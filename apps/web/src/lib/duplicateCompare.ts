import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";

export type CompareTone = "green" | "yellow" | "red";
export type CompareScoreSource = "detector" | "heuristic" | "mixed";

export interface CompareMetrics {
  match: number;
  conflict: number;
  uncertainty: number;
  source: CompareScoreSource;
  // SCRUM-487 (i18n): stabiler i18n-Key (dcmp.note.*), KEIN fertiger Satz — die Ansicht macht t(...).
  note: string;
}

export interface CompareSection {
  key: string;
  label: string;
  leftValue: string;
  rightValue: string;
  metrics: CompareMetrics;
  tone: CompareTone;
  // SCRUM-487 (i18n): stabiler i18n-Key (dcmp.reason.*), KEIN fertiger Satz — die Ansicht macht t(...).
  reason: string;
}

export const DUPLICATE_COMPARE_SAFETY = {
  mergeEnabled: false,
  deleteEnabled: false,
  autoValidateEnabled: false,
  persistDecisions: false,
  aiActionEnabled: false,
} as const;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string | null | undefined): string {
  return compact((value ?? "").replace(/<[^>]*>/g, " "));
}

function tokens(value: string): Set<string> {
  const parts = compact(value.toLowerCase())
    .split(/[^a-z0-9]+/i)
    .filter((part) => part.length > 1);
  return new Set(parts);
}

