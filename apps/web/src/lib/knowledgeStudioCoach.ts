// SCRUM-376: DOM-freies First-Run-/Coaching-Signal für den Knowledge Input Studio. Beantwortet die
// eine Frage, die der große Arbeitsraum bisher offen ließ: „Wo stehe ich gerade — und was ist JETZT
// der nächste sinnvolle Schritt?" Leitet den empfohlenen nächsten Schritt (aus der vorhandenen
// Studio-Schrittfolge structure → assist → preview → apply) AUSSCHLIESSLICH aus den bereits
// vorhandenen Signalen ab: dem Inhaltszustand (editorContentQuality) und der aktuellen Ansicht
// (Bearbeiten/Vorschau). KEIN Score, KEINE Punkte, KEINE KI, KEINE Validierung, keine Mutation,
// kein Backend, kein DOM. Reine Anzeige-/Entscheidungslogik, die die vorhandenen Bausteine (geführte
// Rail, Beitragswert, Vorschau, Übernahme) zu einem zusammenhängenden Flow verbindet.

import type { ContentQuality } from "./editorContentQuality";
import { type StudioGuideStepId, studioGuideStepLabelKey } from "./knowledgeStudioGuide";
import type { StudioEditorView } from "./knowledgeStudioPreview";

export interface StudioNextStep {
  // Welcher Schritt der bestehenden Studio-Schrittfolge ist jetzt der empfohlene nächste?
  stepId: StudioGuideStepId;
  // i18n-Key für das Label des empfohlenen Schritts (aus der bestehenden Schrittfolge).
  stepLabelKey: string;
  // i18n-Key für die kurze, ehrliche Begründung „warum jetzt dieser Schritt".
  reasonKey: string;
  // Erst-Kontakt: leerer Entwurf → ruhiger „Start hier"-Einstieg statt technischer Werkzeugwand.
  isFirstRun: boolean;
}

// Ein Entwurf gilt als „noch nicht rund" (Struktur-Hinweise sinnvoll), wenn er dünn ist ODER
// wesentliche Struktur (Überschriften bzw. Schritte) fehlt. Reiner Hinweis, KEIN Blocker.
function needsStructureWork(q: ContentQuality): boolean {
  return q.isThin || !q.hasHeadings || !q.hasLists;
}

/**
 * Empfiehlt den nächsten sinnvollen Schritt im Studio — content- und ansichtsbewusst.
 *
 *  - Vorschau offen        → „Übernehmen" (der Beitrag wurde geprüft, jetzt bewusst übernehmen).
 *  - Leerer Entwurf        → „Strukturieren" als First-Run-Einstieg („Start hier": Erfahrung erzählen).
 *  - Entwurf noch dünn/roh → „KI prüfen" (KI hilft beim Gliedern/Schärfen).
 *  - Solider Entwurf       → „Vorschau" (ansehen, wie der Beitrag später wirkt).
 */
export function studioNextStep(q: ContentQuality, view: StudioEditorView): StudioNextStep {
  let stepId: StudioGuideStepId;
  let reasonKey: string;
  let isFirstRun = false;

  if (view === "preview") {
    stepId = "apply";
    reasonKey = "studio.coach.reason.apply";
  } else if (q.isEmpty) {
    stepId = "structure";
    reasonKey = "studio.coach.reason.start";
    isFirstRun = true;
  } else if (needsStructureWork(q)) {
    stepId = "assist";
    reasonKey = "studio.coach.reason.improve";
  } else {
    stepId = "preview";
    reasonKey = "studio.coach.reason.preview";
  }

  return {
    stepId,
    stepLabelKey: studioGuideStepLabelKey(stepId),
    reasonKey,
    isFirstRun,
  };
}

// i18n-Keys der ruhigen Coach-/Story-Zeile. Ehrlich: das Studio strukturiert Wissen, die PRÜFUNG
// macht es gesichert — nichts wird automatisch validiert.
export const STUDIO_COACH_KEYS = {
  // Story-Verankerung (AG-13): „Erfahrungswissen sichern — KI hilft strukturieren, Prüfung sichert."
  story: "studio.coach.story",
  // First-Run-Einstieg bei leerem Entwurf („Start hier").
  firstRun: "studio.coach.firstRun",
  // Präfix vor dem empfohlenen nächsten Schritt („Nächster Schritt:").
  nextPrefix: "studio.coach.nextPrefix",
} as const;
