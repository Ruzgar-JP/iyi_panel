import { NextResponse } from "next/server";

import { ST } from "@/lib/ayarlar";
import { hesapBagla, musteriGetir, panelSifresiDogru } from "@/lib/musteri";
import { istemciIp, kayitYaz, musteriOturumu } from "@/lib/oturum";
import {
  acilabilirGruplar,
  girisYap,
  grupKullanilabilirMi,
  hesapAc,
  islemSifresiDegistir,
  STHata,
  stHataMesaji,
} from "@/lib/scaletrade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENCERE_DK = 15;
const AZAMI_DENEME = 5;
const denemeler = new Map<string, { adet: number; bitis: number }>();

function cokDenendiMi(anahtar: string): boolean {
  const simdi = Date.now();
  const kayit = denemeler.get(anahtar);
  if (!kayit || simdi > kayit.bitis) {
    denemeler.set(anahtar, { adet: 1, bitis: simdi + PENCERE_DK * 60_000 });
    return false;
  }
  kayit.adet += 1;
  return kayit.adet > AZAMI_DENEME;
}

/** Giriş yapmış müşteriye mevcut ScaleTrade customer kaydı altında ek işlem hesabı açar. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ ok: false, mesaj: "Bu kaynaktan isteğe izin verilmiyor." }, { status: 403 });
  }

  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json(
      { ok: false, mesaj: "Oturumunuz sona ermiş. Tekrar giriş yapın." },
      { status: 401 },
    );
  }

  const ip = istemciIp(req.headers);
  if (cokDenendiMi(`${oturum.musteriId}:${ip ?? "bilinmeyen"}`)) {
    return NextResponse.json(
      { ok: false, mesaj: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  let govde: unknown;
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const sifre =
    govde && typeof govde === "object" && !Array.isArray(govde)
      ? (govde as { sifre?: unknown }).sifre
      : undefined;
  if (typeof sifre !== "string" || !sifre || sifre.length > 256) {
    return NextResponse.json(
      { ok: false, mesaj: "Güvenliğiniz için mevcut panel şifrenizi girin." },
      { status: 400 },
    );
  }
  if (!(await panelSifresiDogru(oturum.musteriId, sifre))) {
    return NextResponse.json({ ok: false, mesaj: "Panel şifreniz hatalı." }, { status: 403 });
  }

  const musteri = await musteriGetir(oturum.musteriId);
  if (!musteri?.st_sifre) {
    return NextResponse.json(
      { ok: false, mesaj: "İşlem hesabı kimliğiniz bulunamadı. Lütfen destek ile iletişime geçin." },
      { status: 409 },
    );
  }

  try {
    const stOturum = await girisYap(musteri.eposta, musteri.st_sifre);
    if (!stOturum.__token) throw new STHata("giris", "TOKEN_YOK", 200);

    const gruplar = await acilabilirGruplar(stOturum.__token);
    const uygunluk = grupKullanilabilirMi(gruplar, ST.grup);
    if (!uygunluk.uygun) {
      return NextResponse.json(
        { ok: false, kod: uygunluk.kod, mesaj: kodMesaji(uygunluk.kod) },
        { status: 409 },
      );
    }

    const hesap = await hesapAc(stOturum.__token, ST.grup);
    let sifreAyarlandi = false;
    if (ST.yoneticiToken || process.env.DEMO_MOD === "1") {
      try {
        await islemSifresiDegistir(hesap.login, sifre);
        sifreAyarlandi = true;
      } catch (e) {
        console.error("[panel/hesap-ac] işlem şifresi ayarlanamadı", e);
      }
    }

    await hesapBagla(oturum.musteriId, hesap.login, hesap.group, hesap.currency);
    await kayitYaz({
      customerId: oturum.musteriId,
      eylem: "hesap.ac",
      hedefTur: "hesap",
      hedefId: hesap.login,
      detay: { grup: hesap.group, sifreAyarlandi },
      ip,
    });

    return NextResponse.json(
      {
        ok: true,
        hesap: {
          login: hesap.login,
          tur: hesap.account_mode === "DEMO" ? "Demo" : "Gerçek",
          paraBirimi: hesap.currency,
          kaldirac: hesap.leverage,
          sifreAyarlandi,
          geciciSifre: sifreAyarlandi ? null : (hesap.temporary_password ?? null),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[panel/hesap-ac]", e);
    const durum = e instanceof STHata && e.kod === "CUSTOMER_NOT_FOUND_OR_INCORRECT" ? 409 : 502;
    return NextResponse.json({ ok: false, mesaj: stHataMesaji(e) }, { status: durum });
  }
}

function kodMesaji(kod: string): string {
  const mesajlar: Record<string, string> = {
    GROUP_NOT_PUBLIC: "Hesap açılışı şu anda kapalı. Lütfen destek ile iletişime geçin.",
    GROUP_DISABLED: "Hesap türü şu anda kapalı.",
    REAL_OPENING_DISABLED: "Gerçek hesap açılışı şu anda kapalı.",
    DEMO_OPENING_DISABLED: "Demo hesap açılışı şu anda kapalı.",
    KYC_REQUIRED: "Gerçek hesap açmak için kimlik doğrulaması gerekiyor.",
  };
  return mesajlar[kod] ?? `Hesap açılamadı (${kod}).`;
}
