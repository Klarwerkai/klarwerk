// SCRUM-320: kleine, DOM-freie Sicherheitshelfer für bewusste Übernahme im Beta-Editor.
// Ziel: Ersetzen/Anhängen/Template-Anwendung klar unterscheiden, ohne Editor- oder Datenmodell-Änderung.

import { isEmptyHtml } from "./richText";

export type TemplateApplyMode = "set" | "append";

export function hasEditableContent(text: string): boolean {
  return text.trim().length > 0;
}

export function shouldWarnBeforeReplace(text: string): boolean {
  return hasEditableContent(text);
}

export function templateApplyMode(bodyHtml: string): TemplateApplyMode {
  return isEmptyHtml(bodyHtml) ? "set" : "append";
}

export function templateApplyModeHintKey(mode: TemplateApplyMode): string {
  return `editor.template.mode.${mode}`;
}

// SCRUM-339: DOM-freier Zustand für den Knowledge-Studio-Arbeitsraum. Vergleicht den Studio-Entwurf
// mit dem bereits in den Seiten-State übernommenen Body. „dirty" = es gibt unübernommene Änderungen,
// die beim Schließen/Verwerfen NICHT still verloren gehen dürfen. Reine Ableitung, kein Datenmodell,
// kein Auto-Save — nur Anzeige-/Entscheidungslogik für Dirty-Badge + Discard-Schutz.
export interface KnowledgeStudioState {
  dirty: boolean;
  statusKey: string; // i18n-Key für den sichtbaren Status
  tone: "warn" | "neutral";
}

export function knowledgeStudioState(draft: string, applied: string): KnowledgeStudioState {
  return draft !== applied
    ? { dirty: true, statusKey: "studio.state.dirty", tone: "warn" }
    : { dirty: false, statusKey: "studio.state.clean", tone: "neutral" };
}
