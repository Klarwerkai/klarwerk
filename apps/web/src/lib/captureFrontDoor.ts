import type { DraftPayload } from "../api/types";
import { htmlToPlainText, normalizePastedHtml } from "./richText";

export const CAPTURE_FRONT_DOOR_ROUTE = "/capture/frontdoor";
export const CAPTURE_FRONT_DOOR_FALLBACK_TITLE = "Unbenanntes Wissensobjekt";
export const FRONT_DOOR_SAVE_TIMEOUT_MS = 30000;
export const FRONT_DOOR_SAVE_TIMEOUT_MESSAGE =
  "Speichern dauert zu lange. Bitte pruefe Bibliothek oder Entwuerfe, bevor du erneut speicherst.";

export class FrontDoorSaveTimeoutError extends Error {
  constructor() {
    super(FRONT_DOOR_SAVE_TIMEOUT_MESSAGE);
    this.name = "FrontDoorSaveTimeoutError";
  }
}

const MAX_TITLE_LENGTH = 90;
const MAX_STATEMENT_LENGTH = 500;

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

export function deriveFrontDoorTitle(manualTitle: string, bodyHtml: string): string {
  const explicitTitle = compactTitle(manualTitle);
  if (explicitTitle) {
    return explicitTitle;
  }

  const normalizedBody = normalizePastedHtml(bodyHtml);
  const derived = compactTitle(htmlToPlainText(firstBlockHtml(normalizedBody)));
  return derived || CAPTURE_FRONT_DOOR_FALLBACK_TITLE;
}

export function frontDoorStatement(bodyHtml: string, title: string): string {
  const text = htmlToPlainText(bodyHtml).slice(0, MAX_STATEMENT_LENGTH).trim();
  return text || title;
}

export function buildFrontDoorPayload(input: {
  title: string;
  bodyHtml: string;
}): DraftPayload {
  const bodyHtml = normalizePastedHtml(input.bodyHtml);
  const title = deriveFrontDoorTitle(input.title, bodyHtml);
  return {
    title,
    statement: frontDoorStatement(bodyHtml, title),
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    conditions: [],
    measures: [],
    ...(bodyHtml.trim() ? { bodyHtml } : {}),
    origin: "tell",
  };
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
  input: { title: string; bodyHtml: string },
  createDraft: (payload: DraftPayload) => Promise<TDraft>,
  timeoutMs = FRONT_DOOR_SAVE_TIMEOUT_MS,
): Promise<TDraft> {
  return withFrontDoorSaveTimeout(createDraft(buildFrontDoorPayload(input)), timeoutMs);
}
