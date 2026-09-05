import "server-only";
import { cookies } from "next/headers";

import { sql } from "./db";
import { OTURUM } from "./ayarlar";
import { jetonOzeti, jetonUret } from "./kripto";
import { hesapGorunumleriniDiziyeCevir, type HesapGorunumu } from "./hesap-gorunumu";
import type { Musteri } from "./musteri";

/**
 * Girişte alınan hesap + bakiye görüntüsü.
 *
 * Hesap bilgisi artık ScaleTrade'in müşteri oturumundan değil, kendi
 * musteri_hesaplari tablomuzdan geliyor; bakiye yönetici token'ıyla okunuyor.
 */
export type { HesapGorunumu } from "./hesap-gorunumu";

/**
 * Oturumlar veritabanında tutulur; tarayıcıya yalnızca opak bir jeton gider.
 *
 * Bunun iki faydası var:
 *  1. ScaleTrade JWT'si tarayıcıya hiç inmez.
 *  2. Platformun JWT'sindeki bozuk "exp" alanı (üretim anına eşit) bizi
 *     bağlamaz — oturum ömrünü kendi tablomuzdan yönetiriz.
 */

const CEREZ_AYARI = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/* ------------------------------------------------------------- müşteri */

export type MusteriOturumu = {
  id: number;
  /** Bizim veritabanımızdaki müşteri kimliği. */
  musteriId: number;
  eposta: string;
  adSoyad: string | null;
  hesaplar: HesapGorunumu[];
  bakiyeZamani: Date | null;
  /** Terminal için işlem hesabı oturumu; tarayıcıya doğrudan verilmez. */
  stToken: string | null;
};

export async function musteriOturumAc(
  m: Musteri,
  hesaplar: HesapGorunumu[],
  ip: string | null,
  stToken?: string | null,
): Promise<void> {
  const jeton = jetonUret();
  const bitis = new Date(Date.now() + OTURUM.musteriSaat * 3600_000);
  const adSoyad = `${m.ad} ${m.soyad}`.trim();

  await sql`
    INSERT INTO musteri_oturumlari
      (cerez_hash, musteri_id, customer_id, eposta, ad_soyad, st_token,
       hesaplar, bakiye_zamani, ip, bitis)
    VALUES (${jetonOzeti(jeton)}, ${m.id}, ${m.st_customer_id ?? 0}, ${m.eposta},
            ${adSoyad}, ${stToken ?? null},
            ${sql.json(hesaplar)}, now(), ${ip}, ${bitis})
  `;

  (await cookies()).set(OTURUM.musteriCerez, jeton, { ...CEREZ_AYARI, expires: bitis });
}

/** Geçerli müşteri oturumunu döner; yoksa null. */
export async function musteriOturumu(): Promise<MusteriOturumu | null> {
  const jeton = (await cookies()).get(OTURUM.musteriCerez)?.value;
  if (!jeton) return null;

  const satirlar = await sql<
    {
      id: number;
      musteri_id: number;
      eposta: string;
      ad_soyad: string | null;
      hesaplar: unknown;
      bakiye_zamani: Date | null;
      st_token: string | null;
    }[]
  >`
    SELECT o.id, o.musteri_id, o.eposta, o.ad_soyad, o.hesaplar, o.bakiye_zamani,
           o.st_token
      FROM musteri_oturumlari o
      JOIN musteriler m ON m.id = o.musteri_id
     WHERE o.cerez_hash = ${jetonOzeti(jeton)}
       AND o.bitis > now()
       AND m.aktif = true
     LIMIT 1
  `;

  const s = satirlar[0];
  if (!s) return null;

  await sql`UPDATE musteri_oturumlari SET son_gorulme = now() WHERE id = ${s.id}`;

  return {
    id: Number(s.id),
    musteriId: Number(s.musteri_id),
    eposta: s.eposta,
    adSoyad: s.ad_soyad,
    hesaplar: hesapGorunumleriniDiziyeCevir(s.hesaplar),
    bakiyeZamani: s.bakiye_zamani,
    stToken: s.st_token,
  };
}

/** Çekim ekranında bakiye yenilendiğinde oturumdaki görüntüyü de tazeler. */
export async function oturumBakiyeGuncelle(
  oturumId: number,
  hesaplar: HesapGorunumu[],
): Promise<void> {
  await sql`
    UPDATE musteri_oturumlari
       SET hesaplar = ${sql.json(hesaplar)},
           bakiye_zamani = now()
     WHERE id = ${oturumId}
  `;
}

