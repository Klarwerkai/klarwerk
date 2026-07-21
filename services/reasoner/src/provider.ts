import type {
  AnswerResult,
  AssistResult,
  CandidateGroup,
  ConflictJudgeResult,
  DescribeImageResult,
  DuplicateJudgeResult,
  EnrichResult,
  ExtractResult,
  GroupCandidateInput,
  GroupCandidatesResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerLocale,
  StructureResult,
} from "./types";

// WP-IC-4: EHRLICHE deterministische Gruppierung nach den IC-1-Themen — der Fallback ohne
// funktionierendes Modell (und die Basis der „Ohne KI gruppiert"-Kennzeichnung). Kandidaten ohne
// Thema landen in der markierten „Ohne Thema"-Gruppe (kind: "no-theme"; die UI lokalisiert
// DE/EN/NL selbst — der Titel hier ist nur der DE/EN-Serverwert). Deterministisch: Gruppen nach
// Größe absteigend, bei Gleichstand nach Titel (fester Codepoint-Vergleich, keine ICU-Collation);
// die Ids je Gruppe behalten die Eingabereihenfolge.
export function deterministicCandidateGroups(
  candidates: readonly GroupCandidateInput[],
  locale: ReasonerLocale = "de",
): CandidateGroup[] {
  const byTheme = new Map<string, string[]>();
  const noTheme: string[] = [];
  for (const candidate of candidates) {
    const theme = candidate.theme?.trim();
    if (theme && theme.length > 0) {
      const ids = byTheme.get(theme) ?? [];
      ids.push(candidate.id);
      byTheme.set(theme, ids);
    } else {
      noTheme.push(candidate.id);
    }
  }
  const groups: CandidateGroup[] = [...byTheme.entries()]
    .map(([title, ids]) => ({ title, ids }))
    .sort((a, b) => b.ids.length - a.ids.length || (a.title < b.title ? -1 : 1));
  if (noTheme.length > 0) {
    groups.push({
      title: locale === "en" ? "Without topic" : "Ohne Thema",
      ids: noTheme,
      kind: "no-theme",
    });
  }
  return groups;
}

