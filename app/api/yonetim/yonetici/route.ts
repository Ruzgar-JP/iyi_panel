import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { sifreHatalari } from "@/lib/sifre";
import { yoneticiEkle, type Rol } from "@/lib/yoneticiler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: Request) {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 });
  }
  // Operatör kendi kendine yetki üretemesin.
  if (yonetici.rol !== "yonetici") {
    return NextResponse.json(
      { ok: false, mesaj: "Kullanıcı ekleme yetkiniz yok." },
      { status: 403 },
    );
  }

  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const eposta = String(g.eposta ?? "").trim().toLowerCase();
  const adSoyad = String(g.adSoyad ?? "").trim();
  const sifre = String(g.sifre ?? "");
  const rol: Rol = g.rol === "yonetici" ? "yonetici" : "operator";

  if (!EPOSTA.test(eposta)) {
    return NextResponse.json({ ok: false, mesaj: "Geçerli bir e-posta girin." }, { status: 400 });
  }
  if (adSoyad.length < 2) {
    return NextResponse.json({ ok: false, mesaj: "Ad soyad zorunludur." }, { status: 400 });
  }

  const hatalar = sifreHatalari(sifre);
  if (hatalar.length > 0) {
    return NextResponse.json(
      { ok: false, mesaj: `Şifre kurallara uymuyor: ${hatalar.join(", ")}` },
      { status: 400 },
    );
  }

  const id = await yoneticiEkle({
    eposta,
    adSoyad: adSoyad.slice(0, 120),
    sifre,
    rol,
  });

  if (id === null) {
    return NextResponse.json(
      {
        ok: false,
        mesaj:
          "Bu e-posta zaten kayıtlı. Listede pasif duruyorsa düzenleyip yeniden aktif edin.",
      },
      { status: 409 },
    );
  }

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: "yonetici.ekle",
    hedefTur: "yonetici",
    hedefId: id,
    detay: { eposta, ad_soyad: adSoyad, rol },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true, id });
}
