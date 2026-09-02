import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import {
  detaylariAyikla,
  yontemGetir,
  yontemGuncelle,
  yontemSil,
} from "@/lib/odeme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const mevcut = await yontemGetir(id);
  if (!mevcut) {
    return NextResponse.json({ ok: false, mesaj: "Yöntem bulunamadı." }, { status: 404 });
  }

  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const ad = String(g.ad ?? "").trim();
  const paraBirimi = String(g.paraBirimi ?? "").trim().toUpperCase();

  if (!ad) {
    return NextResponse.json({ ok: false, mesaj: "Yöntem adı zorunludur." }, { status: 400 });
  }
  if (!/^[A-Z]{2,10}$/.test(paraBirimi)) {
    return NextResponse.json({ ok: false, mesaj: "Para birimi geçersiz." }, { status: 400 });
  }

  // Tip değiştirilemez — geçmiş talepler o tipe göre kaydedildi
  const detaylar = detaylariAyikla(
    mevcut.tip,
    (g.detaylar as Record<string, unknown>) ?? {},
  );

  await yontemGuncelle(id, {
    ad: ad.slice(0, 120),
    paraBirimi,
    detaylar,
    aciklama: String(g.aciklama ?? "").trim().slice(0, 500) || null,
    yatirimaAcik: g.yatirimaAcik !== false,
    cekimeAcik: g.cekimeAcik !== false,
    aktif: g.aktif !== false,
    sira: Number(g.sira) || 0,
  });

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: "yontem.guncelle",
    hedefTur: "odeme_yontemi",
    hedefId: id,
    detay: { ad },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  const { id: idMetin } = await params;
  const id = Number(idMetin);

  const mevcut = await yontemGetir(id);
  if (!mevcut) {
    return NextResponse.json({ ok: false, mesaj: "Yöntem bulunamadı." }, { status: 404 });
  }

  // Geçmiş talepler etkilenmez: yöntemin o anki hâli talebe kopyalanmıştı.
  await yontemSil(id);

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: "yontem.sil",
    hedefTur: "odeme_yontemi",
    hedefId: id,
    detay: { ad: mevcut.ad, tip: mevcut.tip },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
