import "server-only";

/**
 * Veritabanı bağlantısı.
 *
 * İki sürücü destekleniyor, DATABASE_URL'e göre seçilir:
 *
 *   postgres://...        gerçek PostgreSQL (postgres.js) — ÜRETİM
 *   pglite:./veri         kurulum gerektirmeyen WASM Postgres — YEREL TEST
 *
 * Uygulama kodu ikisini de aynı şekilde kullanır; sorguların hiçbirini
 * değiştirmek gerekmez.
 */

const hamUrl = process.env.DATABASE_URL;
if (!hamUrl) throw new Error("DATABASE_URL tanımlı değil.");

/** Daraltılmış hâli — kapanış (closure) içinde de string olarak görünsün. */
const url: string = hamUrl;

export const yerelTest = url.startsWith("pglite:");

type SqlIslevi = {
  <T = Record<string, unknown>[]>(
    metinler: TemplateStringsArray,
    ...degerler: unknown[]
  ): Promise<T>;
};

declare global {
  // eslint-disable-next-line no-var
  var __iy_sql: SqlIslevi | undefined;
}

function baglantiKur(): SqlIslevi {
  if (yerelTest) {
    // Dinamik require: PGlite yalnızca yerel testte yüklenir, üretim
    // paketinde bulunmasına gerek yoktur.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pgliteBaglantisi } = require("./db-pglite") as typeof import("./db-pglite");
    return pgliteBaglantisi(url.slice("pglite:".length)) as unknown as SqlIslevi;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require("postgres") as typeof import("postgres");
  return postgres(url, {
    max: Number(process.env.DB_MAX_BAGLANTI ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase/Neon havuzlayıcıları prepared statement desteklemez
    prepare: false,
    transform: { undefined: null },
  }) as unknown as SqlIslevi;
}

export const sql: SqlIslevi = globalThis.__iy_sql ?? baglantiKur();

if (process.env.NODE_ENV !== "production") globalThis.__iy_sql = sql;
