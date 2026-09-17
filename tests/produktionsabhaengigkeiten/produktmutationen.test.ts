// ================================================================================================
// JOB 4272 · LIEFERUNG 7 — JEDE MUTATION AM PRODUKT, JEDER REGRESSIONSTEST UNVERÄNDERT.
// ================================================================================================
//
// WAS BEN AN RUNDE 3 ZURÜCKGEWIESEN HAT, wörtlich: „Die als erfüllt gemeldeten Pflichtmutationen
// ersetzen teilweise den Produktweg … Das belegt Hilfsfunktionen, aber keinen roten Lauf der
// vorgeschriebenen Regressionstests gegen mutierten Produktcode."
//
// DAS IST DER UNTERSCHIED, UM DEN ES GEHT. `kalibrierung.test.ts` zeigt, dass die PRÜFFUNKTIONEN
// aus `waechter.ts` unterscheiden können — eine notwendige, aber schwächere Aussage. Diese Datei
// zeigt das, was der Ordner wirklich zusagt:
//
//   WIRD DAS PRODUKT AN DIESER STELLE GEÄNDERT, WIRD GENAU DIESER REGRESSIONSTEST ROT.
//
// DER AUFBAU JE FALL, und er lässt keinen Zwischenweg zu:
//   1. eine vollständige Kopie des Produkts in einem Wegwerfordner (`produktkopie.ts`),
//   2. GENAU EINE Stelle im PRODUKTCODE der Kopie verstellt — greift die Vorlage nicht genau
//      einmal, bricht der Fall ab, statt etwas anderes zu messen,
//   3. der Regressionstest, Zeichen für Zeichen unverändert, in der Kopie gefahren,
//   4. Exit-Code und Fehlermeldung des wirklichen Laufs als Beleg; `code === null` (Abbruch) gilt
//      ausdrücklich NICHT als rot,
//   5. die Verstellung zurückgenommen und die Rücknahme geprüft.
//
// DIE NULLPROBE ZUERST, und sie ist nicht Zierde. Ohne sie wäre jede Rotfärbung unten
// mehrdeutig: sie könnte auch von einer unbrauchbaren Kopie kommen. Der erste Fall fährt deshalb
// den GANZEN Ordner in der UNVERSTELLTEN Kopie und verlangt Exit 0. Erst danach ist ein rotes
// Ergebnis der Verstellung zuzuschreiben.
//
// LAUFZEIT, ehrlich benannt: dieser Aufbau kostet eine Kopie und zehn eigene Vitest-Läufe. Er ist
// der teuerste Test dieses Ordners und der einzige, der die Zusage wirklich belegt.
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  baueProduktkopie,
  belegzeilen,
  fahreTest,
  ohneFarbe,
  verstelle,
  zurueckgenommen,
  zusammenzeilen,
} from "./produktkopie";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORDNER = "tests/produktionsabhaengigkeiten";

interface Fall {
  /** Der Buchstabe aus Auftrag §7 bzw. der Zusatzfall aus BENs Korrekturpflicht 1. */
  readonly kennung: string;
  readonly was: string;
  /** Die PRODUKTdatei, die verstellt wird — relativ zur Wurzel der Kopie. */
  readonly datei: string;
  readonly ersetze: string;
  readonly durch: string;
  /** Der unveränderte Regressionstest, der dadurch rot werden MUSS. */
  readonly test: string;
  /** Was im roten Lauf wörtlich stehen muss. Kein Muster, keine Absicht — ein Zeichenvergleich. */
  readonly erwartet: string;
}

