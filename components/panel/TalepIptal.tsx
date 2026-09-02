"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TalepIptal({ id }: { id: number }) {
  const router = useRouter();
  const [onay, setOnay] = useState(false);
  const [bekliyor, setBekliyor] = useState(false);

  async function iptal() {
    setBekliyor(true);
    try {
      const yanit = await fetch(`/api/panel/talep/${id}/iptal`, { method: "POST" });
      const veri = await yanit.json();
      if (veri.ok) router.refresh();
      else alert(veri.mesaj ?? "Talep iptal edilemedi.");
    } finally {
      setBekliyor(false);
      setOnay(false);
    }
  }

  if (!onay) {
    return (
      <button className="iy-btn sade kucuk" onClick={() => setOnay(true)}>
        İptal et
      </button>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button className="iy-btn red kucuk" onClick={iptal} disabled={bekliyor}>
        {bekliyor ? "…" : "Eminim"}
      </button>
      <button className="iy-btn sade kucuk" onClick={() => setOnay(false)}>
        Vazgeç
      </button>
    </span>
  );
}
