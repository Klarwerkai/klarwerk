// ================================================================================================
// JOB 4154 · JEDER FEHLER DIESES PAKETS STEHT AUF DER LOGLISTE — GEPRÜFT, NICHT BEHAUPTET.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI VERURSACHT HAT, kam aus dem Gesamttor und nicht aus einer Vermutung:
// der erste Entwurf trug eine eigene Fehlerklasse `AnweisungError` und einen eigenen Code
// `VALIDATION`. `services/app/src/build-app.test.ts:673-736` hat beides gemeldet — jede
// `class …Error extends` und jeder Domänencode aus `services/**` muss in
// `ERLAUBTE_FEHLERTYPEN`/`ERLAUBTE_FEHLERCODES` (`build-app.ts:1339`, `:1422`) stehen, sonst
// erscheint er im Protokoll als `UNBEKANNT` und die Betriebsauskunft ist weg.
//
// Beide Listen wohnen in `services/app/src/build-app.ts`. Die Datei ist in diesem Durchgang
// gesperrt (JOB 4151 und der Nachfolger WIKI-GESAMTANWEISUNG-ANSCHLUSS halten sie). Die Lösung war
// deshalb NICHT, dem Wächter auszuweichen, sondern innerhalb des Bestands zu bleiben: vier Codes,
// die es alle schon gibt, und ein gewöhnlicher `Error` statt einer neuen Klasse.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESE DATEI TROTZDEM NÖTIG IST
// ------------------------------------------------------------------------------------------------
// Der Sammler in `build-app.test.ts` kennt drei Setzformen (`new …Error("CODE"`, `code: "CODE"`,
// `code = "CODE"`). Eine Fabrik, die den Code als PARAMETER bekommt, fällt durch alle drei —
// nicht, weil sie etwas verbirgt, sondern weil der Code dort gar nicht als Literal steht.
//
// Das heisst: der Bestandswächter deckt dieses Paket nicht mehr. Statt sich darauf auszuruhen,
// prüft diese Datei dieselbe Zusage direkt und schärfer: sie liest die ECHTEN Listen aus
// `build-app.ts` und hält JEDEN Code dieses Gegenstands dagegen. Käme morgen ein fünfter Code
// dazu, wäre dieser Fall rot — und zwar bevor jemand ihn im Betrieb als `UNBEKANNT` liest.
import { describe, expect, it } from "vitest";
import { ERLAUBTE_FEHLERCODES, ERLAUBTE_FEHLERTYPEN } from "../../services/app/src/build-app";
import {
  type AnweisungFehlerCode,
  anweisungFehler,
} from "../../services/knowledge-object/src/gesamtanweisung-types";

/**
 * Die vier Codes dieses Gegenstands — die ERWARTUNG, und sie wohnt hier.
 *
 * R2: Sie stand zuerst als Laufzeitliste im Produkt und war dort ein Export ohne Aufrufer
 * (`tests/capture/aufrufer-waechter.test.ts`). Das Produkt braucht keine Liste — der Compiler hält
 * `AnweisungFehlerCode`, und der Typ hier bindet diese Zeilen an ihn: schreibt jemand einen
 * fünften Code in den Typ, ist diese Liste unvollständig, und der letzte Fall unten meldet ihn.
 */
const ERWARTETE_CODES: readonly AnweisungFehlerCode[] = [
  "NOT_FOUND",
  "FORBIDDEN",
  "CONFLICT",
  "INVALID",
];

describe("JOB 4154 · die Fehler dieses Pakets erscheinen nie als UNBEKANNT", () => {
  it("jeder Code steht auf `ERLAUBTE_FEHLERCODES` — alle vier sind Bestandsworte", () => {
    const fehlen = ERWARTETE_CODES.filter((c) => !ERLAUBTE_FEHLERCODES.has(c));
    expect(
      fehlen,
      `Diese Codes stehen nicht auf der Logliste in services/app/src/build-app.ts: ${fehlen.join(", ")}. Entweder einen vorhandenen Code nehmen — oder den neuen im selben Zug dort eintragen.`,
    ).toEqual([]);
  });

  it("der geworfene Fehlertyp heisst `Error` und steht auf `ERLAUBTE_FEHLERTYPEN`", () => {
    const fehler = anweisungFehler("CONFLICT", "Beispiel");
    expect(fehler.name).toBe("Error");
    expect(ERLAUBTE_FEHLERTYPEN.has(fehler.name)).toBe(true);
  });

  it("die Fabrik trägt Code und Stand wirklich am Fehler — sonst prüfte der Fall nichts", () => {
    const ohneStand = anweisungFehler("NOT_FOUND", "Gibt es nicht.");
    expect(ohneStand.code).toBe("NOT_FOUND");
    expect(ohneStand.aktuell).toBeNull();
    expect(ohneStand).toBeInstanceOf(Error);
    expect(ohneStand.message).toBe("Gibt es nicht.");

    const mitStand = anweisungFehler("CONFLICT", "Zwischenzeitlich geändert.", {
      stand: "vorgelegt",
      version: 7,
    });
    expect(mitStand.aktuell).toEqual({ stand: "vorgelegt", version: 7 });
  });

  it("der Code steht am Fehler, wo `sendError` ihn liest — ohne Hilfsprädikat", () => {
    // R2: hier stand ein `istAnweisungFehler`. Es ist entfernt, weil es im Produkt keinen Aufrufer
    // hatte (`tests/capture/aufrufer-waechter.test.ts`) — und es wird auch nicht gebraucht:
    // `sendError` (`services/app/src/http.ts:130`) fragt genau so, wie dieser Fall es tut.
    const eigener: unknown = anweisungFehler("FORBIDDEN", "Nein.");
    expect(eigener).toBeInstanceOf(Error);
    expect((eigener as { code?: unknown }).code).toBe("FORBIDDEN");

    // Ein fremder Fehler trägt dieses Feld nicht — daran unterscheidet die Route die beiden.
    const fremder: unknown = new Error("irgendwas");
    expect((fremder as { code?: unknown }).code).toBeUndefined();
  });

  it("die Liste der vier Codes ist vollständig — kein fünfter schleicht sich vorbei", () => {
    // Der Gegenhalt zur Liste: der Quelltext wirft wirklich nur diese vier. Gesucht wird die
    // Aufrufform der Fabrik, nicht die drei Formen des Bestandswächters.
    const { readFileSync, readdirSync } = require("node:fs") as typeof import("node:fs");
    const gefunden = new Set<string>();
    for (const ordner of ["services/knowledge-object/src", "services/app/src/routes"]) {
      for (const name of readdirSync(ordner)) {
        if (!name.startsWith("gesamtanweisung") || !name.endsWith(".ts")) {
          continue;
        }
        const quelle = readFileSync(`${ordner}/${name}`, "utf8");
        for (const m of quelle.matchAll(/anweisungFehler\(\s*"([A-Z_]{2,})"/g)) {
          if (m[1]) {
            gefunden.add(m[1]);
          }
        }
      }
    }
    expect(
      gefunden.size,
      "der Sammler findet nichts — dann prüft dieser Fall auch nichts",
    ).toBeGreaterThan(3);
    const unbekannt = [...gefunden].filter(
      (c) => !(ERWARTETE_CODES as readonly string[]).includes(c),
    );
    expect(unbekannt, `geworfen, aber nicht in ERWARTETE_CODES: ${unbekannt.join(", ")}`).toEqual(
      [],
    );
  });
});
