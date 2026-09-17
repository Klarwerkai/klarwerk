// ================================================================================================
// JOB 4272 · Lieferung 4 + 6c — @fastify/static: WAS WIRD AUSGELIEFERT, UND SCHÜTZT ES JEMAND?
// ================================================================================================
//
// DIE MELDUNG: `@fastify/static` 9.1.3 trägt GHSA-83w8-p2f5-377r („route guard bypass via path
// traversal", high) und GHSA-8pvw-jcv7-9cmj („authorization bypass via non-canonical URL paths",
// moderate). BEIDE beschreiben dasselbe Muster: ein Angreifer kommt über eine nicht-kanonische
// Pfadform an einer RECHTEPRÜFUNG vorbei, die über statischen Dateien liegt.
//
// DIE BEDINGUNG IST ALSO NICHT „das Paket ist installiert", SONDERN „es gibt einen geschützten
// statischen Pfad". Genau diese Frage liess der Recherchebefund vom 16.09. offen
// (`ABHAENGIGKEITEN-SICHERHEIT.md:9`: „die Advisorybedingungen brauchen einen geschützten
// statischen Dateipfad").
//
// DIE ANTWORT, NACHGELESEN UND HIER GEHALTEN: Es gibt genau EINE Registrierung von
// `@fastify/static` im ganzen Produkt (`services/app/src/web-static.ts:109`), und sie liefert genau
// EIN Verzeichnis aus — `apps/web/dist`, die gebaute SPA (`services/app/src/server.ts:61-66`).
// Dieses Verzeichnis ist ÖFFENTLICH PER BAUART: ein Browser lädt es, bevor sich irgendjemand
// angemeldet hat. Über ihm liegt keine Rechteprüfung, die umgangen werden könnte. Vor der
// Auslieferung stehen drei Hooks (`server.ts:47-58`) — Security-Header, Kanonik-Redirect, noindex —
// und keiner davon ist eine Autorisierung.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3: WARUM DER WÄCHTER DIESER DATEI NEU GEBAUT IST — BENs BEFUND AUS RUNDE 2
// ------------------------------------------------------------------------------------------------
// Die erste Fassung zählte DATEIEN MIT `from "@fastify/static"`. BEN hat gezeigt, dass das nicht
// trägt: er hat eine ZWEITE, rechtegeschützte Registrierung IN DIESELBE Datei gesetzt (ohne
// Berechtigung 401, mit Berechtigung 200) — der Import blieb einer, der Wächter blieb grün, und die
// Bedingung der Advisory war trotzdem hergestellt. Sein Satz: „ein unveränderter Import darf die
// Mutation nicht verdecken."
//
// Deshalb misst diese Datei jetzt ZWEIMAL und an zwei verschiedenen Arten von Tatsache:
//   (1) AM QUELLTEXT die AUFRUFSTELLEN `.register(fastifyStatic` — zwei Aufrufe in einer Datei sind
//       zwei Funde (`waechter.ts::statischeRegistrierungen`);
//   (2) AM LAUFENDEN AUFBAU, was beim Registrieren wirklich geschieht: wie viele Bäume, unter
//       welchem Präfix, mit welcher Wache an welcher Route, mit welchem app-weiten Hook
//       (`waechter.ts::beobachteAuslieferung` + `schutzBefunde`).
// Beide Riegel sind in `kalibrierung.test.ts` gegen genau BENs Mutation gefahren: unverändert
// schweigen sie, verstellt reden sie. Ein Wächter, der nur am gesunden Fall lief, ist unbelegt.
//
// URTEIL: nicht exponiert, weil die Bedingung der Advisory nicht erfüllt ist. Kommt eine zweite
// Registrierung, ein Präfix oder eine Wache hinzu, wird diese Datei rot und verlangt die Einordnung
// neu. Das ist dann kein Defekt, sondern der Anlass zur Neubewertung.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerNoindexHook } from "../../services/app/src/noindex-hook";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { registerWebStatic } from "../../services/app/src/web-static";
import {
  type Beobachtung,
  type Zugangsprobe,
  assetBefund,
  auslieferungsKette,
  beobachteAuslieferung,
  ketteBefunde,
  quellen,
  schutzBefunde,
  statischeRegistrierungen,
} from "./waechter";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Der EINE app-weite Hook, den `registerWebStatic` hinzufügen darf: die Auslieferungszusage für
 * Klaras Fläche (`web-static.ts:140`, `Cache-Control: no-cache` auf `/word-addin/*`). Er ist keine
 * Autorisierung. Jeder weitere Hook ist ein Befund — denn dort könnte eine Rechteprüfung sitzen.
 */
const ERLAUBTE_HOOKS = ["onSend"] as const;

