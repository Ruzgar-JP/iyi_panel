import Link from "next/link";

import {
  DURUM_ETIKET,
  yoneticiTalepleri,
  type TalepDurumu,
  type TalepTipi,
} from "@/lib/talepler";
import { paraFormat, tarihFormat } from "@/lib/bicim";
import { yontemMetni } from "@/lib/odeme";
import TalepIslem from "@/components/yonetim/TalepIslem";
import CanliBakiye from "@/components/yonetim/CanliBakiye";
import TalepSil from "@/components/yonetim/TalepSil";

export const dynamic = "force-dynamic";

const TIPLER: { deger: "" | TalepTipi; etiket: string }[] = [
  { deger: "", etiket: "Tümü" },
  { deger: "yatirim", etiket: "Para yatırma" },
  { deger: "cekim", etiket: "Para çekme" },
];

const DURUMLAR: { deger: "" | TalepDurumu; etiket: string }[] = [
  { deger: "", etiket: "Tümü" },
  { deger: "beklemede", etiket: "Beklemede" },
  { deger: "onaylandi", etiket: "Onaylandı" },
  { deger: "reddedildi", etiket: "Reddedildi" },
  { deger: "iptal", etiket: "İptal" },
];

export default async function TaleplerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string; durum?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const tip = (sp.tip === "yatirim" || sp.tip === "cekim" ? sp.tip : undefined) as
    | TalepTipi
    | undefined;
  const durum = (
    ["beklemede", "onaylandi", "reddedildi", "iptal"].includes(sp.durum ?? "")
      ? sp.durum
      : undefined
  ) as TalepDurumu | undefined;

  const talepler = await yoneticiTalepleri({ tip, durum, arama: sp.q });

  const baglanti = (yeni: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const birlesik = { tip: sp.tip, durum: sp.durum, q: sp.q, ...yeni };
    for (const [k, v] of Object.entries(birlesik)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/yonetim/talepler?${qs}` : "/yonetim/talepler";
  };

  return (
    <>
      <h1 className="iy-baslik">Talepler</h1>
      <p className="iy-alt">
        Onay parayı taşımaz — bakiyeyi BackOffice&apos;ten siz düzenledikten sonra
        talebi onaylayın.
      </p>

      <div className="iy-kart" style={{ marginBottom: 16 }}>
        <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ margin: 0, flex: "1 1 180px" }}>
            <span>Ara</span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="E-posta, ad, hesap no veya talep no"
            />
          </label>
          <label style={{ margin: 0, width: 150 }}>
            <span>Tür</span>
            <select name="tip" defaultValue={sp.tip ?? ""}>
              {TIPLER.map((t) => (
                <option key={t.deger} value={t.deger}>{t.etiket}</option>
              ))}
            </select>
          </label>
          <label style={{ margin: 0, width: 150 }}>
            <span>Durum</span>
            <select name="durum" defaultValue={sp.durum ?? ""}>
              {DURUMLAR.map((d) => (
                <option key={d.deger} value={d.deger}>{d.etiket}</option>
              ))}
            </select>
          </label>
          <button className="iy-btn">Filtrele</button>
          <Link className="iy-btn sade" href="/yonetim/talepler">Sıfırla</Link>
        </form>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Link className="iy-btn sade kucuk" href={baglanti({ durum: "beklemede" })}>
          Yalnızca bekleyenler
        </Link>
        <Link className="iy-btn sade kucuk" href={baglanti({ tip: "cekim", durum: "beklemede" })}>
          Bekleyen çekimler
        </Link>
      </div>

      {talepler.length === 0 ? (
        <div className="iy-kart"><div className="iy-bos">Kayıt bulunamadı.</div></div>
      ) : (
        <div className="iy-kaydir">
          <table>
            <thead>
              <tr>
                <th>No</th><th>Tarih</th><th>Müşteri</th><th>Tür</th>
                <th>Tutar</th><th>Yöntem / Hedef</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {talepler.map((t) => {
                const ozet = t.yontem_ozeti as {
                  ad?: string;
                  tip?: string;
                  detaylar?: Record<string, string>;
                };
                return (
                  <tr key={t.id}>
                    <td className="kucuk-yazi">#{t.id}</td>
                    <td className="kucuk-yazi">{tarihFormat(t.olusturma)}</td>
                    <td>
                      {t.ad_soyad ?? "—"}
                      <div className="kucuk-yazi">{t.eposta}</div>
                      <div className="kucuk-yazi">
                        <Link href={`/yonetim/hesap?login=${t.login}`}>
                          Hesap {t.login}
                        </Link>
                      </div>
                    </td>
                    <td>{t.tip === "yatirim" ? "Yatırım" : "Çekim"}</td>
                    <td className="sayi">
                      {paraFormat(Number(t.tutar))} {t.para_birimi}
                      {t.tip === "cekim" && t.bakiye_anlik && (
                        <div className="kucuk-yazi" style={{ fontWeight: 400 }}>
                          talep anı serbest: {paraFormat(t.bakiye_anlik.margin_free)}
                        </div>
                      )}
                      {t.durum === "beklemede" && (
                        <div style={{ fontWeight: 400, marginTop: 8 }}>
                          <CanliBakiye
                            login={Number(t.login)}
                            talepTutari={
                              t.tip === "cekim" ? Number(t.tutar) : undefined
                            }
                          />
                        </div>
                      )}
                    </td>
                    <td className="kucuk-yazi" style={{ maxWidth: 240 }}>
                      {ozet?.ad ?? "—"}
                      {ozet?.detaylar && (
                        <div style={{ wordBreak: "break-all" }}>
                          {yontemMetni(ozet.tip ?? "", ozet.detaylar)}
                        </div>
                      )}
                      {t.hedef_hesap && (
                        <div style={{ wordBreak: "break-all", marginTop: 4 }}>
                          <strong>Hedef:</strong> {t.hedef_hesap}
                        </div>
                      )}
                      {t.musteri_notu && (
                        <div style={{ marginTop: 4 }}>Not: {t.musteri_notu}</div>
                      )}
                      {t.dekont_id && (
                        <div style={{ marginTop: 4 }}>
                          <a href={`/api/yonetim/dosya/${t.dekont_id}`}>Dekontu indir</a>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`iy-rozet ${t.durum}`}>{DURUM_ETIKET[t.durum]}</span>
                      {t.yonetici_notu && (
                        <div className="kucuk-yazi" style={{ marginTop: 5, maxWidth: 200 }}>
                          {t.yonetici_notu}
                        </div>
                      )}
                      {t.sonuclanma && (
                        <div className="kucuk-yazi">{tarihFormat(t.sonuclanma)}</div>
                      )}
                    </td>
                    <td>
                      {t.durum === "beklemede" && (
                        <TalepIslem id={t.id} tip={t.tip} />
                      )}
                      <TalepSil
                        id={t.id}
                        ozet={`${t.tip === "yatirim" ? "Yatırım" : "Çekim"} · ${paraFormat(Number(t.tutar))} ${t.para_birimi} · ${t.eposta}`}
                      />
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
