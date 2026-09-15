// ================================================================================================
// JOB 4012 · RED-FIRST — EIN UPDATE, DAS NICHT HOCHKOMMT, DARF DEN KUNDEN NICHT SO ZURUECKLASSEN.
// ================================================================================================
//
// DER AUSGANGSFEHLER, gemessen am Bestand vor dieser Runde: `build-current-release.mjs:216-228`
// wartet sechzig Sekunden auf `/health`, schreibt dann `healthcheck fehlgeschlagen; previous=…`
// und endet mit 1. `current` zeigt zu diesem Zeitpunkt bereits auf das kaputte Release, der alte
// Server ist tot, und der Rueckweg steht als Abtippanleitung in `ROLLBACK.md`. Diese Datei war auf
// jenem Stand rot, weil es `update-einspielen.sh` gar nicht gab.
//
// WAS SIE MISST: dass der Rueckfall AUTOMATISCH laeuft, dass danach wirklich die Vorversion
// antwortet (nicht nur ein Satz behauptet es), und dass der Weg mit einem Code ungleich 0 endet.
// Das „nicht nur ein Satz" ist der Kern — die Zusage wird an `/health` abgelesen, nicht am Text.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  aktivesRelease,
  fahreRueckfall,
  fahreUpdate,
  feldAus,
  gesundheit,
  legeInselAn,
  legeJournalAn,
  legePaketAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
  standtext,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Der Ausgangszustand jeder Probe: eine laufende Vorversion 1.0.0 und ein Journal mit Daten. */
async function inselMitVorversion(): Promise<Insel> {
  const neue = await legeInselAn();
  schreibeRelease(neue.releases, { name: ALT, appVersion: "1.0.0" });
  setzeCurrent(neue, ALT);
  legeJournalAn(neue);
  return neue;
}

