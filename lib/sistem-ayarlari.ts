import "server-only";
import { sql } from "./db";
import { ayarAnahtariHazir, gizliCoz, gizliSifrele } from "./kripto";

/**
 * Panelden düzenlenebilen sistem ayarları.
 *
 * Neden veritabanında: SMTP bilgileri sık değişir (sağlayıcı değişir, uygulama
 * şifresi yenilenir) ve bunu yapan kişi sunucuya SSH ile girebilen bir yazılımcı
 * olmak zorunda değil. .env.local'de kalsaydı her değişiklik dosya düzenleme +
 * yeniden başlatma isterdi.
 *
 * Geriye dönük uyum: veritabanında kayıt yoksa .env.local'deki eski
 * SMTP_* değişkenleri kullanılır. Yani mevcut kurulumlar bozulmaz; panelden
 * ilk kayıt yapıldığı anda veritabanı devralır.
 *
 * SMTP şifresi düz metin saklanmaz — AES-256-GCM ile şifrelenir (lib/kripto.ts).
 */

export type TlsKipi = "otomatik" | "ssl" | "starttls";

export type SmtpAyari = {
  host: string;
  port: number;
  kullanici: string;
  /** Çözülmüş açık şifre. Tarayıcıya ASLA gönderilmez. */
  sifre: string;
  gonderen: string;
  tls: TlsKipi;
  /** E-postalardaki bağlantıların alan adı, örn. https://musteripanel.iyiyatirim.org */
  siteAdresi: string;
};

/** Veritabanında duran hâli — şifre kapalı. */
type KayitliSmtp = {
  host?: string;
  port?: number;
  kullanici?: string;
  sifre_sifreli?: string;
  gonderen?: string;
  tls?: TlsKipi;
  siteAdresi?: string;
};

export const VARSAYILAN_GONDEREN = "İyi Yatırım <support@iyiyatirim.org>";

/* ------------------------------------------------------------ okuma/yazma */

async function ayarOku(anahtar: string): Promise<Record<string, unknown> | null> {
  // Tablo henüz kurulmamışsa (eski kurulum, 003 çalıştırılmamış) uygulama
  // çökmemeli — ayar yokmuş gibi davranıp .env'e düşmeli.
  try {
    const s = await sql<{ deger: Record<string, unknown> }[]>`
      SELECT deger FROM sistem_ayarlari WHERE anahtar = ${anahtar} LIMIT 1
    `;
    return s[0]?.deger ?? null;
  } catch {
    return null;
  }
}

async function ayarYaz(
  anahtar: string,
  deger: Record<string, unknown>,
  yoneticiId: number,
): Promise<void> {
  await sql`
    INSERT INTO sistem_ayarlari (anahtar, deger, guncelleme, guncelleyen)
    VALUES (${anahtar}, ${JSON.stringify(deger)}::jsonb, now(), ${yoneticiId})
    ON CONFLICT (anahtar)
    DO UPDATE SET deger = ${JSON.stringify(deger)}::jsonb,
                  guncelleme = now(),
                  guncelleyen = ${yoneticiId}
  `;
}

/* ------------------------------------------------------------------ SMTP */

/** .env.local'deki eski ayarlar — veritabanı boşsa bunlar kullanılır. */
function ortamdanSmtp(): SmtpAyari {
  return {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    kullanici: process.env.SMTP_USER ?? "",
    sifre: process.env.SMTP_PASS ?? "",
    gonderen: process.env.SMTP_FROM ?? VARSAYILAN_GONDEREN,
    tls: "otomatik",
    siteAdresi: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  };
}

export type SmtpKaynak = "veritabani" | "ortam" | "yok";

export type SmtpDurumu = {
  ayar: SmtpAyari;
  kaynak: SmtpKaynak;
  /** Gönderim için gereken alanlar dolu mu. */
  hazir: boolean;
  /**
   * Şifre veritabanında şifreli duruyor ama çözülemedi. Genelde tek sebebi
   * vardır: AYAR_ANAHTARI değişti veya silindi.
   */
  sifreCozulemedi: boolean;
};

export async function smtpDurumu(): Promise<SmtpDurumu> {
  const kayit = (await ayarOku("smtp")) as KayitliSmtp | null;

  if (!kayit || !kayit.host) {
    const ayar = ortamdanSmtp();
    const hazir = Boolean(ayar.host && ayar.kullanici && ayar.sifre);
    return {
      ayar,
      kaynak: hazir ? "ortam" : "yok",
      hazir,
      sifreCozulemedi: false,
    };
  }

  let sifre = "";
  let cozulemedi = false;
  if (kayit.sifre_sifreli) {
    const acik = gizliCoz(kayit.sifre_sifreli);
    if (acik === null) cozulemedi = true;
    else sifre = acik;
  }

  const ayar: SmtpAyari = {
    host: kayit.host,
    port: Number(kayit.port ?? 587),
    kullanici: kayit.kullanici ?? "",
    sifre,
    gonderen: kayit.gonderen || VARSAYILAN_GONDEREN,
    tls: kayit.tls ?? "otomatik",
    siteAdresi: kayit.siteAdresi ?? "",
  };

  return {
    ayar,
    kaynak: "veritabani",
    hazir: Boolean(ayar.host && ayar.kullanici && ayar.sifre),
    sifreCozulemedi: cozulemedi,
  };
}

/**
 * Ayarları kaydeder.
 *
 * `sifre` boş bırakılırsa mevcut şifre korunur — form her açıldığında
 * şifreyi yeniden yazdırmamak için. (Şifre tarayıcıya hiç gönderilmediğinden
 * "boş bırak = değiştirme" tek makul davranış.)
 */
export async function smtpAyariYaz(
  yeni: Omit<SmtpAyari, "sifre"> & { sifre?: string },
  yoneticiId: number,
): Promise<void> {
  const mevcut = (await ayarOku("smtp")) as KayitliSmtp | null;

  let sifreliSifre = mevcut?.sifre_sifreli ?? "";
  if (yeni.sifre) {
    sifreliSifre = gizliSifrele(yeni.sifre); // anahtar yoksa burada hata fırlar
  }

  const kayit: KayitliSmtp = {
    host: yeni.host,
    port: yeni.port,
    kullanici: yeni.kullanici,
    sifre_sifreli: sifreliSifre,
    gonderen: yeni.gonderen,
    tls: yeni.tls,
    siteAdresi: yeni.siteAdresi,
  };

  await ayarYaz("smtp", kayit as unknown as Record<string, unknown>, yoneticiId);
}

/** Şifre değiştirilmek istendiğinde anahtar şart. Formu açmadan önce sorulur. */
export const sirSaklanabilir = ayarAnahtariHazir;
