import {
  type ExternalSourceRecord,
  type ImportCandidate,
  type ImportItem,
  type ImportRun,
  type ImportRunCounters,
  type ImportRunItemRef,
  type ImportRunStatus,
  LibraryError,
  type ReviewAction,
  type ReviewStatus,
  istImportItemOutcome,
  istImportRunStatus,
  istImportZeitpunkt,
} from "./types";

// WP-SHIP8-CLOSE-3 (bens ROT-2): der OFFENE Idempotenzraum der Review-Queue. Ein geclaimter
// Kandidat ('in_bearbeitung') ist weiterhin OFFEN — er belegt denselben (provider, externalId,
// sourceVersion)-Schlüssel wie 'neu'. Sonst könnte ein paralleler Importlauf WÄHREND einer
// Review-Aktion einen zweiten offenen Kandidaten derselben Quelle einreihen. EINE Definition für
// InMemory-Dedupe, Pending-Abgleiche/Statuskarten und (gespiegelt) das Pg-Index-Prädikat.
export const OPEN_REVIEW_STATUSES = ["neu", "in_bearbeitung"] as const;

export function isOpenReviewStatus(status: ReviewStatus): boolean {
  return status === "neu" || status === "in_bearbeitung";
}

// SCRUM-157: Persistenz-Schnittstelle der Import-/Source-Review-Queue. Einziger Unterschied
// zwischen In-Memory (Dev/Test) und Postgres. Insertionsreihenfolge bleibt erhalten.
export interface CandidateRepo {
  insert(candidate: ImportCandidate): Promise<void>;
  // SCRUM-510 (WP3): ATOMAR idempotenter Insert für den externalId-Upsert-Strang. Legt den Kandidaten NUR
  // an, wenn noch KEIN OFFENER (status "neu") Kandidat mit derselben (externalId, sourceVersion) existiert.
  // Gibt true zurück, wenn tatsächlich eingefügt wurde, false bei Kollision. Auf Postgres über einen
  // partiellen UNIQUE-Index + ON CONFLICT DO NOTHING — so legen selbst NEBENLÄUFIGE Läufe/Retries keine
  // Doppel-Kandidaten an (der app-seitige seen/pending-Check ist TOCTOU-anfällig, dieser Insert nicht).
  insertIfAbsent(candidate: ImportCandidate): Promise<boolean>;
  findById(id: string): Promise<ImportCandidate | undefined>;
  // WP-SHIP8-CLOSE-2 (bens F1) + WP-SHIP8-CLOSE-3 (bens ROT-1): ATOMARER Claim (CAS) — setzt
  // Status 'neu' → 'in_bearbeitung' UND persistiert das Lease-Protokoll (opId + claimedAt) in
  // EINEM bedingten Write (Pg: UPDATE … WHERE status='neu' RETURNING; InMemory: synchron, kein
  // await zwischen Prüfen und Setzen). Rückgabe ist der geclaimte Kandidat (Stand NACH dem CAS)
  // oder undefined, wenn der CAS nicht griff (Status geändert/Kandidat weg) — der Aufrufer
  // bricht dann ehrlich ab. Das bedingte Cleanup-Delete (removeByIds, erwarteter Status) kann
  // einen geclaimten Kandidaten nicht mehr treffen.
  // WP-SHIP8-CLOSE-7 (bens ROT-2): claimedBy/claimedAction reisen ADDITIV im selben CAS mit —
  // die Recovery kennt damit den echten Reviewer und die geclaimte Aktion. Beide optional
  // (Altaufrufer/Altclaims bleiben gültig); resolveClaim räumt sie wie opId/claimedAt aus.
  claim(
    id: string,
    opId: string,
    claimedAt: string,
    claimedBy?: string,
    claimedAction?: ReviewAction,
  ): Promise<ImportCandidate | undefined>;
  // WP-SHIP8-CLOSE-3 (bens ROT-1): ATOMARER Abschluss des Claims (CAS auf status='in_bearbeitung'
  // UND exakt DIESER opId) — wendet `next` an (Status, optional koId/note/item) und räumt das
  // Lease-Protokoll (opId/claimedAt) IMMER aus. undefined = der Claim gehört nicht (mehr) dieser
  // Operation (z. B. Recovery hat übernommen) — der Aufrufer darf keinen Erfolg annehmen. Der
  // Aufruf mit { status: "neu" } ist die Claim-Rückgabe, mit einem Endstatus der Abschluss; die
  // Recovery nutzt DENSELBEN CAS (kein zweiter Schreibweg).
  resolveClaim(
    id: string,
    opId: string,
    next: ClaimResolution,
  ): Promise<ImportCandidate | undefined>;
  // WP-SHIP8-CLOSE-2 (bens F1): 0 getroffene Zeilen sind ein KONFLIKT (LibraryError "CONFLICT"),
  // kein stilles Ok — der Kandidat ist zwischenzeitlich verschwunden, der Aufrufer muss es sehen.
  update(candidate: ImportCandidate): Promise<void>;
  all(): Promise<ImportCandidate[]>;
  // WP-D-CLEAN (Pedis Testdaten-Aufräumen): entfernt ALLE Kandidaten (jeden Status) aus der Queue
  // und gibt die Anzahl zurück. Kandidaten sind Queue-Einträge, keine Wissensobjekte — für sie ist
  // die harte Entfernung der vorgesehene Weg (kein Papierkorb-Vertrag wie bei KOs).
  // WP-NIGHT-FIX (bens F2-TOCTOU): der CLEANUP-Weg nutzt removeAll NICHT mehr (er würde auch
  // Kandidaten löschen, die NACH dem Digest-Vergleich eingereiht wurden) — removeAll bleibt nur
  // als Werkzeug-/Test-Helfer erhalten.
  removeAll(): Promise<number>;
  // WP-NIGHT-FIX (bens F2-TOCTOU): die Löschung ist an die BESTÄTIGTEN Ids der Vorschau gebunden;
  // ein parallel eingereihter neuer Kandidat überlebt und wird in der Bilanz ehrlich ausgewiesen.
  // WP-SHIP8-CLOSE (bens F2): die Löschung ist zusätzlich BEDINGT — je Eintrag reist der zum
  // Bestätigungs-Zeitpunkt gesehene Status mit, und gelöscht wird NUR, wessen Status noch exakt
  // so ist (Status-Bedingung IN der Löschung: Pg als EIN Statement mit RETURNING id; InMemory
  // atomar je Item, kein await zwischen Prüfen und Löschen). Rückgabe sind die TATSÄCHLICH
  // entfernten Ids — die Wahrheit für die Bilanz; ein Accept im letzten Fenster verliert nie.
  removeByIds(entries: readonly ImportCandidateRemoval[]): Promise<string[]>;
  // WP-SHIP8-CLOSE-7 (bens ROT-1): BEDINGTES Löschen der auditPending-Markierung — nur wenn sie
  // noch EXAKT diese eventId trägt (CAS-Semantik: eine inzwischen neu gesetzte fremde Markierung
  // wird nie überschrieben). true = Markierung entfernt; false = nicht (mehr) vorhanden/fremd.
  // Ein verschwundener Kandidat ist hier KEIN Fehler (Cleanup darf gewinnen) — der Beleg selbst
  // ist zu diesem Zeitpunkt bereits über recordOnce gesichert bzw. exactly-once nachziehbar.
  clearAuditPending(id: string, eventId: string): Promise<boolean>;
}

