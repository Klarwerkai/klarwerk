// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — ARGUMENTATIONSKETTE (R-1627) UND ZUSCHNITT (R-0346).
// ================================================================================================
//
// Gemessen an der reinen Rechnung `antwortBelastbarkeit` (services/ask/src/answer-belastbarkeit.ts):
//   R-1627/R-0281  Kette Aussagen → belegte Beziehungen → Einwand → Vorbehalt → Schluss, jede Stufe
//                  an eine Quelle, eine kuratierte Kante, einen Widerspruch oder einen benannten
//                  Grund gebunden; Belegstelle nur aus `steps[].snippet` der gleichen Quelle; der
//                  Schluss trägt die Antwortaussage; keine Wahrheitswahrscheinlichkeit.
//   R-0346         Rolle und Anlass steuern Tiefe, Fachsprache und die Reihenfolge der Wissensarten.
import { describe, expect, it } from "vitest";
import {
  type AntwortZuschnitt,
  type BelegteBeziehung,
  answerEvidence,
  antwortBelastbarkeit,
  antwortZuschnitt,
  schneideAntwortZu,
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

function kante(
  teil: Partial<BelegteBeziehung> & Pick<BelegteBeziehung, "quelleId" | "zielId">,
): BelegteBeziehung {
  return {
    id: `k-${teil.quelleId}-${teil.zielId}`,
    art: "ergaenzt" as const,
    richtung: "gerichtet" as const,
    urheber: "kurator-1",
    status: "aktiv" as const,
    ...teil,
  };
}

function rechne(
  kos: KnowledgeObject[],
  cited: string[],
  zuschnitt?: AntwortZuschnitt,
  konflikte: Conflict[] = [],
  beziehungen: BelegteBeziehung[] = [],
  antworttext: string | null = "Ventil V4 jährlich prüfen.",
) {
  const map = new Map(kos.map((k): [string, KnowledgeObject] => [k.id, k]));
  const answer = {
    answered: true,
    knowledgeClass: "gesichert" as const,
    sources: cited,
    citedSources: cited,
    answer: antworttext,
  };
  const evidence = answerEvidence({ answer, sourceKos: map, openConflicts: konflikte });
  return antwortBelastbarkeit({
    answer,
    evidence,
    kos: map,
    openConflicts: konflikte,
    seiteSichtbar: () => true,
    erreichbar: new Map(kos.map((k): [string, boolean] => [k.author, true])),
    namen: new Map([["kurator-1", "Kim Kurator"]]),
    steps: [
      { sourceId: "b", snippet: "  Ventil V4 jährlich  " },
      { sourceId: null, snippet: "frei schwebend" },
    ],
    beziehungen,
    ...(zuschnitt ? { zuschnitt } : {}),
  });
}

describe("R-1627 · die mehrstufige, quellengebundene Argumentation", () => {
  it("Aussagen → Einwand → Schluss mit Antwortaussage, jede Stufe an Quelle oder Widerspruch gebunden", () => {
    const b = rechne(
      [ko("a"), ko("b", { trust: 60 }), ko("g", { status: "offen" } as Partial<KnowledgeObject>)],
      ["a", "b"],
      undefined,
      [KONFLIKT],
    );
    expect(b.argumentation.map((s) => s.art)).toEqual(["aussage", "aussage", "einwand", "schluss"]);
    const [aussageA, aussageB, einwand, schluss] = b.argumentation;
    expect(aussageA).toMatchObject({ koId: "a", aussage: "Aussage a", belegstelle: null });
    // Die Belegstelle stammt NUR aus dem Schritt derselben Quelle, getrimmt — nie aus einem
    // quellenlosen Schritt.
    expect(aussageB).toMatchObject({ koId: "b", belegstelle: "Ventil V4 jährlich" });
    expect(einwand).toEqual({
      art: "einwand",
      konfliktId: "c1",
      seite: expect.objectContaining({ einsehbar: true, koId: "g", traegtAntwort: false }),
    });
    // Ein offener Konflikt auf einer tragenden Quelle lässt die Einstufung nicht „belegt" werden.
    // Der Schluss trägt die INHALTLICHE Schlussfolgerung — die gegebene Antwortaussage — und die
    // Quellen, auf die sie gestützt ist. Ohne belegte Beziehung stehen diese ausdrücklich unabhängig.
    expect(schluss).toEqual({
      art: "schluss",
      lage: "belegt_mit_konflikt",
      einstufung: "unverified",
      aussage: "Ventil V4 jährlich prüfen.",
      gestuetztAuf: ["a", "b"],
      unabhaengig: true,
    });
    // Keine Stufe trägt eine Wahrheitswahrscheinlichkeit (R-0260).
    expect(JSON.stringify(b.argumentation)).not.toMatch(/%|wahrscheinlich|probability/i);
  });

  it("Ben nacharbeit-9: die Listenposition stiftet keine Stützung — vertauscht bleibt alles gleichrangig", () => {
    const kos = [ko("a"), ko("b")];
    const vorwaerts = rechne(kos, ["a", "b"]);
    const rueckwaerts = rechne(kos, ["b", "a"]);
    for (const b of [vorwaerts, rueckwaerts]) {
      expect(b.argumentation.filter((s) => s.art === "aussage")).toHaveLength(2);
      expect(b.argumentation.some((s) => s.art === "beziehung")).toBe(false);
      expect(b.argumentation.at(-1)).toMatchObject({ art: "schluss", unabhaengig: true });
    }
  });

  it("eine Beziehung steht nur aus einer aktiven kuratierten Kante zwischen zwei tragenden Quellen", () => {
    const kos = [ko("a"), ko("b"), ko("x")];
    const kanten = [
      kante({ quelleId: "b", zielId: "a", art: "ergaenzt" }),
      // widerrufen → keine Beziehung
      kante({ id: "k-w", quelleId: "a", zielId: "b", art: "ersetzt", status: "widerrufen" }),
      // ein Ende keine tragende Quelle → keine Beziehung
      kante({ quelleId: "a", zielId: "x", art: "gehoert_zu" }),
    ];
    const b = rechne(kos, ["a", "b"], undefined, [], kanten);
    const beziehungen = b.argumentation.filter((s) => s.art === "beziehung");
    expect(beziehungen).toEqual([
      {
        art: "beziehung",
        kanteId: "k-b-a",
        beziehung: "ergaenzt",
        gerichtet: true,
        vonKoId: "b",
        vonTitel: "Wissen b",
        zuKoId: "a",
        zuTitel: "Wissen a",
        gesetztVon: "Kim Kurator",
      },
    ]);
    // Beide Aussagen sind durch die belegte Beziehung verbunden — nicht mehr unabhängig.
    expect(b.argumentation.at(-1)).toMatchObject({
      art: "schluss",
      gestuetztAuf: ["a", "b"],
      unabhaengig: false,
    });
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
    expect(b.argumentation).toEqual([
      {
        art: "schluss",
        lage: "wissensluecke",
        einstufung: "gap",
        aussage: null,
        gestuetztAuf: [],
        unabhaengig: false,
      },
    ]);
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
      b.argumentation.flatMap((s) => (s.art === "aussage" ? [s.koId] : []));
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

// Ben nacharbeit-9, Befund 2: der Zuschnitt wirkt auf die ANTWORT selbst — nur mit Wörtlichem aus
// den tragenden Quellen und Definitionen aus dem Firmenwörterbuch.
describe("R-0346 · der Zuschnitt verändert die Antwort, quellengebunden", () => {
  const technik = ko("t", {
    type: "technik",
    title: "Druckprüfung",
    conditions: ["Anlage drucklos"],
    measures: ["Ventil V4 prüfen", "Dichtung tauschen"],
  } as Partial<KnowledgeObject>);
  const praxis = ko("p", {
    type: "best_practice",
    title: "Freigabe",
    measures: ["Freigabe durch Schichtleitung"],
  } as Partial<KnowledgeObject>);
  const antwort = "Ventil V4 prüfen, bevor der Kessel wieder anläuft.";
  const KESSEL = {
    eintragId: "begriff-kessel",
    fassung: 3,
    geltungsbereich: "Werk Nord",
    verantwortlich: "Instandhaltung",
    geaendertAm: "2026-09-01T00:00:00.000Z",
  };
  const begriffe = [
    { benennung: "Kessel", definition: "Druckbehälter der Dampfanlage.", herkunft: KESSEL },
    {
      benennung: "Turbine",
      definition: "Kommt in der Antwort nicht vor.",
      herkunft: { ...KESSEL, eintragId: "begriff-turbine" },
    },
  ];

  it("Fachrolle: ausführlich — wörtliche Voraussetzungen und Maßnahmen, keine Begriffserklärung", () => {
    const z = schneideAntwortZu(
      antwort,
      [technik],
      antwortZuschnitt("experte", "frage"),
      begriffe,
      "de",
    );
    expect(z.ergaenzungen).toEqual([
      { art: "voraussetzungen", quelleId: "t", eintraege: ["Anlage drucklos"] },
      // „Ventil V4 prüfen" steht schon in der Antwort und wird nicht noch einmal angehängt.
      { art: "massnahmen", quelleId: "t", eintraege: ["Dichtung tauschen"] },
    ]);
    expect(z.text.startsWith(antwort)).toBe(true);
    expect(z.text).toContain("Voraussetzungen (Druckprüfung):\n- Anlage drucklos");
    expect(z.text).toContain("Maßnahmen (Druckprüfung):\n- Dichtung tauschen");
    expect(z.text).not.toContain("Begriffe:");
    // Voraussetzungen und Maßnahmen stammen aus der tragenden Quelle — sie gehören zum Schluss.
    expect(z.quellengebunden).toBe(z.text);
  });

  it("Lesende: kurz und allgemein — nur Wörterbuchbegriffe, die in der Antwort vorkommen", () => {
    const z = schneideAntwortZu(
      antwort,
      [technik],
      antwortZuschnitt("viewer", "frage"),
      begriffe,
      "de",
    );
    // Ben nacharbeit-11: die Erklärung trägt die Herkunft ihres Wörterbucheintrags — keine
    // Wissensobjekt-Quelle (quelleId null), sondern Eintrag, Fassung, Geltungsbereich, Verantwortung.
    expect(z.ergaenzungen).toEqual([
      {
        art: "begriffe",
        quelleId: null,
        eintraege: ["Kessel: Druckbehälter der Dampfanlage."],
        benennungen: ["Kessel"],
        herkunft: [KESSEL],
      },
    ]);
    // Am Text: abgegrenzt von der Quellenbilanz und je Zeile zugeordnet.
    expect(z.text).toContain(
      "Begriffe (aus dem Firmenwörterbuch, nicht Teil der Quellenbilanz):\n" +
        "- Kessel: Druckbehälter der Dampfanlage. " +
        "[Wörterbucheintrag begriff-kessel, Fassung 3, Werk Nord, verantwortlich: Instandhaltung]",
    );
    expect(z.text).not.toContain("Dichtung tauschen");
    expect(z.text).not.toContain("Turbine");
    // Ben nacharbeit-13: der quellengebundene Teil enthält KEINE Wörterbucherklärung.
    expect(z.quellengebunden).toBe(antwort);
  });

  it("fehlende Herkunftsangaben des Eintrags werden nicht erfunden", () => {
    const ohne = [
      {
        benennung: "Kessel",
        definition: "Druckbehälter der Dampfanlage.",
        herkunft: { ...KESSEL, geltungsbereich: null, verantwortlich: null, geaendertAm: null },
      },
    ];
    const z = schneideAntwortZu(antwort, [], antwortZuschnitt("viewer", "frage"), ohne, "de");
    expect(z.text).toContain(
      "- Kessel: Druckbehälter der Dampfanlage. [Wörterbucheintrag begriff-kessel, Fassung 3]",
    );
    expect(z.text).not.toContain("verantwortlich");
  });

  it("die Reihenfolge der Wissensarten ordnet die Ergänzungen — Anlass Dokument: Praxis vor Technik", () => {
    const fach = schneideAntwortZu(
      antwort,
      [technik, praxis],
      antwortZuschnitt("experte", "frage"),
      [],
      "de",
    );
    const dokument = schneideAntwortZu(
      antwort,
      [technik, praxis],
      antwortZuschnitt("experte", "dokument"),
      [],
      "de",
    );
    expect(fach.ergaenzungen.map((e) => e.quelleId)).toEqual(["t", "t", "p"]);
    expect(dokument.ergaenzungen.map((e) => e.quelleId)).toEqual(["p", "t", "t"]);
    expect(dokument.text.indexOf("Freigabe durch Schichtleitung")).toBeLessThan(
      dokument.text.indexOf("Dichtung tauschen"),
    );
  });

  it("nichts zu ergänzen → die Antwort bleibt Zeichen für Zeichen dieselbe", () => {
    const z = schneideAntwortZu(antwort, [ko("a")], antwortZuschnitt("admin", "frage"), [], "de");
    expect(z).toEqual({ text: antwort, quellengebunden: antwort, ergaenzungen: [] });
  });
});
