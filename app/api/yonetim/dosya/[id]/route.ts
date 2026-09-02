import { NextResponse } from "next/server";

import { yoneticiOturumu } from "@/lib/oturum";
import { dosyaOku } from "@/lib/dosyalar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Yönetici her müşterinin belgesini görebilir (customerId sınırı yok). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const dosya = await dosyaOku(Number(id));

  if (!dosya) {
    return NextResponse.json({ ok: false, mesaj: "Dosya bulunamadı." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(dosya.icerik), {
    headers: {
      "Content-Type": dosya.mime,
      "Content-Length": String(dosya.boyut),
      "Content-Disposition": `attachment; filename="${dosya.orijinal_ad}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