// WP-SHIP8-CLOSE (bens F2): ein bedingter Lösch-Auftrag — id + der erwartete (bestätigte) Status.
export interface ImportCandidateRemoval {
  id: string;
  status: string;
}

// WP-SHIP8-CLOSE-3 (bens ROT-1): Abschluss-Patch eines Claims. Nur explizit gesetzte Felder
// werden geschrieben; opId/claimedAt räumt resolveClaim immer aus.
export interface ClaimResolution {
  status: ReviewStatus;
  koId?: string | null;
  note?: string | null;
  item?: ImportItem;
  // WP-SHIP8-CLOSE-6 (bens ROT-3a): Wer/Wann der Entscheidung — im SELBEN Statuswrite persistiert.
  reviewedBy?: string;
  reviewedAt?: string;
  // WP-SHIP8-CLOSE-7 (bens GELB): die Aktion wirklich persistiert (aus der geclaimten Aktion).
  reviewedAction?: ReviewAction;
  // WP-SHIP8-CLOSE-7 (bens ROT-1): VORBEUGENDE Beleg-Markierung — im SELBEN CAS wie der
  // Endstatus persistiert (die Event-Id ist vor dem Statuswrite bekannt). Gelingt das
  // Aktionsaudit danach, löscht clearAuditPending sie bedingt; bei Fehler ODER Crash bleibt sie
  // automatisch für den Queue-Load-Nachzug stehen — es gibt kein Fenster ohne Beleg UND Markierung.
  // WP-SHIP8-CLOSE-8 (bens GELB-1): optionaler Beleg-Payload reist mit (Recovery-Kennzeichnung).
  auditPending?: {
    eventId: string;
    action: ReviewAction;
    actor: string;
    payload?: Record<string, unknown> | undefined;
  };
}

// WP-SHIP8-FIX (bens F3): kanonischer Provider-Anteil ALLER Import-Schlüssel (Queue-Idempotenz,
// Orchestrator-Dedupe, acceptToKo-Anker-Suche). Getrimmt + kleingeschrieben (Adapter schreiben
// "Confluence"/"Jira"). EHRLICHER Fallback: ein Item OHNE Provider zählt als "confluence" — der
// EINZIGE Adapter, der vor Einführung des Provider-Schlüssels externalId-Items erzeugte
// (deckungsgleich mit dem Pg-Backfill der Bestandszeilen in IMPORT_CANDIDATES_SCHEMA).
export function importProviderKey(provider: string | null | undefined): string {
  const p = provider?.trim().toLowerCase();
  return p && p.length > 0 ? p : "confluence";
}

// WP-NIGHT-FIX (bens F3-Rest): DER zentrale zusammengesetzte Quell-Schlüssel provider+externalId —
// EINE Normalisierung (importProviderKey: trim+lowercase, fehlend → confluence) für ALLE Abgleiche
// (Status-Maps/importStatusFor, Orchestrator-Dedupe, Queue-Idempotenz) statt verstreuter
// Eigenbau-Formate. Anker/Items ohne Provider zählen dabei bewusst als Confluence — deckungsgleich
// mit dem Pg-Backfill und acceptToKo (der einzige Adapter vor dem Provider-Schlüssel).
export function importSourceKey(provider: string | null | undefined, externalId: string): string {
  return `${importProviderKey(provider)}::${externalId}`;
}

// WP-NIGHT-FIX (bens F3-Rest): die WIRE-/Anzeige-Id eines Kandidaten (Gruppierungs-Kandidatenliste,
// Modell-Eingabe, Auswahl/Apply-Map, React-Keys). Für Confluence — und provider-losen Altbestand,
// deckungsgleich mit dem Backfill — bleibt es die NACKTE externalId (Bestandsverhalten, von den
// Confluence-Tests gepinnt; kein Client-Umbau nötig). Jeder ANDERE Provider prefixt seinen
// normalisierten Schlüssel: eine zufällig gleiche Jira-Id kollidiert nirgends mehr mit einer
// Confluence-pageId.
export function candidateSourceId(provider: string | null | undefined, externalId: string): string {
  const key = importProviderKey(provider);
  return key === "confluence" ? externalId : `${key}::${externalId}`;
}

// ================================================================================================
// JOB 3087 (Q2b) — DIE GLEICHHEIT ZWEIER OFFENER KANDIDATEN IST EIN FELDVERGLEICH, KEIN STRING.
// ================================================================================================
//
// WAS FALSCH WAR. Bis hierher bildete `openCandidateKey` den Idempotenz-Schlüssel der
// Review-Warteschlange als `${importProviderKey(provider)}@${externalId}@${sourceVersion}`. Diese
// Verkettung ist NICHT injektiv, denn das Trennzeichen darf in BEIDEN Feldern vorkommen:
// `ImportItem.provider` und `ImportItem.externalId` sind freie Zeichenketten (`types.ts:22`,
// `:36`), und `importProviderKey` trimmt und schreibt nur klein — es verbietet kein Zeichen.
//     (provider "test@tenant", externalId "42")        → "test@tenant@42@1"
//     (provider "test",        externalId "tenant@42") → "test@tenant@42@1"
// Zwei VERSCHIEDENE Quellobjekte bekamen denselben Schlüssel, und `insertIfAbsent` reihte den
// zweiten gar nicht erst ein: der Reviewer sah ihn nie, und niemand meldete einen Fehler (gemessen
// in JOB 3081 Runde 2 über die echte API — `expected [ { …(8) } ] to have a length of 2 but got 1`).
// Ein anderes Trennzeichen hätte nichts geheilt; JEDES Zeichen darf in beiden Feldern stehen.
//
// DIE ANTWORT: es gibt keinen Schlüsselstring mehr. Verglichen wird GENAU DAS SPALTEN-TUPEL, das
// der partielle UNIQUE-Index von Postgres führt (`repo-pg.ts:153-155`:
// `ON import_candidates (provider, external_id, source_version) WHERE external_id IS NOT NULL AND
// review_status IN ('neu','in_bearbeitung')`) — Feld für Feld, so wie es dort Spalte für Spalte
// geschieht. Ein Spalten-Tupel kennt keine Trennzeichen-Mehrdeutigkeit; darum war die Datenbank
// schon immer richtig und die Abweichung EINSEITIG: InMemory war STRENGER als Postgres und
// blockierte einen Kandidaten, den der Index korrekt eingereiht hätte. Es gibt hier folglich
// nichts zu migrieren — `IMPORT_CANDIDATES_SCHEMA` bleibt Zeichen für Zeichen, wie es ist.
//
// DAS VORBILD STEHT IM HAUS: JOB 3081 hat denselben Fehler eine Datei weiter am Herkunfts-Anker
// behoben und den Schlüsselstring dort ebenfalls abgeschafft (`service.ts:1620-1622`,
// `matchesAnchor`: „externalId UND importProviderKey(provider), kein zweites, weiteres Netz").