describe("JOB 4272 · @fastify/static: es gibt keinen geschützten statischen Pfad", () => {
  it("genau EINE Registrierung im ganzen Produkt — gezählt werden Aufrufstellen, nicht Importe", () => {
    const gefunden = statischeRegistrierungen(quellen(join(WURZEL, "services"))).map(
      (r) => `${r.pfad}:${r.zeile}`,
    );
    expect(
      gefunden,
      "Die Menge der @fastify/static-Registrierungen hat sich geändert. Damit ist nicht mehr belegt, dass kein geschützter statischer Pfad existiert — die Einordnung gehört neu gemacht, dieser Test NICHT angepasst.",
    ).toEqual(["app/src/web-static.ts:109"]);
  });

  it("der einzige ausgelieferte Baum ist die gebaute SPA — ohne Rechteprüfung davor", () => {
    const server = readFileSync(join(WURZEL, "services/app/src/server.ts"), "utf8");
    // Die eine Wurzel, wörtlich aus server.ts:61.
    expect(server).toContain('"../../../apps/web/dist"');
    // Und der eine Aufruf, der sie ausliefert.
    expect(server.match(/registerWebStatic\(/g) ?? []).toHaveLength(1);
  });
});

describe("JOB 4272 · 6c — die statische Auslieferung scheitert weiter LAUT", () => {
  let dir: string;
  let app: FastifyInstance;
  let beobachtung: Beobachtung;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "kw-4272-static-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>KW-SPA-MARKER</title>");
    writeFileSync(join(dir, "assets", "app.js"), "export const antwort = 42;\n");
    // Eine Datei NEBEN dem ausgelieferten Baum — Ziel jedes Traversal-Versuchs unten.
    writeFileSync(join(dir, "..", "kw-4272-geheim.txt"), "NICHT-AUSLIEFERN-4272");
    app = Fastify();
    // Derselbe Aufbau wie in Produktion — nur mitgeschrieben. Die Beobachtung trägt den
    // Lieferung-4-Fall unten; die Anfragefälle laufen auf genau dieser Instanz.
    beobachtung = await beobachteAuslieferung(app, registerWebStatic, dir);
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
    rmSync(join(dir, "..", "kw-4272-geheim.txt"), { force: true });
  });

  // ==============================================================================================
  // LIEFERUNG 4, AM LAUFENDEN AUFBAU — der Riegel, den BEN in Runde 2 gerissen hat.
  // ==============================================================================================
  it("der Aufbau stellt die Advisorybedingung nicht her: ein Baum, kein Präfix, keine Wache", () => {
    expect(
      schutzBefunde(beobachtung, ERLAUBTE_HOOKS),
      "Ein geschützter statischer Pfad ist entstanden. Die Einordnung von GHSA-83w8-p2f5-377r und GHSA-8pvw-jcv7-9cmj gehört damit neu gemacht — dieser Test NICHT angepasst.",
    ).toEqual([]);
    // Und der eine Baum ist wirklich der übergebene — keine zweite Wurzel daneben.
    expect(beobachtung.registrierungen.map((r) => r.wurzel)).toEqual([dir]);
  });

  it("eine vorhandene Datei wird ausgeliefert (die Kette lebt)", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("export const antwort");
  });

  it("REGRESSION: eine fehlende Asset-Datei → 404, nie der SPA-Fallback", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/gibt-es-nicht.js" });
    // Dieselbe Funktion, die `kalibrierung.test.ts` gegen einen Aufbau MIT SPA-Fallback auf Assets
    // fährt — dort muss sie reden, hier muss sie schweigen.
    expect(
      assetBefundVon(res),
      "Die laute 404 auf ein fehlendes Bündel ist entfallen — eine weisse Seite statt eines erkennbaren Fehlers",
    ).toBeNull();
  });

  it("ein unbekannter Navigationspfad bekommt weiter die SPA (Client-Routing bleibt)", async () => {
    const res = await app.inject({ method: "GET", url: "/konflikte/123/vergleich" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("KW-SPA-MARKER");
  });

  // ==============================================================================================
  // DIE ADVISORY SELBST, AM DRAHT PROBIERT — nicht abgeschrieben.
  // ==============================================================================================
  // Keiner dieser Pfade darf je den Inhalt NEBEN dem ausgelieferten Baum liefern. Das ist die
  // Eigenschaft, die Klarwerk unabhängig von jeder Advisory braucht; sie hier zu messen ist der
  // Unterschied zwischen „die Advisory nennt eine Bedingung" und „wir wissen, was passiert".
  it("kein Traversal-Versuch liefert eine Datei ausserhalb des Baums", async () => {
    const versuche = [
      "/../kw-4272-geheim.txt",
      "/..%2fkw-4272-geheim.txt",
      "/%2e%2e/kw-4272-geheim.txt",
      "/assets/../../kw-4272-geheim.txt",
      "/assets/..%2f..%2fkw-4272-geheim.txt",
      "/.%2e/kw-4272-geheim.txt",
      "//../kw-4272-geheim.txt",
    ];
    for (const url of versuche) {
      const res = await app.inject({ method: "GET", url });
      expect(
        res.body,
        `Traversal erfolgreich über ${url} (Status ${res.statusCode})`,
      ).not.toContain("NICHT-AUSLIEFERN-4272");
    }
  });
});

