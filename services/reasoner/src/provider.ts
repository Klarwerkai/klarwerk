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
  KnowledgeClass,
  KnowledgeRef,
  ReasonerLocale,
  StructureResult,
} from "./types";

// ================================================================================================
// AUFTRAG-mega53 BLOCK B1 — WISSENSKLASSE UND VERTRAUENSWERT STEHEN AUF DEN TRAGENDEN QUELLEN.
// ================================================================================================
//
// DER BEFUND (ben, sammel50 ROT-2). mega52 hat die Fußnotenmarken des Modells zurückgelesen und
// `citedSources` eingeführt — Kennzeichnung, Antwort-Beleg und „Danke" folgen ihr seither korrekt.
// Klasse und Vertrauenswert aber kamen weiterhin PAUSCHAL vom ersten konsultierten Kandidaten
// (`best`), gleichgültig, ob er zitiert wurde. Zitiert das Modell nur Quelle 2, bestimmte trotzdem
// Quelle 1 die sichtbare Sicherheit der Antwort. Das ist genau die Zahl, auf die sich das ganze
// Produkt beruft.
//
// DIESE FUNKTION IST DIE EINE ABLEITUNG. Beide Wege benutzen sie — der deterministische Rückfall
// (dort ist die tragende Quelle seit jeher `best`, die Antwort IST ihre Aussage) und der
// Modellmodus (dort ist sie die zurückgelesene Markenmenge). Damit steht die Regel EINMAL, statt
// zweimal auseinanderlaufen zu können.
//
// DIE DREI ENTSCHEIDUNGEN, alle fail-closed:
//
//  1 KLASSE = „gesichert" NUR, wenn JEDE tragende Quelle validiert ist. Eine einzige ungeprüfte
//    Quelle in der Herleitung macht die Aussage ungeprüft; „mindestens eine ist validiert" wäre
//    dieselbe fail-open-Logik, die dieser Auftrag an zwei Stellen beseitigt.
//  2 VERTRAUENSWERT = das MINIMUM über die tragenden Quellen. Eine Antwort ist nicht belastbarer
//    als ihre schwächste Stütze. Ein Mittelwert würde eine schwache Quelle hinter einer starken
//    verstecken, das Maximum täte es offen.
//  3 OHNE TRAGENDE QUELLE WIRD NICHTS BEHAUPTET (B2). Es wird KEINE Quelle geraten: die Klasse
//    fällt auf „ungeprueft" und der Vertrauenswert auf 0 — nicht, weil die Quellen schlecht wären,
//    sondern weil kein quellenbezogener Wert zu rechtfertigen ist. Die Evidenzregel
//    (services/ask/src/answer-evidence.ts) trägt denselben Fall als benannten Vorbehalt, und die
//    Oberfläche zeigt neben „Zuordnung unbekannt" gar keine Zahl mehr.
export function answerStanding(carrying: readonly Pick<KnowledgeRef, "status" | "trust">[]): {
  knowledgeClass: KnowledgeClass;
  trust: number;
} {
  if (carrying.length === 0) {
    return { knowledgeClass: "ungeprueft", trust: 0 };
  }
  return {
    knowledgeClass: carrying.every((r) => r.status === "validiert") ? "gesichert" : "ungeprueft",
    trust: Math.min(...carrying.map((r) => r.trust)),
  };
}

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
      title:
        locale === "en" ? "Without topic" : locale === "nl" ? "Zonder onderwerp" : "Ohne Thema",
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
  // AUFTRAG-mega61 Block G: `confidential` — dieselbe Bauform wie bei `structure` darüber. Bis
  // mega60 war `answer` die EINZIGE Aufgabe ohne diesen Parameter, und deshalb reichte das
  // Modell-Provider hart `false` an den Chokepoint (`cappedModelClient.complete`) durch. Der
  // Wächter, der genau dort vertraulichen Egress abbricht, sieht ausschließlich dieses Boolean —
  // er konnte auf dem Antwortweg also gar nicht auslösen. Der deterministische Fallback ignoriert
  // den Parameter, wie überall.
  answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale?: ReasonerLocale,
    confidential?: boolean,
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
  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): locale UND `confidential` sind PFLICHT — das echte
  // Paar-Bit reist durch den Provider bis zum zentralen ModelClient.complete-Wächter (kein Aufrufer
  // kann die Vertraulichkeit durch Weglassen absenken; der Compiler erzwingt die Deklaration).
  judgeConflict?(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale,
    confidential: boolean,
  ): Promise<ConflictJudgeResult | null>;
  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): „Duplikatprüfung" — beurteilt die
  // Überschneidung zweier Kerntexte (Beziehung/Grad/gemeinsame Aussagen/Empfehlung). NUR das echte
  // Modell; der deterministische Fallback bewusst NICHT. Ungültige Antworten → null.
  // D-AISTATE PAKET 1 (bens V1): `confidential` PFLICHT bis zum Wächter (s. judgeConflict).
  judgeDuplicate?(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale,
    confidential: boolean,
  ): Promise<DuplicateJudgeResult | null>;
  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): Egress-Politik des dahinterliegenden Clients —
  // `true` = dieser Provider darf vertrauliche Inhalte NICHT sehen (Cloud bzw. ein „lokal"
  // verdrahteter Endpunkt ohne bestätigte On-Prem-Origin). Der Reasoner nimmt ihn dann bei
  // vertraulichen Paaren VOR jedem Aufruf aus der Judge-/Provider-Kette. Optional: Provider ohne
  // Marke gelten als vertraulichkeits-tauglich (der Wächter im Client-Wrapper bleibt die harte
  // letzte Instanz am Chokepoint).
  rejectsConfidential?(): boolean;
  // Key-Test (Pedi 02.07.): kleinstmöglicher Echtaufruf — beweist Schlüssel + Modellzugang.
  // Optional: der deterministische Fallback hat bewusst keinen (nichts zu testen).
  probe?(): Promise<string>;
  // WP-BILD-1c: KI-Bildbeschreibung als Vorschlag (Vision). NUR ein Modell-Provider mit echtem
  // Bild-Eingang implementiert das; der deterministische Fallback bewusst NICHT — eine
  // Bildbeschreibung ohne Modell wäre per Definition erfunden (Ehrlichkeit vor Optik).
  // WP-BILD-1f (Pedi 22.07.): OPTIONALER Dokument-Kontext (Klartext) — reist AUSSCHLIESSLICH im
  // selben Vision-Aufruf mit wie das Bild und damit durch DENSELBEN Egress-Wächter. Kein neuer
  // Egress-Pfad; vertraulich = kein Bild UND kein Kontext an die Cloud.
  describeImage?(
    dataUrl: string,
    locale?: ReasonerLocale,
    confidential?: boolean,
    context?: string,
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
  // mega52 D1: eigener Zweig statt stillem Rückfall auf Deutsch.
  nl: [
    "Waar gaat het over? Formuleer de kernboodschap in één zin.",
    "Onder welke voorwaarden of vanaf wanneer geldt dat?",
    "Welke maatregel of consequentie volgt daaruit?",
    "Welke trefwoorden/tags helpen bij het terugvinden? (komma-gescheiden)",
  ],
};

