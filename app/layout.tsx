import type { Metadata, Viewport } from "next";
import HeadEtiketleri from "@/components/pwa/HeadEtiketleri";
import KurulumYakalayici from "@/components/pwa/KurulumYakalayici";

export const metadata: Metadata = {
  title: "Novatrix Markets",
  robots: { index: false, follow: false },
  applicationName: "Novatrix Markets",
  icons: {
    icon: [{ url: "/favicon.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Novatrix Markets", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b1220", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function KokYerlesim({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>
        <KurulumYakalayici />
        {children}
        <HeadEtiketleri />
      </body>
    </html>
  );
}