// FR-RSN-02: anbieteragnostisch — jede Implementierung (lokales Modell, Cloud, Mock)
// erfüllt diese Schnittstelle und ist ohne Änderung der Fachlogik austauschbar.
// FR-I18N-01: optionale locale steuert Sprache von Prompt/Frage/Label (Default "de").
export interface ReasonerProvider {
  readonly name: string;
  isAvailable(): boolean;
  // structure/answer sind async — ein echtes Modell ruft über das Netz.
  // SCRUM-502 Schicht 2: optionales `confidential` — der ModelProvider reicht es an den
  // Chokepoint (cappedModelClient.complete) durch; der deterministische Fallback ignoriert es.
  structure(
    rawText: string,
    locale?: ReasonerLocale,
    confidential?: boolean,
  ): Promise<StructureResult>;
  answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale?: ReasonerLocale,
  ): Promise<AnswerResult>;
  // FR-RSN-03: Text sprachlich präzisieren (ohne Inhalt zu erfinden).
  // SCRUM-312: optionale, frei-/aktionsbasierte Anweisung (z. B. „klarer", „strukturieren").
  // Der deterministische Fallback ignoriert sie bewusst (generische Glättung); nur das Modell
  // berücksichtigt sie — und niemals durch Erfinden von Inhalten/Fakten.
  assistText(
    text: string,
    locale?: ReasonerLocale,
    instruction?: string,
    confidential?: boolean,
  ): Promise<AssistResult>;
  // SCRUM-132: nächste Interview-Frage + aus den Antworten verdichteter Entwurf.
  interview(
    answers: readonly string[],
    locale?: ReasonerLocale,
    confidential?: boolean,
  ): Promise<InterviewResult>;
  // PMO-FEA-0006: Wissenspunkte aus Dokumenttext extrahieren (optional mit Suchauftrag des
  // Experten). G-2: NUR was im Text steht — der deterministische Fallback liefert ehrlich
  // KEINE Punkte (keine Fake-Extraktion), nur eine erklärende note.
  // SCRUM-451 (Pedi 05.07.): keepSourceLanguage = Ergebnis bleibt in der Sprache des Dokuments
  // (nichts uebersetzen) statt in der UI-Sprache. Belegstellen sind ohnehin immer woertlich.
  extract(
    documentText: string,
    locale?: ReasonerLocale,
    query?: string,
    keepSourceLanguage?: boolean,
    confidential?: boolean,
  ): Promise<ExtractResult>;
  // select ist reines Ranking (synchron, kein Netzaufruf).
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[];
  // Klara Stufe 2 (Pedi 05.07.): Hilfe-Antwort GENERIEREN — Wissensdatenbank (Hilfe-Eintraege)
  // plus eigene KI-Logik (folgern/kombinieren erlaubt). Das Frontend kennzeichnet das Ergebnis
  // IMMER als KI-generiert und nicht vollständig geprüft. NUR das echte Modell implementiert
  // das; der deterministische Fallback bleibt bei der strikten answer()-Zitierlogik.
  helpAnswer?(
    question: string,
    context: readonly KnowledgeRef[],
    locale?: ReasonerLocale,
  ): Promise<AnswerResult>;
  // SCRUM-426: Public-KI-Anreicherung — bewusst NICHT quellengebunden (Modell-Weltwissen).
  // NUR das echte Modell implementiert das; der deterministische Fallback bewusst NICHT
  // (er kann kein externes Wissen beisteuern). Ergebnis ist immer extern/ungeprüft.
  enrichPublic?(query: string, locale?: ReasonerLocale): Promise<EnrichResult>;
  // Berater-Konzept 04.07. (Stufe 2, kon-v1): „Konfliktprüfung" — urteilt rein inhaltlich, ob zwei
  // Kerntexte einander widersprechen/doppeln/überholen. NUR das echte Modell kann das; der
  // deterministische Fallback implementiert es bewusst NICHT (kein regelbasierter Pseudo-Detektor,
  // Ehrlichkeit vor Optik). Ungültige/leere Antworten → null (kein Konflikt aus kaputten Antworten).
  judgeConflict?(
    coreA: string,
    coreB: string,
    locale?: ReasonerLocale,
  ): Promise<ConflictJudgeResult | null>;
  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): „Duplikatprüfung" — beurteilt die
  // Überschneidung zweier Kerntexte (Beziehung/Grad/gemeinsame Aussagen/Empfehlung). NUR das echte
  // Modell; der deterministische Fallback bewusst NICHT. Ungültige Antworten → null.
  judgeDuplicate?(
    coreA: string,
    coreB: string,
    locale?: ReasonerLocale,
  ): Promise<DuplicateJudgeResult | null>;
  // Key-Test (Pedi 02.07.): kleinstmöglicher Echtaufruf — beweist Schlüssel + Modellzugang.
  // Optional: der deterministische Fallback hat bewusst keinen (nichts zu testen).
  probe?(): Promise<string>;
  // WP-BILD-1c: KI-Bildbeschreibung als Vorschlag (Vision). NUR ein Modell-Provider mit echtem
  // Bild-Eingang implementiert das; der deterministische Fallback bewusst NICHT — eine
  // Bildbeschreibung ohne Modell wäre per Definition erfunden (Ehrlichkeit vor Optik).
  describeImage?(
    dataUrl: string,
    locale?: ReasonerLocale,
    confidential?: boolean,
  ): Promise<DescribeImageResult>;
  // WP-IC-4: thematische Gruppierung der Import-Kandidaten. Der deterministische Fallback
  // implementiert sie EHRLICH über die mitgelieferten IC-1-Themen (kein Pseudo-Modell) — der
  // Cockpit-Flow bleibt damit IMMER benutzbar; die UI kennzeichnet „Ohne KI gruppiert".
  groupCandidates?(
    candidates: readonly GroupCandidateInput[],
    locale?: ReasonerLocale,
    confidential?: boolean,
  ): Promise<GroupCandidatesResult>;
}

