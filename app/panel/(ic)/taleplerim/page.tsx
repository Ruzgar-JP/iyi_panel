import { musteriOturumu } from "@/lib/oturum";
import { DURUM_ETIKET, musteriTalepleri } from "@/lib/talepler";
import { paraFormat, tarihFormat } from "@/lib/bicim";
import TalepIptal from "@/components/panel/TalepIptal";

export const dynamic = "force-dynamic";

export default async function TaleplerimSayfasi() {
  const oturum = (await musteriOturumu())!;
  const talepler = await musteriTalepleri(oturum.musteriId);

  return (
    <>
      <h1 className="iy-baslik">Taleplerim</h1>
      <p className="iy-alt">
        Para yatırma ve çekme taleplerinizin tamamı ve güncel durumları.
      </p>

      {talepler.length === 0 ? (
        <div className="iy-kart">
          <div className="iy-bos">Henüz bir talebiniz bulunmuyor.</div>
        </div>
      ) : (
        <div className="iy-kaydir">
          <table>
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tür</th>
                <th>Tutar</th>
                <th>Yöntem</th>
                <th>Hesap</th>
                <th>Durum</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {talepler.map((t) => {
                const ozet = t.yontem_ozeti as { ad?: string } | null;
                return (
                  <tr key={t.id}>
                    <td className="kucuk-yazi">{tarihFormat(t.olusturma)}</td>
                    <td>{t.tip === "yatirim" ? "Para yatırma" : "Para çekme"}</td>
                    <td className="sayi">
                      {paraFormat(Number(t.tutar))} {t.para_birimi}
                    </td>
                    <td className="kucuk-yazi">{ozet?.ad ?? "—"}</td>
                    <td className="kucuk-yazi">{t.login}</td>
                    <td>
                      <span className={`iy-rozet ${t.durum}`}>
                        {DURUM_ETIKET[t.durum]}
                      </span>
                      {t.yonetici_notu && (
                        <div className="kucuk-yazi" style={{ marginTop: 5, maxWidth: 260 }}>
                          {t.yonetici_notu}
                        </div>
                      )}
                    </td>
                    <td>
                      {t.durum === "beklemede" && <TalepIptal id={t.id} />}
                      {t.dekont_id && (
                        <a
                          className="kucuk-yazi"
                          href={`/api/panel/dosya/${t.dekont_id}`}
                        >
                          Dekont
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