/**
 * Die drei Felder, die den OFFENEN Idempotenzraum aufspannen — deckungsgleich mit den drei
 * GENERATED-Spalten `provider`/`external_id`/`source_version` (`repo-pg.ts:78-120`).
 *
 * Bewusst modulintern: nach aussen wird die FRAGE beantwortet (`sameOpenCandidateSource`), nicht
 * ein Zwischenwert herausgegeben, aus dem sich ein zweiter Vergleichsweg bauen liesse.
 */
interface OpenCandidateSource {
  readonly providerKey: string;
  readonly externalId: string;
  readonly sourceVersion: number;
}

/**
 * Der offene Quellbezug eines Kandidaten — oder `null`, wenn er gar keinen belegt.
 *
 * SCRUM-510 (WP3) / WP-SHIP8-FIX (bens F3): Items OHNE externalId haben KEINEN Quellbezug (kein
 * Anker → keine externalId-Idempotenz) — dieselbe Bedingung wie `external_id IS NOT NULL` im
 * Index. Fehlende `sourceVersion` zählt als 1 (deckungsgleich mit dem Orchestrator und dem
 * CASE/ELSE-1 der Generated Column, `repo-pg.ts:114-120`). Ein fehlender Provider zählt als
 * "confluence" (`importProviderKey`, deckungsgleich mit dem Pg-Backfill).
 * WP-SHIP8-CLOSE-3 (bens ROT-2): OFFEN heisst 'neu' ODER 'in_bearbeitung' (`isOpenReviewStatus`) —
 * ein geclaimter Kandidat gibt seinen Platz NICHT frei, ein paralleler Importlauf kann während der
 * Review-Aktion keinen zweiten offenen Kandidaten derselben Quelle einreihen.
 */
function openCandidateSource(candidate: ImportCandidate): OpenCandidateSource | null {
  const ext = candidate.item.externalId;
  if (!ext || !isOpenReviewStatus(candidate.status)) {
    return null;
  }
  return {
    providerKey: importProviderKey(candidate.item.provider),
    externalId: ext,
    sourceVersion: candidate.item.sourceVersion ?? 1,
  };
}

/**
 * Belegen diese beiden Kandidaten DENSELBEN offenen Platz der Review-Warteschlange?
 *
 * Genau dann, wenn beide offen sind, beide einen Anker tragen und alle drei Felder EINZELN
 * übereinstimmen. Ein `true` ohne echten Feldtreffer wäre die verbotene Behauptung „ist schon da"
 * ohne Grundlage — und der Kandidat, der ihretwegen nie eingereiht wird, fehlt dem Reviewer stumm.
 */
export function sameOpenCandidateSource(a: ImportCandidate, b: ImportCandidate): boolean {
  const links = openCandidateSource(a);
  const rechts = openCandidateSource(b);
  return (
    links !== null &&
    rechts !== null &&
    links.providerKey === rechts.providerKey &&
    links.externalId === rechts.externalId &&
    links.sourceVersion === rechts.sourceVersion
  );
}

export class InMemoryCandidateRepo implements CandidateRepo {
  // Map bewahrt die Einfügereihenfolge (wie die bisherige Array-Queue).
  private readonly items = new Map<string, ImportCandidate>();

  insert(candidate: ImportCandidate): Promise<void> {
    this.items.set(candidate.id, candidate);
    return Promise.resolve();
  }

  // Spiegelt den partiellen UNIQUE-Index von Postgres (`repo-pg.ts:153-155`) FELDWEISE: belegt ein
  // bereits offener Kandidat denselben (provider, externalId, sourceVersion)-Platz, wird NICHT
  // eingefügt (false). Ohne Anker (keine externalId) oder ohne offenen Status gibt es keinen Platz
  // → immer einfügen (true), wie der plain insert.
  // JOB 3087 (Q2b): der frühere Vergleich lief über eine verklebte Zeichenkette und war damit
  // STRENGER als der Index — er blockierte Kandidaten, die Postgres korrekt eingereiht hätte
  // (s. den Kopfkommentar von `sameOpenCandidateSource`). Prüfen und Setzen geschehen weiterhin
  // ohne `await` dazwischen: dieselbe Unteilbarkeit wie der ON-CONFLICT-Insert.
  insertIfAbsent(candidate: ImportCandidate): Promise<boolean> {
    for (const existing of this.items.values()) {
      if (sameOpenCandidateSource(candidate, existing)) {
        return Promise.resolve(false);
      }
    }
    this.items.set(candidate.id, candidate);
    return Promise.resolve(true);
  }

  findById(id: string): Promise<ImportCandidate | undefined> {
    return Promise.resolve(this.items.get(id));
  }

  // WP-SHIP8-CLOSE-2 (bens F1): synchron auf der Map — Status-Prüfung und Set ohne await
  // dazwischen (dasselbe Atomaritäts-Muster wie removeByIds).
  // WP-SHIP8-CLOSE-3 (bens ROT-1): der Claim persistiert das Lease-Protokoll (opId/claimedAt) mit.
  // WP-SHIP8-CLOSE-7 (bens ROT-2): zusätzlich claimedBy/claimedAction — im selben synchronen Set.
  claim(
    id: string,
    opId: string,
    claimedAt: string,
    claimedBy?: string,
    claimedAction?: ReviewAction,
  ): Promise<ImportCandidate | undefined> {
    const candidate = this.items.get(id);
    if (!candidate || candidate.status !== "neu") {
      return Promise.resolve(undefined);
    }
    candidate.status = "in_bearbeitung";
    candidate.opId = opId;
    candidate.claimedAt = claimedAt;
    candidate.claimedBy = claimedBy;
    candidate.claimedAction = claimedAction;
    return Promise.resolve(candidate);
  }

