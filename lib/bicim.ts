/** Biçimlendirme yardımcıları — hem sunucu hem istemci tarafında kullanılır. */

const paraBicimi = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tarihBicimi = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function paraFormat(deger: number | string | null | undefined): string {
  const sayi = typeof deger === "string" ? Number(deger) : deger;
  if (sayi == null || !Number.isFinite(sayi)) return "—";
  return paraBicimi.format(sayi);
}

export function tarihFormat(t: Date | string | null | undefined): string {
  if (!t) return "—";
  const d = typeof t === "string" ? new Date(t) : t;
  return Number.isNaN(d.getTime()) ? "—" : tarihBicimi.format(d);
}

/** "3 dakika 12 saniye" gibi geri sayım metni. */
export function sureMetni(saniye: number): string {
  if (saniye <= 0) return "0 saniye";
  const dk = Math.floor(saniye / 60);
  const sn = saniye % 60;
  if (dk === 0) return `${sn} saniye`;
  if (sn === 0) return `${dk} dakika`;
  return `${dk} dakika ${sn} saniye`;
}
