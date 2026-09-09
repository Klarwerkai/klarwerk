import { AsyncLocalStorage } from "node:async_hooks";
// JOB 3276: die leere Modellantwort im assist-Pfad ist ein Fehler mit Grund — dieselbe typisierte
// Klasse, die der HTTP-Chokepoint (model-client.ts) wirft, damit die Kette EINE Fehlerart kennt.
import { ModelEmptyResponseError } from "./model-errors";
import {
  DEFAULT_TOP_K,
  type ReasonerProvider,
  answerStanding,
  deterministicInterview,
  // JOB 3298: DIESELBE Zerlegung, die das Relevanzmaß benutzt — der Auszug wird nach der GLEICHEN
  // Wortauffassung gewählt, nach der die Quelle überhaupt Kandidat wurde. Eine zweite Tokenisierung
  // wäre eine zweite Wahrheit darüber, was ein Wort der Frage ist.
  queryTokens,
  selectCandidates,
  sourceLabel,
} from "./provider";
import type {
  AbbruchBefund,
  AnswerResult,
  AssistResult,
  CandidateGroup,
  ConflictJudgeResult,
  DescribeImageResult,
  DuplicateAspect,
  DuplicateJudgeResult,
  EnrichResult,
  ExtractResult,
  ExtractedPoint,
  GroupCandidateInput,
  GroupCandidatesResult,
  InterviewResult,
  KnowledgeRef,
  Kollision,
  KollisionSeite,
  ReasonerLocale,
  Relevanztext,
  StructureResult,
} from "./types";

// Abstrakter Modell-Client: kapselt den eigentlichen (anbieterspezifischen) Aufruf.
// FR-RSN-02/06: anbieteragnostisch; der Schlüssel lebt nur im Client (serverseitig).
export interface ModelClient {
  readonly name: string;
  // JOB 3036: der REINE Modellbezeichner, ohne Anbieter-Präfix (`claude-sonnet-4-6`, nicht
  // `anthropic:claude-sonnet-4-6`). `name` trägt den Anbieter weiterhin unverändert mit; dieses Feld
  // ist die ZWEITE, eigenständige Auskunft, die das Laufprotokoll (ModelRunRecord.model) braucht —
  // ohne sie stand dort ein zweites Mal derselbe Ausdruck. OPTIONAL, weil zahlreiche Test-Doubles
  // diese Schnittstelle erfüllen: ein Client ohne Modellangabe nennt keines, und das FEHLEN wird
  // nach oben durchgereicht, statt durch einen Ersatzwert gefüllt zu werden.
  readonly model?: string;
  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): sichtbare Egress-Politik des Clients. `true` = dieser
  // Client verweigert vertrauliche Inhalte per Konstruktion (Cloud ODER ein als „lokal" verdrahteter
  // Endpunkt, dessen Origin NICHT als On-Prem bestätigt ist — s. isConfirmedLocalOrigin). Der Reasoner
  // liest die Marke, um einen unzulässigen Judge-Provider VOR jedem Aufruf/Fetch auszuschließen und
  // den Lauf ehrlich als "confidential" zu schließen. Optional (Bestands-Fakes ohne Marke gelten als
  // vertraulichkeits-tauglich — der Wächter im Wrapper bleibt die harte letzte Instanz).
  readonly rejectsConfidential?: boolean;
  // SCRUM-411: optionales Antwort-Limit je Aufruf (Default beim Client: 1024).
  // SCRUM-502 Schicht 2: `confidential` ist PFLICHT (kein Default) — jeder Aufrufer MUSS die
  // Vertraulichkeit des Textes deklarieren. Der Cloud-Wrapper (cappedModelClient mit
  // rejectsConfidential) wirft bei true; so kann kein Pfad vertraulichen Text unbemerkt an die
  // Cloud geben. Interne, quell-reine Aufrufer (Probe/Weltwissen) übergeben bewusst false; die
  // Judges reichen seit D-AISTATE PAKET 1 (bens V1) das ECHTE Paar-Bit durch.
  complete(
    system: string,
    user: string,
    confidential: boolean,
    maxTokens?: number,
  ): Promise<string>;
  // WP-BILD-1c: OPTIONALER Bild-Eingang (Vision). Nur Clients, die WIRKLICH Bilder verarbeiten
  // können, implementieren ihn: der Anthropic-Cloud-Client (content als image/text-Block-Array) und
  // seit JOB 3100 der ChatGPT-Cloud-Client (Bild als `image_url`-Block). Der EIGENE lokale LLM trägt
  // ihn weiterhin NICHT — seine Bildfähigkeit hat niemand zugesagt. Welcher Client den Bildweg
  // bekommt, entscheidet allein `model-client.ts` (Feld `bildEingang`); der Endpunkt selbst wird
  // hier bewusst nicht genannt (Egress-Chokepoint-Wächter, `tests/security/egress-chokepoint.test.ts`).
  // Fehlt er, behandelt der Provider einen Bildbeschreibungs-Auftrag ehrlich als Fehlschlag —
  // es wird NIE aus dem Dateinamen oder Kontext eine Pseudo-Beschreibung erfunden.
  completeVision?(
    system: string,
    imageDataUrl: string,
    user: string,
    confidential: boolean,
    maxTokens?: number,
  ): Promise<string>;
}

// ================================================================================================
// AUFTRAG-mega52 BLOCK D — DIE AUSGABESPRACHE IST EINE ENTSCHEIDUNG, KEIN NEBENEFFEKT.
// ================================================================================================
//
// DER BEFUND (Pedi, 28.07.): Englisch und Niederländisch übersetzten nur die Metadaten, nicht den
// Antwortkörper. Zwei Ursachen, beide hier:
//   1. `answerSystem` enthielt KEINERLEI Anweisung zur Ausgabesprache. Die Sprache ergab sich
//      zufällig daraus, in welcher Sprache der Prompt zufällig formuliert war — bei gemischten
//      Quellen also gar nicht.
//   2. `toReasonerLocale` warf Niederländisch auf Deutsch (mega52 D1, jetzt behoben).
//
// `interviewSystem` macht es seit SCRUM-410 vorbildlich richtig („Antworte ausschließlich auf
// Deutsch." / „Answer in English only.") — genau diese Bauform gilt ab jetzt für JEDEN Modell-Task,
// dessen Ergebnis einem Menschen als Fließtext gezeigt wird. Der Sammler
// `tests/reasoner/mega52-ausgabesprache-sammler.test.ts` erhebt das über die Bauform.
//
// ZWEI REGELN, ZWEI HELFER:
//  · `outputLanguageRule` — die Ausgabesprache ist die GEWÄHLTE Sprache. Für Aufgaben, die neuen
//    Text für Menschen erzeugen (Antwort, Hilfe, Interview, Bildbeschreibung, Anreicherung,
//    Strukturierung, Gruppierung, Urteilsbegründungen).
//  · `keepInputLanguageRule` — die Ausgabesprache ist die des EINGABETEXTES. Für Aufgaben, die
//    vorhandenen Text glätten oder aus einem Dokument zitieren (assist, extract mit
//    keepSourceLanguage). Dort wäre die UI-Sprache aufzuzwingen schlicht falsch: sie würde den
//    Text des Experten übersetzen, statt ihn zu präzisieren. Auch das ist eine ausdrückliche
//    Festlegung der Ausgabesprache — nur eben eine andere.
const OUTPUT_LANGUAGE_RULE: Record<ReasonerLocale, string> = {
  de: "Formuliere alle für Menschen bestimmten Texte ausschließlich auf Deutsch.",
  en: "Write all human-readable text in English only.",
  nl: "Schrijf alle voor mensen bestemde tekst uitsluitend in het Nederlands.",
};

export function outputLanguageRule(locale: ReasonerLocale): string {
  return OUTPUT_LANGUAGE_RULE[locale];
}

const KEEP_INPUT_LANGUAGE_RULE: Record<ReasonerLocale, string> = {
  de: "Behalte die Sprache des Eingabetextes bei — übersetze nichts.",
  en: "Keep the language of the input text — do not translate anything.",
  nl: "Behoud de taal van de invoertekst — vertaal niets.",
};

export function keepInputLanguageRule(locale: ReasonerLocale): string {
  return KEEP_INPUT_LANGUAGE_RULE[locale];
}

// Der ANWEISUNGSKÖRPER bleibt zweisprachig (DE/EN) — er richtet sich an das Modell, nicht an den
// Nutzer, und ein dritter, gepflegter Prompt-Zwilling wäre eine dritte Wahrheit ohne Gewinn.
// Niederländisch bekommt bewusst den englischen Körper (die neutrale Prompt-Sprache) UND die
// ausdrückliche niederländische Ausgaberegel — die Sprache der Anweisung bestimmt die Ausgabe
// gerade NICHT mehr, genau darum ging es in diesem Block.
function taskInstruction(locale: ReasonerLocale, de: string, en: string): string {
  return locale === "de" ? de : en;
}

// FR-I18N-01: Systemprompts sprachbewusst. JSON-Contract der structure-Aufgabe bleibt
// in beiden Sprachen identisch — nur die Anweisung ist lokalisiert.
function structureSystem(locale: ReasonerLocale): string {
  const contract =
    '{"title": string, "statement": string, "conditions": string[], "measures": string[], ' +
    '"tags": string[], "confidence": number (0..1)}';
  const base = taskInstruction(
    locale,
    `Du strukturierst industrielles Erfahrungswissen. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Erfinde nichts dazu.`,
    `You structure industrial experiential knowledge. Respond ONLY with JSON: ${contract}. Do not invent anything.`,
  );
  // Die JSON-SCHLÜSSEL bleiben unangetastet; die Regel gilt den Werten, die der Nutzer liest.
  return `${base} ${outputLanguageRule(locale)}`;
}

// SCRUM-366 / AG-04 / FR-RSN-03: quellengebundene, anti-halluzinatorische Leitplanken für den
// Modellmodus. Bleibt anbieteragnostisch (kein RAG, kein neues Framework) — schärft NUR den
// System-Prompt: nur aus den nummerierten Quellen antworten, nichts erfinden/überdehnen, bei
// unzureichender Basis ehrlich auf die fehlende Wissensbasis verweisen, keine Fake-Zitate.
// AUFTRAG-mega52 A1: die Fußnotenmarke ist jetzt VERBINDLICH, nicht mehr erlaubt. Vorher hieß es
// „Du darfst auf die genutzten Quellen verweisen" — ein Angebot, das kein Modell einlösen musste
// und dessen Ergebnis ohnehin niemand zurücklas. Ohne Pflichtmarke gibt es keine Zuordnung, und
// ohne Zuordnung landet jedes bloß angesehene Objekt als gleichwertige Antwortquelle in der Liste.
// mega52 D2: die Ausgabesprache steht jetzt ausdrücklich im Prompt (Vorbild interviewSystem).
// JOB 2659 D1 (Review EXT1, Befund 7): die Absage ist STRUKTURIERT. Bisher verlangte der Prompt
// „sage ehrlich, dass die Wissensbasis das nicht abdeckt" — Fließtext, den der Code nicht von einer
// Antwort unterscheiden konnte; er ging als `answered:true` hinaus, ohne Wissenslücke. Jetzt ist die
// Absage ein Wort (`ABSAGE_MARKE`), das `answer()` zurückliest und auf `answered:false` abbildet.
function answerSystem(locale: ReasonerLocale): string {
  const base = taskInstruction(
    locale,
    `Beantworte die Frage NUR auf Basis der nummerierten Quellen. Erfinde keine Fakten, Zahlen, Ursachen oder Maßnahmen und ergänze kein allgemeines Weltwissen. Dehne keine Quelle über ihre tatsächliche Aussage hinaus. Reichen die Quellen nicht, antworte AUSSCHLIESSLICH mit dem Wort ${ABSAGE_MARKE} — ohne weiteren Text, rate nicht. Erfinde keine Zitate. Zu einer Quelle kann ein Feld „Dokumenttext (Auszug)" stehen: das sind wörtliche Sätze aus DERSELBEN Quelle und gehören zu deren Nummer — sie sind gleichwertige Grundlage, und du darfst wörtlich daraus übernehmen. Setze einen Satz aus dem Auszug nie mit einem anderen Satz zusammen. PFLICHT: Setze hinter JEDE Aussage, die auf eine Quelle zurückgeht, deren Nummer als Fußnotenmarke in eckigen Klammern, z. B. [1] oder [2][3]. Verwende AUSSCHLIESSLICH die vorgegebenen Quellennummern und markiere nur Quellen, die du wirklich benutzt hast.`,
    `Answer ONLY based on the numbered sources. Do not invent facts, numbers, causes or measures, and do not add general world knowledge. Do not overstate or stretch a source beyond what it actually says. If the sources are not enough, reply ONLY with the word ${ABSAGE_MARKE} — no other text, do not guess. Never fabricate quotes. A source may carry a field "Document text (excerpt)": these are verbatim sentences from the SAME source and belong to its number — they are equally valid grounding and you may copy from them verbatim. Never merge a sentence from the excerpt with another sentence. MANDATORY: after EVERY statement that comes from a source, put that source's number as a footnote marker in square brackets, e.g. [1] or [2][3]. Use ONLY the given source numbers and mark only sources you actually used.`,
  );
  return `${base} ${outputLanguageRule(locale)}`;
}

