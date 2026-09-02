import { musteriOturumu } from "@/lib/oturum";
import SifreFormu from "@/components/panel/SifreFormu";

export const dynamic = "force-dynamic";

export default async function SifreSayfasi() {
  const oturum = (await musteriOturumu())!;

  return (
    <div className="iy-dar">
      <h1 className="iy-baslik">Şifre Değiştir</h1>
      <p className="iy-alt">
        Tek şifreniz var: hem bu panele hem işlem terminaline aynı şifreyle
        girersiniz. Buradan değiştirdiğinizde ikisi birden güncellenir.
      </p>

      {oturum.hesaplar.length === 0 ? (
        <div className="iy-mesaj bilgi">İşlem hesabınız bulunamadı.</div>
      ) : (
        <SifreFormu hesapSayisi={oturum.hesaplar.length} />
      )}
    </div>
  );
}
