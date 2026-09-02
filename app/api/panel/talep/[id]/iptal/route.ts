import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, musteriOturumu } from "@/lib/oturum";
import { talepIptalEt } from "@/lib/talepler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Müşteri yalnızca kendi BEKLEYEN talebini iptal edebilir. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json({ ok: false, mesaj: "Oturumunuz sona ermiş." }, { status: 401 });
  }

  const { id: idMetin } = await params;
  const id = Number(idMetin);

  const oldu = await talepIptalEt(id, oturum.musteriId);
  if (!oldu) {
    return NextResponse.json(
      { ok: false, mesaj: "Talep iptal edilemedi. Sonuçlanmış olabilir." },
      { status: 409 },
    );
  }

  await kayitYaz({
    customerId: oturum.musteriId,
    eylem: "talep.iptal",
    hedefTur: "talep",
    hedefId: id,
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
