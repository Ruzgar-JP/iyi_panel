import { musteriOturumu } from "@/lib/oturum";
import { otomatikGirisVarMi, terminalAdresi } from "@/lib/terminal";
import TerminalCerceve from "@/components/panel/TerminalCerceve";

export const dynamic = "force-dynamic";

/**
 * İşlem terminali.
 *
 * Geçerli bir işlem oturumu varsa terminal SSO ile açılır; alınamadığında
 * kullanıcı normal terminal girişine güvenli şekilde geri düşer.
 */
export default async function TerminalSayfasi() {
  const oturum = (await musteriOturumu())!;

  return (
    <TerminalCerceve
      terminalUrl={terminalAdresi(oturum.stToken)}
      otomatikGiris={otomatikGirisVarMi(oturum.stToken)}
      hesaplar={oturum.hesaplar.map((h) => ({
        login: h.login,
        paraBirimi: h.paraBirimi,
      }))}
    />
  );
}
