// SCRUM-355 / FR-STR-02 / G-P1-1: DOM-freier Helfer, um eine Nicht-Bild-Datei als SICHEREN Link im
// ausführlichen Wissenstext (bodyHtml) zu referenzieren. KEINE Legacy-Data-URLs, KEINE breite
// Sanitizer-Allowlist: der Link zeigt ausschließlich auf den vorhandenen internen Object-Store-Raw-Pfad
// `/api/objects/:id/raw`. Der Dateiname wird sicher escapt. Reine String-/Daten-Logik — kein DOM, kein
// Upload, keine Validierung (die Datei-Referenz ist Evidence/Anhang, KEIN Status-/Trust-/Validierungs-
// Signal). Server- und FE-Sanitizer behalten genau die schmale `attachment`-Div-Klasse + sichere Links.

import { isEmptyHtml } from "./richText";

// Object-Store-IDs sind Wort-/Bindestrich-Token; alles andere wird abgelehnt (kein Pfad-/Scheme-Trick).
const OBJECT_ID_RE = /^[\w-]+$/;

function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sicherer interner Raw-Pfad für ein Object-Store-Objekt, oder null bei ungültiger ID.
export function objectRawHref(objectId: string | null | undefined): string | null {
  const id = (objectId ?? "").trim();
  return OBJECT_ID_RE.test(id) ? `/api/objects/${id}/raw` : null;
}

export interface BodyFileInput {
  objectId?: string | null;
  name?: string | null;
}

// WP-HYG (bens P2-Hinweis aus D1e): DIE zentrale Object-Id-Längen-Reserve — sie lebt HIER, im
// Modul, das Object-Links besitzt, statt verstreut bei den Aufrufern. Reale Ids sind UUIDs
// (36 Zeichen, s. object-store/service.ts genId → randomUUID); 128 liegt weit darüber, sodass ein
// mit dieser Reserve gebauter Platzhalter-Link NIE kürzer ist als ein echter — Größen-Preflights
// mit reservedObjectLinkHtml sind damit beweisbar ausreichend.
export const OBJECT_LINK_ID_RESERVE_CHARS = 128;

// Platzhalter-Link mit reservierter Id-Länge — die EINE Quelle für alle Größen-Preflights
// (kein Aufrufer baut mehr eine eigene x-Repeat-Id).
export function reservedObjectLinkHtml(name: string): string {
  return fileLinkHtml({ objectId: "x".repeat(OBJECT_LINK_ID_RESERVE_CHARS), name });
}

// Sichere Body-Datei-Referenz: div.attachment > a(href=raw, title=name) > name. Leer, wenn keine
// gültige objectId vorliegt (kein Fake-Link). Nur sichere, vom Sanitizer erlaubte Attribute/Klassen.
export function fileLinkHtml(input: BodyFileInput): string {
  const href = objectRawHref(input.objectId);
  if (!href) {
    return "";
  }
  const name = (input.name ?? "").trim() || "Datei";
  const safeName = escapeText(name);
  return `<div class="attachment"><a href="${href}" title="${safeName}">${safeName}</a></div>`;
}

// Body-Datei-Referenz nicht-destruktiv anhängen; leerer Body → setzen; ohne gültige objectId = No-Op.
export function applyBodyFileLink(
  currentHtml: string | null | undefined,
  input: BodyFileInput,
): string {
  const next = fileLinkHtml(input);
  const base = currentHtml ?? "";
  if (next.length === 0) {
    return base;
  }
  return isEmptyHtml(base) ? next : base + next;
}

export interface EditorFile {
  objectId: string;
  name: string;
  mime?: string | null;
}

interface AttachmentRecordLike {
  name?: string | null;
  mime?: string | null;
  objectId?: string | null;
}

function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.toLowerCase().startsWith("image/");
}

// Aus KO-Attachments die im Body verlinkbaren Dateien ableiten: NICHT-Bild UND mit Object-Store-`objectId`.
// Bilder werden weiterhin über den Bild-Einfügen-Pfad eingebettet; Dateien ohne `objectId` (z. B. noch
// nicht hochgeladene Capture-Session-Dateien) sind bewusst NICHT verlinkbar (kein Fake-Link).
export function editorFilesFromAttachments(
  attachments: readonly AttachmentRecordLike[],
): EditorFile[] {
  const out: EditorFile[] = [];
  for (const a of attachments) {
    const id = (a.objectId ?? "").trim();
    if (id.length === 0 || isImageMime(a.mime) || !OBJECT_ID_RE.test(id)) {
      continue;
    }
    out.push({ objectId: id, name: (a.name ?? "").trim() || "Datei", mime: a.mime ?? null });
  }
  return out;
}
