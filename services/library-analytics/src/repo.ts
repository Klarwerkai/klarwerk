import {
  type ImportCandidate,
  type ImportItem,
  LibraryError,
  type ReviewAction,
  type ReviewStatus,
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
  auditPending?: { eventId: string; action: ReviewAction; actor: string };
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

// SCRUM-510 (WP3): der Idempotenz-Schlüssel eines OFFENEN externalId-Kandidaten.
// WP-SHIP8-FIX (bens F3): DURCHGÄNGIG provider+externalId — (provider, externalId, sourceVersion).
// Vorher kollidierte eine Jira-externalId mit einer zufällig gleichen Confluence-pageId (ein
// offener Confluence-Kandidat blockierte den Jira-Kandidaten als vermeintliche Dublette).
// Fehlende sourceVersion zählt als 1 (deckungsgleich mit dem Orchestrator und dem pg-Generated-Column-COALESCE).
// Items ohne externalId haben KEINEN Schlüssel (kein Anker → keine externalId-Idempotenz).
// WP-SHIP8-CLOSE-3 (bens ROT-2): OFFEN heißt 'neu' ODER 'in_bearbeitung' (isOpenReviewStatus) —
// ein geclaimter Kandidat gibt seinen Schlüssel NICHT frei, ein paralleler Importlauf kann
// während der Review-Aktion keinen zweiten offenen Kandidaten derselben Quelle einreihen.
export function openCandidateKey(candidate: ImportCandidate): string | null {
  const ext = candidate.item.externalId;
  if (!ext || !isOpenReviewStatus(candidate.status)) {
    return null;
  }
  return `${importProviderKey(candidate.item.provider)}@${ext}@${candidate.item.sourceVersion ?? 1}`;
}

export class InMemoryCandidateRepo implements CandidateRepo {
  // Map bewahrt die Einfügereihenfolge (wie die bisherige Array-Queue).
  private readonly items = new Map<string, ImportCandidate>();

  insert(candidate: ImportCandidate): Promise<void> {
    this.items.set(candidate.id, candidate);
    return Promise.resolve();
  }

  // Spiegelt den partiellen UNIQUE-Index von Postgres: kollidiert der offene (externalId@version)-Schlüssel
  // mit einem bereits offenen Kandidaten, wird NICHT eingefügt (false). Ohne Schlüssel (kein externalId) →
  // immer einfügen (true), wie der plain insert.
  insertIfAbsent(candidate: ImportCandidate): Promise<boolean> {
    const key = openCandidateKey(candidate);
    if (key) {
      for (const existing of this.items.values()) {
        if (openCandidateKey(existing) === key) {
          return Promise.resolve(false);
        }
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
  removeByIds(entries: readonly ImportCandidateRemoval[]): Promise<string[]> {
    const removed: string[] = [];
    for (const { id, status } of entries) {
      const candidate = this.items.get(id);
      if (candidate && candidate.status === status && this.items.delete(id)) {
        removed.push(id);
      }
    }
    return Promise.resolve(removed);
  }
}
