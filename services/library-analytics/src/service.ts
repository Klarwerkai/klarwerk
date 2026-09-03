import { createHash, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import {
  type Confidentiality,
  type KnowledgeObject,
  KoError,
  type KoFilter,
  type KoService,
  // AUFTRAG-BASIC-380: der injizierte Sicherheitstrim — nur durchgereicht, nie ausgelegt.
  type KoSichtbarkeitstrim,
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
  type DublettenBefund,
  type DublettenPruefung,
  type ExpertiseEntry,
  type Graph,
  type GraphEdge,
  type ImportCandidate,
  type ImportItem,
  type ImportResult,
  type KoSichtbar,
  LibraryError,
  type Neighborhood,
  type ReviewAction,
  type UebersprungenerImport,
} from "./types";

// WP-BILD-1h (bens sammel15-ROT 2): harter Backfill-Deckel PRO SUCHANFRAGE. Eine nicht-matchende
// Query darf nicht den nahezu gesamten Legacy-Bestand voll laden — höchstens so viele Legacy-KOs
// werden je Suche geladen/gescannt/backgefüllt; der Rest folgt in späteren Suchen (konvergiert,
// weil jedes backgefüllte KO danach dauerhaft sein Feld trägt).
// AUFTRAG-mega29 C3 (bens M28-3): der eine Satz, den jede MENSCHLICHE Ausgabe dieses Moduls trägt.
// Er behauptet nichts über den Umfang der Prüfung — er nimmt nur die Zusicherung zurück, die ein
// Leser einer gepflegten Ausgabe sonst selbst ergänzt.
export const EXPORT_NO_CHECK_NOTE =
  "Hinweis: Diese Ausgabe trifft keine Aussage darüber, ob das enthaltene Wissen auf Konflikte oder Duplikate geprüft wurde.";

export const SEARCH_BACKFILL_LIMIT_PER_QUERY = 20;

// AUFTRAG-mega68: Deckel der Nachbarschafts-Auskunft. 12 Nachbarn füllen die Detailseiten-Fläche,
// ohne sie zu überladen (der Entwurf zeichnet ~10); alles darüber weist `truncated`/`total`
// ehrlich aus. Kein Client-Parameter — der Deckel ist Server-Vertrag, nicht Verhandlungsmasse.
export const NEIGHBOR_LIMIT = 12;

// AUFTRAG-mega68 (Schlagwortregel, Begründung am neighbors()-Kopf): ein Schlagwort ist ubiquitär,
// wenn MEHR ALS DIE HÄLFTE des Bestands es trägt — ab der Mehrheitsgrenze verbindet es mehr Paare,
// als es trennt, und die Kante sagt nichts mehr. Der absolute Boden verhindert, dass die
// Anteilsstatistik in Kleinstbeständen feuert (2 von 2 Objekten teilen IMMER 100 %).
export const UBIQUITY_MAX_SHARE = 0.5;
export const UBIQUITY_MIN_COUNT = 5;

// JOB 3022: Kantendeckel des GLOBALEN Graphen. 5.000 Kanten sind rund ein halbes Megabyte Nutzlast
// und weit mehr, als eine Darstellung je zeigt (die Wissensnetz-Ansicht legt selbst schon bei 60
// Knoten ab) — der Deckel schützt Leitung und Browser, nicht die Rechnung: gezählt wird ungedeckelt
// (`totalEdges`), und die Antwort sagt mit `truncated`/`edgeLimit`, dass sie gedeckelt ist.
// BEWUSST KEIN MODUL-EXPORT und kein Anfrageparameter: der Wert reist als FELD in der Antwort
// (dort hat er einen Leser), ein Export hätte keinen Aufrufer, und ein Client-setzbarer Deckel
// wäre kein Schutz, sondern eine Bitte.
const GRAPH_EDGE_LIMIT = 5_000;

// ================================================================================================
// AUFTRAG-mega77 BLOCK D — DIE ZWEITE LINIE UNTER DEM COMPILER, FÜR DIESES MODUL.
// ================================================================================================
//
// DIESELBE KLASSE WIE mega76 BLOCK A, EINE EBENE TIEFER. mega76 hat vier ROUTEN-Zugänge zu
// Pflichtparametern gemacht und in `services/app/src/sichtbarkeit.ts` eine zweite Linie darunter
// gelegt (`zugangTauglich`) — für die Aufrufer, die der Compiler nicht sieht: JavaScript, ein
// `as never`, ein aus JSON gebautes Deps-Objekt, ein `Partial<Deps>`. Die vier AUSKÜNFTE DIESES
// DIENSTES trugen ihren Sichtbarkeitsfilter aber ebenfalls optional bzw. ohne Rückfallebene:
// `graph()` hatte `= {}` und gab dann den vollen Bestand samt aller Titel heraus, `neighbors()`
// fiel auf den milderen `includeConfidential`-Zweig zurück, `analytics()`/`busFactor()` (mega76
// Block D) waren zwar Pflicht, aber ohne Verhalten für den Aufrufer unterhalb des Compilers.
//
// WARUM NICHT WÖRTLICH `zugangTauglich`. Sie liegt in `services/app` (Kompositionswurzel) und prüft
// einen ZUGANG (`{ get(...) }`), nicht ein PRÄDIKAT. Dieses Modul darf `services/app` nicht
// importieren — die Abhängigkeitsrichtung läuft app → library-analytics und wird von
// dependency-cruiser erzwungen. Also steht hier GENAU EINE Stelle mit derselben Bauart und
// derselben Aussage, und alle vier Auskünfte benutzen sie; kopiert wird sie nicht.
//
// FAIL-CLOSED HEISST HIER: ohne Entscheidung ist NICHTS sichtbar. Nicht „alles", nicht ein
// Absturz — eine leere Grundmenge. Eine leere Antwort ist für jeden Aufrufer lesbar und verrät
// nichts; ein `TypeError` wäre zwar auch kein Leck, aber er beschreibt den Fall nicht.
function erzwingeSichtbar(sichtbar: KoSichtbar | undefined): KoSichtbar {
  return typeof sichtbar === "function" ? sichtbar : () => false;
}

// JOB 3023 — DIESELBE ZWEITE LINIE FUER DIE DUBLETTENPRUEFUNG (types.ts, DublettenPruefung).
//
// Der Compiler verlangt sie; ein Aufrufer UNTERHALB des Compilers (JavaScript, ein `as never`, ein
// aus JSON gebautes Deps-Objekt) kann sie trotzdem weglassen. Fail-closed heisst hier NICHT „dann
// eben ohne Pruefung importieren" — das waere die unbemerkte Dublette — sondern: jeder Eintrag
// gilt als NICHT PRUEFBAR und wird ehrlich als solcher uebersprungen. Der geworfene Fehler landet
// im Ausfall-Zweig von `importJson` und erscheint in der Antwort als `pruefung_nicht_moeglich`.
function erzwingeDublettenpruefung(pruefung: DublettenPruefung | undefined): DublettenPruefung {
  if (typeof pruefung === "function") {
    return pruefung;
  }
  return () => {
    throw new LibraryError(
      "BAD_REQUEST",
      "Import ohne verdrahtete Dublettenpruefung — es wird nichts eingespielt.",
    );
  };
}

// Ein Befund aus fremder Hand ist untrusted wie jede andere Fremdangabe (Muster
// `sanitizeImportConfidentiality`): nur ein VOLLSTAENDIGER Duplikatbefund darf einen Eintrag
// zurueckhalten, und nur ein ausdrueckliches `dublette: false` darf ihn durchlassen. Alles andere
// ist keine Entscheidung und faellt in den Ausfall-Zweig.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3 (bens Befund) — EIN BEFUND WIRD MATERIALISIERT, NICHT NUR GEPRUEFT.
// ------------------------------------------------------------------------------------------------
//
// Runde 2 hatte einen PRAEDIKAT-Pruefer (`istBrauchbarerBefund`). Der bestaetigte nur die Form; der
// Aufrufer griff danach WEITER auf das fremde Objekt zu — und dieser Zugriff lag ausserhalb des
// `try`. Ben hat es gemessen: ein `dublette`-Getter, der beim ERSTEN Lesen brav `false` liefert und
// beim ZWEITEN wirft, kam durch die Pruefung und riss dann den GANZEN Import mit.
//
// Ein Praedikat ueber ein fremdes Objekt ist deshalb keine Sicherung: Es sagt etwas ueber den
// Zustand von GESTERN. Zwischen Pruefung und Verwendung kann sich derselbe Zugriff anders
// verhalten — er wirft, oder er liefert einen anderen Wert (`false` zum Pruefen, `true` zum
// Benutzen). Beides ist mit Gettern trivial zu bauen.
//
// DIE ANTWORT: JEDE Eigenschaft wird GENAU EINMAL gelesen, sofort in eine lokale Variable, und aus
// diesen Variablen entsteht ein EIGENES, frisches Objekt. Danach wird das fremde Objekt nie wieder
// angefasst — es gibt keinen zweiten Zugriff, der werfen oder seine Meinung aendern koennte.
// Der einzige Lesevorgang liegt im `try` des Aufrufers; wirft er, kostet er seinen eigenen Eintrag.
//
// Rueckgabe `null` heisst „keine brauchbare Entscheidung" und fuehrt zu `pruefung_nicht_moeglich`.
function materialisiereBefund(roh: unknown): DublettenBefund | null {
  if (typeof roh !== "object" || roh === null) {
    return null;
  }
  const fremd = roh as { dublette?: unknown; koId?: unknown; aehnlichkeit?: unknown };
  // DIE DREI EINZIGEN ZUGRIFFE AUF DAS FREMDE OBJEKT — ab hier nur noch eigene Werte.
  const dublette: unknown = fremd.dublette;
  const koId: unknown = fremd.koId;
  const aehnlichkeit: unknown = fremd.aehnlichkeit;

  if (dublette === false) {
    return { dublette: false };
  }
  if (dublette !== true) {
    return null;
  }
  if (typeof koId !== "string" || koId.trim().length === 0) {
    return null;
  }
  if (typeof aehnlichkeit !== "number" || !Number.isFinite(aehnlichkeit)) {
    return null;
  }
  return { dublette: true, koId, aehnlichkeit };
}

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

/**
 * JOB 2689 D1: Deckel der Bibliotheks-Trefferabfrage. Gleich der Fensterzahl der Bibliotheksseite
 * (`apps/web/src/lib/libraryDisplay.ts`, LIBRARY_RESULT_LIMIT = 200); der Test
 * `tests/app/job2689-ein-prozentzeichen-holt-den-ganzen-bestand.test.ts` hält beide Zahlen zusammen.
 */
export const LIBRARY_SEARCH_HIT_LIMIT = 200;

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
    // WP-SHIP8-CLOSE-8 (bens ROT-1): Kandidaten mit schwebendem Aktionsbeleg (auditPending) —
    // das bedingte DELETE lässt sie stehen (einziger Träger des Belegs); hier ehrlich beziffert.
    auditPendingCandidates: number;
  }> {
    const candidates = await this.candidates.all();
    const candidateIds = candidates.map((c) => c.id);
    const candidateStatuses = new Map(candidates.map((c) => [c.id, c.status as string]));
    const auditPendingCandidates = candidates.filter((c) => c.auditPending !== undefined).length;
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
      auditPendingCandidates,
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
    // WP-SHIP8-CLOSE-8 (bens ROT-1): Kandidaten mit schwebendem Aktionsbeleg — das Löschen
    // lässt sie fail-closed stehen; hier vorab ehrlich beziffert (nicht im Digest: die Ids
    // bleiben Teil der Zielmenge, nur das DELETE verweigert sie).
    auditPendingCandidates: number;
  }> {
    const { candidateIds, targets, claimedKos, auditPendingCandidates } =
      await this.cleanupTargets();
    return {
      candidates: candidateIds.length,
      importedKos: targets.length,
      digest: cleanupDigest(
        candidateIds,
        targets.map((ko) => ko.id),
      ),
      claimedKos,
      auditPendingCandidates,
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
    // WP-SHIP8-CLOSE-8 (bens ROT-1): Kandidaten mit schwebendem Aktionsbeleg — vom bedingten
    // DELETE fail-closed verschont und hier ehrlich beziffert (wie claimedKos BEWUSST kein
    // skipped-Eintrag; ein späterer Lauf räumt sie nach gelungenem Beleg-Nachzug ab).
    auditPendingCandidates: number;
  }> {
    // WP-SHIP8-CLOSE-9 (bens Korrektur 1): KEIN Write vor erfolgreicher Digest-Validierung —
    // auch nicht der best-effort Beleg-Retry. Reihenfolge zwingend:
    //  (1) Zielmenge/Digest lesen und gegen den bestätigten Digest validieren — bei Drift
    //      fail-closed 409, es wurde NICHTS verändert (der Vertrag aus WP-SHIP8-FIX F1/F2).
    const confirmed = await this.cleanupTargets();
    const digest = cleanupDigest(
      confirmed.candidateIds,
      confirmed.targets.map((ko) => ko.id),
    );
    if (confirmedDigest !== digest) {
      throw new LibraryError(
        "CLEANUP_DRIFT",
        "Der Bestand hat sich seit der Vorschau geändert — bitte die Vorschau neu laden.",
      );
    }
    //  (2) ERST NACH der Validierung der Vorab-Retry (WP-SHIP8-CLOSE-8: gelingt er, ist der
    //      Kandidat frei und darf fallen; ein Fehlschlag hebt die Löschsperre im DELETE nie auf).
    await this.retryPendingReviewAudits().catch(() => 0);
    //  (3) Kandidatenzustand für die Delete-Versuche NEU lesen — der Retry ändert keine Ids/
    //      Stati/KO-Ziele (der bestätigte Digest bleibt stabil); jede SONSTIGE parallele Drift
    //      bricht auch hier fail-closed ab (die KO-Phase unten hat noch nichts geschrieben).
    const { candidateIds, candidateStatuses, targets, claimedKos } = await this.cleanupTargets();
    if (
      cleanupDigest(
        candidateIds,
        targets.map((ko) => ko.id),
      ) !== digest
    ) {
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
        let afterById = new Map<string, ImportCandidate>();
        try {
          afterById = new Map((await this.candidates.all()).map((c) => [c.id, c]));
        } catch {
          // Nachlesen scheiterte — die konservative Begründung unten bleibt.
        }
        for (const survivor of survivors) {
          const after = afterById.get(survivor.id);
          // WP-SHIP8-CLOSE-8 (bens ROT-1): vom DELETE wegen schwebendem Aktionsbeleg verschont —
          // Träger des Belegs, KEIN skipped-Eintrag (er zählt über auditPendingCandidates; wie
          // claimedKos blockiert er nichts und fällt nach gelungenem Nachzug im nächsten Lauf).
          if (after?.auditPending !== undefined) {
            continue;
          }
          skipped.push({
            id: survivor.id,
            reason:
              after?.status === "angenommen"
                ? "zwischenzeitlich angenommen"
                : "zwischenzeitlich bearbeitet",
          });
        }
      }
    }
    // Ehrliche Bilanz der Nachzügler: alles, was jetzt in der Queue steht und NICHT Teil der
    // bestätigten Vorschau war (nach der Löschung sind das genau die Neuzugänge seither).
    const confirmedIds = new Set(candidateIds);
    const afterQueue = await this.candidates.all();
    const newCandidates = afterQueue.filter((c) => !confirmedIds.has(c.id)).length;
    // WP-SHIP8-CLOSE-9 (bens Korrektur 2): der ERGEBNIS-Zähler zählt die NACH dem DELETE
    // tatsächlich verbliebenen bestätigten Marker-Träger (Restmenge, KEIN Vorab-Snapshot) —
    // räumt ein paralleler Queue-Load den Marker zwischen Zählung und DELETE, fällt der
    // Kandidat und wird hier ehrlich NICHT mehr als ausgenommen gezählt. Die Vorschau zeigt
    // weiterhin den Snapshot (als solcher ok).
    const auditPendingCandidates = afterQueue.filter(
      (c) => confirmedIds.has(c.id) && c.auditPending !== undefined,
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
          auditPendingCandidates,
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
    return {
      removedCandidates,
      trashedKos,
      skipped,
      auditFailed,
      newCandidates,
      claimedKos,
      auditPendingCandidates,
    };
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
    // WP-SHIP8-CLOSE-7 (bens ROT-2): Akteur + Aktion reisen IM Claim-CAS mit — crasht die
    // Operation, vollendet die Recovery im Namen des ECHTEN Reviewers, nicht anonym als System.
    const candidate = await this.candidates.claim(
      id,
      opId,
      new Date(this.now()).toISOString(),
      actor,
      action,
    );
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
    // WP-SHIP8-CLOSE-7 (bens GELB): die Aktion wird WIRKLICH mitpersistiert (reviewedAction).
    // WP-SHIP8-CLOSE-7 (bens ROT-1): die Event-Id des Aktionsbelegs ist VOR dem Statuswrite
    // bekannt — die auditPending-Markierung reist deshalb VORBEUGEND im selben resolveClaim-CAS
    // mit. Gelingt das Audit danach, wird sie bedingt gelöscht; bei Audit-Fehler ODER Crash
    // zwischen Statuswrite und Audit steht sie automatisch für den Queue-Load-Nachzug bereit —
    // es gibt kein Fenster mehr, in dem weder Beleg noch Markierung existiert.
    const auditEventId = `import.candidate-${action}:${id}:${opId}`;
    const reviewedStamp = {
      reviewedBy: actor,
      reviewedAt: new Date(this.now()).toISOString(),
      reviewedAction: action,
      auditPending: { eventId: auditEventId, action, actor },
    };
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
    // Aktion. WP-SHIP8-CLOSE-7 (bens ROT-1): die auditPending-Markierung steht zu diesem
    // Zeitpunkt bereits PERSISTENT im Statuswrite (vorbeugend, s. oben) — ein Crash genau hier
    // hinterlässt sie automatisch für den Queue-Load-Nachzug. Gelingt das Audit, wird sie
    // BEDINGT gelöscht (clearAuditPending: nur die eigene eventId); wirft es, bleibt sie stehen
    // und die API-Antwort weist den Schwebezustand ehrlich aus. Zusätzlich LAUTES, PII-freies
    // Log (dieselbe Semantik wie Cleanup-Regel 5).
    let auditRecorded = false;
    try {
      // recordOnce false (ein paralleler Nachzug war schneller) zählt als gesichert — der Beleg
      // existiert; ohne verdrahteten Auditdienst gibt es nichts nachzuziehen (ebenfalls räumen).
      await this.audit?.recordOnce(auditEventId, {
        actor,
        action: `import.candidate-${action}`,
        target: resolved.id,
        payload: { duplicate: resolved.duplicate, koId: resolved.koId },
      });
      auditRecorded = true;
    } catch (auditErr) {
      process.stderr.write(
        `[KLARWERK] Abschluss-Audit der Review-Aktion fehlgeschlagen (kandidat=${resolved.id}, aktion=${action}, fehler=${
          auditErr instanceof Error ? auditErr.name : "unknown"
        }) — die Aktion IST vollzogen (Status persistiert), der Beleg wird über die im Statuswrite persistierte auditPending-Markierung nachgezogen.\n`,
      );
    }
    if (auditRecorded) {
      try {
        await this.candidates.clearAuditPending(id, auditEventId);
        resolved = { ...resolved, auditPending: undefined };
      } catch {
        // Markierung nicht räumbar (transienter Persistenzfehler) — unkritisch: der Beleg ist
        // gesichert, der Queue-Load-Nachzug trifft recordOnce=false und räumt exactly-once nach.
        process.stderr.write(
          `[KLARWERK] auditPending-Markierung nicht geräumt (kandidat=${resolved.id}) — der Queue-Load räumt nach, kein Doppel-Beleg möglich.\n`,
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
        // WP-SHIP8-CLOSE-8 (bens GELB-1): ein in der Markierung gespeicherter Beleg-Payload
        // (z. B. recovered/recoveredBy/reviewerUnknown der Recovery) wird UNVERÄNDERT
        // übernommen — die Kennzeichnung überlebt den Nachzug; retried markiert den Retry-Weg.
        await this.audit.recordOnce(pending.eventId, {
          actor: pending.actor,
          action: `import.candidate-${pending.action}`,
          target: candidate.id,
          payload: {
            duplicate: candidate.duplicate,
            koId: candidate.koId,
            ...(pending.payload ?? {}),
            retried: true,
          },
        });
        // WP-SHIP8-CLOSE-7 (bens ROT-1): BEDINGT räumen (nur die eigene eventId) — ein
        // paralleler Räumer oder eine inzwischen neue Markierung wird nie überschrieben.
        await this.candidates.clearAuditPending(candidate.id, pending.eventId);
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
        // WP-SHIP8-CLOSE-7 (bens ROT-2): defensiv unerreichbare Schieflage — ein Stempel-KO
        // existiert, aber geclaimt war NICHT accept (reject/info fassen KOs nie an; ein Alt-
        // Accept-Crash wäre schon von der Recovery vollendet worden). Eine solche Vollendung
        // als „angenommen" würde die tatsächlich geclaimte Entscheidung verfälschen →
        // fail-closed stehen lassen + lautes Log statt raten.
        if (candidate.claimedAction && candidate.claimedAction !== "accept") {
          process.stderr.write(
            `[KLARWERK] Recovery: Stempel-KO vorhanden, aber geclaimte Aktion ist ${candidate.claimedAction} (kandidat=${candidate.id}) — Claim bleibt stehen (fail-closed).\n`,
          );
          continue;
        }
        // WP-SHIP8-CLOSE-7 (bens ROT-2): der ECHTE Reviewer aus dem Claim (claimedBy) — nur
        // Altclaims ohne das Feld fallen EHRLICH auf "system" zurück (Kennzeichnung im Beleg).
        const reviewer = candidate.claimedBy ?? "system";
        const reviewerUnknown = candidate.claimedBy === undefined;
        // WP-SHIP8-CLOSE-6 (bens ROT-3b) + CLOSE-7 (bens ROT-1): exactly-once über die
        // opId-stabile Event-Id; die auditPending-Markierung reist VORBEUGEND im selben
        // resolveClaim-CAS mit — ein Crash zwischen Vollendung und Beleg hinterlässt sie
        // automatisch für den Queue-Load-Nachzug.
        const eventId = `import.candidate-accept:${candidate.id}:${opId}`;
        // WP-SHIP8-CLOSE-8 (bens GELB-1): der Beleg-Payload (inkl. Recovery-Kennzeichnung) wird
        // EINMAL gebaut und reist auch in der vorbeugenden Markierung mit — ein späterer Retry
        // schreibt den Beleg mit EXAKT dieser Kennzeichnung, nichts geht beim Nachzug verloren.
        const recoveryPayload: Record<string, unknown> = {
          duplicate: candidate.duplicate,
          koId: stamped.id,
          recovered: true,
          recoveredBy: "system",
          ...(reviewerUnknown ? { reviewerUnknown: true } : {}),
        };
        const resolved = await this.candidates.resolveClaim(candidate.id, opId, {
          status: "angenommen",
          koId: stamped.id,
          reviewedBy: reviewer,
          reviewedAt: new Date(this.now()).toISOString(),
          reviewedAction: "accept",
          auditPending: { eventId, action: "accept", actor: reviewer, payload: recoveryPayload },
        });
        if (resolved) {
          completed += 1;
          let auditRecorded = false;
          try {
            await this.audit?.recordOnce(eventId, {
              // Fachliche Wahrheit: der Reviewer hat entschieden; die TECHNISCHE Vollendung
              // weist recoveredBy:"system" im Payload aus (bens „ehrlicher Ausweis" — gewählt
              // als Audit-Payload statt Kandidatenfeld: der Kandidat trägt die fachliche
              // Entscheidung, der Beleg die Betriebsgeschichte).
              actor: reviewer,
              action: "import.candidate-accept",
              target: candidate.id,
              payload: recoveryPayload,
            });
            auditRecorded = true;
          } catch {
            // WP-SHIP8-CLOSE-5/7: dieselbe Abschluss-Audit-Semantik wie im Live-Accept — der
            // Statuswechsel ist persistiert; die Markierung steht bereits aus dem Statuswrite.
            process.stderr.write(
              `[KLARWERK] Recovery-Audit fehlgeschlagen (kandidat=${candidate.id}) — Vollendung IST persistiert, Beleg via auditPending nachziehbar.\n`,
            );
          }
          if (auditRecorded) {
            try {
              await this.candidates.clearAuditPending(candidate.id, eventId);
            } catch {
              process.stderr.write(
                `[KLARWERK] auditPending-Markierung nicht geräumt (kandidat=${candidate.id}) — der Queue-Load räumt nach.\n`,
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
        // AUFTRAG-mega82 Block A: der Akteur dieser Mutation ist der ANNEHMENDE, nie `item.author`.
        // Der Wert steht im Prüfprotokoll dieses Upgrades; ein aus dem Rumpf gelieferter Name
        // machte dort einen Ungeprüften zum Handelnden. Begründung in voller Länge an der revise()
        // weiter unten — es ist dieselbe Regel, und beide Stellen tragen sie gemeinsam.
        await this.koService.setConfidentiality(existing.id, target, actor);
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
        // ==========================================================================================
        // AUFTRAG-mega82 BLOCK A — WER IMPORTIERT, HANDELT. WER IM IMPORT GENANNT WIRD, HANDELT NICHT.
        // ==========================================================================================
        //
        // DER REVISIONSAUTOR IST EIN NACHWEIS, KEINE ANZEIGE. `KoService.revise` schreibt ihn als
        // Verfasser des Voll-Schnappschusses fort (knowledge-object/src/service.ts:447-459), und
        // GENAU dieses Feld ist seit mega80 der Anker, an dem `zuordnungInFassung` misst, ob eine
        // Fließtext-Fundstelle nachgewiesen oder nur behauptet ist (app/src/sichtbarkeit.ts:506).
        //
        // Bis mega82 stand hier `item.author ?? actor`. `item.author` kommt aus dem REQUEST: jeder
        // Nutzer mit `ko.create` reicht über POST /api/library/import/candidates beliebige
        // `ImportItem[]` ein, und `ImportItem` erlaubt sowohl freies `author` als auch `bodyHtml`
        // (../types.ts). Damit war die Kette offen: fremde Objektkennung in den Rumpf, Kennung des
        // HOCHLADENDEN dieses Objekts als `author` — die Differenzregel aus mega80 sieht die
        // Fundstelle korrekt als NEU, `vomHochladenden` akzeptiert den gelieferten String, und die
        // Rohbytes eines nie freigegebenen Objekts öffnen sich. Die Restgröße, die mega80 als
        // „heute nicht akut" benannt hat, war über diesen generischen Eingang erreichbar.
        //
        // DIE REGEL: der authentifizierte `actor` ist der ALLEINIGE Mutations- und
        // Schnappschussakteur. Der Quellautor reist unverändert weiter — aber ausschließlich als
        // METADATUM: `originalAuthor` am Wissensobjekt (Wissensträger, Anzeige und busFactor) und
        // `KoSource.author` am Herkunfts-Anker (buildSource unten). Beide sind erhoben: keine
        // Autorisierung und kein Anhangs-Nachweis verzweigt über sie.
        //
        // Der Erstanlage-Zweig weiter unten war seit WP-SAMMEL21-FIX schon so gebaut. Diese Stelle
        // und der Vertraulichkeits-Upgrade darüber waren die beiden, die es noch nicht waren.
        await this.koService.revise(
          existing.id,
          {
            title: item.title,
            statement: item.statement,
            type: item.type,
            ...(item.bodyHtml ? { bodyHtml: item.bodyHtml } : {}),
            sources: nextSources,
          },
          actor,
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
  // ================================================================================================
  // G27 — DIE SUCHE LIEST DEN GANZEN GESPEICHERTEN INHALT, NICHT MEHR NUR DAS KURZFELD.
  // ================================================================================================
  //
  // WAS SICH ÄNDERT. Bis hierher matchte diese Schleife auf `title`, `statement` und den
  // persistierten Bild-Fußnoten. Der eigentliche Dokumenttext (`bodyHtml`) war KEIN Suchraum — ein
  // Begriff, der erst nach Zeichen 500 des Fließtexts steht, war für die Bibliothek nicht
  // vorhanden. Jetzt entscheidet die revisionsgebundene Suchprojektion (knowledge-object,
  // search-projection.ts), und zwar GENAU DIESELBE, die auch Ask/Klara benutzt: ein Suchvertrag,
  // keine zweite Auslegung.
  //
  // WAS GLEICH BLEIBT. Reihenfolge (Bestandsreihenfolge, das Ranking macht der Client), die
  // Filter (type/status/category/tag am Repository), die Body-Freiheit der Trefferliste und der
  // Fußnoten-Backfill für Altbestand. Auch die AUTORISIERUNG bleibt, wo sie war: an der Route
  // (sichtbareFuer) — dieser Dienst liefert Kandidaten, keine Freigaben.
  //
  // ================================================================================================
  // G27 R1 — DER BACKFILL IST AUS DIESEM WEG VERSCHWUNDEN (Entscheidung 04 §5)
  // ================================================================================================
  //
  // Hier stand bis R1 ein gedeckelter Nachzug VOR `listForSearch`. Er war gut begründet (eine
  // Vollladung je Objekt statt zwei) und trotzdem der Träger eines Architekturfehlers: weil er nur
  // 20 Objekte je Anfrage fertigmachte, hing die Trefferliste an der Bestandsreihenfolge, und alles
  // dahinter blieb in Projektionsfassung 1 — regulär durchsuchbar. Genau diesen Mischbetrieb hat
  // BEN reproduziert.
  //
  // §5 stellt das klar: der Backfill ist Optimierung, nicht Migration und nicht Readiness, und der
  // reguläre Suchpfad darf funktional nicht von ihm abhängen. Vollständigkeit verantwortet jetzt
  // das Readiness Gate der Suchprojektion; der Altbestand wird über den ausdrücklichen Reconcile-
  // bzw. Rebuild-Weg fertig. Die Konstante SEARCH_BACKFILL_LIMIT_PER_QUERY bleibt die Schwunggröße
  // dieser Wartungsläufe.
  // ================================================================================================
  // AUFTRAG-BASIC-380 — DER TRIM WIRD DURCHGEREICHT, NICHT AUSGELEGT.
  // ================================================================================================
  //
  // WAS SICH ÄNDERT: `opts.trim` reist von der Route (Kompositionswurzel) bis in die Datenquelle
  // durch. Papierkorb- und Sichtbarkeitsprädikat wirken damit IN SQL, auf der GRUNDMENGE — vor
  // jedem Deckel, Cursor oder Zähler, den ein späterer Abfragevertrag darüber legt. Genau die
  // Doktrin, die dieser Dienst für `sichtbar` schon führt („auf die GRUNDMENGE angewandt, nicht
  // auf das Ergebnis"), nur eine Ebene tiefer.
  //
  // WAS GLEICH BLEIBT: alles andere. Reihenfolge (Bestandsreihenfolge), Filter, Body-Freiheit,
  // Treffer-Nachschlag. Und die AUTORISIERUNG bleibt, wo sie war — dieser Dienst legt die Regel
  // NICHT aus, er trägt sie nur weiter; die Route entscheidet und filtert weiterhin zusätzlich
  // (G-SHADOW: `oldAllowed ∧ newAllowed`, eine neue Regel darf Sichtbarkeit nie erweitern).
  //
  // OHNE `opts.trim` ist das Verhalten zeichengleich dem bisherigen (Altvertrag).
  async search(
    query: string,
    filter: KoFilter = {},
    opts: { trim?: KoSichtbarkeitstrim } = {},
  ): Promise<KnowledgeObject[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Leere Suchzeile = „zeig den Bestand", keine Textabfrage — unverändert. Und genau dieser
      // Weg ist der teuerste (kein Suchbegriff grenzt vorher ein), also der, an dem der Trim in
      // der Datenquelle am meisten zählt.
      return this.koService.listForSearch(filter, opts.trim);
    }
    // G27 R1 (Entscheidung 04 §5): HIER STAND DER GEDECKELTE NACHZUG — ersatzlos entfallen.
    // Der reguläre Suchpfad darf funktional nicht mehr von ihm abhängen; er ist Wartung, nicht
    // Migration und nicht Readiness. Der Altbestand wird über den ausdrücklichen Reconcile-/
    // Rebuild-Weg fertig — und eine Instanz, die überhaupt sucht, ist freigegeben und damit
    // vollständig projiziert.
    const list = await this.koService.listForSearch(filter, opts.trim);
    if (list.length === 0) {
      return [];
    }
    // JOB 2689 D1 (Befund R2-37): hier stand „BEWUSST OHNE limit". Ohne Deckel lief eine breite
    // Anfrage — und `%` war bis 2689 die breiteste, sie traf jede Zeile — über den ganzen Bestand.
    // Der Deckel ist die Zahl, die die Fläche ohnehin zeigt (LIBRARY_RESULT_LIMIT der Bibliothek,
    // 200); mehr Treffer hat die Seite nie auf einmal dargestellt. Die Datenquelle sortiert
    // validierte und vertrauenswürdige Objekte nach vorn, also bleiben die wichtigsten unter dem
    // Deckel. Was der Deckel NICHT löst: die Sichtbarkeitsnachfilterung unten kann aus 200
    // Treffern weniger machen (library-routes.ts, Kommentar zu BASIC-380) — der Deckel liegt vor
    // ihr. Das ist ausgesprochen, nicht versteckt.
    const treffer = new Map(
      (await this.koService.findSearchHits({ terms: [q], limit: LIBRARY_SEARCH_HIT_LIMIT })).map(
        (hit) => [hit.koId, hit],
      ),
    );
    const out: KnowledgeObject[] = [];
    for (const ko of list) {
      const hit = treffer.get(ko.id);
      if (!hit) {
        continue;
      }
      // WP-BILD-1e/1g: das Fußnotenfeld reist im Treffer mit — der Client kennzeichnet damit die
      // Fundstelle, ohne dass bodyHtml transportiert wird. Nach dem Backfill oben trägt die
      // geladene Projektion es bereits; fehlt es dennoch (Objekt jenseits des Deckels), wird der
      // Treffer ehrlich ohne Kennzeichnung ausgeliefert statt dafür ein zweites Mal zu laden.
      out.push(ko);
    }
    return out;
  }

  // ================================================================================================
  // AUFTRAG-mega29 C3 (bens M28-3) — WAS DIESE AUSGABE NICHT BEHAUPTET.
  // ================================================================================================
  //
  // Markdown, MediaWiki und HTML sind die Ausgaben, die ein MENSCH mitnimmt und weitergibt. Sie
  // tragen Reife, Trust und Status — aber keinerlei Aussage darüber, ob das enthaltene Wissen gegen
  // Widersprüche und Duplikate geprüft wurde. Seit dem Kandidaten-Deckel ist Schweigen an dieser
  // Stelle irreführend: wer eine gepflegte Ausgabe in der Hand hält, schließt daraus leicht, sie sei
  // in sich stimmig.
  //
  // BEWUSST NUR EIN SATZ und NICHT die volle Abdeckung: eine Ausgabe bündelt VIELE Objekte mit je
  // eigenem Lauf; eine belastbare Gesamtabdeckung wäre eine eigene Rechnung mit eigener Testfläche.
  // Der Satz behauptet deshalb gar nichts über den Umfang — er nimmt nur die Behauptung zurück, die
  // der Leser sonst selbst ergänzt. Der JSON-Export trägt das Feld ohnehin am Objekt.
  // Strukturgleich zu OUTPUT_NO_CHECK_NOTE in services/output (Modulgrenze: jede Ausgabe-Fläche
  // besitzt ihren eigenen Text, es gibt keinen geteilten Textbestand zwischen den Modulen).
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
    // AUFTRAG-mega31 BLOCK B (bens ROT-3): der Warnsatz steht VOR dem ersten Inhalt. Er stand in
    // allen vier Ausgabewegen hinter dem gesamten Dokument — bei einem langen Export liest ihn
    // dort niemand, und die Vorgabe „wo ein Leser ihn sieht" war damit nicht erfüllt. Die
    // Wiederholung am Ende bleibt (sie kostet nichts und trifft den, der von hinten liest).
    return [
      `''${EXPORT_NO_CHECK_NOTE}''`,
      items.map((ko) => `== ${ko.title} ==\n${ko.statement}`).join("\n\n"),
      `''${EXPORT_NO_CHECK_NOTE}''`,
    ].join("\n\n");
  }

  // FR-LIB-02: echtes Text-Markdown (Überschrift, Listen, Herkunfts-Fußzeile).
  async exportMarkdown(opts?: {
    ids?: readonly string[];
    includeConfidential?: boolean;
  }): Promise<string> {
    const items = await this.exportJson(opts);
    // mega31 B: Exportkopf mit dem Warnsatz, VOR dem ersten Wissensobjekt (s. exportMediaWiki).
    const body = items
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
    return `_${EXPORT_NO_CHECK_NOTE}_\n\n---\n\n${body}\n\n---\n\n_${EXPORT_NO_CHECK_NOTE}_`;
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
    // mega31 B: Titel → Warnsatz → Inhalt. HTML ist der einzige Bibliotheks-Export mit echtem
    // Kopf; der Satz sitzt direkt darunter, nicht mehr nur hinter dem letzten Artikel.
    const note = `<p class="src">${esc(EXPORT_NO_CHECK_NOTE)}</p>`;
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>KLARWERK Export</title><style>${style}</style></head><body><h1>KLARWERK — Wissensexport</h1>${note}${articles}${note}</body></html>`;
  }

  // FR-LIB-02: Import per JSON ohne Duplikate.
  //
  // AUFTRAG-mega82 Block A: `actor` ist der EINREICHENDE Nutzer (library-routes.ts übergibt
  // `user.id`) und damit der Handelnde dieses Imports — nicht mehr bloß ein „Vorgabe-Autor", der
  // einspringt, wenn das Item keinen nennt.
  //
  // JOB 3023: die Vorgabe `"import"` ist entfallen. Sie stand vor dem neuen Pflicht-Port und wäre
  // damit eine Vorgabe, die kein Aufrufer mehr auslassen KANN (`useDefaultParameterLast`) — eine
  // Vorgabe, die nie greift, ist eine Behauptung ohne Fall. Alle Aufrufer nennen ihren Handelnden
  // ohnehin ausdrücklich.
  //
  // ==============================================================================================
  // JOB 3023 — DER RE-IMPORT PRUEFT AUF DUBLETTEN, STATT ZEICHEN ZU VERGLEICHEN.
  // ==============================================================================================
  //
  // WAS FALSCH WAR: der Dublettentest war ein `seen.has()` auf `` `${title}|${statement}` ``. Ein
  // Satzpunkt am Satzende, ein anderes Leerzeichen oder eine geaenderte Gross-/Kleinschreibung
  // genuegte, damit derselbe Eintrag ein zweites Mal angelegt wurde; `conditions`, `measures`,
  // `tags` und `category` gingen gar nicht ein.
  //
  // WAS JETZT GILT — ZWEI PAESSE, EINE REGEL:
  //   1. Der `title|statement`-Schluessel bleibt als BILLIGER erster Pass fuer die exakte
  //      Zeichengleichheit (`identisch`). Er kostet einen Map-Zugriff und faengt den haeufigsten
  //      Fall — dieselbe Sicherung noch einmal eingespielt — ohne jede Rechnung ab. Er traegt
  //      jetzt die getroffene `koId` mit, damit die Antwort auch hier sagen kann, WORAUF.
  //   2. Alles darueber entscheidet die injizierte `DublettenPruefung` — die Regel, die das
  //      Produkt bereits besitzt (`coreText` + `trigramSimilarity`), verdrahtet in der
  //      Kompositionswurzel. Dieses Modul legt sie NICHT aus.
  //
  // GEGEN DEN BESTAND *UND* GEGEN DEN EIGENEN LAUF: `bestand` waechst um jedes erzeugte Objekt.
  // Eine Sicherung, die dieselbe Sache zweimal enthaelt, erzeugt sie darum nicht zweimal.
  //
  // EHRLICHE KOSTENGRENZE: der zweite Pass rechnet je NICHT exakt getroffenem Eintrag gegen den
  // ganzen Bestand (O(neu × bestand) Textvergleiche). Ein Deckel waere eine EIGENE Regel darueber,
  // welche Kandidaten wegfallen duerfen — genau das zweite Gehirn, das dieser Auftrag ausschliesst.
  // Die Wiedereinspielung, der haeufige Fall, laeuft ohnehin ueber Pass 1.
  async importJson(
    rawItems: readonly ImportItem[],
    actor: string,
    // PFLICHT, nicht optional (types.ts, DublettenPruefung): sonst duerfte ein zweiter Aufbau den
    // Schutz typgueltig weglassen.
    pruefeDublette: DublettenPruefung,
  ): Promise<ImportResult> {
    // SCRUM-515: an der Ingest-Grenze runtime-validieren (ungültig/unbekannt → vertraulich, nie intern).
    const items = rawItems.map((item) => this.withSanitizedConfidentiality(item));
    const pruefung = erzwingeDublettenpruefung(pruefeDublette);
    const existing = await this.koService.list();
    // Pass 1: exakter Schluessel → getroffenes Objekt. Der ERSTE Träger eines Schluessels gewinnt,
    // damit die genannte koId bei Altbestand-Dubletten deterministisch ist.
    const exakt = new Map<string, string>();
    for (const ko of existing) {
      const key = `${ko.title}|${ko.statement}`;
      if (!exakt.has(key)) {
        exakt.set(key, ko.id);
      }
    }
    const bestand: KnowledgeObject[] = [...existing];
    const uebersprungen: UebersprungenerImport[] = [];
    let imported = 0;
    for (const item of items) {
      const key = `${item.title}|${item.statement}`;
      const exakterTreffer = exakt.get(key);
      if (exakterTreffer !== undefined) {
        uebersprungen.push({ titel: item.title, grund: "identisch", koId: exakterTreffer });
        continue;
      }
      // FAIL-CLOSED, ausgeschrieben: scheitert die Pruefung fuer EINEN Eintrag, wird er NICHT
      // eingespielt, sondern als `pruefung_nicht_moeglich` uebersprungen. Eine unbemerkte Dublette
      // im Bestand ist teurer als ein nicht eingespielter Eintrag, den der Einspielende in der
      // Antwort sieht und erneut schicken kann. Und der Fehler bleibt LOKAL: er kippt nie den
      // ganzen Import — die uebrigen Eintraege laufen weiter.
      //
      // RUNDE 2 (bens Befund 2): der AUFRUF allein im `try` genuegte nicht — eine Pruefung, die
      // `null`/`undefined` zurueckgab, warf erst beim Auswerten und riss den ganzen Import mit
      // (`TypeError: Cannot read properties of undefined (reading 'dublette')`).
      //
      // RUNDE 3 (bens Befund): auch das PRUEFEN im `try` genuegte nicht, solange danach WEITER auf
      // das fremde Objekt zugegriffen wurde. Ein `dublette`-Getter, der beim ersten Lesen `false`
      // liefert und beim zweiten wirft, kam durch die Pruefung und kippte dann doch den ganzen
      // Import. Deshalb steht hier jetzt eine MATERIALISIERUNG: `materialisiereBefund` liest jede
      // Eigenschaft genau einmal und gibt ein EIGENES Objekt zurueck. `befund` unten ist diese
      // Kopie — das fremde Objekt wird nach dem `try` nie wieder angefasst.
      let befund: DublettenBefund;
      try {
        const eigeneEntscheidung = materialisiereBefund(pruefung(item, bestand));
        if (eigeneEntscheidung === null) {
          uebersprungen.push({ titel: item.title, grund: "pruefung_nicht_moeglich", koId: null });
          continue;
        }
        befund = eigeneEntscheidung;
      } catch {
        uebersprungen.push({ titel: item.title, grund: "pruefung_nicht_moeglich", koId: null });
        continue;
      }
      if (befund.dublette) {
        uebersprungen.push({
          titel: item.title,
          grund: "aehnlich",
          koId: befund.koId,
          aehnlichkeit: befund.aehnlichkeit,
        });
        continue;
      }
      const erzeugt = await this.koService.create({
        title: item.title,
        statement: item.statement,
        type: item.type,
        category: item.category,
        // AUFTRAG-mega82 Block A: DIESELBE ABBILDUNG WIE IM ACCEPT-PFAD (WP-SAMMEL21-FIX weiter
        // oben) — und bis mega82 war sie hier die einzige, die fehlte.
        //
        // `ko.author` ist keine Anzeige, sondern eine RECHTEPOSITION, und zwar gleich vierfach:
        // `darfSehen` öffnet ein vertrauliches Wissensobjekt für seinen Autor
        // (app/src/sichtbarkeit.ts:76), `DELETE /api/kos/:id` erlaubt ihm das Löschen
        // (app/src/routes/ko-routes.ts:1154), `KoService.create` trägt denselben String als Verfasser
        // des v1-Schnappschusses und als Akteur des `ko.created`-Belegs ein
        // (knowledge-object/src/service.ts:1254/1266), und die Rückgabe an den Autor legt ihm eine
        // Aufgabe an (validation/src/service.ts:131).
        //
        // `POST /api/library/import` verlangt nur `ko.create` und steht — anders als der
        // Kandidaten-Accept — NICHT hinter dem Import-Schalter. Ein frei gelieferter `item.author`
        // besetzte damit alle vier Positionen mit einem Namen, den nie jemand geprüft hat.
        // Der Handelnde ist der Einreichende; der Quellautor reist als `originalAuthor` weiter
        // (Wissensträger — Anzeige und busFactor, keine Autorisierung).
        author: actor,
        ...(item.author?.trim() ? { originalAuthor: item.author } : {}),
        tags: item.tags ?? [],
        // SCRUM-509 R3: JSON-Import ist ein Bulk-Pfad → konservativ „vertraulich" bei fehlendem Signal.
        confidentiality: item.confidentiality ?? "vertraulich",
      });
      exakt.set(key, erzeugt.id);
      bestand.push(erzeugt);
      imported += 1;
    }
    // `skipped` behaelt Name und Bedeutung: nicht eingespielt. Es ist die Laenge der Liste — beide
    // Zahlen koennen nicht auseinanderlaufen.
    const skipped = uebersprungen.length;
    await this.audit?.record({
      actor,
      action: "library.import",
      target: "library",
      payload: { imported, skipped },
    });
    return { imported, skipped, uebersprungen };
  }

  // FR-LIB-03: Bus-Faktor je Kategorie (Einzelquelle = nur ein Autor).
  //
  // AUFTRAG-mega76 BLOCK D: `sichtbar` ist PFLICHT und wird auf die GRUNDMENGE angewandt, nicht
  // auf das Ergebnis — sonst zählten unsichtbare Objekte in `authorCount`/`koCount` weiter mit.
  // Ein einzelnes vertrauliches KO in einer sonst leeren Kategorie erzeugte hier eine ganze Zeile
  // MIT Kategorienamen, `koCount: 1`, `authorCount: 1` und `singleSource: true` (ben, sammel72).
  async busFactor(opts: { sichtbar: KoSichtbar }): Promise<BusFactorEntry[]> {
    const list = (await this.koService.list()).filter(erzwingeSichtbar(opts?.sichtbar));
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

  // ==============================================================================================
  // AUFTRAG-mega68 — DIE NACHBARSCHAFT EINES OBJEKTS (Anwendersicht des Wissensnetzes).
  // ==============================================================================================
  //
  // WARUM NICHT graph(): der globale Graph beantwortet eine ANDERE Frage — er zeigt den ganzen
  // sichtbaren Bestand, diese Auskunft die Umgebung EINES Objekts (und nennt an jeder Kante ALLE
  // geteilten Schlagwörter, nicht eines).
  // JOB 3022: bis dahin stand hier der Grund „der globale Graph vergleicht jedes Paar — O(n²),
  // ~72 Mio. Vergleiche bei 12.000 Objekten, begrenzt erst im Browser". Das ist überholt: `graph()`
  // rechnet seit JOB 3022 über denselben Schlagwort-Index, wendet dieselbe Ubiquitätsregel an und
  // ist serverseitig gedeckelt. Der Unterschied ist seitdem der Zuschnitt, nicht die Bauart.
  // Diese Auskunft geht von EINEM Objekt aus: EIN linearer Pass über die
  // Such-Projektion (listForSearch, ohne bodyHtml), je Objekt ein Set-Lookup gegen die
  // Zentrums-Schlagwörter — O(n·t) Zeit mit t = Schlagwörter je Objekt (klein), Antwortgröße
  // O(NEIGHBOR_LIMIT). Der Bestand wird gelesen, aber nie paarweise verrechnet und nie
  // vollständig übertragen. (Ein persistenter Tag-Index wäre der nächste Schritt, wenn der eine
  // lineare Pass je Anfrage messbar drückt — heute wäre er neue Infrastruktur ohne Not.)
  //
  // DIE SCHLAGWORTREGEL (Ubiquität): ein Schlagwort, das MEHR ALS DIE HÄLFTE des Bestands trägt,
  // erzeugt keine Kante. Begründung der Schwelle: eine Kante soll behaupten „diese zwei teilen
  // etwas, das die meisten anderen NICHT teilen" — ab der Mehrheitsgrenze ist das Gegenteil wahr,
  // und die erwartete Nachbarschaft über dieses eine Schlagwort umfasst über die Hälfte des
  // Bestands (genau der Demobestands-Befund: `pilot-demo` auf allen Objekten macht den Graphen
  // vollständig). Gegen die Alternativen entschieden: eine DEKLARIERTE Liste kennte nur die
  // Täter von gestern (der nächste Import-Marker liefe wieder durch); ein ABSOLUTER Zähldeckel
  // skaliert nicht über Bestandsgrößen; eine IDF-GEWICHTUNG würde nur die Reihenfolge ändern,
  // die bedeutungslose Kante aber existieren lassen. Der absolute Boden (UBIQUITY_MIN_COUNT)
  // verhindert, dass die Anteilsstatistik in Kleinstbeständen auf Rauschen feuert: unter 5
  // Trägern ist „100 % Anteil" keine Aussage über Ubiquität, sondern über die Bestandsgröße.
  //
  // VERTRAULICHKEIT: `includeConfidential` kommt als DATUM aus der Kompositionswurzel (Route:
  // SCRUM-506-Regel, `ko.validate` sieht Vertrauliches) — dieselbe Bauart wie provenance-routes.
  // Ein herausgefilterter Nachbar existiert für den Aufrufer NICHT: er fehlt in `neighbors`,
  // in `total` und in `truncated` (alles wird NACH dem Filter gezählt).
  async neighbors(
    koId: string,
    // AUFTRAG-mega74 BLOCK F: statt eines `includeConfidential`-Schalters kommt hier die fertige
    // Entscheidung je Objekt herein. Grund: seit Variante A hängt die Sichtbarkeit auch am AUTOR,
    // und ein Boolescher Wert kann „vertraulich, aber mein eigenes" nicht ausdrücken — die Route
    // hätte die Regel sonst ein zweites Mal auslegen müssen.
    //
    // AUFTRAG-mega77 BLOCK D: `sichtbar` ist PFLICHT, und der `includeConfidential`-Schalter ist
    // ersatzlos weg. Er hatte seit mega74 KEINEN Aufrufer mehr (die Route liefert `sichtbar`), war
    // aber weiterhin die zweite, mildere Auslegung derselben Regel — wer nur ihn setzte, bekam den
    // ganzen nicht-vertraulichen Bestand ohne Autor-Ausnahme. Begründung zur Pflicht am Kopf von
    // `erzwingeSichtbar`.
    opts: { sichtbar: KoSichtbar; limit?: number },
  ): Promise<Neighborhood> {
    const sichtbar = erzwingeSichtbar(opts?.sichtbar);
    const center = await this.koService.get(koId);
    // AUFTRAG-mega74 BLOCK F: das ZENTRUM folgte bis mega74 bewusst dem offenen Hauptlesepfad
    // („die ehrliche Grenze aus mega45"). Seit Block B ist der geschlossen — also gilt hier
    // dieselbe Entscheidung, und ein unsichtbares Zentrum sieht aus wie ein fehlendes.
    if (!center || !sichtbar(center)) {
      throw new LibraryError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    const limit = opts?.limit ?? NEIGHBOR_LIMIT;
    const centerTags = new Set(center.tags);
    // EIN linearer Pass über die Such-Projektion (ohne bodyHtml): Kandidaten sammeln und dabei
    // zählen, wie viele Objekte jedes ZENTRUMS-Schlagwort tragen (inklusive des Zentrums selbst —
    // der Anteil misst den Bestand, nicht die Nachbarn).
    // AUFTRAG-mega71 Block C (bens gelber Punkt 2): für Rollen ohne erweiterte Sichtbarkeit wird
    // bereits die GRUNDMENGE auf sichtbare Objekte gefiltert — VOR carriers, vor der
    // Ubiquitätsrechnung, vor der Kandidatenbildung; eine Stelle, nicht zwei. Bis mega71 zählte
    // die Statistik verborgene Objekte mit: ein vertraulicher Träger konnte ein Zentrums-
    // Schlagwort über die Schwelle heben, damit einen SICHTBAREN Nachbarn entfernen und so
    // unsichtbaren Bestand im Verhalten erkennbar machen. Jetzt rechnet die Antwort der
    // eingeschränkten Rolle, als gäbe es nur den sichtbaren Bestand (auch `total` im
    // Anteilsnenner misst ihn) — der Filter in `visible` unten ist dadurch mit abgedeckt.
    const all = (await this.koService.listForSearch()).filter(sichtbar);
    const carriers = new Map<string, number>();
    const candidates: { ko: KnowledgeObject; shared: string[] }[] = [];
    for (const ko of all) {
      const shared = ko.tags.filter((tag) => centerTags.has(tag));
      for (const tag of shared) {
        carriers.set(tag, (carriers.get(tag) ?? 0) + 1);
      }
      if (ko.id !== center.id && shared.length > 0) {
        candidates.push({ ko, shared });
      }
    }
    const total = all.length;
    const excludedTags = [...centerTags]
      .filter((tag) => {
        const count = carriers.get(tag) ?? 0;
        return count >= UBIQUITY_MIN_COUNT && count / Math.max(total, 1) > UBIQUITY_MAX_SHARE;
      })
      .sort((a, b) => a.localeCompare(b));
    const excluded = new Set(excludedTags);
    // Der Vertraulichkeitsfilter liegt seit mega71 an der Grundmenge oben (EINE Stelle) —
    // Kandidaten stammen bereits ausschließlich aus dem sichtbaren Bestand.
    const visible = candidates
      .map((c) => ({ ko: c.ko, via: c.shared.filter((tag) => !excluded.has(tag)).sort() }))
      .filter((c) => c.via.length > 0)
      // Deterministisch: stärkste Verwandtschaft (meiste geteilte Schlagwörter) zuerst, dann
      // Titel, dann Id — gleicher Bestand ⇒ gleiche Auswahl und Reihenfolge.
      .sort(
        (a, b) =>
          b.via.length - a.via.length ||
          a.ko.title.localeCompare(b.ko.title) ||
          a.ko.id.localeCompare(b.ko.id),
      );
    const kept = visible.slice(0, limit);
    return {
      center: { id: center.id, title: center.title, status: center.status },
      neighbors: kept.map((c) => ({
        id: c.ko.id,
        title: c.ko.title,
        status: c.ko.status,
        via: c.via,
      })),
      total: visible.length,
      truncated: visible.length > kept.length,
      excludedTags,
    };
  }

  // FR-LIB-04: Graph aus gemeinsamen Tags.
  //
  // AUFTRAG-mega74 BLOCK B: der Graph gab Titel ALLER Objekte aus — er kannte die Vertraulichkeit
  // nicht einmal. An der Route ließ sich das nicht nachholen: ein Knoten ist nur noch `{id, title}`,
  // die Stufe ist dort weg, und die KANTEN hätten ein verborgenes Objekt ohnehin über die Struktur
  // verraten (zwei sichtbare Objekte, verbunden über einen unsichtbaren Dritten).
  //
  // Deshalb kommt die fertige Entscheidung als Datum herein und wirkt auf die GRUNDMENGE, bevor
  // gerechnet wird — dasselbe Vorgehen wie `neighbors` seit mega71 Block C. Der Dienst legt die
  // Regel NICHT selbst aus; er wendet sie an.
  //
  // AUFTRAG-mega77 BLOCK D: `sichtbar` ist PFLICHT. Bis mega77 stand hier `= {}` und „ohne Filter
  // bleibt das Verhalten wie bisher" — also der VOLLE Bestand mit allen Titeln. Das ist dieselbe
  // Fail-open-Klasse wie mega76 Block A, nur an einer Dienstmethode statt an einer Route.
  //
  // ----------------------------------------------------------------------------------------------
  // JOB 3022 — KANTEN ÜBER DEN SCHLAGWORT-INDEX, NICHT ÜBER PAARE.
  // ----------------------------------------------------------------------------------------------
  //
  // WAS HIER STAND UND WARUM ES WEG IST: zwei ineinandergelegte Schleifen über den ganzen Bestand,
  // je Paar ein `a.tags.find(tag => b.tags.includes(tag))`. Bei 12.000 Objekten sind das ~72 Mio.
  // Paare in EINER Antwort; gemessen 10.817 ms, und der volle Bestand (`list()`, inklusive
  // `bodyHtml`) wurde dafür durch den Speicher gezogen. Jetzt baut EIN linearer Pass den Index
  // `Schlagwort → Träger`, und Kanten entstehen nur INNERHALB einer Gruppe — der Aufwand hängt an
  // der Zahl der WIRKLICH geteilten Paare, nicht mehr an allen Paaren des Bestands.
  //
  // DIESELBE UBIQUITÄTSREGEL WIE `neighbors`, nicht eine zweite: UBIQUITY_MIN_COUNT/
  // UBIQUITY_MAX_SHARE, Begründung am Kopf von `neighbors()`. Ein Schlagwort über der Schwelle
  // erzeugt KEINE Kante (der Demobestands-Marker `pilot-demo` machte den Graphen sonst vollständig)
  // und erscheint stattdessen in `excludedTags`.
  //
  // `via` IST AB JETZT DAS LEXIKOGRAFISCH KLEINSTE geteilte, nicht-ubiquitäre Schlagwort. Vorher
  // war es das erste in `a.tags` — also von der Einfügereihenfolge des Objekts abhängig: derselbe
  // Bestand konnte zweimal verschiedene Etiketten tragen. Die PAARE sind dieselben wie vorher
  // (Gleichstandsnachweis: tests/netz-skalierung/graph-gleichstand.test.ts), nur das Etikett ist
  // jetzt stabil. Ebenso deterministisch: Knoten nach Id, Kanten nach (a, b), `a` ist die kleinere
  // der beiden Ids — ohne feste Reihenfolge wäre der Deckel unten eine Zufallsauswahl.
  //
  // DIE EHRLICHE RESTGRENZE, und WORAUF SICH DAS LEISTUNGSVERSPRECHEN BEZIEHT (JOB 3022 R3):
  // quadratisch bleibt es INNERHALB einer Gruppe. Ein Schlagwort knapp unter der Ubiquitätsschwelle
  // (bis zur Hälfte des Bestands) erzeugt weiter sehr viele Paare, und `totalEdges` zählt sie exakt,
  // also müssen sie auch entstehen. Gemessen: 999 Träger EINES Schlagworts ergeben 498.501 Kanten
  // (tests/netz-skalierung/graph-deckel-und-gruppengrenze.test.ts, Fall 2) — die Kantenzahl wächst
  // mit dem QUADRAT der Gruppengröße, nicht mit dem Bestand. Die Zusage „12.000 Objekte unter
  // 5 Sekunden" gilt deshalb ausdrücklich für die dort dokumentierte realistische Verteilung
  // (wenige Schlagwörter je Objekt, Gruppen von einigen Dutzend Trägern) und NICHT für einen
  // Bestand, in dem ein einzelnes Schlagwort knapp unter der Hälfte aller Objekte trägt. Der
  // nächste Schritt wäre derselbe wie bei `neighbors`: ein persistenter Index — heute neue
  // Infrastruktur ohne Not.
  async graph(opts: { sichtbar: KoSichtbar }): Promise<Graph> {
    // Schlanke Grundmenge (ohne bodyHtml) wie in `neighbors`: der Graph braucht nur id/title/tags.
    // Der Sichtbarkeitsfilter wirkt auf der GRUNDMENGE, bevor gerechnet wird — Träger-Zählung,
    // Ubiquitätsanteil und Zähler sehen ausschließlich den sichtbaren Bestand.
    const list = (await this.koService.listForSearch()).filter(erzwingeSichtbar(opts?.sichtbar));
    const nodes = list
      .map((ko) => ({ id: ko.id, title: ko.title }))
      .sort((a, b) => a.id.localeCompare(b.id));

    // EIN linearer Pass: Schlagwort → Träger.
    const carriers = new Map<string, KnowledgeObject[]>();
    for (const ko of list) {
      for (const tag of new Set(ko.tags)) {
        const gruppe = carriers.get(tag);
        if (gruppe) {
          gruppe.push(ko);
        } else {
          carriers.set(tag, [ko]);
        }
      }
    }
    const excludedTags = [...carriers.entries()]
      .filter(
        ([, gruppe]) =>
          gruppe.length >= UBIQUITY_MIN_COUNT &&
          gruppe.length / Math.max(list.length, 1) > UBIQUITY_MAX_SHARE,
      )
      .map(([tag]) => tag)
      .sort((a, b) => a.localeCompare(b));
    const excluded = new Set(excludedTags);

    // Je Objekt einmal: die kantenfähigen Schlagwörter aufsteigend sortiert (für „das kleinste
    // geteilte") und als Menge (für den Test „teilt b dieses Schlagwort?").
    const kantenTags = new Map<string, { sortiert: string[]; menge: Set<string> }>();
    for (const ko of list) {
      const sortiert = [...new Set(ko.tags)]
        .filter((tag) => !excluded.has(tag))
        .sort((a, b) => a.localeCompare(b));
      kantenTags.set(ko.id, { sortiert, menge: new Set(sortiert) });
    }

    // Die Gruppen durchgehen und ein Paar GENAU DANN an diesem Schlagwort ausgeben, wenn es das
    // kleinste ist, das beide teilen. Das ist die Entdopplung und die `via`-Regel in einem Schritt:
    // ein Paar, das zwei Schlagwörter teilt, wird zweimal besucht und nur einmal ausgegeben — ohne
    // Merkliste gesehener Paare. Die ausgegebenen Kanten stehen bis zur Sortierung vollständig im
    // Speicher, denn `totalEdges` ist eine EXAKTE Zahl und der Deckel greift erst NACH der
    // deterministischen Reihenfolge; eine früher abbrechende Auswahl wäre eine zufällige.
    const kantenTagsSortiert = [...carriers.keys()]
      .filter((tag) => !excluded.has(tag))
      .sort((a, b) => a.localeCompare(b));
    const edges: GraphEdge[] = [];
    for (const tag of kantenTagsSortiert) {
      const gruppe = carriers.get(tag) ?? [];
      for (let i = 0; i < gruppe.length; i += 1) {
        for (let j = i + 1; j < gruppe.length; j += 1) {
          const links = gruppe[i];
          const rechts = gruppe[j];
          if (!links || !rechts) {
            continue;
          }
          const vorne = links.id.localeCompare(rechts.id) <= 0;
          const a = vorne ? links : rechts;
          const b = vorne ? rechts : links;
          const bTags = kantenTags.get(b.id);
          const kleinstes = kantenTags
            .get(a.id)
            ?.sortiert.find((kandidat) => bTags?.menge.has(kandidat));
          if (kleinstes === tag) {
            edges.push({ a: a.id, b: b.id, via: tag });
          }
        }
      }
    }
    edges.sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

    return {
      nodes,
      edges: edges.slice(0, GRAPH_EDGE_LIMIT),
      totalEdges: edges.length,
      truncated: edges.length > GRAPH_EDGE_LIMIT,
      edgeLimit: GRAPH_EDGE_LIMIT,
      excludedTags,
    };
  }

  // FR-ANA-01: Bestände nach Status / Art / Kategorie.
  //
  // AUFTRAG-mega76 BLOCK D: `sichtbar` ist PFLICHT. `total + 1` sowie je ein erhöhter Status-,
  // Typ- und Kategorie-Bucket verrieten die Existenz eines vertraulichen Objekts; bei einer nur
  // vertraulich belegten Kategorie nannte die Antwort sogar den Kategorienamen.
  async analytics(opts: { sichtbar: KoSichtbar }): Promise<Analytics> {
    const list = (await this.koService.list()).filter(erzwingeSichtbar(opts?.sichtbar));
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