// ================================================================================================
// RUNDE 4 · LIEFERUNG 4 AM VOLLSTÄNDIGEN AUFBAU — BENs KORREKTURPFLICHT 1
// ================================================================================================
//
// WAS BEN WIDERLEGT HAT (Runde 3, Cloud-Lauf `8bbfa0116713d2ca336cc6cf`): Er hat eine Rechteprüfung
// VOR den echten `registerWebStatic`-Aufruf gehängt. Der Dateizugriff war danach nachweislich
// geschützt — ohne Kopf 401, mit Kopf 200 —, und die Wächter dieser Datei schwiegen
// (`schutzBefunde=[]`). Zwei Gründe, und beide waren echte Löcher:
//   · Der Fall oben („der einzige ausgelieferte Baum …") liest VERZEICHNISTEXT und die Zahl der
//     `registerWebStatic(`-Aufrufe. Eine davor ergänzte Prüfung ändert beides nicht.
//   · Die Hook-Beobachtung begann erst mit `beobachteAuslieferung` und sah nur `registerWebStatic`.
//     Was `server.ts` VORHER an die Instanz hängt, lag ausserhalb der Messung.
//
// DIE REPARATUR MISST DIE GANZE KETTE, an drei Tatsachen statt an einer:
//
//   (1) DIE KETTE IM QUELLTEXT. `server.ts::configureWebDelivery` ist der wirkliche Aufbau. Die
//       Funktion ist nicht exportiert und `server.ts` startet beim Import einen Server — sie ist
//       nicht aufrufbar, also wird sie GELESEN: jeder Aufruf in ihrem Rumpf, in Reihenfolge, am
//       Syntaxbaum (`waechter.ts::auslieferungsKette`). Eine vorgeschaltete Rechteprüfung ist ein
//       zusätzlicher Aufruf und fällt damit auf, egal wie sie heisst.
//   (2) DAS HOOKREGISTER DES FERTIGEN AUFBAUS, an der Instanz gelesen und nicht am Aufrufstrom
//       (`waechter.ts::hookProfil`). Ein Hook, der vor der Beobachtung registriert wurde, steht
//       dort genauso — das ist die Reparatur zu BENs zweitem Grund.
//   (3) DER ZUGRIFF OHNE BERECHTIGUNG auf JEDEN ausgelieferten Baum. Das ist die Tatsache, um die
//       es der Advisory geht: liegt eine Rechteprüfung darüber, kommt hier 401 statt der Datei.
//
// DASS DIE NACHSTELLUNG UNTEN DIE ECHTE KETTE IST, hängt an Fall (1): weicht `server.ts` davon ab,
// wird (1) rot und verlangt, BEIDES nachzuführen. Ohne diese Bindung wäre `volleKette` eine Kopie,
// die still veralten könnte.
//
// ALLE DREI SIND IN BEIDE RICHTUNGEN KALIBRIERT (REGELN Abschnitt 6), und zwar nicht gegen
// nachgebaute Hilfsfunktionen, sondern gegen ISOLIERTE PRODUKTKOPIEN mit genau dieser
// unveränderten Testdatei: `produktmutationen.test.ts`, Fälle g (Rechteprüfung in `server.ts`),
// h (Rechteprüfung in `web-static.ts`) und i (zweite, geschützte Registrierung).

/** Aus `server.ts:21` — ohne Wirkung hier, `app.inject` kommt als `localhost` herein. */
const KANONISCHER_HOST = "klarwerk.ai";

/**
 * Die Kette aus `server.ts::configureWebDelivery`, Schritt für Schritt nachgestellt.
 *
 * Gebunden an die Quelle durch den Fall „die Auslieferungskette in `server.ts` …" unten: die
 * gepinnte Aufrufreihe dort ist genau diese Reihenfolge.
 */
async function volleKette(app: FastifyInstance, dist: string): Promise<void> {
  await registerSecurityHeaders(app);
  app.addHook("onRequest", async (request, reply) => {
    if (request.hostname === `app.${KANONISCHER_HOST}`) {
      return reply.redirect(`https://${KANONISCHER_HOST}${request.url}`, 301);
    }
  });
  registerNoindexHook(app);
  await registerWebStatic(app, dist);
}

