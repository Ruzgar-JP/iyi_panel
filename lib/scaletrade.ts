import "server-only";
import { ST } from "./ayarlar";
import {
  DEMO,
  demoBakiyeGetir,
  demoGiris,
  demoGruplar,
  demoHesapAc,
  demoHesaplar,
  demoMusteriKaydet,
  demoProfil,
  demoSifreDegistir,
} from "./demo";

/**
 * ScaleTrade Client API istemcisi — müşteri paneli için.
 * Bu dosya yalnızca OKUMA yapar; bakiyeye para ekleyip çıkarmaz.
 * Tek yazma işlemi işlem hesabı şifresinin değiştirilmesidir.
 *
 * Not: dokümantasyon /balance/me ve /account/me için "body parameters" diyor,
 * ancak sunucu gerçekte query string okuyor (canlı olarak doğrulandı).
 */

const ZAMAN_ASIMI_MS = 25_000;

export type Adim =
  | "kayit"
  | "gruplar"
  | "hesap_ac"
  | "giris"
  | "islem_giris"
  | "hesaplar"
  | "bakiye"
  | "profil"
  | "sifre"
  | "yonetici_bakiye"
  | "yonetici_profil"
  | "yonetici_guncelle";

export class STHata extends Error {
  constructor(
    readonly adim: Adim,
    readonly kod: string,
    readonly httpKodu: number,
  ) {
    super(`${adim}: ${kod}`);
    this.name = "STHata";
  }
}

async function istek<T>(
  adim: Adim,
  yol: string,
  secenek: { yontem?: "GET" | "POST" | "PUT"; govde?: unknown; token?: string } = {},
): Promise<T> {
  const { yontem = "GET", govde, token } = secenek;

  const basliklar: Record<string, string> = { Accept: "application/json" };
  if (govde) basliklar["Content-Type"] = "application/json";
  if (token) basliklar["Authorization"] = token; // "Bearer " öneki YOK

  let yanit: Response;
  try {
    yanit = await fetch(ST.base + yol, {
      method: yontem,
      headers: basliklar,
      body: govde ? JSON.stringify(govde) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });
  } catch (e) {
    const zamanAsimi = e instanceof Error && e.name === "TimeoutError";
    // Ham hatayı günlüğe yaz — yoksa "BAGLANTI_HATASI" nedeni tamamen kaybolur
    // ve sorun tekrarlandığında elimizde hiçbir ipucu kalmaz.
    console.error("[scaletrade] istek başarısız", {
      adim,
      yol,
      yontem,
      hata: e instanceof Error ? e.name : typeof e,
      mesaj: e instanceof Error ? e.message : String(e),
      sebep:
        e instanceof Error && "cause" in e
          ? String((e as Error & { cause?: unknown }).cause)
          : undefined,
    });
    throw new STHata(adim, zamanAsimi ? "ZAMAN_ASIMI" : "BAGLANTI_HATASI", 0);
  }

  // Tanımsız yollarda sunucu 200 + HTML (WebTrader SPA) dönüyor.
  const tur = yanit.headers.get("content-type") ?? "";
  if (!tur.includes("application/json")) {
    throw new STHata(adim, "GECERSIZ_CEVAP", yanit.status);
  }

  let veri: unknown;
  try {
    veri = await yanit.json();
  } catch {
    throw new STHata(adim, "GECERSIZ_CEVAP", yanit.status);
  }

  const kod =
    veri && typeof veri === "object" && "error" in veri
      ? String((veri as { error: unknown }).error)
      : null;

  if (!yanit.ok || kod) {
    throw new STHata(adim, kod ?? `HTTP_${yanit.status}`, yanit.status);
  }
  return veri as T;
}

/* ------------------------------------------------------------------ tipler */

export type Hesap = {
  login: number;
  customer_id: number;
  enable: number;
  leverage: number;
  group: string;
  name: string;
  email: string;
};

export type Musteri = {
  customer_id: number;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  brand?: string;
  deposit_allowed?: number;
  withdrawal_allowed?: number;
  otp_enabled?: number;
  accounts?: Hesap[];
  __token?: string;
};

export type Bakiye = {
  balance: number;
  credit: number;
  /** Ayrı bonus kovasındaki tutar. Genelde çekilemez — LIMIT.bonusDus'e bakın. */
  bonus?: number;
  profit: number;
  commission: number;
  storage: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  equity: number;
  level_type: number;
  leverage: number;
};

