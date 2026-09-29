import { describe, expect, it } from "vitest";
import {
  ConflictService,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
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
