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