const FAELLE: Fall[] = [
  {
    kennung: "a",
    was: "Bildgrenze aufheben (1280 → 4096)",
    datei: "services/app/src/import/bildverkleinerung.ts",
    ersetze: "export const BILD_MAX_KANTE = 1280;",
    durch: "export const BILD_MAX_KANTE = 4096;",
    test: `${ORDNER}/bildimport-bleibt-heil.test.ts`,
    erwartet: "expected 4096 to be 1280",
  },
  {
    kennung: "b",
    was: "Schemaprüfung von POST /api/ask aushängen",
    datei: "services/app/src/routes/ask-routes.ts",
    ersetze: "        schema: { body: askBodySchema },",
    durch: "        schema: {},",
    test: `${ORDNER}/http-validierung-bleibt-streng.test.ts`,
    erwartet: 'Primitiver Body "hallo" kam mit',
  },
  {
    kennung: "c",
    was: "SPA-Fallback auch für Assets liefern",
    datei: "services/app/src/web-static.ts",
    ersetze: [
      "    if (isAssetRequest(request.url)) {",
      '      reply.code(404).type("text/plain").send("Not Found");',
      "      return;",
      "    }",
    ].join("\n"),
    durch: [
      "    if (isAssetRequest(request.url) && false) {",
      '      reply.code(404).type("text/plain").send("Not Found");',
      "      return;",
      "    }",
    ].join("\n"),
    test: `${ORDNER}/statische-auslieferung-bleibt-laut.test.ts`,
    erwartet: "Ein fehlendes Bündel kam still als SPA-HTML zurück",
  },
  {
    kennung: "d",
    was: "Adressweitergabe verfälschen (Grossschreibung)",
    datei: "services/notifications/src/smtp.ts",
    ersetze: "        to: message.to,",
    durch: "        to: message.to.toUpperCase(),",
    test: `${ORDNER}/mailadressen-bleiben-unveraendert.test.ts`,
    erwartet: "Die Empfängeradresse kam verändert bei nodemailer an",
  },
  {
    kennung: "e",
    was: "HTTP/2 im Aufbau einschalten",
    datei: "services/app/src/build-app.ts",
    ersetze: ["  const app = Fastify({", "    trustProxy: resolveTrustProxy(),"].join("\n"),
    durch: [
      "  const app = Fastify({",
      "    http2: true,",
      "    trustProxy: resolveTrustProxy(),",
    ].join("\n"),
    test: `${ORDNER}/kein-http2.test.ts`,
    erwartet: "http2 taucht in services/ auf",
  },
  {
    kennung: "f",
    was: "eine Version in der Lockdatei verstellen",
    datei: "package-lock.json",
    ersetze: ['    "node_modules/sharp": {', '      "version": "0.35.4",'].join("\n"),
    durch: ['    "node_modules/sharp": {', '      "version": "0.0.0-verstellt",'].join("\n"),
    test: `${ORDNER}/gebundene-versionen.test.ts`,
    erwartet: "die Lockdatei sagt 0.0.0-verstellt",
  },
  // ==============================================================================================
  // DIE DREI ZUSATZFÄLLE AUS BENs KORREKTURPFLICHT 1 — der Static-Wächter muss beissen.
  // ==============================================================================================
  // BENs Abnahme wörtlich: „unveränderter Stand grün; eine vorgeschaltete Rechteprüfung gezielt
  // rot; eine zweite geschützte Registrierung gezielt rot." Fall g setzt die Prüfung dorthin, wo
  // BEN sie hatte — in die Auslieferungskette von `server.ts`, VOR `registerWebStatic`. Fall h
  // setzt sie in `registerWebStatic` selbst, damit auch der LAUFENDE Aufbau sie beweisen muss und
  // nicht nur der Quelltext. Fall i ist die zweite, wirklich geschützte Registrierung.
  {
    kennung: "g",
    was: "Rechteprüfung VOR registerWebStatic in der Kette von server.ts",
    datei: "services/app/src/server.ts",
    ersetze: [
      "  // Statische Auslieferung + SPA-Fallback (Stale-Static-Fix, siehe web-static.ts).",
      "  await registerWebStatic(app, dist);",
    ].join("\n"),
    durch: [
      '  app.addHook("onRequest", async (request, reply) => {',
      '    if (request.url.startsWith("/assets/") && request.headers.authorization === undefined) {',
      '      await reply.code(401).send({ error: "UNAUTHORIZED" });',
      "    }",
      "  });",
      "  // Statische Auslieferung + SPA-Fallback (Stale-Static-Fix, siehe web-static.ts).",
      "  await registerWebStatic(app, dist);",
    ].join("\n"),
    test: `${ORDNER}/statische-auslieferung-bleibt-laut.test.ts`,
    erwartet: "Der Auslieferungsaufbau in server.ts hat sich geändert",
  },
  {
    kennung: "h",
    was: "Rechteprüfung unmittelbar vor der Static-Registrierung in web-static.ts",
    datei: "services/app/src/web-static.ts",
    ersetze: ["  await app.register(fastifyStatic, {", "    root: dist,"].join("\n"),
    durch: [
      '  app.addHook("onRequest", async (request, reply) => {',
      "    if (request.headers.authorization === undefined) {",
      '      await reply.code(401).send({ error: "UNAUTHORIZED" });',
      "    }",
      "  });",
      "  await app.register(fastifyStatic, {",
      "    root: dist,",
    ].join("\n"),
    test: `${ORDNER}/statische-auslieferung-bleibt-laut.test.ts`,
    erwartet: "/assets/app.js verlangt ohne Berechtigung eine Anmeldung (Status 401)",
  },
  {
    kennung: "i",
    was: "zweite, wirklich geschützte @fastify/static-Registrierung unter /intern/",
    datei: "services/app/src/web-static.ts",
    ersetze: [
      '  app.addHook("onSend", (request, reply, payload, done) => {',
      "    const path = request.url.split(/[?#]/, 1)[0] ?? request.url;",
    ].join("\n"),
    durch: [
      "  await app.register(async (scope) => {",
      '    scope.addHook("onRequest", async (request, reply) => {',
      "      if (request.headers.authorization === undefined) {",
      '        await reply.code(401).send({ error: "UNAUTHORIZED" });',
      "      }",
      "    });",
      "    await scope.register(fastifyStatic, {",
      "      root: dist,",
      '      prefix: "/intern/",',
      "      decorateReply: false,",
      "    });",
      "  });",
      '  app.addHook("onSend", (request, reply, payload, done) => {',
      "    const path = request.url.split(/[?#]/, 1)[0] ?? request.url;",
    ].join("\n"),
    test: `${ORDNER}/statische-auslieferung-bleibt-laut.test.ts`,
    erwartet: "/intern/assets/app.js verlangt ohne Berechtigung eine Anmeldung (Status 401)",
  },
];

