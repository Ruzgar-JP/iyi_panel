import { NextResponse } from "next/server";

import { yoneticiBakiyeGetir } from "@/lib/scaletrade";
import {
  istemciIp,
  musteriOturumAc,
  suresiDolanlariSil,
  type HesapGorunumu,
} from "@/lib/oturum";
import { girisDogrula, musteriHesaplari } from "@/lib/musteri";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Panel girişi — kimlik BİZİM veritabanımızda doğrulanır.
 *
 * ScaleTrade'e giriş yapılmaz; hesap listesi kendi musteri_hesaplari
 * tablomuzdan, bakiye ise yönetici token'ıyla okunur. Böylece platformun
 * bozuk JWT `exp` alanı akışı hiç etkilemez.
 */

const PENCERE_DK = 15;
const AZAMI_DENEME = 8;
const denemeler = new Map<string, { adet: number; bitis: number }>();

function cokDenendiMi(anahtar: string): boolean {
  const simdi = Date.now();
  const kayit = denemeler.get(anahtar);
  if (!kayit || simdi > kayit.bitis) {
    denemeler.set(anahtar, { adet: 1, bitis: simdi + PENCERE_DK * 60_000 });
    if (denemeler.size > 5000) {
      for (const [k, v] of denemeler) if (simdi > v.bitis) denemeler.delete(k);
    }
    return false;
  }
  kayit.adet += 1;
  return kayit.adet > AZAMI_DENEME;
}

export async function POST(req: Request) {
  const ip = istemciIp(req.headers);

  if (cokDenendiMi(ip ?? "bilinmeyen")) {
    return NextResponse.json(
      { ok: false, mesaj: "Çok fazla giriş denemesi yapıldı. 15 dakika sonra tekrar deneyin." },
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

  if (!eposta || !sifre) {
    return NextResponse.json(
      { ok: false, mesaj: "E-posta ve şifre zorunludur." },
      { status: 400 },
    );
  }

  const sonuc = await girisDogrula(eposta, sifre);

  if (!sonuc.ok) {
    // "bulunamadi" ile "sifre" ayrı mesaj vermez — hesap sayımını engeller.
    const mesaj =
      sonuc.sebep === "pasif"
        ? "Hesabınız devre dışı bırakılmış. Lütfen destek ile iletişime geçin."
        : "E-posta veya şifre hatalı.";
    return NextResponse.json({ ok: false, mesaj }, { status: 401 });
  }

  const musteri = sonuc.musteri;

  /* Bakiye girişte BİR KEZ alınır; yönetici token'ıyla okunur. */
  const hesaplar = await musteriHesaplari(musteri.id);
  const gorunumler: HesapGorunumu[] = await Promise.all(
    hesaplar.map(async (h) => {
      let bakiye = null;
      let kaldirac: number | null = null;
      try {
        const b = await yoneticiBakiyeGetir(h.login);
        bakiye = b;
        kaldirac = b.leverage;
      } catch {
        // Bakiye alınamazsa giriş yine de tamamlanır; panelde "—" görünür.
      }
      return {
        login: h.login,
        grup: h.grup,
        paraBirimi: h.para_birimi,
        kaldirac,
        bakiye,
      };
    }),
  );

  await suresiDolanlariSil();
  await musteriOturumAc(musteri, gorunumler, ip);

  await sql`
    INSERT INTO islem_kayitlari (customer_id, eylem, detay, ip)
    VALUES (${musteri.id}, 'musteri.giris',
            ${JSON.stringify({ eposta })}::jsonb, ${ip})
  `;

  return NextResponse.json({
    ok: true,
    musteri: {
      id: musteri.id,
      eposta: musteri.eposta,
      adSoyad: `${musteri.ad} ${musteri.soyad}`.trim(),
    },
    hesapSayisi: gorunumler.length,
  });
}
