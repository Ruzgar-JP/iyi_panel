import { redirect } from "next/navigation";

import { musteriOturumu } from "@/lib/oturum";
import GirisFormu from "@/components/panel/GirisFormu";

export const dynamic = "force-dynamic";

export default async function GirisSayfasi() {
  if (await musteriOturumu()) redirect("/panel");

  return (
    <div className="iy-govde iy-dar" style={{ paddingTop: 64 }}>
      <h1 className="iy-baslik">Müşteri Girişi</h1>
      <p className="iy-alt">Hesabınıza erişmek için giriş yapın.</p>

      <div className="iy-kart">
        <GirisFormu />
      </div>
    </div>
  );
}
