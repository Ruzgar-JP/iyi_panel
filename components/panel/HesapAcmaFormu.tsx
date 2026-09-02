"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Hesap = {
  login: number;
  tur: string;
  paraBirimi: string;
  kaldirac: number;
  sifreAyarlandi: boolean;
  geciciSifre: string | null;
};

export default function HesapAcmaFormu() {
  const router = useRouter();
  const [sifre, setSifre] = useState("");
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [hesap, setHesap] = useState<Hesap | null>(null);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekliyor(true);
    try {
      const yanit = await fetch("/api/panel/hesap-ac", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sifre }),
      });
      const veri = await yanit.json();
      if (!veri.ok) {
        setHata(veri.mesaj ?? "Hesap açılamadı.");
        return;
      }
      setHesap(veri.hesap);
      setSifre("");
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
    } finally {
      setBekliyor(false);
    }
  }

  if (hesap) {
    return (
      <div className="iy-mesaj ok" role="status">
        <strong>Yeni işlem hesabınız açıldı: {hesap.login}</strong>
        <p style={{ margin: "8px 0 0" }}>
          {hesap.tur} · {hesap.paraBirimi} · kaldıraç 1:{hesap.kaldirac}
        </p>
        {hesap.sifreAyarlandi ? (
          <p style={{ margin: "8px 0 0" }}>
            İşlem terminaline hesap numaranız ve mevcut panel şifrenizle girebilirsiniz.
          </p>
        ) : (
          <p style={{ margin: "8px 0 0" }}>
            Geçici işlem şifreniz: <strong>{hesap.geciciSifre ?? "oluşturulamadı"}</strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <form className="iy-kart" onSubmit={gonder} noValidate>
      <h2>Yeni işlem hesabı aç</h2>
      <p className="kucuk-yazi" style={{ marginTop: 0 }}>
        Yeni hesabınız, mevcut müşteri kaydınıza bağlanır. Güvenliğiniz için panel
        şifrenizi doğrulayın. İşlem platformu şifreyi güncellemeyi kabul ederse
        terminal şifreniz de aynı olur.
      </p>
      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}
      <label>
        <span>Mevcut panel şifresi</span>
        <input
          type="password"
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button className="iy-btn" disabled={bekliyor}>
        {bekliyor ? "Hesap açılıyor…" : "Yeni Hesap Aç"}
      </button>
    </form>
  );
}
