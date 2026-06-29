// SCRUM-324: DOM-freie Inhaltsqualitäts-Signale für den Beta-Editor. Leitet aus `bodyHtml` (und
// optional dem Attachment-Kontext) einfache STRUKTUR-/Nachvollziehbarkeits-Signale ab — KEINE
// fachliche Wahrheitsbewertung, KEINE KI, KEINE Validierung, keine DOM-Abhängigkeit. Robuste
// String-/Regex-Auswertung auf bereits sanitisiertem HTML; bestehende Helfer werden wiederverwendet.

import { hasBodyBlocks } from "./bodyReadMode";
import { type AttachmentLike, attachmentContext } from "./editorAttachmentContext";
import { htmlToPlainText, isEmptyHtml } from "./richText";

// Unter dieser Klartext-Länge gilt vorhandener Inhalt vorsichtig als „dünn" (nur Hinweis, kein Zwang).
const THIN_TEXT_THRESHOLD = 80;

// Typische Begriffe, die auf eine Erwähnung von Anhängen im Text hindeuten (DE + EN, defensiv).
const ATTACHMENT_MENTION_TERMS = [
  "bild",
  "foto",
  "abbildung",
  "screenshot",
  "datei",
  "anhang",
  "anlage",
  "dokument",
  "pdf",
  "image",
  "photo",
  "picture",
  "figure",
  "file",
  "attachment",
  "document",
];

export interface ContentQualityInput {
  bodyHtml?: string | null;
  attachments?: readonly AttachmentLike[];
}

export interface ContentQuality {
  isEmpty: boolean;
  isThin: boolean;
  hasHeadings: boolean;
  hasLists: boolean;
  hasBlocks: boolean;
  hasLinks: boolean;
  hasAttachments: boolean;
  mentionsAttachments: boolean;
  // Anhänge vorhanden, aber im Text kein typischer Verweis darauf → defensiver Hinweis.
  attachmentsUnreferenced: boolean;
}

export function editorContentQuality(input: ContentQualityInput): ContentQuality {
  const html = input.bodyHtml ?? "";
  const attachments = input.attachments ?? [];
  const text = htmlToPlainText(html);
  const lowerText = text.toLowerCase();

  const isEmpty = isEmptyHtml(html);
  const isThin = !isEmpty && text.length < THIN_TEXT_THRESHOLD;
  const hasHeadings = /<h[23]\b/i.test(html);
  const hasLists = /<(ul|ol|li)\b/i.test(html);
  const hasBlocks = hasBodyBlocks(html);
  const hasLinks = /<a\b[^>]*\bhref=/i.test(html);

  const hasAttachments = attachmentContext(attachments).hasAny;
  const mentionsAttachments =
    hasAttachments && ATTACHMENT_MENTION_TERMS.some((term) => lowerText.includes(term));

  return {
    isEmpty,
    isThin,
    hasHeadings,
    hasLists,
    hasBlocks,
    hasLinks,
    hasAttachments,
    mentionsAttachments,
    attachmentsUnreferenced: hasAttachments && !mentionsAttachments,
  };
}
