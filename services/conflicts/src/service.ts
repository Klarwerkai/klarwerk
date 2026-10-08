import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { TxContext } from "../../db-tx";
import { type ComparisonJudgement, type DetectionCoverage, comparisonOutcome } from "./coverage";
import {
  type ConflictVerdict,
  type DetectSubject,
  type GeltungsKollisionsRegel,
  autoDescription,
  coreText,
  decideFromVerdict,
  selectCandidates,
  vorschlagAusUrteil,
} from "./detect";
import {
  type ConflictMemoryRepo,
  type PairMemoryEntry,
  type PairMemoryOutcome,
  memoryKey,
  pruefstand,
} from "./pair-memory";
import type { ConflictRepo } from "./repo";
import {
  type Conflict,
  type ConflictDetector,
  ConflictError,
  type ConflictInput,
  type ConflictResolutionReason,
  type ConflictType,
  type ConflictWorkKind,
  type KonfliktVorrang,
  type VorrangWahl,
  isConflictWorkKind,
} from "./types";
import {
  type CurrentVersionLookup,
  cachedCurrentVersions,
  isBoundToCurrentVersions,
} from "./version-guard";

// SCRUM-491: Ergebnis-Form des side-effect-freien Dry-Runs (assessAgainstPool). Muster wie
// DryRunOverlap; Konflikterkennung ist rein modellgetrieben (ohne judge keine Kandidaten).
export interface DryRunConflict {
  koId: string;
  koTitle: string;
  type: ConflictType;
  method: "model";
  confidence?: number;
  rationale?: string;
  snippet?: string; // Reserve (Slice 5/6), symmetrisch zu DryRunOverlap.
}

export interface ConflictServiceDeps {
  repo: ConflictRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): Versions-Autorität für die fail-closed Lesepfade
  // (unresolved() UND get()/Detail-Route — gemeinsamer Helfer version-guard). Der App-Root bindet
  // sie an den KO-Store (conflicts kennt knowledge-object nicht). Ohne Verdrahtung bleibt das
  // Bestandsverhalten (kein Filter — reine Statusprüfung).
  currentVersion?: CurrentVersionLookup;
  // D-AISTATE PAKET 4 (bens fix5-Recheck §4, aistate-fix6): belastbarer Fehlerkanal für den Lese-GC.
  // Schlägt der superseded-Audit NACH einem gewinnenden CAS-Abschluss fehl, wird der Fehler hierüber
  // SICHTBAR gemeldet (nie kommentarlos verschluckt — sonst bliebe der Datensatz geschlossen ohne
  // Audit still). Default: console.error. Der Read bleibt entkoppelt (fire-and-forget/Makrotask).
  onError?: (context: string, error: unknown) => void;
  // Aufnahme 20260922 · Prüfung-Gedächtnis (R-1103/R-1105): je Paar der zuletzt beurteilte
  // Textstand (pair-memory.ts). Ohne Verdrahtung bleibt nur die Versions-Rückfallregel für
  // menschlich geschlossene Befunde (menschlichAbgeschlossen).
  memory?: ConflictMemoryRepo;
}

// Prompt-Fassung der Konfliktprüfung — Teil des gemerkten Stands: ein Prompt-Bump prüft neu.
const PROMPT_VERSION = "kon-v1";

// Menschliche Abschlüsse, die für den damaligen Inhaltsstand gelten (R-1105). Systemische Enden
// (superseded, participant_deleted) unterdrücken nichts.
const MENSCHLICHE_ABSCHLUESSE = new Set<ConflictResolutionReason>(["dismissed", "decided"]);

// Aufnahme gesamt-auditprotokoll:aktionsabdeckung · R-0733: eine menschliche Entscheidung über
// einen Konflikt steht mit ihrem AUSGANG im Protokoll (entschieden / Fehlalarm) und mit den beiden
// beteiligten Objekten (R-0766) — nicht nur als „es wurde entschieden". Der Begründungstext bleibt
// am Konflikt (`decision`, `decidedBy`); in die unlöschbare Kette wandert kein Freitext.
function entscheidungsBeleg(
  conflict: Conflict,
  resolutionReason: ConflictResolutionReason,
): Record<string, unknown> {
  return { koIds: [conflict.koA, conflict.koB], resolutionReason };
}

/**
 * R-0263: die Wahl des Menschen gegen GENAU diesen Konflikt prüfen und als Beziehung ablegen.
 * `gilt` muss eine der beiden Seiten sein — ein Vorrang über einen dritten Punkt oder ein ganzes
 * Dokument ist nicht ausdrückbar. Eine Präzisierung ohne Geltungsbereich wäre ein Überstimmen unter
 * falschem Namen und wird abgewiesen.
 */
function vorrangAus(conflict: Conflict, wahl: VorrangWahl): KonfliktVorrang {
  if (wahl.gilt !== conflict.koA && wahl.gilt !== conflict.koB) {
    throw new ConflictError(
      "VALIDATION",
      "Vorrang kann nur einer der beiden beteiligten Aussagen gegeben werden.",
    );
  }
  const geltungsbereich = (wahl.geltungsbereich ?? "").trim();
  if (wahl.art === "schraenkt_ein" && geltungsbereich.length === 0) {
    throw new ConflictError(
      "VALIDATION",
      "Eine Präzisierung braucht den Geltungsbereich, in dem die speziellere Aussage gilt.",
    );
  }
  return {
    art: wahl.art,
    vorrangKo: wahl.gilt,
    nachrangKo: wahl.gilt === conflict.koA ? conflict.koB : conflict.koA,
    geltungsbereich: wahl.art === "schraenkt_ein" ? geltungsbereich : null,
  };
}

export class ConflictService {
  private readonly repo: ConflictRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly currentVersion: CurrentVersionLookup | undefined;
  private readonly onError: (context: string, error: unknown) => void;
  private readonly memory: ConflictMemoryRepo | undefined;

