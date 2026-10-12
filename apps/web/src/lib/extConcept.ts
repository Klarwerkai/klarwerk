// SCRUM-90/91/95/96 (EXT-Restblock): DOM-freie, rein abgeleitete Konzept-/Sichtmodelle für
// den Import-/Wiederverwendungsfluss und Gültigkeit/Schutz. KEINE neue Engine, KEINE
// Persistenz, KEINE erfundene Bewertung (z. B. kein erfundenes Ablaufdatum, keine IP-Klasse).
import type {
  Conflict,
  ImportCandidate,
  ImportKandidatBefund,
  KnowledgeObject,
} from "../api/types";

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
// Dubletten, IP. Jede Art zählt zwei Dinge: die TREFFER und die Kandidaten, die für diese Art
// NICHT BEWERTET werden konnten. Ein Nullbefund heißt damit „bewertet, nichts gefunden" — wer nicht
// bewertet ist, steht getrennt da (Nacharbeit 3, Bens Befunde).
//   · Kandidaten — die Prüfliste selbst.
//   · Dubletten — der Dublettenbefund der Prüfliste; „Prüfung nicht möglich" ist nicht bewertet.
//   · fehlend — `candidateFindings().missingInfo` (dieselbe Regel wie das Abzeichen am Kandidaten).
//   · Konflikte — übernommene Kandidaten, deren Wissensobjekt in einem UNGELÖSTEN Konflikt steht
//     (`GET /api/conflicts`, dieselbe Regel wie `validityProtectionView`). Ein noch nicht
//     übernommener Kandidat ist für diese Art nicht bewertet.
//   · veraltet — der Stand der QUELLE liegt jenseits der Importfrist (`GET /api/library/import/
//     candidates/befunde`, Server-Regel `STALE_AFTER_DAYS`) ODER das übernommene Wissensobjekt steht
//     zur erneuten Prüfung an (`GET /api/lifecycle/pending`). Ohne Stand und ohne Objekt: nicht
//     bewertet.
//   · schützenswert — die Servererkennung (Einstufung, Leseschutz der Quelle, Schutzdaten,
//     Schutzkennzeichnung im Text). Fehlt sie, zählt allein die Einstufung der Quelle als Treffer;
//     alle übrigen sind dann nicht bewertet.
//
// `found: null` heißt „nicht ermittelt" (das Signal selbst ist nicht abrufbar) — nie 0.
export const IMPORT_FINDING_KINDS = [
  "candidates",
  "conflicts",
  "missing",
  "outdated",
  "duplicates",
  "protected",
] as const;
export type ImportFindingKind = (typeof IMPORT_FINDING_KINDS)[number];

export interface ImportFindingCount {
  /** Treffer unter den bewerteten Kandidaten; `null` = das Signal ist nicht abrufbar. */
  found: number | null;
  /** Kandidaten, die für diese Art nicht bewertet werden konnten. */
  notAssessed: number;
}

export type ImportFindingCounts = Record<ImportFindingKind, ImportFindingCount>;

export interface ImportFindingSignals {
  /** Sichtbare Konflikte; `undefined`, solange (oder weil) sie nicht gelesen werden konnten. */
  conflicts?: readonly Conflict[] | undefined;
  /** Kennungen der zur erneuten Prüfung anstehenden Objekte; `undefined` = nicht gelesen. */
  pendingIds?: readonly string[] | undefined;
  /** Die Serverbefunde je Kandidat (veraltet, schützenswert); `undefined` = nicht gelesen. */
  befunde?: readonly ImportKandidatBefund[] | undefined;
}

const SCHUETZENSWERT = new Set(["vertraulich", "streng_vertraulich"]);

type Bewertung = "treffer" | "ohne" | "offen";

function zaehle(bewertungen: readonly Bewertung[]): ImportFindingCount {
  return {
    found: bewertungen.filter((b) => b === "treffer").length,
    notAssessed: bewertungen.filter((b) => b === "offen").length,
  };
}

function veraltetBewertung(
  c: ImportCandidate,
  befund: ImportKandidatBefund | undefined,
  pending: ReadonlySet<string> | null,
): Bewertung {
  const quelle = befund?.veraltet.bewertet ? befund.veraltet.veraltet : undefined;
  const objekt = c.koId && pending ? pending.has(c.koId) : undefined;
  if (quelle === true || objekt === true) {
    return "treffer";
  }
  return quelle === undefined && objekt === undefined ? "offen" : "ohne";
}

function schutzBewertung(c: ImportCandidate, befund: ImportKandidatBefund | undefined): Bewertung {
  const eingestuft = SCHUETZENSWERT.has(c.item.confidentiality ?? "");
  if (befund?.schutz.bewertet) {
    return eingestuft || befund.schutz.gruende.length > 0 ? "treffer" : "ohne";
  }
  // Ohne Servererkennung bleibt allein die Einstufung der Quelle eine belegte Aussage.
  return eingestuft ? "treffer" : "offen";
}

/** Die Dublettenfrage konnte nicht entschieden werden — weder Dublette noch keine. */
function dubletteOffen(c: ImportCandidate): boolean {
  return c.dublettenbefund?.ergebnis === "pruefung_nicht_moeglich";
}

export function importFindingsOverview(
  candidates: readonly ImportCandidate[],
  signals: ImportFindingSignals = {},
): ImportFindingCounts {
  const queue = summarizeImportQueue(candidates);
  const ungeloest = signals.conflicts?.filter((c) => c.status !== "geloest");
  const imKonflikt = ungeloest ? new Set(ungeloest.flatMap((c) => [c.koA, c.koB])) : null;
  const pending = signals.pendingIds ? new Set(signals.pendingIds) : null;
  const befunde = new Map((signals.befunde ?? []).map((b) => [b.id, b] as const));
  // Nur übernommene Kandidaten tragen eine Objektkennung — nur sie sind auf Konflikte bewertbar.
  const ohneObjekt = candidates.filter((c) => !c.koId).length;
  return {
    candidates: { found: queue.total, notAssessed: 0 },
    conflicts: {
      found: imKonflikt ? candidates.filter((c) => c.koId && imKonflikt.has(c.koId)).length : null,
      notAssessed: ohneObjekt,
    },
    missing: {
      found: candidates.filter((c) => candidateFindings(c).missingInfo).length,
      notAssessed: 0,
    },
    outdated: zaehle(candidates.map((c) => veraltetBewertung(c, befunde.get(c.id), pending))),
    duplicates: { found: queue.duplicates, notAssessed: candidates.filter(dubletteOffen).length },
    protected: zaehle(candidates.map((c) => schutzBewertung(c, befunde.get(c.id)))),
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
