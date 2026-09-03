import { randomBytes, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import {
  type KnowledgeObject,
  type KoService,
  SUCH_ZUORDNUNGEN,
  type SuchZuordnung,
  type WithTx,
  dropConfidential,
  expandSearchTerms,
  isConfidential,
  normalizeSearchTerms,
} from "../../knowledge-object";
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
import { gapCompareKey, normalizeGapQuestion } from "./gap-text";
import { type GapSummary, summarizeGaps } from "./gap-visibility";
import { signAnswerReceipt, verifyAnswerReceipt } from "./receipt";
import type { AnswerSnapshotRepo, GapRepo } from "./repo";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  type AskCaller,
  AskError,
  type Gap,
  type GapPriority,
  answerSnapshotStatus,
  hashAnswerSnapshot,
  isGapPriority,
} from "./types";

const HELPFUL_TRUST_STEP = 2;

// SCRUM-361 / AG-03 / NFR-PERF-03: Obergrenze der datenquellennahen Kandidaten-Vorauswahl. Bewusst
// deutlich größer als DEFAULT_TOP_K (8): das Repository liefert eine großzügige, vorgefilterte Menge,
// die finale, präzise Status-/Trust-/Relevanz-Sortierung + Top-K macht der Reasoner (selectCandidates).
const ASK_CANDIDATE_PREFILTER_LIMIT = 200;

// ================================================================================================
// JOB 531 — DIE VORAUSWAHL DARF SICH NICHT AUF DIE RANGFOLGE DER DATENQUELLE VERLASSEN.
// ================================================================================================
//
// DER BEFUND. Die Deckelung der Vorauswahl war richtig, ihre Annahme war es nicht: sie setzte
// voraus, dass die Quelle RELEVANZ-bewusst deckelt. Die beiden Adapter tun das unterschiedlich —
//   · InMemoryKoRepo sortiert (Term-Trefferzahl ↓, validiert, Trust ↓) und schneidet danach,
//   · PgKoRepo sortiert `ORDER BY (status='validiert') DESC, trust DESC LIMIT n` OHNE Relevanzmaß.
// Solange der Bestand klein ist, fällt das nicht auf. Wächst er, füllen schwach relevante, aber
// validierte Objekte mit hohem Trust das Limit, und der eigentlich passende Treffer fällt aus der
// Vorauswahl — im Produktionsadapter, nicht im Testadapter. Dieselbe Frage, derselbe Bestand,
// zwei Ergebnisse; die Abweichung beginnt genau dort, wo niemand mehr nachzählt.
//
// DIE LÖSUNG, adapterunabhängig und weiterhin gedeckelt: je Fragebegriff EINE eigene, hart
// begrenzte Quellabfrage; die Vereinigung wird nach der Zahl der abgedeckten Fragebegriffe
// geordnet und erst dann auf das Gesamtlimit geschnitten. Ein seltener, hochspezifischer Begriff
// hat wenige Treffer — der passende Kandidat steht dort weit vorn und überlebt jede Rangfolge der
// Quelle. Es wird weiterhin NIE der Gesamtbestand geladen.
//
// WARUM DIE ZWEI DECKEL. `ASK_PREFILTER_TERM_LIMIT` begrenzt jede einzelne Abfrage; die Zahl der
// Abfragen begrenzt `ASK_PREFILTER_MAX_TERMS`, damit eine absichtlich lange Frage die Datenquelle
// nicht beliebig oft anfragen kann (Lastgrenze je Frage, nicht je Bestand).
const ASK_PREFILTER_TERM_LIMIT = 50;
const ASK_PREFILTER_MAX_TERMS = 8;

// ================================================================================================
// JOB 3006 (KA5) — DIE MARKIERTE STELLE SCHÄRFT DIE SUCHE, UND SONST NICHTS.
// ================================================================================================
//
// WAS HIER GESCHIEHT: Die im Word-Panel markierte Passage wird in Inhaltstoken zerlegt und ERGÄNZT
// die Suchbegriffe der Frage. Das Ergebnis geht an GENAU EINEN Verbraucher — `prefilterCandidates`.
//
// ================================================================================================
// ZWEI TERMMENGEN, UND WARUM ES ZWEI SEIN MÜSSEN (BEN, Runde 2, Befund 1).
// ================================================================================================
//
// Runde 2 hatte nur EINE Menge und reichte sie an alles weiter, was hinter der Vorauswahl auf
// Termen rechnet. Das war ein Fehler, und er war sichtbar: `captionSources` (unten in `ask`)
// entscheidet, ob eine Quelle NUR über ihre Bild-Fußnoten getroffen wurde, und die Oberfläche macht
// daraus das Herkunfts-Etikett „Bildbeschreibung" (`Ask.tsx`). Traf ein Wort der MARKIERUNG die
// Fußnote eines Objekts, das die FRAGE über seinen Fließtext gefunden hatte, behauptete die Antwort
// eine Fundstelle, die es nicht gab — dieselbe Antwort, dieselbe Quelle, aber ein falsches Etikett.
// Das ist genau die Sorte stiller Unwahrheit, die „Ehrlichkeit vor Optik" verbietet.
//
// DIE TRENNUNG IST DESHALB KEINE VORSICHTSMASSNAHME, SONDERN DIE REGEL:
//   · `frageterme`  — wonach der FRAGENDE gesucht hat. Jede Aussage ÜBER die Antwort (Herkunft,
//     Fundstelle, Einstufung) rechnet auf dieser Menge und nur auf ihr.
//   · `suchterme`   — womit der Bestand DURCHSUCHT wurde. Sie darf breiter sein, denn sie behauptet
//     nichts; sie holt nur Kandidaten heran, über die danach unverändert die Frage entscheidet.
// Wer künftig eine weitere Ableitung hinter der Vorauswahl baut, muss sich fragen, welche der
// beiden er meint. Das ist der ganze Zweck der zwei Namen.
//
// DIE DREI EIGENSCHAFTEN, die diese Funktion zu einer Grenze und nicht zu einer Abkürzung machen:
//
//   1. DIE FRAGE BEHÄLT DEN VORRANG. Die Frageterme stehen unverändert vorn, in ihrer Reihenfolge.
//      Die Passagenterme hängen sich hinten an. `prefilterCandidates` schneidet die Liste auf
//      `ASK_PREFILTER_MAX_TERMS` — eine Passage kann der Frage deshalb keinen Suchbegriff wegnehmen.
//      GEMESSENE KEHRSEITE, benannt statt verschwiegen: Trägt die Frage selbst schon acht oder mehr
//      Inhaltstoken, ist das Fenster der Vorauswahl voll, und es wird KEIN Passagenterm mehr
//      abgefragt — die Markierung bleibt dann wirkungslos. Das ist der Preis des Vorrangs und die
//      bestehende Lastgrenze, nicht ein Fehler dieser Funktion (Beleg: KA5-R8b).
//   2. DER DECKEL IST `ASK_PREFILTER_MAX_TERMS` (8), und zwar aus einem gemessenen Grund und nicht
//      aus Geschmack: mehr als acht Terme fragt die Vorauswahl konstruktiv NIE ab. Ein höherer
//      Deckel wäre wirkungslos, ein niedrigerer würde die Passage stärker beschneiden als die
//      bestehende Lastgrenze es ohnehin tut. Die Lastgrenze je Frage (Abfragezahl × Abfragelimit)
//      bleibt damit unverändert die alte.
//   3. DOPPELTE TERME FALLEN WEG. Ein Wort, das in Frage UND Passage steht, ist bereits Suchbegriff;
//      ein zweites Mal abgefragt verdoppelte es nur seine Stimme in der Relevanzordnung von
//      `prefilterCandidates` (`termTreffer`) und verschöbe die Rangfolge ohne neuen Erkenntniswert.
//
// UND WAS HIER AUSDRÜCKLICH NICHT GESCHIEHT: Die Passage wird nicht in die Frage gemischt. Sie
// erreicht weder `reasoner.answer` noch `answerRetrievalOnly`, keinen Embedder, keinen
// Antwortkörper, keinen Auditeintrag, keine Wissenslücke und keine Ablage. Der Beleg dafür ist
// kein Kommentar, sondern `tests/ka5/markierung-kein-egress.test.ts`.
const SELECTION_TERM_LIMIT = ASK_PREFILTER_MAX_TERMS;

function erweiterteSuchterme(frageterme: readonly string[], selection?: string): string[] {
  if (!selection) {
    return [...frageterme];
  }
  const bekannt = new Set(frageterme);
  const zusatz: string[] = [];
  for (const term of queryTokens(selection)) {
    if (bekannt.has(term)) {
      continue;
    }
    bekannt.add(term);
    zusatz.push(term);
    if (zusatz.length >= SELECTION_TERM_LIMIT) {
      break;
    }
  }
  return [...frageterme, ...zusatz];
}

