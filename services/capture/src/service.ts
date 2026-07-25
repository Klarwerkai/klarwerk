import { randomUUID } from "node:crypto";
import type { CreateKoInput } from "../../knowledge-object";
import { sanitizeHtml } from "../../structure";
import { DRAFT_LIMITS } from "./draft-limits";
import type { DraftRepo } from "./repo";
import { CaptureError, type Draft, type DraftPayload } from "./types";

export interface CaptureServiceDeps {
  repo: DraftRepo;
  now?: () => number;
  genId?: () => string;
}

// SCRUM-524 P.1 (WP5): Entwürfe sind ein GETEILTER Pool (FR-CAP-06) und ihr bodyHtml wird beim Fortsetzen
// im Editor gerendert. Der bodyHtml wurde bisher ROH persistiert und erst beim Promote zum KO sanitisiert
// → ein gespeicherter <script>/onerror/javascript:-Payload konnte bei einem fremden Resume ausgeführt
// werden (Stored XSS). Fix: an der PERSISTENZ-Grenze (jedes Speichern) serverseitig mit dem etablierten
// Allowlist-Sanitizer säubern — dieselbe harte Grenze wie beim KO (NFR-SEC-04). Gültige Formatierung
// (fett/kursiv/Listen/Links) übersteht das; aktives Markup nicht. Leerer/kein Body bleibt unverändert.
function sanitizeDraftPayload(payload: DraftPayload): DraftPayload {
  if (typeof payload.bodyHtml !== "string" || !payload.bodyHtml.trim()) {
    return payload;
  }
  return { ...payload, bodyHtml: sanitizeHtml(payload.bodyHtml) };
}

// AUFTRAG-mega5 Block B (bens Zusatzpunkt 1): Runtime-Normalisierung + harte Obergrenzen für die neu
// persistierten Strukturen an DERSELBEN Persistenz-Grenze wie der bodyHtml-Sanitizer. Ein
// authentifizierter ko.create-Nutzer konnte bisher malformte oder sehr große Strukturen speichern
// (reviewerIds: "x", tausende pendingSources, javascript:-URLs), an denen der Resume später mit
// .map()/.includes() scheitert. Regeln: falscher Container-Typ → Feld wird verworfen; Einträge über
// dem Cap → abgeschnitten; überlange Felder → gekürzt; URLs nur http/https (Allowlist), alles andere
// wird verworfen, nicht gespeichert. Ergebnis ist IMMER vertragskonform — nie ein Absturz beim
// Fortsetzen. extResults (voller Treffer-Cache) verlässt den Vertrag komplett (mega5 Block C,
// Datenminimierung): auch Alt-/Fremd-Payloads werden beim nächsten Schreiben davon befreit.
// AUFTRAG-mega6 Block D: die Zahlen stehen nicht mehr hier, sondern in der GEMEINSAMEN Quelle
// draft-limits.ts — aus derselben Datei leitet auch die Oberfläche ihre sichtbaren Grenzen ab
// (apps/web/src/lib/draftLimits.ts). So können Server und UI nicht auseinanderlaufen.
const MAX_REVIEWERS = DRAFT_LIMITS.reviewers;
const MAX_REVIEWER_ID_LEN = DRAFT_LIMITS.reviewerId;
const MAX_SOURCES = DRAFT_LIMITS.sources;
const MAX_SOURCE_LABEL_LEN = DRAFT_LIMITS.sourceLabel;
const MAX_URL_LEN = DRAFT_LIMITS.sourceUrl;
const MAX_SOURCE_EXCERPT_LEN = DRAFT_LIMITS.sourceExcerpt;
const MAX_SOURCE_PROVIDER_LEN = DRAFT_LIMITS.sourceProvider;
const MAX_EXT_QUERY_LEN = DRAFT_LIMITS.extQuery;
const MAX_INTERVIEW_ANSWERS = DRAFT_LIMITS.interviewAnswers;
const MAX_INTERVIEW_TEXT_LEN = DRAFT_LIMITS.interviewText;
const MAX_INTERVIEW_QUESTION_LEN = DRAFT_LIMITS.interviewQuestion;

function cappedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.slice(0, max) : undefined;
}

// http/https-Allowlist: nur vollständige, parsebare Web-URLs überleben; javascript:, data:,
// file: usw. werden verworfen (nicht gespeichert) — sie haben im Entwurf nichts verloren.
function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const candidate = value.trim().slice(0, MAX_URL_LEN);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return candidate;
    }
  } catch {
    // keine parsebare URL → verwerfen
  }
  return undefined;
}

function normalizeReviewerIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const ids = value
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    .map((id) => id.slice(0, MAX_REVIEWER_ID_LEN));
  return [...new Set(ids)].slice(0, MAX_REVIEWERS);
}

function normalizePendingSources(value: unknown): DraftPayload["pendingSources"] {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const sources: NonNullable<DraftPayload["pendingSources"]> = [];
  for (const entry of value.slice(0, MAX_SOURCES)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const label = cappedString(raw.label, MAX_SOURCE_LABEL_LEN)?.trim();
    if (!label) {
      continue; // Label ist Pflicht (gleiche Regel wie beim KO-add-source)
    }
    const url = safeHttpUrl(raw.url);
    const excerpt = cappedString(raw.excerpt, MAX_SOURCE_EXCERPT_LEN);
    const sourceProvider = cappedString(raw.sourceProvider, MAX_SOURCE_PROVIDER_LEN);
    sources.push({
      label,
      ...(url !== undefined ? { url } : {}),
      ...(excerpt !== undefined ? { excerpt } : {}),
      ...(sourceProvider !== undefined ? { sourceProvider } : {}),
    });
  }
  return sources;
}

function normalizeSourceForm(value: unknown): DraftPayload["sourceForm"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const form = {
    label: cappedString(raw.label, MAX_SOURCE_LABEL_LEN) ?? "",
    url: safeHttpUrl(raw.url) ?? "",
    excerpt: cappedString(raw.excerpt, MAX_SOURCE_EXCERPT_LEN) ?? "",
  };
  return form.label || form.url || form.excerpt ? form : undefined;
}

function normalizeInterview(value: unknown): DraftPayload["interview"] {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const answers = (Array.isArray(raw.answers) ? raw.answers : [])
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.slice(0, MAX_INTERVIEW_TEXT_LEN))
    .slice(0, MAX_INTERVIEW_ANSWERS);
  const answer = cappedString(raw.answer, MAX_INTERVIEW_TEXT_LEN);
  const question = cappedString(raw.question, MAX_INTERVIEW_QUESTION_LEN);
  const started = raw.started === true;
  // Substanzlose Hülle ({} o. ä.) gar nicht erst speichern — der Resume hätte nichts wiederherzustellen.
  if (!started && answers.length === 0 && answer === undefined && question === undefined) {
    return undefined;
  }
  return {
    started,
    answers,
    ...(answer !== undefined ? { answer } : {}),
    ...(question !== undefined ? { question } : {}),
    ...(typeof raw.done === "boolean" ? { done: raw.done } : {}),
    ...(typeof raw.demo === "boolean" ? { demo: raw.demo } : {}),
  };
}

