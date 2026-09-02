import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { detaylariAyikla, yontemEkle } from "@/lib/odeme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }

  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const tip = g.tip;
  if (tip !== "banka" && tip !== "kripto") {
    return NextResponse.json({ ok: false, mesaj: "Yöntem türü seçin." }, { status: 400 });
  }

  const ad = String(g.ad ?? "").trim();
  const paraBirimi = String(g.paraBirimi ?? "").trim().toUpperCase();

  if (!ad) {
    return NextResponse.json({ ok: false, mesaj: "Yöntem adı zorunludur." }, { status: 400 });
  }
  if (!/^[A-Z]{2,10}$/.test(paraBirimi)) {
    return NextResponse.json(
      { ok: false, mesaj: "Para birimi geçersiz (örn. TRY, USD, USDT)." },
      { status: 400 },
    );
  }

  const detaylar = detaylariAyikla(tip, (g.detaylar as Record<string, unknown>) ?? {});

  if (tip === "banka" && !detaylar.iban) {
    return NextResponse.json({ ok: false, mesaj: "IBAN zorunludur." }, { status: 400 });
  }
  if (tip === "kripto" && !detaylar.adres) {
    return NextResponse.json({ ok: false, mesaj: "Cüzdan adresi zorunludur." }, { status: 400 });
  }

  const id = await yontemEkle({
    tip,
    ad: ad.slice(0, 120),
    paraBirimi,
    detaylar,
    aciklama: String(g.aciklama ?? "").trim().slice(0, 500) || null,
    yatirimaAcik: g.yatirimaAcik !== false,
    cekimeAcik: g.cekimeAcik !== false,
    sira: Number(g.sira) || 0,
  });

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: "yontem.ekle",
    hedefTur: "odeme_yontemi",
    hedefId: id,
    detay: { ad, tip, para_birimi: paraBirimi },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true, id });
}
