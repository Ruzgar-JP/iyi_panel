import type { Metadata } from "next";
import "./tani.css";

export const metadata: Metadata = {
  title: "Teşhis",
  robots: { index: false, follow: false },
};

export default function TaniKabugu({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
