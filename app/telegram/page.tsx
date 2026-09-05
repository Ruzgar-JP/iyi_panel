import Image from "next/image";
import Link from "next/link";

import { telegramYapilandirildi } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export default function TelegramSayfasi() {
  const hazir = telegramYapilandirildi();

  return (
    <main className="iy-telegram-page">
      <section
        className="iy-telegram-card"
        aria-labelledby="telegram-baslik"
      >
        {/* Logo */}
        <div className="iy-telegram-logo">
          <Image
            src="/iyi-yatirim-logo.png"
            alt="İYİ YATIRIM"
            width={260}
            height={80}
            priority
          />
        </div>

        {/* Üst başlık */}
        <p className="iy-telegram-label">MÜŞTERİ PANELİ</p>

        <h1 id="telegram-baslik">
          Telegram İşlem Paneli
        </h1>

        <p className="iy-telegram-description">
          İşlemlerinizi hızlı ve güvenli bir şekilde
          müşteri paneliniz üzerinden yönetin.
        </p>

        {hazir ? (
          <div className="iy-telegram-content">
            <div className="iy-telegram-info">
              <div className="iy-telegram-icon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M21.8 3.2L18.7 20.1C18.5 21.3 17.8 21.6 16.8 21L11.9 17.4L9.5 19.7C9.2 20 9 20.2 8.4 20.2L8.8 15.2L17.8 7.1C18.2 6.7 17.7 6.5 17.2 6.8L6.1 13.8L1.3 12.3C0.2 12 0.2 11.2 1.5 10.7L20.2 3.5C21.3 3.1 22.2 3.7 21.8 3.2Z"
                    fill="currentColor"
                  />
                </svg>
              </div>

              <div>
                <strong>Güvenli bağlantı hazır</strong>
                <span>
                  Müşteri panelinizi açmak için aşağıdaki butona
                  tıklayabilirsiniz.
                </span>
              </div>
            </div>

            <Link
              className="iy-telegram-button"
              href="/panel/giris"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Müşteri Panelini Aç</span>

              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13 6L19 12L13 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>

            <p className="iy-telegram-security">
              🔒 Güvenli bağlantı üzerinden yönlendirileceksiniz.
            </p>
          </div>
        ) : (
          <div className="iy-telegram-error" role="alert">
            <div className="iy-telegram-error-icon">
              !
            </div>

            <div>
              <strong>Bağlantı kullanılamıyor</strong>
              <p>
                Telegram bağlantısı henüz yapılandırılmamış.
                Lütfen daha sonra tekrar deneyin.
              </p>
            </div>
          </div>
        )}
      </section>

      <p className="iy-telegram-footer">
        © {new Date().getFullYear()} İYİ YATIRIM
      </p>
    </main>
  );
}