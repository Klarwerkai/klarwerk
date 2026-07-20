// SCRUM-315: DOM-freie Helfer für die KI-Nachbearbeitung des ausführlichen Inhalts (bodyHtml).
// Die KI liefert PLAINTEXT (reasoner.assist) — diese Helfer leiten den KI-Quelltext aus dem Body ab
// und wandeln einen Plaintext-Vorschlag in SICHERES Body-HTML um. Sicherheit: KI-Text wird escaped;
// erzeugt werden nur statische <p>/<br>-Tags. Bestehender Body-HTML-Stand wird NICHT erneut escaped
// (sanitizeHtml ist bei Entities nicht idempotent → keine Doppel-Maskierung). Kein Auto-Speichern,
// keine Validierung — der Mensch übernimmt den Vorschlag bewusst.

import type { StructureResult } from "../api/types";
import { frontDoorStructuredBodyHtml } from "./captureFrontDoor";
import { EDITOR_BLOCKS, type EditorBlock, editorBlockClass } from "./editorBlocks";
import { FLAT_BODY_TAGS, htmlToPlainText, isEmptyHtml, sanitizeHtml } from "./richText";

export type BodyAssistMode = "replace" | "append";

function escapeBodyText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plaintext → escapte <p>-Absätze (Doppel-Umbruch = Absatz, einfacher Umbruch = <br>). Leer → "".
// Gemeinsame Basis für freie Absätze (suggestionToBodyHtml) und Block-Inhalt (suggestionToBodyBlockHtml).
function escapedParagraphs(text: string | null | undefined): string {
  const normalized = (text ?? "").replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) {
    return "";
  }
  return normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => `<p>${p.split("\n").map(escapeBodyText).join("<br>")}</p>`)
    .join("");
}

// KI-Quelltext aus dem Body ableiten (reiner Text; Bilder/Markup fallen weg — der Reasoner arbeitet
// auf Text). Leerer/fehlender Body → leerer String (Box wird dann deaktiviert).
export function bodyTextForAssist(bodyHtml: string | null | undefined): string {
  return bodyHtml ? htmlToPlainText(bodyHtml) : "";
}

// WP-D6/WP-D6b (Pedi-LIVE-BEFUND + bens ROT-Fix 1): „Original ist heilig" gilt AUCH gegenüber dem
// KI-Vorschlag. Ein Struktur-/Assist-Vorschlag liefert flachen Klartext; würde er einen Body mit
// eingebetteten Bildern oder ECHTER Struktur/Formatierung ERSETZEN, gingen Bilder und Formatierung
// unwiderruflich verloren (der berichtete Schaden). Die Entscheidung wird KONSERVATIV aus dem
// autoritativen Rich-Text-Tag-Vertrag (richText.FLAT_BODY_TAGS) abgeleitet — KEINE zweite, driftanfällige
// Liste: NUR ein wirklich flacher Body aus p/br/Text gilt als nicht-reich; JEDES andere Tag (div.panel,
// div.attachment, a, strong/em/u, li/tr/td/thead/tbody/tfoot/caption, h*, ul/ol, img, table, blockquote —
// und jedes unbekannte Tag) macht den Body reich → er darf NICHT ersetzt werden.
export function shouldPreserveRichBody(bodyHtml: string | null | undefined): boolean {
  const re = /<\/?([a-zA-Z][\w-]*)/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = re.exec(bodyHtml ?? "")) !== null) {
    const tag = (m[1] ?? "").toLowerCase();
    if (!FLAT_BODY_TAGS.has(tag)) {
      return true;
    }
  }
  return false;
}

// WP-D6b (bens GELB-Fix 3): PURE Übernahme-Entscheidung für den Struktur-Vorschlag — EINE Quelle für
// Handler UND Test (kein simulateAccept-Klon). Ergebnis:
//  - preserved: reicher Body wird NICHT ersetzt (byte-identisch erhalten);
//  - titleAdopted: der Titel war leer UND der Vorschlag hat einen → er wird übernommen (sonst bleibt der
//    vorhandene Titel unverändert). Die Kernaussage wird NIE in den Body übernommen.
export interface StructureProposalInput {
  currentTitle: string;
  currentBodyHtml: string;
  proposal: StructureResult;
}

export interface StructureProposalResult {
  title: string;
  bodyHtml: string;
  preserved: boolean;
  titleAdopted: boolean;
}

