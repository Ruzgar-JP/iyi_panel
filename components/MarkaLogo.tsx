import Link from "next/link";

export default function MarkaLogo({
  href,
  yonetim = false,
}: {
  href: string;
  yonetim?: boolean;
}) {
  return (
    <Link className="iy-marka" href={href} aria-label={yonetim ? "İyi Yatırım yönetim paneli" : "İyi Yatırım müşteri paneli"}>
      <img src="/iyi-yatirim-logo.png" alt="İyi Yatırım" />
      {yonetim && <span>Yönetim</span>}
    </Link>
  );
}
