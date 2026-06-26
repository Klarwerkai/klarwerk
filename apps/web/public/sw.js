/* KLARWERK Service Worker (SCRUM-113 / FE-MOB-01).
 * Handgeschrieben, kein Workbox. Ziel: installierbare PWA + Offline-Start.
 * Strategie:
 *  - /api und /health: NIE cachen, network-only (keine kaputt gecachten API-Responses).
 *  - Navigationen (HTML): network-first → Fallback auf gecachte App-Shell (index.html).
 *  - statische Assets (gleiche Origin, GET): stale-while-revalidate.
 * Offline-Start funktioniert nach erstem Online-Besuch (Shell + Assets im Cache).
 */
const CACHE = "klarwerk-v1";
const SHELL = "/index.html";
const PRECACHE = ["/", SHELL, "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api") || url.pathname === "/health";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApi(url)) {
    return; // API/cross-origin: Browser-Default (network), nichts cachen.
  }

  // Navigationen → network-first, Fallback App-Shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy));
          return res;
        })
        .catch(() => caches.match(SHELL).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // statische Assets → stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
