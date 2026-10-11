// FUNKE (nacht24 Paket 6, SCRUM-477/529): pure Logik der Wirkungs-Schleife — Zitat-Zähler,
// Lücken-Liste aus echten Gaps, Wissenskapital-Zahlen aus dem Bestand + i18n DE/EN/NL.
import { describe, expect, it } from "vitest";
import type { Gap } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { knowledgeCapital } from "../../apps/web/src/lib/funke";
import { computeMyImpact } from "../../services/app/src/impact";

describe("FUNKE F1: computeMyImpact (Zitat-/Danke-Zähler, pure)", () => {
  const kos = [
    { id: "a", author: "me", status: "validiert" },
    { id: "b", author: "me", status: "offen" },
    { id: "x", author: "other", status: "validiert" },
  ];

  it("zählt eigene Beiträge/Validierungen, Zitate (nur beantwortete) und fremdes Danke", () => {
    const impact = computeMyImpact(
      "me",
      kos,
      [
        { actor: "colleague", target: "a" }, // fremdes Danke auf eigenes KO → zählt
        { actor: "me", target: "a" }, // eigener Klick → zählt NICHT (keine Selbst-Wirkung)
        { actor: "colleague", target: "x" }, // fremdes KO → zählt nicht
      ],
      [
        { actor: "colleague", target: "a", payload: { answered: true } }, // Zitat eigenes KO
        { actor: "colleague", target: "a", payload: { answered: false } }, // unbeantwortet → nein
        { actor: "colleague", target: "x", payload: { answered: true } }, // fremdes KO → nein
      ],
    );
    expect(impact).toEqual({ contributions: 2, validated: 1, cited: 1, helpfulReceived: 1 });
  });

  it("ohne eigene Beiträge und Belege: ehrliche Nullen (nichts erfunden)", () => {
    expect(computeMyImpact("neu", kos, [], [])).toEqual({
      contributions: 0,
      validated: 0,
      cited: 0,
      helpfulReceived: 0,
    });
  });
});

function gap(overrides: Partial<Gap>): Gap {
  return {
    id: Math.random().toString(36).slice(2),
    question: "Wie entlüftet man Pumpe P3?",
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

// R-1349 (Aufnahme gesamt-aufruferwaechter): Der Block zu F3 `openGapsView` ist mit dem Baustein
// entfallen — er hatte keinen Produktleser; die Fläche zeigt die offenen Lücken als Zahl
// (`OpenGapsSummary`), die `knowledgeCapital` unten mitzählt.

describe("FUNKE F5: knowledgeCapital (nur echte Bestandszahlen)", () => {
  it("gesichert/validiert/Themenfelder(validiert)/Wissensträger/offene Lücken", () => {
    const capital = knowledgeCapital(
      [
        { status: "validiert", category: "Pumpen", author: "anna" },
        { status: "validiert", category: "Pumpen", author: "ben" },
        { status: "offen", category: "Ventile", author: "anna" },
      ],
      [gap({}), gap({ status: "geschlossen" })],
    );
    expect(capital).toEqual({
      secured: 3,
      validated: 2,
      // AUFTRAG-mega38 BLOCK G2: „davon offen" kam aus dem gestrichenen Kennzahlen-Block hierher.
      open: 1,
      answerableCategories: 1, // nur Pumpen hat validiertes Wissen — Ventile ist (noch) nicht beantwortbar
      activeAuthors: 2,
      openGaps: 1,
    });
    expect(knowledgeCapital([], [])).toEqual({
      secured: 0,
      validated: 0,
      open: 0,
      answerableCategories: 0,
      activeAuthors: 0,
      openGaps: 0,
    });
  });
});

describe("FUNKE: i18n DE/EN/NL vollständig", () => {
  it("alle funke.*-Schlüssel existieren in drei Sprachen", () => {
    const keys = [
      "funke.sourceAuthor",
      "funke.impact.title",
      "funke.impact.contributions",
      "funke.impact.validated",
      "funke.impact.cited",
      "funke.impact.helpful",
      "funke.impact.hint",
      "funke.gaps.title",
      "funke.gaps.count",
      "funke.gaps.answerCta",
      "funke.gaps.more",
      "funke.capital.title",
      "funke.capital.secured",
      "funke.capital.validated",
      "funke.capital.categories",
      "funke.capital.authors",
      "funke.capital.gaps",
      "funke.capital.hint",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
