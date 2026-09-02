import Link from "next/link";

import { jetonKontrol, jetonMesaji } from "@/lib/sifirlama";
import SifreSifirlaFormu from "@/components/panel/SifreSifirlaFormu";

export const dynamic = "force-dynamic";

export default async function SifreSifirlaSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>;
}) {
  const sp = await searchParams;
  const jeton = sp.jeton ?? "";

  // Jeton burada yalnızca KONTROL edilir, tüketilmez — sayfayı açmak
  // bağlantıyı harcamamalı.
  const durum = jeton
    ? await jetonKontrol(jeton)
    : ({ gecerli: false, sebep: "yok" } as const);

  return (
    <div className="iy-govde iy-dar" style={{ paddingTop: 64, maxWidth: 460 }}>
      <h1 className="iy-baslik">Yeni Şifre Belirle</h1>

      {durum.gecerli ? (
        <>
          <p className="iy-alt">
            Yeni şifreniz hem müşteri panelinde hem işlem terminalinde geçerli olacak.
          </p>
          <div className="iy-kart">
            <SifreSifirlaFormu jeton={jeton} />
          </div>
        </>
      ) : (
        <>
          <div className="iy-mesaj hata">{jetonMesaji(durum.sebep)}</div>
          <p style={{ fontSize: 14 }}>
            <Link href="/panel/sifremi-unuttum">Yeni sıfırlama bağlantısı iste</Link>
          </p>
        </>
      )}

      <p style={{ marginTop: 16, fontSize: 14 }}>
        <Link href="/panel/giris">← Giriş sayfasına dön</Link>
      </p>
    </div>
  );
}
