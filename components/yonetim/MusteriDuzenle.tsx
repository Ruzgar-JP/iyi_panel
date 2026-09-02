"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SIFRE_KURALLARI } from "@/lib/sifre";

type Musteri = {
  id: number;
  ad: string;
  soyad: string;
  eposta: string;
  telefon: string;
  aktif: boolean;
};

export default function MusteriDuzenle({ musteri }: { musteri: Musteri }) {
  const router = useRouter();
  const [acik, setAcik] = useState<"bilgi" | "sifre" | null>(null);
  const [form, setForm] = useState(musteri);
  const [yeniSifre, setYeniSifre] = useState("");
  const [terminaleDe, setTerminaleDe] = useState(true);

  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const durum = SIFRE_KURALLARI.map((k) => ({ ...k, tamam: k.gecti(yeniSifre) }));
  const sifreTamam = durum.every((k) => k.tamam);

  async function bilgiKaydet() {
    setHata(null); setBasari(null); setBekliyor(true);
    try {
      const y = await fetch(`/api/yonetim/musteri/${musteri.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad: form.ad, soyad: form.soyad, eposta: form.eposta,
          telefon: form.telefon, aktif: form.aktif,
        }),
      });
      const v = await y.json();
      if (!v.ok) { setHata(v.mesaj ?? "Güncellenemedi."); return; }
      setBasari("Bilgiler güncellendi.");
      setAcik(null);
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally { setBekliyor(false); }
  }

  async function sifreSifirla() {
    setHata(null); setBasari(null); setBekliyor(true);
    try {
      const y = await fetch(`/api/yonetim/musteri/${musteri.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yeniSifre, terminaleDe }),
      });
      const v = await y.json();
      if (!v.ok) { setHata(v.mesaj ?? "Şifre değiştirilemedi."); return; }
      setBasari(v.mesaj);
      setYeniSifre("");
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally { setBekliyor(false); }
  }

  const gir = (k: keyof Musteri) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (!acik) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button className="iy-btn sade kucuk" onClick={() => setAcik("bilgi")}>Düzenle</button>
        <button className="iy-btn sade kucuk" onClick={() => setAcik("sifre")}>Şifre sıfırla</button>
        {basari && <div className="kucuk-yazi" style={{ color: "#067647" }}>{basari}</div>}
      </div>
    );
  }

  return (
    <div style={{ minWidth: 250 }}>
      {hata && (
        <div className="iy-mesaj hata" style={{ padding: "7px 10px", fontSize: 12.5 }}>{hata}</div>
      )}

      {acik === "bilgi" ? (
        <>
          <div className="iy-izgara" style={{ gap: 8 }}>
            <label style={{ marginBottom: 8 }}>
              <span>Ad</span>
              <input type="text" value={form.ad} onChange={gir("ad")} />
            </label>
            <label style={{ marginBottom: 8 }}>
              <span>Soyad</span>
              <input type="text" value={form.soyad} onChange={gir("soyad")} />
            </label>
          </div>
          <label style={{ marginBottom: 8 }}>
            <span>E-posta</span>
            <input type="email" value={form.eposta} onChange={gir("eposta")} />
          </label>
          <label style={{ marginBottom: 8 }}>
            <span>Telefon</span>
            <input type="tel" value={form.telefon} onChange={gir("telefon")} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input type="checkbox" checked={form.aktif} onChange={gir("aktif")} />
            <span style={{ margin: 0, fontWeight: 400, fontSize: 13 }}>
              Aktif (kapalıysa panele giremez)
            </span>
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            <button className="iy-btn kucuk" onClick={bilgiKaydet} disabled={bekliyor}>
              {bekliyor ? "…" : "Kaydet"}
            </button>
            <button className="iy-btn sade kucuk" onClick={() => { setAcik(null); setHata(null); }}>
              Vazgeç
            </button>
          </div>
        </>
      ) : (
        <>
          <label style={{ marginBottom: 8 }}>
            <span>Yeni şifre</span>
            <input
              type="text"
              value={yeniSifre}
              onChange={(e) => setYeniSifre(e.target.value)}
              autoComplete="off"
            />
            <div className="iy-ipucu">Açık gösteriliyor — müşteriye iletmeniz gerekiyor.</div>
          </label>

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", fontSize: 12 }}>
            {durum.map((k) => (
              <li key={k.id} style={{ color: k.tamam ? "#067647" : yeniSifre ? "#b42318" : "#667085" }}>
                <span style={{ display: "inline-block", width: 13, fontWeight: 700 }}>
                  {k.tamam ? "✓" : "•"}
                </span>
                {k.etiket}
              </li>
            ))}
          </ul>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={terminaleDe}
              onChange={(e) => setTerminaleDe(e.target.checked)}
            />
            <span style={{ margin: 0, fontWeight: 400, fontSize: 13 }}>
              İşlem hesaplarına da uygula (önerilir)
            </span>
          </label>

          <div style={{ display: "flex", gap: 6 }}>
            <button className="iy-btn red kucuk" onClick={sifreSifirla} disabled={bekliyor || !sifreTamam}>
              {bekliyor ? "…" : "Şifreyi Değiştir"}
            </button>
            <button
              className="iy-btn sade kucuk"
              onClick={() => { setAcik(null); setHata(null); setYeniSifre(""); }}
            >
              Vazgeç
            </button>
          </div>
        </>
      )}
    </div>
  );
}
