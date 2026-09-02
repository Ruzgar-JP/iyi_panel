import { redirect } from "next/navigation";

import { yoneticiOturumu } from "@/lib/oturum";
import YonetimGirisFormu from "@/components/yonetim/YonetimGirisFormu";

export const dynamic = "force-dynamic";

export default async function YonetimGirisSayfasi() {
  if (await yoneticiOturumu()) redirect("/yonetim");

  return (
    <div className="iy-govde iy-dar" style={{ paddingTop: 64, maxWidth: 420 }}>
      <h1 className="iy-baslik">Yönetim Girişi</h1>
      <p className="iy-alt">Bu alan yalnızca yetkili personel içindir.</p>

      <div className="iy-kart">
        <YonetimGirisFormu />
      </div>
    </div>
  );
}