/**
 * Die Aufrufreihe, die `configureWebDelivery` heute hat — vollständig, ungefiltert.
 *
 * ABSICHTLICH NICHT auf „verdächtige" Namen eingeschränkt: ein Filter wäre genau das Loch, durch
 * das BENs Rechteprüfung gegangen ist. Wird diese Liste rot, ist NICHT notwendigerweise etwas
 * kaputt — es hat sich der Aufbau geändert, unter dem „kein geschützter statischer Pfad" gilt.
 * Dann gehört die Einordnung neu gemacht, nicht diese Liste nachgezogen.
 */
const KETTE_SERVER = [
  "registerSecurityHeaders",
  'app.addHook("onRequest")',
  "reply.redirect",
  "registerNoindexHook",
  "join",
  "dirname",
  "fileURLToPath",
  "existsSync",
  "registerWebStatic",
];

/**
 * Das Hookregister, das der vollständige Aufbau erzeugt — abgeleitet aus den vier Beiträgen:
 * `@fastify/helmet` (onRoute 1, onRequest 2), die Kanonik-Umleitung (onRequest 1),
 * `registerSecurityHeaders` (onSend 1), `registerNoindexHook` (onSend 1),
 * `registerWebStatic` (onSend 1).
 */
const HOOKPROFIL_KETTE: Readonly<Record<string, number>> = {
  onRequest: 3,
  onSend: 3,
  onRoute: 1,
};

/** Die `register`-Aufrufe, die die Kette tut — in dieser Reihenfolge und in keiner anderen. */
const PLUGINS_KETTE: readonly string[] = ["@fastify/helmet", "@fastify/static"];

describe("JOB 4272 · der VOLLSTÄNDIGE Auslieferungsaufbau trägt keine Rechteprüfung", () => {
  it("die Auslieferungskette in server.ts ist Aufruf für Aufruf die gepinnte", () => {
    const server = readFileSync(join(WURZEL, "services/app/src/server.ts"), "utf8");
    expect(
      auslieferungsKette(server, "configureWebDelivery"),
      "Der Auslieferungsaufbau in server.ts hat sich geändert. Damit ist nicht mehr belegt, dass vor der statischen Auslieferung keine Rechteprüfung steht — die Einordnung von GHSA-83w8-p2f5-377r und GHSA-8pvw-jcv7-9cmj gehört neu gemacht, dieser Test NICHT angepasst.",
    ).toEqual(KETTE_SERVER);
  });

  it("die ganze Kette gefahren: ein Baum, kein Präfix, keine Wache, kein fremder Hook — und die Datei kommt OHNE Berechtigung", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kw-4272-kette-"));
    mkdirSync(join(dir, "assets"));
    writeFileSync(join(dir, "index.html"), "<!doctype html><title>KW-KETTE</title>");
    writeFileSync(join(dir, "assets", "app.js"), "export const kette = 4272;\n");
    const app = Fastify();
    try {
      const beobachtet = await beobachteAuslieferung(app, volleKette, dir);

      // JEDEN ausgelieferten Baum ohne einen einzigen Kopf abfragen. Genau hier hat BENs Mutation
      // 401 geliefert, während die Wächter schwiegen.
      const proben: Zugangsprobe[] = [];
      for (const eintrag of beobachtet.registrierungen) {
        if (eintrag.plugin !== "@fastify/static") {
          continue;
        }
        const basis = typeof eintrag.praefix === "string" ? eintrag.praefix.replace(/\/$/, "") : "";
        const url = `${basis}/assets/app.js`;
        const res = await app.inject({ method: "GET", url });
        proben.push({
          url,
          status: res.statusCode,
          koerper: res.body,
          erwartet: "export const kette",
        });
      }

      expect(
        ketteBefunde(beobachtet, { plugins: PLUGINS_KETTE, hooks: HOOKPROFIL_KETTE }, proben),
        "Der vollständige Auslieferungsaufbau stellt die Advisorybedingung her — ein geschützter statischer Pfad ist entstanden. Einordnung neu machen, diesen Test NICHT anpassen.",
      ).toEqual([]);
    } finally {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** Die Antwortform von `app.inject` auf die Form bringen, die `assetBefund` liest. */
function assetBefundVon(res: {
  statusCode: number;
  headers: Record<string, unknown>;
  body: string;
}): string | null {
  return assetBefund(
    { statusCode: res.statusCode, headers: res.headers, body: res.body },
    "KW-SPA-MARKER",
  );
}
