import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { talepGetir, talepSonuclandir } from "@/lib/talepler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Talebi onaylar veya reddeder.
 *
 * ÖNEMLİ: bu uç parayı taşımaz. Yalnızca talebin durumunu değiştirir.
 * Onaylamadan önce parayı BackOffice'ten hesaba ekleyip/çıkarmak
 * yöneticinin sorumluluğundadır.
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

  // Red için gerekçe zorunlu — müşteri neden reddedildiğini görmeli
  if (durum === "reddedildi" && !not) {
    return NextResponse.json(
      { ok: false, mesaj: "Red gerekçesi yazmanız gerekiyor." },
      { status: 400 },
    );
  }

  const talep = await talepGetir(id);
  if (!talep) {
    return NextResponse.json({ ok: false, mesaj: "Talep bulunamadı." }, { status: 404 });
  }
  if (talep.durum !== "beklemede") {
    return NextResponse.json(
      { ok: false, mesaj: `Bu talep zaten sonuçlandırılmış (${talep.durum}).` },
      { status: 409 },
    );
  }

  const oldu = await talepSonuclandir(id, durum, yonetici.yoneticiId, not);
  if (!oldu) {
    // Araya başka bir yönetici girdi
    return NextResponse.json(
      { ok: false, mesaj: "Talep bu sırada başka bir yönetici tarafından işlendi." },
      { status: 409 },
    );
  }

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    customerId: talep.customer_id,
    eylem: `talep.${durum}`,
    hedefTur: "talep",
    hedefId: id,
    detay: {
      tip: talep.tip,
      tutar: talep.tutar,
      para_birimi: talep.para_birimi,
      login: talep.login,
      not,
    },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
