import TamEkranTerminal from "@/components/terminal/TamEkranTerminal";

export const dynamic = "force-dynamic";

const terminalUrl = process.env.NEXT_PUBLIC_TERMINAL_URL || "https://client.iyiyatirim.org/en/sign/in";

export default function TerminalSayfasi() {
  return <TamEkranTerminal terminalUrl={terminalUrl} />;
}
