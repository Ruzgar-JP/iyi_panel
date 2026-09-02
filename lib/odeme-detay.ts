/** Ödeme yöntemi JSONB'sini geçmiş hatalara karşı güvenli nesne biçimine getirir. */
export function odemeDetaylariniDuzelt(veri: unknown): Record<string, string> {
  let deger = veri;
  // Eski kayıtlar JSONB içinde JSON metni olarak kalmış olabilir.
  for (let katman = 0; katman < 2 && typeof deger === "string"; katman += 1) {
    try {
      deger = JSON.parse(deger) as unknown;
    } catch {
      return {};
    }
  }
  if (!deger || typeof deger !== "object" || Array.isArray(deger)) return {};

  return Object.fromEntries(
    Object.entries(deger).flatMap(([anahtar, deger]) =>
      typeof deger === "string" ? [[anahtar, deger]] : [],
    ),
  );
}
