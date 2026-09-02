import "server-only";
import nodemailer from "nodemailer";

import { smtpDurumu } from "./sistem-ayarlari";

/**
 * E-posta gönderimi (SMTP).
 *
 * Platformun kendi Mailer modülü bu kurulumda yok (POST /mailer/email → 404),
 * bu yüzden doğrudan SMTP kullanılıyor. Taşınabilir: herhangi bir posta
 * sağlayıcısıyla çalışır.
 *
 * Ayarlar önce VERİTABANINDAN okunur (yönetim panelindeki "Sistem" sayfası),
 * orada kayıt yoksa .env.local'deki SMTP_* değişkenlerine düşülür. Böylece
 * sağlayıcı değiştiğinde sunucuya dokunmak gerekmez.
 *
 * SMTP hiç tanımlı değilse:
 *   - geliştirme/demo → e-posta gönderilmez, içeriği sunucu günlüğüne yazılır
 *     (yerel testte bağlantıyı terminalden kopyalayabilmek için)
 *   - üretim          → hata fırlatır, sessizce yutulmaz
 */

/**
 * Taşıyıcı (bağlantı havuzu) yeniden kurulmasın diye saklanır; ama ayarlar
 * panelden değiştirilebildiği için ayarların parmak iziyle birlikte tutulur.
 * İz değişince taşıyıcı yeniden kurulur — aksi halde panelden yapılan
 * değişiklik sunucu yeniden başlatılana kadar etkisiz kalırdı.
 */
let tasiyici: { iz: string; nesne: nodemailer.Transporter } | null = null;