  // WP-SHIP8-CLOSE-3 (bens ROT-1): CAS auf (status='in_bearbeitung', opId) — synchron, dann den
  // Patch anwenden und das Lease-Protokoll IMMER ausräumen.
  resolveClaim(
    id: string,
    opId: string,
    next: ClaimResolution,
  ): Promise<ImportCandidate | undefined> {
    const candidate = this.items.get(id);
    if (!candidate || candidate.status !== "in_bearbeitung" || candidate.opId !== opId) {
      return Promise.resolve(undefined);
    }
    candidate.status = next.status;
    if (next.koId !== undefined) {
      candidate.koId = next.koId;
    }
    if (next.note !== undefined) {
      candidate.note = next.note;
    }
    if (next.item !== undefined) {
      candidate.item = next.item;
    }
    // WP-SHIP8-CLOSE-6 (bens ROT-3a): Wer/Wann im selben Write (Spiegel des Pg-jsonb-Patches).
    if (next.reviewedBy !== undefined) {
      candidate.reviewedBy = next.reviewedBy;
    }
    if (next.reviewedAt !== undefined) {
      candidate.reviewedAt = next.reviewedAt;
    }
    // WP-SHIP8-CLOSE-7 (bens GELB + ROT-1): Aktion + vorbeugende Beleg-Markierung im selben Write.
    if (next.reviewedAction !== undefined) {
      candidate.reviewedAction = next.reviewedAction;
    }
    if (next.auditPending !== undefined) {
      candidate.auditPending = next.auditPending;
    }
    candidate.opId = undefined;
    candidate.claimedAt = undefined;
    candidate.claimedBy = undefined;
    candidate.claimedAction = undefined;
    return Promise.resolve(candidate);
  }

  // WP-SHIP8-CLOSE-7 (bens ROT-1): synchrones bedingtes Löschen — nur die EIGENE Markierung
  // (exakte eventId) wird entfernt; verschwundener Kandidat oder fremde Markierung → false.
  clearAuditPending(id: string, eventId: string): Promise<boolean> {
    const candidate = this.items.get(id);
    if (!candidate || candidate.auditPending?.eventId !== eventId) {
      return Promise.resolve(false);
    }
    candidate.auditPending = undefined;
    return Promise.resolve(true);
  }

  update(candidate: ImportCandidate): Promise<void> {
    // WP-SHIP8-CLOSE-2 (bens F1): ein verschwundener Kandidat wird NICHT still neu angelegt —
    // derselbe ehrliche Konflikt wie beim Pg-Adapter (0 Zeilen getroffen).
    if (!this.items.has(candidate.id)) {
      return Promise.reject(
        new LibraryError("CONFLICT", "Importkandidat existiert nicht mehr — nicht gespeichert."),
      );
    }
    this.items.set(candidate.id, candidate);
    return Promise.resolve();
  }

  all(): Promise<ImportCandidate[]> {
    return Promise.resolve([...this.items.values()]);
  }

  removeAll(): Promise<number> {
    const removed = this.items.size;
    this.items.clear();
    return Promise.resolve(removed);
  }

  // WP-SHIP8-CLOSE (bens F2): atomar je Item — Status-Prüfung und Löschung ohne await dazwischen
  // (synchron auf der Map); ein Eintrag mit inzwischen geändertem Status überlebt.
  // WP-SHIP8-CLOSE-8 (bens ROT-1): ein Kandidat mit auditPending ist der EINZIGE Träger des
  // ausstehenden Aktionsbelegs — die Löschsperre steckt IN der Löschbedingung selbst (Spiegel
  // der Pg-DELETE-Bedingung), nie in einem Vorab-Read.
  removeByIds(entries: readonly ImportCandidateRemoval[]): Promise<string[]> {
    const removed: string[] = [];
    for (const { id, status } of entries) {
      const candidate = this.items.get(id);
      if (
        candidate &&
        candidate.status === status &&
        candidate.auditPending === undefined &&
        this.items.delete(id)
      ) {
        removed.push(id);
      }
    }
    return Promise.resolve(removed);
  }
}

// ================================================================================================
// W2-A (KW-W2-17 Zeilen 35-39) — DIE REVISIONSIDENTITAET UND IHR REPO-VERTRAG
// ================================================================================================

/**
 * Die kanonische Normalisierung des Quellsystems fuer BEIDE Identitaeten: getrimmt und
 * kleingeschrieben, damit „Confluence", „confluence" und „ Confluence " dieselbe Quelle sind.
 *
 * BEWUSST OHNE den `confluence`-Rueckfall von `importProviderKey`. Dort ist er richtig: er heilt
 * echten Altbestand, der vor Einfuehrung des Provider-Schluessels entstand. Hier gibt es keinen
 * Altbestand — `sourceSystem` ist ein Pflichtfeld eines neuen Typs, und ein leerer Wert waere
 * kein Altfall, sondern ein Fehler. Ihn stillschweigend zu Confluence zu machen hiesse, eine
 * Tatsache zu erfinden; deshalb weist der Insert ihn zurueck (s. `pruefeRevisionsidentitaet`).
 */
export function externalSourceSystemKey(sourceSystem: string): string {
  return sourceSystem.trim().toLowerCase();
}

/** Die FACHLICHE Quellenidentitaet: sourceSystem + externalId — „welche Seite". */
export function externalSourceIdentityKey(sourceSystem: string, externalId: string): string {
  return `${externalSourceSystemKey(sourceSystem)}::${externalId}`;
}

/** Die REVISIONSIDENTITAET: sourceSystem + externalId + sourceVersion — „welcher Stand". */
export function externalSourceRevisionKey(
  sourceSystem: string,
  externalId: string,
  sourceVersion: number,
): string {
  return `${externalSourceIdentityKey(sourceSystem, externalId)}@${sourceVersion}`;
}

/**
 * Die Obergrenze der Quellversion. Sie ist KEINE Willkuer, sondern die Lehre aus der
 * `source_version`-Migration weiter oben in diesem Modul: eine Ziffernfolge ohne Laengengrenze
 * passiert jeden Regex-Guard und laeuft danach am `::int` ueber. Neun Stellen liegen sicher unter
 * `2^31-1`; die Pruefung sitzt hier an der Grenze, nicht erst in der Datenbank.
 */
export const MAX_SOURCE_VERSION = 999_999_999;

