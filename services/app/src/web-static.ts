import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

// Eine Anfrage gilt als Asset-Anfrage, wenn ihr letztes Pfadsegment eine Dateiendung trägt
// (z. B. .js, .css, .woff2, .map). Solche Anfragen dürfen NIE den SPA-Fallback (index.html)
// bekommen: ein fehlendes Bundle muss laut mit 404 scheitern, statt still text/html zu liefern.
// (Stale-Static-Fix: ein Bundle-Mismatch nach einem Rebuild wird so sichtbar statt weißer Seite.)
export function isAssetRequest(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0] ?? url;
  const lastSegment = path.slice(path.lastIndexOf("/") + 1);
  return /\.[a-z0-9]+$/i.test(lastSegment);
}

// Statische Auslieferung der gebauten SPA + SPA-Fallback. Bewusst mit dem @fastify/static-Default
// (wildcard: true): Dateien werden pro Anfrage dynamisch von der Platte aufgelöst — ein
// Frontend-Rebuild mit neuen Bundle-Hashes wird also OHNE Server-Neustart ausgeliefert.
// Zuvor (wildcard: false) globte @fastify/static das dist-Verzeichnis einmalig beim Start; neue
// Hash-Dateinamen aus einem späteren Rebuild waren dem laufenden Prozess unbekannt → NotFound
// lieferte index.html (text/html) für .js → weiße Seite.
export async function registerWebStatic(app: FastifyInstance, dist: string): Promise<void> {
  await app.register(fastifyStatic, {
    root: dist,
    setHeaders: (res, filePath) => {
      // Gehashte Assets sind unveränderlich; index.html nie cachen.
      // BEFUND AUFTRAG-mega69 Block D (am Draht gemessen, tests/app/mega69-klara-auslieferung):
      // dieser Callback wird von @fastify/static ANSCHLIESSEND überschrieben — auf dem Draht stand
      // für ALLE Pfade `public, max-age=0` (Plugin-Default cacheControl/maxAge), nie das hier
      // Gesetzte. Für die Frische ist max-age=0 zufällig gutartig (sofort stale → Revalidierung),
      // aber `immutable` für Assets war eine tote Absicht. Der onSend-Hook unten setzt die Zusage
      // für die EINE Fläche durch, an der sie vertraglich gebraucht wird (Klara-Manifest zeigt auf
      // /word-addin/taskpane.html); die App-weite Regel bleibt bewusst unangetastet — sie zu
      // „reparieren" wäre eine Verhaltensänderung der ganzen Auslieferung und gehört als eigene
      // Entscheidung vor den Kopf (Registerpunkt im mega69-Bericht).
      if (filePath.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  });

  // AUFTRAG-mega69 Block D: die Auslieferungszusage für Klaras eine Datei — DURCHGESETZT, nicht nur
  // beabsichtigt. onSend läuft nach dem Static-Plugin und gewinnt damit gegen dessen Default.
  // NUR /word-addin/* (die Fläche, die ein installiertes Add-in per stabiler URL abruft): der
  // Webview darf die Antwort nicht einfrieren und muss je Abruf revalidieren (ETag bleibt).
  // AUFTRAG-mega71 Block A (bens Ship-Blocker): SYNCHRON im 4-Parameter-Callback-Stil, wie die
  // drei anderen app-globalen onSend-Hooks (noindex-hook.ts, security-headers.ts,
  // addin-static-routes.ts) — die WP-E-Regel. Die mega69-Fassung stand hier als `async` und war
  // damit einen einzigen Edit (ein await hier ODER irgendein zweiter async-Hook) vom
  // wrap-thenable-Doppel-Send-Fenster entfernt (ERR_HTTP_HEADERS_SENT → Prozess-Crash; Mechanik
  // in routes/addin-static-routes.ts:130 ff., am Draht gepinnt in tests/app/mega71-onsend-synchron).
  app.addHook("onSend", (request, reply, payload, done) => {
    const path = request.url.split(/[?#]/, 1)[0] ?? request.url;
    if (path.startsWith("/word-addin/")) {
      reply.header("Cache-Control", "no-cache");
    }
    done(null, payload);
  });

  // SPA-Fallback: unbekannte Navigationspfade → index.html (Client-Routing). Aber:
  // - /api und /health → strukturierter JSON-404 (nie SPA-HTML).
  // - Asset-Anfragen (Pfad mit Dateiendung) → echter 404 statt index.html, damit ein fehlendes
  //   Bundle laut scheitert und nicht still text/html unter einem .js-Pfad ausgeliefert wird.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api") || request.url === "/health") {
      reply.code(404).send({ error: "NOT_FOUND", message: "Nicht gefunden." });
      return;
    }
    if (isAssetRequest(request.url)) {
      reply.code(404).type("text/plain").send("Not Found");
      return;
    }
    reply.header("Cache-Control", "no-cache");
    reply.type("text/html");
    return reply.sendFile("index.html");
  });
}