  constructor(deps: ConflictServiceDeps) {
    this.repo = deps.repo;
    this.memory = deps.memory;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.currentVersion = deps.currentVersion;
    this.onError =
      deps.onError ??
      ((context, error) => {
        // R-0623: nur die Fehlerklasse — Meldung und Stack können Inhalte tragen.
        console.error(`[conflicts] ${context}: ${error instanceof Error ? error.name : "unknown"}`);
      });
  }

  // FR-CON-01: Widerspruch erzeugt einen klassifizierten Konflikt, kein stilles Überschreiben.
  // Berater-Konzept 04.07. (Stufe 4): manuell angelegte Konflikte tragen origin="manual".
  async create(input: ConflictInput, actor = "system"): Promise<Conflict> {
    const conflict: Conflict = {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      type: input.type,
      // R-0252: die ausdrücklich gewählte Arbeitsart — nur wenn ein Mensch sie gewählt hat.
      ...(input.arbeitsart !== undefined ? { arbeitsart: input.arbeitsart } : {}),
      description: input.description,
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      origin: "manual",
      // mega26 Block B: der Behauptende steht jetzt AM DATENSATZ, nicht nur im Audit. Es ist
      // exakt derselbe `actor`, den die Zeile darunter protokolliert — keine zweite Quelle,
      // keine abweichende Ableitung.
      createdBy: actor,
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.repo.insert(conflict);
    // R-0766: der Beleg nennt die beiden beteiligten Wissensobjekte — damit die Herkunftskette am
    // Objekt den Konflikt und seine Folgeereignisse (Ziel = Konflikt-Id) zuordnen kann.
    await this.audit?.record({
      actor,
      action: "conflict.created",
      target: conflict.id,
      payload: { koIds: [conflict.koA, conflict.koB] },
    });
    return conflict;
  }

  // Berater-Konzept 04.07. (Stufe 4): automatisch erkannter Konflikt — origin="auto" + detector-
  // Metadaten (Begründung, Zitate, Sicherheit). Eigenes Audit-Vokabular „conflict.auto-created".
  async createAuto(
    input: ConflictInput,
    detector: ConflictDetector,
    actor = "system",
  ): Promise<Conflict> {
    const conflict = this.buildAuto(input, detector);
    await this.repo.insert(conflict);
    await this.recordAutoCreated(conflict, detector, actor);
    return conflict;
  }

  // Baut die auto-Entität OHNE Persistenz — gemeinsame Grundlage für createAuto (ungebunden) und
  // createAutoVersionBound (versions-konditionaler Insert gegen den bereits committeten Stand, NICHT
  // gegen ein Revisions-Interleaving serialisiert — volle Schreib-Serialisierung ist Post-VIP).
  private buildAuto(input: ConflictInput, detector: ConflictDetector): Conflict {
    return {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      type: input.type,
      description: input.description,
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      origin: "auto",
      // R-0252: die Einordnung der Erkennung (version bei „ueberholt", sonst das Modellurteil).
      ...(input.arbeitsart !== undefined ? { arbeitsart: input.arbeitsart } : {}),
      detector,
      // D-AISTATE PAKET 4 (bens V5): geprüfte Versionen additiv mitschreiben (nur wenn vorhanden).
      ...(input.koAVersion !== undefined ? { koAVersion: input.koAVersion } : {}),
      ...(input.koBVersion !== undefined ? { koBVersion: input.koBVersion } : {}),
      createdAt: new Date(this.now()).toISOString(),
    };
  }

  private async recordAutoCreated(
    conflict: Conflict,
    detector: ConflictDetector,
    actor: string,
  ): Promise<void> {
    await this.audit?.record({
      actor,
      action: "conflict.auto-created",
      target: conflict.id,
      payload: {
        trigger: detector.trigger,
        method: detector.method,
        // R-0766: wie bei `conflict.created` — die beteiligten Objekte stehen im Beleg.
        koIds: [conflict.koA, conflict.koB],
      },
    });
  }

  // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch". Ein Mensch schließt den
  // (meist automatisch erkannten) Konflikt bewusst als falsch-positiv. Kein Auto-Effekt an den KOs.
  async dismiss(id: string, by: string, note?: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({
      ...conflict,
      status: "geloest",
      decidedBy: by,
      decision: note ?? null,
      resolutionReason: "dismissed",
    });
    await this.audit?.record({
      actor: by,
      action: "conflict.dismissed",
      target: id,
      payload: entscheidungsBeleg(conflict, "dismissed"),
    });
    // R-1105: derselbe Vorschlag kommt nicht wieder, solange sich die Inhalte nicht ändern.
    await this.merkeAbschluss(conflict, "dismissed");
    return saved;
  }

  // FR-CON-02: nur Wahrheitskonflikte eskalieren an einen Menschen.
  async escalate(id: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.type !== "truth") {
      throw new ConflictError(
        "NOT_ESCALATABLE",
        "Nur Wahrheitskonflikte werden an einen Menschen eskaliert.",
      );
    }
    const saved = await this.save({ ...conflict, status: "eskaliert" });
    await this.audit?.record({
      actor,
      action: "conflict.escalated",
      target: id,
      payload: { koIds: [conflict.koA, conflict.koB] },
    });
    return saved;
  }