/**
 * Fail-closed am Repo-Rand: eine Revision ohne vollstaendige, wohlgeformte Identitaet wird NICHT
 * gespeichert. Der Grund ist die Eindeutigkeit selbst — ein leeres Quellsystem oder eine
 * gebrochene Version machen den Unique-Vertrag loechrig, und zwar still.
 */
export function pruefeRevisionsidentitaet(record: ExternalSourceRecord): void {
  if (externalSourceSystemKey(record.sourceSystem).length === 0) {
    throw new LibraryError("BAD_REQUEST", "Quellrevision ohne Quellsystem.");
  }
  if (record.externalId.trim().length === 0) {
    throw new LibraryError("BAD_REQUEST", "Quellrevision ohne externalId.");
  }
  if (
    !Number.isInteger(record.sourceVersion) ||
    record.sourceVersion < 0 ||
    record.sourceVersion > MAX_SOURCE_VERSION
  ) {
    throw new LibraryError(
      "BAD_REQUEST",
      `Quellrevision mit ungueltiger sourceVersion (erlaubt: ganzzahlig 0..${MAX_SOURCE_VERSION}).`,
    );
  }
  if (record.sourceRecordId.trim().length === 0) {
    throw new LibraryError("BAD_REQUEST", "Quellrevision ohne sourceRecordId.");
  }
}

/**
 * DER SCHNAPPSCHUSS — die Unveraenderlichkeit als Laufzeitzusage statt als `readonly`.
 *
 * BENs Nachpruefung 33 (Befund A) hat den wunden Punkt getroffen: `readonly` im Interface ist eine
 * Uebersetzungshilfe, keine Zusage zur Laufzeit, und `sourceMetadata` war ohnehin nur FLACH
 * readonly. Wer dieselbe Objektreferenz ablegt und wieder herausgibt, hat nichts unveraenderlich
 * gemacht — er hat nur aufgeschrieben, dass man es nicht tun soll.
 *
 * WARUM DIE JSON-RUNDREISE UND NICHT `structuredClone`. Der Massstab ist nicht „irgendeine tiefe
 * Kopie", sondern PostgreSQL: dort geht der Datensatz durch `JSON.stringify` in eine
 * `jsonb`-Spalte und kommt als frisch geparstes Objekt zurueck. Genau diese Rundreise wird hier
 * nachgebildet — mit allen Folgen, die `jsonb` auch hat (ein `undefined` im `sourceMetadata`
 * verschwindet in beiden Ablagen, ein Wert, der sich nicht serialisieren laesst, scheitert in
 * beiden). `structuredClone` waere tiefer als die Datenbank und haette damit eine ZWEITE Semantik
 * eingefuehrt — also genau das, was die Paritaet zerstoert.
 */
function externalSourceSnapshot(record: ExternalSourceRecord): ExternalSourceRecord {
  return JSON.parse(JSON.stringify(record)) as ExternalSourceRecord;
}

/**
 * Persistenz-Schnittstelle der Quellrevisionen (KW-W2-17 Zeilen 18-41).
 *
 * ES GIBT KEIN `update` UND KEIN `delete`. Das ist die Unveraenderlichkeit, ausgedrueckt im
 * Vertrag statt in einem Kommentar: was der Aufrufer nicht aufrufen kann, kann er auch nicht
 * versehentlich tun. Eine neue Quellversion ist eine neue Zeile — nie ein Ueberschreiben.
 */
export interface ExternalSourceRepo {
  /**
   * IDEMPOTENTER Insert ueber die Revisionsidentitaet. `true` = diese Revision war neu und wurde
   * angelegt; `false` = sie existierte bereits und die VORHANDENE Zeile bleibt unangetastet.
   *
   * Auf PostgreSQL ein `ON CONFLICT DO NOTHING` gegen einen echten Unique-Index — damit legen
   * selbst NEBENLAEUFIGE Laeufe keine zweite Zeile an. Der InMemory-Zweig spiegelt dieselbe Zusage.
   */
  /**
   * WIRFT `LibraryError("CONFLICT")`, wenn die interne `sourceRecordId` bereits an eine ANDERE
   * Revision vergeben ist. Das ist kein neuer Vertrag, sondern der bereits vorhandene
   * PostgreSQL-Primaerschluessel, endlich in beiden Ablagen gleich benannt (BEN-33 Befund B).
   */
  insertIfAbsent(record: ExternalSourceRecord): Promise<boolean>;
  /** Die konkrete Revision — oder undefined. */
  findByRevision(
    sourceSystem: string,
    externalId: string,
    sourceVersion: number,
  ): Promise<ExternalSourceRecord | undefined>;
  /** Nachschlag ueber die interne Klarwerk-Id. */
  findById(sourceRecordId: string): Promise<ExternalSourceRecord | undefined>;
  /** Alle Revisionen EINER Quelle, aufsteigend nach `sourceVersion`. */
  listBySource(sourceSystem: string, externalId: string): Promise<ExternalSourceRecord[]>;
  /** Die hoechste bekannte Version dieser Quelle — oder undefined, wenn es keine gibt. */
  latestVersion(sourceSystem: string, externalId: string): Promise<number | undefined>;
}

export class InMemoryExternalSourceRepo implements ExternalSourceRepo {
  /** Schluessel ist die REVISIONSIDENTITAET — nicht die sourceRecordId. */
  private readonly nachRevision = new Map<string, ExternalSourceRecord>();
  /**
   * Der zweite Index: interne Id → Revisionsschluessel. Er hat zwei Aufgaben, und beide kommen aus
   * BEN-33 Befund B. Erstens macht er die interne Id EINDEUTIG, so wie es der
   * PostgreSQL-Primaerschluessel tut. Zweitens macht er `findById` deterministisch: die fruehere
   * Schleife ueber alle Werte lieferte bei doppelt vergebener Id das, was in der Map zufaellig
   * zuerst lag — eine Antwort, die von der Einfuegereihenfolge abhing.
   */
  private readonly revisionNachId = new Map<string, string>();

