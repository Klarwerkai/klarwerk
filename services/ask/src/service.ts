import { randomBytes, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import { type KoService, type WithTx, dropConfidential } from "../../knowledge-object";
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
import { type GapSummary, summarizeGaps } from "./gap-visibility";
import { signAnswerReceipt, verifyAnswerReceipt } from "./receipt";
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
  // FUNKE-FIX P0 (bens ROT-1): HMAC-Secret für den opaken Answer-Receipt. Fehlt es, wird ein
  // prozess-lokales Zufalls-Secret erzeugt (single-process Monolith; Belege sind kurzlebig). Für
  // Mehr-Instanz-/deterministische Testläufe kann es injiziert werden (build-app: optional aus ENV).
  receiptSecret?: Buffer;
  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): echte DB-Transaktion für das gekoppelte „Danke" (Audit-CAS
  // + Trust-Inkrement in EINER Transaktion). Nur die Kompositionswurzel mit echtem Pg-Pool bindet
  // withPgTx (build-app); ohne Injektion (InMemory/Dev-Journal) läuft der serialisierte, synchron-
  // atomare Fallback (kein echtes I/O-Fenster, Analogie zum purgeKo-Fallback).
  withTx?: WithTx;
}

export interface AskResult {
  // WP-RETEST7 R5: + captionSources — Quellen, deren Treffer NUR über die Bild-Fußnoten zustande
  // kam (Fundstellen-Kennzeichnung analog zur Bibliothek: Badge „Bildbeschreibung").
  result: AnswerResult & { captionSources: string[] };
  gap: Gap | null;
  // FUNKE-FIX P0 (bens ROT-1): opaker Beleg über (Nutzer + ausgelieferte Quell-KOs). Der Client
  // reicht ihn beim „Danke" (/api/ask/helpful) zurück; der Server verifiziert die Quellen-Bindung.
  receipt: string;
}

