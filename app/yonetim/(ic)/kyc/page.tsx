import Link from "next/link";

import { BELGE_ETIKET, KYC_ETIKET, yoneticiBelgeleri, type KycDurumu } from "@/lib/kyc";
import { tarihFormat } from "@/lib/bicim";
import KycIslem from "@/components/yonetim/KycIslem";

export const dynamic = "force-dynamic";

export default async function YonetimKycSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const durum = (
    ["beklemede", "onaylandi", "reddedildi"].includes(sp.durum ?? "")
      ? sp.durum
      : undefined
  ) as KycDurumu | undefined;

  const belgeler = await yoneticiBelgeleri({ durum, arama: sp.q });

  return (
    <>
      <h1 className="iy-baslik">Müşteri Belgeleri</h1>
      <p className="iy-alt">Yüklenen kimlik ve adres belgelerini burada inceleyin.</p>

      <div className="iy-kart" style={{ marginBottom: 16 }}>
        <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ margin: 0, flex: "1 1 200px" }}>
            <span>Ara</span>
            <input type="text" name="q" defaultValue={sp.q ?? ""} placeholder="E-posta, ad veya müşteri no" />
          </label>
          <label style={{ margin: 0, width: 160 }}>
            <span>Durum</span>
            <select name="durum" defaultValue={sp.durum ?? ""}>
              <option value="">Tümü</option>
              <option value="beklemede">İncelemede</option>
              <option value="onaylandi">Onaylandı</option>
              <option value="reddedildi">Reddedildi</option>
            </select>
          </label>
          <button className="iy-btn">Filtrele</button>
          <Link className="iy-btn sade" href="/yonetim/kyc">Sıfırla</Link>
        </form>
      </div>

      {belgeler.length === 0 ? (
        <div className="iy-kart"><div className="iy-bos">Kayıt bulunamadı.</div></div>
      ) : (
        <div className="iy-kaydir">
          <table>
            <thead>
              <tr>
                <th>Tarih</th><th>Müşteri</th><th>Belge</th><th>Dosya</th>
                <th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {belgeler.map((b) => (
                <tr key={b.id}>
                  <td className="kucuk-yazi">{tarihFormat(b.olusturma)}</td>
                  <td>
                    {b.ad_soyad ?? "—"}
                    <div className="kucuk-yazi">{b.eposta}</div>
                    <div className="kucuk-yazi">Müşteri #{b.customer_id}</div>
                  </td>
                  <td>{BELGE_ETIKET[b.belge_turu]}</td>
                  <td className="kucuk-yazi">
                    <a href={`/api/yonetim/dosya/${b.dosya_id}`}>{b.orijinal_ad}</a>
                    <div>{Math.round(b.boyut / 1024)} KB</div>
                  </td>
                  <td>
                    <span className={`iy-rozet ${b.durum}`}>{KYC_ETIKET[b.durum]}</span>
                    {b.yonetici_notu && (
                      <div className="kucuk-yazi" style={{ marginTop: 5, maxWidth: 200 }}>
                        {b.yonetici_notu}
                      </div>
                    )}
                  </td>
                  <td>
                    {b.durum === "beklemede" ? (
                      <KycIslem id={b.id} />
                    ) : (
                      <span className="kucuk-yazi">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