/** Yönetici tarafında dönen tam hesap profili (GET /account/login). */
export type HesapProfili = {
  id: number;
  login: number;
  customer_id: number;
  brand: string;
  group: string;
  currency: string;
  comment: string;
  enable: number;
  enable_read_only: number;
  enable_change_password: number;
  leverage: number;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  zipcode: string;
  regdate: number;
  update_time: number;
  prevbalance: number;
  prevmonthbalance: number;
  balance: number;
  bonus: number;
  credit: number;
  storage: number;
  commission: number;
  margin: number;
  margin_free: number;
  margin_level: number;
  equity: number;
};

/* ---------------------------------------------------------------- işlemler */

/** Müşteri girişi. Dönen token tarayıcıya ASLA gönderilmez. */
export function girisYap(eposta: string, sifre: string) {
  if (DEMO) {
    try {
      return Promise.resolve(demoGiris(eposta, sifre));
    } catch {
      return Promise.reject(
        new STHata("giris", "CUSTOMER_NOT_FOUND_OR_INCORRECT", 403),
      );
    }
  }
  return istek<Musteri>("giris", "/customer/auth/login", {
    yontem: "POST",
    govde: { email: eposta, password: sifre },
  });
}

/**
 * İşlem hesabı oturumu açar ve terminal SSO'sunun kabul ettiği tokenı döner.
 * Başarısızlık panel girişini engellemez; kullanıcı normal terminal girişine
 * yönlendirilir.
 */
export async function islemGirisYap(login: number, sifre: string): Promise<string | null> {
  if (DEMO) return null;

  try {
    const yanit = await istek<{ __token?: string }>("islem_giris", "/sign/in", {
      yontem: "POST",
      govde: { login, password: sifre },
    });
    return yanit.__token ?? null;
  } catch {
    return null;
  }
}

/**
 * Müşterinin açabileceği gruplar — buradan grup→para birimi eşlemesi çıkarılır.
 * Hesap listesi para birimini içermediği için gerekli.
 */
export async function grupParaBirimleri(
  token: string,
): Promise<Record<string, string>> {
  if (DEMO) return { Main: "USD" };
  try {
    const c = await istek<{ rows?: { group: string; currency: string }[] }>(
      "hesaplar",
      "/customer/account/groups",
      { token },
    );
    return Object.fromEntries((c.rows ?? []).map((r) => [r.group, r.currency]));
  } catch {
    // Para birimi alınamazsa akış durmasın; arayüz birimi gizler.
    return {};
  }
}

/** Müşteriye bağlı işlem hesapları. */
export async function hesaplariGetir(token: string): Promise<Hesap[]> {
  if (DEMO) return demoHesaplar();
  const c = await istek<{ accounts?: Hesap[] }>(
    "hesaplar",
    "/customer/session/accounts",
    { token },
  );
  return c.accounts ?? [];
}

/**
 * Anlık bakiye ve teminat görüntüsü.
 * Çekilebilir tutar için `margin_free` kullanılır — açık pozisyonlarda
 * kilitli teminat çekilemez.
 */
export function bakiyeGetir(token: string, login: number) {
  if (DEMO) return Promise.resolve(demoBakiyeGetir(login));
  return istek<Bakiye>("bakiye", `/balance/me?login=${encodeURIComponent(login)}`, {
    token,
  });
}

/** Hesap profili (ad, ülke, telefon vb.). */
export function profilGetir(token: string, login: number) {
  if (DEMO) return Promise.resolve(demoProfil(login) as unknown as Record<string, unknown>);
  return istek<Record<string, unknown>>(
    "profil",
    `/account/me?login=${encodeURIComponent(login)}`,
    { token },
  );
}

/**
 * İşlem hesabı şifresini değiştirir.
 *
 * DİKKAT: bu uç müşteri oturumu kabul etmiyor, yönetici oturumu istiyor.
 * Bu yüzden sunucuda tutulan yönetici token'ı kullanılır. Çağırmadan ÖNCE
 * müşterinin mevcut şifresini girisYap() ile doğrulamak zorunludur —
 * aksi halde oturumu ele geçiren biri şifreyi değiştirebilir.
 */
export function islemSifresiDegistir(login: number, yeniSifre: string) {
  if (DEMO) return Promise.resolve(demoSifreDegistir());
  if (!ST.yoneticiToken) {
    throw new STHata("sifre", "YONETICI_TOKEN_YOK", 0);
  }
  return istek<{ login: string }>("sifre", "/password", {
    yontem: "PUT",
    govde: { login, password: yeniSifre },
    token: ST.yoneticiToken,
  });
}

/* ------------------------------------------------------------ kayıt akışı */

export type Grup = {
  group: string;
  brand: string;
  currency: string;
  account_mode: "DEMO" | "REAL";
  default_leverage: number;
  default_deposit: number;
  available: boolean;
  kyc_required: boolean;
  block_reason?: string;
};

