/** Dış web sitesinin kayıt isteği göndermesine izin verilen tek kaynak. */
export const KAYIT_WEB_ORIGIN = "https://www.iyiyatirim.org";

/**
 * Tarayıcıdan gelen bir kayıt isteğinin kaynağını sınırlar.
 * Origin başlığı olmayan istekler sunucu-sunucu istekleri için korunur;
 * kayıt isteğinin kendisi yine Turnstile ve hız sınırından geçer.
 */
export function kayitOriginineIzinVar(
  origin: string | null,
  panelOrigin: string,
): boolean {
  return origin === null || origin === panelOrigin || origin === KAYIT_WEB_ORIGIN;
}
