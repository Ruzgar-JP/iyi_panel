"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tip = "banka" | "kripto";

type Yontem = {
  id: number;
  tip: Tip;
  ad: string;
  paraBirimi: string;
  detaylar: Record<string, string>;
  aciklama: string | null;
  yatirimaAcik: boolean;
  cekimeAcik: boolean;
  aktif: boolean;
  sira: number;
};

const ALANLAR: Record<Tip, { ad: string; etiket: string; zorunlu?: boolean }[]> = {
  banka: [
    { ad: "banka", etiket: "Banka adı" },
    { ad: "hesap_sahibi", etiket: "Hesap sahibi" },
    { ad: "iban", etiket: "IBAN", zorunlu: true },
    { ad: "sube", etiket: "Şube / hesap no" },
  ],
  kripto: [
    { ad: "ag", etiket: "Ağ (TRC20, ERC20…)" },
    { ad: "adres", etiket: "Cüzdan adresi", zorunlu: true },
    { ad: "etiket", etiket: "Memo / Etiket" },
  ],
};

const BOS = (tip: Tip): Yontem => ({
  id: 0,
  tip,
  ad: "",
  paraBirimi: tip === "kripto" ? "USDT" : "TRY",
  detaylar: {},
  aciklama: null,
  yatirimaAcik: true,
  cekimeAcik: true,
  aktif: true,
  sira: 0,
});

export default function YontemYonetimi({ baslangic }: { baslangic: Yontem[] }) {
  const router = useRouter();
  const [duzenlenen, setDuzenlenen] = useState<Yontem | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [silinecek, setSilinecek] = useState<number | null>(null);

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!duzenlenen) return;
    setHata(null);

    const yeni = duzenlenen.id === 0;
    setBekliyor(true);
    try {
      const yanit = await fetch(
        yeni ? "/api/yonetim/yontem" : `/api/yonetim/yontem/${duzenlenen.id}`,
        {
          method: yeni ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(duzenlenen),
        },
      );
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Kaydedilemedi.");
        return;
      }
      setDuzenlenen(null);
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  async function sil(id: number) {
    setBekliyor(true);
    try {
      const yanit = await fetch(`/api/yonetim/yontem/${id}`, { method: "DELETE" });
      const veri = await yanit.json();
      if (!veri.ok) alert(veri.mesaj ?? "Silinemedi.");
      else router.refresh();
    } finally {
      setBekliyor(false);
      setSilinecek(null);
    }
  }

  const alanGuncelle = (alan: string, deger: string) =>
    setDuzenlenen((y) =>
      y ? { ...y, detaylar: { ...y.detaylar, [alan]: deger } } : y,
    );

  return (
    <>
      {!duzenlenen && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="iy-btn" onClick={() => setDuzenlenen(BOS("banka"))}>
            Banka hesabı ekle
          </button>
          <button className="iy-btn sade" onClick={() => setDuzenlenen(BOS("kripto"))}>
            Kripto cüzdanı ekle
          </button>
        </div>
      )}

      {duzenlenen && (
        <form className="iy-kart" onSubmit={kaydet} style={{ marginBottom: 20 }}>
          <h2>
            {duzenlenen.id === 0 ? "Yeni" : "Düzenle"} ·{" "}
            {duzenlenen.tip === "banka" ? "Banka hesabı" : "Kripto cüzdanı"}
          </h2>

          {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}

          <div className="iy-izgara">
            <label>
              <span>Görünen ad</span>
              <input
                type="text"
                value={duzenlenen.ad}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, ad: e.target.value })}
                placeholder={duzenlenen.tip === "banka" ? "Ziraat Bankası TRY" : "USDT TRC20"}
                required
              />
            </label>
            <label>
              <span>Para birimi</span>
              <input
                type="text"
                value={duzenlenen.paraBirimi}
                onChange={(e) =>
                  setDuzenlenen({ ...duzenlenen, paraBirimi: e.target.value.toUpperCase() })
                }
                placeholder="TRY"
                required
              />
            </label>
          </div>

          {ALANLAR[duzenlenen.tip].map((a) => (
            <label key={a.ad}>
              <span>
                {a.etiket}
                {a.zorunlu && " *"}
              </span>
              <input
                type="text"
                value={duzenlenen.detaylar[a.ad] ?? ""}
                onChange={(e) => alanGuncelle(a.ad, e.target.value)}
                required={a.zorunlu}
              />
            </label>
          ))}

          <label>
            <span>Müşteriye gösterilecek açıklama</span>
            <textarea
              value={duzenlenen.aciklama ?? ""}
              onChange={(e) => setDuzenlenen({ ...duzenlenen, aciklama: e.target.value })}
              maxLength={500}
              placeholder="Açıklama kısmına hesap numaranızı yazmayın gibi uyarılar"
            />
          </label>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
            {(
              [
                ["yatirimaAcik", "Para yatırmada göster"],
                ["cekimeAcik", "Para çekmede göster"],
                ["aktif", "Aktif"],
              ] as const
            ).map(([alan, etiket]) => (
              <label key={alan} style={{ display: "flex", alignItems: "center", gap: 7, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={duzenlenen[alan]}
                  onChange={(e) => setDuzenlenen({ ...duzenlenen, [alan]: e.target.checked })}
                />
                <span style={{ margin: 0, fontWeight: 400 }}>{etiket}</span>
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 7, margin: 0 }}>
              <span style={{ margin: 0, fontWeight: 400 }}>Sıra</span>
              <input
                type="number"
                value={duzenlenen.sira}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, sira: Number(e.target.value) })}
                style={{ width: 80 }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="iy-btn" disabled={bekliyor}>
              {bekliyor ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
              type="button"
              className="iy-btn sade"
              onClick={() => { setDuzenlenen(null); setHata(null); }}
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}

      {baslangic.length === 0 ? (
        <div className="iy-kart"><div className="iy-bos">Henüz ödeme yöntemi eklenmemiş.</div></div>
      ) : (
        <div className="iy-kaydir">
          <table>
            <thead>
              <tr>
                <th>Sıra</th><th>Ad</th><th>Tür</th><th>Bilgiler</th>
                <th>Kullanım</th><th>Durum</th><th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {baslangic.map((y) => (
                <tr key={y.id}>
                  <td className="kucuk-yazi">{y.sira}</td>
                  <td>
                    {y.ad}
                    <div className="kucuk-yazi">{y.paraBirimi}</div>
                  </td>
                  <td>{y.tip === "banka" ? "Banka" : "Kripto"}</td>
                  <td className="kucuk-yazi" style={{ maxWidth: 260, wordBreak: "break-all" }}>
                    {Object.entries(y.detaylar).map(([k, v]) => (
                      <div key={k}>{k}: {v}</div>
                    ))}
                  </td>
                  <td className="kucuk-yazi">
                    {y.yatirimaAcik && <div>Yatırım</div>}
                    {y.cekimeAcik && <div>Çekim</div>}
                  </td>
                  <td>
                    <span className={`iy-rozet ${y.aktif ? "onaylandi" : "iptal"}`}>
                      {y.aktif ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td>
                    {silinecek === y.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="iy-btn red kucuk" onClick={() => sil(y.id)} disabled={bekliyor}>
                          Eminim
                        </button>
                        <button className="iy-btn sade kucuk" onClick={() => setSilinecek(null)}>
                          Vazgeç
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="iy-btn sade kucuk" onClick={() => setDuzenlenen(y)}>
                          Düzenle
                        </button>
                        <button className="iy-btn sade kucuk" onClick={() => setSilinecek(y.id)}>
                          Sil
                        </button>
                      </div>
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
