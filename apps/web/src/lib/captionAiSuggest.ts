// WP-BILD-1c (Pedis Präzisierung 20.07.): KI-Bildbeschreibung als VORSCHLAG BEIM BEARBEITEN der
// Bild-Fußnote — NICHT automatisch in die Fußnote. Der kleine Knopf erscheint erst, wenn der
// Nutzer im Editier-Modus in eine editierbare figcaption fokussiert; das Ergebnis kommt als
// Vorschlags-Panel (Übernehmen/Verwerfen). Ohne funktionierende Cloud-KI (aktueller Live-Zustand:
// Fallback) zeigt das Panel die EHRLICHE Ursache — nie eine Pseudo-Beschreibung.
// DOM-lib-frei (schmale Strukturtypen) — im Gate-tsc prüfbar und ohne Browser testbar.

import type { DescribeImageResult } from "../api/types";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster AI_TASK_INFO_TEXT).
export const CAPTION_AI_TEXT = {
  suggest: "editor.captionAi.suggest",
  loading: "editor.captionAi.loading",
  panelTitle: "editor.captionAi.panelTitle",
  aiBadge: "editor.captionAi.aiBadge",
  apply: "editor.captionAi.apply",
  discard: "editor.captionAi.discard",
  tooLarge: "editor.captionAi.tooLarge",
  imageUnreadable: "editor.captionAi.imageUnreadable",
  fallbackNoModel: "editor.captionAi.fallbackNoModel",
  fallbackTimeout: "editor.captionAi.fallbackTimeout",
  fallbackError: "editor.captionAi.fallbackError",
  // WP-SHIP9-S2 (bens Folgeschnitt B4): spezifischer, wahrer Grund, wenn die Cloud-Vision wegen
  // vertraulichem Bild ausgeschlossen war (vorher als generischer Modellfehler dargestellt).
  fallbackConfidential: "editor.captionAi.fallbackConfidential",
} as const;

// Client-Spiegel des Server-Deckels (MAX_DESCRIBE_IMAGE_DATAURL_CHARS, services/reasoner): zu große
// Bilder werden gar nicht erst hochgeladen — dieselbe ehrliche Meldung, nur ohne Netz-Umweg.
// WP-BILD-1f (bens P3): der String-Deckel ist nur der schnelle Vorab-Check; autoritativ prüft der
// Server die DEKODIERTE Bytegrenze (5 MB) — deshalb liegt der String-Deckel etwas darüber.
export const MAX_CAPTION_IMAGE_DATAURL_CHARS = 7_000_000;

// WP-BILD-1f (bens P1): der Vorschlag ist FEST an seine Ausgangs-Fußnote gebunden. Jeder Request
// trägt die data-image-id + die Auswahl-Generation der Fußnote zum Startzeitpunkt; eine (späte)
// Antwort wird NUR angewandt/angezeigt, wenn das Ziel unverändert ist — sonst STILL verworfen
// (wechselt der Nutzer während des Requests von Fußnote A nach B, darf As Antwort weder Panel
// noch Inhalt von B verändern).
export interface CaptionRequestBinding {
  imageId: string | null; // data-image-id der Ausgangs-Fußnote (null bei Altbestand ohne id)
  generation: number; // Auswahl-Generation beim Start des Requests
}

export function captionResponseApplicable(
  binding: CaptionRequestBinding,
  current: CaptionRequestBinding,
): boolean {
  return binding.generation === current.generation && binding.imageId === current.imageId;
}

// Der Knopf erscheint NUR im Editier-Modus, NUR mit fokussierter Fußnote und NUR, wenn der
// Eltern-Kontext den describe-Aufruf verdrahtet hat (sonst gäbe es einen toten Klick).
export function captionSuggestVisible(
  mode: "edit" | "preview",
  hasFocusedCaption: boolean,
  hasHandler: boolean,
): boolean {
  return mode === "edit" && hasFocusedCaption && hasHandler;
}

// Ergebnis → Panel-Zustand. Ein Vorschlag existiert nur bei echtem Modell-Text; jeder Fallback
// wird nach Ursache unterschieden (gleiche Dreiteilung wie die FALLBACK-Erklärung des
// Struktur-Vorschlags, WP-D8/D10).
export type CaptionSuggestOutcome =
  | { kind: "suggestion"; text: string }
  | { kind: "fallback"; messageKey: string };

export function captionSuggestOutcome(result: DescribeImageResult): CaptionSuggestOutcome {
  if (!result.demo && result.text !== null && result.text.trim().length > 0) {
    return { kind: "suggestion", text: result.text.trim() };
  }
  const messageKey =
    result.fallbackReason === "no-model"
      ? CAPTION_AI_TEXT.fallbackNoModel
      : result.fallbackReason === "model-timeout"
        ? CAPTION_AI_TEXT.fallbackTimeout
        : // WP-SHIP9-S2: vertraulichkeitsbedingter Cloud-Ausschluss wird als eigener, wahrer Grund
          // gezeigt — nicht mehr als generischer Modellfehler.
          result.fallbackReason === "confidential"
          ? CAPTION_AI_TEXT.fallbackConfidential
          : CAPTION_AI_TEXT.fallbackError;
  return { kind: "fallback", messageKey };
}

// Schmaler Strukturtyp der Fußnote (statt HTMLElement) — Gate-tsc-tauglich, im Test direkt stubbar.
export interface CaptionLike {
  textContent: string | null;
}

// Übernahme des Vorschlags: setzt den Text über die NORMALE Editier-Mechanik der figcaption
// (textContent — kein HTML, Sanitizer-Verträge unangetastet; gespeichert wird erst beim emit()
// des Editors, wie bei jeder Handeingabe).
export function applyCaptionSuggestion(caption: CaptionLike, text: string): void {
  caption.textContent = text;
}

// Bild einer Fußnote → data:image-URL fürs Modell. data:-Quellen (eingebettete Editor-Bilder)
// werden direkt verwendet; Objekt-Store-/HTTP-Quellen lädt der Aufrufer als Blob und reicht die
// gelesene data:-URL hier durch. Deckel-Prüfung zentral an EINER Stelle.
export function checkCaptionImageDataUrl(
  dataUrl: string,
): { ok: true; dataUrl: string } | { ok: false; messageKey: string } {
  if (!dataUrl.startsWith("data:image/")) {
    return { ok: false, messageKey: CAPTION_AI_TEXT.imageUnreadable };
  }
  if (dataUrl.length > MAX_CAPTION_IMAGE_DATAURL_CHARS) {
    return { ok: false, messageKey: CAPTION_AI_TEXT.tooLarge };
  }
  return { ok: true, dataUrl };
}
