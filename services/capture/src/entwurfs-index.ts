import { createHash } from "node:crypto";
import {
  MAX_SEARCH_TEXT_LENGTH,
  normalizeSearchFragment,
  visibleTextFromBodyHtml,
} from "../../knowledge-object";
import { searchCaptionTexts } from "../../structure";
import type { Draft } from "./types";

// ================================================================================================
// R-1133 — DER TECHNISCHE INDEX DES ENTWURFS. DIESE DATEI IST SEINE REINE REGEL.
// ================================================================================================
//
// DIE LÜCKE. Wissensobjekte — auch die offenen, eingereichten und die mit Prüfzuweisung, also die
// prüfbaren Einträge — tragen seit G27 einen technischen Index: die Suchprojektion je Fassung
// (`knowledge-object/src/search-projection.ts`). Entwürfe trugen keinen. Ihr Inhalt lag nur als
// JSONB-Vollobjekt mit bis zu 5 MiB `bodyHtml` vor, und jede Frage an ihn hieß: Rumpf laden.
//
// WAS ER IST. Eine Ableitung aus dem GESPEICHERTEN Entwurfsstand: derselbe sichtbare Text, dieselbe
// Normalisierung und derselbe Fußnoten-Scanner wie die KO-Projektion — kein zweiter Begriff davon,
// was an einem Text suchbar ist. Gebunden an `stand` (= `updatedAt` des indizierten Entwurfs): ein
// Index gilt nur, solange der gespeicherte Entwurf noch genau diesen Stand trägt.
//
// WAS ER NICHT IST. Keine Wahrheit. Der Entwurf, seine Quellen und jede menschliche Entscheidung
// bleiben, wo sie sind; der Index entscheidet über nichts, gibt nichts frei und ändert keine Rechte.
// Fehlt er oder ist er veraltet, fehlt eine Beschleunigung — nicht ein Inhalt.

/**
 * Die Fassung der Regel. Ändert sich die Feldgrenze oder die Normalisierung, steigt sie, und der
 * Abgleich (`CaptureService.gleicheEntwurfsIndexAb`) zieht jeden Entwurf auf die neue Fassung nach.
 */
export const ENTWURFS_INDEX_FASSUNG = 1;

export type EntwurfsIndexStatus = "vollstaendig" | "unvollstaendig";

export interface EntwurfsIndex {
  fassung: number;
  /** `updatedAt` des Entwurfsstands, aus dem dieser Index abgeleitet ist. */
  stand: string;
  /** sha256 über alle Inhaltsfelder mit festen Grenzen — gleicher Inhalt, gleicher Wert. */
  inhaltsHash: string;
  /** Der normalisierte Suchtext (gedeckelt wie der KO-Suchtext). */
  text: string;
  /** `unvollstaendig`, wenn `text` geschnitten wurde — der Index behauptet keine Vollständigkeit. */
  status: EntwurfsIndexStatus;
}

/**
 * Die Ableitung. Deterministisch: gleicher Entwurfsinhalt ⇒ gleicher Text und gleicher Hash.
 *
 * Die Felder sind die des späteren Wissensobjekts, aus denen auch dessen Suchdokument entsteht:
 * Titel, Aussage, Kategorie, Schlagwörter, Bildunterschriften, sichtbarer Textkörper.
 */
export function entwurfsIndexVon(draft: Draft): EntwurfsIndex {
  const p = draft.payload;
  const felder = [
    normalizeSearchFragment(p.title),
    normalizeSearchFragment(p.statement),
    normalizeSearchFragment(p.category),
    (p.tags ?? [])
      .map((tag) => normalizeSearchFragment(tag))
      .filter((tag) => tag.length > 0)
      .join(" "),
    searchCaptionTexts(p.bodyHtml)
      .map((caption) => normalizeSearchFragment(caption))
      .join(" "),
    normalizeSearchFragment(visibleTextFromBodyHtml(p.bodyHtml)),
  ];
  const roh = felder.filter((teil) => teil.length > 0).join("\n");
  const geschnitten = roh.length > MAX_SEARCH_TEXT_LENGTH;
  // Der Hash läuft über ALLE sechs Felder samt leerer — sonst hätten „Titel x, Aussage leer" und
  // „Titel leer, Aussage x" denselben Wert —, und über den ungeschnittenen Inhalt.
  const inhaltsHash = createHash("sha256")
    .update(JSON.stringify([ENTWURFS_INDEX_FASSUNG, ...felder]), "utf8")
    .digest("hex");
  return {
    fassung: ENTWURFS_INDEX_FASSUNG,
    stand: draft.updatedAt,
    inhaltsHash,
    text: geschnitten ? roh.slice(0, MAX_SEARCH_TEXT_LENGTH) : roh,
    status: geschnitten ? "unvollstaendig" : "vollstaendig",
  };
}
