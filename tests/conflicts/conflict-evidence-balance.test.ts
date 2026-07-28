// ================================================================================================
// AUFTRAG-mega32 BLOCK K (aus dem zurückgezogenen mega30, unverändert)
// ================================================================================================
//
// Der Anlassfall: „Alle Firmenwagen müssen blau sein" gegen „Firmenwagen ausschließlich in Rot
// bestellen". Unter beiden Karten steht bereits „keine Quelle hinterlegt · kein Quelldatum" — das
// IST die Antwort auf die Frage, welche Seite stimmt (keine von beiden ist belegt). Die Seite sagte
// es nur nicht.
//
// Drei Fälle, drei Verhalten: beide ohne Quelle → ein Satz · genau eine mit Quelle → derselbe Satz
// benennt das als BEWEISLAGE, nicht als Urteil · beide mit Quelle → die Zeile schweigt.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoSource } from "../../apps/web/src/api/types";
import { conflictEvidenceBalance, conflictKoPair } from "../../apps/web/src/lib/conflictView";

function source(id: string): KoSource {
  return {
    id,
    label: "Handbuch",
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    author: "u1",
    at: "2026-01-01T00:00:00.000Z",
  };
}

function ko(id: string, title: string, sources?: KoSource[]): KnowledgeObject {
  return {
    id,
    title,
    statement: `${title} — Aussage`,
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 80,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(sources ? { sources } : {}),
  } as unknown as KnowledgeObject;
}

const BLAU = "Alle Firmenwagen müssen blau sein";
const ROT = "Firmenwagen ausschließlich in Rot bestellen";
const conflict = { koA: "a", koB: "b" };

describe("mega32 K · der Satz über den Konfliktkarten benennt die Beweislage", () => {
  it("BEIDE Seiten ohne Quelle — genau der Anlassfall", () => {
    const kos = [ko("a", BLAU), ko("b", ROT)];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, kos))).toEqual({ kind: "neither" });
  });

  it("GENAU EINE Seite mit Quelle — der Satz benennt WELCHE, ohne sie zum Sieger zu erklären", () => {
    const kos = [ko("a", BLAU, [source("s1")]), ko("b", ROT)];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, kos))).toEqual({
      kind: "oneSided",
      side: "a",
    });
    // Und andersherum, ohne dass die Seitenzuordnung durcheinandergerät.
    const gedreht = [ko("a", BLAU), ko("b", ROT, [source("s2")])];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, gedreht))).toEqual({
      kind: "oneSided",
      side: "b",
    });
  });

  it("BEIDE Seiten mit Quelle — die Zeile schweigt (kein Dauerhinweis)", () => {
    const kos = [ko("a", BLAU, [source("s1")]), ko("b", ROT, [source("s2")])];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, kos))).toBeNull();
  });

  it("ein leeres Quellen-Array ist dasselbe wie gar keins — kein Scheinbeleg", () => {
    const kos = [ko("a", BLAU, []), ko("b", ROT, [])];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, kos))).toEqual({ kind: "neither" });
  });

  it("eine nicht geladene Seite ⇒ SCHWEIGEN, nicht „keine Quelle“", () => {
    // Über ein Objekt, das die Seite gar nicht hat, darf sie nichts behaupten — auch nichts
    // Negatives. Das wäre eine Aussage über Daten, die nicht vorliegen.
    const nurA = [ko("a", BLAU)];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, nurA))).toBeNull();
    expect(conflictEvidenceBalance(conflictKoPair(conflict, []))).toBeNull();
    const nurBMitQuelle = [ko("b", ROT, [source("s2")])];
    expect(conflictEvidenceBalance(conflictKoPair(conflict, nurBMitQuelle))).toBeNull();
  });
});
