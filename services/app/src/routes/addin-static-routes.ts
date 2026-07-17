import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";

// SCRUM-490 H: statisches Serving des Klara-Add-in-Bundles unter /addin/*. NUR bei aktivem
// KLARWERK_ADDON_API registriert (Flag OFF → Route existiert nicht → 404 wie heute). Das Bundle liegt
// eingecheckt unter services/app/addin-static/ (klein, selten ändernd; Regenerierung s. REGENERATE.md).
//
// PATH-TRAVERSAL STRUKTURELL UNMÖGLICH: der angefragte Pfad wird NIE in einen Dateipfad übersetzt. Es
// gibt AUSSCHLIESSLICH exakte String-Treffer gegen eine EXPLIZITE Datei-Map — kein Wildcard-Static, kein
// join() mit Nutzereingabe, keine `..`-Auflösung, keine Dotfiles, kein Directory-Listing. Alles, was
// nicht exakt in der Map steht (inkl. /addin, /addin/, /addin/unbekannt.js, /addin/../x, encoded/
// backslash-Varianten), ist 404.

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

export function addinStaticRoutes(): FastifyPluginAsync {
  // Einmalig einlesen (winziges, statisches Bundle) → keine FS-Zugriffe pro Request, kein dynamischer
  // Pfad. Die Dateipfade stammen AUSSCHLIESSLICH aus der obigen Konstanten-Map.
  const loaded = new Map<string, { body: Buffer; type: string }>();
  for (const [key, { file, type }] of Object.entries(BUNDLE)) {
    loaded.set(key, { body: readFileSync(join(ROOT, file)), type });
  }

  return async (app) => {
    const notFound = (reply: import("fastify").FastifyReply): void => {
      reply.code(404).send({ error: "NOT_FOUND", message: "Nicht gefunden." });
    };

    app.get<{ Params: { "*": string } }>("/addin/*", async (request, reply) => {
      const hit = loaded.get(request.params["*"]);
      if (!hit) {
        notFound(reply); // jeder unbekannte/Trick-Pfad → 404 (kein Listing, kein Traversal)
        return;
      }
      reply
        .header("content-type", hit.type)
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "public, max-age=300")
        .send(hit.body);
    });

    // Kein Auto-Index: /addin (ohne Slash) → 404. (/addin/ und /addin/<datei> laufen über den Wildcard,
    // wo der leere/unbekannte Schlüssel ebenfalls 404 liefert.)
    app.get("/addin", async (_request, reply) => notFound(reply));
  };
}
