// SCRUM-90/91/95/96 (EXT-Restblock): DOM-freie, rein abgeleitete Konzept-/Sichtmodelle für
// den Import-/Wiederverwendungsfluss und Gültigkeit/Schutz. KEINE neue Engine, KEINE
// Persistenz, KEINE erfundene Bewertung (z. B. kein erfundenes Ablaufdatum, keine IP-Klasse).
import type { Conflict, ImportCandidate, KnowledgeObject } from "../api/types";

// SCRUM-90: konzeptioneller Import-/Wiederverwendungsfluss (Upload → … → Wiederverwenden).
export const IMPORT_PIPELINE_STEPS = [
  "upload",
  "extract",
  "structure",
  "review",
  "validate",
  "release",
  "reuse",
] as const;
export type ImportPipelineStep = (typeof IMPORT_PIPELINE_STEPS)[number];

// SCRUM-91: ehrliche Zusammenfassung der Review-Queue aus den vorhandenen Statuswerten.
export interface ImportQueueSummary {
  total: number;
  duplicates: number;
  accepted: number;
  rejected: number;
  infoRequested: number;
  open: number;
}

export function summarizeImportQueue(candidates: readonly ImportCandidate[]): ImportQueueSummary {
  return {
    total: candidates.length,
    duplicates: candidates.filter((c) => c.duplicate).length,
    accepted: candidates.filter((c) => c.status === "angenommen").length,
    rejected: candidates.filter((c) => c.status === "abgelehnt").length,
    infoRequested: candidates.filter((c) => c.status === "info-angefragt").length,
    open: candidates.filter((c) => c.status === "neu").length,
  };
}

// ================================================================================================
// Aufnahme 20260922 · import-gesamtvertrag (R-0179, FR-EXT-01) — DIE BEFUNDÜBERSICHT DES IMPORTS.
// ================================================================================================
//
// FR-EXT-01 verlangt die Ergebnis-Befunde in sechs Arten: Kandidaten, Konflikte, fehlend, veraltet,
// Dubletten, IP. Jede Zahl hier stammt aus einer VORHANDENEN Quelle; keine Art bekommt eine eigene,
// neue Erkennungsregel:
//   · Kandidaten, Dubletten — die Prüfliste selbst (dieselben Zahlen wie `summarizeImportQueue`).
//   · fehlend — `candidateFindings().missingInfo` (dieselbe Regel wie das Abzeichen am Kandidaten).
//   · Konflikte — übernommene Kandidaten, deren Wissensobjekt in einem UNGELÖSTEN Konflikt steht
//     (`GET /api/conflicts`, dieselbe Regel wie `validityProtectionView`).
//   · veraltet — übernommene Kandidaten, deren Wissensobjekt zur erneuten Prüfung ansteht
//     (`GET /api/lifecycle/pending`, dort „revalidierung-faellig").
//   · schützenswert — Kandidaten, deren Quelle „vertraulich" oder „streng vertraulich" meldet. Eine
//     eigene IP-Bewertung gibt es weiterhin nicht (`IpSensitivity` unten bleibt „nicht-bewertet").
//
// `null` heißt „nicht ermittelt" (das Signal ist nicht abrufbar) — nie „null Befunde". Ein noch
// nicht übernommener Kandidat hat kein Wissensobjekt und kann darum weder Konflikt noch Veraltung
// tragen; das ist eine Grenze der Quelle, keine Entwarnung.
export const IMPORT_FINDING_KINDS = [
  "candidates",
  "conflicts",
  "missing",
  "outdated",
  "duplicates",
  "protected",
] as const;
export type ImportFindingKind = (typeof IMPORT_FINDING_KINDS)[number];

export type ImportFindingCounts = Record<ImportFindingKind, number | null>;

export interface ImportFindingSignals {
  /** Sichtbare Konflikte; `undefined`, solange (oder weil) sie nicht gelesen werden konnten. */
  conflicts?: readonly Conflict[] | undefined;
  /** Kennungen der zur erneuten Prüfung anstehenden Objekte; `undefined` = nicht gelesen. */
  pendingIds?: readonly string[] | undefined;
}

const SCHUETZENSWERT = new Set(["vertraulich", "streng_vertraulich"]);

export function importFindingsOverview(
  candidates: readonly ImportCandidate[],
  signals: ImportFindingSignals = {},
): ImportFindingCounts {
  const queue = summarizeImportQueue(candidates);
  // Nur übernommene Kandidaten tragen eine Objektkennung.
  const koIds = candidates.flatMap((c) => (c.koId ? [c.koId] : []));
  const ungeloest = signals.conflicts?.filter((c) => c.status !== "geloest");
  const imKonflikt = ungeloest ? new Set(ungeloest.flatMap((c) => [c.koA, c.koB])) : null;
  const pending = signals.pendingIds ? new Set(signals.pendingIds) : null;
  return {
    candidates: queue.total,
    conflicts: imKonflikt ? koIds.filter((id) => imKonflikt.has(id)).length : null,
    missing: candidates.filter((c) => candidateFindings(c).missingInfo).length,
    outdated: pending ? koIds.filter((id) => pending.has(id)).length : null,
    duplicates: queue.duplicates,
    protected: candidates.filter((c) => SCHUETZENSWERT.has(c.item.confidentiality ?? "")).length,
  };
}

