"use client";

import { useState } from "react";

import { SIFRE_KURALLARI } from "@/lib/sifre";

/**
 * Şifre değiştirme. Tek şifre, iki yer:
 * panel girişi (bizim veritabanımız) ve terminal girişi (işlem hesapları).
 */
export default function SifreFormu({ hesapSayisi }: { hesapSayisi: number }) {
  const [mevcut, setMevcut] = useState("");
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");

  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const durum = SIFRE_KURALLARI.map((k) => ({ ...k, tamam: k.gecti(yeni) }));
  const hepsiTamam = durum.every((k) => k.tamam);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBasari(null);
    setUyari(null);

    if (!hepsiTamam) return setHata("Yeni şifre kuralları sağlanmıyor.");
    if (yeni !== tekrar) return setHata("Yeni şifreler birbiriyle uyuşmuyor.");

    setBekliyor(true);
    try {
      const yanit = await fetch("/api/panel/sifre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mevcutSifre: mevcut, yeniSifre: yeni }),
      });
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Şifre değiştirilemedi.");
        return;
      }
      if (veri.kismi) setUyari(veri.mesaj);
      else setBasari(veri.mesaj);

      setMevcut("");
      setYeni("");
      setTekrar("");
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form className="iy-kart" onSubmit={gonder} noValidate>
      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}
      {basari && <div className="iy-mesaj ok" role="status">{basari}</div>}
      {uyari && <div className="iy-mesaj bilgi" role="alert">{uyari}</div>}

      <label>
        <span>Mevcut şifreniz</span>
        <input
          type="password"
          value={mevcut}
          onChange={(e) => setMevcut(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <label>
        <span>Yeni şifre</span>
        <input
          type="password"
          value={yeni}
          onChange={(e) => setYeni(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      <ul style={{ listStyle: "none", padding: 0, margin: "-8px 0 16px", fontSize: 13 }}>
        {durum.map((k) => (
          <li
            key={k.id}
            style={{ padding: "2px 0", color: k.tamam ? "#067647" : yeni ? "#b42318" : "#667085" }}
          >
            <span style={{ display: "inline-block", width: 14, fontWeight: 700 }}>
              {k.tamam ? "✓" : "•"}
            </span>
            {k.etiket}
          </li>
        ))}
      </ul>

      <label>
        <span>Yeni şifre (tekrar)</span>
        <input
          type="password"
          value={tekrar}
          onChange={(e) => setTekrar(e.target.value)}
          autoComplete="new-password"
          required
        />
        <div className="iy-ipucu">
          Yeni şifre hem panel girişinde hem{" "}
          {hesapSayisi === 1 ? "işlem hesabınızda" : `${hesapSayisi} işlem hesabınızda`}{" "}
          geçerli olacak.
        </div>
      </label>

      <button className="iy-btn" disabled={bekliyor || !mevcut || !hepsiTamam}>
        {bekliyor ? "Değiştiriliyor…" : "Şifreyi Değiştir"}
      </button>
    </form>
  );
}
