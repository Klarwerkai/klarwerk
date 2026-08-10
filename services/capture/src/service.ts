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
  /**
   * AUFTRAG-mega20 Block D: existiert dieses Objekt im Objektspeicher?
   *
   * INJIZIERT und nicht importiert — capture darf den Object-Store nicht kennen (Modulgrenze,
   * dependency-cruiser). Die Composition-Root reicht die Auflösung herein; damit bleibt die Prüfung
   * hier ohne Persistenzkenntnis und in jedem Test ohne Objektspeicher ausführbar.
   *
   * FEHLT die Verdrahtung, findet KEINE Prüfung statt und die Referenzen reisen unverändert mit —
   * bewusst kein künstlicher Fehler, aber auch keine erfundene Zusage: `verifyDraftAnchors` sagt
   * dann ehrlich, dass es nichts geprüft hat.
   */
  objectExists?: (objectId: string) => Promise<boolean>;
}

/**
 * AUFTRAG-mega20 Block D — DAS ERGEBNIS DER ANKERPRÜFUNG EINES ENTWURFS.
 *
 * `checked: false` heißt „konnte nicht geprüft werden" (keine Auflösung verdrahtet) und ist
 * ausdrücklich NICHT dasselbe wie „alles in Ordnung". Der Unterschied steht hier im Typ, damit ihn
 * niemand versehentlich einebnet.
 */
export interface DraftAnchorCheck {
  checked: boolean;
  /** Die Objektkennungen, auf die sich der Entwurf beruft, die es aber nicht (mehr) gibt. */
  missing: string[];
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
// AUFTRAG-mega20 Block D: Längendeckel der persistierten Original-Referenz (anchorKey/objectId).
const MAX_SOURCE_REF_LEN = DRAFT_LIMITS.sourceRef;
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
    // AUFTRAG-mega20 Block D: die neuen Referenzfelder durchlaufen DIESELBE Härtung wie alles
    // andere an dieser Grenze — Typ, Länge, Trim. Sie sind keine Ausnahme, nur weil sie technisch
    // aussehen: sie kommen aus demselben Client-Body wie Label und Auszug.
    //
    // Und sie werden hier NICHT gegen den Bestand geprüft. Das ist Absicht: capture kennt den
    // Objektspeicher nicht (Modulgrenze), und die Prüfung gehört an die Stelle, an der etwas davon
    // ABHÄNGT — also ans Fortsetzen und ans Einreichen (verifyDraftAnchors). Eine Prüfung beim
    // Speichern wäre außerdem zu früh: sie würde einen Entwurf ablehnen, dessen Original in genau
    // diesem Moment noch hochgeladen wird.
    const anchorKey = cappedString(raw.anchorKey, MAX_SOURCE_REF_LEN)?.trim();
    const objectId = cappedString(raw.objectId, MAX_SOURCE_REF_LEN)?.trim();
    sources.push({
      label,
      ...(url !== undefined ? { url } : {}),
      ...(excerpt !== undefined ? { excerpt } : {}),
      ...(sourceProvider !== undefined ? { sourceProvider } : {}),
      ...(anchorKey ? { anchorKey } : {}),
      ...(objectId ? { objectId } : {}),
    });
  }
  return sources;
}

/**
 * AUFTRAG-mega20 Block D: die gesicherten Originale des Entwurfs, mit derselben Härte wie alles
 * andere an dieser Grenze — Typ, Menge, Länge, Trim.
 *
 * VOLLSTÄNDIG ODER GAR NICHT: fehlt eine der vier Angaben, fällt der Eintrag weg. Ein halber
 * Anker (Kennung ohne Name, Name ohne Kennung) wäre die Behauptung ohne Deckung, die dieser Block
 * gerade beseitigt — und sie fiele erst beim Einreichen auf, wo sie am teuersten ist.
 *
 * Die Mengengrenze ist DRAFT_LIMITS.sources: mehr Ankerdokumente als Belegstellen kann es nicht
 * geben, und ein fremder Payload soll den Entwurf nicht über diesen Weg aufblähen.
 */
