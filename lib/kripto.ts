import "server-only";
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  sifre: string | Buffer,
  tuz: string | Buffer,
  uzunluk: number,
) => Promise<Buffer>;

/* ---------------------------------------------------------- yönetici şifresi */

/** scrypt ile şifre özeti üretir. Biçim: scrypt$<tuz-hex>$<ozet-hex> */
export async function sifreOzetle(sifre: string): Promise<string> {
  const tuz = randomBytes(16);
  const ozet = await scryptAsync(sifre.normalize("NFKC"), tuz, 64);
  return `scrypt$${tuz.toString("hex")}$${ozet.toString("hex")}`;
}

/** Sabit süreli karşılaştırma — zamanlama saldırısına kapalı. */
export async function sifreDogrula(sifre: string, kayit: string): Promise<boolean> {
  const parcalar = kayit.split("$");
  if (parcalar.length !== 3 || parcalar[0] !== "scrypt") return false;

  const tuz = Buffer.from(parcalar[1], "hex");
  const beklenen = Buffer.from(parcalar[2], "hex");
  const hesaplanan = await scryptAsync(sifre.normalize("NFKC"), tuz, beklenen.length);

  return (
    hesaplanan.length === beklenen.length && timingSafeEqual(hesaplanan, beklenen)
  );
}

/* ------------------------------------------------------------ oturum çerezi */

/** Tahmin edilemez oturum jetonu (tarayıcıya bu gider). */
export function jetonUret(): string {
  return randomBytes(32).toString("base64url");
}

/** Veritabanına jetonun kendisi değil, özeti yazılır. */
export function jetonOzeti(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/* ------------------------------------------------------------- sır saklama */

/**
 * Veritabanına yazılacak sırların (SMTP şifresi gibi) şifrelenmesi.
 *
 * Şifre özetinden (scrypt) farkı: özet geri çevrilemez, burada ise değeri
 * kullanmak için geri okumamız gerekiyor. Bu yüzden AES-256-GCM kullanılıyor.
 * GCM aynı zamanda bütünlük de doğrular — kayıt kurcalanırsa çözme başarısız
 * olur, sessizce yanlış değer dönmez.
 *
 * Anahtar AYAR_ANAHTARI ortam değişkeninden gelir (32 bayt, base64):
 *   openssl rand -base64 32
 *
 * Böylece veritabanı yedeği tek başına ele geçse bile sırlar okunamaz;
 * anahtar sunucudaki .env.local dosyasındadır.
 */

const ETIKET = "aes256gcm";

/** Ham anahtarı verir; tanımsız/geçersizse null (çağıran karar verir). */
function anahtar(): Buffer | null {
  const ham = process.env.AYAR_ANAHTARI;
  if (!ham) return null;

  let bayt: Buffer;
  try {
    bayt = Buffer.from(ham, "base64");
  } catch {
    return null;
  }
  return bayt.length === 32 ? bayt : null;
}

/** AYAR_ANAHTARI kurulu ve doğru uzunlukta mı. */
export function ayarAnahtariHazir(): boolean {
  return anahtar() !== null;
}

/** Biçim: aes256gcm$<iv-base64>$<etiket-base64>$<şifreli-base64> */
export function gizliSifrele(acikMetin: string): string {
  const k = anahtar();
  if (!k) {
    throw new Error(
      "AYAR_ANAHTARI tanımlı değil — sır güvenli şekilde saklanamaz. " +
        "Kurulum kılavuzuna bakın (openssl rand -base64 32).",
    );
  }

  const iv = randomBytes(12); // GCM için önerilen uzunluk
  const sifreleyici = createCipheriv("aes-256-gcm", k, iv);
  const sifreli = Buffer.concat([
    sifreleyici.update(acikMetin, "utf8"),
    sifreleyici.final(),
  ]);

  return [
    ETIKET,
    iv.toString("base64"),
    sifreleyici.getAuthTag().toString("base64"),
    sifreli.toString("base64"),
  ].join("$");
}

/**
 * Şifreli değeri çözer. Anahtar yoksa, kayıt bozuksa veya anahtar
 * değiştirilmişse null döner — çağıran "SMTP şifresi okunamadı" diye
 * anlaşılır bir hata gösterir.
 */
export function gizliCoz(kayit: string): string | null {
  const k = anahtar();
  if (!k) return null;

  const p = kayit.split("$");
  if (p.length !== 4 || p[0] !== ETIKET) return null;

  try {
    const cozucu = createDecipheriv("aes-256-gcm", k, Buffer.from(p[1], "base64"));
    cozucu.setAuthTag(Buffer.from(p[2], "base64"));
    return Buffer.concat([
      cozucu.update(Buffer.from(p[3], "base64")),
      cozucu.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
