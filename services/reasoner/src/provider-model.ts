import {
  type ReasonerProvider,
  deterministicInterview,
  selectCandidates,
  sourceLabel,
} from "./provider";
import type {
  AnswerResult,
  AssistResult,
  EnrichResult,
  ExtractResult,
  ExtractedPoint,
  InterviewResult,
  KnowledgeRef,
  ReasonerLocale,
  StructureResult,
} from "./types";

// Abstrakter Modell-Client: kapselt den eigentlichen (anbieterspezifischen) Aufruf.
// FR-RSN-02/06: anbieteragnostisch; der Schlüssel lebt nur im Client (serverseitig).
export interface ModelClient {
  readonly name: string;
  // SCRUM-411: optionales Antwort-Limit je Aufruf (Default beim Client: 1024).
  complete(system: string, user: string, maxTokens?: number): Promise<string>;
}

// FR-I18N-01: Systemprompts sprachbewusst. JSON-Contract der structure-Aufgabe bleibt
// in beiden Sprachen identisch — nur die Anweisung ist lokalisiert.
function structureSystem(locale: ReasonerLocale): string {
  const contract =
    '{"title": string, "statement": string, "conditions": string[], "measures": string[], ' +
    '"tags": string[], "confidence": number (0..1)}';
  return locale === "en"
    ? `You structure industrial experiential knowledge. Respond ONLY with JSON: ${contract}. Do not invent anything.`
    : `Du strukturierst industrielles Erfahrungswissen. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Erfinde nichts dazu.`;
}

// SCRUM-366 / AG-04 / FR-RSN-03: quellengebundene, anti-halluzinatorische Leitplanken für den
// Modellmodus. Bleibt anbieteragnostisch (kein RAG, kein neues Framework) — schärft NUR den
// System-Prompt: nur aus den nummerierten Quellen antworten, nichts erfinden/überdehnen, bei
// unzureichender Basis ehrlich auf die fehlende Wissensbasis verweisen, keine Fake-Zitate.
function answerSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "Answer ONLY based on the numbered sources. Do not invent facts, numbers, causes or measures, and do not add general world knowledge. Do not overstate or stretch a source beyond what it actually says. If the sources are not enough, say honestly that the knowledge base does not cover this — do not guess. You may refer to the sources you used, but never fabricate quotes."
    : "Beantworte die Frage NUR auf Basis der nummerierten Quellen. Erfinde keine Fakten, Zahlen, Ursachen oder Maßnahmen und ergänze kein allgemeines Weltwissen. Dehne keine Quelle über ihre tatsächliche Aussage hinaus. Reichen die Quellen nicht, sage ehrlich, dass die Wissensbasis das nicht abdeckt — rate nicht. Du darfst auf die genutzten Quellen verweisen, aber erfinde keine Zitate.";
}

function assistSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "Improve wording without changing content. Do NOT alter or invent any content, numbers or facts. Return ONLY the revised text, without preamble or quotation marks."
    : "Du präzisierst und glättest industrielles Erfahrungswissen sprachlich. Verändere oder erfinde KEINE Inhalte, Zahlen oder Fakten. Gib AUSSCHLIESSLICH den überarbeiteten Text zurück, ohne Vorbemerkung oder Anführungszeichen.";
}

// SCRUM-312: leitet die optionale Nutzer-/Aktionsanweisung an das Modell weiter — als
// Stil-/Form-Wunsch, NICHT als Erlaubnis, Inhalte zu erfinden.
// SCRUM-426: Public-KI-Anreicherung — bewusst NICHT quellengebunden. Das Modell darf hier
// externes Weltwissen beisteuern (Abgrenzung zum quellengebundenen answer/assist). Leitplanken:
// knapp, sachlich, ehrlich bei Unsicherheit, KEINE erfundenen konkreten Zahlen/Zitate. Das
// Ergebnis wird in der UI IMMER als „extern · ungeprüft" gekennzeichnet und nie automatisch
// validiert — die Verantwortung für die Übernahme bleibt beim Menschen.
function enrichPublicSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "You add helpful external background knowledge to an expert's draft. Be concise (3–6 sentences or short bullet points), factual and general. Do NOT invent specific numbers, thresholds, dates, names or quotes — if you are unsure, say so plainly. Make clear this is general external knowledge to be verified, not the company's own validated knowledge. Answer in English."
    : "Du ergänzt den Entwurf eines Experten um hilfreiches externes Hintergrundwissen. Fasse dich kurz (3–6 Sätze oder knappe Stichpunkte), sachlich und allgemein. Erfinde KEINE konkreten Zahlen, Grenzwerte, Daten, Namen oder Zitate — bist du unsicher, sage es offen. Mache klar, dass dies allgemeines externes Wissen zum Prüfen ist, nicht das validierte Wissen des Unternehmens. Antworte auf Deutsch.";
}

