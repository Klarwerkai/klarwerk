// A28 — das dauerhafte Signal am eigenen Wissensobjekt.
//
// Die Tests prüfen drei Dinge, und der mittlere ist der wichtige:
//   1. das Signal entsteht am eigenen Objekt und nennt die Art,
//   2. die GESPERRTE Richtung („ein fremdes Objekt dupliziert meines") entsteht NICHT,
//   3. die Gegenseite taucht nirgends auf — weder als Kennung noch sonst.
//
// JOB 3032 (N5): der Befund trägt seit diesem Auftrag ein VIERTES Feld — die Deckungslage des
// Laufs, der DIESES eigene Objekt angesehen hat. Die Fälle hier prüfen weiterhin den Kern, und der
// Kern entscheidet über Prüfläufe NICHTS (Grenze 4): er bekommt die fertige Lage hereingereicht.
// Wo diese Lage ENTSTEHT und dass sie mit der Bestandsauswertung übereinstimmt, prüft
// `tests/eigenes-signal/n5-deckung-am-eigenen-objekt.test.ts`.
import { describe, expect, it } from "vitest";
import {
  A28_SIGNAL_GRENZE,
  type BefundPaar,
  type Deckung,
  befundFuerEigenesKo,
  eigeneBefunde,
} from "./duplicate-signal";

// koA = eingereichtes Subjekt, koB = vorgefundener Kandidat
// (overlap-service.ts:358, conflicts/src/service.ts:387).
const paar = (koA: string, koB: string): BefundPaar => ({ koA, koB });

const MEINE = ["ko-mein-1", "ko-mein-2"];

/**
 * Die Lage, die entsteht, wenn der Aufrufer zu einer Kennung nichts hereinreicht — fail-honest.
 * Die meisten Fälle unten stellen keine Lage, weil sie die SIGNALREGEL prüfen und nicht die
 * Deckung; sie erwarten deshalb genau diesen Wert.
 */
const OHNE_AUSKUNFT: Deckung = { lage: "kein_lauf", geprueft: null, bestand: null };

/** Keine Lage hereingereicht. Bewusst benannt, damit der Aufbau der Fälle lesbar bleibt. */
const KEINE_LAGE = new Map<string, Deckung>();