// ================================================================================================
// JOB 2659 D1 — EINE MARKE IST KEIN BELEG (Review EXT1-20260828, Befunde 4, 6, 7).
// ================================================================================================
//
// DER BEFUND: `citedSourceIds` prüfte nur, ob die Zahl in „[n]" im Kandidatenbereich liegt. Ein
// halluzinierter Satz mit „[1]" galt damit als belegt und wurde über `answerStanding` sogar
// „gesichert". Keine Codezeile prüfte, ob der Text aus der Quelle stammt.
//
// DER WEG ZUM MASS — vier Durchgänge, jeder hat eine Umgehung geschlossen (die Prosa unten ist
// Geschichte, der Code darunter ist der Stand D4):
//
//  · D1 verglich INHALTSTOKEN in Grundform (`queryTokens`) gegen die VEREINIGUNG der markierten
//    Quellen, mit einem ANTEIL von 60 % — UND DAS WAR FALSCH. BEN (2659 D1):
//    „Ventil tauschen [1]" gegen „Ventil schließen" passierte mit 2 von 3 Token; die
//    handlungsentscheidende Aussage kippte, die Tokenmehrheit legitimierte sie. Reine Tokenmasse
//    KANN das nicht fangen: jeder Anteil unter 100 % lässt genau ein neues Wort zu, und das eine
//    Wort ist bei einer Handlungsanweisung das Verb.
//  · UND JEDES TOKENMASS IST AN DER SCHLIMMSTEN STELLE BLIND (EXT1, Behebungsprüfung 19:37,
//    Entscheidung `00_CONTROL/ENTSCHEIDUNGEN/JOB-2659.md`): `tokenize` wirft Stoppwörter weg, und
//    in STOPWORDS stehen `nicht`, `kein`, `nie`, `ohne`, `nur`, `muss`, `darf`, `soll`, `kann`,
//    `immer`, `vor`, `nach`. „Ventil bei Überdruck NICHT schließen [1]" ist gegen „Ventil bei
//    Überdruck schließen" damit zu 100 % gedeckt — bei JEDER Schwelle. Zweites Loch: die Vereinigung
//    zweier markierter Quellen erlaubt, zwei wahre Sätze zu einem falschen zu verschränken. Drittes:
//    „X vor Y" → „Y vor X" — `vor` ist Stoppwort, die Tokenmenge bleibt gleich.
//
// DIE GEWÄHLTE FORM — ZITATDECKUNG, nicht Tokendeckung (Entscheidung des Kopfes: Form frei, hier
// begründet). Das Produktversprechen (`askRuleNote`) lautet: Klara „zitiert validiertes
// KLARWERK-Wissen wörtlich, statt eine Antwort zu formulieren". Genau das wird geprüft:
//  · EINHEIT: die markierte Aussage — der Text seit der vorigen Markengruppe. Der NACHLAUF hinter
//    der letzten Marke ist eine Aussage ohne Marke; trägt er ein Wort, fällt die ganze Antwort.
//  · REGEL (D3): Die Aussage muss nach Normalisierung (Kleinschreibung, Leerraum, Satzzeichen,
//    ä/ö/ü/ß; Zahlen unverändert) ein ZUSAMMENHÄNGENDER AUSSCHNITT EINER EINZIGEN markierten
//    Quelle sein. Alle Wörter zählen, auch Stoppwörter: „nicht" muss an derselben Stelle stehen,
//    „vor"/„nach" ebenso. Kleine Toleranz für Beugung (`beugungsgleich`: gemeinsamer Wortstamm,
//    Rest höchstens drei Zeichen), KEINE Toleranz für neue, fehlende oder vertauschte Wörter;
//    Zahlen nur exakt.
//  · SEGMENTE (D4, BEN 2659 D3): D3 verglich gegen den verketteten `refMatchText` und warf dabei
//    den Punkt weg — aus „Prüfen Sie Ventil A. Schließen Sie Ventil B." wurde der Strom „prüfen
//    sie ventil a schließen sie ventil b", und „Ventil A schließen [1]" war darin ein Ausschnitt
//    ÜBER DIE SATZGRENZE. Zwei richtige Sätze wurden zu einem falschen. Jetzt wird die Quelle in
//    SEGMENTE zerlegt (`quellSegmente`: je Feld — Titel, Aussage, jeder Bildtext, Volltext — und
//    darin je Satz), die Aussage ebenfalls satzweise (`saetze`), und JEDER Satz der Aussage muss
//    Ausschnitt EINES Segments DERSELBEN Quelle sein. Ein Ausschnitt verlässt nie ein Segment;
//    das Ende eines Satzes und der Anfang des nächsten ergeben kein Zitat — ebenso wenig das Ende
//    des Titels und der Anfang der Aussage. Warum satzweise und nicht nur eine Satzmarke im Strom:
//    die Marke müsste in der Aussage ebenfalls erhalten bleiben, und ein Modell setzt Punkte, wo
//    es will — die Segmentregel braucht vom Modell nichts, sie liest nur die Quelle.
//  · Eine Aussage ohne Wort („[1]." allein) behauptet nichts und gilt als gedeckt.
//
//  GEFANGEN:  „Ventil bei Überdruck nicht schließen [1]" gegen „Ventil bei Überdruck schließen"
//             — EXT1s Pflichtfall: „nicht" steht in keinem Ausschnitt der Quelle.
//             „Bei Überdruck das Ventil tauschen [1]" — „tauschen" ist kein Quellwort.
//             „Gedeckter Satz [1]. Ventil sofort tauschen." — der Nachlauf hat keine Marke.
//             „Ventil X … alle 3 Monate [1][2]" aus zwei Quellen verschränkt — kein Ausschnitt EINER.
//             „Y vor X" gegen „X vor Y" — die Reihenfolge ist Teil des Zitats.
//             „Ventil A schließen [1]" gegen „Prüfen Sie Ventil A. Schließen Sie Ventil B." —
//             BENs D3-Fall: der Ausschnitt überspränge die Satzgrenze.
//             dasselbe gegen „Prüfen Sie Ventil A.“ Schließen Sie Ventil B. — BENs D4-Fall: das
//             schließende Anführungszeichen (oder Apostroph, Klammer) hebt die Grenze nicht auf.
//  GEDECKT:   der Quellsatz selbst, ein Teilsatz daraus, eine gebeugte Form („schließt" für
//             „schließen"), mehrere Zitate je mit eigener Marke, zwei Sätze DERSELBEN Quelle
//             hintereinander („Prüfen Sie Ventil A. Schließen Sie Ventil B. [1]").
//
//  WAS DIESE DECKUNGSPRÜFUNG NICHT FÄNGT (D5, ehrlich aufgeschrieben — jede Zeile ein Fall):
//   1. BRUCHSTÜCKE MIT EIGENEM PUNKT (EXT1, Zweitinstanz D4): die Aussage wird ebenfalls satzweise
//      gelesen, und jeder Aussage-Satz muss Ausschnitt IRGENDEINES Segments derselben Quelle sein.
//      „Ventil A. Schließen. [1]" gegen „Prüfen Sie Ventil A. Schließen Sie Ventil B." → „ventil
//      a" ist Ausschnitt von Satz 1, „schließen" von Satz 2 → gedeckt. Der Mensch liest „Ventil
//      A. Schließen." — die falsche Anweisung mit einem Punkt dazwischen. Zwei Bruchstücke aus
//      zwei Segmenten. Mögliche Regel (EXT1): ein Aussage-Satz, der kein ganzer Quellsatz ist,
//      darf nur allein stehen, oder alle Bruchstücke müssen aus DEMSELBEM Segment kommen. Nicht
//      gebaut — Entscheidung des Kopfes (D5 war auf die Zeichenklasse zugeschnitten).
//   2. RICHTIG ZITIERT, FALSCHER KONTEXT: der Mensch fragt nach Ventil B, das Modell zitiert
//      korrekt den Satz über Ventil A. Kein Deckungsfehler — Relevanz, liegt beim Ranking.
//   3. WORTGLEICHER SATZ, ANDERE BEDEUTUNG DURCH AUSLASSUNG AM RAND: „Ventil A prüfen, bevor B
//      schließt" → Zitat „Ventil A prüfen [1]" ist ein Ausschnitt und gedeckt, obwohl die
//      Bedingung fehlt. Ein Teilsatz ist per Definition erlaubt (M3b) — der Preis dieser Freiheit.
//   4. ZAHLEN- UND EINHEITENFORMATE: „6,5 bar" gegen „6.5 bar" — Komma und Punkt bleiben in der
//      Normalisierung erhalten, die Formen gelten als verschiedene Wörter → Rückfall (sicher, aber
//      streng). Tausenderpunkte („1.000") desgleichen.
//   5. BEUGUNG: `beugungsgleich` erlaubt gemeinsamen Stamm ab 4 Zeichen mit Rest bis 3 —
//      „schließen"/„schließt" ja, aber auch „Ventil"/„Ventile" (richtig) und theoretisch zwei
//      verschiedene Wörter mit gleichem 4er-Stamm und kurzen Resten (z. B. „bremst"/„bremse").
//   6. ZEICHENKLASSE: Unicode-Schließzeichen außerhalb der Klasse oben (etwa 」 oder ﴿) halten
//      die Satzgrenze NICHT; das Produkt führt sie nicht, ein Import könnte sie liefern.
//   7. ABKÜRZUNGEN: „z. B." trennt an „z." und „B." (Punkt + Leerraum) — zu früh, nie verschmolzen;
//      ein Zitat über „z. B." hinweg fällt zurück. Dasselbe seit D4, durch D5 unverändert.
//  WAS ES KOSTET (EXT1, wörtlich): „Paraphrasen des Modells fallen zurück auf den Quellentext. Das
//             ist kein Verlust — es ist das Versprechen. Der Modelltext darf auswählen und
//             zusammenstellen, nicht umformulieren."
//
// Fällt eine Aussage durch, fällt die ANTWORT durch (Befund 4: „Rückfall auf `best.statement`
// oder `answered:false`", hier: die Aussage der bestgerankten zitierten Quelle im Wortlaut —
// dieselbe Form wie der deterministische Weg). Der Modelltext geht dann NICHT hinaus.
export const ABSAGE_MARKE = "KEINE_DECKUNG";

/** Normalisierung für den Zitatvergleich — ALLE Wörter bleiben, auch Stoppwörter. */
export function zitatWoerter(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .split(/[^a-z0-9.,]+/)
    .map((w) => w.replace(/^[.,]+|[.,]+$/g, ""))
    .filter((w) => w.length > 0);
}

/** Beugungstoleranz: gleiches Wort, oder gemeinsamer Stamm (ab 4 Zeichen) mit höchstens drei Zeichen Rest je Seite. Zahlen nur exakt. */
function beugungsgleich(a: string, b: string): boolean {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i >= 4 && a.length - i <= 3 && b.length - i <= 3;
}

