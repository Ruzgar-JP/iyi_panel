import { redirect } from "next/navigation";

import { musteriOturumu } from "@/lib/oturum";
import PanelMenu from "@/components/panel/PanelMenu";

export const dynamic = "force-dynamic";

/** Giriş yapılmamışsa buradaki hiçbir sayfa açılmaz. */
export default async function KorumaliKabuk({
  children,
}: {
  children: React.ReactNode;
}) {
  const oturum = await musteriOturumu();
  if (!oturum) redirect("/panel/giris");

  return (
    <>
      <PanelMenu adSoyad={oturum.adSoyad ?? oturum.eposta} />
      <div className="iy-govde">{children}</div>
    </>
  );
}
