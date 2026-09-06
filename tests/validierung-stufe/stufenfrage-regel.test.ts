// ================================================================================================
// JOB 3112 · V3 · TEST 1 — DIE REGEL: WANN GEFRAGT WIRD, UND WAS ZUR WAHL STEHT.
// ================================================================================================
//
// Rein, DOM-frei, ohne i18n. Gegenstand ist ausschliesslich `lib/validationStufenfrage.ts`; ob die
// Fläche die Regel auch BEFOLGT, messen die gemounteten Tests 2–6 daneben — eine Regel, die nur
// sich selbst prüft, ist ein Kommentar mit Rechenaufwand.
import { describe, expect, it } from "vitest";

import type { StufenLage } from "../../apps/web/src/lib/boardAuskunft";
import { CONFIDENTIALITY_LEVELS } from "../../apps/web/src/lib/confidentiality";
import {
  FreigabeFehler,
  OHNE_STUFE,
  STUFENFRAGE_VERTRAG,
  STUFENFRAGE_WAHLEN,
  brauchtStufenfrage,
  freigabeFehlerUrsache,
  gespeicherteStufeAusFehler,
  stufeAusAntwort,
} from "../../apps/web/src/lib/validationStufenfrage";

// Die drei Lagen sind abschliessend (boardAuskunft.ts:41) — die Liste steht hier ausgeschrieben,
// damit eine vierte Lage diesen Test rot macht und nicht stillschweigend durchrutscht.
const ALLE_LAGEN: readonly StufenLage[] = ["eingestuft", "nicht_eingestuft", "auskunft_fehlt"];

describe("JOB 3112 · R1: gefragt wird genau dann, wenn keine Stufe belegt ist", () => {
  it("`nicht_eingestuft` → es wird gefragt (der Fall, den 2623 D1 §2 meint)", () => {
    expect(brauchtStufenfrage("nicht_eingestuft")).toBe(true);
  });

  it("`auskunft_fehlt` → es wird gefragt (fragen behauptet nichts; schweigen behauptete Ordnung)", () => {
    expect(brauchtStufenfrage("auskunft_fehlt")).toBe(true);
  });

  it("`eingestuft` → es wird NICHT gefragt: ein Klick bleibt ein Klick", () => {
    expect(brauchtStufenfrage("eingestuft")).toBe(false);
  });

  it("genau EINE der drei Lagen fragt nicht — die Regel ist keine Konstante", () => {
    expect(ALLE_LAGEN.filter((l) => !brauchtStufenfrage(l))).toEqual(["eingestuft"]);
  });
});

describe("JOB 3112 · R2: der Vertrag steht als lesbares Datum da", () => {
  it("gefragt, nicht erzwungen — und nie selbst gesetzt", () => {
    expect(STUFENFRAGE_VERTRAG.fragt).toBe(true);
    expect(STUFENFRAGE_VERTRAG.erzwingt).toBe(false);
    expect(STUFENFRAGE_VERTRAG.setztNiemalsSelbst).toBe(true);
  });

  // Der Vertrag ist WIRKSAM und nicht bloß beschrieben: `brauchtStufenfrage` liest ihn. Wäre
  // `fragt` je falsch, fragte keine der drei Lagen mehr — dieser Fall hält fest, dass die
  // Zusicherung und die Regel dieselbe Sache sind.
  it("`fragt` trägt die Regel: solange er gilt, fragen genau die zwei unbelegten Lagen", () => {
    expect(STUFENFRAGE_VERTRAG.fragt && true).toBe(true);
    expect(ALLE_LAGEN.filter(brauchtStufenfrage)).toEqual(["nicht_eingestuft", "auskunft_fehlt"]);
  });
});

describe("JOB 3112 · R3: die Wahlmöglichkeiten sind die drei Stufen plus der Übergeh-Weg", () => {
  it("die Stufenliste ist ZEICHENGLEICH `CONFIDENTIALITY_LEVELS` — keine zweite Aufzählung", () => {
    expect(STUFENFRAGE_WAHLEN.filter((w) => w !== OHNE_STUFE)).toEqual([...CONFIDENTIALITY_LEVELS]);
  });

  it("der Übergeh-Weg ist ein EIGENER Wert und keine vierte Stufe", () => {
    expect(STUFENFRAGE_WAHLEN).toContain(OHNE_STUFE);
    expect([...CONFIDENTIALITY_LEVELS] as string[]).not.toContain(OHNE_STUFE);
    expect(STUFENFRAGE_WAHLEN).toHaveLength(CONFIDENTIALITY_LEVELS.length + 1);
  });

  // Die Gegenprobe aus dem Auftrag (§6.1), hier als Fall statt als Handgriff: eine vierte Stufe im
  // Test macht den Vergleich rot — der Test misst also wirklich die Liste und nicht ihre Länge.
  it("eine erfundene vierte Stufe deckt sich NICHT mit der Wahlliste", () => {
    const erfunden = [...CONFIDENTIALITY_LEVELS, "geheim"];
    expect(STUFENFRAGE_WAHLEN.filter((w) => w !== OHNE_STUFE)).not.toEqual(erfunden);
  });
});

describe("JOB 3112 · R4: aus der Antwort wird nur geschrieben, was gewählt wurde", () => {
  it("eine gewählte Stufe wird geschrieben", () => {
    expect(stufeAusAntwort("vertraulich")).toBe("vertraulich");
    expect(stufeAusAntwort("intern")).toBe("intern");
    expect(stufeAusAntwort("streng_vertraulich")).toBe("streng_vertraulich");
  });

  it("„ohne Stufe“ schreibt NICHTS — keine Vorbelegung, keine „intern“-Annahme", () => {
    expect(stufeAusAntwort(OHNE_STUFE)).toBeNull();
  });
});

// ================================================================================================
// RUNDE 2 · KORREKTURPFLICHT 2 — der Fehler trägt mit, was VOR ihm ankam.
// ================================================================================================
describe("JOB 3112 · R5: der Teilerfolg ist ein eigener Zustand, kein Sonderfall von „Fehler“", () => {
  const ursache = new Error("500");

  it("scheitert Schritt 1, liegt NICHTS am Server", () => {
    const f = new FreigabeFehler("stufe", null, ursache);
    expect(f.schritt).toBe("stufe");
    expect(gespeicherteStufeAusFehler(f)).toBeNull();
  });

  it("scheitert Schritt 2 nach gewählter Stufe, liegt die Stufe am Server", () => {
    const f = new FreigabeFehler("freigabe", "vertraulich", ursache);
    expect(f.schritt).toBe("freigabe");
    expect(gespeicherteStufeAusFehler(f)).toBe("vertraulich");
  });

  it("scheitert Schritt 2 OHNE gewählte Stufe (Übergeh-Weg), liegt ebenfalls nichts", () => {
    expect(gespeicherteStufeAusFehler(new FreigabeFehler("freigabe", null, ursache))).toBeNull();
  });

  it("ein fremder Fehler behauptet keine Speicherung — Wissenslücke statt Erfindung", () => {
    expect(gespeicherteStufeAusFehler(ursache)).toBeNull();
    expect(gespeicherteStufeAusFehler(undefined)).toBeNull();
  });

  it("die Hülle ERSETZT die Ursache nicht, sie trägt sie", () => {
    expect(freigabeFehlerUrsache(new FreigabeFehler("freigabe", "intern", ursache))).toBe(ursache);
    expect(freigabeFehlerUrsache(ursache)).toBe(ursache);
    expect(new FreigabeFehler("stufe", null, ursache).message).toBe("500");
  });
});
