import Link from "next/link";
import "./panel.css";

export const dynamic = "force-dynamic";

/** Test ortamı giriş sayfası — üretimde bu dosyayı silin. */
export default function AnaSayfa() {
  const demo = process.env.DEMO_MOD === "1";

  return (
    <div className="iy">
      <div className="iy-govde iy-dar" style={{ paddingTop: 56 }}>
        <h1 className="iy-baslik">İyi Yatırım — Test Ortamı</h1>
        <p className="iy-alt">
          {demo
            ? "Demo modu açık: canlı sunucuya hiçbir istek gitmiyor, veriler sahte."
            : "Demo modu KAPALI: gerçek ScaleTrade sunucusuna bağlanılıyor."}
        </p>

        {!demo && (
          <div className="iy-mesaj bilgi">
            <strong>Dikkat:</strong> demo modu kapalı. Giriş yapılan her hesap
            canlı sunucudan sorgulanır. Test için <code>DEMO_MOD=1</code> yapın.
          </div>
        )}

        <div className="iy-kart">
          <h2>Müşteri paneli</h2>
          <p className="kucuk-yazi">
            Bakiye görüntüleme, para yatırma/çekme talebi, belge yükleme, şifre
            değiştirme.
          </p>
          {demo && (
            <p className="kucuk-yazi" style={{ marginTop: 10 }}>
              Demo girişi:{" "}
              <strong>demo@iyiyatirim.org</strong> / <strong>Demo1234!</strong>
            </p>
          )}
          <Link className="iy-btn" href="/panel/giris" style={{ marginTop: 12, display: "inline-block", textDecoration: "none" }}>
            Müşteri paneline git
          </Link>
        </div>

        <div className="iy-kart">
          <h2>Yönetim paneli</h2>
          <p className="kucuk-yazi">
            Talep onay/red, canlı bakiye kontrolü, belge inceleme, ödeme yöntemi
            yönetimi.
          </p>
          <p className="kucuk-yazi" style={{ marginTop: 10 }}>
            Giriş bilgileri <code>npm run kur</code> çıktısında yazıyor.
          </p>
          <Link className="iy-btn" href="/yonetim/giris" style={{ marginTop: 12, display: "inline-block", textDecoration: "none" }}>
            Yönetim paneline git
          </Link>
        </div>

        {demo && (
          <div className="iy-kart">
            <h2>Demo senaryoları</h2>
            <ol className="kucuk-yazi" style={{ paddingLeft: 20, margin: 0, lineHeight: 1.9 }}>
              <li>Müşteri panelinden <strong>para yatırma</strong> talebi oluşturun (dekont ekleyebilirsiniz).</li>
              <li>Yönetim panelinde talebi görün, <strong>güncel bakiyeyi getirin</strong>, onaylayın.</li>
              <li>Müşteri panelinde durumun <strong>Onaylandı</strong> olduğunu görün.</li>
              <li><strong>Para çekme</strong> deneyin — bakiyeden fazlasını isteyince engellenir.</li>
              <li>Çekim yaptıktan sonra tekrar deneyin — bekleme süresi uyarısı çıkar.</li>
              <li>Yönetimde bir talebi <strong>reddedin</strong>; gerekçe müşteri tarafında görünür.</li>
              <li><strong>Belge yükleyin</strong>, yönetimden onaylayın veya reddedin.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
