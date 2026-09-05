/** Dış web sitesinin kayıt isteği göndermesine izin verilen tek kaynak. */
export const KAYIT_WEB_ORIGIN = "https://www.novatrixmarkets.com";
const YEREL_GELISTIRME_ORIGIN = "http://localhost:3000";

function izinliOriginMi(origin: string | null): boolean {
  return origin === KAYIT_WEB_ORIGIN || origin === YEREL_GELISTIRME_ORIGIN;
}

/** İzinli dış web sitesi için tüm (hata dâhil) yanıtların CORS başlıkları. */
export function kayitCorsBasliklari(origin: string | null): Record<string, string> {
  return izinliOriginMi(origin)
    ? {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      }
    : {};
}

/**
 * Tarayıcıdan gelen bir kayıt isteğinin kaynağını sınırlar.
 * Origin başlığı olmayan istekler sunucu-sunucu istekleri için korunur;
 * kayıt isteğinin kendisi yine Turnstile ve hız sınırından geçer.
 */
export function kayitOriginineIzinVar(
  origin: string | null,
  panelOrigin: string,
): boolean {
  return origin === null || origin === panelOrigin || izinliOriginMi(origin);
}
