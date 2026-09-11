import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { LEAD_METRIC_TEXT, type LeadMetric, overlapDetectorInfo } from "./duplicateBoard";
import { htmlToPlainText } from "./richText";

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

// ================================================================================================
// REVIEW26 (JOB 3469) — DIE FÜHRENDE ZAHL DER VERGLEICHSSEITE BEKOMMT IHREN NAMEN.
// ================================================================================================
//
// `CompareMetrics` bleibt unverändert (die Abschnittswerte messen alle dasselbe: die
// Textähnlichkeit IHRES Feldes). Was einen Namen braucht, ist die GESAMTZAHL — und die entsteht
// je nach Datenlage aus verschiedenen Quellen: aus dem Detektorwert oder aus dem Durchschnitt der
// Abschnitte. `CompareOverall` sagt deshalb zusätzlich, WAS `match` misst.
export interface CompareOverall extends CompareMetrics {
  // Was `match` misst. `null` NUR, wenn es gar keine Grundlage gibt (fehlendes Wissensobjekt):
  // dann wird keine Metrik behauptet, so wie ohne detector keine Zahl behauptet wird.
  matchMetric: LeadMetric | null;
  // i18n-Schlüssel „NN % <Metrik>" zu `match`; `null` mit derselben Begründung.
  matchLeadKey: string | null;
}

// Fehlt ein Wissensobjekt, gibt es weder Abschnitte noch Detektorwert. Diese Lage stand bis
// hierher als Objektliteral IN der Ansicht; sie gehört hierher, damit die Ansicht auch in diesem
// Fall keine Metrik auswählt.
export const COMPARE_OVERALL_KO_MISSING: CompareOverall = {
  match: 0,
  conflict: 0,
  uncertainty: 100,
  source: "heuristic",
  note: "dcmp.note.koMissing",
  matchMetric: null,
  matchLeadKey: null,
};

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

// AUFTRAG-mega85 Block A: hier stand `replace(/<[^>]*>/g, " ")` — jedes Tag wurde zu einem
// Leerzeichen. Anders als bei der Suche fällt das hier dem Menschen INS AUGE: der angezeigte
// Vergleichswert las „Ventil V2 ,“ statt „Ventil V2,“, also etwas, das so in keinem der beiden
// Wissensobjekte steht. Seit mega84 trägt die Bild-Fußnote Auszeichnung, damit trifft es echte
// Inhalte. Gelesen wird jetzt über die kanonische Reduktion (`htmlToPlainText`, richText.ts) statt
// über eine eigene Regel; `compact` bleibt, weil der Vergleichswert auch aus anderen Quellen kommt.
function stripHtml(value: string | null | undefined): string {
  return compact(htmlToPlainText(value ?? ""));
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
// JOB 1988: als Überladung statt als ein Aufruf mit optionalem Zweitwert. Unter
// `exactOptionalPropertyTypes` heißt `opts?: …` auch „darf ausdrücklich `undefined` sein", und das
// sagt i18nexts `t` nicht zu — die Zusage hier war weiter als nötig. Beide Aufrufformen bleiben
// erlaubt, die Aufrufstellen ändern sich nicht.
type Translate = {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
};

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
): CompareOverall {
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
      // REVIEW26: ohne Detektorwert IST die führende Zahl der Abschnittsdurchschnitt — und sie
      // sagt es jetzt auch, statt sich „gleich" zu nennen.
      matchMetric: "sectionAverage",
      matchLeadKey: LEAD_METRIC_TEXT.sectionAverage,
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
    // Diese Seite führt IMMER die deterministische Textdeckung (`lexicalScore`) — auch bei einem
    // Modellfund, dessen Sicherheit hier nur in `uncertainty` einfliesst. Genau daher rührt der
    // gemeldete Sprung gegenüber dem Brett; er wird benannt, nicht wegdefiniert.
    matchMetric: "textOverlap",
    matchLeadKey: LEAD_METRIC_TEXT.textOverlap,
  };
}