/** Ist `aussage` ein zusammenhängender Ausschnitt von `quelle` (Wort für Wort, in Reihenfolge)? */
function istAusschnitt(aussage: readonly string[], quelle: readonly string[]): boolean {
  if (aussage.length === 0) return true;
  for (let start = 0; start + aussage.length <= quelle.length; start++) {
    let ok = true;
    for (let k = 0; k < aussage.length; k++) {
      if (!beugungsgleich(aussage[k] as string, quelle[start + k] as string)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export interface DeckungAussage {
  text: string;
  quellen: string[];
  /** Die EINE Quelle, deren Text die Aussage als Ausschnitt enthält — oder null. */
  zitatVon: string | null;
  /** true für den Text nach der letzten Marke (kein `[n]`, keine Quelle — nie gedeckt). */
  nachlauf: boolean;
  gedeckt: boolean;
}

export interface DeckungBefund {
  gedeckt: boolean;
  aussagen: DeckungAussage[];
}

const MARKE = /\[([0-9\s,]+)\]/g;

function markenIn(text: string, anzahl: number): number[] {
  const marked = new Set<number>();
  for (const match of text.matchAll(MARKE)) {
    for (const part of (match[1] ?? "").split(",")) {
      const n = Number.parseInt(part.trim(), 10);
      if (Number.isInteger(n) && n >= 1 && n <= anzahl) {
        marked.add(n);
      }
    }
  }
  return [...marked];
}

/** Ist der Text (in Gänze) die strukturierte Absage des Modells? */
export function istAbsage(answerText: string): boolean {
  return new RegExp(`(^|[^A-Z_])${ABSAGE_MARKE}([^A-Z_]|$)`).test(answerText);
}

/**
 * Prüft jede markierte Aussage des Antworttexts gegen die Quellen, die sie markiert.
 *
 * EINE AUSSAGE ist der Text seit der vorigen Markengruppe bis zu dieser Markengruppe — nicht der
 * Satz. Gemessen, warum: das Eval-Fake `hallucinatingModel` hängt „[1]" NACH dem letzten Satzpunkt
 * an; ein Satzsplitter machte die Marke zu einem eigenen, leeren Segment, das nichts behauptet und
 * als gedeckt galt, während die drei erfundenen Sätze davor unmarkiert und ungeprüft blieben.
 * Wer eine Marke ans Ende eines Absatzes setzt, hat den ganzen Absatz markiert — und muss ihn decken.
 *
 * JOB 2659 D2 (BEN, Vollständigkeit „halb"): Text NACH der letzten Marke war in D1 eine „benannte
 * Grenze" — und damit die Umgehung der ganzen Prüfung: gedeckte Marke voran, dahinter frei erfunden.
 * Jetzt ist der Nachlauf eine eigene Aussage ohne Quelle; trägt er ein Inhaltstoken, ist er
 * ungedeckt und kippt die Antwort. Ein Segment mit ungültigen Marken (etwa „[7]" bei zwei Quellen)
 * gilt ebenso: Marke ohne Quelle ist keine Deckung.
 */
export function pruefeDeckung(
  answerText: string,
  candidates: readonly KnowledgeRef[],
): DeckungBefund {
  const aussagen: DeckungAussage[] = [];
  const segmente: { text: string; nachlauf: boolean }[] = [];
  let start = 0;
  for (const gruppe of answerText.matchAll(/(?:\[[0-9\s,]+\]\s*)+/g)) {
    const ende = (gruppe.index ?? 0) + gruppe[0].length;
    segmente.push({ text: answerText.slice(start, ende).trim(), nachlauf: false });
    start = ende;
  }
  // Der Nachlauf zählt, sobald er ein Wort trägt. Ein nackter Satzpunkt hinter der Marke ist keiner.
  const rest = answerText.slice(start).trim();
  if (rest.length > 0 && zitatWoerter(rest).length > 0) {
    segmente.push({ text: rest, nachlauf: true });
  }
  for (const { text: satz, nachlauf } of segmente) {
    const marken = nachlauf ? [] : markenIn(satz, candidates.length);
    const quellen = marken.map((n) => candidates[n - 1] as KnowledgeRef);
    // D4: die Aussage satzweise — jeder Satz muss Ausschnitt eines Segments DERSELBEN Quelle sein.
    const aussageSaetze = saetze(satz.replace(MARKE, " "))
      .map((s) => zitatWoerter(s))
      .filter((w) => w.length > 0);
    // Ein Segment ohne gültige Quelle (Nachlauf, ungültige Marke) ist gedeckt nur, wenn es nichts sagt.
    const zitatVon =
      aussageSaetze.length === 0
        ? null
        : (quellen.find((q) => {
            const segmenteDerQuelle = quellSegmente(q);
            return aussageSaetze.every((a) => segmenteDerQuelle.some((s) => istAusschnitt(a, s)));
          })?.id ?? null);
    const gedeckt = aussageSaetze.length === 0 || zitatVon !== null;
    aussagen.push({ text: satz, quellen: quellen.map((q) => q.id), zitatVon, nachlauf, gedeckt });
  }
  return { gedeckt: aussagen.every((a) => a.gedeckt), aussagen };
}

/**
 * D4: Satzweise Zerlegung. Ein Satz endet an `.`, `!`, `?`, `:` oder `;` NUR mit folgendem Leerraum
 * (oder am Zeilenumbruch) — „6.5 bar" und „z.B." bleiben zusammen, „Ventil A. Schließen" trennt.
 */
/**
 * D5 (BEN 2659 D4): DIE SCHLIESSENDE TYPOGRAFIE HEBT DIE SATZGRENZE NICHT AUF. Zwischen
 * Satzendezeichen und Leerraum dürfen beliebig viele SCHLIESSENDE Zeichen stehen — die Grenze
 * bleibt. Die Klasse ist die Zusicherung; sie steht hier vollständig:
 *   Anführungszeichen  “  ”  "  »  «  ›  ‹      (deutsch „…“ schließt mit “; »…« und «…» beide
 *                                                Richtungen; ›…‹ ebenso)
 *   Apostrophe         '  ’  ‘
 *   Klammern           )  ]  }
 * NICHT in der Klasse (bewusst): „ (U+201E) und ‚ (U+201A) sind ÖFFNENDE Zeichen und stehen nie
 * hinter einem Satzende. Ein Zeichen, das zwischen Satzende und Leerraum steht und KEINE
 * Satzgrenze bedeutet, gibt es in dieser Klasse nicht — das schließende Zeichen gehört zum Satz
 * davor. Was die Klasse VERSCHÄRFT: ein Satzzeichen INNERHALB eines Zitats („Er sagte „Stopp.“
 * und ging.") trennt jetzt zu früh; ein Modellzitat über diese Stelle fällt zurück. Das ist ein zu
 * früh getrennter Satz, kein verschmolzener — die sichere Richtung (H3 pinnt es).
 */
const SCHLIESSEND = "“”\"»«›‹'’‘)\\]}";
const SATZGRENZE = new RegExp(`(?<=[.!?:;][${SCHLIESSEND}]*)\\s+|\\n+`);

export function saetze(text: string): string[] {
  return text
    .split(SATZGRENZE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * D4: die Segmente einer Quelle — je Feld (Titel, Aussage, jeder Bildtext, Volltext), darin je
 * Satz, als normalisierte Wortfolgen. Ein Zitat verlässt nie ein Segment: weder eine Satzgrenze
 * noch die Grenze zwischen zwei Feldern. Das ist die Bezugsgröße, die EXT1 in der Zweitinstanz D2
 * verlangt hat („ein Satz einer Quelle, nicht der Text aller Quellen") und BEN in D3 mit dem
 * Fall „Prüfen Sie Ventil A. Schließen Sie Ventil B." erzwungen hat.
 */
export function quellSegmente(ref: KnowledgeRef): string[][] {
  const felder = [ref.title, ref.statement, ...(ref.captionTexts ?? []), ref.bodyText ?? ""];
  const segmente: string[][] = [];
  for (const feld of felder) {
    for (const s of saetze(feld)) {
      const woerter = zitatWoerter(s);
      if (woerter.length > 0) {
        segmente.push(woerter);
      }
    }
  }
  return segmente;
}

// ================================================================================================
// JOB 3298 · ASK-VOLLTEXT — DIE REGEL STEHT IM DOKUMENTTEXT, ALSO GEHÖRT SIE IN DEN ANTWORTKONTEXT.
// ================================================================================================
//
// DER BEFUND (Codex b65c00b4, Freitagsvorführung A02/A06/W1). Seit G27 (JOB 1565 D1) trägt ein Ref
// den Dokumenttext (`bodyText`, aus der Suchprojektion), und seit JOB 2614 D3 reicht der Ask-Dienst
// ihn wirklich durch. Er wirkte aber NUR auf zwei Dinge: auf das Relevanzmaß (`refMatchText`) und
// auf die Zitatprüfung (`quellSegmente`). Der Text, den das Modell zu sehen bekam, war unverändert
// `[i] Titel: Aussage`. Folge auf der importierten Confluence-Seite C02, deren Aussage nur der
// DEMO-Hinweis ist und deren Regel („30 calendar days") im Fließtext steht: die Quelle wird
// GEFUNDEN, das Modell sieht die Regel nie — es sagt strukturiert ab (ABSAGE_MARKE) oder antwortet
// ohne die Regel. Wissen im Haus, unerreichbar an der letzten Kante.
//
// WAS HIER ENTSTEHT: je Quelle ein AUSZUG aus ihrem Dokumenttext — die Sätze, die mit der Frage
// Inhaltstoken teilen —, der im Grounding als EIGENES Feld neben der Kernaussage steht.
//
// DREI ZUSAGEN, die den Auszug tragen (jede ist unten ein Testfall):
//
//  1. WÖRTLICH UND SATZGANZ. Der Auszug besteht aus GANZEN Sätzen des Dokumenttexts, unverändert.
//     Er wird nicht normalisiert (`zitatWoerter` wäre für den Menschen unlesbar: „ueberdruck") und
//     nicht umformuliert. Damit ist jeder Auszug-Satz Zeichen für Zeichen ein Satz, den
//     `quellSegmente` aus demselben `bodyText` schneidet — ein Zitat aus dem Auszug ist folglich
//     ein Ausschnitt EINES Segments DERSELBEN Quelle und besteht die Prüfung D4 unverändert. Die
//     Segmentregel wird NICHT gelockert: sie bekommt nur endlich Material, das sie decken kann.
//  2. NUR AUS DEM DOKUMENTTEXT. Titel und Aussage stehen ohnehin im Grounding; sie hier zu
//     wiederholen kostete Kontext ohne Gewinn. Bildfußnoten (`captionTexts`) bleiben bewusst
//     draußen — sie sind ein eigener Weg und ein eigener Auftrag (Rest in der Rückgabe).
//  3. GEDECKELT, UND ZWAR ZWEIFACH. Der Dokumenttext kommt aus der Suchprojektion und darf dort bis
//     zu MAX_SEARCH_TEXT_LENGTH (200.000 Zeichen) lang sein; `DEFAULT_TOP_K` ist 8. Ungedeckelt
//     wären das 1,6 Mio. Zeichen je Frage im Prompt. Die Zahlen unten sind deshalb hart.
//
// DIE ZAHLEN, UND WARUM GENAU DIESE:
//  · 3 SÄTZE je Quelle: eine Regel besteht in diesen Dokumenten aus der Regel, ihrer Bedingung und
//    ihrer Folge. Bei 1 fiele die Bedingung weg (Pedis „30 calendar days" ohne „after delivery"),
//    ab 4 kippt der Auszug in ein Abschriftverfahren, das die Auswahl nicht mehr trifft.
//  · 600 ZEICHEN je Quelle: 3 Sätze zu je ~200 Zeichen — die Länge eines normalen Fachsatzes in
//    diesem Bestand. Der Deckel schneidet also nur, was ohnehin überlang ist.
//  · 2400 ZEICHEN insgesamt: der Bezugspunkt ist das einzige vergleichbare Server-Budget im Haus,
//    MAX_IMAGE_CONTEXT_LENGTH = 1500 Zeichen für EINEN mitgereichten Dokument-Kontext. Für bis zu
//    acht Quellen ist das Vierfache je Quelle unvertretbar, das Anderthalbfache insgesamt ist es
//    nicht: 2400 Zeichen sind rund 600 Tokens, gegen ein Antwortbudget von 1024 Tokens und ein
//    bisheriges Grounding von acht Titel/Aussage-Zeilen (gemessen 300–2000 Zeichen). Der Prompt
//    wächst im schlimmsten Fall etwa auf das Doppelte — das ist der Preis, und er steht in der
//    Rückgabe. Ein Gesamtdeckel UND ein Quelldeckel, weil der Quelldeckel allein bei acht Quellen
//    4800 Zeichen zuließe und der Gesamtdeckel allein eine einzige Quelle alles verbrauchen ließe.
export const AUSZUG_MAX_SAETZE = 3;
export const AUSZUG_MAX_ZEICHEN_JE_QUELLE = 600;
export const AUSZUG_MAX_ZEICHEN_GESAMT = 2400;

/**
 * Kürzt auf höchstens `deckel` Zeichen, ohne ein Wort zu zerschneiden.
 *
 * Warum die Wortgrenze: ein halbes Wort („30 calendar da") wäre zwar weiterhin ein zulässiger
 * ANFANG des Quellsegments — die Deckungsprüfung bliebe also sicher —, aber das Modell würde es
 * zitieren und die Prüfung fiele auf den Quellwortlaut zurück. Der Schnitt an der Wortgrenze
 * kostet nichts und nimmt diesen Fehlweg heraus. Gibt es im Deckel gar keine Leerstelle, bleibt
 * der harte Schnitt: er ist die sichere Richtung (ein Zitat daraus fällt zurück, es hält nie mehr).
 */
function kuerzeAufWortgrenze(text: string, deckel: number): string {
  if (text.length <= deckel) {
    return text;
  }
  const roh = text.slice(0, deckel);
  const letzte = roh.lastIndexOf(" ");
  return (letzte > 0 ? roh.slice(0, letzte) : roh).trim();
}

/**
 * Der Auszug EINER Quelle: die Sätze ihres Dokumenttexts, die mit der Frage Inhaltstoken teilen.
 *
 * AUSWAHL nach Wortüberdeckung (verschiedene gemeinsame Inhaltstoken, wie überall in diesem Modul
 * gezählt), bei Gleichstand entscheidet die frühere Stelle im Dokument — die Reihenfolge ist damit
 * TOTAL und der Auszug für dieselbe Frage und denselben Text immer derselbe. AUSGEGEBEN wird in
 * Dokumentreihenfolge: der Mensch liest die Sätze so, wie sie im Dokument stehen.
 *
 * Ein Satz OHNE gemeinsames Token kommt nicht in den Auszug. Das ist die Grenze, die den Auszug von
 * einer Abschrift trennt: mitgegeben wird, was zur Frage gehört, nicht der Anfang des Dokuments.
 */
export function dokumentAuszug(
  frage: string,
  ref: KnowledgeRef,
  deckelZeichen: number = AUSZUG_MAX_ZEICHEN_JE_QUELLE,
): string[] {
  const body = ref.bodyText?.trim() ?? "";
  const budget = Math.min(deckelZeichen, AUSZUG_MAX_ZEICHEN_JE_QUELLE);
  if (body.length === 0 || budget <= 0) {
    return [];
  }
  const frageWoerter = new Set(queryTokens(frage));
  if (frageWoerter.size === 0) {
    return [];
  }
  const bewertet = saetze(body)
    .map((satz, stelle) => ({
      satz,
      stelle,
      treffer: new Set(queryTokens(satz).filter((w) => frageWoerter.has(w))).size,
    }))
    .filter((x) => x.treffer > 0)
    .sort((a, b) => (b.treffer === a.treffer ? a.stelle - b.stelle : b.treffer - a.treffer))
    .slice(0, AUSZUG_MAX_SAETZE);
  const genommen: { satz: string; stelle: number }[] = [];
  let verbraucht = 0;
  for (const { satz, stelle } of bewertet) {
    // Das Trennzeichen zwischen zwei Sätzen zählt mit — sonst überschritte der zusammengesetzte
    // Auszug den Deckel um genau die Zahl seiner Fugen.
    const kosten = satz.length + (genommen.length > 0 ? 1 : 0);
    if (verbraucht + kosten <= budget) {
      genommen.push({ satz, stelle });
      verbraucht += kosten;
      continue;
    }
    if (genommen.length === 0) {
      // Der bestbewertete Satz allein sprengt den Deckel: gekürzt ist er mehr wert als gar nichts.
      const gekuerzt = kuerzeAufWortgrenze(satz, budget);
      if (gekuerzt.length > 0) {
        genommen.push({ satz: gekuerzt, stelle });
      }
      break;
    }
  }
  return genommen.sort((a, b) => a.stelle - b.stelle).map((x) => x.satz);
}

/**
 * Die Auszüge ALLER Quellen unter dem Gesamtdeckel — Quelle für Quelle in Rangfolge, weil der
 * bestgerankte Treffer sein Budget zuerst bekommen soll. Ist das Gesamtbudget aufgebraucht, tragen
 * die hinteren Quellen keinen Auszug; sie stehen weiterhin mit Titel und Aussage im Grounding
 * (nichts verschwindet, es kommt nur nichts hinzu).
 */
export function dokumentAuszuege(
  frage: string,
  refs: readonly KnowledgeRef[],
): Map<string, string> {
  const auszuege = new Map<string, string>();
  let uebrig = AUSZUG_MAX_ZEICHEN_GESAMT;
  for (const ref of refs) {
    if (uebrig <= 0) {
      break;
    }
    const gewaehlt = dokumentAuszug(frage, ref, Math.min(AUSZUG_MAX_ZEICHEN_JE_QUELLE, uebrig));
    if (gewaehlt.length === 0) {
      continue;
    }
    const text = gewaehlt.join(" ");
    auszuege.set(ref.id, text);
    uebrig -= text.length;
  }
  return auszuege;
}

// ================================================================================================
// JOB 3353 · ASK-C02 — ZWEI GEMESSENE FEHLER AN DER LETZTEN KANTE.
// ================================================================================================
//
// DER LIVEBEFUND (Codex d1710126 / a2c15bbf auf 1.201, Freitagsvorführung). Pedi fragt lang:
// „In the fictional Advisor ICT demo data, what is the standard invoice payment period? Answer in
// English and cite the stored source. If the sources disagree, say so rather than choosing
// silently." Klara antwortet AUSSCHLIESSLICH mit dem DEMO-Hinweis der Confluence-Kopie von C02,
// Vertrauenswert 0, und das validierte Paketobjekt desselben Titels ist gar nicht erst dabei.
// Fragt Pedi KURZ („What is the standard invoice due date?"), kommt die vollständige Regel aus dem
// Paketobjekt. Dieselbe Wissenslage, zwei Frageformen, zwei Antworten.
//
// DIE MESSUNG (tests/ask-c02/befund.test.ts, Fälle M1–M4 — die Zahlen unten stammen von dort und
// sind dort nachgerechnet, nicht abgeschrieben):
//
//   M1  DER AUSZUG IST NICHT DER FEHLER. `queryTokens` führt „invoices" und „invoice" beide auf
//       „invoic"; der Auszug für C02 enthält bei BEIDEN Frageformen den Satz mit den 30 Kalender-
//       tagen. Die Ausgangsthese des Auftrags („leer wegen Flexion") ist damit gemessen WIDERLEGT,
//       und die dort vorgeschlagene Normalisierung wird deshalb NICHT gebaut (Auftrag §
//       Nachführung: „Keine Reparatur auf Verdacht").
//
//   M2  DIE RAHMENWÖRTER DER FRAGE WERFEN DAS VALIDIERTE OBJEKT HERAUS. Die Confluence-Kopie trägt
//       als Kernaussage den Fiktionshinweis („Fictional demonstration material prepared for Advisor
//       ICT …"). Gegen die LANGE Frage misst sie deshalb 6 gemeinsame Inhaltstoken (standard,
//       invoic UND fictional, advisor, ict, demo), das validierte Paketobjekt nur 2. Die relative
//       Regel `meetsRelevanceThreshold` (2·2 > 6 ist falsch) stuft das validierte Objekt als
//       Mitläufer ein und entfernt es. Gegen die KURZE Frage stehen beide bei 4 und beide bleiben.
//       Die vier Zusatzpunkte kommen also NICHT aus der Sache, sondern aus dem RAHMEN, in dem
//       gefragt wurde — und sie treffen die Quelle, die den Rahmen im Text trägt.
//
//   M3  DER DECKUNGSRÜCKFALL GIBT DEN HINWEIS AUS. Das Modell bekommt den Regelsatz im Auszug und
//       formuliert ihn um („The standard invoice payment period is 30 calendar days …") — eine
//       Paraphrase, und die Zitatprüfung lässt keine Paraphrase durch (gemessen: `gedeckt=false`,
//       der wörtliche Satz dagegen `true`). Der Rückfall gab bis heute `carrying[0].statement`
//       aus und meldete `answered: true`. Bei der Confluence-Kopie IST diese Kernaussage der
//       Fiktionshinweis — genau der Livetext.
//
// WAS DARAUS FOLGT, und nur das: zwei eng begrenzte Regeln. Die Zitatprüfung selbst, die Zusagen
// aus JOB 3298 (wörtlich, satzganz, gedeckelt), die Sichtbarkeitsregeln und `selectCandidates`
// bleiben unangetastet.

// ------------------------------------------------------------------------------------------------
// JOB 3353 R2 (Codex 6338b57f, Befund 1) — EINE KLAMMER IST NOCH KEINE HERKUNFTSMARKE.
// ------------------------------------------------------------------------------------------------
//
// RUNDE 1 ENTFERNTE JEDE führende Klammergruppe. Codex hat den Preis benannt, und er ist zu hoch:
// „[NL] Invoice due date" und „[DE] Invoice due date" wären damit Zwillinge geworden, ebenso
// „[Router A] Reset" und „[Router B] Reset" — ein sachfremder validierter Stand hätte sich vor den
// richtigen geschoben. Ein Klammerpräfix trägt im Bestand BEIDES: Herkunft UND Geltungsbereich.
// Nur das erste darf wegfallen.
//
// DIE LISTE IST DESHALB AUFGEZÄHLT UND BELEGT, nicht gemustert. Zwei Marken, zwei Fundstellen:
//   · `[Beispiel] `  — `EXAMPLE_TITLE_PREFIX` (services/app/src/example-packages.ts:19). Der
//                      Ladeweg setzt sie vor JEDEN Titel eines Demopakets; sie sagt „aus einem
//                      Paket geladen" und nichts über die Sache.
//   · `[DEMO …] `    — der Titelpräfix der Demo-Seiten des Confluence-Raums, im Livebefund als
//                      „[DEMO C02] Standard invoice due date" gemessen (Codex d1710126). Der Teil
//                      hinter DEMO ist der Seitenschlüssel des Raums, also ebenfalls Herkunft.
//
// WER EINE DRITTE MARKE AUFNIMMT, nennt hier ihre Fundstelle im Produkt. Ohne Fundstelle gehört
// ein Präfix zum Titel — im Zweifel bleibt es stehen, und die beiden Objekte sind KEINE Zwillinge.
// Das ist die sichere Richtung: ein nicht erkannter Zwilling kostet die Vorreihung, ein falsch
// erkannter stellt einen sachfremden Stand nach vorn.
const HERKUNFTSMARKE = /^\s*\[(?:beispiel|demo(?:\s[^\]]*)?)\]\s*/i;

/**
 * Der Titelkern: der Titel OHNE eine führende, BELEGTE Herkunftsmarke (Liste oben).
 *
 * „[Beispiel] Standard invoice due date" und „[DEMO C02] Standard invoice due date" fallen damit
 * auf denselben Kern — sie sind dieselbe Seite in zwei Herkünften. „[NL] Invoice due date" und
 * „[DE] Invoice due date" fallen NICHT zusammen: `NL`/`DE` steht in keiner Fundstelle und gilt
 * darum als Teil des Titels. Entfernt wird höchstens EINE Marke; was danach kommt, bleibt stehen.
 */
export function titelkern(titel: string): string {
  return titel.replace(HERKUNFTSMARKE, "").trim().toLowerCase();
}

/**
 * JOB 3353 · DIE ZWILLINGSREGEL — ein validiertes Objekt verliert seinen Platz nicht an die
 * unvalidierte Kopie desselben Titels.
 *
 * WAS SIE TUT, in einem Satz: unter Kandidaten mit DEMSELBEN Titelkern steht der validierte vorn,
 * und ein validierter Zwilling eines gewählten Kandidaten wird wieder aufgenommen, wenn die
 * relative Regel ihn als Mitläufer entfernt hat (M2).
 *
 * WAS SIE AUSDRÜCKLICH NICHT TUT — das ist die Grenze, die sie ungefährlich macht:
 *  · Sie holt KEINEN neuen Titel herein. Nur ein Objekt, dessen Titelkern schon unter den
 *    gewählten Kandidaten steht, kann zurückkommen. Welche Titel überhaupt zur Frage gehören,
 *    entscheidet unverändert allein `selectCandidates`.
 *  · Sie ändert KEINE Sichtbarkeitsregel. `validatedOnly` und `dropConfidential` haben lange vor
 *    dieser Zeile entschieden, welche Objekte überhaupt Kandidat sein dürfen (ask/src/service.ts);
 *    hier steht nur noch, in welcher Reihenfolge die Übriggebliebenen dem Modell vorliegen.
 *  · Sie hebt den Deckel nicht an. `topK` bleibt `topK`; ein zurückgeholter Zwilling nimmt den
 *    Platz des schwächsten Mitläufers ein, der Prompt wächst um kein Zeichen.
 *
 * WARUM „validiert vorn" und nicht „nur der validierte": zwei Objekte gleichen Titels können
 * inhaltlich auseinandergehen (die Kopie ist der Import, das Paketobjekt der freigegebene Stand).
 * Die Kopie zu VERSCHWEIGEN hieße, einen möglichen Widerspruch zu unterschlagen — und die Frage
 * „If the sources disagree, say so" wäre nicht mehr beantwortbar. Beide bleiben also im Kontext;
 * nur die Rangfolge sagt, welcher der geprüfte Stand ist.
 */
export function waehleKandidaten(
  frage: string,
  kontext: readonly KnowledgeRef[],
  topK: number = DEFAULT_TOP_K,
  relevanz: Relevanztext = [],
): KnowledgeRef[] {
  const gewaehlt = selectCandidates(frage, kontext, topK, relevanz);
  const kerne = new Set(gewaehlt.map((r) => titelkern(r.title)));
  const gewaehlteIds = new Set(gewaehlt.map((r) => r.id));
  const nachzuegler = kontext.filter(
    (r) => !gewaehlteIds.has(r.id) && r.status === "validiert" && kerne.has(titelkern(r.title)),
  );
  if (nachzuegler.length === 0 && gewaehlt.every((r) => r.status === "validiert")) {
    // Nichts zurückzuholen und nichts umzuordnen — die Auswahl geht Zeichen für Zeichen unverändert
    // hinaus. Das ist der Normalfall und er kostet nichts.
    return gewaehlt;
  }
  // Ausgabe in der Rangfolge der gewählten Kandidaten; beim ERSTEN Auftreten eines Titelkerns
  // kommen seine validierten Zwillinge davor. Damit bleibt die Ordnung total und stabil.
  const geordnet: KnowledgeRef[] = [];
  const gesetzt = new Set<string>();
  const erledigteKerne = new Set<string>();
  for (const ref of gewaehlt) {
    const kern = titelkern(ref.title);
    if (!erledigteKerne.has(kern)) {
      erledigteKerne.add(kern);
      for (const zwilling of [...nachzuegler, ...gewaehlt]) {
        if (
          zwilling.status === "validiert" &&
          titelkern(zwilling.title) === kern &&
          !gesetzt.has(zwilling.id)
        ) {
          gesetzt.add(zwilling.id);
          geordnet.push(zwilling);
        }
      }
    }
    if (!gesetzt.has(ref.id)) {
      gesetzt.add(ref.id);
      geordnet.push(ref);
    }
  }
  return geordnet.slice(0, topK);
}

/**
 * JOB 3353 · DER DECKUNGSRÜCKFALL SAGT NIE ETWAS, DAS DIE FRAGE NICHT BERÜHRT.
 *
 * Die Reihenfolge ist die ganze Regel, und sie ist nach ABNEHMENDEM Fragebezug geordnet:
 *
 *  1. DER AUSZUG. Die Sätze des Dokumenttexts, die diese Frage ausgewählt hat — wörtlich, satzganz
 *     und aus DERSELBEN Quelle. Er ist per Konstruktion ein Ausschnitt eines Segments dieser Quelle
 *     (JOB 3298, Zusage 1) und besteht die Deckungsprüfung deshalb selbst; und er ist das einzige
 *     Material auf dieser Kante, dessen Bezug zur Frage GEMESSEN ist. Bei C02 ist das der Satz mit
 *     den 30 Kalendertagen — genau die Auskunft, die Pedi verlangt hat.
 *  2. DIE KERNAUSSAGE — unverändert wie bisher. Trägt die Quelle keinen Dokumenttext, ist sie das
 *     einzige Material, das sie hat, und JOB 2659 hat sie genau dafür an diese Stelle gesetzt.
 *  3. NICHTS. Bleibt auch die Kernaussage leer, wird nichts behauptet: `answered: false`, dieselbe
 *     ehrliche Wissenslücke wie ohne Kandidaten. Bis heute ging in diesem Fall die leere
 *     Zeichenkette als beantwortete Frage hinaus.
 *
 * Geprüft wird QUELLE FÜR QUELLE in Rangfolge: hat die bestgerankte zitierte Quelle keinen Auszug,
 * darf die zweite ihn liefern, statt dass der Rückfall am ersten Kandidaten endet.
 *
 * ------------------------------------------------------------------------------------------------
 * WAS HIER BEWUSST NICHT STEHT, UND DIE MESSUNG DAZU (Auftrag, Nachführung: „dieser Ersatz darf NIE
 * eine Kernaussage als Antwort ausgeben, die die Frage nicht beantwortet").
 *
 * Der naheliegende Zusatz wäre ein Tor auf Schritt 2: die Kernaussage nur ausgeben, wenn sie
 * `MIN_ANSWER_SUBSTANCE` Inhaltstoken mit der Frage teilt. Er ist gebaut, gemessen und wieder
 * ENTFERNT worden, weil die Messung ihn widerlegt (die Zahlen stehen in
 * `tests/ask-c02/befund.test.ts`, Fall M5):
 *
 *   Frage „Was tun mit Ventil A in Anlage 7?" · Aussage „Pruefen Sie Ventil A. Schliessen Sie
 *   Ventil B."                                                → 1 gemeinsames Token („ventil")
 *   Frage „In the fictional Advisor ICT demo data, …" · Aussage „DEMO notice: content imported for
 *   the demonstration."                                       → 1 gemeinsames Token („demo")
 *
 * Der richtige Rückfall (JOB 2659 G1/H1: der Mensch liest die Quelle statt der falschen Zuordnung)
 * und der falsche (ein Herkunftshinweis als Antwort) sind an diesem Maß NICHT unterscheidbar — das
 * Tor hätte 15 bestehende Fälle rot gemacht, darunter BENs Pflichtfälle. Ein Maß, das beide trennt,
 * hat dieses Haus nicht; eines zu erfinden hieße, Codex' Netz für einen Verdacht zu lockern.
 *
 * Was den Livefall STATTDESSEN schließt, ist Schritt 1 und nur er: eine importierte Confluence-Seite
 * trägt IMMER ihren Dokumenttext (`bodyText` aus der Suchprojektion), also gewinnt der Auszug, und
 * der Hinweis kommt nie zum Zug (Fall A5). Der ungedeckte Rest — eine Quelle OHNE Dokumenttext,
 * deren Kernaussage ein reiner Hinweis ist — steht als benannte Prüflücke in der Rückgabe. Im
 * Bestand der Vorführung gibt es ihn nicht.
 * ------------------------------------------------------------------------------------------------
 */
export function rueckfallAntwort(
  frage: string,
  tragend: readonly KnowledgeRef[],
): { ref: KnowledgeRef; text: string } | null {
  for (const ref of tragend) {
    const auszug = dokumentAuszug(frage, ref);
    if (auszug.length > 0) {
      return { ref, text: auszug.join(" ") };
    }
  }
  for (const ref of tragend) {
    if (ref.statement.trim().length > 0) {
      return { ref, text: ref.statement };
    }
  }
  return null;
}

// ================================================================================================
// JOB 3365 · ASK-C02-KONFLIKT — DER RÜCKFALL WÄHLT NICHT STILL EINE VON ZWEI AUSKÜNFTEN.
// ================================================================================================
//
// DER BEFUND (Codex 8950be7a/b9949f58, 09.09.; JOB 3353 R4, REST 2 — dort gemessen und ausdrücklich
// NICHT grün festgeschrieben). Im Bestand der Vorführung stehen zwei nachvollziehbar abweichende
// Fristen: der freigegebene Stand sagt 30 Kalendertage, die importierte Confluence-Kopie 45. Pedis
// Frage verlangt wörtlich „If the sources disagree, say so rather than choosing silently". Sagt das
// Modell daraufhin einen freien Satz ÜBER die Quellen („The sources disagree …"), verwirft ihn
// `pruefeDeckung` zu Recht — ein Nachlauf ohne Marke ist von keiner Quelle gedeckt. Danach griff
// `rueckfallAntwort` und gab die 30 Tage aus, `answered:true`, EINE Quelle. Der belegte Widerspruch
// verschwand auf der letzten Kante, und zwar STILL: dem Leser sah man nicht an, dass überhaupt
// etwas abzuwägen war.
//
// WARUM DAS EIN FEHLER IST UND NICHT NUR UNSCHÖN: der Rückfall greift GENAU DANN, wenn der
// Modelltext verworfen wurde. In diesem Augenblick gibt es keine belastbare Aussage mehr darüber,
// WELCHE Quelle die Frage beantwortet — die einzige, die es je gab, ist gerade durchgefallen. Eine
// davon als vollständige Antwort auszugeben, ist die stille Wahl, die die Frage verboten hat.
//
// WAS HIER ENTSTEHT, und nur das: der Rückfall sieht nach, ob eine ANDERE herangezogene Quelle zu
// DERSELBEN Frage einen ANDEREN Wortlaut trägt. Trägt sie einen, wird nichts mehr gewählt; die
// Antwort nennt beide Quellen mit ihrem Wortlaut und sagt, dass die Frage damit nicht geklärt ist.
//
// DIE VIER GRENZEN, die das ungefährlich machen:
//  · KEINE LOCKERUNG DER ZITATPRÜFUNG. `pruefeDeckung` läuft unverändert, der Modelltext geht
//    weiterhin nicht hinaus, und jeder ausgegebene Satz ist WÖRTLICH der Auszug einer Quelle
//    (JOB 3298, Zusage 1) oder ihre Kernaussage — kein Zeichen davon ist formuliert.
//  · KEIN C02-SONDERFALL. Es steht kein Titel, kein Schlüssel, keine Zahl und keine Einheit in
//    dieser Regel. Sie kennt nur „zwei Auszüge zu derselben Frage sind nicht derselbe Text".
//  · KEINE BEHAUPTUNG ÜBER DIE SACHE. Gemessen ist, dass die Wortlaute VERSCHIEDEN sind — nicht,
//    dass sie sich widersprechen (sie könnten einander auch ergänzen). Der Begleitsatz sagt genau
//    das und nicht mehr; er nennt die Frage „nicht geklärt", statt einen Widerspruch zu behaupten.
//    Ein Maß für „widerspricht" hat dieses Haus nicht, und eines zu erfinden hieße, aus zwei
//    verschiedenen Sätzen eine Tatsache abzuleiten, die niemand belegt hat.
//  · KEIN FEHLALARM BEI EINIGKEIT. Verglichen wird über `zitatWoerter`, also normalisiert:
//    Zwillinge mit demselben Dokumenttext (der Normalfall — dieselbe Seite als Paketobjekt und als
//    Import) liefern denselben Auszug, fallen zusammen und ändern gar nichts. Dann bleibt der
//    Rückfall Zeichen für Zeichen der Rückfall aus JOB 3353.
//
// UND DIE EINSTUFUNG FOLGT MIT: `answerStanding` rechnet ab jetzt über ALLE genannten Quellen. Eine
// offene Kopie in der Herleitung macht die Antwort „ungeprüft" mit Vertrauenswert 0 — was sie ist.
// Die alte Form gab „gesichert, 90" aus, obwohl die andere Hälfte der Auskunft ungeprüft war.

/** Der Vergleichsschlüssel zweier Auskünfte: derselbe Wortlaut, unabhängig von Schreibung und Leerraum. */
function auskunftSchluessel(text: string): string {
  return zitatWoerter(text).join(" ");
}

/**
 * Der Begleitsatz vor den Wortlauten. Er behauptet zwei Dinge, und beide sind gemessen: die
 * Wortlaute der Quellen sind verschieden, und deshalb ist hier nichts entschieden.
 */
const UNGEKLAERT: Record<ReasonerLocale, string> = {
  de: "Die herangezogenen Quellen sagen dazu Verschiedenes. Diese Frage ist damit nicht geklärt — hier steht, was jede Quelle im Wortlaut sagt:",
  en: "The sources consulted say different things about this. The question is therefore not settled — here is what each source says, verbatim:",
  nl: "De geraadpleegde bronnen zeggen hier iets verschillends over. De vraag is daarmee niet beslecht — dit is wat elke bron letterlijk zegt:",
};

/**
 * JOB 3365 · DER RÜCKFALLSTAND — eine Auskunft, oder alle, aber nie eine STILL gewählte.
 *
 * Schritt 1 ist unverändert `rueckfallAntwort` (Auszug vor Kernaussage vor gar nichts, JOB 3353).
 * Schritt 2 ist neu und ist die ganze Änderung: jede WEITERE herangezogene Quelle, deren Auszug zu
 * dieser Frage einen anderen Wortlaut trägt, kommt dazu — in der Rangfolge des Kontexts, ohne
 * Dubletten. Bleibt nach Schritt 2 nur eine Auskunft übrig (der Normalfall), ist das Ergebnis
 * byteweise das der alten Form: derselbe Text, dieselbe eine Quelle.
 *
 * Der Vergleich läuft ausdrücklich gegen den AUSZUG der anderen Quelle und nicht gegen ihre
 * Kernaussage: der Auszug ist das einzige Material auf dieser Kante, dessen Bezug zur Frage
 * GEMESSEN ist (JOB 3353, Kommentar bei `rueckfallAntwort`). Eine Kernaussage ohne Fragebezug —
 * etwa ein Fiktions- oder Herkunftshinweis — hätte hier sonst einen „Widerspruch" erzeugt, den es
 * nicht gibt.
 */
export function rueckfallStand(
  frage: string,
  tragend: readonly KnowledgeRef[],
  kontext: readonly KnowledgeRef[],
  locale: ReasonerLocale,
): { refs: KnowledgeRef[]; text: string } | null {
  const gewaehlt = rueckfallAntwort(frage, tragend);
  if (!gewaehlt) {
    return null;
  }
  const gesehen = new Set([auskunftSchluessel(gewaehlt.text)]);
  const weitere: { ref: KnowledgeRef; text: string }[] = [];
  for (const ref of kontext) {
    if (ref.id === gewaehlt.ref.id) {
      continue;
    }
    const auszug = dokumentAuszug(frage, ref);
    if (auszug.length === 0) {
      continue;
    }
    const text = auszug.join(" ");
    const schluessel = auskunftSchluessel(text);
    if (gesehen.has(schluessel)) {
      continue;
    }
    gesehen.add(schluessel);
    weitere.push({ ref, text });
  }
  if (weitere.length === 0) {
    return { refs: [gewaehlt.ref], text: gewaehlt.text };
  }
  const stimmen = [gewaehlt, ...weitere];
  return {
    refs: stimmen.map((s) => s.ref),
    // Absatzweise (Leerzeile), weil die Fläche den Antworttext als Markdown rendert: so steht jede
    // Quelle für sich, statt dass zwei Auskünfte zu einem Fließtext verschmelzen.
    text: [UNGEKLAERT[locale], ...stimmen.map((s) => `${s.ref.title}: ${s.text}`)].join("\n\n"),
  };
}

// AUFTRAG-mega52 A2 — DIE MARKEN ZURÜCKLESEN.
//
// Der Prompt nummerierte die Quellen seit SCRUM-366; gelesen hat sie nie jemand. Hier passiert
// genau das und nichts darüber hinaus: aus dem gelieferten Antworttext werden die Marken `[n]`
// gezogen und über den 1-basierten Index auf die Kandidatenliste abgebildet.
//
// STRENG, nicht großzügig — geraten wird nichts:
//  · Nur Ziffern in eckigen Klammern zählen; `[1]`, `[2][3]` und `[1, 2]` werden erfasst.
//  · Eine Nummer außerhalb der Kandidatenliste (0, 99, „[12]" bei 8 Quellen) wird VERWORFEN, nicht
//    auf den nächsten gültigen Wert gebogen.
//  · Die Reihenfolge folgt der Kandidatenliste (Rangfolge), nicht dem Zufall des Fließtexts;
//    Doppelnennungen fallen weg.
// Bleibt nichts übrig, ist das Ergebnis LEER — die Reißleine A5 liegt beim Aufrufer, nicht hier.
export function citedSourceIds(answerText: string, candidates: readonly KnowledgeRef[]): string[] {
  const marked = new Set<number>();
  for (const match of answerText.matchAll(/\[([0-9\s,]+)\]/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const n = Number.parseInt(part.trim(), 10);
      if (Number.isInteger(n) && n >= 1 && n <= candidates.length) {
        marked.add(n);
      }
    }
  }
  return candidates.filter((_, i) => marked.has(i + 1)).map((c) => c.id);
}

// Klara Stufe 2: generierende Hilfe-Antwort — Wissensdatenbank vorrangig, Folgern erlaubt,
// aber nie Funktionen erfinden; erkennbare Luecken ehrlich benennen (Kennzeichnung macht das FE).
function helpAnswerSystem(locale: ReasonerLocale): string {
  const base = taskInstruction(
    locale,
    "Du bist Klara, die Hilfe-Assistentin der Anwendung KLARWERK. Beantworte die Frage zur Bedienung und zu den Konzepten der Anwendung. Stütze dich vorrangig auf die nummerierten Hilfe-Einträge — deine Wissensdatenbank; du darfst daraus folgern und kombinieren. Deckt die Wissensdatenbank die Frage erkennbar nicht, sage ehrlich, dass du es nicht sicher weißt — erfinde niemals Funktionen, die es nicht gibt. Antworte kurz, in Du-Anrede, ohne Aufzählungslisten.",
    "You are Klara, the help assistant of the KLARWERK application. Answer the user question about using and understanding the application. Rely primarily on the numbered help entries, which are your knowledge base; you may reason, combine and infer from them. If the knowledge base clearly does not cover the question, say honestly that you are not sure — never invent features the application does not have. Keep it short and plain, no bullet lists.",
  );
  return `${base} ${outputLanguageRule(locale)}`;
}

// WP-BILD-1c: nüchterne, ehrliche Bildbeschreibung als VORSCHLAG für die Fußnote. Kurz (~200
// Zeichen), nur was sichtbar ist, keine Erfindungen/Interpretationen, keine Floskeln — der Text
// wird dem Nutzer als editierbarer Vorschlag angezeigt und nie automatisch gespeichert.
function describeImageSystem(locale: ReasonerLocale): string {
  const base = taskInstruction(
    locale,
    "Du schreibst eine kurze, nüchterne Bildbeschreibung für die Fußnote einer Wissensseite. Beschreibe NUR, was sichtbar im Bild ist, in höchstens 200 Zeichen, ein bis zwei schlichte Sätze. Erfinde keinen Kontext, keine Namen, Zahlen oder Zwecke, die nicht sichtbar sind. Keine Vorbemerkung, keine Anführungszeichen — gib AUSSCHLIESSLICH die Beschreibung zurück.",
    "You write a short, factual image description for a knowledge-base figure caption. Describe ONLY what is visibly in the image, in at most 200 characters, one or two plain sentences. Do not invent context, names, numbers or purposes that are not visible. No preamble, no quotation marks — return ONLY the description.",
  );
  return `${base} ${outputLanguageRule(locale)}`;
}

// Harte Server-Obergrenze der Vorschlagslänge (der Prompt bittet um ~200 Zeichen; das Modell kann
// überziehen — gekappt wird deterministisch, nicht verhandelt).
export const MAX_IMAGE_DESCRIPTION_LENGTH = 300;

// WP-BILD-1f (Pedi 22.07.): HARTES Größenbudget für den mitgereichten Dokument-Kontext. Der Client
// kürzt schon bei der Extraktion (MAX_IMAGE_CONTEXT_CHARS, apps/web/src/lib/captionContext.ts) — der
// Server kappt hier AUTORITATIV und deterministisch nach, egal woher der Kontext stammt. Überschuss
// wird ehrlich abgeschnitten (kein Fehler, nur weniger Kontext).
export const MAX_IMAGE_CONTEXT_LENGTH = 1500;

// WP-BILD-1f: der Dokument-Kontext wird NUR für die Fachsprache mitgegeben — die harte
// Anti-Halluzinations-Regel (nur Sichtbares beschreiben) bleibt in describeImageSystem unangetastet;
// die Kontext-Nutzung ist bewusst auf „richtige Benennung des Sichtbaren" begrenzt.
function describeImageUserPrompt(locale: ReasonerLocale, context: string): string {
  const base =
    locale === "en"
      ? "Describe this image for the caption."
      : "Beschreibe dieses Bild für die Fußnote.";
  if (!context) {
    return base;
  }
  return locale === "en"
    ? `${base}\n\nSurrounding document context (use ONLY to pick the correct technical terminology for what is visible — do NOT add anything that is not visible in the image):\n${context}`
    : `${base}\n\nUmgebender Dokument-Kontext (NUR zur richtigen Fachbenennung des Sichtbaren nutzen — ergänze NICHTS, was nicht im Bild sichtbar ist):\n${context}`;
}

// WP-IC-4: KI-Gruppierung der Import-Kandidaten. Strikter JSON-Vertrag; die Antwort wird
// serverseitig HART validiert (normalizeCandidateGroups) — das Modell strukturiert nur, es
// entscheidet nichts (jede Id genau einmal, Unbekanntes fliegt, Fehlendes in die Auffanggruppe).
function groupSystem(locale: ReasonerLocale): string {
  const contract = '{"groups":[{"title": string, "ids": [string]}]}';
  // Die Sprachfestlegung stand hier bisher IM Anweisungstext („in English"/„auf Deutsch") — damit
  // war sie an den Prompt-Zwilling geknüpft und für Niederländisch unerreichbar. Jetzt liefert sie
  // dieselbe eine Quelle wie überall (mega52 D2/D3).
  const base = taskInstruction(
    locale,
    `Du gruppierst Import-Kandidaten für eine Wissensdatenbank in 3–8 thematische Gruppen. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Jede Kandidaten-Id MUSS in genau EINER Gruppe vorkommen; erfinde keine Ids. Gruppentitel: kurz und sachlich. Erfinde keine Inhalte.`,
    `You group knowledge-import candidates into 3-8 thematic groups. Respond ONLY with JSON: ${contract}. Every candidate id MUST appear in exactly ONE group; never invent ids. Group titles: short and factual. Do not invent content.`,
  );
  return `${base} ${outputLanguageRule(locale)}`;
}

// Deckel je Gruppentitel — überlange Modell-Titel werden deterministisch gekappt.
export const MAX_GROUP_TITLE_LENGTH = 80;

// Beschriftung der Auffanggruppe (DE/EN vom Server; NL lokalisiert die UI über kind:"catchall").
export function catchAllGroupTitle(locale: ReasonerLocale): string {
  if (locale === "en") {
    return "More posts";
  }
  return locale === "nl" ? "Overige bijdragen" : "Weitere Beiträge";
}

// STRIKTE Validierung der Modell-Antwort (bens Auflagen): jede bekannte Id GENAU einmal (erste
// Zuordnung gewinnt, Duplikate fliegen), unbekannte Ids werden verworfen, leere Gruppen fallen
// weg, fehlende Ids landen in der markierten Auffanggruppe. Wirft bei strukturell unbrauchbarer
// Antwort — die Reasoner-Kette fällt dann auf die deterministische Themen-Gruppierung zurück.
//
// WP-SHIP7-FIX (bens sammel17-Fix 2, GENAU-EINMAL-INVARIANTE): Reihenfolge ist entscheidend —
// ZUERST wird die Gruppe validiert (Titel nicht leer nach trim, mindestens eine brauchbare Id),
// und ERST WENN sie wirklich angenommen wird, werden ihre Ids als „gesehen" committet. Vorher
// markierte eine VERWORFENE Gruppe (z. B. leerer Titel) ihre Ids bereits als gesehen — die Ids
// verschwanden aus allen sichtbaren Gruppen UND aus der Auffanggruppe (unsichtbar, aber beim
// Übernehmen mitimportierbar). Jetzt geben verworfene Gruppen ihre Ids an die Auffanggruppe.
export function normalizeCandidateGroups(
  raw: string,
  knownIds: readonly string[],
  locale: ReasonerLocale,
): CandidateGroup[] {
  const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
  if (rawGroups.length === 0) {
    throw new Error("Modell-Antwort enthält keine Gruppen.");
  }
  const known = new Set(knownIds);
  const seen = new Set<string>();
  const groups: CandidateGroup[] = [];
  for (const entry of rawGroups) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const rec = entry as Record<string, unknown>;
    const title = String(rec.title ?? "")
      .trim()
      .slice(0, MAX_GROUP_TITLE_LENGTH);
    // Fix 2: Titel ZUERST — eine Gruppe ohne brauchbaren Titel wird verworfen, OHNE ihre Ids
    // anzufassen (sie bleiben unmarkiert und landen unten in der Auffanggruppe).
    if (title.length === 0) {
      continue;
    }
    const ids: string[] = [];
    const local = new Set<string>();
    for (const rawId of Array.isArray(rec.ids) ? rec.ids : []) {
      const id = String(rawId);
      // Unbekannte Ids verworfen; jede Id nur beim ERSTEN Vorkommen (Duplikate fliegen) —
      // lokal dedupliziert, global erst beim COMMIT der Gruppe markiert.
      if (known.has(id) && !seen.has(id) && !local.has(id)) {
        local.add(id);
        ids.push(id);
      }
    }
    if (ids.length > 0) {
      // Fix 2: seen-Commit ERST hier — die Gruppe ist jetzt wirklich angenommen.
      for (const id of ids) {
        seen.add(id);
      }
      groups.push({ title, ids });
    }
  }
  if (groups.length === 0) {
    throw new Error("Modell-Antwort enthält keine verwertbare Gruppe.");
  }
  // Vom Modell vergessene ODER aus verworfenen Gruppen stammende Ids: EHRLICH in die markierte
  // Auffanggruppe (eindeutige Eingabereihenfolge — doppelte knownIds zählen einmal).
  const uniqueKnown = [...new Set(knownIds)];
  const missing = uniqueKnown.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    groups.push({ title: catchAllGroupTitle(locale), ids: missing, kind: "catchall" });
  }
  // Fix 2, ABSCHLUSS-INVARIANTE als Code: die flache Id-Menge aller gerenderten Gruppen ist EXAKT
  // die eindeutige bekannte Eingabemenge — nichts verschwindet, nichts doppelt, nichts erfunden.
  // Verletzung → werfen (die Kette fällt auf die deterministische Themen-Gruppierung zurück).
  const flat = groups.flatMap((g) => g.ids);
  if (flat.length !== uniqueKnown.length || new Set(flat).size !== flat.length) {
    throw new Error("Genau-einmal-Invariante der Gruppierung verletzt.");
  }
  for (const id of flat) {
    if (!known.has(id)) {
      throw new Error("Genau-einmal-Invariante der Gruppierung verletzt.");
    }
  }
  return groups;
}

// mega52 D3: assist GLÄTTET vorhandenen Text — hier wäre die UI-Sprache aufzuzwingen falsch (das
// würde den Text des Experten übersetzen statt präzisieren). Die Ausgabesprache ist deshalb
// ausdrücklich die des Eingabetextes. Festgelegt ist sie damit trotzdem, und genau das verlangt der
// Sammler: keine Aufgabe darf die Frage offenlassen.
function assistSystem(locale: ReasonerLocale): string {
  const base = taskInstruction(
    locale,
    "Du präzisierst und glättest industrielles Erfahrungswissen sprachlich. Verändere oder erfinde KEINE Inhalte, Zahlen oder Fakten. Gib AUSSCHLIESSLICH den überarbeiteten Text zurück, ohne Vorbemerkung oder Anführungszeichen.",
    "Improve wording without changing content. Do NOT alter or invent any content, numbers or facts. Return ONLY the revised text, without preamble or quotation marks.",
  );
  return `${base} ${keepInputLanguageRule(locale)}`;
}

// SCRUM-312: leitet die optionale Nutzer-/Aktionsanweisung an das Modell weiter — als
// Stil-/Form-Wunsch, NICHT als Erlaubnis, Inhalte zu erfinden.
// SCRUM-426: Public-KI-Anreicherung — bewusst NICHT quellengebunden. Das Modell darf hier
// externes Weltwissen beisteuern (Abgrenzung zum quellengebundenen answer/assist). Leitplanken:
// knapp, sachlich, ehrlich bei Unsicherheit, KEINE erfundenen konkreten Zahlen/Zitate. Das
// Ergebnis wird in der UI IMMER als „extern · ungeprüft" gekennzeichnet und nie automatisch
// validiert — die Verantwortung für die Übernahme bleibt beim Menschen.
function enrichPublicSystem(locale: ReasonerLocale): string {
  const base = taskInstruction(
    locale,
    "Du ergänzt den Entwurf eines Experten um hilfreiches externes Hintergrundwissen. Fasse dich kurz (3–6 Sätze oder knappe Stichpunkte), sachlich und allgemein. Erfinde KEINE konkreten Zahlen, Grenzwerte, Daten, Namen oder Zitate — bist du unsicher, sage es offen. Mache klar, dass dies allgemeines externes Wissen zum Prüfen ist, nicht das validierte Wissen des Unternehmens.",
    "You add helpful external background knowledge to an expert's draft. Be concise (3–6 sentences or short bullet points), factual and general. Do NOT invent specific numbers, thresholds, dates, names or quotes — if you are unsure, say so plainly. Make clear this is general external knowledge to be verified, not the company's own validated knowledge.",
  );
  return `${base} ${outputLanguageRule(locale)}`;
}

// Berater-Konzept 04.07. (Stufe 2, kon-v1): System-Prompt der „Konfliktprüfung". Rein inhaltlich
// (A/B ohne Autoren/Trust), striktes JSON, nur was in den Texten steht, im Zweifel „unsicher",
// wörtliche Belegzitate (nachgelagert hart geprüft, G-2). Temperatur 0 (deterministisches Urteil).
function conflictSystem(locale: ReasonerLocale): string {
  // SCRUM-492: optionaler "kollision"-Block bei echten Widersprüchen (widerspruch/ueberholt) — je
  // Seite eine knappe Kernaussage + der konkret kollidierende "streitwert". Der Streitwert SOLL
  // wörtlich aus dem jeweiligen Zitat stammen, wo möglich (belegter Fall).
  const contract =
    '{"relation":"widerspruch|doppelung|ueberholt|kein_konflikt|unsicher","older":"a|b|null","confidence":0.0-1.0,"begruendung":"...","zitat_a":"...","zitat_b":"...","kollision":{"streitpunkt":"...","seite_a":{"kernaussage":"...","streitwert":"..."},"seite_b":{"kernaussage":"...","streitwert":"..."}}}';
  // Die WÖRTLICHEN Zitate (zitat_a/zitat_b/streitwert) sind Kopien aus den Quelltexten und bleiben
  // in deren Sprache — sie werden nachgelagert wörtlich geprüft (G-2). Die Ausgaberegel gilt der
  // `begruendung` und den Kernaussagen, die der Nutzer im Konfliktboard liest.
  const base = taskInstruction(
    locale,
    `Du vergleichst zwei Wissens-Aussagen A und B und bestimmst ihre Beziehung. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Urteile NUR über das, was in den Texten steht — ergänze kein Weltwissen. Ein im Text genannter abweichender Geltungsbereich (andere Anlage/Bedingung) ist KEIN Widerspruch → "kein_konflikt". Im Zweifel: "unsicher". "zitat_a"/"zitat_b" MÜSSEN wörtliche Zitate aus A bzw. B sein (exakt kopieren). "older" nur bei "ueberholt", sonst null. Nur bei "widerspruch"/"ueberholt" zusätzlich "kollision": "streitpunkt" = worum die Kollision geht (z. B. "Pflichtfarbe"); je Seite eine knappe "kernaussage" (ein Satz) und der "streitwert" = das konkret kollidierende Element (z. B. "blau" vs. "rot"). Den "streitwert" WÖRTLICH aus dem jeweiligen Zitat (zitat_a bzw. zitat_b) übernehmen, wo möglich; nur wenn kein einzelnes Wort passt, knapp zusammenfassen. Bei "kein_konflikt"/"unsicher"/"doppelung" "kollision" weglassen.`,
    `You compare two knowledge statements A and B and decide their relation. Respond ONLY with JSON: ${contract}. Judge ONLY what the texts state — add no world knowledge. A different scope stated in the text (other asset/condition) is NOT a contradiction → "kein_konflikt". When in doubt: "unsicher". "zitat_a"/"zitat_b" MUST be verbatim quotes copied from A resp. B. "older" only for "ueberholt", otherwise null. Only for "widerspruch"/"ueberholt" add "kollision": "streitpunkt" = what the collision is about (e.g. "mandatory colour"); per side a short "kernaussage" (one sentence) and the "streitwert" = the concretely colliding element (e.g. "blue" vs "red"). Copy the "streitwert" VERBATIM from the respective quote (zitat_a resp. zitat_b) where possible; only summarise briefly if no single word fits. For "kein_konflikt"/"unsicher"/"doppelung" omit "kollision".`,
  );
  const quoteRule = taskInstruction(
    locale,
    "Die wörtlichen Zitate bleiben unverändert in ihrer Originalsprache.",
    "The verbatim quotes stay unchanged in their original language.",
  );
  return `${base} ${quoteRule} ${outputLanguageRule(locale)}`;
}

const CONFLICT_RELATIONS: readonly string[] = [
  "widerspruch",
  "doppelung",
  "ueberholt",
  "kein_konflikt",
  "unsicher",
];

// SCRUM-492: der Streitwert gilt als „wörtlich belegt", wenn er (getrimmt, Kleinschreibung) als
// Teilzeichenkette im zugehörigen Zitat vorkommt. Leerer Streitwert → nicht belegt.
export function streitwertVerbatim(streitwert: string, zitat: string): boolean {
  const needle = streitwert.trim().toLowerCase();
  return needle.length > 0 && zitat.toLowerCase().includes(needle);
}

// SCRUM-492: eine Kollisions-Seite defensiv parsen — nur bei String kernaussage + String streitwert.
// streitwertWoertlich wird gegen das jeweilige Zitat berechnet (nicht vom Modell übernommen).
function parseKollisionSeite(raw: unknown, zitat: string): KollisionSeite | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const s = raw as Record<string, unknown>;
  if (typeof s.kernaussage !== "string" || typeof s.streitwert !== "string") {
    return null;
  }
  return {
    kernaussage: s.kernaussage,
    streitwert: s.streitwert,
    streitwertWoertlich: streitwertVerbatim(s.streitwert, zitat),
  };
}

// SCRUM-492: kollision NUR übernehmen, wenn Objekt + streitpunkt-String + beide Seiten vollständig
// (String kernaussage/streitwert) vorliegen; sonst undefined (kein Bruch, Konflikt entsteht trotzdem).
export function parseKollision(
  raw: unknown,
  zitatA: string,
  zitatB: string,
): Kollision | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const k = raw as Record<string, unknown>;
  if (typeof k.streitpunkt !== "string") {
    return undefined;
  }
  const seiteA = parseKollisionSeite(k.seite_a, zitatA);
  const seiteB = parseKollisionSeite(k.seite_b, zitatB);
  if (!seiteA || !seiteB) {
    return undefined;
  }
  return { streitpunkt: k.streitpunkt, seiteA, seiteB };
}

// kon-v1: striktes, defensives Parsen des Modellurteils. Ungültiges JSON, unbekannte Relation,
// fehlende/nicht-numerische confidence oder Nicht-String-Zitate → null (kein Konflikt aus kaputten
// Antworten). confidence wird auf 0..1 geklemmt; older nur "a"/"b", sonst null.
export function parseConflictResponse(raw: string): ConflictJudgeResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  const relation = o.relation;
  if (typeof relation !== "string" || !CONFLICT_RELATIONS.includes(relation)) {
    return null;
  }
  if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence)) {
    return null;
  }
  if (typeof o.zitat_a !== "string" || typeof o.zitat_b !== "string") {
    return null;
  }
  const confidence = Math.min(1, Math.max(0, o.confidence));
  const older = o.older === "a" || o.older === "b" ? o.older : null;
  const begruendung = typeof o.begruendung === "string" ? o.begruendung : "";
  const kollision = parseKollision(o.kollision, o.zitat_a, o.zitat_b);
  return {
    relation: relation as ConflictJudgeResult["relation"],
    older,
    confidence,
    begruendung,
    zitat_a: o.zitat_a,
    zitat_b: o.zitat_b,
    ...(kollision ? { kollision } : {}),
  };
}

// Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): System-Prompt der „Duplikatprüfung".
// Beschreibt die Überschneidung als Profil (Beziehung/Grad/gemeinsame Aussagen/Empfehlung); nur was
// im Text steht; abweichender Geltungsbereich → getrennt lassen; Sprachpaar → nicht zusammenführen.
function duplicateSystem(locale: ReasonerLocale): string {
  const contract =
    '{"beziehung":"identisch|a_enthaelt_b|b_enthaelt_a|teilweise|verwandt|verschieden|unsicher","gemeinsame_aussagen":[{"beschreibung":"...","zitat_a":"...","zitat_b":"..."}],"nur_in_a":"...","nur_in_b":"...","empfehlung":"zusammenfuehren|zusammenfuehren_pruefen|getrennt_lassen|verwandt_verlinken","confidence":0.0-1.0,"begruendung":"..."}';
  const base = taskInstruction(
    locale,
    `Du vergleichst zwei Wissens-Aussagen A und B und beschreibst ihre ÜBERSCHNEIDUNG (Beziehung + Grad + gemeinsame Aussagen). Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Urteile NUR über das, was in den Texten steht. Ein im Text ausdrücklich abweichender Geltungsbereich (andere Anlage/Bedingung) → Empfehlung "getrennt_lassen", auch bei hoher Textdeckung. Gleicher Inhalt in zwei Sprachen → "identisch", aber Empfehlung "getrennt_lassen"/"verwandt_verlinken" (nie über Sprachgrenzen zusammenführen). Im Zweifel: "unsicher". Jedes "zitat_a"/"zitat_b" MUSS ein wörtliches Zitat aus A bzw. B sein. Höchstens 5 gemeinsame Aussagen.`,
    `You compare two knowledge statements A and B and describe their OVERLAP (relation + degree + shared statements). Respond ONLY with JSON: ${contract}. Judge ONLY what the texts state. Explicitly different scope in the text (other asset/condition) → recommend "getrennt_lassen" even at high textual overlap. Same content in two languages → "identisch" but recommend "getrennt_lassen"/"verwandt_verlinken" (never merge across languages). When in doubt: "unsicher". Every "zitat_a"/"zitat_b" MUST be a verbatim quote from A resp. B. At most 5 shared statements.`,
  );
  const quoteRule = taskInstruction(
    locale,
    "Die wörtlichen Zitate bleiben unverändert in ihrer Originalsprache.",
    "The verbatim quotes stay unchanged in their original language.",
  );
  return `${base} ${quoteRule} ${outputLanguageRule(locale)}`;
}