// ================================================================================================
// JOB 3021 (N2) — DIE DEKLARIERTE WORTZUORDNUNG GILT AUCH, WENN KLARA ANTWORTET.
// ================================================================================================
//
// DER BEFUND. Die Zuordnung aus JOB 1531 (`SUCH_ZUORDNUNGEN`/`expandSearchTerms`) wirkt in beiden
// Suchadaptern der Bibliothek. Bei Klara wirkte sie NICHT — und der Grund ist ein anderer als der
// naheliegende: der Adapter ruft sie sehr wohl (`search-projection-repo.ts:710`, dieselbe Zeile
// steht in `…-repo-pg.ts:580`, und `findCandidates` läuft über genau diesen Weg). Was fehlte, ist
// die FORM.
//
// GEMESSEN, nicht vermutet (die Zahlen sind mit `queryTokens` am Baumstand erhoben):
//
//     queryTokens("Urlaubsregelung")  ===  ["urlaubsregel"]
//     queryTokens("Firmenwagen")      ===  ["firmenwag"]
//     queryTokens("klep")             ===  ["klep"]
//
// `queryTokens` ist KEINE reine Zerlegung: es siebt Stoppwörter UND führt jedes Token auf seine
// Grundform (`provider.ts:1161-1175`). Die Tabelle ist dagegen in der OBERFLÄCHENFORM deklariert —
// so, wie Pedi die Wörter diktiert hat und wie die Bibliothek sie in ihre Suchzeile tippt. Der
// Mengenvergleich in `expandSearchTerms` trifft „urlaubsregel" gegen „urlaubsregelung" deshalb
// nie. Nur `klep` fiel nicht auf: es ist zufällig seine eigene Grundform.
//
// DIE UMRECHNUNG GEHÖRT HIERHER UND NICHT IN DIE TABELLE. Ein zweiter, gebeugter Eintrag je Wort
// wäre eine erfundene Setzung ohne Fundstelle (genau der Fehler, gegen den `s2-synonyme.test.ts`
// Fall Z1 steht), und `expandSearchTerms` darf nichts ableiten (`S2_ERWEITERUNG_GRENZE.leitetAb`).
// Hier dagegen ist nichts abzuleiten: die Grundform der DEKLARIERTEN Wörter entsteht durch genau
// dieselbe Zerlegung, durch die auch die Frage läuft. Es wird keine Regel erfunden, sondern die
// vorhandene auf beide Seiten desselben Vergleichs angewandt.
//
// DREI SCHRITTE, und die Zuordnung selbst bleibt in `expandSearchTerms` — hier steht kein Nachbau:
//   1. Welche deklarierten Wörter hat der Fragepfad wirklich getippt? Verglichen wird in SEINER
//      Form: `queryTokens(begriff)` gegen die Suchterme.
//   2. Die Erweiterung: `expandSearchTerms(normalizeSearchTerms(…))` — die kanonische Kette, die
//      auch die beiden Adapter fahren, mit derselben Tabelle und derselben Reihenfolgezusage.
//   3. Zurück in die Form des Fragepfads, und NUR das, was noch fehlt. Damit steht die ganze
//      Termliste der Vorauswahl in EINER Form; ein Mischbetrieb wäre die zweite Wahrheit, die
//      dieser Durchgang gerade abschafft.
//
// WAS HIER AUSDRÜCKLICH NICHT GESCHIEHT: keine Komposita-Zerlegung, kein Wörterbuch, kein
// Stemmer (der vorhandene wird benutzt, nicht erweitert), kein Modell, kein Embedder, kein Netz.
// Der semantische Vorfilter bleibt unberührt und AUS.
//
// ================================================================================================
// UND DIE GRENZE DIESER SCHEIBE — VON JOB 3039 NACHGEMESSEN UND BERICHTIGT.
// ================================================================================================
//
// JOB 3021 hat hier gestanden: „geschärft wird die KANDIDATENVORAUSWAHL. Zwischen ihr und der
// Antwort steht `selectCandidates` (`reasoner/src/provider.ts`), dessen Relevanzmaß auf dem
// GETIPPTEN Fragetext rechnet." Der Satz war RICHTIG, aber UNVOLLSTÄNDIG, und die fehlende Hälfte
// ist der Grund, warum JOB 3039 die Zusage „Klara antwortet aus dem gefundenen Objekt" NICHT
// eingelöst hat. Zwischen Vorauswahl und Antwort stehen ZWEI Tore, nicht eines:
//
//   TOR 1  `selectCandidates` im Fragedienst        (`ask/src/service.ts`, unten)
//   TOR 2  DIESELBE Auswahl NOCH EINMAL im Reasoner:
//            · `DeterministicProvider.select` → `selectCandidates(question, …)`
//              (`reasoner/src/provider.ts:1683`; `Reasoner.answerRetrievalOnly`
//              (`reasoner/src/service.ts:1150-1156`) führt genau dorthin)
//            · `ModelProvider.answer` → `selectCandidates(question, context)`
//              (`reasoner/src/provider-model.ts:1424`, ebenso `select` `:1147`)
//
// TOR 2 bekommt die ROHE Frage — und zwar zu Recht: der Reasoner ist der Ort, an dem die Antwort
// entsteht, und er darf nur auf dem rechnen, wonach wirklich gefragt wurde. Ein Objekt, das nur
// über eine Entsprechung hereinkam, fällt deshalb DORT, auch wenn Tor 1 es durchlässt.
//
// GEMESSEN, nicht geschlossen (JOB 3039 R2, alle Zahlen aus `tests/suche-zuordnung/…`):
//   · Echtpfad `AskService` + echter `Reasoner`, Frage „Wo finde ich die Urlaubsregelungen im
//     Handbuch?" → `answered:false`, `sources:[]` — auf BEIDEN Antwortwegen (Fall Z1).
//   · Liegt das Objekt bereits im Kontext, verwerfen es beide Wege erneut; wird das deklarierte
//     Gegenwort dagegen GETIPPT, antworten beide (Fall Z2). Die Wand ist also die Neuauswahl auf
//     der Rohfrage und nichts anderes.
//   · Tor 1 allein zu weiten, hilft nicht nur nichts, es SCHADET: acht Objekte, die allein über die
//     Entsprechung hereinkommen, füllen den Deckel `DEFAULT_TOP_K` (8) und verdrängen den echten
//     Treffer, der ohne die Weitung geantwortet hätte — `answered:true` wird zu `answered:false`
//     (Fall W1). Deshalb steht am Toraufruf unten wieder die unveränderte Frage.
//   · Und die Weitung von Tor 1 allein wäre fail-open: eine Quelle, die BEIDE Wörter eines Paares
//     trägt, sammelt aus EINEM getippten Wort zwei Substanzpunkte (Fall W2) — genau der zweite
//     Punkt, den es nicht geben darf.
//
// WAS ES BRÄUCHTE, als Vorschlag und nicht als Bau: einen sauber getrennten RELEVANZTEXT, der neben
// der Frage durch `Reasoner.answer`/`answerRetrievalOnly` bis in beide Provider gereicht wird —
// Fragetext, Modellprompt, Wissenslücke und Prüfprotokoll blieben dabei unangetastet. Das sind
// Änderungen in `services/reasoner/**`, und dieser Pfad ist in JOB 3039 §10 ausdrücklich
// ausgeschlossen. Solange er nicht freigegeben ist, endet die Zuordnung bei der VORAUSWAHL.
//
// DIE ZWEITE GRENZE, unabhängig von der ersten und ebenfalls gemessen: das Substanzmaß.
// `MIN_ANSWER_SUBSTANCE` ist 2 (`reasoner/src/provider.ts:1392`) und verlangt ZWEI verschiedene
// gemeinsame Inhaltstoken. Eine Frage mit nur EINEM Inhaltstoken — „Wie ist die Urlaubsregelung?"
// zerfällt in `["urlaubsregel"]` — erreicht diese Zahl auch dann nicht, wenn das Gegenwort trifft;
// sie fiele selbst dann, wenn der Fragende „Urlaubszeiten" wörtlich getippt hätte. AUSNAHME,
// gemessen und deshalb hier genannt statt verschwiegen: trägt EINE Quelle beide Wörter des Paares,
// kämen zwei Punkte aus einem getippten Wort zustande (Fall W2). Das ist keine Grenze, sondern ein
// Fehler — und der Grund, warum ein künftiger Relevanztext jedes Paar höchstens EINMAL zählen muss.
// Gemessen: `tests/suche-zuordnung/n2-klara-versteht-zusammensetzungen.test.ts`, Fälle F6, W1, W2, Z1, Z2.
export function zugeordneteSuchterme(
  suchterme: readonly string[],
  /**
   * Die belegten WÖRTER, in denen dieser Pfad die Frage wiedererkennt — Parameter mit der
   * Produktionsvorgabe, damit die Kalibrierung des Prüfstands führbar ist: eine Reihe grüner
   * Zusicherungen ist von einem toten Prüfstand nur dann zu unterscheiden, wenn ein Lauf mit
   * LEERER Tabelle wieder auf das alte Verhalten fällt.
   *
   * AUSDRÜCKLICH NICHT die Paarung: welches Wort welches bedeutet, entscheidet unverändert
   * `expandSearchTerms` an seiner eigenen, deklarierten Tabelle. Wer hier ein Paar hereingibt, das
   * dort nicht steht, bekommt KEINE Ergänzung — von dieser Seite ist keine Zuordnung zu erfinden.
   */
  zuordnungen: readonly SuchZuordnung[] = SUCH_ZUORDNUNGEN,
): string[] {
  const getippt = new Set(suchterme);
  const getroffen = zuordnungen
    .flatMap((z) => z.begriffe)
    .filter((begriff) => queryTokens(begriff).some((t) => getippt.has(t)));
  if (getroffen.length === 0) {
    return [];
  }
  const raus: string[] = [];
  for (const wort of expandSearchTerms(normalizeSearchTerms(getroffen))) {
    for (const term of normalizeSearchTerms(queryTokens(wort))) {
      if (!getippt.has(term)) {
        getippt.add(term);
        raus.push(term);
      }
    }
  }
  return raus;
}

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
  /**
   * W3-C1 (Auftrag 76): der Beleg-Schreibweg — BEWUSST OPTIONAL.
   *
   * Ohne Repo laeuft der Antwortweg byte-identisch wie bisher; es entsteht nur kein Snapshot.
   * Ein Pflichtfeld haette dieselbe Wirkung gehabt wie das Pflicht-`findBySeq` aus Auftrag 67:
   * Bruch in fremden Aufbauten (Tests, Dev-Journal) ausserhalb jeder Dateigrenze. Die Lehre ist
   * frisch und wird hier angewandt.
   */
  answerSnapshots?: AnswerSnapshotRepo;
}

