import { NextResponse } from "next/server";

import {
  acilabilirGruplar,
  girisYap,
  grupKullanilabilirMi,
  hesapAc,
  islemSifresiDegistir,
  musteriKaydet,
  stHataMesaji,
  STHata,
} from "@/lib/scaletrade";
import { captchaGecerliMi } from "@/lib/captcha";
import { KAYIT_WEB_ORIGIN, kayitOriginineIzinVar } from "@/lib/kayit-origin";
import { istemciIp, kayitYaz } from "@/lib/oturum";
import { ST } from "@/lib/ayarlar";
import { sifreHatalari } from "@/lib/sifre";
import {
  epostayaGoreGetir,
  hesapBagla,
  icSifreUret,
  musteriOlustur,
} from "@/lib/musteri";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Yeni müşteri kaydı + işlem hesabı açma.
 *
 * KİMLİK NEREDE:
 *   Panel kimliği (e-posta + şifre) BİZİM veritabanımızda. ION'dan CRM
 *   alınmadığı için ScaleTrade'in customer kayıtları yönetilemiyor.
 *
 *   ScaleTrade tarafında yine bir customer kaydı açılır, çünkü hesap açan uç
 *   (/customer/account/open) müşteri oturumu istiyor ve manager karşılığı
 *   (MngAddAccount) yalnızca TCP Server API'de. Bu kaydın şifresi makine
 *   üretimidir; müşteri onu hiç görmez ve hiçbir yerde kullanmaz.
 *
 * ŞİFRE:
 *   Müşterinin seçtiği şifre iki yere yazılır —
 *     1. bizim veritabanımıza (scrypt özeti)  → panel girişi
 *     2. işlem hesabına (PUT /password)       → terminal girişi
 */

const PENCERE_DK = 15;
const AZAMI_DENEME = 5;
const denemeler = new Map<string, { adet: number; bitis: number }>();

function cokDenendiMi(anahtar: string): boolean {
  const simdi = Date.now();
  const k = denemeler.get(anahtar);
  if (!k || simdi > k.bitis) {
    denemeler.set(anahtar, { adet: 1, bitis: simdi + PENCERE_DK * 60_000 });
    if (denemeler.size > 5000) {
      for (const [a, v] of denemeler) if (simdi > v.bitis) denemeler.delete(a);
    }
    return false;
  }
  k.adet += 1;
  return k.adet > AZAMI_DENEME;
}

const EPOSTA = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function telefonNormalize(t: string): string {
  const s = t.replace(/[\s\-()./]/g, "");
  if (s.startsWith("+")) return s;
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return "+9" + s;
  if (s.startsWith("5")) return "+90" + s;
  return s;
}

function hata(mesaj: string, durum: number, ek?: object) {
  return NextResponse.json({ ok: false, mesaj, ...ek }, { status: durum });
}

