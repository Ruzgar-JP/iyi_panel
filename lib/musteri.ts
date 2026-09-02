import "server-only";
import { randomBytes } from "node:crypto";

import { sql } from "./db";
import { sifreDogrula, sifreOzetle } from "./kripto";

/**
 * Müşteri kimliği — bizim veritabanımızda.
 *
 * ION'dan CRM alınmadığı için ScaleTrade'in customer kayıtları BackOffice'ten
 * yönetilemiyor. Panel girişi, şifre ve iletişim bilgileri bu yüzden burada
 * tutulur; ScaleTrade yalnızca işlem hesaplarını (login) barındırır.
 */

export type Musteri = {
  id: number;
  eposta: string;
  /** scrypt özeti — ASLA tarayıcıya gönderilmez. */
  sifre_hash: string;
  ad: string;
  soyad: string;
  telefon: string | null;
  aktif: boolean;
  /** ScaleTrade ara kaydı — makine üretimi, müşteri hiç görmez. */
  st_customer_id: number | null;
  st_sifre: string | null;
  olusturma: Date;
  son_giris: Date | null;
};

export type MusteriHesabi = {
  login: number;
  musteri_id: number;
  grup: string | null;
  para_birimi: string | null;
};

/* --------------------------------------------------------------- okuma */

export async function musteriGetir(id: number): Promise<Musteri | null> {
  const s = await sql<Musteri[]>`SELECT * FROM musteriler WHERE id = ${id} LIMIT 1`;
  return s[0] ?? null;
}

export async function epostayaGoreGetir(eposta: string): Promise<Musteri | null> {
  const s = await sql<Musteri[]>`
    SELECT * FROM musteriler WHERE lower(eposta) = lower(${eposta}) LIMIT 1
  `;
  return s[0] ?? null;
}

export function musteriHesaplari(musteriId: number) {
  return sql<MusteriHesabi[]>`
    SELECT login, musteri_id, grup, para_birimi
      FROM musteri_hesaplari
     WHERE musteri_id = ${musteriId}
     ORDER BY login
  `;
}

/** Bir hesap gerçekten bu müşteriye mi ait — her istekte doğrulanır. */
export async function hesapMusterininMi(
  musteriId: number,
  login: number,
): Promise<boolean> {
  const s = await sql<{ login: number }[]>`
    SELECT login FROM musteri_hesaplari
     WHERE musteri_id = ${musteriId} AND login = ${login} LIMIT 1
  `;
  return s.length > 0;
}

/* ------------------------------------------------------------ oluşturma */

/** ScaleTrade ara kaydı için makine üretimi şifre (kullanıcı şifresi değil). */
export function icSifreUret(): string {
  return randomBytes(24).toString("base64url");
}

export async function musteriOlustur(m: {
  eposta: string;
  sifre: string;
  ad: string;
  soyad: string;
  telefon: string;
  pazarlamaIzni: boolean;
  stCustomerId?: number | null;
  stSifre?: string | null;
}): Promise<number> {
  const s = await sql<{ id: number }[]>`
    INSERT INTO musteriler
      (eposta, sifre_hash, ad, soyad, telefon, pazarlama_izni, st_customer_id, st_sifre)
    VALUES (${m.eposta.toLowerCase()}, ${await sifreOzetle(m.sifre)}, ${m.ad},
            ${m.soyad}, ${m.telefon}, ${m.pazarlamaIzni},
            ${m.stCustomerId ?? null}, ${m.stSifre ?? null})
    RETURNING id
  `;
  return Number(s[0].id);
}

export async function hesapBagla(
  musteriId: number,
  login: number,
  grup: string | null,
  paraBirimi: string | null,
): Promise<void> {
  await sql`
    INSERT INTO musteri_hesaplari (login, musteri_id, grup, para_birimi)
    VALUES (${login}, ${musteriId}, ${grup}, ${paraBirimi})
    ON CONFLICT (login) DO UPDATE
      SET musteri_id = ${musteriId}, grup = ${grup}, para_birimi = ${paraBirimi}
  `;
}

/* ------------------------------------------------------------- kimlik */

export type GirisSonucu =
  | { ok: true; musteri: Musteri }
  | { ok: false; sebep: "bulunamadi" | "sifre" | "pasif" };

/**
 * Panel girişi. Kullanıcı bulunamasa bile şifre doğrulaması çalıştırılır;
 * böylece yanıt süresinden hesabın var olup olmadığı anlaşılmaz.
 */
export async function girisDogrula(
  eposta: string,
  sifre: string,
): Promise<GirisSonucu> {
  const musteri = await epostayaGoreGetir(eposta);

  const sahteHash = "scrypt$" + "0".repeat(32) + "$" + "0".repeat(128);
  const dogru = await sifreDogrula(sifre, musteri?.sifre_hash ?? sahteHash);

  if (!musteri) return { ok: false, sebep: "bulunamadi" };
  if (!dogru) return { ok: false, sebep: "sifre" };
  if (!musteri.aktif) return { ok: false, sebep: "pasif" };

  await sql`UPDATE musteriler SET son_giris = now() WHERE id = ${musteri.id}`;
  return { ok: true, musteri };
}

/** Panel şifresini değiştirir. */
export async function panelSifresiAyarla(
  musteriId: number,
  yeniSifre: string,
): Promise<void> {
  await sql`
    UPDATE musteriler
       SET sifre_hash = ${await sifreOzetle(yeniSifre)}, guncelleme = now()
     WHERE id = ${musteriId}
  `;
}

/** Mevcut şifreyi doğrular — şifre değiştirmeden önce zorunlu. */
export async function panelSifresiDogru(
  musteriId: number,
  sifre: string,
): Promise<boolean> {
  const m = await musteriGetir(musteriId);
  return m ? sifreDogrula(sifre, m.sifre_hash) : false;
}

/* ---------------------------------------------------------- yönetim */

export async function musteriGuncelle(
  id: number,
  d: { ad?: string; soyad?: string; telefon?: string; eposta?: string; aktif?: boolean },
): Promise<void> {
  await sql`
    UPDATE musteriler SET
      ad      = COALESCE(${d.ad ?? null}, ad),
      soyad   = COALESCE(${d.soyad ?? null}, soyad),
      telefon = COALESCE(${d.telefon ?? null}, telefon),
      eposta  = COALESCE(${d.eposta?.toLowerCase() ?? null}, eposta),
      aktif   = COALESCE(${d.aktif ?? null}, aktif),
      guncelleme = now()
    WHERE id = ${id}
  `;
}

export function musterileriAra(arama?: string) {
  const a = arama?.trim();
  return sql<(Musteri & { hesaplar: string | null })[]>`
    SELECT m.*,
           (SELECT string_agg(h.login::text, ', ' ORDER BY h.login)
              FROM musteri_hesaplari h WHERE h.musteri_id = m.id) AS hesaplar
      FROM musteriler m
     WHERE true
       ${
         a
           ? sql`AND (m.eposta ILIKE ${"%" + a + "%"}
                   OR m.ad ILIKE ${"%" + a + "%"}
                   OR m.soyad ILIKE ${"%" + a + "%"}
                   OR m.id::text = ${a}
                   OR EXISTS (SELECT 1 FROM musteri_hesaplari h
                               WHERE h.musteri_id = m.id AND h.login::text = ${a}))`
           : sql``
       }
     ORDER BY m.olusturma DESC
     LIMIT 200
  `;
}
