import Link from "next/link";

import SifremiUnuttumFormu from "@/components/panel/SifremiUnuttumFormu";

export const dynamic = "force-dynamic";

export default function SifremiUnuttumSayfasi() {
  return (
    <div className="iy-govde iy-dar" style={{ paddingTop: 64, maxWidth: 460 }}>
      <h1 className="iy-baslik">Şifremi Unuttum</h1>
      <p className="iy-alt">
        Kayıtlı e-posta adresinizi girin, sıfırlama bağlantısını gönderelim.
      </p>

      <div className="iy-kart">
        <SifremiUnuttumFormu />
      </div>

      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link href="/panel/giris">← Giriş sayfasına dön</Link>
      </p>
    </div>
  );
}
