import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

// SCRUM-490 H: statisches Serving des Klara-Add-in-Bundles unter /addin/*. NUR bei aktivem
// KLARWERK_ADDON_API registriert (Flag OFF → Route/Hooks existieren nicht → globaler 404 wie heute).
// Das Bundle liegt eingecheckt unter services/app/addin-static/ (klein, selten ändernd; Regenerierung
// s. REGENERATE.md).
//
// PATH-TRAVERSAL STRUKTURELL UNMÖGLICH: der angefragte Pfad wird NIE in einen Dateipfad übersetzt. Es
// gibt AUSSCHLIESSLICH exakte String-Treffer gegen eine EXPLIZITE Datei-Map — kein Wildcard-Static, kein
// join() mit Nutzereingabe, keine `..`-Auflösung, keine Dotfiles, kein Directory-Listing.
//
// SCRUM-490 H2/H3 (Response-Hardening, bens Punkte 1–4): die GESAMTE negative Antwortfläche des
// /addin-Namensraums ist vereinheitlicht — EIN statischer 404-Body + nosniff, kein Pfad-/Methoden-/
// Fehler-Echo, nichts fällt auf Fastifys globale Handler durch. Drei Schichten (alle in dieser Datei):
//  1. onRequest-Hook: fängt jeden klassifizierten Namensraum-Pfad; NUR GET/HEAD mit exaktem Map-Treffer
//     erreichen den 200-Pfad (Punkt 1: alle anderen Methoden → statischer 404; Entscheid 404-statt-405:
//     Einheitlichkeit > HTTP-Purismus — kein Methoden-/Existenz-Orakel auf der statischen Fläche).
//  2. onSend-Hook (Response-Phase): universeller Stempel für alles, was die Request-Phase passiert
//     (z. B. CORS-/Fremd-Hook-Antworten, globale 404 nach künftigen Refactors) — nosniff auf JEDE
//     Namensraum-Antwort; 401/429 des vorgelagerten Auth-/Throttle-Hooks bleiben in Status/Semantik/Body
//     UNVERÄNDERT (Punkt 4, nur nosniff ergänzt); jede andere Negative wird auf den statischen 404
//     normalisiert. Der 200-Pfad (GET/HEAD + Map-Treffer) bleibt byte-/header-identisch.
//  3. onListen + server.prependListener("request"): FST_ERR_BAD_URL-Abdeckung (Punkt 3). Fastify weist
//     nicht-dekodierbare URLs (/addin/%c0%ae, truncated %E0%A4%A) VOR jedem Hook ab — weder onSend noch
//     setErrorHandler laufen (empirisch belegt). Deshalb wird ein solcher Pfad, WENN er in den
//     /addin-Namensraum klassifiziert, VOR Fastify auf einen harmlosen, dekodierbaren Map-Miss-Pfad
//     umgeschrieben → die Antwort entsteht im normalen Lifecycle als statischer 404 + nosniff
//     (konsistent 404 statt 400 — dokumentierter Entscheid, Einheitlichkeit der Fläche). Nicht-
//     Namensraum-URLs bleiben unberührt (deren globale 400 ist nicht unsere Fläche).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "addin-static");

// Schlüssel = der Rest hinter "/addin/" (params["*"]); Wert = eingecheckte Datei + Content-Type.
const BUNDLE: Record<string, { file: string; type: string }> = {
  "taskpane.html": { file: "taskpane.html", type: "text/html; charset=utf-8" },
  "taskpane.css": { file: "taskpane.css", type: "text/css; charset=utf-8" },
  "taskpane.js": { file: "taskpane.js", type: "text/javascript; charset=utf-8" },
  "klarwerk-client.js": { file: "klarwerk-client.js", type: "text/javascript; charset=utf-8" },
  "assets/icon-32.png": { file: "assets/icon-32.png", type: "image/png" },
  "assets/icon-80.png": { file: "assets/icon-80.png", type: "image/png" },
};

// H2: EIN statischer Fehlerbody für alle negativen /addin-Antworten — kein Pfad-Echo, keine Interna.
const NOT_FOUND_BODY = JSON.stringify({ error: "NOT_FOUND", message: "Nicht gefunden." });

