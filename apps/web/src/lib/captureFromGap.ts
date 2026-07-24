// SCRUM-263: DOM-freier Übergang Wissenslücke → Erfassung. Baut den Link von einer offenen
// Wissenslücke (/risiko) nach /erfassen; Capture liest den Startkontext für die Rohnotiz. KEIN
// automatisches KO, keine Lücken-Schließung — der Mensch ergänzt die Erfahrung, die KI strukturiert nur.
//
// FUNKE-FIX2 P0 (bens Erforderlich 4): Der Einstieg trägt jetzt die GAP-ID statt des Fragetextes.
// Gap-Fragen sind Nutzer-Freitext OHNE Vertraulichkeitsstufe und dürfen NICHT in URL/Historie/Logs
// landen. Capture löst die ID über die BEREITS serverseitig berechtigungsgefilterte Gap-Liste in den
// Fragetext auf (resolveGapQuestion) — ein Unberechtigter bekommt dort nur die redigierte Sicht (kein
// Freitext). So erscheint der Text erst NACH serverseitiger Berechtigungsprüfung.

import type { Gap } from "../api/types";

const GAP_PARAM = "gap";

// SCRUM-285: FE-seitige, DOM-freie Normalisierung des Gap-Startkontexts. SPIEGELT bewusst die
// Backend-Regel (services/ask/src/gap-text.ts → normalizeGapQuestion, MAX 200) wider, OHNE
// cross-package Import (Architekturgrenze). Damit rutschen lange Originalfragen weder über die
// Ask-Direkt-CTA (roher `asked`-Text) noch über externe/alte /erfassen?gap=…-Links als überlanger
// URL-/Capture-Kontext durch. Trimmt + zieht Whitespace zusammen + begrenzt deterministisch an
// Wortgrenze (sonst harter Schnitt) mit Ellipse. KEINE PII-Erkennung, keine semantische Analyse.
// Kurze normale Fragen bleiben unverändert; das Ergebnis ist identisch zur persistierten
// gap.question (gleiche Regel) → konsistenter Ask→Gap→Risk→Capture-Fluss.
export const MAX_GAP_CONTEXT_LENGTH = 200;

const ELLIPSIS = "…";

export function normalizeGapContext(
  question: string,
  maxLength: number = MAX_GAP_CONTEXT_LENGTH,
): string {
  const collapsed = question.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }
  const window = collapsed.slice(0, maxLength);
  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(maxLength * 0.6) ? window.slice(0, lastSpace) : window;
  return `${cut.trimEnd()}${ELLIPSIS}`;
}

// FUNKE-FIX2 P0 (bens Erforderlich 4): Link zur Erfassung mit der GAP-ID (kein Fragetext in der URL).
export function captureGapHref(gapId: string): string {
  return `/erfassen?${GAP_PARAM}=${encodeURIComponent(gapId)}`;
}

// Die Gap-ID aus den Query-Parametern lesen (null bei leer).
export function readGapId(params: URLSearchParams): string | null {
  const value = (params.get(GAP_PARAM) ?? "").trim();
  return value.length > 0 ? value : null;
}

// FUNKE-FIX2 P0 (bens Erforderlich 4): Startkontext über die Gap-ID auflösen — NUR aus der bereits
// serverseitig berechtigungsgefilterten Gap-Liste. Ein redigierter oder unbekannter Eintrag liefert
// null (kein Freitext ohne Berechtigung). Das Ergebnis ist defensiv normalisiert.
export function resolveGapQuestion(
  gapId: string | null,
  gaps: readonly Gap[] | undefined,
): string | null {
  if (!gapId || !gaps) {
    return null;
  }
  const gap = gaps.find((g) => g.id === gapId);
  if (!gap || gap.redacted) {
    return null;
  }
  const value = normalizeGapContext(gap.question);
  return value.length > 0 ? value : null;
}

// SCRUM-270: Rohnotiz-Vorlage aus einer Gap-Frage. Macht klar, dass die Frage ein OFFENER
// Startkontext ist (kein fertiges Wissen): die Frage steht als „Offene Frage", darunter eine
// leere Zeile für die eigene Erfahrung/Beobachtung. Labels werden übergeben (DOM-frei, i18n-fähig).
// Keine KO-Erzeugung, keine Lücken-Schließung — nur eine Schreibvorlage für den Menschen.
export interface GapDraftLabels {
  question: string; // z. B. „Offene Frage"
  experience: string; // z. B. „Eigene Erfahrung/Beobachtung ergänzen"
}

export function gapContextDraft(question: string, labels: GapDraftLabels): string {
  return `${labels.question}: ${question.trim()}\n\n${labels.experience}:\n`;
}

// SCRUM-283: Einheitlicher, datensparsamer Hinweis zu gespeicherten Wissenslücken. Eine
// unbeantwortete Frage wird als Wissenslücke gespeichert — das ist KEINE Antwort und KEIN
// validiertes Wissen. Nutzer sollen keine sensiblen/personenbezogenen Details erfassen und
// später geprüfte Erfahrung ergänzen. DOM-frei: liefert nur den i18n-Schlüssel, damit Ask und
// Risk denselben ehrlichen Wortlaut zeigen (eine Quelle der Wahrheit). Kein Backend, keine
// PII-Erkennung — reiner Anzeigetext.
export const GAP_PRIVACY_NOTICE_KEY = "gap.privacyNotice";

export function gapPrivacyNoticeKey(): string {
  return GAP_PRIVACY_NOTICE_KEY;
}
