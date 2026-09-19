// ================================================================================================
// JOB 4353 · R2 — FEHLENDE VORAUSSETZUNGEN, GEZIELT SIMULIERT: DIE PFLICHTABNAHME DARF NICHT GRÜN.
// ================================================================================================
//
// BEN, Runde 1, Prüflücke 6, wörtlich: „fehlende Voraussetzungen gezielt simulieren und
// sicherstellen, dass die Pflichtabnahme nicht erfolgreich endet."
//
// Diese Datei ist diese Simulation — und sie läuft IM TOR, ohne Datenbank, ohne Browser, ohne DOM.
// Das ist der Punkt: die Regel „ein übersprungener Pflichtfall ist kein bestandener" muss auch dort
// messbar sein, wo die Voraussetzungen gerade fehlen. Stünde sie nur im Prüfstand, fiele ihre
// Prüfung mit derselben Umgebung aus, gegen deren Fehlen sie schützt.
//
// JEDE ZEILE VON `pruefePflichtabnahme` HAT HIER EINEN FALL, und jeder Fall verstellt GENAU EIN
// Feld eines sonst vollständigen Protokolls. Ein Fall, der zwei Dinge gleichzeitig verstellt,
// belegt nicht, welches davon gefangen wurde.
import { describe, expect, it } from "vitest";
import type { Laufzustand } from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { type Protokoll, type Sprachbefund, pruefePflichtabnahme } from "./pflichtabnahme";
import { SOLL_WORT, SPRACHEN } from "./sollwoerter";

const GELAUFEN: Laufzustand = { gelaufen: true, quelle: "PostgreSQL auf 127.0.0.1, Chromium 149" };

/** Eine Station, wie ein geglückter Lauf sie liefert — die Wörter aus der Sollwerttabelle. */
function station(sprache: string): Sprachbefund {
  const zeile = SOLL_WORT[sprache];
  if (!zeile) {
    throw new Error(`für ${sprache} fehlt die Sollwertzeile`);
  }
  return {
    sprache,
    kurz: `kante-${sprache}`,
    kanteId: `id-${sprache}`,
    kachelnVorher: 3,
    kachelnNachher: 2,
    wortListe: zeile.aktiv,
    wortAntwort: zeile.widerrufen,
    pgVorher: "aktiv",
    pgNachher: "widerrufen",
    satz: "Dieser Eintrag wird ersetzt von einem anderen.",
    herkunft: "GESETZT",
  };
}

/** Das vollständige, glaubwürdige Protokoll. Jeder Negativfall leitet sich DARAUS ab. */
function vollstaendig(): Protokoll {
  return {
    chromium: "149.0.7827.55",
    flaeche: "gebaut in 10436 ms",
    pgFassung: "PostgreSQL 16.15",
    datenbank: "klarwerk_wbs_gruen12345678_test",
    sprachen: SPRACHEN.map(station),
  };
}

/** Ein Protokoll mit genau einer verstellten Station. */
function mitStation(sprache: string, aenderung: Partial<Sprachbefund>): Protokoll {
  const p = vollstaendig();
  p.sprachen = p.sprachen.map((s) => (s.sprache === sprache ? { ...s, ...aenderung } : s));
  return p;
}

