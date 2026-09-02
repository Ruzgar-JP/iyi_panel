/**
 * Müşteri ↔ ScaleTrade hesap bağlantılarını salt-okunur denetler.
 * Kullanım: node scripts/tani-hesap-baglanti.mjs
 */
import fs from "node:fs";
import postgres from "postgres";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const eslesme = env.match(/^DATABASE_URL=(.*)$/m);
if (!eslesme) throw new Error("DATABASE_URL .env.local içinde bulunamadı.");

const veritabaniUrl = eslesme[1].trim().replace(/^['"]|['"]$/g, "");
const sql = postgres(veritabaniUrl, { prepare: false });

try {
  const satirlar = await sql`
    SELECT m.id, m.eposta, m.ad, m.soyad, m.st_customer_id,
           (m.st_sifre IS NOT NULL) AS platform_kimligi,
           COUNT(h.login)::int AS bagli_hesap_sayisi,
           COALESCE(array_agg(h.login) FILTER (WHERE h.login IS NOT NULL), '{}') AS bagli_hesaplar
      FROM musteriler m
      LEFT JOIN musteri_hesaplari h ON h.musteri_id = m.id
     GROUP BY m.id, m.eposta, m.ad, m.soyad, m.st_customer_id, m.st_sifre
     ORDER BY m.olusturma DESC
     LIMIT 20
  `;
  console.table(satirlar);

  const oturumlar = await sql`
    SELECT o.id, o.musteri_id, o.eposta, o.olusturma, o.son_gorulme,
           jsonb_typeof(o.hesaplar) AS hesap_bicimi,
           left(o.hesaplar::text, 500) AS oturum_hesap_verisi,
           jsonb_array_length(CASE WHEN jsonb_typeof(o.hesaplar) = 'array' THEN o.hesaplar ELSE '[]'::jsonb END) AS oturum_hesap_sayisi
      FROM musteri_oturumlari o
     WHERE o.bitis > now()
     ORDER BY o.olusturma DESC
     LIMIT 20
  `;
  console.table(oturumlar);
} finally {
  await sql.end();
}