// FR-I18N-01: sprachbewusstes Label für eine Beleg-/Quellenangabe (kein Quelleninhalt).
export function sourceLabel(title: string, locale: ReasonerLocale = "de"): string {
  // mega52 D1: dreisprachig — das Quellen-Label erscheint in den Argumentationsschritten.
  if (locale === "en") {
    return `Source: ${title}`;
  }
  return locale === "nl" ? `Bron: ${title}` : `Quelle: ${title}`;
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
//
// ================================================================================================
// AUFTRAG-mega56 BLOCK A — DIE GRENZE VERLÄUFT AN DER WORTKLASSE.
// ================================================================================================
//
// DER BEFUND (ben, sammel53): mega55 schloss die Possessivpronomen, aber nicht die Fehlerklasse.
// Dieselbe Grundform führt auch Modalformen neu zusammen — „könnte"/„könnten" treffen sich auf
// „könn", „dürfte"/„dürften" auf „dürf", und keine dieser Formen stand in der Liste. Zwei solche
// rein grammatischen Stämme erfüllen `MIN_ANSWER_SUBSTANCE` genauso wie zwei Fachwörter.
//
// DER DENKFEHLER, den diese Runde korrigiert: „alle Funktionswörter" ist KEINE Liste ohne Ende.
// Inhaltswörter — Substantive, Verben, Adjektive — sind die offene Klasse. Funktionswörter bilden
// GESCHLOSSENE Klassen und sind damit abzählbar. Deshalb wird hier nicht der dritte Einzelfall
// repariert, sondern die Klasse geschlossen. Die Grenze ist die Wortklasse, nicht die Wortlänge
// (die Regel „unter fünf Zeichen" griff bei den sechsstelligen Modalformen ins Leere) und nicht
// die Liste der zuletzt gemessenen Fälle.
//
// WIE DIE FORMEN GEFUNDEN WURDEN (A2): nicht geraten, sondern abgeleitet. Zu jedem Eintrag wurden
// die gebräuchlichen Beugungen erzeugt, durch DIESE Zerlegung geschickt, und aufgenommen wurde,
// was als Inhaltstoken überlebte. Deshalb steht hier von jedem Paradigma nur, was die Normalform
// NICHT ohnehin einfängt: „meinem"/„meinen" laufen auf das gelistete „mein" und fehlen hier —
// „meiner" läuft wegen `MIN_GRUNDFORM_LAENGE` auf nichts und steht deshalb da. Wer ergänzt,
// ergänzt in der Klasse, zu der die Form gehört, und prüft sie mit derselben Ableitung.
//
// WAS HIER NICHT MEHR STEHEN MUSS (mega57 A1): die mehrdeutigen Formen, deren Aufnahme ein echtes
// Wort gekostet hätte — „wart"/„Wartung", „falls"/„Fall", „waren"/„Ware", „würde"/„Würde" und die
// übrigen. Sie waren bis mega56 eine benannte, offene Lücke, weil diese Liste nur EINE Antwort
// kennt (ganz weg oder ganz da). Sie sind jetzt in `MEHRDEUTIGE_FUNKTIONSFORMEN` verzeichnet und
// haben dort ihre eigene, schwächere Antwort. Hier gehört nur her, was KEIN echtes Wort trifft.
const STOPWORDS = new Set<string>([
  // --- KLASSE Grundbestand Deutsch (SCRUM-282) ---
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
  // --- KLASSE Personal- und Reflexivpronomen (mega56 A1) ---
  "mich",
  "dich",
  "euch",
  "ihn",
  "ihnen",
  "mir",
  "wir",
  "einander",
  // --- KLASSE Possessivpronomen (mega56 A1) ---
  "meiner",
  "deiner",
  "seiner",
  "ihrem",
  "ihrer",
  "unser",
  "unserer",
  "eure",
  "eurem",
  "eurer",
  // --- KLASSE Demonstrativ- und Relativpronomen (mega56 A1) ---
  "dies",
  "dieser",
  "jene",
  "jenem",
  "jener",
  "solch",
  "solcher",
  "dessen",
  "deren",
  "denen",
  "derer",
  "selbst",
  "selber",
  "derselbe",
  "dieselbe",
  "dasselbe",
  "demselben",
  "denselben",
  "desselben",
  // --- KLASSE Indefinitpronomen (mega56 A1) ---
  "jede",
  "jedem",
  "jeder",
  "manche",
  "mancher",
  "einige",
  "einiger",
  "mehrere",
  "mehrerer",
  "wenige",
  "weniger",
  "beide",
  "beider",
  "andere",
  "anderer",
  "sämtliche",
  "sämtlicher",
  "kein",
  "keiner",
  "jemand",
  "niemand",
  "irgend",
  "irgendein",
  "irgendeiner",
  "jeweils",
  "all",
  // --- KLASSE Präpositionen und Verschmelzungen (mega56 A1) ---
  "hinter",
  "neben",
  "während",
  "außer",
  "entlang",
  "gegenüber",
  "innerhalb",
  "außerhalb",
  "statt",
  "anstatt",
  "trotz",
  "gemäß",
  "binnen",
  "bezüglich",
  "beim",
  "ans",
  "aufs",
  "ins",
  "fürs",
  "unterm",
  "hinterm",
  // mega57 B1 — DIE KLASSE ZU ENDE GESCHRIEBEN. mega56 hat „geschlossene Klasse" behauptet und die
  // Klasse dann nur so weit gefüllt, wie die zuletzt gemessenen Fälle reichten. Der Sammler dieser
  // Runde führt das volle deutsche Inventar; was er hier fand und KEIN echtes Wort trifft, steht
  // jetzt da. Was ein echtes Wort trifft („kraft" → „Kraft"), steht in MEHRDEUTIGE_FUNKTIONSFORMEN.
  "nebst",
  "wider",
  "halber",
  "per",
  "pro",
  "via",
  "zufolge",
  "angesichts",
  "hinsichtlich",
  "aufgrund",
  "infolge",
  "anhand",
  "mithilfe",
  "zugunsten",
  "entgegen",
  "unweit",
  "oberhalb",
  "unterhalb",
  "diesseits",
  "jenseits",
  "betreffs",
  "ungeachtet",
  "zuzüglich",
  "abzüglich",
  "einschließlich",
  "ausschließlich",
  // --- KLASSE Konjunktionen und Subjunktionen (mega56 A1) ---
  "denn",
  "sondern",
  "sowie",
  "sowohl",
  "weder",
  "damit",
  "obwohl",
  "bevor",
  "nachdem",
  "seitdem",
  "sobald",
  "solange",
  "indem",
  "sofern",
  "zumal",
  "jedoch",
  "wobei",
  "außerdem",
  "zudem",
  "beziehungsweise",
  // mega57 B1 — der Rest der Klasse (s. o.).
  "obgleich",
  "wenngleich",
  "soweit",
  "soviel",
  "insofern",
  "insoweit",
  "desto",
  "umso",
  "allein",
  "respektive",
  // --- KLASSE Hilfs- und Modalverben, finite Formen (mega56 A1) ---
  "sei",
  "seid",
  "seien",
  "wäre",
  "warst",
  "wärst",
  // mega57 B1: vom Sammler gefunden, kein echtes Wort dahinter („Wärter" fällt auf „wärter") —
  // deshalb hier und nicht bei den mehrdeutigen Formen. Das Gegenstück „wart" trifft „Wartung".
  "wärt",
  "habe",
  "habt",
  "hast",
  "hätte",
  "wirst",
  "wurde",
  "können",
  "konnte",
  "müssen",
  "dürfen",
  "darf",
  "durfte",
  "mögen",
  "mag",
  "magst",
  "mögt",
  "mochte",
  "möchte",
  // --- KLASSE Unregelmäßige Hilfs-/Modalpartizipien (mega56 A3) ---
  // Ausdrücklich gelistet, weil KEINE Endungs- oder Vorsilbenregel sie herleitet.
  "gewesen",
  "geworden",
  "worden",
  "gehabt",
  "gekonnt",
  "gemusst",
  "gesollt",
  "gedurft",
  "gemocht",
  // mega57 C3 — DIE ATTRIBUTIVE „-er"-FORM MUSS EINZELN DASTEHEN. mega56 hat sie ausgelassen und
  // die Auslassung als „strukturell" bezeichnet; sie ist es nicht. „-er" fehlt zwar absichtlich in
  // `GRUNDFORM_ENDUNGEN` (es kostete „Filter" → „Filt"), aber genau deshalb fällt „gewordener"
  // eben NICHT auf „geworden" zurück, sondern läuft über den „ge"-Abtrag auf das Inhaltstoken
  // „wordener". Erreichbar war die Form also sehr wohl — nur ungeprüft. Die übrigen attributiven
  // Endungen („-e/-em/-en/-es") sind über den Endungsabtrag gedeckt und stehen deshalb nicht hier.
  "gewesener",
  "gewordener",
  "gehabter",
  "gekonnter",
  "gemusster",
  "gesollter",
  "gedurfter",
  "gemochter",
  // --- KLASSE Pronominaladverbien (mega56 A1) ---
  "dabei",
  "dadurch",
  "dafür",
  "dagegen",
  "daher",
  "danach",
  "daneben",
  "daran",
  "darauf",
  "daraus",
  "darin",
  "darum",
  "darunter",
  "darüber",
  "davon",
  "davor",
  "dazu",
  "dennoch",
  "deshalb",
  "deswegen",
  "trotzdem",
  "hierbei",
  "hierdurch",
  "hierfür",
  "hierin",
  "hiermit",
  "hiernach",
  "hierauf",
  "hieraus",
  "hierzu",
  "hieran",
  "hierum",
  "hierüber",
  "wodurch",
  "wofür",
  "woher",
  "wohin",
  "womit",
  "wonach",
  "woran",
  "worauf",
  "woraus",
  "worin",
  "worum",
  "worunter",
  "worüber",
  "wovon",
  "wovor",
  "wozu",
  // mega57 B1 — die Klasse ist GENERATIV ({da|dar|hier|wo|wor} + Präpositionsstamm, „dar"/„wor" vor
  // Vokal). mega56 hat die Erzeugung nicht zu Ende geführt; das hier fehlte.
  "dahin",
  "hierher",
  "hierhin",
  "hiervon",
  "hiervor",
  "hierunter",
  "hiergegen",
  "hierneben",
  "wogegen",
  "woneben",
  // --- KLASSE Partikeln und Frageadverbien (mega56 A1) ---
  "schon",
  "mal",
  "nein",
  "etwa",
  "ganz",
  "gar",
  "zwar",
  "eigentlich",
  "überhaupt",
  "allerdings",
  "immer",
  "wieder",
  "dann",
  "sonst",
  "bereits",
  "jetzt",
  "oben",
  "unten",
  "nie",
  "niemals",
  "sogar",
  "durchaus",
  "vielleicht",
  "womöglich",
  "insbesondere",
  "ebenfalls",
  "ebenso",
  "hingegen",
  "wen",
  "wem",
  "wessen",
  "weshalb",
  "wieso",
  "wieviel",
  "weswegen",
  // mega57 B1 — der Rest der Partikelklasse (s. o.). Die Häufigkeitsadverbien stehen hier und nicht
  // bei den mehrdeutigen Formen, weil ihre Normalform KEIN echtes Wort trifft („selt" ≠ „Seltenheit"
  // → „seltenhei", „stet" ≠ „stetig", „häufig" ≠ „Häufigkeit" → „häufigkei"). Gemessen wurde auch
  // der Preis: keine der zehn Abnahmefragen trägt über eines dieser Wörter — „Wie oft wird der
  // Drehmomentschlüssel kalibriert?" trägt über „drehmomentschlüssel"/„kalibrier". „oft" war
  // umgekehrt der EINZIGE Anker, über den die fachfremde Nachtschicht-Notiz in drei der zehn Fragen
  // überhaupt punktete. „immer", „nie" und „niemals" stehen seit mega56 in derselben Klasse.
  "oft",
  "häufig",
  "selten",
  "stets",
  "freilich",
  "sicherlich",
  "selbstverständlich",
  "keineswegs",
  "keinesfalls",
  "jedenfalls",
  "allenfalls",
  "mindestens",
  "zumindest",
  "lediglich",
  "bloß",
  "beinahe",
  "kaum",
  "allzu",
  "ziemlich",
  "meist",
  "meistens",
  "nochmals",
  "abermals",
  "erneut",
  // --- KLASSE Funktionswörter Englisch (locale kann en sein) ---
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

// ================================================================================================
// AUFTRAG-mega54 BLOCK A — KENNUNGEN ÜBERLEBEN DIE ZERLEGUNG.
// ================================================================================================
//
// DER BEFUND, den mega53 selbst gemessen und als Preis benannt hat (s. MIN_ANSWER_SUBSTANCE): die
// Längengrenze „länger als zwei Zeichen" hält Funktionswörter wie „an", „im", „so" draußen — und
// wirft dabei „F3" mit weg. Damit verliert Pedis eigene P0-Frage („Der Filter F3 … wie oft muss er
// geprüft werden?") genau das Wort, das sie von jeder anderen Frage unterscheidet.
//
// DIE REGEL IST ENG GEFASST: Buchstabe UND Ziffer, beides mindestens einmal. Keine Ausnahmeliste,
// kein „kurz und selten". Reine Wörter behalten die Längengrenze, wo sie hingehört; reine Ziffern-
// folgen sind keine Kennungen. „f3", „m12", „dn50", „q1" kommen durch — „an", „im", „so" nicht.
function istKennung(token: string): boolean {
  return /[0-9]/.test(token) && /[a-zäöüß]/.test(token);
}

// ================================================================================================
// AUFTRAG-mega54 BLOCK B — „GEPRÜFT" UND „PRÜFEN" SIND DASSELBE WORT.
// ================================================================================================
//
// DER BEFUND: `overlap` vergleicht ganze Token. „geprüft" aus der Frage traf „prüfen" im richtigen,
// validierten Wissensobjekt nicht — die Antwort lag im Bestand und wurde nicht gefunden.
//
// DER WEG (B2), innerhalb der gesetzten Grenzen — KEINE neue Bibliothek, KEINE Synonymliste (die
// wäre eine zweite Wahrheit und ein Pflegefall), deterministisch und rein wie die Zerlegung selbst:
// ein regelbasierter Endungs-Abtrag mit Fixpunkt, danach EINMAL die Partizip-Vorsilbe „ge".
//
// WARUM ENDUNGEN ZUERST UND DIE VORSILBE ZULETZT: die Vorsilbe darf nicht davon abhängen, WIE das
// Wort endet. „gemeldeten" und „gemeldetem" müssen dieselbe Grundform ergeben; prüfte man die
// Vorsilbe an der Endung („ge…t" / „ge…en"), fiele sie beim einen und beim anderen nicht. Nach dem
// Endungs-Abtrag stehen beide auf „gemeld" — und die Vorsilbe fällt für beide oder für keinen.
//
// WARUM DIE GRUNDFORM IMMER EIN ZUSAMMENHÄNGENDER TEILSTRING BLEIBT (das ist B4, die Zusage an den
// Repo-Prefilter): abgetragen wird ausschließlich am Ende und einmal am Anfang. „prüf" steckt
// wörtlich in „geprüft" — der Prefilter (`%term%` ILIKE) findet damit weiterhin JEDES Wort, aus dem
// der Term entstanden ist, und dazu die gebeugten Geschwister. Vorauswahl und Ranking bleiben auf
// EXAKT denselben Termen, wie es der Kommentar an `queryTokens` zusagt.
//
// AUSDRÜCKLICH NICHT ABGEDECKT (im Bericht mega54 B2 benannt): trennbare/untrennbare Vorsilben
// („vorgewärmt" ≠ „vorwärmen"), Umlautwechsel im Stamm („trägt" ≠ „tragen"), starke Verben
// („gefunden" ≠ „finden"), die Ableitungsendungen -er/-lich/-heit/-keit/-isch/-bar, und jede Form
// von Synonymie oder Übersetzung. Was hier nicht steht, wird nicht behauptet.

// AUFTRAG-mega54 B3 — DIE MINDESTLÄNGE DER GRUNDFORM.
//
// Unterhalb von vier Zeichen zieht ein Stamm fremde Wörter zusammen: aus „Gerät" würde „rä", und
// jedes Wort mit diesen zwei Buchstaben wäre plötzlich ein Treffer. Vier ist zugleich die kleinste
// Zahl, die den tragenden Fall dieses Auftrags noch liefert — „prüf" hat genau vier Zeichen. Jede
// Kürzung, die darunter führen würde, unterbleibt; das Wort bleibt dann ungekürzt stehen.
const MIN_GRUNDFORM_LAENGE = 4;

// Häufige deutsche Endungen, LÄNGSTE ZUERST (die Reihenfolge ist die Regel: der längste passende
// Abtrag gewinnt). Bewusst schmal gehalten — Flexion und die Nominalisierung auf -ung, mehr nicht.
// „-er" fehlt absichtlich: es trägt Komparative und Nomen („Filter" → „Filt") und kostet mehr
// Trennschärfe, als es an Treffern bringt.
const GRUNDFORM_ENDUNGEN = ["ung", "en", "em", "es", "e", "n", "s", "t"] as const;

// AUFTRAG-mega59 BLOCK B — DIE NOMINALISIERUNG IST DIE EINE ENDUNG, DIE ETWAS ÜBER DIE HERKUNFT SAGT.
//
// Alle anderen Einträge oben sind Flexion: sie beugen ein Wort, ohne seine Wortart zu verändern.
// „-ung" ist die Ausnahme — sie MACHT aus einem Verbstamm ein Nomen. Genau deshalb ist sie die
// einzige, aus der sich ableiten lässt, WAS das Ausgangswort war: „Wartung" ist ein Sachverhalt,
// „ihr wart" eine Verbform. Beide fallen auf denselben Term „wart"; nur die Herkunft trennt sie.
const NOMINALISIERUNGS_ENDUNG = "ung";

// Das Merkmal, das der Abtrag mitführt. Bewusst ein zweites, PARALLELES Feld und niemals ein
// zweites Token: der ausgegebene Term bleibt byteweise identisch, damit die Prefilter-Zusage aus
// mega54 B4 (Vorauswahl und Ranking auf EXAKT denselben Termen) unangetastet bleibt.
interface Herkunft {
  nominalisierung: boolean;
}

// Der Endungs-Abtrag bis zum Fixpunkt — die erste Hälfte der Grundform, ohne jede Stoppwortkenntnis.
// Getrennt ausgewiesen, weil BLOCK A der Vorsilbe eine andere Antwort gibt als der Endung (s. u.).
//
// mega59 B: `herkunft` ist ein optionaler AUSGANG, kein Eingang — die Rechnung selbst ändert sich
// nicht, sie berichtet nur zusätzlich, ob unterwegs die Nominalisierungsendung gefallen ist. Es
// bleibt bei EINEM Endungs-Abtrag (Wächter: mega54-eine-zerlegung-sammler): die Regel ist hier
// erweitert, nicht ein zweites Mal geschrieben.
function abtragEndungen(token: string, herkunft?: Herkunft): string {
  let wort = token;
  let gekuerzt = true;
  while (gekuerzt) {
    gekuerzt = false;
    for (const endung of GRUNDFORM_ENDUNGEN) {
      if (wort.endsWith(endung) && wort.length - endung.length >= MIN_GRUNDFORM_LAENGE) {
        wort = wort.slice(0, wort.length - endung.length);
        if (herkunft && endung === NOMINALISIERUNGS_ENDUNG) {
          herkunft.nominalisierung = true;
        }
        gekuerzt = true;
        break;
      }
    }
  }
  return wort;
}

// Die Partizip-Vorsilbe, einmal, nach den Endungen (Begründung s. BLOCK B oben).
function abtragGe(wort: string): string {
  return wort.startsWith("ge") && wort.length - 2 >= MIN_GRUNDFORM_LAENGE ? wort.slice(2) : wort;
}

// ================================================================================================
// AUFTRAG-mega55 BLOCK A — EIN STOPPWORT BLEIBT EIN STOPPWORT, AUCH ALS GRUNDFORM.
// ================================================================================================
//
// DER BEFUND (ben, sammel52 ROT-1): der Stoppwortfilter lief NUR auf der Oberflächenform, die
// Grundform lief DANACH — und bildete Stoppwörter neu, die niemand mehr wegfiltert. „meinem" und
// „meinen" wurden zu „mein", „deinem" und „deinen" zu „dein"; beide stehen in der Liste. Damit
// erfüllten ZWEI REIN GRAMMATISCHE WÖRTER die Mindestsubstanz aus mega53: Frage „Was ist mit meinem
// Vorgang und deinem Termin?" gegen die fachfremde Quelle „Hinweis zu meinen Akten und deinen
// Unterlagen." ergab `overlap = 2`. Die Mengenbildung aus mega54 half nicht — sie verhindert nur,
// dass DERSELBE Stamm zweimal zählt; zwei VERSCHIEDENE wieder eingeführte Stoppwortstämme blieben
// zwei Punkte. Dieselbe Tür, die mega53 verschlossen hat, mit einem neuen Schlüssel.
//
// DIE REGEL (A1): ein Token, dessen NORMALISIERTE Form ein Stoppwort ist, ist kein Inhaltstoken und
// erreicht `overlap` nicht. Fail-closed wie die Mindestsubstanz selbst. Es bleibt bei EINER
// Zerlegung — Vorauswahl und Ranking sehen weiterhin exakt dieselben Terme (s. `queryTokens`).
//
// DIE MENGE (A2): verglichen wird gegen die Stoppwortliste UND deren eigene Grundformen, EINMAL
// beim Laden gebildet. Sonst hinge die Deckung daran, ob ein Listeneintrag zufällig schon seine
// eigene Grundform ist: „ihren" läuft über den „n"-Abtrag auf „ihre" (gelistet, gedeckt), „werden"
// aber auf „werd" (nicht gelistet) — ohne die Grundformen der Liste bliebe „werd" ein Inhaltstoken.
//
// AUFTRAG-mega56 A3 — DIE ZWISCHENSTUFE VOR DEM „ge"-ABTRAG GEHÖRT MIT IN DIE MENGE.
//
// Ohne sie öffnet die A3-Rücknahme (s. `grundform`) die Tür, die sie schließen soll, für genau die
// unregelmäßigen Partizipien wieder: „geworden" läuft über „geword" auf „word". Die Rücknahme
// greift, sobald ERST der „ge"-Abtrag eine Stoppform erzeugt — sie gäbe „geword" zurück, und
// „geword" wäre ein Inhaltstoken. Steht die Zwischenstufe selbst in der Menge, ist die Bedingung
// „der Zwischenstand ist noch keine Stoppform" falsch, die Rücknahme unterbleibt, und „word" fällt.
// Für jeden Eintrag, der nicht mit „ge" beginnt, ist dieser dritte Zweig identisch mit dem zweiten
// und fügt nichts hinzu — er wirkt genau dort, wo A3 wirkt.
const STOPPWORT_NORMALFORMEN: ReadonlySet<string> = new Set<string>([
  ...STOPWORDS,
  ...[...STOPWORDS].map((w) => abtragEndungen(w)),
  ...[...STOPWORDS].map((w) => abtragGe(abtragEndungen(w))),
]);

// ================================================================================================
// AUFTRAG-mega56 BLOCK D — WAS DIESE LISTE NICHT KANN.
// ================================================================================================
//
// Eine Wortliste ist eine NÄHERUNG, kein Beweis. Gedeckt ist: die aufgezählten geschlossenen
// Klassen in ihren abgeleiteten Formen (A2), ihre unregelmäßigen Partizipien (A3), und alles, was
// über den Endungs-/Vorsilbenabtrag auf einen dieser Einträge fällt. NICHT gedeckt und hier
// ausdrücklich NICHT behauptet:
//
//   1. Unregelmäßige Formen, die niemand gelistet hat. Es gibt keine Regel, die sie herleitet —
//      genau deshalb steht die A3-Gruppe da. Was dort fehlt, fehlt still.
//   2. Die bewusst zurückgehaltenen Einträge (s. BLOCK A oben). Ihre Formen bleiben Inhaltstoken;
//      zwei von ihnen erfüllen weiterhin die Mindestsubstanz. Das ist eine offene, benannte Lücke.
//   3. Fremdsprachige Funktionswörter jenseits der kurzen englischen Liste — kein Französisch,
//      kein Türkisch, kein Niederländisch, obwohl die App eine NL-Oberfläche hat.
//   4. Dialekt, Umgangssprache und Kurzformen („ham", „nix", „ne", „dat").
//   5. Die Zusammenfälle aus der ÜBERSTEMMUNG — zwei verschiedene Begriffe auf demselben Stamm
//      („Geschichte"/„Schichten" → „schich"). Das ist eine eigene Scheibe und nicht Gegenstand
//      dieser Liste; sie kostet Trennschärfe, nicht Ehrlichkeit.
//   6. Der gemessene Preis in die andere Richtung: „Nacht" verliert seinen Token an die Präposition
//      „nach", „Seide" an „seid", „bereit" an „bereits". Gemessen, nicht geschätzt (Bericht B2).
//
// Die Zusicherung reicht deshalb genau so weit: zwei Wörter aus den HIER DEKLARIERTEN Klassen
// allein erreichen `MIN_ANSWER_SUBSTANCE` nicht. Nicht: „zwei grammatische Wörter überhaupt".
function istStoppform(token: string): boolean {
  return STOPPWORT_NORMALFORMEN.has(token);
}

// ================================================================================================
// AUFTRAG-mega57 BLOCK A — SUCHBAR IST NICHT DASSELBE WIE TRAGEND.
// ================================================================================================
//
// DER BEFUND (ben, sammel54 ROT): „wollte"/„wollten" fallen auf „woll", „würde"/„würden" auf
// „würd". Beide Formen stehen bewusst NICHT in `STOPWORDS`, also entfernt sie auch das zweite Sieb
// nicht. Damit trägt die Frage „Was wollte man und was würde gelten?" gegen die fachfremde Quelle
// „Sie wollten etwas, und dadurch würden Folgen entstehen." mit `overlap = 2` die Mindestsubstanz.
// Dieselbe Fehlerklasse wie mega53 und mega55, mit dem dritten Schlüssel.
//
// DER DENKFEHLER, den diese Runde korrigiert, liegt nicht in der Liste, sondern im WERKZEUG: bis
// hierher beantwortet EINE Menge ZWEI verschiedene Fragen. „Steht das Wort drin?" entscheidet
// zugleich, ob ein Token ÜBERHAUPT EXISTIERT (Vorauswahl, Ranking) und ob es SUBSTANZ TRÄGT
// (Mindestsubstanz). Deshalb war die Aufnahme von „wart" ein Verlust — sie hätte „Wartung" aus
// jeder Suche geworfen — und die Auslassung ein Loch. Zwei Fragen brauchen zwei Mengen.
//
// DIE TRENNUNG (A1):
//   · `STOPWORDS` bleibt, was sie ist: Formen, die EINDEUTIG grammatisch sind und kein echtes Wort
//     treffen („mein", „dies", „jen", „wärt"). Sie verschwinden vollständig aus dem Strom.
//   · `MEHRDEUTIGE_FUNKTIONSFORMEN` ist neu und für die MEHRDEUTIGEN. Ihre Token bleiben im Strom:
//     der Repo-Prefilter findet sie weiter, das Ranking sieht sie weiter, „Wartung" und „Ware"
//     verlieren ihren Term nicht. Sie zahlen nur nicht mehr auf `MIN_ANSWER_SUBSTANCE` ein.
//
// DIE ZUORDNUNGSREGEL (B1) IST EINE EINZIGE, und sie steht neben jedem Eintrag: trifft die
// Normalform der Funktionsform ein ECHTES Wort, gehört sie hierher; trifft sie keines, gehört sie
// in `STOPWORDS`. Das zweite Feld jedes Paares IST dieser Beleg — es nennt das Wort, das ein
// Stoppworteintrag gekostet hätte, und der Sammler rechnet nach, dass beide wirklich auf dieselbe
// Normalform fallen (mega57 B2). Eine behauptete Kollision, die keine ist, wird dort rot.
//
// WAS DAS NICHT ÄNDERT (A3): es bleibt bei EINER Zerlegung. `queryTokens` liefert unverändert
// dieselben Terme wie das Ranking, die B4-Zusage aus mega54 an den Prefilter gilt weiter. Diese
// Menge entfernt NICHTS aus dem Strom — sie ändert nur, was ZÄHLT, nicht was EXISTIERT.
const MEHRDEUTIGE_FUNKTIONSFORMEN: ReadonlyArray<readonly [string, string]> = [
  // [Funktionsform, das echte Wort, das ein Stoppworteintrag gekostet hätte]
  // --- MEHRDEUTIG Modalverb wollen ---
  ["wollen", "Wolle"],
  ["will", "Wille"],
  // --- MEHRDEUTIG Konjunktiv von werden ---
  ["würde", "Würde"],
  // --- MEHRDEUTIG Präteritum von sein ---
  ["waren", "Ware"],
  ["wart", "Wartung"],
  // --- MEHRDEUTIG Konjunktionen und Subjunktionen ---
  ["falls", "Fall"],
  ["ehe", "Ehe"],
  // --- MEHRDEUTIG Präpositionen ---
  ["seit", "Seite"],
  ["seitens", "Seite"],
  ["wegen", "Wege"],
  ["laut", "lautet"],
  ["mittels", "Mittel"],
  ["zwecks", "Zweck"],
  ["samt", "Samt"],
  ["kraft", "Kraft"],
  ["dank", "danken"],
  ["mangels", "Mangel"],
  ["namens", "Name"],
  ["längs", "Länge"],
  ["entsprechend", "entsprechende"],
  // --- MEHRDEUTIG Partikeln ---
  ["halt", "Haltung"],
  ["eben", "Ebene"],
  ["wohl", "Wohl"],
  ["erst", "erste"],
  ["fast", "fasten"],
  ["recht", "Rechte"],
  ["gewiss", "Gewissen"],
  ["natürlich", "natürliche"],
  ["höchstens", "höchste"],
];

// Dieselbe Hüllenbildung wie bei `STOPPWORT_NORMALFORMEN` und aus demselben Grund (mega55 A2): ein
// Token wird auf seiner NORMALFORM geprüft, also muss die Normalform jedes Eintrags mit in die
// Menge — „wollen" deckt so auch „wollte", „wolltet" und „gewollt", die alle auf „woll" fallen.
const NICHT_SUBSTANZTRAGEND: ReadonlySet<string> = new Set<string>(
  MEHRDEUTIGE_FUNKTIONSFORMEN.flatMap(([form]) => {
    const klein = form.toLowerCase();
    const nachEndung = abtragEndungen(klein);
    return [klein, nachEndung, abtragGe(nachEndung)];
  }),
);

// Ein Token trägt Substanz, solange es keine mehrdeutige Funktionsform ist. Bewusst als POSITIVE
// Frage formuliert: gezählt wird, was trägt — nicht, was fehlt.
function istSubstanztragend(token: string): boolean {
  return !NICHT_SUBSTANZTRAGEND.has(token);
}

// ================================================================================================
// AUFTRAG-mega59 BLOCK B — DIE MEHRDEUTIGKEIT WIRD HERKUNFTSTREU.
// ================================================================================================
//
// DER PREIS, den mega57 gemessen und als Produktentscheidung gemeldet hat: `["wart", "Wartung"]`
// steht in `MEHRDEUTIGE_FUNKTIONSFORMEN`, weil „wart" auch Präteritum von „sein" ist. Folge —
// „Wartung" zahlt nicht auf die Mindestsubstanz ein, und die Frage „Wann ist die Wartung am Ventil
// fällig?" endet gegen die Quelle „Wartungsplan / Die Wartung am Ventil erfolgt jährlich" in einer
// Wissenslücke, obwohl die Antwort wörtlich dasteht. „Wartung" ist das zentrale Industriewort der
// Testerin; am Freitag ist dieser Preis zu teuer.
//
// DER WEG, kleinster Eingriff und ohne die Trennung suchbar/tragend aufzugeben: „Wartung" verliert
// seine Nominalisierungsendung erst durch den Abtrag von `-ung`. Führt der Abtrag dieses Merkmal
// mit (s. `Herkunft`), lässt sich die Frage stellen, die die Liste allein nicht beantworten kann:
// stammt dieses „wart" aus einem NOMEN oder aus einer VERBFORM? Das trennt „Wartung" und
// „Wartungsplan" von „ihr wart" — ohne zweites Token, ohne zweite Zerlegung, ohne Listenpflege.
//
// DIE ENTSCHEIDUNG IST SYMMETRISCH UND FAIL-CLOSED: getragen wird ein Term nur, wenn er auf BEIDEN
// Seiten aus einer Nominalisierung stammt. Frage und Quelle laufen durch dieselbe Funktion
// (Symmetriezusage), und der Schnitt zweier Mengen ist von sich aus richtungsfrei. Die Alternative
// „eine Seite genügt" wäre fail-open: die Frage „Wann war die Wartung?" träfe die Quelle „Wo wart
// ihr?" und bekäme dafür Substanz gutgeschrieben, obwohl keine der beiden von der anderen redet.
//
// WAS DAS NICHT ÄNDERT: der ausgegebene Term (`queryTokens("Wartung")` bleibt `["wart"]`), die
// Stoppwortsiebe, den Strom. Ein Wort, dessen Grundform ein STOPPWORT ist („Meinung" → „mein"),
// fällt weiterhin ganz aus der Zerlegung — dieser Block macht mehrdeutige Formen tragend, er holt
// keine Stoppwörter zurück. Genau diese Tür hat mega55 geschlossen, und sie bleibt zu.
//
// WAS NICHT GEDECKT IST, ausdrücklich: andere Nominalisierungsendungen (-heit, -keit, -nis, -schaft
// stehen gar nicht in `GRUNDFORM_ENDUNGEN`), und der Fall, dass EIN Text dasselbe Token beide Male
// führt („die Wartung, als ihr wart") — dann gilt der Term für diesen Text als Nominalisierung.
// Das ist bewusst so: eine echte Nominalisierung im Text ist selbst der Beleg dafür, dass er von
// der Sache redet, und der Mischfall ist konstruiert, nicht real.
function traegtSubstanz(
  token: string,
  nominalA?: ReadonlySet<string>,
  nominalB?: ReadonlySet<string>,
): boolean {
  if (istSubstanztragend(token)) {
    return true;
  }
  return nominalA?.has(token) === true && nominalB?.has(token) === true;
}

// Deterministisch und ohne Seiteneffekt: gleiche Eingabe → gleiche Ausgabe, kein Zustand, kein Netz.
// (mega59 B: `herkunft` ist ein reiner Ausgang und ändert die Rückgabe nicht — s. `abtragEndungen`.)
function grundform(token: string, herkunft?: Herkunft): string {
  // Eine Kennung ist kein Wort — an ihr gibt es nichts zu beugen (BLOCK A bliebe sonst wirkungslos,
  // sobald eine Kennung auf „e", „n", „s" oder „t" endet).
  if (istKennung(token)) {
    return token;
  }
  const nachEndung = abtragEndungen(token, herkunft);
  const ohneGe = abtragGe(nachEndung);
  // AUFTRAG-mega55 A3 — DIE VORSILBE IST EIN ANDERER FALL ALS DIE ENDUNG.
  //
  // Entsteht das Stoppwort durch den ENDUNGS-Abtrag, war das Wort die gebeugte Form eines
  // Stoppworts („meinem" → „mein") — es fällt in `tokenize` weg, und das ist richtig so.
  //
  // Entsteht es erst durch den „ge"-Abtrag, ist der bessere Schluss ein anderer: dann war das „ge"
  // vermutlich gar keine Partizip-Vorsilbe, sondern Teil des Wortes. „Gesicht" läuft über „gesich"
  // auf „sich". Hier das Wort wegzuwerfen kostet einen echten Begriff; den Abtrag zu UNTERLASSEN
  // kostet nichts — „gesich" ist ein zulässiger Stamm, bleibt ein zusammenhängender Teilstring
  // (B4-Zusage an den Prefilter) und ist auf beiden Seiten dieselbe Rechnung (Symmetrie).
  // Bedingung ist ausdrücklich, dass erst die Vorsilbe das Stoppwort erzeugt: war die Form schon
  // vorher eine Stoppform, hilft kein Zurücknehmen, und sie fällt wie jede andere.
  if (ohneGe !== nachEndung && istStoppform(ohneGe) && !istStoppform(nachEndung)) {
    return nachEndung;
  }
  return ohneGe;
}

// Die EINE Zerlegung des Antwortwegs. Die Reihenfolge trägt zwei Siebe, nicht eines: Stoppwörter
// und die Längengrenze wirken auf der OBERFLÄCHENFORM (die Stoppwortliste führt Oberflächenformen:
// „werden", „wie"), danach läuft jedes verbleibende Token auf seine Grundform — und wird ERNEUT
// gegen die Stoppwortmenge gehalten (mega55 A1). Ohne das zweite Sieb führt die Grundform genau die
// Wörter wieder ein, die das erste entfernt hat.
//
// AUFTRAG-mega59 B: `ausNominalisierung` ist der optionale AUSGANG für das Herkunfts-Merkmal — ein
// zweites, paralleles Feld NEBEN dem Tokenstrom, kein zweites Token und keine zweite Zerlegung. Die
// Rückgabe bleibt byteweise dieselbe, ob der Ausgang mitgegeben wird oder nicht; wer ihn weglässt
// (etwa `queryTokens` für den Repo-Prefilter), sieht exakt die Zerlegung von mega54.
function tokenize(text: string, ausNominalisierung?: Set<string>): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zäöüß0-9]+/)
    .filter((w) => (w.length > 2 || istKennung(w)) && !STOPWORDS.has(w))
    .map((w) => {
      const herkunft: Herkunft = { nominalisierung: false };
      const norm = grundform(w, herkunft);
      if (ausNominalisierung && herkunft.nominalisierung) {
        ausNominalisierung.add(norm);
      }
      return norm;
    })
    .filter((w) => !istStoppform(w));
}

