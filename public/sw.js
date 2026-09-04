const VERSION = "iyi-pwa-v2.8.1";
const CACHE = `${VERSION}-static`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

function staticAsset(url) { return url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname); }

self.addEventListener("fetch", (event) => {
  const istek = event.request;
  if (istek.method !== "GET") return;
  const url = new URL(istek.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (!staticAsset(url)) return;
  event.respondWith(caches.match(istek).then((cached) => cached || fetch(istek).then((response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(istek, response.clone()));
    return response;
  })));
});