export type GruplarCevabi = {
  brand: string;
  can_open_demo: number;
  can_open_real: number;
  kyc_required_for_real: number;
  kyc_approved: boolean;
  rows: Grup[];
  count: number;
};

export type AcilanHesap = {
  login: number;
  group: string;
  brand: string;
  account_mode: "DEMO" | "REAL";
  currency: string;
  leverage: number;
  temporary_password?: string;
  must_change_password?: boolean;
};

/** 1) Müşteri profili oluşturur. Verilen şifre PORTAL giriş şifresi olur. */
export function musteriKaydet(m: {
  eposta: string;
  sifre: string;
  ad: string;
  soyad: string;
  telefon: string;
  pazarlamaIzni: boolean;
}) {
  if (DEMO) {
    try {
      return Promise.resolve(demoMusteriKaydet(m.eposta, m.sifre));
    } catch {
      return Promise.reject(new STHata("kayit", "DUPLICATE_RECORD", 409));
    }
  }
  return istek<{ registered: boolean; customer: { customer_id: number } }>(
    "kayit",
    "/customer/registration",
    {
      yontem: "POST",
      govde: {
        email: m.eposta,
        password: m.sifre,
        first_name: m.ad,
        last_name: m.soyad,
        phone: m.telefon,
        brand: ST.brand,
        preferred_language: "tr",
        timezone: "Europe/Istanbul",
        marketing_allowed: m.pazarlamaIzni ? 1 : 0,
      },
    },
  );
}

/** 2) Müşterinin açabileceği gruplar (tam cevap). */
export function acilabilirGruplar(token: string) {
  if (DEMO) return Promise.resolve(demoGruplar() as GruplarCevabi);
  return istek<GruplarCevabi>("gruplar", "/customer/account/groups", { token });
}

/** 3) İşlem hesabını açar. Platform bir GEÇİCİ şifre üretir. */
export function hesapAc(token: string, grup: string) {
  if (DEMO) return Promise.resolve(demoHesapAc(grup) as AcilanHesap);
  return istek<AcilanHesap>("hesap_ac", "/customer/account/open", {
    yontem: "POST",
    govde: { group: grup },
    token,
  });
}

/** Hedef grup gerçekten açılabilir mi; değilse sebebini söyler. */
export function grupKullanilabilirMi(
  gruplar: GruplarCevabi,
  hedef: string,
): { uygun: true } | { uygun: false; kod: string } {
  const grup = gruplar.rows?.find((g) => g.group === hedef);

  if (!grup) return { uygun: false, kod: "GROUP_NOT_PUBLIC" };
  if (grup.available === false) {
    return { uygun: false, kod: grup.block_reason ?? "GROUP_DISABLED" };
  }
  if (grup.account_mode === "REAL" && gruplar.can_open_real !== 1) {
    return { uygun: false, kod: "REAL_OPENING_DISABLED" };
  }
  if (grup.account_mode === "DEMO" && gruplar.can_open_demo !== 1) {
    return { uygun: false, kod: "DEMO_OPENING_DISABLED" };
  }
  if (grup.kyc_required && !gruplar.kyc_approved) {
    return { uygun: false, kod: "KYC_REQUIRED" };
  }
  return { uygun: true };
}

/* ------------------------------------------------- yönetici tarafı okuma */

/**
 * Yönetici token'ıyla HERHANGİ bir hesabın anlık bakiyesi.
 *
 * Aynı /balance/me ucu hem müşteri hem yönetici oturumu kabul ediyor; müşteri
 * yalnızca kendi hesabını görebilirken yönetici kapsamındaki tüm hesapları
 * görebiliyor (canlı olarak doğrulandı).
 *
 * Çekim talebini incelerken TALEP ANINDAKİ değil GÜNCEL bakiyeyi görmek için.
 */
export function yoneticiBakiyeGetir(login: number) {
  if (DEMO) return Promise.resolve(demoBakiyeGetir(login));
  if (!ST.yoneticiToken) throw new STHata("yonetici_bakiye", "YONETICI_TOKEN_YOK", 0);
  return istek<Bakiye>(
    "yonetici_bakiye",
    `/balance/me?login=${encodeURIComponent(login)}`,
    { token: ST.yoneticiToken },
  );
}

/** Yönetici tarafından düzenlenebilen alanlar. Verilmeyen alan değişmez. */
export type HesapDuzenleme = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  zipcode?: string;
  comment?: string;
  leverage?: number;
  enable?: 0 | 1;
  enable_read_only?: 0 | 1;
  enable_change_password?: 0 | 1;
};