function assistGuidance(locale: ReasonerLocale, instruction: string): string {
  return locale === "en"
    ? `Apply this editing instruction to the wording only (no new facts): ${instruction}`
    : `Wende diese Bearbeitungs-Anweisung nur auf die Formulierung an (keine neuen Fakten): ${instruction}`;
}

// PMO-FEA-0006 / G-2: Wissens-Extraktion aus Dokumenttext — anti-halluzinatorischer
// System-Prompt. Jeder Punkt MUSS mit einem wörtlichen Auszug belegt sein; die Auszüge
// werden zusätzlich serverseitig gegen den Dokumenttext geprüft (parseExtractResponse).
function extractSystem(locale: ReasonerLocale): string {
  const contract =
    '{"points": [{"title": string (die Aussage in einem Satz), "summary": string, ' +
    '"sourceExcerpt": string (wörtliches Zitat aus dem Dokument)}]}';
  // SCRUM-418: Ausgabe begrenzen (≤12 Punkte, Auszug ≤300 Zeichen) — vollständige, kurze
  // Punkte statt einer langen Antwort, die am Token-Limit abreißt.
  return locale === "en"
    ? `You identify distinct pieces of knowledge in a document (rules of experience, thresholds, procedures, causes, conditions). Respond ONLY with JSON: ${contract}. Return at most ${EXTRACT_PROMPT_MAX_POINTS} points — pick the most important ones. Keep each sourceExcerpt under 300 characters. Every point MUST quote a verbatim excerpt from the document as sourceExcerpt (copy it exactly, do not paraphrase it). Extract ONLY what the document actually states — do not invent, infer beyond the text, or add world knowledge. If the document contains no usable knowledge, return {"points": []}.`
    : `Du identifizierst einzelne Wissenspunkte in einem Dokument (Erfahrungsregeln, Grenzwerte, Vorgehensweisen, Ursachen, Bedingungen). Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Gib höchstens ${EXTRACT_PROMPT_MAX_POINTS} Punkte zurück — wähle die wichtigsten. Halte jede sourceExcerpt unter 300 Zeichen. Jeder Punkt MUSS eine wörtliche Belegstelle aus dem Dokument als sourceExcerpt zitieren (exakt kopieren, nicht paraphrasieren). Extrahiere NUR, was im Dokument tatsächlich steht — erfinde nichts, schlussfolgere nicht über den Text hinaus, ergänze kein Weltwissen. Enthält das Dokument kein verwertbares Wissen, gib {"points": []} zurück.`;
}

// PMO-FEA-0006: optionaler Suchauftrag des Experten — schränkt ein, WONACH gesucht wird,
// erlaubt aber NIE das Erfinden von Inhalten.
function extractGuidance(locale: ReasonerLocale, query: string): string {
  return locale === "en"
    ? `The expert is looking specifically for: ${query}. Restrict the points to this focus — but still only what the document actually states.`
    : `Der Experte sucht gezielt nach: ${query}. Beschränke die Punkte auf diesen Fokus — aber weiterhin nur, was im Dokument tatsächlich steht.`;
}

