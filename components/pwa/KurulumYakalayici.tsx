import Script from "next/script";

/** Kurulum olayını React yüklenmeden yakalar ve yalnızca üretimde SW kaydeder. */
export default function KurulumYakalayici() {
  const production = process.env.NODE_ENV === "production";
  const script = `
    window.__iyKurulum = null;
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      window.__iyKurulum = event;
      window.dispatchEvent(new Event('iy-kurulum-hazir'));
    });
    window.addEventListener('appinstalled', function () {
      window.__iyKurulum = null;
      window.dispatchEvent(new Event('iy-kuruldu'));
    });
    ${production ? "if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(console.warn);" : ""}
  `;

  return <Script id="iy-pwa" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: script }} />;
}
