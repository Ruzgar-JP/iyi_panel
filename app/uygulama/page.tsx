import UygulamaKurulum from "@/components/uygulama/UygulamaKurulum";
import "./kurulum.css";

export const dynamic = "force-dynamic";

export default async function UygulamaSayfasi({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  return <UygulamaKurulum secili={p === "android" || p === "ios" ? p : undefined} />;
}