const CORS_BASLIKLARI = {
  "Access-Control-Allow-Origin": KAYIT_WEB_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS(req: Request) {
  if (!kayitOriginineIzinVar(req.headers.get("origin"), new URL(req.url).origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: CORS_BASLIKLARI });
}

export async function POST(req: Request) {
  if (!kayitOriginineIzinVar(req.headers.get("origin"), new URL(req.url).origin)) {
    return hata("Bu kaynaktan kayıt isteğine izin verilmiyor.", 403);
  }

  const ip = istemciIp(req.headers);

  if (cokDenendiMi(ip ?? "bilinmeyen")) {
    return hata("Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin.", 429);
  }

  let g: Record<string, unknown>;
  try {
    g = (await req.json()) as Record<string, unknown>;
  } catch {
    return hata("Geçersiz istek.", 400);
  }

  if (!(await captchaGecerliMi(g.captchaJetonu as string | undefined, ip))) {
    return hata("Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.", 400);
  }

  /* --- sunucu tarafı doğrulama --- */
  const ad = String(g.ad ?? "").trim();
  const soyad = String(g.soyad ?? "").trim();
  const eposta = String(g.eposta ?? "").trim().toLowerCase();
  const telefon = String(g.telefon ?? "").trim();
  const sifre = String(g.sifre ?? "");
  const pazarlamaIzni = g.pazarlamaIzni === true;

  const alanHatalari: string[] = [];
  if (ad.length < 2) alanHatalari.push("Ad en az 2 karakter olmalı.");
  if (soyad.length < 2) alanHatalari.push("Soyad en az 2 karakter olmalı.");
  if (!EPOSTA.test(eposta)) alanHatalari.push("Geçerli bir e-posta adresi girin.");
  if (!/^\+[1-9]\d{9,14}$/.test(telefonNormalize(telefon)))
    alanHatalari.push("Telefon numarası geçersiz. Örnek: 0532 111 22 33");

  const sifreEksikleri = sifreHatalari(sifre);
  if (sifreEksikleri.length)
    alanHatalari.push("Şifre kuralları: " + sifreEksikleri.join(", ") + ".");

  if (alanHatalari.length) {
    return hata("Formda düzeltilmesi gereken alanlar var:", 400, { alanHatalari });
  }

  /* --- e-posta bizde zaten var mı --- */
  if (await epostayaGoreGetir(eposta)) {
    return hata(
      "Bu e-posta adresiyle daha önce kayıt oluşturulmuş. Giriş yapmayı deneyin.",
      409,
    );
  }

  /* --- ScaleTrade tarafı: ara customer + işlem hesabı --- */
  const icSifre = icSifreUret();

  try {
    /*
     * Kayıt adımı ağ hatasıyla düşerse isteğin sunucuya ULAŞIP ulaşmadığını
     * bilemeyiz — cevap kaybolmuş da olabilir. Körlemesine tekrar denemek
     * çift kayıt riski taşır; onun yerine üretilen iç şifreyle giriş yapmayı
     * deneriz. Giriş tutuyorsa kayıt aslında oluşmuştur ve akış devam eder.
     */
    let stKayit: { customer: { customer_id: number } } | null = null;
    try {
      stKayit = await musteriKaydet({
        eposta,
        sifre: icSifre, // makine üretimi — müşterinin şifresi DEĞİL
        ad,
        soyad,
        telefon: telefonNormalize(telefon),
        pazarlamaIzni,
      });
    } catch (e) {
      const agHatasi =
        e instanceof STHata &&
        (e.kod === "BAGLANTI_HATASI" || e.kod === "ZAMAN_ASIMI");
      if (!agHatasi) throw e;

      console.warn("[kayit] kayıt adımı ağ hatası — oluşup oluşmadığı kontrol ediliyor");
      try {
        await girisYap(eposta, icSifre);
        console.warn("[kayit] kayıt aslında oluşmuş, akış devam ediyor");
      } catch {
        throw e; // gerçekten oluşmamış
      }
    }

    const stOturum = await girisYap(eposta, icSifre);
    const token = stOturum.__token;
    if (!token) throw new STHata("giris", "TOKEN_YOK", 200);

    const gruplar = await acilabilirGruplar(token);
    const uygunluk = grupKullanilabilirMi(gruplar, ST.grup);
    if (!uygunluk.uygun) {
      return NextResponse.json(
        { ok: false, kod: uygunluk.kod, mesaj: kodMesaji(uygunluk.kod) },
        { status: 409 },
      );
    }

    const hesap = await hesapAc(token, ST.grup);

    /* --- işlem şifresini müşterinin seçtiğine çek --- */
    let sifreAyarlandi = false;
    if (ST.yoneticiToken || process.env.DEMO_MOD === "1") {
      try {
        await islemSifresiDegistir(hesap.login, sifre);
        sifreAyarlandi = true;
      } catch (e) {
        console.error("[kayit] işlem şifresi ayarlanamadı", e);
      }
    } else {
      console.warn("[kayit] SCALETRADE_MANAGER_TOKEN yok — geçici şifre gösterilecek.");
    }

    /* --- kendi kaydımız: panel kimliği --- */
    const musteriId = await musteriOlustur({
      eposta,
      sifre, // scrypt ile özetlenir
      ad,
      soyad,
      telefon: telefonNormalize(telefon),
      pazarlamaIzni,
      // customer_id giriş cevabından alınır: kurtarma yolunda stKayit null olabilir
      stCustomerId: stOturum.customer_id ?? stKayit?.customer.customer_id ?? null,
      stSifre: icSifre,
    });

    await hesapBagla(musteriId, hesap.login, hesap.group, hesap.currency);

    await kayitYaz({
      customerId: musteriId,
      eylem: "musteri.kayit",
      hedefTur: "hesap",
      hedefId: hesap.login,
      detay: { eposta, grup: hesap.group, sifreAyarlandi },
      ip,
    });

    return NextResponse.json({
      ok: true,
      eposta,
      hesap: {
        login: hesap.login,
        tur: hesap.account_mode === "DEMO" ? "Demo" : "Gerçek",
        paraBirimi: hesap.currency,
        kaldirac: hesap.leverage,
        sifreAyarlandi,
        geciciSifre: sifreAyarlandi ? null : (hesap.temporary_password ?? null),
      },
    });
  } catch (e) {
    if (e instanceof STHata) {
      console.error("[kayit]", { adim: e.adim, kod: e.kod });
      return NextResponse.json(
        {
          ok: false,
          kod: e.kod,
          etiket: `${e.adim.toUpperCase()}/${e.kod}`,
          mesaj: kodMesaji(e.kod),
        },
        { status: e.kod === "DUPLICATE_RECORD" ? 409 : 502 },
      );
    }
    console.error("[kayit] beklenmeyen", e);
    return hata(stHataMesaji(e), 500);
  }
}

function kodMesaji(kod: string): string {
  const m: Record<string, string> = {
    DUPLICATE_RECORD:
      "Bu e-posta adresiyle daha önce kayıt oluşturulmuş. Giriş yapmayı deneyin.",
    INVALID_DATA: "Gönderdiğiniz bilgilerden biri kabul edilmedi.",
    GROUP_NOT_PUBLIC: "Hesap açılışı şu anda kapalı. Lütfen destek ile iletişime geçin.",
    GROUP_DISABLED: "Hesap türü şu anda kapalı.",
    REAL_OPENING_DISABLED: "Gerçek hesap açılışı şu anda kapalı.",
    DEMO_OPENING_DISABLED: "Demo hesap açılışı şu anda kapalı.",
    KYC_REQUIRED: "Gerçek hesap açmak için kimlik doğrulaması gerekiyor.",
    CORE_NOT_AVAILABLE: "İşlem sunucusuna şu anda ulaşılamıyor. Biraz sonra deneyin.",
    ADD_BALANCE_ERROR: "Hesap açıldı ancak başlangıç bakiyesi yüklenemedi.",
    TOKEN_YOK: "Hesap oluşturulamadı. Lütfen tekrar deneyin.",
    BAGLANTI_HATASI:
      "İşlem sunucusuna ulaşılamadı. Kaydınız oluşturulmadı — lütfen birkaç " +
      "saniye sonra tekrar deneyin.",
    ZAMAN_ASIMI:
      "İşlem sunucusu zamanında yanıt vermedi. Lütfen tekrar deneyin.",
    GECERSIZ_CEVAP:
      "İşlem sunucusundan beklenmeyen bir yanıt geldi. Lütfen destek ile iletişime geçin.",
  };
  return m[kod] ?? `Beklenmeyen bir hata oluştu (${kod}).`;
}