// SCRUM-91: kompakte Befunde je Kandidat (Badges) — nur aus vorhandenen Feldern abgeleitet.
//
// JOB 3116: zwei Befunde tragen eine KENNUNG, und sie tragen sie als Objekt oder gar nicht —
// `{ koId } | null` statt eines Booleans neben einer losen `koId`. Dieselbe Typdisziplin, die der
// Servertyp begründet: eine Kennung gibt es nur, wenn der Befund sie wirklich führt. `null` heißt
// hier immer „diese Aussage steht nicht an" — nie „das Gegenteil gilt".
export interface CandidateFindings {
  duplicate: boolean;
  missingInfo: boolean; // fehlende Pflichtangaben (Titel/Aussage/Kategorie)
  acceptedKo: boolean; // angenommen → echtes KO im normalen Flow erzeugt
  rejected: boolean;
  infoRequested: boolean;
  // Derselbe Herkunfts-Anker liegt im Papierkorb — mit der Kennung des getrashten Objekts.
  imPapierkorb: { koId: string } | null;
  // Der Inhalt fließt in ein BESTEHENDES Wissensobjekt zurück (Re-Sync) — mit dessen Kennung.
  wiederverwendet: { koId: string } | null;
}

/**
 * Die Kennung wird NUR genannt, wenn der Befund sie wirklich trägt. Ein Treffer der Art `kandidat`
 * verweist auf einen offenen Eintrag der Warteschlange (desselben Laufs oder, seit R-0116, eines
 * früheren Uploads) und hat keine `koId`; im Anker-Strang kann er nicht
 * vorkommen, aber daraus eine Kennung zu erfinden wäre genau die Behauptung ohne Voraussetzung,
 * gegen die der Typ steht.
 */
function trefferKoId(befund: ImportCandidate["dublettenbefund"]): { koId: string } | null {
  if (befund === undefined || !("treffer" in befund) || befund.treffer.art !== "wissensobjekt") {
    return null;
  }
  return { koId: befund.treffer.koId };
}

export function candidateFindings(candidate: ImportCandidate): CandidateFindings {
  const item = candidate.item;
  const missingInfo = !item.title?.trim() || !item.statement?.trim() || !item.category?.trim();
  const befund = candidate.dublettenbefund;
  const imPapierkorb = befund?.ergebnis === "im_papierkorb" ? trefferKoId(befund) : null;
  const wiederverwendet = befund?.ergebnis === "wiederverwendet" ? trefferKoId(befund) : null;
  return {
    // JOB 3116 · ABLÖSUNG: am Papierkorb-Kandidaten setzt der Server `duplicate: true` (fail-closed,
    // service.ts). „Dublette" heißt im Anker-Strang aber ausdrücklich nur „dasselbe Quellobjekt
    // zweimal in DIESEM Lauf" — neben dem genaueren Papierkorb-Befund wäre es ein zweites Wort für
    // dieselbe Sache, und das schwächere von beiden. Es tritt darum zurück, statt danebenzustehen.
    duplicate: candidate.duplicate && imPapierkorb === null,
    missingInfo,
    // JOB 3116 · ABLÖSUNG: beim Re-Sync wird die Kennung eines BESTEHENDEN Objekts zurückgegeben —
    // erzeugt wurde nichts. „KO erzeugt" wäre schlicht falsch.
    // Lauf gesamt-import-adoption:2 Runde 3 (Bens B3): dasselbe gilt für den Papierkorb-Anker —
    // die Annahme nennt dann die Kennung des getrashten Objekts, angelegt wurde nichts.
    acceptedKo:
      candidate.status === "angenommen" &&
      candidate.koId !== null &&
      wiederverwendet === null &&
      imPapierkorb === null,
    rejected: candidate.status === "abgelehnt",
    infoRequested: candidate.status === "info-angefragt",
    imPapierkorb,
    wiederverwendet,
  };
}

// SCRUM-95/96: Gültigkeit & Schutz als ehrlich abgeleitete Sicht (kein neues KO-Feld,
// keine Persistenz). freshnessStatus aus Status + Revalidierungs-/Konflikt-Signalen.
export type FreshnessStatus =
  | "validiert"
  | "revalidierung-faellig"
  | "offen"
  | "konflikt"
  | "unbekannt";

// IP-Sensitivität wird bewusst NICHT erfunden — bis zu einem echten Governance-/Modell-Ticket
// bleibt sie „nicht bewertet".
export type IpSensitivity = "nicht-bewertet";

// Stabile, sprachunabhängige Empfehlungs-Token (i18n-Mapping in der UI).
export type ExtRecommendation =
  | "clarify-conflict"
  | "start-revalidation"
  | "finish-validation"
  | "output-ready"
  | "unknown";

export interface ValidityProtectionView {
  freshnessStatus: FreshnessStatus;
  ipSensitivity: IpSensitivity;
  outputEligible: boolean;
  recommendation: ExtRecommendation;
}

export function validityProtectionView(
  ko: Pick<KnowledgeObject, "id" | "status">,
  pendingIds: readonly string[],
  conflicts: readonly Conflict[],
): ValidityProtectionView {
  const inConflict = conflicts.some(
    (c) => (c.koA === ko.id || c.koB === ko.id) && c.status !== "geloest",
  );
  const pending = pendingIds.includes(ko.id);

  let freshnessStatus: FreshnessStatus;
  let recommendation: ExtRecommendation;
  if (inConflict) {
    freshnessStatus = "konflikt";
    recommendation = "clarify-conflict";
  } else if (pending) {
    freshnessStatus = "revalidierung-faellig";
    recommendation = "start-revalidation";
  } else if (ko.status === "offen") {
    freshnessStatus = "offen";
    recommendation = "finish-validation";
  } else if (ko.status === "validiert") {
    freshnessStatus = "validiert";
    recommendation = "output-ready";
  } else {
    freshnessStatus = "unbekannt";
    recommendation = "unknown";
  }

  return {
    freshnessStatus,
    ipSensitivity: "nicht-bewertet",
    // SCRUM-95: Output-Eignung strikt an „validiert" gekoppelt (Output Factory nutzt nur diese).
    outputEligible: ko.status === "validiert",
    recommendation,
  };
}
