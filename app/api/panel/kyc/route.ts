import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, musteriOturumu } from "@/lib/oturum";
import { dosyaYukle } from "@/lib/dosyalar";
import { belgeEkle, belgeTuruGecerliMi } from "@/lib/kyc";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Aynı türden en fazla kaç bekleyen belge olabilir. */
const AZAMI_BEKLEYEN = 10;

export async function POST(req: Request) {
  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json(
      { ok: false, mesaj: "Oturumunuz sona ermiş. Tekrar giriş yapın." },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const tur = String(form.get("belgeTuru") ?? "");
  if (!belgeTuruGecerliMi(tur)) {
    return NextResponse.json({ ok: false, mesaj: "Belge türü seçin." }, { status: 400 });
  }

  const dosya = form.get("dosya");
  if (!(dosya instanceof File) || dosya.size === 0) {
    return NextResponse.json({ ok: false, mesaj: "Dosya seçin." }, { status: 400 });
  }

  const bekleyen = await sql<{ adet: number }[]>`
    SELECT COUNT(*)::int AS adet
      FROM kyc_belgeleri
     WHERE customer_id = ${oturum.musteriId} AND durum = 'beklemede'
  `;
  if ((bekleyen[0]?.adet ?? 0) >= AZAMI_BEKLEYEN) {
    return NextResponse.json(
      {
        ok: false,
        mesaj:
          "İncelenmeyi bekleyen belge sayınız çok fazla. Mevcut belgeleriniz sonuçlanınca yeni yükleyebilirsiniz.",
      },
      { status: 429 },
    );
  }

  const yukleme = await dosyaYukle(oturum.musteriId, dosya);
  if (!yukleme.ok) {
    return NextResponse.json({ ok: false, mesaj: yukleme.hata }, { status: 400 });
  }

  const id = await belgeEkle({
    customerId: oturum.musteriId,
    eposta: oturum.eposta,
    adSoyad: oturum.adSoyad,
    belgeTuru: tur,
    dosyaId: yukleme.id,
  });

  await kayitYaz({
    customerId: oturum.musteriId,
    eylem: "kyc.yukle",
    hedefTur: "kyc",
    hedefId: id,
    detay: { belge_turu: tur, dosya: dosya.name },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({
    ok: true,
    id,
    mesaj: "Belgeniz alındı ve incelemeye gönderildi.",
  });
}