// PMO-FEA-0006: ehrliche Fallback-Meldung — ohne Modell ist keine inhaltliche Wissens-
// Extraktion möglich. Es werden bewusst KEINE deterministischen Pseudo-Punkte erzeugt
// (jede Heuristik würde „gefundenes Wissen" vortäuschen — G-2/FR-RSN-04).
export function honestExtractUnavailable(locale: ReasonerLocale = "de"): ExtractResult {
  return {
    points: [],
    note:
      locale === "en"
        ? "Without an AI model, no knowledge extraction is possible. The document text was NOT analyzed — no fake points are shown. You can still copy relevant passages into the free-text mode yourself."
        : "Ohne KI-Modell ist keine Wissens-Extraktion möglich. Der Dokumenttext wurde NICHT analysiert — es werden keine Schein-Punkte angezeigt. Du kannst relevante Stellen weiterhin selbst in den Freitext-Modus übernehmen.",
    demo: true,
  };
}

// SCRUM-411 (Pedi-Test 03.07.): Modell KONFIGURIERT, aber der Aufruf ist gescheitert — das
// ist ein ANDERER Fall als „kein Modell" und wird ehrlich benannt (kein falscher „kein
// KI-Modell"-Befund bei grünem Schlüssel). Weiterhin bewusst KEINE Pseudo-Punkte (G-2).
export function honestExtractModelFailed(
  detail: string,
  locale: ReasonerLocale = "de",
): ExtractResult {
  return {
    points: [],
    note:
      locale === "en"
        ? `The AI model is configured, but the extraction call failed (${detail}). The document text was NOT analyzed — no fake points are shown. Try again; if the error persists, run the key test in the admin area.`
        : `Das KI-Modell ist konfiguriert, aber der Extraktions-Aufruf ist fehlgeschlagen (${detail}). Der Dokumenttext wurde NICHT analysiert — es werden keine Schein-Punkte angezeigt. Versuch es erneut; bleibt der Fehler, hilft der Schlüssel-Test im Admin-Bereich.`,
    demo: true,
  };
}

// SCRUM-132 / FR-I18N-01: feste Fragenfolge je Sprache (eine Frage pro Turn) — vom Modell
// nur umformulierbar, nie inhaltlich erfunden. Index = Anzahl bisher gegebener Antworten.
export const INTERVIEW_QUESTIONS: Record<ReasonerLocale, readonly string[]> = {
  de: [
    "Worum geht es? Formuliere die Kernaussage in einem Satz.",
    "Unter welchen Bedingungen oder ab wann gilt das?",
    "Welche Maßnahme oder Konsequenz folgt daraus?",
    "Welche Stichworte/Tags helfen beim Wiederfinden? (kommagetrennt)",
  ],
  en: [
    "What is this about? State the core message in one sentence.",
    "Under what conditions or from when does this apply?",
    "What action or consequence follows from it?",
    "Which keywords/tags help to find it again? (comma-separated)",
  ],
};

// FR-I18N-01: sprachbewusstes Label für eine Beleg-/Quellenangabe (kein Quelleninhalt).
export function sourceLabel(title: string, locale: ReasonerLocale = "de"): string {
  return locale === "en" ? `Source: ${title}` : `Quelle: ${title}`;
}

