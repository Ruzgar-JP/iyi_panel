import TamEkranTerminal from "@/components/terminal/TamEkranTerminal";
import { musteriOturumu } from "@/lib/oturum";
import { terminalAdresi } from "@/lib/terminal";

export const dynamic = "force-dynamic";

export default async function TerminalSayfasi() {
  const oturum = await musteriOturumu();
  return <TamEkranTerminal terminalUrl={terminalAdresi(oturum?.stToken)} />;
}