// AUFTRAG-mega54 C3 — DIE GRUNDFORM HEBELT DIE MINDESTSUBSTANZ NICHT AUS.
//
// Gezählt werden VERSCHIEDENE gemeinsame Inhaltstoken, nicht Vorkommen. Sonst entstünde genau die
// Umgehung, vor der Block C warnt: eine Frage, die denselben Begriff zweimal gebeugt nennt
// („wurde das geprüft … wie oft muss man prüfen"), fiele nach der Grundform auf zweimal dasselbe
// Wort zusammen und erfüllte MIN_ANSWER_SUBSTANCE aus EINEM einzigen geteilten Begriff. Ein Wort
// bleibt ein Wort — auch in zwei Beugungen.
//
// AUFTRAG-mega57 A2 — ZWEI ZAHLEN STATT EINER, AUS EINER EINZIGEN ÜBERSCHNEIDUNG.
//
// `wert` ist der bisherige Überschneidungswert und bleibt, was er war: er trägt das Ranking und die
// relative Regel. `substanz` ist derselbe Schnitt ohne die mehrdeutigen Funktionsformen — und NUR
// er wird gegen `MIN_ANSWER_SUBSTANCE` gehalten. Beide entstehen aus DERSELBEN Tokenmenge; es gibt
// weiterhin genau eine Zerlegung und genau einen Schnitt.
interface Ueberschneidung {
  readonly wert: number; // alle gemeinsamen Inhaltstoken — Rangfolge und relative Schwelle.
  readonly substanz: number; // davon die substanztragenden — die absolute Mindestsubstanz.
}

