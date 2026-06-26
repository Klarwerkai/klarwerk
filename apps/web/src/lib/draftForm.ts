// Reine, DOM-freie Logik fürs Entwurfs-Formular & Fortsetzen (SCRUM-113 / FE-CAP-07).
// Mapping Formular ↔ DraftPayload, Resume-Status, Vollständigkeit. Kein DOM, kein API-Aufruf.
import type { Draft, DraftPayload, KnowledgeType } from "../api/types";

// Schlankes Mobile-/Resume-Formular: Titel + Aussage genügen für einen Entwurf.
export interface DraftFormState {
  title: string;
  statement: string;
}

export const EMPTY_DRAFT_FORM: DraftFormState = { title: "", statement: "" };

// Formular → DraftPayload (nur gesetzte Felder; getrimmt).
export function formToPayload(form: DraftFormState): DraftPayload {
  const payload: DraftPayload = {};
  const title = form.title.trim();
  const statement = form.statement.trim();
  if (title) {
    payload.title = title;
  }
  if (statement) {
    payload.statement = statement;
  }
  return payload;
}

// Bestehenden Entwurf ins Formular laden (Resume).
export function draftToForm(draft: Pick<Draft, "payload">): DraftFormState {
  return {
    title: draft.payload.title ?? "",
    statement: draft.payload.statement ?? "",
  };
}

// Ein Entwurf ist speicherbar, sobald irgendein Inhalt da ist.
export function isDraftFormFillable(form: DraftFormState): boolean {
  return form.title.trim().length > 0 || form.statement.trim().length > 0;
}

// Kurzer, sicherer Anzeigetitel für die Entwurfsliste.
export function draftTitle(draft: Pick<Draft, "payload">, fallback: string): string {
  const t = draft.payload.title?.trim();
  if (t) {
    return t;
  }
  const s = draft.payload.statement?.trim();
  return s ? s.slice(0, 60) : fallback;
}

// FR-CAP-07: Promote setzt ein KO voraus — Pflichtfelder vollständig?
// type/category sind im schlanken Formular nicht erfasst → fehlen i. d. R. (ehrlich gemeldet).
export function isPromotable(payload: DraftPayload): boolean {
  return Boolean(
    payload.title?.trim() && payload.statement?.trim() && payload.type && payload.category,
  );
}

export const KNOWLEDGE_TYPES_DRAFT: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];
