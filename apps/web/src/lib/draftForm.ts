// Reine, DOM-freie Logik fürs Entwurfs-Formular & Fortsetzen (SCRUM-113 / FE-CAP-07).
// Mapping Formular ↔ DraftPayload, Resume-Status, Vollständigkeit. Kein DOM, kein API-Aufruf.
import type { Draft, DraftPayload, KnowledgeType } from "../api/types";
import {
  type DraftBodySegment,
  draftBodyFromText,
  draftBodyPatch,
  draftBodyText,
  splitDraftBody,
} from "./draftBody";

// Schlankes Mobile-/Resume-Formular: Titel + Aussage genügen für einen Entwurf.
export interface DraftFormState {
  title: string;
  statement: string;
  /**
   * JOB 3377 — DER FLIESSTEXT DES ENTWURFS, wenn er einen `bodyHtml` hat.
   *
   * Er steht NEBEN `statement`, nicht an dessen Stelle: welches der beiden Felder die Fläche zeigt,
   * entscheidet allein `segments` (s. `draftToForm`). Ein Entwurf ohne Body verhält sich
   * unverändert wie bisher — dort fehlen `body` und `segments`, und die Kernaussage bleibt das eine
   * Feld. Deshalb sind beide OPTIONAL: der bisherige Weg bleibt wörtlich der bisherige.
   */
  body?: string;
  /**
   * Die Zerlegung des GESPEICHERTEN Bodys. Sie ist zugleich der Schalter („trägt dieser Entwurf
   * einen Body?") und der Bauplan für die Rückwandlung — Bilder, Tabellen und Auszeichnung reisen
   * darin wörtlich mit (s. `draftBodyFromText`).
   *
   * Sie liegt bewusst IM Formularzustand und nicht als zweiter Parameter an `formToPayload`: so
   * gibt es keine Aufrufform, die den Body versehentlich weglässt — der Weg ist einer, nicht zwei.
   */
  segments?: readonly DraftBodySegment[];
}

export const EMPTY_DRAFT_FORM: DraftFormState = { title: "", statement: "" };

/**
 * Formular → DraftPayload (nur gesetzte Felder; getrimmt).
 *
 * JOB 3377: MIT `segments` (der Entwurf hat einen Body) wird der BODY geschrieben und `statement`
 * bewusst NICHT mitgeschickt — der partielle Merge (`mergeDraftPayload`, services/capture/src/
 * service.ts) lässt die gespeicherte Kernaussage damit unangetastet stehen. `draftBodyPatch` oben
 * regelt wie bisher den Leerfall, und zwar als EINZIGE Quelle dafür. `segments` gibt es nur an
 * einem FORTGESETZTEN Entwurf mit Body, also immer an einem Update — daher `isDraftUpdate = true`.
 * OHNE `segments` bleibt alles Zeile für Zeile wie vorher.
 */
export function formToPayload(form: DraftFormState): DraftPayload {
  const payload: DraftPayload = {};
  const title = form.title.trim();
  if (title) {
    payload.title = title;
  }
  if (form.segments) {
    return {
      ...payload,
      ...draftBodyPatch(draftBodyFromText(form.segments, form.body ?? ""), true),
    };
  }
  const statement = form.statement.trim();
  if (statement) {
    payload.statement = statement;
  }
  return payload;
}

/**
 * Bestehenden Entwurf ins Formular laden (Resume).
 *
 * JOB 3377: trägt er einen Body, steht im Textfeld DERSELBE Text, den die Vollversion im Editor
 * zeigt. FEHLT EIN GESICHERTES ORIGINAL (`anchorsMissing`), wird der Body NICHT angefasst: der
 * Server hat ihn dann bewusst ausgedünnt (`withAnchorCheck`, services/capture/src/service.ts) und
 * liefert `bodyHtml: null` — ein Zurückschreiben aus diesem Stand hiesse, den echten Body zu
 * löschen. Dann bleibt es beim Kernaussage-Weg, genau wie bisher.
 */
export function draftToForm(draft: Pick<Draft, "payload" | "anchorsMissing">): DraftFormState {
  const ankerFehlt = (draft.anchorsMissing?.length ?? 0) > 0;
  const segments =
    !ankerFehlt && draft.payload.bodyHtml?.trim() ? splitDraftBody(draft.payload.bodyHtml) : null;
  return {
    title: draft.payload.title ?? "",
    statement: draft.payload.statement ?? "",
    ...(segments ? { body: draftBodyText(segments), segments } : {}),
  };
}

// Nur die bearbeitbaren Textfelder zählen; segments ist der unverändert mitreisende Bauplan.
export function isDraftFormChanged(form: DraftFormState, baseline: DraftFormState): boolean {
  return (
    form.title.trim() !== baseline.title.trim() ||
    form.statement.trim() !== baseline.statement.trim() ||
    (form.body ?? "").trim() !== (baseline.body ?? "").trim()
  );
}

// Ein Entwurf ist speicherbar, sobald irgendein Inhalt da ist.
export function isDraftFormFillable(form: DraftFormState): boolean {
  return (
    form.title.trim().length > 0 ||
    form.statement.trim().length > 0 ||
    (form.body ?? "").trim().length > 0
  );
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
