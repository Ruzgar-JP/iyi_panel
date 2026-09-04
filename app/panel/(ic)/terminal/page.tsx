import { musteriOturumu } from "@/lib/oturum";
import TerminalCerceve from "@/components/panel/TerminalCerceve";

export const dynamic = "force-dynamic";

const TERMINAL_URL =
  process.env.NEXT_PUBLIC_TERMINAL_URL ||
  "https://client.iyiyatirim.org/en/sign/in";

/**
 * İşlem terminali.
 *
 * Terminal ayrı bir uygulama (ScaleTrade WebTrader) ve otomatik giriş (SSO)
 * platformun REST API'sinde YOK — yalnızca TCP Server API'de, o da bize
 * açılmadı. Bu yüzden müşteri terminale kendi bilgileriyle giriyor.
 *
 * Bizim buradaki katkımız: giriş için gereken hesap numarasını kopyalanabilir
 * şekilde göstermek. Kullanıcı adı e-posta DEĞİL, hesap numarasıdır — en sık
 * takılınan yer burası. Şifre panel şifresiyle aynıdır (tek şifre kuralı).
 */
export default async function TerminalSayfasi() {
  const oturum = (await musteriOturumu())!;

  return (
    <TerminalCerceve
      terminalUrl={TERMINAL_URL}
      hesaplar={oturum.hesaplar.map((h) => ({
        login: h.login,
        paraBirimi: h.paraBirimi,
      }))}
    />
  );
}
