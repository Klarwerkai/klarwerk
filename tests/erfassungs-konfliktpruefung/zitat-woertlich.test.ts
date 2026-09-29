import { describe, expect, it } from "vitest";
import {
  ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
} from "../../services/conflicts";

// R-1117 · BEN-1 (Runde 1): Ein Widerspruch wird nur angelegt, wenn beide Belegzitate WÖRTLICH in
// den Texten stehen. Bens Gegenprobe gegen den unveränderten Dienst: Quelle „1–5 bar“, Modellzitat
// „1,5 bar“ → angelegt, weil die Zitatprüfung Satzzeichen zu Leerraum machte. Diese Datei läuft
// durch den echten `ConflictService.detectForSubject`; nur das Modellurteil ist gestellt.

function subject(refId: string, statement: string): DetectSubject {
  return {
    refId,
    title: "Betriebsdruck Pumpe P3",
    statement,
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
  };
}

const QUELLE = subject("ko-quelle", "Der zulässige Betriebsdruck beträgt 1–5 bar.");
const NEU = subject("ko-neu", "Der zulässige Betriebsdruck beträgt höchstens 8 bar.");

function urteil(zitatA: string, zitatB: string): () => Promise<ConflictVerdict> {
  return async () => ({
    relation: "widerspruch",
    older: null,
    confidence: 0.95,
    begruendung: "Die Obergrenze des Betriebsdrucks weicht ab.",
    zitat_a: zitatA,
    zitat_b: zitatB,
  });
}

async function angelegt(zitatA: string, zitatB: string): Promise<number> {
  const service = new ConflictService({ repo: new InMemoryConflictRepo() });
  const created = await service.detectForSubject(NEU, [QUELLE], urteil(zitatA, zitatB));
  expect(await service.badgeCount()).toBe(created.length);
  return created.length;
}

describe("R-1117 · Belegzitate müssen wörtlich stehen", () => {
  it("Z1 · Kontrolle: das tatsächliche Zitat legt genau einen Konflikt an", async () => {
    expect(
      await angelegt(
        "Der zulässige Betriebsdruck beträgt höchstens 8 bar.",
        "Der zulässige Betriebsdruck beträgt 1–5 bar.",
      ),
    ).toBe(1);
  });

  it("Z2 · BEN-1: erfundene Dezimalzahl „1,5 bar“ für geschriebenes „1–5 bar“ → kein Konflikt", async () => {
    expect(
      await angelegt(
        "Der zulässige Betriebsdruck beträgt höchstens 8 bar.",
        "Der zulässige Betriebsdruck beträgt 1,5 bar.",
      ),
    ).toBe(0);
  });

  it("Z3 · auch „1.5“ und „15“ statt „1–5“ belegen nichts", async () => {
    expect(await angelegt("höchstens 8 bar", "beträgt 1.5 bar")).toBe(0);
    expect(await angelegt("höchstens 8 bar", "beträgt 15 bar")).toBe(0);
  });

  it("Z4 · Wortgrenze: ein Zitat, das mitten in einem Wort beginnt oder endet, belegt nichts", async () => {
    expect(await angelegt("höchstens 8 bar", "beträgt 1–5 ba")).toBe(0);
    expect(await angelegt("chstens 8 bar", "beträgt 1–5 bar")).toBe(0);
    // Kalibrierung: dasselbe Stück an Wortgrenzen ist wörtlich vorhanden und zählt.
    expect(await angelegt("höchstens 8 bar", "beträgt 1–5 bar")).toBe(1);
  });

  it("Z5 · völlig fremdes Zitat → kein Konflikt", async () => {
    expect(await angelegt("höchstens 8 bar", "Die Pumpe wird jährlich getauscht.")).toBe(0);
  });

  it("Z6 · typografische Varianten und Ränder bleiben tolerant: Viertelgeviertstrich als Bindestrich, Schlusspunkt, Anführung, Groß-/Kleinschreibung", async () => {
    expect(
      await angelegt("„höchstens 8 bar.“", "der zulässige betriebsdruck beträgt 1-5 bar"),
    ).toBe(1);
  });
});

