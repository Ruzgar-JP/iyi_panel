import type { Bakiye } from "./scaletrade";

export type HesapGorunumu = {
  login: number;
  grup: string | null;
  paraBirimi: string | null;
  kaldirac: number | null;
  bakiye: Bakiye | null;
};

type Kayit = Record<string, unknown>;

function nesneMu(deger: unknown): deger is Kayit {
  return typeof deger === "object" && deger !== null && !Array.isArray(deger);
}

function sayiMi(deger: unknown): deger is number {
  return typeof deger === "number" && Number.isFinite(deger);
}

/**
 * Oturum tablosundaki hesap görüntüsünü her zaman dizi biçimine getirir.
 *
 * İlk sürüm `[{ hesap: {...}, bakiye: {...} }]`, güncel sürüm ise doğrudan
 * `[{ login, grup, paraBirimi, ... }]` yazıyordu. Eski çerezler panel
 * açılırken uygulamayı çökertmemelidir.
 */
export function hesapGorunumleriniDiziyeCevir(veri: unknown): HesapGorunumu[] {
  let deger = veri;
  if (typeof deger === "string") {
    try {
      deger = JSON.parse(deger) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(deger)) return [];

  return deger.flatMap((kayit) => {
    if (!nesneMu(kayit)) return [];
    const eskiHesap = nesneMu(kayit.hesap) ? kayit.hesap : null;
    const kaynak = eskiHesap ?? kayit;
    if (!sayiMi(kaynak.login)) return [];

    return [{
      login: kaynak.login,
      grup: typeof (kaynak.grup ?? kaynak.group) === "string"
        ? String(kaynak.grup ?? kaynak.group)
        : null,
      paraBirimi: typeof (kaynak.paraBirimi ?? kaynak.currency) === "string"
        ? String(kaynak.paraBirimi ?? kaynak.currency)
        : null,
      kaldirac: sayiMi(kaynak.kaldirac)
        ? kaynak.kaldirac
        : sayiMi(kaynak.leverage)
          ? kaynak.leverage
          : null,
      bakiye: nesneMu(kayit.bakiye) ? kayit.bakiye as Bakiye : null,
    }];
  });
}