function tasiyiciAl(a: {
  host: string;
  port: number;
  kullanici: string;
  sifre: string;
  tls: "otomatik" | "ssl" | "starttls";
}): nodemailer.Transporter {
  const iz = `${a.host}|${a.port}|${a.kullanici}|${a.sifre}|${a.tls}`;
  if (tasiyici?.iz === iz) return tasiyici.nesne;

  // 465 = örtük TLS (baştan şifreli), 587/25 = STARTTLS (sonradan yükseltilir).
  // Sağlayıcı alışılmadık bir kurulum kullanıyorsa panelden elle seçilebilir.
  const guvenli = a.tls === "ssl" || (a.tls === "otomatik" && a.port === 465);

  const nesne = nodemailer.createTransport({
    host: a.host,
    port: a.port,
    secure: guvenli,
    auth: { user: a.kullanici, pass: a.sifre },
    // Şifrelenmemiş bağlantıya sessizce düşmeyi engeller: sunucu STARTTLS
    // sunmuyorsa gönderim yapılmaz, hata verir.
    requireTLS: !guvenli,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  tasiyici = { iz, nesne };
  return nesne;
}

export type Eposta = {
  kime: string;
  konu: string;
  metin: string;
  html: string;
};

export async function epostaGonder(e: Eposta): Promise<void> {
  const d = await smtpDurumu();

  if (!d.hazir) {
    if (d.sifreCozulemedi) {
      throw new Error(
        "SMTP şifresi çözülemedi — AYAR_ANAHTARI değişmiş olabilir. " +
          "Yönetim → Sistem sayfasından şifreyi yeniden girin.",
      );
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP yapılandırılmamış — e-posta gönderilemedi.");
    }
    console.warn(
      "\n──────── E-POSTA (SMTP yok, gönderilmedi) ────────\n" +
        `Kime : ${e.kime}\nKonu : ${e.konu}\n\n${e.metin}\n` +
        "──────────────────────────────────────────────────\n",
    );
    return;
  }

  await tasiyiciAl(d.ayar).sendMail({
    from: d.ayar.gonderen,
    to: e.kime,
    subject: e.konu,
    text: e.metin,
    html: e.html,
  });
}

/**
 * E-postalardaki bağlantıların kök adresi.
 *
 * Sıralama: panelden girilen değer → .env.local → isteğin kendi adresi.
 * Sondaki yedek ters vekil arkasında yanlış olabilir (örn. http://localhost),
 * bu yüzden panelden doldurulması önerilir.
 */
export async function siteAdresi(istekUrl: string): Promise<string> {
  const d = await smtpDurumu();
  const adres = d.ayar.siteAdresi || process.env.NEXT_PUBLIC_SITE_URL || "";
  return (adres || new URL(istekUrl).origin).replace(/\/+$/, "");
}

/* ------------------------------------------------------- bağlantı denemesi */

export type DenemeSonucu = { ok: true } | { ok: false; mesaj: string };

/**
 * Ayarları sınar: önce sunucuya bağlanıp kimlik doğrular (verify), sonra
 * belirtilen adrese örnek bir e-posta yollar.
 *
 * Hata mesajları sadeleştirilir; nodemailer'ın ham çıktısı operatöre bir şey
 * anlatmıyor.
 */
export async function smtpDene(kime: string): Promise<DenemeSonucu> {
  const d = await smtpDurumu();

  if (d.sifreCozulemedi) {
    return {
      ok: false,
      mesaj:
        "Kayıtlı şifre çözülemedi. AYAR_ANAHTARI değişmiş olabilir — " +
        "şifreyi yeniden girip kaydedin.",
    };
  }
  if (!d.hazir) {
    return { ok: false, mesaj: "Önce sunucu, kullanıcı ve şifre alanlarını doldurun." };
  }

  try {
    const t = tasiyiciAl(d.ayar);
    await t.verify();
    await t.sendMail({
      from: d.ayar.gonderen,
      to: kime,
      subject: "İyi Yatırım — test e-postası",
      text:
        "Bu bir test e-postasıdır.\n\n" +
        "Bunu okuyabiliyorsanız panelin e-posta ayarları doğru çalışıyor; " +
        "şifre sıfırlama bağlantıları müşterilere ulaşacaktır.",
      html: kabuk(
        "Test e-postası",
        `<p>Bu bir test e-postasıdır.</p>
         <p>Bunu okuyabiliyorsanız panelin e-posta ayarları doğru çalışıyor;
            şifre sıfırlama bağlantıları müşterilere ulaşacaktır.</p>
         <p style="color:#667085;font-size:13px">Sunucu: ${d.ayar.host}:${d.ayar.port}</p>`,
      ),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, mesaj: hataMesaji(e) };
  }
}

/** Ham SMTP hatasını operatörün anlayacağı bir cümleye çevirir. */
function hataMesaji(e: unknown): string {
  const h = e as { code?: string; responseCode?: number; message?: string };
  const kod = h?.code ?? "";
  const yanit = h?.responseCode ?? 0;

  if (kod === "EAUTH" || yanit === 535 || yanit === 534) {
    return (
      "Kullanıcı adı veya şifre kabul edilmedi. Gmail/Outlook kullanıyorsanız " +
      "hesap şifrenizi değil, sağlayıcının verdiği uygulama şifresini girin."
    );
  }
  if (kod === "ECONNREFUSED") {
    return "Sunucu bağlantıyı reddetti. Adres ve port doğru mu?";
  }
  if (kod === "ETIMEDOUT" || kod === "ECONNECTION" || kod === "ESOCKET") {
    return (
      "Sunucuya ulaşılamadı (zaman aşımı). Port kapalı olabilir veya güvenlik " +
      "duvarı engelliyor olabilir. 587 yerine 465 deneyin."
    );
  }
  if (kod === "EDNS" || (h?.message ?? "").includes("getaddrinfo")) {
    return "Sunucu adresi bulunamadı. Yazımını kontrol edin.";
  }
  if (kod === "EENVELOPE" || yanit === 550 || yanit === 553) {
    return (
      "Sunucu gönderen adresini kabul etmedi. \"Gönderen\" alanındaki adres, " +
      "giriş yaptığınız hesaba ait olmalı."
    );
  }
  return h?.message ? `SMTP hatası: ${h.message}` : "SMTP sunucusuna bağlanılamadı.";
}

/* ------------------------------------------------------------ şablon */

const MARKA = "İyi Yatırım";

function kabuk(baslik: string, govde: string): string {
  return `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f7f8fa;padding:24px;
  font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#101828">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4e7ec;
    border-radius:12px;padding:28px">
    <div style="font-weight:700;font-size:16px;margin-bottom:18px">${MARKA}</div>
    <h1 style="font-size:19px;margin:0 0 14px">${baslik}</h1>
    ${govde}
    <p style="color:#667085;font-size:12.5px;margin:24px 0 0;padding-top:16px;
      border-top:1px solid #e4e7ec">
      Bu e-postayı siz istemediyseniz dikkate almayın; hesabınızda hiçbir değişiklik olmaz.
    </p>
  </div>
</body></html>`;
}

export function sifirlamaEpostasi(adSoyad: string, baglanti: string, dakika: number): Eposta {
  const metin =
    `Merhaba ${adSoyad},\n\n` +
    `Şifrenizi sıfırlamak için aşağıdaki bağlantıyı açın:\n\n${baglanti}\n\n` +
    `Bağlantı ${dakika} dakika geçerlidir ve yalnızca bir kez kullanılabilir.\n\n` +
    `Bu isteği siz yapmadıysanız dikkate almayın; hesabınızda hiçbir değişiklik olmaz.\n\n` +
    `${MARKA}`;

  const html = kabuk(
    "Şifre sıfırlama",
    `<p>Merhaba ${adSoyad},</p>
     <p>Şifrenizi sıfırlamak için aşağıdaki düğmeye tıklayın:</p>
     <p style="margin:22px 0">
       <a href="${baglanti}" style="display:inline-block;background:#1a56db;color:#fff;
         text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600">
         Şifremi Sıfırla
       </a>
     </p>
     <p style="color:#667085;font-size:13px">
       Bağlantı <strong>${dakika} dakika</strong> geçerlidir ve yalnızca bir kez kullanılabilir.
     </p>
     <p style="color:#667085;font-size:12.5px;word-break:break-all">${baglanti}</p>`,
  );

  return { kime: "", konu: `${MARKA} — şifre sıfırlama`, metin, html };
}

export function sifreDegistiEpostasi(adSoyad: string): Eposta {
  const metin =
    `Merhaba ${adSoyad},\n\n` +
    `Hesabınızın şifresi az önce değiştirildi. Bu işlemi siz yapmadıysanız ` +
    `hemen bizimle iletişime geçin.\n\n${MARKA}`;

  return {
    kime: "",
    konu: `${MARKA} — şifreniz değiştirildi`,
    metin,
    html: kabuk(
      "Şifreniz değiştirildi",
      `<p>Merhaba ${adSoyad},</p>
       <p>Hesabınızın şifresi az önce değiştirildi. Artık hem müşteri paneline
          hem işlem terminaline yeni şifrenizle girebilirsiniz.</p>
       <p style="color:#b42318"><strong>Bu işlemi siz yapmadıysanız hemen bizimle
          iletişime geçin.</strong></p>`,
    ),
  };
}