function tokenSimilarity(left: string, right: string): number {
  const a = tokens(left);
  const b = tokens(right);
  if (a.size === 0 && b.size === 0) {
    return 1;
  }
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function compareText(leftValue: string, rightValue: string, label: string): CompareSection {
  const left = compact(leftValue);
  const right = compact(rightValue);
  if (!left && !right) {
    return {
      key: label,
      label,
      leftValue: "Kein Wert vorhanden",
      rightValue: "Kein Wert vorhanden",
      metrics: {
        match: 0,
        conflict: 0,
        uncertainty: 100,
        source: "heuristic",
        note: "dcmp.note.bothEmpty",
      },
      tone: "yellow",
      reason: "dcmp.reason.bothEmpty",
    };
  }
  if (left === right) {
    return {
      key: label,
      label,
      leftValue: left || "Kein Wert vorhanden",
      rightValue: right || "Kein Wert vorhanden",
      metrics: {
        match: 100,
        conflict: 0,
        uncertainty: 0,
        source: "heuristic",
        note: "dcmp.note.exactMatch",
      },
      tone: "green",
      reason: "dcmp.reason.identical",
    };
  }
  if (!left || !right) {
    return {
      key: label,
      label,
      leftValue: left || "Kein Wert vorhanden",
      rightValue: right || "Kein Wert vorhanden",
      metrics: {
        match: 0,
        conflict: 0,
        uncertainty: 100,
        source: "heuristic",
        note: "dcmp.note.oneMissing",
      },
      tone: "yellow",
      reason: "dcmp.reason.oneMissing",
    };
  }
  const match = clampPercent(tokenSimilarity(left, right) * 100);
  const conflict = match < 35 ? 60 : match < 65 ? 30 : 5;
  const uncertainty = clampPercent(100 - match - conflict);
  return {
    key: label,
    label,
    leftValue: left,
    rightValue: right,
    metrics: {
      match,
      conflict,
      uncertainty,
      source: "heuristic",
      note: "dcmp.note.heuristic",
    },
    tone: conflict >= 50 ? "red" : match >= 85 ? "green" : "yellow",
    reason: conflict >= 50 ? "dcmp.reason.strongDiff" : "dcmp.reason.partialDiff",
  };
}

function joinList(values: readonly string[] | undefined): string {
  return (values ?? []).filter((value) => value.trim().length > 0).join("; ");
}

function sourceText(ko: KnowledgeObject): string {
  return (ko.sources ?? [])
    .map((source) =>
      [source.label, source.excerpt ?? "", source.url ?? ""].filter(Boolean).join(" | "),
    )
    .join("; ");
}

function hintsText(ko: KnowledgeObject): string {
  return (ko.comments ?? []).map((comment) => comment.text).join("; ");
}

// SCRUM-486 C: keine Roh-Enums in der Nutzersicht — Status/Wissensart als Klartext-Label. Deutsche
// Inline-Labels (DOM-frei, testbar), passend zur bereits deutschsprachigen Vergleichsseite.
const STATUS_LABEL: Record<string, string> = {
  offen: "Offen",
  validiert: "Validiert",
};
const TYPE_LABEL: Record<string, string> = {
  bauchgefuehl: "Intuition",
  best_practice: "Best Practice",
  lernkurve: "Lernkurve",
  technik: "Technik",
  negativwissen: "Negativwissen",
};

function trustStatusText(ko: KnowledgeObject): string {
  const status = STATUS_LABEL[ko.status] ?? ko.status;
  return `Trust ${ko.trust}; Status ${status}; benötigte Prüfungen ${ko.neededValidations}`;
}

function tagsCategoryText(ko: KnowledgeObject): string {
  const type = TYPE_LABEL[ko.type] ?? ko.type;
  return [
    `Kategorie ${ko.category || "keine"}`,
    `Wissensart ${type}`,
    `Tags ${(ko.tags ?? []).join(", ") || "keine"}`,
  ].join("; ");
}

export function buildDuplicateCompareSections(
  left: KnowledgeObject,
  right: KnowledgeObject,
): CompareSection[] {
  return [
    compareText(left.title, right.title, "Titel"),
    compareText(
      [left.statement, stripHtml(left.bodyHtml)].filter(Boolean).join(" "),
      [right.statement, stripHtml(right.bodyHtml)].filter(Boolean).join(" "),
      "Kernaussage / Inhalt",
    ),
    compareText(joinList(left.conditions), joinList(right.conditions), "Bedingungen"),
    compareText(joinList(left.measures), joinList(right.measures), "Massnahmen"),
    compareText(hintsText(left), hintsText(right), "Hinweise"),
    compareText(sourceText(left), sourceText(right), "Quellen / Evidence"),
    compareText(tagsCategoryText(left), tagsCategoryText(right), "Tags / Kategorie"),
    compareText(trustStatusText(left), trustStatusText(right), "Trust / Validierungsstatus"),
  ];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return clampPercent(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function overallFromOverlap(
  entry: OverlapEntry,
  sections: readonly CompareSection[],
): CompareMetrics {
  const sectionMatch = average(sections.map((section) => section.metrics.match));
  const sectionConflict = average(sections.map((section) => section.metrics.conflict));
  const sectionUncertainty = average(sections.map((section) => section.metrics.uncertainty));
  if (!entry.detector) {
    return {
      match: sectionMatch,
      conflict: sectionConflict,
      uncertainty: sectionUncertainty,
      source: "heuristic",
      note: "dcmp.note.noScore",
    };
  }
  const detectorMatch = clampPercent(entry.detector.lexicalScore * 100);
  const detectorUncertainty =
    entry.detector.method === "model" && typeof entry.detector.confidence === "number"
      ? clampPercent((1 - entry.detector.confidence) * 100)
      : sectionUncertainty;
  return {
    match: detectorMatch,
    conflict: sectionConflict,
    uncertainty: detectorUncertainty,
    source: "mixed",
    note: "dcmp.note.mixedOverlap",
  };
}

export function overallFromConflict(
  conflict: Conflict,
  sections: readonly CompareSection[],
): CompareMetrics {
  const sectionMatch = average(sections.map((section) => section.metrics.match));
  const sectionConflict = average(sections.map((section) => section.metrics.conflict));
  const sectionUncertainty = average(sections.map((section) => section.metrics.uncertainty));
  if (conflict.origin === "auto" && typeof conflict.detector?.confidence === "number") {
    const detectorConflict = clampPercent(conflict.detector.confidence * 100);
    return {
      match: sectionMatch,
      conflict: detectorConflict,
      uncertainty: clampPercent((1 - conflict.detector.confidence) * 100),
      source: "mixed",
      note: "dcmp.note.mixedConflict",
    };
  }
  return {
    match: sectionMatch,
    conflict: sectionConflict,
    uncertainty: sectionUncertainty,
    source: "heuristic",
    note: "dcmp.note.noScore",
  };
}

// SCRUM-486 B (ehrliche Rahmung): Die Feld-/Textheuristik ist KEIN fachliches Urteil. Deshalb führt
// genau EINE Zahl — die Text-Ähnlichkeit (match) —; der frühere „Konflikt"-Wert wird ehrlich als
// „Textunterschied" geführt und wandert samt Unsicherheit in die Details. Reine Zahlen (DOM-frei,
// testbar); die Beschriftung liegt in der Ansicht.
export interface CompareHeadline {
  leadPercent: number; // führende Zahl: Text-Ähnlichkeit (match)
  differencePercent: number; // vormals „Konflikt %" → ehrlich: Textunterschied, kein bewiesener Widerspruch
  uncertaintyPercent: number;
}

export function compareHeadline(metrics: CompareMetrics): CompareHeadline {
  return {
    leadPercent: metrics.match,
    differencePercent: metrics.conflict,
    uncertaintyPercent: metrics.uncertainty,
  };
}

// SCRUM-488 (Nullschulung): sprechende Bedeutung je Ampelfarbe statt des bloßen Farbnamens.
// SCRUM-487 (i18n): die Lib liefert nur noch stabile i18n-KEYS; die Ansicht macht t(...). Grün =
// deckt sich, Gelb = teils/unklar, Rot = weicht ab (bewusst „Unterschied", KEIN bewiesener
// Widerspruch — die Ehrlichkeits-Aussage lebt jetzt im i18n-Wert dcmp.tone.red.meaning).
export function compareToneLabelKey(tone: CompareTone): string {
  return `dcmp.tone.${tone}.label`;
}

export interface CompareToneLegendEntry {
  tone: CompareTone;
  labelKey: string;
  meaningKey: string;
}

// Legende der Abschnittsampeln — eine Quelle für die Anzeige UND den Test. Nur noch i18n-Keys.
export const COMPARE_TONE_LEGEND: readonly CompareToneLegendEntry[] = [
  { tone: "green", labelKey: "dcmp.tone.green.label", meaningKey: "dcmp.tone.green.meaning" },
  { tone: "yellow", labelKey: "dcmp.tone.yellow.label", meaningKey: "dcmp.tone.yellow.meaning" },
  { tone: "red", labelKey: "dcmp.tone.red.label", meaningKey: "dcmp.tone.red.meaning" },
];