const DUP_RELATIONS: readonly string[] = [
  "identisch",
  "a_enthaelt_b",
  "b_enthaelt_a",
  "teilweise",
  "verwandt",
  "verschieden",
  "unsicher",
];
const DUP_RECOMMENDATIONS: readonly string[] = [
  "zusammenfuehren",
  "zusammenfuehren_pruefen",
  "getrennt_lassen",
  "verwandt_verlinken",
];

// dup-v1: striktes, defensives Parsen. Ungültiges JSON, unbekannte Beziehung oder nicht-numerische
// confidence → null. Aspekte ohne beide String-Zitate werden gestrichen (der G-2-Wächter prüft später
// zusätzlich wörtlich). Unbekannte Empfehlung fällt sicher auf „zusammenfuehren_pruefen".
export function parseDuplicateResponse(raw: string): DuplicateJudgeResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const o = parsed as Record<string, unknown>;
  const beziehung = o.beziehung;
  if (typeof beziehung !== "string" || !DUP_RELATIONS.includes(beziehung)) {
    return null;
  }
  if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence)) {
    return null;
  }
  const empfehlung =
    typeof o.empfehlung === "string" && DUP_RECOMMENDATIONS.includes(o.empfehlung)
      ? o.empfehlung
      : "zusammenfuehren_pruefen";
  const rawAspects = Array.isArray(o.gemeinsame_aussagen) ? o.gemeinsame_aussagen : [];
  const aspects: DuplicateAspect[] = [];
  for (const item of rawAspects) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.zitat_a !== "string" || typeof rec.zitat_b !== "string") {
      continue;
    }
    aspects.push({
      beschreibung: typeof rec.beschreibung === "string" ? rec.beschreibung : "",
      zitatA: rec.zitat_a,
      zitatB: rec.zitat_b,
    });
  }
  return {
    beziehung: beziehung as DuplicateJudgeResult["beziehung"],
    aspects,
    nurInA: typeof o.nur_in_a === "string" ? o.nur_in_a : "",
    nurInB: typeof o.nur_in_b === "string" ? o.nur_in_b : "",
    empfehlung: empfehlung as DuplicateJudgeResult["empfehlung"],
    confidence: Math.min(1, Math.max(0, o.confidence)),
    begruendung: typeof o.begruendung === "string" ? o.begruendung : "",
  };
}

