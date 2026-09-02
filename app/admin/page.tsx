import { redirect } from "next/navigation";

import YonetimGirisFormu from "@/components/yonetim/YonetimGirisFormu";
import { yoneticiOturumu } from "@/lib/oturum";

export const dynamic = "force-dynamic";

/** Yönetici girişinin kısa ve paylaşılabilir adresi. */
export default async function AdminGirisSayfasi() {
  if (await yoneticiOturumu()) redirect("/yonetim");

  return (
    <div className="iy yonetim">
      <main className="iy-giris">
        <div className="iy-giris-kart">
          <img className="iy-giris-logo" src="/iyi-yatirim-logo.png" alt="İyi Yatırım" />
          <p className="iy-giris-etiket">YÖNETİM PANELİ</p>
          <h1>Yönetici Girişi</h1>
          <p>Bu alan yalnızca yetkili personel içindir.</p>
          <YonetimGirisFormu />
        </div>
      </main>
    </div>
  );
}
