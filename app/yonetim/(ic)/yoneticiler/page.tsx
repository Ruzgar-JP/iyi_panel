import { redirect } from "next/navigation";

import { yoneticiOturumu } from "@/lib/oturum";
import { tumYoneticiler } from "@/lib/yoneticiler";
import YoneticiYonetimi from "@/components/yonetim/YoneticiYonetimi";

export const dynamic = "force-dynamic";

export default async function YoneticilerSayfasi() {
  const oturum = await yoneticiOturumu();
  if (!oturum) redirect("/yonetim/giris");

  // Menüde görünmüyor ama adresi elle yazan olabilir.
  if (oturum.rol !== "yonetici") {
    return (
      <>
        <h1 className="iy-baslik">Kullanıcılar</h1>
        <div className="iy-kart">
          <div className="iy-bos">
            Bu sayfa yalnızca tam yetkili kullanıcılara açıktır.
          </div>
        </div>
      </>
    );
  }

  const liste = await tumYoneticiler();

  return (
    <>
      <h1 className="iy-baslik">Kullanıcılar</h1>
      <p className="iy-alt">
        Yönetim paneline girebilecek personel. <strong>Operatör</strong> günlük
        işleri yapar; <strong>tam yetkili</strong> ayrıca personel ekler ve şifre
        sıfırlar. İşten ayrılan birini silmek yerine <strong>pasif</strong> yapın —
        girişi kapanır, geçmiş işlemlerinde adı durur.
      </p>

      <YoneticiYonetimi
        kendiId={oturum.yoneticiId}
        baslangic={liste.map((y) => ({
          id: Number(y.id),
          eposta: y.eposta,
          adSoyad: y.ad_soyad,
          rol: y.rol,
          aktif: y.aktif,
          olusturma: new Date(y.olusturma).toISOString(),
          sonGiris: y.son_giris ? new Date(y.son_giris).toISOString() : null,
        }))}
      />
    </>
  );
}
