// ================================================================================================
// AUFTRAG-mega39 BLOCK D — DIE SEITE DARF KEINE NACHWEISQUALITÄT BEHAUPTEN, DIE ES NICHT GIBT.
// ================================================================================================
//
// ben hat die vier F-Aussagen aus mega38 einzeln nachgeprüft und ALLE VIER bestätigt: `sources` und
// `steps` entstehen 1:1 aus derselben Menge, die Acht ist der Deckel der Retrieval-Auswahl, es gibt
// keinen Rückparser für `[n]`, und der Prompt ERLAUBT Quellenverweise, verlangt sie nicht. Die echte
// Modellierung (zitiert vs. herangezogen) ist ausdrücklich nach Freitag verwiesen. Was HIER fällig
// war: die sichtbare Erklärung auf diese Wahrheit zurückziehen.
//
// D1 — `ask.sourcesHint` behauptete in allen drei Sprachen, der Antworttext nenne die Quellen, auf
//      die er sich stützt. Genau das garantiert der Prompt nicht.
// D2 — „Argumentationsschritte" hiess eine Liste, die dieselben herangezogenen Quellen wiederholt.
//      Entscheidung: AUSBLENDEN, wenn sie nichts trägt, was die Quellenliste nicht schon sagt —
//      und der Name heisst, was es ist. Begründung im Bericht.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { stepsBeyondSources, stepsWorthShowing } from "../../apps/web/src/lib/askSteps";

const SPRACHEN = ["de", "en", "nl"] as const;
const text = (lng: string, key: string): string =>
  String(i18n.getResource(lng, "translation", key) ?? "");

describe("mega39 D1 · der Quellen-Hinweis behauptet nichts über den Antworttext", () => {
  // Die ALTE Zeichenkette je Sprache — wörtlich, damit der Pin nicht an einer Umformulierung
  // vorbeigreift. Wer sie zurückholt, macht diesen Test rot.
  const ALT: Record<(typeof SPRACHEN)[number], string> = {
    de: "der Antworttext nennt die, auf die er sich stützt",
    en: "the answer text names the ones it relies on",
    nl: "de antwoordtekst noemt de bronnen waarop hij steunt",
  };

  for (const lng of SPRACHEN) {
    it(`${lng}: die widerlegte Zusage steht nicht mehr im Hinweis`, () => {
      const hinweis = text(lng, "ask.sourcesHint");
      expect(hinweis.length, "der Hinweis fehlt ganz").toBeGreaterThan(0);
      expect(hinweis).not.toContain(ALT[lng]);
    });
  }

  it("die tragende Aussage bleibt erhalten — quellengebunden und nur so belastbar wie die Quelle", () => {
    // Der Hinweis wurde ZURÜCKGEZOGEN, nicht ausgeräumt: die ehrliche Kernaussage steht weiter.
    expect(text("de", "ask.sourcesHint")).toContain("quellengebunden");
    expect(text("en", "ask.sourcesHint")).toContain("source-bound");
    expect(text("nl", "ask.sourcesHint")).toContain("brongebonden");
  });
});

describe("mega39 D2 · die Liste heisst, was sie ist — und erscheint nur, wenn sie etwas trägt", () => {
  it("kein Wort mehr, das eine protokollierte Herleitung verspricht (DE/EN/NL)", () => {
    expect(text("de", "ask.steps")).not.toContain("Argumentationsschritte");
    expect(text("en", "ask.steps")).not.toContain("Reasoning steps");
    expect(text("nl", "ask.steps")).not.toContain("Argumentatiestappen");
    // Und der Erklärtext daneben verspricht keine Schritt-für-Schritt-Herleitung mehr.
    expect(text("de", "shelp.ask.steps")).not.toContain("Schritt für Schritt");
    expect(text("en", "shelp.ask.steps")).not.toContain("step by step");
    expect(text("nl", "shelp.ask.steps")).not.toContain("stap voor stap");
  });

  for (const lng of SPRACHEN) {
    it(`${lng}: Titel und Erklärtext sind vorhanden (kein leerer Schlüssel als Ersatz)`, () => {
      expect(text(lng, "ask.steps").length).toBeGreaterThan(0);
      expect(text(lng, "shelp.ask.steps").length).toBeGreaterThan(0);
    });
  }

  // ── Die Ausblend-Regel, DOM-frei ───────────────────────────────────────────────────────────────
  const quellen = [{ id: "ko-1" }, { id: "ko-2" }];

  it("der REALE Fall: jeder Schritt zeigt auf eine gelistete Quelle → die Liste entfällt", () => {
    const steps = [
      { sourceId: "ko-1", description: "Ventilprüfung L4", snippet: "jährlich" },
      { sourceId: "ko-2", description: "Wartungsplan", snippet: "Q3" },
    ];
    expect(stepsWorthShowing(steps, quellen)).toBe(false);
    expect(stepsBeyondSources(steps, quellen)).toEqual([]);
  });

  it("ausblenden heisst NICHT 'immer weg' — eine Fundstelle ausserhalb der Quellenliste bleibt", () => {
    const steps = [
      { sourceId: "ko-1", description: "Ventilprüfung L4", snippet: "jährlich" },
      { sourceId: "ko-9", description: "Nicht in der Quellenliste", snippet: "x" },
    ];
    expect(stepsWorthShowing(steps, quellen)).toBe(true);
    // Und sichtbar wird GENAU der eine — nicht wieder die ganze Wiederholung.
    expect(stepsBeyondSources(steps, quellen).map((s) => s.sourceId)).toEqual(["ko-9"]);
  });

  it("ein Schritt ganz OHNE Quellenbezug ist die einzige Fundstelle für seine Angabe → bleibt", () => {
    const steps = [{ description: "Kein Quellenbezug" }];
    expect(stepsWorthShowing(steps, quellen)).toBe(true);
  });

  it("Leerfälle sind still: keine Schritte, keine Quellen → nichts zu zeigen", () => {
    expect(stepsWorthShowing([], quellen)).toBe(false);
    expect(stepsWorthShowing(undefined, undefined)).toBe(false);
    // Ohne Quellenliste trägt jeder Schritt seine Angabe allein — dann bleibt er sichtbar.
    expect(stepsWorthShowing([{ sourceId: "ko-1", description: "x" }], [])).toBe(true);
  });
});
