// ================================================================================================
// R-1117 — KI-WIDERSPRUCH NUR MIT WÖRTLICHEM BELEGZITAT (Auftrag …:r1117-zitat-woertlich)
// ================================================================================================
//
// Ein Belegzitat zählt nur, wenn es als lückenlose Tokenfolge im Kerntext steht (`quoteFound` in
// services/conflicts/src/detect.ts). Gemessen wird am echten ConflictService bzw. OverlapService,
// nur das Modellurteil ist ein Doppelgänger.
//
// Gegenproben:
//   Z1  Kontrollfall '5 bar' gegen 'Set pressure to 5 bar.' → 1 Konflikt
//   Z2  '1,5 bar' gegen '1–5 bar' → verworfen
//   Z3  '1.5', '15', '.5 bar', ',5', '-5', '+5', '5%', '5.0', 'to .5' gegen 'Set pressure to 5 bar.'
//   Z4  '-8 °C' gegen '8 °C' (und umgekehrt) → verworfen
//   Z5  frei erfundenes Zitat → verworfen
//   Z6  typografische Varianten gleicher Zeichen (Anführungszeichen, Binde-/Gedankenstrich,
//       Auslassungszeichen) → akzeptiert
//   Z7  freistehende Rand-Anführung und Satzendezeichen → akzeptiert
//   Z8  'beträgt 1' gegen 'beträgt 15' → verworfen
//   Z9  'beträgt 1' gegen 'beträgt 1–5' → verworfen
//   Z10 Dublettenaspekt: '.5 bar' ist kein geteiltes Zitat, das echte Zitat bleibt ein Aspekt
//   BEN-1 Prime/Doppelprime: 'Cut to 5″.' belegt 'Cut to 5′.' nicht
//
// BEKANNTE GRENZE: Ein Modellzitat mit abweichender Zeichensetzung in der Mitte ('5 bar, dann'
// gegen '5 bar dann') oder mit einer Auslassung in der Mitte ('Set … 5 bar') gilt als NICHT
// wörtlich; ein echter Widerspruch geht dann verloren (Präzision vor Vollständigkeit). Wie oft echte
// Modelle so zitieren, ist gegen KEINEN echten Modellanbieter gemessen.
//
// ROT-NACHWEIS: Der Block „alte Regel" am Ende rechnet die Gegenproben gegen einen wörtlichen
// Nachbau der bisherigen Regel (normalisieren, dann Teilzeichenkette) und hält fest, welche sie
// durchgelassen hätte. Das ist ein Nachbau, KEIN Lauf am Git-Stand cd54531f.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type ConflictVerdict,
  type DetectSubject,
  normalizeForCompare,
  quoteFound,
} from "../../services/conflicts/src/detect";
import type { OverlapVerdict } from "../../services/conflicts/src/duplicate-detect";
import { InMemoryOverlapRepo } from "../../services/conflicts/src/overlap-repo";
import { OverlapService } from "../../services/conflicts/src/overlap-service";
import { InMemoryConflictRepo } from "../../services/conflicts/src/repo";
import { ConflictService } from "../../services/conflicts/src/service";

const DRUCK = "Set pressure to 5 bar.";

function subject(refId: string, title: string, statement: string): DetectSubject {
  return {
    refId,
    title,
    statement,
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
  };
}

const VERWORFEN = { angelegt: 0, badge: 0 };
const ANGELEGT = { angelegt: 1, badge: 1 };

const bestand = subject("ko-alt", "Kesseldruck", "Set pressure to 3 bar.");

// Doppelgänger des Modells: Widerspruch mit sicherer Konfidenz; zitat_b ist immer echt, zitat_a ist
// die Probe gegen den Kerntext des neuen Beitrags.
function widerspruch(zitatA: string) {
  return async (): Promise<ConflictVerdict> => ({
    relation: "widerspruch",
    older: null,
    confidence: 0.95,
    begruendung: "Beide legen einen anderen Kesseldruck fest.",
    zitat_a: zitatA,
    zitat_b: "pressure to 3 bar",
  });
}

