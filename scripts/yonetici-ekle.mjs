#!/usr/bin/env node
/**
 * İlk yöneticiyi oluşturur (veya mevcut yöneticinin şifresini değiştirir).
 *
 * Kullanım:
 *   node scripts/yonetici-ekle.mjs "ad@iyiyatirim.org" "Ad Soyad" "GucluSifre123!"
 *
 * DATABASE_URL önce ortam değişkeninden, yoksa proje kökündeki .env.local
 * dosyasından okunur.
 */
import { randomBytes, scrypt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import postgres from "postgres";

const scryptAsync = promisify(scrypt);
const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");

const [eposta, adSoyad, sifre] = process.argv.slice(2);

if (!eposta || !adSoyad || !sifre) {
  console.error('Kullanım: node scripts/yonetici-ekle.mjs "eposta" "Ad Soyad" "sifre"');
  process.exit(1);
}

if (sifre.length < 10) {
  console.error("Şifre en az 10 karakter olmalı.");
  process.exit(1);
}

function envOku() {
  const yol = join(KOK, ".env.local");
  if (!existsSync(yol)) return {};
  return Object.fromEntries(
    readFileSync(yol, "utf8")
      .split("\n")
      .filter((satir) => satir.trim() && !satir.trim().startsWith("#") && satir.includes("="))
      .map((satir) => {
        const i = satir.indexOf("=");
        return [satir.slice(0, i).trim(), satir.slice(i + 1).trim()];
      }),
  );
}

const url = process.env.DATABASE_URL || envOku().DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL tanımlı değil. .env.local dosyasını kontrol edin.");
  process.exit(1);
}

const tuz = randomBytes(16);
const ozet = await scryptAsync(sifre.normalize("NFKC"), tuz, 64);
const hash = `scrypt$${tuz.toString("hex")}$${ozet.toString("hex")}`;

const sql = postgres(url, { prepare: false });

try {
  const [satir] = await sql`
    INSERT INTO yoneticiler (eposta, sifre_hash, ad_soyad, rol)
    VALUES (${eposta.toLowerCase()}, ${hash}, ${adSoyad}, 'yonetici')
    ON CONFLICT (eposta)
    DO UPDATE SET sifre_hash = ${hash}, ad_soyad = ${adSoyad}, aktif = true
    RETURNING id, eposta
  `;
  console.log(`Yönetici hazır: #${satir.id} ${satir.eposta}`);
  console.log("Giriş: /yonetim/giris");
} catch (e) {
  console.error("Hata:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
