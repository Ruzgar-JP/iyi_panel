import Link from "next/link";

import { bekleyenSayilari, yoneticiTalepleri, DURUM_ETIKET } from "@/lib/talepler";
import { paraFormat, tarihFormat } from "@/lib/bicim";

export const dynamic = "force-dynamic";

export default async function YonetimOzet() {
  const [sayilar, sonTalepler] = await Promise.all([
    bekleyenSayilari(),
    yoneticiTalepleri({ limit: 10 }),
  ]);

  const kutular = [
    { etiket: "Bekleyen yatırım", sayi: sayilar.yatirim, yol: "/yonetim/talepler?tip=yatirim" },
    { etiket: "Bekleyen çekim", sayi: sayilar.cekim, yol: "/yonetim/talepler?tip=cekim" },
    { etiket: "Bekleyen belge", sayi: sayilar.kyc, yol: "/yonetim/kyc" },
  ];

  return (
    <>
      <h1 className="iy-baslik">Özet</h1>
      <p className="iy-alt">Bekleyen işler ve son hareketler.</p>

      <div className="iy-izgara" style={{ marginBottom: 20 }}>
        {kutular.map((k) => (
          <Link key={k.etiket} href={k.yol} className="iy-kart" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="kucuk-yazi">{k.etiket}</div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                marginTop: 4,
                color: k.sayi > 0 ? "#b54708" : "#101828",
              }}
            >
              {k.sayi}
            </div>
          </Link>
        ))}
      </div>

      <div className="iy-kaydir">
        <table>
          <thead>
            <tr>
              <th>Tarih</th><th>Müşteri</th><th>Tür</th><th>Tutar</th><th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {sonTalepler.length === 0 ? (
              <tr><td colSpan={5}><div className="iy-bos">Henüz talep yok.</div></td></tr>
            ) : (
              sonTalepler.map((t) => (
                <tr key={t.id}>
                  <td className="kucuk-yazi">{tarihFormat(t.olusturma)}</td>
                  <td>
                    {t.ad_soyad ?? "—"}
                    <div className="kucuk-yazi">{t.eposta}</div>
                  </td>
                  <td>{t.tip === "yatirim" ? "Yatırım" : "Çekim"}</td>
                  <td className="sayi">{paraFormat(Number(t.tutar))} {t.para_birimi}</td>
                  <td><span className={`iy-rozet ${t.durum}`}>{DURUM_ETIKET[t.durum]}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 14 }}>
        <Link href="/yonetim/talepler" className="kucuk-yazi">Tüm talepleri gör</Link>
      </p>
    </>
  );
}
