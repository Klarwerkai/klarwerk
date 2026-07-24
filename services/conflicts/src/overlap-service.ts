import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import { coreText } from "./detect";
import {
  type DetectSubject,
  type OverlapAspect,
  type OverlapRecommendation,
  type OverlapRelation,
  type OverlapVerdict,
  decideFromOverlapVerdict,
  deterministicOverlapDecision,
  exhaustiveOverlapCandidacy,
  lexicalOverlapScore,
  overlapPairKey,
} from "./duplicate-detect";
import type { OverlapRepo } from "./overlap-repo";
import {
  type OverlapDetector,
  type OverlapEntry,
  OverlapError,
  type OverlapInput,
  type OverlapResolutionReason,
} from "./overlap-types";
import {
  type CurrentVersionLookup,
  cachedCurrentVersions,
  isBoundToCurrentVersions,
} from "./version-guard";

export interface OverlapServiceDeps {
  repo: OverlapRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): Versions-Autorität für die fail-closed Lesepfade
  // (unresolved() UND get()/Detail-Route) — Vertrag wie ConflictServiceDeps.currentVersion.
  currentVersion?: CurrentVersionLookup;
  // D-AISTATE PAKET 4 (bens fix5-Recheck §4, aistate-fix6): belastbarer Fehlerkanal für den Lese-GC
  // (Vertrag wie ConflictServiceDeps.onError) — ein superseded-Audit-Ausfall nach gewinnendem CAS
  // wird SICHTBAR gemeldet statt still verschluckt. Default: console.error.
  onError?: (context: string, error: unknown) => void;
}

interface BuiltOverlap {
  method: "model" | "deterministic";
  relation: OverlapRelation;
  aspects: OverlapAspect[];
  eigenanteilA: string;
  eigenanteilB: string;
  recommendation: OverlapRecommendation;
  confidence?: number;
  rationale?: string;
}

// SCRUM-491: Ergebnis-Form des side-effect-freien Dry-Runs (assessAgainstPool). Dieselbe Urteilslogik
// wie detectForSubject, aber KEIN createAuto/Insert — nur die bewertete Kandidaten-Info zurück.
export interface DryRunOverlap {
  koId: string;
  koTitle: string;
  relation: OverlapRelation;
  method: "model" | "deterministic";
  confidence?: number;
  rationale?: string;
  snippet?: string; // Reserve (Slice 5/6): das Modul erzeugt heute keinen Beleg-Snippet.
}

export class OverlapService {
  private readonly repo: OverlapRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly currentVersion: CurrentVersionLookup | undefined;
  private readonly onError: (context: string, error: unknown) => void;

