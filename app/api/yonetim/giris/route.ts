import { NextResponse } from "next/server";

import { sql } from "@/lib/db";
import { sifreDogrula } from "@/lib/kripto";
import { istemciIp, suresiDolanlariSil, yoneticiOturumAc } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENCERE_DK = 15;
const AZAMI_DENEME = 6;
const denemeler = new Map<string, { adet: number; bitis: number }>();

function cokDenendiMi(anahtar: string): boolean {
  const simdi = Date.now();
  const k = denemeler.get(anahtar);
  if (!k || simdi > k.bitis) {
    denemeler.set(anahtar, { adet: 1, bitis: simdi + PENCERE_DK * 60_000 });
    return false;
  }
  k.adet += 1;
  return k.adet > AZAMI_DENEME;
}

export async function POST(req: Request) {
  const ip = istemciIp(req.headers);

  if (cokDenendiMi(ip ?? "bilinmeyen")) {
    return NextResponse.json(
      { ok: false, mesaj: "Çok fazla deneme yapıldı. 15 dakika sonra tekrar deneyin." },
      { status: 429 },
    );
  }

  let govde: { eposta?: string; sifre?: string };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const eposta = govde.eposta?.trim().toLowerCase() ?? "";
  const sifre = govde.sifre ?? "";

  const satirlar = await sql<{ id: number; sifre_hash: string }[]>`
    SELECT id, sifre_hash FROM yoneticiler
     WHERE eposta = ${eposta} AND aktif = true
     LIMIT 1
  `;

  const y = satirlar[0];

  // Kullanıcı bulunamasa bile şifre doğrulaması çalıştırılır; böylece
  // yanıt süresinden hesabın var olup olmadığı anlaşılmaz.
  const sahteHash =
    "scrypt$00000000000000000000000000000000$" + "0".repeat(128);
  const dogru = await sifreDogrula(sifre, y?.sifre_hash ?? sahteHash);

  if (!y || !dogru) {
    return NextResponse.json(
      { ok: false, mesaj: "E-posta veya şifre hatalı." },
      { status: 401 },
    );
  }

  await suresiDolanlariSil();
  await yoneticiOturumAc(Number(y.id), ip);

  await sql`
    INSERT INTO islem_kayitlari (yonetici_id, eylem, ip)
    VALUES (${y.id}, 'yonetici.giris', ${ip})
  `;

  return NextResponse.json({ ok: true });
}