export async function musteriOturumKapat(): Promise<void> {
  const cerezler = await cookies();
  const jeton = cerezler.get(OTURUM.musteriCerez)?.value;

  if (jeton) {
    await sql`DELETE FROM musteri_oturumlari WHERE cerez_hash = ${jetonOzeti(jeton)}`;
  }
  cerezler.delete(OTURUM.musteriCerez);
}

/** Müşterinin tüm oturumlarını kapatır (şifre değişiminden sonra). */
export async function musteriTumOturumlariKapat(musteriId: number): Promise<void> {
  await sql`DELETE FROM musteri_oturumlari WHERE musteri_id = ${musteriId}`;
}

/* ------------------------------------------------------------ yönetici */

export type YoneticiOturumu = {
  id: number;
  yoneticiId: number;
  eposta: string;
  adSoyad: string;
  rol: "operator" | "yonetici";
};

export async function yoneticiOturumAc(
  yoneticiId: number,
  ip: string | null,
): Promise<void> {
  const jeton = jetonUret();
  const bitis = new Date(Date.now() + OTURUM.yoneticiSaat * 3600_000);

  await sql`
    INSERT INTO yonetici_oturumlari (cerez_hash, yonetici_id, ip, bitis)
    VALUES (${jetonOzeti(jeton)}, ${yoneticiId}, ${ip}, ${bitis})
  `;
  await sql`UPDATE yoneticiler SET son_giris = now() WHERE id = ${yoneticiId}`;

  (await cookies()).set(OTURUM.yoneticiCerez, jeton, { ...CEREZ_AYARI, expires: bitis });
}

export async function yoneticiOturumu(): Promise<YoneticiOturumu | null> {
  const jeton = (await cookies()).get(OTURUM.yoneticiCerez)?.value;
  if (!jeton) return null;

  const satirlar = await sql<
    {
      id: number;
      yonetici_id: number;
      eposta: string;
      ad_soyad: string;
      rol: "operator" | "yonetici";
    }[]
  >`
    SELECT o.id, o.yonetici_id, y.eposta, y.ad_soyad, y.rol
      FROM yonetici_oturumlari o
      JOIN yoneticiler y ON y.id = o.yonetici_id
     WHERE o.cerez_hash = ${jetonOzeti(jeton)}
       AND o.bitis > now()
       AND y.aktif = true
     LIMIT 1
  `;

  const s = satirlar[0];
  if (!s) return null;

  return {
    id: Number(s.id),
    yoneticiId: Number(s.yonetici_id),
    eposta: s.eposta,
    adSoyad: s.ad_soyad,
    rol: s.rol,
  };
}

export async function yoneticiOturumKapat(): Promise<void> {
  const cerezler = await cookies();
  const jeton = cerezler.get(OTURUM.yoneticiCerez)?.value;

  if (jeton) {
    await sql`DELETE FROM yonetici_oturumlari WHERE cerez_hash = ${jetonOzeti(jeton)}`;
  }
  cerezler.delete(OTURUM.yoneticiCerez);
}

/* -------------------------------------------------------------- ortak */

/** Süresi dolmuş oturumları siler. Giriş işlemlerinde tetiklenir. */
export async function suresiDolanlariSil(): Promise<void> {
  await sql`DELETE FROM musteri_oturumlari  WHERE bitis < now()`;
  await sql`DELETE FROM yonetici_oturumlari WHERE bitis < now()`;
}

/** Ters vekil arkasındaki gerçek istemci IP'si. */
export function istemciIp(basliklar: Headers): string | null {
  return (
    basliklar.get("cf-connecting-ip") ??
    basliklar.get("x-forwarded-for")?.split(",")[0].trim() ??
    basliklar.get("x-real-ip") ??
    null
  );
}

/** İşlem kaydı — para taleplerinde denetim izi zorunlu. */
export async function kayitYaz(k: {
  yoneticiId?: number | null;
  customerId?: number | null;
  eylem: string;
  hedefTur?: string | null;
  hedefId?: number | null;
  detay?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO islem_kayitlari
      (yonetici_id, customer_id, eylem, hedef_tur, hedef_id, detay, ip)
    VALUES (${k.yoneticiId ?? null}, ${k.customerId ?? null}, ${k.eylem},
            ${k.hedefTur ?? null}, ${k.hedefId ?? null},
            ${JSON.stringify(k.detay ?? {})}::jsonb, ${k.ip ?? null})
  `;
}