// H3: Ziel des Malformed-Rewrites — dekodierbar, garantiert KEIN Map-Treffer → statischer 404.
const MALFORMED_REWRITE_TARGET = "/addin/__malformed__";

function staticNotFound(reply: FastifyReply): FastifyReply {
  return reply
    .code(404)
    .header("content-type", "application/json; charset=utf-8")
    .header("x-content-type-options", "nosniff")
    .send(NOT_FOUND_BODY);
}

// H3 (Punkt 2): gehärteter Namensraum-Klassifizierer auf dem ROH-Pfad. Reine Klassifikation — es wird
// weiterhin NIE ein Pfad in eine Datei übersetzt.
//  (a) iterativ dekodieren, begrenzt (max. 3 Passes, Stop bei Stabilität) → /%2561ddin, /%2541DDIN,
//      /addin%252F… werden erkannt;
//  (b) Backslash → Slash normalisiert (/addin\foo), Semikolon-Segment-Parameter toleriert (/addin;v=1/…);
//  (c) bei Decode-FEHLER greift der Roh-Präfix-Check (der Roh-Kandidat wird immer mitgeprüft) →
//      /addin/%c0%ae, /addin/%E0%A4%A gelten als Namensraum.
// Negativ-Pins: /addinfoo, /addin-x, /api/ask, /health, / → NIEMALS Namensraum (das Regex verlangt nach
// „/addin" ein Segment-Ende: „/", „;“-Parameter oder String-Ende).
const ADDIN_SEGMENT_RE = /^\/addin(?:;[^/]*)?(?:\/|$)/;

export function isAddinNamespacePath(rawUrl: string | undefined): boolean {
  const withoutQuery = (rawUrl ?? "").split("?")[0] ?? "";
  const normalize = (s: string): string => s.replace(/\\/g, "/").toLowerCase();

  const candidates: string[] = [normalize(withoutQuery)];
  let current = withoutQuery;
  for (let pass = 0; pass < 3; pass++) {
    let next: string;
    try {
      next = decodeURIComponent(current);
    } catch {
      break; // nicht dekodierbar → der Roh-Kandidat (oben) entscheidet (Punkt 2c)
    }
    if (next === current) {
      break; // stabil → fertig
    }
    current = next;
    candidates.push(normalize(current));
  }
  return candidates.some((c) => ADDIN_SEGMENT_RE.test(c));
}

// Ist der ROH-Pfad ein exakter (case-sensitiver) Bundle-Schlüssel? Nur diese Pfade erreichen den
// 200-Pfad; alles andere ist statischer 404. Kein decode, kein normalize — exakte Map wie in H.
function exactBundleKey(rawUrl: string | undefined): string | null {
  const rawPath = (rawUrl ?? "").split("?")[0] ?? "";
  return rawPath.startsWith("/addin/") ? rawPath.slice("/addin/".length) : null;
}

