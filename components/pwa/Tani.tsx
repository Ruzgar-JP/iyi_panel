"use client";

import { useEffect, useState } from "react";

/**
 * Kurulabilirlik teşhisi.
 *
 * Chrome kurulum penceresini (`beforeinstallprompt`) yalnızca bütün koşullar
 * sağlanınca gönderiyor ve sağlanmadığında HİÇBİR hata vermiyor — sadece
 * sessizce olmuyor. Bu sayfa hangi koşulun tutmadığını tek tek gösterir.
 *
 * Telefonda açılıp okunmak için var; müşteriye gösterilmez.
 */

type Satir = { ad: string; deger: string; iyi: boolean | null };

export default function Tani() {
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [olayGeldi, setOlayGeldi] = useState(false);

  useEffect(() => {
    let iptal = false;

    async function calistir() {
      const s: Satir[] = [];
      const ekle = (ad: string, deger: string, iyi: boolean | null = null) =>
        s.push({ ad, deger, iyi });

      /* --------------------------------------------------------- ortam */
      ekle("Adres", location.origin, location.protocol === "https:" || location.hostname === "localhost");
      ekle("Güvenli bağlam", String(window.isSecureContext), window.isSecureContext);

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true;
      ekle(
        "Uygulama olarak açık",
        standalone ? "EVET — zaten kurulu ve içindesiniz" : "hayır (tarayıcıda)",
        null,
      );

      /* ----------------------------------------------- servis çalışanı */
      if (!("serviceWorker" in navigator)) {
        ekle("Servis çalışanı", "TARAYICI DESTEKLEMİYOR", false);
      } else {
        try {
          const r = await navigator.serviceWorker.register("/sw.js");
          const kayitlar = await navigator.serviceWorker.getRegistrations();
          ekle("SW kayıtlı", `evet (${kayitlar.length} adet)`, kayitlar.length > 0);
          ekle("SW kapsam", r.scope, true);
          ekle(
            "SW durumu",
            r.active ? "etkin" : r.installing ? "kuruluyor" : r.waiting ? "bekliyor" : "yok",
            Boolean(r.active),
          );
          // EN KRİTİK SATIR: SW sayfayı yönetmiyorsa Chrome kurulum sunmaz.
          ekle(
            "SW sayfayı yönetiyor",
            navigator.serviceWorker.controller ? "EVET" : "HAYIR — sayfayı bir kez yenileyin",
            Boolean(navigator.serviceWorker.controller),
          );
        } catch (e) {
          ekle("SW kaydı", "HATA: " + String((e as Error).message).slice(0, 90), false);
        }
      }

      /* ------------------------------------------------------ manifest */
      try {
        const m = await fetch("/manifest.webmanifest").then((r) => r.json());
        const boyutlar: string[] = (m.icons ?? []).map((i: { sizes: string }) => i.sizes);
        ekle("Manifest adı", m.name, Boolean(m.name));
        ekle("start_url", m.start_url, Boolean(m.start_url));
        ekle("display", m.display, ["standalone", "fullscreen", "minimal-ui"].includes(m.display));
        ekle("İkonlar", boyutlar.join(", "), boyutlar.includes("192x192") && boyutlar.includes("512x512"));

        const su = await fetch(m.start_url, { method: "GET" });
        ekle("start_url açılıyor", `HTTP ${su.status}`, su.ok);
      } catch (e) {
        ekle("Manifest", "OKUNAMADI: " + String((e as Error).message).slice(0, 80), false);
      }

      /* ------------------------------------------- zaten kurulu mu (Chrome) */
      type Ilgili = { platform?: string; id?: string };
      const nav = navigator as Navigator & {
        getInstalledRelatedApps?: () => Promise<Ilgili[]>;
      };
      if (nav.getInstalledRelatedApps) {
        try {
          const liste = await nav.getInstalledRelatedApps();
          ekle(
            "Zaten kurulu mu",
            liste.length
              ? "EVET — Chrome bu yüzden kurulum sunmuyor. Android Ayarlar → " +
                "Uygulamalar → İyi Yatırım → Kaldır yapın (ana ekrandan simgeyi " +
                "silmek YETMEZ)."
              : "hayır",
            liste.length === 0,
          );
        } catch {
          ekle("Kurulu sürüm sorgusu", "yapılamadı", null);
        }
      } else {
        ekle("Kurulu sürüm sorgusu", "tarayıcı desteklemiyor (iOS normal)", null);
      }

      /* ------------------------------------------------------ kurulum olayı */
      ekle(
        "Kurulum olayı geldi",
        window.__iyKurulumHazir ? "EVET — tek dokunuşla kurulabilir" : "henüz gelmedi",
        window.__iyKurulumHazir,
      );

      if (!iptal) setSatirlar(s);
    }

    calistir();

    const geldi = () => setOlayGeldi(true);
    window.addEventListener("iy-kurulum-hazir", geldi);
    if (window.__iyKurulumHazir) setOlayGeldi(true);

    return () => {
      iptal = true;
      window.removeEventListener("iy-kurulum-hazir", geldi);
    };
  }, []);

  return (
    <div className="tn">
      <h1>Kurulum teşhisi</h1>

      {olayGeldi && (
        <p className="tn-ok">
          ✓ Kurulum olayı geldi — kurulum sayfasındaki buton tek dokunuşla
          çalışır.
        </p>
      )}

      <table>
        <tbody>
          {satirlar.map((r) => (
            <tr key={r.ad}>
              <th>{r.ad}</th>
              <td className={r.iyi === null ? "" : r.iyi ? "iyi" : "kotu"}>
                {r.deger}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {satirlar.length === 0 && <p>Kontrol ediliyor…</p>}

      <div className="tn-butonlar">
        <button type="button" onClick={() => location.reload()}>
          Sayfayı yenile
        </button>
        <a href="/uygulama">Kurulum sayfası</a>
      </div>

      <p className="tn-not">
        Bu sayfa yalnızca teşhis içindir. &quot;SW sayfayı yönetiyor: HAYIR&quot;
        yazıyorsa bir kez yenileyin — servis çalışanı ilk ziyarette kurulur ama
        sayfayı ancak sonraki açılışta yönetmeye başlar, Chrome da o ana kadar
        kurulum sunmaz.
      </p>
    </div>
  );
}
