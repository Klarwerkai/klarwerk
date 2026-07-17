import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync, FastifyReply } from "fastify";

// SCRUM-490 H: statisches Serving des Klara-Add-in-Bundles unter /addin/*. NUR bei aktivem
// KLARWERK_ADDON_API registriert (Flag OFF → Route/Hook existieren nicht → globaler 404 wie heute).
// Das Bundle liegt eingecheckt unter services/app/addin-static/ (klein, selten ändernd; Regenerierung
// s. REGENERATE.md).
//
// PATH-TRAVERSAL STRUKTURELL UNMÖGLICH: der angefragte Pfad wird NIE in einen Dateipfad übersetzt. Es
// gibt AUSSCHLIESSLICH exakte String-Treffer gegen eine EXPLIZITE Datei-Map — kein Wildcard-Static, kein
// join() mit Nutzereingabe, keine `..`-Auflösung, keine Dotfiles, kein Directory-Listing. Alles, was
// nicht exakt in der Map steht (inkl. /addin, /addin/, /addin/unbekannt.js, /addin/../x, encoded/
// backslash-Varianten), ist 404.
//
// SCRUM-490 H2 (Response-Hardening, ben-Punkt 3): JEDE /addin-Antwort — auch die negativen — trägt
// x-content-type-options: nosniff und einen EINHEITLICHEN STATISCHEN 404-Body OHNE Echo des angefragten
// Pfades. Dafür fängt ein onRequest-Hook alle /addin-Präfix-Pfade (case-/decode-normalisiert, deckt
// auch /ADDIN/TASKPANE.HTML und Malformed ab), lässt NUR exakte Map-Treffer zur 200er-Route durch und
// beantwortet alles andere selbst — nichts unter /addin fällt auf Fastifys globalen 404 (der den Pfad
// spiegelt) durch. Case-Miss bleibt 404 (die exakte Map ist korrekt — nur Body/Header sind jetzt sauber).

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

function staticNotFound(reply: FastifyReply): FastifyReply {
  return reply
    .code(404)
    .header("content-type", "application/json; charset=utf-8")
    .header("x-content-type-options", "nosniff")
    .send(NOT_FOUND_BODY);
}

// H2: gehört der ROH-Pfad (Teil vor "?") zum /addin-Namensraum? Case-insensitiv und decode-tolerant
// (auch /%61ddin/… oder /ADDIN/… zählen), damit KEINE Variante auf den globalen Fastify-404 (mit
// Pfad-Echo) durchfällt. Reine Klassifikation — es wird weiterhin NIE ein Pfad in eine Datei übersetzt.
export function isAddinNamespacePath(rawUrl: string | undefined): boolean {
  const rawPath = (rawUrl ?? "").split("?")[0] ?? "";
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    // ungültige %-Sequenz → mit dem Roh-Pfad weiterprüfen
  }
  const lower = decoded.toLowerCase();
  return lower === "/addin" || lower === "/addin/" || lower.startsWith("/addin/");
}

export function addinStaticRoutes(): FastifyPluginAsync {
  // Einmalig einlesen (winziges, statisches Bundle) → keine FS-Zugriffe pro Request, kein dynamischer
  // Pfad. Die Dateipfade stammen AUSSCHLIESSLICH aus der obigen Konstanten-Map.
  const loaded = new Map<string, { body: Buffer; type: string }>();
  for (const [key, { file, type }] of Object.entries(BUNDLE)) {
    loaded.set(key, { body: readFileSync(join(ROOT, file)), type });
  }

  const plugin: FastifyPluginAsync = async (app) => {
    // H2: Abfang ALLER /addin-Namensraum-Pfade VOR dem Routing-Fallback. Exakte (case-sensitive)
    // Map-Treffer laufen zur 200er-Route durch; alles andere (Case-Miss, unbekannt, Malformed,
    // Trailing-Slash) bekommt den statischen 404 + nosniff — nie der globale Handler mit Pfad-Echo.
    app.addHook("onRequest", async (request, reply) => {
      if (!isAddinNamespacePath(request.raw.url)) {
        return; // alle Nicht-/addin-Anfragen: unberührt (kein neuer Weg in die API)
      }
      const rawPath = (request.raw.url ?? "").split("?")[0] ?? "";
      if (rawPath.startsWith("/addin/") && loaded.has(rawPath.slice("/addin/".length))) {
        return; // exakter Bundle-Treffer → normale 200er-Route
      }
      staticNotFound(reply);
      return reply;
    });

    app.get<{ Params: { "*": string } }>("/addin/*", async (request, reply) => {
      const hit = loaded.get(request.params["*"]);
      if (!hit) {
        // Defense-in-Depth: der Hook fängt Nicht-Treffer bereits ab; identische statische Antwort.
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

  // H2: Fastifys dokumentiertes skip-override-Symbol — der onRequest-Hook muss AUSSERHALB der Plugin-
  // Kapselung wirken, damit auch Pfade OHNE Routen-Match (/ADDIN/…, Malformed) ihn durchlaufen, statt
  // auf den globalen 404 zu fallen. Der Hook selbst fasst ausschließlich den /addin-Namensraum an.
  (plugin as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;
  return plugin;
}
