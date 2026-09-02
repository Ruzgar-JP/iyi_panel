"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function GirisFormu() {
  const router = useRouter();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);

    try {
      const yanit = await fetch("/api/panel/giris", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eposta, sifre }),
      });
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Giriş yapılamadı.");
        return;
      }
      router.replace("/panel");
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form onSubmit={gonder} noValidate>
      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}

      <label>
        <span>E-posta</span>
        <input
          type="email"
          value={eposta}
          onChange={(e) => setEposta(e.target.value)}
          autoComplete="email"
          autoFocus
          required
        />
      </label>

      <label>
        <span>Şifre</span>
        <input
          type="password"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button className="iy-btn tam" disabled={bekliyor || !eposta || !sifre}>
        {bekliyor ? "Giriş yapılıyor…" : "Giriş Yap"}
      </button>

      <p style={{ textAlign: "center", margin: "14px 0 0", fontSize: 14 }}>
        <Link href="/panel/sifremi-unuttum">Şifremi unuttum</Link>
      </p>
    </form>
  );
}
