import "server-only";

/** Tek yerden ayar. Değerler .env.local'den gelir. */

export const ST = {
  base: process.env.SCALETRADE_BASE_URL ?? "https://client.novatrixmarkets.com",
  brand: process.env.SCALETRADE_BRAND ?? "novatrix",
  grup: process.env.SCALETRADE_GROUP ?? "Main",
  /**
   * İşlem hesabı şifresini değiştirmek için gereken yönetici JWT'si.
   * PUT /password ucu müşteri oturumu kabul etmiyor, yönetici istiyor.
   * Bu token sunucudan asla dışarı çıkmaz.
   */
  yoneticiToken: process.env.SCALETRADE_MANAGER_TOKEN ?? "",
};

export const OTURUM = {
  musteriCerez: "iy_oturum",
  yoneticiCerez: "iy_yonetim",
  /** Müşteri oturumu ömrü. Platformun bozuk JWT exp'i bizi bağlamıyor. */
  musteriSaat: Number(process.env.OTURUM_SAAT ?? 8),
  yoneticiSaat: Number(process.env.YONETIM_OTURUM_SAAT ?? 12),
};

export const LIMIT = {
  /** Çekim ekranında bakiye sorguları arasındaki bekleme (saniye). */
  bakiyeBeklemeSn: Number(process.env.BAKIYE_BEKLEME_SN ?? 60),
  /** İki çekim talebi arasındaki bekleme (dakika). */
  cekimBeklemeDk: Number(process.env.CEKIM_BEKLEME_DK ?? 30),
  /** Aynı anda açık bekleyen çekim talebi sayısı. */
  aciCekimAdedi: Number(process.env.ACIK_CEKIM_ADEDI ?? 1),
  /** En düşük / en yüksek talep tutarı. */
  minTutar: Number(process.env.MIN_TUTAR ?? 10),
  maxTutar: Number(process.env.MAX_TUTAR ?? 1_000_000),
  /**
   * Çekilebilir tutardan bonus düşülsün mü. Varsayılan AÇIK.
   * Bonus kullanmıyorsanız değer 0 gelir, etkisi olmaz.
   */
  bonusDus: process.env.CEKIMDE_BONUS_DUS !== "0",
  /**
   * Çekilebilir tutardan kredi düşülsün mü. Varsayılan AÇIK.
   *
   * Kredi brokerin verdiği bir limittir, müşterinin parası değildir; ama
   * equity'ye dahil olduğu için margin_free'yi şişirir. Düşülmezse müşteri
   * kredi tutarını nakit olarak çekebilir.
   */
  krediDus: process.env.CEKIMDE_KREDI_DUS !== "0",
  /** Yüklenebilecek dosya boyutu (bayt). */
  maxDosyaBayt: Number(process.env.MAX_DOSYA_MB ?? 8) * 1024 * 1024,
};

export const IZINLI_DOSYA: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

export const DESTEK_EPOSTA =
  process.env.NEXT_PUBLIC_DESTEK_EPOSTA ?? "support@novatrixmarkets.com";