// BEN-1 (Runde 2): Bens zweite Gegenprobe. Die Randbereinigung nahm einen führenden Dezimalpunkt als
// bloßen Zitatrand weg — „.5 bar“ wurde zu „5 bar“ und belegte damit „Set pressure to 5 bar.“. Ein
// Zeichen, das zu einer Zahl gehört, ist kein Rand.
describe("R-1117 · Zahlenzeichen sind nie Zitatrand (BEN-1, Runde 2)", () => {
  const QUELLE_EN = subject("ko-quelle-en", "Set pressure to 5 bar.");
  const NEU_EN = subject("ko-neu-en", "Set pressure to 8 bar.");

  async function angelegtEn(zitatA: string, zitatB: string): Promise<number> {
    const service = new ConflictService({ repo: new InMemoryConflictRepo() });
    const created = await service.detectForSubject(NEU_EN, [QUELLE_EN], urteil(zitatA, zitatB));
    expect(await service.badgeCount()).toBe(created.length);
    return created.length;
  }

  it("Z7 · Kontrolle: „5 bar“ und „5 bar.“ belegen „Set pressure to 5 bar.“", async () => {
    expect(await angelegtEn("8 bar", "5 bar")).toBe(1);
    expect(await angelegtEn("8 bar", "Set pressure to 5 bar.")).toBe(1);
  });

  it("Z8 · BEN-1 R2: „.5 bar“ belegt kein „5 bar“ → kein Konflikt, kein erfundenes Zitat gespeichert", async () => {
    const service = new ConflictService({ repo: new InMemoryConflictRepo() });
    const created = await service.detectForSubject(NEU_EN, [QUELLE_EN], urteil("8 bar", ".5 bar"));
    expect(created).toHaveLength(0);
    expect(await service.badgeCount()).toBe(0);
  });

  it("Z9 · auch „,5“, „-5“, „+5“, „5%“ und „5.0“ sind andere Zahlen als „5“", async () => {
    for (const erfunden of [",5 bar", "-5 bar", "+5 bar", "5% bar", "5.0 bar", "to .5 bar"]) {
      expect(await angelegtEn("8 bar", erfunden), erfunden).toBe(0);
    }
  });

  it("Z10 · derselbe Maßstab für Dublettenaspekte: der erfundene Zahlenbeleg wird nicht als geteiltes Zitat geführt", async () => {
    const a = subject("ko-dup-a", "Set pressure to 5 bar before start.");
    const b = subject("ko-dup-b", "Before start set the pressure to 5 bar.");
    const verdict = (zitatA: string): OverlapVerdict => ({
      beziehung: "teilweise",
      aspects: [{ beschreibung: "Druckvorgabe", zitatA, zitatB: "pressure to 5 bar" }],
      nurInA: "",
      nurInB: "",
      empfehlung: "zusammenfuehren_pruefen",
      confidence: 0.9,
      begruendung: "Gleiche Druckvorgabe.",
    });
    const lauf = async (zitatA: string) => {
      const service = new OverlapService({ repo: new InMemoryOverlapRepo() });
      const [entry] = await service.detectForSubject(a, [b], async () => verdict(zitatA));
      return entry;
    };
    // Kalibrierung: das echte Zitat wird als geteilter Aspekt geführt — der Weg läuft wirklich.
    const echt = await lauf("pressure to 5 bar");
    expect(echt, "Kalibrierung: ohne Eintrag misst Z10 nichts").toBeDefined();
    expect(echt?.aspects.map((x) => x.zitatA)).toEqual(["pressure to 5 bar"]);
    // Gegenprobe: „.5 bar“ steht so nicht in A — der Aspekt fällt weg, egal ob ein Eintrag entsteht.
    const erfunden = await lauf(".5 bar");
    expect(erfunden?.aspects ?? []).toEqual([]);
  });
});