export interface AskResult {
  // WP-RETEST7 R5: + captionSources — Quellen, deren Treffer NUR über die Bild-Fußnoten zustande
  // kam (Fundstellen-Kennzeichnung analog zur Bibliothek: Badge „Bildbeschreibung").
  result: AnswerResult & { captionSources: string[] };
  /**
   * W3-C1 (Auftrag 76): die stabile Identitaet DIESER Antwort — oder `null`, wenn kein
   * Beleg-Repo verdrahtet ist. `null` heisst ehrlich „es wurde nichts persistiert", nicht
   * „die Antwort hat keine Identitaet": eine Kennung ohne Beleg waere eine leere Zusage.
   */
  answerId: string | null;
  gap: Gap | null;
  // FUNKE-FIX P0 (bens ROT-1): opaker Beleg über (Nutzer + ausgelieferte Quell-KOs). Der Client
  // reicht ihn beim „Danke" (/api/ask/helpful) zurück; der Server verifiziert die Quellen-Bindung.
  receipt: string;
  // ==============================================================================================
  // AUFTRAG-mega77 BLOCK A — HIER STAND `ungeprueftUnterdrueckt`, UND ER IST ENTFERNT.
  // ==============================================================================================
  //
  // mega74 Teil 2b hat an dieser Stelle eine Zahl ausgegeben: wie viele UNGEPRÜFTE Kandidaten die
  // `validatedOnly`-Einschränkung unterdrückt hat. Der Wunsch dahinter war richtig — „kein
  // validiertes Wissen" ist eine Auskunft über unseren PRÜFSTAND, nicht über den BESTAND. Die
  // Umsetzung trug aus zwei unabhängigen Gründen nicht, von denen jeder allein reicht:
  //
  //   1. SIE VERRIET. Die Zahl entstand OHNE Betrachterfilter — der AskService kennt an dieser
  //      Stelle keinen Nutzer mit Sichtbarkeitsvertrag, nur einen `actor`-String. Der
  //      Add-on-Principal besitzt `ask.validated` und gerade KEIN allgemeines Leserecht auf
  //      unvalidierte Objekte, bekam aber ihre Anzahl. Eine gezielte Frage mit dem Ergebnis `1`
  //      bestätigt die Existenz eines passenden unvalidierten Objekts; eng variierte
  //      Wiederholungen machen daraus ein ABFRAGEORAKEL. Die Leckwirkung beginnt bei n = 1 —
  //      dieselbe Grenze, die mega76 Block D bei den sechs Aggregaten gezogen hat.
  //
  //   2. SIE STIMMTE NICHT. Gezählt wurde nicht der Bestand, sondern die bereits gedeckelte
  //      Vorauswahl (`prefilteredRaw`). Der Kommentar am Clientvertrag behauptete trotzdem, `0`
  //      heiße „es gab wirklich nichts" und nicht „wir wissen es nicht" — durch die Berechnung war
  //      das nicht gedeckt.
  //
  // Ohne Zähler bleibt die Wissenslücke, wie sie vor mega74 war: ehrlich und ohne Auskunft über
  // fremden Bestand. WAS ES BRÄUCHTE, um die Auskunft richtig zu bauen, steht im Bericht zu
  // mega77 (Betrachterfilter an dieser Stelle, ehrliche Aussage über die Vollständigkeit, Antwort
  // auf das Orakel-Problem) — als Vorschlag, nicht als Bau.
  //
  // ==============================================================================================
  // JOB 1591 D1 (W5) — DER VORSCHLAG VON mega77 IST JETZT GEBAUT. KEIN ZAEHLER, SONDERN EIN FILTER.
  // ==============================================================================================
  //
  // Pedis Befund um 21:28: Er speichert einen Absatz als Entwurf (Zustand „Offen / ZU PRUEFEN"),
  // markiert ihn und fragt „haben wir diese Information schon?". Klara antwortet „Es gibt kein
  // VALIDIERTES Wissen zu dieser Frage." Das ist eine Auskunft ueber unseren PRUEFSTAND, waehrend
  // gefragt war nach unserem BESTAND — und der Anwender merkt den Unterschied nicht.
  //
  // Die zwei Gruende, aus denen mega77 den Zaehler entfernt hat, sind BEIDE beantwortet — nicht
  // umgangen:
  //
  //   1. GEGEN DAS LECK: Es wird nichts mehr ohne Betrachter gemeldet. `ungeprueftSichtbarFuer`
  //      ist die FERTIGE Sichtbarkeitsentscheidung, die der Aufrufer mitbringt — genau die
  //      Bauform, die `sichtbarkeitsfilterFuer` in `services/app/src/sichtbarkeit.ts` fuer
  //      „Dienste, die selbst ueber den Bestand laufen" anbietet. Der Dienst legt die Regel NICHT
  //      selbst aus; er wendet sie an. Wer keinen Filter uebergibt, bekommt `null` — und `null`
  //      heisst „nicht gefragt", nicht „nichts da". DER ADD-ON-PFAD UEBERGIBT KEINEN: der
  //      Add-on-Principal besitzt `ask.validated` und kein allgemeines Leserecht, hat keinen
  //      `SessionUser` und damit keinen Sichtbarkeitsvertrag. Fuer ihn bleibt alles, wie mega77 es
  //      hinterlassen hat. Das Abfrageorakel entsteht dort gar nicht erst.
  //
  //   2. GEGEN DIE FALSCHE ZAHL: Es wird KEINE Zahl mehr behauptet. Gemeldet werden die
  //      IDENTIFIZIERTEN Objekte aus derselben gedeckelten Vorauswahl, die auch die Antwort
  //      speist — und eine leere Liste heisst deshalb ausdruecklich NICHT „es gibt wirklich
  //      nichts". Sie heisst „in dieser Vorauswahl war nichts". Genau diese Zusage hat mega74
  //      gegeben und nicht gehalten; sie wird hier nicht wiederholt.
  //
  // WAS SICH NICHT AENDERT — die Grenze aus bens Fix 1 (P0) steht unberuehrt: `validatedOnly`
  // bleibt, die gemeldeten Objekte werden NIE Grundlage einer Antwort. Sie gehen nicht in `refs`,
  // nicht in `candidates`, nicht an den Reasoner, nicht in `sources`, nicht in den Antworttext.
  // Gemeldet wird die EXISTENZ mit Zustand — `{id, title, status}` —, nie der ungeprüfte Inhalt.
  // Das ist der ganze Unterschied zwischen „wir haben nichts" und „wir haben etwas, das noch
  // niemand geprueft hat".
  // JOB 1591 D2: ABWESEND statt `null`. Bis D1 stand hier `ungeprueft: … | null`, und der
  // Add-on-Zweig trug dadurch `"ungeprueft":null` im Antwortkoerper — der WERT war leer, der NAME
  // stand trotzdem da. `mega77` verbietet den Namen im Koerper, und zwar zu Recht: schon die
  // Anwesenheit eines Feldes verraet, dass es dieses Merkmal gibt, und macht es zum Ansatzpunkt.
  // Ab D2 fehlt das Feld vollstaendig, wo kein Betrachter uebergeben wurde. Das ist eine
  // VERSCHAERFUNG gegenueber D1, keine Lockerung: der unberechtigte Weg trug das Wort vorher,
  // jetzt traegt er es nicht mehr. Die Semantik bleibt dieselbe — abwesend heisst „nicht
  // gefragt", eine leere Liste heisst „nachgesehen und in dieser Vorauswahl nichts gefunden".
  ungeprueft?: UngeprueftHinweis[];
  // JOB 2626 D1 — WENN KLARA NICHT ANTWORTEN KANN, SAGT SIE WARUM.
  //
  // Pedis Frage vom 27.08. bekam „Keine belastbare Grundlage" — ehrlich und unbrauchbar: drei
  // Tore seines Dokuments waren gleichzeitig zu (nicht validiert, keine Stufe, kein Volltext),
  // und der Satz nannte keines. Dieses Feld traegt die TORLAGE der Kandidaten, die die Frage
  // getroffen haben, aber nicht Antwortgrundlage wurden — damit die Flaeche den Grund nennen
  // kann statt nur die Leere. Dieselben drei Vertraege wie bei `ungeprueft` gelten woertlich:
  //   · NUR mit Betrachter (`verschlossenSichtbarFuer`) — ohne Filter fehlt das Feld VOLLSTAENDIG
  //     (mega77: schon der Feldname im Koerper waere ein Ansatzpunkt; der Add-on-Pfad hat keinen
  //     Sichtbarkeitsvertrag und bekommt deshalb nichts).
  //   · NIE ueber Vertrauliches — die Menge entsteht hinter `dropConfidential`, derselben Linie,
  //     die auch die Antwort selbst schuetzt. Ein vertrauliches Dokument als „verschlossen" zu
  //     nennen, waere selbst der Egress, den die Sperre verhindert.
  //   · KEINE Behauptung ueber den Bestand — gemeldet wird aus derselben gedeckelten Vorauswahl,
  //     die auch die Antwort speist; eine leere Liste heisst „in dieser Vorauswahl nichts", nie
  //     „es gibt nichts".
  // Und die Grenze aus §4 des Auftrags: NUR bei `answered=false`, und je Dokument NUR die Tore,
  // die WIRKLICH zu sind (am Objekt gemessen, nicht am Sperrmechanismus geraten). Ein Kandidat,
  // dessen drei Tore offen sind und der trotzdem nicht trug (Relevanz, Modellentscheid), erscheint
  // NICHT — ein falsch benanntes Tor schickt in die falsche Richtung, die generische Leermeldung
  // bleibt fuer ihn die ehrliche Auskunft. Die Sperrlogik selbst ist unberuehrt
  // (E-VERTRAULICHKEIT-OHNE-STUFE-20260828: erklaeren ja, sperren oder entsperren nein).
  verschlossen?: VerschlossenHinweis[];
}

