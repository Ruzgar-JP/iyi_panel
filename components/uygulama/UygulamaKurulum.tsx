"use client";

import { useEffect, useState } from "react";

type Platform = "android" | "ios" | "desktop";
function platformBelirle(): Platform {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(agent)) return "android";
  return "desktop";
}

export default function UygulamaKurulum({ secili }: { secili?: "android" | "ios" }) {
  const [platform, setPlatform] = useState<Platform>(secili ?? "desktop");
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(secili ?? platformBelirle());
    setInstallable(Boolean(window.__iyKurulum));
    const ready = () => setInstallable(true);
    const done = () => setInstalled(true);
    window.addEventListener("iy-kurulum-hazir", ready);
    window.addEventListener("iy-kuruldu", done);
    return () => { window.removeEventListener("iy-kurulum-hazir", ready); window.removeEventListener("iy-kuruldu", done); };
  }, [secili]);

  async function install() {
    const prompt = window.__iyKurulum;
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
  }

  if (installed) return <main className="ku"><section className="ku-kart"><h1>Uygulama eklendi</h1><p>Artık ana ekranınızdaki İyi Yatırım simgesinden terminali açabilirsiniz.</p><a className="ku-btn" href="/terminal">İşlem terminalini aç</a></section></main>;

  if (platform === "ios") return <main className="ku"><section className="ku-kart"><img className="ku-ikon" src="/ikon-192.png" alt="İyi Yatırım" width={72} height={72} /><h1>İyi Yatırım’ı yükleyin</h1><p>Safari’de aşağıdaki üç adımı izleyin:</p><ol><li>Sayfanın altındaki <strong>Paylaş</strong> simgesine dokunun.</li><li><strong>Ana Ekrana Ekle</strong> seçeneğini bulun.</li><li><strong>Ekle</strong>ye dokunun.</li></ol><a className="ku-btn ikincil" href="/terminal">Terminali tarayıcıda aç</a></section></main>;

  return <main className="ku"><section className="ku-kart"><img className="ku-ikon" src="/ikon-192.png" alt="İyi Yatırım" width={72} height={72} /><h1>İyi Yatırım uygulaması</h1><p>İşlem terminalini ana ekranınıza ekleyin; tek dokunuşla tam ekran açın.</p>{installable ? <button className="ku-btn" type="button" onClick={install}>Ana ekrana ekle</button> : <p className="ku-not">Tarayıcı menüsünden “Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğini kullanın.</p>}<a className="ku-btn ikincil" href="/terminal">Terminali tarayıcıda aç</a></section></main>;
}
