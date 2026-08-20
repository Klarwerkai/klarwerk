// A28 — das dauerhafte Signal am eigenen Wissensobjekt.
//
// Die Tests prüfen drei Dinge, und der mittlere ist der wichtige:
//   1. das Signal entsteht am eigenen Objekt und nennt die Art,
//   2. die GESPERRTE Richtung („ein fremdes Objekt dupliziert meines") entsteht NICHT,
//   3. die Gegenseite taucht nirgends auf — weder als Kennung noch sonst.
import { describe, expect, it } from "vitest";
import {
  A28_SIGNAL_GRENZE,
  type BefundPaar,
  befundFuerEigenesKo,
  eigeneBefunde,
} from "./duplicate-signal";

// koA = eingereichtes Subjekt, koB = vorgefundener Kandidat
// (overlap-service.ts:358, conflicts/src/service.ts:387).
const paar = (koA: string, koB: string): BefundPaar => ({ koA, koB });

const MEINE = ["ko-mein-1", "ko-mein-2"];

describe("A28 · Signal am eigenen Objekt", () => {
  it("P-1 · mein Einreichen fand eine Dublette → Signal an meinem Objekt, Art benannt", () => {
    const befunde = eigeneBefunde(MEINE, [paar("ko-mein-1", "ko-fremd-9")], []);
    expect(befunde).toEqual([{ koId: "ko-mein-1", dublette: true, konflikt: false }]);
  });

  it("P-2 · mein Einreichen fand einen Konflikt → Art ist Konflikt, nicht Dublette", () => {
    const befunde = eigeneBefunde(MEINE, [], [paar("ko-mein-1", "ko-fremd-9")]);
    expect(befunde).toEqual([{ koId: "ko-mein-1", dublette: false, konflikt: true }]);
  });

  it("P-3 · beides am selben Objekt → beide Arten stehen an EINEM Eintrag", () => {
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9")],
      [paar("ko-mein-1", "ko-fremd-8")],
    );
    expect(befunde).toEqual([{ koId: "ko-mein-1", dublette: true, konflikt: true }]);
  });

  it("P-4 · mehrere offene Befunde am selben Objekt bleiben EIN Signal", () => {
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9"), paar("ko-mein-1", "ko-fremd-8")],
      [],
    );
    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.dublette).toBe(true);
  });

  it("P-5 · beide Seiten gehören mir → beide eigenen Objekte tragen das Signal", () => {
    // Kein fremder Bestand im Spiel: der Autor kennt beide Objekte, es entsteht keine Auskunft.
    const befunde = eigeneBefunde(MEINE, [paar("ko-mein-1", "ko-mein-2")], []);
    expect(befunde.map((b) => b.koId).sort()).toEqual(["ko-mein-1", "ko-mein-2"]);
    expect(befunde.every((b) => b.dublette)).toBe(true);
  });

  it("P-6 · Einzelabfrage liefert den Befund des eigenen Objekts", () => {
    const befund = befundFuerEigenesKo("ko-mein-1", MEINE, [paar("ko-mein-1", "ko-fremd-9")], []);
    expect(befund).toEqual({ koId: "ko-mein-1", dublette: true, konflikt: false });
  });
});

describe('A28 · die GESPERRTE Richtung — „ein fremdes Objekt dupliziert meines"', () => {
  it("N-1 · fremdes Subjekt trifft mein Objekt → KEIN Signal", () => {
    // Das ist der Fall, den A28 ausdrücklich Pedi vorbehält (bens n=1-Einwand). Entstünde hier ein
    // Signal, erführe der Autor NACHTRÄGLICH von fremdem Bestand, den er vorher nicht kannte.
    const befunde = eigeneBefunde(MEINE, [paar("ko-fremd-9", "ko-mein-1")], []);
    expect(befunde).toEqual([]);
  });

  it("N-2 · dasselbe für Konflikte → KEIN Signal", () => {
    const befunde = eigeneBefunde(MEINE, [], [paar("ko-fremd-9", "ko-mein-1")]);
    expect(befunde).toEqual([]);
  });

  it("N-3 · die Sperre ist als Zusicherung hinterlegt, nicht nur als Verhalten", () => {
    expect(A28_SIGNAL_GRENZE.fremdesDupliziertMeines).toBe(false);
  });

  it("N-4 · gemischtes Paar: nur die erlaubte Richtung erzeugt ein Signal", () => {
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9"), paar("ko-fremd-7", "ko-mein-2")],
      [],
    );
    expect(befunde).toEqual([{ koId: "ko-mein-1", dublette: true, konflikt: false }]);
  });

  it("N-5 · rein fremdes Paar → KEIN Signal", () => {
    expect(eigeneBefunde(MEINE, [paar("ko-fremd-9", "ko-fremd-8")], [])).toEqual([]);
  });

  it("N-6 · ohne eigene Objekte gibt es kein Signal", () => {
    expect(eigeneBefunde([], [paar("ko-mein-1", "ko-fremd-9")], [])).toEqual([]);
  });

  it("N-7 · eine leere Kennung ist KEINE Autorschaft", () => {
    // Sonst fiele ein Altobjekt ohne Kennung mit einem leeren koA zusammen und wiese ein fremdes
    // Paar als eigenes aus — dieselbe Vorsicht wie in darfSehen (sichtbarkeit.ts:74-76).
    expect(eigeneBefunde([""], [paar("", "ko-fremd-9")], [])).toEqual([]);
  });
});

describe("A28 · die Grenze: Vorhandensein und Art, nie die Gegenseite", () => {
  it("G-1 · der Befund trägt genau drei Felder — keines davon ist die Gegenseite", () => {
    const befunde = eigeneBefunde(MEINE, [paar("ko-mein-1", "ko-fremd-9")], []);
    expect(Object.keys(befunde[0] ?? {}).sort()).toEqual(["dublette", "koId", "konflikt"]);
  });

  it("G-2 · die Kennung der Gegenseite steht in der gesamten Ausgabe nirgends", () => {
    // Der schärfste Griff: die Ausgabe wird verschriftet und nach der fremden Kennung durchsucht.
    // Ein künftiges Zusatzfeld, das die Gegenseite mitschleppt, fällt hier auf.
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9")],
      [paar("ko-mein-2", "ko-fremd-8")],
    );
    expect(JSON.stringify(befunde)).not.toContain("ko-fremd-9");
    expect(JSON.stringify(befunde)).not.toContain("ko-fremd-8");
  });

  it('G-3 · ohne Befund kein Eintrag — „kein Befund" ist nicht „Befund mit zwei Neins"', () => {
    expect(eigeneBefunde(MEINE, [], [])).toEqual([]);
    expect(befundFuerEigenesKo("ko-mein-1", MEINE, [], [])).toBeNull();
  });

  it("G-4 · die Zusicherungen der Grenze sind vollständig hinterlegt", () => {
    expect(A28_SIGNAL_GRENZE).toEqual({
      nenntVorhandensein: true,
      nenntArt: true,
      nenntGegenseite: false,
      nenntInhalt: false,
      fremdesDupliziertMeines: false,
    });
  });
});
