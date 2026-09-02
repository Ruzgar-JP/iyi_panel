import { NextResponse } from "next/server";

import { smtpDene } from "@/lib/eposta";
import { istemciIp, kayitYaz, yoneticiOturumu } from "@/lib/oturum";
import { ayarAnahtariHazir } from "@/lib/kripto";
import { smtpAyariYaz, type TlsKipi } from "@/lib/sistem-ayarlari";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * E-posta (SMTP) ayarları.
 *
 *   PUT   kaydeder
 *   POST  test e-postası gönderir
 *
 * Yalnızca TAM YETKİLİ kullanıcı erişebilir: SMTP bilgisi giden postanın
 * kimliğini belirler, operatörün işi değildir.
 *
 * Şifre hiçbir yanıtta geri dönmez. Formda boş bırakılırsa mevcut şifre
 * korunur.
 */

const TLS_KIPLERI: TlsKipi[] = ["otomatik", "ssl", "starttls"];

async function tamYetkili() {
  const y = await yoneticiOturumu();
  if (!y) return { hata: NextResponse.json({ ok: false, mesaj: "Yetkiniz yok." }, { status: 401 }) };
  if (y.rol !== "yonetici") {
    return {
      hata: NextResponse.json(
        { ok: false, mesaj: "Bu ayarları yalnızca tam yetkili kullanıcı değiştirebilir." },
        { status: 403 },
      ),
    };
  }
  return { yonetici: y };
}

export async function PUT(req: Request) {
  const { hata, yonetici } = await tamYetkili();
  if (hata) return hata;

  let g: Record<string, unknown>;
  try {
    g = await req.json();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  const host = String(g.host ?? "").trim();
  const port = Number(g.port);
  const kullanici = String(g.kullanici ?? "").trim();
  const sifre = String(g.sifre ?? "");
  const gonderen = String(g.gonderen ?? "").trim();
  const siteAdresi = String(g.siteAdresi ?? "").trim().replace(/\/+$/, "");
  const tls = TLS_KIPLERI.includes(g.tls as TlsKipi) ? (g.tls as TlsKipi) : "otomatik";

  if (!host) {
    return NextResponse.json(
      { ok: false, mesaj: "Sunucu adresi zorunludur (örn. smtp.yandex.com)." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json(
      { ok: false, mesaj: "Port geçersiz (örn. 587 veya 465)." },
      { status: 400 },
    );
  }
  if (!kullanici) {
    return NextResponse.json({ ok: false, mesaj: "Kullanıcı adı zorunludur." }, { status: 400 });
  }
  if (!gonderen) {
    return NextResponse.json(
      { ok: false, mesaj: "Gönderen adresi zorunludur." },
      { status: 400 },
    );
  }
  if (siteAdresi && !/^https?:\/\/[^\s]+$/.test(siteAdresi)) {
    return NextResponse.json(
      { ok: false, mesaj: "Site adresi http:// veya https:// ile başlamalı." },
      { status: 400 },
    );
  }

  // Şifre düz metin saklanmayacağı için anahtar olmadan yeni şifre kabul edilmez.
  if (sifre && !ayarAnahtariHazir()) {
    return NextResponse.json(
      {
        ok: false,
        mesaj:
          "AYAR_ANAHTARI tanımlı olmadan şifre kaydedilemez. Sunucuda " +
          '"openssl rand -base64 32" çalıştırıp çıktıyı .env.local içine ' +
          "AYAR_ANAHTARI=... olarak ekleyin ve uygulamayı yeniden başlatın.",
      },
      { status: 400 },
    );
  }

  try {
    await smtpAyariYaz(
      { host, port, kullanici, sifre, gonderen, tls, siteAdresi },
      yonetici!.yoneticiId,
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, mesaj: e instanceof Error ? e.message : "Kaydedilemedi." },
      { status: 500 },
    );
  }

  // Şifrenin kendisi kayda GİRMEZ; yalnızca değiştirilip değiştirilmediği.
  await kayitYaz({
    yoneticiId: yonetici!.yoneticiId,
    eylem: "ayar.smtp",
    hedefTur: "ayar",
    detay: { host, port, kullanici, sifre_degisti: Boolean(sifre) },
    ip: istemciIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const { hata, yonetici } = await tamYetkili();
  if (hata) return hata;

  let kime = "";
  try {
    const g = (await req.json()) as { kime?: string };
    kime = (g.kime ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(kime)) {
    return NextResponse.json(
      { ok: false, mesaj: "Testin gönderileceği e-posta adresini yazın." },
      { status: 400 },
    );
  }

  const sonuc = await smtpDene(kime);

  await kayitYaz({
    yoneticiId: yonetici!.yoneticiId,
    eylem: "ayar.smtp_test",
    hedefTur: "ayar",
    detay: { kime, sonuc: sonuc.ok ? "basarili" : "basarisiz" },
    ip: istemciIp(req.headers),
  });

  if (!sonuc.ok) {
    return NextResponse.json({ ok: false, mesaj: sonuc.mesaj }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    mesaj: `Test e-postası ${kime} adresine gönderildi. Gelen kutusunu ve spam klasörünü kontrol edin.`,
  });
}