describe("R-1117 · ConflictService legt nur mit wörtlichem Belegzitat an", () => {
  let service: ConflictService;
  beforeEach(() => {
    service = new ConflictService({ repo: new InMemoryConflictRepo() });
  });

  async function lauf(text: string, zitat: string): Promise<typeof VERWORFEN> {
    const neu = subject("ko-neu", "Kesseldruck", text);
    const created = await service.detectForSubject(neu, [bestand], widerspruch(zitat));
    return { angelegt: created.length, badge: await service.badgeCount() };
  }

  it("Z1 · Kontrollfall '5 bar' gegen 'Set pressure to 5 bar.' → 1 Konflikt", async () => {
    expect(await lauf(DRUCK, "5 bar")).toEqual(ANGELEGT);
  });

  it("Z2 · '1,5 bar' gegen 'Set pressure to 1–5 bar.' → verworfen, Badge 0", async () => {
    expect(await lauf("Set pressure to 1–5 bar.", "1,5 bar")).toEqual(VERWORFEN);
  });

  it.each(["1.5", "15", ".5 bar", ",5", "-5", "+5", "5%", "5.0", "to .5"])(
    "Z3 · '%s' gegen 'Set pressure to 5 bar.' → verworfen, Badge 0",
    async (zitat) => {
      expect(await lauf(DRUCK, zitat)).toEqual(VERWORFEN);
    },
  );

  it("Z4 · '-8 °C' gegen 'Lagern bei 8 °C.' → verworfen, Badge 0", async () => {
    expect(await lauf("Lagern bei 8 °C.", "-8 °C")).toEqual(VERWORFEN);
  });

  it("Z4 · umgekehrt: '8 °C' gegen 'Lagern bei -8 °C.' → verworfen, Badge 0", async () => {
    expect(await lauf("Lagern bei -8 °C.", "8 °C")).toEqual(VERWORFEN);
  });

  it("Z5 · frei erfundenes Zitat → verworfen, Badge 0", async () => {
    expect(await lauf(DRUCK, "Set pressure to 7 bar")).toEqual(VERWORFEN);
  });

  it.each([
    ["Anführungszeichen", "Schalter „Notaus“ drücken, dann 5 bar.", 'Schalter "Notaus" drücken'],
    ["Anführungszeichen einfach", "Den Schalter ‚Notaus‘ drücken.", "Schalter 'Notaus' drücken"],
    ["Gedankenstrich gegen Bindestrich", "Druck – nicht Temperatur – prüfen.", "Druck - nicht"],
    ["Bindestrich gegen Gedankenstrich", "Den Kessel-Druck auf 5 bar.", "Kessel–Druck auf 5 bar"],
    ["Auslassungszeichen", "Warten… dann 5 bar einstellen.", "Warten... dann 5 bar"],
    ["drei Punkte gegen Auslassungszeichen", "Warten... dann 5 bar einstellen.", "Warten… dann"],
  ])("Z6 · typografische Variante (%s) → akzeptiert", async (_art, text, zitat) => {
    expect(await lauf(text, zitat)).toEqual(ANGELEGT);
  });

  it.each([
    ["Anführung und Satzpunkt am Rand", "„Set pressure to 5 bar.“"],
    ["Satzpunkt am Ende", "pressure to 5 bar."],
    ["Anführung um ein Teilstück", '"5 bar"'],
    ["freistehende Auslassung am Anfang", "… to 5 bar"],
    ["Großschreibung und Leerraum", "SET  pressure   to 5 BAR"],
  ])("Z7 · %s → akzeptiert", async (_art, zitat) => {
    expect(await lauf(DRUCK, zitat)).toEqual(ANGELEGT);
  });

  it("Z8 · 'beträgt 1' gegen 'Der Druck beträgt 15 bar.' → verworfen, Badge 0", async () => {
    expect(await lauf("Der Druck beträgt 15 bar.", "beträgt 1")).toEqual(VERWORFEN);
  });

  it("Z9 · 'beträgt 1' gegen 'Der Druck beträgt 1–5 bar.' → verworfen, Badge 0", async () => {
    expect(await lauf("Der Druck beträgt 1–5 bar.", "beträgt 1")).toEqual(VERWORFEN);
  });

  it("BEN-1 · 'Cut to 5″.' belegt 'Cut to 5′.' nicht (Prime ≠ Doppelprime)", async () => {
    expect(await lauf("Cut to 5′.", "Cut to 5″.")).toEqual(VERWORFEN);
    expect(await lauf("Cut to 5′.", "Cut to 5′.")).toEqual(ANGELEGT);
  });
});