describe("A28 · Signal am eigenen Objekt", () => {
  it("P-1 · mein Einreichen fand eine Dublette → Signal an meinem Objekt, Art benannt", () => {
    const befunde = eigeneBefunde(MEINE, [paar("ko-mein-1", "ko-fremd-9")], [], KEINE_LAGE);
    expect(befunde).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: false, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("P-2 · mein Einreichen fand einen Konflikt → Art ist Konflikt, nicht Dublette", () => {
    const befunde = eigeneBefunde(MEINE, [], [paar("ko-mein-1", "ko-fremd-9")], KEINE_LAGE);
    expect(befunde).toEqual([
      { koId: "ko-mein-1", dublette: false, konflikt: true, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("P-3 · beides am selben Objekt → beide Arten stehen an EINEM Eintrag", () => {
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9")],
      [paar("ko-mein-1", "ko-fremd-8")],
      KEINE_LAGE,
    );
    expect(befunde).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: true, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("P-4 · mehrere offene Befunde am selben Objekt bleiben EIN Signal", () => {
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9"), paar("ko-mein-1", "ko-fremd-8")],
      [],
      KEINE_LAGE,
    );
    expect(befunde).toHaveLength(1);
    expect(befunde[0]?.dublette).toBe(true);
  });

  it("P-5 · beide Seiten gehören mir → beide eigenen Objekte tragen das Signal", () => {
    // Kein fremder Bestand im Spiel: der Autor kennt beide Objekte, es entsteht keine Auskunft.
    const befunde = eigeneBefunde(MEINE, [paar("ko-mein-1", "ko-mein-2")], [], KEINE_LAGE);
    expect(befunde.map((b) => b.koId).sort()).toEqual(["ko-mein-1", "ko-mein-2"]);
    expect(befunde.every((b) => b.dublette)).toBe(true);
  });

  it("P-6 · Einzelabfrage liefert den Befund des eigenen Objekts", () => {
    const befund = befundFuerEigenesKo(
      "ko-mein-1",
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9")],
      [],
      KEINE_LAGE,
    );
    expect(befund).toEqual({
      koId: "ko-mein-1",
      dublette: true,
      konflikt: false,
      deckung: OHNE_AUSKUNFT,
    });
  });
});

describe('A28 · die GESPERRTE Richtung — „ein fremdes Objekt dupliziert meines"', () => {
  it("N-1 · fremdes Subjekt trifft mein Objekt → KEIN Signal", () => {
    // Das ist der Fall, den A28 ausdrücklich Pedi vorbehält (bens n=1-Einwand). Entstünde hier ein
    // Signal, erführe der Autor NACHTRÄGLICH von fremdem Bestand, den er vorher nicht kannte.
    const befunde = eigeneBefunde(MEINE, [paar("ko-fremd-9", "ko-mein-1")], [], KEINE_LAGE);
    expect(befunde).toEqual([]);
  });

  it("N-2 · dasselbe für Konflikte → KEIN Signal", () => {
    const befunde = eigeneBefunde(MEINE, [], [paar("ko-fremd-9", "ko-mein-1")], KEINE_LAGE);
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
      KEINE_LAGE,
    );
    expect(befunde).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: false, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("N-5 · rein fremdes Paar → KEIN Signal", () => {
    expect(eigeneBefunde(MEINE, [paar("ko-fremd-9", "ko-fremd-8")], [], KEINE_LAGE)).toEqual([]);
  });

  it("N-6 · ohne eigene Objekte gibt es kein Signal", () => {
    expect(eigeneBefunde([], [paar("ko-mein-1", "ko-fremd-9")], [], KEINE_LAGE)).toEqual([]);
  });

  it("N-7 · eine leere Kennung ist KEINE Autorschaft", () => {
    // Sonst fiele ein Altobjekt ohne Kennung mit einem leeren koA zusammen und wiese ein fremdes
    // Paar als eigenes aus — dieselbe Vorsicht wie in darfSehen (sichtbarkeit.ts:74-76).
    expect(eigeneBefunde([""], [paar("", "ko-fremd-9")], [], KEINE_LAGE)).toEqual([]);
  });
});

describe("A28 · die Grenze: Vorhandensein und Art, nie die Gegenseite", () => {
  it("G-1 · der Befund trägt genau vier Felder — keines davon ist die Gegenseite", () => {
    // JOB 3032 (N5): aus drei sind vier geworden. Das vierte ist `deckung` — eine Aussage über den
    // EIGENEN Prüflauf (wie weit reichte er?), nicht über das Gegenüber. Die Zahl der Felder ist
    // hier ausdrücklich festgeschrieben, damit ein künftiges FÜNFTES Feld eine bewusste
    // Entscheidung erzwingt statt sich einzuschleichen.
    const befunde = eigeneBefunde(MEINE, [paar("ko-mein-1", "ko-fremd-9")], [], KEINE_LAGE);
    expect(Object.keys(befunde[0] ?? {}).sort()).toEqual([
      "deckung",
      "dublette",
      "koId",
      "konflikt",
    ]);
  });

  it("G-2 · die Kennung der Gegenseite steht in der gesamten Ausgabe nirgends", () => {
    // Der schärfste Griff: die Ausgabe wird verschriftet und nach der fremden Kennung durchsucht.
    // Ein künftiges Zusatzfeld, das die Gegenseite mitschleppt, fällt hier auf.
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9")],
      [paar("ko-mein-2", "ko-fremd-8")],
      KEINE_LAGE,
    );
    expect(JSON.stringify(befunde)).not.toContain("ko-fremd-9");
    expect(JSON.stringify(befunde)).not.toContain("ko-fremd-8");
  });

  it('G-3 · ohne Befund kein Eintrag — „kein Befund" ist nicht „Befund mit zwei Neins"', () => {
    // JOB 3032 (N5) ändert daran NICHTS: die Deckung hängt an einem Befund, sie erzeugt keinen.
    // Ein vollständig geprüftes eigenes Objekt ohne Befund erscheint deshalb weiterhin nicht.
    expect(eigeneBefunde(MEINE, [], [], KEINE_LAGE)).toEqual([]);
    expect(befundFuerEigenesKo("ko-mein-1", MEINE, [], [], KEINE_LAGE)).toBeNull();
    const geprueft = new Map<string, Deckung>([
      ["ko-mein-1", { lage: "vollstaendig", geprueft: 7, bestand: 7 }],
    ]);
    expect(eigeneBefunde(MEINE, [], [], geprueft)).toEqual([]);
  });

  it("G-4 · die Zusicherungen der Grenze sind vollständig hinterlegt", () => {
    expect(A28_SIGNAL_GRENZE).toEqual({
      nenntVorhandensein: true,
      nenntArt: true,
      nenntGegenseite: false,
      nenntInhalt: false,
      // JOB 3032 (N5): die Deckung des EIGENEN Laufs wird genannt. Die beiden Verbote darüber
      // bleiben unverändert — die Deckung sagt nichts über ein fremdes Objekt.
      nenntDeckung: true,
      fremdesDupliziertMeines: false,
    });
  });

  it("G-5 · die hereingereichte Lage landet am RICHTIGEN Objekt und nirgends sonst", () => {
    // JOB 3032 (N5): der Kern schlägt die Lage ausschließlich unter der EIGENEN Kennung nach. Eine
    // breitere Tabelle als nötig kann deshalb keine fremde Reichweite an ein Signal heften.
    const lage = new Map<string, Deckung>([
      ["ko-mein-1", { lage: "unvollstaendig", geprueft: 20, bestand: 12479 }],
      ["ko-fremd-9", { lage: "vollstaendig", geprueft: 4444, bestand: 4444 }],
    ]);
    const befunde = eigeneBefunde(
      MEINE,
      [paar("ko-mein-1", "ko-fremd-9"), paar("ko-mein-2", "ko-fremd-8")],
      [],
      lage,
    );

    expect(befunde.find((b) => b.koId === "ko-mein-1")?.deckung).toEqual({
      lage: "unvollstaendig",
      geprueft: 20,
      bestand: 12479,
    });
    // ko-mein-2 steht NICHT in der Tabelle: fail-honest statt Entwarnung.
    expect(befunde.find((b) => b.koId === "ko-mein-2")?.deckung).toEqual(OHNE_AUSKUNFT);
    expect(JSON.stringify(befunde)).not.toContain("4444");
  });
});