export class AskService {
  private readonly reasoner: Reasoner;
  private readonly koService: KoService;
  private readonly gaps: GapRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly receiptSecret: Buffer;
  private readonly withTx: WithTx | undefined;
  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): serialisiert die gekoppelten „Danke"-Schreibvorgänge (die
  // Audit-Kette ist per Konstruktion ein Single-Writer — ihre seq/prevHash bilden eine Totalordnung).
  // Ohne diese Serialisierung würden zwei gleichzeitige Danke VERSCHIEDENER Nutzer (verschiedene
  // Event-Ids) mit derselben berechneten seq am PRIMARY KEY kollidieren; MIT ihr zieht jeder seinen
  // eigenen Audit + eigenen atomaren Trust-Schritt (kein Lost-Update). Monolith = ein Prozess, daher
  // ist ein prozess-globaler Promise-Ketten-Mutex die ehrliche, minimale Serialisierung.
  private helpfulChain: Promise<unknown> = Promise.resolve();

  constructor(deps: AskServiceDeps) {
    this.reasoner = deps.reasoner;
    this.koService = deps.koService;
    this.gaps = deps.gaps;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    // FUNKE-FIX P0: ohne injiziertes Secret ein prozess-lokales Zufalls-Secret — Belege sind
    // kurzlebig, das Secret verlässt den Server nie.
    this.receiptSecret = deps.receiptSecret ?? randomBytes(32);
    this.withTx = deps.withTx;
  }

  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): serialisiert fn hinter der `helpfulChain` (ein Vorgänger-
  // Fehler blockiert den nächsten nicht — catch). So laufen die gekoppelten Danke-Transaktionen nie
  // echt nebenläufig gegen die Single-Writer-Audit-Kette.
  private serializeHelpful<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.helpfulChain.catch(() => undefined).then(fn);
    this.helpfulChain = run.catch(() => undefined);
    return run;
  }

  // FR-ASK-01/02/03: begründete Antwort über den Reasoner; ehrliche Verweigerung → Wissenslücke.
  // FR-I18N-01: locale steuert die Antwortsprache des Reasoners (Quelleninhalt bleibt original).
  async ask(
    question: string,
    actor = "system",
    locale: ReasonerLocale = "de",
    // SCRUM-490 D2: validatedOnly (Add-on-Principal ask.validated) → der Reasoner sieht AUSSCHLIESSLICH
    // validierte KOs; unvalidierte („offen") Kandidaten werden vor der Auswahl verworfen. Für den
    // Session-Pfad ungesetzt → unverändertes Verhalten.
    // SCRUM-490 D1: gapPolicy steuert die Wissenslücken-Nebenwirkung bei answered=false. Ohne die Option
    // (Session-Pfad) unverändert: Gap anlegen (actor="system"). "count_only" (addon-Pfad) legt KEINE
    // Wissenslücke an — die Zählung liefert stattdessen das metadata-only ask.query-Audit. Der Service
    // bleibt generisch: er kennt keine addon-ID, nur die explizit übergebene Policy.
    // SCRUM-490 R2 (B1): retrievalOnly (Add-on-Pfad) → der (vertrauliche) Dokumenttext wird NICHT ans
    // Modell synthetisiert. Die Antwort entsteht rein aus dem Retrieval gegen die bereits gefilterten
    // (validiert, nicht-vertraulich) Kandidaten — kein Cloud-/Local-LLM, kein Embedder, kein Egress.
    opts?: {
      demoSeed?: boolean;
      validatedOnly?: boolean;
      gapPolicy?: "create" | "count_only";
      retrievalOnly?: boolean;
    },
  ): Promise<AskResult> {
    // SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: Ask nutzt NICHT mehr `koService.list()` (Laden des
    // gesamten Pools) als Kernpfad, sondern eine datenquellennahe, begrenzte Kandidaten-Vorauswahl
    // (`findCandidates`). Die Frage wird in Inhaltstoken zerlegt (identisch zum Ranking); ohne
    // Inhaltstoken (nur Stoppwörter) gibt es keine Kandidaten → ehrliche Wissenslücke. Das Repository
    // (InMemory/Pg) filtert ODER-weise über Titel/Aussage/Tags/Kategorie, gedeckelt auf den Prefilter-
    // Limit und mit validiert-/Trust-Bias, damit relevante validierte Treffer unter dem Limit bleiben.
    const terms = queryTokens(question);
    const prefilteredRaw =
      terms.length === 0
        ? []
        : await this.koService.findCandidates({ terms, limit: ASK_CANDIDATE_PREFILTER_LIMIT });
    // SCRUM-490 D2: Der Add-on-Principal (ask.validated) darf nie aus unvalidierten Inhalten antworten
    // — hier fallen alle nicht-„validiert"en Kandidaten weg, bevor der Reasoner sie sieht.
    // SCRUM-502: vertrauliche KOs gehen NIE in einen externen Kontext — hier upstream entfernt, damit sie
    // weder ins Modell-Input (reasoner.answer) noch in die zitierten Quellen (sources) noch in den
    // Antworttext gelangen. Ein Filter deckt alle drei Egress-Wege (rollen-unabhängig, immer aktiv).
    const prefiltered = dropConfidential(
      opts?.validatedOnly
        ? prefilteredRaw.filter((ko) => ko.status === "validiert")
        : prefilteredRaw,
    );
    const refs: KnowledgeRef[] = prefiltered.map((ko) => ({
      id: ko.id,
      title: ko.title,
      statement: ko.statement,
      status: ko.status,
      trust: ko.trust,
      // WP-RETEST7 R5 (Pedis Befund): die persistierten Bild-Fußnoten reisen in den Match-/
      // Kontextpfad mit (captionTexts-Suchfeld — kein bodyHtml-Vollload, kein neuer Scanner).
      // Sichtbarkeitsregeln unverändert: dropConfidential/validatedOnly liefen bereits davor.
      ...(ko.captionTexts?.length ? { captionTexts: ko.captionTexts } : {}),
    }));
    // SCRUM-360: präzise, status-/trust-bewusste Top-K-Auswahl auf der vorgefilterten Menge (Relevanz-
    // Gate dominiert, validierte/ready bevorzugt). Idempotent zur Vorauswahl: Top-K der vorgefilterten
    // Menge = Top-K, da jeder relevante KO (Token-Überschneidung) bereits im Prefilter enthalten ist.
    const candidates = selectCandidates(question, refs, DEFAULT_TOP_K);
    // SCRUM-490 R2 (B1): Add-on-Pfad → RETRIEVAL-ONLY (kein Modell-/Embedder-Egress des Dokumenttexts).
    // Sonst der übliche Reasoner-Weg (Session-Pfad unverändert).
    const rawResult = opts?.retrievalOnly
      ? await this.reasoner.answerRetrievalOnly(question, candidates, locale)
      : await this.reasoner.answer(question, candidates, locale);
    // SCRUM-490 R2 (A2): Quellenpflicht — ein „Treffer" ohne echte Quelle ist KEIN belegter Treffer.
    // answered=true mit leeren sources → als ehrliche Leer-Antwort behandeln (nie eine Quelle vortäuschen).
    const resultCore =
      rawResult.answered && rawResult.sources.length === 0
        ? { ...rawResult, answered: false, answer: null }
        : rawResult;
    // WP-RETEST7 R5: Fundstellen-Kennzeichnung — eine Quelle, deren Frage-Treffer AUSSCHLIESSLICH
    // aus den Bild-Fußnoten stammt (kein Term in Titel/Aussage), wird als Caption-Fund markiert;
    // die UI zeigt dazu das Bibliotheks-Badge „Bildbeschreibung".
    const captionSources = resultCore.sources.filter((id) => {
      const ko = prefiltered.find((k) => k.id === id);
      if (!ko || !ko.captionTexts?.length) {
        return false;
      }
      const core = `${ko.title} ${ko.statement}`.toLowerCase();
      const captions = ko.captionTexts.join(" ").toLowerCase();
      return terms.some((term) => captions.includes(term)) && !terms.some((t) => core.includes(t));
    });
    const result = { ...resultCore, captionSources };
    // FUNKE-FIX P0 (bens ROT-1): opaker Answer-Receipt über (Nutzer + ausgelieferte Quell-KOs) —
    // die serverseitige Grundlage für ein NICHT fälschbares „Danke". Bindet exakt result.sources,
    // die dieser actor in diesem Vorgang bekam (leer, wenn keine Quelle → späteres „Danke" scheitert).
    const receipt = signAnswerReceipt(this.receiptSecret, actor, result.sources, this.now());
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
      // SCRUM-490 D1: "count_only" (addon-Pfad) legt KEINE Wissenslücke an — kein Gap-Record, kein
      // gespeicherter Fragetext, kein gap.created-Audit, kein gap im Response. Die aggregierte Zählung
      // liefert das oben emittierte metadata-only ask.query-Audit (trägt Actor + answered=false, keinen
      // Text). Ohne die Option bleibt der Pfad byte-identisch: Gap anlegen.
      if (opts?.gapPolicy === "count_only") {
        return { result, gap: null, receipt };
      }
      const gap = await this.createGap(question, actor, opts?.demoSeed);
      return { result, gap, receipt };
    }
    return { result, gap: null, receipt };
  }

  // FR-ASK-04: „Hat geholfen" erhöht Trust leicht und erzeugt einen Audit-Eintrag.
  // FUNKE-FIX P0 (bens ROT-1): Das „Danke" ist an einen echten Antwortvorgang GEBUNDEN und
  // genau-einmal-persistiert:
  //  (1) `receipt` ist der serverseitig ausgestellte Answer-Receipt; er muss GENAU DIESES koId
  //      als Quelle für GENAU DIESEN actor belegen — sonst 403 (unbelegte/fremd gewählte KO-ID ist
  //      nicht mehr wirksam; fremde Wirkung/Glocke/Trust nicht mehr fälschbar).
  //  (2) recordOnce (partieller Unique-Index / synchroner Set-Guard) koppelt den Trust-Bump ATOMAR
  //      an den CAS-Gewinn: zwei gleichzeitige Requests ⇒ genau EIN Audit, genau EIN Trust-Schritt;
  //      der zweite Klick ist ein ehrlicher No-op. Kein Read-then-Write-Fenster mehr.
  // FUNKE F2 (nacht24 Paket 6): weiterhin idempotent je Nutzer+Ziel — der Idempotenzschlüssel ist
  // bewusst (actor+koId), nicht (actor+koId+Beleg): so bleibt ein Zweitklick aus JEDEM Antwortvorgang
  // ein No-op (strikt stärker als eine beleggebundene Zählung).
  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): Audit-CAS und Trust-Schritt sind jetzt ATOMAR gekoppelt
  // (gemeinsame Transaktion bzw. serialisierter synchron-atomarer Fallback) — kein Zustand „Beleg ja,
  // Trust nie" mehr, und der Trust ist ein ATOMARER Inkrement (kein Lost-Update bei zwei Nutzern).
  async markHelpful(receipt: string, koId: string, actor: string): Promise<void> {
    const bound = verifyAnswerReceipt(this.receiptSecret, receipt, this.now());
    if (!bound || bound.userId !== actor || !bound.sources.includes(koId)) {
      throw new AskError("FORBIDDEN", "Kein gültiger Antwort-Beleg für dieses Wissensobjekt.");
    }
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new AskError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    // Serialisiert gegen die Single-Writer-Audit-Kette (s. serializeHelpful); der gekoppelte Schreib-
    // block committet Event-Beleg UND Trust-Schritt gemeinsam oder gar nicht.
    await this.serializeHelpful(() =>
      this.recordHelpful(koId, actor, { koTitle: ko.title, koAuthor: ko.author }),
    );
  }

  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): der gekoppelte Kern des „Danke". recordOnce (Event-CAS) und
  // der atomare Trust-Inkrement liegen in DERSELBEN Persistenz-Transaktion (gemeinsamer TxContext), so
  // dass entweder BEIDE oder KEINE wirksam werden. Fail-forward: schlägt der Trust-Schritt fehl, rollt
  // die Transaktion den bereits geschriebenen Event-Beleg zurück — ein Retry zieht sauber nach (kein
  // „Beleg ohne Trust", nach dem jeder Retry ein No-op wäre).
  private async recordHelpful(
    koId: string,
    actor: string,
    payload: { koTitle: string; koAuthor: string },
  ): Promise<void> {
    const audit = this.audit;
    // SCRUM-359/PI-K2: Trust-Deckel zentral (TRUST_MAX=99) — auch der „Hat geholfen"-Bump darf nie auf
    // 100 („100 % wahr") springen.
    if (!audit) {
      // Degenerationsfall ohne Audit (Dev/Tests): kein Exactly-once-Vertrag möglich → nur der atomare
      // Trust-Schritt (best-effort). In Produktion ist der Audit immer verdrahtet.
      await this.koService.bumpTrust(koId, HELPFUL_TRUST_STEP, TRUST_MAX);
      return;
    }
    const eventId = `answer.helpful:${actor}:${koId}`;
    // PMO-FEA-0002: Payload trägt Autor+Titel, damit der Feed die Wirkungs-Rückmeldung an den
    // Originalautor ohne weitere Lookups ableiten kann (ehrlich: nur echte Klicks).
    const auditInput = {
      actor,
      action: "answer.helpful" as const,
      target: koId,
      payload,
    };
    if (this.withTx) {
      // Pg: Event-CAS UND Trust-Inkrement auf DEMSELBEN Client (gemeinsamer tx). Wirft der Trust-
      // Schritt (z. B. KO zwischenzeitlich getrasht), rollt der Event-Beleg mit zurück.
      await this.withTx(async (tx) => {
        const won = await audit.recordOnce(eventId, auditInput, tx);
        if (!won) {
          return; // bereits gedankt → idempotenter No-op (kein zweiter Bump)
        }
        await this.koService.bumpTrust(koId, HELPFUL_TRUST_STEP, TRUST_MAX, tx);
      });
      return;
    }
    // Fallback ohne echten Pg-Pool (InMemory/Dev-Journal): serialisiert (serializeHelpful) + gate-first/
    // effect-second. Zwei synchrone In-Process-Schritte ohne echtes I/O-Fenster (Analogie purgeKo-A).
    const won = await audit.recordOnce(eventId, auditInput);
    if (!won) {
      return;
    }
    await this.koService.bumpTrust(koId, HELPFUL_TRUST_STEP, TRUST_MAX);
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

  // SCRUM-115 / FE-RISK: aggregierte Zähler der offenen Lücken — NUR Zahlen, KEIN Fragetext. Die
  // Startseite nutzt AUSSCHLIESSLICH diesen Weg (kein Volltext-Fetch mehr, s. gap-visibility).
  async gapsSummary(): Promise<GapSummary> {
    return summarizeGaps(await this.listGaps());
  }

  private async createGap(question: string, createdBy: string, demoSeed?: boolean): Promise<Gap> {
    const gap: Gap = {
      id: this.genId(),
      // SCRUM-284: datensparsam + lesbar — gespeicherte Gap-Frage normalisieren/begrenzen.
      question: normalizeGapQuestion(question),
      status: "offen",
      assignee: null,
      priority: "mittel",
      createdAt: new Date(this.now()).toISOString(),
      // FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): den fragenden Actor als Owner vermerken (nur echte
      // Nutzer, nie "system") — Grundlage, dass der Ersteller „seinen" Fragetext wiedersehen darf.
      ...(createdBy && createdBy !== "system" ? { createdBy } : {}),
      ...(demoSeed ? { demoSeed: true } : {}),
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