let kopie = "";

beforeAll(() => {
  kopie = baueProduktkopie(WURZEL);
}, 600_000);

afterAll(() => {
  if (kopie !== "") {
    rmSync(kopie, { recursive: true, force: true });
  }
});

describe("JOB 4272 · Lieferung 7 — jede Mutation am Produkt, jeder Regressionstest unverändert", () => {
  it("NULLPROBE: der ganze Ordner ist in der UNVERSTELLTEN Kopie grün — erst damit ist jede Rotfärbung unten zuzuordnen", () => {
    const ergebnis = fahreTest(kopie, ORDNER);
    const summe = zusammenzeilen(ergebnis.ausgabe).join(" · ");
    console.log(`4272-NULLPROBE → Exit ${String(ergebnis.code)} · ${summe}`);
    expect(
      ergebnis.code,
      `Die unverstellte Produktkopie ist nicht grün — dann belegt keine Verstellung unten etwas. Ausgabe:\n${ohneFarbe(ergebnis.ausgabe).slice(-4000)}`,
    ).toBe(0);
    // Ein Exit 0 ohne ausgeführte Fälle ist kein Bestehen (REGELN Abschnitt 7): die Zusammenfassung
    // muss da sein UND bestandene Dateien nennen.
    expect(summe, "Der Lauf in der Kopie hat keine Zusammenfassung geliefert").toMatch(
      /^Test Files \d+ passed \(\d+\)/,
    );
  }, 600_000);

  for (const fall of FAELLE) {
    it(`${fall.kennung}) ${fall.was} → ${fall.test.split("/").pop()} wird rot`, () => {
      const original = verstelle(kopie, fall.datei, fall.ersetze, fall.durch);
      let ergebnis: { code: number | null; ausgabe: string };
      try {
        ergebnis = fahreTest(kopie, fall.test);
      } finally {
        expect(
          zurueckgenommen(kopie, fall.datei, original),
          `Die Verstellung in ${fall.datei} liess sich nicht zurücknehmen`,
        ).toBe(true);
      }
      const sicht = ohneFarbe(ergebnis.ausgabe);
      const summe = zusammenzeilen(ergebnis.ausgabe).join(" · ");
      const belege = belegzeilen(ergebnis.ausgabe, fall.erwartet, 1);
      // Die Rundenakte liest diese Zeile: Kennung, Exit, Zusammenfassung, wörtliche Meldung.
      console.log(
        `4272-MUTATION ${fall.kennung} → Exit ${String(ergebnis.code)} · ${summe} · ${belege.join(" ⏐ ")}`,
      );
      expect(
        ergebnis.code,
        `Die Verstellung „${fall.was}" wurde ABGEBROCHEN (Zeitgrenze oder Signal) — ein Abbruch ist kein roter Fall. Ausgabe:\n${sicht.slice(-4000)}`,
      ).not.toBeNull();
      expect(
        ergebnis.code,
        `Die Verstellung „${fall.was}" hat ${fall.test} NICHT rot gemacht. Genau das ist der Befund, für den Auftrag §7 existiert — er gehört gemeldet, nicht übergangen. Ausgabe:\n${sicht.slice(-4000)}`,
      ).not.toBe(0);
      expect(
        belege,
        `${fall.test} wurde rot, aber NICHT an der zugesagten Stelle: „${fall.erwartet}" kommt in der Ausgabe nicht vor. Ein roter Lauf aus einem anderen Grund belegt die Kalibrierung nicht. Ausgabe:\n${sicht.slice(-4000)}`,
      ).not.toEqual([]);
      // Der rote Lauf muss auch WIRKLICH Fälle gefahren haben — ein Abbruch beim Sammeln wäre
      // ebenfalls „nicht 0" und belegte nichts.
      expect(
        summe,
        `Der rote Lauf zu „${fall.was}" hat keine Fallzahlen geliefert — ein Abbruch vor den fachlichen Fällen ist kein kalibrierter Fall. Ausgabe:\n${sicht.slice(-4000)}`,
      ).toMatch(/^Test Files \d+ failed/);
    }, 600_000);
  }
});
