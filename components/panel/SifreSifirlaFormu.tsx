"use client";

import { useState } from "react";
import Link from "next/link";

import { SIFRE_KURALLARI } from "@/lib/sifre";

export default function SifreSifirlaFormu({ jeton }: { jeton: string }) {
  const [yeni, setYeni] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const durum = SIFRE_KURALLARI.map((k) => ({ ...k, tamam: k.gecti(yeni) }));
  const hepsiTamam = durum.every((k) => k.tamam);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    if (!hepsiTamam) return setHata("Şifre kuralları sağlanmıyor.");
    if (yeni !== tekrar) return setHata("Şifreler birbiriyle uyuşmuyor.");

    setBekliyor(true);
    try {
      const y = await fetch("/api/panel/sifre-sifirla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jeton, yeniSifre: yeni }),
      });
      const v = await y.json();
      if (!v.ok) {
        setHata(v.mesaj ?? "Şifre değiştirilemedi.");
        return;
      }
      setBasari(v.mesaj);
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  if (basari) {
    return (
      <>
        <div className="iy-mesaj ok" role="status">{basari}</div>
        <Link className="iy-btn tam" href="/panel/giris" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Giriş Yap
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={gonder} noValidate>
      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}

      <label>
        <span>Yeni şifre</span>
        <input
          type="password"
          value={yeni}
          onChange={(e) => setYeni(e.target.value)}
          autoComplete="new-password"
          autoFocus
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
      </label>

      <button className="iy-btn tam" disabled={bekliyor || !hepsiTamam}>
        {bekliyor ? "Kaydediliyor…" : "Şifremi Değiştir"}
      </button>
    </form>
  );
}
