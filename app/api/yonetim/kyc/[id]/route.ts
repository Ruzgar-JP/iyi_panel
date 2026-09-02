import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { belgeSonuclandir } from "@/lib/kyc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let govde: { durum?: string; not?: string };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const durum = govde.durum;
  if (durum !== "onaylandi" && durum !== "reddedildi") {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz durum." }, { status: 400 });
  }

  const not = govde.not?.trim().slice(0, 1000) || null;
  if (durum === "reddedildi" && !not) {
    return NextResponse.json(
      { ok: false, mesaj: "Red gerekçesi yazmanız gerekiyor." },
      { status: 400 },
    );
  }

  const oldu = await belgeSonuclandir(id, durum, yonetici.yoneticiId, not);
  if (!oldu) {
    return NextResponse.json(
      { ok: false, mesaj: "Belge bulunamadı veya zaten sonuçlandırılmış." },
      { status: 409 },
    );
  }

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: `kyc.${durum}`,
    hedefTur: "kyc",
    hedefId: id,
    detay: { not },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
