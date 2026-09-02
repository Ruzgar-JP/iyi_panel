import { NextResponse } from "next/server";

import { stHataMesaji, yoneticiBakiyeGetir } from "@/lib/scaletrade";
import { hesapMusterininMi } from "@/lib/musteri";
import { istemciIp, kayitYaz, musteriOturumu } from "@/lib/oturum";
import { acikYontemler, yontemGetir, yontemOzeti } from "@/lib/odeme";
import { dosyaYukle } from "@/lib/dosyalar";
import { LIMIT } from "@/lib/ayarlar";
import {
  cekimTutariGecerliMi,
  cekimYapilabilirMi,
  talepOlustur,
} from "@/lib/talepler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Para yatırma / çekme TALEBİ oluşturur.
 *
 * Burada hiçbir bakiye hareketi yapılmaz — ScaleTrade'e para ekleyen veya
 * çıkaran hiçbir çağrı yoktur. Yalnızca kendi veritabanımıza "beklemede"
 * durumunda bir kayıt yazılır; parayı yönetici BackOffice'te taşır.
 *
 * İstek multipart/form-data olarak gelir (yatırımda dekont dosyası olabilir).
 */
export async function POST(req: Request) {
  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json(
      { ok: false, mesaj: "Oturumunuz sona ermiş. Tekrar giriş yapın." },
      { status: 401 },
    );
  }

  const ip = istemciIp(req.headers);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const tip = String(form.get("tip") ?? "");
  if (tip !== "yatirim" && tip !== "cekim") {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz talep türü." }, { status: 400 });
  }

  const login = Number(form.get("login"));
  const tutar = Number(String(form.get("tutar") ?? "").replace(",", "."));
  const yontemId = Number(form.get("yontemId"));
  const musteriNotu = (String(form.get("not") ?? "").trim() || null)?.slice(0, 1000) ?? null;
  const hedefHesap = (String(form.get("hedefHesap") ?? "").trim() || null)?.slice(0, 300) ?? null;

  /* --- hesap doğrulaması — kendi tablomuzdan --- */
  const sahip = await hesapMusterininMi(oturum.musteriId, login);
  const hesapBirimi =
    oturum.hesaplar.find((g) => g.login === login)?.paraBirimi ?? null;
  if (!sahip) {
    return NextResponse.json(
      { ok: false, mesaj: "Geçerli bir işlem hesabı seçin." },
      { status: 400 },
    );
  }

  /* --- ödeme yöntemi doğrulaması --- */
  const yontem = await yontemGetir(yontemId);
  const uygunlar = await acikYontemler(tip);
  if (!yontem || !uygunlar.some((y) => y.id === yontem.id)) {
    return NextResponse.json(
      { ok: false, mesaj: "Seçtiğiniz ödeme yöntemi kullanılamıyor." },
      { status: 400 },
    );
  }

  /* --- tutar --- */
  if (!Number.isFinite(tutar) || tutar <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Geçerli bir tutar girin." }, { status: 400 });
  }
  if (tutar < LIMIT.minTutar || tutar > LIMIT.maxTutar) {
    return NextResponse.json(
      { ok: false, mesaj: `Tutar ${LIMIT.minTutar} ile ${LIMIT.maxTutar} arasında olmalı.` },
      { status: 400 },
    );
  }

  /* ------------------------------------------------------------ ÇEKİM */
  let bakiyeAnlik = null;

  if (tip === "cekim") {
    const kontrol = await cekimYapilabilirMi(oturum.musteriId);
    if (!kontrol.uygun) {
      return NextResponse.json({ ok: false, mesaj: kontrol.sebep }, { status: 429 });
    }

    if (!hedefHesap) {
      return NextResponse.json(
        { ok: false, mesaj: "Paranın gönderileceği hesap bilgisini girin." },
        { status: 400 },
      );
    }

    // Çekimde bakiye HER ZAMAN canlı doğrulanır — ekranda gösterilen
    // eski değere güvenilmez.
    try {
      bakiyeAnlik = await yoneticiBakiyeGetir(login);
    } catch (e) {
      console.error("[panel/talep] bakiye alınamadı", e);
      return NextResponse.json(
        { ok: false, mesaj: "Bakiyeniz doğrulanamadı, lütfen tekrar deneyin." },
        { status: 502 },
      );
    }

    const tutarKontrol = cekimTutariGecerliMi(tutar, bakiyeAnlik);
    if (!tutarKontrol.gecerli) {
      return NextResponse.json({ ok: false, mesaj: tutarKontrol.sebep }, { status: 400 });
    }
  }

  /* ---------------------------------------------------------- YATIRIM */
  let dekontId: number | null = null;

  if (tip === "yatirim") {
    const dosya = form.get("dekont");
    if (dosya instanceof File && dosya.size > 0) {
      const sonuc = await dosyaYukle(oturum.musteriId, dosya);
      if (!sonuc.ok) {
        return NextResponse.json({ ok: false, mesaj: sonuc.hata }, { status: 400 });
      }
      dekontId = sonuc.id;
    }
  }

  /* --------------------------------------------------------- kaydet */
  try {
    // Yatırımda tutar müşterinin GÖNDERDİĞİ paradır → ödeme yönteminin birimi.
    // Çekimde tutar hesaptan DÜŞECEK paradır → hesabın birimi. Ödeme yöntemi
    // yalnızca paranın nasıl ulaştırılacağını belirler; kur ödeme sırasında
    // yönetici tarafından belirlenir.
    const talepBirimi =
      tip === "cekim" ? (hesapBirimi ?? yontem.para_birimi) : yontem.para_birimi;

    const id = await talepOlustur({
      tip,
      customerId: oturum.musteriId,
      eposta: oturum.eposta,
      adSoyad: oturum.adSoyad,
      login,
      tutar,
      paraBirimi: talepBirimi,
      odemeYontemiId: yontem.id,
      yontemOzeti: yontemOzeti(yontem),
      hedefHesap,
      bakiyeAnlik,
      musteriNotu,
      dekontId,
    });

    await kayitYaz({
      customerId: oturum.musteriId,
      eylem: `talep.olustur.${tip}`,
      hedefTur: "talep",
      hedefId: id,
      detay: { tutar, para_birimi: talepBirimi, login, yontem: yontem.ad },
      ip,
    });

    return NextResponse.json({
      ok: true,
      id,
      mesaj:
        tip === "yatirim"
          ? "Para yatırma talebiniz alındı. Ödemeniz kontrol edildikten sonra hesabınıza yansıtılacak."
          : "Çekim talebiniz alındı. İncelendikten sonra bilgilendirileceksiniz.",
    });
  } catch (e) {
    console.error("[panel/talep]", e);
    return NextResponse.json(
      { ok: false, mesaj: stHataMesaji(e) },
      { status: 500 },
    );
  }
}
