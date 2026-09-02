import "server-only";
import { sql } from "./db";
import { LIMIT } from "./ayarlar";
import type { Bakiye } from "./scaletrade";

/**
 * Para yatırma / çekme TALEPLERİ.
 *
 * Burada hiçbir bakiye hareketi yapılmaz. Talep bir kayıttır; parayı
 * gerçekten hesaba ekleyen veya çıkaran işlem BackOffice'te insan eliyle
 * yapılır. Onaylandı durumu "para taşındı" değil, "yönetici bu talebi
 * uygun buldu ve işledi" anlamına gelir.
 */

export type TalepTipi = "yatirim" | "cekim";
export type TalepDurumu = "beklemede" | "onaylandi" | "reddedildi" | "iptal";

export const DURUM_ETIKET: Record<TalepDurumu, string> = {
  beklemede: "Beklemede",
  onaylandi: "Onaylandı",
  reddedildi: "Reddedildi",
  iptal: "İptal edildi",
};

export type Talep = {
  id: number;
  tip: TalepTipi;
  durum: TalepDurumu;
  customer_id: number;
  eposta: string;
  ad_soyad: string | null;
  login: number;
  tutar: string;
  para_birimi: string;
  odeme_yontemi_id: number | null;
  yontem_ozeti: Record<string, unknown>;
  hedef_hesap: string | null;
  bakiye_anlik: Bakiye | null;
  musteri_notu: string | null;
  yonetici_notu: string | null;
  dekont_id: number | null;
  olusturma: Date;
  guncelleme: Date;
  sonuclanma: Date | null;
};

/* ------------------------------------------------- bakiye sorgu beklemesi */

export type BeklemeDurumu = { izinli: boolean; kalanSn: number };

/**
 * Çekim ekranında bakiye canlı sorgulanıyor. Platformu yormamak için
 * müşteri başına bekleme süresi uygulanır; arayüz kalan süreyi gösterir.
 */
export async function bakiyeSorgulanabilirMi(
  customerId: number,
): Promise<BeklemeDurumu> {
  const satir = await sql<{ kalan: number }[]>`
    SELECT GREATEST(
             0,
             ${LIMIT.bakiyeBeklemeSn}
               - EXTRACT(EPOCH FROM (now() - son_sorgu))
           )::int AS kalan
      FROM bakiye_sorgulari
     WHERE customer_id = ${customerId}
  `;

  const kalan = satir[0]?.kalan ?? 0;
  return { izinli: kalan <= 0, kalanSn: kalan };
}

export async function bakiyeSorgusuKaydet(customerId: number): Promise<void> {
  await sql`
    INSERT INTO bakiye_sorgulari (customer_id, son_sorgu, adet)
    VALUES (${customerId}, now(), 1)
    ON CONFLICT (customer_id)
    DO UPDATE SET son_sorgu = now(), adet = bakiye_sorgulari.adet + 1
  `;
}

/* --------------------------------------------------- çekim ön koşulları */

export type CekimKontrolu =
  | { uygun: true }
  | { uygun: false; sebep: string; kalanDk?: number };

/**
 * Çekim talebi oluşturulabilir mi:
 *  - aynı anda çok sayıda açık talep olmamalı
 *  - iki talep arasında bekleme süresi dolmuş olmalı
 */
export async function cekimYapilabilirMi(customerId: number): Promise<CekimKontrolu> {
  const acik = await sql<{ adet: number }[]>`
    SELECT COUNT(*)::int AS adet
      FROM talepler
     WHERE customer_id = ${customerId}
       AND tip = 'cekim'
       AND durum = 'beklemede'
  `;

  if ((acik[0]?.adet ?? 0) >= LIMIT.aciCekimAdedi) {
    return {
      uygun: false,
      sebep:
        LIMIT.aciCekimAdedi === 1
          ? "Bekleyen bir çekim talebiniz var. Sonuçlanmadan yeni talep oluşturamazsınız."
          : `Aynı anda en fazla ${LIMIT.aciCekimAdedi} çekim talebiniz olabilir.`,
    };
  }

  const son = await sql<{ kalan: number }[]>`
    SELECT GREATEST(
             0,
             ${LIMIT.cekimBeklemeDk} - EXTRACT(EPOCH FROM (now() - olusturma)) / 60
           )::int AS kalan
      FROM talepler
     WHERE customer_id = ${customerId} AND tip = 'cekim'
     ORDER BY olusturma DESC
     LIMIT 1
  `;

  const kalanDk = son[0]?.kalan ?? 0;
  if (kalanDk > 0) {
    return {
      uygun: false,
      sebep: `Yeni çekim talebi için ${kalanDk} dakika beklemeniz gerekiyor.`,
      kalanDk,
    };
  }

  return { uygun: true };
}