export function applyStructureProposal(input: StructureProposalInput): StructureProposalResult {
  const preserved = shouldPreserveRichBody(input.currentBodyHtml);
  const titleWasEmpty = input.currentTitle.trim().length === 0;
  const proposalHasTitle = input.proposal.title.trim().length > 0;
  const titleAdopted = titleWasEmpty && proposalHasTitle;
  const title = titleAdopted ? input.proposal.title : input.currentTitle;
  // preserved ⇒ Body BYTE-IDENTISCH erhalten; sonst der flache Body wird strukturiert. Das ist die EINZIGE
  // Stelle, an der frontDoorStructuredBodyHtml den Body ersetzt (Source-Pin im Test).
  const bodyHtml = preserved ? input.currentBodyHtml : frontDoorStructuredBodyHtml(input.proposal);
  return { title, bodyHtml, preserved, titleAdopted };
}

// Plaintext-Vorschlag → strukturiertes, sicheres Body-HTML: Doppel-Zeilenumbruch = Absatz, einfacher
// Umbruch = <br>. Der Text wird selbst escaped; die einzigen erzeugten Tags sind statische <p>/<br>.
// Leer → "".
export function suggestionToBodyHtml(text: string | null | undefined): string {
  return escapedParagraphs(text);
}

// SCRUM-316: Plaintext-Vorschlag → sicherer Body-BLOCK (Info/Hinweis/Warnung/Erfolg). Nutzt die
// statische, sichere Klasse aus editorBlocks (`panel panel-<typ>`); der Text wird escaped, es entstehen
// nur statische <div>/<p>/<br>-Tags — keine fremden Klassen, kein aktives HTML aus Modelltext.
// Leerer Vorschlag → "".
export function suggestionToBodyBlockHtml(
  block: EditorBlock,
  text: string | null | undefined,
): string {
  const inner = escapedParagraphs(text);
  if (inner.length === 0) {
    return "";
  }
  return `<div class="${editorBlockClass(block)}">${inner}</div>`;
}

// Bewusste Übernahme: replace ersetzt den Body durch den Vorschlag, append hängt ihn an.
// Bestehender Body (`currentHtml`) gilt als bereits sanitisiert (kommt aus dem Editor) und wird
// unverändert übernommen; nur der neue Vorschlag wird sanitisiert. Leerer Vorschlag = No-Op.
export function applyBodyAssist(
  mode: BodyAssistMode,
  currentHtml: string | null | undefined,
  suggestionText: string | null | undefined,
): string {
  const base = currentHtml ?? "";
  const next = suggestionToBodyHtml(suggestionText);
  if (next.length === 0) {
    return base;
  }
  if (mode === "replace") {
    return next;
  }
  return isEmptyHtml(base) ? next : base + next;
}

interface HtmlToken {
  kind: "tag" | "text";
  value: string;
}

export interface SpellingAssistApplyResult {
  html: string;
  applied: boolean;
  reason?: "empty_suggestion" | "word_count_mismatch";
}

function decodeBodyText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const tagRe = /<[^>]+>/g;
  let last = 0;
  let match: RegExpExecArray | null = tagRe.exec(html);
  while (match !== null) {
    if (match.index > last) {
      tokens.push({ kind: "text", value: html.slice(last, match.index) });
    }
    tokens.push({ kind: "tag", value: match[0] });
    last = tagRe.lastIndex;
    match = tagRe.exec(html);
  }
  if (last < html.length) {
    tokens.push({ kind: "text", value: html.slice(last) });
  }
  return tokens;
}

function textWords(text: string): string[] {
  return text.trim().length > 0 ? text.trim().split(/\s+/) : [];
}

function renderMappedText(originalText: string, replacementWords: string[]): string {
  const decoded = decodeBodyText(originalText);
  const leading = decoded.match(/^\s*/)?.[0] ?? "";
  const trailing = decoded.match(/\s*$/)?.[0] ?? "";
  return escapeBodyText(`${leading}${replacementWords.join(" ")}${trailing}`);
}

// Rechtschreibung ist der einzige KI-Hilfe-Modus, der vorhandene RichText-Struktur erhalten muss:
// Der Reasoner liefert weiterhin Plaintext, deshalb wird der Vorschlag konservativ Wort-fuer-Wort
// auf die vorhandenen Textknoten verteilt. Tags/Attribute kommen ausschliesslich aus dem bestehenden
// sanitisierten Body; das Ergebnis laeuft erneut durch sanitizeHtml. Wenn die Wortanzahl nicht passt,
// wird die destruktive Uebernahme blockiert.
export function applySpellingAssistPreservingHtml(
  currentHtml: string | null | undefined,
  suggestionText: string | null | undefined,
): SpellingAssistApplyResult {
  const base = sanitizeHtml(currentHtml ?? "");
  const suggestionWords = textWords(suggestionText ?? "");
  if (suggestionWords.length === 0) {
    return { html: base, applied: false, reason: "empty_suggestion" };
  }

  const tokens = tokenizeHtml(base);
  const textTokenWordCounts = tokens.map((token) =>
    token.kind === "text" ? textWords(decodeBodyText(token.value)).length : 0,
  );
  const originalWordCount = textTokenWordCounts.reduce((sum, count) => sum + count, 0);
  if (originalWordCount !== suggestionWords.length) {
    return { html: base, applied: false, reason: "word_count_mismatch" };
  }

  let offset = 0;
  const mapped = tokens
    .map((token, index) => {
      if (token.kind === "tag") {
        return token.value;
      }
      const count = textTokenWordCounts[index] ?? 0;
      if (count === 0) {
        return token.value;
      }
      const nextWords = suggestionWords.slice(offset, offset + count);
      offset += count;
      return renderMappedText(token.value, nextWords);
    })
    .join("");

  return { html: sanitizeHtml(mapped), applied: true };
}

