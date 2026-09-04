"use client";

import { useEffect, useRef, useState } from "react";

export default function TamEkranTerminal({ terminalUrl }: { terminalUrl: string }) {
  const container = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncFrameSize = () => {
      const host = container.current;
      const iframe = frame.current;
      if (!host || !iframe) return;

      const width = Math.round(host.clientWidth);
      const height = Math.round(host.clientHeight);
      if (width > 0 && height > 0) {
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
      }
    };

    syncFrameSize();
    const observer = new ResizeObserver(syncFrameSize);
    if (container.current) observer.observe(container.current);
    window.visualViewport?.addEventListener("resize", syncFrameSize);
    window.addEventListener("orientationchange", syncFrameSize);

    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", syncFrameSize);
      window.removeEventListener("orientationchange", syncFrameSize);
    };
  }, []);

  function retry() {
    setLoaded(false);
    setDelayed(false);
    if (frame.current) frame.current.src = terminalUrl;
  }

  return (
    <main className="tm" ref={container}>
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