  constructor(deps: OverlapServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.currentVersion = deps.currentVersion;
    this.onError =
      deps.onError ??
      ((context, error) => {
        console.error(`[overlaps] Lese-GC ${context}:`, error);
      });
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  // Berater-Konzept Duplikate 04.07. (D3): automatisch erkannter Überschneidungs-Eintrag.
  async createAuto(
    input: OverlapInput,
    detector: OverlapDetector,
    actor = "system",
  ): Promise<OverlapEntry> {
    const entry = this.buildAuto(input, detector);
    await this.repo.insert(entry);
    await this.recordAutoCreated(entry, detector, actor);
    return entry;
  }

  // Baut die auto-Entität OHNE Persistenz — gemeinsame Grundlage für createAuto (ungebunden) und
  // createAutoVersionBound (versions-konditionaler Insert gegen den bereits committeten Stand, NICHT
  // gegen ein Revisions-Interleaving serialisiert — volle Schreib-Serialisierung ist Post-VIP).
  private buildAuto(input: OverlapInput, detector: OverlapDetector): OverlapEntry {
    return {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      relation: input.relation,
      aspects: input.aspects,
      eigenanteilA: input.eigenanteilA,
      eigenanteilB: input.eigenanteilB,
      recommendation: input.recommendation,
      status: "offen",
      pairKey: overlapPairKey(input.koA, input.koB),
      origin: "auto",
      detector,
      // D-AISTATE PAKET 4 (bens V5): geprüfte Versionen additiv mitschreiben (nur wenn vorhanden).
      ...(input.koAVersion !== undefined ? { koAVersion: input.koAVersion } : {}),
      ...(input.koBVersion !== undefined ? { koBVersion: input.koBVersion } : {}),
      createdAt: this.iso(),
    };
  }

  private async recordAutoCreated(
    entry: OverlapEntry,
    detector: OverlapDetector,
    actor: string,
  ): Promise<void> {
    await this.audit?.record({
      actor,
      action: "overlap.auto-created",
      target: entry.id,
      payload: { relation: entry.relation, method: detector.method },
    });
  }

  // Erkennung für EINEN Beitrag gegen einen (bereits geladenen) Kandidaten-Pool. Modul-rein: der
  // Aufrufer reicht Kerntext-Subjekte + einen judge-Callback (Reasoner „Duplikatprüfung"). Sehr hohe
  // Textdeckung → deterministischer Eintrag ohne Modell; mittlere → Modell-Profil. Idempotent gegen
  // bereits offene Einträge desselben Paars.
  async detectForSubject(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    // D-AISTATE PAKET 1 (bens V1): der judge bekommt die restriktivste PAAR-Vertraulichkeit — der
    // Reasoner nimmt bei `true` die Cloud aus der Kette. Die DETERMINISTISCHE Deckungsprüfung (lokal)
    // läuft für JEDES Paar, auch das vertrauliche (kein Egress).
    judge: (coreA: string, coreB: string, confidential: boolean) => Promise<OverlapVerdict | null>,
    // D-AISTATE PAKET 4 (bens V5): `isCurrent` = Stale-Schreibschutz vor dem Persistieren.
    options: {
      cap?: number;
      minConfidence?: number;
      actor?: string;
      modelLabel?: string;
      isCurrent?: (koId: string, version: number) => boolean | Promise<boolean>;
    } = {},
  ): Promise<OverlapEntry[]> {
    // „Jeder gegen jeden" (Pedi 04.07.): der Beitrag wird gegen den GESAMTEN vorhandenen Bestand
    // geprüft, nicht nur gegen eine textnahe Vorauswahl. Sehr hohe Textdeckung → deterministischer
    // Eintrag ohne Modell; alles andere geht IMMER an die inhaltliche KI-Prüfung (die Wahrscheinlichkeit
    // entscheidet). Eine optionale Obergrenze (cap) bleibt für den späteren Hintergrund-Scan; live ist
    // sie standardmäßig offen. Idempotent gegen bereits offene Einträge desselben Paars.
    const open = (await this.repo.all()).filter((e) => e.status !== "geschlossen");
    // D-AISTATE PAKET 4 (bens V5): versionsbewusste Paar-Dedupe (stale-Befund blockt den neuen Lauf nicht).
    const hasOpenPair = (aId: string, bId: string, aVer?: number, bVer?: number): boolean =>
      open.some((e) => {
        const sameIds = (e.koA === aId && e.koB === bId) || (e.koA === bId && e.koB === aId);
        if (!sameIds) {
          return false;
        }
        if (e.koAVersion === undefined && e.koBVersion === undefined) {
          return true; // Altbestand-Eintrag → wie bisher blocken
        }
        if (aVer === undefined || bVer === undefined) {
          return true; // versionsloser Lauf → konservativ blocken
        }
        const verFor = (koId: string): number | undefined =>
          e.koA === koId ? e.koAVersion : e.koBVersion;
        return verFor(aId) === aVer && verFor(bId) === bVer;
      });
    const subjectCore = coreText(subject);
    const created: OverlapEntry[] = [];
    let compared = 0;
    for (const cand of pool) {
      if (
        cand.refId === subject.refId ||
        hasOpenPair(subject.refId, cand.refId, subject.version, cand.version)
      ) {
        continue;
      }
      if (options.cap !== undefined && compared >= options.cap) {
        break;
      }
      compared += 1;
      const lexicalScore = lexicalOverlapScore(subject, cand);
      const candidacy = exhaustiveOverlapCandidacy(lexicalScore);
      const pairConfidential = Boolean(subject.confidential) || Boolean(cand.confidential);
      const candCore = coreText(cand);
      // D-AISTATE PAKET 2 (bens V2, Pedi D-V2=a, aistate-fix3): deterministisch und Modell sind KEINE
      // Alternativen mehr — die KI beurteilt JEDEN hervorgeholten Kandidaten zusätzlich, sobald ein
      // für das Paar ZULÄSSIGES Modell da ist (V1-Regel: vertraulich ⇒ nur lokal; der judge-Callback
      // läuft durch genau dieses Reasoner-Routing). ZUSAMMENFÜHRUNGSVERTRAG:
      //  - Deckung ≥ Schwelle (deterministischer Treffer): der Eintrag entsteht IMMER — er geht NIE
      //    still verloren. Das KI-Urteil präzisiert/ergänzt ihn:
      //     * KI bestätigt eine anlegende Beziehung → das präzisere Modell-Profil trägt den Eintrag
      //       (method "model"; die deterministische Evidenz bleibt als detector.lexicalScore erhalten).
      //     * KI ordnet anders ein (z. B. „ähnlich, kein Duplikat") oder liefert kein Urteil → der
      //       deterministische Eintrag bleibt UNVERÄNDERT bestehen; eine vorhandene KI-Einordnung wird
      //       additiv am detector notiert (confidence/rationale), method bleibt "deterministic".
      //  - Deckung < Schwelle: wie bisher entscheidet allein das Modell-Urteil über die Anlage.
      //  - Kein zulässiges Modell (vertraulich+cloud-only bzw. gar keins): die deterministische Ebene
      //    trägt allein; der Aufrufer (aiCheck-Runner) schließt den Lauf ehrlich confidential/no-model
      //    ab, NICHT done (der judge-Callback meldet den Ausgang über den Outcome-Vertrag).
      const verdict = await this.modelVerdict(subjectCore, candCore, judge, pairConfidential);
      const modelBuilt = verdict
        ? OverlapService.buildFromVerdict(verdict, subjectCore, candCore, options.minConfidence)
        : null;
      const built =
        candidacy === "deterministic"
          ? (modelBuilt ?? this.deterministicBuild(verdict))
          : modelBuilt;
      if (!built) {
        continue;
      }
      const detector: OverlapDetector = {
        trigger: "validation",
        method: built.method,
        lexicalScore,
        ...(built.method === "model" ? { promptVersion: "dup-v1" } : {}),
        ...(built.confidence !== undefined ? { confidence: built.confidence } : {}),
        ...(built.rationale ? { rationale: built.rationale } : {}),
        ...(options.modelLabel && built.method === "model"
          ? { modelLabel: options.modelLabel }
          : {}),
      };
      // D-AISTATE PAKET 4 (bens V5, aistate-fix5): versions-konditionale Aktivierung — Umfang und
      // ehrliche Grenze der Absicherung s. createAutoVersionBound.
      const entry = await this.createAutoVersionBound(
        {
          koA: subject.refId,
          koB: cand.refId,
          relation: built.relation,
          aspects: built.aspects,
          eigenanteilA: built.eigenanteilA,
          eigenanteilB: built.eigenanteilB,
          recommendation: built.recommendation,
          ...(subject.version !== undefined ? { koAVersion: subject.version } : {}),
          ...(cand.version !== undefined ? { koBVersion: cand.version } : {}),
        },
        detector,
        options.actor ?? "system",
        options.isCurrent,
      );
      if (!entry) {
        continue; // stale — Befund zur alten Fassung wurde nicht aktiviert (bzw. sofort geschlossen)
      }
      created.push(entry);
      open.push(entry);
    }
    return created;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): VERSIONS-KONDITIONALE Aktivierung — dasselbe
  // Muster wie ConflictService.createAutoVersionBound: repo.insertIfVersionsCurrent legt den
  // Datensatz nur an, wenn beide gebundenen KO-Versionen zum Prüfzeitpunkt noch aktuell sind
  // (schließt den bereits VOR der Prüfung committeten neuen Stand; kein Insert-dann-Kompensieren,
  // Audit erst NACH der Anlage). EHRLICHE GRENZE (bens ROT 1, Pedi D-V5=b): gegen ein
  // GLEICHZEITIGES Revisions-Interleaving ist dieser Schritt NICHT serialisiert (keine gemeinsame
  // Sperr-/Transaktionsdomäne mit ko.revise; volle Schreib-Serialisierung = Post-VIP-Job-Queue-
  // Scheibe). Die Sichtbarkeits-Garantie tragen der Revisions-Sweep onKoRevised (aktives
  // Schließen) und der GEMEINSAME fail-closed Read-Filter (version-guard) in unresolved() UND
  // get() samt Lese-GC.
  private async createAutoVersionBound(
    input: OverlapInput,
    detector: OverlapDetector,
    actor: string,
    isCurrent?: (koId: string, version: number) => boolean | Promise<boolean>,
  ): Promise<OverlapEntry | null> {
    const guarded =
      input.koAVersion !== undefined && input.koBVersion !== undefined && isCurrent !== undefined;
    if (!guarded) {
      return this.createAuto(input, detector, actor);
    }
    const entry = this.buildAuto(input, detector);
    const inserted = await this.repo.insertIfVersionsCurrent(entry, isCurrent);
    if (!inserted) {
      return null; // stale — es wurde GAR KEIN Datensatz committed (kein Audit, nichts sichtbar)
    }
    await this.recordAutoCreated(entry, detector, actor);
    return entry;
  }

  // Systemischer Abschluss als „superseded" (kein menschlicher Entscheider, by=null).
  private async supersede(
    entry: OverlapEntry,
    actor: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const saved: OverlapEntry = {
      ...entry,
      status: "geschlossen",
      resolution: { reason: "superseded", by: null, note: null, at: this.iso() },
      closedAt: this.iso(),
    };
    await this.repo.update(saved);
    await this.audit?.record({ actor, action: "overlap.superseded", target: entry.id, payload });
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix3): Revisions-Sweep — analog ConflictService.onKoRevised.
  // Alle OFFENEN Einträge, die eine ÄLTERE Version dieses KOs gebunden haben, werden systemisch
  // geschlossen (superseded); Board/Badges (unresolved()) zeigen keinen veralteten offenen Fund mehr.
  // Versionslose Alt-Einträge bleiben unberührt. Idempotent; gibt die Anzahl zurück.
  async onKoRevised(koId: string, currentVersion: number, actor = "system"): Promise<number> {
    const stale = (await this.repo.all()).filter((e) => {
      if (e.status === "geschlossen") {
        return false;
      }
      return (
        (e.koA === koId && e.koAVersion !== undefined && e.koAVersion !== currentVersion) ||
        (e.koB === koId && e.koBVersion !== undefined && e.koBVersion !== currentVersion)
      );
    });
    for (const entry of stale) {
      await this.supersede(entry, actor, { koId, currentVersion });
    }
    return stale.length;
  }

  // SCRUM-491: Side-effect-freier Dry-Run — dieselbe Urteilslogik wie detectForSubject (hohe lexikalische
  // Deckung → deterministisch; sonst Modell via judge), aber OHNE jede Persistenz: kein repo.all(), kein
  // createAuto/Insert, kein Board-Eintrag, kein Audit. Für transienten Freitext gegen einen bereits
  // gebundenen (validierten, gedeckelten) Pool. judge ist OPTIONAL: ohne judge nur der deterministische
  // Pfad (kein Modell); mit judge zusätzlich das Modell-Urteil. Gibt die bewerteten Kandidaten zurück.
  async assessAgainstPool(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    judge?: (coreA: string, coreB: string) => Promise<OverlapVerdict | null>,
    options: { cap?: number; minConfidence?: number } = {},
  ): Promise<DryRunOverlap[]> {
    const subjectCore = coreText(subject);
    const results: DryRunOverlap[] = [];
    let compared = 0;
    for (const cand of pool) {
      if (cand.refId === subject.refId) {
        continue;
      }
      if (options.cap !== undefined && compared >= options.cap) {
        break;
      }
      compared += 1;
      const lexicalScore = lexicalOverlapScore(subject, cand);
      const candidacy = exhaustiveOverlapCandidacy(lexicalScore);
      const built =
        candidacy === "deterministic"
          ? this.deterministicBuild()
          : judge
            ? await this.modelBuild(
                subjectCore,
                coreText(cand),
                judge,
                Boolean(subject.confidential) || Boolean(cand.confidential),
                options.minConfidence,
              )
            : null;
      if (!built) {
        continue;
      }
      results.push({
        koId: cand.refId,
        koTitle: cand.title,
        relation: built.relation,
        method: built.method,
        ...(built.confidence !== undefined ? { confidence: built.confidence } : {}),
        ...(built.rationale ? { rationale: built.rationale } : {}),
      });
    }
    return results;
  }

  // D-AISTATE PAKET 2 (bens V2): der deterministische Treffer — optional mit der ADDITIV notierten
  // KI-Einordnung (das Modell hat den Kandidaten zusätzlich beurteilt, aber keine anlegende Beziehung
  // bestätigt, z. B. „ähnlich, kein Duplikat"). Der Treffer selbst wird dadurch NIE verworfen; die
  // Einordnung wird als confidence/rationale am detector sichtbar (Zusammenführungsvertrag oben).
  private deterministicBuild(modelContext?: OverlapVerdict | null): BuiltOverlap {
    const d = deterministicOverlapDecision();
    return {
      method: "deterministic",
      relation: d.relation ?? "identisch",
      aspects: d.aspects,
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: d.recommendation ?? "zusammenfuehren",
      ...(modelContext
        ? { confidence: modelContext.confidence, rationale: modelContext.begruendung }
        : {}),
    };
  }

  // Holt das Modell-Urteil (oder null: kein Modell / unverwertbare Antwort / Modellfehler).
  private async modelVerdict(
    coreA: string,
    coreB: string,
    judge: (coreA: string, coreB: string, confidential: boolean) => Promise<OverlapVerdict | null>,
    confidential: boolean,
  ): Promise<OverlapVerdict | null> {
    try {
      return await judge(coreA, coreB, confidential);
    } catch (err) {
      // SCRUM-498 B2: Backpressure (Modell-Cap voll/Timeout) ist KEIN Judge-Fehler. Einen echten
      // Modell-/Parsing-Fehler lassen wir weiterhin fallen (Kandidat auslassen, kein Crash) — aber
      // Backpressure NICHT still schlucken, sonst verschwiegen wir unter Last ein echtes Duplikat
      // (falsch-negativ in einem Sicherheits-Feature). Durchreichen → die HTTP-Schicht macht daraus
      // 503 + Retry-After. Namensbasiert erkannt, um die Modul-Entkopplung conflicts↮reasoner zu
      // wahren (kein Import des Fehlertyps aus dem Reasoner).
      if (err instanceof Error && err.name === "ModelCapacityError") {
        throw err;
      }
      return null;
    }
  }

  // Baut aus einem vorhandenen Modell-Urteil das anlegbare Profil (oder null, wenn das Urteil keine
  // Anlage trägt — verschieden/unsicher/verwandt/unter Schwelle/kein belegter Aspekt).
  private static buildFromVerdict(
    verdict: OverlapVerdict,
    coreA: string,
    coreB: string,
    minConfidence?: number,
  ): BuiltOverlap | null {
    const decision = decideFromOverlapVerdict(verdict, coreA, coreB, minConfidence);
    if (!decision.create || decision.relation === null || decision.recommendation === null) {
      return null;
    }
    return {
      method: "model",
      relation: decision.relation,
      aspects: decision.aspects,
      eigenanteilA: verdict.nurInA,
      eigenanteilB: verdict.nurInB,
      recommendation: decision.recommendation,
      confidence: verdict.confidence,
      rationale: verdict.begruendung,
    };
  }

  // Bestandsfläche für den Dry-Run (assessAgainstPool): Urteil holen + Profil bauen in einem Schritt.
  private async modelBuild(
    coreA: string,
    coreB: string,
    judge: (coreA: string, coreB: string, confidential: boolean) => Promise<OverlapVerdict | null>,
    confidential: boolean,
    minConfidence?: number,
  ): Promise<BuiltOverlap | null> {
    const verdict = await this.modelVerdict(coreA, coreB, judge, confidential);
    return verdict ? OverlapService.buildFromVerdict(verdict, coreA, coreB, minConfidence) : null;
  }

  // Menschliche Abschlüsse (⚑) — bewusst schlank: kein Eskalieren/Zweitmeinung. Merge folgt (D5).
  async dismiss(id: string, by: string, note?: string): Promise<OverlapEntry> {
    return this.close(id, by, note ?? null, "dismissed", "overlap.dismissed");
  }

  async keepSeparate(id: string, by: string, note?: string): Promise<OverlapEntry> {
    return this.close(id, by, note ?? null, "kept_separate", "overlap.kept-separate");
  }

  async linkRelated(id: string, by: string, note?: string): Promise<OverlapEntry> {
    return this.close(id, by, note ?? null, "linked_related", "overlap.linked-related");
  }

  private async close(
    id: string,
    by: string,
    note: string | null,
    reason: OverlapResolutionReason,
    action: string,
  ): Promise<OverlapEntry> {
    const entry = await this.requireOpen(id);
    const saved: OverlapEntry = {
      ...entry,
      status: "geschlossen",
      resolution: { reason, by, note, at: this.iso() },
      closedAt: this.iso(),
    };
    await this.repo.update(saved);
    await this.audit?.record({ actor: by, action, target: id });
    return saved;
  }

  // Geister-Bug (wie bei Konflikten, Pedi 04.07.): wird ein beteiligter Beitrag gelöscht, dürfen seine
  // offenen Überschneidungen nicht als „Objekt entfernt" hängen bleiben. Alle OFFENEN Einträge, die
  // dieses KO referenzieren, werden geordnet geschlossen (participant_deleted, systemisch → by=null) und
  // protokolliert. Idempotent: bereits geschlossene Einträge bleiben unberührt. Gibt die Anzahl zurück.
  async onKoRemoved(koId: string, actor = "system"): Promise<number> {
    const affected = (await this.repo.all()).filter(
      (e) => e.status !== "geschlossen" && (e.koA === koId || e.koB === koId),
    );
    for (const entry of affected) {
      const saved: OverlapEntry = {
        ...entry,
        status: "geschlossen",
        resolution: { reason: "participant_deleted", by: null, note: null, at: this.iso() },
        closedAt: this.iso(),
      };
      await this.repo.update(saved);
      await this.audit?.record({
        actor,
        action: "overlap.participant-removed",
        target: entry.id,
        payload: { koId },
      });
    }
    return affected.length;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): FAIL-CLOSED versionsgebunden über den GEMEINSAMEN
  // Helfer isBoundToCurrentVersions — Vertrag wie ConflictService.unresolved(): ein Eintrag,
  // dessen gebundene KO-Version nicht mehr der aktuellen entspricht (oder deren aktuelle Version
  // nicht ermittelbar ist), wird HART herausgefiltert; ein SICHER stale offener Eintrag wird
  // zusätzlich best-effort per Lese-GC geschlossen (s. gcStaleOpen). Altbestand ohne
  // Versionsfelder bleibt konservativ sichtbar.
  async unresolved(): Promise<OverlapEntry[]> {
    const open = (await this.repo.all()).filter((e) => e.status !== "geschlossen");
    const lookup = this.currentVersion;
    if (!lookup) {
      return open; // keine Versions-Autorität verdrahtet → Bestandsverhalten
    }
    const current = cachedCurrentVersions(lookup);
    const result: OverlapEntry[] = [];
    for (const e of open) {
      const verdict = await isBoundToCurrentVersions(e, current);
      if (verdict.visible) {
        result.push(e);
      } else if (verdict.stale) {
        this.gcStaleOpen(e.id, verdict.stale);
      }
    }
    return result;
  }

  async badgeCount(): Promise<number> {
    return (await this.unresolved()).length;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5, ROT 2): Detail-Lesepfad FAIL-CLOSED — Vertrag wie
  // ConflictService.get(): ein OFFENER Eintrag mit stale (oder nicht ermittelbarer) Versions-
  // bindung wird nicht mehr roh durchgereicht (Route ⇒ ehrliches 404), ein SICHER stale offener
  // Eintrag zusätzlich per Lese-GC geschlossen. GESCHLOSSENE Einträge bleiben abrufbar
  // (ehrlicher Grabstein — nie ein offener stale Eintrag).
  async get(id: string): Promise<OverlapEntry | undefined> {
    const entry = await this.repo.findById(id);
    const lookup = this.currentVersion;
    if (!entry || entry.status === "geschlossen" || !lookup) {
      return entry;
    }
    const verdict = await isBoundToCurrentVersions(entry, cachedCurrentVersions(lookup));
    if (verdict.visible) {
      return entry;
    }
    if (verdict.stale) {
      this.gcStaleOpen(id, verdict.stale);
    }
    return undefined;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5; ROT-Härtung aistate-fix6): Lese-GC — Vertrag wie
  // ConflictService.gcStaleOpen und NEBENLÄUFIGKEITSSICHER (bens fix5-Recheck §2.2/§4):
  //  - repo.supersedeIfOpen ist ein STATUS-CAS (schließt nur den noch offenen Eintrag, atomar) — kein
  //    Check-then-Act mehr; eine zwischenzeitliche menschliche Entscheidung (Status ≠ "offen") wird
  //    NIE überschrieben (kein Lost Update),
  //  - NUR der CAS-Gewinner auditiert ⇒ genau EIN superseded-Audit trotz paralleler GC-Läufe,
  //  - AUDIT-AUSFALL EHRLICH: ein Fehler NACH gewinnendem CAS wird über onError SICHTBAR gemeldet.
  // Feuern-und-vergessen (Makrotask), blockiert den Read nie; bei NICHT ermittelbarer aktueller
  // Version wird gar nicht erst hierher verzweigt (nur ausgeblendet, s. version-guard).
  private gcStaleOpen(id: string, stale: { koId: string; currentVersion: number }): void {
    setTimeout(() => {
      void (async () => {
        const won = await this.repo.supersedeIfOpen(id, {
          status: "geschlossen",
          resolution: { reason: "superseded", by: null, note: null, at: this.iso() },
          closedAt: this.iso(),
        });
        if (!won) {
          return; // Verlierer: schon geschlossen/menschlich entschieden — kein Update, kein Audit.
        }
        await this.audit?.record({
          actor: "system",
          action: "overlap.superseded",
          target: id,
          payload: { koId: stale.koId, currentVersion: stale.currentVersion, via: "read-gc" },
        });
      })().catch((error) => {
        // best-effort: den Lesepfad nie blockieren, aber den Fehler NICHT still schlucken.
        this.onError(`superseded audit (${id})`, error);
      });
    }, 0);
  }

  private async requireOpen(id: string): Promise<OverlapEntry> {
    const entry = await this.repo.findById(id);
    if (!entry) {
      throw new OverlapError("NOT_FOUND", "Überschneidung nicht gefunden.");
    }
    if (entry.status === "geschlossen") {
      throw new OverlapError("ALREADY_CLOSED", "Überschneidung ist bereits geschlossen.");
    }
    return entry;
  }
}
