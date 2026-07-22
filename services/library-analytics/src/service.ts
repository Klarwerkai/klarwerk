import { createHash, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import {
  type Confidentiality,
  type KnowledgeObject,
  KoError,
  type KoFilter,
  type KoService,
  type KoSource,
  confidentialityRank,
  isConfidential,
  isValidConfidentiality,
  normalizeConfidentiality,
  // SCRUM-527 (WP2): importierte/re-synchronisierte Quell-URLs durch dieselbe Allowlist.
  safeSourceUrl,
} from "../../knowledge-object";
import {
  type CandidateRepo,
  type ClaimResolution,
  InMemoryCandidateRepo,
  importProviderKey,
} from "./repo";
import {
  type Analytics,
  type BusFactorEntry,
  type ExpertiseEntry,
  type Graph,
  type GraphEdge,
  type ImportCandidate,
  type ImportItem,
  type ImportResult,
  LibraryError,
  type ReviewAction,
} from "./types";

// WP-BILD-1h (bens sammel15-ROT 2): harter Backfill-Deckel PRO SUCHANFRAGE. Eine nicht-matchende
// Query darf nicht den nahezu gesamten Legacy-Bestand voll laden — höchstens so viele Legacy-KOs
// werden je Suche geladen/gescannt/backgefüllt; der Rest folgt in späteren Suchen (konvergiert,
// weil jedes backgefüllte KO danach dauerhaft sein Feld trägt).
export const SEARCH_BACKFILL_LIMIT_PER_QUERY = 20;

// WP-D-CLEAN (Pedis Testdaten-Aufräumen): Provider, deren Import-Provenienz zum Aufräum-Umfang
// gehört (kleingeschrieben verglichen — Adapter schreiben "Confluence"/"Jira").
export const IMPORT_CLEANUP_PROVIDERS = ["confluence", "jira"] as const;

// WP-SHIP8-CLOSE-3 (bens ROT-1): Lease-Dauer eines Review-Claims. Eine Review-Aktion arbeitet
// Sekunden (KO-Service-Aufrufe, kein Modell) — 10 Minuten sind weit jenseits jedes echten Laufs;
// erst danach greift die Crash-Recovery (dieselbe Frist-Philosophie wie AI_CHECK_STALE_PENDING_MS).
export const REVIEW_CLAIM_LEASE_MS = 10 * 60_000;

// Lease abgelaufen? Ein unlesbares/fehlendes claimedAt zählt defensiv als abgelaufen (Muster
// shouldReEnqueueAiCheck: lieber einmal zu viel recovern als still liegen lassen — die Recovery
// selbst ist per opId-CAS gegen laufende Operationen abgesichert).
export function reviewClaimLeaseExpired(claimedAt: string | undefined, nowMs: number): boolean {
  if (!claimedAt) {
    return true;
  }
  const started = Date.parse(claimedAt);
  return !Number.isFinite(started) || nowMs - started > REVIEW_CLAIM_LEASE_MS;
}

// WP-SHIP8-FIX (bens F2): STATELESS Bindung der bestätigten Aufräum-Zielmenge. SHA-256 über die
// SORTIERTEN Kandidaten-Ids + KO-Ids (getrennt, damit ein Id-Wechsel zwischen den Mengen nie
// kollidiert). Die Vorschau liefert den Digest, confirm schickt ihn zurück, der Server berechnet
// neu und vergleicht — kein Prozess-Zustand, robust über Replikas/Neustarts.
export function cleanupDigest(candidateIds: readonly string[], koIds: readonly string[]): string {
  const hash = createHash("sha256");
  hash.update([...candidateIds].sort().join("\n"));
  hash.update("\n--\n");
  hash.update([...koIds].sort().join("\n"));
  return hash.digest("hex");
}

export interface LibraryServiceDeps {
  koService: KoService;
  audit?: AuditService;
  // SCRUM-157: persistente Import-Queue. Optional; ohne Angabe In-Memory (Dev/Test).
  candidates?: CandidateRepo;
  genId?: () => string;
  now?: () => number;
  // SCRUM-510 R2b (quellneutrales Enablement): schaltet den externalId-Upsert-/Re-Sync-Strang. Aus
  // (Default) = exakt heutiges Bestandsverhalten (title|statement-Dedup, kein Anker). An = externalId-
  // Dedup + externalId-Upsert — QUELLNEUTRAL (kein Confluence-Begriff). build-app leitet den Wert aus dem
  // generischen Import-Enable ab (aktuell durch KLARWERK_CONFLUENCE_IMPORT gesetzt; ein Adapter #2/Jira
  // schaltet denselben Strang über sein eigenes Flag, ohne Confluence-Symbole).
  externalUpsert?: boolean;
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

// SCRUM-515: Runtime-Validierung der Vertraulichkeit an der Import-Ingest-Grenze. Fremd-Payload (HTTP-
// Body ODER Quell-Adapter) ist untrusted: ein GESETZTER, aber ungültiger/unbekannter Wert wird
// RESTRIKTIV auf „vertraulich" gezogen (NIE intern) — der Import scheitert weder hart noch stuft er
// still herab. FEHLT der Wert ganz, bleibt er undefined (acceptToKo/importJson stufen dann fail-safe auf
// „vertraulich", R3/R4). Der einzige Ort, an dem eine rohe confidentiality in den Import-Kern eintritt.
export function sanitizeImportConfidentiality(raw: unknown): Confidentiality | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  return isValidConfidentiality(raw) ? raw : "vertraulich";
}

export class LibraryService {
  private readonly koService: KoService;
  private readonly audit: AuditService | undefined;
  private readonly genId: () => string;
  private readonly now: () => number;
  // SCRUM-116/157: Import-/Source-Review-Queue über ein Repo (persistent via Pg, sonst In-Memory).
  private readonly candidates: CandidateRepo;
  // SCRUM-510 R2b: quellneutraler externalId-Upsert-Strang aktiv? Aus = heutiges Bestandsverhalten.
  private readonly externalUpsert: boolean;

  constructor(deps: LibraryServiceDeps) {
    this.koService = deps.koService;
    this.audit = deps.audit;
    this.candidates = deps.candidates ?? new InMemoryCandidateRepo();
    this.genId = deps.genId ?? (() => randomUUID());
    this.now = deps.now ?? (() => Date.now());
    this.externalUpsert = deps.externalUpsert ?? false;
  }

  // SCRUM-515: die eine Stelle, an der eine rohe (untrusted) confidentiality in den Import-Kern eintritt.
  // Ungültig/unbekannt → restriktiv „vertraulich"; fehlend → unverändert (downstream fail-safe).
  private withSanitizedConfidentiality(item: ImportItem): ImportItem {
    const confidentiality = sanitizeImportConfidentiality(item.confidentiality);
    return confidentiality === undefined ? item : { ...item, confidentiality };
  }

  // SCRUM-116: JSON-Re-Import erzeugt Review-Kandidaten (keine stille Bulk-Anlage).
  async createImportCandidates(
    rawItems: readonly ImportItem[],
    actor = "system",
  ): Promise<ImportCandidate[]> {
    // SCRUM-515: an der Ingest-Grenze runtime-validieren, BEVOR das Item in die Queue/den Bestand geht.
    // WP-IC-PAKET-1d (bens sammel9-ROT): ZENTRALE Codec-Erzeugungsregel. Dies ist DIE eine Stelle,
    // durch die jede Kandidaten-Erzeugung läuft (Confluence-Import, JSON-Re-Import-Route, Demo-Korpus) —
    // jedes NEUE Item wird hier autoritativ als kanonisch gestempelt (textCodec="decoded"). Ein neuer
    // Kandidat IST per Definition kanonischer Text: liefert ein Aufrufer rohe Entities, ist das SEIN
    // Text — hier wird nichts nachträglich dekodiert, nur markiert. Damit gilt wieder verlässlich:
    // Marker fehlt = echter Altbestand (gespeichert VOR dieser Regel).
    const items = rawItems.map<ImportItem>((item) => ({
      ...this.withSanitizedConfidentiality(item),
      textCodec: "decoded",
    }));
    const existing = await this.koService.list();
    const seen = new Set(existing.map((ko) => `${ko.title}|${ko.statement}`));
    const at = new Date(this.now()).toISOString();
    // SCRUM-510 R2b: Items mit externalId werden per externalId dedupliziert — aber NUR innerhalb dieses
    // Imports (mehrfach dasselbe Quell-Objekt in einer Scheibe). Eine Kollision mit dem BESTAND ist keine
    // zu überspringende Dublette, sondern ein Re-Sync/Update (wird beim Annehmen als Upsert behandelt).
    // WP-SHIP8-FIX (bens F3): der Dedup-Schlüssel ist provider+externalId — gleiche externalId aus
    // ZWEI Quellen (Confluence-pageId vs. Jira-Key) ist KEINE Dublette.
    const batchExternalIds = new Set<string>();
    const created = items.map<ImportCandidate>((item) => {
      let duplicate: boolean;
      // externalId-Dedup nur bei aktivem Upsert-Strang. Aus → title|statement-Dedup für ALLE Items.
      if (this.externalUpsert && item.externalId) {
        const batchKey = `${importProviderKey(item.provider)}@${item.externalId}`;
        duplicate = batchExternalIds.has(batchKey);
        batchExternalIds.add(batchKey);
      } else {
        duplicate = seen.has(`${item.title}|${item.statement}`);
      }
      return {
        id: this.genId(),
        item,
        status: "neu",
        duplicate,
        note: null,
        koId: null,
        createdAt: at,
      };
    });
    // SCRUM-510 (WP3): externalId-Kandidaten ATOMAR idempotent einreihen (partieller UNIQUE-Index / ON
    // CONFLICT DO NOTHING) — ein bereits offener Kandidat derselben (externalId, sourceVersion) wird NICHT
    // erneut angelegt, auch bei nebenläufigen Läufen/Retries. Nur der externalId-Upsert-Strang nutzt das;
    // der JSON-Re-Import (externalUpsert aus) fügt unverändert per plain insert ein. `persisted` zählt/
    // liefert NUR die tatsächlich eingereihten Kandidaten (ehrliche Zählung, keine Phantom-Kandidaten).
    const persisted: ImportCandidate[] = [];
    for (const candidate of created) {
      const inserted =
        this.externalUpsert && candidate.item.externalId
          ? await this.candidates.insertIfAbsent(candidate)
          : await this.candidates.insert(candidate).then(() => true);
      if (inserted) {
        persisted.push(candidate);
      }
    }
    await this.audit?.record({
      actor,
      action: "import.candidates-created",
      target: "library",
      payload: { count: persisted.length },
    });
    return persisted;
  }

  listImportCandidates(): Promise<ImportCandidate[]> {
    return this.candidates.all();
  }

  // ---- WP-D-CLEAN (Pedis Entscheid: alle Testdaten löschen, auch Confluence und Jira) ----
  // Umfang: (a) ALLE Import-Kandidaten der Review-Queue (jeder Status, harte Entfernung — Queue-
  // Einträge kennen keinen Papierkorb), (b) alle KOs mit Import-Provenienz eines der Cleanup-
  // Provider (Herkunfts-Anker: kind "external" + provider). KOs OHNE solche Provenienz bleiben
  // UNANGETASTET; die KO-Löschung läuft über den BESTEHENDEN Soft-Delete (Papierkorb — Original
  // ist heilig, Wiederherstellung bleibt möglich). Nichts an Nutzern/Teams/Einstellungen.

  private hasCleanupProvenance(
    sources: readonly { kind?: string; provider?: string | null }[],
  ): boolean {
    return sources.some(
      (s) =>
        s.kind === "external" &&
        typeof s.provider === "string" &&
        (IMPORT_CLEANUP_PROVIDERS as readonly string[]).includes(s.provider.toLowerCase()),
    );
  }

  // WP-SHIP8-FIX (bens F1): die VOLLSTÄNDIGE Zielmenge des Aufräumens — Queue-Einträge + KOs mit
  // Cleanup-Provenienz — wird IMMER als Ganzes gelesen, BEVOR irgendein Write passiert (Vorschau
  // UND Ausführung nutzen dieselbe Ermittlung; die Ausführung liest nie mehr „nebenbei nach").
  // WP-SHIP8-CLOSE-4 (bens ROT-1C): KOs, deren Kandidaten-Anker (importCandidateId) zu einem
  // OFFENEN Claim ('in_bearbeitung') gehört, sind NIE Teil der Zielmenge — sonst würde der
  // Cleanup das frisch gestempelte KO einer LAUFENDEN Review-Aktion trashen und die Recovery
  // fände den Anker nicht mehr lebend. Der Ausschluss ist über den Digest gebunden (Vorschau UND
  // Ausführung berechnen die Zielmenge identisch; ändert sich der Claim-Zustand dazwischen,
  // greift ehrlich CLEANUP_DRIFT) und wird als eigener Zähler ehrlich ausgewiesen.
  private async cleanupTargets(): Promise<{
    candidateIds: string[];
    // WP-SHIP8-FINAL (bens Bedingung 3): der Status je Kandidat zum Bestätigungs-Zeitpunkt —
    // die Ausführung löscht nur Kandidaten, deren Status seitdem UNVERÄNDERT ist.
    candidateStatuses: Map<string, string>;
    targets: KnowledgeObject[];
    // KOs mit Cleanup-Provenienz, die WEGEN eines offenen Claims geschützt sind (nur Zähler).
    claimedKos: number;
  }> {
    const candidates = await this.candidates.all();
    const candidateIds = candidates.map((c) => c.id);
    const candidateStatuses = new Map(candidates.map((c) => [c.id, c.status as string]));
    const openClaims = new Set(
      candidates.filter((c) => c.status === "in_bearbeitung").map((c) => c.id),
    );
    const provenance = (await this.koService.list()).filter((ko) =>
      this.hasCleanupProvenance(ko.sources ?? []),
    );
    const claimProtected = (ko: KnowledgeObject): boolean =>
      ko.importCandidateId !== undefined && openClaims.has(ko.importCandidateId);
    return {
      candidateIds,
      candidateStatuses,
      targets: provenance.filter((ko) => !claimProtected(ko)),
      claimedKos: provenance.filter(claimProtected).length,
    };
  }

  // Vorschau: NUR zählen, nichts verändern. WP-SHIP8-FIX (bens F2): zusätzlich der STATELESS
  // Digest über die Zielmenge — die Bestätigung schickt ihn zurück, die Ausführung berechnet neu
  // und vergleicht (robust über Replikas, kein Prozess-Zustand nötig).
  async importCleanupPreview(): Promise<{
    candidates: number;
    importedKos: number;
    digest: string;
    // WP-SHIP8-CLOSE-4 (bens ROT-1C): KOs einer LAUFENDEN Review-Aktion — ehrlich beziffert,
    // aber NIE Teil der Zielmenge (und damit nicht im Digest).
    claimedKos: number;
  }> {
    const { candidateIds, targets, claimedKos } = await this.cleanupTargets();
    return {
      candidates: candidateIds.length,
      importedKos: targets.length,
      digest: cleanupDigest(
        candidateIds,
        targets.map((ko) => ko.id),
      ),
      claimedKos,
    };
  }

  // Ausführung: Import-KOs in den Papierkorb, DANN die Queue leeren; ehrliche Bilanz (übersprungen
  // mit PII-freiem Grund je KO-Id). Audit-Eintrag mit Zählern (wer/wann kommt vom Audit-Service).
  //
  // WP-SHIP8-FIX (bens F1, FEHLERATOMARER ABLAUF):
  //  (1) Zielmenge VOLLSTÄNDIG lesen + gegen den bestätigten Vorschau-Digest validieren, BEVOR
  //      irgendein Write passiert (F2: Drift → CLEANUP_DRIFT/409, NICHTS wird verändert).
  //  (2) KO-Soft-Deletes ZUERST — jeder ist einzeln wiederherstellbar (Papierkorb).
  //  (3) Die Queue (UNWIDERRUFLICH — Kandidaten kennen keinen Papierkorb) kommt ans ENDE und wird
  //      NUR geleert, wenn die KO-Phase vollständig gut ging. Bei übersprungenen KOs bleibt sie
  //      ehrlich stehen (removedCandidates 0) — ein späterer Lauf räumt nach neuer Vorschau nach.
  //  (4) Nach einem GEFANGENEN Soft-Delete-Fehler wird der TATSÄCHLICHE KO-Zustand erneut gelesen:
  //      ist das KO in Wahrheit schon im Papierkorb (bens Fenster: Trash geschrieben, aber der
  //      Audit-Schreiber warf danach), zählt es als trashed — NIE fälschlich als skipped.
  //  (5) Ein Fehler des ABSCHLUSS-Audits macht die Antwort NICHT zum Fehler (die Mutationen sind
  //      passiert; ein Fehler-Response würde nur einen sinnlosen Retry provozieren) — die Bilanz
  //      trägt ehrlich auditFailed:true + PII-freies Log.
  async runImportCleanup(
    actor: string,
    confirmedDigest?: string,
  ): Promise<{
    removedCandidates: number;
    trashedKos: number;
    skipped: { id: string; reason: string }[];
    auditFailed: boolean;
    // WP-NIGHT-FIX (bens F2-TOCTOU): Kandidaten, die NACH der bestätigten Vorschau eingereiht
    // wurden — sie werden NICHT angefasst und ehrlich ausgewiesen.
    newCandidates: number;
    // WP-SHIP8-CLOSE-4 (bens ROT-1C): KOs einer LAUFENDEN Review-Aktion — aus der Zielmenge
    // ausgeschlossen (nie getrasht) und in der Bilanz ehrlich beziffert. BEWUSST kein Eintrag in
    // `skipped`: das würde die Queue-Phase blockieren (Regel 3 gilt nur für ECHTE KO-Fehlschläge).
    claimedKos: number;
  }> {
    const { candidateIds, candidateStatuses, targets, claimedKos } = await this.cleanupTargets();
    const digest = cleanupDigest(
      candidateIds,
      targets.map((ko) => ko.id),
    );
    if (confirmedDigest !== digest) {
      throw new LibraryError(
        "CLEANUP_DRIFT",
        "Der Bestand hat sich seit der Vorschau geändert — bitte die Vorschau neu laden.",
      );
    }
    // WP-SHIP8-FINAL (bens Bedingung 3): der Confirm ist je Item FAIL-CLOSED gegen parallele
    // Accepts/Revisionen — KEIN globales Lock nötig: jede Einzel-Entscheidung prüft unmittelbar
    // vor ihrem Write den aktuellen Zustand (KO: Versions-CAS im delete; Kandidat: Status-
    // Vergleich gegen den Bestätigungs-Snapshot) und weist Drift ehrlich als übersprungen aus.
    // Ein Lock würde nur das Fenster verkleinern, nicht die Ehrlichkeit ersetzen — und der
    // Reviewer-Accept bliebe trotzdem der gewinnende, nie verlorene Write.
    let trashedKos = 0;
    const skipped: { id: string; reason: string }[] = [];
    for (const ko of targets) {
      try {
        // BESTEHENDE Löschlogik: Soft-Delete in den Papierkorb (SCRUM-422) — kein Hard-Delete.
        // forceTrash (bens F2): auch ein demoSeed-KO mit Import-Provenienz landet auf DIESEM Weg
        // im Papierkorb statt still in der Endlöschung (delete-Semantik sonst unverändert).
        // WP-SHIP8-FINAL (bens Bedingung 3): mit Versions-Erwartung des Bestätigungs-Snapshots —
        // ein zwischenzeitlich revidiertes KO wird NICHT gelöscht (STALE_WRITE → skipped).
        await this.koService.delete(ko.id, actor, {
          forceTrash: true,
          expectedVersion: ko.version,
        });
        trashedKos += 1;
      } catch (err) {
        // (4) Ehrliche Bilanz: erst den ECHTEN Zustand nachlesen, dann zählen.
        const reason =
          err instanceof KoError && err.code === "STALE_WRITE"
            ? "zwischenzeitlich ueberarbeitet"
            : err instanceof Error
              ? err.name
              : "unknown";
        try {
          const stillLive = await this.koService.get(ko.id);
          if (stillLive === undefined) {
            trashedKos += 1; // in Wahrheit schon im Papierkorb — der Fehler kam NACH dem Trash
          } else {
            skipped.push({ id: ko.id, reason });
          }
        } catch {
          // Auch das Nachlesen scheiterte → konservativ als übersprungen ausweisen (Original-Fehlerklasse).
          skipped.push({ id: ko.id, reason });
        }
      }
    }
    // (3) Der unwiderrufliche Teil kommt ZULETZT und nur bei vollständig guter KO-Phase.
    // WP-NIGHT-FIX (bens F2-TOCTOU): gelöscht werden EXAKT die BESTÄTIGTEN Ids der Vorschau
    // — NICHT die ganze Queue. Ein Kandidat, der zwischen Digest-Vergleich und Löschung
    // eingereiht wurde, war nie Teil der Bestätigung: er überlebt (newCandidates unten).
    // WP-SHIP8-FINAL (Bedingung 3) + WP-SHIP8-CLOSE (bens F2, Restfenster geschlossen): die
    // Status-Bedingung steckt jetzt IN der Löschung selbst (removeByIds mit erwartetem Status je
    // Id — Pg: EIN bedingtes DELETE mit RETURNING; InMemory: atomar je Item). Der Re-Read davor
    // ist NUR noch Vorab-Bilanz („schon weg"); die WAHRHEIT ist das bedingte Delete-Ergebnis:
    // ein Accept im letzten Fenster zwischen Re-Read und Delete verliert nie — der Kandidat
    // überlebt und steht ehrlich in der Bilanz.
    let removedCandidates = 0;
    if (skipped.length === 0) {
      const preRead = new Map((await this.candidates.all()).map((c) => [c.id, c.status as string]));
      const attempts: { id: string; status: string }[] = [];
      for (const id of candidateIds) {
        if (!preRead.has(id)) {
          continue; // schon weg — nichts zu löschen
        }
        const confirmedStatus = candidateStatuses.get(id);
        if (confirmedStatus === undefined) {
          continue;
        }
        // WP-SHIP8-CLOSE-2 (bens F1): ein GECLAIMTER Kandidat (Review-Aktion läuft gerade) ist
        // NIE löschbar — auch wenn der Claim schon zur Bestätigungszeit sichtbar war. Er steht
        // ehrlich in der Bilanz; ein späterer Lauf räumt nach neuer Vorschau nach.
        if (confirmedStatus === "in_bearbeitung") {
          skipped.push({ id, reason: "in Bearbeitung" });
          continue;
        }
        attempts.push({ id, status: confirmedStatus });
      }
      const removedIds = attempts.length > 0 ? await this.candidates.removeByIds(attempts) : [];
      removedCandidates = removedIds.length;
      // Ehrliche Bilanz für alles, was das BEDINGTE Delete NICHT entfernt hat: der Status hat
      // sich seit der Bestätigung geändert. Für die Begründung den echten Zustand nachlesen
      // (best-effort — ohne Nachlesen konservativ „zwischenzeitlich bearbeitet").
      const removedSet = new Set(removedIds);
      const survivors = attempts.filter((attempt) => !removedSet.has(attempt.id));
      if (survivors.length > 0) {
        let afterStatuses = new Map<string, string>();
        try {
          afterStatuses = new Map(
            (await this.candidates.all()).map((c) => [c.id, c.status as string]),
          );
        } catch {
          // Nachlesen scheiterte — die konservative Begründung unten bleibt.
        }
        for (const survivor of survivors) {
          skipped.push({
            id: survivor.id,
            reason:
              afterStatuses.get(survivor.id) === "angenommen"
                ? "zwischenzeitlich angenommen"
                : "zwischenzeitlich bearbeitet",
          });
        }
      }
    }
    // Ehrliche Bilanz der Nachzügler: alles, was jetzt in der Queue steht und NICHT Teil der
    // bestätigten Vorschau war (nach der Löschung sind das genau die Neuzugänge seither).
    const confirmedIds = new Set(candidateIds);
    const newCandidates = (await this.candidates.all()).filter(
      (c) => !confirmedIds.has(c.id),
    ).length;
    let auditFailed = false;
    try {
      await this.audit?.record({
        actor,
        action: "import.cleanup",
        target: "library",
        payload: {
          removedCandidates,
          trashedKos,
          skipped: skipped.length,
          newCandidates,
          claimedKos,
        },
      });
    } catch (err) {
      auditFailed = true;
      // PII-frei: nur die Fehlerklasse — die Antwort bleibt Erfolg (s. (5)).
      process.stderr.write(
        `[KLARWERK] Cleanup-Abschluss-Audit fehlgeschlagen (fehler=${
          err instanceof Error ? err.name : "unknown"
        }).\n`,
      );
    }
    return { removedCandidates, trashedKos, skipped, auditFailed, newCandidates, claimedKos };
  }

  // SCRUM-116: Review-Aktion. accept → echtes KO (außer Dublette, dann übersprungen).
  // WP-SHIP8-CLOSE-2 (bens F1): die Aktion CLAIMT den Kandidaten ZUERST storage-atomar
  // (Status-CAS 'neu' → 'in_bearbeitung'). Damit ist bens Restfenster zu: ein Accept, der noch
  // in acceptToKo hängt, ist in der DB nicht mehr 'neu' — das bedingte Cleanup-Delete
  // (removeByIds mit dem bestätigten Status) trifft ihn nicht, KO+Audit+Queue bleiben konsistent.
  // Schlägt der CAS fehl (0 Zeilen), bricht die Aktion EHRLICH ab, BEVOR irgendetwas passiert
  // (kein KO, kein Audit): NOT_FOUND wenn der Kandidat weg ist, sonst ALREADY_REVIEWED (auch:
  // parallel geclaimt).
  //
  // WP-SHIP8-CLOSE-3 (bens ROT-1) — LEASE/OPID-PROTOKOLL (crash-sicher):
  //  (1) Der Claim persistiert opId (eindeutige Operations-Id) + claimedAt (Lease-Beginn) im
  //      selben CAS-Write. Die opId gehört NUR dem Claim-CAS (Fencing des Kandidaten-Writes).
  //  (2) WP-SHIP8-CLOSE-4 (bens ROT-1B): der Accept stempelt den STABILEN Kandidaten-Anker
  //      (importCandidateId = candidate.id, DB-unique inkl. Papierkorb) ans NEU ERZEUGTE KO,
  //      BEVOR der Endstatus geschrieben wird — je Kandidat ist damit hart höchstens EIN KO
  //      möglich, egal wie viele (auch abgelöste) Läufe schreiben; acceptToKo adoptiert bei
  //      Kollision. Der Re-Sync-/Anker-Pfad (revise/No-op) braucht keinen Stempel, er ist per
  //      (provider, externalId, sourceVersion) monoton idempotent.
  //  (3) Der Abschluss läuft über resolveClaim (CAS auf status+opId, räumt die Lease aus). Greift
  //      er nicht (Recovery hat übernommen), bricht die Aktion mit CONFLICT ab — nie stiller Erfolg.
  //  (4) Fehlerpfad (WP-SHIP8-CLOSE-4, bens ROT-1A): der ANKER entscheidet — NIE blind freigeben.
  //      Existiert das KO (createdKoId ODER Anker-Suche inkl. Papierkorb — auch bei create-
  //      Teilpersistenz: Insert gelungen, Snapshot/Audit warf), wird die Operation DIREKT
  //      vollendet (resolveClaim mit eigener opId); greift der CAS nicht, bleibt der Claim für
  //      die Recovery stehen. Schlägt die Anker-Suche selbst fehl → fail-closed (Claim bleibt).
  //      Nur wenn sicher KEIN KO existiert, geht der Claim auf 'neu' zurück (Retry sofort
  //      möglich). Crash-Fälle heilt recoverStaleReviewClaims nach Lease-Ablauf.
  async reviewImportCandidate(
    id: string,
    action: ReviewAction,
    actor = "system",
    note?: string,
  ): Promise<ImportCandidate> {
    const opId = this.genId();
    const candidate = await this.candidates.claim(id, opId, new Date(this.now()).toISOString());
    if (!candidate) {
      const current = await this.candidates.findById(id);
      if (!current) {
        throw new LibraryError("NOT_FOUND", "Importkandidat nicht gefunden.");
      }
      throw new LibraryError(
        "ALREADY_REVIEWED",
        "Kandidat wurde bereits bearbeitet oder wird gerade bearbeitet.",
      );
    }
    // Erst NACH erfolgreicher KO-Erzeugung gesetzt — steuert den Fehlerpfad (s. Kopfkommentar (4)).
    let createdKoId: string | null = null;
    let resolved: ImportCandidate | undefined;
    // WP-SHIP8-CLOSE-6 (bens ROT-3a): Wer/Wann der Entscheidung reisen IM SELBEN Statuswrite mit
    // (resolveClaim-Patch) — unverlierbar im Produktbestand, egal was das Aktionsaudit später tut.
    const reviewedStamp = { reviewedBy: actor, reviewedAt: new Date(this.now()).toISOString() };
    try {
      let resolution: ClaimResolution;
      if (action === "reject") {
        resolution = { status: "abgelehnt", ...reviewedStamp };
      } else if (action === "info") {
        resolution = {
          status: "info-angefragt",
          note: note?.trim() ? note.trim() : null,
          ...reviewedStamp,
        };
      } else if (candidate.duplicate) {
        resolution = { status: "angenommen", ...reviewedStamp };
      } else {
        // SCRUM-515-Vervollständigung: ein PERSISTIERTER Alt-Kandidat (vor 515 eingereiht; PgCandidateRepo
        // liefert das JSONB unverändert) wurde bei createImportCandidates evtl. nie sanitisiert. Unmittelbar
        // VOR acceptToKo erneut sanitisieren — sonst würde ein ungültiger Altwert im Re-Sync-Ranking auf
        // „intern" normalisiert (fail-open) bzw. bei der Erstanlage hart abgelehnt. Das bereinigte Item wird
        // MIT persistiert (nicht nur transient), damit die Queue keinen ungültigen Wert behält.
        const item = this.withSanitizedConfidentiality(candidate.item);
        createdKoId = await this.acceptToKo(item, actor, id);
        resolution = { status: "angenommen", koId: createdKoId, item, ...reviewedStamp };
      }
      // SCRUM-157: Endstatus/koId/Note (+ bereinigtes Item, 515) persistieren — atomar über den
      // opId-CAS (kein stiller Verlust, kein Fremd-Overwrite).
      resolved = await this.candidates.resolveClaim(id, opId, resolution);
      if (!resolved) {
        throw new LibraryError(
          "CONFLICT",
          "Der Review-Claim wurde zwischenzeitlich übernommen — Aktion nicht gespeichert.",
        );
      }
    } catch (err) {
      // WP-SHIP8-CLOSE-4 (bens ROT-1A): der ANKER entscheidet über den Fehlerpfad — eine blinde
      // Freigabe, während das gestempelte KO existiert (z. B. create-Teilpersistenz: Insert
      // gelungen, Snapshot/Audit warf danach), wäre beim Retry ein Doppel-KO.
      // WP-SHIP8-CLOSE-5 (bens ROT-1A, kein halber Zustand): VOR jeder Vollendung werden die
      // create-Belege idempotent nachgezogen (ensureCreatedSideEffects: v1-Snapshot + ko.created).
      // Scheitert Anker-Suche ODER Beleg-Nachzug, bleibt der Claim fail-closed stehen — es gibt
      // nie ein „angenommen" ohne vollständige Belege.
      let stampedId = createdKoId;
      let ankerUnsettled = false;
      if (stampedId === null && action === "accept" && !candidate.duplicate) {
        try {
          const stamped = await this.koService.findByImportCandidateId(id);
          if (stamped) {
            await this.koService.ensureCreatedSideEffects(stamped);
            stampedId = stamped.id;
          }
        } catch {
          ankerUnsettled = true; // Anker/Belege nicht gesichert → fail-closed (s. unten).
        }
      }
      if (stampedId !== null) {
        // Das KO existiert — die Operation DIREKT vollenden statt auf die Recovery zu warten.
        // CAS auf die EIGENE opId: eine übernommene Lease wird nie überschrieben.
        const completed = await this.candidates
          .resolveClaim(id, opId, { status: "angenommen", koId: stampedId, ...reviewedStamp })
          .catch(() => undefined);
        if (completed) {
          process.stderr.write(
            `[KLARWERK] Review-Accept trotz Seiteneffekt-Fehler vollendet (kandidat=${id}, fehler=${
              err instanceof Error ? err.name : "unknown"
            }) — genau EIN KO, Endzustand angenommen.\n`,
          );
          resolved = completed;
        } else {
          // Entweder hält eine ANDERE Operation die Lease (deren Ausgang gilt; ein offener Claim
          // wird von der Recovery per Kandidaten-Anker vollendet) — oder der Kandidat ist bereits
          // aufgelöst (der Gewinner-Zustand steht). Nie ein Doppel-KO: der Anker ist DB-unique.
          process.stderr.write(
            `[KLARWERK] Review-Accept: KO existiert, aber der Claim gehört dieser Operation nicht mehr (kandidat=${id}) — Zustand des Gewinners gilt.\n`,
          );
          throw err;
        }
      } else if (ankerUnsettled) {
        // FAIL-CLOSED: ohne verlässliche Anker-Auskunft bzw. ohne vollständige Belege weder
        // freigeben (Doppel-KO-Risiko) noch vollenden (halber Zustand) — der Claim bleibt
        // stehen, die Lease-Recovery entscheidet später sicher.
        process.stderr.write(
          `[KLARWERK] Anker-Pruefung/Beleg-Nachzug nach Review-Fehler fehlgeschlagen (kandidat=${id}) — Claim bleibt stehen (fail-closed).\n`,
        );
        throw err;
      } else {
        // Sicher KEIN KO entstanden → Claim zurückgeben (CAS trifft nur die EIGENE Lease).
        try {
          await this.candidates.resolveClaim(id, opId, { status: "neu" });
        } catch {
          // PII-frei: der Kandidat bleibt sichtbar 'in_bearbeitung' — kein stiller Verlust;
          // die Lease-Recovery gibt ihn nach Ablauf frei.
          process.stderr.write(
            `[KLARWERK] Review-Claim-Rueckgabe fehlgeschlagen (kandidat=${id}) — Status bleibt in_bearbeitung.\n`,
          );
        }
        throw err;
      }
    }
    if (!resolved) {
      // Defensiv unerreichbar: jeder nicht-werfende Pfad oben setzt resolved.
      throw new LibraryError("CONFLICT", "Review-Aktion ohne Ergebnis — bitte erneut versuchen.");
    }
    // WP-SHIP8-CLOSE-5 (bens Konsistenz-Punkt, GEWÄHLTE SEMANTIK): der Statuswechsel IST zu
    // diesem Zeitpunkt persistiert (resolveClaim, inkl. reviewedBy/reviewedAt) und die HARTEN
    // Belege (KO, v1-Snapshot, ko.created) sind fail-closed gesichert, BEVOR es überhaupt hierher
    // kommt. Wirft jetzt noch das abschließende Aktions-Audit (in Produktion derselbe Auditdienst
    // wie im KoService), bleibt die Antwort ERFOLG: ein Fehler-Response würde nur einen Retry
    // provozieren, der ALREADY_REVIEWED erntet — der Client sähe einen Fehler für eine vollzogene
    // Aktion. WP-SHIP8-CLOSE-6 (bens ROT-3b/3c): der Beleg fehlt dann aber NICHT dauerhaft —
    // der Ausfall wird als PERSISTENTE auditPending-Markierung am Kandidaten vermerkt (mit der
    // stabilen Event-Id für den exactly-once-Nachzug via recordOnce) und beim nächsten
    // Queue-Load nachgezogen; die API-Antwort weist den Schwebezustand aus. Zusätzlich LAUTES,
    // PII-freies Log (dieselbe Semantik wie Cleanup-Regel 5).
    const auditEventId = `import.candidate-${action}:${id}:${opId}`;
    try {
      await this.audit?.recordOnce(auditEventId, {
        actor,
        action: `import.candidate-${action}`,
        target: resolved.id,
        payload: { duplicate: resolved.duplicate, koId: resolved.koId },
      });
    } catch (auditErr) {
      process.stderr.write(
        `[KLARWERK] Abschluss-Audit der Review-Aktion fehlgeschlagen (kandidat=${resolved.id}, aktion=${action}, fehler=${
          auditErr instanceof Error ? auditErr.name : "unknown"
        }) — die Aktion IST vollzogen (Status persistiert), der Beleg wird per auditPending nachgezogen.\n`,
      );
      const marked: ImportCandidate = {
        ...resolved,
        auditPending: { eventId: auditEventId, action, actor },
      };
      try {
        await this.candidates.update(marked);
        resolved = marked;
      } catch {
        // Markierung selbst nicht persistierbar (z. B. Kandidat parallel entfernt) — dann bleibt
        // NUR das laute Log; die Wer/Wann-Wahrheit steht weiterhin am Kandidaten/ist mit ihm weg.
        process.stderr.write(
          `[KLARWERK] auditPending-Markierung fehlgeschlagen (kandidat=${resolved.id}) — Beleg-Nachzug nicht möglich.\n`,
        );
      }
    }
    return { ...resolved };
  }

  // WP-SHIP8-CLOSE-6 (bens ROT-3b): Nachzug-Retry schwebender Review-Aktionsbelege — LAZY beim
  // Queue-Load (dasselbe Muster wie recoverStaleReviewClaims, direkt daneben verdrahtet). JE
  // Kandidat mit auditPending: recordOnce mit der GESPEICHERTEN Event-Id erzeugt exactly-once
  // GENAU EINEN Aktionsbeleg (auch bei parallelen Retries — der Unique-/Set-Guard entscheidet),
  // danach wird die Markierung gelöscht. Wirft der Nachzug, bleibt die Markierung stehen und der
  // nächste Load versucht es erneut (fail-closed für den Beleg, nie für die Antwort).
  async retryPendingReviewAudits(): Promise<number> {
    if (!this.audit) {
      return 0;
    }
    let retried = 0;
    for (const candidate of await this.candidates.all()) {
      const pending = candidate.auditPending;
      if (!pending) {
        continue;
      }
      try {
        await this.audit.recordOnce(pending.eventId, {
          actor: pending.actor,
          action: `import.candidate-${pending.action}`,
          target: candidate.id,
          payload: { duplicate: candidate.duplicate, koId: candidate.koId, retried: true },
        });
        await this.candidates.update({ ...candidate, auditPending: undefined });
        retried += 1;
      } catch {
        process.stderr.write(
          `[KLARWERK] Beleg-Nachzug fehlgeschlagen (kandidat=${candidate.id}) — Markierung bleibt, naechster Queue-Load versucht erneut.\n`,
        );
      }
    }
    return retried;
  }

  // WP-SHIP8-CLOSE-3 (bens ROT-1): Crash-Recovery festhängender Review-Claims — LAZY beim Laden
  // der Review-Queue (Route GET /api/library/import/candidates; dasselbe dokumentierte Muster wie
  // der aiCheck-Lazy-Re-Enqueue am Board-Load: kein Cron, keine neue Infrastruktur; wird die
  // Queue nie geladen, bleibt ein verwaister Claim sichtbar 'in_bearbeitung' liegen).
  // JE Kandidat mit status 'in_bearbeitung' und ABGELAUFENER Lease (claimedAt älter als
  // REVIEW_CLAIM_LEASE_MS; fehlend/unlesbar = abgelaufen):
  //  - WP-SHIP8-CLOSE-4 (bens ROT-1C): existiert ein KO mit importCandidateId === candidate.id —
  //    gesucht INKLUSIVE Papierkorb — war die KO-Erzeugung bereits gelungen, nur der Endstatus
  //    fehlte: Operation VOLLENDEN (angenommen + koId, Audit mit recovered:true) — höchstens EIN
  //    KO, kein stiller Erfolg. FESTER TRASH-VERTRAG: auch ein vom D-CLEAN getrashtes Stempel-KO
  //    zählt als vollendet — der Kandidat erhält seinen Endstatus mit Verweis auf das (ggf.
  //    getrashte) KO; es entsteht NIE ein neues KO, und die Trash-Entscheidung bleibt beim
  //    Cleanup (Wiederherstellen läuft über den Papierkorb, nicht über einen Re-Accept).
  //  - existiert keines → nichts Unumkehrbares ist passiert: Claim auf 'neu' zurückgeben (der
  //    Anker-/Re-Sync-Pfad ist idempotent; die Erstanlage hätte den Anker hinterlassen, und der
  //    DB-Unique-Anker macht selbst einen SPÄTER noch schreibenden abgelösten Lauf unschädlich —
  //    er kollidiert und adoptiert statt zu duplizieren).
  //  - fehlt die opId (darf nie vorkommen — der Claim schreibt sie atomar mit): KEINE blinde
  //    Freigabe (der Kandidaten-CAS wäre nicht fence-bar) — lauter Log, Kandidat bleibt stehen.
  // Beide Wege laufen über den opId-CAS (resolveClaim) — eine PARALLEL noch laufende Operation
  // oder eine zweite Replika-Recovery kann nie überschrieben werden (0 Zeilen = No-op).
  async recoverStaleReviewClaims(): Promise<{ completed: number; released: number }> {
    const nowMs = this.now();
    const stale = (await this.candidates.all()).filter(
      (c) => c.status === "in_bearbeitung" && reviewClaimLeaseExpired(c.claimedAt, nowMs),
    );
    let completed = 0;
    let released = 0;
    if (stale.length === 0) {
      return { completed, released };
    }
    for (const candidate of stale) {
      const opId = candidate.opId;
      if (!opId) {
        process.stderr.write(
          `[KLARWERK] Review-Claim ohne opId (kandidat=${candidate.id}) — keine sichere Recovery möglich, bleibt in_bearbeitung.\n`,
        );
        continue;
      }
      // WP-SHIP8-CLOSE-5 (bens ROT-1A): Anker-Suche (inkl. Papierkorb, s. Trash-Vertrag oben) UND
      // Beleg-Nachzug laufen fail-closed JE Kandidat: wirft eine der beiden Flächen, bleibt DIESER
      // Claim stehen (nächster Recovery-Lauf versucht es erneut) und der Queue-Load bricht nicht.
      let stamped: KnowledgeObject | undefined;
      try {
        stamped = await this.koService.findByImportCandidateId(candidate.id);
        if (stamped) {
          // Kein Abschluss ohne vollständige Belege (v1-Snapshot + ko.created) — idempotent.
          await this.koService.ensureCreatedSideEffects(stamped);
        }
      } catch {
        process.stderr.write(
          `[KLARWERK] Recovery: Anker-Pruefung/Beleg-Nachzug fehlgeschlagen (kandidat=${candidate.id}) — Claim bleibt stehen (fail-closed).\n`,
        );
        continue;
      }
      if (stamped) {
        const resolved = await this.candidates.resolveClaim(candidate.id, opId, {
          status: "angenommen",
          koId: stamped.id,
          // WP-SHIP8-CLOSE-6 (bens ROT-3a): auch die Recovery-Vollendung persistiert Wer/Wann.
          reviewedBy: "system",
          reviewedAt: new Date(this.now()).toISOString(),
        });
        if (resolved) {
          completed += 1;
          // WP-SHIP8-CLOSE-6 (bens ROT-3b): exactly-once über die opId-stabile Event-Id; ein
          // Ausfall hinterlässt die persistente auditPending-Markierung für den Queue-Load-Nachzug.
          const eventId = `import.candidate-accept:${candidate.id}:${opId}`;
          try {
            await this.audit?.recordOnce(eventId, {
              actor: "system",
              action: "import.candidate-accept",
              target: candidate.id,
              payload: { duplicate: candidate.duplicate, koId: stamped.id, recovered: true },
            });
          } catch {
            // WP-SHIP8-CLOSE-5: dieselbe Abschluss-Audit-Semantik wie im Live-Accept — der
            // Statuswechsel ist persistiert; der Beleg wird per Markierung nachziehbar.
            process.stderr.write(
              `[KLARWERK] Recovery-Audit fehlgeschlagen (kandidat=${candidate.id}) — Vollendung IST persistiert, Beleg via auditPending.\n`,
            );
            try {
              await this.candidates.update({
                ...resolved,
                auditPending: { eventId, action: "accept", actor: "system" },
              });
            } catch {
              process.stderr.write(
                `[KLARWERK] auditPending-Markierung fehlgeschlagen (kandidat=${candidate.id}).\n`,
              );
            }
          }
        }
      } else if (await this.candidates.resolveClaim(candidate.id, opId, { status: "neu" })) {
        released += 1;
      }
    }
    return { completed, released };
  }

  // SCRUM-470: Baut das KO aus einem angenommenen Import-Item — idempotent per pageId.
  // Bekannte pageId (Anker im Bestand) → Re-Sync via revise() (nur bei höherer sourceVersion),
  // sonst neues KO. Gibt die KO-Id zurück (für die nachgelagerte Erkennung im Route-Layer).
  // WP-SHIP8-CLOSE-4 (bens ROT-1A/1B/1C): INSERT-OR-ADOPT am STABILEN Kandidaten-Anker
  // (importCandidateId = candidate.id; DB-unique inkl. Papierkorb). Damit sind späte/wiederholte
  // Writes ALLER Läufe desselben Kandidaten unschädlich:
  //  - VORAB-ADOPTION: existiert bereits ein KO mit diesem Anker (auch getrasht — z. B. weil der
  //    D-CLEAN es nach einem Crash trashte), wird ES zurückgegeben — nie ein zweites erzeugt.
  //  - KOLLISIONS-ADOPTION: wirft create (Unique-Kollision eines parallelen/abgelösten Laufs ODER
  //    Teilpersistenz: KO-Insert gelungen, Snapshot/Audit warf danach — bens ROT-1A), wird der
  //    Anker nachgeschlagen; existiert das KO, ist der Accept materialisiert → adoptieren.
  //  Der Anker-/Re-Sync-Pfad (revise bei höherer Version, sonst No-op) ist monoton idempotent
  //  und braucht keinen Stempel; ein Crash dort ist per Claim-Freigabe sicher wiederholbar.
  private async acceptToKo(item: ImportItem, actor: string, candidateId?: string): Promise<string> {
    if (candidateId) {
      const stamped = await this.koService.findByImportCandidateId(candidateId);
      if (stamped) {
        // WP-SHIP8-CLOSE-5 (bens ROT-1A): Adoption NUR mit vollständigen Belegen — fehlende
        // create-Seiteneffekte (v1-Snapshot/ko.created) werden idempotent nachgezogen; wirft der
        // Nachzug, wirft die Adoption (fail-closed, kein halber Zustand wird vollendet).
        await this.koService.ensureCreatedSideEffects(stamped);
        return stamped.id;
      }
    }
    // SCRUM-510 R2b: externalId-Upsert/Anker nur bei aktivem Strang. Aus → externalId ignorieren, immer
    // neu anlegen ohne Herkunfts-Anker (exakt heutiges Bestandsverhalten). Quellneutral.
    // WP-SHIP8-FIX (bens F3): das Ziel-KO wird nach provider+externalId gesucht (der Herkunfts-
    // Anker kennt beide) — ein Jira-Item mit zufällig gleicher externalId wie eine Confluence-
    // pageId revidiert NIE das Confluence-KO. Anker ohne Provider (Altbestand) zählen wie
    // importProviderKey als Confluence (der einzige Adapter vor dem Provider-Schlüssel).
    const externalId = this.externalUpsert ? item.externalId : undefined;
    const providerKey = importProviderKey(item.provider);
    const matchesAnchor = (s: { externalId?: string; provider?: string | null }): boolean =>
      s.externalId === externalId && importProviderKey(s.provider) === providerKey;
    const existing = externalId
      ? (await this.koService.list()).find((ko) => (ko.sources ?? []).some(matchesAnchor))
      : undefined;

    if (existing && externalId) {
      // WP-SHIP8-CLOSE-6 (bens ROT-2): der Re-Sync ist eine VOLLENDUNGSSTELLE — trägt das
      // bestehende KO einen Kandidaten-Anker (Stempel eines Import-Accepts), werden dessen
      // create-Belege HIER fail-closed nachgezogen, ZWINGEND VOR Upgrade/Revision/Rückgabe:
      // nur so entsteht der v1-Snapshot aus dem TATSÄCHLICHEN Erstanlagezustand (nicht aus der
      // gleich folgenden Revision), und Kandidat B kann As teilpersistiertes KO nie mit dauerhaft
      // fehlenden Belegen übernehmen. Wirft der Nachzug, wirft der Accept (Muster der anderen
      // Vollendungsstellen); KOs ohne Stempel (vor der Anker-Ära) haben nichts nachzuziehen.
      if (existing.importCandidateId) {
        await this.koService.ensureCreatedSideEffects(existing);
      }
      // SCRUM-509 R4: Re-Sync eines bestehenden KO aus externer Quelle darf die Vertraulichkeit nur
      // ANHEBEN, nie still niedrig halten. Fail-safe wie der Create-Import (R3): fehlt das Governance-
      // Signal (ImportItem.confidentiality, s. 511), gilt „vertraulich"; eine explizit HÖHERE
      // Importstufe wird respektiert. Ziel = die höhere aus (aktueller Stufe, Import-Boden) → nie ein
      // Downgrade über Re-Sync. Der Upgrade läuft durch setConfidentiality (transaktional: Lock + CAS +
      // Audit) und wird von der nachfolgenden revise() nicht angetastet.
      const currentConf = normalizeConfidentiality(existing.confidentiality);
      const importFloor: Confidentiality = item.confidentiality ?? "vertraulich";
      const target =
        confidentialityRank(importFloor) > confidentialityRank(currentConf)
          ? importFloor
          : currentConf;
      if (target !== currentConf) {
        await this.koService.setConfidentiality(existing.id, target, item.author ?? actor);
      }

      const current = existing.sources.find(matchesAnchor)?.sourceVersion ?? 0;
      // ben-Review #3: Ohne explizite Version NICHT hochzählen (früher `current + 1` → jeder versions-
      // lose Re-Import revidierte endlos). `?? current` heißt: „gleiche Version wie zuletzt" → No-op.
      // Nur eine tatsächlich höhere (explizite) Version schreibt monoton fort — kein Downgrade.
      const incoming = item.sourceVersion ?? current;
      if (incoming > current) {
        // bens F3: nur der Anker DESSELBEN Providers wird fortgeschrieben — ein gleichnamiger
        // Anker eines anderen Providers am selben KO bliebe unangetastet.
        const nextSources = [
          ...existing.sources.filter((s) => !matchesAnchor(s)),
          this.buildSource(item, actor, incoming),
        ];
        await this.koService.revise(
          existing.id,
          {
            title: item.title,
            statement: item.statement,
            type: item.type,
            ...(item.bodyHtml ? { bodyHtml: item.bodyHtml } : {}),
            sources: nextSources,
          },
          item.author ?? actor,
        );
      }
      return existing.id;
    }

    // Erstanlage: die effektive Version wird IMMER gespeichert (auch ohne Item-Version → 1), damit ein
    // versionsloser Re-Import (current = 1, incoming = 1) sauber als No-op erkannt wird (Idempotenz).
    const firstVersion = item.sourceVersion ?? 1;
    try {
      const ko = await this.koService.create({
        title: item.title,
        statement: item.statement,
        type: item.type,
        category: item.category,
        // WP-SAMMEL21-FIX (Pedis Autor-Entscheid, Fix 4): GEWÄHLTE ABBILDUNG — `author` ist IMMER
        // der annehmende Reviewer (ein echter KLARWERK-Nutzer: RBAC-Checks wie „eigenes KO löschen"
        // und die Historie funktionieren; vorher stand hier der rohe Quell-Autor-String, den das
        // Nutzer-Verzeichnis nie auflösen kann). Der QUELL-AUTOR wandert in das BESTEHENDE
        // originalAuthor-Feld (Wissensträger — dasselbe Modell wie der Draft-Weg): die
        // Validierungs-/Detail-Anzeige zeigt „von <Quell-Autor>" mit Vorrang, busFactor/expertise
        // zählen ihn als Träger. KEIN Fake-User. Fehlt der Quell-Autor, bleibt ehrlich der Reviewer.
        author: actor,
        ...(item.author?.trim() ? { originalAuthor: item.author } : {}),
        tags: item.tags ?? [],
        // SCRUM-509 R3: Import ist ein Bulk-/Programmatik-Pfad → konservativ. Fehlt das Governance-Signal,
        // gilt „vertraulich" (NICHT still intern) — importierter Fremdinhalt bleibt bis zur bewussten
        // Freigabe aus Cloud/Export heraus.
        confidentiality: item.confidentiality ?? "vertraulich",
        ...(item.bodyHtml ? { bodyHtml: item.bodyHtml } : {}),
        ...(externalId ? { sources: [this.buildSource(item, actor, firstVersion)] } : {}),
        // WP-SHIP8-CLOSE-3/4 (bens ROT-1): Kandidaten-Anker VOR dem Endstatus des Kandidaten —
        // Recovery und Insert-or-Adopt erkennen daran eine bereits gelungene Erstanlage.
        ...(candidateId ? { importCandidateId: candidateId } : {}),
      });
      return ko.id;
    } catch (err) {
      // WP-SHIP8-CLOSE-4 (bens ROT-1A/1B): KOLLISIONS-ADOPTION — existiert das KO mit diesem
      // Anker trotz werfendem create (Unique-Kollision ODER Insert gelungen + Snapshot/Audit
      // warf danach), ist der Accept materialisiert: das bestehende KO gilt, der Fehler wird
      // PII-frei geloggt statt in ein Doppel-KO oder eine falsche Claim-Freigabe zu münden.
      // WP-SHIP8-CLOSE-5 (bens ROT-1A): VOR der Adoption werden die create-Belege idempotent
      // nachgezogen (genau der Teilpersistenz-Fall: Insert durch, Snapshot/Audit fehlt) — wirft
      // der Nachzug, wirft die Adoption (fail-closed; der äußere Fehlerpfad lässt den Claim stehen).
      if (candidateId) {
        const raced = await this.koService.findByImportCandidateId(candidateId);
        if (raced) {
          await this.koService.ensureCreatedSideEffects(raced);
          process.stderr.write(
            `[KLARWERK] Import-Accept adoptiert bestehendes KO (kandidat=${candidateId}, fehler=${
              err instanceof Error ? err.name : "unknown"
            }).\n`,
          );
          return raced.id;
        }
      }
      throw err;
    }
  }

  // SCRUM-470: Herkunfts-Anker aus einem Import-Item. Generisch — provider kommt vom Item
  // (die Confluence-Route setzt "Confluence"); externe Importquellen sind nie peer-validiert.
  // `effectiveVersion` (ben-Review #3): die tatsächlich geschriebene Version — IMMER gesetzt, damit der
  // Monotonie-Vergleich beim Re-Sync verlässlich ist (nie ein „versionsloser" Anker im Bestand).
  private buildSource(item: ImportItem, actor: string, effectiveVersion: number): KoSource {
    return {
      id: this.genId(),
      label: item.title,
      // SCRUM-527 (WP2): importierte URL nur, wenn absolute http/https — sonst verworfen (kein Egress
      // eines aktiven Schemas aus einer manipulierten Import-/Confluence-Quelle in den Klick-Pfad).
      url: safeSourceUrl(item.url),
      excerpt: null,
      kind: "external",
      peerValidated: false,
      provider: item.provider ?? null,
      // SCRUM-510 R2b: quellneutraler Anker. externalId = Re-Sync-Schlüssel; sourceScope landet als
      // (KO-seitig weiterhin so genanntes) spaceKey-Container-Label — der Match läuft NUR über externalId.
      ...(item.externalId ? { externalId: item.externalId } : {}),
      ...(item.sourceScope ? { spaceKey: item.sourceScope } : {}),
      sourceVersion: effectiveVersion,
      // WP-RETEST7 R6: leerer Autor-String → ehrlicher Fallback auf den annehmenden Nutzer.
      author: item.author?.trim() ? item.author : actor,
      at: new Date(this.now()).toISOString(),
    };
  }

  // FR-LIB-01: Suche + Filter.
  // WP-BILD-1e: zusätzlich zu title/statement matchen auch die Bild-Fußnoten; Alt-Platzhalter
  // gelten als KEIN Inhalt. WP-BILD-1g (bens sammel14-ROT): der Suchpfad arbeitet auf
  // DATENQUELLEN-Ebene body-frei — geladen wird die Projektion OHNE bodyHtml, der Caption-Match
  // läuft über das beim KO-Schreiben persistierte captionTexts-Feld. Legacy-KOs ohne Feld werden
  // beim ersten Such-Kandidaten EINMALIG backgefüllt (bodyHtml nur für dieses eine KO geladen,
  // Ergebnis persistiert). WP-BILD-1h (bens sammel15-ROT 2): der Backfill ist HART LASTBEGRENZT —
  // höchstens SEARCH_BACKFILL_LIMIT_PER_QUERY Vollladungen PRO SUCHANFRAGE; Kandidaten über dem
  // Deckel werden in DIESER Suche ehrlich ohne Caption-Match behandelt (title/statement-Match
  // bleibt), die nächste Suche arbeitet den nächsten Schwung ab (konvergiert). Wirft der Backfill
  // eines Kandidaten (Laden/Scan/Write), fällt NUR dieser Kandidat auf „kein Caption-Match"
  // zurück — die Suche selbst scheitert NIE am Backfill (PII-freies Log: KO-Id + Fehlerklasse).
  async search(query: string, filter: KoFilter = {}): Promise<KnowledgeObject[]> {
    const list = await this.koService.listForSearch(filter);
    const q = query.trim().toLowerCase();
    if (!q) {
      return list;
    }
    const out: KnowledgeObject[] = [];
    let backfills = 0;
    for (const ko of list) {
      if (ko.title.toLowerCase().includes(q) || ko.statement.toLowerCase().includes(q)) {
        out.push(ko);
        continue;
      }
      let captionTexts = ko.captionTexts;
      if (captionTexts === undefined) {
        if (backfills >= SEARCH_BACKFILL_LIMIT_PER_QUERY) {
          continue; // Deckel erreicht: in DIESER Suche ehrlich ohne Caption-Match weiter.
        }
        backfills += 1;
        try {
          captionTexts = await this.koService.ensureCaptionTexts(ko.id);
        } catch (error) {
          // PII-frei: nur Id + Fehlerklasse — nie Inhalte. Der Kandidat bleibt ohne Caption-Match.
          process.stderr.write(
            `[KLARWERK] Caption-Backfill fehlgeschlagen (ko=${ko.id}, fehler=${
              error instanceof Error ? error.name : "unknown"
            }).\n`,
          );
          continue;
        }
      }
      if (captionTexts.some((caption) => caption.toLowerCase().includes(q))) {
        // Das (ggf. frisch backgefüllte) Feld reist im Treffer mit — der Client kennzeichnet
        // damit die Fundstelle, ohne dass bodyHtml transportiert wird.
        out.push({ ...ko, captionTexts });
      }
    }
    return out;
  }

  // FR-LIB-02: Export als JSON / MediaWiki.
  // SCRUM-506 (ben-Review): der Export ist ein Egress-Kanal und durchsetzt dieselben Grenzen wie
  // die Output Factory (services/output): NUR validierte KOs (nicht-validierte nie im regulären
  // Export) und KEINE vertraulichen KOs — außer der Aufrufer ist berechtigt (includeConfidential,
  // in der Route an ko.validate gebunden: Controller/Admin). Fail-closed by default.
  async exportJson(
    opts: { ids?: readonly string[]; includeConfidential?: boolean } = {},
  ): Promise<KnowledgeObject[]> {
    const list = await this.koService.list({ status: "validiert" });
    const scoped = opts.ids ? list.filter((ko) => opts.ids?.includes(ko.id)) : list;
    return opts.includeConfidential
      ? scoped
      : scoped.filter((ko) => !isConfidential(ko.confidentiality));
  }

  async exportMediaWiki(opts?: {
    ids?: readonly string[];
    includeConfidential?: boolean;
  }): Promise<string> {
    const items = await this.exportJson(opts);
    return items.map((ko) => `== ${ko.title} ==\n${ko.statement}`).join("\n\n");
  }

  // FR-LIB-02: echtes Text-Markdown (Überschrift, Listen, Herkunfts-Fußzeile).
  async exportMarkdown(opts?: {
    ids?: readonly string[];
    includeConfidential?: boolean;
  }): Promise<string> {
    const items = await this.exportJson(opts);
    return items
      .map((ko) => {
        const lines: string[] = [`# ${ko.title}`, "", ko.statement];
        if (ko.conditions.length > 0) {
          lines.push("", "**Wann es gilt**", ...ko.conditions.map((c) => `- ${c}`));
        }
        if (ko.measures.length > 0) {
          lines.push("", "**Vorgehen**", ...ko.measures.map((m) => `- ${m}`));
        }
        const author =
          ko.author === ko.originalAuthor
            ? ko.author
            : `${ko.author} (urspr. ${ko.originalAuthor})`;
        lines.push(
          "",
          `_${ko.type} · ${ko.category} · Trust ${ko.trust} · ${ko.status} · Autor: ${author}_`,
        );
        return lines.join("\n");
      })
      .join("\n\n---\n\n");
  }

  // FR-LIB-02: druckfertiges HTML — der Browser erzeugt daraus per „Als PDF sichern" das PDF.
  async exportHtml(opts?: {
    ids?: readonly string[];
    includeConfidential?: boolean;
  }): Promise<string> {
    const items = await this.exportJson(opts);
    const esc = (s: string): string =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const li = (xs: readonly string[]): string => xs.map((x) => `<li>${esc(x)}</li>`).join("");
    const articles = items
      .map((ko) => {
        const conditions = ko.conditions.length
          ? `<p><strong>Wann es gilt</strong></p><ul>${li(ko.conditions)}</ul>`
          : "";
        const measures = ko.measures.length
          ? `<p><strong>Vorgehen</strong></p><ul>${li(ko.measures)}</ul>`
          : "";
        const author =
          ko.author === ko.originalAuthor
            ? esc(ko.author)
            : `${esc(ko.author)} (urspr. ${esc(ko.originalAuthor)})`;
        return `<article><h2>${esc(ko.title)}</h2><p class="meta">${esc(ko.type)} · ${esc(ko.category)} · Trust ${ko.trust} · ${esc(ko.status)}</p><p>${esc(ko.statement)}</p>${conditions}${measures}<p class="src">Autor: ${author}</p></article>`;
      })
      .join("\n");
    const style =
      "body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#1f2a37}" +
      "h2{margin-bottom:.2rem}.meta{color:#666;font-size:.85rem;margin-top:0}" +
      "article{break-inside:avoid;border-bottom:1px solid #eee;padding:1rem 0}" +
      ".src{color:#888;font-size:.8rem}@media print{body{margin:0}}";
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>KLARWERK Export</title><style>${style}</style></head><body><h1>KLARWERK — Wissensexport</h1>${articles}</body></html>`;
  }

  // FR-LIB-02: Import per JSON ohne Duplikate.
  async importJson(
    rawItems: readonly ImportItem[],
    defaultAuthor = "import",
  ): Promise<ImportResult> {
    // SCRUM-515: an der Ingest-Grenze runtime-validieren (ungültig/unbekannt → vertraulich, nie intern).
    const items = rawItems.map((item) => this.withSanitizedConfidentiality(item));
    const existing = await this.koService.list();
    const seen = new Set(existing.map((ko) => `${ko.title}|${ko.statement}`));
    let imported = 0;
    let skipped = 0;
    for (const item of items) {
      const key = `${item.title}|${item.statement}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      await this.koService.create({
        title: item.title,
        statement: item.statement,
        type: item.type,
        category: item.category,
        // WP-RETEST7 R6: auch ein LEERER Autor-String fällt ehrlich auf den einreichenden
        // Session-Nutzer zurück (kein KO ohne „von …“ mehr aus dem Import).
        author: item.author?.trim() ? item.author : defaultAuthor,
        tags: item.tags ?? [],
        // SCRUM-509 R3: JSON-Import ist ein Bulk-Pfad → konservativ „vertraulich" bei fehlendem Signal.
        confidentiality: item.confidentiality ?? "vertraulich",
      });
      seen.add(key);
      imported += 1;
    }
    await this.audit?.record({
      actor: defaultAuthor,
      action: "library.import",
      target: "library",
      payload: { imported, skipped },
    });
    return { imported, skipped };
  }

  // FR-LIB-03: Bus-Faktor je Kategorie (Einzelquelle = nur ein Autor).
  async busFactor(): Promise<BusFactorEntry[]> {
    const list = await this.koService.list();
    const byCategory = new Map<string, { authors: Set<string>; count: number }>();
    for (const ko of list) {
      const entry = byCategory.get(ko.category) ?? { authors: new Set<string>(), count: 0 };
      entry.authors.add(ko.originalAuthor);
      entry.count += 1;
      byCategory.set(ko.category, entry);
    }
    return [...byCategory.entries()].map(([category, entry]) => ({
      category,
      authorCount: entry.authors.size,
      koCount: entry.count,
      singleSource: entry.authors.size <= 1,
    }));
  }

  // Consultant-System (Experten-Matching): Thema (Kategorie) → beitragende Personen. Wissensträger =
  // `originalAuthor` (wer das Wissen einbrachte; bewusste Produktentscheidung, konsistent mit busFactor).
  // BEWUSST ohne Score/Trust/Zeitreihe und OHNE Sortierung nach Beitragsmenge — Reihenfolge ist rein
  // alphabetisch (deterministisch), damit keine Rangliste entsteht. Reine Aggregation, kein DB-Umbau.
  // Sichtbarkeit/Freigabe regelt die Route (Recht ko.assign + Feature-Flag, Default AUS).
  async expertise(): Promise<ExpertiseEntry[]> {
    const list = await this.koService.list();
    const byCategory = new Map<string, Map<string, number>>();
    for (const ko of list) {
      const authors = byCategory.get(ko.category) ?? new Map<string, number>();
      authors.set(ko.originalAuthor, (authors.get(ko.originalAuthor) ?? 0) + 1);
      byCategory.set(ko.category, authors);
    }
    return [...byCategory.entries()].map(([category, authors]) => ({
      category,
      contributors: [...authors.entries()]
        .map(([authorId, koCount]) => ({ authorId, koCount }))
        .sort((a, b) => (a.authorId < b.authorId ? -1 : a.authorId > b.authorId ? 1 : 0)),
    }));
  }

  // FR-LIB-04: Graph aus gemeinsamen Tags.
  async graph(): Promise<Graph> {
    const list = await this.koService.list();
    const nodes = list.map((ko) => ({ id: ko.id, title: ko.title }));
    const edges: GraphEdge[] = [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (!a || !b) {
          continue;
        }
        const shared = a.tags.find((tag) => b.tags.includes(tag));
        if (shared) {
          edges.push({ a: a.id, b: b.id, via: shared });
        }
      }
    }
    return { nodes, edges };
  }

  // FR-ANA-01: Bestände nach Status / Art / Kategorie.
  async analytics(): Promise<Analytics> {
    const list = await this.koService.list();
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const ko of list) {
      increment(byStatus, ko.status);
      increment(byType, ko.type);
      increment(byCategory, ko.category);
    }
    return { total: list.length, byStatus, byType, byCategory };
  }
}
