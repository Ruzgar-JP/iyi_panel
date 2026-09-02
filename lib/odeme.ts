import "server-only";
import { sql } from "./db";

/**
 * Ödeme yöntemleri — banka hesapları ve kripto cüzdanları.
 * Yönetici panelinden eklenir/çıkarılır; müşteri para yatırırken buradan seçer.
 */

export type YontemTipi = "banka" | "kripto";

export type BankaDetay = {
  banka?: string;
  hesap_sahibi?: string;
  iban?: string;
  sube?: string;
};

export type KriptoDetay = {
  ag?: string; // TRC20, ERC20, BEP20 ...
  adres?: string;
  etiket?: string; // memo / destination tag
};

export type OdemeYontemi = {
  id: number;
  tip: YontemTipi;
  ad: string;
  para_birimi: string;
  detaylar: BankaDetay & KriptoDetay;
  aciklama: string | null;
  yatirima_acik: boolean;
  cekime_acik: boolean;
  aktif: boolean;
  sira: number;
};

/** Müşteriye gösterilecek yöntemler. */
export function acikYontemler(amac: "yatirim" | "cekim") {
  return sql<OdemeYontemi[]>`
    SELECT * FROM odeme_yontemleri
     WHERE aktif = true
       ${amac === "yatirim" ? sql`AND yatirima_acik = true` : sql`AND cekime_acik = true`}
     ORDER BY sira, ad
  `;
}

/** Yönetici panelinde hepsi (pasifler dahil). */
export function tumYontemler() {
  return sql<OdemeYontemi[]>`
    SELECT * FROM odeme_yontemleri ORDER BY aktif DESC, sira, ad
  `;
}

export async function yontemGetir(id: number): Promise<OdemeYontemi | null> {
  const s = await sql<OdemeYontemi[]>`
    SELECT * FROM odeme_yontemleri WHERE id = ${id} LIMIT 1
  `;
  return s[0] ?? null;
}

export async function yontemEkle(y: {
  tip: YontemTipi;
  ad: string;
  paraBirimi: string;
  detaylar: Record<string, string>;
  aciklama?: string | null;
  yatirimaAcik: boolean;
  cekimeAcik: boolean;
  sira?: number;
}): Promise<number> {
  const s = await sql<{ id: number }[]>`
    INSERT INTO odeme_yontemleri
      (tip, ad, para_birimi, detaylar, aciklama, yatirima_acik, cekime_acik, sira)
    VALUES (${y.tip}, ${y.ad}, ${y.paraBirimi},
            ${JSON.stringify(y.detaylar)}::jsonb, ${y.aciklama ?? null},
            ${y.yatirimaAcik}, ${y.cekimeAcik}, ${y.sira ?? 0})
    RETURNING id
  `;
  return Number(s[0].id);
}

export async function yontemGuncelle(
  id: number,
  y: {
    ad: string;
    paraBirimi: string;
    detaylar: Record<string, string>;
    aciklama?: string | null;
    yatirimaAcik: boolean;
    cekimeAcik: boolean;
    aktif: boolean;
    sira?: number;
  },
): Promise<void> {
  await sql`
    UPDATE odeme_yontemleri
       SET ad = ${y.ad},
           para_birimi = ${y.paraBirimi},
           detaylar = ${JSON.stringify(y.detaylar)}::jsonb,
           aciklama = ${y.aciklama ?? null},
           yatirima_acik = ${y.yatirimaAcik},
           cekime_acik = ${y.cekimeAcik},
           aktif = ${y.aktif},
           sira = ${y.sira ?? 0},
           guncelleme = now()
     WHERE id = ${id}
  `;
}

/**
 * Yöntem silinir. Geçmiş talepler etkilenmez: talep oluşturulurken
 * yöntemin o anki hâli `yontem_ozeti` alanına kopyalanmıştır.
 */
export async function yontemSil(id: number): Promise<void> {
  await sql`DELETE FROM odeme_yontemleri WHERE id = ${id}`;
}

/** Talebe kopyalanacak özet — yöntem sonradan silinse bile kayıt bozulmaz. */
export function yontemOzeti(y: OdemeYontemi): Record<string, unknown> {
  return {
    id: y.id,
    tip: y.tip,
    ad: y.ad,
    para_birimi: y.para_birimi,
    detaylar: y.detaylar,
  };
}

/** Tipe göre hangi detay alanlarının tutulacağı — fazlası atılır. */
const ALANLAR: Record<YontemTipi, string[]> = {
  banka: ["banka", "hesap_sahibi", "iban", "sube"],
  kripto: ["ag", "adres", "etiket"],
};

/** İstemciden gelen ham detayları temizler; yalnızca bilinen alanlar kalır. */
export function detaylariAyikla(
  tip: YontemTipi,
  ham: Record<string, unknown>,
): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const alan of ALANLAR[tip]) {
    const deger = ham[alan];
    if (typeof deger === "string" && deger.trim()) {
      cikti[alan] = deger.trim().slice(0, 300);
    }
  }
  return cikti;
}

/** Yöntemi tek satırda okunur biçimde gösterir. */
export function yontemMetni(tip: string, detaylar: BankaDetay & KriptoDetay): string {
  if (tip === "banka") {
    return [detaylar.banka, detaylar.hesap_sahibi, detaylar.iban]
      .filter(Boolean)
      .join(" · ");
  }
  return [detaylar.ag, detaylar.adres].filter(Boolean).join(" · ");
}
