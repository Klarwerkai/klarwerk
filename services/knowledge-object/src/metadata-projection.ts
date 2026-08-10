import { normalizeSearchFragment } from "./search-projection";
import type { KnowledgeObject } from "./types";

// ================================================================================================
// G27 WELLE 1 / S2 — DIE VERÄNDERLICHE METADATENPROJEKTION. DIESE DATEI IST IHRE REINE REGEL.
// ================================================================================================
//
// WARUM ES SIE GIBT. Kategorie und normale Schlagwörter sind im Domänenmodell VERSIONSLOSE,
// dynamische Metadaten: `updateCategory` und `updateTags` erzeugen ausdrücklich keinen KO-Versions-
// Bump (KW-ARCH-G27, Abschnitt 1). In der append-only Content Projection an (ko_id, ko_version)
// wären sie damit planmäßig veraltet — die Suche zeigte einen Wert, den das Objekt nicht mehr
// trägt, und niemand könnte die Zeile korrigieren, ohne die Unveränderlichkeit zu brechen.
//
// Ihr Schlüssel ist deshalb `ko_id` — EINE Zeile je Objekt, die den AKTUELLEN Stand trägt.
//
// WAS SIE AUSDRÜCKLICH NICHT AUFNIMMT. Sicherheits-, Zugriffs-, Export-, KI-, Aufbewahrungs-,
// Validierungs-, Freigabe- und Provenienzmerkmale sind KEINE normalen Schlagwörter und wirken nie
// über diesen Mechanismus (Abschnitt 1, Detailentscheidung B, Schnittfolge G: „S2 nimmt keine
// Sicherheitsklassifizierung auf"). Eine sicherheitswirksame Einstufung, die über einen
// versionslosen, jederzeit überschreibbaren Metadatenweg wanderte, wäre genau die stille
// Rechteänderung, die es nicht geben darf.
//
// `metadata_revision` IST DER BEWEIS. Sie wächst monoton und GENAU DANN, wenn sich die fachlich
// wirksamen Metadatentexte wirklich ändern. Damit ist „die Suche steht auf dem aktuellen Stand"
// keine Behauptung mehr, sondern eine Zahl, die man vergleichen kann — und die Wiederholung
// desselben Updates ist nachweislich idempotent statt nur „vermutlich harmlos".

/**
 * DER KANONISCHE FELDVERTRAG der veränderlichen Metadatenprojektion (KW-ARCH-G27, Abschnitt 2).
 */
export interface KoMetadataProjection {
  koId: string;
  categoryText: string;
  tagText: string;
  /** Monoton. Klettert bei jeder WIRKSAMEN Änderung genau einmal, nie bei einer Wiederholung. */
  metadataRevision: number;
  updatedAt: string;
}

// Der Feldvertrag als Datum — damit ein Test ihn prüfen kann, statt ihn abzuschreiben.
export const METADATA_PROJECTION_FIELDS = [
  "koId",
  "categoryText",
  "tagText",
  "metadataRevision",
  "updatedAt",
] as const;

/** Die Felder, aus denen ein Treffer dieser Projektion entstehen kann. */
export const METADATA_PROJECTION_MATCH_FIELDS = ["categoryText", "tagText"] as const;

/** Die Revision einer Zeile, die es noch nicht gibt. Nie ein gültiger Stand — nur „noch nichts". */
export const METADATA_REVISION_NONE = 0;

/**
 * DIE reine Ableitung der Metadatentexte aus dem Wissensobjekt.
 *
 * Dieselbe Normalisierung wie in der Content Projection (search-projection.ts) — sonst hätte die
 * eine Hälfte des Suchdokuments eine andere Auffassung davon, was dasselbe Wort ist, als die
 * andere. Die Schlagwortreihenfolge ist die AM OBJEKT: sie ist eine Eingabe des Menschen und keine
 * Menge, die wir umordnen dürften (und eine Umsortierung wäre eine wirksame Änderung, die die
 * Revision zu Recht klettern ließe).
 */
export function metadataTextsOf(ko: Pick<KnowledgeObject, "category" | "tags">): {
  categoryText: string;
  tagText: string;
} {
  return {
    categoryText: normalizeSearchFragment(ko.category),
    tagText: (ko.tags ?? []).map((tag) => normalizeSearchFragment(tag)).join(" "),
  };
}

/** Sind zwei Metadatenstände fachlich derselbe? Genau diese Frage entscheidet über den Bump. */
export function metadataTextsEqual(
  a: { categoryText: string; tagText: string },
  b: { categoryText: string; tagText: string },
): boolean {
  return a.categoryText === b.categoryText && a.tagText === b.tagText;
}