export function overallFromConflict(
  conflict: Conflict,
  sections: readonly CompareSection[],
): CompareOverall {
  const sectionMatch = average(sections.map((section) => section.metrics.match));
  const sectionConflict = average(sections.map((section) => section.metrics.conflict));
  const sectionUncertainty = average(sections.map((section) => section.metrics.uncertainty));
  // In BEIDEN Zweigen ist `match` der Abschnittsdurchschnitt; der Detektorwert des Konflikts
  // fliesst in `conflict`/`uncertainty`. Die führende Zahl heisst hier deshalb immer gleich.
  if (conflict.origin === "auto" && typeof conflict.detector?.confidence === "number") {
    const detectorConflict = clampPercent(conflict.detector.confidence * 100);
    return {
      match: sectionMatch,
      conflict: detectorConflict,
      uncertainty: clampPercent((1 - conflict.detector.confidence) * 100),
      source: "mixed",
      note: "dcmp.note.mixedConflict",
      matchMetric: "sectionAverage",
      matchLeadKey: LEAD_METRIC_TEXT.sectionAverage,
    };
  }
  return {
    match: sectionMatch,
    conflict: sectionConflict,
    uncertainty: sectionUncertainty,
    source: "heuristic",
    note: "dcmp.note.noScore",
    matchMetric: "sectionAverage",
    matchLeadKey: LEAD_METRIC_TEXT.sectionAverage,
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
  // REVIEW26 (JOB 3469): WAS `leadPercent` misst, und der i18n-Schlüssel seiner Beschriftung.
  // `null` nur, wenn die übergebenen Werte selbst keine Metrik benennen (siehe `CompareOverall`).
  leadMetric: LeadMetric | null;
  leadTextKey: string | null;
}

export function compareHeadline(metrics: CompareMetrics | CompareOverall): CompareHeadline {
  const benannt = "matchMetric" in metrics ? metrics : null;
  return {
    leadPercent: metrics.match,
    differencePercent: metrics.conflict,
    uncertaintyPercent: metrics.uncertainty,
    leadMetric: benannt?.matchMetric ?? null,
    leadTextKey: benannt?.matchLeadKey ?? null,
  };
}

// ================================================================================================
// REVIEW26 (JOB 3469) — DER BRÜCKENSATZ ZWISCHEN BRETT UND VERGLEICH.
// ================================================================================================
//
// Führen die zwei Flächen VERSCHIEDENE Metriken desselben Paars (Brett: KI-Sicherheit, Vergleich:
// Textdeckung), dann liest derselbe Mensch nacheinander zwei Zahlen, die einander zu widersprechen
// scheinen. Der Satz nennt beide nebeneinander. Er entsteht NUR aus tatsächlich vorhandenen
// Werten: ohne `detector` (kein Brettwert) und bei gleicher Metrik gibt es ihn nicht.
export interface CompareLeadBridge {
  messageKey: string;
  boardMetric: LeadMetric;
  boardPercent: number;
  boardLeadKey: string;
  compareMetric: LeadMetric;
  comparePercent: number;
  compareLeadKey: string;
}

export function overlapLeadBridge(
  entry: OverlapEntry,
  overall: CompareOverall,
): CompareLeadBridge | null {
  const brett = overlapDetectorInfo(entry);
  if (!brett || overall.matchMetric === null || overall.matchLeadKey === null) {
    return null;
  }
  if (brett.leadMetric === overall.matchMetric) {
    return null;
  }
  return {
    messageKey: "dcmp.metricBridge",
    boardMetric: brett.leadMetric,
    boardPercent: brett.leadPercent,
    boardLeadKey: brett.leadTextKey,
    compareMetric: overall.matchMetric,
    comparePercent: overall.match,
    compareLeadKey: overall.matchLeadKey,
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
