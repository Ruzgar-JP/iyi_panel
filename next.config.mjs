/** @type {import('next').NextConfig} */

const uretim = process.env.NODE_ENV === "production";

/**
 * İçerik Güvenlik Politikası (CSP).
 *
 * Tarayıcıya "bu sayfada yalnızca şu kaynaklardan içerik çalıştır" der. Bir
 * şekilde sayfaya kod enjekte edilse bile (örneğin bir metin alanından),
 * tarayıcı onu dışarı veri göndermek için kullanamaz.
 *
 * Dikkat edilenler:
 *  - Turnstile (captcha) kendi betiğini ve iframe'ini yükler; izin verildi.
 *  - Next.js sayfa verisini satır içi <script> ile gönderir → 'unsafe-inline'.
 *    Nonce'a geçmek middleware ister; şu anki fayda/karmaşıklık dengesinde
 *    değmez, çünkü panelde kullanıcı içeriği HTML olarak hiç basılmıyor.
 *  - Geliştirme kipinde Next sıcak yenileme için eval kullanır → 'unsafe-eval'
 *    yalnızca dev'de açık.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${uretim ? "" : "'unsafe-eval' "}https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://challenges.cloudflare.com${uretim ? "" : " ws: wss:"}`,
  "frame-src https://challenges.cloudflare.com",
  // Panelin başka bir sitenin iframe'ine konmasını engeller (tıklama hırsızlığı)
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // Form verisi yalnızca kendi sunucumuza gidebilir
  "form-action 'self'",
  "object-src 'none'",
  ...(uretim ? ["upgrade-insecure-requests"] : []),
].join("; ");

const guvenlikBasliklari = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Tarayıcı bu siteyi bir daha HTTP üzerinden açmasın. Yalnızca üretimde:
  // yerel geliştirmede tarayıcıya localhost'u HTTPS'e zorlatır ve iş göremez
  // hâle getirir. 2 yıl + alt alan adları — HSTS ön yükleme listesi için uygun.
  ...(uretim
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig = {
  // PGlite ve postgres sürücüleri sunucu tarafında, paketlenmeden çalışsın
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],

  // Sunucu sürümünü sızdıran X-Powered-By başlığını kaldırır
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:yol*",
        headers: guvenlikBasliklari,
      },
      {
        // www.iyiyatirim.org üzerindeki hesap açma formu, aynı kayıt
        // akışını bu uca gönderir. Route ayrıca Origin değerini denetler.
        source: "/api/kayit",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://www.iyiyatirim.org" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
      {
        // Panel ve yönetim sayfaları ara belleğe ALINMAZ. Ortak bilgisayarda
        // çıkış yapıldıktan sonra "geri" tuşuyla bakiye görülmesin.
        source: "/:yol(panel|yonetim)/:kalan*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
