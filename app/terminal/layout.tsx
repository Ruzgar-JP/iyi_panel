import type { Metadata } from "next";
import "./terminal.css";

export const metadata: Metadata = { title: "Novatrix Markets", robots: { index: false, follow: false } };

export default function TerminalYerlesim({ children }: { children: React.ReactNode }) {
  return children;
}
