import "server-only";
import { sql } from "./db";
import { IZINLI_DOSYA, LIMIT } from "./ayarlar";

/**
 * Yüklenen dosyalar (KYC belgeleri, yatırım dekontları) veritabanında
 * bytea olarak tutulur. Ek servis gerekmez, yedekleme veritabanıyla gelir.
 * Hacim çok büyürse nesne depolamaya taşınmalı — arayüz aynı kalır.
 */

export type DosyaKaydi = {
  id: number;
  customer_id: number;
  orijinal_ad: string;
  mime: string;
  boyut: number;
};

export type YuklemeSonucu =
  | { ok: true; id: number }
  | { ok: false; hata: string };

/** Dosya imzasına bakarak gerçek türü doğrular — uzantıya güvenilmez. */
function imzaUyuyorMu(bayt: Uint8Array, mime: string): boolean {
  const b = bayt;
  if (b.length < 4) return false;

  switch (mime) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png":
      return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    case "image/webp":
      return (
        b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
      );
    case "image/heic":
      // ftyp kutusu 4. bayttan başlar
      return b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
    case "application/pdf":
      return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;
    default:
      return false;
  }
}

export async function dosyaYukle(
  customerId: number,
  dosya: File,
): Promise<YuklemeSonucu> {
  if (dosya.size === 0) return { ok: false, hata: "Dosya boş." };

  if (dosya.size > LIMIT.maxDosyaBayt) {
    const mb = Math.round(LIMIT.maxDosyaBayt / 1024 / 1024);
    return { ok: false, hata: `Dosya çok büyük. En fazla ${mb} MB yükleyebilirsiniz.` };
  }

  const mime = dosya.type;
  if (!IZINLI_DOSYA[mime]) {
    return {
      ok: false,
      hata: "Yalnızca JPG, PNG, WEBP, HEIC ve PDF dosyaları yükleyebilirsiniz.",
    };
  }

  const bayt = new Uint8Array(await dosya.arrayBuffer());
  if (!imzaUyuyorMu(bayt, mime)) {
    return { ok: false, hata: "Dosya içeriği uzantısıyla uyuşmuyor." };
  }

  // Dosya adını temizle. Bu ad indirirken Content-Disposition başlığına
  // filename="..." olarak yazılıyor; tırnak veya satır sonu kalırsa saldırgan
  // başlığı bölebilir. Bu yüzden güvenli olmayan her karakter atılır.
  const ad =
    (dosya.name || "belge")
      // kontrol karakterleri, tırnak, yol ayraçları
      .replace(/[\u0000-\u001f\u007f"\\/]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 180) || "belge";

  const satir = await sql<{ id: number }[]>`
    INSERT INTO dosyalar (customer_id, orijinal_ad, mime, boyut, icerik)
    VALUES (${customerId}, ${ad}, ${mime}, ${dosya.size}, ${Buffer.from(bayt)})
    RETURNING id
  `;

  return { ok: true, id: Number(satir[0].id) };
}

/**
 * Dosyayı okur. customerId verilirse yalnızca o müşterinin dosyası döner —
 * müşteri tarafındaki indirmelerde bu parametre ZORUNLU, yoksa bir müşteri
 * id değiştirerek başkasının belgesini indirebilir.
 */
export async function dosyaOku(
  id: number,
  customerId?: number,
): Promise<(DosyaKaydi & { icerik: Buffer }) | null> {
  const s = await sql<(DosyaKaydi & { icerik: Buffer })[]>`
    SELECT id, customer_id, orijinal_ad, mime, boyut, icerik
      FROM dosyalar
     WHERE id = ${id}
       ${customerId !== undefined ? sql`AND customer_id = ${customerId}` : sql``}
     LIMIT 1
  `;
  return s[0] ?? null;
}
