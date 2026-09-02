import { NextResponse } from "next/server";

import { stHataMesaji, yoneticiBakiyeGetir } from "@/lib/scaletrade";
import { hesapMusterininMi, musteriHesaplari } from "@/lib/musteri";
import { musteriOturumu, oturumBakiyeGuncelle } from "@/lib/oturum";
import {
  bakiyeSorgulanabilirMi,
  bakiyeSorgusuKaydet,
  cekilebilirTutar,
  cekilemeyenKalemler,
} from "@/lib/talepler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Anlık bakiye sorgusu.
 *
 * Panelde bakiye girişte bir kez gösterilir; bu uç yalnızca çekim ekranında,
 * müşteri "çekim yap" dediğinde çağrılır. Platformu yormamak için müşteri
 * başına bekleme süresi uygulanır ve kalan süre arayüze bildirilir.
 */
export async function POST(req: Request) {
  const oturum = await musteriOturumu();
  if (!oturum) {
    return NextResponse.json(
      { ok: false, mesaj: "Oturumunuz sona ermiş. Tekrar giriş yapın." },
      { status: 401 },
    );
  }

  let login: number;
  try {
    const govde = (await req.json()) as { login?: number };
    login = Number(govde.login);
  } catch {
    return NextResponse.json({ ok: false, mesaj: "Geçersiz istek." }, { status: 400 });
  }

  if (!Number.isInteger(login) || login <= 0) {
    return NextResponse.json({ ok: false, mesaj: "Hesap seçilmedi." }, { status: 400 });
  }

  // Hesap gerçekten bu müşteriye mi ait — kendi tablomuzdan doğrulanır.
  if (!(await hesapMusterininMi(oturum.musteriId, login))) {
    return NextResponse.json(
      { ok: false, mesaj: "Bu hesap size ait değil." },
      { status: 403 },
    );
  }

  const bekleme = await bakiyeSorgulanabilirMi(oturum.musteriId);
  if (!bekleme.izinli) {
    return NextResponse.json(
      {
        ok: false,
        beklemede: true,
        kalanSn: bekleme.kalanSn,
        mesaj:
          `Bakiye çok sık sorgulanamaz. ${bekleme.kalanSn} saniye sonra tekrar deneyin.`,
      },
      { status: 429 },
    );
  }

  try {
    const bakiye = await yoneticiBakiyeGetir(login);
    await bakiyeSorgusuKaydet(oturum.musteriId);
    const hesaplar = await musteriHesaplari(oturum.musteriId);

    // Oturumdaki görüntüyü de tazele ki panelde eski değer kalmasın
    await oturumBakiyeGuncelle(
      oturum.id,
      hesaplar.map((h) => {
        const eski = oturum.hesaplar.find((g) => g.login === h.login);
        return {
          login: h.login,
          grup: h.grup,
          paraBirimi: h.para_birimi,
          kaldirac: eski?.kaldirac ?? null,
          bakiye: h.login === login ? bakiye : (eski?.bakiye ?? null),
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      login,
      bakiye,
      cekilebilir: cekilebilirTutar(bakiye),
      cekilemeyen: cekilemeyenKalemler(bakiye),
    });
  } catch (e) {
    console.error("[panel/bakiye]", e);
    return NextResponse.json({ ok: false, mesaj: stHataMesaji(e) }, { status: 502 });
  }
}
