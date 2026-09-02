"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";

import { SIFRE_KURALLARI } from "@/lib/sifre";
import KayitSonucu, { type AcilanHesap } from "./KayitSonucu";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (jeton: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          language?: string;
          theme?: "auto" | "light" | "dark";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

type Hata = { mesaj: string; alanHatalari?: string[]; musteriOlustu?: boolean; etiket?: string };

const BOS = {
  ad: "",
  soyad: "",
  eposta: "",
  telefon: "",
  sifre: "",
  sifreTekrar: "",
  pazarlamaIzni: false,
  sozlesme: false,
};

export default function KayitFormu({
  captchaGerekli,
  siteAnahtari,
}: {
  captchaGerekli: boolean;
  siteAnahtari: string;
}) {
  const [form, setForm] = useState(BOS);
  const [hata, setHata] = useState<Hata | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [sifreGoster, setSifreGoster] = useState(false);
  const [sonuc, setSonuc] = useState<AcilanHesap | null>(null);

  const [captchaJetonu, setCaptchaJetonu] = useState<string | null>(null);
  const captchaKutusu = useRef<HTMLDivElement>(null);
  const captchaKimligi = useRef<string | null>(null);

  const captchaKur = useCallback(() => {
    if (!captchaGerekli || !window.turnstile || !captchaKutusu.current) return;
    if (captchaKimligi.current || !siteAnahtari) return;
    captchaKimligi.current = window.turnstile.render(captchaKutusu.current, {
      sitekey: siteAnahtari,
      language: "tr",
      theme: "auto",
      callback: setCaptchaJetonu,
      "expired-callback": () => setCaptchaJetonu(null),
      "error-callback": () => setCaptchaJetonu(null),
    });
  }, [captchaGerekli, siteAnahtari]);

  useEffect(() => {
    if (window.turnstile) captchaKur();
  }, [captchaKur]);

  const captchaSifirla = () => {
    setCaptchaJetonu(null);
    if (window.turnstile && captchaKimligi.current) {
      window.turnstile.reset(captchaKimligi.current);
    }
  };

  const guncelle =
    (alan: keyof typeof BOS) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const deger = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((o) => ({ ...o, [alan]: deger }));
    };

  const sifreDurumu = SIFRE_KURALLARI.map((k) => ({
    id: k.id,
    etiket: k.etiket,
    tamam: k.gecti(form.sifre),
  }));
  const sifreTamam = sifreDurumu.every((k) => k.tamam);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    const yerel: string[] = [];
    if (form.ad.trim().length < 2) yerel.push("Ad en az 2 karakter olmalı.");
    if (form.soyad.trim().length < 2) yerel.push("Soyad en az 2 karakter olmalı.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(form.eposta.trim()))
      yerel.push("Geçerli bir e-posta adresi girin.");
    if (!form.telefon.trim()) yerel.push("Telefon zorunludur.");
    if (!sifreTamam) yerel.push("Şifre kuralları sağlanmıyor.");
    if (form.sifre !== form.sifreTekrar) yerel.push("Şifreler birbiriyle uyuşmuyor.");
    if (!form.sozlesme) yerel.push("Kullanıcı sözleşmesini kabul etmeniz gerekiyor.");

    if (yerel.length) {
      setHata({ mesaj: "Formda düzeltilmesi gereken alanlar var:", alanHatalari: yerel });
      return;
    }
    if (captchaGerekli && !captchaJetonu) {
      setHata({ mesaj: "Lütfen güvenlik doğrulamasını tamamlayın." });
      return;
    }

    setBekliyor(true);
    try {
      const yanit = await fetch("/api/kayit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad: form.ad,
          soyad: form.soyad,
          eposta: form.eposta,
          telefon: form.telefon,
          sifre: form.sifre,
          pazarlamaIzni: form.pazarlamaIzni,
          captchaJetonu,
        }),
      });
      const veri = await yanit.json();

      if (!veri.ok) {
        captchaSifirla();
        setHata({
          mesaj: veri.mesaj ?? "Kayıt tamamlanamadı.",
          alanHatalari: veri.alanHatalari,
          musteriOlustu: veri.musteriOlustu,
          etiket: veri.etiket,
        });
        return;
      }
      setSonuc({ ...veri.hesap, eposta: veri.eposta });
    } catch {
      captchaSifirla();
      setHata({ mesaj: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin." });
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <>
      {captchaGerekli && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={captchaKur}
        />
      )}

      {sonuc && <KayitSonucu hesap={sonuc} onKapat={() => setSonuc(null)} />}

      <form className="iy-kart" onSubmit={gonder} noValidate>
        {hata && (
          <div className="iy-mesaj hata" role="alert">
            <strong>{hata.mesaj}</strong>
            {hata.alanHatalari && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                {hata.alanHatalari.map((h) => <li key={h}>{h}</li>)}
              </ul>
            )}
            {hata.musteriOlustu && (
              <p style={{ margin: "10px 0 0", fontSize: 13 }}>
                Not: Üyeliğiniz oluşturuldu, yalnızca işlem hesabı açılamadı. Aynı
                e-posta ile tekrar kayıt olmayı denemeyin.
              </p>
            )}
            {hata.etiket && (
              <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.75 }}>
                Hata kodu: {hata.etiket}
              </p>
            )}
          </div>
        )}

        <div className="iy-izgara">
          <label>
            <span>Ad</span>
            <input type="text" value={form.ad} onChange={guncelle("ad")} autoComplete="given-name" required />
          </label>
          <label>
            <span>Soyad</span>
            <input type="text" value={form.soyad} onChange={guncelle("soyad")} autoComplete="family-name" required />
          </label>
        </div>

        <label>
          <span>E-posta</span>
          <input type="email" value={form.eposta} onChange={guncelle("eposta")} autoComplete="email" required />
        </label>

        <label>
          <span>Telefon</span>
          <input
            type="tel"
            value={form.telefon}
            onChange={guncelle("telefon")}
            placeholder="0532 111 22 33"
            autoComplete="tel"
            required
          />
        </label>

        <label>
          <span>Şifre</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={sifreGoster ? "text" : "password"}
              value={form.sifre}
              onChange={guncelle("sifre")}
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="iy-btn sade"
              onClick={() => setSifreGoster((g) => !g)}
              style={{ flex: "none" }}
            >
              {sifreGoster ? "Gizle" : "Göster"}
            </button>
          </div>
        </label>

        <ul
          style={{ listStyle: "none", padding: 0, margin: "-8px 0 16px", fontSize: 13 }}
        >
          {sifreDurumu.map((k) => (
            <li
              key={k.id}
              style={{
                padding: "2px 0",
                color: k.tamam ? "#067647" : form.sifre ? "#b42318" : "#667085",
              }}
            >
              <span style={{ display: "inline-block", width: 14, fontWeight: 700 }}>
                {k.tamam ? "✓" : "•"}
              </span>
              {k.etiket}
            </li>
          ))}
        </ul>

        <label>
          <span>Şifre (tekrar)</span>
          <input
            type={sifreGoster ? "text" : "password"}
            value={form.sifreTekrar}
            onChange={guncelle("sifreTekrar")}
            autoComplete="new-password"
            required
          />
          <div className="iy-ipucu">
            Bu şifreyle hem müşteri paneline hem işlem terminaline gireceksiniz.
          </div>
        </label>

        <label className="iy-onay">
          <input type="checkbox" checked={form.sozlesme} onChange={guncelle("sozlesme")} required />
          <span>Kullanıcı sözleşmesini ve gizlilik politikasını okudum, kabul ediyorum.</span>
        </label>

        <label className="iy-onay">
          <input type="checkbox" checked={form.pazarlamaIzni} onChange={guncelle("pazarlamaIzni")} />
          <span>Kampanya ve duyurulardan e-posta ile haberdar olmak istiyorum.</span>
        </label>

        {captchaGerekli && <div ref={captchaKutusu} className="iy-captcha" style={{ margin: "16px 0" }} />}

        <button
          className="iy-btn tam"
          disabled={bekliyor || (captchaGerekli && !captchaJetonu)}
        >
          {bekliyor ? "Oluşturuluyor…" : "Hesabımı Oluştur"}
        </button>
      </form>
    </>
  );
}
