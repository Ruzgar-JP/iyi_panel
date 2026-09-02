import "server-only";
import { DEMO } from "./demo";

const DOGRULAMA_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare Turnstile doğrulaması.
 *
 * Demo modunda atlanır (yerel test için). Üretimde gizli anahtar tanımlı
 * değilse istek REDDEDİLİR — yani captcha'yı yanlışlıkla kapalı bırakmak
 * kaydı açmaz, kapatır.
 */
/**
 * Yerel testte captcha'yı atlamak için: CAPTCHA_ATLA=1
 *
 * ÜRETİM DERLEMESİNDE ÇALIŞMAZ — NODE_ENV=production iken bu anahtar
 * yok sayılır, yani yanlışlıkla açık kalsa bile canlıda kapıyı açmaz.
 */
const testAtlamasi =
  process.env.CAPTCHA_ATLA === "1" && process.env.NODE_ENV !== "production";

export type CaptchaDogrulamaSonucu = {
  gecerli: boolean;
  /** Kullanıcıya sır veya Cloudflare yanıtı sızdırmayan tanı etiketi. */
  etiket?: "AYAR_HATASI" | "JETON_GECERSIZ" | "JETON_SURESI_DOLDU" | "SERVIS_HATASI";
};

function captchaEtiketi(hataKodlari: string[] | undefined): CaptchaDogrulamaSonucu["etiket"] {
  if (hataKodlari?.includes("invalid-input-secret")) return "AYAR_HATASI";
  if (hataKodlari?.includes("timeout-or-duplicate")) return "JETON_SURESI_DOLDU";
  if (hataKodlari?.includes("invalid-input-response")) return "JETON_GECERSIZ";
  return "SERVIS_HATASI";
}

export async function captchaDogrula(
  jeton: string | undefined,
  ip: string | null,
): Promise<CaptchaDogrulamaSonucu> {
  if (DEMO) return { gecerli: true };

  if (testAtlamasi) {
    console.warn(
      "[captcha] ATLANDI (CAPTCHA_ATLA=1) — yalnızca yerel test içindir.",
    );
    return { gecerli: true };
  }

  const gizli = process.env.TURNSTILE_SECRET_KEY;
  if (!gizli) {
    console.error("[captcha] TURNSTILE_SECRET_KEY tanımlı değil — kayıt reddedildi.");
    return { gecerli: false, etiket: "AYAR_HATASI" };
  }
  if (!jeton) return { gecerli: false, etiket: "JETON_GECERSIZ" };

  const govde = new URLSearchParams({ secret: gizli, response: jeton });
  if (ip) govde.set("remoteip", ip);

  try {
    const yanit = await fetch(DOGRULAMA_URL, {
      method: "POST",
      body: govde,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const sonuc = (await yanit.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (!sonuc.success) {
      console.warn("[captcha] reddedildi:", sonuc["error-codes"]);
      return { gecerli: false, etiket: captchaEtiketi(sonuc["error-codes"]) };
    }
    return { gecerli: true };
  } catch (e) {
    console.error("[captcha] doğrulama başarısız:", e);
    return { gecerli: false, etiket: "SERVIS_HATASI" };
  }
}

/** Arayüz captcha bileşenini gösterecek mi. */
export const captchaGerekli = !DEMO && !testAtlamasi;
