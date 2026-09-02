"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function YonetimMenu({
  adSoyad,
  rol,
  sayilar,
}: {
  adSoyad: string;
  rol: "operator" | "yonetici";
  sayilar: { yatirim: number; cekim: number; kyc: number };
}) {
  const yol = usePathname();
  const router = useRouter();

  const bekleyenTalep = sayilar.yatirim + sayilar.cekim;

  const baglantilar = [
    { yol: "/yonetim", etiket: "Özet", sayi: 0 },
    { yol: "/yonetim/talepler", etiket: "Talepler", sayi: bekleyenTalep },
    { yol: "/yonetim/kyc", etiket: "Belgeler", sayi: sayilar.kyc },
    { yol: "/yonetim/musteriler", etiket: "Müşteriler", sayi: 0 },
    { yol: "/yonetim/hesap", etiket: "Hesaplar", sayi: 0 },
    { yol: "/yonetim/yontemler", etiket: "Ödeme Yöntemleri", sayi: 0 },
    { yol: "/yonetim/kayitlar", etiket: "Kayıtlar", sayi: 0 },
    // Personel yönetimi yalnızca tam yetkili kullanıcıda görünür.
    ...(rol === "yonetici"
      ? [
          { yol: "/yonetim/yoneticiler", etiket: "Kullanıcılar", sayi: 0 },
          { yol: "/yonetim/sistem", etiket: "Sistem", sayi: 0 },
        ]
      : []),
  ];

  async function cikis() {
    await fetch("/api/yonetim/cikis", { method: "POST" });
    router.replace("/yonetim/giris");
    router.refresh();
  }

  return (
    <header className="iy-ust">
      <div className="iy-ust-ic">
        <span className="iy-logo">İyi Yatırım · Yönetim</span>

        <nav className="iy-menu">
          {baglantilar.map((b) => (
            <Link key={b.yol} href={b.yol} className={yol === b.yol ? "etkin" : undefined}>
              {b.etiket}
              {b.sayi > 0 && <span className="iy-rozet sayi">{b.sayi}</span>}
            </Link>
          ))}
          <button type="button" className="iy-btn sade kucuk" onClick={cikis} style={{ marginLeft: 8 }}>
            Çıkış
          </button>
        </nav>
      </div>
      <div className="iy-ust-ic kucuk-yazi" style={{ height: "auto", paddingBottom: 8 }}>
        {adSoyad} · {rol === "yonetici" ? "tam yetkili" : "operatör"}
      </div>
    </header>
  );
}
