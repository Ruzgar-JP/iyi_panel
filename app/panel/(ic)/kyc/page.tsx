import { musteriOturumu } from "@/lib/oturum";
import { BELGE_ETIKET, KYC_ETIKET, musteriBelgeleri } from "@/lib/kyc";
import { tarihFormat } from "@/lib/bicim";
import KycYukle from "@/components/panel/KycYukle";

export const dynamic = "force-dynamic";

export default async function KycSayfasi() {
  const oturum = (await musteriOturumu())!;
  const belgeler = await musteriBelgeleri(oturum.musteriId);

  return (
    <div className="iy-dar">
      <h1 className="iy-baslik">Belgelerim</h1>
      <p className="iy-alt">
        Kimlik doğrulaması için belgelerinizi buradan yükleyebilirsiniz.
        Belgeler ekibimiz tarafından incelenir.
      </p>

      <KycYukle />

      <div className="iy-kart">
        <h2>Yüklediğiniz belgeler</h2>

        {belgeler.length === 0 ? (
          <div className="iy-bos">Henüz belge yüklemediniz.</div>
        ) : (
          <div className="iy-kaydir" style={{ border: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Tarih</th><th>Belge</th><th>Dosya</th><th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {belgeler.map((b) => (
                  <tr key={b.id}>
                    <td className="kucuk-yazi">{tarihFormat(b.olusturma)}</td>
                    <td>{BELGE_ETIKET[b.belge_turu]}</td>
                    <td className="kucuk-yazi">
                      <a href={`/api/panel/dosya/${b.dosya_id}`}>{b.orijinal_ad}</a>
                    </td>
                    <td>
                      <span className={`iy-rozet ${b.durum}`}>{KYC_ETIKET[b.durum]}</span>
                      {b.yonetici_notu && (
                        <div className="kucuk-yazi" style={{ marginTop: 5, maxWidth: 240 }}>
                          {b.yonetici_notu}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
