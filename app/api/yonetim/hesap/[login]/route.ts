import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import {
  islemSifresiDegistir,
  stHataMesaji,
  yoneticiBakiyeGetir,
  yoneticiHesapGetir,
  yoneticiHesapGuncelle,
  type HesapDuzenleme,
} from "@/lib/scaletrade";
import { sifreHatalari } from "@/lib/sifre";
import { cekilebilirTutar } from "@/lib/talepler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Yöneticiye bir hesabın GÜNCEL durumunu verir.
 *
 * Talep listesinde saklanan bakiye, talebin oluşturulduğu ana aittir.
 * Çekim onaylanırken görülmesi gereken şey ise şu anki bakiyedir — müşteri
 * talepten sonra işlem yapmış, para çekmiş veya yatırmış olabilir.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  const { login: loginMetin } = await params;
  const login = Number(loginMetin);

  if (!Number.isInteger(login) || login <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz hesap." }, { status: 400 });
  }

  try {
    const [bakiye, profil] = await Promise.all([
      yoneticiBakiyeGetir(login),
      yoneticiHesapGetir(login).catch(() => null), // profil alınamazsa bakiye yine dönsün
    ]);

    return NextResponse.json({
      ok: true,
      login,
      bakiye,
      cekilebilir: cekilebilirTutar(bakiye),
      profil: profil && {
        ad: profil.name,
        eposta: profil.email,
        telefon: profil.phone,
        ulke: profil.country,
        sehir: profil.city,
        adres: profil.address,
        grup: profil.group,
        paraBirimi: profil.currency,
        aktif: profil.enable === 1,
        saltOkunur: profil.enable_read_only === 1,
        kayitZamani: profil.regdate,
        oncekiBakiye: profil.prevbalance,
        oncekiAyBakiyesi: profil.prevmonthbalance,
      },
    });
  } catch (e) {
    console.error("[yonetim/hesap]", e);
    return NextResponse.json({ ok: false, mesaj: stHataMesaji(e) }, { status: 502 });
  }
}

/* ------------------------------------------------------------------ */

/** Metin alanını temizler; boş string "değiştirme" anlamına gelmez, boşaltır. */
function metin(d: unknown, azami = 200): string | undefined {
  return typeof d === "string" ? d.trim().slice(0, azami) : undefined;
}

function bayrak(d: unknown): 0 | 1 | undefined {
  if (d === true || d === 1) return 1;
  if (d === false || d === 0) return 0;
  return undefined;
}

/**
 * İşlem hesabı bilgilerini günceller.
 * Yalnızca gönderilen alanlar değişir (sunucuda oku-birleştir-yaz).
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  const { login: loginMetin } = await params;
  const login = Number(loginMetin);
  if (!Number.isInteger(login) || login <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz hesap." }, { status: 400 });
  }

  let g: Record<string, unknown>;
  try {
    g = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const kaldirac = g.leverage === undefined ? undefined : Number(g.leverage);
  if (kaldirac !== undefined && (!Number.isInteger(kaldirac) || kaldirac < 1 || kaldirac > 10000)) {
    return NextResponse.json(
      { ok: false, mesaj: "Kaldıraç 1 ile 10000 arasında olmalı." },
      { status: 400 },
    );
  }

  const eposta = metin(g.email);
  if (eposta !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(eposta)) {
    return NextResponse.json({ ok: false, mesaj: "Geçerli bir e-posta girin." }, { status: 400 });
  }

  const degisiklikler: HesapDuzenleme = {
    name: metin(g.name, 120),
    email: eposta,
    phone: metin(g.phone, 40),
    address: metin(g.address, 300),
    city: metin(g.city, 100),
    country: metin(g.country, 100),
    comment: metin(g.comment, 500),
    leverage: kaldirac,
    enable: bayrak(g.enable),
    enable_read_only: bayrak(g.enable_read_only),
    enable_change_password: bayrak(g.enable_change_password),
  };

  try {
    const guncel = await yoneticiHesapGuncelle(login, degisiklikler);

    await kayitYaz({
      yoneticiId: yonetici.yoneticiId,
      customerId: guncel.customer_id,
      eylem: "hesap.guncelle",
      hedefTur: "hesap",
      hedefId: login,
      detay: { degisiklikler: degisiklikler as unknown as Record<string, unknown> },
      ip: istemciIp(req.headers),
    });

    return NextResponse.json({ ok: true, profil: guncel });
  } catch (e) {
    console.error("[yonetim/hesap PUT]", e);
    return NextResponse.json({ ok: false, mesaj: stHataMesaji(e) }, { status: 502 });
  }
}

/**
 * İşlem hesabı şifresini sıfırlar.
 *
 * Bu yalnızca TERMİNAL şifresidir. Müşterinin panel (portal) şifresi ayrı bir
 * uçta tutuluyor ve REST'te yok — bkz. README.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ login: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  const { login: loginMetin } = await params;
  const login = Number(loginMetin);

  let yeniSifre: string;
  try {
    const g = (await req.json()) as { yeniSifre?: string };
    yeniSifre = g.yeniSifre ?? "";
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const eksik = sifreHatalari(yeniSifre);
  if (eksik.length) {
    return NextResponse.json(
      { ok: false, mesaj: "Şifre kuralları: " + eksik.join(", ") + "." },
      { status: 400 },
    );
  }

  try {
    await islemSifresiDegistir(login, yeniSifre);

    await kayitYaz({
      yoneticiId: yonetici.yoneticiId,
      eylem: "hesap.sifre_sifirla",
      hedefTur: "hesap",
      hedefId: login,
      ip: istemciIp(req.headers),
    });

    return NextResponse.json({
      ok: true,
      mesaj: "İşlem hesabı şifresi güncellendi. Müşteriye iletmeyi unutmayın.",
    });
  } catch (e) {
    console.error("[yonetim/hesap POST]", e);
    return NextResponse.json({ ok: false, mesaj: stHataMesaji(e) }, { status: 502 });
  }
}
