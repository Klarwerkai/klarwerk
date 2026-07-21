// WP-D11 (Pedis Entscheid: jede Folie als Bild): Client-Seite der Folien-Konvertierung. Der Server
// liefert PNG-data-URLs je Folie; dieses Modul baut daraus den „Folienansicht"-Abschnitt am ENDE
// des Beitrags — jede Folie als <figure> mit leerer Bild-Fußnote im BILD-1a/1b-Vertrag (beidseitige
// data-image-id; der Sanitizer-Vertrag bleibt unangetastet). Die Budget-Regeln von D9b/D9c gelten
// UNVERÄNDERT: der Aufrufer schickt das kombinierte HTML durch applyInlineImageBudget (Drop-to-fit
// ganzer figures, ehrliche Zähler). DOM-frei und ohne Netz — im Node-Gate testbar.
import { ApiError } from "../api/client";
import type { SlideConvertResponse } from "../api/types";
import { IMAGE_ID_PREFIX } from "./docx";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_FILE_TEXT).
export const SLIDE_IMAGES_TEXT = {
  toggle: "capture.slides.toggle",
  toggleHint: "capture.slides.toggleHint",
  heading: "capture.slides.heading",
  converting: "capture.slides.converting",
  done: "capture.slides.done",
  truncated: "capture.slides.truncated",
  dropped: "capture.slides.dropped",
  busy: "capture.slides.busy",
  unavailable: "capture.slides.unavailable",
  failed: "capture.slides.failed",
  // WP-RETEST7 R8: harter Client-Timeout — ehrliche Meldung, der Text-Import bleibt.
  timeout: "capture.slides.timeout",
} as const;

// ---- WP-RETEST7 R8 (Pedis Befund: endloser Spinner bei abgeschalteter Route) ----

// Harter Client-Timeout der Konvertierungs-Anfrage (großzügig über der 60-s-Server-Deadline).
export const SLIDES_CONVERT_TIMEOUT_MS = 90_000;

// Schmale Sicht auf die Slides-API — injizierbar für Tests (kein Netz nötig).
export interface SlidesApi {
  availability(): Promise<{ available: boolean }>;
  convert(dataBase64: string): Promise<SlideConvertResponse>;
}

export type SlidesConvertOutcome =
  | { ok: true; result: SlideConvertResponse }
  | { ok: false; messageKey: string };

// EINE Fehler-Klassifikation für alle Ausgänge: 503 → nicht verfügbar, 429 → belegt,
// Timeout (408/TIMEOUT) → Zeitüberschreitung, alles andere (Netz/Abort/5xx) → generisch ehrlich.
export function slidesErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) {
      return SLIDE_IMAGES_TEXT.unavailable;
    }
    if (error.status === 429) {
      return SLIDE_IMAGES_TEXT.busy;
    }
    if (error.status === 408 || error.code === "TIMEOUT") {
      return SLIDE_IMAGES_TEXT.timeout;
    }
  }
  return SLIDE_IMAGES_TEXT.failed;
}

// Abgesicherter Konvertierungs-Lauf: (1) LEICHTER Verfügbarkeits-Check — disabled/kein Konverter
// → SOFORT die ehrliche Meldung, OHNE den großen Upload zu senden; scheitert schon der Check
// (Netz), wird ehrlich gemeldet statt ins Blaue hochzuladen. (2) Jeder Konvertierungs-Fehler
// (503/429/Timeout/Netz) endet in einem Outcome — nie in einem hängenden Spinner (der Aufrufer
// beendet den Spinner in einem finally).
export async function convertSlidesWithGuard(
  api: SlidesApi,
  dataBase64: string,
): Promise<SlidesConvertOutcome> {
  try {
    const availability = await api.availability();
    if (!availability.available) {
      return { ok: false, messageKey: SLIDE_IMAGES_TEXT.unavailable };
    }
  } catch (error) {
    return { ok: false, messageKey: slidesErrorKey(error) };
  }
  try {
    return { ok: true, result: await api.convert(dataBase64) };
  } catch (error) {
    return { ok: false, messageKey: slidesErrorKey(error) };
  }
}

// Kollisionsfeste Folien-IDs: eigener Namensraum (…-s<N>) unter einem EIGENEN Run-Token — kollidiert
// weder mit den Foto-figures desselben Imports (anderes Token) noch zwischen zwei Folien-Läufen.
export function slideImageId(runToken: string, slideNo: number): string {
  return `${IMAGE_ID_PREFIX}${runToken}-s${slideNo}`;
}

// Eine Folie als figure im BILD-1a/1b-Vertrag (leere figcaption — ein Platzhalter ist KEIN Inhalt).
function slideFigureHtml(src: string, id: string): string {
  return `<figure><img data-image-id="${id}" src="${src}"><figcaption data-image-id="${id}"></figcaption></figure>`;
}

// „Folienansicht"-Abschnitt ANS ENDE des vorhandenen Beitrags-HTML. heading kommt lokalisiert vom
// Aufrufer (DE/EN/NL) und wird escaped eingebettet (kein HTML aus Übersetzungen).
export function appendSlideSection(
  html: string | null,
  heading: string,
  slides: readonly string[],
  runToken: string,
): string {
  const safeHeading = heading.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const figures = slides
    .map((src, i) => slideFigureHtml(src, slideImageId(runToken, i + 1)))
    .join("");
  return `${html ?? ""}<h2>${safeHeading}</h2>${figures}`;
}

// Ehrlicher Zähler nach dem Drop-to-fit: wie viele Folien-figures haben das Budget überlebt?
// (Zählt die eigenen Folien-IDs im finalen HTML — dieselbe Quelle wie die Galerie.)
export function countKeptSlides(finalHtml: string, runToken: string, total: number): number {
  let kept = 0;
  for (let i = 1; i <= total; i++) {
    if (finalHtml.includes(`data-image-id="${slideImageId(runToken, i)}"`)) {
      kept += 1;
    }
  }
  return kept;
}

// WP-D11b (bens GELB c): konvertierte/verworfene Folien fließen in DIESELBE Import-Bildbilanz wie
// die eingebetteten Bilder — ein textloses Deck mit behaltenen Folien darf nie als „alle Bilder
// verworfen" gemeldet werden. slidesTotal = übernommene + serverseitig verworfene Folien;
// slidesKept = Folien-figures, die das Client-Budget überlebt haben (countKeptSlides).
export interface ImportImageInfo {
  total: number;
  compressed: number;
  dropped: number;
  htmlOverflow: boolean;
}

export function mergeSlideImageInfo(
  info: ImportImageInfo | null,
  slidesTotal: number,
  slidesKept: number,
): ImportImageInfo | null {
  if (slidesTotal <= 0) {
    return info;
  }
  const base = info ?? { total: 0, compressed: 0, dropped: 0, htmlOverflow: false };
  return {
    ...base,
    total: base.total + slidesTotal,
    dropped: base.dropped + Math.max(0, slidesTotal - slidesKept),
  };
}
