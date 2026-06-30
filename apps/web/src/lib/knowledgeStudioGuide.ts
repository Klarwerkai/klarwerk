// SCRUM-353: DOM-freie Führung für den Knowledge Input Studio. Zwei Dinge:
//  1) Eine ruhige, geführte Schrittfolge (Strukturieren → KI prüfen → Vorschau → bewusst übernehmen),
//     damit der große Arbeitsraum erklärt, „was als Nächstes ein guter Schritt ist".
//  2) Ein leichtgewichtiger Beitragswert-/Qualitätsblick: was ist am Entwurf schon gut, was würde ihn
//     stärker machen — abgeleitet AUSSCHLIESSLICH aus den vorhandenen Struktur-Signalen
//     (editorContentQuality). KEIN Score, KEINE Punkte, KEINE KI, KEINE Validierung, keine Mutation.
import type { ContentQuality } from "./editorContentQuality";

// ---------------------------------------------------------------------------
// Geführte Schrittfolge im Studio (Orientierung, kein State-Zwang).
// ---------------------------------------------------------------------------
export type StudioGuideStepId = "structure" | "assist" | "preview" | "apply";

export interface StudioGuideStep {
  id: StudioGuideStepId;
  labelKey: string;
  hintKey: string;
}

export const STUDIO_GUIDE_STEPS: readonly StudioGuideStep[] = (
  ["structure", "assist", "preview", "apply"] as const
).map((id) => ({
  id,
  labelKey: `studio.guide.${id}.label`,
  hintKey: `studio.guide.${id}.hint`,
}));

export function studioGuideSteps(): readonly StudioGuideStep[] {
  return STUDIO_GUIDE_STEPS;
}

export function studioGuideStepLabelKey(id: StudioGuideStepId): string {
  return `studio.guide.${id}.label`;
}

export function studioGuideActiveStep(view: "edit" | "preview"): StudioGuideStepId {
  return view === "preview" ? "preview" : "structure";
}

// ---------------------------------------------------------------------------
// Beitragswert / Qualität (leichtgewichtig, ehrlich, ohne Score).
// ---------------------------------------------------------------------------
export type ContributionLevel = "empty" | "draft" | "solid";

export interface ContributionItem {
  id: string;
  labelKey: string;
}

export interface StudioContribution {
  level: ContributionLevel;
  levelLabelKey: string;
  levelHintKey: string;
  tone: "neutral" | "warn" | "pos";
  // Was ist schon gut am Entwurf (vorhandene Struktur-Stärken).
  strengths: ContributionItem[];
  // Was würde den Beitrag stärker machen (Hinweise, KEINE Blocker).
  suggestions: ContributionItem[];
}

function contributionLevel(q: ContentQuality): ContributionLevel {
  if (q.isEmpty) {
    return "empty";
  }
  // „solide": echter Text + Überschriften + Schritte/Hervorhebungen.
  if (!q.isThin && q.hasHeadings && (q.hasLists || q.hasBlocks)) {
    return "solid";
  }
  return "draft";
}

// Stabile Reihenfolge der möglichen Stärken; nur vorhandene werden zurückgegeben.
const STRENGTHS: readonly { id: string; present: (q: ContentQuality) => boolean }[] = [
  { id: "text", present: (q) => !q.isEmpty && !q.isThin },
  { id: "headings", present: (q) => q.hasHeadings },
  { id: "steps", present: (q) => q.hasLists },
  { id: "highlights", present: (q) => q.hasBlocks },
  { id: "links", present: (q) => q.hasLinks },
  { id: "evidence", present: (q) => q.hasAttachments },
];

// Stabile Reihenfolge der möglichen Hinweise; nur sinnvolle (bei nicht-leerem Entwurf) zurückgeben.
const SUGGESTIONS: readonly { id: string; missing: (q: ContentQuality) => boolean }[] = [
  { id: "detail", missing: (q) => q.isThin },
  { id: "headings", missing: (q) => !q.hasHeadings },
  { id: "steps", missing: (q) => !q.hasLists },
  { id: "referenceAttachments", missing: (q) => q.attachmentsUnreferenced },
];

export function studioContribution(q: ContentQuality): StudioContribution {
  const level = contributionLevel(q);
  const tone: StudioContribution["tone"] =
    level === "solid" ? "pos" : level === "draft" ? "warn" : "neutral";
  const strengths = q.isEmpty
    ? []
    : STRENGTHS.filter((s) => s.present(q)).map((s) => ({
        id: s.id,
        labelKey: `studio.contrib.strength.${s.id}`,
      }));
  const suggestions = q.isEmpty
    ? []
    : SUGGESTIONS.filter((s) => s.missing(q)).map((s) => ({
        id: s.id,
        labelKey: `studio.contrib.suggestion.${s.id}`,
      }));
  return {
    level,
    levelLabelKey: `studio.contrib.level.${level}.label`,
    levelHintKey: `studio.contrib.level.${level}.hint`,
    tone,
    strengths,
    suggestions,
  };
}
