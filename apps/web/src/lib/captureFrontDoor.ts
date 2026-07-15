import type { DraftPayload, StructureResult } from "../api/types";
import { htmlToPlainText, normalizePastedHtml } from "./richText";

export const CAPTURE_FRONT_DOOR_ROUTE = "/capture/frontdoor";
// SCRUM-487 (i18n): der Fallback-Titel wird als echter KO-Titel gespeichert (Daten, nicht nur
// Anzeige). Diese Konstante bleibt der deutsche DEFAULT; die Ansicht reicht den lokalisierten Wert
// (t("cfd.fallbackTitle")) über die Parameter unten durch, damit der gespeicherte Titel der Sprache
// folgt, ohne dass die Lib den i18n-Kontext braucht.
export const CAPTURE_FRONT_DOOR_FALLBACK_TITLE = "Unbenanntes Wissensobjekt";
export const FRONT_DOOR_SAVE_TIMEOUT_MS = 30000;
export const FRONT_DOOR_SAVE_TIMEOUT_MESSAGE =
  "Speichern dauert zu lange. Bitte pruefe Bibliothek oder Entwuerfe, bevor du erneut speicherst.";
// SCRUM-487 (i18n): reine Anzeigemeldung → stabiler i18n-Key; die Ansicht macht t(...).
export const FRONT_DOOR_STRUCTURING_UNAVAILABLE_KEY = "cfd.structuringUnavailable";

export class FrontDoorSaveTimeoutError extends Error {
  constructor() {
    super(FRONT_DOOR_SAVE_TIMEOUT_MESSAGE);
    this.name = "FrontDoorSaveTimeoutError";
  }
}

const MAX_TITLE_LENGTH = 90;
const MAX_STATEMENT_LENGTH = 500;
const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function firstBlockHtml(html: string): string {
  const heading = /<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i.exec(html);
  if (heading?.[1]) {
    return heading[1];
  }
  const block =
    /<(?:p|div|li|blockquote|td|th)\b[^>]*>([\s\S]*?)<\/(?:p|div|li|blockquote|td|th)>/i.exec(html);
  return block?.[1] ?? html;
}

function compactTitle(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH).trim();
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char] ?? char);
}

export function deriveFrontDoorTitle(
  manualTitle: string,
  bodyHtml: string,
  fallbackTitle: string = CAPTURE_FRONT_DOOR_FALLBACK_TITLE,
): string {
  const explicitTitle = compactTitle(manualTitle);
  if (explicitTitle) {
    return explicitTitle;
  }

  const normalizedBody = normalizePastedHtml(bodyHtml);
  const derived = compactTitle(htmlToPlainText(firstBlockHtml(normalizedBody)));
  return derived || fallbackTitle;
}

export function frontDoorStatement(bodyHtml: string, title: string): string {
  const text = htmlToPlainText(bodyHtml).slice(0, MAX_STATEMENT_LENGTH).trim();
  return text || title;
}

export function frontDoorBodyFromDraft(payload: DraftPayload): string {
  const bodyHtml = payload.bodyHtml?.trim();
  if (bodyHtml) {
    return bodyHtml;
  }
  const statement = payload.statement?.trim();
  return statement ? `<p>${escapeHtml(statement)}</p>` : "";
}

export function buildFrontDoorPayload(input: {
  title: string;
  bodyHtml: string;
  fallbackTitle?: string;
}): DraftPayload {
  const bodyHtml = normalizePastedHtml(input.bodyHtml);
  const title = deriveFrontDoorTitle(input.title, bodyHtml, input.fallbackTitle);
  return {
    title,
    statement: frontDoorStatement(bodyHtml, title),
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    conditions: [],
    measures: [],
    ...(bodyHtml.trim() ? { bodyHtml } : {}),
    origin: "frontdoor",
  };
}

export function buildFrontDoorStructureInput(input: {
  title: string;
  bodyHtml: string;
}): string {
  const title = compactTitle(input.title);
  const body = htmlToPlainText(normalizePastedHtml(input.bodyHtml));
  return [title, body]
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
}

function renderList(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter((item) => item.length > 0);
  if (clean.length === 0) {
    return "";
  }
  return `<ul>${clean.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function frontDoorStructuredBodyHtml(result: StructureResult): string {
  const sections: string[] = [];
  const title = compactTitle(result.title);
  const statement = result.statement.trim();

  if (title) {
    sections.push(`<h2>${escapeHtml(title)}</h2>`);
  }
  if (statement) {
    sections.push(`<p><strong>Kernaussage:</strong> ${escapeHtml(statement)}</p>`);
  }
  const conditions = renderList(result.conditions);
  if (conditions) {
    sections.push(`<h3>Bedingungen</h3>${conditions}`);
  }
  const measures = renderList(result.measures);
  if (measures) {
    sections.push(`<h3>Massnahmen</h3>${measures}`);
  }
  if (result.tags.length > 0) {
    sections.push(`<p><strong>Hinweise:</strong> ${escapeHtml(result.tags.join(", "))}</p>`);
  }

  return sections.join("");
}

export function withFrontDoorSaveTimeout<T>(
  save: Promise<T>,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new FrontDoorSaveTimeoutError());
    }, timeoutMs);

    save.then(resolve, reject).finally(() => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    });
  });
}

export function createFrontDoorDraft<TDraft>(
  input: { title: string; bodyHtml: string; fallbackTitle?: string },
  createDraft: (payload: DraftPayload) => Promise<TDraft>,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<TDraft> {
  return withFrontDoorSaveTimeout(createDraft(buildFrontDoorPayload(input)), timeoutMs);
}

export interface FrontDoorDraftRef {
  id: string;
}

export interface FrontDoorSubmitClient<TDraft extends FrontDoorDraftRef, TKo> {
  createDraft: (payload: DraftPayload) => Promise<TDraft>;
  updateDraft: (id: string, payload: DraftPayload) => Promise<TDraft>;
  promoteDraft: (id: string) => Promise<TKo>;
}

export async function submitFrontDoorDraft<TDraft extends FrontDoorDraftRef, TKo>(
  input: { title: string; bodyHtml: string; activeDraftId?: string | null; fallbackTitle?: string },
  client: FrontDoorSubmitClient<TDraft, TKo>,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<TKo> {
  const payload = buildFrontDoorPayload(input);
  const draft = await withFrontDoorSaveTimeout(
    input.activeDraftId
      ? client.updateDraft(input.activeDraftId, payload)
      : client.createDraft(payload),
    timeoutMs,
  );
  return client.promoteDraft(draft.id);
}
