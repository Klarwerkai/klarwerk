// SCRUM-318: DOM-freie Erkennung für den Lesemodus des ausführlichen Inhalts (bodyHtml) im KO-Detail.
// Reine String-/Regex-Auswertung auf bereits sanitisiertem HTML — KEINE DOM-Abhängigkeit, KEINE
// Parsing-Engine, kein Sicherheitsrisiko (es wird nichts ausgewertet/gerendert, nur erkannt).
// Liefert ehrliche Orientierung: Body vorhanden? enthält redaktionelle Blöcke? — Status/Trust/Quellen
// bleiben unverändert maßgeblich (nur Hinweis-Text, keine Bewertung).

import { isEmptyHtml } from "./richText";

// i18n-Keys für die Lese-Orientierung (Titel/Hinweis/Blöcke-Chip).
export const BODY_READ_TITLE_KEY = "ko.body.readTitle";
export const BODY_READ_NOTE_KEY = "ko.body.readNote";
export const BODY_READ_BLOCKS_KEY = "ko.body.readBlocksChip";

// Statische, sichere Block-Klassen aus SCRUM-314/316 (Basis + vier Typen).
// Wichtig: nur echte class-Attribute prüfen, nicht beliebigen Text wie "Panel im Auto".
const CLASS_ATTR_RE = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const BODY_BLOCK_CLASSES = new Set([
  "panel",
  "panel-info",
  "panel-note",
  "panel-warning",
  "panel-success",
]);

export function hasBody(bodyHtml: string | null | undefined): boolean {
  return !isEmptyHtml(bodyHtml);
}

export function hasBodyBlocks(bodyHtml: string | null | undefined): boolean {
  if (!hasBody(bodyHtml)) {
    return false;
  }
  CLASS_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null = CLASS_ATTR_RE.exec(bodyHtml ?? "");
  while (m !== null) {
    const classValue = m[1] ?? m[2] ?? m[3] ?? "";
    if (classValue.split(/\s+/).some((c) => BODY_BLOCK_CLASSES.has(c))) {
      return true;
    }
    m = CLASS_ATTR_RE.exec(bodyHtml ?? "");
  }
  return false;
}

export interface BodyReadMode {
  hasBody: boolean;
  hasBlocks: boolean;
}

export function bodyReadMode(bodyHtml: string | null | undefined): BodyReadMode {
  return { hasBody: hasBody(bodyHtml), hasBlocks: hasBodyBlocks(bodyHtml) };
}
