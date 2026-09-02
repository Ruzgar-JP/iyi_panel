import Link from "next/link";

import { sql } from "@/lib/db";
import { tarihFormat } from "@/lib/bicim";

export const dynamic = "force-dynamic";

type Kayit = {
  id: number;
  yonetici_id: number | null;
  yonetici_ad: string | null;
  customer_id: number | null;
  eylem: string;
  hedef_tur: string | null;
  hedef_id: number | null;
  detay: Record<string, unknown>;
  ip: string | null;
  olusturma: Date;
};

const EYLEM_ETIKET: Record<string, string> = {
  "musteri.giris": "Müşteri girişi",
  "musteri.kayit": "Yeni müşteri kaydı",
  "musteri.islem_sifresi_degisti": "Müşteri işlem şifresini değiştirdi",
  "yonetici.giris": "Yönetici girişi",
  "talep.olustur.yatirim": "Yatırım talebi oluşturuldu",
  "talep.olustur.cekim": "Çekim talebi oluşturuldu",
  "talep.onaylandi": "Talep onaylandı",
  "talep.reddedildi": "Talep reddedildi",
  "talep.iptal": "Talep iptal edildi",
  "talep.sil": "Talep SİLİNDİ",
  "kyc.yukle": "Belge yüklendi",
  "kyc.onaylandi": "Belge onaylandı",
  "kyc.reddedildi": "Belge reddedildi",
  "yontem.ekle": "Ödeme yöntemi eklendi",
  "yontem.guncelle": "Ödeme yöntemi güncellendi",
  "yontem.sil": "Ödeme yöntemi silindi",
  "hesap.guncelle": "Hesap bilgileri güncellendi",
  "hesap.sifre_sifirla": "İşlem şifresi sıfırlandı",
};

export default async function KayitlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ eylem?: string }>;
}) {
  const sp = await searchParams;
  const suzgec = sp.eylem?.trim();

  const kayitlar = await sql<Kayit[]>`
    SELECT k.*, y.ad_soyad AS yonetici_ad
      FROM islem_kayitlari k
      LEFT JOIN yoneticiler y ON y.id = k.yonetici_id
     WHERE true
       ${suzgec ? sql`AND k.eylem LIKE ${suzgec + "%"}` : sql``}
     ORDER BY k.olusturma DESC
     LIMIT 300
  `;

  return (
    <>
      <h1 className="iy-baslik">İşlem Kayıtları</h1>
      <p className="iy-alt">
        Kim neyi ne zaman değiştirdi. Silinen taleplerin tam kopyası da burada
        saklanır — satır gider, izi kalır.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Link className="iy-btn sade kucuk" href="/yonetim/kayitlar">Tümü</Link>
        <Link className="iy-btn sade kucuk" href="/yonetim/kayitlar?eylem=talep.sil">
          Silinen talepler
        </Link>
        <Link className="iy-btn sade kucuk" href="/yonetim/kayitlar?eylem=talep">Talepler</Link>
        <Link className="iy-btn sade kucuk" href="/yonetim/kayitlar?eylem=hesap">Hesap işlemleri</Link>
        <Link className="iy-btn sade kucuk" href="/yonetim/kayitlar?eylem=kyc">Belgeler</Link>
      </div>

      {kayitlar.length === 0 ? (
        <div className="iy-kart"><div className="iy-bos">Kayıt bulunamadı.</div></div>
      ) : (
        <div className="iy-kaydir">
          <table>
            <thead>
              <tr>
                <th>Zaman</th><th>Kim</th><th>Eylem</th><th>Hedef</th><th>Ayrıntı</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => {
                const silinen = k.eylem === "talep.sil";
                const d = k.detay ?? {};
                const kopya = d.silinen_kayit as Record<string, unknown> | undefined;

                return (
                  <tr key={k.id}>
                    <td className="kucuk-yazi">{tarihFormat(k.olusturma)}</td>
                    <td className="kucuk-yazi">
                      {k.yonetici_ad ?? (k.customer_id ? `müşteri #${k.customer_id}` : "sistem")}
                      {k.ip && <div>{k.ip}</div>}
                    </td>
                    <td>
                      <span
                        className={`iy-rozet ${silinen ? "reddedildi" : "iptal"}`}
                        style={{ fontWeight: silinen ? 700 : 600 }}
                      >
                        {EYLEM_ETIKET[k.eylem] ?? k.eylem}
                      </span>
                    </td>
                    <td className="kucuk-yazi">
                      {k.hedef_tur ? `${k.hedef_tur} #${k.hedef_id}` : "—"}
                    </td>
                    <td className="kucuk-yazi" style={{ maxWidth: 340 }}>
                      {typeof d.gerekce === "string" && (
                        <div><strong>Gerekçe:</strong> {d.gerekce}</div>
                      )}
                      {kopya && (
                        <div style={{ marginTop: 4 }}>
                          Silinen: {String(kopya.tip)} · {String(kopya.tutar)}{" "}
                          {String(kopya.para_birimi)} · {String(kopya.eposta)} · hesap{" "}
                          {String(kopya.login)} · durum {String(kopya.durum)}
                        </div>
                      )}
                      {!kopya && !d.gerekce && (
                        <span style={{ wordBreak: "break-all" }}>
                          {JSON.stringify(d).slice(0, 160)}
                        </span>
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
