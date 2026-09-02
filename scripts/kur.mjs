#!/usr/bin/env node
/**
 * Test ortamını tek komutla hazırlar:
 *   1. .env.local yoksa oluşturur (demo modu + PGlite)
 *   2. Şemayı kurar
 *   3. Örnek ödeme yöntemleri ekler
 *   4. Yönetici hesabı oluşturur
 *
 * Kullanım:  npm run kur
 */
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scryptAsync = promisify(scrypt);
const KOK = join(dirname(fileURLToPath(import.meta.url)), "..");

const YONETICI_EPOSTA = "yonetici@iyiyatirim.org";
const YONETICI_SIFRE = "Yonetim1234!";

/* ------------------------------------------------ 1) .env.local */

const envYolu = join(KOK, ".env.local");
if (!existsSync(envYolu)) {
  writeFileSync(
    envYolu,
    `# Otomatik oluşturuldu — yerel test içindir
DATABASE_URL=pglite:./veri
DEMO_MOD=1

SCALETRADE_BASE_URL=https://client.iyiyatirim.org
SCALETRADE_BRAND=iyiyatirim
SCALETRADE_GROUP=Main
SCALETRADE_MANAGER_TOKEN=

OTURUM_SAAT=8
YONETIM_OTURUM_SAAT=12
BAKIYE_BEKLEME_SN=20
CEKIM_BEKLEME_DK=2
ACIK_CEKIM_ADEDI=1
MIN_TUTAR=10
MAX_TUTAR=1000000
CEKIMDE_BONUS_DUS=1
MAX_DOSYA_MB=8
NEXT_PUBLIC_DESTEK_EPOSTA=destek@iyiyatirim.org
`,
    "utf8",
  );
  console.log("✓ .env.local oluşturuldu (demo modu açık, PGlite)");
} else {
  console.log("· .env.local zaten var, dokunulmadı");
}

/* Ayarları oku */
const env = Object.fromEntries(
  readFileSync(envYolu, "utf8")
    .split("\n")
    .filter((s) => s.trim() && !s.trim().startsWith("#") && s.includes("="))
    .map((s) => {
      const i = s.indexOf("=");
      return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    }),
);

const url = env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL bulunamadı.");
  process.exit(1);
}

/* ------------------------------------------------ 2) veritabanı */

// db/ klasöründeki bütün .sql dosyaları sırayla çalıştırılır. schema.sql
// önce gelir (tabloları o kurar), sonra numaralı göçler alfabetik sırayla.
// Yeni bir göç eklendiğinde burayı düzenlemek gerekmez.
const semaDosyalari = [
  "schema.sql",
  ...readdirSync(join(KOK, "db"))
    .filter((a) => a.endsWith(".sql") && a !== "schema.sql")
    .sort(),
];
const sema = semaDosyalari
  .map((a) => readFileSync(join(KOK, "db", a), "utf8"))
  .join("\n");
let sorgula; // (metin, parametreler) => satırlar

if (url.startsWith("pglite:")) {
  const klasor = join(KOK, url.slice("pglite:".length).replace(/^\.\//, ""));
  mkdirSync(klasor, { recursive: true });

  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(klasor);
  await db.exec(sema);
  sorgula = async (m, p = []) => (await db.query(m, p)).rows;
  console.log(`✓ PGlite hazır (${klasor})`);
} else {
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, { prepare: false });
  await sql.unsafe(sema);
  sorgula = async (m, p = []) => sql.unsafe(m, p);
  console.log("✓ PostgreSQL şeması kuruldu");
}

/* ------------------------------------------------ 3) ödeme yöntemleri */

const mevcut = await sorgula("SELECT count(*)::int AS n FROM odeme_yontemleri");
if (Number(mevcut[0].n) === 0) {
  const yontemler = [
    ["banka", "Ziraat Bankası — TRY", "TRY",
      { banka: "Ziraat Bankası", hesap_sahibi: "İyi Yatırım A.Ş.", iban: "TR33 0006 1005 1978 6457 8413 26" },
      "Açıklama kısmına yalnızca hesap numaranızı yazın.", 1],
    ["banka", "Garanti BBVA — TRY", "TRY",
      { banka: "Garanti BBVA", hesap_sahibi: "İyi Yatırım A.Ş.", iban: "TR64 0006 2000 1234 0006 2971 55" },
      null, 2],
    ["kripto", "USDT — TRC20", "USDT",
      { ag: "TRC20", adres: "TXn9YvKPqAX4rW2mLbC8dEfGhJkLmNpQrS" },
      "Yalnızca TRC20 ağını kullanın. Farklı ağdan gönderilen tutar kaybolur.", 3],
    ["kripto", "USDT — ERC20", "USDT",
      { ag: "ERC20", adres: "0x8f2a3B4c5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a" },
      null, 4],
  ];

  for (const [tip, ad, birim, detay, aciklama, sira] of yontemler) {
    await sorgula(
      `INSERT INTO odeme_yontemleri (tip, ad, para_birimi, detaylar, aciklama, sira)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
      [tip, ad, birim, JSON.stringify(detay), aciklama, sira],
    );
  }
  console.log(`✓ ${yontemler.length} örnek ödeme yöntemi eklendi`);
} else {
  console.log("· Ödeme yöntemleri zaten var");
}

/* ------------------------------------------------ 4) yönetici */

const tuz = randomBytes(16);
const ozet = await scryptAsync(YONETICI_SIFRE.normalize("NFKC"), tuz, 64);
const hash = `scrypt$${tuz.toString("hex")}$${ozet.toString("hex")}`;

await sorgula(
  `INSERT INTO yoneticiler (eposta, sifre_hash, ad_soyad, rol)
   VALUES ($1, $2, $3, 'yonetici')
   ON CONFLICT (eposta) DO UPDATE SET sifre_hash = $2, aktif = true`,
  [YONETICI_EPOSTA, hash, "Test Yöneticisi"],
);
console.log("✓ Yönetici hesabı hazır");

/* ------------------------------------------------ özet */

console.log(`
────────────────────────────────────────────────
  Test ortamı hazır.  Başlatmak için:  npm run dev
  Adres: http://localhost:3100

  MÜŞTERİ PANELİ   /panel/giris
    demo@iyiyatirim.org
    Demo1234!

  YÖNETİM PANELİ   /yonetim/giris
    ${YONETICI_EPOSTA}
    ${YONETICI_SIFRE}

  Demo modu açık — canlı sunucuya hiçbir istek gitmiyor.
────────────────────────────────────────────────`);

process.exit(0);
