import { redirect } from "next/navigation";

import { musteriOturumu } from "@/lib/oturum";
import GirisFormu from "@/components/panel/GirisFormu";

export const dynamic = "force-dynamic";

export default async function GirisSayfasi() {
  if (await musteriOturumu()) redirect("/panel");

  return (
    <main className="iy-giris">
      <div className="iy-giris-kart">
        <img className="iy-giris-logo" src="/iyi-yatirim-logo.png" alt="İyi Yatırım" />
        <p className="iy-giris-etiket">MÜŞTERİ PANELİ</p>
        <h1>Müşteri Girişi</h1>
        <p>Hesabınıza güvenle erişmek için giriş yapın.</p>
        <GirisFormu />
      </div>
    </main>
  );
}