  /**
   * BEWUSST `async`, obwohl nichts erwartet wird — und das ist keine Formalie.
   *
   * `pruefeRevisionsidentitaet` WIRFT. Ohne `async` fluege der Fehler SYNCHRON aus dem Aufruf
   * heraus, waehrend derselbe Fehler im Pg-Adapter (dort ist die Methode `async`) als abgelehntes
   * Promise ankaeme. Derselbe Vertrag verhielte sich je Ablage verschieden — genau die Parität,
   * die Akzeptanzkriterium 6 verlangt, waere am Fehlerweg gebrochen. Der Unit-Test hat das
   * aufgedeckt; `async` stellt beide Ablagen gleich.
   */
  async insertIfAbsent(record: ExternalSourceRecord): Promise<boolean> {
    pruefeRevisionsidentitaet(record);
    const key = externalSourceRevisionKey(
      record.sourceSystem,
      record.externalId,
      record.sourceVersion,
    );
    // Pruefen und Setzen ohne `await` dazwischen — dieselbe Unteilbarkeit wie im
    // ON-CONFLICT-Insert von PostgreSQL (Muster: InMemoryCandidateRepo.insertIfAbsent).
    //
    // DIE REIHENFOLGE DER BEIDEN PRUEFUNGEN IST DIE PARITAET, nicht Geschmack. PostgreSQL prueft
    // beim `ON CONFLICT (source_system, external_id, source_version_key) DO NOTHING` ZUERST den
    // Arbiter-Index: trifft der Datensatz dieselbe Revision, ist das Ergebnis ein stiller No-op —
    // auch dann, wenn die interne Id gleich ist. Erst wenn die Revision NEU ist und die interne Id
    // schon vergeben, schlaegt der Primaerschluessel zu. Genau so urteilt es hier. Waere es
    // umgekehrt, wuerde ein harmloser Wiederholungslauf derselben Quellversion ploetzlich werfen.
    if (this.nachRevision.has(key)) {
      return false;
    }
    if (this.revisionNachId.has(record.sourceRecordId)) {
      throw new LibraryError(
        "CONFLICT",
        `Die interne Quellrevisions-Id ${record.sourceRecordId} ist bereits an eine andere Revision vergeben.`,
      );
    }
    // Erst ab hier wird geschrieben: eine abgewiesene Revision hinterlaesst KEINE halbe Spur.
    this.nachRevision.set(key, externalSourceSnapshot(record));
    this.revisionNachId.set(record.sourceRecordId, key);
    return true;
  }

  findByRevision(
    sourceSystem: string,
    externalId: string,
    sourceVersion: number,
  ): Promise<ExternalSourceRecord | undefined> {
    return Promise.resolve(
      this.schnappschuss(externalSourceRevisionKey(sourceSystem, externalId, sourceVersion)),
    );
  }

  findById(sourceRecordId: string): Promise<ExternalSourceRecord | undefined> {
    const key = this.revisionNachId.get(sourceRecordId);
    return Promise.resolve(key === undefined ? undefined : this.schnappschuss(key));
  }

  listBySource(sourceSystem: string, externalId: string): Promise<ExternalSourceRecord[]> {
    const identity = externalSourceIdentityKey(sourceSystem, externalId);
    return Promise.resolve(
      [...this.nachRevision.values()]
        .filter((r) => externalSourceIdentityKey(r.sourceSystem, r.externalId) === identity)
        .sort((a, b) => a.sourceVersion - b.sourceVersion)
        .map(externalSourceSnapshot),
    );
  }

  /**
   * JEDER Leseweg gibt eine frische Kopie heraus — nie den Bestand selbst. Sonst waere die
   * Unveraenderlichkeit nur halb: der Schreibweg geschuetzt, der Leseweg offen (BEN-33, Probe 2).
   */
  private schnappschuss(key: string): ExternalSourceRecord | undefined {
    const treffer = this.nachRevision.get(key);
    return treffer === undefined ? undefined : externalSourceSnapshot(treffer);
  }

  async latestVersion(sourceSystem: string, externalId: string): Promise<number | undefined> {
    const alle = await this.listBySource(sourceSystem, externalId);
    return alle.length > 0 ? alle[alle.length - 1]?.sourceVersion : undefined;
  }
}

// ================================================================================================
// AUFTRAG-144 (KW-S4-26 §92-114, KW-S4-28 F1) — DIE LAUFABLAGE
// ================================================================================================
//
// ZWEI OPERATIONEN, DIE NICHT VERWECHSELT WERDEN DUERFEN, und der ganze Vertrag haengt daran:
//   · `insertIfAbsent` LEGT AN und ueberschreibt nie. Ein zweiter Anlauf desselben Laufs ist ein
//     stiller No-op mit `false` — auch wenn der uebergebene Lauf anders aussieht.
//   · `advance` SCHREIBT FORT und legt nie an. Ein unbekannter Lauf ist ein `CONFLICT`, kein
//     stilles Anlegen.
// Waeren beide dasselbe (der Mutant „upsert statt insertIfAbsent"), koennte ein Wiederholungslauf
// einen bereits abgeschlossenen Lauf auf QUEUED zuruecksetzen — und niemand saehe es.

/** Ein Feldflicken der Fortschreibung. Nur was hier steht, wird ueberschrieben. */
export interface ImportRunFortschritt {
  readonly status: ImportRunStatus;
  readonly sourceRecordId?: string | null;
  readonly completedAt?: string | null;
  readonly failureCode?: string | null;
  readonly failureReason?: string | null;
  readonly counters?: ImportRunCounters;
}

// ================================================================================================
// JOB-924 — DER LETZTE ERFOLG. EINE REGEL, ZWEI ABLAGEN.
// ================================================================================================
//
// WARUM DIE AUSWAHL HIER STEHT UND NICHT ZWEIMAL: Sie soll in beiden Ablagen WORTGLEICH gelten.
// Haette PostgreSQL sie als SQL und der Speicher als Schleife, gaebe es zwei Fassungen derselben
// Regel — und die zweite wuerde beim naechsten Umbau still abweichen. Genau diese Paritaet verlangt
// BEN7s Pruefluecke 1. Der Adapter liefert deshalb nur ROHZEILEN; entschieden wird hier.
//
// WARUM SIE NICHT ALS `ORDER BY … DESC LIMIT 1` IN SQL GEHOERT: Das sortierte TEXTUELL.
// `2026-08-10T11:00:00+02:00` ist textuell groesser als `2026-08-10T09:00:00.000Z` und bezeichnet
// denselben Augenblick; `2026-9-…` waere textuell groesser als `2026-10-…`. Der Vergleich muss auf
// dem AUGENBLICK stattfinden, nicht auf der Schreibweise.

/**
 * Der Rohbefund eines Laufs, so schmal wie die Auswahl ihn braucht.
 *
 * Alle drei Felder sind bewusst `unknown`: Der PostgreSQL-Adapter liest sie als Text aus einer
 * JSONB-Spalte, und was dort steht, hat niemand typgeprueft. Ein `string` an dieser Stelle waere
 * eine Zusicherung, die die Ablage nicht geben kann.
 */
export interface ImportErfolgsbefund {
  readonly sourceSystem: unknown;
  readonly status: unknown;
  readonly completedAt: unknown;
}

