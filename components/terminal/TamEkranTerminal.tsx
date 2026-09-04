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

      // iOS klavye açıldığında layout viewport aynı kalabilir; oysa
      // visualViewport gerçek, kullanıcının gördüğü alanı verir. Terminal
      // çerçevesini buna göre küçültmezsek alt işlem tuşları klavyenin altında
      // kalır. offset değerleri Safari'nin görünür alanı kaydırdığı durumda
      // çerçevenin de aynı yerde kalmasını sağlar.
      const width = Math.round(window.visualViewport?.width ?? host.clientWidth);
      const height = Math.round(window.visualViewport?.height ?? host.clientHeight);
      const top = Math.round(window.visualViewport?.offsetTop ?? 0);
      const left = Math.round(window.visualViewport?.offsetLeft ?? 0);
      if (width > 0 && height > 0) {
        host.style.width = `${width}px`;
        host.style.height = `${height}px`;
        host.style.top = `${top}px`;
        host.style.left = `${left}px`;
        iframe.style.width = `${width}px`;
        iframe.style.height = `${height}px`;
      }
    };

    syncFrameSize();
    const observer = new ResizeObserver(syncFrameSize);
    if (container.current) observer.observe(container.current);
    window.visualViewport?.addEventListener("resize", syncFrameSize);
    window.visualViewport?.addEventListener("scroll", syncFrameSize);
    window.addEventListener("orientationchange", syncFrameSize);

    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener("resize", syncFrameSize);
      window.visualViewport?.removeEventListener("scroll", syncFrameSize);
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
