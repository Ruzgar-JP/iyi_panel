import Link from "next/link";

import { musteriOturumu } from "@/lib/oturum";
import {
  cekilebilirTutar,
  cekilemeyenKalemler,
  musteriTalepleri,
  DURUM_ETIKET,
} from "@/lib/talepler";
import { kycOzeti } from "@/lib/kyc";
import { paraFormat, tarihFormat } from "@/lib/bicim";
import HesapAcmaFormu from "@/components/panel/HesapAcmaFormu";

export const dynamic = "force-dynamic";

export default async function OzetSayfasi() {
  const oturum = (await musteriOturumu())!;
  const [talepler, kyc] = await Promise.all([
    musteriTalepleri(oturum.musteriId),
    kycOzeti(oturum.musteriId),
  ]);

  const sonUc = talepler.slice(0, 3);

  return (
    <>
      <h1 className="iy-baslik">Merhaba{oturum.adSoyad ? `, ${oturum.adSoyad}` : ""}</h1>
      <p className="iy-alt">
        Hesap özetiniz aşağıda. Bakiye bilgisi giriş yaptığınız anda alınmıştır
        {oturum.bakiyeZamani && ` (${tarihFormat(oturum.bakiyeZamani)})`}.
      </p>

      {oturum.hesaplar.length === 0 && (
        <div className="iy-mesaj bilgi">
          Hesabınıza bağlı bir işlem hesabı bulunamadı. Destek ekibimizle iletişime geçin.
        </div>
      )}

      {oturum.hesaplar.map((h) => (
        <div className="iy-kart" key={h.login}>
          <h2>
            Hesap {h.login}{" "}
            <span className="kucuk-yazi" style={{ fontWeight: 400 }}>
              · {h.grup ?? "—"}
              {h.paraBirimi && ` · ${h.paraBirimi}`}
              {h.kaldirac && ` · kaldıraç 1:${h.kaldirac}`}
            </span>
          </h2>

          {h.bakiye ? (
            <dl className="iy-bakiye">
              <div>
                <dt>Bakiye</dt>
                <dd>{paraFormat(h.bakiye.balance)}</dd>
              </div>
              <div>
                <dt>Varlık (equity)</dt>
                <dd>{paraFormat(h.bakiye.equity)}</dd>
              </div>
              {cekilemeyenKalemler(h.bakiye).map((k) => (
                <div key={k.etiket}>
                  <dt>{k.etiket}</dt>
                  <dd style={{ color: "#667085" }}>{paraFormat(k.tutar)}</dd>
                </div>
              ))}
              <div className="vurgu">
                <dt>Çekilebilir</dt>
                <dd>{paraFormat(cekilebilirTutar(h.bakiye))}</dd>
              </div>
            </dl>
          ) : (
            <p className="kucuk-yazi">Bakiye bilgisi şu anda alınamadı.</p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <Link className="iy-btn" href="/panel/yatirim">Para Yatır</Link>
            <Link className="iy-btn sade" href="/panel/cekim">Para Çek</Link>
          </div>
        </div>
      ))}

      <HesapAcmaFormu />

      <div className="iy-kart">
        <h2>Belge durumu</h2>
        {kyc.toplam === 0 ? (
          <p className="kucuk-yazi" style={{ margin: 0 }}>
            Henüz belge yüklemediniz.{" "}
            <Link href="/panel/kyc">Belge yükleyin</Link>
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            {kyc.onaylandi > 0 && <span className="iy-rozet onaylandi">{kyc.onaylandi} onaylı</span>}{" "}
            {kyc.beklemede > 0 && <span className="iy-rozet beklemede">{kyc.beklemede} incelemede</span>}{" "}
            {kyc.reddedildi > 0 && <span className="iy-rozet reddedildi">{kyc.reddedildi} reddedildi</span>}{" "}
            <Link href="/panel/kyc" className="kucuk-yazi">Belgelerim</Link>
          </p>
        )}
      </div>

      <div className="iy-kart">
        <h2>Son talepleriniz</h2>
        {sonUc.length === 0 ? (
          <p className="kucuk-yazi" style={{ margin: 0 }}>Henüz talebiniz yok.</p>
        ) : (
          <div className="iy-kaydir">
            <table>
              <thead>
                <tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Durum</th></tr>
              </thead>
              <tbody>
                {sonUc.map((t) => (
                  <tr key={t.id}>
                    <td className="kucuk-yazi">{tarihFormat(t.olusturma)}</td>
                    <td>{t.tip === "yatirim" ? "Para yatırma" : "Para çekme"}</td>
                    <td className="sayi">{paraFormat(Number(t.tutar))} {t.para_birimi}</td>
                    <td><span className={`iy-rozet ${t.durum}`}>{DURUM_ETIKET[t.durum]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ marginTop: 12, marginBottom: 0 }}>
          <Link href="/panel/taleplerim" className="kucuk-yazi">Tüm talepleri gör</Link>
        </p>
      </div>
    </>
  );
}