/** Nur dieser eine Status ist voller Erfolg (`KW-S4-26` §89-90). */
const VOLLER_ERFOLG: ImportRunStatus = "COMPLETED";

/**
 * Der juengste GUELTIGE Abschlusszeitpunkt eines erfolgreichen Laufs dieses Quellsystems —
 * oder `null`, wenn es keinen gibt. Vier Huerden, jede fail-closed:
 *
 *  1. fremdes Quellsystem  → zaehlt nicht (ein Sharepoint-Erfolg belegt keinen Confluence-Kontakt);
 *  2. unbekannter Status   → zaehlt nicht (ein zehnter, erfundener Zustand ist kein Erfolg);
 *  3. `PARTIAL`/`FAILED`   → zaehlt nicht (ein halber Lauf ist kein Kontaktbeleg);
 *  4. unbrauchbarer Text   → zaehlt nicht (`istImportZeitpunkt`).
 *
 * Zurueck kommt die GESPEICHERTE Zeichenkette, nicht eine umformatierte: Der Server reicht durch,
 * was dasteht; formatiert wird erst in der Flaeche, in der Zeitzone des Betrachters.
 *
 * GLEICHSTAND: Zwei Schreibweisen desselben Augenblicks (`…T09:00:00.000Z` und `…T11:00:00+02:00`)
 * sind gleich gross. Ohne feste Entscheidung haenge das Ergebnis an der Zeilenreihenfolge — und die
 * ist in einer Map eine andere als in einem `SELECT` ohne `ORDER BY`. Es gewinnt deshalb die
 * lexikografisch kleinere Zeichenkette: dieselbe Antwort in beiden Ablagen, unabhaengig von der
 * Reihenfolge.
 */
export function waehleLetztenErfolg(
  sourceSystem: string,
  befunde: readonly ImportErfolgsbefund[],
): string | null {
  let beste: string | null = null;
  let besterAugenblick = Number.NEGATIVE_INFINITY;
  for (const befund of befunde) {
    if (befund.sourceSystem !== sourceSystem) {
      continue;
    }
    if (!istImportRunStatus(befund.status)) {
      continue;
    }
    if (befund.status !== VOLLER_ERFOLG) {
      continue;
    }
    if (!istImportZeitpunkt(befund.completedAt)) {
      continue;
    }
    const augenblick = Date.parse(befund.completedAt);
    if (augenblick > besterAugenblick) {
      besterAugenblick = augenblick;
      beste = befund.completedAt;
    } else if (augenblick === besterAugenblick && beste !== null && befund.completedAt < beste) {
      beste = befund.completedAt;
    }
  }
  return beste;
}

export interface ImportRunRepo {
  /**
   * IDEMPOTENT ueber die `importId`. `true` = neu angelegt; `false` = existierte bereits und die
   * VORHANDENE Zeile bleibt unangetastet. Auf PostgreSQL ein `ON CONFLICT DO NOTHING` gegen den
   * echten Primaerschluessel — nebenlaeufige Laeufe legen keinen zweiten an.
   */
  insertIfAbsent(run: ImportRun): Promise<boolean>;
  /**
   * JOB-924: Der juengste gueltige `COMPLETED.completedAt` dieses Quellsystems — oder `null`.
   * BEIDE Ablagen entscheiden das ueber `waehleLetztenErfolg`; der Vertrag ist wortgleich.
   */
  findLastSuccessAt(sourceSystem: string): Promise<string | null>;
  /** Der Lauf — oder `undefined`. NIE ein erfundener Leer-Lauf (KW-S4-26 §142-143). */
  findById(importId: string): Promise<ImportRun | undefined>;
  /** Schreibt den Lauf fort. WIRFT `CONFLICT`, wenn es ihn nicht gibt. */
  advance(importId: string, fortschritt: ImportRunFortschritt): Promise<ImportRun>;
  /** Legt fehlende Elementreferenzen an; vorhandene `(importId, ordinal)` bleiben unberuehrt. */
  appendItemRefs(refs: readonly ImportRunItemRef[]): Promise<number>;
  /** Die Elementreferenzen EINES Laufs, stabil nach `ordinal` aufsteigend. */
  listItemRefs(importId: string): Promise<ImportRunItemRef[]>;
}

/**
 * Baut den Lauf FELD FUER FELD neu.
 *
 * Das ist kein Kopierstil, sondern die strukturelle Zusicherung aus `KW-S4-26` §108-110: was nicht
 * zum kanonischen Vertrag gehoert, ueberlebt diese Grenze nicht. Ein Aufrufer, der versehentlich
 * KO-Inhalt an den Lauf haengt, bekommt ihn hier abgeschnitten — statt ihn zu persistieren.
 */
function importRunSnapshot(run: ImportRun): ImportRun {
  return {
    importId: run.importId,
    sourceSystem: run.sourceSystem,
    externalId: run.externalId,
    sourceScope: run.sourceScope,
    requestedSourceVersion: run.requestedSourceVersion,
    status: run.status,
    sourceRecordId: run.sourceRecordId,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failureCode: run.failureCode,
    failureReason: run.failureReason,
    counters: {
      itemsTotal: run.counters.itemsTotal,
      itemsCreated: run.counters.itemsCreated,
      itemsBound: run.counters.itemsBound,
      itemsSkipped: run.counters.itemsSkipped,
      itemsFailed: run.counters.itemsFailed,
    },
  };
}

/** Dieselbe Grenze fuer das Kind — sieben Felder, kein achtes. */
function importRunItemRefSnapshot(ref: ImportRunItemRef): ImportRunItemRef {
  return {
    importId: ref.importId,
    ordinal: ref.ordinal,
    sourceRecordId: ref.sourceRecordId,
    candidateItemId: ref.candidateItemId,
    knowledgeObjectId: ref.knowledgeObjectId,
    itemOutcome: ref.itemOutcome,
    itemFailureCode: ref.itemFailureCode,
  };
}

/**
 * Fail-closed VOR dem Schreiben — in beiden Ablagen dieselbe Pruefung, damit derselbe Aufruf nicht
 * je nach Ablage verschieden ausgeht (dieselbe Paritaetslehre wie bei `pruefeRevisionsidentitaet`).
 */
