"use client";

import { useState } from "react";

export default function SifremiUnuttumFormu() {
  const [eposta, setEposta] = useState("");
  const [sonuc, setSonuc] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setSonuc(null);
    setBekliyor(true);

    try {
      const y = await fetch("/api/panel/sifremi-unuttum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eposta }),
      });
      const v = await y.json();
      if (!v.ok) {
        setHata(v.mesaj ?? "İstek gönderilemedi.");
        return;
      }
      setSonuc(v.mesaj);
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  if (sonuc) {
    return (
      <div className="iy-mesaj ok" style={{ marginBottom: 0 }} role="status">
        {sonuc}
      </div>
    );
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

      <button className="iy-btn tam" disabled={bekliyor || !eposta}>
        {bekliyor ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
      </button>
    </form>
  );
}
