import { redirect } from "next/navigation";

import { yoneticiOturumu } from "@/lib/oturum";
import { ayarAnahtariHazir } from "@/lib/kripto";
import { enKotu, kurulumKontrolu, type Durum } from "@/lib/kurulum-kontrol";
import { smtpDurumu, VARSAYILAN_GONDEREN } from "@/lib/sistem-ayarlari";
import EpostaAyarlari from "@/components/yonetim/EpostaAyarlari";

export const dynamic = "force-dynamic";

const ROZET: Record<Durum, { sinif: string; etiket: string }> = {
  ok: { sinif: "onaylandi", etiket: "Tamam" },
  uyari: { sinif: "beklemede", etiket: "Dikkat" },
  hata: { sinif: "reddedildi", etiket: "Eksik" },
};

const OZET: Record<Durum, string> = {
  ok: "Tüm kontroller geçti — kurulum canlıya hazır görünüyor.",
  uyari: "Kurulum çalışıyor ama tamamlanmamış maddeler var.",
  hata: "Canlıya çıkmadan önce giderilmesi gereken eksikler var.",
};

export default async function SistemSayfasi() {
  const oturum = await yoneticiOturumu();
  if (!oturum) redirect("/yonetim/giris");

  // Menüde görünmüyor ama adresi elle yazan olabilir.
  if (oturum.rol !== "yonetici") {
    return (
      <>
        <h1 className="iy-baslik">Sistem</h1>
        <div className="iy-kart">
          <div className="iy-bos">
            Bu sayfa yalnızca tam yetkili kullanıcılara açıktır.
          </div>
        </div>
      </>
    );
  }

  const [maddeler, smtp] = await Promise.all([kurulumKontrolu(), smtpDurumu()]);
  const genel = enKotu(maddeler);

  return (
    <>
      <h1 className="iy-baslik">Sistem</h1>
      <p className="iy-alt">
        Kurulumun durumu ve e-posta ayarları. Buradaki hiçbir ekranda şifre veya
        anahtarın kendisi gösterilmez — yalnızca tanımlı olup olmadığı.
      </p>

      <div
        className={`iy-mesaj ${genel === "ok" ? "ok" : genel === "uyari" ? "bilgi" : "hata"}`}
      >
        {OZET[genel]}
      </div>

      <div className="iy-kart">
        <h2>Kurulum kontrol listesi</h2>
        <div className="iy-kaydir" style={{ border: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Durum</th>
                <th>Madde</th>
              </tr>
            </thead>
            <tbody>
              {maddeler.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className={`iy-rozet ${ROZET[m.durum].sinif}`}>
                      {ROZET[m.durum].etiket}
                    </span>
                  </td>
                  <td>
                    <strong>{m.baslik}</strong>
                    <div className="kucuk-yazi" style={{ marginTop: 3 }}>
                      {m.aciklama}
                    </div>
                    {m.cozum && (
                      <div
                        className="kucuk-yazi"
                        style={{ marginTop: 5, color: "var(--marka)" }}
                      >
                        → {m.cozum}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EpostaAyarlari
        anahtarHazir={ayarAnahtariHazir()}
        sifreKayitli={Boolean(smtp.ayar.sifre) || smtp.sifreCozulemedi}
        baslangic={{
          host: smtp.ayar.host,
          port: smtp.ayar.port,
          kullanici: smtp.ayar.kullanici,
          gonderen: smtp.ayar.gonderen || VARSAYILAN_GONDEREN,
          tls: smtp.ayar.tls,
          siteAdresi: smtp.ayar.siteAdresi,
        }}
      />
    </>
  );
}
