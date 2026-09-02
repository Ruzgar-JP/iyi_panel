import { musteriOturumu } from "@/lib/oturum";
import { acikYontemler } from "@/lib/odeme";
import {
  cekilebilirTutar,
  cekilemeyenKalemler,
  cekimYapilabilirMi,
} from "@/lib/talepler";
import { LIMIT } from "@/lib/ayarlar";
import { tarihFormat } from "@/lib/bicim";
import CekimFormu from "@/components/panel/CekimFormu";

export const dynamic = "force-dynamic";

export default async function CekimSayfasi() {
  const oturum = (await musteriOturumu())!;
  const [yontemler, kontrol] = await Promise.all([
    acikYontemler("cekim"),
    cekimYapilabilirMi(oturum.musteriId),
  ]);

  return (
    <div className="iy-dar">
      <h1 className="iy-baslik">Para Çek</h1>
      <p className="iy-alt">
        Çekim talebiniz incelendikten sonra bildirdiğiniz hesaba gönderilir.
        Aşağıdaki bakiye giriş anına aittir
        {oturum.bakiyeZamani && ` (${tarihFormat(oturum.bakiyeZamani)})`}; talep
        oluştururken güncel bakiyeniz yeniden kontrol edilir.
      </p>

      {!kontrol.uygun && (
        <div className="iy-mesaj bilgi">{kontrol.sebep}</div>
      )}

      {yontemler.length === 0 ? (
        <div className="iy-mesaj bilgi">
          Şu anda çekime açık bir ödeme yöntemi yok. Destek ekibimizle iletişime geçin.
        </div>
      ) : oturum.hesaplar.length === 0 ? (
        <div className="iy-mesaj bilgi">İşlem hesabınız bulunamadı.</div>
      ) : (
        <CekimFormu
          kilitli={!kontrol.uygun}
          hesaplar={oturum.hesaplar.map((h) => ({
            login: h.login,
            grup: h.grup ?? "—",
            bakiye: h.bakiye,
            cekilebilir: h.bakiye ? cekilebilirTutar(h.bakiye) : null,
            cekilemeyen: h.bakiye ? cekilemeyenKalemler(h.bakiye) : [],
            paraBirimi: h.paraBirimi,
          }))}
          yontemler={yontemler.map((y) => ({
            id: y.id,
            tip: y.tip,
            ad: y.ad,
            paraBirimi: y.para_birimi,
          }))}
          minTutar={LIMIT.minTutar}
          beklemeSn={LIMIT.bakiyeBeklemeSn}
        />
      )}
    </div>
  );
}