/**
 * İşlem hesabı bilgilerini günceller (MngUpdateAccount → PUT /account).
 *
 * DİKKAT: platform group, name, email, leverage ve enable alanlarını ZORUNLU
 * istiyor; kısmi güncelleme yok. Bu yüzden önce mevcut kaydı okuyup üzerine
 * yalnızca değişen alanları yazıyoruz. Aksi halde bir alan boş gönderildiğinde
 * müşterinin grubu veya kaldıracı kazara değişebilir.
 */
export async function yoneticiHesapGuncelle(
  login: number,
  degisiklikler: HesapDuzenleme,
): Promise<HesapProfili> {
  if (!ST.yoneticiToken) throw new STHata("yonetici_guncelle", "YONETICI_TOKEN_YOK", 0);

  const mevcut = await yoneticiHesapGetir(login);

  const govde = {
    login,
    // Zorunlu alanlar — değiştirilmiyorsa mevcut değerleriyle geri gönderilir
    group: mevcut.group,
    name: degisiklikler.name ?? mevcut.name,
    email: degisiklikler.email ?? mevcut.email,
    leverage: degisiklikler.leverage ?? mevcut.leverage,
    enable: degisiklikler.enable ?? mevcut.enable,
    // İsteğe bağlı alanlar
    enable_read_only: degisiklikler.enable_read_only ?? mevcut.enable_read_only,
    enable_change_password:
      degisiklikler.enable_change_password ?? mevcut.enable_change_password,
    comment: degisiklikler.comment ?? mevcut.comment,
    country: degisiklikler.country ?? mevcut.country,
    city: degisiklikler.city ?? mevcut.city,
    address: degisiklikler.address ?? mevcut.address,
    phone: degisiklikler.phone ?? mevcut.phone,
    customer_id: mevcut.customer_id,
  };

  await istek<unknown>("yonetici_guncelle", "/account", {
    yontem: "PUT",
    govde,
    token: ST.yoneticiToken,
  });

  return yoneticiHesapGetir(login);
}

/** Yönetici token'ıyla tam hesap profili — iletişim bilgileri dahil. */
export function yoneticiHesapGetir(login: number) {
  if (DEMO) return Promise.resolve(demoProfil(login));
  if (!ST.yoneticiToken) throw new STHata("yonetici_profil", "YONETICI_TOKEN_YOK", 0);
  return istek<HesapProfili>(
    "yonetici_profil",
    `/account/login?login=${encodeURIComponent(login)}`,
    { token: ST.yoneticiToken },
  );
}

/* ------------------------------------------------------- hata mesajları */

const MESAJ: Record<string, string> = {
  CUSTOMER_NOT_FOUND_OR_INCORRECT: "E-posta veya şifre hatalı.",
  CUSTOMER_DISABLED: "Hesabınız devre dışı bırakılmış.",
  OTP_REQUIRED: "Hesabınızda iki adımlı doğrulama açık.",
  INVALID_OTP_CODE: "Doğrulama kodu geçersiz.",
  OTP_NOT_CONFIGURED: "İki adımlı doğrulama tanımlı değil.",
  ACCESS_DENIED: "Bu hesaba erişim yetkiniz yok.",
  PERMISSION_DENIED: "Oturumunuz doğrulanamadı, tekrar giriş yapın.",
  INCORRECT_TOKEN: "Oturumunuz geçersiz, tekrar giriş yapın.",
  INVALID_USER: "Hesap bulunamadı.",
  INVALID_USER_MARGIN: "Bu hesap için bakiye bilgisi alınamadı.",
  INVALID_DATA: "Gönderilen bilgiler geçersiz.",
  UPDATE_PASSWORD_ERROR: "Şifre güncellenemedi. Farklı bir şifre deneyin.",
  YONETICI_TOKEN_YOK:
    "Bu işlem şu anda kullanılamıyor (yönetici token'ı tanımlı değil).",
  UPDATE_USER_ERROR: "Hesap güncellenemedi.",
  ZAMAN_ASIMI: "Sunucu zamanında yanıt vermedi, tekrar deneyin.",
  BAGLANTI_HATASI: "Sunucuya bağlanılamadı.",
  GECERSIZ_CEVAP: "Sunucudan beklenmeyen bir yanıt geldi.",
};

export function stHataMesaji(e: unknown): string {
  if (e instanceof STHata) {
    return MESAJ[e.kod] ?? `Beklenmeyen bir hata oluştu (${e.kod}).`;
  }
  return "Beklenmeyen bir hata oluştu.";
}
