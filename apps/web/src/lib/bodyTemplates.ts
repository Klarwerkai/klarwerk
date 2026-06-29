// SCRUM-319: DOM-freie Body-Strukturvorlagen für den Beta-Knowledge-Editor.
// Die Vorlagen sind statisches HTML (keine Nutzereingaben), nutzen vorhandene Editor-Blockklassen
// aus SCRUM-314/316 und laufen defensiv durch sanitizeHtml. Kein Cursor-Insert, kein Auto-Fill.

import { editorBlockClass } from "./editorBlocks";
import { isEmptyHtml, sanitizeHtml } from "./richText";

export type BodyTemplateId = "procedure" | "troubleshooting" | "safety";
export type BodyTemplateLocale = "de" | "en";

export interface BodyTemplateDef {
  id: BodyTemplateId;
  labelKey: string;
  descriptionKey: string;
}

export const BODY_TEMPLATE_IDS: readonly BodyTemplateId[] = [
  "procedure",
  "troubleshooting",
  "safety",
];

export const BODY_TEMPLATES: readonly BodyTemplateDef[] = BODY_TEMPLATE_IDS.map((id) => ({
  id,
  labelKey: `editor.template.${id}.label`,
  descriptionKey: `editor.template.${id}.description`,
}));

const COPY: Record<BodyTemplateLocale, Record<BodyTemplateId, string>> = {
  de: {
    procedure: `
      <h2>Vorgehen</h2>
      <p>Beschreibe kurz, wann dieses Wissen gilt.</p>
      <h3>Bedingungen</h3>
      <ul><li>Bedingung ergänzen …</li></ul>
      <h3>Schritte</h3>
      <ol><li>Ersten Schritt ergänzen …</li><li>Nächsten Schritt ergänzen …</li></ol>
      <div class="${editorBlockClass("info")}"><p>Quelle oder Erfahrungsbeleg ergänzen …</p></div>
    `,
    troubleshooting: `
      <h2>Störung / Symptom</h2>
      <p>Was ist sichtbar oder messbar?</p>
      <h3>Mögliche Ursache</h3>
      <ul><li>Ursache ergänzen …</li></ul>
      <h3>Maßnahme</h3>
      <ol><li>Prüfschritt ergänzen …</li><li>Maßnahme ergänzen …</li></ol>
      <div class="${editorBlockClass("warning")}"><p>Grenze / Abbruchkriterium ergänzen …</p></div>
    `,
    safety: `
      <h2>Sicherheitsrelevantes Wissen</h2>
      <p>Beschreibe die Situation und das Risiko.</p>
      <div class="${editorBlockClass("warning")}"><p>Warnung oder Gefahr ergänzen …</p></div>
      <h3>Sicher prüfen</h3>
      <ol><li>Prüfschritt ergänzen …</li></ol>
      <div class="${editorBlockClass("success")}"><p>Sichere Maßnahme / gewünschter Zustand ergänzen …</p></div>
    `,
  },
  en: {
    procedure: `
      <h2>Procedure</h2>
      <p>Briefly describe when this knowledge applies.</p>
      <h3>Conditions</h3>
      <ul><li>Add condition …</li></ul>
      <h3>Steps</h3>
      <ol><li>Add first step …</li><li>Add next step …</li></ol>
      <div class="${editorBlockClass("info")}"><p>Add source or experience evidence …</p></div>
    `,
    troubleshooting: `
      <h2>Issue / symptom</h2>
      <p>What is visible or measurable?</p>
      <h3>Possible cause</h3>
      <ul><li>Add cause …</li></ul>
      <h3>Action</h3>
      <ol><li>Add check …</li><li>Add action …</li></ol>
      <div class="${editorBlockClass("warning")}"><p>Add limit / stop criterion …</p></div>
    `,
    safety: `
      <h2>Safety-relevant knowledge</h2>
      <p>Describe the situation and the risk.</p>
      <div class="${editorBlockClass("warning")}"><p>Add warning or hazard …</p></div>
      <h3>Safe check</h3>
      <ol><li>Add check …</li></ol>
      <div class="${editorBlockClass("success")}"><p>Add safe action / desired state …</p></div>
    `,
  },
};

export function normalizeBodyTemplateLocale(locale: string | null | undefined): BodyTemplateLocale {
  return locale?.toLowerCase().startsWith("en") ? "en" : "de";
}

export function bodyTemplateHtml(id: BodyTemplateId, locale: BodyTemplateLocale = "de"): string {
  return sanitizeHtml(COPY[locale][id].trim().replace(/>\s+</g, "><"));
}

export function applyBodyTemplate(
  currentHtml: string | null | undefined,
  id: BodyTemplateId,
  locale: BodyTemplateLocale = "de",
): string {
  const base = currentHtml ?? "";
  const next = bodyTemplateHtml(id, locale);
  return isEmptyHtml(base) ? next : base + next;
}