function normalizeDraftPayload(payload: DraftPayload): DraftPayload {
  const raw = payload as Record<string, unknown>;
  // Die neuen Strukturen werden per Destrukturierung AUS dem Payload gelöst und nur normalisiert
  // (und nur wenn vorhanden) wieder eingesetzt — so überlebt kein malformter Container den
  // Schreibvorgang. Block C (Datenminimierung): der volle Treffer-Cache (extResults) wird dabei
  // nie persistiert — auch nicht aus Alt-Payloads, die das Feld noch tragen (continueDraft merged
  // über den Bestand).
  const {
    reviewerIds: _reviewerIds,
    pendingSources: _pendingSources,
    sourceForm: _sourceForm,
    extQuery: _extQuery,
    interview: _interview,
    extResults: _extResults,
    ...rest
  } = payload as DraftPayload & { extResults?: unknown };
  const next: DraftPayload = { ...rest };

  const reviewerIds = normalizeReviewerIds(raw.reviewerIds);
  if (reviewerIds !== undefined && reviewerIds.length > 0) {
    next.reviewerIds = reviewerIds;
  }
  const pendingSources = normalizePendingSources(raw.pendingSources);
  if (pendingSources !== undefined && pendingSources.length > 0) {
    next.pendingSources = pendingSources;
  }
  const sourceForm = normalizeSourceForm(raw.sourceForm);
  if (sourceForm !== undefined) {
    next.sourceForm = sourceForm;
  }
  const extQuery = cappedString(raw.extQuery, MAX_EXT_QUERY_LEN);
  if (extQuery !== undefined && extQuery.trim().length > 0) {
    next.extQuery = extQuery;
  }
  const interview = normalizeInterview(raw.interview);
  if (interview !== undefined) {
    next.interview = interview;
  }
  return next;
}

// AUFTRAG-mega6 Block B (bens ROT 2, Weg zwei): PUT bleibt ein partieller Merge — fünf von sieben
// Frontend-Aufrufern (Mobile ×2, Vordertür ×2, Offline-Queue) senden bewusst nur {title?, statement?}
// bzw. einen Vordertür-Ausschnitt und HÄNGEN daran, dass die übrigen Felder überleben. Echte
// Replace-Semantik würde bei jedem Mobil-Speichern bodyHtml/Metadaten löschen. Statt der Semantik
// ändert sich daher die GENAUIGKEIT des Merges:
//
//   Schlüssel NICHT mitgeschickt (oder Wert `undefined`) ⇒ Altwert bleibt.
//   Schlüssel mitgeschickt mit LEERWERT ([], "", leeres Formular, leeres Interview) ⇒ Altwert geht.
//
// Der zweite Fall funktioniert, weil normalizeDraftPayload NACH dem Merge läuft und leere optionale
// Strukturen nicht wieder einsetzt. Der explizite `undefined`-Ausschluss hier ist der Unterschied,
// der beide Fälle eindeutig macht: ein Aufrufer, der ein Feld gar nicht meint, kann es nicht mehr
// versehentlich löschen (`{ ...base, ...{ x: undefined } }` hätte x auf undefined gesetzt und die
// Normalisierung hätte den Altwert verworfen).
function mergeDraftPayload(base: DraftPayload, changes: DraftPayload): DraftPayload {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      continue; // „nicht mitgeschickt" ist kein „ausdrücklich geleert"
    }
    merged[key] = value;
  }
  return merged as DraftPayload;
}

function validateMetadata(payload: DraftPayload): void {
  // FR-CAP-08: nötige Validierungen 1–5 (Standard 3 wird erst beim KO gesetzt).
  if (payload.neededValidations !== undefined) {
    const n = payload.neededValidations;
    if (n < 1 || n > 5) {
      throw new CaptureError(
        "INVALID_NEEDED",
        "Nötige Validierungen müssen zwischen 1 und 5 liegen.",
      );
    }
  }
}

