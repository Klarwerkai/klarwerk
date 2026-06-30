import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import type { KoService } from "../../knowledge-object";
import {
  type AnswerResult,
  DEFAULT_TOP_K,
  type KnowledgeRef,
  type Reasoner,
  type ReasonerLocale,
  queryTokens,
  selectCandidates,
} from "../../reasoner";
import { TRUST_MAX } from "../../validation";
import { normalizeGapQuestion } from "./gap-text";
import type { GapRepo } from "./repo";
import { AskError, type Gap, type GapPriority, isGapPriority } from "./types";

const HELPFUL_TRUST_STEP = 2;

// SCRUM-361 / AG-03 / NFR-PERF-03: Obergrenze der datenquellennahen Kandidaten-Vorauswahl. Bewusst
// deutlich größer als DEFAULT_TOP_K (8): das Repository liefert eine großzügige, vorgefilterte Menge,
// die finale, präzise Status-/Trust-/Relevanz-Sortierung + Top-K macht der Reasoner (selectCandidates).
const ASK_CANDIDATE_PREFILTER_LIMIT = 200;

// SCRUM-115: Lücken ohne gespeicherte Priorität (Altdaten) erhalten beim Lesen
// den sicheren Default "mittel" — keine stille undefined-Priorität nach außen.
function withPriority(gap: Gap): Gap {
  return isGapPriority(gap.priority) ? gap : { ...gap, priority: "mittel" };
}

export interface AskServiceDeps {
  reasoner: Reasoner;
  koService: KoService;
  gaps: GapRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
}

export interface AskResult {
  result: AnswerResult;
  gap: Gap | null;
}

export class AskService {
  private readonly reasoner: Reasoner;
  private readonly koService: KoService;
  private readonly gaps: GapRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: AskServiceDeps) {
    this.reasoner = deps.reasoner;
    this.koService = deps.koService;
    this.gaps = deps.gaps;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-ASK-01/02/03: begründete Antwort über den Reasoner; ehrliche Verweigerung → Wissenslücke.
  // FR-I18N-01: locale steuert die Antwortsprache des Reasoners (Quelleninhalt bleibt original).
  async ask(question: string, actor = "system", locale: ReasonerLocale = "de"): Promise<AskResult> {
    // SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: Ask nutzt NICHT mehr `koService.list()` (Laden des
    // gesamten Pools) als Kernpfad, sondern eine datenquellennahe, begrenzte Kandidaten-Vorauswahl
    // (`findCandidates`). Die Frage wird in Inhaltstoken zerlegt (identisch zum Ranking); ohne
    // Inhaltstoken (nur Stoppwörter) gibt es keine Kandidaten → ehrliche Wissenslücke. Das Repository
    // (InMemory/Pg) filtert ODER-weise über Titel/Aussage/Tags/Kategorie, gedeckelt auf den Prefilter-
    // Limit und mit validiert-/Trust-Bias, damit relevante validierte Treffer unter dem Limit bleiben.
    const terms = queryTokens(question);
    const prefiltered =
      terms.length === 0
        ? []
        : await this.koService.findCandidates({ terms, limit: ASK_CANDIDATE_PREFILTER_LIMIT });
    const refs: KnowledgeRef[] = prefiltered.map((ko) => ({
      id: ko.id,
      title: ko.title,
      statement: ko.statement,
      status: ko.status,
      trust: ko.trust,
    }));
    // SCRUM-360: präzise, status-/trust-bewusste Top-K-Auswahl auf der vorgefilterten Menge (Relevanz-
    // Gate dominiert, validierte/ready bevorzugt). Idempotent zur Vorauswahl: Top-K der vorgefilterten
    // Menge = Top-K, da jeder relevante KO (Token-Überschneidung) bereits im Prefilter enthalten ist.
    const candidates = selectCandidates(question, refs, DEFAULT_TOP_K);
    const result = await this.reasoner.answer(question, candidates, locale);
    // FR-ANA-02 / SCRUM-361: Telemetrie nachvollziehbar + ehrlich — Prefilter-/Kandidatengröße,
    // Top-K und der Retrieval-Modus (kein Inhaltstext, keine Frage im Audit).
    await this.audit?.record({
      actor,
      action: "ask.query",
      target: result.sources[0] ?? "-",
      payload: {
        answered: result.answered,
        retrievalMode: "prefilter",
        prefilterCount: prefiltered.length,
        candidateCount: candidates.length,
        topK: DEFAULT_TOP_K,
      },
    });
    if (!result.answered) {
      const gap = await this.createGap(question);
      return { result, gap };
    }
    return { result, gap: null };
  }

  // FR-ASK-04: „Hat geholfen" erhöht Trust leicht und erzeugt einen Audit-Eintrag.
  async markHelpful(koId: string, actor: string): Promise<void> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new AskError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    // SCRUM-359/PI-K2: Trust-Deckel zentral (TRUST_MAX=99) — auch der „Hat geholfen"-Bump
    // darf nie auf 100 („100 % wahr") springen.
    const trust = Math.min(TRUST_MAX, ko.trust + HELPFUL_TRUST_STEP);
    await this.koService.setValidationState(koId, { trust, status: ko.status });
    await this.audit?.record({ actor, action: "answer.helpful", target: koId });
  }

  // FR-ASK-05: Wissenslücken verwalten.
  async assignGap(id: string, expertId: string): Promise<Gap> {
    const gap = await this.require(id);
    return this.save({ ...gap, assignee: expertId });
  }

  async closeGap(id: string): Promise<Gap> {
    const gap = await this.require(id);
    return this.save({ ...gap, status: "geschlossen" });
  }

  // SCRUM-115 / FE-RISK-02: Priorität einer Wissenslücke setzen.
  async setGapPriority(id: string, priority: GapPriority): Promise<Gap> {
    if (!isGapPriority(priority)) {
      throw new AskError("BAD_REQUEST", "Ungültige Priorität.");
    }
    const gap = await this.require(id);
    const saved = await this.save({ ...gap, priority });
    await this.audit?.record({ actor: "system", action: "gap.priority-changed", target: id });
    return saved;
  }

  async deleteGap(id: string, confirm: boolean): Promise<void> {
    if (!confirm) {
      throw new AskError("CONFIRM_REQUIRED", "Löschen erfordert Bestätigung.");
    }
    await this.require(id);
    await this.gaps.delete(id);
  }

  async listGaps(): Promise<Gap[]> {
    const gaps = await this.gaps.all();
    return gaps.map(withPriority);
  }

  private async createGap(question: string): Promise<Gap> {
    const gap: Gap = {
      id: this.genId(),
      // SCRUM-284: datensparsam + lesbar — gespeicherte Gap-Frage normalisieren/begrenzen.
      question: normalizeGapQuestion(question),
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.gaps.insert(gap);
    await this.audit?.record({ actor: "system", action: "gap.created", target: gap.id });
    return gap;
  }

  private async save(gap: Gap): Promise<Gap> {
    await this.gaps.update(gap);
    return gap;
  }

  private async require(id: string): Promise<Gap> {
    const found = await this.gaps.findById(id);
    if (!found) {
      throw new AskError("NOT_FOUND", "Wissenslücke nicht gefunden.");
    }
    const gap = withPriority(found);
    return gap;
  }
}
