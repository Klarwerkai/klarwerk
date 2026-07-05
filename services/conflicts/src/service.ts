import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import {
  type ConflictVerdict,
  type DetectSubject,
  autoDescription,
  coreText,
  decideFromVerdict,
  selectCandidates,
} from "./detect";
import type { ConflictRepo } from "./repo";
import { type Conflict, type ConflictDetector, ConflictError, type ConflictInput } from "./types";

export interface ConflictServiceDeps {
  repo: ConflictRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
}

export class ConflictService {
  private readonly repo: ConflictRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: ConflictServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-CON-01: Widerspruch erzeugt einen klassifizierten Konflikt, kein stilles Überschreiben.
  // Berater-Konzept 04.07. (Stufe 4): manuell angelegte Konflikte tragen origin="manual".
  async create(input: ConflictInput, actor = "system"): Promise<Conflict> {
    const conflict: Conflict = {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      type: input.type,
      description: input.description,
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      origin: "manual",
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.repo.insert(conflict);
    await this.audit?.record({ actor, action: "conflict.created", target: conflict.id });
    return conflict;
  }

  // Berater-Konzept 04.07. (Stufe 4): automatisch erkannter Konflikt — origin="auto" + detector-
  // Metadaten (Begründung, Zitate, Sicherheit). Eigenes Audit-Vokabular „conflict.auto-created".
  async createAuto(
    input: ConflictInput,
    detector: ConflictDetector,
    actor = "system",
  ): Promise<Conflict> {
    const conflict: Conflict = {
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
      detector,
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.repo.insert(conflict);
    await this.audit?.record({
      actor,
      action: "conflict.auto-created",
      target: conflict.id,
      payload: { trigger: detector.trigger, method: detector.method },
    });
    return conflict;
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
    await this.audit?.record({ actor: by, action: "conflict.dismissed", target: id });
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
    await this.audit?.record({ actor, action: "conflict.escalated", target: id });
    return saved;
  }

  // FR-CON-03: Zweitmeinung als Zwischenschritt.
  async secondOpinion(id: string, opinion: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({ ...conflict, status: "zweitmeinung", secondOpinion: opinion });
    await this.audit?.record({ actor, action: "conflict.second-opinion", target: id });
    return saved;
  }

  // FR-CON-03: Controller-Entscheidung schließt den Wahrheitskonflikt ab.
  async resolve(id: string, decidedBy: string, decision: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({
      ...conflict,
      status: "geloest",
      decidedBy,
      decision,
      resolutionReason: "decided",
    });
    await this.audit?.record({ actor: decidedBy, action: "conflict.resolved", target: id });
    return saved;
  }

  // Konzept 04.07. (Stufe 1) — Geister-Bug: Wird ein beteiligtes Wissensobjekt gelöscht, darf sein
  // Konflikt nicht als „Objekt nicht gefunden" offen hängen bleiben. Alle OFFENEN Konflikte, die
  // dieses KO referenzieren, werden geordnet beendet (participant_deleted) und protokolliert —
  // OHNE Status/Trust des verbleibenden KO automatisch zu ändern (kein stilles Überschreiben).
  // Idempotent: bereits gelöste Konflikte bleiben unberührt. Gibt die Anzahl beendeter Konflikte.
  async onKoRemoved(koId: string, actor = "system"): Promise<number> {
    const affected = (await this.repo.all()).filter(
      (c) => c.status !== "geloest" && (c.koA === koId || c.koB === koId),
    );
    for (const c of affected) {
      await this.save({
        ...c,
        status: "geloest",
        decidedBy: null,
        resolutionReason: "participant_deleted",
      });
      await this.audit?.record({
        actor,
        action: "conflict.participant-removed",
        target: c.id,
        payload: { koId },
      });
      await this.audit?.record({
        actor,
        action: "conflict.auto-resolved",
        target: c.id,
        payload: { reason: "participant_deleted" },
      });
    }
    return affected.length;
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
    judge: (coreA: string, coreB: string) => Promise<ConflictVerdict | null>,
    options: { cap?: number; minConfidence?: number; actor?: string; modelLabel?: string } = {},
  ): Promise<Conflict[]> {
    const candidates = selectCandidates(subject, pool, options.cap ?? 8);
    if (candidates.length === 0) {
      return [];
    }
    const open = (await this.repo.all()).filter((c) => c.status !== "geloest");
    const hasOpenPair = (aId: string, bId: string): boolean =>
      open.some((c) => (c.koA === aId && c.koB === bId) || (c.koA === bId && c.koB === aId));
    const subjectCore = coreText(subject);
    const created: Conflict[] = [];
    for (const cand of candidates) {
      if (hasOpenPair(subject.refId, cand.refId)) {
        continue;
      }
      let verdict: ConflictVerdict | null;
      try {
        verdict = await judge(subjectCore, coreText(cand));
      } catch {
        continue; // ein Modellfehler darf die Erkennung (und das Einreichen) nie kippen
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
      // Stufe 4: Herkunfts-/Erkennungs-Metadaten mitschreiben (Board zeigt „Automatisch erkannt ·
      // Sicherheit % · Begründung + Zitate"). modelLabel optional (vom Aufrufer, sonst weglassen).
      const detector: ConflictDetector = {
        trigger: "validation",
        method: "model",
        promptVersion: "kon-v1",
        confidence: verdict.confidence,
        rationale: verdict.begruendung,
        quotes: { a: verdict.zitat_a, b: verdict.zitat_b },
        ...(options.modelLabel ? { modelLabel: options.modelLabel } : {}),
      };
      const conflict = await this.createAuto(
        {
          koA: subject.refId,
          koB: cand.refId,
          type: decision.type,
          description: autoDescription(verdict),
        },
        detector,
        options.actor ?? "system",
      );
      created.push(conflict);
      open.push(conflict); // im selben Lauf kein zweiter Konflikt für dasselbe Paar
    }
    return created;
  }

  // FR-CON-04: alle ungelösten Konflikte (jeder Status außer gelöst).
  async unresolved(): Promise<Conflict[]> {
    const all = await this.repo.all();
    return all.filter((c) => c.status !== "geloest");
  }

  // FR-CON-04: Zähler für das Sidebar-Badge.
  async badgeCount(): Promise<number> {
    return (await this.unresolved()).length;
  }

  get(id: string): Promise<Conflict | undefined> {
    return this.repo.findById(id);
  }

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
}
