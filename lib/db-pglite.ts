import "server-only";

/**
 * PGlite (WASM PostgreSQL) üzerine postgres.js uyumlu ince bir katman.
 *
 * Sadece YEREL TEST içindir. Kurulum gerektirmez, veriler bir klasöre yazılır.
 * Üretimde gerçek PostgreSQL kullanılır — kod aynı kalır, yalnızca
 * DATABASE_URL değişir (bkz. lib/db.ts).
 *
 * postgres.js'in etiketli şablon sözdizimini taklit eder:
 *
 *   sql`SELECT * FROM t WHERE id = ${id}`
 *   sql`SELECT * FROM t WHERE true ${kosul ? sql`AND x = ${v}` : sql``}`
 *
 * İç içe parçalar düzleştirilir, değerler $1..$n olarak parametreye çevrilir —
 * yani SQL enjeksiyonuna karşı gerçek parametreli sorgu üretilir.
 */

type Parca = { __parca: true; metinler: readonly string[]; degerler: unknown[] };

function parcaMi(d: unknown): d is Parca {
  return typeof d === "object" && d !== null && "__parca" in d;
}

/** Etiketli şablonu (metin, parametreler) çiftine çevirir. */
function derle(parca: Parca): { metin: string; parametreler: unknown[] } {
  const parcalar: string[] = [];
  const parametreler: unknown[] = [];

  const yaz = (p: Parca) => {
    p.metinler.forEach((metin, i) => {
      parcalar.push(metin);
      if (i < p.degerler.length) {
        const deger = p.degerler[i];
        if (parcaMi(deger)) {
          yaz(deger); // iç içe parça — parametre değil, metin olarak gömülür
        } else {
          parametreler.push(deger);
          parcalar.push(`$${parametreler.length}`);
        }
      }
    });
  };

  yaz(parca);
  return { metin: parcalar.join(""), parametreler };
}

export type PgliteSql = {
  <T = Record<string, unknown>[]>(
    metinler: TemplateStringsArray,
    ...degerler: unknown[]
  ): Promise<T> & Parca;
  hazir: () => Promise<void>;
  kapat: () => Promise<void>;
  json: (deger: unknown) => string;
};

export function pgliteBaglantisi(klasor: string): PgliteSql {
  // PGlite yalnızca yerel testte yüklenir; üretim paketine girmesin diye
  // dinamik import kullanıyoruz.
  let dbSozu: Promise<{
    query: (m: string, p?: unknown[]) => Promise<{ rows: unknown[] }>;
    exec: (m: string) => Promise<unknown>;
    close: () => Promise<void>;
  }> | null = null;

  const db = () => {
    if (!dbSozu) {
      dbSozu = import("@electric-sql/pglite").then(
        ({ PGlite }) => new PGlite(klasor) as never,
      );
    }
    return dbSozu;
  };

  const sql = ((metinler: TemplateStringsArray, ...degerler: unknown[]) => {
    const parca: Parca = { __parca: true, metinler, degerler };

    // Hem "await sql`...`" hem de iç içe parça olarak kullanılabilsin diye
    // parçanın kendisini thenable yapıyoruz.
    const calistir = async () => {
      const { metin, parametreler } = derle(parca);
      const sonuc = await (await db()).query(metin, parametreler);
      return sonuc.rows;
    };

    return Object.assign(parca, {
      then: (
        cozum: (d: unknown) => unknown,
        hata?: (e: unknown) => unknown,
      ) => calistir().then(cozum, hata),
      catch: (hata: (e: unknown) => unknown) => calistir().catch(hata),
      finally: (son: () => void) => calistir().finally(son),
    });
  }) as unknown as PgliteSql;

  sql.hazir = async () => {
    await db();
  };
  sql.kapat = async () => {
    if (dbSozu) await (await dbSozu).close();
  };
  // PGlite parametreleri düz metin taşır; PostgreSQL tarafında ::jsonb ile
  // çözülecek gerçek JSON belgesini kendimiz üretiriz.
  sql.json = (deger: unknown) => JSON.stringify(deger);

  return sql;
}

/** Şema dosyasını çalıştırır (birden çok ifade içerebilir). */
export async function semaYukle(klasor: string, sema: string): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite(klasor);
  await db.exec(sema);
  await db.close();
}
