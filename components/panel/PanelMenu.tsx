"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const BAGLANTILAR = [
  { yol: "/panel", etiket: "Özet" },
  { yol: "/panel/yatirim", etiket: "Para Yatır" },
  { yol: "/panel/cekim", etiket: "Para Çek" },
  { yol: "/panel/taleplerim", etiket: "Taleplerim" },
  { yol: "/panel/kyc", etiket: "Belgelerim" },
  { yol: "/panel/sifre", etiket: "Şifre" },
];

export default function PanelMenu({ adSoyad }: { adSoyad: string }) {
  const yol = usePathname();
  const router = useRouter();

  async function cikis() {
    await fetch("/api/panel/cikis", { method: "POST" });
    router.replace("/panel/giris");
    router.refresh();
  }

  return (
    <header className="iy-ust">
      <div className="iy-ust-ic">
        <span className="iy-logo">İyi Yatırım</span>

        <nav className="iy-menu">
          {BAGLANTILAR.map((b) => (
            <Link
              key={b.yol}
              href={b.yol}
              className={yol === b.yol ? "etkin" : undefined}
            >
              {b.etiket}
            </Link>
          ))}
          <button type="button" className="iy-btn sade kucuk" onClick={cikis} style={{ marginLeft: 8 }}>
            Çıkış
          </button>
        </nav>
      </div>
      <div
        className="iy-ust-ic kucuk-yazi"
        style={{ height: "auto", paddingBottom: 8 }}
      >
        {adSoyad}
      </div>
    </header>
  );
}