// SCRUM-410 (Pedi-Test 03.07.: „Die Sprache ist furchtbar"): Stil-Leitplanken nach den
// CI-Sprachregeln (Brand Book: nüchtern, kompetent, aktiv, ohne Hype) — natürliche Du-Anrede,
// kurz, konkret am Erzählten, kein Übersetzungsdeutsch, keine Floskeln. Antwortsprache
// STRIKT = UI-Sprache. Inhaltlich unverändert streng: nichts erfinden, nur EINE Frage.
function interviewSystem(locale: ReasonerLocale): string {
  return locale === "en"
    ? "You are an experienced colleague conducting a short interview to capture experiential knowledge. Rephrase the guiding question into exactly ONE natural next question. Rules: plain, natural English; at most 20 words; pick up concrete terms from the previous answers instead of asking generically; aim at what makes knowledge experiential (thresholds, exceptions, why, how-do-you-notice-it). No filler phrases, no politeness formulas, no quotation marks, no numbering, no leading label. Do NOT invent any technical content or facts. Answer in English only. Return ONLY the question."
    : "Du bist ein erfahrener Kollege und führst ein kurzes Interview, um Erfahrungswissen zu sichern. Formuliere aus der Leitfrage genau EINE natürliche nächste Frage. Regeln: klares, natürliches Deutsch in Du-Anrede; höchstens 20 Wörter; greife konkrete Begriffe aus den bisherigen Antworten auf, statt generisch zu fragen; ziele auf das, was Erfahrungswissen ausmacht (Grenzwerte, Ausnahmen, Warum, Woran-erkennst-du-es). Keine Floskeln oder Höflichkeitsformeln, keine Anführungszeichen, keine Nummerierung, kein vorangestelltes Label. Erfinde KEINE fachlichen Inhalte oder Fakten. Antworte ausschließlich auf Deutsch. Gib AUSSCHLIESSLICH die Frage zurück.";
}

// Sprachbewusste User-Prompt-Labels (kein Quelleninhalt wird übersetzt).
const LABELS: Record<ReasonerLocale, Record<string, string>> = {
  de: {
    question: "Frage",
    sources: "Quellen",
    priorAnswers: "Bisherige Antworten",
    guiding: "Leitfrage",
    none: "(noch keine)",
  },
  en: {
    question: "Question",
    sources: "Sources",
    priorAnswers: "Previous answers",
    guiding: "Guiding question",
    none: "(none yet)",
  },
};

