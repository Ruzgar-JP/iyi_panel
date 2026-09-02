import { tumYontemler } from "@/lib/odeme";
import YontemYonetimi from "@/components/yonetim/YontemYonetimi";

export const dynamic = "force-dynamic";

export default async function YontemlerSayfasi() {
  const yontemler = await tumYontemler();

  return (
    <>
      <h1 className="iy-baslik">Ödeme Yöntemleri</h1>
      <p className="iy-alt">
        Müşterilerin para yatırırken göreceği banka hesapları ve kripto
        cüzdanları. Pasife alınan yöntem müşteriye görünmez; silinen yöntem
        geçmiş talepleri etkilemez.
      </p>

      <YontemYonetimi
        baslangic={yontemler.map((y) => ({
          id: y.id,
          tip: y.tip,
          ad: y.ad,
          paraBirimi: y.para_birimi,
          detaylar: y.detaylar as Record<string, string>,
          aciklama: y.aciklama,
          yatirimaAcik: y.yatirima_acik,
          cekimeAcik: y.cekime_acik,
          aktif: y.aktif,
          sira: y.sira,
        }))}
      />
    </>
  );
}
