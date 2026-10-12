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

/* R-0679 / FR-VAL-07: Geräte-Push bei einer Prüfzuweisung.
 * Der Server schickt KEINE Nutzlast (services/notifications/src/push.ts) — der Push-Dienst des
 * Browserherstellers erfährt nur, dass etwas anliegt. Der Hinweis hier ist deshalb ein fester Satz
 * ohne Titel oder Namen; ein Antippen öffnet die eigene Prüfliste („Mir zugewiesen"), wo die
 * angemeldete Anwendung zeigt, was genau anliegt. */
const PUSH_TEXTE = {
  de: { title: "KLARWERK", body: "Dir wurde eine Prüfung zugewiesen." },
  en: { title: "KLARWERK", body: "A review has been assigned to you." },
  nl: { title: "KLARWERK", body: "Er is een beoordeling aan je toegewezen." },
};
const PUSH_ZIEL = "/validierung?mine=1";

self.addEventListener("push", (event) => {
  const sprache = (self.navigator.language || "de").slice(0, 2).toLowerCase();
  const text = PUSH_TEXTE[sprache] || PUSH_TEXTE.de;
  event.waitUntil(
    self.registration.showNotification(text.title, {
      body: text.body,
      icon: "/icon-192.png",
      tag: "klarwerk-pruefzuweisung",
      data: { ziel: PUSH_ZIEL },
    }),
  );
});

/* Was ein Antippen des Hinweises tut — als benannte Funktion, damit der Geräteprüfplatz
 * (tests-smoke/pruefzuweisung-push-geraet.spec.ts) GENAU diesen Weg nach einem echt
 * empfangenen Hinweis auslösen kann: ein Betriebssystem-Hinweis lässt sich aus dem Prüfbrowser
 * nicht anklicken. Reihenfolge: ein offenes Fenster ZUERST navigieren, dann fokussieren — der
 * Fokus kann vom Browser verweigert werden, die Navigation in die Prüfliste darf daran nicht
 * hängen. Ohne offenes Fenster öffnet ein neues. */
function oeffnePruefliste(notification) {
  const angegeben = new URL(notification?.data?.ziel || PUSH_ZIEL, self.location.origin);
  // Nur Ziele der eigenen Anwendung — nie eine fremde Adresse aus den Hinweisdaten.
  const ziel =
    angegeben.origin === self.location.origin
      ? angegeben.href
      : new URL(PUSH_ZIEL, self.location.origin).href;
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenster) => {
    const offen = fenster.find((f) => new URL(f.url).origin === self.location.origin);
    if (offen) {
      return offen.navigate(ziel).then((neu) => {
        const fokus = neu || offen;
        return fokus.focus().catch(() => fokus);
      });
    }
    return self.clients.openWindow(ziel);
  });
}
self.klarwerkPruefzuweisungOeffnen = oeffnePruefliste;

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(oeffnePruefliste(event.notification));
});
