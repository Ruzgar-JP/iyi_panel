import "server-only";
import type { Bakiye, Hesap, HesapProfili, Musteri } from "./scaletrade";

/**
 * DEMO MODU — ScaleTrade API'sinin yerine geçen sahte veri.
 *
 * DEMO_MOD=1 iken hiçbir dış istek yapılmaz; panelin tamamı canlı sunucuya
 * dokunmadan denenebilir. Yerel testte varsayılan olarak açıktır.
 *
 * Demo giriş bilgileri:
 *   demo@iyiyatirim.org  /  Demo1234!
 */

export const DEMO = process.env.DEMO_MOD === "1";

const DEMO_EPOSTA = "demo@iyiyatirim.org";
const DEMO_SIFRE = "Demo1234!";
const DEMO_LOGIN = 100007;
const DEMO_MUSTERI_ID = 4;

/** Bakiye bellekte tutulur; demo sırasında değişiklikleri görebilmek için. */
let demoBakiye: Bakiye = {
  balance: 2500,
  // Kredi ve bonus bilerek sıfırdan farklı: ikisi de equity'ye dahil ama
  // çekilemez. Çekilebilir = margin_free (2100) − bonus (250) − kredi (300).
  credit: 300,
  bonus: 250,
  profit: 43.2,
  commission: -3.5,
  storage: -1.25,
  margin: 400,
  margin_free: 2100,
  margin_level: 636.05,
  equity: 2543.2,
  level_type: 0,
  leverage: 100,
};

const demoHesap: Hesap = {
  login: DEMO_LOGIN,
  customer_id: DEMO_MUSTERI_ID,
  enable: 1,
  leverage: 100,
  group: "Main",
  name: "Demo Kullanıcı",
  email: DEMO_EPOSTA,
};

export function demoGiris(eposta: string, sifre: string): Musteri {
  const sabitHesap = eposta.toLowerCase() === DEMO_EPOSTA && sifre === DEMO_SIFRE;
  // Demo modda kayıt olan müşteriler de kendi seçtikleri şifreyle girebilir
  const yeniKayit = sabitHesap ? null : demoKayitliMi(eposta, sifre);

  if (!sabitHesap && yeniKayit === null) {
    throw new Error("DEMO_HATALI_GIRIS");
  }
  return {
    customer_id: yeniKayit ?? DEMO_MUSTERI_ID,
    email: DEMO_EPOSTA,
    full_name: "Demo Kullanıcı",
    first_name: "Demo",
    last_name: "Kullanıcı",
    phone: "+905321112233",
    brand: "iyiyatirim",
    deposit_allowed: 1,
    withdrawal_allowed: 1,
    otp_enabled: 0,
    accounts: [demoHesap],
    __token: "demo-token",
  };
}

export function demoHesaplar(): Hesap[] {
  return [demoHesap];
}

/**
 * Demo modda HER hesap aynı örnek bakiyeyi döner. Kayıt akışıyla açılan
 * hesaplar (200001+) da dahil; aksi halde yeni kaydolan demo müşteri bakiye
 * göremezdi.
 */
export function demoBakiyeGetir(_login: number): Bakiye {
  return { ...demoBakiye };
}

/** Demo panelinden bakiyeyi değiştirip senaryo denemek için. */
export function demoBakiyeAyarla(yeni: Partial<Bakiye>): Bakiye {
  demoBakiye = { ...demoBakiye, ...yeni };
  demoBakiye.equity =
    demoBakiye.balance + demoBakiye.credit + demoBakiye.profit;
  demoBakiye.margin_free = Math.max(0, demoBakiye.equity - demoBakiye.margin);
  return { ...demoBakiye };
}

export function demoProfil(login: number): HesapProfili {
  return {
    id: login,
    login,
    customer_id: DEMO_MUSTERI_ID,
    brand: "iyiyatirim",
    group: "Main",
    currency: "USD",
    comment: "",
    enable: 1,
    enable_read_only: 0,
    enable_change_password: 1,
    leverage: 100,
    email: DEMO_EPOSTA,
    name: "Demo Kullanıcı",
    phone: "+905321112233",
    address: "Bağdat Caddesi 1",
    city: "İstanbul",
    country: "TR",
    zipcode: "34000",
    regdate: Math.floor(Date.now() / 1000) - 86400 * 30,
    update_time: Math.floor(Date.now() / 1000),
    prevbalance: 2400,
    prevmonthbalance: 2000,
    balance: demoBakiye.balance,
    bonus: demoBakiye.bonus ?? 0,
    credit: demoBakiye.credit,
    storage: demoBakiye.storage,
    commission: demoBakiye.commission,
    margin: demoBakiye.margin,
    margin_free: demoBakiye.margin_free,
    margin_level: demoBakiye.margin_level,
    equity: demoBakiye.equity,
  };
}

/* ------------------------------------------------------------ kayıt akışı */

/**
 * Demo modda kayıt olanlar bellekte tutulur (sunucu yeniden başlayınca sıfırlanır).
 *
 * globalThis üzerinde saklanıyor: Next.js her rotayı ayrı derlediği için bu
 * modül birden fazla kez örneklenebilir ve modül düzeyi bir Map, /api/kayit
 * ile /api/panel/giris arasında paylaşılmaz.
 */
type DemoDefter = {
  kayitlar: Map<string, { customerId: number; sifre: string }>;
  sonrakiId: number;
  sonrakiLogin: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __iy_demo: DemoDefter | undefined;
}

function defter(): DemoDefter {
  globalThis.__iy_demo ??= {
    kayitlar: new Map(),
    sonrakiId: 100,
    sonrakiLogin: 200001,
  };
  return globalThis.__iy_demo;
}

export function demoMusteriKaydet(eposta: string, sifre: string) {
  const d = defter();
  const anahtar = eposta.toLowerCase();
  if (anahtar === DEMO_EPOSTA || d.kayitlar.has(anahtar)) {
    throw new Error("DUPLICATE_RECORD");
  }
  const customerId = d.sonrakiId++;
  d.kayitlar.set(anahtar, { customerId, sifre });
  return { registered: true, customer: { customer_id: customerId } };
}

export function demoKayitliMi(eposta: string, sifre: string): number | null {
  const k = defter().kayitlar.get(eposta.toLowerCase());
  return k && k.sifre === sifre ? k.customerId : null;
}

export function demoGruplar() {
  return {
    brand: "iyiyatirim",
    can_open_demo: 1,
    can_open_real: 1,
    kyc_required_for_real: 0,
    kyc_approved: false,
    rows: [
      {
        group: "Main",
        brand: "iyiyatirim",
        currency: "USD",
        account_mode: "REAL" as const,
        default_leverage: 100,
        default_deposit: 0,
        available: true,
        kyc_required: false,
      },
    ],
    count: 1,
  };
}

export function demoHesapAc(grup: string) {
  return {
    login: defter().sonrakiLogin++,
    group: grup,
    brand: "iyiyatirim",
    account_mode: "REAL" as const,
    currency: "USD",
    leverage: 100,
    // Platform her zaman geçici şifre üretir; biz bunu sonra müşterinin
    // seçtiği şifreyle değiştiriyoruz.
    temporary_password: "demo-" + Math.random().toString(36).slice(2, 10),
    must_change_password: true,
  };
}

/** Demo modda şifre değiştirme gerçekten bir şey yapmaz. */
export function demoSifreDegistir(): { login: string } {
  return { login: "OK" };
}
