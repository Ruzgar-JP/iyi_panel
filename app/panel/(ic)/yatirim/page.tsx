import { musteriOturumu } from "@/lib/oturum";
import { acikYontemler } from "@/lib/odeme";
import { LIMIT } from "@/lib/ayarlar";
import YatirimFormu from "@/components/panel/YatirimFormu";

export const dynamic = "force-dynamic";

export default async function YatirimSayfasi() {
  const oturum = (await musteriOturumu())!;
  const yontemler = await acikYontemler("yatirim");

  const hesaplar = oturum.hesaplar.map((h) => ({
    login: h.login,
    grup: h.grup ?? "—",
  }));

  return (
    <div className="iy-dar">
      <h1 className="iy-baslik">Para Yatır</h1>
      <p className="iy-alt">
        Ödemenizi aşağıdaki hesaplardan birine gönderin, ardından bu formu
        doldurun. Talebiniz kontrol edildikten sonra bakiyenize yansıtılır.
      </p>

      {yontemler.length === 0 ? (
        <div className="iy-mesaj bilgi">
          Şu anda tanımlı bir ödeme yöntemi yok. Lütfen destek ekibimizle iletişime geçin.
        </div>
      ) : hesaplar.length === 0 ? (
        <div className="iy-mesaj bilgi">
          İşlem hesabınız bulunamadı. Destek ekibimizle iletişime geçin.
        </div>
      ) : (
        <YatirimFormu
          hesaplar={hesaplar}
          yontemler={yontemler.map((y) => ({
            id: y.id,
            tip: y.tip,
            ad: y.ad,
            paraBirimi: y.para_birimi,
            detaylar: y.detaylar,
            aciklama: y.aciklama,
          }))}
          minTutar={LIMIT.minTutar}
          maxTutar={LIMIT.maxTutar}
        />
      )}
    </div>
  );
}
