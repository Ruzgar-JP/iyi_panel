import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, musteriTumOturumlariKapat, yoneticiOturumu } from "@/lib/oturum";
import {
  epostayaGoreGetir,
  musteriGetir,
  musteriGuncelle,
  musteriHesaplari,
  panelSifresiAyarla,
} from "@/lib/musteri";
import { islemSifresiDegistir, stHataMesaji } from "@/lib/scaletrade";
import { sifreHatalari } from "@/lib/sifre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EPOSTA = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function metin(d: unknown, azami = 200): string | undefined {
  return typeof d === "string" ? d.trim().slice(0, azami) : undefined;
}

/** Müşterinin panel bilgilerini günceller. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  const { id: idMetin } = await params;
  const id = Number(idMetin);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz müşteri numarası." }, { status: 400 });
  }

  const musteri = await musteriGetir(id);
  if (!musteri) {
    return NextResponse.json({ ok: false, mesaj: "Müşteri bulunamadı." }, { status: 404 });
  }

  let g: Record<string, unknown>;
  try {
    g = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const eposta = metin(g.eposta);
  if (eposta !== undefined) {
    if (!EPOSTA.test(eposta)) {
      return NextResponse.json({ ok: false, mesaj: "Geçerli bir e-posta girin." }, { status: 400 });
    }
    // Başka bir müşteride bu e-posta var mı
    const baskasi = await epostayaGoreGetir(eposta);
    if (baskasi && baskasi.id !== id) {
      return NextResponse.json(
        { ok: false, mesaj: "Bu e-posta başka bir müşteride kayıtlı." },
        { status: 409 },
      );
    }
  }

  const aktif = typeof g.aktif === "boolean" ? g.aktif : undefined;

  await musteriGuncelle(id, {
    ad: metin(g.ad, 120),
    soyad: metin(g.soyad, 120),
    telefon: metin(g.telefon, 40),
    eposta,
    aktif,
  });

  // Hesap devre dışı bırakıldıysa açık oturumları da kapat
  if (aktif === false) await musteriTumOturumlariKapat(id);

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    customerId: id,
    eylem: "musteri.guncelle",
    hedefTur: "musteri",
    hedefId: id,
    detay: { ad: metin(g.ad), soyad: metin(g.soyad), eposta, aktif },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true, musteri: await musteriGetir(id) });
}

/**
 * Panel şifresini sıfırlar.
 *
 * `terminaleDe: true` gönderilirse müşterinin tüm işlem hesaplarının şifresi
 * de aynı değere çekilir — müşteride tek şifre kalır. Varsayılan budur;
 * ikisini ayırmak müşteriyi karıştırır.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  const { id: idMetin } = await params;
  const id = Number(idMetin);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz müşteri numarası." }, { status: 400 });
  }

  const musteri = await musteriGetir(id);
  if (!musteri) {
    return NextResponse.json({ ok: false, mesaj: "Müşteri bulunamadı." }, { status: 404 });
  }

  let yeniSifre: string;
  let terminaleDe = true;
  try {
    const g = (await req.json()) as { yeniSifre?: string; terminaleDe?: boolean };
    yeniSifre = g.yeniSifre ?? "";
    if (g.terminaleDe === false) terminaleDe = false;
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

  await panelSifresiAyarla(id, yeniSifre);
  // Şifre değişti — eski oturumlar geçersiz olsun
  await musteriTumOturumlariKapat(id);

  const basarisiz: number[] = [];
  if (terminaleDe) {
    const hesaplar = await musteriHesaplari(id);
    for (const h of hesaplar) {
      try {
        await islemSifresiDegistir(h.login, yeniSifre);
      } catch (e) {
        console.error("[yonetim/musteri] terminal şifresi güncellenemedi", h.login, e);
        basarisiz.push(h.login);
      }
    }
  }

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    customerId: id,
    eylem: "musteri.sifre_sifirla",
    hedefTur: "musteri",
    hedefId: id,
    detay: { terminaleDe, basarisiz },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({
    ok: true,
    basarisiz,
    mesaj: basarisiz.length
      ? `Panel şifresi güncellendi, ancak ${basarisiz.join(", ")} numaralı hesabın ` +
        `terminal şifresi değiştirilemedi.`
      : terminaleDe
        ? "Panel ve terminal şifresi güncellendi. Müşteriye iletmeyi unutmayın."
        : "Panel şifresi güncellendi. Müşteriye iletmeyi unutmayın.",
  });
}

export function GET() {
  return NextResponse.json({ ok: false, mesaj: stHataMesaji(null) }, { status: 405 });
}