// ================================================================================================
// AUFTRAG-mega59 BLOCK C — DIE VALIDIERTE QUELLE GEHT AM KOMPOSITUM NICHT MEHR VERLOREN.
// ================================================================================================
//
// DER BEFUND (S5, am Bestand nachgesehen): auf „Welche Farbe müssen Firmenwagen haben?" fällt die
// VALIDIERTE Quelle `koCarBlau` („Firmenwagen: Pflichtfarbe Blau") weg, während die nur OFFENE
// `koCarRot` trägt — weil „Farbe" dort im Kompositum „Pflichtfarbe" steckt.
//
// WO DIE LÜCKE NICHT SITZT, und das erspart die falsche Fährte: NICHT in der Vorauswahl. Der
// Repo-Prefilter arbeitet mit `%term%` ILIKE, „farb" matcht „Pflichtfarbe" als Teilstring, der
// Kandidat KOMMT AN. Er stirbt erst hier, am exakten Mengenschnitt (`ziel.has(word)`).
//
// DIE REGEL IST ENG UND FAIL-CLOSED — drei Bedingungen, jede einzelne notwendig:
//
//  1. MINDESTLÄNGE des Frageterms (vier Zeichen, dieselbe Zahl und derselbe Grund wie
//     MIN_GRUNDFORM_LAENGE). Ohne sie fände „art" das „Wartung" — genau die Teilstring-Suche mitten
//     im Wort, die diese Regel NICHT sein soll. Es ist zugleich die Zahl, die den tragenden Fall
//     noch liefert: „farb" hat genau vier Zeichen.
//  2. EINE BELEGBARE KOMPOSITUMGRENZE, nicht irgendeine Fundstelle: entweder steht der Term am
//     WORTENDE („farb" in „pflichtfarb"), oder er endet an einem FUGEN-S („arbeit" in
//     „arbeitsschutz"). Beides sind Stellen, an denen im Deutschen wirklich ein Kompositum
//     zusammengesetzt wird. Eine Fundstelle mitten im Wort ist keine Grenze und zählt nicht.
//  3. DER REST IST SELBST EIN WORTTEIL (auch mindestens vier Zeichen). Ohne diese dritte Bedingung
//     wäre die zweite zahnlos: „wart" steht am Wortende von „erwart" (aus „erwarten"), und eine
//     Wartungsfrage träfe plötzlich jede Erwartung. Zwei oder drei Zeichen davor sind eine
//     Verbvorsilbe, kein Kompositumglied — vier sind die Grenze, ab der der Rest ein Wort sein kann.
//
// DIE GEGENRICHTUNG IST MITGENOMMEN, weil sie keine neue Annahme braucht: dieselbe Prüfung wird auf
// beiden Seiten gefahren, ein Frage-KOMPOSITUM trifft also auch ein einfaches Quelltoken
// („pflichtfarb" in der Frage gegen „farb" in der Quelle).
//
// ------------------------------------------------------------------------------------------------
// AUFTRAG-mega60 BLOCK A — DIE ZUSAGE „GEZÄHLT WIRD AUCH AUF `substanz`" IST ZURÜCKGENOMMEN.
// ------------------------------------------------------------------------------------------------
//
// mega59 C zählte den Kompositumtreffer auf `wert` UND auf `substanz` („ein echtes Fachwort, kein
// Mitläufer"). Das war zu weit, und ben hat es an einem Gegenbeispiel nachgewiesen (ROT-1 gegen
// sammel57, ohne Fehlerinjektion reproduzierbar): die Frage „Welcher Stand gilt am Ventil?" gegen die
// Quelle „Der Widerstand am Ventil ist vorgeschrieben." erfüllt die drei Bedingungen unten
// buchstäblich — „stand" steht am Wortende von „widerstand", der Rest „wider" ist selbst ein
// Wortteil. Zusammen mit dem echten Treffer „ventil" ergab das ZWEI Substanzpunkte, und eine
// sachfremde Quelle trug eine Antwort. Gleichartig: „Stand" gegen „Wohlstand". Der Fehler folgt aus
// der Regel, er ist keine Wortkuriosität.
//
// WARUM KEINE VIERTE ZEICHENBEDINGUNG, und warum sie auch später keine sein wird: „Unterdruck" und
// „Widerstand" sind morphologisch identisch gebaut — Präposition plus Substantiv —, semantisch aber
// verschieden. Ein Unterdruck IST ein Druck, ein Widerstand ist KEIN Stand. Jede rein formale Regel,
// die den einen trägt, trägt auch den anderen; eine weitere Bedingung verschiebt die Grenze nur.
//
// DIE ENGE, FAIL-CLOSED ENTSCHEIDUNG: der Kompositumtreffer zählt weiterhin auf `wert` — die Quelle
// wird GEFUNDEN, kommt in die Kandidatenliste und wird gerankt —, aber NICHT auf `substanz`, und
// zwar in BEIDEN Zweigen (Wortende und Fugen-s). Damit kann er eine Antwort weder allein tragen noch
// den zweiten Substanzpunkt liefern; er erscheint nur als Mitläufer eines substanzstarken Treffers.
// Das ist exakt die Trennung suchbar/tragend aus mega57, angewandt auf einen neuen Treffertyp.
//
// WAS DAMIT NICHT ERREICHT IST, ausdrücklich und ohne Beschönigung: der ursprüngliche Zweck von
// mega59 C ist verfehlt. `koCarBlau` trägt die Antwort auf „Welche Farbe müssen Firmenwagen haben?"
// weiterhin NICHT — die Frage liefert nur die zwei Terme „farb" und „firmenwag", und „farb" ist in
// „pflichtfarb" nur ein Kompositumtreffer, der Substanzwert bleibt bei eins. Die Recall-Schuld S5 ist
// damit nicht beglichen, sondern präziser beschrieben. Die dazu passende Lösung — eine begrenzte und
// getestete Domänenrelation echter Fachkomposita — steht im Register und kommt nach dem Vortest.
const MIN_KOMPOSITUM_TEIL = MIN_GRUNDFORM_LAENGE;
const FUGEN_S = "s";