  // R-0252 (Nacharbeit 5, Ben): der EINORDNUNGSWEG. Ein Konflikt ohne Arbeitsart (Altbestand, die
  // widersprechende Ablehnung R-0238, oder ein Befund, den die Prüfung nicht eingeordnet hat) wird
  // von einer befugten Person als Regel-, Sach- oder Versionskonflikt eingeordnet. Die Einordnung
  // wird gespeichert und protokolliert; danach bietet die Konfliktseite die passenden Aktionen an.
  // Nur an nicht gelösten Konflikten; eine vorhandene Einordnung darf korrigiert werden — die
  // Prüfung kann sich irren, die Person ordnet ein.
  async einordnen(id: string, arbeitsart: ConflictWorkKind, actor = "system"): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    if (!isConflictWorkKind(arbeitsart)) {
      throw new ConflictError("VALIDATION", "Arbeitsart muss regel, sache oder version sein.");
    }
    const saved = await this.save({ ...conflict, arbeitsart });
    await this.audit?.record({
      actor,
      action: "conflict.classified",
      target: id,
      payload: { koIds: [conflict.koA, conflict.koB], arbeitsart },
    });
    return saved;
  }

  // FR-CON-03: Zweitmeinung als Zwischenschritt — beim Wahrheitskonflikt erst NACH der Eskalation.
  async secondOpinion(id: string, opinion: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    this.requireEscalatedIfTruth(conflict);
    const saved = await this.save({ ...conflict, status: "zweitmeinung", secondOpinion: opinion });
    await this.audit?.record({ actor, action: "conflict.second-opinion", target: id });
    return saved;
  }

  // FR-CON-03: Controller-Entscheidung schließt den Konflikt ab.
  //
  // R-0215 / R-1714 (Nacharbeit 2, Ben): der Eskalationspfad des Wahrheitskonflikts ist VERBINDLICH.
  // Ein offener Wahrheitskonflikt wird nicht entschieden, bevor er an einen Menschen eskaliert ist
  // (Eskalation → ggf. Zweitmeinung → Entscheidung). Die übrigen vier Arten lösen keine Eskalation
  // aus und werden unverändert direkt entschieden.
  //
  // R-0263: `vorrang` legt fest, welcher der ZWEI beteiligten Punkte gilt bzw. einschränkt. Er wirkt
  // nur zwischen diesen beiden — kein Objekt, kein Dokument, keine Quelle wird verändert.
  async resolve(
    id: string,
    decidedBy: string,
    decision: string,
    vorrang?: VorrangWahl,
  ): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    this.requireEscalatedIfTruth(conflict);
    const abgelegt = vorrang ? vorrangAus(conflict, vorrang) : undefined;
    // Ein früherer Vorrang (erneut eskalierter Befund) gilt nicht weiter, wenn die neue Entscheidung
    // keinen festlegt — „Beide gelten" heisst: kein Vorrang.
    const { vorrang: _frueher, ...ohneVorrang } = conflict;
    const saved = await this.save({
      ...ohneVorrang,
      status: "geloest",
      decidedBy,
      decision,
      resolutionReason: "decided",
      ...(abgelegt ? { vorrang: abgelegt } : {}),
    });
    await this.audit?.record({
      actor: decidedBy,
      action: "conflict.resolved",
      target: id,
      payload: entscheidungsBeleg(conflict, "decided"),
    });
    await this.merkeAbschluss(conflict, "decided");
    return saved;
  }

  // R-1103/R-1105: der menschliche Abschluss gilt für den Stand, unter dem der Befund erkannt wurde —
  // nur wenn das Gedächtnis genau diesen Befund führt (manuelle Konflikte haben keinen Stand).
  // Best-effort: die Entscheidung ist gespeichert und protokolliert; ein Gedächtnisfehler wird
  // sichtbar gemeldet, kippt sie aber nicht.
  private async merkeAbschluss(
    conflict: Conflict,
    outcome: Extract<PairMemoryOutcome, "dismissed" | "decided">,
  ): Promise<void> {
    if (!this.memory) {
      return;
    }
    try {
      const [entry] = await this.memory.find([memoryKey(conflict.koA, conflict.koB)]);
      if (!entry || entry.conflictId !== conflict.id) {
        return;
      }
      await this.memory.put({ ...entry, outcome, at: new Date(this.now()).toISOString() });
    } catch (error) {
      this.onError(`Prüfgedächtnis ${outcome} (${conflict.id})`, error);
    }
  }

  // Konzept 04.07. (Stufe 1) — Geister-Bug: Wird ein beteiligtes Wissensobjekt gelöscht, darf sein
  // Konflikt nicht als „Objekt nicht gefunden" offen hängen bleiben. Alle OFFENEN Konflikte, die
  // dieses KO referenzieren, werden geordnet beendet (participant_deleted) und protokolliert —
  // OHNE Status/Trust des verbleibenden KO automatisch zu ändern (kein stilles Überschreiben).
  // Idempotent: bereits gelöste Konflikte bleiben unberührt. Gibt die Anzahl beendeter Konflikte.
  //
  // JOB 3066 — DER OPTIONALE tx UND DIE MENGENBASIERTE FORM, wortgleich begründet wie in
  // OverlapService.onKoRemoved: dies ist der EINZIGE Weg dieses Dienstes, der Teil eines fremden
  // Vorgangs ist (KoService.purgeKo). Mit Kontext committen Löschung, Beleg und das Beenden der
  // Konflikte gemeinsam — oder gar nicht. Er geht an JEDEN Schritt dieses Weges (Schliessen, beide
  // Belege); jeder andere Weg des Dienstes bleibt ohne tx.
  // Das Schliessen ist EINE mengenbasierte Anweisung (`closeOpenForKo`), die die beendeten
  // Konflikte zurückgibt — keine Schleife über Einzelobjekte im gehaltenen Transaktionskörper
  // (PurgeTxCleanup-Vertrag, knowledge-object/src/service.ts:248-255). Obergrenze 1 + 2m mit
  // m = offene Konflikte dieses Beitrags (je einer zwei Belege). Warum die Belege einzeln bleiben,
  // steht ausgeschrieben in OverlapService.onKoRemoved.
  async onKoRemoved(koId: string, actor = "system", tx?: TxContext): Promise<number> {
    const beendet = await this.repo.closeOpenForKo(
      koId,
      { status: "geloest", decidedBy: null, resolutionReason: "participant_deleted" },
      tx,
    );
    for (const c of beendet) {
      await this.audit?.record(
        {
          actor,
          action: "conflict.participant-removed",
          target: c.id,
          payload: { koId },
        },
        tx,
      );
      await this.audit?.record(
        {
          actor,
          action: "conflict.auto-resolved",
          target: c.id,
          payload: { reason: "participant_deleted" },
        },
        tx,
      );
    }
    return beendet.length;
  }

  // Berater-Konzept 04.07. (Stufe 2/3): automatische Erkennung für EINEN Beitrag gegen einen bereits
  // geladenen Kandidaten-Pool. Modul-rein — KEIN knowledge-object-Import: der Aufrufer (App-Root)
  // reicht Kerntext-Subjekte + einen judge-Callback (Reasoner „Konfliktprüfung"). Legt je erkanntem
  // Widerspruch EINEN Konflikt an (origin: automatisch, ehrliche Beschreibung mit Begründung) und ist
  // idempotent gegen bereits offene Konflikte desselben Paars — G-2-Zitatprüfung sitzt in
  // decideFromVerdict (kein Konflikt aus Modell-Halluzination). Gibt die neu angelegten Konflikte.
  async detectForSubject(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    // D-AISTATE PAKET 1 (bens V1): der judge bekommt die restriktivste PAAR-Vertraulichkeit — der
    // Reasoner nimmt bei `true` die Cloud aus der Kette (kein Egress vertraulichen Textes).
    judge: (
      coreA: string,
      coreB: string,
      confidential: boolean,
    ) => Promise<ConflictVerdict | null | ComparisonJudgement<ConflictVerdict>>,
    // D-AISTATE PAKET 4 (bens V5): `isCurrent` prüft vor dem Persistieren, ob beide gebundenen KO-
    // Versionen noch aktuell sind (Stale-Schreibschutz gegen den revise-Race).
    //
    // AUFTRAG-mega28 A1/A4 (Pedi 26.07.): `cap` ist im LIVE-Pfad wieder scharf. Bis mega27 stand
    // dort ausdrücklich Number.POSITIVE_INFINITY („bens V2: KEIN stiller Cap 8 im Live-Pfad") —
    // diese Festlegung ist zurückgenommen. Grund: bei 12.480 Objekten kostete EIN Submit bis zu
    // 12.479 Konflikt-Urteile, und nichts brach das ab. Der Aufrufer setzt den Wert (App-Root,
    // EIN Wert für Konflikt- UND Duplikatweg); die Vorauswahl selbst (selectCandidates) ist
    // deterministisch (Score, refId als Stichentscheid) und begründet (fachliche Nachbarschaft +
    // Textnähe — dasselbe Maß, das der Weg ohnehin berechnet).
    // `coverage` (A2/A3) ist das vom Aufrufer gestellte, hier FORTGESCHRIEBENE Protokoll: wie viele
    // Kandidaten standen zur Wahl, wie viele wurden vorgelegt, wurde gedeckelt, wurde übersprungen.
    options: {
      cap?: number;
      minConfidence?: number;
      actor?: string;
      modelLabel?: string;
      isCurrent?: (koId: string, version: number) => boolean | Promise<boolean>;
      coverage?: DetectionCoverage;
      // AUFNAHME 20260922 · R-1124: true = ohne fachlichen Vorfilter (jedes Bestandsobjekt ist
      // Kandidat). Zusammen mit `cap = ∞` der gewählte Vollabgleich; ohne Angabe wie bisher.
      vollabgleich?: boolean;
      // R-1632 / R-1633: geben BEIDE Seiten eine Geltung an und liegt sie verschieden, ist ein
      // erkannter Widerspruch ein Kontext- bzw. Rollenkonflikt statt eines Wahrheitskonflikts
      // (Regel in knowledge-object `geltungsKollision`). Ohne Regel: Bestandsverhalten.
      geltungsKollision?: GeltungsKollisionsRegel;
    } = {},
  ): Promise<Conflict[]> {
    // AUFTRAG-mega29 B2 (bens M28-2): der Deckel begrenzt, was GEPRÜFT wird — nicht, was
    // übersprungen wird. Deshalb wird hier die VOLLE (fachlich vorgefilterte, deterministisch
    // sortierte) Liste geholt und der Deckel erst in der Schleife über die tatsächlichen Vergleiche
    // gezogen. Ein Paar mit bereits offenem Befund kostet damit nur seinen Rang, keinen Prüfplatz.
    const cap = options.cap ?? 8;
    const ranked = selectCandidates(
      subject,
      pool,
      Number.POSITIVE_INFINITY,
      options.vollabgleich !== true,
    );
    const coverage = options.coverage;
    if (coverage) {
      coverage.available = pool.filter((c) => c.refId !== subject.refId).length;
    }
    if (ranked.length === 0) {
      return [];
    }
    const alle = await this.repo.all();
    const open = alle.filter((c) => c.status !== "geloest");
    // D-AISTATE PAKET 4 (bens V5): Paar-Dedupe nur für die AKTUELLE Versionskombination. Ein Befund zu
    // einer inzwischen revidierten Fassung (stale) blockt den neuen Lauf NICHT. Altbestand ohne
    // Versionsfelder (oder ein versionsloser Lauf) blockt konservativ wie bisher.
    const hasOpenPair = (aId: string, bId: string, aVer?: number, bVer?: number): boolean =>
      open.some((c) => {
        const sameIds = (c.koA === aId && c.koB === bId) || (c.koA === bId && c.koB === aId);
        if (!sameIds) {
          return false;
        }
        if (c.koAVersion === undefined && c.koBVersion === undefined) {
          return true; // Altbestand-Eintrag → wie bisher blocken
        }
        if (aVer === undefined || bVer === undefined) {
          return true; // versionsloser Lauf → konservativ blocken
        }
        const verFor = (koId: string): number | undefined =>
          c.koA === koId ? c.koAVersion : c.koBVersion;
        return verFor(aId) === aVer && verFor(bId) === bVer;
      });
    // R-1105, Rückfall ohne gemerkten Stand (Befunde von vor dem Gedächtnis): ein MENSCHLICH
    // geschlossener Befund zu GENAU den aktuellen Versionen beider Seiten gilt weiter — die Fassung
    // ändert sich mit jedem Inhalt. Ohne Versionsbindung greift die Regel nicht (kein Stand belegt).
    const menschlichAbgeschlossen = (
      aId: string,
      bId: string,
      aVer?: number,
      bVer?: number,
    ): boolean =>
      aVer !== undefined &&
      bVer !== undefined &&
      alle.some((c) => {
        if (
          c.status !== "geloest" ||
          c.resolutionReason === undefined ||
          !MENSCHLICHE_ABSCHLUESSE.has(c.resolutionReason)
        ) {
          return false;
        }
        const verFor = (koId: string): number | undefined =>
          c.koA === koId ? c.koAVersion : c.koB === koId ? c.koBVersion : undefined;
        return verFor(aId) === aVer && verFor(bId) === bVer;
      });
    const subjectCore = coreText(subject);
    // R-1103: das Gedächtnis aller Paare dieses Laufs in EINEM Abruf.
    const gemerkt = await this.gemerkteStaende(
      ranked.map((c) => memoryKey(subject.refId, c.refId)),
    );
    const created: Conflict[] = [];
    // AUFTRAG-mega29 B1: getrennte Begriffe (s. coverage.ts). `attempted` ist die einzige Zahl, die
    // der Deckel trifft; `selected` sagt, wie viele Ränge der Lauf überhaupt angesehen hat.
    let selected = 0;
    let alreadyOpen = 0;
    let attempted = 0;
    let completed = 0;
    let skipped = 0;
    const writeCoverage = (): void => {
      if (!coverage) {
        return;
      }
      coverage.selected = selected;
      coverage.alreadyOpen = alreadyOpen;
      coverage.attempted = attempted;
      coverage.completed = completed;
      coverage.skipped = skipped;
      // AUFTRAG-mega28 A2: „gedeckelt" meint hier ehrlich JEDE Verengung gegenüber dem Bestand —
      // der Deckel UND die fachliche Vorauswahl (Nachbarschaft/Textnähe), die es hier immer schon
      // gab und die nie jemand ausgewiesen hat. Der Leser fragt „wurde alles angesehen?".
      coverage.capped = selected < coverage.available;
    };
    writeCoverage();
    for (const cand of ranked) {
      if (attempted >= cap) {
        break; // Deckel erreicht — alles ab hier blieb ungeprüft und wird auch nicht behauptet.
      }
      selected += 1;
      const candCore = coreText(cand);
      const confidential = Boolean(subject.confidential) || Boolean(cand.confidential);
      const key = memoryKey(subject.refId, cand.refId);
      const stand = pruefstand(
        { refId: subject.refId, core: subjectCore },
        { refId: cand.refId, core: candCore },
        PROMPT_VERSION,
        confidential,
      );
      const eintrag = gemerkt.get(key);
      // R-1103/R-1105: offener Befund, gleicher bereits beurteilter Textstand oder menschlich
      // geschlossener Befund zur selben Fassung — kein neuer Fall, kein erneuter KI-Aufruf. Gezählt
      // wie ein offener Befund: angesehen (selected), nicht vorgelegt (attempted), kein Deckelplatz.
      if (
        hasOpenPair(subject.refId, cand.refId, subject.version, cand.version) ||
        (eintrag !== undefined && eintrag.stand === stand && eintrag.outcome !== "created") ||
        menschlichAbgeschlossen(subject.refId, cand.refId, subject.version, cand.version)
      ) {
        alreadyOpen += 1;
        writeCoverage();
        continue;
      }
      attempted += 1;
      writeCoverage();
      let result: ConflictVerdict | null | ComparisonJudgement<ConflictVerdict>;
      try {
        result = await judge(subjectCore, candCore, confidential);
      } catch {
        // Ein Modellfehler darf die Erkennung (und das Einreichen) nie kippen — aber er darf seit
        // AUFTRAG-mega28 A3 auch nicht mehr unsichtbar bleiben: bens JR-2 fand genau hier den
        // Teilausfall, der wie ein sauberer Lauf aussah. Der übersprungene Kandidat wird gezählt.
        result = null;
      }
      // AUFTRAG-mega31 A1 (bens ROT-1): NICHT „normal zurückgekehrt" zählt, sondern „hat geurteilt".
      // Ein 429/no-model/confidential/Parsefehler kommt aus dem Reasoner als `null` zurück, nicht als
      // Wurf — der stand hier bisher als fehlerfrei abgeschlossener Vergleich. Die Regel wohnt in
      // coverage.ts, damit beide Wege sie nicht getrennt auslegen.
      const outcome = comparisonOutcome<ConflictVerdict>(result);
      if (outcome.status === "skipped") {
        skipped += 1;
        if (coverage) {
          coverage.skippedReasons ??= {};
          const reasons = coverage.skippedReasons;
          reasons[outcome.reason] = (reasons[outcome.reason] ?? 0) + 1;
        }
        writeCoverage();
        continue;
      }
      const verdict = outcome.verdict;
      completed += 1;
      writeCoverage();
      const decision = decideFromVerdict(verdict, subjectCore, candCore, options.minConfidence);
      if (!decision.create || decision.type === null) {
        // Ein gültiges Urteil ohne Befund wird gemerkt. Eine verworfene Modellantwort (Zitat nicht
        // wörtlich) ist kein Urteil über den Stand — das Paar bleibt prüfbar.
        if (decision.reason !== "hallucination") {
          await this.merkeStand(key, stand, "none");
        }
        continue;
      }
      // Stufe 4: Herkunfts-/Erkennungs-Metadaten mitschreiben (Board zeigt „Automatisch erkannt ·
      // Sicherheit % · Begründung + Zitate"). modelLabel optional (vom Aufrufer, sonst weglassen).
      const vorschlag = vorschlagAusUrteil(verdict, subject.refId, cand.refId);
      const detector: ConflictDetector = {
        trigger: "validation",
        method: "model",
        promptVersion: PROMPT_VERSION,
        confidence: verdict.confidence,
        rationale: verdict.begruendung,
        quotes: { a: verdict.zitat_a, b: verdict.zitat_b },
        ...(options.modelLabel ? { modelLabel: options.modelLabel } : {}),
        // SCRUM-492: strukturierte Kollisionsfelder mitschreiben (Board-Kacheln), wenn vorhanden.
        ...(verdict.kollision ? { kollision: verdict.kollision } : {}),
        // R-0263: Klaras Vorschlag Widerspruch/Präzisierung, auf die zwei Punkte abgebildet.
        ...(vorschlag ? { vorschlag } : {}),
      };
      // R-1632 / R-1633: ein Widerspruch zweier Punkte mit VERSCHIEDENER Geltung ist ein
      // Kontext- (anderer Ort) bzw. Rollenkonflikt (gleicher Ort, andere Rolle) — beide Aussagen
      // können in ihrem Bereich gelten. Die Beschreibung nennt beide Geltungen. Nur „truth" wird
      // umgeordnet; ein Versionskonflikt („ueberholt") bleibt, was er ist.
      const kollision =
        decision.type === "truth"
          ? (options.geltungsKollision?.(subject.geltung, cand.geltung) ?? null)
          : null;
      // D-AISTATE PAKET 4 (bens V5, aistate-fix5): versions-konditionale Aktivierung — Umfang und
      // ehrliche Grenze der Absicherung s. createAutoVersionBound.
      const conflict = await this.createAutoVersionBound(
        {
          koA: subject.refId,
          koB: cand.refId,
          type: kollision ? kollision.art : decision.type,
          // R-0252: unabhängig von `type` eingeordnet (detect.ts `arbeitsartAusUrteil`).
          ...(decision.arbeitsart ? { arbeitsart: decision.arbeitsart } : {}),
          description: kollision
            ? `${autoDescription(verdict)} ${kollision.vermerk}`
            : autoDescription(verdict),
          ...(subject.version !== undefined ? { koAVersion: subject.version } : {}),
          ...(cand.version !== undefined ? { koBVersion: cand.version } : {}),
        },
        detector,
        options.actor ?? "system",
        options.isCurrent,
      );
      if (!conflict) {
        continue; // stale — Befund zur alten Fassung wurde nicht aktiviert (bzw. sofort geschlossen)
      }
      created.push(conflict);
      open.push(conflict); // im selben Lauf kein zweiter Konflikt für dasselbe Paar
      await this.merkeStand(key, stand, "created", conflict.id);
    }
    return created;
  }

  // Gedächtnisfehler kippen die Erkennung nie: ohne Gedächtnis wird geprüft wie bisher (sichtbar
  // gemeldet), ein fehlgeschlagenes Merken kostet höchstens einen späteren erneuten KI-Aufruf.
  private async gemerkteStaende(keys: string[]): Promise<Map<string, PairMemoryEntry>> {
    const map = new Map<string, PairMemoryEntry>();
    if (!this.memory) {
      return map;
    }
    try {
      for (const entry of await this.memory.find(keys)) {
        map.set(entry.pairKey, entry);
      }
    } catch (error) {
      this.onError("Prüfgedächtnis lesen", error);
    }
    return map;
  }

  private async merkeStand(
    pairKey: string,
    stand: string,
    outcome: PairMemoryOutcome,
    conflictId?: string,
  ): Promise<void> {
    if (!this.memory) {
      return;
    }
    try {
      await this.memory.put({
        pairKey,
        stand,
        outcome,
        ...(conflictId !== undefined ? { conflictId } : {}),
        at: new Date(this.now()).toISOString(),
      });
    } catch (error) {
      this.onError(`Prüfgedächtnis merken (${pairKey})`, error);
    }
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): VERSIONS-KONDITIONALE Aktivierung eines
  // automatischen Befunds. repo.insertIfVersionsCurrent legt den Datensatz nur an, wenn beide
  // gebundenen KO-Versionen zum Prüfzeitpunkt noch aktuell sind — das schließt den Fall eines
  // bereits VOR der Prüfung committeten neuen Standes (dann entsteht kein Datensatz; das Audit
  // läuft erst NACH der Anlage, ein hängendes/fehlschlagendes Audit erzeugt also keinen Befund,
  // der sonst nicht entstanden wäre — kein Insert-dann-Kompensieren mehr).
  // EHRLICHE GRENZE (bens ROT 1, Pedi D-V5=b): gegen ein GLEICHZEITIGES Revisions-Interleaving
  // (Revision committet zwischen Versionsprüfung und Insert-Commit) ist dieser Schritt NICHT
  // serialisiert — es gibt keine gemeinsame Sperr-/Transaktionsdomäne mit ko.revise. Die volle
  // Schreib-Serialisierung ist bewusst in die Post-VIP-Scheibe (Job-Queue) verschoben. Die
  // Sichtbarkeits-Garantie tragen deshalb:
  //  1. der Revisions-Sweep onKoRevised (aktives Schließen nach einer Revision),
  //  2. der GEMEINSAME fail-closed Read-Filter (version-guard) in unresolved() UND get() samt
  //     Lese-GC — kein aktiver Lesepfad liefert einen stale gebundenen offenen Befund aus.
  // Ohne Versionsbindung (Altbestand/versionsloser Lauf) bleibt das Bestandsverhalten (createAuto).
  private async createAutoVersionBound(
    input: ConflictInput,
    detector: ConflictDetector,
    actor: string,
    isCurrent?: (koId: string, version: number) => boolean | Promise<boolean>,
  ): Promise<Conflict | null> {
    const guarded =
      input.koAVersion !== undefined && input.koBVersion !== undefined && isCurrent !== undefined;
    if (!guarded) {
      return this.createAuto(input, detector, actor);
    }
    const conflict = this.buildAuto(input, detector);
    const inserted = await this.repo.insertIfVersionsCurrent(conflict, isCurrent);
    if (!inserted) {
      return null; // stale — es wurde GAR KEIN Datensatz committed (kein Audit, nichts sichtbar)
    }
    await this.recordAutoCreated(conflict, detector, actor);
    return conflict;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix3): Revisions-Sweep — eine inhaltliche Überarbeitung
  // eines KOs macht ALLE offenen Befunde, die eine ÄLTERE Version dieses KOs gebunden haben,
  // systemisch gegenstandslos (superseded). Board/Badges/Benachrichtigungen (alles über
  // unresolved()) zeigen danach keinen veralteten offenen Fund mehr; der frische Prüf-Job der
  // neuen Version legt bei Bedarf einen neuen, korrekt gebundenen Befund an. Versionslose
  // Alt-Befunde bleiben bewusst unberührt (keine Bindung — konservatives Bestandsverhalten).
  // Idempotent; gibt die Anzahl geschlossener Befunde zurück.
  async onKoRevised(koId: string, currentVersion: number, actor = "system"): Promise<number> {
    const stale = (await this.repo.all()).filter((c) => {
      if (c.status === "geloest") {
        return false;
      }
      const boundStale =
        (c.koA === koId && c.koAVersion !== undefined && c.koAVersion !== currentVersion) ||
        (c.koB === koId && c.koBVersion !== undefined && c.koBVersion !== currentVersion);
      return boundStale;
    });
    for (const c of stale) {
      await this.save({ ...c, status: "geloest", decidedBy: null, resolutionReason: "superseded" });
      await this.audit?.record({
        actor,
        action: "conflict.superseded",
        target: c.id,
        payload: { koId, currentVersion },
      });
    }
    return stale.length;
  }

  // SCRUM-491: Side-effect-freier Dry-Run (symmetrisch zu OverlapService.assessAgainstPool). Konflikt-
  // erkennung ist rein modellgetrieben — ohne judge gibt es keine Kandidaten (kein deterministischer
  // Pfad). Dieselbe Urteilslogik (selectCandidates → judge → decideFromVerdict) wie detectForSubject,
  // aber OHNE Persistenz: kein repo.all(), kein createAuto/Insert, kein Audit.
  async assessAgainstPool(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    judge?: (coreA: string, coreB: string) => Promise<ConflictVerdict | null>,
    options: { cap?: number; minConfidence?: number } = {},
  ): Promise<DryRunConflict[]> {
    if (!judge) {
      return [];
    }
    const candidates = selectCandidates(subject, pool, options.cap ?? 8);
    const subjectCore = coreText(subject);
    const results: DryRunConflict[] = [];
    for (const cand of candidates) {
      let verdict: ConflictVerdict | null;
      try {
        verdict = await judge(subjectCore, coreText(cand));
      } catch {
        continue;
      }
      if (!verdict) {
        continue;
      }
      const decision = decideFromVerdict(
        verdict,
        subjectCore,
        coreText(cand),
        options.minConfidence,
      );
      if (!decision.create || decision.type === null) {
        continue;
      }
      results.push({
        koId: cand.refId,
        koTitle: cand.title,
        type: decision.type,
        method: "model",
        confidence: verdict.confidence,
        rationale: verdict.begruendung,
      });
    }
    return results;
  }

  // FR-CON-04: alle ungelösten Konflikte (jeder Status außer gelöst).
  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): FAIL-CLOSED versionsgebunden über den GEMEINSAMEN
  // Helfer isBoundToCurrentVersions (derselbe Vertrag wie get() und damit die Detail-Route) — ein
  // Befund, dessen gebundene KO-Version nicht mehr der aktuellen entspricht (oder deren aktuelle
  // Version nicht ermittelbar ist), wird HART herausgefiltert. Ein SICHER stale offener Befund
  // wird zusätzlich best-effort per Lese-GC geschlossen (s. gcStaleOpen); der Revisions-Sweep
  // (onKoRevised) bleibt das aktive Schließen, dieser Filter die Rückfall-Sicherung. Altbestand
  // ohne Versionsfelder bleibt konservativ sichtbar (keine Regression).
  //
  // D5 (KI aus): `vorObjektabruf` ist ein optionaler Prüfhaken des Aufrufers. Er läuft unmittelbar
  // vor JEDER Versionsabfrage — das sind Lesezugriffe auf die Wissensobjekte selbst. Wirft er, findet
  // die Abfrage nicht statt, und der Aufruf endet mit genau diesem Fehler, statt ihn im fail-closed-
  // Fang von `cachedCurrentVersions` zu „Version nicht ermittelbar" zu verschlucken. Nur der Klara-
  // Frageweg setzt ihn (ask-routes.ts); Board, Badge und Detail-Routen rufen ohne und bleiben gleich.
  async unresolved(vorObjektabruf?: () => void): Promise<Conflict[]> {
    const open = (await this.repo.all()).filter((c) => c.status !== "geloest");
    const lookup = this.currentVersion;
    if (!lookup) {
      return open; // keine Versions-Autorität verdrahtet → Bestandsverhalten
    }
    let abbruch: { fehler: unknown } | undefined;
    const current = cachedCurrentVersions(
      vorObjektabruf
        ? (koId) => {
            try {
              vorObjektabruf();
            } catch (fehler) {
              abbruch ??= { fehler };
              throw fehler;
            }
            return lookup(koId);
          }
        : lookup,
    );
    const result: Conflict[] = [];
    for (const c of open) {
      const verdict = await isBoundToCurrentVersions(c, current);
      if (abbruch) {
        throw abbruch.fehler;
      }
      if (verdict.visible) {
        result.push(c);
      } else if (verdict.stale) {
        this.gcStaleOpen(c.id, verdict.stale);
      }
    }
    return result;
  }

  // Aufnahme gesamt-auditprotokoll, Lauf 2 (R-0766): die Kennungen ALLER Konflikte, an denen das
  // Objekt beteiligt ist — offen UND gelöst, ohne Versionsfilter. Die Kette am Objekt findet darüber
  // Altbelege, die das Objekt selbst nicht nennen (Belegformat vor Lauf 1 ohne `koIds`). Nur Kennungen,
  // kein Inhalt: der Leseweg dafür (`GET /api/audit/ko/:koId/findings`) steht hinter derselben Tür wie
  // das Protokoll, das diese Kennungen ohnehin als Ziel führt.
  async idsForKo(koId: string): Promise<string[]> {
    return (await this.repo.all()).filter((c) => c.koA === koId || c.koB === koId).map((c) => c.id);
  }

  // R-0263: die festgelegten Vorrang-Beziehungen, an denen dieser Punkt beteiligt ist — aus den
  // ENTSCHIEDENEN Konflikten, ohne Versionsfilter (eine Entscheidung bleibt Teil der Geschichte).
  // Die Sichtbarkeit beider Seiten prüft die Route (`GET /api/conflicts/vorrang/:koId`).
  async vorrangFuerKo(koId: string): Promise<Conflict[]> {
    return (await this.repo.all()).filter(
      (c) =>
        c.status === "geloest" && c.vorrang !== undefined && (c.koA === koId || c.koB === koId),
    );
  }

  // FR-CON-04: Zähler für das Sidebar-Badge.
  async badgeCount(): Promise<number> {
    return (await this.unresolved()).length;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5, ROT 2): der Detail-Lesepfad ist FAIL-CLOSED — ein
  // OFFENER Befund mit stale (oder nicht ermittelbarer) Versionsbindung wird NICHT mehr roh
  // durchgereicht, sondern wie „nicht vorhanden" behandelt (die Route macht daraus ein ehrliches
  // 404); ein SICHER stale offener Befund wird zusätzlich per Lese-GC geschlossen. GESCHLOSSENE
  // Befunde bleiben abrufbar (ehrlicher Grabstein: status geloest + superseded — nie ein offener
  // stale Befund).
  async get(id: string): Promise<Conflict | undefined> {
    const conflict = await this.repo.findById(id);
    const lookup = this.currentVersion;
    if (!conflict || conflict.status === "geloest" || !lookup) {
      return conflict;
    }
    const verdict = await isBoundToCurrentVersions(conflict, cachedCurrentVersions(lookup));
    if (verdict.visible) {
      return conflict;
    }
    if (verdict.stale) {
      this.gcStaleOpen(id, verdict.stale);
    }
    return undefined;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5; ROT-Härtung aistate-fix6): Lese-GC — ein beim Lesen
  // entdeckter, SICHER stale gebundener OFFENER Befund (Karteileiche aus dem bewusst nicht
  // serialisierten Schreib-Race, Pedi D-V5=b) wird best-effort systemisch geschlossen (superseded,
  // by=null — analog onKoRevised, das der aktive Haupt-Weg bleibt). Feuern-und-vergessen (Makrotask):
  // der Read wird nicht blockiert. NEBENLÄUFIGKEITSSICHER (bens fix5-Recheck §2.2/§4):
  //  - repo.supersedeIfOpen ist ein STATUS-CAS (schließt nur den noch offenen Befund, atomar). Kein
  //    Check-then-Act-Fenster mehr: eine zwischenzeitliche MENSCHLICHE Entscheidung (Status ≠ "offen")
  //    gewinnt das CAS, der GC überschreibt sie NIE (kein Lost Update).
  //  - NUR der CAS-Gewinner (won=true) auditiert ⇒ genau EIN superseded-Audit, auch bei mehreren
  //    parallelen GC-Läufen; Verlierer tun NICHTS (kein Update, kein Audit).
  //  - AUDIT-AUSFALL EHRLICH: schlägt der Audit NACH gewinnendem CAS fehl, wird der Fehler über
  //    onError SICHTBAR gemeldet (nicht kommentarlos verschluckt) — der Abschluss bleibt konsistent,
  //    das fehlende Audit ist im Log/Metrik sichtbar statt dauerhaft still.
  // Bei NICHT ermittelbarer aktueller Version wird gar nicht erst hierher verzweigt (nur ausgeblendet
  // — ein transienter Lookup-Fehler darf keinen Befund beenden; s. version-guard).
  private gcStaleOpen(id: string, stale: { koId: string; currentVersion: number }): void {
    setTimeout(() => {
      void (async () => {
        const won = await this.repo.supersedeIfOpen(id, {
          status: "geloest",
          decidedBy: null,
          resolutionReason: "superseded",
        });
        if (!won) {
          return; // Verlierer: schon geschlossen/menschlich entschieden — kein Update, kein Audit.
        }
        await this.audit?.record({
          actor: "system",
          action: "conflict.superseded",
          target: id,
          payload: { koId: stale.koId, currentVersion: stale.currentVersion, via: "read-gc" },
        });
      })().catch((error) => {
        // best-effort: den Lesepfad nie blockieren, aber den Fehler NICHT still schlucken (ein
        // fehlender Audit nach gewinnendem CAS bliebe sonst dauerhaft unsichtbar).
        this.onError(`Lese-GC superseded audit (${id})`, error);
      });
    }, 0);
  }

  // JOB 3066: OHNE tx — der einzige Weg, der zu einem fremden Vorgang gehört (`onKoRemoved`),
  // schliesst mengenbasiert über `repo.closeOpenForKo` und läuft nicht mehr hier durch. Ein
  // tx-Parameter ohne Aufrufer wäre eine Atomaritätszusage, die niemand einlöst.
  private async save(conflict: Conflict): Promise<Conflict> {
    await this.repo.update(conflict);
    return conflict;
  }

  private async require(id: string): Promise<Conflict> {
    const conflict = await this.repo.findById(id);
    if (!conflict) {
      throw new ConflictError("NOT_FOUND", "Konflikt nicht gefunden.");
    }
    return conflict;
  }

  private async requireOpen(id: string): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.status === "geloest") {
      throw new ConflictError("ALREADY_RESOLVED", "Konflikt ist bereits gelöst.");
    }
    return conflict;
  }

  // R-0215 / R-1714: der eine Riegel des verbindlichen Eskalationspfads. Nur „truth" ist betroffen;
  // „offen" heisst beim Wahrheitskonflikt: noch nicht an einen Menschen eskaliert.
  private requireEscalatedIfTruth(conflict: Conflict): void {
    if (conflict.type === "truth" && conflict.status === "offen") {
      throw new ConflictError(
        "CONFLICT",
        "Ein Wahrheitskonflikt wird zuerst an einen Menschen eskaliert; erst danach wird entschieden.",
      );
    }
  }
}
