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
      if (filePath.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
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
