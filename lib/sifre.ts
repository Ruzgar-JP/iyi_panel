/**
 * Şifre kuralları — TEK KAYNAK.
 *
 * Hem kayıt formunda, hem panel şifre değiştirmede, hem de sunucu tarafı
 * doğrulamada bu liste kullanılır. Kural eklemek için yalnızca buraya
 * eleman ekleyin; arayüzdeki canlı liste ve sunucu kontrolü birlikte güncellenir.
 *
 * Bu dosya "server-only" DEĞİLDİR — istemci bileşenleri de import eder.
 */

export type SifreKurali = {
  id: "uzunluk" | "buyukHarf" | "kucukHarf" | "simge";
  etiket: string;
  gecti: (s: string) => boolean;
};

export const SIFRE_KURALLARI: SifreKurali[] = [
  {
    id: "uzunluk",
    etiket: "En az 8 karakter",
    gecti: (s) => s.length >= 8,
  },
  {
    id: "buyukHarf",
    etiket: "En az 1 büyük harf",
    gecti: (s) => /[A-ZÇĞİÖŞÜ]/.test(s),
  },
  {
    id: "kucukHarf",
    etiket: "En az 1 küçük harf",
    gecti: (s) => /[a-zçğıöşü]/.test(s),
  },
  {
    id: "simge",
    etiket: "En az 1 özel karakter (!@#$%&* gibi)",
    gecti: (s) => /[^\p{L}\p{N}]/u.test(s),
  },
];

/** Sağlanmayan kuralların etiketleri. Boş dizi = şifre geçerli. */
export function sifreHatalari(sifre: string): string[] {
  return SIFRE_KURALLARI.filter((k) => !k.gecti(sifre)).map((k) => k.etiket);
}

export function sifreGecerliMi(sifre: string): boolean {
  return sifreHatalari(sifre).length === 0;
}

/** Platformun kendi sınırı: 6–64 karakter (PUT /password dokümanı). */
export const PLATFORM_AZAMI_UZUNLUK = 64;

export function platformKabulEderMi(sifre: string): boolean {
  return sifre.length >= 6 && sifre.length <= PLATFORM_AZAMI_UZUNLUK;
}
