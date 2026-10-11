// G27 — DIE FELDVERTRÄGE DER SUCHPROJEKTIONEN, ALS ERWARTUNG DER TESTS.
//
// R-1349: Diese drei Listen standen bis hierher als `SEARCH_PROJECTION_FIELDS`,
// `METADATA_PROJECTION_FIELDS` und `EFFECTIVE_SEARCH_DOCUMENT_FIELDS` im Produktmodul
// `services/knowledge-object` („der Feldvertrag als Datum — damit ein Test ihn prüfen kann").
// Kein Produktweg hat sie gelesen; den Vertrag im Produkt tragen die Typen `KoSearchProjection`,
// `KoMetadataProjection` und `EffectiveSearchDocument`. Die Listen liegen deshalb bei den Tests,
// die die Laufzeitform jeder Projektion gegen sie halten — unverändert im Inhalt und in der
// Reihenfolge (Architekturentscheidung und Tabellenspalten).

export const SEARCH_PROJECTION_FIELDS = [
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
  "createdAt",
  "updatedAt",
] as const;

export const METADATA_PROJECTION_FIELDS = [
  "koId",
  "categoryText",
  "tagText",
  "metadataRevision",
  "updatedAt",
] as const;

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
