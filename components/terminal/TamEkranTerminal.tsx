"use client";

import { useEffect, useRef, useState } from "react";

export default function TamEkranTerminal({ terminalUrl }: { terminalUrl: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);

  function retry() {
    setLoaded(false);
    setDelayed(false);
    if (frame.current) frame.current.src = terminalUrl;
  }

  return (
    <main className="tm">
      {!loaded && <div className="tm-bekle">
        <img src="/ikon-192.png" alt="" width={56} height={56} />
        <p>İşlem terminali açılıyor…</p>
        {delayed && <div className="tm-gecikti">
          <p>Beklenenden uzun sürdü. Bağlantınızı kontrol edin.</p>
          <button type="button" onClick={retry}>Tekrar dene</button>
          <a href={terminalUrl}>Tarayıcıda aç</a>
        </div>}
      </div>}
      <iframe ref={frame} src={terminalUrl} title="İyi Yatırım işlem terminali" onLoad={() => setLoaded(true)} allow="clipboard-write; fullscreen" />
    </main>
  );
}
