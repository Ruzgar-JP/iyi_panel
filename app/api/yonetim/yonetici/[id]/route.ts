import { NextResponse } from "next/server";

import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { sifreHatalari } from "@/lib/sifre";
import {
  baskaTamYetkiliVarMi,
  yoneticiGecmisiVarMi,
  yoneticiGetir,
  yoneticiGuncelle,
  yoneticiOturumlariKapat,
  yoneticiSifreDegistir,
  yoneticiSil,
  type Rol,
} from "@/lib/yoneticiler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Oturum + tam yetki kontrolü. Sorun varsa hazır yanıtı döner. */
async function yetkiKontrol() {
  const yonetici = await yoneticiOturumu();
  if (!yonetici) {
    return {
      yonetici: null,
      yanit: NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 }),
    };
  }
  if (yonetici.rol !== "yonetici") {
    return {
      yonetici: null,
      yanit: NextResponse.json(
        { ok: false, mesaj: "Kullanıcı yönetimi yetkiniz yok." },
        { status: 403 },
      ),
    };
  }
  return { yonetici, yanit: null };
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { yonetici, yanit } = await yetkiKontrol();
  if (!yonetici) return yanit;

  const { id: idMetin } = await params;
  const id = Number(idMetin);

  const hedef = await yoneticiGetir(id);
  if (!hedef) {
    return NextResponse.json({ ok: false, mesaj: "Kullanıcı bulunamadı." }, { status: 404 });
  }

  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const adSoyad = String(g.adSoyad ?? "").trim();
  const yeniSifre = String(g.yeniSifre ?? "");
  const kendisi = hedef.id === yonetici.yoneticiId;

  // Kendi rolünü/durumunu değiştirmek kilitlenmeye açık kapı; kapalı tutulur.
  const rol: Rol = kendisi
    ? hedef.rol
    : g.rol === "yonetici"
      ? "yonetici"
      : "operator";
  const aktif = kendisi ? hedef.aktif : g.aktif !== false;

  if (adSoyad.length < 2) {
    return NextResponse.json({ ok: false, mesaj: "Ad soyad zorunludur." }, { status: 400 });
  }
  if (kendisi && (g.rol !== undefined || g.aktif !== undefined)) {
    // Sessizce yok saymak yerine söylüyoruz; kullanıcı neden değişmediğini bilsin.
    if (g.rol !== hedef.rol || g.aktif !== hedef.aktif) {
      return NextResponse.json(
        {
          ok: false,
          mesaj:
            "Kendi rolünüzü ve durumunuzu değiştiremezsiniz. Bunu başka bir tam yetkili kullanıcı yapmalı.",
        },
        { status: 400 },
      );
    }
  }

  // Son tam yetkiliyi indirmek/pasife almak panele giriş kapısını kapatır.
  const yetkiKaybi = hedef.rol === "yonetici" && hedef.aktif && (rol !== "yonetici" || !aktif);
  if (yetkiKaybi && !(await baskaTamYetkiliVarMi(hedef.id))) {
    return NextResponse.json(
      {
        ok: false,
        mesaj:
          "Bu, sistemdeki son aktif tam yetkili kullanıcı. Önce başka bir tam yetkili ekleyin.",
      },
      { status: 400 },
    );
  }

  if (yeniSifre) {
    const hatalar = sifreHatalari(yeniSifre);
    if (hatalar.length > 0) {
      return NextResponse.json(
        { ok: false, mesaj: `Şifre kurallara uymuyor: ${hatalar.join(", ")}` },
        { status: 400 },
      );
    }
  }

  await yoneticiGuncelle(id, { adSoyad: adSoyad.slice(0, 120), rol, aktif });

  if (yeniSifre) {
    await yoneticiSifreDegistir(id, yeniSifre);
  }
  // Şifre değişti ya da kullanıcı pasife alındı: açık oturumlar düşsün.
  if (yeniSifre || !aktif) {
    await yoneticiOturumlariKapat(id);
  }

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: yeniSifre ? "yonetici.sifre" : "yonetici.guncelle",
    hedefTur: "yonetici",
    hedefId: id,
    detay: { eposta: hedef.eposta, ad_soyad: adSoyad, rol, aktif },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({
    ok: true,
    mesaj: yeniSifre ? "Kullanıcı güncellendi, şifre değiştirildi." : "Kullanıcı güncellendi.",
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { yonetici, yanit } = await yetkiKontrol();
  if (!yonetici) return yanit;

  const { id: idMetin } = await params;
  const id = Number(idMetin);

  const hedef = await yoneticiGetir(id);
  if (!hedef) {
    return NextResponse.json({ ok: false, mesaj: "Kullanıcı bulunamadı." }, { status: 404 });
  }
  if (hedef.id === yonetici.yoneticiId) {
    return NextResponse.json(
      { ok: false, mesaj: "Kendi hesabınızı silemezsiniz." },
      { status: 400 },
    );
  }
  if (hedef.rol === "yonetici" && hedef.aktif && !(await baskaTamYetkiliVarMi(hedef.id))) {
    return NextResponse.json(
      { ok: false, mesaj: "Sistemdeki son aktif tam yetkili kullanıcı silinemez." },
      { status: 400 },
    );
  }

  // İşlem yapmış bir kullanıcı silinirse taleplerdeki "kim onayladı" bilgisi
  // NULL'a düşer (ON DELETE SET NULL). Denetim izi için buna izin vermiyoruz.
  if (await yoneticiGecmisiVarMi(id)) {
    return NextResponse.json(
      {
        ok: false,
        mesaj:
          "Bu kullanıcı sistemde işlem yapmış; kaydı silinemez. Yerine 'Pasif' yapın — girişi kapanır, geçmişi durur.",
      },
      { status: 409 },
    );
  }

  await yoneticiOturumlariKapat(id);
  await yoneticiSil(id);

  await kayitYaz({
    yoneticiId: yonetici.yoneticiId,
    eylem: "yonetici.sil",
    hedefTur: "yonetici",
    hedefId: id,
    detay: { eposta: hedef.eposta, ad_soyad: hedef.ad_soyad, rol: hedef.rol },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