function normalizeAnchorDocuments(value: unknown): DraftPayload["anchorDocuments"] {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const docs: NonNullable<DraftPayload["anchorDocuments"]> = [];
  const gesehen = new Set<string>();
  for (const entry of value.slice(0, MAX_SOURCES)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const raw = entry as Record<string, unknown>;
    const key = cappedString(raw.key, MAX_SOURCE_REF_LEN)?.trim();
    const objectId = cappedString(raw.objectId, MAX_SOURCE_REF_LEN)?.trim();
    const name = cappedString(raw.name, MAX_SOURCE_LABEL_LEN)?.trim();
    const mime = cappedString(raw.mime, MAX_SOURCE_PROVIDER_LEN)?.trim();
    if (!key || !objectId || !name || !mime || gesehen.has(key)) {
      continue;
    }
    gesehen.add(key);
    docs.push({ key, objectId, name, mime });
  }
  return docs;
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
    // AUFTRAG-mega20 Block D: die gesicherten Originale laufen durch dieselbe Schleuse.
    anchorDocuments: _anchorDocuments,
    sourceForm: _sourceForm,
    extQuery: _extQuery,
    interview: _interview,
    extResults: _extResults,
    ...rest
  } = payload as DraftPayload & { extResults?: unknown };
  const next: DraftPayload = normalizeOriginIn(rest);

  const reviewerIds = normalizeReviewerIds(raw.reviewerIds);
  if (reviewerIds !== undefined && reviewerIds.length > 0) {
    next.reviewerIds = reviewerIds;
  }
  const pendingSources = normalizePendingSources(raw.pendingSources);
  if (pendingSources !== undefined && pendingSources.length > 0) {
    next.pendingSources = pendingSources;
  }
  const anchorDocuments = normalizeAnchorDocuments(raw.anchorDocuments);
  if (anchorDocuments !== undefined && anchorDocuments.length > 0) {
    next.anchorDocuments = anchorDocuments;
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

  // AUFTRAG-mega20 Block D: injizierte Existenzprüfung des Objektspeichers (s. Deps).
  private readonly objectExists: ((objectId: string) => Promise<boolean>) | undefined;

  constructor(deps: CaptureServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.objectExists = deps.objectExists;
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

  /**
   * AUFTRAG-mega20 Block D — HÄNGEN DIE ANKER DIESES ENTWURFS NOCH?
   *
   * Fragt für JEDE Belegstelle mit `objectId` beim Objektspeicher nach. Der lokale `anchorKey`
   * wird bewusst NICHT geprüft: er ist eine Behauptung der Oberfläche über ihren eigenen
   * Formularzustand und sagt über den Bestand nichts aus.
   */
  async verifyDraftAnchors(draft: Draft): Promise<DraftAnchorCheck> {
    const ids = [
      ...new Set(
        [
          ...(draft.payload.pendingSources ?? []).map((src) => src.objectId),
          // Auch die gesicherten Originale selbst: ein Ankerdokument ohne zugehörige Belegstelle
          // wäre zwar nutzlos, aber es steht im Entwurf — und was im Entwurf steht, wird geprüft.
          ...(draft.payload.anchorDocuments ?? []).map((doc) => doc.objectId),
        ].filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    if (!this.objectExists || ids.length === 0) {
      // Nichts zu prüfen ODER nicht prüfbar — der Unterschied steht im Rückgabewert, nicht in
      // einer stillen Annahme.
      return { checked: this.objectExists !== undefined, missing: [] };
    }
    const missing: string[] = [];
    for (const id of ids) {
      if (!(await this.objectExists(id))) {
        missing.push(id);
      }
    }
    return { checked: true, missing };
  }

  /**
   * AUFTRAG-mega20 Block D — DAS FORTSETZEN. KEIN BODY-RESUME OHNE ANKER.
   *
   * DIE ENTSCHEIDUNG, ausgeschrieben, weil sie unbequem ist: beruft sich ein Entwurf auf ein
   * gesichertes Original, das es nicht mehr gibt, kommt sein BODY NICHT zurück.
   *
   * Warum nicht einfach alles ausliefern und warnen? Weil der Body in genau diesem Fall
   * DOKUMENTINHALT OHNE HERKUNFT ist — der Zustand, den mega17 bis mega19 an jeder anderen Stelle
   * geschlossen haben. Käme er zurück, stünde er im Editor, ließe sich speichern, und das
   * entstehende Wissensobjekt trüge übernommenen Text, dessen Original niemand mehr benennen kann.
   * Ein Warnhinweis daneben ändert daran nichts; er verlagert die Regel nur auf den Nutzer.
   *
   * Warum nicht den ganzen Entwurf verweigern? Weil das mehr zerstört als nötig. Titel, Aussage,
   * Bedingungen, Maßnahmen, Prüferauswahl und Interviewfortschritt sind eigene Arbeit ohne
   * Herkunftsproblem — sie kommen zurück. Nur der übernommene Text bleibt aus, und der Aufrufer
   * erfährt in `anchorsMissing` ausdrücklich, WELCHE Originale fehlen.
   *
   * Die verwaisten Belegstellen kommen ebenfalls nicht zurück: eine Belegstelle, die auf ein
   * nicht mehr existierendes Original zeigt, ist kein Beleg, sondern eine Behauptung.
   */
  async resumeDraft(id: string): Promise<{ draft: Draft; anchorsMissing: string[] } | undefined> {
    const draft = await this.repo.findById(id);
    if (!draft) {
      return undefined;
    }
    return this.withAnchorCheck(draft);
  }

  /**
   * AUFTRAG-mega20 Block D — DIE LISTE LÄUFT ÜBER DIESELBE PRÜFUNG.
   *
   * WARUM DAS NICHT OPTIONAL IST. Die Oberfläche setzt einen Entwurf NICHT über
   * `GET /api/drafts/:id` fort, sondern aus der LISTE heraus (CaptureDraftList → `onResume`, mit
   * dem Objekt aus `GET /api/drafts`). Prüfte nur die Einzelroute, wäre „kein Body-Resume ohne
   * Anker" genau auf dem Weg umgehbar, den jeder Nutzer tatsächlich geht — die Regel stünde im
   * Code und griffe in der Anwendung nie.
   */
  async listDraftsForResume(): Promise<{ draft: Draft; anchorsMissing: string[] }[]> {
    const drafts = await this.repo.list();
    const result: { draft: Draft; anchorsMissing: string[] }[] = [];
    for (const draft of drafts) {
      result.push(await this.withAnchorCheck(draft));
    }
    return result;
  }

  /** Der gemeinsame Kern von Einzel-Fortsetzung und Liste (s. `resumeDraft` für die Abwägung). */
  private async withAnchorCheck(draft: Draft): Promise<{ draft: Draft; anchorsMissing: string[] }> {
    const check = await this.verifyDraftAnchors(draft);
    if (check.missing.length === 0) {
      return { draft, anchorsMissing: [] };
    }
    const fehlend = new Set(check.missing);
    return {
      draft: {
        ...draft,
        payload: {
          ...draft.payload,
          bodyHtml: null,
          pendingSources: (draft.payload.pendingSources ?? []).filter(
            (src) => !(src.objectId && fehlend.has(src.objectId)),
          ),
          anchorDocuments: (draft.payload.anchorDocuments ?? []).filter(
            (doc) => !fehlend.has(doc.objectId),
          ),
        },
      },
      anchorsMissing: [...fehlend],
    };
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
    // AUFTRAG-mega20 Block D: DIE ZWEITE PRÜFSTELLE — beim EINREICHEN, nicht nur beim Fortsetzen.
    //
    // Warum beides nötig ist: zwischen Fortsetzen und Einreichen liegt eine beliebig lange
    // Bearbeitungszeit, in der das Original verschwinden kann. Und der Einreich-Weg ist auch ohne
    // vorheriges Fortsetzen erreichbar (Promote direkt auf eine Entwurfs-Id). Hier wird deshalb
    // NICHT ausgedünnt, sondern ABGEBROCHEN: an dieser Stelle entsteht ein Wissensobjekt, und ein
    // Wissensobjekt mit Dokumentinhalt ohne Herkunft ist der eine Zustand, den es nicht geben darf.
    const anker = await this.verifyDraftAnchors(draft);
    if (anker.missing.length > 0) {
      throw new CaptureError(
        "MISSING_DRAFT_ANCHOR",
        "Der Entwurf beruft sich auf ein gesichertes Originaldokument, das es nicht mehr gibt — übernommener Inhalt wird ohne seinen Beleg nicht eingereicht.",
      );
    }
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

// ================================================================================================
// JOB 510 / R10 — DIE HERKUNFT IST EIN GEPRUEFTES FELD, KEIN DURCHREICHER.
// ================================================================================================
//
// Bis hierher lief `origin` an der Persistenz-Grenze ungeprueft durch `...rest`: ein aus Word
// stammender Entwurf konnte seine Herkunft zwar behalten, aber ebenso konnte JEDER beliebige
// String aus einem Client-Body dauerhaft im geteilten Pool landen. Beides ist jetzt entschieden:
// bekannte Werte bleiben ZEICHENGLEICH erhalten (auch `word_addin`), fehlende bleiben fehlend
// (kein stiller Default), und unbekannte oder leere Werte werden VERWORFEN statt zu `frontdoor`
// oder `word_addin` normalisiert — eine erfundene Herkunft waere schlimmer als gar keine.
const ERLAUBTE_HERKUNFT: readonly NonNullable<DraftPayload["origin"]>[] = [
  "tell",
  "studio",
  "expert",
  "frontdoor",
  "word_addin",
];

function normalizeOriginIn(payload: DraftPayload): DraftPayload {
  const roh = (payload as Record<string, unknown>).origin;
  if (roh === undefined) {
    return payload;
  }
  const bekannt = ERLAUBTE_HERKUNFT.find((wert) => wert === roh);
  if (bekannt !== undefined) {
    return { ...payload, origin: bekannt };
  }
  const { origin: _verworfen, ...ohneHerkunft } = payload;
  return ohneHerkunft;
}
