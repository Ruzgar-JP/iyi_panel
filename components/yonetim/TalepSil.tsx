"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Talebi kalıcı olarak siler.
 * Silinen kaydın tam kopyası işlem kaydına yazılır, iz kaybolmaz.
 */
export default function TalepSil({
  id,
  ozet,
}: {
  id: number;
  /** Onay ekranında gösterilecek kısa özet — yanlış kaydı silmeyi zorlaştırır. */
  ozet: string;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [gerekce, setGerekce] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function sil() {
    setHata(null);
    if (!gerekce.trim()) {
      setHata("Silme gerekçesi zorunlu.");
      return;
    }
    setBekliyor(true);
    try {
      const yanit = await fetch(`/api/yonetim/talep/${id}/sil`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gerekce: gerekce.trim() }),
      });
      const veri = await yanit.json();
      if (!veri.ok) {
        setHata(veri.mesaj ?? "Silinemedi.");
        return;
      }
      setAcik(false);
      router.refresh();
    } catch {
      setHata("Sunucuya ulaşılamadı.");
    } finally {
      setBekliyor(false);
    }
  }

  if (!acik) {
    return (
      <button
        className="iy-btn sade kucuk"
        onClick={() => setAcik(true)}
        title="Talebi kalıcı olarak sil"
      >
        Sil
      </button>
    );
  }

  return (
    <div style={{ minWidth: 200, marginTop: 6 }}>
      <div
        className="iy-mesaj hata"
        style={{ padding: "8px 10px", fontSize: 12.5, marginBottom: 8 }}
      >
        <strong>#{id} silinecek</strong>
        <div style={{ marginTop: 3 }}>{ozet}</div>
        <div style={{ marginTop: 5 }}>Bu işlem geri alınamaz.</div>
      </div>

      {hata && (
        <div className="iy-mesaj hata" style={{ padding: "6px 9px", fontSize: 12.5 }}>
          {hata}
        </div>
      )}

      <textarea
        value={gerekce}
        onChange={(e) => setGerekce(e.target.value)}
        placeholder="Silme gerekçesi (zorunlu)"
        maxLength={500}
        style={{ minHeight: 54, fontSize: 13, marginBottom: 8 }}
      />

      <div style={{ display: "flex", gap: 6 }}>
        <button className="iy-btn red kucuk" onClick={sil} disabled={bekliyor}>
          {bekliyor ? "…" : "Kalıcı olarak sil"}
        </button>
        <button
          className="iy-btn sade kucuk"
          onClick={() => { setAcik(false); setHata(null); }}
          disabled={bekliyor}
        >
          Vazgeç
        </button>
      </div>
    </div>
  );
}
