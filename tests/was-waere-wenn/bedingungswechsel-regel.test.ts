// ================================================================================================
// R-1628 — „WENN ICH STATT 5083-H111 JETZT 6082-T6 VERWENDE — WELCHE BESTEHENDEN ERFAHRUNGSWERTE
// GELTEN DANN NOCH, WELCHE NICHT?" — DIE REGEL.
// ================================================================================================
//
// Geprüft wird die eine Regel in `apps/web/src/lib/bedingungswechsel.ts` mit dem Beispiel der Quelle.
//
//   W1  Der Wechsel der Quelle: gebunden (nur bisher), beide, nur neu — je mit Fundort und Wortlaut;
//       was keine nennt, wird ohne Thema nur gezählt.
//   W2  Mit Thema: eingegrenzt, und „nennt keine" steht einzeln da — ausdrücklich nicht „übertragbar".
//   W3  Wortgrenze, Gross-/Kleinschreibung und Leerraum: „5083" trifft nicht „50830".
//   W4  Unvollständig oder gleich: nichts wird verglichen, nichts geraten.
//   W5  Lange Aussage: der Ausschnitt trägt den Treffer.
//   W6  Vorschläge: die Bedingungen des Bestands, ohne Doppel, sortiert.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  bedingungsVorschlaege,
  fundstelle,
  vergleicheBedingungen,
} from "../../apps/web/src/lib/bedingungswechsel";

function ko(over: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Schweißen",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [],
    sources: [],
    ...over,
  } as KnowledgeObject;
}

const BESTAND: KnowledgeObject[] = [
  ko({
    id: "gebunden",
    title: "Vorwärmen vor dem Schweißen",
    statement: "Vor dem Schweißen auf 80 Grad vorwärmen.",
    conditions: ["Werkstoff 5083-H111"],
  }),
  ko({
    id: "beide",
    title: "Schutzgas Argon",
    statement: "Als Schutzgas reines Argon verwenden.",
    conditions: ["5083-H111", "6082-T6"],
  }),
  ko({
    id: "neu",
    title: "Nahtvorbereitung",
    statement: "Bei 6082-T6 die Kanten vor dem Schweißen entgraten.",
  }),
  ko({
    id: "ohne",
    title: "Schweißnaht reinigen",
    statement: "Nach dem Schweißen die Naht bürsten.",
  }),
  ko({
    id: "fremd",
    title: "Kaffeeküche",
    statement: "Milch nachfüllen.",
    category: "Allgemein",
  }),
];

describe("R-1628 · Bedingungswechsel — die Regel", () => {
  it("W1 · statt 5083-H111 jetzt 6082-T6: gebunden, beide, nur neu — mit Fundstelle", () => {
    const r = vergleicheBedingungen(BESTAND, { bisher: "5083-H111", neu: "6082-T6" });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const v = r.vergleich;
    expect(v.gruppen.nur_bisher.map((e) => e.id)).toEqual(["gebunden"]);
    expect(v.gruppen.nur_bisher[0]?.bisher).toEqual({
      fundort: "bedingung",
      text: "Werkstoff 5083-H111",
    });
    expect(v.gruppen.nur_bisher[0]?.neu).toBeNull();
    expect(v.gruppen.beide.map((e) => e.id)).toEqual(["beide"]);
    expect(v.gruppen.nur_neu.map((e) => e.id)).toEqual(["neu"]);
    expect(v.gruppen.nur_neu[0]?.neu?.fundort).toBe("aussage");
    // Ohne Thema: „nennt keine" wird gezählt, nicht gelistet.
    expect(v.gruppen.keine).toEqual([]);
    expect(v.ohneNennungAnzahl).toBe(2);
  });

  it("W2 · mit Thema: was keine nennt, steht einzeln — nicht als „übertragbar“", () => {
    const r = vergleicheBedingungen(BESTAND, {
      bisher: "5083-H111",
      neu: "6082-T6",
      thema: "schweiß",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const v = r.vergleich;
    expect(v.thema).toBe("schweiß");
    expect(v.gruppen.keine.map((e) => e.id)).toEqual(["ohne"]);
    expect(v.gruppen.keine[0]?.lage).toBe("keine");
    expect(v.gruppen.keine[0]?.bisher).toBeNull();
    expect(v.gruppen.keine[0]?.neu).toBeNull();
    // Die Kaffeeküche gehört nicht zum Thema und wird auch nicht gezählt.
    expect(v.ohneNennungAnzahl).toBe(1);
    const alle = Object.values(v.gruppen).flatMap((g) => g.map((e) => e.id));
    expect(alle).not.toContain("fremd");
  });

  it("W3 · Wortgrenze, Gross-/Kleinschreibung und Leerraum", () => {
    const k = ko({ conditions: ["Legierung 50830"], statement: "Gilt für  6082-t6 ebenso." });
    expect(fundstelle(k, "5083")).toBeNull();
    expect(fundstelle(k, " 6082-T6 ")).toEqual({
      fundort: "aussage",
      text: "Gilt für 6082-t6 ebenso.",
    });
    expect(fundstelle(ko({ tags: ["AlMg4,5Mn"] }), "almg4,5mn")?.fundort).toBe("schlagwort");
    expect(fundstelle(ko({ title: "Werkstoff 5083" }), "5083")?.fundort).toBe("titel");
  });

  it("W4 · unvollständig oder gleich: kein Vergleich", () => {
    expect(vergleicheBedingungen(BESTAND, { bisher: "5083-H111", neu: "  " })).toEqual({
      ok: false,
      grund: "unvollstaendig",
    });
    expect(vergleicheBedingungen(BESTAND, { bisher: "", neu: "6082-T6" })).toEqual({
      ok: false,
      grund: "unvollstaendig",
    });
    expect(vergleicheBedingungen(BESTAND, { bisher: "6082-t6", neu: " 6082-T6" })).toEqual({
      ok: false,
      grund: "gleich",
    });
  });

  it("W5 · lange Aussage: der Ausschnitt trägt den Treffer", () => {
    const lang = `${"Vorlauf ".repeat(40)}bei 6082-T6 gilt das ebenso ${"Nachlauf ".repeat(40)}`;
    const f = fundstelle(ko({ statement: lang }), "6082-T6");
    expect(f?.fundort).toBe("aussage");
    expect(f?.text).toContain("6082-T6");
    expect(f?.text.startsWith("…")).toBe(true);
    expect(f?.text.endsWith("…")).toBe(true);
    expect((f?.text.length ?? 0) <= 162).toBe(true);
  });

  it("W6 · Vorschläge aus den Bedingungen des Bestands", () => {
    const vorschlaege = bedingungsVorschlaege([
      ...BESTAND,
      ko({ conditions: ["5083-h111", "  Werkstoff   5083-H111 "] }),
    ]);
    expect(vorschlaege).toEqual(["5083-H111", "6082-T6", "Werkstoff 5083-H111"]);
  });
});
