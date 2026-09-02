import Link from "next/link";

import { musterileriAra } from "@/lib/musteri";
import { tarihFormat } from "@/lib/bicim";
import MusteriDuzenle from "@/components/yonetim/MusteriDuzenle";

export const dynamic = "force-dynamic";

export default async function MusterilerSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const musteriler = await musterileriAra(sp.q);

  return (
    <>
      <h1 className="iy-baslik">Müşteriler</h1>
      <p className="iy-alt">
        Panel kimliği bu veritabanında tutulur. Bilgileri düzenleyebilir, panel
        şifresini sıfırlayabilir veya hesabı devre dışı bırakabilirsiniz.
      </p>

      <div className="iy-kart" style={{ marginBottom: 16 }}>
        <form method="get" style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <label style={{ margin: 0, flex: 1 }}>
            <span>Ara</span>
            <input
              type="text"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="E-posta, ad, soyad, müşteri no veya hesap no"
            />
          </label>
          <button className="iy-btn">Ara</button>
          <Link className="iy-btn sade" href="/yonetim/musteriler">Sıfırla</Link>
        </form>
      </div>

      {musteriler.length === 0 ? (
        <div className="iy-kart"><div className="iy-bos">Müşteri bulunamadı.</div></div>
      ) : (
        <div className="iy-kaydir">
          <table>
            <thead>
              <tr>
                <th>No</th><th>Müşteri</th><th>Telefon</th><th>Hesaplar</th>
                <th>Kayıt</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {musteriler.map((m) => (
                <tr key={m.id}>
                  <td className="kucuk-yazi">#{m.id}</td>
                  <td>
                    {m.ad} {m.soyad}
                    <div className="kucuk-yazi">{m.eposta}</div>
                  </td>
                  <td className="kucuk-yazi">{m.telefon ?? "—"}</td>
                  <td className="kucuk-yazi">
                    {m.hesaplar
                      ? m.hesaplar.split(", ").map((l) => (
                          <div key={l}>
                            <Link href={`/yonetim/hesap?login=${l}`}>{l}</Link>
                          </div>
                        ))
                      : "—"}
                  </td>
                  <td className="kucuk-yazi">{tarihFormat(m.olusturma)}</td>
                  <td>
                    <span className={`iy-rozet ${m.aktif ? "onaylandi" : "iptal"}`}>
                      {m.aktif ? "Aktif" : "Pasif"}
                    </span>
                    {m.son_giris && (
                      <div className="kucuk-yazi" style={{ marginTop: 4 }}>
                        son giriş {tarihFormat(m.son_giris)}
                      </div>
                    )}
                  </td>
                  <td>
                    <MusteriDuzenle
                      musteri={{
                        id: m.id,
                        ad: m.ad,
                        soyad: m.soyad,
                        eposta: m.eposta,
                        telefon: m.telefon ?? "",
                        aktif: m.aktif,
                      }}
                    />
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
