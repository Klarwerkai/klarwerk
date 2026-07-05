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

export interface OverlapServiceDeps {
  repo: OverlapRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
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

export class OverlapService {
  private readonly repo: OverlapRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: OverlapServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
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
    const entry: OverlapEntry = {
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
      createdAt: this.iso(),
    };
    await this.repo.insert(entry);
    await this.audit?.record({
      actor,
      action: "overlap.auto-created",
      target: entry.id,
      payload: { relation: entry.relation, method: detector.method },
    });
    return entry;
  }

  // Erkennung für EINEN Beitrag gegen einen (bereits geladenen) Kandidaten-Pool. Modul-rein: der
  // Aufrufer reicht Kerntext-Subjekte + einen judge-Callback (Reasoner „Duplikatprüfung"). Sehr hohe
  // Textdeckung → deterministischer Eintrag ohne Modell; mittlere → Modell-Profil. Idempotent gegen
  // bereits offene Einträge desselben Paars.
  async detectForSubject(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    judge: (coreA: string, coreB: string) => Promise<OverlapVerdict | null>,
    options: { cap?: number; minConfidence?: number; actor?: string; modelLabel?: string } = {},
  ): Promise<OverlapEntry[]> {
    // „Jeder gegen jeden" (Pedi 04.07.): der Beitrag wird gegen den GESAMTEN vorhandenen Bestand
    // geprüft, nicht nur gegen eine textnahe Vorauswahl. Sehr hohe Textdeckung → deterministischer
    // Eintrag ohne Modell; alles andere geht IMMER an die inhaltliche KI-Prüfung (die Wahrscheinlichkeit
    // entscheidet). Eine optionale Obergrenze (cap) bleibt für den späteren Hintergrund-Scan; live ist
    // sie standardmäßig offen. Idempotent gegen bereits offene Einträge desselben Paars.
    const open = (await this.repo.all()).filter((e) => e.status !== "geschlossen");
    const hasOpenPair = (aId: string, bId: string): boolean =>
      open.some((e) => (e.koA === aId && e.koB === bId) || (e.koA === bId && e.koB === aId));
    const subjectCore = coreText(subject);
    const created: OverlapEntry[] = [];
    let compared = 0;
    for (const cand of pool) {
      if (cand.refId === subject.refId || hasOpenPair(subject.refId, cand.refId)) {
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
          : await this.modelBuild(subjectCore, coreText(cand), judge, options.minConfidence);
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
      const entry = await this.createAuto(
        {
          koA: subject.refId,
          koB: cand.refId,
          relation: built.relation,
          aspects: built.aspects,
          eigenanteilA: built.eigenanteilA,
          eigenanteilB: built.eigenanteilB,
          recommendation: built.recommendation,
        },
        detector,
        options.actor ?? "system",
      );
      created.push(entry);
      open.push(entry);
    }
    return created;
  }

  private deterministicBuild(): BuiltOverlap {
    const d = deterministicOverlapDecision();
    return {
      method: "deterministic",
      relation: d.relation ?? "identisch",
      aspects: d.aspects,
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: d.recommendation ?? "zusammenfuehren",
    };
  }

  private async modelBuild(
    coreA: string,
    coreB: string,
    judge: (coreA: string, coreB: string) => Promise<OverlapVerdict | null>,
    minConfidence?: number,
  ): Promise<BuiltOverlap | null> {
    let verdict: OverlapVerdict | null;
    try {
      verdict = await judge(coreA, coreB);
    } catch {
      return null;
    }
    if (!verdict) {
      return null;
    }
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

  async unresolved(): Promise<OverlapEntry[]> {
    return (await this.repo.all()).filter((e) => e.status !== "geschlossen");
  }

  async badgeCount(): Promise<number> {
    return (await this.unresolved()).length;
  }

  get(id: string): Promise<OverlapEntry | undefined> {
    return this.repo.findById(id);
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