/**
 * Çekilebilir tutar.
 *
 * Serbest teminattan (margin_free) başlanır — açık pozisyonlarda kilitli
 * teminat çekilemez.
 *
 * Ayrıca müşterinin parası OLMAYAN kalemler düşülür:
 *   - bonus  : kampanya bakiyesi
 *   - kredi  : brokerin verdiği limit
 * İkisi de equity'ye dahil olduğu için margin_free'yi şişirir; düşülmezse
 * müşteri kendisine ait olmayan tutarı nakde çevirebilir.
 */
export function cekilebilirTutar(bakiye: Bakiye): number {
  const dusulecek =
    (LIMIT.bonusDus ? (bakiye.bonus ?? 0) : 0) +
    (LIMIT.krediDus ? (bakiye.credit ?? 0) : 0);
  return Math.max(0, bakiye.margin_free - dusulecek);
}

/** Çekilemeyen kalemler — arayüzde ayrı ayrı gösterilir. */
export function cekilemeyenKalemler(bakiye: Bakiye): { etiket: string; tutar: number }[] {
  const k: { etiket: string; tutar: number }[] = [];
  if (LIMIT.bonusDus && (bakiye.bonus ?? 0) > 0)
    k.push({ etiket: "Bonus", tutar: bakiye.bonus ?? 0 });
  if (LIMIT.krediDus && (bakiye.credit ?? 0) > 0)
    k.push({ etiket: "Kredi", tutar: bakiye.credit ?? 0 });
  if (bakiye.margin > 0) k.push({ etiket: "Kullanılan teminat", tutar: bakiye.margin });
  return k;
}

/** Tutar sınırları ve serbest teminat kontrolü. */
export function cekimTutariGecerliMi(
  tutar: number,
  bakiye: Bakiye,
): { gecerli: true } | { gecerli: false; sebep: string } {
  if (!Number.isFinite(tutar) || tutar <= 0) {
    return { gecerli: false, sebep: "Geçerli bir tutar girin." };
  }
  if (tutar < LIMIT.minTutar) {
    return { gecerli: false, sebep: `En düşük çekim tutarı ${LIMIT.minTutar}.` };
  }
  if (tutar > LIMIT.maxTutar) {
    return { gecerli: false, sebep: `En yüksek çekim tutarı ${LIMIT.maxTutar}.` };
  }
  const cekilebilir = cekilebilirTutar(bakiye);
  if (tutar > cekilebilir) {
    const kalemler = cekilemeyenKalemler(bakiye).map((k) => k.etiket.toLowerCase());
    return {
      gecerli: false,
      sebep:
        `Çekilebilir tutarınız ${cekilebilir.toFixed(2)}.` +
        (kalemler.length ? ` ${kalemler.join(", ")} çekilemez.` : ""),
    };
  }
  return { gecerli: true };
}

/* ------------------------------------------------------------ oluşturma */

export async function talepOlustur(t: {
  tip: TalepTipi;
  customerId: number;
  eposta: string;
  adSoyad: string | null;
  login: number;
  tutar: number;
  paraBirimi: string;
  odemeYontemiId: number | null;
  yontemOzeti: Record<string, unknown>;
  hedefHesap?: string | null;
  bakiyeAnlik?: Bakiye | null;
  musteriNotu?: string | null;
  dekontId?: number | null;
}): Promise<number> {
  const satir = await sql<{ id: number }[]>`
    INSERT INTO talepler
      (tip, customer_id, eposta, ad_soyad, login, tutar, para_birimi,
       odeme_yontemi_id, yontem_ozeti, hedef_hesap, bakiye_anlik,
       musteri_notu, dekont_id)
    VALUES
      (${t.tip}, ${t.customerId}, ${t.eposta}, ${t.adSoyad}, ${t.login},
       ${t.tutar}, ${t.paraBirimi}, ${t.odemeYontemiId},
       ${JSON.stringify(t.yontemOzeti)}::jsonb, ${t.hedefHesap ?? null},
       ${t.bakiyeAnlik ? JSON.stringify(t.bakiyeAnlik) : null}::jsonb,
       ${t.musteriNotu ?? null}, ${t.dekontId ?? null})
    RETURNING id
  `;
  return Number(satir[0].id);
}

