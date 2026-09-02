"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Talebi onaylar veya reddeder.
 * Onay parayı taşımaz — yalnızca durumu değiştirir. Bu yüzden onay
 * penceresinde açık bir hatırlatma gösteriyoruz.
 */
export default function TalepIslem({
  id,
  tip,
}: {
  id: number;
  tip: "yatirim" | "cekim";
}) {
  const router = useRouter();
  const [acik, setAcik] = useState<"onay" | "red" | null>(null);
  const [not, setNot] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(durum: "onaylandi" | "reddedildi") {
    setHata(null);

    if (durum === "reddedildi" && !not.trim()) {
      setHata("Red gerekçesi zorunlu.");
      return;
    }

    setBekliyor(true);
    try {
      const yanit = await fetch(`/api/yonetim/talep/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durum, not: not.trim() || null }),
      });
      const veri = await yanit.json();

      if (!veri.ok) {
        setHata(veri.mesaj ?? "İşlem tamamlanamadı.");
        return;
      }
      setAcik(null);
      setNot("");
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  if (!acik) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button className="iy-btn onay kucuk" onClick={() => setAcik("onay")}>
          Onayla
        </button>
        <button className="iy-btn sade kucuk" onClick={() => setAcik("red")}>
          Reddet
        </button>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 210 }}>
      {hata && (
        <div className="iy-mesaj hata" style={{ padding: "7px 10px", fontSize: 13 }}>
          {hata}
        </div>
      )}

      {acik === "onay" && (
        <div className="iy-mesaj bilgi" style={{ padding: "8px 10px", fontSize: 12.5 }}>
          {tip === "yatirim"
            ? "Parayı BackOffice'ten hesaba eklediğinizden emin olun."
            : "Parayı gönderdiğinizden ve BackOffice'ten düştüğünüzden emin olun."}
        </div>
      )}

      <textarea
        value={not}
        onChange={(e) => setNot(e.target.value)}
        placeholder={acik === "red" ? "Red gerekçesi (zorunlu)" : "Not (isteğe bağlı)"}
        maxLength={1000}
        style={{ minHeight: 60, fontSize: 13, marginBottom: 8 }}
      />

      <div style={{ display: "flex", gap: 6 }}>
        <button
          className={`iy-btn kucuk ${acik === "onay" ? "onay" : "red"}`}
          onClick={() => gonder(acik === "onay" ? "onaylandi" : "reddedildi")}
          disabled={bekliyor}
        >
          {bekliyor ? "…" : acik === "onay" ? "Onayla" : "Reddet"}
        </button>
        <button
          className="iy-btn sade kucuk"
          onClick={() => { setAcik(null); setHata(null); }}
          disabled={bekliyor}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
