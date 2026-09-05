import type { Metadata } from "next";
import "../panel.css";

export const metadata: Metadata = {
  title: "Yönetim | Novatrix Markets",
  robots: { index: false, follow: false },
};

export default function YonetimKabugu({ children }: { children: React.ReactNode }) {
  return <div className="iy yonetim">{children}</div>;
}
