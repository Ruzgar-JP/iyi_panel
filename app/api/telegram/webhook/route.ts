import { NextResponse } from "next/server";

import { telegramGonder, telegramWebhookDogrula, telegramYapilandirildi } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramGuncellemesi = {
  message?: {
    chat?: { id?: number };
    text?: string;
  };
};

function siteAdresi(istekUrl: string): string | null {
  // Vercel'de bu değer atlanmışsa webhook'un ulaştığı HTTPS alan adını
  // kullanırız. Telegram'ın gizli webhook başlığı doğrulanmadan bu değere
  // hiçbir işlem yapılmaz.
  const ham = process.env.NEXT_PUBLIC_SITE_URL?.trim() || istekUrl;

  try {
    const url = new URL(ham);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Telegram'ın /start komutuna Mini App düğmesiyle cevap verir. */
export async function POST(istek: Request) {
  if (!telegramYapilandirildi() || !telegramWebhookDogrula(
    istek.headers.get("x-telegram-bot-api-secret-token"),
  )) {
    return new NextResponse(null, { status: 401 });
  }

  let guncelleme: TelegramGuncellemesi;
  try {
    guncelleme = await istek.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const sohbetId = guncelleme.message?.chat?.id;
  const metin = guncelleme.message?.text?.trim();
  const site = siteAdresi(istek.url);

  if (sohbetId && (metin === "/start" || metin === "/terminal") && site) {
    await telegramGonder("sendMessage", {
      chat_id: sohbetId,
      text: "İyi Yatırım işlem panelini Telegram içinden güvenle açabilirsiniz.",
      reply_markup: {
        inline_keyboard: [[{
          text: "Terminali Aç",
          web_app: { url: `${site}/telegram` },
        }]],
      },
    });
  }

  // Telegram isteği tekrar denemesin diye yanıtı hemen kapatırız.
  return new NextResponse(null, { status: 200 });
}
