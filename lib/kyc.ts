import "server-only";
import { sql } from "./db";

/**
 * KYC belgeleri bizim sistemimizde tutulur ve yönetici panelinden onaylanır.
 * ScaleTrade'in KYC API'si kullanılmıyor.
 */

export type BelgeTuru =
  | "kimlik_on"
  | "kimlik_arka"
  | "pasaport"
  | "ikametgah"
  | "banka_dekontu"
  | "diger";

export const BELGE_ETIKET: Record<BelgeTuru, string> = {
  kimlik_on: "Kimlik — ön yüz",
  kimlik_arka: "Kimlik — arka yüz",
  pasaport: "Pasaport",
  ikametgah: "İkametgah belgesi",
  banka_dekontu: "Banka hesap dökümü",
  diger: "Diğer",
};

export type KycDurumu = "beklemede" | "onaylandi" | "reddedildi";

export const KYC_ETIKET: Record<KycDurumu, string> = {
  beklemede: "İncelemede",
  onaylandi: "Onaylandı",
  reddedildi: "Reddedildi",
};

export type KycBelgesi = {
  id: number;
  customer_id: number;
  eposta: string;
  ad_soyad: string | null;
  belge_turu: BelgeTuru;
  dosya_id: number;
  durum: KycDurumu;
  yonetici_notu: string | null;
  olusturma: Date;
  sonuclanma: Date | null;
};

export function belgeTuruGecerliMi(t: string): t is BelgeTuru {
  return t in BELGE_ETIKET;
}

export async function belgeEkle(b: {
  customerId: number;
  eposta: string;
  adSoyad: string | null;
  belgeTuru: BelgeTuru;
  dosyaId: number;
}): Promise<number> {
  const s = await sql<{ id: number }[]>`
    INSERT INTO kyc_belgeleri
      (customer_id, eposta, ad_soyad, belge_turu, dosya_id)
    VALUES (${b.customerId}, ${b.eposta}, ${b.adSoyad}, ${b.belgeTuru}, ${b.dosyaId})
    RETURNING id
  `;
  return Number(s[0].id);
}

export function musteriBelgeleri(customerId: number) {
  return sql<(KycBelgesi & { orijinal_ad: string; mime: string })[]>`
    SELECT k.*, d.orijinal_ad, d.mime
      FROM kyc_belgeleri k
      JOIN dosyalar d ON d.id = k.dosya_id
     WHERE k.customer_id = ${customerId}
     ORDER BY k.olusturma DESC
  `;
}

export function yoneticiBelgeleri(f: { durum?: KycDurumu; arama?: string }) {
  const arama = f.arama?.trim();
  return sql<(KycBelgesi & { orijinal_ad: string; mime: string; boyut: number })[]>`
    SELECT k.*, d.orijinal_ad, d.mime, d.boyut
      FROM kyc_belgeleri k
      JOIN dosyalar d ON d.id = k.dosya_id
     WHERE true
       ${f.durum ? sql`AND k.durum = ${f.durum}` : sql``}
       ${
         arama
           ? sql`AND (k.eposta ILIKE ${"%" + arama + "%"}
                   OR k.ad_soyad ILIKE ${"%" + arama + "%"}
                   OR k.customer_id::text = ${arama})`
           : sql``
       }
     ORDER BY
       CASE WHEN k.durum = 'beklemede' THEN 0 ELSE 1 END,
       k.olusturma DESC
     LIMIT 300
  `;
}

/** Yalnızca bekleyen belgeler sonuçlandırılabilir (çift işlem koruması). */
export async function belgeSonuclandir(
  id: number,
  durum: Exclude<KycDurumu, "beklemede">,
  yoneticiId: number,
  not: string | null,
): Promise<boolean> {
  const s = await sql<{ id: number }[]>`
    UPDATE kyc_belgeleri
       SET durum = ${durum},
           yonetici_notu = ${not},
           islem_yapan = ${yoneticiId},
           sonuclanma = now()
     WHERE id = ${id} AND durum = 'beklemede'
    RETURNING id
  `;
  return s.length > 0;
}

/** Müşterinin genel KYC durumu — panelde tek satırlık özet için. */
export async function kycOzeti(customerId: number) {
  const s = await sql<{ durum: KycDurumu; adet: number }[]>`
    SELECT durum, COUNT(*)::int AS adet
      FROM kyc_belgeleri
     WHERE customer_id = ${customerId}
     GROUP BY durum
  `;
  const bul = (d: KycDurumu) => s.find((x) => x.durum === d)?.adet ?? 0;
  return {
    beklemede: bul("beklemede"),
    onaylandi: bul("onaylandi"),
    reddedildi: bul("reddedildi"),
    toplam: s.reduce((t, x) => t + x.adet, 0),
  };
}
