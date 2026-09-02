"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TURLER = [
  { deger: "kimlik_on", etiket: "Kimlik — ön yüz" },
  { deger: "kimlik_arka", etiket: "Kimlik — arka yüz" },
  { deger: "pasaport", etiket: "Pasaport" },
  { deger: "ikametgah", etiket: "İkametgah belgesi" },
  { deger: "banka_dekontu", etiket: "Banka hesap dökümü" },
  { deger: "diger", etiket: "Diğer" },
];

export default function KycYukle() {
  const router = useRouter();
  const dosyaGirdi = useRef<HTMLInputElement>(null);

  const [tur, setTur] = useState(TURLER[0].deger);
  const [dosya, setDosya] = useState<File | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBasari(null);

    if (!dosya) return setHata("Lütfen bir dosya seçin.");

    const form = new FormData();
    form.set("belgeTuru", tur);
    form.set("dosya", dosya);

    setBekliyor(true);
    try {
      const yanit = await fetch("/api/panel/kyc", { method: "POST", body: form });
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "Belge yüklenemedi.");
        return;
      }
      setBasari(veri.mesaj);
      setDosya(null);
      if (dosyaGirdi.current) dosyaGirdi.current.value = "";
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <form className="iy-kart" onSubmit={gonder} noValidate>
      <h2>Yeni belge yükle</h2>

      {hata && <div className="iy-mesaj hata" role="alert">{hata}</div>}
      {basari && <div className="iy-mesaj ok" role="status">{basari}</div>}

      <label>
        <span>Belge türü</span>
        <select value={tur} onChange={(e) => setTur(e.target.value)}>
          {TURLER.map((t) => (
            <option key={t.deger} value={t.deger}>{t.etiket}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Dosya</span>
        <input
          ref={dosyaGirdi}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
          onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
          required
        />
        <div className="iy-ipucu">
          JPG, PNG, WEBP, HEIC veya PDF. Belgenin tamamı okunaklı ve kesilmemiş olmalı.
        </div>
      </label>

      <button className="iy-btn" disabled={bekliyor || !dosya}>
        {bekliyor ? "Yükleniyor…" : "Belgeyi Gönder"}
      </button>
    </form>
  );
}
