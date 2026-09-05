import Link from "next/link";

import { telegramYapilandirildi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export default function TelegramSayfasi() {
  const hazir = telegramYapilandirildi();

  return (
    <main className="iy-giris">
      <section className="iy-giris-kart" aria-labelledby="telegram-baslik">
        <p className="iy-kucuk-baslik">İYİ YATIRIM</p>
        <h1 id="telegram-baslik">Telegram İşlem Paneli</h1>
        {hazir ? (
          <>
            <p className="iy-alt">
              Müşteri panelinizi Telegram'ın güvenli tarayıcısında açın.
            </p>
            <Link className="iy-btn tam" href="/panel/giris" target="_blank" rel="noopener noreferrer">
              Müşteri panelini aç
            </Link>
          </>
        ) : (
          <p className="iy-mesaj hata" role="alert">
            Telegram bağlantısı henüz yapılandırılmamış. Lütfen daha sonra tekrar deneyin.
          </p>
        )}
      </section>
    </main>
  );
}
