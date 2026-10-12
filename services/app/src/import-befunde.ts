// ================================================================================================
// R-0179 / FR-EXT-01 (Aufnahme import-gesamtvertrag, Nacharbeit 3, Bens Befunde) — VERALTETE
// INHALTE UND SCHÜTZENSWERTES FIRMENWISSEN AM IMPORTKANDIDATEN ERKENNEN.
// ================================================================================================
//
// Die Befundübersicht der Import-Seite zählte „veraltet" nur an bereits übernommenen Objekten und
// „schützenswert" nur an vorhandenen Vertraulichkeitsstufen. Diese Datei bewertet den KANDIDATEN
// selbst — vor der Übernahme — und unterscheidet dabei ausdrücklich „bewertet, ohne Befund" von
// „nicht bewertet".
//
// VERALTET — dieselbe Regel, die der Import an der Gruppierung schon zeigt (`STALE_AFTER_DAYS`,
// services/library-analytics/src/grouping.ts, Qualitätshinweis „stale"): der Stand der Quelle
// (`ImportItem.updatedAt`) liegt länger als diese Frist zurück. Ohne lesbaren Stand ist der
// Kandidat NICHT bewertet — es wird kein Alter geraten.
//
// SCHÜTZENSWERT — vier Gründe, jeder aus einer vorhandenen Regel oder einer schmalen, benannten
// Kennzeichnung:
//   · `einstufung`   — die Quelle stuft „vertraulich" oder „streng vertraulich" ein;
//   · `leseschutz`   — die Quelle beschränkt das Lesen auf Personen oder Gruppen
//                      (`sourceRestrictions`, Erzeuger ist allein ein Quelladapter);
//   · `schutzdaten`  — Personalnummer oder IBAN im Text (`erkenneSchutzdaten`, R-0658 — dieselbe
//                      Regel, die ein Wissensobjekt in Quarantäne stellt);
//   · `kennzeichnung` — der Text trägt eine ausdrückliche Schutzkennzeichnung (vertraulich,
//                      Betriebs-/Geschäftsgeheimnis, nur für den internen Gebrauch, confidential,
//                      trade secret, internal use only, proprietary).
// Geprüft wird Titel, Aussage und Volltext. Ein Kandidat ohne jeden Text ist NICHT bewertet.
// Es werden nur GRÜNDE ausgegeben, nie die gefundenen Werte.
//
// GRENZE: Die Kennzeichnung ist eine Wortliste, kein Verständnis des Inhalts. Unmarkiertes
// Spezialwissen erkennt sie nicht; ein Nullbefund heißt „keine dieser Kennzeichnungen".
import { type SchutzdatenArt, erkenneSchutzdaten } from "../../knowledge-object";
import { type ImportCandidate, STALE_AFTER_DAYS } from "../../library-analytics";
import { htmlToPlainText } from "../../structure";

export type SchutzGrund = "einstufung" | "leseschutz" | "schutzdaten" | "kennzeichnung";

export type SchutzBefund =
  | { readonly bewertet: false }
  | {
      readonly bewertet: true;
      readonly gruende: readonly SchutzGrund[];
      readonly schutzdaten: readonly SchutzdatenArt[];
    };

export type VeraltetBefund =
  | { readonly bewertet: false }
  | { readonly bewertet: true; readonly veraltet: boolean; readonly stand: string };

export interface ImportKandidatBefund {
  readonly id: string;
  readonly schutz: SchutzBefund;
  readonly veraltet: VeraltetBefund;
}

const TAG_MS = 24 * 60 * 60 * 1000;

/** Ausdrückliche Schutzkennzeichnungen im Text — schmal gehalten, ganze Wörter. */
export const SCHUTZKENNZEICHNUNG =
  /(?:^|[^\p{L}])(?:streng\s+vertraulich|vertraulich|betriebsgeheimnis(?:se)?|gesch(?:ä|ae)ftsgeheimnis(?:se)?|nur\s+f(?:ü|ue)r\s+den\s+internen\s+gebrauch|strictly\s+confidential|confidential|trade\s+secrets?|internal\s+use\s+only|proprietary)(?![\p{L}])/iu;

const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function veraltetBefund(updatedAt: unknown, jetztMs: number): VeraltetBefund {
  if (typeof updatedAt !== "string" || !ISO_ZEIT.test(updatedAt)) {
    return { bewertet: false };
  }
  const stand = Date.parse(updatedAt);
  if (!Number.isFinite(stand)) {
    return { bewertet: false };
  }
  return {
    bewertet: true,
    veraltet: jetztMs - stand > STALE_AFTER_DAYS * TAG_MS,
    stand: updatedAt,
  };
}

/** Personen oder Gruppen, auf die die Quelle das Lesen beschränkt — ungeprüfte Form, defensiv. */
function hatLeseschutz(leser: unknown): boolean {
  if (!leser || typeof leser !== "object") {
    return false;
  }
  const { users, groups } = leser as { users?: unknown; groups?: unknown };
  return (Array.isArray(users) && users.length > 0) || (Array.isArray(groups) && groups.length > 0);
}

/**
 * Die Leseeinschränkung als Quellangabe (R-0549, `quellangaben.ts`: `sourceReadRestriction`). Sie
 * reist am Kandidaten mit, steht aber nicht im eingefrorenen `ImportItem` — deshalb hier gelesen.
 */
function quellangaben(item: ImportCandidate["item"]): unknown {
  return (item as unknown as { sourceReadRestriction?: unknown }).sourceReadRestriction;
}

function schutzBefund(kandidat: ImportCandidate): SchutzBefund {
  const item = kandidat.item;
  const texte = [
    item.title,
    item.statement,
    typeof item.bodyHtml === "string" ? htmlToPlainText(item.bodyHtml) : undefined,
  ].filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  if (texte.length === 0) {
    return { bewertet: false };
  }
  const gruende: SchutzGrund[] = [];
  if (item.confidentiality === "vertraulich" || item.confidentiality === "streng_vertraulich") {
    gruende.push("einstufung");
  }
  if (hatLeseschutz(item.sourceRestrictions) || hatLeseschutz(quellangaben(item))) {
    gruende.push("leseschutz");
  }
  const schutzdaten = erkenneSchutzdaten(texte);
  if (schutzdaten.length > 0) {
    gruende.push("schutzdaten");
  }
  if (texte.some((t) => SCHUTZKENNZEICHNUNG.test(t))) {
    gruende.push("kennzeichnung");
  }
  return { bewertet: true, gruende, schutzdaten };
}

/** Die Befunde je Kandidat, in der gelieferten Reihenfolge. */
export function importKandidatBefunde(
  kandidaten: readonly ImportCandidate[],
  jetztMs: number,
): ImportKandidatBefund[] {
  return kandidaten.map((k) => ({
    id: k.id,
    schutz: schutzBefund(k),
    veraltet: veraltetBefund(k.item.updatedAt, jetztMs),
  }));
}
