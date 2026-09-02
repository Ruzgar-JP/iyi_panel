"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Yontem = {
  id: number;
  tip: "banka" | "kripto";
  ad: string;
  paraBirimi: string;
  detaylar: Record<string, string | undefined>;
  aciklama: string | null;
};

const ALAN_ETIKET: Record<string, string> = {
  banka: "Banka",
  hesap_sahibi: "Hesap sahibi",
  iban: "IBAN",
  sube: "Şube",
  ag: "Ağ",
  adres: "Cüzdan adresi",
  etiket: "Memo / Etiket",
};

export default function YatirimFormu({
  hesaplar,
  yontemler,
  minTutar,
  maxTutar,
}: {
  hesaplar: { login: number; grup: string }[];
  yontemler: Yontem[];
  minTutar: number;
  maxTutar: number;
}) {
  const router = useRouter();

  const [login, setLogin] = useState(hesaplar[0]?.login ?? 0);
  const [yontemId, setYontemId] = useState(yontemler[0]?.id ?? 0);
  const [tutar, setTutar] = useState("");
  const [not, setNot] = useState("");
  const [dekont, setDekont] = useState<File | null>(null);

  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState<string | null>(null);

  const secili = yontemler.find((y) => y.id === yontemId);

  async function kopyala(deger: string, alan: string) {
    try {
      await navigator.clipboard.writeText(deger);
      setKopyalandi(alan);
      setTimeout(() => setKopyalandi(null), 1800);
    } catch { /* pano izni yoksa değer zaten ekranda */ }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBasari(null);

    const sayi = Number(tutar.replace(",", "."));
    if (!Number.isFinite(sayi) || sayi <= 0) return setHata("Geçerli bir tutar girin.");
    if (sayi < minTutar || sayi > maxTutar) {
      return setHata(`Tutar ${minTutar} ile ${maxTutar} arasında olmalı.`);
    }

    const form = new FormData();
    form.set("tip", "yatirim");
    form.set("login", String(login));
    form.set("yontemId", String(yontemId));
    form.set("tutar", String(sayi));
    form.set("not", not);
    if (dekont) form.set("dekont", dekont);

    setBekliyor(true);
    try {
      const yanit = await fetch("/api/panel/talep", { method: "POST", body: form });
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Talebiniz oluşturulamadı.");
        return;
      }
      setBasari(veri.mesaj);
      setTutar("");
      setNot("");
      setDekont(null);
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form className="iy-kart" onSubmit={gonder} noValidate>
      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}
      {basari && <div className="iy-mesaj ok" role="status">{basari}</div>}

      {hesaplar.length > 1 && (
        <label>
          <span>Hangi hesaba yatırılacak</span>
          <select value={login} onChange={(e) => setLogin(Number(e.target.value))}>
            {hesaplar.map((h) => (
              <option key={h.login} value={h.login}>
                {h.login} — {h.grup}
              </option>
            ))}
          </select>
        </label>
      )}

      <span
        style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#344054" }}
      >
        Ödeme yöntemi
      </span>

      {yontemler.map((y) => (
        <label className="iy-yontem" key={y.id}>
          <input
            type="radio"
            name="yontem"
            value={y.id}
            checked={yontemId === y.id}
            onChange={() => setYontemId(y.id)}
          />
          <span className="iy-yontem-ad">{y.ad}</span>
          <span className="kucuk-yazi"> · {y.paraBirimi}</span>

          {yontemId === y.id && (
            <div className="iy-yontem-detay">
              <dl className="iy-yontem-detay-listesi">
                {Object.entries(y.detaylar).map(([alan, deger]) =>
                  deger ? (
                    <div className="iy-yontem-detay-satir" key={alan}>
                      <dt>{ALAN_ETIKET[alan] ?? alan}</dt>
                      <dd>
                        <span className="iy-yontem-deger">{deger}</span>
                        <button
                          type="button"
                          className="iy-kopyala-buton"
                          aria-label={`${ALAN_ETIKET[alan] ?? alan} bilgisini kopyala`}
                          onClick={(ev) => { ev.preventDefault(); kopyala(deger, `${y.id}-${alan}`); }}
                        >
                          {kopyalandi === `${y.id}-${alan}` ? "Kopyalandı ✓" : "Kopyala"}
                        </button>
                      </dd>
                    </div>
                  ) : null,
                )}
              </dl>
              <p className="sr-only" aria-live="polite" aria-atomic="true">
                {kopyalandi ? "Bilgi panoya kopyalandı." : ""}
              </p>
              {y.aciklama && (
                <p className="kucuk-yazi" style={{ fontFamily: "inherit", marginTop: 8 }}>
                  {y.aciklama}
                </p>
              )}
            </div>
          )}
        </label>
      ))}

      <label style={{ marginTop: 16 }}>
        <span>Yatırdığınız tutar ({secili?.paraBirimi})</span>
        <input
          type="text"
          inputMode="decimal"
          value={tutar}
          onChange={(e) => setTutar(e.target.value)}
          placeholder="0,00"
          required
        />
        <div className="iy-ipucu">
          Gönderdiğiniz tutarı birebir yazın. Farklı tutar girilirse talep reddedilebilir.
        </div>
      </label>

      <label>
        <span>Dekont / ekran görüntüsü (isteğe bağlı)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={(e) => setDekont(e.target.files?.[0] ?? null)}
        />
        <div className="iy-ipucu">Dekont eklemeniz onay sürecini hızlandırır.</div>
      </label>

      <label>
        <span>Not (isteğe bağlı)</span>
        <textarea value={not} onChange={(e) => setNot(e.target.value)} maxLength={1000} />
      </label>

      <button className="iy-btn tam" disabled={bekliyor}>
        {bekliyor ? "Gönderiliyor…" : "Yatırım Talebi Oluştur"}
      </button>
    </form>
  );
}