function trifftAlsWortteil(teil: string, ganzes: string): boolean {
  if (teil.length < MIN_KOMPOSITUM_TEIL || ganzes.length <= teil.length) {
    return false;
  }
  // Am Wortende: „farb" in „pflichtfarb" — davor muss ein eigener Wortteil stehen.
  if (ganzes.endsWith(teil) && ganzes.length - teil.length >= MIN_KOMPOSITUM_TEIL) {
    return true;
  }
  // Am Fugen-s: „arbeit" in „arbeitsschutz" — die Fuge IST der Beleg für die Grenze.
  return (
    ganzes.startsWith(`${teil}${FUGEN_S}`) &&
    ganzes.length - teil.length - FUGEN_S.length >= MIN_KOMPOSITUM_TEIL
  );
}

// Trifft der Frageterm irgendein Zieltoken an einer Kompositumgrenze — in beiden Richtungen?
function trifftAlsKompositum(wort: string, ziel: readonly string[]): boolean {
  for (const anderes of ziel) {
    if (trifftAlsWortteil(wort, anderes) || trifftAlsWortteil(anderes, wort)) {
      return true;
    }
  }
  return false;
}

function ueberschneidung(
  a: readonly string[],
  b: readonly string[],
  nominalA?: ReadonlySet<string>,
  nominalB?: ReadonlySet<string>,
): Ueberschneidung {
  const ziel = new Set(b);
  const gemeinsam = new Set<string>();
  // mega60 A: `exakt` ist die Teilmenge von `gemeinsam` OHNE die Kompositumtreffer. Nur sie kann
  // Substanz tragen — der Kompositumtreffer bleibt suchbar (er steht in `gemeinsam` und zählt auf
  // `wert`), aber er trägt nicht. Es bleibt bei EINEM Durchlauf über EINE Zerlegung.
  const exakt = new Set<string>();
  for (const word of a) {
    if (ziel.has(word)) {
      gemeinsam.add(word);
      exakt.add(word);
    } else if (trifftAlsKompositum(word, b)) {
      gemeinsam.add(word);
    }
  }
  let substanz = 0;
  for (const word of exakt) {
    if (traegtSubstanz(word, nominalA, nominalB)) {
      substanz += 1;
    }
  }
  return { wert: gemeinsam.size, substanz };
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

// AUFTRAG-mega52 B1 — DAS RELEVANZMASS.
//
// DER BEFUND (Pedi, Word-Handlauf 28.07.): die Antwort zog fachfremde Quellen heran. Die Ursache
// war kein Ranking-Fehler, sondern ein fehlendes MASS: das Gate hieß `keywordScore > 0`. EIN
// einziges gemeinsames Inhaltstoken genügte. Teilt eine Vereinsfest-Notiz mit der Frage nach dem
// Filter das Wort „vorher", steht sie als gleichwertige Antwortquelle in der Liste.
//
// DIE SCHWELLE, die diesen Auftrag ersetzt hat: `keywordScore * 2 > bestScore` — ein Kandidat muss
// MEHR ALS DIE HÄLFTE der Inhaltstoken-Überschneidung des besten Treffers erreichen.
//
// WARUM DIESE UND KEINE DECKUNGSANTEIL-SCHWELLE (gemessen, nicht behauptet — s. Bericht mega52 B3):
//  · Sie KANN NIE LEEREN. Der beste Treffer erfüllt sie per Konstruktion immer (2·best > best für
//    best > 0). Jede Schwelle über dem Deckungsanteil (Treffer-Token / Fragetoken) läuft dagegen
//    genau in Pedis eigene P0-Frage: „Der Filter F3 … wie oft muss er geprüft werden?" hat 8
//    Inhaltstoken, das RICHTIGE Wissensobjekt deckt davon genau eines (11 %) — „F3" fällt als
//    Zweizeichen-Token aus der Tokenisierung, „geprüft" trifft „prüfen" literal nicht. Sowohl
//    ≥1/3 als auch ≥1/2 löschten dort ALLES, auch die richtige Antwort. Das ist die Falle, vor der
//    der Auftrag ausdrücklich warnt: lieber die Schwelle verwerfen als sie passend biegen.
//  · Sie ist LÄNGENUNABHÄNGIG. Beim literalen Token-Schnitt ist die Fragelänge kein Maß für
//    Spezifität — ein Wortschwall verschiebt jeden Deckungsanteil, aber nicht die Rangfolge.
//  · Sie folgt AUS DEM VORHANDENEN `overlap`/`rankCandidates` (nur `keywordScore`), ohne neue
//    Bibliothek, ohne Embeddings, ohne DB-Umbau.
//
// BENANNTE GRENZE von mega52 (sie war echt) — und AUFTRAG-mega53 BLOCK A, DIE ABSOLUTE
// MINDESTSUBSTANZ, die sie schließt:
//
// DER BEFUND (ben, sammel50 ROT-1). Die relative Schwelle allein ist FAIL-OPEN. Sie misst jeden
// Kandidaten am besten Treffer — sagt aber nichts darüber, ob der BESTE Treffer selbst etwas taugt.
// Bei `bestScore = 1` gilt für jeden Ein-Wort-Treffer `1 * 2 > 1`, also passieren ALLE gleich
// schwachen Treffer. Genau die Vereinsfest-Lage aus Pedis Word-Handlauf kehrt damit zurück, sobald
// keine starke Quelle im Pool ist — und mega52 hat das an Filter F3 und Kaltstart selbst gemessen,
// ohne es zu schließen. mega52 verließ sich darauf, dass Block A hinterher SAGT, welche Quelle
// getragen hat. Das ist Transparenz über ein schlechtes Ergebnis, keine Abwehr davor.
//
// DIE SCHWELLE: erreicht der beste Treffer nicht MINDESTENS ZWEI gemeinsame Inhaltstoken, gibt es
// KEINE Kandidaten — die Antwort ist eine ehrliche Wissenslücke. Das ist bens kleinster ehrlicher
// Schnitt, und er ist hier übernommen, aus drei Gründen:
//
//  · ZWEI IST DIE KLEINSTE ZAHL, DIE EINEN ZUSAMMENHANG BEHAUPTET. Ein einzelnes gemeinsames Wort
//    ist bei einer literalen Tokenisierung ein Zufall („vorher", „oft", „anlegen", „sofort" — die
//    vier realen Störer aus der mega52-Messung hingen an genau so einem Wort). Zwei gemeinsame
//    Inhaltstoken sind das erste Maß, das nicht mehr durch ein Allerweltswort entsteht.
//  · FAIL-CLOSED, nicht fail-open. Im Zweifel keine Antwort statt einer fachfremden. Eine
//    Wissenslücke ist im Vertrauensvertrag dieses Produkts ein gültiges, benanntes Ergebnis; eine
//    Antwort aus einer Vereinsfest-Notiz ist es nicht.
//  · KEIN HÖHERER SCHNITT. Drei gemeinsame Token verlangte bereits von den kurzen Realfragen der
//    Messung mehr, als der richtige Treffer liefert (die meisten haben nur 2–4 Inhaltstoken
//    insgesamt) — das löschte richtige Antworten mit. Zwei ist die Grenze, an der die gemessenen
//    Störer fallen und die gemessenen Treffer stehen bleiben (s. Bericht mega53 A5).
//
// DER PREIS IST ECHT UND BENANNT: das ist eine bewusste Absenkung des Recalls. Fragen, deren
// richtige Quelle nur über ein Wort literal trifft — Pedis eigenes „Der Filter F3 …", weil „F3" als
// Zweizeichen-Token herausfällt und „geprüft" das Wort „prüfen" nicht literal trifft — enden jetzt
// in der Wissenslücke. Der Recall kommt über eine spätere Token-Scheibe zurück (Kennungen,
// Flexionen), nicht über ein aufgeweichtes Maß.
export const MIN_ANSWER_SUBSTANCE = 2;

// ==================================================================================================
// AUFTRAG-mega59 BLOCK I — DIE ABSOLUTE UND DIE RELATIVE REGEL STEHEN GETRENNT.
// ==================================================================================================
//
// HIER STAND DIE ABSOLUTE REGEL EIN ZWEITES MAL: `if (bestScore < MIN_ANSWER_SUBSTANCE) return false;`
//
// Seit mega58 filtert das Substanztor JE KANDIDAT, und zwar VOR dem Bestwert (s. `keywordSelect` und
// `rankCandidates`). Damit war dieser Zweig TOT: `best` ist das Maximum über eine Menge, in der jeder
// Kandidat `substanz >= MIN_ANSWER_SUBSTANCE` erfüllt, und weil `substanz <= wert` gilt, ist jeder
// dieser Kandidaten auch im Überschneidungswert mindestens zwei. Der Bestwert konnte die Schwelle
// also nicht mehr unterschreiten — außer die Menge war leer, und dann wird die Funktion gar nicht
// aufgerufen.
//
// Tote Zweige sind nicht bloß Ballast: sie behaupten eine Zuständigkeit. Wer diese Funktion liest,
// glaubte, sie trage die Mindestsubstanz mit — und hätte beim nächsten Umbau des Tors darauf gebaut.
// Ab hier ist die Zuständigkeit eindeutig: `meetsAnswerSubstance` trägt die ABSOLUTE Regel, diese
// Funktion die RELATIVE, und keine kennt die andere.
//
// DIE BEHAUPTUNG „DAS PRODUKT VERHÄLT SICH UNVERÄNDERT" IST BELEGT, NICHT KOMMENTIERT: der Beweis
// der Unerreichbarkeit steht in tests/ask/mega59-getrennte-regeln.test.ts — er fährt beide
// Auswahlwege über eine erschöpfende Wertetafel und zeigt, dass der Bestwert die Schwelle nie
// unterschreiten KANN, weil das Tor je Kandidat davorsteht.
export function meetsRelevanceThreshold(keywordScore: number, bestScore: number): boolean {
  // Rein relativ: wer weniger als die Hälfte des besten Treffers erreicht, ist ein Mitläufer.
  return keywordScore > 0 && keywordScore * 2 > bestScore;
}

// AUFTRAG-mega57 A2 — DAS ABSOLUTE TOR STEHT AB HIER AUF DEM SUBSTANZWERT.
//
// Die Schwelle selbst bleibt bei ZWEI und wird nicht angefasst; nur die Zahl, die gegen sie
// gehalten wird, ist jetzt die richtige. `meetsRelevanceThreshold` behält seinen Wortlaut — die
// relative Regel und die Rangfolge messen weiter am Überschneidungswert (A2) — und dieses Tor
// steht davor. Weil `substanz <= wert` immer gilt, ist es die STRENGERE der beiden Prüfungen:
// ein Kandidat, der hier fällt, wäre auch vorher nie stärker gewesen.
//
// AUFTRAG-mega58 A — DAS TOR GILT JE KANDIDAT, NICHT NUR FÜR DEN BESTEN.
//
// HIER STAND BIS mega57 EINE ZUSAGE, DIE NICHT GALT: „ein Kandidat ohne eigene Substanz kann nur
// als Mitläufer eines substanzstarken Treffers erscheinen — nie allein." Sie fiel, und zwar im
// Normalfall, nicht am Rand (ben, sammel55, ROT-Blocker). Beide Auswahlwege prüften das Tor auf dem
// `Math.max` über die Substanzwerte ALLER Kandidaten; danach entschied die relative Regel allein auf
// dem Überschneidungswert. Eine Quelle mit `substanz = 0` und hohem Überschneidungswert kam damit
// mit, sobald irgendeine andere Quelle das Tor öffnete — und verdrängte den tragenden Treffer sogar,
// denn bei Wert 5 gegen Wert 2 gilt `2 · 2 > 5` nicht. Dann stand die substanzlose Quelle ALLEIN in
// der Antwort. Genau der Fall, den die alte Zusage ausgeschlossen hatte.
//
// DIE NEUE WAHRHEIT, in beiden Wegen gleich: jeder Kandidat unter `MIN_ANSWER_SUBSTANCE` fällt
// ZUERST heraus. Bestwert, relative Regel, Ranking und topK rechnen erst auf der verbleibenden
// Menge. Bleibt nichts übrig, ist die Menge leer wie bisher — eine ehrliche Wissenslücke.
//
// WAS DAS NICHT ÄNDERT: die Rangfolge der tragenden Kandidaten. Das Tor entfernt nur Kandidaten
// unter der Schwelle; wer sie erreicht, wird danach exakt wie vorher gewichtet und sortiert. Der
// Bestwert kann durch den Wegfall nur SINKEN, also lässt die relative Regel auf der verbleibenden
// Menge höchstens mehr tragende Kandidaten durch, nie weniger.
//
// Die Funktion prüft deshalb EINEN Substanzwert — den des Kandidaten, der gerade zur Debatte steht.
export function meetsAnswerSubstance(substanz: number): boolean {
  return substanz >= MIN_ANSWER_SUBSTANCE;
}

// Semantische Vorauswahl über Keyword-Überschneidung — synchron, modellunabhängig.
// Von beiden Providern genutzt, damit Antworten immer in echten KOs verankert bleiben.
// mega52 B1: EINE Schwelle für beide Auswahlwege — `keywordSelect` misst wie `rankCandidates`.
export function keywordSelect(
  question: string,
  candidates: readonly KnowledgeRef[],
): KnowledgeRef[] {
  // mega59 B: dieselbe Zerlegung, zusätzlich mit dem Herkunfts-Merkmal — die Frage EINMAL, jede
  // Quelle einmal. Beide Seiten laufen durch dieselbe Funktion (Symmetriezusage).
  const nominalFrage = new Set<string>();
  const words = tokenize(question, nominalFrage);
  // mega57 A2: das absolute Tor auf dem Substanzwert, die relative Regel auf dem Überschneidungswert.
  // mega58 A: und das Tor JE KANDIDAT, vor der relativen Regel — sonst kommt eine substanzlose
  // Quelle über ihren hohen Überschneidungswert mit und verdrängt den tragenden Treffer.
  const scored = candidates
    .map((c) => {
      const nominalQuelle = new Set<string>();
      const zieltoken = tokenize(refMatchText(c), nominalQuelle);
      return { c, ...ueberschneidung(words, zieltoken, nominalFrage, nominalQuelle) };
    })
    .filter((x) => x.wert > 0 && meetsAnswerSubstance(x.substanz))
    .sort((a, b) => b.wert - a.wert);
  const best = scored.reduce((max, x) => Math.max(max, x.wert), 0);
  return scored.filter((x) => meetsRelevanceThreshold(x.wert, best)).map((x) => x.c);
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

// Nachvollziehbares, DOM-freies Ranking: (1) Relevanz-Gate (mega52 B1: das MASS `meetsRelevance-
// Threshold`, nicht mehr „Überschneidung > 0"), (2) stabile Sortierung nach rankScore (Relevanz
// dominiert, Status/Trust als Tiebreak), (3) harte Begrenzung auf topK Kandidaten. Bei Gleichstand
// bleibt die Eingabereihenfolge erhalten (stabil).
//
// AUFTRAG-mega52 B2 — ACHT IST EIN DECKEL, KEIN SOLLWERT. Die Schwelle wirkt VOR dem `slice`: wer
// sie nicht erreicht, kommt gar nicht erst in die Liste, auch wenn dadurch nur zwei Quellen übrig
// bleiben. Vorher war DEFAULT_TOP_K faktisch ein Sollwert — Status und Trust wirken nur als
// Tiebreaker < 1 und konnten einen schwachen Störer nie aussortieren, nur nach hinten schieben;
// solange weniger als acht starke Treffer da waren, rutschte jeder Ein-Token-Treffer sicher mit
// in die Antwortquellen. Zwei belegte Quellen sind mehr wert als acht, von denen sechs nicht
// dazugehören.
export function rankCandidates(
  question: string,
  candidates: readonly KnowledgeRef[],
  topK: number = DEFAULT_TOP_K,
): RankedCandidate[] {
  // mega59 B: identisch zu `keywordSelect` — eine Zerlegung, ein Herkunfts-Merkmal, beide Seiten
  // durch dieselbe Funktion. Die Regel darf sich zwischen den zwei Auswahlwegen nicht unterscheiden.
  const nominalFrage = new Set<string>();
  const words = tokenize(question, nominalFrage);
  const limit = Math.max(1, Math.floor(topK));
  const scored = candidates
    .map((ref) => {
      // WP-RETEST7 R5: gleiche Match-Basis wie keywordSelect — inkl. Bild-Fußnoten (captionTexts).
      const nominalQuelle = new Set<string>();
      const zieltoken = tokenize(refMatchText(ref), nominalQuelle);
      const { wert, substanz } = ueberschneidung(words, zieltoken, nominalFrage, nominalQuelle);
      return { ref, keywordScore: wert, substanz, rankScore: wert + statusTrustBoost(ref) };
    })
    // mega57 A2: dasselbe absolute Tor wie in `keywordSelect`, auf demselben Substanzwert — eine
    // Regel für beide Auswahlwege (mega52 B1), nur jetzt mit der richtigen Zahl davor.
    // mega58 A: und je Kandidat statt auf dem besten, vor der relativen Regel und vor dem Bestwert.
    .filter((x) => x.keywordScore > 0 && meetsAnswerSubstance(x.substanz));
  // Der Bezugspunkt ist die REINE Relevanz des besten Treffers, nicht sein rankScore — der Status-/
  // Trust-Bonus (< 1) darf die Schwelle nicht anheben, sonst entschiede Trust doch über Relevanz.
  const best = scored.reduce((max, x) => Math.max(max, x.keywordScore), 0);
  return scored
    .map(({ ref, keywordScore, rankScore }) => ({ ref, keywordScore, rankScore }))
    .filter((x) => meetsRelevanceThreshold(x.keywordScore, best))
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
        // mega52 A3: keine Antwort → nichts hat sie getragen. Leer ist hier die Wahrheit.
        citedSources: [],
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
        // mega52 A3: keine Antwort → nichts hat sie getragen. Leer ist hier die Wahrheit.
        citedSources: [],
        steps: [],
        demo: true,
      };
    }
    return {
      answered: true,
      answer: best.statement,
      // mega53 B1: dieselbe eine Ableitung wie im Modellmodus. Hier ist die tragende Quelle genau
      // `best` — die Antwort IST ihre Aussage —, das Ergebnis bleibt also unverändert. Neu ist,
      // dass es aus der GEMEINSAMEN Regel kommt und nicht aus einer zweiten, gleichlautenden Zeile.
      ...answerStanding([best]),
      // SCRUM-256: Die deterministische Antwort (answer/trust/knowledgeClass/steps) wird
      // AUSSCHLIESSLICH aus `best` abgeleitet. Daher nur die tatsächlich genutzte Quelle melden —
      // lose gematchte Kandidaten erscheinen nicht als gleichwertige Antwortquellen (Quellen-
      // ehrlichkeit, Abgrenzung gegen Chatbot-Wahrnehmung). Kein Ranking-/Retrieval-Umbau.
      sources: [best.id],
      // mega52 A3: DIESER Weg wusste immer schon, worauf er steht — die Antwort IST `best.statement`.
      // Die tragende Quelle ist damit genau `best`, ohne jedes Zurücklesen. Das ist die vorhandene
      // Wahrheit, an der sich der Modellmodus jetzt ausrichtet, nicht umgekehrt.
      citedSources: [best.id],
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
