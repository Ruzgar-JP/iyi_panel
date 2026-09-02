import { NextResponse } from "next/server";

import { epostaGonder, sifirlamaEpostasi, siteAdresi } from "@/lib/eposta";
import { epostayaGoreGetir } from "@/lib/musteri";
import { GECERLILIK_DK, eskileriSil, jetonOlustur } from "@/lib/sifirlama";
import { istemciIp, kayitYaz } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Şifremi unuttum" — sıfırlama bağlantısı gönderir.
 *
 * Yanıt HER ZAMAN aynıdır: e-posta kayıtlı olsun olmasın "gönderildi" denir.
 * Aksi halde bu uç, hangi e-postaların sistemde olduğunu sızdıran bir
 * sorgulama aracına dönüşür.
 */

const PENCERE_DK = 15;
const AZAMI_DENEME = 5;
const denemeler = new Map<string, { adet: number; bitis: number }>();

function cokDenendiMi(anahtar: string): boolean {
  const simdi = Date.now();
  const k = denemeler.get(anahtar);
  if (!k || simdi > k.bitis) {
    denemeler.set(anahtar, { adet: 1, bitis: simdi + PENCERE_DK * 60_000 });
    if (denemeler.size > 5000) {
      for (const [a, v] of denemeler) if (simdi > v.bitis) denemeler.delete(a);
    }
    return false;
  }
  k.adet += 1;
  return k.adet > AZAMI_DENEME;
}

const AYNI_YANIT = {
  ok: true,
  mesaj:
    "Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısını gönderdik. " +
    "Gelen kutunuzu ve spam klasörünü kontrol edin.",
};

export async function POST(req: Request) {
  const ip = istemciIp(req.headers);

  let eposta: string;
  try {
    const g = (await req.json()) as { eposta?: string };
    eposta = g.eposta?.trim().toLowerCase() ?? "";
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  if (!eposta) {
    return NextResponse.json(
      { ok: false, mesaj: "E-posta adresinizi girin." },
      { status: 400 },
    );
  }

  // Hız sınırı hem IP hem e-posta bazında
  if (cokDenendiMi(ip ?? "ip-yok") || cokDenendiMi("e:" + eposta)) {
    // Sınıra takılsa bile aynı yanıt verilir; sayım yapılmasını engeller.
    return NextResponse.json(AYNI_YANIT);
  }

  const musteri = await epostayaGoreGetir(eposta);

  // Kayıt yoksa veya hesap pasifse sessizce aynı yanıt döner.
  if (!musteri || !musteri.aktif) {
    return NextResponse.json(AYNI_YANIT);
  }

  try {
    await eskileriSil();
    const jeton = await jetonOlustur(musteri.id);

    // Adres önce panelden girilen ayardan, yoksa .env'den, en son istekten alınır.
    const temel = await siteAdresi(req.url);
    const baglanti = `${temel}/panel/sifre-sifirla?jeton=${jeton}`;

    const sablon = sifirlamaEpostasi(
      `${musteri.ad} ${musteri.soyad}`.trim(),
      baglanti,
      GECERLILIK_DK,
    );
    await epostaGonder({ ...sablon, kime: musteri.eposta });

    await kayitYaz({
      customerId: musteri.id,
      eylem: "musteri.sifirlama_istegi",
      hedefTur: "musteri",
      hedefId: musteri.id,
      ip,
    });
  } catch (e) {
    // Gönderim hatası da kullanıcıya sızdırılmaz; sunucu günlüğüne yazılır.
    console.error("[sifremi-unuttum] gönderilemedi", e);
  }

  return NextResponse.json(AYNI_YANIT);
}
