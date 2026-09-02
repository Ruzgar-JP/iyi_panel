#!/usr/bin/env node
/**
 * Veritabanı şemasını kurar veya günceller.
 *
 *   npm run goc
 *
 * db/ klasöründeki bütün .sql dosyalarını sırayla çalıştırır (önce
 * schema.sql, sonra numaralı göçler). Hepsi "IF NOT EXISTS" ile yazıldığı
 * için tekrar tekrar çalıştırmak güvenlidir — var olanı bozmaz.
 *
 * Yeni sürüme geçerken de bu çalıştırılır: yeni tablolar eklenir, mevcut
 * veriye dokunulmaz.
 *
 * DATABASE_URL .env.local dosyasından okunur.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------ ayarları oku */

function envOku() {
  const yol = join(KOK, ".env.local");
  if (!existsSync(yol)) return {};
  return Object.fromEntries(
    readFileSync(yol, "utf8")
      .split("\n")
      .filter((s) => s.trim() && !s.trim().startsWith("#") && s.includes("="))
      .map((s) => {
        const i = s.indexOf("=");
        return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
      }),
  );
}

const env = envOku();
const url = process.env.DATABASE_URL || env.DATABASE_URL;

if (!url) {
  console.error(
    "✗ DATABASE_URL bulunamadı.\n" +
      "  .env.local dosyasını oluşturup veritabanı adresini yazın.\n" +
      "  Örnek için: .env.local.example",
  );
  process.exit(1);
}

/* ------------------------------------------------ dosyaları topla */

const dosyalar = [
  "schema.sql",
  ...readdirSync(join(KOK, "db"))
    .filter((a) => a.endsWith(".sql") && a !== "schema.sql")
    .sort(),
];

console.log(`Veritabanı: ${url.replace(/:\/\/[^@]*@/, "://***@")}`);
console.log(`Çalıştırılacak dosyalar: ${dosyalar.join(", ")}\n`);

/* ------------------------------------------------ çalıştır */

try {
  if (url.startsWith("pglite:")) {
    const klasor = join(KOK, url.slice("pglite:".length).replace(/^\.\//, ""));
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(klasor);

    for (const ad of dosyalar) {
      await db.exec(readFileSync(join(KOK, "db", ad), "utf8"));
      console.log(`✓ ${ad}`);
    }
    await db.close();
    console.log(`\nPGlite hazır (${klasor})`);
  } else {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, { prepare: false, max: 1 });

    for (const ad of dosyalar) {
      await sql.unsafe(readFileSync(join(KOK, "db", ad), "utf8"));
      console.log(`✓ ${ad}`);
    }
    await sql.end();
    console.log("\nPostgreSQL şeması güncel.");
  }

  console.log("\nSıradaki adım: yönetici hesabı açın —");
  console.log('  node scripts/yonetici-ekle.mjs "ad@iyiyatirim.org" "Ad Soyad" "GucluSifre123!"');
} catch (e) {
  console.error("\n✗ Hata:", e.message);
  console.error(
    "\nSık görülen sebepler:\n" +
      "  · Veritabanı sunucusu çalışmıyor veya adres yanlış\n" +
      "  · Kullanıcı adı/şifre hatalı\n" +
      "  · Kullanıcının bu veritabanında tablo oluşturma yetkisi yok",
  );
  process.exit(1);
}