/**
 * Ein vorhandenes, aber NICHT validiertes Objekt — gemeldet, nie behauptet.
 *
 * Bewusst dieselben drei Felder, die der Bestandsblick KA2 dem Panel schon liefert
 * (`{treffer:[{id,title,status}]}`): kein zweiter Vertrag fuer dieselbe Sache
 * (`ENTSCHEIDUNGEN/JOB-646.md`). `statement` ist NICHT dabei und darf es nicht werden — der
 * ungeprüfte INHALT ist genau das, was hier nicht behauptet werden darf.
 */
export interface UngeprueftHinweis {
  id: string;
  title: string;
  status: string;
}

/**
 * JOB 2626 D1: ein Dokument, das die Frage traf, aber nicht antworten konnte — mit den Toren,
 * die zu sind. Basisfelder wie `UngeprueftHinweis` (KA2-Vertrag, kein `statement`); die drei
 * Tor-Flags sind ZUSTAENDE DES OBJEKTS (Station-1-3-Begriffe des Pedi-Pfads), keine Aussage
 * darueber, WELCHER Mechanismus den Kandidaten verworfen hat.
 */
export interface VerschlossenHinweis {
  id: string;
  title: string;
  status: string;
  /** Station 3: das Dokument ist nicht validiert („Freigabe fehlt"). */
  freigabeFehlt: boolean;
  /**
   * Station 3: keine Vertraulichkeitsstufe gesetzt („Stufe fehlt"). Die NULL=intern-Semantik
   * bleibt gepinnt und unangetastet (confidentiality.ts:39-41) — hier wird sie SICHTBAR gemacht,
   * nicht verlangt und nicht gesperrt.
   */
  stufeFehlt: boolean;
  /** Station 2: die Suchprojektion traegt keinen Dokumenttext („kein durchsuchbarer Text"). */
  volltextFehlt: boolean;
}

/**
 * Der Name, unter dem eine Systemausfuehrung im PRUEFPROTOKOLL erscheint.
 *
 * Das ist eine Beschriftung fuer Menschen, KEIN Eigentumsbegriff. Wer daraus wieder eine
 * Eigentumsentscheidung ableitet, baut den Fehler aus D3 nach.
 */
export const SYSTEM_ACTOR = "system";

/**
 * ================================================================================================
 * JOB 541 D4 — DIE ABSICHT KOMMT VOM AUFRUFER, NICHT AUS DEM WERT.
 * ================================================================================================
 *
 * HIER STAND BIS D3 `istSystemActor(actor)` mit `actor === SYSTEM_ACTOR`. Genau dieser Vergleich
 * ist der Datenfehler, den BEN beanstandet hat: Er verwechselt eine echte Kontokennung mit dem
 * Systemkontext, und ein Konto namens `system` verliert dadurch seine eigenen Antworten.
 *
 * DIE REGEL JETZT, ohne Ausnahme:
 *   · kein Aufrufer angegeben  → Systemausfuehrung. **Abwesenheit** ist das Signal, nicht ein Wort.
 *   · leere Zeichenkette       → dito; eine leere Kennung ist keine Kennung.
 *   · ein Aufrufervertrag      → wird uebernommen, wie er ist. Der Aufrufer sagt, was er ist.
 *   · irgendeine Kennung       → **immer** ein Nutzer, auch wenn sie `system` lautet.
 *
 * Es gibt in dieser Funktion keinen Vergleich gegen `SYSTEM_ACTOR` mehr — und es darf keinen
 * geben. Der Wächter dazu steht in `snapshot-ko-version-und-ref.test.ts` (JOB 541 D4).
 */
export function aufruferAus(actor: string | AskCaller | undefined): AskCaller {
  if (actor === undefined) {
    return { kind: "system" };
  }
  if (typeof actor !== "string") {
    return actor;
  }
  // Die Kennung wird UNVERAENDERT uebernommen; getrimmt wird nur fuer die Leerprüfung, damit ein
  // versehentliches Leerzeichen nicht zu einem Konto namens " " wird.
  return actor.trim().length === 0 ? { kind: "system" } : { kind: "user", userId: actor };
}