describe("R-1117 · Z10 · OverlapService: geteilte Zitate der Dublettenaspekte", () => {
  const kessel = subject("ko-kessel", "Kesseldruck", DRUCK);
  const anfahren = subject(
    "ko-anfahren",
    "Anfahren der Anlage",
    "Before start, set pressure to 5 bar and open valve V2 slowly.",
  );

  function teilweise(aspects: OverlapVerdict["aspects"]) {
    return async (): Promise<OverlapVerdict> => ({
      beziehung: "teilweise",
      aspects,
      nurInA: "",
      nurInB: "Ventil V2",
      empfehlung: "zusammenfuehren_pruefen",
      confidence: 0.9,
      begruendung: "Beide nennen den Solldruck.",
    });
  }

  const unecht = { beschreibung: "Solldruck", zitatA: ".5 bar", zitatB: ".5 bar" };
  const echt = { beschreibung: "Solldruck", zitatA: "5 bar", zitatB: "set pressure to 5 bar" };

  it("'.5 bar' ist kein geteiltes Zitat, das echte Zitat bleibt der einzige Aspekt", async () => {
    const service = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const created = await service.detectForSubject(kessel, [anfahren], teilweise([unecht, echt]));
    expect(created).toHaveLength(1);
    expect(created[0]?.aspects).toEqual([echt]);
  });

  it("nur '.5 bar' als Aspekt → kein Dubletteneintrag", async () => {
    const service = new OverlapService({ repo: new InMemoryOverlapRepo() });
    const created = await service.detectForSubject(kessel, [anfahren], teilweise([unecht]));
    expect(created).toHaveLength(0);
    expect(await service.badgeCount()).toBe(0);
  });
});

describe("R-1117 · Rot-Nachweis: Nachbau der alten Regel (nicht der Git-Stand cd54531f)", () => {
  // Wortgleich die bisherige Zitatregel: normalisieren, dann Teilzeichenkette.
  const alteRegel = (zitat: string, kern: string): boolean => {
    const q = normalizeForCompare(zitat);
    return q.length > 0 && normalizeForCompare(kern).includes(q);
  };

  const proben: Array<[string, string, string]> = [
    ["Z2", "1,5 bar", "Set pressure to 1–5 bar."],
    ["Z3", ".5 bar", DRUCK],
    ["Z3", ",5", DRUCK],
    ["Z3", "-5", DRUCK],
    ["Z3", "+5", DRUCK],
    ["Z3", "5%", DRUCK],
    ["Z3", "to .5", DRUCK],
    ["Z4", "-8 °C", "Lagern bei 8 °C."],
    ["Z8", "beträgt 1", "Der Druck beträgt 15 bar."],
    ["Z9", "beträgt 1", "Der Druck beträgt 1–5 bar."],
    ["Z10", ".5 bar", "Before start, set pressure to 5 bar and open valve V2 slowly."],
    ["BEN-1", "Cut to 5″.", "Cut to 5′."],
  ];

  it.each(proben)("%s · alte Regel ließ '%s' durch, die neue verwirft es", (_z, zitat, kern) => {
    expect(alteRegel(zitat, kern)).toBe(true);
    expect(quoteFound(zitat, kern)).toBe(false);
  });
});
