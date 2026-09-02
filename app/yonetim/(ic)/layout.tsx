import { redirect } from "next/navigation";

import { yoneticiOturumu } from "@/lib/oturum";
import { bekleyenSayilari } from "@/lib/talepler";
import YonetimMenu from "@/components/yonetim/YonetimMenu";

export const dynamic = "force-dynamic";

export default async function YonetimKorumali({
  children,
}: {
  children: React.ReactNode;
}) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) redirect("/yonetim/giris");

  const sayilar = await bekleyenSayilari();

  return (
    <>
      <YonetimMenu adSoyad={yonetici.adSoyad} rol={yonetici.rol} sayilar={sayilar} />
      <div className="iy-govde">{children}</div>
    </>
  );
}
