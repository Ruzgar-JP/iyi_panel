#!/usr/bin/env node
/**
 * Telegram botuna Mini App menüsünü ve güvenli webhook adresini tanıtır.
 * Çalıştırma: npm run telegram [https://panel-adresi.example]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = fileURLToPath(new URL("..", import.meta.url));
const envYolu = join(kok, ".env.local");
const env = Object.fromEntries(
  readFileSync(envYolu, "utf8")
    .split(/\r?\n/)
    .filter((satir) => satir.trim() && !satir.trim().startsWith("#") && satir.includes("="))
    .map((satir) => {
      const ayirac = satir.indexOf("=");
      return [satir.slice(0, ayirac).trim(), satir.slice(ayirac + 1).trim()];
    }),
);

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
const hamSite = process.argv[2] ?? env.NEXT_PUBLIC_SITE_URL;

if (!token || !secret || secret.length < 32) {
  throw new Error("TELEGRAM_BOT_TOKEN ve en az 32 karakterlik TELEGRAM_WEBHOOK_SECRET gerekli.");
}

let site;
try {
  site = new URL(hamSite);
  if (site.protocol !== "https:") throw new Error("HTTPS gerekli.");
} catch {
  throw new Error("Geçerli bir HTTPS site adresi gerekli (NEXT_PUBLIC_SITE_URL)." );
}

const kokAdres = site.origin;
const miniAppUrl = `${kokAdres}/telegram`;
const webhookUrl = `${kokAdres}/api/telegram/webhook`;

async function telegram(yontem, govde) {
  const yanit = await fetch(`https://api.telegram.org/bot${token}/${yontem}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(govde),
  });
  const veri = await yanit.json().catch(() => null);
  if (!yanit.ok || !veri?.ok) throw new Error(`${yontem} başarısız oldu.`);
}

await telegram("setMyCommands", {
  commands: [{ command: "start", description: "İşlem panelini aç" }],
});
await telegram("setChatMenuButton", {
  menu_button: { type: "web_app", text: "Terminal", web_app: { url: miniAppUrl } },
});
await telegram("setWebhook", {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
});

console.log(`Telegram botu hazır: ${miniAppUrl}`);
