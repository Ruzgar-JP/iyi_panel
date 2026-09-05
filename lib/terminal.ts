import "server-only";

/**
 * Terminale geçiş adresi. Terminal, `token` parametresindeki işlem hesabı
 * oturumunu kendi SSO betiğiyle alarak müşteriyi doğrudan alım-satıma geçirir.
 */
const TEMEL =
  process.env.NEXT_PUBLIC_TERMINAL_URL ||
  "https://trade.iyiyatirim.org/";

function terminalKoku(): string | null {
  try {
    return new URL(TEMEL).origin;
  } catch {
    return null;
  }
}

/** Token yoksa veya terminal adresi geçersizse normal terminal girişini döner. */
export function terminalAdresi(stToken?: string | null): string {
  if (!stToken) return TEMEL;

  const kok = terminalKoku();
  if (!kok) return TEMEL;

  return `${kok}/en/?token=${encodeURIComponent(stToken)}`;
}

export function otomatikGirisVarMi(stToken?: string | null): boolean {
  return Boolean(stToken);
}
