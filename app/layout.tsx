import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "İyi Yatırım",
  robots: { index: false, follow: false },
};

export default function KokYerlesim({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
