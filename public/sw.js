/* LUMINA Optics SW v1 — runtime cache tài sản tĩnh + ảnh (không precache HTML).
 * Navigations luôn đi mạng (giữ giá/tồn tươi); asset/ảnh stale-while-revalidate.
 */
const VERSION = "lumina-v1";
const ASSET_CACHE = `${VERSION}-assets`;
const IMAGE_CACHE = `${VERSION}-images`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Navigations: network-only (giá/tồn/realtime + tránh HTML cũ)
  if (request.mode === "navigate") return;
  const isImage = request.destination === "image" || url.pathname.startsWith("/icons/");
  const isAsset = url.pathname.startsWith("/_next/static/");
  if (!isImage && !isAsset) return;
  event.respondWith(
    caches.open(isImage ? IMAGE_CACHE : ASSET_CACHE).then((cache) =>
      cache.match(request).then((hit) => {
        const network = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        });
        return hit ?? network;
      }),
    ),
  );
});
