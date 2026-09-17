// ================================================================================================
// JOB 4309 · A9 — DER ZEUGE ÜBER DEN SKIP. ER LÄUFT IM TOR, OHNE DATENBANK UND OHNE BROWSER.
// ================================================================================================
//
// PEDI WÖRTLICH (`eingang/erledigt/EINGANG-20260917-PRO-OFFICE-PG-0708.md:5`): „Erforderliche Fälle
// dürfen nicht durch Skip grün erscheinen."
//
// WARUM DIESER FALL NICHT IN DER INTEGRATIONSDATEI STEHT — und das ist der Kern: Die Zusage lautet
// „ein übersprungener Pflichtfall zählt nicht als bestanden". Stünde sie NUR in
// `a8-menue-und-migration.integration.test.ts`, wäre sie genau dann nicht messbar, wenn sie
// gebraucht wird — nämlich auf einer Maschine ohne PostgreSQL und ohne Chromium. Eine Zusicherung,
// die mit ihrem Gegenstand zusammen ausfällt, ist keine.
//
// Deshalb steht die Regel als FUNKTION in `laufzustand.ts` (DOM-frei, datenbankfrei) und hier ihr
// Fall. Er läuft im Tor bei jedem Lauf.
//
// UND ER PRÜFT ZWEITENS DIE BINDUNG: eine Regel ohne Aufrufer wäre die Fehlerklasse „gebaut,
// richtig, wirkungslos" (`tests/capture/aufrufer-waechter.test.ts`). Gelesen wird deshalb der
// Quelltext der Integrationsdatei — dass sie die Funktion wirklich ruft und dass sie ihren Grund
// wirklich auf stderr schreibt, statt still zu überspringen.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Laufzustand, befundsatz, zaehltAlsBestanden } from "./laufzustand";

const INTEGRATION = "tests/wiki-gesamtanweisung-abnahme/a8-menue-und-migration.integration.test.ts";
const QUELLE = readFileSync(INTEGRATION, "utf8");

describe("JOB 4309 A9 · ein übersprungener Pflichtfall zählt nicht als bestanden", () => {
  it("nur ein GELAUFENER Lauf zählt — Skip und fehlender Aufbau tun es ausdrücklich nicht", () => {
    const gelaufen: Laufzustand = { gelaufen: true, quelle: "localhost:5432/klarwerk_test" };
    const uebersprungen: Laufzustand = { gelaufen: false, grund: "keine gesicherte Test-URL" };
    expect(zaehltAlsBestanden(gelaufen)).toBe(true);
    expect(
      zaehltAlsBestanden(uebersprungen),
      "ein Skip gilt als bestanden — genau das verbietet Pedis Satz",
    ).toBe(false);
    expect(
      zaehltAlsBestanden(undefined),
      "ein Lauf ohne durchgelaufenen Aufbau gilt als bestanden",
    ).toBe(false);
  });

  it("jeder der drei Zustände hat einen eigenen, ausgeschriebenen Satz — keiner klingt wie Erfolg", () => {
    const marke = "PRUEFSTAND A9";
    const gelaufen = befundsatz(marke, { gelaufen: true, quelle: "host/db" });
    const uebersprungen = befundsatz(marke, { gelaufen: false, grund: "kein Docker" });
    const ohne = befundsatz(marke, undefined);
    expect(new Set([gelaufen, uebersprungen, ohne]).size, "zwei Zustände klingen gleich").toBe(3);
    for (const satz of [gelaufen, uebersprungen, ohne]) {
      expect(satz, "der Satz nennt den Prüfstand nicht").toContain(marke);
      expect(
        satz.endsWith("\n"),
        "ohne Zeilenumbruch verschmilzt der Befund mit der Nachbarzeile",
      ).toBe(true);
    }
    expect(uebersprungen, "der Grund fehlt im Skip-Satz").toContain("kein Docker");
    expect(
      uebersprungen,
      "der Skip-Satz sagt nicht, dass er nichts belegt — dann liest ihn jemand als Erfolg",
    ).toContain("NICHT belegt");
    expect(ohne, "der fehlende Aufbau wird nicht als Befund benannt").toContain("Befund");
  });

  it("die Integrationsdatei ist wirklich der Aufrufer — und sie überspringt nie still", () => {
    // Ohne diese drei Zeilen wäre die Regel oben gebaut, richtig und wirkungslos.
    expect(QUELLE, `${INTEGRATION} ruft die Regel nicht`).toContain("zaehltAlsBestanden");
    expect(QUELLE, `${INTEGRATION} schreibt keinen Befundsatz`).toContain("befundsatz(MARKE");
    expect(QUELLE, `${INTEGRATION} meldet den Grund nicht auf stderr`).toContain(
      "process.stderr.write(befundsatz(",
    );
    // JEDER `ctx.skip()` hängt an derselben Bedingung `!verfuegbar`, und `verfuegbar` wird NUR
    // gesetzt, nachdem Datenbank, Fläche und Browser wirklich stehen. Ein zweiter, freier Skip-Weg
    // wäre die Stelle, an der ein Fall still verschwände.
    const skips = QUELLE.match(/ctx\.skip\(\)/g) ?? [];
    expect(skips.length, "kein einziger Skip-Zweig — dann prüft dieser Fall nichts").toBe(2);
    for (const stelle of QUELLE.split("ctx.skip()").slice(0, -1)) {
      expect(
        stelle.slice(-400),
        "ein Skip-Zweig hängt nicht an der gemeinsamen Verfügbarkeitsbedingung",
      ).toContain("!verfuegbar");
    }
    // Und der Zeuge in der Integrationsdatei selbst ruft NIE `ctx.skip()` — er läuft immer.
    const zeuge = QUELLE.slice(QUELLE.indexOf('it("A8z'));
    expect(zeuge.length, "der Zeugenfall A8z fehlt in der Integrationsdatei").toBeGreaterThan(0);
    expect(
      zeuge,
      "der Zeuge kann selbst übersprungen werden — dann bezeugt er nichts",
    ).not.toContain("ctx.skip()");
  });
});
