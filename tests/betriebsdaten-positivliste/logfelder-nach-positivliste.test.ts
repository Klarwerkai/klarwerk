// ================================================================================================
// Aufnahme gesamt-telemetrie (R-0623) · Ben, Nacharbeit 1 — AUCH DER BETRIEBSLOGGER NACH LISTE.
// ================================================================================================
//
// Befund: „Der allgemeine Betriebslogger übernimmt weiterhin beliebige Feldnamen und Freitexte:
// senkeUeberWert kopiert sämtliche Einträge und filtert lediglich Geheimnismuster … Beispielsweise
// schreibt external-routes.ts:93 einen freien Fehlertext unter detail."
//
// Gemessen an einem echten pino über GENAU die Loggeroptionen des Produkts (`baueLoggerOptionen`):
// ungelistete Felder, ungültige Werte und freie Fehlertexte erreichen die Zeile nicht; gelistete
// Felder kommen unverändert an.
import { readFileSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { ERR_TEXT_UNTERDRUECKT, baueLoggerOptionen } from "../../services/app/src/build-app";
import type { Guards } from "../../services/app/src/http";
import { starteKlaraAufraeumen } from "../../services/app/src/klara-aufraeumen";
import {
  LOGFELDER,
  MELDUNG_NICHT_GELISTET,
  gelisteteMeldung,
  inhaltsfreieFehlerkennung,
} from "../../services/app/src/log-positivliste";
import { externalRoutes } from "../../services/app/src/routes/external-routes";
import { StartvertragError } from "../../services/app/src/start-vertrag";
import { STARTFEHLER_EREIGNIS, startfehlerZeile } from "../../services/app/src/startfehler-zeile";
import type { IntervalHandle } from "../../services/app/src/trash-sweep-scheduler";
import { InMemoryExternalKnowledgePolicyRepo } from "../../services/external-search/src/policy";
import { ExternalSearchService } from "../../services/external-search/src/service";
import { createWikipediaProvider } from "../../services/external-search/src/wikipedia";

const INHALT = "KUNDENINHALT_Befund_Anna_Meier_42";

type Zeile = Record<string, unknown>;

function mitLogger(): { app: FastifyInstance; zeilen: () => Zeile[]; roh: () => string } {
  const puffer: string[] = [];
  const app = Fastify({
    logger: baueLoggerOptionen({ senke: { write: (z) => void puffer.push(z) }, stufe: "info" }),
  });
  return {
    app,
    zeilen: () => puffer.map((z) => JSON.parse(z) as Zeile),
    roh: () => puffer.join("\n"),
  };
}

describe("R-0623 · Betriebslogfelder nur nach Positivliste", () => {
  it("L1 · ungelistete Felder fallen weg — auf jeder Ebene; gelistete kommen an", async () => {
    const { app, zeilen, roh } = mitLogger();
    app.log.warn(
      {
        event: "probe",
        koId: "ko-1",
        detail: INHALT,
        frage: INHALT,
        ka4: { entscheidung: "blockiert", grund: "kein_consent", passage: INHALT },
      },
      "ask.ka4.dokument-consent",
    );
    await app.close();

    expect(roh()).not.toContain(INHALT);
    const zeile = zeilen().find((z) => z.msg === "ask.ka4.dokument-consent");
    expect(zeile).toBeDefined();
    expect(zeile?.event).toBe("probe");
    expect(zeile?.koId).toBe("ko-1");
    expect(zeile?.ka4).toEqual({ entscheidung: "blockiert", grund: "kein_consent" });
    expect(Object.hasOwn(zeile as object, "detail")).toBe(false);
    expect(Object.hasOwn(zeile as object, "frage")).toBe(false);
  });

  it("L2 · ein gelistetes Feld mit unpassendem Wert fällt ebenfalls weg", async () => {
    const { app, zeilen } = mitLogger();
    app.log.info(
      {
        koId: "Anna Meier, Befund vom 3.4.",
        konto: "anna@example.org",
        slides: "viele",
        stelle: "x".repeat(200),
        reason: "Anna Meier",
      },
      "slides-convert",
    );
    await app.close();

    const zeile = zeilen().find((z) => z.msg === "slides-convert") as Zeile;
    for (const feld of ["koId", "konto", "slides", "stelle"]) {
      expect(Object.hasOwn(zeile, feld), feld).toBe(false);
    }
    // Ein Fehlerklassenname ausserhalb der Erlaubnisliste wird ersetzt, nicht übernommen.
    expect(zeile.reason).toBe("UNBEKANNT");
  });

  it("L3 · Fastifys Fehlerweg: der Fehlertext steht weder in der Meldung noch in einem Feld", async () => {
    const { app, zeilen, roh } = mitLogger();
    app.get("/kaputt", async () => {
      throw new Error(`duplicate key value: Key (titel)=(${INHALT}) already exists`);
    });
    const antwort = await app.inject({ method: "GET", url: "/kaputt" });
    await app.close();

    expect(antwort.statusCode).toBe(500);
    expect(roh()).not.toContain(INHALT);
    const fehlerzeile = zeilen().find((z) => z.err !== undefined);
    expect(fehlerzeile?.msg).toBe(ERR_TEXT_UNTERDRUECKT);
    // Die Auskunft bleibt — als Typ und Quelltextstelle aus dem Erlaubnislisten-Serializer.
    expect((fehlerzeile?.err as Zeile).type).toBe("Error");
  });

  it("L4 · externe Suche: statt des freien Netzfehlertexts (detail) nur die Fehlerkennung", async () => {
    const { app, roh } = mitLogger();
    const angemeldet: Guards = {
      requireUser: async () => ({ id: "u1", role: "experte" }),
      requirePermission: async () => ({ id: "u1", role: "experte" }),
    };
    await app.register(
      externalRoutes(
        {
          search: new ExternalSearchService({
            provider: createWikipediaProvider({
              fetchImpl: async () => {
                throw new TypeError(`fetch failed: getaddrinfo ENOTFOUND ${INHALT}.example`);
              },
              timeoutMs: 1_000,
            }),
          }),
          policy: new InMemoryExternalKnowledgePolicyRepo(),
        },
        angemeldet,
      ),
    );
    const antwort = await app.inject({ method: "GET", url: "/api/external/search?q=Ventil" });
    await app.close();

    expect(antwort.statusCode).toBeGreaterThanOrEqual(400);
    const geloggt = roh();
    expect(geloggt).toContain("external-search: Anfrage an den Anbieter fehlgeschlagen");
    expect(geloggt).not.toContain(INHALT);
    expect(geloggt).not.toMatch(/getaddrinfo|ENOTFOUND/);
  });

  it("L5 · die Fehlerkennung der Importwege: fester Satz oder Klassenname, nie freier Text", () => {
    expect(inhaltsfreieFehlerkennung(new Error(`kaputt bei ${INHALT}`))).toBe("Error");
    expect(inhaltsfreieFehlerkennung(new TypeError(INHALT))).toBe("TypeError");
    expect(inhaltsfreieFehlerkennung(INHALT)).toBe("unknown");
    // Der feste Satz des Confluence-Status (nur eine Statuszahl) bleibt lesbar.
    expect(inhaltsfreieFehlerkennung(new Error("Confluence-API antwortete mit 404"))).toBe(
      "Confluence-API antwortete mit 404",
    );
    const fest = new Error("Keine Leseberechtigung für diese Jira-Quelle.");
    fest.name = "JiraRequestError";
    expect(inhaltsfreieFehlerkennung(fest)).toBe(fest.message);
  });

  it("L6 · die Liste nennt keinen Inhaltsnamen", () => {
    const namen = Object.keys(LOGFELDER).map((n) => n.toLowerCase());
    for (const inhalt of [
      "detail",
      "message",
      "frage",
      "question",
      "antwort",
      "answer",
      "prompt",
      "text",
      "body",
      "title",
      "titel",
      "email",
    ]) {
      expect(namen, `Inhaltsfeld ${inhalt} auf der Liste`).not.toContain(inhalt);
    }
  });

  it("L7 · die Konsolenwege geben kein ganzes Fehlerobjekt mehr aus", () => {
    const stellen = [
      "services/conflicts/src/service.ts",
      "services/conflicts/src/overlap-service.ts",
      "services/knowledge-object/src/service.ts",
      "services/app/src/duplicate-detection.ts",
      "services/app/src/routes/library-routes.ts",
    ];
    for (const datei of stellen) {
      const quelle = readFileSync(datei, "utf8");
      expect(quelle, datei).not.toMatch(/console\.(error|warn)\(`[^`]*`,\s*(error|err)\)/);
    }
    const server = readFileSync("services/app/src/server.ts", "utf8");
    expect(server).not.toMatch(/app\.log\.warn\(`[^`]*\$\{String\(error\)\}/);
    // Nacharbeit 3: der rohe Datenbanktext des Policy-Ladefehlers steht nicht im Meldungstext.
    expect(server).not.toMatch(/konnte NICHT geladen werden \(\$\{policy\.detail/);
  });

  // ----------------------------------------------------------------------------------------------
  // Ben, Nacharbeit 3: „Der neue Logfilter lässt reine Textaufrufe unverändert passieren. Ein
  // konkreter verbleibender Weg ist klara-aufraeumen.ts:46: String(error) gelangt über server.ts:254
  // als Meldungstext in die zentrale Logausgabe."
  // ----------------------------------------------------------------------------------------------
  it("L8 · Klara-Aufräumlauf, verdrahtet wie in server.ts: der Fehlertext erreicht das Log nicht", async () => {
    const { app, zeilen, roh } = mitLogger();
    starteKlaraAufraeumen({
      lauf: () => Promise.reject(new Error(`duplicate key: Key (email)=(${INHALT}@example.org)`)),
      intervalMs: 60_000,
      // Dieselbe Verdrahtung wie `server.ts` (`starteKlaraAufraeumen({ … log: … })`).
      log: { info: (t) => app.log.info(t), warn: (felder, t) => app.log.warn(felder, t) },
      setIntervalFn: () => 1 as unknown as IntervalHandle,
      clearIntervalFn: () => undefined,
    });
    for (let takt = 0; takt < 5; takt += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
    await app.close();

    expect(roh()).not.toContain(INHALT);
    const zeile = zeilen().find((z) => z.msg === "Klara-Aufräumlauf (Start) übersprungen");
    expect(zeile, "die Warnung des Aufräumlaufs fehlt").toBeDefined();
    // Die Ursache bleibt nachvollziehbar — als Typ und Quelltextstelle, nicht als Text.
    expect((zeile?.err as Zeile).type).toBe("Error");
    expect((zeile?.err as Zeile).message).toBe(ERR_TEXT_UNTERDRUECKT);
  });

  // ----------------------------------------------------------------------------------------------
  // Ben, Nacharbeit 4: „begrenzteMeldung übernimmt jede erste Zeile ohne das Muster „…Error: “
  // unverändert. Beispielsweise würde app.log.warn('Befund: Anna Meier') weiterhin Kundeninhalt
  // ausgeben. Dasselbe gilt für Meldungsargumente neben einem Feldobjekt."
  // ----------------------------------------------------------------------------------------------
  it("L9 · Meldungen nur nach Vorlagenliste — auch einzeiliger Kundeninhalt ohne Error-Präfix fällt weg", async () => {
    const { app, zeilen, roh } = mitLogger();
    // Einzeiliger Kundeninhalt ohne jedes Fehlermuster — als reiner Text und neben einem Feldobjekt.
    app.log.warn("Befund: Anna Meier");
    app.log.warn(`Befund: ${INHALT}`);
    app.log.warn({ event: "probe" }, `Befund: ${INHALT}`);
    // Eingebetteter Fehlertext, Folgezeile, Formatwert.
    app.log.warn(`Lauf übersprungen: ${String(new TypeError(`kaputt bei ${INHALT}`))}`);
    app.log.warn(`Lauf übersprungen\n    at geheim (${INHALT}.ts:1:1)`);
    app.log.info("Formatprobe %s", INHALT);
    // Eine gelistete Vorlage, deren Platzhalter einen Wert ausserhalb seiner Regel trägt.
    app.log.info(`Bestandsabfrage gescheitert: ${INHALT} von Anna Meier`);
    // Gelistete Vorlagen mit regelgerechten Werten bleiben unverändert.
    app.log.info("KLARWERK läuft auf :3000 — Datenhaltung: Postgres");
    app.log.info("Klara-Sitzungen aufgeräumt (Start): 2 entfernt.");
    app.log.warn({ err: new Error(INHALT) }, "Bestandsabfrage gescheitert: wissensobjekte");
    await app.close();

    const geloggt = roh();
    expect(geloggt).not.toContain(INHALT);
    expect(geloggt).not.toContain("Anna Meier");
    const meldungen = zeilen().map((z) => z.msg);
    expect(meldungen.filter((m) => m === MELDUNG_NICHT_GELISTET)).toHaveLength(7);
    expect(meldungen).toContain("KLARWERK läuft auf :3000 — Datenhaltung: Postgres");
    expect(meldungen).toContain("Klara-Sitzungen aufgeräumt (Start): 2 entfernt.");
    expect(meldungen).toContain("Bestandsabfrage gescheitert: wissensobjekte");
    // Die Feldliste wirkt daneben unverändert.
    expect(zeilen().find((z) => z.event === "probe")?.msg).toBe(MELDUNG_NICHT_GELISTET);
    expect(gelisteteMeldung("Befund: Anna Meier")).toBe(MELDUNG_NICHT_GELISTET);
    // Über „Hauptstand integriert" hinzugekommene Sätze aus server.ts stehen auf der Liste.
    for (const satz of [
      "Wissensereignis-Abgleich übersprungen",
      "Wissensereignis-Meldungen aktiv — 2 Ziel(e), Takt 60 s.",
      "Lückenerkennung über den Reasoner aktiv — Takt 15 min.",
    ]) {
      expect(gelisteteMeldung(satz), satz).toBe(satz);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // Ben, Nacharbeit 5: „Der Fehlerweg beim Serverstart schreibt weiterhin String(error) ungefiltert
  // auf stderr … Die neue Loggerabsicherung greift hier nicht."
  // ----------------------------------------------------------------------------------------------
  it("L10 · Startfehler: Kundeninhalt in Meldung und Stack erreicht die stderr-Zeile nicht", () => {
    const fehler = new Error(`duplicate key value: Key (email)=(${INHALT}@example.org) exists`);
    (fehler as Error & { code: string }).code = "23505";
    fehler.stack = `Error: ${fehler.message}\n    at migrate (/srv/klarwerk/services/app/src/db.ts:12:7)`;
    const zeile = startfehlerZeile(fehler);

    expect(zeile).not.toContain(INHALT);
    expect(zeile).not.toContain("duplicate key");
    expect(zeile).not.toMatch(/[\r\n]/);
    expect(zeile.startsWith(`${STARTFEHLER_EREIGNIS} Error `)).toBe(true);
    // Die freigegebenen Kennungen bleiben: Typ, Code aus der Liste, Quelltextstelle.
    expect(zeile).toContain("code 23505");
    expect(zeile).toContain("herkunft services/app/src/db.ts:12:7");
    expect(zeile).toContain(ERR_TEXT_UNTERDRUECKT);

    // Ein unbekannter Typ, ein unbekannter Code, kein Error-Objekt: jeweils der stabile Ersatz.
    const fremd = new Error(INHALT);
    fremd.name = `Anna Meier ${INHALT}`;
    (fremd as Error & { code: string }).code = `CODE_${INHALT}`;
    expect(startfehlerZeile(fremd)).not.toContain(INHALT);
    expect(startfehlerZeile(fremd)).toContain("UNBEKANNT");
    expect(startfehlerZeile(`Befund ${INHALT}`)).not.toContain(INHALT);
  });

  it("L11 · Startvertrag: alle fehlenden Namen stehen weiter in der einen Zeile — nur Namen", () => {
    const zeile = startfehlerZeile(
      new StartvertragError(["DATABASE_URL", "APP_BASE_URL", `kein Name ${INHALT}`]),
    );
    expect(zeile.startsWith(`${STARTFEHLER_EREIGNIS} StartvertragError: `)).toBe(true);
    expect(zeile).toContain("DATABASE_URL, APP_BASE_URL");
    expect(zeile).toContain("Pflichtwert(e)");
    expect(zeile).not.toContain(INHALT);
  });

  it("L12 · server.ts schreibt den Startfehler nur über die begrenzte Zeile", () => {
    const server = readFileSync("services/app/src/server.ts", "utf8");
    // Der Fänger selbst steht auf Modulebene am Zeilenanfang; Kommentare nennen ihn nur.
    const anfang = server.indexOf("\nstart().catch((error) => {");
    expect(anfang, "der Fänger start().catch fehlt in server.ts").toBeGreaterThan(-1);
    const faenger = server.slice(anfang);
    expect(faenger).toMatch(/process\.stderr\.write\(`\$\{startfehlerZeile\(error\)\}\\n`\);/);
    expect(faenger).not.toMatch(/String\(error\)|error\.message|error\.stack/);
  });
});