// Verdichtet die bisherigen Antworten nachvollziehbar zu einem KO-Entwurf.
// Rein deterministisch — erfindet keinen Inhalt, mappt nur Antwort → Feld.
export function condenseInterview(answers: readonly string[], demo: boolean): StructureResult {
  const a = answers.map((s) => s.trim());
  const tags = a[3]
    ? a[3]
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  return {
    title: a[0] ?? "",
    statement: a[0] ?? "",
    conditions: a[1] ? [a[1]] : [],
    measures: a[2] ? [a[2]] : [],
    tags,
    confidence: 0,
    demo,
  };
}

// SCRUM-132 / FR-I18N-01: deterministischer Interview-Turn — nächste Standardfrage (in der
// gewählten Sprache) + Abschluss bei ausreichendem Inhalt (Kernaussage + Bedingung + Maßnahme).
export function deterministicInterview(
  answers: readonly string[],
  demo: boolean,
  locale: ReasonerLocale = "de",
): InterviewResult {
  const questions = INTERVIEW_QUESTIONS[locale];
  const core = (answers[0]?.trim().length ?? 0) > 0;
  const hasCond = (answers[1]?.trim().length ?? 0) > 0;
  const hasMeas = (answers[2]?.trim().length ?? 0) > 0;
  const sufficient = core && hasCond && hasMeas;
  const done = answers.length >= questions.length || sufficient;
  return {
    question: done ? null : (questions[answers.length] ?? null),
    done,
    draft: condenseInterview(answers, demo),
    demo,
  };
}