/* -------------------------------------------------------------- listeler */

export function musteriTalepleri(customerId: number, tip?: TalepTipi) {
  return sql<Talep[]>`
    SELECT * FROM talepler
     WHERE customer_id = ${customerId}
       ${tip ? sql`AND tip = ${tip}` : sql``}
     ORDER BY olusturma DESC
     LIMIT 200
  `;
}

export function yoneticiTalepleri(f: {
  tip?: TalepTipi;
  durum?: TalepDurumu;
  arama?: string;
  limit?: number;
}) {
  const arama = f.arama?.trim();
  return sql<Talep[]>`
    SELECT * FROM talepler
     WHERE true
       ${f.tip ? sql`AND tip = ${f.tip}` : sql``}
       ${f.durum ? sql`AND durum = ${f.durum}` : sql``}
       ${
         arama
           ? sql`AND (eposta ILIKE ${"%" + arama + "%"}
                   OR ad_soyad ILIKE ${"%" + arama + "%"}
                   OR login::text = ${arama}
                   OR id::text = ${arama})`
           : sql``
       }
     ORDER BY
       CASE WHEN durum = 'beklemede' THEN 0 ELSE 1 END,
       olusturma DESC
     LIMIT ${f.limit ?? 200}
  `;
}

export async function talepGetir(id: number): Promise<Talep | null> {
  const s = await sql<Talep[]>`SELECT * FROM talepler WHERE id = ${id} LIMIT 1`;
  return s[0] ?? null;
}

/** Bekleyen talep sayıları — yönetici panelindeki rozetler için. */
export async function bekleyenSayilari() {
  const s = await sql<{ tip: TalepTipi; adet: number }[]>`
    SELECT tip, COUNT(*)::int AS adet
      FROM talepler
     WHERE durum = 'beklemede'
     GROUP BY tip
  `;
  const kyc = await sql<{ adet: number }[]>`
    SELECT COUNT(*)::int AS adet FROM kyc_belgeleri WHERE durum = 'beklemede'
  `;
  return {
    yatirim: s.find((x) => x.tip === "yatirim")?.adet ?? 0,
    cekim: s.find((x) => x.tip === "cekim")?.adet ?? 0,
    kyc: kyc[0]?.adet ?? 0,
  };
}

/* ----------------------------------------------------- durum değiştirme */

/**
 * Talebi sonuçlandırır. Yalnızca "beklemede" olan talepler değiştirilebilir —
 * böylece iki yönetici aynı anda işlem yaparsa ikincisi sessizce üzerine
 * yazmaz, 0 satır güncellenir ve çağıran taraf bunu görür.
 */
export async function talepSonuclandir(
  id: number,
  durum: Exclude<TalepDurumu, "beklemede">,
  yoneticiId: number,
  not: string | null,
): Promise<boolean> {
  const s = await sql<{ id: number }[]>`
    UPDATE talepler
       SET durum = ${durum},
           yonetici_notu = ${not},
           islem_yapan = ${yoneticiId},
           sonuclanma = now(),
           guncelleme = now()
     WHERE id = ${id} AND durum = 'beklemede'
    RETURNING id
  `;
  return s.length > 0;
}

/** Müşteri kendi bekleyen talebini iptal edebilir. */
export async function talepIptalEt(id: number, customerId: number): Promise<boolean> {
  const s = await sql<{ id: number }[]>`
    UPDATE talepler
       SET durum = 'iptal', sonuclanma = now(), guncelleme = now()
     WHERE id = ${id}
       AND customer_id = ${customerId}
       AND durum = 'beklemede'
    RETURNING id
  `;
  return s.length > 0;
}
