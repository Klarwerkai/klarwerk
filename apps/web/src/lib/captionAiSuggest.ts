// WP-BILD-1c (Pedis Präzisierung 20.07.): KI-Bildbeschreibung als VORSCHLAG BEIM BEARBEITEN der
// Bild-Fußnote — NICHT automatisch in die Fußnote. Der kleine Knopf erscheint erst, wenn der
// Nutzer im Editier-Modus in eine editierbare figcaption fokussiert; das Ergebnis kommt als
// Vorschlags-Panel (Übernehmen/Verwerfen). Ohne funktionierende Cloud-KI (aktueller Live-Zustand:
// Fallback) zeigt das Panel die EHRLICHE Ursache — nie eine Pseudo-Beschreibung.
// DOM-lib-frei (schmale Strukturtypen) — im Gate-tsc prüfbar und ohne Browser testbar.

import type { DescribeImageResult } from "../api/types";
import { capCaptionHtml, captionPlainText, escapeCaptionText } from "./richText";

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster AI_TASK_INFO_TEXT).
export const CAPTION_AI_TEXT = {
  suggest: "editor.captionAi.suggest",
  loading: "editor.captionAi.loading",
  panelTitle: "editor.captionAi.panelTitle",
  aiBadge: "editor.captionAi.aiBadge",
  // WP-BILD-1f (Pedi 22.07.): Kennzeichnung, dass der Vorschlag mit umgebendem Dokument-Kontext
  // erzeugt wurde (Titel/Überschrift/Absätze) — für die fachsprachlich passende Benennung.
  withContext: "editor.captionAi.withContext",
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
  // AUFTRAG-mega9 Block F (Pedi: „immer noch kein richtiges Eingabeformular"): Texte des ECHTEN
  // Eingabeformulars für die Bildbeschreibung. Die Vorschlags-Logik darüber bleibt unverändert die
  // eine Quelle — das Formular ist die Oberfläche DAVOR, kein zweiter Weg zum Ergebnis.
  formOpen: "editor.captionForm.open",
  formTitle: "editor.captionForm.title",
  formLabel: "editor.captionForm.label",
  formPlaceholder: "editor.captionForm.placeholder",
  formLimit: "editor.captionForm.limit",
  formLimitReached: "editor.captionForm.limitReached",
  formAppend: "editor.captionForm.append",
  formSave: "editor.captionForm.save",
  formCancel: "editor.captionForm.cancel",
  formImageAlt: "editor.captionForm.imageAlt",
  formNoSuggestionYet: "editor.captionForm.noSuggestionYet",
  // AUFTRAG-mega11 Block D (bens SB-4): Das Ziel des Formulars ist unter ihm weggezogen worden
  // (Bild getauscht, Quelle gewechselt, Bildblock entfernt, Inhalt von außen ersetzt). Dann wird
  // NICHT geschrieben — und das wird gesagt, statt still auf ein abgelöstes Ziel zu schreiben.
  formStale: "editor.captionForm.stale",
  // AUFTRAG-mega84 Block A: die Bildbeschreibung SELBST ist der Einstieg. Sie ist damit ein
  // Bedienelement und braucht eine angekündigte Beschriftung — der Platzhalter allein ist eine
  // Aufforderung an das Auge, nicht an den Screenreader (und bei GEFÜLLTER Fußnote gibt es ihn gar
  // nicht: dort stünde sonst nur der Beschreibungstext, ohne dass jemand sagt, dass er anklickbar ist).
  captionOpenLabel: "editor.captionForm.openLabel",
  // AUFTRAG-mega84 Block B (Pedis entschiedener Umfang, 31.07. 13:30): fett, kursiv, Zeilenumbruch.
  formBold: "editor.captionForm.bold",
  formItalic: "editor.captionForm.italic",
  formLineBreak: "editor.captionForm.lineBreak",
  formFormatLabel: "editor.captionForm.formatLabel",
  // AUFTRAG-mega86 Block B (bens GELB aus sammel84): Fett/Kursiv konnten still nichts tun — weder
  // `execCommand` noch der Range-Rückfall richten etwas aus, wenn gar nichts markiert ist. Dann
  // wird der Grund GESAGT, statt den Nutzer raten zu lassen, warum der Knopf wirkungslos blieb.
  formSelectFirst: "editor.captionForm.selectFirst",
} as const;

// AUFTRAG-mega9 Block F: sichtbares Zeichen-Maximum der Bildbeschreibung — nach dem Muster, das der
// Prüfer für Quelle und Interviewantwort ausdrücklich gelobt hat (Grenze AM FELD sichtbar, statt
// still zu kürzen). Eine Fußnote ist eine kurze Bildunterschrift, kein Fließtext.
export const MAX_CAPTION_TEXT_CHARS = 300;

// Die Übernahme eines Vorschlags in das FELD (nicht in die Fußnote): ersetzen oder anhängen. Beim
// Anhängen entsteht genau ein Trenn-Leerzeichen, und das Ergebnis wird auf das Maximum begrenzt —
// dieselbe Grenze, die das Feld sichtbar ausweist (kein stilles Überlaufen).
//
// AUFTRAG-mega84 Block B: das Feld trägt seit heute FORMATIERUNG, sein Inhalt ist also HTML. Der
// Vorschlag selbst bleibt KLARTEXT (das Modell liefert keine Auszeichnung) — er wird deshalb
// escaped eingefügt, nie roh. Zwei Folgen, beide gewollt:
//   · ein Vorschlag kann keine Formatierung mitbringen und damit auch keine einschleusen,
//   · beim Anhängen bleibt die bereits gesetzte Formatierung des Nutzers erhalten.
// Die Grenze zählt KLARTEXT (`capCaptionHtml`), nicht Markup — sonst kostete ein <strong> den
// Nutzer 17 seiner 300 Zeichen.
export function applyCaptionSuggestionToHtml(
  currentHtml: string,
  suggestion: string,
  strategy: "replace" | "append",
): string {
  const eingefügt = escapeCaptionText(suggestion);
  const next =
    strategy === "replace" || captionPlainText(currentHtml).trim().length === 0
      ? eingefügt
      : `${currentHtml} ${eingefügt}`;
  return capCaptionHtml(next, MAX_CAPTION_TEXT_CHARS);
}

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

