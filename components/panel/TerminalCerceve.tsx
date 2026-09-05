"use client";

import { useState } from "react";

/**
 * Terminali panelin içinde gösterir.
 *
 * Neden iframe yerine "aç" butonu da var: gömülü çerçeve her ortamda
 * çalışmayabiliyor. Terminal ayrı bir alan adında olduğu için tarayıcının
 * üçüncü taraf çerez kısıtları devreye girebiliyor — canlıda ikisi de
 * `iyiyatirim.org` altında olduğundan sorun çıkmaz, ama yerel testte
 * (localhost) çıkar. Çerçeve boş kalırsa müşteri butonla devam edebilsin.
 */
export default function TerminalCerceve({
  terminalUrl,
  hesaplar,
  otomatikGiris = false,
}: {
  terminalUrl: string;
  hesaplar: { login: number; paraBirimi: string | null }[];
  otomatikGiris?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [kopyalanan, setKopyalanan] = useState<number | null>(null);

  async function kopyala(login: number) {
    try {
      await navigator.clipboard.writeText(String(login));
      setKopyalanan(login);
      setTimeout(() => setKopyalanan(null), 2000);
    } catch {
      /* izin yoksa sessiz geç — numara zaten ekranda yazılı */
    }
  }

  return (
    <>
      <h1 className="iy-baslik">İşlem Terminali</h1>
      <p className="iy-alt">
        {otomatikGiris ? (
          <>Alım satım ekranı hesabınızla doğrudan açılır; yeniden giriş yapmanız gerekmez.</>
        ) : (
          <>Alım satım ekranı. Terminale <strong>hesap numaranızla</strong>{" "}
          girersiniz — e-posta adresinizle değil. Şifreniz panele girdiğiniz
          şifreyle aynıdır.</>
        )}
      </p>

      {!otomatikGiris && hesaplar.length > 0 && (
        <div className="iy-kart">
          <h2>Giriş bilgileriniz</h2>
          {hesaplar.map((h) => (
            <div className="iy-ozet" key={h.login}>
              <div>
                <dt>Hesap numarası (kullanıcı adı)</dt>
                <dd>
                  <button
                    type="button"
                    className="iy-kopyala vurgulu"
                    onClick={() => kopyala(h.login)}
                  >
                    {h.login}
                    <span>{kopyalanan === h.login ? "kopyalandı" : "kopyala"}</span>
                  </button>
                  {h.paraBirimi && (
                    <span className="kucuk-yazi"> · {h.paraBirimi}</span>
                  )}
                </dd>
              </div>
            </div>
          ))}
          <p className="iy-ipucu" style={{ marginTop: 12 }}>
            Şifrenizi hatırlamıyorsanız <strong>Şifre</strong> sayfasından
            değiştirin; yeni şifre hem panelde hem terminalde geçerli olur.
          </p>
        </div>
      )}

      <div className="iy-kart">
        <h2>Terminali aç</h2>

        {!acik ? (
          <>
            <p className="iy-ipucu" style={{ marginTop: -6, marginBottom: 14 }}>
              Terminal bu sayfanın içinde açılır. Telefonda daha rahat kullanmak
              için ayrı sekmede açmayı tercih edebilirsiniz.
            </p>
            <div className="iy-modal-butonlar">
              <button type="button" className="iy-btn" onClick={() => setAcik(true)}>
                Bu sayfada aç
              </button>
              <a
                className="iy-btn sade"
                href={terminalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Yeni sekmede aç
              </a>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 12,
              }}
            >
              <span className="kucuk-yazi">
                Ekran boş kalırsa yeni sekmede açın.
              </span>
              <a
                className="iy-btn sade kucuk"
                href={terminalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Yeni sekmede aç
              </a>
            </div>

            <div className="iy-terminal">
              <iframe
                src={terminalUrl}
                title="İşlem terminali"
                // sandbox KULLANMAYIN: denendi, terminal yükleniyor ama
                // bembeyaz kalıyor ve hiçbir hata vermiyor. Kaldırınca
                // sorunsuz açılıyor.
                allow="clipboard-write; fullscreen"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
