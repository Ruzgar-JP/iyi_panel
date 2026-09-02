import { NextResponse } from "next/server";

import { musteriOturumu } from "@/lib/oturum";
import { dosyaOku } from "@/lib/dosyalar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Müşterinin kendi yüklediği dosyayı indirmesi.
 * dosyaOku'ya customerId geçmek ZORUNLU — aksi halde id değiştirerek
 * başkasının belgesi indirilebilir.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { id } = await params;
  const dosya = await dosyaOku(Number(id), oturum.musteriId);

  if (!dosya) {
    return NextResponse.json({ ok: false, mesaj: "Dosya bulunamadı." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(dosya.icerik), {
    headers: {
      "Content-Type": dosya.mime,
      "Content-Length": String(dosya.boyut),
      // inline değil attachment: tarayıcıda çalıştırılabilir içerik riskini keser
      "Content-Disposition": `attachment; filename="${dosya.orijinal_ad}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
