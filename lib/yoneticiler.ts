import "server-only";
import { sql } from "./db";
import { sifreOzetle } from "./kripto";

/**
 * Yönetim paneli kullanıcıları.
 *
 * İki rol var (db/schema.sql'deki CHECK ile sınırlı):
 *
 *   yonetici — her şeyi yapar; personel ekler/çıkarır, şifre sıfırlar
 *   operator — günlük iş: talep onayı, belge, müşteri. Kullanıcı yönetimine
 *              giremez.
 *
 * SİLME yerine PASİFE ALMA tercih edilir: taleplerde ve belgelerde "kim
 * onayladı" bilgisi bu satıra bağlıdır (islem_yapan). Satır silinince o bilgi
 * NULL'a düşer, denetim izi kopar. Bu yüzden yalnızca hiç işlem yapmamış
 * (yanlışlıkla açılmış) bir kullanıcı silinebilir.
 */

export type Rol = "operator" | "yonetici";

export type Yonetici = {
  id: number;
  eposta: string;
  ad_soyad: string;
  rol: Rol;
  aktif: boolean;
  olusturma: Date;
  son_giris: Date | null;
};

export function tumYoneticiler() {
  return sql<Yonetici[]>`
    SELECT id, eposta, ad_soyad, rol, aktif, olusturma, son_giris
      FROM yoneticiler
     ORDER BY aktif DESC, ad_soyad
  `;
}

export async function yoneticiGetir(id: number): Promise<Yonetici | null> {
  const s = await sql<Yonetici[]>`
    SELECT id, eposta, ad_soyad, rol, aktif, olusturma, son_giris
      FROM yoneticiler WHERE id = ${id} LIMIT 1
  `;
  return s[0] ?? null;
}

/**
 * Yeni kullanıcı. E-posta zaten kayıtlıysa null döner (pasif kayıt da çakışır).
 * ON CONFLICT kullanmamızın sebebi: sürücüye özgü hata kodu yakalamak yerine
 * hem PostgreSQL hem PGlite'ta aynı şekilde çalışan bir kontrol.
 */
export async function yoneticiEkle(y: {
  eposta: string;
  adSoyad: string;
  sifre: string;
  rol: Rol;
}): Promise<number | null> {
  const hash = await sifreOzetle(y.sifre);

  const s = await sql<{ id: number }[]>`
    INSERT INTO yoneticiler (eposta, sifre_hash, ad_soyad, rol)
    VALUES (${y.eposta.toLowerCase()}, ${hash}, ${y.adSoyad}, ${y.rol})
    ON CONFLICT (eposta) DO NOTHING
    RETURNING id
  `;

  return s[0] ? Number(s[0].id) : null;
}

export async function yoneticiGuncelle(
  id: number,
  d: { adSoyad: string; rol: Rol; aktif: boolean },
): Promise<void> {
  await sql`
    UPDATE yoneticiler
       SET ad_soyad = ${d.adSoyad}, rol = ${d.rol}, aktif = ${d.aktif}
     WHERE id = ${id}
  `;
}

export async function yoneticiSifreDegistir(id: number, sifre: string): Promise<void> {
  const hash = await sifreOzetle(sifre);
  await sql`UPDATE yoneticiler SET sifre_hash = ${hash} WHERE id = ${id}`;
}

export async function yoneticiSil(id: number): Promise<void> {
  await sql`DELETE FROM yoneticiler WHERE id = ${id}`;
}

/** Şifre değişince / kullanıcı pasife alınınca açık oturumlar düşürülür. */
export async function yoneticiOturumlariKapat(id: number): Promise<void> {
  await sql`DELETE FROM yonetici_oturumlari WHERE yonetici_id = ${id}`;
}

/** Bu kullanıcı sistemde iz bırakmış mı? Bırakmışsa silinemez, pasife alınır. */
export async function yoneticiGecmisiVarMi(id: number): Promise<boolean> {
  const s = await sql<{ adet: number }[]>`
    SELECT (
      (SELECT count(*) FROM islem_kayitlari WHERE yonetici_id = ${id}) +
      (SELECT count(*) FROM talepler        WHERE islem_yapan = ${id}) +
      (SELECT count(*) FROM kyc_belgeleri   WHERE islem_yapan = ${id})
    )::int AS adet
  `;
  return Number(s[0]?.adet ?? 0) > 0;
}

/**
 * Kilitlenme koruması: verilen kullanıcı dışında aktif bir tam yetkili
 * kalıyor mu? Kalmıyorsa o kullanıcı pasife alınamaz, operatöre indirilemez
 * ve silinemez — yoksa panele girebilen kimse kalmaz.
 */
export async function baskaTamYetkiliVarMi(haricId: number): Promise<boolean> {
  const s = await sql<{ adet: number }[]>`
    SELECT count(*)::int AS adet FROM yoneticiler
     WHERE aktif = true AND rol = 'yonetici' AND id <> ${haricId}
  `;
  return Number(s[0]?.adet ?? 0) > 0;
}