describe("JOB 4353 · die Pflichtabnahme ist fail-closed — jede Lücke ist ein Nein", () => {
  it("P1 · das vollständige Protokoll eines geglückten Laufs ist BELEGT", () => {
    const befund = pruefePflichtabnahme(GELAUFEN, vollstaendig(), SPRACHEN);
    expect(befund.belegt, befund.grund).toBe(true);
    // Ohne diesen Fall könnte die Funktion einfach immer „nein" sagen, und alle Fälle unten wären
    // grün, ohne etwas zu prüfen.
    expect(befund.grund, "auch der Erfolgsfall nennt, WAS belegt ist").toContain("BELEGT");
    expect(befund.grund).toContain("149.0.7827.55");
  });

  // ----------------------------------------------------------------------------------------------
  // DIE FEHLENDEN VORAUSSETZUNGEN — genau der Fall, der bisher grün blieb
  // ----------------------------------------------------------------------------------------------

  it("N1 · kein Laufzustand (beforeAll lief nicht durch) → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(undefined, undefined, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("KEIN LAUFZUSTAND");
  });

  it("N2 · übersprungen, weil PostgreSQL oder Chromium fehlten → NICHT belegt", () => {
    const zustand: Laufzustand = {
      gelaufen: false,
      grund: "weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar",
    };
    const befund = pruefePflichtabnahme(zustand, undefined, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("UEBERSPRUNGEN");
    expect(befund.grund, "der Grund der Umgebung reist mit").toContain("Container-Laufzeit");
    expect(befund.grund).toContain("NICHT erbracht");
  });

  it("N3 · Voraussetzungen da, aber kein Protokoll → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(GELAUFEN, undefined, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("kein Protokoll");
  });

  // ----------------------------------------------------------------------------------------------
  // EIN PROTOKOLL, DAS SEINE EIGENEN ZUSAGEN NICHT TRÄGT
  // ----------------------------------------------------------------------------------------------

  it("N4 · Protokoll ohne Chromium-Fassung → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(GELAUFEN, { ...vollstaendig(), chromium: "" }, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("Chromium-Fassung");
  });

  it("N5 · Protokoll ohne PostgreSQL-Fassung → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(GELAUFEN, { ...vollstaendig(), pgFassung: "" }, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("PostgreSQL-Fassung");
  });

  it("N6 · gemessen gegen eine Datenbank, die kein test im Namen trägt → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(
      GELAUFEN,
      { ...vollstaendig(), datenbank: "klarwerk_produktion" },
      SPRACHEN,
    );
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("klarwerk_produktion");
  });

  it("N7 · eine zugesagte Sprache fehlt ganz → NICHT belegt", () => {
    const p = vollstaendig();
    p.sprachen = p.sprachen.filter((s) => s.sprache !== "nl");
    const befund = pruefePflichtabnahme(GELAUFEN, p, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("zugesagt");
  });

  it("N7b · dieselbe Zahl Stationen, aber eine andere Sprache → NICHT belegt", () => {
    // Eine reine Mengenprüfung liesse sich mit einer doppelten Station täuschen.
    const p = vollstaendig();
    p.sprachen = p.sprachen.map((s) => (s.sprache === "nl" ? { ...s, sprache: "fr" } : s));
    const befund = pruefePflichtabnahme(GELAUFEN, p, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("nl");
  });

  it("N8 · die Probe vor dem Widerruf meldet nicht aktiv → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(
      GELAUFEN,
      mitStation("en", { pgVorher: "widerrufen" }),
      SPRACHEN,
    );
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("en:");
    expect(befund.grund).toContain("die geltende Seite der Zusage ist nicht gemessen");
  });

  it("N8b · die Probe nach dem Widerruf meldet nicht widerrufen → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(
      GELAUFEN,
      mitStation("nl", { pgNachher: "aktiv" }),
      SPRACHEN,
    );
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("nl:");
    expect(befund.grund).toContain("die widerrufene Seite der Zusage ist nicht gemessen");
  });

  it("N8c · ein Ersatzwert statt eines Vertragswerts → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(
      GELAUFEN,
      mitStation("de", { pgVorher: "nicht gemessen" }),
      SPRACHEN,
    );
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("nicht gemessen");
  });

  it("N9 · ein gelesenes Statuswort ist leer → NICHT belegt", () => {
    const befund = pruefePflichtabnahme(GELAUFEN, mitStation("de", { wortListe: "" }), SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("leer");
  });

  it("N10 · vor und nach dem Widerruf dasselbe Wort → NICHT belegt", () => {
    const gleich = SOLL_WORT.de?.aktiv ?? "";
    const befund = pruefePflichtabnahme(
      GELAUFEN,
      mitStation("de", { wortAntwort: gleich }),
      SPRACHEN,
    );
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("nicht unterscheidbar");
  });

  it("N11 · alle Sprachen zeigen dasselbe Wort (fest verdrahtet statt übersetzt) → NICHT belegt", () => {
    const p = vollstaendig();
    const deutsch = SOLL_WORT.de;
    p.sprachen = p.sprachen.map((s) => ({
      ...s,
      wortListe: deutsch?.aktiv ?? "",
      wortAntwort: deutsch?.widerrufen ?? "",
    }));
    const befund = pruefePflichtabnahme(GELAUFEN, p, SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("kein übersetzter Text");
  });

  it("N12 · Richtungssatz oder Herkunftsetikett nicht gelesen → NICHT belegt (Kriterium 2)", () => {
    const befund = pruefePflichtabnahme(GELAUFEN, mitStation("en", { herkunft: "" }), SPRACHEN);
    expect(befund.belegt).toBe(false);
    expect(befund.grund).toContain("Kriterium 2");
  });
});