describe("JOB 4012 · rotes Release — der Rueckfall laeuft von selbst", () => {
  it("R1 · /health bleibt rot: Vorversion laeuft wieder, Exit ungleich 0", async () => {
    insel = await inselMitVorversion();
    const kaputt = legePaketAn(insel, { name: NEU, appVersion: "1.1.0", gesundheit: "rot" });

    const lauf = fahreUpdate(insel, kaputt);

    expect(lauf.code, lauf.ausgabe).not.toBe(0);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft wieder, Grund: health");
    expect(aktivesRelease(insel)).toBe(ALT);

    const stand = await gesundheit(insel);
    expect(stand?.code, "die Vorversion muss wirklich antworten, nicht nur behauptet werden").toBe(
      200,
    );
    expect(stand?.version).toBe("1.0.0");
  });

  it("R2 · der Start scheitert ganz: derselbe Weg, dieselbe Ergebniszeile", async () => {
    insel = await inselMitVorversion();
    const tot = legePaketAn(insel, { name: NEU, appVersion: "1.1.0", gesundheit: "tot" });

    const lauf = fahreUpdate(insel, tot);

    expect(lauf.code, lauf.ausgabe).toBe(7);
    expect(lauf.ergebnis).toContain("Vorversion 1.0.0 läuft wieder");
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("R3 · gruener Health, aber die falsche Version: kein „aktiv“, sondern zurueck", async () => {
    insel = await inselMitVorversion();
    // Der haeufigste stille Fehlschlag der Insel: der alte Prozess haelt den Port, das neue
    // Release ist gar nicht angelaufen. `/health` ist gruen — und sagt trotzdem die alte Fassung.
    const falsch = legePaketAn(insel, {
      name: NEU,
      appVersion: "1.1.0",
      meldeVersion: "1.0.0",
    });

    const lauf = fahreUpdate(insel, falsch);

    expect(lauf.code, lauf.ausgabe).toBe(8);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft wieder, Grund: version");
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("R4 · der Stand neben den Daten bleibt beim neuen Release — unbestaetigt, nicht verschwiegen", async () => {
    insel = await inselMitVorversion();
    const kaputt = legePaketAn(insel, {
      name: NEU,
      appVersion: "1.1.0",
      stufen: [
        { stufe: "AUTH_SCHEMA", risiko: "ADDITIV" },
        { stufe: "KO_SCHEMA", risiko: "ADDITIV" },
        { stufe: "NEUE_STUFE", risiko: "ADDITIV" },
      ],
      gesundheit: "rot",
    });

    fahreUpdate(insel, kaputt);

    // `migrate()` KANN gelaufen sein, bevor der Health-Check rot wurde. Wuerde der Stand das
    // verschweigen, liefe ein spaeteres Update der alten Fassung als harmlos durch — genau der
    // Downgrade, den der Vertrag verhindern soll.
    const stand = standtext(insel);
    expect(feldAus(stand, "stufen")).toContain("NEUE_STUFE");
    expect(feldAus(stand, "bestaetigt")).toBe("nein");
  });

  it("R5 · ohne Vorversion wird nichts behauptet, was es nicht gibt", async () => {
    insel = await legeInselAn();
    const kaputt = legePaketAn(insel, { name: NEU, appVersion: "1.1.0", gesundheit: "rot" });

    const lauf = fahreUpdate(insel, kaputt);

    expect(lauf.code, lauf.ausgabe).toBe(7);
    expect(lauf.ergebnis).toBe("Update abgebrochen, keine Vorversion vorhanden, Grund: health");
  });
});

describe("JOB 4012 · rueckfall.sh von Hand — derselbe Weg, jederzeit", () => {
  it("R6 · ohne Argument faellt er auf die zuletzt aktive Fassung zurueck", async () => {
    insel = await inselMitVorversion();

    const update = fahreUpdate(insel, legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }));
    expect(update.code, update.ausgabe).toBe(0);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");

    const zurueck = fahreRueckfall(insel);

    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(zurueck.ergebnis).toBe("Vorversion 1.0.0 aktiv");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect((await gesundheit(insel))?.version).toBe("1.0.0");
  });

  it("R7 · mit Releasenamen schaltet er genau dorthin", async () => {
    insel = await inselMitVorversion();
    const update = fahreUpdate(insel, legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }));
    expect(update.code, update.ausgabe).toBe(0);

    const zurueck = fahreRueckfall(insel, [ALT]);

    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("R8 · gibt es keine Vorversion, sagt er das und schaltet nichts", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0" });
    setzeCurrent(insel, ALT);

    const zurueck = fahreRueckfall(insel);

    expect(zurueck.code, zurueck.ausgabe).toBe(6);
    expect(zurueck.ergebnis).toBe("Rückfall gescheitert, Grund: keine Vorversion vorhanden");
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("R9 · --daten-zurueck spielt die Journalsicherung ein und sichert den bisherigen Stand davor", async () => {
    insel = await inselMitVorversion();
    const journal = legeJournalAn(insel, 2);

    const update = fahreUpdate(insel, legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }));
    expect(update.code, update.ausgabe).toBe(0);
    const sicherung = /Update auf 1\.1\.0 aktiv, Sicherung (.+)$/.exec(update.ergebnis)?.[1] ?? "";
    expect(existsSync(sicherung), update.ergebnis).toBe(true);

    // Der Betrieb schreibt weiter — genau das, was ein Ruecklauf ueberschreibt.
    const spaeter = `${readFileSync(journal, "utf8")}{"nr":99,"wert":"spaeter"}\n`;
    writeFileSync(journal, spaeter);

    const zurueck = fahreRueckfall(insel, ["--daten-zurueck", sicherung]);

    expect(zurueck.code, zurueck.ausgabe).toBe(0);
    expect(readFileSync(journal, "utf8")).toBe(readFileSync(sicherung, "utf8"));
    const vorher = /gesichert: (.+)$/m.exec(zurueck.ausgabe)?.[1] ?? "";
    expect(existsSync(vorher), "der ueberschriebene Stand muss vorher gesichert sein").toBe(true);
    expect(readFileSync(vorher, "utf8")).toBe(spaeter);
  });

  it("R10 · eine unbekannte Sicherungsart wird abgelehnt, nicht geraten", async () => {
    insel = await inselMitVorversion();
    const update = fahreUpdate(insel, legePaketAn(insel, { name: NEU, appVersion: "1.1.0" }));
    expect(update.code, update.ausgabe).toBe(0);

    const fremd = join(insel.wurzel, "backups", "irgendetwas.tar");
    writeFileSync(fremd, "kein Dump und kein Journal");

    const zurueck = fahreRueckfall(insel, ["--daten-zurueck", fremd]);

    expect(zurueck.code, zurueck.ausgabe).toBe(9);
    expect(zurueck.ergebnis).toContain("unbekannte Sicherungsart");
  });
});
