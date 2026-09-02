/**
 * Yönetim panelindeki istemci bileşenleri için ortak fetch sarmalayıcısı.
 *
 * Neden gerekli: yönetim sayfaları sunucuda render edilir. Sayfa açıkken
 * oturum düşerse (süre dolması, sunucu yeniden başlatma, veritabanı sıfırlama)
 * sayfa ekranda durmaya devam eder ama butonlar 401 alır. Ham "Yetkiniz yok"
 * mesajı kullanıcıya bir şey anlatmaz; asıl sorun oturumun bitmiş olmasıdır.
 *
 * Bu sarmalayıcı 401'i yakalar, anlaşılır bir mesaj döner ve giriş sayfasına
 * yönlendirir.
 */

export type IstekSonucu<T> =
  | { ok: true; veri: T }
  | { ok: false; mesaj: string; oturumBitti?: boolean };

export async function yonetimIstek<T = Record<string, unknown>>(
  yol: string,
  secenek?: RequestInit,
): Promise<IstekSonucu<T>> {
  let yanit: Response;
  try {
    yanit = await fetch(yol, secenek);
  } catch {
    return { ok: false, mesaj: "Sunucuya ulaşılamadı." };
  }

  if (yanit.status === 401) {
    // Kullanıcı mesajı okuyabilsin diye kısa bir gecikmeyle yönlendir
    setTimeout(() => {
      window.location.href = "/yonetim/giris";
    }, 2000);
    return {
      ok: false,
      oturumBitti: true,
      mesaj: "Oturumunuz sona ermiş. Giriş sayfasına yönlendiriliyorsunuz…",
    };
  }

  let veri: Record<string, unknown>;
  try {
    veri = (await yanit.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, mesaj: `Sunucudan beklenmeyen yanıt (HTTP ${yanit.status}).` };
  }

  if (!yanit.ok || veri.ok === false) {
    return { ok: false, mesaj: String(veri.mesaj ?? "İşlem tamamlanamadı.") };
  }

  return { ok: true, veri: veri as T };
}