function assistGuidance(locale: ReasonerLocale, instruction: string): string {
  return locale === "en"
    ? `Apply this editing instruction to the wording only (no new facts): ${instruction}`
    : `Wende diese Bearbeitungs-Anweisung nur auf die Formulierung an (keine neuen Fakten): ${instruction}`;
}

// ================================================================================================
// JOB 3276 (KI-ASSIST-LEER) — DAS ANTWORTBUDGET EINER ÜBERARBEITUNG HÄNGT AN DER EINGABE.
// ================================================================================================
//
// Der assist-Aufruf fuhr mit dem Bestandsbudget des Clients (1024 Token). Für einen kurzen Satz an
// einem klassischen Modell reicht das. Für `gpt-6-astra` reicht es nicht: bei OpenAI deckelt
// `max_completion_tokens` REASONING UND sichtbare Ausgabe ZUSAMMEN (JOB 3222). Ein Denkmodell
// verbraucht das Budget in seiner Denkphase, die Antwort bleibt leer — HTTP 200, kein Inhalt.
// Genau diesen Zustand hat Codex am 08.09. live gemessen.
//
// DIE RECHNUNG, und warum sie so aussieht:
//  · Die Ausgabe einer Überarbeitung ist etwa so lang wie die Eingabe. Der Faktor 2 ist der
//    Sicherheitsabstand nach oben (Erweitern/Strukturieren wird länger, nicht kürzer).
//  · Dazu die RESERVE für die Denkphase, die bei OpenAI aus demselben Topf kommt.
//  · 4 Zeichen je Token ist die grobe, anerkannte Faustregel für europäische Sprachen. Sie ist
//    ABSICHTLICH eine Schätzung: ein echter Tokenizer je Anbieter wäre eine zweite Wahrheit über
//    fremde Modelle, und die Zahl muss nur GROSS GENUG sein, nicht exakt.
//  · Der DECKEL ist der Bestandswert der teuersten Aufgabe (extract fährt 16384). Ohne ihn
//    bezahlte ein sehr langer Text ein Budget, das kein Aufrufer je gedeckt hat — bei einem
//    Anbieter, der je Token abrechnet.
//
// WAS HIER NICHT GEMESSEN IST (Korrekturpflicht aus JOB 3239, LEHREN.md): der TATSÄCHLICHE
// Mindestbedarf von `gpt-6-astra` an einem echten Aufruf. Gemessen ist der GESENDETE Request
// (tests/ki-assist-leer/assist-budget-und-anweisung.test.ts), nicht die Antwort eines echten
// Anbieters. Die Anhebung ist deshalb begründet und gedeckelt, aber sie ist keine Zusage, dass
// das Denkbudget im Betrieb reicht — bleibt die Antwort leer, sagt der Fehlerweg es weiterhin
// mit Grund (finish_reason, Budget), statt einen Vorschlag zu erfinden.
const ASSIST_ZEICHEN_JE_TOKEN = 4;
const ASSIST_BUDGET_RESERVE = 1024;
const ASSIST_BUDGET_MINDEST = 1024;
const ASSIST_BUDGET_DECKEL = 16384;

function assistAntwortBudget(text: string): number {
  const eingabeToken = Math.ceil(text.trim().length / ASSIST_ZEICHEN_JE_TOKEN);
  const gebraucht = eingabeToken * 2 + ASSIST_BUDGET_RESERVE;
  return Math.min(ASSIST_BUDGET_DECKEL, Math.max(ASSIST_BUDGET_MINDEST, gebraucht));
}

// ================================================================================================
// JOB 3276 RUNDE 3 — EIN FRAGMENT MUSS DER AUFRUFER ERKENNEN KÖNNEN.
// ================================================================================================
//
// DER BEFUND (Codex-Vorprüfung R2, 08.09. 16:30): `finish_reason: length` MIT Inhalt wird im
// Chokepoint zwar serverintern gemeldet (JOB 3239) — das Fragment geht danach aber als ganz
// normale Antwort zum Aufrufer. Für extract ist das richtig so (`salvageTruncatedExtract` rettet
// abgeschnittenes JSON). Für assist ist es gefährlich: ein am Token-Limit abgerissener Satz stünde
// als „Vorschlag" mit scharfem „Ersetzen"-Schalter da und schnitte dem Menschen das Ende seines
// eigenen Textes ab. Genau die Klasse Unwahrheit, gegen die dieser Auftrag angetreten ist.
//
// WARUM EINE LAUF-SPUR UND KEIN ZWEITER PARAMETER AN `complete`: der Weg vom Aufrufer zum Client
// führt durch `cappedModelClient` (`model-concurrency.ts`) — eine Datei außerhalb der ZIELPFADE
// dieses Auftrags. Ein Schalter am Aufruf käme dort nicht durch, und ein stillschweigend verlorener
// Schalter wäre schlimmer als keiner. Die Spur reist dagegen durch JEDE Zwischenschicht, weil sie am
// Kontext hängt und nicht am Argument — dasselbe Muster, das `modellAufrufSpur` (model-concurrency)
// für den Verbrauch schon fährt.
//
// SIE STEHT IN DIESER DATEI und nicht im Chokepoint, weil die einzige Abhängigkeitsrichtung
// zwischen beiden bereits besteht (model-client → provider-model); andersherum wäre es ein Zyklus.
// Sie trägt NUR Metadaten (Budgetfeld, Budget, finish_reason, Zeichenzahl), nie Antwort- oder
// Nutzertext.
export interface ModellAbbruchBefund {
  budgetFeld: string;
  budget: number;
  finishReason: string;
  zeichen: number;
}

const abbruchSpur = new AsyncLocalStorage<{ abbruch: ModellAbbruchBefund | null }>();

/**
 * Führt `fn` aus und meldet mit, ob eine Antwort DARIN am Token-Limit abgeschnitten wurde, OBWOHL
 * sie Inhalt trug. Ohne diese Klammer bleibt alles wie bisher: das Fragment geht unverändert durch.
 */
export async function mitAbbruchBefund<T>(
  fn: () => Promise<T>,
): Promise<{ wert: T; abbruch: ModellAbbruchBefund | null }> {
  const spur: { abbruch: ModellAbbruchBefund | null } = { abbruch: null };
  const wert = await abbruchSpur.run(spur, fn);
  return { wert, abbruch: spur.abbruch };
}

/** Der Vermerk am Chokepoint. Ohne laufende Spur ein No-op. */
export function vermerkeAbbruch(befund: ModellAbbruchBefund): void {
  const spur = abbruchSpur.getStore();
  if (spur) {
    spur.abbruch = befund;
  }
}

/**
 * JOB 3366 — DIE EINE UMRECHNUNG VOM LAUFVERMERK IN DAS VERTRAGSFELD.
 *
 * Kein Befund → ein LEERES Objekt, das per Spread nichts hinterlässt: das Feld FEHLT dann, statt
 * als `undefined` im Vertrag zu stehen. Das ist der Unterschied, den §9 verlangt — es gibt den
 * Hinweis oder gar nichts, nie eine positive Gegenaussage „vollständig".
 *
 * Sie steht hier, damit ALLE Wege (answer, helpAnswer, extract) dasselbe Feld aus derselben
 * Quelle bilden; zwei Umrechnungen wären zwei Auffassungen davon, was ein Abbruch ist.
 */
function abbruchFeld(abbruch: ModellAbbruchBefund | null): { abgeschnitten?: AbbruchBefund } {
  return abbruch === null
    ? {}
    : {
        abgeschnitten: {
          finishReason: abbruch.finishReason,
          budgetFeld: abbruch.budgetFeld,
          budget: abbruch.budget,
          zeichen: abbruch.zeichen,
        },
      };
}

