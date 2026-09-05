export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PWA tanımı; ana ekrandan açıldığında doğrudan işlem terminaline gider. */
export function GET() {
  return new Response(
    JSON.stringify({
      id: "/",
      name: "Novatrix Markets",
      short_name: "Novatrix",
      description: "Novatrix Markets işlem terminali.",
      lang: "tr",
      start_url: "/terminal",
      scope: "/",
      display: "standalone",
      background_color: "#0b1220",
      theme_color: "#0b1220",
      icons: [
        { src: "/ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/ikon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
        { src: "/ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    },
  );
}
