import HesapYonetimi from "@/components/yonetim/HesapYonetimi";

export const dynamic = "force-dynamic";

export default async function HesapSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ login?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 className="iy-baslik">Müşteri Hesabı</h1>
      <p className="iy-alt">
        İşlem hesabının bilgilerini düzenleyin, hesabı devre dışı bırakın veya
        işlem şifresini sıfırlayın.
      </p>

      <HesapYonetimi baslangicLogin={sp.login ?? ""} />
    </div>
  );
}