// PMO-FEA-0006 / G-2: Wissens-Extraktion aus Dokumenttext — anti-halluzinatorischer
// System-Prompt. Jeder Punkt MUSS mit einem wörtlichen Auszug belegt sein; die Auszüge
// werden zusätzlich serverseitig gegen den Dokumenttext geprüft (parseExtractResponse).
function extractSystem(locale: ReasonerLocale, keepSourceLanguage = false): string {
  const contract =
    '{"points": [{"title": string (die Aussage in einem Satz), "summary": string, ' +
    '"sourceExcerpt": string (wörtliches Zitat aus dem Dokument)}]}';
  // SCRUM-451 (Pedi 05.07.): auf Wunsch bleibt das Ergebnis in der Sprache des Dokuments —
  // ohne diesen Zusatz übersetzt das Modell Titel/Zusammenfassungen faktisch in die UI-Sprache.
  // mega52 D3: die Festlegung gilt jetzt in BEIDEN Richtungen ausdrücklich. Vorher stand hier nur
  // der Sonderfall „Dokumentsprache behalten"; ohne ihn blieb die Ausgabesprache ungesagt und das
  // Modell übersetzte faktisch in die Sprache des Prompt-Zwillings — für Niederländisch also nie
  // ins Niederländische. Die sourceExcerpt-Zitate bleiben in JEDEM Fall wörtlich (G-2).
  const langRule = keepSourceLanguage
    ? ` ${taskInstruction(locale, "WICHTIG: Schreibe title und summary in der SPRACHE DES DOKUMENTS — übersetze nichts.", "IMPORTANT: Write title and summary in the LANGUAGE OF THE DOCUMENT — do not translate anything.")}`
    : ` ${outputLanguageRule(locale)} ${taskInstruction(locale, "Die sourceExcerpt-Zitate bleiben davon unberührt wörtlich in der Sprache des Dokuments.", "The sourceExcerpt quotes stay verbatim in the document's language regardless.")}`;
  // SCRUM-418: Ausgabe begrenzen (≤12 Punkte, Auszug ≤300 Zeichen) — vollständige, kurze
  // Punkte statt einer langen Antwort, die am Token-Limit abreißt.
  const base = taskInstruction(
    locale,
    `Du identifizierst einzelne Wissenspunkte in einem Dokument (Erfahrungsregeln, Grenzwerte, Vorgehensweisen, Ursachen, Bedingungen). Antworte AUSSCHLIESSLICH mit JSON: ${contract}. Gib höchstens ${EXTRACT_PROMPT_MAX_POINTS} Punkte zurück — wähle die wichtigsten. Halte jede sourceExcerpt unter 300 Zeichen. Jeder Punkt MUSS eine wörtliche Belegstelle aus dem Dokument als sourceExcerpt zitieren (exakt kopieren, nicht paraphrasieren). Extrahiere NUR, was im Dokument tatsächlich steht — erfinde nichts, schlussfolgere nicht über den Text hinaus, ergänze kein Weltwissen. Enthält das Dokument kein verwertbares Wissen, gib {"points": []} zurück.`,
    `You identify distinct pieces of knowledge in a document (rules of experience, thresholds, procedures, causes, conditions). Respond ONLY with JSON: ${contract}. Return at most ${EXTRACT_PROMPT_MAX_POINTS} points — pick the most important ones. Keep each sourceExcerpt under 300 characters. Every point MUST quote a verbatim excerpt from the document as sourceExcerpt (copy it exactly, do not paraphrase it). Extract ONLY what the document actually states — do not invent, infer beyond the text, or add world knowledge. If the document contains no usable knowledge, return {"points": []}.`,
  );
  return base + langRule;
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
// mega52 D2/D3: DAS VORBILD dieses Blocks. Die Ausgabesprache stand hier seit SCRUM-410 als eigener
// Satz im Prompt — sie war nur an den Prompt-Zwilling geknüpft und damit für Niederländisch
// unerreichbar. Jetzt kommt sie aus derselben einen Quelle wie überall; der Rest bleibt wörtlich.
function interviewSystem(locale: ReasonerLocale): string {
  const base = taskInstruction(
    locale,
    "Du bist ein erfahrener Kollege und führst ein kurzes Interview, um Erfahrungswissen zu sichern. Formuliere aus der Leitfrage genau EINE natürliche nächste Frage. Regeln: klare, natürliche Sprache in Du-Anrede; höchstens 20 Wörter; greife konkrete Begriffe aus den bisherigen Antworten auf, statt generisch zu fragen; ziele auf das, was Erfahrungswissen ausmacht (Grenzwerte, Ausnahmen, Warum, Woran-erkennst-du-es). Keine Floskeln oder Höflichkeitsformeln, keine Anführungszeichen, keine Nummerierung, kein vorangestelltes Label. Erfinde KEINE fachlichen Inhalte oder Fakten. Gib AUSSCHLIESSLICH die Frage zurück.",
    "You are an experienced colleague conducting a short interview to capture experiential knowledge. Rephrase the guiding question into exactly ONE natural next question. Rules: plain, natural wording; at most 20 words; pick up concrete terms from the previous answers instead of asking generically; aim at what makes knowledge experiential (thresholds, exceptions, why, how-do-you-notice-it). No filler phrases, no politeness formulas, no quotation marks, no numbering, no leading label. Do NOT invent any technical content or facts. Return ONLY the question.",
  );
  return `${base} ${outputLanguageRule(locale)}`;
}

// Sprachbewusste User-Prompt-Labels (kein Quelleninhalt wird übersetzt).
const LABELS: Record<ReasonerLocale, Record<string, string>> = {
  de: {
    question: "Frage",
    sources: "Quellen",
    priorAnswers: "Bisherige Antworten",
    guiding: "Leitfrage",
    none: "(noch keine)",
    // JOB 3298: die Beschriftung des Dokumenttext-Auszugs im Grounding. Sie ist ein EIGENES Feld
    // und nicht an die Aussage angehängt — der Leser des Prompts (das Modell) soll sehen, dass hier
    // Quelltext steht, den es zitieren darf, und nicht eine zweite Kernaussage.
    excerpt: "Dokumenttext (Auszug)",
  },
  en: {
    question: "Question",
    sources: "Sources",
    priorAnswers: "Previous answers",
    guiding: "Guiding question",
    none: "(none yet)",
    excerpt: "Document text (excerpt)",
  },
  // mega52 D1: Niederländisch ist eine eigene Reasoner-Sprache — der Compiler verlangt diesen
  // Zweig jetzt, statt ihn stillschweigend auf Deutsch fallen zu lassen.
  nl: {
    question: "Vraag",
    sources: "Bronnen",
    priorAnswers: "Eerdere antwoorden",
    guiding: "Leidende vraag",
    none: "(nog geen)",
    excerpt: "Documenttekst (fragment)",
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
// SCRUM-427: lange Dokumente in Abschnitten extrahieren. Jeder Abschnitt bleibt klein genug,
// dass die Modell-Antwort nicht am Token-Limit abreißt → der Gekürzt-Hinweis entfällt bei
// normal langen Dokumenten. Die Ergebnisse werden dedupliziert zusammengeführt (G-2 bleibt:
// jede Belegstelle wird gegen IHREN Abschnitt geprüft).
export const EXTRACT_CHUNK_LENGTH = 8000;

// Teilt Dokumenttext in Abschnitte ~size, möglichst an Absatz-/Zeilen-/Satzgrenzen (damit
// keine Belegstelle mitten im Wort zerschnitten wird). Kurze Dokumente bleiben EIN Abschnitt.
export function chunkForExtract(doc: string, size = EXTRACT_CHUNK_LENGTH): string[] {
  if (doc.length <= size) {
    return [doc];
  }
  const chunks: string[] = [];
  let i = 0;
  while (i < doc.length) {
    let end = Math.min(i + size, doc.length);
    if (end < doc.length) {
      const window = doc.slice(i, end);
      const brk = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("\n"),
        window.lastIndexOf(". "),
      );
      if (brk > size * 0.5) {
        end = i + brk + 1;
      }
    }
    chunks.push(doc.slice(i, end));
    i = end;
  }
  return chunks;
}

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

  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): reicht die Egress-Politik des Clients nach oben —
  // der Reasoner schließt einen Provider, der vertrauliche Inhalte verweigert, bei einem
  // vertraulichen Paar VOR jedem Aufruf aus der Judge-Kette aus (kein Fetch, Ausgang "confidential").
  rejectsConfidential(): boolean {
    return this.client?.rejectsConfidential === true;
  }

  // JOB 3036: reicht den REINEN Modellbezeichner des Clients nach oben — die Auskunft, WELCHES
  // Modell gearbeitet hat. Zwilling von `rejectsConfidential()` darüber, mit derselben Zusage:
  // ohne Client oder ohne Modellangabe kommt `undefined` heraus, und `undefined` heißt „kein
  // Modellname bekannt". Es wird NIE auf `this.name` ausgewichen — der trägt den Anbieter.
  modelName(): string | undefined {
    return this.client?.model;
  }

  // Key-Test (Pedi 02.07.): kleinstmöglicher Echtaufruf. Beweist Schlüssel + Modellzugang;
  // Fehler (z. B. 401 = Schlüssel ungültig) laufen unverändert nach oben — nichts wird geraten.
  async probe(): Promise<string> {
    const client = this.requireClient();
    // Key-Test: interner Ping, kein Nutzer-/KO-Text → nicht vertraulich.
    return client.complete("Antworte mit genau einem Wort: OK", "ping", false);
  }

  // SCRUM-360: begrenzte, status-/trust-bewusste Kandidatenauswahl (siehe selectCandidates) — das
  // Modell bekommt nur eine gedeckelte, relevant gerankte Quellenmenge statt aller KOs.
  select(
    question: string,
    candidates: readonly KnowledgeRef[],
    // JOB 3049: derselbe Relevanztext, dieselbe eine Auswahlfunktion wie im deterministischen Weg.
    relevanz: Relevanztext = [],
  ): KnowledgeRef[] {
    return selectCandidates(question, candidates, DEFAULT_TOP_K, relevanz);
  }

  // IC-3 (Import-Cockpit): schmaler Roh-Aufruf für eine JSON-liefernde Auswahl-Anweisung. Der Eingabe-
  // text ist die kurze Nutzer-Instruktion (kein KO/Dokument) → confidential=false. Rückgabe ist die
  // Roh-Antwort; das Parsen/Sanitisieren übernimmt der Aufrufer (nie raten). Kein deterministischer
  // Ersatz — ohne Client gibt es hier nichts (der Aufrufer fällt dann auf leere Kriterien zurück).
  async completeRaw(system: string, user: string, maxTokens = 512): Promise<string> {
    const client = this.requireClient();
    return client.complete(system, user, false, maxTokens);
  }

  async structure(
    rawText: string,
    locale: ReasonerLocale = "de",
    // SCRUM-502 Schicht 2: an den Chokepoint durchgereicht — der Cloud-Wrapper wirft bei true.
    confidential = false,
  ): Promise<StructureResult> {
    const client = this.requireClient();
    const raw = await client.complete(structureSystem(locale), rawText, confidential);
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

  // Klara Stufe 2: generierende Hilfe-Antwort. Die komplette (bereits gerankte) Wissensbasis
  // geht nummeriert ins Modell; Folgern/Kombinieren ist ausdruecklich erlaubt (helpAnswerSystem).
  // Ohne Wissensbasis keine Rateantwort — das Modell wird gar nicht erst befragt.
  async helpAnswer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    if (context.length === 0) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: false,
      };
    }
    const client = this.requireClient();
    const labels = LABELS[locale];
    const grounding = context.map((r, i) => `[${i + 1}] ${r.title}: ${r.statement}`).join("\n");
    // JOB 3366: dieselbe Abbruch-Spur wie im Antwortweg — die generierende Hilfe ist der zweite
    // Weg, auf dem ein Mensch den MODELLTEXT selbst zu lesen bekommt.
    const { wert: rohHilfe, abbruch } = await mitAbbruchBefund(() =>
      client.complete(
        helpAnswerSystem(locale),
        `${labels.question}: ${question}\n\n${labels.sources}:\n${grounding}`,
        // Hilfe-Kontext ist kuratierte Produkt-Hilfe (keine KOs/Kundendaten) → nicht vertraulich.
        false,
      ),
    );
    const answerText = rohHilfe.trim();
    return {
      answered: answerText.length > 0,
      answer: answerText.length > 0 ? answerText : null,
      // Ohne Text gibt es keine Antwort, über die der Hinweis etwas sagen könnte (§9 „laden").
      ...(answerText.length > 0 ? abbruchFeld(abbruch) : {}),
      knowledgeClass: "ungeprueft",
      trust: 0,
      sources: context.map((r) => r.id),
      // mega52 A3: Klara-Hilfe ist bewusst GENERIEREND (folgern/kombinieren erlaubt) und verlangt
      // deshalb keine Fußnotenmarken. Ohne Marken gibt es keine Zuordnung — und ohne Zuordnung
      // bleibt die Liste leer, statt eine Herkunft zu behaupten, die niemand geprüft hat (A5).
      citedSources: [],
      steps: [],
      demo: false,
    };
  }

  // WP-IC-4: KI-Gruppierung. SPARSAME Eingabe (id | Titel | Kurztext — nie volle Bodies); die
  // Antwort läuft durch die HARTE Validierung normalizeCandidateGroups (jede Id genau einmal,
  // Unbekanntes verworfen, Fehlendes in die Auffanggruppe). Strukturell unbrauchbar → Wurf →
  // die Kette fällt auf die ehrliche deterministische Themen-Gruppierung zurück.
  async groupCandidates(
    candidates: readonly GroupCandidateInput[],
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<GroupCandidatesResult> {
    const client = this.requireClient();
    const lines = candidates
      .map((c) => `${c.id} | ${c.title}${c.text ? ` | ${c.text}` : ""}`)
      .join("\n");
    const raw = await client.complete(groupSystem(locale), lines, confidential, 2048);
    const groups = normalizeCandidateGroups(
      raw,
      candidates.map((c) => c.id),
      locale,
    );
    return { groups, demo: false };
  }

  // WP-BILD-1c: KI-Bildbeschreibung über den Vision-Pfad des Clients. Ohne Bild-Eingang
  // (lokaler LLM, Alt-Stubs) wird EHRLICH geworfen — die Reasoner-Kette fällt dann durch und
  // meldet den echten Grund; es entsteht NIE eine erfundene Beschreibung. Leere Modell-Antwort
  // → text null (kein Vorschlag ist besser als ein leerer/erfundener).
  async describeImage(
    dataUrl: string,
    locale: ReasonerLocale = "de",
    confidential = false,
    context?: string,
  ): Promise<DescribeImageResult> {
    const client = this.requireClient();
    if (typeof client.completeVision !== "function") {
      throw new Error("Dieses Modell hat keinen Bild-Eingang (Vision).");
    }
    // WP-BILD-1f: Kontext deterministisch auf das harte Budget kürzen; er reist als Teil des
    // Vision-USER-Prompts mit — also durch DENSELBEN Egress-Wächter wie das Bild. Bei vertraulichem
    // Bild wirft cappedModelClient BEVOR dieser Aufruf läuft; Kontext geht dann NIE an die Cloud.
    const trimmedContext = (context ?? "").trim().slice(0, MAX_IMAGE_CONTEXT_LENGTH).trim();
    const raw = await client.completeVision(
      describeImageSystem(locale),
      dataUrl,
      describeImageUserPrompt(locale, trimmedContext),
      confidential,
      256,
    );
    const text = raw.trim().slice(0, MAX_IMAGE_DESCRIPTION_LENGTH).trim();
    return {
      text: text.length > 0 ? text : null,
      demo: false,
      ...(trimmedContext.length > 0 ? { withContext: true } : {}),
    };
  }

  async assistText(
    text: string,
    locale: ReasonerLocale = "de",
    instruction?: string,
    // SCRUM-502 Schicht 2: an den Chokepoint durchgereicht.
    confidential = false,
  ): Promise<AssistResult> {
    const client = this.requireClient();
    // SCRUM-312: optionale Anweisung als zusätzliche Leitplanke an das System-Prompt hängen —
    // der „keine Inhalte/Fakten erfinden"-Schutz aus assistSystem bleibt vollständig erhalten.
    const guidance = instruction?.trim();
    const system = guidance
      ? `${assistSystem(locale)}\n${assistGuidance(locale, guidance)}`
      : assistSystem(locale);
    // JOB 3276: das Budget richtet sich nach der Eingabe (s. assistAntwortBudget) — ein Denkmodell
    // braucht Kopfraum für Denken UND Antwort, sonst kommt eine 200er-Antwort ohne Inhalt zurück.
    const budget = assistAntwortBudget(text);
    // JOB 3276 R3: der Aufruf läuft in der Abbruch-Spur — ein Fragment (finish_reason=length MIT
    // Inhalt) kommt damit als BEFUND hier an und nicht als scheinbar vollständiger Vorschlag.
    const { wert: roh, abbruch } = await mitAbbruchBefund(() =>
      client.complete(system, text, confidential, budget),
    );
    const improved = roh.trim();
    // ============================================================================================
    // JOB 3276 — `improved || text.trim()` WAR DIE LÜGE, DIE PEDI GESEHEN HAT.
    // ============================================================================================
    // Eine leere Modellantwort wurde damit zum EINGABETEXT, ausgewiesen mit `demo: false` — also
    // als Arbeit des Modells. Im Expertenformular stand danach der unveränderte Text mitsamt
    // seiner Rechtschreibfehler da, ohne jeden Hinweis. Ein Vorschlag, den es nie gab.
    //
    // Leer heißt ab hier: FEHLER. Er trägt (wie der Chokepoint in `model-client.ts`) nur
    // Metadaten — Modell und Budget —, nie den Text des Nutzers. Was daraus wird, entscheidet die
    // Kette in `service.ts`: ein anderes Modell, ein Ersatz, der wirklich etwas kann, oder eine
    // ehrliche Meldung. Nur eines nicht mehr: das Original als Vorschlag.
    if (improved.length === 0) {
      throw new ModelEmptyResponseError(
        `${client.model ?? client.name} lieferte keinen überarbeiteten Text (assist, Budget ${budget}).`,
        { reason: "empty", maxTokens: budget },
      );
    }
    // ============================================================================================
    // JOB 3276 R3 — EIN ABGERISSENER SATZ IST KEIN VORSCHLAG.
    // ============================================================================================
    // Ein Fragment sieht aus wie eine Antwort und ist eine halbe. Es als Vorschlag zu reichen wäre
    // hier besonders teuer: der Mensch drückt „Ersetzen" und verliert das Ende seines Absatzes.
    // Also derselbe Fehlerweg wie beim leeren Abbruch, mit demselben Grund im Wortlaut
    // (`finish_reason=length`, Budgetfeld und Budget) — die Kette entscheidet danach weiter.
    if (abbruch !== null) {
      throw new ModelEmptyResponseError(
        `${client.model ?? client.name}: Antwort wurde am Token-Limit abgeschnitten (assist, ${abbruch.budgetFeld}=${abbruch.budget}, finish_reason=${abbruch.finishReason}).`,
        { reason: "truncated", finishReason: abbruch.finishReason, maxTokens: abbruch.budget },
      );
    }
    return { text: improved, demo: false };
  }

  // SCRUM-132: Modell formuliert nur die nächste Frage; Abschluss + Draft-Verdichtung
  // bleiben deterministisch (kein Erfinden von Inhalt). demo=false, da Modell genutzt.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
    // SCRUM-502 Schicht 2: an den Chokepoint durchgereicht.
    confidential = false,
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
        confidential,
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
    keepSourceLanguage = false,
    // SCRUM-502 Schicht 2: an den Chokepoint durchgereicht.
    confidential = false,
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
      ? `${extractSystem(locale, keepSourceLanguage)}\n${extractGuidance(locale, guidance)}`
      : extractSystem(locale, keepSourceLanguage);
    // SCRUM-427: in Abschnitten extrahieren — jede Modell-Antwort bleibt klein genug, dass sie
    // nicht am Token-Limit abreißt. Ergebnisse dedupliziert zusammenführen; jede Belegstelle
    // wird gegen IHREN Abschnitt geprüft (G-2 bleibt). SCRUM-411/418-Semantik erhalten:
    //  - vollständige Punkte aus gekürzten Abschnitts-Antworten werden gerettet (salvage);
    //  - liefert KEIN Abschnitt verwertbare Punkte UND mind. einer scheitert hart → ehrlich
    //    scheitern (Reasoner meldet den echten Grund, SCRUM-411).
    const chunks = chunkForExtract(doc);
    const points: ExtractedPoint[] = [];
    const seen = new Set<string>();
    let anyIncomplete = false;
    let hardFailure = false;
    // JOB 3366: der belegte Abbruchbefund des Anbieters — je Abschnitt erhoben, weil jeder Abschnitt
    // ein eigener Modellaufruf ist. Gehalten wird der ZULETZT gemeldete; die Aussage, die daraus an
    // der Fläche wird, lautet „mindestens ein Abschnitt riss am Limit ab" und ist damit gedeckt.
    let abbruch: ModellAbbruchBefund | null = null;
    for (const chunk of chunks) {
      if (points.length >= MAX_EXTRACT_POINTS) {
        break;
      }
      const { wert: raw, abbruch: abschnittAbbruch } = await mitAbbruchBefund(() =>
        client.complete(system, chunk, confidential, EXTRACT_MAX_TOKENS),
      );
      if (abschnittAbbruch !== null) {
        abbruch = abschnittAbbruch;
      }
      let chunkPoints: ExtractedPoint[];
      try {
        chunkPoints = parseExtractResponse(raw, chunk);
      } catch {
        chunkPoints = salvageTruncatedExtract(raw, chunk);
        anyIncomplete = true;
        if (chunkPoints.length === 0) {
          hardFailure = true;
          continue;
        }
      }
      for (const p of chunkPoints) {
        const key = p.title.trim().toLowerCase();
        if (key.length === 0 || seen.has(key)) {
          continue;
        }
        seen.add(key);
        points.push(p);
        if (points.length >= MAX_EXTRACT_POINTS) {
          break;
        }
      }
    }
    // Kein einziger verwertbarer Punkt UND mindestens ein Abschnitt scheiterte hart →
    // ehrlich scheitern (SCRUM-411-Meldeweg über den Reasoner-Fallback).
    if (points.length === 0 && hardFailure) {
      throw new Error(
        locale === "en"
          ? "model response was not valid JSON (possibly truncated)"
          : "Modell-Antwort war kein gültiges JSON (möglicherweise abgeschnitten)",
      );
    }
    const incomplete = anyIncomplete || hardFailure;
    return {
      points,
      note:
        points.length > 0
          ? incomplete
            ? locale === "en"
              ? "Note: part of the document could not be fully processed — this list may be incomplete. Every shown point still carries a verified source excerpt."
              : "Hinweis: Ein Teil des Dokuments konnte nicht vollständig verarbeitet werden — diese Liste ist möglicherweise unvollständig. Jeder angezeigte Punkt trägt weiterhin eine geprüfte Belegstelle."
            : null
          : locale === "en"
            ? "No knowledge points with a verifiable source excerpt were found in this document."
            : "In diesem Dokument wurden keine Wissenspunkte mit belegbarer Textstelle gefunden.",
      demo: false,
      // JOB 3366: die Meldung des ANBIETERS, getrennt von der abgeleiteten `note` darüber.
      ...abbruchFeld(abbruch),
    };
  }

  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
    // AUFTRAG-mega61 Block G: kommt aus dem Kontext, den der Ask-Dienst wirklich übergibt.
    confidential = false,
    // JOB 3049 (N2, Scheibe 3): der Relevanztext. Er wirkt AUSSCHLIESSLICH auf die Auswahl eine
    // Zeile tiefer — der Prompt darunter baut unverändert auf `question` und den Quelltexten auf,
    // und kein ergänztes Wort verlässt diesen Dienst (kein Egress, kein Netzaufruf).
    relevanz: Relevanztext = [],
  ): Promise<AnswerResult> {
    // SCRUM-360: begrenzte, status-/trust-bewusste Top-K-Auswahl → das Modell bekommt nur eine
    // gedeckelte, relevant gerankte Quellenmenge (kein blindes Durchreichen aller KOs).
    // JOB 3049: dieselbe eine Auswahlfunktion wie im deterministischen Weg, jetzt mit demselben
    // Relevanztext — sonst fiele hier wieder, was Tor 1 gerade durchgelassen hat.
    // JOB 3353 (M2): DIESELBE Auswahl wie bisher, danach die Zwillingsregel — ein validiertes
    // Objekt verliert seinen Platz nicht an die unvalidierte Kopie desselben Titels, nur weil die
    // Rahmenwörter der Frage in deren Herkunftshinweis stehen. Kein neuer Titel, kein größerer
    // Deckel, keine gelockerte Sichtbarkeit (Begründung und Grenzen bei `waehleKandidaten`).
    const relevant = waehleKandidaten(question, context, DEFAULT_TOP_K, relevanz);
    // FR-RSN-03: ohne belastbares Wissen keine Rateantwort — Modell wird gar nicht erst befragt.
    const best = relevant[0];
    if (!best) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: false,
      };
    }
    const client = this.requireClient();
    const labels = LABELS[locale];
    // JOB 3298: DER ANTWORTKONTEXT TRÄGT JETZT AUCH DEN DOKUMENTTEXT — als eigenes, beschriftetes
    // Feld unter DERSELBEN Quellennummer. Bis heute stand hier ausschließlich `Titel: Aussage`; eine
    // Regel, die nur im Fließtext steht, erreichte das Modell nie (Begründung und Deckel bei
    // `dokumentAuszuege`). Die Nummerierung, die Reihenfolge und die Zeile selbst bleiben unverändert
    // — ein Ref ohne passenden Auszug sieht Zeichen für Zeichen aus wie vorher.
    const auszuege = dokumentAuszuege(question, relevant);
    const grounding = relevant
      .map((r, i) => {
        const zeile = `[${i + 1}] ${r.title}: ${r.statement}`;
        const auszug = auszuege.get(r.id);
        return auszug ? `${zeile}\n    ${labels.excerpt}: ${auszug}` : zeile;
      })
      .join("\n");
    // JOB 3366: der Aufruf läuft in der Abbruch-Spur (JOB 3276 R3). Ein Fragment (finish_reason
    // `length` MIT Inhalt) kommt damit als BEFUND hier an; der Text selbst bleibt unangetastet.
    const { wert: rohAntwort, abbruch } = await mitAbbruchBefund(() =>
      client.complete(
        answerSystem(locale),
        `${labels.question}: ${question}\n\n${labels.sources}:\n${grounding}`,
        // AUFTRAG-mega61 Block G: hier stand hart `false`, begründet mit „Ask-Antwortkontext ist
        // bereits Schicht-1-gefiltert". Das ist eine ANNAHME über einen entfernten Aufrufer, keine
        // Garantie im Code — und sie machte den Egress-Wächter am Chokepoint auf diesem Weg
        // wirkungslos. Jetzt kommt der Wert von dort, wo der Kontext entsteht.
        confidential,
      ),
    );
    const answerText = rohAntwort.trim();
    // JOB 2659 D1 (Befund 7): EINE ABSAGE IST EINE ABSAGE. Das Modell sagt strukturiert, dass die
    // Quellen nicht reichen — das ist keine Antwort, sondern eine Wissenslücke (`answered:false`,
    // der Ask-Dienst legt daraus den Gap an). Bisher ging derselbe Satz als Fließtext-Antwort hinaus.
    if (istAbsage(answerText)) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: false,
      };
    }
    // mega52 A2/A3: die Marken werden jetzt WIRKLICH zurückgelesen. Leer, wenn das Modell keine
    // oder nur unbrauchbare Marken lieferte (A5).
    const cited = citedSourceIds(answerText, relevant);
    // JOB 2659 D1 (Befund 6): KEINE MARKE, KEINE ANTWORT. Bis heute ging ein Text ohne jede Marke
    // mit `answered:true` und bis zu acht `sources` hinaus; die Reißleine im Ask-Dienst griff nur
    // bei `sources.length === 0`, was hier nie eintrat. Der Prompt macht die Marke zur PFLICHT für
    // jede Quellaussage — ein Text ohne Marke ist nach diesem Vertrag keine Quellaussage. Er wird
    // herabgestuft auf „nicht beantwortet": derselbe Zustand wie ohne Kandidaten, damit kein
    // Verbraucher aus `sources` eine Grundlage liest, die niemand belegt hat. Der Pin in
    // `tests/ask/mega52-tragende-quellen.test.ts` (A5) ist entsprechend geändert und begründet.
    if (cited.length === 0) {
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: false,
      };
    }
    // AUFTRAG-mega53 B1: die TRAGENDE Teilmenge — genau die Kandidaten, deren Marke im Antworttext
    // stand. Bis mega53 kamen Klasse und Vertrauenswert von `best`, also vom BESTGERANKTEN
    // Kandidaten, unabhängig davon, ob das Modell ihn überhaupt benutzt hat. `best` entscheidet ab
    // hier nur noch, OB gefragt wird (ohne Kandidaten kein Modellaufruf), nicht mehr, WIE sicher
    // die Antwort ist.
    const carrying = relevant.filter((r) => cited.includes(r.id));
    // JOB 2659 D1/D2 (Befund 4): EINE MARKE IST KEIN BELEG. Jede markierte Aussage wird gegen die
    // Quelle geprüft, die sie markiert (Maß und Grenze bei `pruefeDeckung`). Hält eine nicht,
    // geht NICHT der Modelltext hinaus, sondern der Wortlaut der bestgerankten zitierten Quelle;
    // `citedSources` ist dann genau diese eine. `sources` bleibt die vollständige Transparenzliste
    // der herangezogenen Kandidaten (B3, mega52: was `sources` bedeutet, ändert dieser Auftrag nicht).
    const deckung = pruefeDeckung(answerText, relevant);
    if (!deckung.gedeckt) {
      // JOB 3353 (M3): HIER STAND `answer: carrying[0].statement` OHNE JEDE BEDINGUNG — und das war
      // der Livetext der Vorführung: bei der Confluence-Kopie von C02 ist diese Kernaussage der
      // Fiktionshinweis, und er ging als beantwortete Frage hinaus. Jetzt entscheidet
      // `rueckfallAntwort`, WAS überhaupt tragfähig ist (Auszug vor Kernaussage vor gar nichts).
      // JOB 3365: und `rueckfallStand` entscheidet, ob überhaupt EINE Auskunft ausgegeben werden
      // darf. Trägt eine andere herangezogene Quelle zu dieser Frage einen anderen Wortlaut, wird
      // nicht mehr still gewählt — beide stehen mit ihrer Quelle da (Begründung am Funktionskopf).
      // `relevant` und nicht `carrying` ist die Bezugsgröße: die Markenwahl des Modells stammt aus
      // dem Text, der eben verworfen wurde, und trägt hier nichts mehr.
      const rueckfall = rueckfallStand(question, carrying, relevant, locale);
      if (!rueckfall) {
        // Nichts, was die Frage berührt: dieselbe ehrliche Wissenslücke wie ohne Kandidaten. Der
        // Modelltext geht weiterhin NICHT hinaus (Befund 4 aus JOB 2659 bleibt geschlossen).
        return {
          answered: false,
          answer: null,
          knowledgeClass: "unbekannt",
          trust: 0,
          sources: [],
          citedSources: [],
          steps: [],
          demo: false,
        };
      }
      return {
        answered: true,
        answer: rueckfall.text,
        // JOB 3365: über ALLE genannten Quellen. Steht eine offene Kopie in der Herleitung, ist die
        // Antwort ungeprüft — die alte Form rechnete auf der einen gewählten Quelle und hätte hier
        // „gesichert" ausgewiesen, obwohl die andere Hälfte der Auskunft ungeprüft ist.
        ...answerStanding(rueckfall.refs),
        sources: relevant.map((r) => r.id),
        citedSources: rueckfall.refs.map((r) => r.id),
        steps: relevant.map((r) => ({
          description: sourceLabel(r.title, locale),
          sourceId: r.id,
          snippet: r.statement,
        })),
        demo: false,
      };
    }
    return {
      answered: true,
      answer: answerText,
      // JOB 3366: HIER und nur hier — dies ist der einzige Ausgang, der den MODELLTEXT ausliefert.
      // Die Rückfallausgänge oben geben den Wortlaut einer Quelle aus (vollständig) oder gar keine
      // Antwort; ein Unvollständigkeits-Hinweis an ihnen wäre eine Aussage über einen Text, den
      // niemand zu sehen bekommt.
      ...abbruchFeld(abbruch),
      ...answerStanding(carrying),
      // Unverändert: alle HERANGEZOGENEN Kandidaten. Was `sources` bedeutet, ändert dieser Auftrag
      // nicht (B3) — sie bleiben die vollständige Transparenzliste, aber sie sind nicht mehr die
      // Grundlage einer Aussage über die Antwort.
      sources: relevant.map((r) => r.id),
      citedSources: cited,
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
    // enrichPublic ist per Design öffentliches Weltwissen (Admin-gated) — reine User-Query, nicht vertraulich.
    const text = (await client.complete(enrichPublicSystem(locale), query, false, 1024)).trim();
    return { text, provider: this.name, demo: false };
  }

  // Berater-Konzept 04.07. (Stufe 2, kon-v1): „Konfliktprüfung" über das echte Modell. Neutrale
  // A/B-Labels (kein Autor/Trust), striktes JSON; kaputte/ungültige Antworten → null (kein Konflikt).
  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): `confidential` ist PFLICHT und reist als ECHTES
  // Paar-Bit bis in den zentralen ModelClient.complete-Wächter (cappedModelClient) — kein hartes
  // `false` mehr. Ein falsch verdrahteter Cloud-/Fremd-Secondary wird dort VOR dem Fetch gestoppt.
  async judgeConflict(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale,
    confidential: boolean,
  ): Promise<ConflictJudgeResult | null> {
    const client = this.requireClient();
    const user = `A:\n${coreA}\n\nB:\n${coreB}`;
    // SCRUM-492: etwas mehr Spielraum für den optionalen kollision-Block (vorher 512).
    const raw = await client.complete(conflictSystem(locale), user, confidential, 640);
    return parseConflictResponse(raw);
  }

  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): „Duplikatprüfung" über das echte Modell.
  // D-AISTATE PAKET 1 (bens V1, aistate-fix3): `confidential` PFLICHT bis zum Wächter (s. judgeConflict).
  async judgeDuplicate(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale,
    confidential: boolean,
  ): Promise<DuplicateJudgeResult | null> {
    const client = this.requireClient();
    const user = `A:\n${coreA}\n\nB:\n${coreB}`;
    const raw = await client.complete(duplicateSystem(locale), user, confidential, 768);
    return parseDuplicateResponse(raw);
  }

  private requireClient(): ModelClient {
    if (!this.client) {
      throw new Error("Kein Modell-Client konfiguriert.");
    }
    return this.client;
  }
}