export function pruefeImportRun(run: ImportRun): void {
  if (run.importId.trim() === "") {
    throw new LibraryError("BAD_REQUEST", "Ein Importlauf ohne importId ist kein Lauf.");
  }
  if (!istImportRunStatus(run.status)) {
    throw new LibraryError(
      "BAD_REQUEST",
      `Unbekannter Laufstatus ${JSON.stringify(run.status)} — die kanonische Menge hat genau neun Werte.`,
    );
  }
  if (run.sourceSystem.trim() === "") {
    throw new LibraryError("BAD_REQUEST", "Ein Importlauf ohne sourceSystem ist kein Lauf.");
  }
  // EIN LAUF OHNE SCOPE WAERE EIN AUFTRAG OHNE GEGENSTAND. `KW-S4-26` §63 laesst ausdruecklich
  // beides zu — das konkrete Objekt ODER den expliziten Container —, aber nicht keines von beiden.
  if (
    (run.externalId === null || run.externalId.trim() === "") &&
    (run.sourceScope === null || run.sourceScope.trim() === "")
  ) {
    throw new LibraryError(
      "BAD_REQUEST",
      "Ein Importlauf braucht ein Quellobjekt (externalId) ODER einen expliziten Scope (sourceScope).",
    );
  }
  if (run.startedAt.trim() === "") {
    throw new LibraryError("BAD_REQUEST", "Ein Importlauf ohne startedAt ist kein Lauf.");
  }
  const zaehler = run.counters;
  for (const [name, wert] of Object.entries(zaehler)) {
    if (!Number.isInteger(wert) || wert < 0) {
      throw new LibraryError(
        "BAD_REQUEST",
        `Der Zaehler ${name} muss eine nicht-negative ganze Zahl sein — ein ehrlicher Zaehler erfindet nichts.`,
      );
    }
  }
}

export function pruefeImportRunItemRef(ref: ImportRunItemRef): void {
  if (ref.importId.trim() === "") {
    throw new LibraryError(
      "BAD_REQUEST",
      "Eine Elementreferenz ohne importId gehoert zu keinem Lauf.",
    );
  }
  if (!Number.isInteger(ref.ordinal) || ref.ordinal < 0) {
    throw new LibraryError(
      "BAD_REQUEST",
      "ordinal muss eine nicht-negative ganze Zahl sein — sie ist die Ordnung, nicht die Einfuegezeit.",
    );
  }
  if (ref.candidateItemId.trim() === "") {
    throw new LibraryError(
      "BAD_REQUEST",
      "Eine Elementreferenz ohne candidateItemId referenziert nichts.",
    );
  }
  if (!istImportItemOutcome(ref.itemOutcome)) {
    throw new LibraryError(
      "BAD_REQUEST",
      `Unbekanntes itemOutcome ${JSON.stringify(ref.itemOutcome)} — unbekannt ist fail-closed.`,
    );
  }
}

export class InMemoryImportRunRepo implements ImportRunRepo {
  private readonly laeufe = new Map<string, ImportRun>();
  /** Je Lauf: ordinal → Referenz. Die Map macht `(importId, ordinal)` eindeutig wie der Primaerschluessel. */
  private readonly referenzen = new Map<string, Map<number, ImportRunItemRef>>();

  async insertIfAbsent(run: ImportRun): Promise<boolean> {
    pruefeImportRun(run);
    // Pruefen und Setzen ohne `await` dazwischen — dieselbe Unteilbarkeit wie im
    // ON-CONFLICT-Insert von PostgreSQL (Muster: InMemoryExternalSourceRepo.insertIfAbsent).
    if (this.laeufe.has(run.importId)) {
      return false;
    }
    this.laeufe.set(run.importId, importRunSnapshot(run));
    return true;
  }

  async findById(importId: string): Promise<ImportRun | undefined> {
    const treffer = this.laeufe.get(importId);
    return treffer === undefined ? undefined : importRunSnapshot(treffer);
  }

  /** JOB-924: dieselbe geteilte Regel wie im Adapter — hier ueber die vollstaendigen Laeufe. */
  async findLastSuccessAt(sourceSystem: string): Promise<string | null> {
    return waehleLetztenErfolg(sourceSystem, [...this.laeufe.values()]);
  }

  async advance(importId: string, fortschritt: ImportRunFortschritt): Promise<ImportRun> {
    if (!istImportRunStatus(fortschritt.status)) {
      throw new LibraryError(
        "BAD_REQUEST",
        `Unbekannter Laufstatus ${JSON.stringify(fortschritt.status)} — die kanonische Menge hat genau neun Werte.`,
      );
    }
    const vorher = this.laeufe.get(importId);
    if (vorher === undefined) {
      // KEIN stilles Anlegen. Ein Fortschritt auf einem Lauf, den es nicht gibt, ist ein Befund.
      throw new LibraryError(
        "CONFLICT",
        `Der Importlauf ${importId} existiert nicht — eine Fortschreibung legt keinen Lauf an.`,
      );
    }
    // `startedAt` und die Identitaetsfelder reisen unveraendert mit: die Fortschreibung erfindet
    // keine neue Vergangenheit.
    const nachher: ImportRun = {
      ...vorher,
      status: fortschritt.status,
      ...(fortschritt.sourceRecordId !== undefined
        ? { sourceRecordId: fortschritt.sourceRecordId }
        : {}),
      ...(fortschritt.completedAt !== undefined ? { completedAt: fortschritt.completedAt } : {}),
      ...(fortschritt.failureCode !== undefined ? { failureCode: fortschritt.failureCode } : {}),
      ...(fortschritt.failureReason !== undefined
        ? { failureReason: fortschritt.failureReason }
        : {}),
      ...(fortschritt.counters !== undefined ? { counters: fortschritt.counters } : {}),
    };
    pruefeImportRun(nachher);
    this.laeufe.set(importId, importRunSnapshot(nachher));
    return importRunSnapshot(nachher);
  }

  async appendItemRefs(refs: readonly ImportRunItemRef[]): Promise<number> {
    let neu = 0;
    for (const ref of refs) {
      pruefeImportRunItemRef(ref);
      const proLauf = this.referenzen.get(ref.importId) ?? new Map<number, ImportRunItemRef>();
      this.referenzen.set(ref.importId, proLauf);
      // VORHANDENES BLEIBT. Dieselbe Zusage wie `ON CONFLICT (import_id, ordinal) DO NOTHING`.
      if (proLauf.has(ref.ordinal)) {
        continue;
      }
      proLauf.set(ref.ordinal, importRunItemRefSnapshot(ref));
      neu += 1;
    }
    return neu;
  }

  async listItemRefs(importId: string): Promise<ImportRunItemRef[]> {
    const proLauf = this.referenzen.get(importId);
    if (proLauf === undefined) {
      return [];
    }
    // NACH ORDINAL, nicht nach Einfuegereihenfolge — spiegelt das `ORDER BY ordinal` des Adapters.
    return [...proLauf.values()]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((ref) => importRunItemRefSnapshot(ref));
  }
}
