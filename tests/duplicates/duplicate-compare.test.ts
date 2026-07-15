import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject, OverlapEntry } from "../../apps/web/src/api/types";
import {
  DUPLICATE_COMPARE_SAFETY,
  buildDuplicateCompareSections,
  compareHeadline,
  overallFromOverlap,
} from "../../apps/web/src/lib/duplicateCompare";

const ko = (id: string, overrides: Partial<KnowledgeObject> = {}): KnowledgeObject =>
  ({
    id,
    title: `Titel ${id}`,
    statement: "Maschine nur nach Sicherheitspruefung starten.",
    bodyHtml: null,
    conditions: ["Sicherheitspruefung abgeschlossen"],
    measures: ["Start dokumentieren"],
    type: "technik",
    category: "Betrieb",
    tags: ["sicherheit"],
    confidence: 0,
    trust: 42,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    sources: [],
    attachments: [],
    comments: [],
    ...overrides,
  }) as KnowledgeObject;

const overlap = (overrides: Partial<OverlapEntry> = {}): OverlapEntry => ({
  id: "dup-1",
  koA: "a",
  koB: "b",
  relation: "teilweise",
  aspects: [],
  eigenanteilA: "",
  eigenanteilB: "",
  recommendation: "zusammenfuehren_pruefen",
  status: "offen",
  pairKey: "dup|a|b",
  origin: "auto",
  createdAt: "2026-07-07T10:00:00.000Z",
  ...overrides,
});

describe("KW-DUP-02: read-only duplicate comparison", () => {
  it("baut Abschnittsampeln fuer Objekt A und B", () => {
    const sections = buildDuplicateCompareSections(
      ko("a"),
      ko("b", { conditions: ["Sicherheitspruefung fehlt"], tags: ["betrieb"] }),
    );
    expect(sections.map((section) => section.label)).toEqual([
      "Titel",
      "Kernaussage / Inhalt",
      "Bedingungen",
      "Massnahmen",
      "Hinweise",
      "Quellen / Evidence",
      "Tags / Kategorie",
      "Trust / Validierungsstatus",
    ]);
    expect(sections.some((section) => section.tone === "red" || section.tone === "yellow")).toBe(
      true,
    );
  });

  it("nutzt vorhandene Detector-Textdeckung, markiert Konflikt/Unsicherheit aber als vorlaeufig", () => {
    const sections = buildDuplicateCompareSections(ko("a"), ko("b"));
    const overall = overallFromOverlap(
      overlap({ detector: { trigger: "validation", method: "deterministic", lexicalScore: 0.91 } }),
      sections,
    );
    expect(overall.match).toBe(91);
    expect(overall.source).toBe("mixed");
    expect(overall.note).toContain("vorlaeufige Anzeigehilfe");
  });

  it("zeigt fehlende echte Scores ehrlich als vorlaeufige Feldheuristik", () => {
    const sections = buildDuplicateCompareSections(ko("a"), ko("b"));
    const overall = overallFromOverlap(overlap(), sections);
    expect(overall.source).toBe("heuristic");
    expect(overall.note).toContain("Score nicht vorhanden");
  });

  it("hat keine aktiven Merge-, Delete-, Auto-Validate-, Persistenz- oder KI-Aktionen", () => {
    expect(DUPLICATE_COMPARE_SAFETY).toEqual({
      mergeEnabled: false,
      deleteEnabled: false,
      autoValidateEnabled: false,
      persistDecisions: false,
      aiActionEnabled: false,
    });
  });

  it("verdrahtet eine Deep-Link-Route und keine mutierenden Duplicate-Endpunkte in der Vergleichsseite", () => {
    const routes = readFileSync("apps/web/src/routes.tsx", "utf8");
    const page = readFileSync("apps/web/src/pages/DuplicateCompare.tsx", "utf8");
    expect(routes).toContain("/duplikate/:id/vergleich");
    expect(routes).toContain("/konflikte/:id/vergleich");
    expect(page).toContain("Merge spaeter");
    expect(page).not.toContain("endpoints.duplicates.dismiss");
    expect(page).not.toContain("endpoints.duplicates.keepSeparate");
    expect(page).not.toContain("endpoints.duplicates.linkRelated");
    expect(page).not.toContain("endpoints.ko.act");
    expect(page).not.toContain("endpoints.ko.remove");
  });
});

// SCRUM-486 B: ehrliche Rahmung der Prozentzahlen — EINE führende Zahl (Text-Ähnlichkeit = match);
// der frühere „Konflikt"-Wert wird als „Textunterschied" geführt (kein bewiesener Widerspruch).
describe("SCRUM-486 B: compareHeadline", () => {
  it("führt mit der Text-Ähnlichkeit (match) und benennt Konflikt ehrlich als Textunterschied", () => {
    const head = compareHeadline({
      match: 72,
      conflict: 18,
      uncertainty: 10,
      source: "heuristic",
      note: "x",
    });
    expect(head.leadPercent).toBe(72);
    expect(head.differencePercent).toBe(18);
    expect(head.uncertaintyPercent).toBe(10);
  });
});
