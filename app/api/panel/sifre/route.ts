import { NextResponse } from "next/server";

import { islemSifresiDegistir, stHataMesaji } from "@/lib/scaletrade";
import { istemciIp, kayitYaz, musteriOturumu } from "@/lib/oturum";
import { sifreHatalari } from "@/lib/sifre";
import {
  musteriHesaplari,
  panelSifresiAyarla,
  panelSifresiDogru,
} from "@/lib/musteri";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Müşteri kendi şifresini değiştirir.
 *
 * İKİ YERE birden yazılır:
 *   1. Bizim veritabanımız → panel girişi
 *   2. Her işlem hesabı    → terminal girişi (PUT /password, yönetici token'ı)
 *
 * İkisi ayrışırsa müşteri "şifremi değiştirdim ama terminale giremiyorum"
 * durumuna düşer; o yüzden tek işlemde ikisi de güncellenir.
 *
 * Terminal tarafı başarısız olursa panel şifresi YİNE DE değişir (müşteri
 * panele girebilsin) ve hangi hesapların güncellenemediği bildirilir.
 */
export async function POST(req: Request) {
  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json(
      { ok: false, mesaj: "Oturumunuz sona ermiş. Tekrar giriş yapın." },
      { status: 401 },
    );
  }

  let govde: { mevcutSifre?: string; yeniSifre?: string };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const mevcut = govde.mevcutSifre ?? "";
  const yeni = govde.yeniSifre ?? "";

  if (!mevcut || !yeni) {
    return NextResponse.json(
      { ok: false, mesaj: "Mevcut ve yeni şifre zorunludur." },
      { status: 400 },
    );
  }

  const eksik = sifreHatalari(yeni);
  if (eksik.length) {
    return NextResponse.json(
      { ok: false, mesaj: "Yeni şifre kuralları: " + eksik.join(", ") + "." },
      { status: 400 },
    );
  }
  if (yeni === mevcut) {
    return NextResponse.json(
      { ok: false, mesaj: "Yeni şifre mevcut şifreyle aynı olamaz." },
      { status: 400 },
    );
  }

  /* Kimlik doğrulaması — mevcut panel şifresi */
  if (!(await panelSifresiDogru(oturum.musteriId, mevcut))) {
    return NextResponse.json({ ok: false, mesaj: "Mevcut şifreniz hatalı." }, { status: 403 });
  }

  /* 1) Panel şifresi */
  await panelSifresiAyarla(oturum.musteriId, yeni);

  /* 2) Her işlem hesabının terminal şifresi */
  const hesaplar = await musteriHesaplari(oturum.musteriId);
  const basarisiz: number[] = [];

  for (const h of hesaplar) {
    try {
      await islemSifresiDegistir(h.login, yeni);
    } catch (e) {
      console.error("[panel/sifre] işlem şifresi güncellenemedi", h.login, e);
      basarisiz.push(h.login);
    }
  }

  await kayitYaz({
    customerId: oturum.musteriId,
    eylem: "musteri.sifre_degisti",
    detay: { hesap_sayisi: hesaplar.length, basarisiz },
    ip: istemciIp(req.headers),
  });

  if (basarisiz.length) {
    return NextResponse.json({
      ok: true,
      kismi: true,
      mesaj:
        "Panel şifreniz güncellendi, ancak " +
        basarisiz.join(", ") +
        " numaralı işlem hesabının şifresi değiştirilemedi. " +
        "Terminale eski şifrenizle girmeyi deneyin ve destek ile iletişime geçin.",
    });
  }

  return NextResponse.json({
    ok: true,
    mesaj:
      "Şifreniz güncellendi. Hem panele hem işlem terminaline yeni şifrenizle girebilirsiniz.",
  });
}

export function GET() {
  return NextResponse.json({ ok: false, mesaj: stHataMesaji(null) }, { status: 405 });
}
