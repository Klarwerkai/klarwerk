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
import {
  ERR_TEXT_UNTERDRUECKT,
  baueLoggerOptionen,
  begrenzteMeldung,
} from "../../services/app/src/build-app";
import type { Guards } from "../../services/app/src/http";
import { starteKlaraAufraeumen } from "../../services/app/src/klara-aufraeumen";
import { LOGFELDER, inhaltsfreieFehlerkennung } from "../../services/app/src/log-positivliste";
import { externalRoutes } from "../../services/app/src/routes/external-routes";
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
      "probe-zeile",
    );
    await app.close();

    expect(roh()).not.toContain(INHALT);
    const zeile = zeilen().find((z) => z.msg === "probe-zeile");
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
      "werte-probe",
    );
    await app.close();

    const zeile = zeilen().find((z) => z.msg === "werte-probe") as Zeile;
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

  it("L9 · reine Textaufrufe: eingebetteter Fehlertext, Folgezeilen und Formatwerte fallen weg", async () => {
    const { app, zeilen, roh } = mitLogger();
    app.log.warn(`Lauf übersprungen: ${String(new TypeError(`kaputt bei ${INHALT}`))}`);
    app.log.warn(`Lauf übersprungen\n    at geheim (${INHALT}.ts:1:1)`);
    app.log.info("Formatprobe %s", INHALT);
    app.log.info("KLARWERK läuft auf :3000 — Datenhaltung: Postgres");
    await app.close();

    expect(roh()).not.toContain(INHALT);
    const meldungen = zeilen().map((z) => z.msg);
    expect(meldungen).toContain(`Lauf übersprungen: ${ERR_TEXT_UNTERDRUECKT}`);
    expect(meldungen).toContain("Lauf übersprungen");
    // Ein gewöhnlicher Betriebssatz bleibt unverändert.
    expect(meldungen).toContain("KLARWERK läuft auf :3000 — Datenhaltung: Postgres");
    expect(begrenzteMeldung("Bestandsabfrage gescheitert: wissensobjekte")).toBe(
      "Bestandsabfrage gescheitert: wissensobjekte",
    );
  });
});