export function addinStaticRoutes(): FastifyPluginAsync {
  // Einmalig einlesen (winziges, statisches Bundle) → keine FS-Zugriffe pro Request, kein dynamischer
  // Pfad. Die Dateipfade stammen AUSSCHLIESSLICH aus der obigen Konstanten-Map.
  const loaded = new Map<string, { body: Buffer; type: string }>();
  for (const [key, { file, type }] of Object.entries(BUNDLE)) {
    loaded.set(key, { body: readFileSync(join(ROOT, file)), type });
  }

  const isExactHit = (rawUrl: string | undefined): boolean => {
    const key = exactBundleKey(rawUrl);
    return key !== null && loaded.has(key);
  };

  const plugin: FastifyPluginAsync = async (app) => {
    // Schicht 1 (Request-Phase, H2/H3-Punkt 1): jeder klassifizierte Namensraum-Pfad wird hier
    // beantwortet, AUSSER GET/HEAD auf einen exakten Map-Treffer (→ 200-Route, byte-identisch).
    // Auth-401/429 des VORHER registrierten Throttle-Hooks (build-app) sind davon unberührt — sie
    // antworten, bevor dieser Hook läuft (Punkt 4: Throttle-Verhalten heilig).
    app.addHook("onRequest", async (request, reply) => {
      if (!isAddinNamespacePath(request.raw.url)) {
        return; // Nicht-Namensraum-Traffic: unberührt (kein neuer Weg in die API)
      }
      const method = request.raw.method ?? "";
      if ((method === "GET" || method === "HEAD") && isExactHit(request.raw.url)) {
        return; // exakter Bundle-Treffer → normale 200er-Route
      }
      staticNotFound(reply);
      return reply;
    });

    // Schicht 2 (Response-Phase, H3): universeller Stempel für ALLE Namensraum-Antworten, die die
    // Request-Phase passieren (Auth-401/429, CORS-/Fremd-Hook-Antworten, globale Fallbacks).
    app.addHook("onSend", async (request, reply, payload) => {
      if (!isAddinNamespacePath(request.raw.url)) {
        return payload; // sofortiger Return: Nicht-Namensraum unverändert
      }
      reply.header("x-content-type-options", "nosniff"); // nosniff auf JEDER /addin-Antwort
      const status = reply.statusCode;
      if (status === 401 || status === 429) {
        return payload; // Punkt 4: Auth-/Throttle-Antworten in Status/Semantik/Body unverändert
      }
      const method = request.raw.method ?? "";
      if (status < 400 && (method === "GET" || method === "HEAD") && isExactHit(request.raw.url)) {
        return payload; // 200-Pfad byte-/header-identisch
      }
      // Jede andere Antwort im Namensraum → einheitlicher statischer 404 (kein Echo, keine Interna).
      reply.code(404);
      reply.header("content-type", "application/json; charset=utf-8");
      reply.header("content-length", String(Buffer.byteLength(NOT_FOUND_BODY)));
      return NOT_FOUND_BODY;
    });

    // Schicht 3 (vor Fastify, H3-Punkt 3): FST_ERR_BAD_URL-Abdeckung. Nicht-dekodierbare Pfade im
    // Namensraum werden auf einen harmlosen Map-Miss-Pfad umgeschrieben, BEVOR Fastifys Router sie
    // (außerhalb jedes Lifecycles, ohne onSend/Error-Handler) mit einem URL-echoenden 400 abweisen
    // würde. Ergebnis: normaler Lifecycle → statischer 404 + nosniff. Läuft nur bei echtem listen()
    // (Rohsocket/Produktion); inject() normalisiert URLs ohnehin clientseitig vorab.
    app.addHook("onListen", async function (this: typeof app) {
      this.server.prependListener("request", (req: { url?: string }) => {
        const rawPath = (req.url ?? "").split("?")[0] ?? "";
        let malformed = false;
        try {
          decodeURIComponent(rawPath);
        } catch {
          malformed = true;
        }
        if (malformed && isAddinNamespacePath(req.url)) {
          req.url = MALFORMED_REWRITE_TARGET;
        }
      });
    });

    app.get<{ Params: { "*": string } }>("/addin/*", async (request, reply) => {
      const hit = loaded.get(request.params["*"]);
      if (!hit) {
        // Defense-in-Depth: die Hooks fangen Nicht-Treffer bereits ab; identische statische Antwort.
        staticNotFound(reply);
        return;
      }
      reply
        .header("content-type", hit.type)
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "public, max-age=300")
        .send(hit.body);
    });

    // Kein Auto-Index: /addin (ohne Slash) → statischer 404 (der Hook antwortet bereits; die Route
    // bleibt als Defense-in-Depth und für den Route-Guard-Audit-Scanner).
    app.get("/addin", async (_request, reply) => staticNotFound(reply));
  };

  // H2: Fastifys dokumentiertes skip-override-Symbol — die Hooks müssen AUSSERHALB der Plugin-Kapselung
  // wirken, damit auch Pfade OHNE Routen-Match (/ADDIN/…, Malformed) sie durchlaufen, statt auf die
  // globalen Handler zu fallen. Alle Hooks fassen ausschließlich den /addin-Namensraum an.
  (plugin as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
  return plugin;
}
