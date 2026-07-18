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

// SCRUM-513/487 (WP5-i18n): DOM-freie Übersetzerfunktion (dieselbe Signatur wie i18next-t). So kann die
// Lib die angezeigten Werte lokalisieren, ohne selbst react-i18next zu importieren; der Aufrufer reicht t.
type Translate = (key: string, opts?: Record<string, unknown>) => string;

function compareText(
  leftValue: string,
  rightValue: string,
  label: string,
  t: Translate,
): CompareSection {
  const left = compact(leftValue);
  const right = compact(rightValue);
  const noValue = t("dcmp.noValue");
  if (!left && !right) {
    return {
      key: label,
      label,
      leftValue: noValue,
      rightValue: noValue,
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
      leftValue: left || noValue,
      rightValue: right || noValue,
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
      leftValue: left || noValue,
      rightValue: right || noValue,
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

// SCRUM-513/487 (WP5-i18n): Status/Wissensart als LOKALISIERTES Klartext-Label über die bestehenden
// status.*/ktype.*-Keys (keine deutschen Inline-Labels mehr → EN/NL sauber). Der Aufrufer reicht t.
function trustStatusText(ko: KnowledgeObject, t: Translate): string {
  return t("dcmp.trustStatus", {
    trust: ko.trust,
    status: t(`status.${ko.status}`),
    needed: ko.neededValidations,
  });
}

function tagsCategoryText(ko: KnowledgeObject, t: Translate): string {
  return t("dcmp.tagsCategory", {
    category: ko.category || t("dcmp.none"),
    type: t(`ktype.${ko.type}`),
    tags: (ko.tags ?? []).join(", ") || t("dcmp.none"),
  });
}

export function buildDuplicateCompareSections(
  left: KnowledgeObject,
  right: KnowledgeObject,
  t: Translate,
): CompareSection[] {
  return [
    compareText(left.title, right.title, "Titel", t),
    compareText(
      [left.statement, stripHtml(left.bodyHtml)].filter(Boolean).join(" "),
      [right.statement, stripHtml(right.bodyHtml)].filter(Boolean).join(" "),
      "Kernaussage / Inhalt",
      t,
    ),
    compareText(joinList(left.conditions), joinList(right.conditions), "Bedingungen", t),
    compareText(joinList(left.measures), joinList(right.measures), "Massnahmen", t),
    compareText(hintsText(left), hintsText(right), "Hinweise", t),
    compareText(sourceText(left), sourceText(right), "Quellen / Evidence", t),
    compareText(tagsCategoryText(left, t), tagsCategoryText(right, t), "Tags / Kategorie", t),
    compareText(
      trustStatusText(left, t),
      trustStatusText(right, t),
      "Trust / Validierungsstatus",
      t,
    ),
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
