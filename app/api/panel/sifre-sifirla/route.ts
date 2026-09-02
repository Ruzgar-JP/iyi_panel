import { NextResponse } from "next/server";

import { islemSifresiDegistir } from "@/lib/scaletrade";
import { epostaGonder, sifreDegistiEpostasi } from "@/lib/eposta";
import { istemciIp, kayitYaz, musteriTumOturumlariKapat } from "@/lib/oturum";
import {
  musteriGetir,
  musteriHesaplari,
  panelSifresiAyarla,
} from "@/lib/musteri";
import { jetonKontrol, jetonMesaji, jetonTuket } from "@/lib/sifirlama";
import { sifreHatalari } from "@/lib/sifre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sıfırlama bağlantısıyla yeni şifre belirler.
 *
 * Yeni şifre HEM panele HEM tüm işlem hesaplarına yazılır — müşteride tek
 * şifre kalsın diye. Terminal tarafı başarısız olsa bile panel şifresi
 * değişir (müşteri en azından panele girebilsin) ve durum bildirilir.
 */
export async function POST(req: Request) {
  const ip = istemciIp(req.headers);

  let jeton: string;
  let yeniSifre: string;
  try {
    const g = (await req.json()) as { jeton?: string; yeniSifre?: string };
    jeton = g.jeton ?? "";
    yeniSifre = g.yeniSifre ?? "";
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  if (!jeton) {
    return NextResponse.json(
      { ok: false, mesaj: "Sıfırlama bağlantısı eksik." },
      { status: 400 },
    );
  }

  const eksik = sifreHatalari(yeniSifre);
  if (eksik.length) {
    return NextResponse.json(
      { ok: false, mesaj: "Şifre kuralları: " + eksik.join(", ") + "." },
      { status: 400 },
    );
  }

  // Tek sorguda kontrol + tüketim: aynı jetonla iki eşzamanlı istek gelirse
  // yalnızca biri geçer.
  const musteriId = await jetonTuket(jeton);
  if (musteriId === null) {
    const durum = await jetonKontrol(jeton);
    const sebep = durum.gecerli ? "yok" : durum.sebep;
    return NextResponse.json({ ok: false, mesaj: jetonMesaji(sebep) }, { status: 400 });
  }

  const musteri = await musteriGetir(musteriId);
  if (!musteri || !musteri.aktif) {
    return NextResponse.json(
      { ok: false, mesaj: "Hesabınız devre dışı. Lütfen destek ile iletişime geçin." },
      { status: 403 },
    );
  }

  /* 1) Panel şifresi + açık oturumları kapat */
  await panelSifresiAyarla(musteriId, yeniSifre);
  await musteriTumOturumlariKapat(musteriId);

  /* 2) İşlem hesaplarının terminal şifresi */
  const hesaplar = await musteriHesaplari(musteriId);
  const basarisiz: number[] = [];
  for (const h of hesaplar) {
    try {
      await islemSifresiDegistir(h.login, yeniSifre);
    } catch (e) {
      console.error("[sifre-sifirla] terminal şifresi güncellenemedi", h.login, e);
      basarisiz.push(h.login);
    }
  }

  /* 3) Bilgilendirme e-postası — hesap ele geçirilmişse müşteri fark etsin */
  try {
    const sablon = sifreDegistiEpostasi(`${musteri.ad} ${musteri.soyad}`.trim());
    await epostaGonder({ ...sablon, kime: musteri.eposta });
  } catch (e) {
    console.error("[sifre-sifirla] bilgilendirme e-postası gönderilemedi", e);
  }

  await kayitYaz({
    customerId: musteriId,
    eylem: "musteri.sifre_sifirlandi",
    hedefTur: "musteri",
    hedefId: musteriId,
    detay: { basarisiz },
    ip,
  });

  return NextResponse.json({
    ok: true,
    kismi: basarisiz.length > 0,
    mesaj: basarisiz.length
      ? "Panel şifreniz güncellendi, ancak işlem hesabınızın şifresi değiştirilemedi. " +
        "Terminale girerken sorun yaşarsanız destek ile iletişime geçin."
      : "Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.",
  });
}
