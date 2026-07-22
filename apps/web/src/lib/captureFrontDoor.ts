import type { Confidentiality, DraftPayload, StructureResult } from "../api/types";
import { htmlToPlainText, normalizePastedHtml } from "./richText";

export const CAPTURE_FRONT_DOOR_ROUTE = "/capture/frontdoor";
// SCRUM-487 (i18n): der Fallback-Titel wird als echter KO-Titel gespeichert (Daten, nicht nur
// Anzeige). Diese Konstante bleibt der deutsche DEFAULT; die Ansicht reicht den lokalisierten Wert
// (t("cfd.fallbackTitle")) über die Parameter unten durch, damit der gespeicherte Titel der Sprache
// folgt, ohne dass die Lib den i18n-Kontext braucht.
export const CAPTURE_FRONT_DOOR_FALLBACK_TITLE = "Unbenanntes Wissensobjekt";
export const FRONT_DOOR_SAVE_TIMEOUT_MS = 30000;
export const FRONT_DOOR_SAVE_TIMEOUT_MESSAGE =
  "Speichern dauert zu lange. Bitte prüfe Bibliothek oder Entwürfe, bevor du erneut speicherst.";
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
  // SCRUM-502 Schicht 2 (Round 3): die im Front-Door gewählte Vertraulichkeit fließt in den Entwurf
  // (und damit ins spätere KO), damit Anzeige/Egress konsistent zur Erfassung sind. Standard „intern".
  confidentiality?: Confidentiality;
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
    ...(input.confidentiality && input.confidentiality !== "intern"
      ? { confidentiality: input.confidentiality }
      : {}),
    origin: "frontdoor",
  };
}

// WP-D7 (Befund 3, Latenz/FALLBACK-Diagnose): Bei großen Dokumenten (z. B. das ganze BAADER-PDF inkl.
// Inhaltsverzeichnis) ging bisher der KOMPLETTE Klartext als Prompt an den Reasoner. Ein riesiger Prompt
// ist langsam (→ „hängt sehr lange") und läuft ins Modell-Timeout (30 s) → deterministischer Fallback
// (FALLBACK-Badge). Der Struktur-Vorschlag braucht für Titel/Struktur nur den Anfang. Deshalb wird der
// Prompt-Input hier sinnvoll gekappt (erste N Zeichen an einer Wortgrenze + ehrlicher Kürzungshinweis).
// Das ändert NICHTS am gespeicherten Body — nur den an die KI gereichten Text (Original bleibt heilig).
export const FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS = 12000;
// WP-D7b (Klein-Fix 3): Der Kürzungshinweis wird ins Budget EINGERECHNET — die Rückgabe überschreitet die
// Konstante nie. Führendes Leerzeichen + Klammer-Ellipse (ein Zeichen U+2026).
const STRUCTURE_INPUT_TRUNCATION_SUFFIX = " […]";

function capStructureInput(text: string): string {
  if (text.length <= FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS) {
    return text;
  }
  // WP-D7b (Klein-Fix 3): codepoint-bewusst kappen — ein einfaches slice(0, N) könnte ein Surrogatpaar
  // (z. B. Emoji) mitten durchtrennen und einen kaputten Codepoint hinterlassen. Budget = Max ABZÜGLICH
  // Suffixlänge, damit die Rückgabe inkl. „[…]" die Konstante nicht überschreitet. Wir füllen den Kopf
  // codepoint-weise (for..of iteriert Codepoints) bis knapp unters Budget — nie in ein Surrogatpaar hinein.
  const budget = FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS - STRUCTURE_INPUT_TRUNCATION_SUFFIX.length;
  let head = "";
  for (const codePoint of text) {
    if (head.length + codePoint.length > budget) {
      break;
    }
    head += codePoint;
  }
  // An der letzten Wortgrenze kappen, sofern sie nicht zu weit vorne liegt (kein zerrissenes Wort). Das
  // Leerzeichen ist BMP → der Schnitt an lastSpace trennt garantiert kein Surrogatpaar.
  const lastSpace = head.lastIndexOf(" ");
  const trimmed = (lastSpace > budget * 0.8 ? head.slice(0, lastSpace) : head).trimEnd();
  return `${trimmed}${STRUCTURE_INPUT_TRUNCATION_SUFFIX}`;
}

export function buildFrontDoorStructureInput(input: {
  title: string;
  bodyHtml: string;
}): string {
  const title = compactTitle(input.title);
  const body = htmlToPlainText(normalizePastedHtml(input.bodyHtml));
  const combined = [title, body]
    .filter((part) => part.length > 0)
    .join("\n\n")
    .trim();
  return capStructureInput(combined);
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
  input: {
    title: string;
    bodyHtml: string;
    fallbackTitle?: string;
    confidentiality?: Confidentiality;
  },
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
  input: {
    title: string;
    bodyHtml: string;
    activeDraftId?: string | null;
    fallbackTitle?: string;
    confidentiality?: Confidentiality;
  },
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
