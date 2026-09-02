import "server-only";
import { sql, yerelTest } from "./db";
import { DEMO } from "./demo";
import { ayarAnahtariHazir } from "./kripto";
import { ST } from "./ayarlar";
import { smtpDurumu } from "./sistem-ayarlari";

/**
 * Kurulum ve güvenlik kontrol listesi.
 *
 * Amaç: sunucuya erişimi olmayan birinin de "bu kurulum canlıya hazır mı?"
 * sorusunu tek ekrandan yanıtlayabilmesi. Kurulumu yapan kişi buradaki
 * maddeler yeşile dönene kadar ilerler.
 *
 * Buradaki hiçbir kontrol sırrın KENDİSİNİ göstermez — yalnızca "tanımlı mı"
 * bilgisini verir.
 */

export type Durum = "ok" | "uyari" | "hata";

export type Madde = {
  id: string;
  baslik: string;
  durum: Durum;
  /** Şu an ne olduğu. */
  aciklama: string;
  /** Sorunluysa nasıl düzeltilir. */
  cozum?: string;
};

/** Test kurulumundaki varsayılan yönetici — canlıda durmamalı. */
const TEST_YONETICI = "yonetici@iyiyatirim.org";

export async function kurulumKontrolu(): Promise<Madde[]> {
  const m: Madde[] = [];
  const uretim = process.env.NODE_ENV === "production";

  /* ---------------------------------------------------------- çalışma kipi */

  m.push(
    uretim
      ? {
          id: "kip",
          baslik: "Çalışma kipi",
          durum: "ok",
          aciklama:
            "Üretim kipinde çalışıyor. Oturum çerezleri yalnızca HTTPS " +
            "üzerinden gönderiliyor.",
        }
      : {
          id: "kip",
          baslik: "Çalışma kipi",
          durum: "uyari",
          aciklama:
            "Geliştirme kipinde (npm run dev). Çerezler HTTP üzerinden de " +
            "gidiyor ve hata ayrıntıları açık.",
          cozum:
            "Canlıda: npm run build && npm start (NODE_ENV otomatik production olur).",
        },
  );

  /* ------------------------------------------------------------ veritabanı */

  m.push(
    yerelTest
      ? {
          id: "db",
          baslik: "Veritabanı",
          durum: uretim ? "hata" : "uyari",
          aciklama:
            "PGlite kullanılıyor — sunucudaki bir klasörde duran, tek süreçlik " +
            "test veritabanı. Yedeklenmesi ve ölçeklenmesi yok.",
          cozum:
            "DATABASE_URL değerini gerçek PostgreSQL adresiyle değiştirin " +
            "(postgres://...), sonra 'npm run goc' ile tabloları kurun. " +
            "Ayrıntı: KURULUM.md, Adım 3–5.",
        }
      : {
          id: "db",
          baslik: "Veritabanı",
          durum: "ok",
          aciklama: "Gerçek PostgreSQL bağlantısı kullanılıyor.",
        },
  );

  /* ------------------------------------------------------------- demo modu */

  if (DEMO) {
    m.push({
      id: "demo",
      baslik: "Demo modu",
      durum: "hata",
      aciklama:
        "DEMO_MOD açık. Hiçbir istek gerçek ScaleTrade sunucusuna gitmiyor, " +
        "veriler uydurma.",
      cozum: ".env.local içinde DEMO_MOD=0 yapın ve uygulamayı yeniden başlatın.",
    });
  }

  /* ---------------------------------------------------------------- captcha */

  const captchaAtla = process.env.CAPTCHA_ATLA === "1";
  const turnstileGizli = Boolean(process.env.TURNSTILE_SECRET_KEY);
  const turnstileSite = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  if (turnstileGizli && turnstileSite && !captchaAtla) {
    m.push({
      id: "captcha",
      baslik: "Kayıt formu koruması (captcha)",
      durum: "ok",
      aciklama: "Cloudflare Turnstile kurulu. Otomatik kayıt denemeleri engelleniyor.",
    });
  } else if (captchaAtla) {
    m.push({
      id: "captcha",
      baslik: "Kayıt formu koruması (captcha)",
      durum: uretim ? "uyari" : "uyari",
      aciklama: uretim
        ? "CAPTCHA_ATLA=1 duruyor ama üretim kipinde yok sayılıyor; captcha " +
          "anahtarları eksikse kayıt formu tamamen kapalıdır."
        : "CAPTCHA_ATLA=1 — captcha atlanıyor. Yalnızca yerel test içindir.",
      cozum:
        "Turnstile anahtarlarını girip .env.local'den CAPTCHA_ATLA satırını silin.",
    });
  } else {
    m.push({
      id: "captcha",
      baslik: "Kayıt formu koruması (captcha)",
      durum: uretim ? "hata" : "uyari",
      aciklama:
        "Turnstile anahtarları eksik. Bu hâliyle kayıt formu istekleri " +
        "REDDEDİYOR — kimse kayıt olamaz.",
      cozum:
        "dash.cloudflare.com → Turnstile'dan site ve gizli anahtarı alıp " +
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY ve TURNSTILE_SECRET_KEY olarak girin.",
    });
  }

  /* ------------------------------------------------------- şifreleme anahtarı */

  m.push(
    ayarAnahtariHazir()
      ? {
          id: "anahtar",
          baslik: "Ayar şifreleme anahtarı",
          durum: "ok",
          aciklama:
            "AYAR_ANAHTARI kurulu. Panelden girilen SMTP şifresi veritabanına " +
            "şifrelenmiş yazılıyor.",
        }
      : {
          id: "anahtar",
          baslik: "Ayar şifreleme anahtarı",
          durum: "uyari",
          aciklama:
            "AYAR_ANAHTARI tanımlı değil. SMTP şifresi panelden kaydedilemez " +
            "(düz metin saklamamak için kasıtlı olarak reddedilir).",
          cozum:
            'Sunucuda "openssl rand -base64 32" çalıştırıp çıktıyı .env.local ' +
            "içine AYAR_ANAHTARI=... olarak ekleyin, sonra yeniden başlatın.",
        },
  );

  /* ------------------------------------------------------------------ SMTP */

  const smtp = await smtpDurumu();
  if (smtp.sifreCozulemedi) {
    m.push({
      id: "smtp",
      baslik: "E-posta gönderimi",
      durum: "hata",
      aciklama:
        "Kayıtlı SMTP şifresi çözülemiyor. AYAR_ANAHTARI değişmiş veya " +
        "silinmiş olabilir.",
      cozum: "Aşağıdaki formdan şifreyi yeniden girip kaydedin.",
    });
  } else if (smtp.hazir) {
    m.push({
      id: "smtp",
      baslik: "E-posta gönderimi",
      durum: "ok",
      aciklama:
        `SMTP tanımlı (${smtp.ayar.host}:${smtp.ayar.port}) — ayarlar ` +
        (smtp.kaynak === "veritabani" ? "panelden geliyor." : ".env.local'den geliyor."),
    });
  } else {
    m.push({
      id: "smtp",
      baslik: "E-posta gönderimi",
      durum: uretim ? "hata" : "uyari",
      aciklama:
        "SMTP tanımlı değil. Müşteriler şifrelerini sıfırlayamaz" +
        (uretim ? " ve istek hata verir." : "; bağlantı sunucu günlüğüne yazılır."),
      cozum: "Aşağıdaki formu doldurup test e-postası gönderin.",
    });
  }

  /* -------------------------------------------------------------- site adresi */

  const adres = smtp.ayar.siteAdresi || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!adres) {
    m.push({
      id: "adres",
      baslik: "Site adresi",
      durum: "uyari",
      aciklama:
        "Tanımlı değil. Şifre sıfırlama bağlantısı isteğin geldiği adresten " +
        "üretilir; ters vekil (nginx) arkasında bu yanlış çıkabilir.",
      cozum: "Aşağıdaki formda tam adresi yazın (örn. https://panel.iyiyatirim.org).",
    });
  } else if (!adres.startsWith("https://") && uretim) {
    m.push({
      id: "adres",
      baslik: "Site adresi",
      durum: "hata",
      aciklama: `Adres HTTPS değil: ${adres}`,
      cozum: "SSL sertifikası kurup adresi https:// ile başlatın.",
    });
  } else {
    m.push({
      id: "adres",
      baslik: "Site adresi",
      durum: "ok",
      aciklama: `E-posta bağlantıları ${adres} adresiyle üretiliyor.`,
    });
  }

  /* --------------------------------------------------------- ScaleTrade token */

  m.push(
    ST.yoneticiToken
      ? {
          id: "token",
          baslik: "ScaleTrade yönetici anahtarı",
          durum: "ok",
          aciklama: "Tanımlı. Bakiye okuma ve işlem şifresi değiştirme çalışıyor.",
        }
      : {
          id: "token",
          baslik: "ScaleTrade yönetici anahtarı",
          durum: "uyari",
          aciklama:
            "SCALETRADE_MANAGER_TOKEN boş. Bakiye görüntüleme ve işlem şifresi " +
            "değiştirme kapalı; panelin geri kalanı çalışır.",
          cozum: "Anahtarı .env.local içine ekleyip yeniden başlatın.",
        },
  );

  /* ------------------------------------------------------- test yöneticisi */

  try {
    const s = await sql<{ adet: number }[]>`
      SELECT count(*)::int AS adet FROM yoneticiler
       WHERE eposta = ${TEST_YONETICI} AND aktif = true
    `;
    if (Number(s[0]?.adet ?? 0) > 0) {
      m.push({
        id: "test-yonetici",
        baslik: "Kurulum yöneticisi",
        durum: uretim ? "hata" : "uyari",
        aciklama:
          `Kurulumla gelen ${TEST_YONETICI} hesabı hâlâ aktif. Şifresi ` +
          "kurulum betiğinde açıkça yazılıdır.",
        cozum:
          "Kullanıcılar sayfasından kendinize gerçek bir hesap açın, sonra bu " +
          "hesabı pasife alın.",
      });
    }
  } catch {
    /* tablo yoksa sessiz geç */
  }

  return m;
}

/** Listedeki en kötü durum — sayfa başlığındaki özet için. */
export function enKotu(maddeler: Madde[]): Durum {
  if (maddeler.some((x) => x.durum === "hata")) return "hata";
  if (maddeler.some((x) => x.durum === "uyari")) return "uyari";
  return "ok";
}
