import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

// ================================================================================================
// JOB 1077 — DIE AUSGELIEFERTE FASSUNG ENTSTEHT BEI DER AUSLIEFERUNG.
// ================================================================================================
//
// DAS PROBLEM, gemessen und nicht vermutet: Ein installiertes Klara-Add-in hält seine Seite so
// lange, bis der Webview sie neu holt. Bis hierher konnte niemand — der Mensch davor am wenigsten —
// erkennen, ob die Seite im Aufgabenfenster noch die ist, die der Server ausliefert.
//
// DER ERSTE ENTWURF (D5) schrieb die Nummer als handgepflegtes Literal in die Quelldatei. Das ist
// im Ansatz nicht schliessbar: Ein Literal ändert sich durch ein Neuladen nicht, also konnte die
// Kette „Wechsel auslösen → neu laden → die neue Seite meldet die neue Fassung" nie geschlossen
// werden. Die Quelle wird deshalb UMGEDREHT: Die Datei trägt nur den Platzhalter, und der Server
// stempelt ihn in den GESENDETEN Körper. Daraus folgt die tragende Eigenschaft —
//
//   EINE AUSGELIEFERTE SEITE KANN NIEMALS EINE ANDERE FASSUNG BEHAUPTEN ALS DER SERVER,
//   DER SIE GESCHICKT HAT.
//
// Beide Antworten, die gestempelte Seite und der Kopf `X-KW-Available-Version`, entstehen aus
// EINEM Wert. Ein Client mit einer älteren Lieferung sieht die Abweichung sofort.
//
// WARUM EINE EIGENE ROUTE UND KEIN `onSend`-EINGRIFF — der naheliegende Weg wäre ein Stempel im
// bestehenden Hook gewesen, und er wäre ein STILLER Fehler: `@fastify/static` antwortet mit einem
// Stream und einem ETag über den PLATTENINHALT. Wird der Körper danach verändert, zeigt der
// Validator auf einen anderen Inhalt als den gesendeten — und bei `no-cache` führt genau das zu
// einem `304` auf veralteten Inhalt. Ausgerechnet der Mechanismus, der Frische herstellen soll,
// hätte Altes zementiert. Diese Route bildet den Validator deshalb über den Körper, der WIRKLICH
// hinausgeht.
//
// KEIN NEUER VERTRAG NACH AUSSEN: `no-cache`, `Content-Type` und das laute 404 bei fehlendem
// Add-in bleiben, wie `tests/app/mega69-klara-auslieferung.test.ts` sie am Draht gepinnt hat.

/** Die eine Adresse, auf die das Klara-Manifest zeigt (`docs/word-addin/klara-manifest.xml`). */
export const KLARA_TASKPANE_PFAD = "/word-addin/taskpane.html";

/** Der Kopf, über den eine geladene Seite erfährt, was der Server HEUTE ausliefert. */
export const KLARA_FASSUNG_KOPF = "x-kw-available-version";

/** Steht so in der Quelldatei — und niemals in einer Antwort. */
export const KLARA_FASSUNG_PLATZHALTER = "__KW_FASSUNG__";

/**
 * Die ausgelieferte Fassung. Sie ist DIESELBE Zahl wie `<Version>` im Klara-Manifest — eine Zahl,
 * zwei Orte, ein Wert; gepinnt in `tests/app/word-addin-taskpane-version-contract.test.ts` (E3).
 *
 * Sie ist bewusst NICHT der Bau-Stempel `__KLARA_STAND__`: der beantwortet „wann wurde gebaut",
 * diese Zahl „ist meine Seite noch die, die ausgeliefert wird". Zwei Fragen, zwei Mechaniken.
 */
export const KLARA_TASKPANE_FASSUNG = "1.0.0.1";

/** Ersetzt den Platzhalter im Körper. Rührt `__KLARA_STAND__` ausdrücklich nicht an. */
export function stempleFassung(html: string, fassung: string): string {
  return html.split(KLARA_FASSUNG_PLATZHALTER).join(fassung);
}

// Statische Auslieferung der gebauten SPA + SPA-Fallback. Bewusst mit dem @fastify/static-Default
// (wildcard: true): Dateien werden pro Anfrage dynamisch von der Platte aufgelöst — ein
// Frontend-Rebuild mit neuen Bundle-Hashes wird also OHNE Server-Neustart ausgeliefert.
// Zuvor (wildcard: false) globte @fastify/static das dist-Verzeichnis einmalig beim Start; neue
// Hash-Dateinamen aus einem späteren Rebuild waren dem laufenden Prozess unbekannt → NotFound
// lieferte index.html (text/html) für .js → weiße Seite.
//
// JOB 1077: `fassung` ist injizierbar, damit ein Test ZWEI Auslieferungen desselben Server-Codes
// gegeneinander stellen kann — ohne sie liesse sich „A geladen, B verfügbar" nur behaupten.
export async function registerWebStatic(
  app: FastifyInstance,
  dist: string,
  fassung: string = KLARA_TASKPANE_FASSUNG,
): Promise<void> {
  // JOB 1077: Die EIGENE Route für Klaras eine Datei — VOR dem Static-Plugin registriert, damit
  // sichtbar ist, dass sie den Vorrang hat (find-my-way zieht die exakte Route ohnehin dem
  // Wildcard vor). Fastify legt die HEAD-Route selbst dazu (`exposeHeadRoutes`); sie durchläuft
  // denselben Handler und liefert damit denselben Kopf ohne Körper.
  app.get(KLARA_TASKPANE_PFAD, async (_request, reply) => {
    let roh: string;
    try {
      roh = await readFile(join(dist, "word-addin", "taskpane.html"), "utf8");
    } catch {
      // LAUT scheitern, nie still als SPA-HTML: ein fehlendes Add-in im Build ist ein Defekt,
      // kein Navigationspfad (dieselbe Entscheidung wie bei den Assets unten).
      reply.code(404).type("text/plain").send("Not Found");
      return;
    }
    const koerper = stempleFassung(roh, fassung);
    reply
      .header("Cache-Control", "no-cache")
      .header(KLARA_FASSUNG_KOPF, fassung)
      // Der Validator über den GESENDETEN Körper — s. Kopfkommentar.
      .header("ETag", `"${createHash("sha256").update(koerper).digest("hex").slice(0, 32)}"`)
      .type("text/html; charset=utf-8")
      .send(koerper);
  });

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
