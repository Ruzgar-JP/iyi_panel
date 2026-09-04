import Tani from "@/components/pwa/Tani";

export const dynamic = "force-dynamic";

/**
 * Kurulabilirlik teşhis sayfası — /tani
 *
 * Chrome kurulum penceresini göstermediğinde sebebi söylemiyor; bu sayfa
 * koşulları tek tek kontrol edip hangisinin tutmadığını gösterir.
 */
export default function TaniSayfasi() {
  return <Tani />;
}