export class CaptureService {
  private readonly repo: DraftRepo;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: CaptureServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  async createDraft(rawPayload: DraftPayload, author: string): Promise<Draft> {
    validateMetadata(rawPayload);
    // E2E-004: leere/Whitespace-only Entwürfe ablehnen — ein Entwurf braucht mindestens Titel ODER
    // Aussage. Client sperrt den Knopf zusätzlich; das hier ist die harte Serverkante (auch für API).
    const hasTitle = typeof rawPayload.title === "string" && rawPayload.title.trim().length > 0;
    const hasStatement =
      typeof rawPayload.statement === "string" && rawPayload.statement.trim().length > 0;
    if (!hasTitle && !hasStatement) {
      throw new CaptureError(
        "EMPTY_DRAFT",
        "Ein Entwurf braucht mindestens einen Titel oder eine Aussage.",
      );
    }
    // SCRUM-524 P.1 (WP5) + mega5 Block B: bodyHtml säubern UND die neuen Strukturen normalisieren,
    // BEVOR irgendetwas in den geteilten Pool geht.
    const payload = normalizeDraftPayload(sanitizeDraftPayload(rawPayload));
    const at = new Date(this.now()).toISOString();
    const draft: Draft = {
      id: this.genId(),
      payload,
      originalAuthor: author,
      lastEditor: author,
      createdAt: at,
      updatedAt: at,
    };
    await this.repo.insert(draft);
    return draft;
  }

  // FR-CAP-06: jeder Schreibberechtigte sieht und nutzt den gemeinsamen Pool.
  listDrafts(): Promise<Draft[]> {
    return this.repo.list();
  }

  getDraft(id: string): Promise<Draft | undefined> {
    return this.repo.findById(id);
  }

  // FR-CAP-07: beim Fortsetzen bleibt der Originalautor erhalten.
  async continueDraft(id: string, changes: DraftPayload, editor: string): Promise<Draft> {
    const draft = await this.require(id);
    // AUFTRAG-mega6 Block B: Merge mit eindeutiger Löschsemantik (s. mergeDraftPayload).
    const merged: DraftPayload = mergeDraftPayload(draft.payload, changes);
    validateMetadata(merged);
    // SCRUM-524 P.1 (WP5) + mega5 Block B: auch beim Fortsetzen an der Persistenz-Grenze säubern und
    // normalisieren — der Merge über den Bestand streift dabei auch Alt-Felder (extResults) ab.
    const updated: Draft = {
      ...draft,
      payload: normalizeDraftPayload(sanitizeDraftPayload(merged)),
      lastEditor: editor,
      updatedAt: new Date(this.now()).toISOString(),
    };
    await this.repo.update(updated);
    return updated;
  }

  async deleteDraft(id: string): Promise<void> {
    await this.require(id);
    await this.repo.delete(id);
  }

  // Brücke zu knowledge-object: Autor = Originalautor des Entwurfs (FR-CAP-07).
  async toKoInput(id: string): Promise<CreateKoInput> {
    const draft = await this.require(id);
    const p = draft.payload;
    if (!p.title || !p.statement || !p.type || !p.category) {
      throw new CaptureError(
        "INCOMPLETE",
        "Entwurf hat noch keine vollständigen KO-Pflichtfelder.",
      );
    }
    return {
      title: p.title,
      statement: p.statement,
      type: p.type,
      category: p.category,
      author: draft.originalAuthor,
      conditions: p.conditions ?? [],
      measures: p.measures ?? [],
      tags: p.tags ?? [],
      // SCRUM-395: KEIN hartes 3 mehr — ohne Angabe entscheidet knowledge-object
      // (Admin-Standard-Prüferanzahl, sonst Modul-Default). Explizite Werte bleiben.
      ...(p.neededValidations !== undefined ? { neededValidations: p.neededValidations } : {}),
      asset: p.asset ?? null,
      bodyHtml: p.bodyHtml ?? null, // KW-STR: Body in den KO übernehmen (wird dort sanitisiert)
      // SCRUM-509 R2: die Vertraulichkeitsstufe des Entwurfs ans KO durchreichen (kein Verlust beim
      // Promote). ko.create prüft/lehnt ungültige Werte ab — keine stille Intern-Normalisierung.
      ...(p.confidentiality !== undefined ? { confidentiality: p.confidentiality } : {}),
    };
  }

  private async require(id: string): Promise<Draft> {
    const draft = await this.repo.findById(id);
    if (!draft) {
      throw new CaptureError("NOT_FOUND", "Entwurf nicht gefunden.");
    }
    return draft;
  }
}
