"use client";

import { useEffect, useRef, useState } from "react";

/**
 * İşlem terminalinin GİRİŞ adresi — hesap numarası + şifre ile girilir.
 *
 * Doğrudan giriş yoluna gidiyoruz: kök adres SPA'nın kendi yönlendirmesine
 * düşüyor ve bu yönlendirme bazen "brand_not_found" ekranıyla sonuçlanıyor.
 * Açık yol vererek o adımı atlıyoruz.
 *
 * ?? yerine || kullanıldı: ortam değişkeni tanımlı ama BOŞ olduğunda da
 * varsayılana düşsün (?? yalnızca null/undefined yakalar).
 */
const TERMINAL_URL =
  process.env.NEXT_PUBLIC_TERMINAL_URL || "https://trade.novatrixmarkets.com/";

export type AcilanHesap = {
  login: number;
  tur: string;
  paraBirimi: string;
  kaldirac: number;
  /** true ise müşteri kendi belirlediği şifreyle girer. */
  sifreAyarlandi: boolean;
  /** Yalnızca şifre ayarlanamadıysa dolu gelir. */
  geciciSifre: string | null;
  eposta: string;
};

export default function KayitSonucu({
  hesap,
  onKapat,
}: {
  hesap: AcilanHesap;
  onKapat: () => void;
}) {
  const [kopyalandi, setKopyalandi] = useState<"no" | "sifre" | null>(null);
  const girisButonu = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    girisButonu.current?.focus();
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onKapat();
    document.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = eski;
      document.removeEventListener("keydown", esc);
    };
  }, [onKapat]);

  async function kopyala(metin: string, hangi: "no" | "sifre") {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalandi(hangi);
      setTimeout(() => setKopyalandi(null), 2000);
    } catch {
      /* pano izni yoksa değer zaten ekranda */
    }
  }

  return (
    <div className="iy-modal-zemin" onClick={onKapat}>
      <div
        className="iy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kayit-basligi"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="iy-modal-ikon" aria-hidden>✓</div>

        <h2 id="kayit-basligi">Hesabınız hazır</h2>
        <p className="iy-modal-alt">
          <strong>{hesap.eposta}</strong> adresiyle kaydınız tamamlandı.
        </p>

        <dl className="iy-ozet">
          <div>
            <dt>Hesap numaranız</dt>
            <dd>
              <button
                type="button"
                className="iy-kopyala"
                onClick={() => kopyala(String(hesap.login), "no")}
              >
                {hesap.login}
                <span>{kopyalandi === "no" ? "kopyalandı" : "kopyala"}</span>
              </button>
            </dd>
          </div>
          <div><dt>Hesap türü</dt><dd>{hesap.tur}</dd></div>
          <div><dt>Para birimi</dt><dd>{hesap.paraBirimi}</dd></div>
          <div><dt>Kaldıraç</dt><dd>1:{hesap.kaldirac}</dd></div>
        </dl>

        {hesap.sifreAyarlandi ? (
          /* Normal durum: müşteri kendi belirlediği şifreyle girer.
             İki giriş noktası farklı KİMLİK kullanıyor, şifre aynı:
               müşteri paneli    → e-posta + şifre
               işlem terminali   → hesap numarası + şifre           */
          <div className="iy-mesaj ok" style={{ marginTop: 16, marginBottom: 0 }}>
            <strong>Şifreniz: kayıt sırasında belirlediğiniz şifre.</strong>
            <p style={{ margin: "8px 0 0", fontSize: 13.5 }}>
              İki yere de <em>aynı şifreyle</em> girersiniz, yalnızca kullanıcı
              adı değişir:
            </p>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5 }}>
              <li>
                <strong>Müşteri paneli</strong> → e-posta adresiniz
              </li>
              <li>
                <strong>İşlem terminali</strong> → hesap numaranız{" "}
                <strong>{hesap.login}</strong>
              </li>
            </ul>
          </div>
        ) : (
          /* Yedek durum: işlem şifresi ayarlanamadı, platformun ürettiği geçici
             şifre gösterilir — yoksa müşteri hesabına hiç giremez. */
          <div className="iy-uyari">
            <div className="iy-uyari-satir">
              <span>Geçici işlem şifreniz</span>
              <button
                type="button"
                className="iy-kopyala vurgulu"
                onClick={() => kopyala(hesap.geciciSifre!, "sifre")}
              >
                {hesap.geciciSifre}
                <span>{kopyalandi === "sifre" ? "kopyalandı" : "kopyala"}</span>
              </button>
            </div>
            <p>
              İşlem terminaline girerken <strong>bu geçici şifreyi</strong> kullanın;
              kendi belirlediğiniz şifre yalnızca müşteri panelinde geçerli. Geçici
              şifre <strong>bir daha gösterilmeyecek</strong>, kaydedin ve ilk
              girişte değiştirin.
            </p>
          </div>
        )}

        <div className="iy-modal-butonlar">
          <a ref={girisButonu} href="/panel/giris" className="iy-btn tam" rel="noopener">
            Müşteri Paneline Gir
          </a>
          <a
            href={TERMINAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="iy-btn sade tam"
            title={`Terminale hesap numaranız (${hesap.login}) ve şifrenizle girin`}
          >
            İşlem Terminaline Gir ↗
          </a>
          <p
            className="kucuk-yazi"
            style={{ textAlign: "center", margin: "-2px 0 0" }}
          >
            Terminalde kullanıcı adı olarak <strong>{hesap.login}</strong> yazın
          </p>
          <button type="button" className="iy-btn sade tam" onClick={onKapat}>
            Daha sonra
          </button>
        </div>
      </div>
    </div>
  );
}
