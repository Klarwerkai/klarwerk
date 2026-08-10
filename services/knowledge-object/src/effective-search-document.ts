import { type KoMetadataProjection, METADATA_REVISION_NONE } from "./metadata-projection";
import type {
  ClassificationSnapshot,
  KoSearchHit,
  KoSearchProjection,
  SearchProjectionStatus,
} from "./search-projection";

// ================================================================================================
// G27 WELLE 1 — DAS EFFECTIVE SEARCH DOCUMENT
// ================================================================================================
//
// WAS ES IST. Die EINE logisch vollständige Sicht, die der Suchkonsument sieht — zusammengesetzt
// aus genau zwei Quellen (KW-ARCH-G27, Abschnitt 3):
//
//     Immutable Content Projection (ko_id, ko_version)
//   + Mutable Metadata Projection  (ko_id)
//   = Effective Search Document
//
// WARUM ES DIESE DATEI GIBT. Ohne sie hätte S1 den äußeren Suchvertrag gebrochen: Kategorie und
// Schlagwörter sind aus der unveränderlichen Inhaltszeile verschwunden, aber Bibliothek und Klara
// suchen weiter danach. Die Welle ist deshalb ausdrücklich unteilbar (Detailentscheidung H) — ein
// isolierter S1-Stand wäre eine Suchregression, kein Zwischenschritt.
//
// WORAUS ES NICHT ENTSTEHT — und das ist ein verbindliches Stop-Kriterium, kein Stilwunsch:
// NIEMALS aus den operativen KO-/Kategorie-/Tag-Tabellen. Ein Join oder Fallback dorthin würde den
// äußeren Vertrag zwar billig erhalten, aber die Projektionsgrenze wieder aufheben: es gäbe zwei
// produktive Wahrheiten über denselben Suchbegriff, und niemand könnte sagen, welche gerade
// geliefert wurde. Fehlt die Metadatenzeile, ist die Antwort ehrlich leer (und der idempotente
// Backfill zieht sie nach) — nicht heimlich aus der operativen Tabelle geborgt.
//
// KEIN ZWEITER ÖFFENTLICHER SUCHVERTRAG. Dieses Dokument ist die INTERNE Zusammensetzung; nach
// außen bleibt `KoSearchHit` unverändert das, was es vorher war.

export interface EffectiveSearchDocument {
  koId: string;
  koVersion: number;
  projectionVersion: number;
  // --- aus der Immutable Content Projection ---
  searchText: string;
  titleText: string;
  statementText: string;
  captionText: string;
  bodyText: string;
  language: string;
  contentHash: string;
  status: SearchProjectionStatus;
  classificationSnapshot: ClassificationSnapshot;
  // --- aus der Mutable Metadata Projection ---
  categoryText: string;
  tagText: string;
  metadataRevision: number;
}

export const EFFECTIVE_SEARCH_DOCUMENT_FIELDS = [
  "koId",
  "koVersion",
  "projectionVersion",
  "searchText",
  "titleText",
  "statementText",
  "captionText",
  "bodyText",
  "language",
  "contentHash",
  "status",
  "classificationSnapshot",
  "categoryText",
  "tagText",
  "metadataRevision",
] as const;

/**
 * Die Zusammensetzung. Reine Funktion — keine Datenbank, kein Fallback, keine dritte Quelle.
 *
 * Fehlt die Metadatenzeile (Altbestand vor dem Backfill), stehen `categoryText`/`tagText` LEER und
 * `metadataRevision` auf `METADATA_REVISION_NONE`. Das ist die ehrliche Aussage „für dieses Objekt
 * ist noch kein Metadatenstand projiziert" — und an der Revision 0 ist sie von einem projizierten
 * Objekt ohne Kategorie eindeutig unterscheidbar.
 */
export function composeEffectiveSearchDocument(
  content: KoSearchProjection,
  metadata: KoMetadataProjection | undefined,
): EffectiveSearchDocument {
  return {
    koId: content.koId,
    koVersion: content.koVersion,
    projectionVersion: content.projectionVersion,
    searchText: content.searchText,
    titleText: content.titleText,
    statementText: content.statementText,
    captionText: content.captionText,
    bodyText: content.bodyText,
    language: content.language,
    contentHash: content.contentHash,
    status: content.status,
    classificationSnapshot: content.classificationSnapshot,
    categoryText: metadata?.categoryText ?? "",
    tagText: metadata?.tagText ?? "",
    metadataRevision: metadata?.metadataRevision ?? METADATA_REVISION_NONE,
  };
}

/**
 * DER TREFFER-VERTRAG als reine Funktion — die In-Memory-Adapter und die Tests leiten die
 * `matched`-Flags hieraus ab; Postgres bildet exakt dieselbe Regel in SQL ab (ILIKE je Feld).
 *
 * DIE ODER-BEDINGUNG hat jetzt DREI Glieder statt einem: `search_text` deckt nur noch die
 * revisionsgebundenen Inhaltsteile ab; Kategorie und Schlagwörter stehen daneben und müssen
 * ausdrücklich mitgeprüft werden. Genau hier bliebe der äußere Vertrag sonst auf der Strecke.
 *
 * `matched.body` bleibt UNVERÄNDERT abgeleitet („getroffen, aber in keinem der Kurzfelder") und
 * nicht etwa neu aus `bodyText` berechnet: die Bedeutung dieses Flags gehört zum äußeren Vertrag,
 * den diese Welle ausdrücklich nicht ändert.
 */
export function matchEffectiveSearchDocument(
  doc: EffectiveSearchDocument,
  terms: readonly string[],
): KoSearchHit | undefined {
  const treffer = (feld: string): boolean => {
    const lower = feld.toLowerCase();
    return terms.some((term) => lower.includes(term));
  };
  const category = treffer(doc.categoryText);
  const tag = treffer(doc.tagText);
  if (!treffer(doc.searchText) && !category && !tag) {
    return undefined;
  }
  const title = treffer(doc.titleText);
  const statement = treffer(doc.statementText);
  const caption = treffer(doc.captionText);
  return {
    koId: doc.koId,
    koVersion: doc.koVersion,
    projectionVersion: doc.projectionVersion,
    contentHash: doc.contentHash,
    status: doc.status,
    language: doc.language,
    matched: {
      title,
      statement,
      category,
      tag,
      caption,
      body: !(title || statement || category || tag || caption),
    },
  };
}