// SCRUM-316: Vorschlag bewusst als Body-Block ANHÄNGEN (Info/Hinweis/Warnung/Erfolg). Bestehender
// Body bleibt unverändert; nur der neue Block wird ergänzt. Leerer Vorschlag = No-Op.
export function applyBodyAssistBlock(
  currentHtml: string | null | undefined,
  suggestionText: string | null | undefined,
  block: EditorBlock,
): string {
  const base = currentHtml ?? "";
  const next = suggestionToBodyBlockHtml(block, suggestionText);
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}

// SCRUM-343: Plaintext-Vorschlag → strukturierter ABSCHNITT: erste nicht-leere Zeile wird die
// Überschrift (<h3>), der Rest sichere Absätze. Macht aus „freiem KI-Text" einen klar gegliederten
// Editor-Abschnitt. Text wird escaped; erzeugt werden nur statische <h3>/<p>/<br>-Tags. Leer → "".
export function suggestionToBodySectionHtml(text: string | null | undefined): string {
  const normalized = (text ?? "").replace(/\r\n?/g, "\n").trim();
  if (normalized.length === 0) {
    return "";
  }
  const newline = normalized.indexOf("\n");
  const heading = (newline === -1 ? normalized : normalized.slice(0, newline)).trim();
  const rest = newline === -1 ? "" : normalized.slice(newline + 1).trim();
  const headingHtml = heading.length > 0 ? `<h3>${escapeBodyText(heading)}</h3>` : "";
  const out = headingHtml + escapedParagraphs(rest);
  return out.length > 0 ? out : "";
}

// SCRUM-343: Vorschlag bewusst als strukturierten Abschnitt übernehmen. Bestehender Body bleibt
// unverändert; nur der neue Abschnitt wird ergänzt (leerer Body → gesetzt). Leerer Vorschlag = No-Op.
export function applyBodyAssistSection(
  currentHtml: string | null | undefined,
  suggestionText: string | null | undefined,
): string {
  const base = currentHtml ?? "";
  const next = suggestionToBodySectionHtml(suggestionText);
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}

// SCRUM-337: gebündelte AiAssistBox-„extraApplyActions" für die vier Body-Blocktypen (Info/Hinweis/
// Warnung/Erfolg) — bisher in Capture UND KO-Detail dupliziert, jetzt eine geteilte, testbare Quelle
// (auch vom Knowledge Input Studio genutzt). Reine Ableitung über die bestehenden Helfer; kein DOM.
export interface BodyAssistBlockAction {
  labelKey: string;
  apply: (original: string, suggestion: string) => string;
}

export function bodyAssistBlockActions(currentHtml: string): BodyAssistBlockAction[] {
  return EDITOR_BLOCKS.map((block) => ({
    labelKey: `capture.ai.applyAs.${block}`,
    apply: (_original: string, suggestion: string) =>
      applyBodyAssistBlock(currentHtml, suggestion, block),
  }));
}

// SCRUM-343: „als Abschnitt"-Übernahme als eigene strukturierte Aktion (gleiche Form wie die
// Block-Aktionen, damit die AiAssistBox sie unverändert rendern kann).
export function bodyAssistSectionAction(currentHtml: string): BodyAssistBlockAction {
  return {
    labelKey: "capture.ai.applyAs.section",
    apply: (_original: string, suggestion: string) =>
      applyBodyAssistSection(currentHtml, suggestion),
  };
}

// SCRUM-343: gebündelte strukturierte Übernahme-Modi für den Knowledge-Studio-Arbeitsraum:
// zuerst „als Abschnitt" (Überschrift + Absätze), dann die vier Block-Typen. So fühlt sich die
// KI-Übernahme editor-nah an (Struktur statt nur Ersetzen/Anhängen).
export function bodyAssistStructuredActions(currentHtml: string): BodyAssistBlockAction[] {
  return [bodyAssistSectionAction(currentHtml), ...bodyAssistBlockActions(currentHtml)];
}
