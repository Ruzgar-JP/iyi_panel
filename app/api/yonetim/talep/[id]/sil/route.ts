import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { talepGetir } from "@/lib/talepler";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Talebi tamamen siler — hatalı kayıtları temizlemek için.
 *
 * Silmeden önce talebin TAM KOPYASI işlem kaydına yazılır. Para talepleri
 * denetime tabi olduğu için "hiç olmamış gibi" kaybolmamalı; satır gider,
 * izi kalır.
 *
 * Varsa ekli dekont dosyası da silinir (başka hiçbir kayıt ona bağlı değil).
 */
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

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz talep numarası." }, { status: 400 });
  }

  // Silme gerekçesi ZORUNLU — denetim izi gerekçesiz kalmasın.
  // Arayüzde de zorunlu, ama uca doğrudan istek atılabileceği için burada da
  // kontrol ediliyor.
  let gerekce: string;
  try {
    const g = (await req.json()) as { gerekce?: string };
    gerekce = g.gerekce?.trim().slice(0, 500) ?? "";
  } catch {
    gerekce = "";
  }

  if (gerekce.length < 3) {
    return NextResponse.json(
      { ok: false, mesaj: "Silme gerekçesi zorunludur (en az 3 karakter)." },
      { status: 400 },
    );
  }

  const talep = await talepGetir(id);
  if (!talep) {
    return NextResponse.json({ ok: false, mesaj: "Talep bulunamadı." }, { status: 404 });
  }

  // 1) Tam kopyayı denetim kaydına yaz
  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    customerId: talep.customer_id,
    eylem: "talep.sil",
    hedefTur: "talep",
    hedefId: id,
    detay: { gerekce, silinen_kayit: talep as unknown as Record<string, unknown> },
    ip: istemciIp(req.headers),
  });

  // 2) Satırı ve varsa dekontu sil
  await sql`DELETE FROM talepler WHERE id = ${id}`;
  if (talep.dekont_id) {
    await sql`DELETE FROM dosyalar WHERE id = ${talep.dekont_id}`;
  }

  return NextResponse.json({ ok: true });
}