// SCRUM-418 (Pedi 03.07., Extract scheiterte weiter trotz grünem Key-Test): robuste
// JSON-Objekt-Extraktion. Findet das ERSTE ausgewogene {…}-Objekt ab der ersten „{",
// string-/escape-bewusst. Damit stören umschließende Prosa, Code-Fences (```json) oder ein
// „}" im Begleittext NICHT mehr — die naive „erstes { bis letztes }"-Variante zerbrach genau
// daran (Modell schrieb einen Satz vor/nach der JSON). Ist das Objekt am Token-Limit
// abgeschnitten (nie ausgewogen), kommt der Rest ab „{" zurück — die Rettung greift dann.
function extractJson(raw: string): string {
  // Anker: das Objekt, das den points-Contract trägt — die „{" unmittelbar VOR dem ersten
  // „"points"". So wird geschwätzige Prosa mit eigenen geschweiften Klammern (z. B. „nutze
  // {dies}") übersprungen; bei abgeschnittener Antwort liefert der Scan den Rest ab dieser
  // „{" (die Rettung greift). Ohne „"points"" fällt es auf die erste „{" zurück.
  const pointsIdx = raw.indexOf('"points"');
  const start = pointsIdx >= 0 ? raw.lastIndexOf("{", pointsIdx) : raw.indexOf("{");
  if (start < 0) {
    return raw;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw.charAt(i);
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = inString; // Escapes zählen nur innerhalb von Strings
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  return raw.slice(start); // abgeschnitten → Rest für die Rettung (salvage)
}

// SCRUM-418: Rettung gekürzter Antworten — vollständige Punkt-Objekte aus einem am
// Token-Limit abgerissenen JSON bergen (Klammer-Reparatur von hinten nach vorn). Jeder
// geborgene Punkt läuft weiterhin durch parseExtractResponse und damit durchs
// G-2-Belegstellen-Gate — gerettet wird nur, was vollständig UND belegt ist.
export function salvageTruncatedExtract(raw: string, documentText: string): ExtractedPoint[] {
  const json = extractJson(raw);
  let cut = json.lastIndexOf("}");
  while (cut > 0) {
    const candidate = `${json.slice(0, cut + 1)}]}`;
    try {
      return parseExtractResponse(candidate, documentText);
    } catch {
      cut = json.lastIndexOf("}", cut - 1);
    }
  }
  return [];
}

// ---- PMO-FEA-0006: Extract-Parsing (DOM-frei, deterministisch testbar) ----------------------

// Obergrenzen: begrenzte Punkteliste (Review-bar in einer Sitzung) und gedeckelte Feldlängen.
export const MAX_EXTRACT_POINTS = 20;
export const MAX_EXCERPT_LENGTH = 400;
// SCRUM-411/418: Antwort-Limit für extract — abgeschnittenes JSON war eine Ursache des
// Pedi-Befunds „kein KI-Modell trotz grünem Key-Test" (03.07.). 4096 reichte bei einem
// 42.000-Zeichen-PDF nicht → jetzt 16384, PLUS Ausgabe-Begrenzung im Prompt (≤12 Punkte),
// robuste JSON-Extraktion (Prosa/Fences ignorieren) PLUS Rettung gekürzter Antworten.
export const EXTRACT_MAX_TOKENS = 16384;
// SCRUM-418: Ausgabe ehrlich begrenzen — weniger, dafür vollständige Punkte.
export const EXTRACT_PROMPT_MAX_POINTS = 12;
// Dokumenttext-Deckel für den Modell-Aufruf — bewusst großzügig, aber endlich (Token-Schutz).
export const MAX_EXTRACT_DOCUMENT_LENGTH = 60_000;

// Whitespace-normalisierter, case-insensitiver Substring-Check: die Belegstelle muss wirklich
// im Dokument stehen. Das ist der harte G-2-Gate gegen erfundene/paraphrasierte „Zitate".
function normalizeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// SCRUM-418: nur Buchstaben/Ziffern, kleingeschrieben. Fällt Silbentrennung (Dosier-\npumpe),
// Zeilenumbrüche, Bindestriche und Sonderzeichen aus der PDF-Extraktion weg — genau die
// Artefakte, an denen echte Zitate sonst am G-2-Gate scheiterten.
function alnumOnly(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function excerptFoundInDocument(excerpt: string, documentText: string): boolean {
  const needle = normalizeForMatch(excerpt);
  if (needle.length === 0) {
    return false;
  }
  if (normalizeForMatch(documentText).includes(needle)) {
    return true;
  }
  // Toleranter Rückfall gegen PDF-Artefakte (Silbentrennung/Umbrüche/Sonderzeichen).
  // Mindestlänge 12, damit der lockerere Vergleich keine Zufallstreffer erzeugt.
  const alnumNeedle = alnumOnly(excerpt);
  if (alnumNeedle.length < 12) {
    return false;
  }
  return alnumOnly(documentText).includes(alnumNeedle);
}

// Modell-Antwort → geprüfte Punkteliste. Ehrlichkeit vor Vollständigkeit:
//  - Punkte ohne Titel ODER ohne im Dokument auffindbare Belegstelle werden VERWORFEN.
//  - Fehlende summary fällt auf den Titel zurück (keine Erfindung, nur Wiederholung).
//  - Liste und Feldlängen sind gedeckelt (MAX_EXTRACT_POINTS / MAX_EXCERPT_LENGTH).
// Wirft bei strukturell unbrauchbarer Antwort (kein JSON) — der Reasoner fällt dann auf den
// deterministischen, ehrlichen Fallback zurück (runTask-Mechanik).
export function parseExtractResponse(raw: string, documentText: string): ExtractedPoint[] {
  const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  const list = Array.isArray(parsed.points) ? parsed.points : [];
  const points: ExtractedPoint[] = [];
  for (const entry of list) {
    if (points.length >= MAX_EXTRACT_POINTS) {
      break;
    }
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const title = String(rec.title ?? "").trim();
    const summary = String(rec.summary ?? "").trim();
    const sourceExcerpt = String(rec.sourceExcerpt ?? "")
      .trim()
      .slice(0, MAX_EXCERPT_LENGTH);
    if (title.length === 0 || !excerptFoundInDocument(sourceExcerpt, documentText)) {
      continue; // G-2: kein Punkt ohne echte Belegstelle im Dokument
    }
    points.push({ title, summary: summary || title, sourceExcerpt });
  }
  return points;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

// Echter Provider: nutzt ein Modell über den injizierten Client, bleibt aber in den
// vorhandenen KOs verankert (Anti-Halluzination: Quellen/Trust kommen aus den Daten,
// das Modell formuliert nur). Ohne Client → nicht verfügbar → Reasoner nimmt den Fallback.
export class ModelProvider implements ReasonerProvider {
  readonly name: string;
  private readonly client: ModelClient | undefined;

  constructor(client?: ModelClient) {
    this.client = client;
    this.name = client?.name ?? "model";
  }

  isAvailable(): boolean {
    return this.client !== undefined;
  }

  // Key-Test (Pedi 02.07.): kleinstmöglicher Echtaufruf. Beweist Schlüssel + Modellzugang;
  // Fehler (z. B. 401 = Schlüssel ungültig) laufen unverändert nach oben — nichts wird geraten.
  async probe(): Promise<string> {
    const client = this.requireClient();
    return client.complete("Antworte mit genau einem Wort: OK", "ping");
  }

  // SCRUM-360: begrenzte, status-/trust-bewusste Kandidatenauswahl (siehe selectCandidates) — das
  // Modell bekommt nur eine gedeckelte, relevant gerankte Quellenmenge statt aller KOs.
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    return selectCandidates(question, candidates);
  }

  async structure(rawText: string, locale: ReasonerLocale = "de"): Promise<StructureResult> {
    const client = this.requireClient();
    const raw = await client.complete(structureSystem(locale), rawText);
    const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    const firstSentence = rawText.split(/[.!?]/)[0]?.trim() ?? rawText.trim();
    return {
      title: String(parsed.title ?? firstSentence).trim(),
      statement: String(parsed.statement ?? rawText).trim(),
      conditions: asStringArray(parsed.conditions),
      measures: asStringArray(parsed.measures),
      tags: asStringArray(parsed.tags),
      confidence: clamp01(Number(parsed.confidence ?? 0)),
      demo: false,
    };
  }

  async assistText(
    text: string,
    locale: ReasonerLocale = "de",
    instruction?: string,
  ): Promise<AssistResult> {
    const client = this.requireClient();
    // SCRUM-312: optionale Anweisung als zusätzliche Leitplanke an das System-Prompt hängen —
    // der „keine Inhalte/Fakten erfinden"-Schutz aus assistSystem bleibt vollständig erhalten.
    const guidance = instruction?.trim();
    const system = guidance
      ? `${assistSystem(locale)}\n${assistGuidance(locale, guidance)}`
      : assistSystem(locale);
    const improved = (await client.complete(system, text)).trim();
    return { text: improved || text.trim(), demo: false };
  }

  // SCRUM-132: Modell formuliert nur die nächste Frage; Abschluss + Draft-Verdichtung
  // bleiben deterministisch (kein Erfinden von Inhalt). demo=false, da Modell genutzt.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
  ): Promise<InterviewResult> {
    const base = deterministicInterview(answers, false, locale);
    if (base.done || base.question === null) {
      return base;
    }
    const client = this.requireClient();
    const labels = LABELS[locale];
    const prior = answers.map((a, i) => `A${i + 1}: ${a}`).join("\n");
    const phrased = (
      await client.complete(
        interviewSystem(locale),
        `${labels.priorAnswers}:\n${prior || labels.none}\n\n${labels.guiding}: ${base.question}`,
      )
    ).trim();
    return { ...base, question: phrased || base.question };
  }

  // PMO-FEA-0006: Wissens-Extraktion über das Modell. Die Antwort wird serverseitig gegen den
  // Dokumenttext geprüft (parseExtractResponse) — Punkte ohne echte Belegstelle fliegen raus.
  async extract(
    documentText: string,
    locale: ReasonerLocale = "de",
    query?: string,
  ): Promise<ExtractResult> {
    const client = this.requireClient();
    const doc = documentText.trim().slice(0, MAX_EXTRACT_DOCUMENT_LENGTH);
    if (doc.length === 0) {
      return {
        points: [],
        note:
          locale === "en"
            ? "The document contains no extractable text."
            : "Das Dokument enthält keinen auswertbaren Text.",
        demo: false,
      };
    }
    const guidance = query?.trim();
    const system = guidance
      ? `${extractSystem(locale)}\n${extractGuidance(locale, guidance)}`
      : extractSystem(locale);
    // SCRUM-411/418: großes Antwort-Limit — bei 1024 (und selbst 4096) Token wurde das
    // Punkte-JSON realer Dokumente abgeschnitten (Pedi-Tests 03.07., 42k-Zeichen-PDF).
    const raw = await client.complete(system, doc, EXTRACT_MAX_TOKENS);
    let points: ExtractedPoint[];
    let truncated = false;
    try {
      points = parseExtractResponse(raw, doc);
    } catch {
      // SCRUM-418: erst vollständige Punkte aus der gekürzten Antwort retten;
      // nur wenn NICHTS zu retten ist, ehrlich scheitern (SCRUM-411-Meldeweg).
      points = salvageTruncatedExtract(raw, doc);
      truncated = true;
      if (points.length === 0) {
        throw new Error(
          locale === "en"
            ? "model response was not valid JSON (possibly truncated)"
            : "Modell-Antwort war kein gültiges JSON (möglicherweise abgeschnitten)",
        );
      }
    }
    return {
      points,
      // Ehrlich: gekürzte Antwort wird benannt; leere Liste bekommt eine Erklärung.
      note: truncated
        ? locale === "en"
          ? "Note: the model response was cut off — this list may be incomplete. Every shown point still carries a verified source excerpt."
          : "Hinweis: Die Modell-Antwort wurde gekürzt — diese Liste ist möglicherweise unvollständig. Jeder angezeigte Punkt trägt weiterhin eine geprüfte Belegstelle."
        : points.length > 0
          ? null
          : locale === "en"
            ? "No knowledge points with a verifiable source excerpt were found in this document."
            : "In diesem Dokument wurden keine Wissenspunkte mit belegbarer Textstelle gefunden.",
      demo: false,
    };
  }

  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    // SCRUM-360: begrenzte, status-/trust-bewusste Top-K-Auswahl → das Modell bekommt nur eine
    // gedeckelte, relevant gerankte Quellenmenge (kein blindes Durchreichen aller KOs).
    const relevant = selectCandidates(question, context);
    // FR-RSN-03: ohne belastbares Wissen keine Rateantwort — Modell wird gar nicht erst befragt.
    const best = relevant[0];
    if (!best) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: false,
      };
    }
    const client = this.requireClient();
    const labels = LABELS[locale];
    const grounding = relevant.map((r, i) => `[${i + 1}] ${r.title}: ${r.statement}`).join("\n");
    const answerText = (
      await client.complete(
        answerSystem(locale),
        `${labels.question}: ${question}\n\n${labels.sources}:\n${grounding}`,
      )
    ).trim();
    return {
      answered: true,
      answer: answerText,
      knowledgeClass: best.status === "validiert" ? "gesichert" : "ungeprueft",
      trust: best.trust,
      sources: relevant.map((r) => r.id),
      steps: relevant.map((r) => ({
        description: sourceLabel(r.title, locale),
        sourceId: r.id,
        snippet: r.statement,
      })),
      demo: false,
    };
  }

  // SCRUM-426: Public-KI-Anreicherung — externer Modell-Beitrag (Weltwissen), knapp gehalten.
  // Immer extern/ungeprüft; die Übernahme entscheidet der Mensch. demo=false (echtes Modell).
  async enrichPublic(query: string, locale: ReasonerLocale = "de"): Promise<EnrichResult> {
    const client = this.requireClient();
    const text = (await client.complete(enrichPublicSystem(locale), query, 1024)).trim();
    return { text, provider: this.name, demo: false };
  }

  private requireClient(): ModelClient {
    if (!this.client) {
      throw new Error("Kein Modell-Client konfiguriert.");
    }
    return this.client;
  }
}
