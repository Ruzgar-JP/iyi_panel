import type { Metadata } from "next";
import "./kurulum.css";

export const metadata: Metadata = {
  // Kurulum penceresinde ve ana ekran simgesinin altında bu ad görünür —
  // "Uygulamayı Yükle | ..." gibi ekler istenmiyor, sadece marka adı.
  title: "İyi Yatırım",
  description: "İyi Yatırım işlem terminalini telefonunuzun ana ekranına ekleyin.",
  robots: { index: false, follow: false },
};

export default function UygulamaKabugu({ children }: { children: React.ReactNode }) {
  return <div className="ku">{children}</div>;
}