// ── AUFTRAG-mega11 Block D (bens SB-4): dieselbe Zielbindung für das FORMULAR ─────────────────────
//
// Der Inline-Weg band seinen Request an `data-image-id` UND die Auswahl-Generation und prüfte beides
// mit `captionResponseApplicable`. Der in mega9 ergänzte Formular-Weg prüfte dagegen nur, ob die
// Fußnote noch dieselbe ist (`captionFormRef.current?.caption === target`) — weder Generation noch
// Bild-Kennung noch die aktuelle DOM-Zugehörigkeit noch die Bildquelle.
//
// bens Widerlegung der mega9-Begründung, und sie trägt: der EGRESS- und ERGEBNISKERN ist zwischen
// beiden Wegen geteilt (`runCaptionSuggestion`, ein `onDescribeImage`), die GELTUNGSPRÜFUNG war es
// nicht. Eine späte Antwort konnte deshalb nach einem Bildtausch, einem Quellenwechsel, dem
// Entfernen und Neuaufbau des Bildblocks oder einem externen Wertwechsel noch im Formular erscheinen
// — und beim Speichern auf ein abgelöstes oder fremdes Ziel geschrieben werden.
//
// Diese beiden Funktionen sind die eine Quelle dieser Prüfung, für die Anzeige UND für das Speichern.

// Das Ziel, wie es beim ÖFFNEN des Formulars eingefroren wurde.
export interface CaptionFormTarget {
  imageId: string | null; // data-image-id der Fußnote
  src: string; // Bildquelle der zugehörigen figure
}

// Der Stand, wie er JETZT am DOM abgelesen wird.
export interface CaptionFormCurrent extends CaptionFormTarget {
  open: boolean; // Formular noch offen?
  sameCaption: boolean; // noch dieselbe Fußnote (Knoten-Identität)?
  inDom: boolean; // Fußnote noch im Editor-DOM (nicht abgelöst)?
  run: number; // Lauf-Nummer des Formulars (Öffnen/Schließen/Speichern/externer Wertwechsel)
}

// Darf überhaupt noch in dieses Ziel geschrieben werden? Gilt für das Speichern — dort gibt es
// keinen laufenden Request, dessen Generation man vergleichen könnte, aber sehr wohl ein Ziel, das
// sich unter dem offenen Formular verändert haben kann.
export function captionFormTargetIntact(
  opened: CaptionFormTarget & { run: number },
  current: CaptionFormCurrent,
): boolean {
  return (
    current.open &&
    current.sameCaption &&
    current.inDom &&
    current.run === opened.run &&
    current.imageId === opened.imageId &&
    current.src === opened.src
  );
}

// Darf eine (späte) Antwort im Formular ANGEZEIGT werden? Alles von oben PLUS die Generations-/
// Kennungs-Prüfung des Inline-Wegs — die beiden Oberflächen prüfen ab jetzt gleich streng.
export function captionFormResponseApplicable(
  opened: CaptionFormTarget & { run: number; generation: number },
  current: CaptionFormCurrent & { generation: number },
): boolean {
  return (
    captionFormTargetIntact(opened, current) &&
    captionResponseApplicable(
      { imageId: opened.imageId, generation: opened.generation },
      { imageId: current.imageId, generation: current.generation },
    )
  );
}

// AUFTRAG-mega84 Block A: `captionSuggestVisible` ist HIER ENTFALLEN. Sie steuerte die Sichtbarkeit
// des INLINE-Vorschlagsknopfes an der fokussierten Fußnote — eines Weges, den es seit mega84 nicht
// mehr gibt: die Fußnote ist kein Editing-Host mehr, sondern der Einstieg in das Formular, und der
// Vorschlag lebt ausschließlich IM Formular. Eine Sichtbarkeitsregel für eine Fläche, die niemand
// mehr rendern kann, wäre genau die tote, zweite Wahrheit, gegen die dieser Auftrag gebaut ist.

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
  innerHTML: string;
}

// AUFTRAG-mega84 Block B: Schreiben in die Fußnote. Bis mega82 lief das über `textContent` — das
// war richtig, solange die Beschreibung reiner Text war, und ist es ab jetzt nicht mehr: Pedis
// Formular kennt fett, kursiv und Zeilenumbruch.
//
// Die Sanitizer-Verträge bleiben trotzdem unangetastet, und zwar an ZWEI Stellen hintereinander:
// hier landet ausschließlich, was `sanitizeCaptionHtml` durchgelassen hat (der vorhandene
// Client-Sanitizer plus die Verengung auf die drei Tags), und beim Speichern läuft der Body wie
// jede Handeingabe noch einmal durch `emit()` → `sanitizeHtml` und danach durch den autoritativen
// Server-Sanitizer. Es gibt keinen Weg, auf dem ungeprüftes HTML in die Fußnote käme.
export function applyCaptionHtml(caption: CaptionLike, html: string): void {
  caption.innerHTML = html;
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
