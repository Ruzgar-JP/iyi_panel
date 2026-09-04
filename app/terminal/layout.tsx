import type { Metadata } from "next";
import "./terminal.css";

export const metadata: Metadata = { title: "İyi Yatırım", robots: { index: false, follow: false } };

export default function TerminalYerlesim({ children }: { children: React.ReactNode }) {
  return children;
}