// SCRUM-282: Funktions-/Stoppwörter (DE/EN) aus dem Matching ausschließen. Sonst erscheinen
// lange/offtopic Fragen über zufällige Überschneidung gängiger Wörter (z. B. „ist", „die", „von")
// als belegte Antwort. Nur Inhaltstoken zählen → ehrliche Wissenslücke statt Scheinquelle.
// Bewusst nur generische Funktionswörter (keine Fach-/Domänenbegriffe), damit seed-sichere
// Treffer (Ventil/Überdruck, Filter F3 …) unverändert bleiben.
const STOPWORDS = new Set<string>([
  // Deutsch — Artikel, Pronomen, Präpositionen, Konjunktionen, Hilfs-/Frageworte
  "aber",
  "alle",
  "allem",
  "allen",
  "aller",
  "alles",
  "als",
  "also",
  "auch",
  "auf",
  "aus",
  "bei",
  "bin",
  "bis",
  "bist",
  "das",
  "dass",
  "dein",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "dir",
  "doch",
  "dort",
  "durch",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "er",
  "es",
  "etwas",
  "euer",
  "für",
  "gegen",
  "hat",
  "hatte",
  "hier",
  "ich",
  "ihm",
  "ihr",
  "ihre",
  "ist",
  "kann",
  "man",
  "mein",
  "mit",
  "muss",
  "nach",
  "nicht",
  "noch",
  "nur",
  "ob",
  "oder",
  "ohne",
  "sehr",
  "sein",
  "sich",
  "sie",
  "sind",
  "soll",
  "über",
  "uns",
  "und",
  "unter",
  "viel",
  "vom",
  "von",
  "vor",
  "war",
  "was",
  "weil",
  "welche",
  "welchem",
  "welchen",
  "welcher",
  "welches",
  "wenn",
  "wer",
  "werde",
  "werden",
  "wie",
  "wird",
  "wo",
  "wann",
  "warum",
  "zum",
  "zur",
  "zwischen",
  // Englisch — häufige Funktionswörter (locale kann en sein)
  "the",
  "and",
  "for",
  "are",
  "you",
  "your",
  "what",
  "when",
  "how",
  "why",
  "with",
  "this",
  "that",
  "not",
  "from",
  "into",
  "does",
  "did",
  "can",
  "has",
  "have",
  "their",
  "them",
  "they",
  "there",
  "here",
  "about",
  "over",
  "please",
  "note",
  "context",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function overlap(a: readonly string[], b: readonly string[]): number {
  const set = new Set(b);
  let count = 0;
  for (const word of a) {
    if (set.has(word)) {
      count += 1;
    }
  }
  return count;
}

// SCRUM-361 / AG-03: öffentliche, stabile Tokenisierung der Frage in Inhaltstoken (Stoppwörter und
// Kurzwörter entfernt). Identisch zur internen Ranking-Tokenisierung → der Repo-Prefilter (Ask)
// nutzt EXAKT dieselben Terme wie das Ranking (`selectCandidates`), bleibt also konsistent. Reine
// Funktion ohne Seiteneffekt; kein Quelleninhalt wird verändert.
export function queryTokens(text: string): string[] {
  return tokenize(text);
}

// WP-RETEST7 R5: der durchsuchbare Text eines Refs — Titel + Aussage + (falls vorhanden) die
// persistierten Bild-Fußnoten. EINE Quelle für keywordSelect UND rankCandidates, damit ein KO,
// dessen Wissen nur in der Fußnote steht, das Relevanz-Gate passieren kann.
export function refMatchText(ref: KnowledgeRef): string {
  const captions = ref.captionTexts?.length ? ` ${ref.captionTexts.join(" ")}` : "";
  return `${ref.title} ${ref.statement}${captions}`;
}

// Semantische Vorauswahl über Keyword-Überschneidung — synchron, modellunabhängig.
// Von beiden Providern genutzt, damit Antworten immer in echten KOs verankert bleiben.
export function keywordSelect(
  question: string,
  candidates: readonly KnowledgeRef[],
): KnowledgeRef[] {
  const words = tokenize(question);
  return candidates
    .map((c) => ({ c, score: overlap(words, tokenize(refMatchText(c))) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

// SCRUM-360 / AG-03 / FR-ASK-02 / NFR-PERF-03: begrenzte, status-/trust-bewusste Top-K-Kandidaten-
// auswahl. Ziel ist sichtbarer Beta-Fortschritt OHNE RAG/Embeddings/Suchmaschine/DB-Umbau: Ask reicht
// nicht mehr blind alle KOs an den Reasoner/das Modell durch, sondern eine klar begrenzte, nachvoll-
// ziehbar gerankte Auswahl. Default-Obergrenze für die Kandidatenliste (pro Frage).
export const DEFAULT_TOP_K = 8;

// Status-/Trust-Bonus für das Ranking — STRIKT < 1, damit eine höhere Keyword-Überschneidung IMMER
// gewinnt (irrelevante Störer können nie über relevantere KOs steigen). Innerhalb gleicher Relevanz
// bevorzugt der Bonus validierte/„ready" Quellen und höheren Trust. Trust HILFT, ist aber keine
// Wahrheit (PI-K2) → nur als feiner Tiebreaker, nicht als eigenständiges Relevanzsignal. Konflikt-
// wirkung (SCRUM-357/358) fließt bereits über Status/Trust ein (ein Truth-Konflikt setzt ein KO
// serverseitig auf „offen" + senkt den Trust), daher kein Widerspruch zu diesen Signalen.
export function statusTrustBoost(ref: Pick<KnowledgeRef, "status" | "trust">): number {
  const statusBonus = ref.status === "validiert" ? 0.5 : 0;
  const trust = Math.max(0, Math.min(100, ref.trust));
  const trustBonus = (trust / 100) * 0.4; // max 0.4 → Summe max 0.9 (< 1)
  return statusBonus + trustBonus;
}

export interface RankedCandidate {
  ref: KnowledgeRef;
  keywordScore: number; // reine Relevanz (Keyword-Überschneidung) — der dominante Gate.
  rankScore: number; // keywordScore + gedeckelter Status-/Trust-Bonus (< 1).
}

// Nachvollziehbares, DOM-freies Ranking: (1) Relevanz-Gate (Keyword-Überschneidung > 0), (2) stabile
// Sortierung nach rankScore (Relevanz dominiert, Status/Trust als Tiebreak), (3) harte Begrenzung auf
// topK Kandidaten. Bei Gleichstand bleibt die Eingabereihenfolge erhalten (stabil).
export function rankCandidates(
  question: string,
  candidates: readonly KnowledgeRef[],
  topK: number = DEFAULT_TOP_K,
): RankedCandidate[] {
  const words = tokenize(question);
  const limit = Math.max(1, Math.floor(topK));
  return candidates
    .map((ref) => {
      // WP-RETEST7 R5: gleiche Match-Basis wie keywordSelect — inkl. Bild-Fußnoten (captionTexts).
      const keywordScore = overlap(words, tokenize(refMatchText(ref)));
      return { ref, keywordScore, rankScore: keywordScore + statusTrustBoost(ref) };
    })
    .filter((x) => x.keywordScore > 0)
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, limit);
}

// Begrenzte, status-/trust-bewusste Kandidatenliste (nur die Refs, in Rangfolge). Ersetzt das
// frühere „alle Keyword-Treffer unbegrenzt" — Antworten bleiben quellengebunden, aber die an den
// Reasoner/das Modell gereichte Menge ist gedeckelt und bevorzugt validierte/ready Quellen.
export function selectCandidates(
  question: string,
  candidates: readonly KnowledgeRef[],
  topK: number = DEFAULT_TOP_K,
): KnowledgeRef[] {
  return rankCandidates(question, candidates, topK).map((x) => x.ref);
}

// FR-RSN-04: deterministischer Fallback ohne Modell. Immer verfügbar, Ergebnisse
// klar als Demo markiert; semantische Auswahl über Keyword-Überschneidung.
// G-2: erkennt Eingaben ohne verwertbare Fachinformation (nur Zeichen/Zahlen, zu kurz,
// kein beschreibender Text). Bewusst konservativ — im Zweifel wird normal strukturiert.
export function isNonInformative(rawText: string): boolean {
  const t = rawText.trim();
  if (t.length === 0) {
    return true;
  }
  const letters = (t.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length;
  if (letters < 4) {
    return true; // nur Zahlen/Symbole oder Einzelbuchstaben ("123", "qwe?" -> qwe hat 3)
  }
  const words = t.split(/\s+/).filter((w) => (w.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length >= 3);
  return words.length < 2; // ein einzelnes Kürzel ohne Kontext ist keine Fachaussage
}

// Ehrlicher Entwurf im Stil der Alt-App: benennt das Problem, wann das gilt und was zu tun ist.
export function honestNonInformativeDraft(
  rawText: string,
  locale: ReasonerLocale,
): StructureResult {
  const shown = rawText.trim().slice(0, 40) || "(leer)";
  if (locale === "en") {
    return {
      title: "Insufficient expert input — no usable information",
      statement: `The input '${shown}' contains no usable domain information. A structured knowledge derivation is not possible from this input.`,
      conditions: [
        "When the expert input consists only of non-informative characters or numbers",
        "When no domain hint and no descriptive text are provided",
      ],
      measures: [
        "Ask the expert to re-enter meaningful free text",
        "Request a domain hint and context description",
        "Do not save this input as a knowledge object",
      ],
      tags: [],
      confidence: 0,
      demo: true,
    };
  }
  return {
    title: "Unzureichende Expertenangabe – keine verwertbare Information",
    statement: `Die Eingabe '${shown}' enthält keine verwertbaren Fachinformationen. Eine strukturierte Wissensableitung ist auf Basis dieser Eingabe nicht möglich.`,
    conditions: [
      "Wenn die Experteneingabe ausschließlich aus nicht-informativen Zeichen oder Zahlen besteht",
      "Wenn kein Domänenhinweis und kein beschreibender Text vorhanden sind",
    ],
    measures: [
      "Experten zur erneuten Eingabe mit aussagekräftigem Freitext auffordern",
      "Domänenhinweis und Kontextbeschreibung anfordern",
      "Eingabe nicht als Wissensobjekt speichern",
    ],
    tags: [],
    confidence: 0,
    demo: true,
  };
}

export class DeterministicProvider implements ReasonerProvider {
  readonly name = "deterministic";

  isAvailable(): boolean {
    return true;
  }

  async structure(rawText: string, locale: ReasonerLocale = "de"): Promise<StructureResult> {
    // G-2 (Verhalten der Alt-App, Pedi-Review 02.07.2026): Unbrauchbare Eingaben werden
    // NICHT brav in Felder gekippt, sondern ehrlich als "keine verwertbare Information"
    // strukturiert — mit Geltungsbedingungen und klarem Vorgehen statt Fake-Entwurf.
    if (isNonInformative(rawText)) {
      return honestNonInformativeDraft(rawText, locale);
    }
    const firstSentence = rawText.split(/[.!?]/)[0]?.trim() ?? rawText.trim();
    return {
      title: firstSentence,
      statement: rawText.trim(),
      conditions: [],
      measures: [],
      tags: [],
      confidence: 0,
      demo: true,
    };
  }

  // WP-IC-4: ehrliche Themen-Gruppierung ohne Modell (demo:true) — der Cockpit-Flow bleibt
  // IMMER benutzbar; die UI kennzeichnet das Ergebnis als „Ohne KI gruppiert".
  async groupCandidates(
    candidates: readonly GroupCandidateInput[],
    locale: ReasonerLocale = "de",
  ): Promise<GroupCandidatesResult> {
    return { groups: deterministicCandidateGroups(candidates, locale), demo: true };
  }

  // Ohne Modell: deterministische Glättung (Whitespace, Großschreibung, Satzabschluss).
  // Verändert keinen Inhalt — markiert als Demo.
  async assistText(text: string): Promise<AssistResult> {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return { text: "", demo: true };
    }
    const cased = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    const ended = /[.!?]$/.test(cased) ? cased : `${cased}.`;
    return { text: ended, demo: true };
  }

  // SCRUM-132 / FR-I18N-01: deterministischer Fallback, klar als Demo markiert.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
  ): Promise<InterviewResult> {
    return deterministicInterview(answers, true, locale);
  }

  // PMO-FEA-0006: ohne Modell KEINE Extraktion — ehrliche Meldung statt Fake-Punkte (G-2).
  async extract(_documentText: string, locale: ReasonerLocale = "de"): Promise<ExtractResult> {
    return honestExtractUnavailable(locale);
  }

  // SCRUM-360: status-/trust-bewusste, auf topK begrenzte Kandidatenauswahl statt unbegrenztem
  // reinem Keyword-Ranking. Relevanz bleibt dominanter Gate; validierte/ready Quellen werden bei
  // gleicher Relevanz bevorzugt.
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    return selectCandidates(question, candidates);
  }

  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    const relevant = this.select(question, context);
    // FR-RSN-03: keine Rateantwort ohne belastbares Wissen.
    if (relevant.length === 0) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: true,
      };
    }
    const best = relevant[0];
    if (!best) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        steps: [],
        demo: true,
      };
    }
    return {
      answered: true,
      answer: best.statement,
      knowledgeClass: best.status === "validiert" ? "gesichert" : "ungeprueft",
      trust: best.trust,
      // SCRUM-256: Die deterministische Antwort (answer/trust/knowledgeClass/steps) wird
      // AUSSCHLIESSLICH aus `best` abgeleitet. Daher nur die tatsächlich genutzte Quelle melden —
      // lose gematchte Kandidaten erscheinen nicht als gleichwertige Antwortquellen (Quellen-
      // ehrlichkeit, Abgrenzung gegen Chatbot-Wahrnehmung). Kein Ranking-/Retrieval-Umbau.
      sources: [best.id],
      steps: [
        {
          description: sourceLabel(best.title, locale),
          sourceId: best.id,
          snippet: best.statement,
        },
      ],
      demo: true,
    };
  }
}
