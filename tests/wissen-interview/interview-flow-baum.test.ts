// AUFNAHME 20260922 · WISSEN-INTERVIEW — die DOM-freien Helfer der Oberfläche: wann der Abschluss
// angeboten wird (R-0113), wie Thema/Baum/Bestätigung einen gesicherten Entwurf überleben und wie
// die vertiefenden Antworten wörtlich in die Wissensseite kommen (R-0043, Argus-Herkunft getrennt).
import { describe, expect, it } from "vitest";
import type { InterviewResult } from "../../apps/web/src/api/types";
import { draftArticleHtml } from "../../apps/web/src/lib/captureDraftArticle";
import {
  SKIPPED_ANSWER,
  interviewCanConfirm,
  interviewDepthSections,
  interviewForDraft,
  interviewFromDraft,
  interviewNodeKey,
} from "../../apps/web/src/lib/interviewFlow";

const LEER: InterviewResult["draft"] = {
  title: "",
  statement: "",
  conditions: [],
  measures: [],
  tags: [],
  confidence: 0,
  demo: false,
};

function ergebnis(teil: Partial<InterviewResult>): InterviewResult {
  return { question: "Weiter?", done: false, draft: LEER, demo: false, ...teil };
}

describe("R-0113: der Abschluss wird angeboten, nicht vollzogen", () => {
  it("im Fragebaum erst bei genug Inhalt oder durchlaufenem Baum", () => {
    expect(interviewCanConfirm(true, null)).toBe(false);
    expect(interviewCanConfirm(true, ergebnis({ sufficient: false }))).toBe(false);
    expect(interviewCanConfirm(true, ergebnis({ sufficient: true }))).toBe(true);
    expect(interviewCanConfirm(true, ergebnis({ question: null, done: true }))).toBe(true);
  });

  it("im alten Ablauf ohne Baum gibt es keine Bestätigung (dort bleibt alles wie bisher)", () => {
    expect(interviewCanConfirm(false, ergebnis({ sufficient: true, done: true }))).toBe(false);
  });

  it("eine übersprungene Frage ist eine leere Antwort", () => {
    expect(SKIPPED_ANSWER).toBe("");
  });
});

describe("Fortsetzen: Baum, Thema und Bestätigung überleben den Entwurf", () => {
  it("Roundtrip trägt tree, topic und confirmed", () => {
    const gesichert = interviewForDraft({
      started: true,
      answers: ["Vorwärmen", SKIPPED_ANSWER],
      answer: "",
      result: ergebnis({ question: "Welche Maßnahme?" }),
      tree: true,
      topic: "  Kaltstart Linie 4 ",
      confirmed: false,
    });
    expect(gesichert).toEqual({
      started: true,
      answers: ["Vorwärmen", ""],
      question: "Welche Maßnahme?",
      done: false,
      demo: false,
      tree: true,
      topic: "Kaltstart Linie 4",
    });
    const zurueck = interviewFromDraft(gesichert ?? { started: false, answers: [] }, LEER);
    expect(zurueck.tree).toBe(true);
    expect(zurueck.topic).toBe("Kaltstart Linie 4");
    expect(zurueck.confirmed).toBe(false);
    expect(zurueck.answers).toEqual(["Vorwärmen", ""]);
    expect(zurueck.result?.question).toBe("Welche Maßnahme?");
  });

  it("ein durchlaufener, unbestätigter Baum kommt ohne Ergebnis zurück — der Mensch lädt bewusst nach", () => {
    const zurueck = interviewFromDraft(
      { started: true, answers: ["a", "b", "c"], done: true, demo: true, tree: true },
      LEER,
    );
    expect(zurueck.result).toBeNull();
    const bestaetigt = interviewFromDraft(
      { started: true, answers: ["a", "b", "c"], done: true, tree: true, confirmed: true },
      LEER,
    );
    expect(bestaetigt.result?.done).toBe(true);
    expect(bestaetigt.confirmed).toBe(true);
  });

  it("ein alter Entwurf ohne Baum-Kennung bleibt im alten Ablauf", () => {
    const alt = interviewFromDraft({ started: true, answers: ["a"], question: "Q?" }, LEER);
    expect(alt.tree).toBe(false);
    expect(alt.topic).toBeNull();
    expect(interviewForDraft({ started: true, answers: [], answer: "", result: null })).toEqual({
      started: true,
      answers: [],
    });
  });
});

describe("R-0043 / Argus: die Vertiefung steht wörtlich in der Wissensseite", () => {
  it("je Knoten ein Abschnitt; die Herkunft steht getrennt von der Aussage", () => {
    const abschnitte = interviewDepthSections(
      [
        { node: "schwelle", text: "ab 6 bar" },
        { node: "herkunft", text: "eigene Erfahrung seit 2019" },
        { node: "warum", text: "  " },
      ],
      (node) => interviewNodeKey(node),
    );
    expect(abschnitte).toEqual([
      { heading: "interview.knoten.schwelle", items: ["ab 6 bar"] },
      { heading: "interview.knoten.herkunft", items: ["eigene Erfahrung seit 2019"] },
    ]);
    const html = draftArticleHtml({
      statement: "Ventil X bei Überdruck schließen",
      measures: ["Handventil zu"],
      sections: [
        { heading: "Schwellenwert", items: ["ab 6 bar"] },
        { heading: "Herkunft des Wissens", items: ["eigene Erfahrung seit 2019"] },
      ],
    });
    expect(html).toContain("<h3>Schwellenwert</h3><ul><li>ab 6 bar</li></ul>");
    expect(html).toContain(
      "<h3>Herkunft des Wissens</h3><ul><li>eigene Erfahrung seit 2019</li></ul>",
    );
    // Reihenfolge: Aussage, Maßnahmen, dann die Vertiefung.
    expect(html.indexOf("Maßnahmen")).toBeLessThan(html.indexOf("Schwellenwert"));
  });

  it("ohne Vertiefung bleibt das Artikel-HTML wie bisher", () => {
    const eingabe = { statement: "S", conditions: ["C"], measures: ["M"], tags: ["t"] };
    expect(draftArticleHtml({ ...eingabe, sections: [] })).toBe(draftArticleHtml(eingabe));
  });
});
