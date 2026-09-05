import type { Metadata } from "next";
import "../panel.css";

export const metadata: Metadata = {
  title: "Müşteri Paneli | İyi Yatırım",
  robots: { index: false, follow: false },
};

/** Giriş sayfası dahil tüm panel sayfalarını saran kabuk. */
export default function PanelKabugu({ children }: { children: React.ReactNode }) {
  return <div className="iy">{children}</div>;
}
