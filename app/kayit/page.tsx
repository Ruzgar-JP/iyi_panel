import type { Metadata } from "next";

import { captchaGerekli } from "@/lib/captcha";
import KayitFormu from "@/components/kayit/KayitFormu";
import "../panel.css";

export const metadata: Metadata = {
  title: "Hesap Aç | İyi Yatırım",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function KayitSayfasi() {
  return (
    <div className="iy">
      <div className="iy-govde iy-dar" style={{ paddingTop: 48 }}>
        <h1 className="iy-baslik">Hesap Aç</h1>
        <p className="iy-alt">
          Bilgilerinizi girin, işlem hesabınız anında oluşturulsun. Belirlediğiniz
          şifreyle hem panele hem işlem terminaline girersiniz.
        </p>

        {process.env.DEMO_MOD !== "1" && (
          <div className="iy-mesaj bilgi">
            <strong>Canlı sunucu.</strong> Bu formu her gönderdiğinizde
            client.iyiyatirim.org üzerinde <strong>gerçek</strong> bir müşteri
            kaydı ve işlem hesabı oluşur. Test kayıtlarını sonra BackOffice&apos;ten
            temizlemeyi unutmayın.
          </div>
        )}

        <KayitFormu
          captchaGerekli={captchaGerekli}
          siteAnahtari={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        />
      </div>
    </div>
  );
}
