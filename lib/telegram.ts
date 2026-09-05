import "server-only";
import { timingSafeEqual } from "node:crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";

/** Bot kimlik bilgileri eksikse Telegram uçları kapalı kalır. */
export function telegramYapilandirildi(): boolean {
  return BOT_TOKEN.length > 0 && WEBHOOK_SECRET.length >= 32;
}

/** Telegram'ın webhook üstbilgisini sabit zamanlı karşılaştırmayla doğrular. */
export function telegramWebhookDogrula(gelen: string | null): boolean {
  if (!telegramYapilandirildi() || !gelen) return false;

  const beklenen = Buffer.from(WEBHOOK_SECRET);
  const deger = Buffer.from(gelen);
  return beklenen.length === deger.length && timingSafeEqual(beklenen, deger);
}

/** Bot API isteği. Jeton, URL veya hata çıktısına asla eklenmez. */
export async function telegramGonder(yontem: string, govde: unknown): Promise<void> {
  if (!telegramYapilandirildi()) return;

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${yontem}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(govde),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (hata) {
    // Telegram yanıtı veya jeton loglanmaz; yalnızca sınıflandırılmış hata tutulur.
    console.warn("[telegram] bot isteği başarısız", {
      hata: hata instanceof Error ? hata.name : typeof hata,
    });
  }
}
