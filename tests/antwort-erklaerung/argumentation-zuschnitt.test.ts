// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — ARGUMENTATIONSKETTE (R-1627) UND ZUSCHNITT (R-0346).
// ================================================================================================
//
// Gemessen an der reinen Rechnung `antwortBelastbarkeit` (services/ask/src/answer-belastbarkeit.ts):
//   R-1627/R-0281  Kette Aussage → Stützung → Einwand → Vorbehalt → Schluss, jede Stufe an eine
//                  Quelle, einen Widerspruch oder einen benannten Grund gebunden; Belegstelle nur
//                  aus `steps[].snippet` der gleichen Quelle; keine Wahrheitswahrscheinlichkeit.
//   R-0346         Rolle und Anlass steuern Tiefe, Fachsprache und die Reihenfolge der Wissensarten.
import { describe, expect, it } from "vitest";
import {
  type AntwortZuschnitt,
  answerEvidence,
  antwortBelastbarkeit,
  antwortZuschnitt,
} from "../../services/ask";
import type { Conflict } from "../../services/conflicts";
import type { KnowledgeObject } from "../../services/knowledge-object";

const BELEGT = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko(id: string, teil: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `Wissen ${id}`,
    statement: `Aussage ${id}`,
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 80,
    version: 1,
    author: `autor-${id}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [{ version: 1, at: "2026-02-01T00:00:00.000Z", author: `autor-${id}`, note: "x" }],
    aiCheck: { status: "done", requestedAt: "x", coverage: BELEGT },
    // Benannter Eigentümer: sonst stünde der Vorbehalt „verantwortung_nur_autor" in jeder Kette.
    ownership: { owner: `autor-${id}`, reviewers: [], validators: [] },
    ...teil,
  } as unknown as KnowledgeObject;
}

const KONFLIKT = {
  id: "c1",
  koA: "a",
  koB: "g",
  type: "truth",
  description: "Widerspruch a/g",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-04-01T00:00:00.000Z",
} as Conflict;

function rechne(
  kos: KnowledgeObject[],
  cited: string[],
  zuschnitt?: AntwortZuschnitt,
  konflikte: Conflict[] = [],
) {
  const map = new Map(kos.map((k): [string, KnowledgeObject] => [k.id, k]));
  const answer = {
    answered: true,
    knowledgeClass: "gesichert" as const,
    sources: cited,
    citedSources: cited,
  };
  const evidence = answerEvidence({ answer, sourceKos: map, openConflicts: konflikte });
  return antwortBelastbarkeit({
    answer,
    evidence,
    kos: map,
    openConflicts: konflikte,
    seiteSichtbar: () => true,
    erreichbar: new Map(kos.map((k): [string, boolean] => [k.author, true])),
    namen: new Map(),
    steps: [
      { sourceId: "b", snippet: "  Ventil V4 jährlich  " },
      { sourceId: null, snippet: "frei schwebend" },
    ],
    ...(zuschnitt ? { zuschnitt } : {}),
  });
}

describe("R-1627 · die mehrstufige, quellengebundene Argumentation", () => {
  it("Aussage → Stützung → Einwand → Schluss, jede Stufe an Quelle oder Widerspruch gebunden", () => {
    const b = rechne(
      [ko("a"), ko("b", { trust: 60 }), ko("g", { status: "offen" } as Partial<KnowledgeObject>)],
      ["a", "b"],
      undefined,
      [KONFLIKT],
    );
    expect(b.argumentation.map((s) => s.art)).toEqual([
      "aussage",
      "stuetzung",
      "einwand",
      "schluss",
    ]);
    const [aussage, stuetzung, einwand, schluss] = b.argumentation;
    expect(aussage).toMatchObject({ koId: "a", aussage: "Aussage a", belegstelle: null });
    // Die Belegstelle stammt NUR aus dem Schritt derselben Quelle, getrimmt — nie aus einem
    // quellenlosen Schritt.
    expect(stuetzung).toMatchObject({ koId: "b", belegstelle: "Ventil V4 jährlich" });
    expect(einwand).toEqual({
      art: "einwand",
      konfliktId: "c1",
      seite: expect.objectContaining({ einsehbar: true, koId: "g", traegtAntwort: false }),
    });
    // Ein offener Konflikt auf einer tragenden Quelle lässt die Einstufung nicht „belegt" werden.
    expect(schluss).toEqual({
      art: "schluss",
      lage: "belegt_mit_konflikt",
      einstufung: "unverified",
    });
    // Keine Stufe trägt eine Wahrheitswahrscheinlichkeit (R-0260).
    expect(JSON.stringify(b.argumentation)).not.toMatch(/%|wahrscheinlich|probability/i);
  });

  it("benannte Vorbehalte stehen als eigene Stufen vor dem Schluss", () => {
    const b = rechne([ko("a", { status: "offen" } as Partial<KnowledgeObject>)], ["a"]);
    expect(b.argumentation).toContainEqual({
      art: "vorbehalt",
      grund: "tragende_quelle_nicht_validiert",
    });
    expect(b.argumentation.at(-1)?.art).toBe("schluss");
  });

  it("eine Wissenslücke hat nur den Schluss — keine erfundene Herleitung", () => {
    const answer = {
      answered: false,
      knowledgeClass: "ungeprueft" as const,
      sources: [] as string[],
      citedSources: [] as string[],
    };
    const evidence = answerEvidence({ answer, sourceKos: new Map(), openConflicts: [] });
    const b = antwortBelastbarkeit({ answer, evidence, kos: new Map(), openConflicts: [] });
    expect(b.argumentation).toEqual([{ art: "schluss", lage: "wissensluecke", einstufung: "gap" }]);
  });
});

describe("R-0346 · Rolle und Anlass steuern Tiefe, Fachsprache und Reihenfolge", () => {
  it("Lesende bekommen die kurze, allgemeine Erklärung; Fachrollen die ausführliche", () => {
    expect(antwortZuschnitt("viewer", "frage")).toMatchObject({
      tiefe: "kurz",
      fachsprache: "allgemein",
    });
    expect(antwortZuschnitt("unbekannt", "frage")).toMatchObject({ tiefe: "kurz" });
    for (const rolle of ["experte", "controller", "admin"] as const) {
      expect(antwortZuschnitt(rolle, "frage")).toMatchObject({
        tiefe: "ausfuehrlich",
        fachsprache: "fach",
      });
    }
  });

  it("der Anlass Dokument stellt die bewährte Vorgehensweise vor die Technik", () => {
    expect(antwortZuschnitt("experte", "dokument").reihenfolge[0]).toBe("best_practice");
    expect(antwortZuschnitt("experte", "frage").reihenfolge[0]).toBe("technik");
    expect(antwortZuschnitt("viewer", "frage").reihenfolge[0]).toBe("best_practice");
    // Jede Wissensart kommt in jeder Reihenfolge genau einmal vor; das Bauchgefühl steht zuletzt.
    for (const z of [
      antwortZuschnitt("experte", "dokument"),
      antwortZuschnitt("admin", "frage"),
      antwortZuschnitt("viewer", "frage"),
    ]) {
      expect([...z.reihenfolge].sort()).toEqual(
        ["bauchgefuehl", "best_practice", "lernkurve", "negativwissen", "technik"].sort(),
      );
      expect(z.reihenfolge.at(-1)).toBe("bauchgefuehl");
    }
  });

  it("die Reihenfolge der Wissensarten ordnet die Argumentationsstufen — sonst nichts", () => {
    const technik = ko("t", { type: "technik", trust: 70 });
    const praxis = ko("p", { type: "best_practice", trust: 90 });
    const fach = rechne([technik, praxis], ["p", "t"], antwortZuschnitt("experte", "frage"));
    const dokument = rechne([technik, praxis], ["p", "t"], antwortZuschnitt("experte", "dokument"));
    const tragende = (b: typeof fach): string[] =>
      b.argumentation.flatMap((s) =>
        s.art === "aussage" || s.art === "stuetzung" ? [s.koId] : [],
      );
    expect(tragende(fach)).toEqual(["t", "p"]);
    expect(tragende(dokument)).toEqual(["p", "t"]);
    // Der Zuschnitt ändert weder Lage noch Vertrauenswert noch die Quellenliste.
    expect(fach.lage).toBe(dokument.lage);
    expect(fach.vertrauenswert).toEqual(dokument.vertrauenswert);
    expect(fach.quellen.map((q) => q.koId)).toEqual(dokument.quellen.map((q) => q.koId));
    expect(fach.zuschnitt).toMatchObject({ rolle: "experte", anlass: "frage" });
    expect(dokument.zuschnitt).toMatchObject({ rolle: "experte", anlass: "dokument" });
  });

  it("ohne Angabe gilt die enge Vorgabe: unbekannte Rolle, freie Frage", () => {
    const b = rechne([ko("a")], ["a"]);
    expect(b.zuschnitt).toEqual(antwortZuschnitt("unbekannt", "frage"));
  });
});