/** Die Beschriftung des Aufrufers fuer Protokoll, Beleg und Wissenslücke — nie fuer Eigentum. */
function aufruferBeschriftung(aufrufer: AskCaller): string {
  return aufrufer.kind === "system" ? SYSTEM_ACTOR : aufrufer.userId;
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
  /** W3-C1: der Beleg-Schreibweg. `undefined` heisst: dieser Aufbau schreibt keine Snapshots. */
  private readonly answerSnapshots: AnswerSnapshotRepo | undefined;
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
    this.answerSnapshots = deps.answerSnapshots;
  }

  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): serialisiert fn hinter der `helpfulChain` (ein Vorgänger-
  // Fehler blockiert den nächsten nicht — catch). So laufen die gekoppelten Danke-Transaktionen nie
  // echt nebenläufig gegen die Single-Writer-Audit-Kette.
  private serializeHelpful<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.helpfulChain.catch(() => undefined).then(fn);
    this.helpfulChain = run.catch(() => undefined);
    return run;
  }

  // JOB 531: relevanzbewusste, gedeckelte Kandidaten-Vorauswahl (Begründung an den Konstanten oben).
  //
  // Je Fragebegriff eine eigene Quellabfrage mit hartem Limit; die Vereinigung wird nach der Zahl
  // der abgedeckten Fragebegriffe geordnet (bei Gleichstand nach der besten Position, die die Quelle
  // dem Kandidaten gegeben hat) und erst dann auf das Gesamtlimit geschnitten. Damit entscheidet
  // über das Überleben im Deckel die Fragedeckung — nicht die Rangfolge der Datenquelle.
  //
  // Die Sicherheitsgrenzen bleiben unberührt: `validatedOnly` und `dropConfidential` greifen
  // unverändert NACH dieser Vorauswahl, ebenso die Endauswahl `selectCandidates` (Top-K).
  private async prefilterCandidates(terms: readonly string[]): Promise<KnowledgeObject[]> {
    const genutzteTerme = terms.slice(0, ASK_PREFILTER_MAX_TERMS);
    if (genutzteTerme.length === 0) {
      return [];
    }
    const trefferlisten = await Promise.all(
      genutzteTerme.map((term) =>
        this.koService.findCandidates({ terms: [term], limit: ASK_PREFILTER_TERM_LIMIT }),
      ),
    );
    const gesammelt = new Map<
      string,
      { ko: KnowledgeObject; termTreffer: number; besterRang: number }
    >();
    for (const liste of trefferlisten) {
      liste.forEach((kandidat, rang) => {
        const vorhanden = gesammelt.get(kandidat.id);
        if (vorhanden) {
          vorhanden.termTreffer += 1;
          vorhanden.besterRang = Math.min(vorhanden.besterRang, rang);
          return;
        }
        gesammelt.set(kandidat.id, { ko: kandidat, termTreffer: 1, besterRang: rang });
      });
    }
    return [...gesammelt.values()]
      .sort((a, b) => b.termTreffer - a.termTreffer || a.besterRang - b.besterRang)
      .slice(0, ASK_CANDIDATE_PREFILTER_LIMIT)
      .map((eintrag) => eintrag.ko);
  }

  // FR-ASK-01/02/03: begründete Antwort über den Reasoner; ehrliche Verweigerung → Wissenslücke.
  // FR-I18N-01: locale steuert die Antwortsprache des Reasoners (Quelleninhalt bleibt original).
  async ask(
    question: string,
    // JOB 541 D4: Die Vorgabe ist jetzt **Abwesenheit**, nicht die Zeichenkette `"system"`. Ein
    // Aufruf ohne Fragenden ist damit typisch als Systemausfuehrung erkennbar, statt an einem Wort
    // zu haengen. Beide Altformen bleiben zulaessig: eine blosse Kennung (alle bestehenden
    // Aufrufer) und der ausdrueckliche Vertrag `{ kind: … }`.
    actor?: string | AskCaller,
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
    // JOB 1591 D1 (W5): die FERTIGE Sichtbarkeitsentscheidung des Betrachters. Ausdruecklich ein
    // Filter und KEIN `includeUnvalidated`-Schalter — dieselbe Begruendung, die
    // `sichtbarkeitsfilterFuer` traegt: seit der Autor-Ausnahme kann ein Boolescher Wert
    // „vertrauliches, aber eigenes Objekt" nicht mehr ausdruecken, und ein Dienst, der ein Flag
    // bekaeme, muesste die Regel ein zweites Mal auslegen. UNGESETZT (Add-on-Pfad, Systemaufrufe,
    // jeder bestehende Aufrufer) → `ungeprueft` ist `null`, und der Ablauf ist Zeile fuer Zeile
    // der bisherige.
    opts?: {
      demoSeed?: boolean;
      validatedOnly?: boolean;
      gapPolicy?: "create" | "count_only";
      retrievalOnly?: boolean;
      // Der Rueckruf bekommt das ganze Objekt und entscheidet selbst, welche Felder seine Regel
      // braucht — heute `confidentiality` und `author`. Bewusst NICHT auf diese zwei Felder
      // eingeengt: eine engere Signatur wuerde `Sichtbarkeitsfilter` ausschliessen und die Route
      // zwingen, die Regel doch wieder selbst auszulegen.
      ungeprueftSichtbarFuer?: (ko: KnowledgeObject) => boolean;
      // JOB 2626 D1: die FERTIGE Sichtbarkeitsentscheidung fuer die Torlage-Meldung `verschlossen`
      // — gleiche Bauform, gleiche Begruendung wie `ungeprueftSichtbarFuer` (Zeilen darueber);
      // eigenes Feld, weil die beiden Meldungen unabhaengig angefragt werden (das Panel traegt
      // heute W5, die Konsole die Torlage) und ein geteilter Schalter beide aneinander kettete.
      verschlossenSichtbarFuer?: (ko: KnowledgeObject) => boolean;
      /**
       * JOB 3006 (KA5): die im Panel MARKIERTE PASSAGE — roh vom Aufrufer, ungedeutet.
       *
       * Sie ist ausdrücklich KEIN zweiter Fragetext und wird nirgends mit `question` vermischt.
       * Ihre einzige Wirkung steht in `sucheterme` (oben): sie ergänzt die Suchbegriffe der
       * Vorauswahl. Ohne das Feld ist der Ablauf Zeile für Zeile der bisherige.
       */
      selection?: string;
    },
  ): Promise<AskResult> {
    // JOB 541 D4: Die Absicht wird EINMAL aufgeloest, gleich hier — und danach getrennt gefuehrt:
    //   `aufrufer`  ist der Vertrag und die EINZIGE Quelle des Eigentums.
    //   `actorId`   ist die Beschriftung fuer Protokoll, Beleg und Wissensluecke.
    // Vorher war beides dieselbe Zeichenkette, und genau daraus entstand der Eigentumsfehler.
    const aufrufer = aufruferAus(actor);
    const actorId = aufruferBeschriftung(aufrufer);
    // SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: Ask nutzt NICHT mehr `koService.list()` (Laden des
    // gesamten Pools) als Kernpfad, sondern eine datenquellennahe, begrenzte Kandidaten-Vorauswahl
    // (`findCandidates`). Die Frage wird in Inhaltstoken zerlegt (identisch zum Ranking); ohne
    // Inhaltstoken (nur Stoppwörter) gibt es keine Kandidaten → ehrliche Wissenslücke. Das Repository
    // (InMemory/Pg) filtert ODER-weise über Titel/Aussage/Tags/Kategorie, gedeckelt auf den Prefilter-
    // Limit und mit validiert-/Trust-Bias, damit relevante validierte Treffer unter dem Limit bleiben.
    // JOB 531: die Vorauswahl läuft term-weise und relevanzbewusst (s. prefilterCandidates) —
    // gedeckelt wie bisher, aber unabhängig davon, wonach die Datenquelle ihre Treffer ordnet.
    // JOB 3006 (KA5): ZWEI MENGEN, ZWEI AUFGABEN — die Begründung steht an `erweiterteSuchterme`.
    //   `frageterme` ist unverändert das, was es vor KA5 war: wonach der Fragende gesucht hat.
    //               Jede Aussage ÜBER die Antwort rechnet weiter auf DIESER Menge.
    //   `suchterme`  ist dieselbe Menge, um die Terme der Markierung (und seit JOB 3021 um die
    //               deklarierten Entsprechungen) ergänzt — und sie hat GENAU EINEN Verbraucher,
    //               die Zeile darunter. Weiter reicht sie nicht.
    // JOB 3021 (N2): die deklarierte Wortzuordnung wirkt jetzt auch hier — und zwar GENAU auf
    // `suchterme`. Die Trennung von JOB 3006 bleibt damit unangetastet: `frageterme` ist weiterhin
    // nur das Getippte, und jede Aussage ÜBER die Antwort (Herkunft, Deckung, Wissenslücke, Beleg)
    // rechnet unverändert auf DIESER Menge — ein ergänztes Wort wird nie als das ausgegeben,
    // wonach gefragt wurde.
    //
    // DIE REIHENFOLGE IST ENTSCHIEDEN, nicht zufällig: erst die Frage, dann die Markierung, dann
    // die ergänzten Terme. Der Grund ist derselbe, aus dem `expandSearchTerms` seine Zusätze
    // hinten anhängt — `prefilterCandidates` schneidet auf `ASK_PREFILTER_MAX_TERMS`, und unter
    // einem Deckel darf niemals eine ECHTE Eingabe zugunsten einer abgeleiteten fallen. Die
    // markierte Passage IST echte Eingabe (ein Mensch hat sie markiert), die Entsprechung ist es
    // nicht; deshalb steht die Markierung davor und nicht dahinter. Die beiden verdrängen einander
    // nicht: die Markierung ist auf `SELECTION_TERM_LIMIT` gedeckelt, die Erweiterung ergänzt nur
    // und kürzt nie.
    // DIE GEMESSENE KEHRSEITE, benannt statt verschwiegen: füllen Frage und Markierung das Fenster
    // von acht Termen bereits, wird KEIN ergänzter Term mehr ABGEFRAGT — dieselbe Lastgrenze und
    // derselbe Preis, den KA5-R8b für die Markierung schon ausspricht (JOB 3039 R2 hat den Fall
    // nachgemessen: Fall D1).
    // JOB 3039 (N2, Scheibe 2): `suchterme` hat weiterhin GENAU EINEN Verbraucher, die Zeile
    // darunter — der Versuch, dieselbe Menge auch dem Relevanztor zu geben, ist gemessen
    // zurückgenommen worden (Begründung im Grenzblock an `zugeordneteSuchterme`).
    const frageterme = queryTokens(question);
    const eingabeterme = erweiterteSuchterme(frageterme, opts?.selection);
    const suchterme = [...eingabeterme, ...zugeordneteSuchterme(eingabeterme)];
    const prefilteredRaw = await this.prefilterCandidates(suchterme);
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
    // JOB 1591 D1 (W5): WAS DIE ENGE VERSCHLUCKT HAT — gemeldet, nicht verwendet.
    //
    // Die Menge entsteht aus DERSELBEN `prefilteredRaw`, aus der auch die Antwort entsteht; sie
    // wird nirgends zusaetzlich erhoben, es gibt keine zweite Abfrage und keinen zweiten Weg.
    // DREI Filter, in dieser Reihenfolge, jeder mit eigenem Grund:
    //   · `dropConfidential` — dieselbe harte Linie wie eine Zeile tiefer. Vertrauliches verlaesst
    //     diesen Dienst nicht, auch nicht als blosser Titel. Das ist ENGER als das, was der
    //     Betrachter sehen duerfte (`darfSehen` laesst dem Autor sein eigenes vertrauliches
    //     Objekt); die Enge ist Absicht, weil das Panel derselbe Kanal ist, fuer den bens Fix 1
    //     die Linie gezogen hat. Wer sie lockern will, entscheidet — er baut nicht nach.
    //   · `status !== "validiert"` — genau die Kandidaten, die `validatedOnly` verworfen hat.
    //     Ohne `validatedOnly` ist die Menge leer, denn dann wurde nichts wegen des Pruefstands
    //     verworfen: es gibt nichts zu melden, was nicht ohnehin Grundlage sein durfte.
    //   · der Betrachterfilter — die Antwort auf mega77s Grund 1.
    // JOB 1591 D2: Das Feld entsteht als ganzes oder gar nicht — s. Grabstein am Vertrag oben.
    const ungeprueftFeld: { ungeprueft?: UngeprueftHinweis[] } = opts?.ungeprueftSichtbarFuer
      ? {
          ungeprueft: dropConfidential(prefilteredRaw)
            .filter((ko) => ko.status !== "validiert")
            .filter((ko) => opts.ungeprueftSichtbarFuer?.(ko) ?? false)
            .map((ko) => ({ id: ko.id, title: ko.title, status: ko.status })),
        }
      : {};
    const refs: KnowledgeRef[] = await Promise.all(
      prefiltered.map(async (ko) => {
        // JOB 2614 D3 (G27-Anschluss, JOB 1565 Weg A): der DOKUMENTTEXT reist in die Refs — aus der
        // Suchprojektion, die ihn kanonisch extrahiert und geschnitten hat (`bodyText`,
        // search-projection.ts:637). Kein zweiter Scanner, kein bodyHtml-Vollload, KEINE neue
        // Grenze am Aufrufer (1565 §11: „B ohne Messung wäre der Fehler von G27 zum zweiten Mal").
        // Ohne dieses Feld überlebte ein Nur-Fliesstext-Treffer zwar den Kandidatenweg, fiel aber
        // am Relevanztor (`refMatchText`) — Pedis „Keine belastbare Grundlage" trotz gefülltem
        // `body_text`. Sichtbarkeitsregeln unverändert: dropConfidential/validatedOnly liefen
        // bereits davor, und die Projektion einer hier noch enthaltenen Quelle ist dieselbe
        // Wahrheit, die auch der Kandidatenweg (`findCandidates`) gelesen hat.
        const projektion = await this.koService.searchProjectionOf(ko.id);
        return {
          id: ko.id,
          title: ko.title,
          statement: ko.statement,
          status: ko.status,
          trust: ko.trust,
          // WP-RETEST7 R5 (Pedis Befund): die persistierten Bild-Fußnoten reisen in den Match-/
          // Kontextpfad mit (captionTexts-Suchfeld — kein bodyHtml-Vollload, kein neuer Scanner).
          ...(ko.captionTexts?.length ? { captionTexts: ko.captionTexts } : {}),
          ...(projektion?.bodyText.trim() ? { bodyText: projektion.bodyText } : {}),
        };
      }),
    );
    // SCRUM-360: präzise, status-/trust-bewusste Top-K-Auswahl auf der vorgefilterten Menge (Relevanz-
    // Gate dominiert, validierte/ready bevorzugt). Idempotent zur Vorauswahl: Top-K der vorgefilterten
    // Menge = Top-K, da jeder relevante KO (Token-Überschneidung) bereits im Prefilter enthalten ist.
    // JOB 3039 (N2, Scheibe 2), GEMESSEN UND ZURÜCKGENOMMEN: Runde 1 hat hier die Frage UM die
    // deklarierten Entsprechungen ERWEITERT übergeben. Das ist zurückgebaut, und zwar nicht aus
    // Vorsicht, sondern aus zwei Messungen: der Reasoner wählt dahinter ein ZWEITES Mal auf der
    // rohen Frage aus und verwirft das Objekt erneut (die Weitung hatte keinerlei Nutzerwirkung,
    // `answered` blieb `false`), und sie SCHADET, weil Objekte, die allein über die Entsprechung
    // hereinkommen, den Deckel `DEFAULT_TOP_K` füllen und den tragenden Treffer verdrängen können.
    // Die vollständige Begründung mit beiden Fundstellen steht im Grenzblock an
    // `zugeordneteSuchterme`; die Zahlen stehen in `tests/suche-zuordnung/…` (Z1, Z2, W1, W2).
    const candidates = selectCandidates(question, refs, DEFAULT_TOP_K);
    // SCRUM-490 R2 (B1): Add-on-Pfad → RETRIEVAL-ONLY (kein Modell-/Embedder-Egress des Dokumenttexts).
    // Sonst der übliche Reasoner-Weg (Session-Pfad unverändert).
    // AUFTRAG-mega61 BLOCK G — DAS ZWEITE NETZ, AUS DEM KONTEXT ABGELEITET.
    //
    // Bis mega60 übergab dieser Aufruf die Vertraulichkeit NICHT; der Reasoner nahm sie als `false`
    // an, und damit war der Egress-Wächter am Engpass auf dem Antwortweg wirkungslos (Begründung
    // ausführlich in reasoner/src/service.ts an `answer`). Die Ableitung geschieht bewusst auf
    // `prefiltered`, also NACH `dropConfidential` — auf dem, was WIRKLICH hinausgeht:
    //   · Heute ist der Wert damit immer `false`. Es ändert sich kein Verhalten, keine Antwort
    //     wird schlechter, keine Cloud-Kante fällt grundlos weg.
    //   · Ließe ein künftiger Umbau ein vertrauliches Objekt bis hierher durch, wird er `true` —
    //     die Cloud fällt aus der Providerkette UND `ConfidentialEgressError` schlägt an.
    // Auf `prefilteredRaw` abzuleiten wäre falsch: dann würde eine Frage, die zufällig ein
    // vertrauliches Objekt streift, ihre Antwort verlieren, obwohl das Objekt längst entfernt ist.
    const kontextVertraulich = prefiltered.some((ko) => isConfidential(ko.confidentiality));
    const rawResult = opts?.retrievalOnly
      ? await this.reasoner.answerRetrievalOnly(question, candidates, locale)
      : await this.reasoner.answer(question, candidates, locale, kontextVertraulich, {
          // mega61 Block G: der Handelnde am Protokolleintrag. Kein Gegenstand — bei einer Antwort
          // ist er eine Trefferliste und kein einzelnes Objekt (dieselbe Begründung, die in
          // reasoner-routes.ts schon steht).
          actor: actorId,
        });
    // SCRUM-490 R2 (A2): Quellenpflicht — ein „Treffer" ohne echte Quelle ist KEIN belegter Treffer.
    // answered=true mit leeren sources → als ehrliche Leer-Antwort behandeln (nie eine Quelle vortäuschen).
    // mega52 A3: wird der Treffer hier zur ehrlichen Leer-Antwort herabgestuft, fällt auch die
    // Zuordnung weg — eine tragende Quelle ohne Antwort gibt es nicht.
    const resultCore =
      rawResult.answered && rawResult.sources.length === 0
        ? { ...rawResult, answered: false, answer: null, citedSources: [] }
        : rawResult;
    // WP-RETEST7 R5: Fundstellen-Kennzeichnung — eine Quelle, deren Frage-Treffer AUSSCHLIESSLICH
    // aus den Bild-Fußnoten stammt (kein Term in Titel/Aussage), wird als Caption-Fund markiert;
    // die UI zeigt dazu das Bibliotheks-Badge „Bildbeschreibung".
    //
    // JOB 3006 (KA5): GERECHNET WIRD AUF `frageterme`, NIE AUF `suchterme`. Das ist eine Aussage
    // über die HERKUNFT des Frage-Treffers — der Satz oben sagt es selbst: „deren FRAGE-Treffer".
    // Nähme man hier die um die Markierung erweiterte Menge, bekäme ein Objekt, das die Frage über
    // seinen Fließtext gefunden hat, das Etikett „Bildbeschreibung", nur weil ein Wort der
    // markierten Passage zufällig in seiner Fußnote steht. Dieselbe Antwort, dieselbe Quelle, eine
    // erfundene Fundstelle. Der Wächter dagegen ist `tests/ka5/markierung-fundstelle-bleibt.test.ts`.
    const captionSources = resultCore.sources.filter((id) => {
      const ko = prefiltered.find((k) => k.id === id);
      if (!ko || !ko.captionTexts?.length) {
        return false;
      }
      const core = `${ko.title} ${ko.statement}`.toLowerCase();
      const captions = ko.captionTexts.join(" ").toLowerCase();
      return (
        frageterme.some((term) => captions.includes(term)) &&
        !frageterme.some((t) => core.includes(t))
      );
    });
    const result = { ...resultCore, captionSources };
    // JOB 2626 D1 — DIE TORLAGE, wenn es keine Antwort gab (Vertrag und Grenzen am Feld
    // `AskResult.verschlossen`). Gerechnet wird auf `dropConfidential(prefilteredRaw)` — derselbe
    // Schnitt wie bei `ungeprueft` eine Seite weiter oben: NIE ueber Vertrauliches, NUR was der
    // Betrachter sehen darf. Der Volltext-Blick nutzt DIESELBE Suchprojektion, die auch der
    // Refs-Bau liest (JOB 2614 D3) — kein zweiter Scanner, keine zweite Wahrheit.
    const verschlossenSicht = opts?.verschlossenSichtbarFuer;
    const verschlossenFeld: { verschlossen?: VerschlossenHinweis[] } =
      verschlossenSicht && !result.answered
        ? {
            verschlossen: (
              await Promise.all(
                dropConfidential(prefilteredRaw)
                  .filter((ko) => verschlossenSicht(ko))
                  .map(async (ko) => {
                    const projektion = await this.koService.searchProjectionOf(ko.id);
                    return {
                      id: ko.id,
                      title: ko.title,
                      status: ko.status,
                      freigabeFehlt: ko.status !== "validiert",
                      stufeFehlt: ko.confidentiality === null || ko.confidentiality === undefined,
                      volltextFehlt: !projektion?.bodyText.trim(),
                    };
                  }),
              )
            ).filter((h) => h.freigabeFehlt || h.stufeFehlt || h.volltextFehlt),
          }
        : {};
    // FUNKE-FIX P0 (bens ROT-1): opaker Answer-Receipt über (Nutzer + ausgelieferte Quell-KOs) —
    // die serverseitige Grundlage für ein NICHT fälschbares „Danke".
    //
    // AUFTRAG-mega52 A4 — DER BELEG BINDET NUR NOCH DIE TRAGENDEN QUELLEN.
    //
    // Vorher band er `result.sources`, also ALLE bis zu acht herangezogenen Kandidaten. Folge, die
    // bis mega52 niemand benannt hatte: drückt jemand „Hat geholfen", bekommt JEDES bloß angesehene
    // Objekt ein Vertrauensplus (+2, HELPFUL_TRUST_STEP). Das ist eine stille Verfälschung genau
    // der Zahl, auf die sich das ganze Produkt beruft — Trust wächst dann durch Nachbarschaft im
    // Ranking statt durch Bewährung.
    //
    // Ist `citedSources` leer (A5: das Modell lieferte keine oder unbrauchbare Marken), ist der
    // Beleg leer und ein „Danke" scheitert ehrlich mit 403. Das ist gewollt: wer nicht weiß, welche
    // Quelle getragen hat, darf keiner ein Vertrauensplus zuschreiben. Die Oberfläche bietet den
    // Knopf dann gar nicht erst an (Ask.tsx) — der 403 ist die serverseitige Rückfallebene.
    const receipt = signAnswerReceipt(this.receiptSecret, actorId, result.citedSources, this.now());
    // W3-C1 (Auftrag 76): der Beleg entsteht GENAU HIER — nach der Antwort, aus derselben
    // Ausfuehrung, vor jeder Verzweigung. So traegt jeder der drei Rueckgabewege dieselbe
    // Identitaet, und keiner kann sie stillschweigend verlieren.
    const answerId = await this.schreibeAntwortbeleg(result, prefiltered, aufrufer);
    // FR-ANA-02 / SCRUM-361: Telemetrie nachvollziehbar + ehrlich — Prefilter-/Kandidatengröße,
    // Top-K und der Retrieval-Modus (kein Inhaltstext, keine Frage im Audit).
    await this.audit?.record({
      actor: actorId,
      action: "ask.query",
      target: result.sources[0] ?? "-",
      payload: {
        answered: result.answered,
        retrievalMode: "prefilter",
        prefilterCount: prefiltered.length,
        candidateCount: candidates.length,
        topK: DEFAULT_TOP_K,
        // JOB 531: die Vorauswahl ist term-weise gedeckelt — beide Grenzen sind auditierbar, damit
        // die Last je Frage (Abfragezahl × Abfragelimit) belegt ist und nicht geschätzt werden muss.
        // JOB 3006 (KA5): HIER steht bewusst `suchterme` und nicht `frageterme` — und das ist keine
        // Ausnahme von der Trennungsregel, sondern ihre Anwendung. Dieses Feld ist keine Aussage
        // über die Antwort, sondern die LASTZAHL der Vorauswahl: wie viele Quellabfragen wirklich
        // gelaufen sind. Stünde hier die Frage-Menge, meldete das Protokoll bei jeder Markierung
        // WENIGER Abfragen, als der Server ausgeführt hat — eine Untertreibung genau der Zahl,
        // wegen der JOB 531 dieses Feld eingeführt hat. Es ist eine Anzahl, kein Inhalt: die
        // Passage steht damit weiterhin in keinem Auditeintrag (Beleg KA5-R3 (d)).
        prefilterQueries: Math.min(suchterme.length, ASK_PREFILTER_MAX_TERMS),
        prefilterTermLimit: ASK_PREFILTER_TERM_LIMIT,
      },
    });
    // AUFTRAG-mega77 BLOCK A: hier wurde `ungeprueftUnterdrueckt` berechnet. Die Berechnung ist
    // ERSATZLOS entfernt — Begründung am Feld-Grabstein in `AskResult` oben. Kurz: sie lief ohne
    // Betrachterfilter (Leck ab n = 1, Orakel bei enger Wiederholung) und zählte die gedeckelte
    // Vorauswahl statt des Bestands (die Zusage „0 heißt wirklich nichts" war nicht gedeckt).
    if (!result.answered) {
      // SCRUM-490 D1: "count_only" (addon-Pfad) legt KEINE Wissenslücke an — kein Gap-Record, kein
      // gespeicherter Fragetext, kein gap.created-Audit, kein gap im Response. Die aggregierte Zählung
      // liefert das oben emittierte metadata-only ask.query-Audit (trägt Actor + answered=false, keinen
      // Text). Ohne die Option bleibt der Pfad byte-identisch: Gap anlegen.
      if (opts?.gapPolicy === "count_only") {
        return { result, answerId, gap: null, receipt, ...ungeprueftFeld, ...verschlossenFeld };
      }
      // GAP-SPRACHHERKUNFT: `locale` steuert schon die Antwortsprache des Reasoners und liegt hier
      // ohnehin vor — es ging bisher nur verloren. Mitgegeben, damit die Oberfläche einen
      // fremdsprachigen Lückentitel erklären kann, statt ihn wie einen Fehler aussehen zu lassen.
      const gap = await this.createGap(question, actorId, opts?.demoSeed, locale);
      return { result, answerId, gap, receipt, ...ungeprueftFeld, ...verschlossenFeld };
    }
    return { result, answerId, gap: null, receipt, ...ungeprueftFeld, ...verschlossenFeld };
  }

  /**
   * ============================================================================================
   * W3-C1 (Auftrag 76) — DER BELEG DIESER ANTWORT, EINMAL UND UNVERAENDERLICH.
   * ============================================================================================
   *
   * WAS HIER GESCHIEHT: aus dem, was die Antwort GETRAGEN hat, entsteht Revision 1 eines
   * unveraenderlichen Schnappschusses. Nicht mehr.
   *
   * WAS HIER AUSDRUECKLICH NICHT GESCHIEHT: keine Neusuche, kein zweiter Reasoner-Lauf, keine
   * Client-Evidence, kein Nachschlagen einer Validierungsentscheidung. Der Schreibweg liest
   * NICHTS — er schreibt nur nieder, was der Antwortlauf ohnehin schon in der Hand hat.
   *
   * DIE DREI LEEREN FELDER SIND DER EHRLICHE TEIL. `resolutionId` bleibt leer, weil der
   * Antwortweg W1 nicht beruehrt; `sourceRecordId`, weil niemand Quellrevisionen schreibt; und
   * `validationDecisionRef`, weil es zwischen Bewertung und Antwort keinen Traeger gibt
   * (Prewrite 72 §2). Jedes davon traegt seinen maschinenlesbaren Grund — ein leeres Feld ohne
   * Grund waere ein Schweigen, das wie eine Aussage aussieht.
   *
   * FEHLER HIER DUERFEN DIE ANTWORT NICHT VERSCHLUCKEN: der Beleg ist eine Zugabe, keine
   * Vorbedingung. Schlaegt das Schreiben fehl, bekommt der Fragende trotzdem seine Antwort —
   * und die fehlende Kennung sagt ehrlich, dass kein Beleg entstand.
   */
  private async schreibeAntwortbeleg(
    result: AnswerResult & { captionSources: string[] },
    herangezogen: readonly KnowledgeObject[],
    // JOB 541 D4: Hier kam bis D3 eine Zeichenkette an, und der Schreibweg entschied SELBST, ob sie
    // ein Konto meint. Jetzt kommt die Entscheidung fertig an — der Schreibweg trifft sie nicht mehr.
    aufrufer: AskCaller,
  ): Promise<string | null> {
    const repo = this.answerSnapshots;
    if (!repo) {
      return null;
    }
    const answerId = this.genId();
    const jetzt = new Date(this.now()).toISOString();
    // ============================================================================================
    // JOB 541 D3 — DIE FASSUNG UND DIE ENTSCHEIDUNG WERDEN GEBUNDEN, NICHT GESUCHT.
    // ============================================================================================
    //
    // `herangezogen` sind die Objekte, die dieser Antwortlauf WIRKLICH in der Hand hatte
    // (`prefiltered`, nach Vertraulichkeits- und Validiert-Filter). Ihre `version` ist die Fassung
    // zum Ausfuehrungszeitpunkt, und ihr `validationDecisionRef` ist die Entscheidung, die zu
    // diesem Zeitpunkt am Objekt stand.
    //
    // DAS IST KEINE NEUSUCHE — und der Unterschied ist der ganze Punkt von KW-W3-18. Eine Neusuche
    // waere ein zweiter Blick in den Bestand, der etwas ANDERES finden koennte als der Antwortlauf.
    // Hier wird nur aufgeschrieben, was der Lauf ohnehin schon hielt. Deshalb kommen die Werte aus
    // dem uebergebenen Feld und nicht aus `this.koService`.
    //
    // FEHLT ein Objekt in der Liste (etwa weil der Reasoner eine Quelle nennt, die nicht unter den
    // Kandidaten war), bleibt die Fassung ehrlich `null`. Erfunden wird sie nicht.
    const nachId = new Map(herangezogen.map((ko) => [ko.id, ko]));
    const evidence: AnswerEvidenceRef[] = result.sources.map((koId) => {
      const ko = nachId.get(koId);
      const tragend = result.citedSources.includes(koId);
      const entscheidung = ko?.validationDecisionRef;
      return {
        knowledgeObjectId: koId,
        knowledgeObjectVersion: ko?.version ?? null,
        evidenceRole: tragend ? "carrying" : "consulted",
        sourceRecordId: null,
        sourceRecordIdReason: "w2a_not_wired",
        locator: null,
        locatorReason: "no_locator_from_import",
        // KW-W3-23 §2: GENAU EINES von beidem. Traegt das Objekt eine Entscheidung, steht sie hier;
        // sonst der Grund, warum nicht — und der haengt an der ROLLE: eine tragende Quelle SOLL
        // eine Entscheidung haben (`NOT_AVAILABLE_AT_EXECUTION` ist dann eine echte Luecke), eine
        // bloss herangezogene muss keine haben (`NOT_REQUIRED`).
        ...(entscheidung !== undefined
          ? { validationDecisionRef: entscheidung }
          : {
              validationReferenceAbsenceReason: tragend
                ? ("NOT_AVAILABLE_AT_EXECUTION" as const)
                : ("NOT_REQUIRED" as const),
            }),
      };
    });
    const roh: AnswerEvidenceSnapshot = {
      answerId,
      snapshotRevision: 1,
      supersedesSnapshotRevision: null,
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      capturedAt: jetzt,
      citedSources: [...result.citedSources],
      evidence,
      resolutionId: null,
      resolutionIdReason: "w1_not_on_answer_path",
      // KW-W3-23 §3: der obere Ort wird von NEUEN Snapshots nicht mehr beschrieben. Der Grund sagt
      // das ausdruecklich — und ersetzt `w3c_no_decision_carrier`, das seit dem KO-Traeger nicht
      // mehr stimmt.
      validationDecisionRef: null,
      validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
      status: "PENDING_EVIDENCE",
      integrityHash: "",
    };
    const mitStatus: AnswerEvidenceSnapshot = { ...roh, status: answerSnapshotStatus(roh) };
    const snapshot: AnswerEvidenceSnapshot = {
      ...mitStatus,
      integrityHash: hashAnswerSnapshot(mitStatus),
    };
    // ============================================================================================
    // AUFTRAG 89 (BEN 82, Befund 1) — HIER STAND DIE ZUSAGE OBEN UND NICHTS, DAS SIE EINLOEST.
    // ============================================================================================
    //
    // Der Kommentar dieser Methode versprach seit Auftrag 76, ein Fehler beim Belegschreiben duerfe
    // die bereits erzeugte Antwort nicht verschlucken. Die Laufzeit hielt das NICHT: beide Aufrufe
    // lagen in keinem Fangzweig, und ein Ausfall der Ablage erreichte den Fragenden als Ausnahme.
    // BEN hat beide Faelle einzeln injiziert; beide endeten ohne Antwort. Eine Zusage im Quelltext,
    // die die Laufzeit nicht haelt, ist schlimmer als gar keine — sie beruhigt den naechsten Leser.
    //
    // GEFANGEN WIRD GENAU DAS I/O, NICHT MEHR. Der Fangzweig umschliesst die zwei Schreibaufrufe
    // und nicht den Aufbau des Snapshots darueber: dessen Hashen und Statusableiten ist reine
    // Rechnung. Wuerde SIE werfen, waere das ein Programmfehler — und den zu verschlucken hiesse,
    // einen Defekt als „kein Beleg" zu tarnen.
    //
    // DREI PREISE, BENANNT STATT WEGGEREDET:
    //  (1) Ein Kettenbruch aus Freeze 59 (`pruefeSnapshotKette`) faellt hier ebenfalls in den
    //      Fangzweig und erscheint als „kein Beleg" statt als Fehler. Fuer Revision 1 auf einer
    //      frischen `answerId` ist er praktisch ausgeschlossen — ausgeschlossen ist er nicht.
    //  (2) `AskServiceDeps` kennt keine Protokollsenke. Ein Ausfall ist damit ununterscheidbar von
    //      „kein Repo verdrahtet"; fuer den Aufrufer ist beides dieselbe Auskunft („nichts
    //      persistiert"), fuer den Betrieb waere ein anhaltender Ausfall still. Ein
    //      unterscheidbares Signal waere eine ENTSCHEIDUNG und gehoert nicht in diese Korrektur.
    //  (3) Faellt `appendSnapshot` NACH erfolgreichem `createRecord` aus, bleibt ein Record ohne
    //      Snapshot zurueck. Aufraeumen ist ausgeschlossen (append-only); der spaetere Lesepfad
    //      muss diesen Zustand vertragen.
    try {
      await repo.createRecord({
        answerId,
        askExecutionId: this.genId(),
        createdAt: jetzt,
        schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
        // ========================================================================================
        // JOB 541 D4 — DAS EIGENTUM WIRD HIER NUR NOCH ABGESCHRIEBEN, NICHT MEHR ENTSCHIEDEN.
        // ========================================================================================
        //
        // HIER STAND BIS D3 `actor === undefined || istSystemActor(actor)`. Der Vergleich las die
        // Zeichenkette `"system"` als Systemkontext — und BEN hat den Preis dafuer als Datenfehler
        // beurteilt: ein echtes Konto mit der Kennung `system` verlor seine eigenen Antworten
        // (404 auf die eigene Erklaerung).
        //
        // D3 hielt diesen Preis fuer noetig, weil sonst „ein Konto namens `system` jede
        // Systemantwort lesen koennte". Das trifft nicht zu, und der Grund steht in types.ts:
        // `AnswerOwner` ist ein VERBUND. Eine Systemantwort hat kein Feld, in dem eine
        // Nutzerkennung stehen koennte — `gehoertNutzer` verlangt `kind === "user"` und kann bei
        // ihr nie zutreffen. Der Verbund schuetzt bereits; der Stringvergleich davor hat die
        // Kennung nur weggeworfen, ehe der Schutz greifen konnte.
        //
        // Der Aufrufer sagt jetzt, was er ist (`aufruferAus`, oben). Diese Stelle entscheidet
        // nichts mehr — sie schreibt nieder.
        owner: aufrufer,
      });
      await repo.appendSnapshot(snapshot);
    } catch {
      return null;
    }
    return answerId;
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

  private async createGap(
    question: string,
    createdBy: string,
    demoSeed?: boolean,
    locale?: ReasonerLocale,
  ): Promise<Gap> {
    // JOB 1111 / D-032: der Vergleichsschlüssel entsteht HIER, aus demselben Text, der gespeichert
    // wird — nicht aus dem Rohtext. So können Text und Schlüssel niemals auseinanderlaufen.
    const compareKey = gapCompareKey(question);
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
      // GAP-SPRACHHERKUNFT: immer setzen, wenn bekannt — auch "de". Ein fehlendes Feld wäre sonst
      // mehrdeutig (Altbestand oder deutsche Lücke?), und genau daran scheitern Migrationen.
      ...(locale ? { locale } : {}),
      // Ein LEERER Schlüssel ist kein Schlüssel: eine Frage ganz ohne Buchstaben („???") darf
      // nicht mit jeder anderen solchen Frage über eine gemeinsame Leere zusammenfallen. Dann
      // wird das Feld weggelassen und die Lücke ist wie ein Altbestand nicht dedupfähig.
      ...(compareKey ? { compareKey, askCount: 1 } : {}),
    };
    // ============================================================================================
    // JOB 1111 / D-032 — HIER ENTSCHEIDET SICH: NEUE LÜCKE ODER EINE WEITERE STIMME.
    // ============================================================================================
    // Die Unteilbarkeit liegt in der Ablage (`insertOrIncrement`), nicht hier — ein Suchen im
    // Dienst mit anschliessendem Einfügen verlöre jedes Rennen zweier gleichzeitiger Fragen.
    // Eine Ablage ohne diesen Weg führt nicht zusammen und legt wie bisher an. Das betrifft keine
    // Betriebsablage, sondern nur speicherlose Testattrappen (Begründung am Interface in `repo.ts`).
    const { gap: gespeichert, created } = this.gaps.insertOrIncrement
      ? await this.gaps.insertOrIncrement(gap)
      : await this.gaps.insert(gap).then(() => ({ gap, created: true }));
    if (created) {
      await this.audit?.record({ actor: "system", action: "gap.created", target: gespeichert.id });
    }
    // BEWUSST KEIN Audit-Eintrag bei der Wiederholung: es wurde keine Lücke angelegt, und
    // `gap.created` für einen nicht angelegten Datensatz wäre eine falsche Auskunft. Ein eigener
    // Vorgang (`gap.repeated`) bräuchte eine Beschriftung in `apps/web/src/i18n.ts`; diese Datei
    // liegt nicht in der Lease dieses Auftrags. Als kleiner Folgeschritt in der Rückgabe benannt.
    return gespeichert;
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
