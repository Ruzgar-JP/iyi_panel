import "server-only";
import { sql } from "./db";
import { jetonOzeti, jetonUret } from "./kripto";

/**
 * Şifre sıfırlama jetonları.
 *
 * Jetonun kendisi yalnızca e-postadaki bağlantıda bulunur; veritabanında
 * sha256 özeti saklanır. Böylece veritabanı okunsa bile jetonlar kullanılamaz.
 *
 * Tek kullanımlık ve kısa ömürlü.
 */

export const GECERLILIK_DK = Number(process.env.SIFIRLAMA_DK ?? 60);

/** Yeni jeton üretir; e-postaya konacak ham değeri döner. */
export async function jetonOlustur(musteriId: number): Promise<string> {
  // Aynı müşterinin eski, kullanılmamış jetonlarını geçersiz kıl —
  // aynı anda birden fazla geçerli bağlantı dolaşmasın.
  await sql`
    UPDATE sifre_sifirlama SET kullanildi = true
     WHERE musteri_id = ${musteriId} AND kullanildi = false
  `;

  const jeton = jetonUret();
  const bitis = new Date(Date.now() + GECERLILIK_DK * 60_000);

  await sql`
    INSERT INTO sifre_sifirlama (jeton_hash, musteri_id, bitis)
    VALUES (${jetonOzeti(jeton)}, ${musteriId}, ${bitis})
  `;
  return jeton;
}

export type JetonSonucu =
  | { gecerli: true; musteriId: number }
  | { gecerli: false; sebep: "yok" | "suresi_dolmus" | "kullanilmis" };

/** Jetonu doğrular ama TÜKETMEZ — form gösterilirken kullanılır. */
export async function jetonKontrol(jeton: string): Promise<JetonSonucu> {
  const s = await sql<
    { musteri_id: number; kullanildi: boolean; suresi_gecti: boolean }[]
  >`
    SELECT musteri_id, kullanildi, (bitis < now()) AS suresi_gecti
      FROM sifre_sifirlama
     WHERE jeton_hash = ${jetonOzeti(jeton)}
     LIMIT 1
  `;

  const k = s[0];
  if (!k) return { gecerli: false, sebep: "yok" };
  if (k.kullanildi) return { gecerli: false, sebep: "kullanilmis" };
  if (k.suresi_gecti) return { gecerli: false, sebep: "suresi_dolmus" };
  return { gecerli: true, musteriId: Number(k.musteri_id) };
}

/**
 * Jetonu tüketir. Tek sorguda hem kontrol hem işaretleme yapar; böylece
 * aynı jetonla iki eşzamanlı istek gelirse yalnızca biri geçer.
 */
export async function jetonTuket(jeton: string): Promise<number | null> {
  const s = await sql<{ musteri_id: number }[]>`
    UPDATE sifre_sifirlama
       SET kullanildi = true
     WHERE jeton_hash = ${jetonOzeti(jeton)}
       AND kullanildi = false
       AND bitis > now()
    RETURNING musteri_id
  `;
  return s[0] ? Number(s[0].musteri_id) : null;
}

/** Süresi dolmuş jetonları temizler. */
export async function eskileriSil(): Promise<void> {
  await sql`DELETE FROM sifre_sifirlama WHERE bitis < now() - interval '7 days'`;
}

export function jetonMesaji(sebep: "yok" | "suresi_dolmus" | "kullanilmis"): string {
  if (sebep === "suresi_dolmus")
    return "Bu bağlantının süresi dolmuş. Lütfen yeni bir sıfırlama isteği oluşturun.";
  if (sebep === "kullanilmis")
    return "Bu bağlantı daha önce kullanılmış. Lütfen yeni bir sıfırlama isteği oluşturun.";
  return "Bağlantı geçersiz. Lütfen yeni bir sıfırlama isteği oluşturun.";
}
