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

// SCRUM-513/487 (WP5): die Lib lokalisiert die Werte jetzt über eine injizierte t-Funktion (DOM-frei,
// ohne react-i18next). Dieser Fake spiegelt die realen DE-Strings der genutzten Keys, sodass die
// bestehenden DE-Erwartungen unverändert gelten und die Interpolation mitgeprüft wird.
const t = (key: string, opts?: Record<string, unknown>): string => {
  const de: Record<string, string> = {
    "dcmp.noValue": "Kein Wert vorhanden",
    "dcmp.none": "keine",
    "dcmp.trustStatus": "Trust {{trust}}; Status {{status}}; benötigte Prüfungen {{needed}}",
    "dcmp.tagsCategory": "Kategorie {{category}}; Wissensart {{type}}; Tags {{tags}}",
    "status.offen": "Offen",
    "status.validiert": "Validiert",
    "ktype.technik": "Technik",
    "ktype.bauchgefuehl": "Intuition",
    "ktype.best_practice": "Best Practice",
    "ktype.lernkurve": "Lernkurve",
    "ktype.negativwissen": "Negativwissen",
  };
  let out = de[key] ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      out = out.replace(new RegExp(`{{${k}}}`, "g"), String(v));
    }
  }
  return out;
};

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
      t,
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
    const sections = buildDuplicateCompareSections(ko("a"), ko("b"), t);
    const overall = overallFromOverlap(
      overlap({ detector: { trigger: "validation", method: "deterministic", lexicalScore: 0.91 } }),
      sections,
    );
    expect(overall.match).toBe(91);
    expect(overall.source).toBe("mixed");
    // SCRUM-487 (i18n): note ist jetzt ein stabiler i18n-Key, die Ansicht macht t(...).
    expect(overall.note).toBe("dcmp.note.mixedOverlap");
  });

  it("zeigt fehlende echte Scores ehrlich als vorlaeufige Feldheuristik", () => {
    const sections = buildDuplicateCompareSections(ko("a"), ko("b"), t);
    const overall = overallFromOverlap(overlap(), sections);
    expect(overall.source).toBe("heuristic");
    expect(overall.note).toBe("dcmp.note.noScore");
  });

  // SCRUM-487 (i18n): reason/note sind stabile i18n-Keys (dcmp.reason.* / dcmp.note.*), keine Sätze.
  it("liefert reason/note als i18n-Keys, nicht als fertige Sätze", () => {
    const sections = buildDuplicateCompareSections(
      ko("a"),
      ko("b", {
        conditions: ["Sicherheitspruefung fehlt"],
        statement: "Ganz anderer Inhalt hier.",
      }),
      t,
    );
    for (const section of sections) {
      expect(section.reason).toMatch(/^dcmp\.reason\./);
      expect(section.metrics.note).toMatch(/^dcmp\.note\./);
    }
    // Die DE-Werte der Keys stehen gepinnt in i18n.ts (ehrliche Rahmung „vorläufige Feldheuristik").
    const i18nSource = readFileSync("apps/web/src/i18n.ts", "utf8");
    expect(i18nSource).toContain('"dcmp.reason.identical": "Die Werte sind identisch."');
    expect(i18nSource).toContain(
      '"dcmp.note.heuristic": "Vorläufige Feldheuristik; keine fachliche Wahrheit."',
    );
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
    expect(page).not.toContain("endpoints.duplicates.dismiss");
    expect(page).not.toContain("endpoints.duplicates.keepSeparate");
    expect(page).not.toContain("endpoints.duplicates.linkRelated");
    expect(page).not.toContain("endpoints.ko.act");
    expect(page).not.toContain("endpoints.ko.remove");
  });

  // SCRUM-486 C: keine internen MVP-/Safety-Rohtexte und kein Roh-UUID in der Nutzersicht.
  it("zeigt keine internen MVP-/Safety-Rohtexte und einen kind-abhaengigen Titel", () => {
    const page = readFileSync("apps/web/src/pages/DuplicateCompare.tsx", "utf8");
    expect(page).not.toContain("Merge spaeter");
    expect(page).not.toContain("Merge aktiv");
    expect(page).not.toContain("KW-DUP-02");
    expect(page).not.toContain("Read-only MVP");
    expect(page).not.toContain("Wissensobjekt nicht gefunden");
    // SCRUM-487 (i18n): Kind-abhängiger Titel + neutraler „entfernt"-Hinweis jetzt über t()-Keys.
    expect(page).toContain("dcmp.titleConflict");
    expect(page).toContain("dcmp.objectRemoved");
  });

  // SCRUM-486 C: Status/Wissensart als Klartext-Label in den Vergleichsabschnitten, kein Roh-Enum.
  it("nutzt Klartext-Label fuer Status und Wissensart (kein Roh-Enum)", () => {
    const sections = buildDuplicateCompareSections(ko("a"), ko("b"), t);
    const trustSection = sections.find((s) => s.label === "Trust / Validierungsstatus");
    expect(trustSection?.leftValue).toContain("Status Offen");
    expect(trustSection?.leftValue).toContain("benötigte Prüfungen");
    expect(trustSection?.leftValue).not.toContain("Status offen");
    expect(trustSection?.leftValue).not.toContain("benoetigte Validierungen");
    const tagsSection = sections.find((s) => s.label === "Tags / Kategorie");
    expect(tagsSection?.leftValue).toContain("Wissensart Technik");
    expect(tagsSection?.leftValue).not.toContain("Wissensart technik");
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
