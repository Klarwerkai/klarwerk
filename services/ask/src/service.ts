import { randomBytes, randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import {
  type Fragekontext,
  type GelernteHalbwertszeiten,
  type GeltungsPassung,
  type KnowledgeObject,
  type KnowledgeType,
  type KoGeltung,
  type KoService,
  SUCH_ZUORDNUNGEN,
  type SuchZuordnung,
  type WithTx,
  buildSearchProjection,
  dropConfidential,
  erkenneSchutzdaten,
  expandSearchTerms,
  geltungFuerFrage,
  haltbarkeitAbgelaufen,
  inSchutzdatenQuarantaene,
  isConfidential,
  normalizeSearchTerms,
  responsibleKindOf,
  responsibleOf,
  visibleTextFromBodyHtml,
} from "../../knowledge-object";
import {
  type AnswerResult,
  DEFAULT_TOP_K,
  KiAbgeschaltetFehler,
  type KnowledgeRef,
  type Reasoner,
  type ReasonerLocale,
  type Relevanztext,
  type ZuordnungsPaar,
  type ZweitmeinungErgebnis,
  decktAlleFragebegriffe,
  queryTokens,
  waehleKandidaten,
} from "../../reasoner";
import { TRUST_MAX } from "../../validation";
import { type AnsprechpartnerAuskunft, leiteAnsprechpartnerAb } from "./ansprechpartner";
import {
  ANTWORT_MELDUNG_ACTION,
  type AntwortMeldungQuittung,
  antwortMeldungEventId,
  antwortMeldungId,
  isAntwortMeldeGrund,
} from "./antwort-meldung";
import {
  type ZuschnittAbschnitt,
  type ZuschnittBegriff,
  type ZuschnittDerAntwort,
  type ZuschnittErgaenzung,
  schneideAntwortZu,
} from "./antwort-zuschnitt";
import { leiteBelegbedarfAb } from "./gap-belegbedarf";
import { gapCompareKey, normalizeGapQuestion } from "./gap-text";
import { type GapSummary, summarizeGaps } from "./gap-visibility";
import {
  type FachlicheNutzbarkeit,
  GapAbschlussVerweigert,
  type GapPruefstand,
  type GapVorgangEintrag,
  type GapVorgangSicht,
  type GapVorgangsrolle,
  abschlussMeldungId,
  abschlussSicht,
  fragendeVon,
  istFragender,
  istZustaendig,
  naechsterSchritt,
  pruefeFachlicheNutzbarkeit,
  rueckfrageMeldungId,
  rueckfrageText,
  vorgangEintrag,
  vorgangsphase,
} from "./gap-vorgang";
import { signAnswerReceipt, verifyAnswerReceipt } from "./receipt";
import { type AnswerSnapshotRepo, type GapRepo, gleicherLueckenstand } from "./repo";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  type AskCaller,
  AskError,
  type Gap,
  type GapBelegbedarf,
  type GapPriority,
  type GapRueckfrage,
  type GapRuecknahmeGrund,
  type GapZuordnung,
  answerSnapshotStatus,
  hashAnswerSnapshot,
  isGapPriority,
  isGapRuecknahmeGrund,
} from "./types";
import {
  type VergleichsSeiten,
  type WissensstandVergleich,
  antwortGeaendert,
  fassungZumStichtag,
  freigabeZumStichtagBelegt,
  grundlageDamals,
  vergleichsQuelle,
} from "./wissensstand-vergleich";

const HELPFUL_TRUST_STEP = 2;

/**
 * produkt:20261010:wissenskreislauf-schliessen: wie oft ein Vorgangsschritt am frischen Stand neu
 * gerechnet wird, wenn die Lücke währenddessen geändert wurde (`aendereLuecke`). Danach 409.
 */
const LUECKE_SCHREIBVERSUCHE = 8;

/**
 * R-0142: wie viele offene Lücken `offeneLueckenZu` je Aufruf höchstens prüft (die jüngsten). Jede
 * geprüfte Lücke kostet eine Vorauswahl (bis zu `ASK_PREFILTER_MAX_TERMS` Abfragen); der Deckel hält
 * die Admin-Auskunft auf einer Wissensseite bezahlbar und wird in der Antwort ausgewiesen.
 */
const OFFENE_LUECKEN_BEZUG_DECKEL = 50;
// SCRUM-361 / AG-03 / NFR-PERF-03: Obergrenze der datenquellennahen Kandidaten-Vorauswahl. Bewusst
// deutlich größer als DEFAULT_TOP_K (8): das Repository liefert eine großzügige, vorgefilterte Menge,
// die finale, präzise Status-/Trust-/Relevanz-Sortierung + Top-K macht der Reasoner (selectCandidates).
const ASK_CANDIDATE_PREFILTER_LIMIT = 200;

// ================================================================================================
// JOB 531 — DIE VORAUSWAHL DARF SICH NICHT AUF DIE RANGFOLGE DER DATENQUELLE VERLASSEN.
// ================================================================================================
//
// DER HISTORISCHE BEFUND (JOB 531). Die Deckelung der Vorauswahl war richtig, ihre Annahme
// war es nicht: sie setzte voraus, dass jede Quelle RELEVANZ-bewusst deckelt. Damals sortierte
// PgKoRepo nur nach validiert/Trust. Bei wachsendem Bestand verdrängten schwach relevante,
// validierte Objekte mit hohem Trust den passenden Treffer — anders als im Speicherbestand.
// Diese frühere Abweichung begründete den adapterunabhängigen Weg unten.
// HEUTE haben beide Adapter dieselbe Rangfolge vor dem Limit:
//   · InMemoryKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und schneidet danach,
//   · PgKoRepo sortiert (Term-Trefferzahl ↓, validiert ↓, Trust ↓) und deckelt in der Abfrage.
// Beleg: services/knowledge-object/src/repo-pg.ts, JOB 3583. Die Härtung gegen schwächere
// Quellen bleibt sinnvoll; sie setzt diese heutige Übereinstimmung nicht voraus.
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
// R-0348 — GESPRÄCHSFADEN STATT EINZELFRAGEN, INNERHALB DER AUFGABENGEBUNDENEN FRAGESTRECKE.
// ================================================================================================
//
// WAS HIER GESCHIEHT: Eine Nachfrage („Und bei Teilzeit?") bringt die vorangegangenen Fragen
// derselben Fragestrecke mit. Aus beiden entsteht die FRAGE IM ZUSAMMENHANG — sie geht an die
// Kandidatenwahl (Tor 1 und Tor 2) und an den Antwortweg, damit die Nachfrage nicht bei null
// anfängt. Vorher war jede Frage ein Einzelschuss: eine Nachfrage mit einem Inhaltswort erreichte
// `MIN_ANSWER_SUBSTANCE` nie und endete als Wissenslücke.
//
// WAS AUSDRÜCKLICH BLEIBT (R-0345, kein offener Chatbot):
//   · Die Antwort bleibt quellengebunden; der Faden schafft keine Grundlage, er findet sie nur.
//   · GEBUNDEN werden die getippte Frage UND der Themenanker (`decktAlleFragebegriffe` für beide):
//     jede Quelle muss alle Begriffe der Nachfrage tragen — ein früheres Thema kann keine Quelle
//     zur Antwort machen, die zur neuen Frage nichts sagt — und die sachlichen Einschränkungen des
//     Ankers gelten weiter (R-0278, Nacharbeit 12: eine Quelle zu Ventil F4 trägt keine Nachfrage
//     zu Ventil F3).
//   · `frageterme` bleibt das Getippte — jede Aussage ÜBER die Antwort (Fundstelle, Etikett)
//     rechnet weiter darauf (s. die Trennung an `erweiterteSuchterme`).
//   · Die Fadenterme hängen in der Vorauswahl HINTER den Termen der Frage, der Markierung und
//     den deklarierten Entsprechungen; unter dem Deckel `ASK_PREFILTER_MAX_TERMS` verdrängen sie
//     keinen davon. Die Lastgrenze je Frage bleibt die alte.
// Ohne Faden ist die Frage im Zusammenhang Zeichen für Zeichen die Frage, und der Ablauf ist der
// bisherige.
export const GESPRAECHSFADEN_MAX_FRAGEN = 3;
const FADEN_TRENNER = " → ";

// Begrenzt wird wie auf der Fragen-Seite: die ERSTE Frage ist der Themenanker und bleibt, dazu die
// jüngsten Nachfragen (Ben, Nacharbeit 2 — sonst fiel das Thema nach drei Nachfragen heraus).
function fadenfragen(faden?: readonly string[]): string[] {
  const fragen = (faden ?? []).map((frage) => frage.trim()).filter((frage) => frage.length > 0);
  if (fragen.length <= GESPRAECHSFADEN_MAX_FRAGEN) {
    return fragen;
  }
  return [...fragen.slice(0, 1), ...fragen.slice(-(GESPRAECHSFADEN_MAX_FRAGEN - 1))];
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
// Fall Z1 steht), und `expandSearchTerms` darf nichts ableiten (S2-Grenze, `search-projection.ts`).
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
// JOB 3049 (N2, SCHEIBE 3) — DIE ZUORDNUNG ENDET NICHT MEHR BEI DER VORAUSWAHL.
// ================================================================================================
//
// WAS BIS JOB 3039 HIER STAND: „Solange er nicht freigegeben ist, endet die Zuordnung bei der
// VORAUSWAHL." Das gilt nicht mehr. Der dort nur VORGESCHLAGENE Relevanztext ist gebaut, und die
// Zuordnung reist jetzt durch BEIDE Auswahlpunkte:
//
//   TOR 1  `selectCandidates` im Fragedienst        (unten, `ask/src/service.ts`)
//   TOR 2  DIESELBE Auswahl NOCH EINMAL im Reasoner:
//            · `DeterministicProvider.answer` → `select` → `selectCandidates`
//              (`reasoner/src/provider.ts`; `Reasoner.answerRetrievalOnly` führt dorthin)
//            · `ModelProvider.answer` → `selectCandidates`
//              (`reasoner/src/provider-model.ts`)
//
// WAS REIST — UND WAS AUSDRÜCKLICH NICHT. Gereicht wird der RELEVANZTEXT: die getroffenen
// deklarierten PAARE, jedes mit seiner getippten und seiner ergänzten Seite (`Relevanztext` in
// `reasoner/src/types.ts`). Er ist ein eigener Wert NEBEN der Frage. `question` wird nirgends
// umgeschrieben oder angereichert: Antworttext, Modellprompt, Wissenslücke, `sources`,
// `citedSources` und das Prüfprotokoll rechnen unverändert auf dem, wonach wirklich gesucht wurde.
// R-0348 ist die eine benannte Ausnahme, und sie ist keine Ableitung: eine Nachfrage reist mit den
// vorher GETIPPTEN Fragen ihrer Fragestrecke als Frage im Zusammenhang (`fadenfragen`). Gebunden
// bleiben dabei die neue Frage und der Themenanker; ohne Faden gilt der Satz oben wörtlich.
//
// WARUM PAARE UND NICHT DIE GEWEITETE FRAGE — das ist der ganze Unterschied zu der Bauform, die
// JOB 3039 gemessen und zurückgebaut hat (Zahlen in `tests/suche-zuordnung/…`):
//   · Fall W1: ergänzte Wörter zählten dort wie getippte, füllten den Deckel `DEFAULT_TOP_K` (8)
//     und verdrängten den tragenden Treffer — aus `answered:true` wurde `answered:false`. Jetzt
//     zählt die Entsprechung NICHT in die Rangfolge: ein Kandidat ohne direkte Überschneidung
//     steht strikt hinter jedem mit direkter Überschneidung und wird zuerst weggeschnitten.
//   · Fall W2: trug EINE Quelle beide Wörter eines Paares, sammelte sie aus EINEM getippten Wort
//     zwei Substanzpunkte. Jetzt zählt jedes Paar höchstens EINMAL und nur dann, wenn nicht schon
//     ein getipptes Token desselben Paares getragen hat. Der Fehler ist geschlossen, nicht bloß
//     beschrieben.
//
// DIE ZWEITE GRENZE BLEIBT, unabhängig von der ersten und unverändert: das Substanzmaß.
// `MIN_ANSWER_SUBSTANCE` ist 2 und verlangt ZWEI verschiedene tragende Token. Eine Frage mit nur
// EINEM Inhaltstoken — „Wie ist die Urlaubsregelung?" zerfällt in `["urlaubsregel"]` — erreicht
// diese Zahl auch mit Entsprechung nicht; sie fiele selbst dann, wenn der Fragende „Urlaubszeiten"
// wörtlich getippt hätte (Fall F6). Diese Schwelle ist NICHT gesenkt worden, und der Deckel
// `DEFAULT_TOP_K` ebenso wenig.
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
): Relevanztext {
  // JOB 3049: DIE PAARUNG BLEIBT ERHALTEN, statt in eine flache Wortliste zu zerfallen. Der Inhalt
  // ist derselbe, den JOB 3021 gebildet hat — dieselbe Tabelle, dieselbe Erweiterung, dieselbe
  // Umrechnung in die Form des Fragepfads; nur wird jetzt je Zuordnung getrennt festgehalten, was
  // GETIPPT war und was ERGÄNZT wurde. Ohne diese Trennung kann die Auswahl weder „höchstens ein
  // Punkt je Paar" noch „nur statt des getippten Wortes" prüfen (Fall W2).
  const getippt = new Set(suchterme);
  // `bekannt` wächst mit den Ergänzungen und entdoppelt sie über alle Paare hinweg; `getippt`
  // wächst NICHT. Das ist der Unterschied zwischen Entdopplung und Ableitung: ein ergänztes Wort
  // darf nie selbst wieder als getippt gelten und eine zweite Ergänzung auslösen (Kettenbildung),
  // denn das wäre genau die Ableitung, die die S2-Grenze („nichts wird abgeleitet") ausschließt.
  const bekannt = new Set(getippt);
  const paare: ZuordnungsPaar[] = [];
  for (const zuordnung of zuordnungen) {
    const getroffen = zuordnung.begriffe.filter((begriff) =>
      queryTokens(begriff).some((t) => getippt.has(t)),
    );
    if (getroffen.length === 0) {
      continue;
    }
    const ergaenzt: string[] = [];
    for (const wort of expandSearchTerms(normalizeSearchTerms(getroffen))) {
      for (const term of normalizeSearchTerms(queryTokens(wort))) {
        if (!bekannt.has(term)) {
          bekannt.add(term);
          ergaenzt.push(term);
        }
      }
    }
    if (ergaenzt.length === 0) {
      continue;
    }
    paare.push({
      // Die getippte Seite in der Form des Fragepfads — genau die Token, über die dieses Paar
      // überhaupt getroffen wurde. Sie sind die Sperre gegen den zweiten Substanzpunkt.
      getippt: [...new Set(getroffen.flatMap(queryTokens).filter((t) => getippt.has(t)))],
      ergaenzt,
    });
  }
  return paare;
}

// ================================================================================================
// JOB 3353 · ASK-C02 — TOR 1 VERLIERT DEN VALIDIERTEN ZWILLING NICHT, BEVOR TOR 2 IHN SIEHT.
// ================================================================================================
//
// GEMESSEN (tests/ask-c02/befund.test.ts, Fall M2): Die Confluence-Kopie von C02 trägt als
// Kernaussage den Fiktionshinweis („Fictional demonstration material prepared for Advisor ICT …").
// Gegen Pedis LANGE Frage („In the fictional Advisor ICT demo data, what is the standard invoice
// payment period? …") misst sie 6 gemeinsame Inhaltstoken, das validierte Paketobjekt desselben
// Titels nur 2 — vier der sechs kommen aus dem RAHMEN der Frage, nicht aus der Sache. Die relative
// Regel in `selectCandidates` (`keywordScore · 2 > bestScore`) stuft das validierte Objekt damit
// als Mitläufer ein und entfernt es HIER, an Tor 1. Was Tor 1 wegwirft, kann Tor 2 nicht mehr
// abwägen: der geprüfte Stand ist still verloren, bevor irgendjemand ihn gegen die Kopie halten
// konnte.
//
// DIE ARBEITSTEILUNG BLEIBT DIE ANGESCHRIEBENE (Zeile 47: „die finale, präzise Status-/Trust-/
// Relevanz-Sortierung + Top-K macht der Reasoner"): Tor 1 ist die WOHLFEILE Vorauswahl und
// ENTSCHEIDET nichts. Es hört hier deshalb nur auf, einen validierten Zwilling wegzuwerfen; welcher
// der beiden vorn steht und was zitiert wird, entscheidet unverändert Tor 2 (`waehleKandidaten`
// in `reasoner/src/provider-model.ts`, wo auch die Begründung der Zwillingsregel steht).
//
// DIE GRENZEN, wie an Tor 2 und aus denselben Gründen: kein neuer Titel (nur ein Objekt, dessen
// Titelkern schon unter den Gewählten steht, kommt zurück), keine gelockerte Sichtbarkeit
// (`dropConfidential`/`validatedOnly` haben lange vorher entschieden — `refs` enthält nur, was
// hinausgehen DARF), und der Deckel `DEFAULT_TOP_K` bleibt der alte.
//
// EINE FASSUNG, NICHT ZWEI (Runde 2, Codex 6338b57f Befund 2). Runde 1 hatte die Titelnormalisierung
// hier nachgebaut, weil `services/reasoner/index.ts` sie nicht nach außen gab und ein Tiefimport die
// Modulgrenze bräche. Der Nachbau war genau das, wovor dieses Haus warnt: ein Test, der zwei Kopien
// gegeneinander hält, misst nicht das Produkt. Jetzt exportiert der Reasoner `waehleKandidaten`, und
// BEIDE Tore rufen dieselbe Funktion — es gibt keine zweite Auffassung davon, was ein Zwilling ist.

// SCRUM-115: Lücken ohne gespeicherte Priorität (Altdaten) erhalten beim Lesen
// den sicheren Default "mittel" — keine stille undefined-Priorität nach außen.
function withPriority(gap: Gap): Gap {
  return isGapPriority(gap.priority) ? gap : { ...gap, priority: "mittel" };
}

/**
 * produkt:20261010:wissenskreislauf-schliessen — die Lücke, wie sie an DEN FRAGENDEN zurückgeht.
 *
 * Bei einer wiederholten Frage kommt die BESTEHENDE Lücke zurück — mit dem Ersteller und den
 * weiteren Fragenden, also mit fremden Kennungen. Der Fragende erfährt nur sich selbst: ein fremder
 * Ersteller fällt weg, von den weiteren Fragenden bleibt höchstens er selbst. Zuordnungsverlauf und
 * Rückfragen gehören nicht in die Antwort auf eine Frage.
 */
const PERSONENBEZOGENE_LUECKENFELDER: ReadonlySet<string> = new Set([
  "createdBy",
  "weitereFragende",
  "zuordnungen",
  "rueckfragen",
]);

function fuerDenFragenden(gap: Gap, fragender: string): Gap {
  const { createdBy, weitereFragende } = gap;
  const rest = Object.fromEntries(
    Object.entries(gap).filter(([feld]) => !PERSONENBEZOGENE_LUECKENFELDER.has(feld)),
  ) as unknown as Gap;
  const selbst = fragender && fragender !== "system" ? fragender : undefined;
  return {
    ...rest,
    ...(createdBy && createdBy === selbst ? { createdBy } : {}),
    ...(selbst && createdBy !== selbst && weitereFragende?.includes(selbst)
      ? { weitereFragende: [selbst] }
      : {}),
  };
}

export interface AskServiceDeps {
  reasoner: Reasoner;
  koService: KoService;
  gaps: GapRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
  // aufnahme:20260922:gesamt-wissen-frische (R-1636): die aus der Bewährungs-Historie gelernten
  // Halbwertszeiten je Kategorie (`KoService.gelernteHalbwertszeiten`). Fehlt der Zugang, gilt für
  // die Haltbarkeit (R-0248) die Vorgabe je Wissensart — dieselbe Regel, nur ohne Lernstand.
  halbwertszeiten?: () => Promise<GelernteHalbwertszeiten>;
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
  /**
   * D5: die administrative KI-Abschaltung des Fragewegs — gelesen bei JEDEM Schritt, nie gemerkt.
   *
   * Die Kompositionswurzel bindet sie an `Reasoner.kiAbschaltung()` (gespeicherte Adminwahl
   * `deterministic` für `answer`). Ist sie gesetzt und meldet `abgeschaltet`, endet eine Frage mit
   * `AskError("KI_ABGESCHALTET")` — und zwar VOR dem nächsten Schritt, der Kundeninhalt liest
   * (Vorauswahl, Suchprojektion) oder an den Antwortweg übergibt. Eine schon laufende Frage, die
   * zwischen zwei Schritten auf die Abschaltung trifft, wird dort angehalten; sie holt nichts nach.
   *
   * Der deterministische Antwortweg ist ausdrücklich eingeschlossen: auch er liest und verarbeitet
   * Kundeninhalt im Namen des Assistenten. Menschliche Lesewege (Bibliothek, Original) laufen nicht
   * über diesen Dienst und bleiben unberührt.
   *
   * OPTIONAL aus demselben Grund wie `answerSnapshots`: fremde Aufbauten (Tests) bleiben
   * unverändert. Die eine Kompositionswurzel (`build-app.ts`) setzt sie immer.
   */
  kiSperre?: AskKiSperre;
  /**
   * produkt:20261010:wissenskreislauf-schliessen — DER FACHPRÜFSTAND EINER FASSUNG.
   *
   * Die Kompositionswurzel bindet ihn an `ValidationService.pruefstandFuer` — dieselbe Zählung, die
   * Prüfboard und Detailabruf zeigen (nur Stimmen der übergebenen Fassung). Der Dienst zählt nicht
   * selbst. FEHLT er, kann keine Lücke fachlich geschlossen werden (`pruefstand_unbekannt`,
   * fail-closed) — ein Aufbau ohne Prüfstand darf keinen Abschluss behaupten.
   */
  pruefstand?: (koId: string, koVersion: number) => Promise<GapPruefstand>;
}

/**
 * produkt:20261010:wissenskreislauf-schliessen — wer einen Vorgangsschritt ausführt, mit der FERTIGEN
 * Sichtbarkeitsentscheidung der Route (`sichtbarkeitsfilterFuer`) und dem Verwaltungsrecht
 * (`ko.assign`). Der Dienst legt keine Rechte aus; er wendet die mitgebrachte Entscheidung an.
 */
export interface GapBeteiligter {
  readonly id: string;
  readonly verwaltend: boolean;
  readonly sichtbar: (ko: KnowledgeObject) => boolean;
}

/** Eine aus dem Lückenstand abgeleitete Meldung der vorhandenen Glocke (`notification-feed.ts`). */
export interface GapMeldung {
  readonly id: string;
  readonly art: "geloest" | "rueckfrage" | "rueckfrage_beantwortet";
  readonly gapId: string;
  readonly at: string;
  /** Bei `geloest` der Titel des nutzbaren Wissenseintrags, sonst der eigene Fragetext. */
  readonly title: string;
  readonly koId?: string;
}

/** D5: die schmale Sicht auf den Abschaltzustand — mehr braucht der Frageweg nicht zu kennen. */
export interface AskKiSperre {
  abgeschaltet(): boolean;
  /**
   * Die Abschalt-Epoche (`Reasoner.kiAbschaltStand`): sie steigt mit JEDER gespeicherten Abschaltung.
   * Eine Frage hält sie zu Beginn fest; weicht sie später ab, wurde während der Frage abgeschaltet —
   * dann bleibt die Frage entwertet, auch wenn inzwischen wieder eingeschaltet ist.
   */
  stand(): number;
}

/**
 * D5: die benannten Schritte, vor denen die Sperre erneut gelesen wird. Sie stehen im Fehlertext
 * (nicht im Antwortkörper), damit ein Protokoll zeigt, WO eine laufende Frage angehalten wurde.
 */
type AskKiSchritt =
  | "diensteinstieg"
  | "vorauswahl"
  | "suchprojektion"
  | "antwortweg"
  | "ergebnis"
  | "auslieferung";

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
  /**
   * R-0338 (Aufnahme gesamt-suchindex-aktualitaet, Ben Nacharbeit 3): die Fassung JEDER
   * herangezogenen Quelle (`result.sources`), so wie DIESE Antwort sie gelesen hat — aus denselben
   * Objekten, die an den Antwortweg gingen, nicht aus einem Bestand des Browsers. Grundlage des
   * Auffrischen-Vertrags der Fragenseite (`apps/web/src/lib/fragenArbeitsstand.ts`). Optional,
   * damit ältere Aufrufer und Doubles gültig bleiben; dieser Dienst setzt es immer.
   */
  quellenStand?: Record<string, number>;
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
  // AUFNAHME 20260922 (R-0305, R-1099): die Gegenüberstellung mit dem Zweitmodell — NUR, wenn die
  // Frage sie angefordert hat (`opts.zweitmeinung`). Sonst fehlt das Feld vollständig, und der
  // Antwortkörper ist der bisherige.
  zweitmeinung?: ZweitmeinungErgebnis;
  // R-1633 — WOFÜR GEWICHTET WURDE, SICHTBAR. Nur wenn der Fragende einen Fragekontext angegeben
  // hat (Werk/Schicht/Rolle); sonst fehlt das Feld vollständig. Je herangezogener Quelle
  // (`result.sources`, also nach Sichtbarkeits-, Vertraulichkeits- und Freigabefilter) ihre Geltung
  // und wie sie zum Kontext passt — dieselbe Rechnung, die die Rangfolge bestimmt hat.
  geltung?: AskGeltungsauskunft;
  // AUFNAHME 20260922 · R-0284 — WOGEGEN GEPRÜFT WURDE. Eine Wissenslücke ohne ihren Rahmen ist
  // eine nackte Null: niemand weiss, ob sie etwas bedeutet. Der Dienst setzt das Feld auf JEDEM
  // Rückgabeweg; optional nur, damit Aufrufer mit eigenen Ergebnisattrappen unberührt bleiben.
  pruefrahmen?: AskPruefrahmen;
  // AUFNAHME 20260922 · R-0346 (Ben nacharbeit-9): WIE die Antwort zugeschnitten wurde — Tiefe,
  // Fachsprache, Reihenfolge und GENAU die angehängten Ergänzungen samt ihrer Quelle. Fehlt das
  // Feld, ist die Antwort unverändert (wörtlicher Weg, kein Zuschnitt übergeben, keine Antwort).
  antwortZuschnitt?: AskAntwortZuschnitt;
  /**
   * produkt:20261010:wissenskreislauf-schliessen — DIESELBE FRAGE IST SCHON FACHLICH GELÖST.
   *
   * Nur bei `answered=false` und nur mit Betrachter: eine fachlich geschlossene Lücke mit derselben
   * Frage (`compareKey`) verweist auf ihren Wissenseintrag, und dieser trägt HEUTE für diesen
   * Fragenden (`pruefeFachlicheNutzbarkeit` mit seiner Sichtbarkeit). Dann entsteht keine neue Lücke —
   * die Wiederholungsfrage nutzt genau den Eintrag, den die Abschlussmeldung nannte. Trägt er nicht
   * mehr (abgelaufen, gesperrt, kein Zugriff), fehlt das Feld, und die Frage wird wieder eine Lücke.
   */
  geloesteLuecke?: { koId: string; koVersion: number; titel: string };
}

/** R-0346: der angewandte Zuschnitt der Antwort (Regel und Grenzen: `antwort-zuschnitt.ts`). */
export interface AskAntwortZuschnitt {
  tiefe: ZuschnittDerAntwort["tiefe"];
  fachsprache: ZuschnittDerAntwort["fachsprache"];
  reihenfolge: KnowledgeType[];
  ergaenzungen: ZuschnittErgaenzung[];
  /**
   * Ben nacharbeit-13: die Antwort OHNE Wörterbucherklärungen — der Teil, den die tragenden Quellen
   * belegen. Die Argumentationskette führt GENAU diesen Text als Schluss; Wörterbuchdefinitionen
   * werden so nie den Wissensquellen zugeschrieben.
   */
  quellengebundenerText: string;
  /**
   * Ben nacharbeit-20: die angehängten Abschnitte samt der Quelle, für die jeder erzeugt wurde, in
   * der Reihenfolge am Ende der Antwort (`antwort-zuschnitt.ts`). Grundlage der Absatzzuordnung.
   */
  abschnitte: ZuschnittAbschnitt[];
}

/**
 * Der Rahmen einer Suche — eine Aussage über den WEG, nie über den Bestand.
 *
 * WARUM DAS KEIN ZWEITES `ungeprueftUnterdrueckt` IST (mega77): gezählt wird nicht die gedeckelte
 * Vorauswahl und nichts Ungeprüftes neben der Enge, sondern genau die Kandidaten, die dem
 * Antwortweg vorgelegt wurden — hinter `dropConfidential` und, wo verlangt, hinter `validatedOnly`.
 * Das ist dieselbe Menge, aus der dieser Aufrufer ohnehin Quellen bekommen hätte; die Zahl verrät
 * nichts, was er nicht sehen darf. Und sie behauptet nichts über den Bestand: „0 verglichen" heisst
 * „keine Quelle deckte alle Fragebegriffe", nicht „es gibt nichts".
 */
export interface AskPruefrahmen {
  /** Wogegen gesucht wurde: nur validiertes Wissen, oder jedes nicht vertrauliche. */
  umfang: "validiert" | "nicht_vertraulich";
  /** Wie viele passende Einträge (alle Fragebegriffe gedeckt) dem Antwortweg vorlagen. */
  verglichen: number;
  /** Höchstzahl je Frage (Top-K). */
  hoechstens: number;
  /** `true`: nur wörtliche Übernahme validierter Aussagen, keine Synthese durch ein Modell. */
  nurWoertlich: boolean;
}

/** R-1633: der Fragekontext und je Quelle ihre Geltung und Passung (Regel: `geltungFuerFrage`). */
export interface AskGeltungsauskunft {
  fragekontext: Fragekontext;
  quellen: { id: string; passung: GeltungsPassung; geltung?: KoGeltung }[];
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
  private readonly halbwertszeiten: (() => Promise<GelernteHalbwertszeiten>) | undefined;
  private readonly receiptSecret: Buffer;
  private readonly withTx: WithTx | undefined;
  /** W3-C1: der Beleg-Schreibweg. `undefined` heisst: dieser Aufbau schreibt keine Snapshots. */
  private readonly answerSnapshots: AnswerSnapshotRepo | undefined;
  /** D5: die administrative KI-Abschaltung (s. `AskServiceDeps.kiSperre`). */
  private readonly kiSperre: AskKiSperre | undefined;
  /** Der Fachprüfstand (s. `AskServiceDeps.pruefstand`). */
  private readonly pruefstand: AskServiceDeps["pruefstand"];
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
    this.halbwertszeiten = deps.halbwertszeiten;
    // FUNKE-FIX P0: ohne injiziertes Secret ein prozess-lokales Zufalls-Secret — Belege sind
    // kurzlebig, das Secret verlässt den Server nie.
    this.receiptSecret = deps.receiptSecret ?? randomBytes(32);
    this.withTx = deps.withTx;
    this.answerSnapshots = deps.answerSnapshots;
    this.kiSperre = deps.kiSperre;
    this.pruefstand = deps.pruefstand;
  }

  /**
   * D5: vor jedem Schritt, der Kundeninhalt liest oder an den Antwortweg übergibt, die Abschaltung
   * FRISCH lesen. Wirft `KI_ABGESCHALTET`; der Schritt findet dann nicht statt.
   */
  private pruefeKiSperre(schritt: AskKiSchritt, beginn: number | undefined): void {
    const sperre = this.kiSperre;
    if (!sperre) {
      return;
    }
    // Zwei Bedingungen, beide nötig: JETZT abgeschaltet — oder SEIT BEGINN dieser Frage abgeschaltet
    // worden (Epoche verschoben), auch wenn inzwischen wieder eingeschaltet ist. Die zweite ist Bens
    // Befund aus Runde 2: eine angehaltene alte Frage las nach Aus- und Wiedereinschalten weiter.
    if (sperre.abgeschaltet() || (beginn !== undefined && sperre.stand() !== beginn)) {
      throw new AskError(
        "KI_ABGESCHALTET",
        `Der Administrator hat die KI abgeschaltet — die Frage wurde vor dem Schritt „${schritt}" angehalten.`,
      );
    }
  }

  /**
   * D5: die Abschalt-Epoche, die ein Aufrufer beim Beginn einer Frage festhält (`AskKiSperre.stand`).
   * `undefined`, wenn dieser Aufbau keine Sperre trägt.
   */
  kiStand(): number | undefined {
    return this.kiSperre?.stand();
  }

  /**
   * D5 (Lauf 5 Runde 2, Bens B1): für die Route — nach ihrem letzten Warten VOR dem Dienst (Anmeldung,
   * Klara-Einwilligung) gegen die beim EINGANG der Anfrage festgehaltene Epoche. Unmittelbar danach,
   * ohne `await` dazwischen, ruft die Route `ask`; dessen eigene Epoche ist damit dieselbe.
   */
  kiSperreVorFrage(beginn: number | undefined): void {
    this.pruefeKiSperre("diensteinstieg", beginn);
  }

  /**
   * D5: für die Route — nach der Antwort und VOR dem Nachlesen der Quellobjekte für die Einstufung
   * (`evidenceFor`, ask-routes.ts). Wirft `KI_ABGESCHALTET` wie jeder andere Prüfpunkt.
   */
  kiSperreVorAuslieferung(beginn: number | undefined): void {
    this.pruefeKiSperre("auslieferung", beginn);
  }

  /**
   * D5: die Suchprojektion eines Kandidaten — mit Sperre vor BEIDEN Lesevorgängen, die darin
   * stecken (Objekt, dann Projektion; `KoService.searchProjectionUnterKiSperre`). Ohne Sperre
   * (fremde Aufbauten) unverändert `searchProjectionOf`.
   */
  private suchprojektion(id: string, schritt: AskKiSchritt, beginn: number | undefined) {
    return this.kiSperre
      ? this.koService.searchProjectionUnterKiSperre(id, () => this.pruefeKiSperre(schritt, beginn))
      : this.koService.searchProjectionOf(id);
  }

  /**
   * D5: der Antwortweg prüft die Abschaltung selbst noch einmal — unmittelbar vor der Übertragung
   * an ein Modell, nach jedem Warten auf einen freien Modellplatz (`Reasoner.runTask`). Scheitert
   * er daran, ist das dieselbe Abschaltung und wird dieselbe Auskunft.
   */
  private async mitUebertragungssperre<T>(lauf: () => Promise<T>): Promise<T> {
    try {
      return await lauf();
    } catch (fehler) {
      if (fehler instanceof KiAbgeschaltetFehler) {
        throw new AskError(
          "KI_ABGESCHALTET",
          "Der Administrator hat die KI abgeschaltet — die Frage wurde vor der Übertragung an das Modell angehalten.",
        );
      }
      throw fehler;
    }
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
  private async prefilterCandidates(
    terms: readonly string[],
    kiBeginn: number | undefined,
  ): Promise<KnowledgeObject[]> {
    const genutzteTerme = terms.slice(0, ASK_PREFILTER_MAX_TERMS);
    if (genutzteTerme.length === 0) {
      return [];
    }
    const trefferlisten = await Promise.all(
      genutzteTerme.map((term) =>
        this.koService.findCandidates({
          terms: [term],
          limit: ASK_PREFILTER_TERM_LIMIT,
          // AUFNAHME 20260922 (R-0316): der Deckel je Begriff wächst mit dem Bestand (Regel an
          // `bestandsgerechterKandidatendeckel`). Bis 5.000 Objekte bleibt er bei 50.
          deckelWaechstMitBestand: true,
          // D5: die Sperre reist mit bis vor jedes Lesen in Suche und Nachladen (s. KoService).
          ...(this.kiSperre
            ? { vorInhaltsabruf: () => this.pruefeKiSperre("vorauswahl", kiBeginn) }
            : {}),
        }),
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
    // AUFNAHME 20260922 (R-0316): eine vollständige Einzelliste wird von der Vereinigung nie
    // gekürzt. Ist der Deckel je Begriff über 200 gewachsen, stünde die Kürzung sonst wieder in
    // der Ausgabeordnung (validiert ↓, Trust ↓) — und nähme genau den Titeltreffer mit niedrigem
    // Trust weg, den die Güteauswahl im Deckel eben hereingeholt hat.
    const gesamtDeckel = Math.max(
      ASK_CANDIDATE_PREFILTER_LIMIT,
      ...trefferlisten.map((liste) => liste.length),
    );
    return [...gesammelt.values()]
      .sort((a, b) => b.termTreffer - a.termTreffer || a.besterRang - b.besterRang)
      .slice(0, gesamtDeckel)
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
      /**
       * F-0295 / R-0639: die Route hat die EIGENE Deckungsprüfung des Dokumenttexts bestanden
       * (`dokumenttextFreigabe` in `services/app/src/routes/ask-routes.ts`). Nur dann — und nur auf
       * dem Modellweg, nie mit `retrievalOnly` — geht `selection` als benannter Dokumenttext an
       * `Reasoner.answer`. Kein Rumpffeld: gesetzt wird es ausschliesslich von der Route.
       */
      dokumenttextFreigegeben?: boolean;
      /**
       * Auftrag gesamt-ki-freigaberegeln (Ben Nacharbeit 2): der hinausgehende Dokumenttext (Markierung
       * oder Frage) ist als VERTRAULICH markiert und nur durch die zweite zentrale Adminfreigabe
       * gedeckt. Dann läuft die Antwort als vertraulich in den Reasoner — der Kern und der Chokepoint
       * entscheiden dieselbe Freigabe noch einmal. Gesetzt ausschliesslich von der Route.
       */
      dokumenttextVertraulich?: boolean;
      /**
       * R-0348: die vorangegangenen Fragen derselben Fragestrecke, älteste zuerst (höchstens
       * `GESPRAECHSFADEN_MAX_FRAGEN` zählen). Wirkung und Grenzen an `fadenfragen`. Gesetzt nur
       * von der Route, und nur im Konsolenzweig.
       */
      gespraechsfaden?: readonly string[];
      /**
       * AUFNAHME 20260922 (R-0305, R-1099): dieselbe Frage zusätzlich vom Zweitmodell beantworten
       * lassen und gegenüberstellen (`Reasoner.answerMitZweitmeinung`). Beide Modelle bekommen
       * DIESELBEN Kandidaten — die Sichtbarkeits-, Prüfstands- und Vertraulichkeitsfilter liefen
       * davor und gelten für beide. Wirkungslos mit `retrievalOnly` (dort fragt kein Modell).
       * Gesetzt nur von der Route, und nur im Konsolenzweig.
       */
      zweitmeinung?: boolean;
      /**
       * R-1633: wofür gefragt wird (Werk/Schicht/Rolle), bereits geprüft (`normalizeFragekontext`).
       * Wirkung: je Kandidat ein `geltungsrang`, der unter GLEICH relevanten Quellen ordnet
       * (Regel an `rankCandidates`), und die Auskunft `geltung` an der Antwort. Gesetzt nur von
       * der Route, und nur im Konsolenzweig — wie der Gesprächsfaden.
       */
      fragekontext?: Fragekontext;
      /**
       * Klara 03 (produkt:20261007:klara-kontext-tutorial): der gewählte Seitenkontext, bereits von
       * der Route unter den Rechten des Fragenden aufgelöst. Gesetzt nur im Konsolenzweig.
       *   · `kontext` — ein Satz zum Objekt der Seite (Titel des Artikels, Titel des Entwurfs, die
       *     aktuelle Frage). Er reist wie eine Fadenfrage als ZUSAMMENHANG: er ergänzt die Suche
       *     (hinter den Fragetermen) und steht vor der Frage im Zusammenhang — gebunden wird er NICHT.
       *   · `nurObjekt` — Bezug „Dieser Artikel“: geantwortet wird NUR aus diesem Objekt (sofern es
       *     die Frage deckt und alle übrigen Filter besteht). `null` heisst: das gewählte Objekt ist
       *     für den Fragenden nicht zugänglich — dann gibt es keine Grundlage.
       */
      seitenkontext?: { kontext: string; nurObjekt?: string | null };
    },
    // produkt:20261007:spaces — WAS DER FRAGENDE ÜBERHAUPT SEHEN DARF, als fertige Entscheidung der
    // Route (`sichtbarkeitsfilterFuer`, samt führendem Space). Bewusst ein EIGENER Parameter und
    // nicht Teil von `opts`: `opts` ist je Zweig wörtlich vertraglich festgelegt (KA4-E1, mega52).
    // Er wirkt auf die Vorauswahl, VOR `dropConfidential` und `validatedOnly`, und kann damit nur
    // verengen. Ungesetzt (Systemaufrufe, bestehende Aufrufer) bleibt der Ablauf der bisherige.
    grundlageSichtbarFuer?: (ko: KnowledgeObject) => boolean,
    // AUFNAHME 20260922 · R-0346 (Ben nacharbeit-9): Rolle und Dokumentanlass für die ANTWORT selbst —
    // Tiefe (wörtliche Voraussetzungen/Maßnahmen der tragenden Quellen), Fachsprache (Erklärungen
    // aus dem Firmenwörterbuch) und Reihenfolge der Wissensarten (`antwort-zuschnitt.ts`). Wie
    // `grundlageSichtbarFuer` ein EIGENER Parameter und nicht Teil von `opts` (KA4-E1, mega52).
    // Ungesetzt, und auf dem wörtlichen Weg (`retrievalOnly`), bleibt die Antwort unverändert.
    zuschnitt?: ZuschnittDerAntwort & {
      begriffe?: (locale: ReasonerLocale) => Promise<readonly ZuschnittBegriff[]>;
    },
  ): Promise<AskResult> {
    // D5: die Abschalt-Epoche beim Beginn DIESER Frage — jede Prüfung unten vergleicht mit ihr.
    const kiBeginn = this.kiSperre?.stand();
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
    // JOB 3049 (N2, Scheibe 3): DER RELEVANZTEXT ENTSTEHT HIER — EINMAL, AN GENAU DIESER STELLE.
    // Aus ihm entstehen ZWEI Dinge, und beide aus derselben Rechnung: die ergänzten Terme der
    // Vorauswahl (die Zeile darunter, wie seit JOB 3021) und der Wert, der neben der Frage bis in
    // beide Provider reist. Es gibt keine zweite Zerlegung und keine zweite Zuordnungstabelle.
    // `suchterme` selbst hat weiterhin GENAU EINEN Verbraucher: `prefilterCandidates`.
    const frageterme = queryTokens(question);
    const eingabeterme = erweiterteSuchterme(frageterme, opts?.selection);
    const relevanz = zugeordneteSuchterme(eingabeterme);
    const vorFaden = [...eingabeterme, ...relevanz.flatMap((paar) => [...paar.ergaenzt])];
    // R-0348: der Gesprächsfaden — Begründung und Grenzen an `fadenfragen`.
    const faden = fadenfragen(opts?.gespraechsfaden);
    // Klara 03: der Seitenkontext steht im Zusammenhang direkt vor der Frage — wie eine Fadenfrage,
    // aber nie Themenanker (gebunden bleibt allein `faden[0]`). Ohne ihn ist alles wie bisher.
    const kontextSatz = opts?.seitenkontext?.kontext.trim() ?? "";
    const zusammenhang = kontextSatz ? [...faden, kontextSatz] : faden;
    const frageImZusammenhang =
      zusammenhang.length > 0 ? [...zusammenhang, question].join(FADEN_TRENNER) : question;
    const suchterme =
      zusammenhang.length > 0 ? erweiterteSuchterme(vorFaden, zusammenhang.join(" ")) : vorFaden;
    // D5: bis hierher wurde nur die Frage selbst zerlegt — ab der nächsten Zeile wird Bestand gelesen.
    this.pruefeKiSperre("vorauswahl", kiBeginn);
    const vorauswahl = await this.prefilterCandidates(suchterme, kiBeginn);
    const prefilteredRaw = grundlageSichtbarFuer
      ? vorauswahl.filter((ko) => grundlageSichtbarFuer(ko))
      : vorauswahl;
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
    // R-1633: der Fragekontext (Werk/Schicht/Rolle) — ohne ihn ist der Ablauf der bisherige.
    const fragekontext = opts?.fragekontext;
    // aufnahme:20260922:gesamt-wissen-frische (R-0248): EIN Zeitpunkt für alle Quellen dieser Frage.
    const jetzt = this.now();
    // R-1636: die gelernte Halbwertszeit der Kategorie bestimmt die Frist mit.
    const gelernt = await this.halbwertszeiten?.();
    // D5: die Suchprojektion trägt den Dokumenttext — ein weiterer inhaltlesender Schritt.
    this.pruefeKiSperre("suchprojektion", kiBeginn);
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
        const projektion = await this.suchprojektion(ko.id, "suchprojektion", kiBeginn);
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
          // R-1633: nur mit Fragekontext — dann ordnet der Rang an BEIDEN Toren (dieselben Refs).
          ...(fragekontext
            ? { geltungsrang: geltungFuerFrage(ko.geltung, fragekontext).rang }
            : {}),
          // R-0248: nach Fristende nicht mehr „gesichert" (answerStanding), bis der Verantwortliche
          // bestätigt. Nur an validierten Quellen gesetzt — ungeprüfte sind ohnehin nicht gesichert.
          ...(ko.status === "validiert" && haltbarkeitAbgelaufen(ko, jetzt, gelernt)
            ? { haltbarkeitAbgelaufen: true as const }
            : {}),
        };
      }),
    );
    // SCRUM-360: präzise, status-/trust-bewusste Top-K-Auswahl auf der vorgefilterten Menge (Relevanz-
    // Gate dominiert, validierte/ready bevorzugt). Idempotent zur Vorauswahl: Top-K der vorgefilterten
    // Menge = Top-K, da jeder relevante KO (Token-Überschneidung) bereits im Prefilter enthalten ist.
    // JOB 3049 (N2, Scheibe 3): TOR 1 BEKOMMT DIE FRAGE UND DEN RELEVANZTEXT — GETRENNT.
    //
    // Die Frage bleibt die Frage: nichts wird in sie hineingemischt. Was JOB 3039 hier versucht und
    // gemessen zurückgebaut hat, war die geweitete FRAGE — ein Text, in dem ergänzte Wörter wie
    // getippte zählen; das verdrängte den tragenden Treffer (W1) und öffnete das Substanztor aus
    // einem einzigen Wort (W2). Der Relevanztext daneben tut beides nicht: er zählt nicht in die
    // Rangfolge und jedes Paar höchstens einmal (Begründung an `rankCandidates`/`ueberschneidung`).
    // Dasselbe Datum geht zwei Zeilen weiter an Tor 2 — ein Objekt, das nur über die Entsprechung
    // trifft, überlebt damit beide oder keines, aber nie nur das erste.
    // JOB 3353: `waehleKandidaten` IST `selectCandidates` plus die Zwillingsregel — dieselbe
    // Funktion, die Tor 2 ruft (Begründung und Grenzen dort, `reasoner/src/provider-model.ts`).
    // R-0473 (K8): MEHRERE BEGRIFFE MÜSSEN ALLE VORKOMMEN. Die Vorauswahl bleibt term-weise ODER
    // (sonst fände der Deckel nichts mehr), aber eine Quelle, der ein gebundener Fragebegriff fehlt,
    // erreicht weder Tor 1 noch Tor 2. Eine deklarierte Entsprechung zählt als derselbe Begriff.
    // Welche Begriffe gebunden sind und warum nicht jedes Token: `undVerknuepfteFragebegriffe`.
    // Gebunden wird nur die FRAGE — die Markierung ergänzt die Suche, sie verschärft sie nicht.
    // Geprüft wird auf DENSELBEN Feldern, die die Suche trifft — Kategorie und Tags eingeschlossen,
    // die `KnowledgeRef` nicht führt; sie kommen deshalb aus `prefiltered`.
    const ordnung = new Map<string, string[]>(
      prefiltered.map((ko): [string, string[]] => [ko.id, [ko.category, ...(ko.tags ?? [])]]),
    );
    // R-0278 (Nacharbeit 12, ben): bei einer anknüpfenden Nachfrage gelten die sachlichen
    // Einschränkungen des THEMENANKERS (erste Fadenfrage, s. `fadenfragen`) weiter. Gebunden wird
    // deshalb die Nachfrage UND der Anker: nach „Welche maximale Temperatur gilt am Ventil F3?" darf
    // „Und bei Dauerbetrieb?" keine Quelle zu Ventil F4 tragen. Zwischenfragen binden nicht — sie
    // sind die Nachfragen, die der Anker einrahmt. Ohne Faden ist der Ablauf der bisherige.
    const anker = faden[0];
    const vollstaendig = refs.filter((ref) => {
      const durchsuchbar = [
        ref.title,
        ref.statement,
        ...(ref.captionTexts ?? []),
        ref.bodyText ?? "",
        ...(ordnung.get(ref.id) ?? []),
      ].join(" ");
      return (
        decktAlleFragebegriffe(question, durchsuchbar, relevanz) &&
        (anker === undefined || decktAlleFragebegriffe(anker, durchsuchbar, relevanz))
      );
    });
    // R-0348: gebunden haben oben die getippte Frage und ihr Anker; gewählt und beantwortet wird im
    // Zusammenhang.
    // Klara 03: Bezug „Dieser Artikel“ — nur dieses Objekt kommt an beide Tore (Tor 2 wählt aus
    // genau diesen Kandidaten). `null` (nicht zugänglich) lässt keinen Kandidaten übrig.
    const nurObjekt = opts?.seitenkontext?.nurObjekt;
    const auswahlBasis =
      nurObjekt === undefined ? vollstaendig : vollstaendig.filter((ref) => ref.id === nurObjekt);
    const candidates = waehleKandidaten(frageImZusammenhang, auswahlBasis, DEFAULT_TOP_K, relevanz);
    // R-0284: der Rahmen dieser Suche, aus genau den Werten, die den Weg bestimmt haben.
    const pruefrahmen: AskPruefrahmen = {
      umfang: opts?.validatedOnly ? "validiert" : "nicht_vertraulich",
      verglichen: candidates.length,
      hoechstens: DEFAULT_TOP_K,
      nurWoertlich: opts?.retrievalOnly === true,
    };
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
    const kontextVertraulich =
      prefiltered.some((ko) => isConfidential(ko.confidentiality)) ||
      opts?.dokumenttextVertraulich === true;
    // F-0295 / R-0639: der markierte Dokumenttext — nur mit bestandener eigener Deckungsprüfung.
    const dokumenttext =
      opts?.dokumenttextFreigegeben === true && opts.selection?.trim()
        ? opts.selection.trim()
        : undefined;
    // D5: die gelesenen Kandidaten gehen gleich an den Antwortweg (Modell oder deterministischer
    // Ersatz). Wurde inzwischen abgeschaltet, verlassen sie diesen Dienst nicht.
    this.pruefeKiSperre("antwortweg", kiBeginn);
    // R-0305/R-1099: angefordert — dann beantworten beide Modelle dieselbe Frage aus denselben
    // `candidates` mit denselben Argumenten, und die erste Antwort ist hier die Antwort wie sonst
    // auch. Der Weg des Add-ins (`retrievalOnly`) bleibt davon unberührt: dort fragt kein Modell.
    const zweitmeinungFeld: { zweitmeinung?: ZweitmeinungErgebnis } = {};
    const antworte = async (...args: Parameters<Reasoner["answer"]>): Promise<AnswerResult> => {
      if (opts?.zweitmeinung !== true) {
        return this.reasoner.answer(...args);
      }
      const beide = await this.reasoner.answerMitZweitmeinung(...args);
      zweitmeinungFeld.zweitmeinung = beide.zweitmeinung;
      return beide.erste;
    };
    const rawResult = await this.mitUebertragungssperre(() =>
      opts?.retrievalOnly
        ? // JOB 3049: TOR 2, Weg des Add-ins — derselbe Relevanztext wie an Tor 1. Ohne ihn hier
          // wäre genau der Klara-Weg der eine, der die Zusage nicht einlöst.
          this.reasoner.answerRetrievalOnly(frageImZusammenhang, candidates, locale, relevanz)
        : antworte(
            frageImZusammenhang,
            candidates,
            locale,
            kontextVertraulich,
            {
              // mega61 Block G: der Handelnde am Protokolleintrag. Kein Gegenstand — bei einer
              // Antwort ist er eine Trefferliste und kein einzelnes Objekt (dieselbe Begründung,
              // die in reasoner-routes.ts schon steht).
              actor: actorId,
            },
            // JOB 3049: TOR 2, üblicher Weg. Der Relevanztext geht an die Kandidatenauswahl des
            // Providers — NICHT in den Modellprompt; der baut unverändert auf `question` auf.
            relevanz,
            dokumenttext,
          ),
    );
    // D5: danach werden Beleg, Wissenslücke und (in der Route) die Quellobjekte der Einstufung
    // geschrieben bzw. gelesen. Ist inzwischen abgeschaltet, wird nichts davon mehr ausgeliefert.
    this.pruefeKiSperre("ergebnis", kiBeginn);
    // SCRUM-490 R2 (A2): Quellenpflicht — ein „Treffer" ohne echte Quelle ist KEIN belegter Treffer.
    // answered=true mit leeren sources → als ehrliche Leer-Antwort behandeln (nie eine Quelle vortäuschen).
    // mega52 A3: wird der Treffer hier zur ehrlichen Leer-Antwort herabgestuft, fällt auch die
    // Zuordnung weg — eine tragende Quelle ohne Antwort gibt es nicht.
    // JOB 3366: fällt der Treffer hier zur ehrlichen Leer-Antwort zurück, fällt AUCH der
    // Abbruchbefund weg. Er ist eine Aussage ÜBER einen ausgelieferten Antworttext („dieser Text
    // ist unvollständig"); ohne Text gibt es nichts, worüber er etwas sagen könnte, und die
    // Lückenkarte trüge sonst einen Hinweis auf eine Antwort, die es nicht gibt. Alles andere
    // reist unverändert weiter: der Befund des Reasoners geht als Feld an den API-Vertrag
    // (`apps/web/src/api/types.ts`) und von dort an die drei Flächen.
    // Das Feld wird WEGGELASSEN, nicht auf `undefined` gesetzt: `exactOptionalPropertyTypes` ist
    // an, und „fehlt" ist auch am Draht die Aussage (JSON kennt kein `undefined`).
    // R-1643: dasselbe gilt für die Argumentationskette — ohne Antwort gibt es nichts zu begründen.
    const {
      abgeschnitten: _abgeschnittenVerworfen,
      argumentation: _argumentationVerworfen,
      ...rawOhneAbbruch
    } = rawResult;
    const resultCore =
      rawResult.answered && rawResult.sources.length === 0
        ? { ...rawOhneAbbruch, answered: false, answer: null, citedSources: [] }
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
    // AUFNAHME 20260922 · R-0346 (Ben nacharbeit-9): der Zuschnitt verändert die Antwort SELBST —
    // nur auf dem Antwortweg mit Synthese bzw. Rückfall, NIE auf dem wörtlichen (`retrievalOnly`).
    // Ergänzt wird ausschließlich Wörtliches aus den TRAGENDEN Quellen und Definitionen aus dem
    // Firmenwörterbuch; Quellen, Zuordnung und Belegstellen bleiben unberührt.
    let antwortZuschnitt: AskAntwortZuschnitt | undefined;
    const basisText = resultCore.answer;
    let zugeschnittenerText = basisText;
    if (zuschnitt && opts?.retrievalOnly !== true && resultCore.answered && basisText) {
      const getragen: readonly string[] = resultCore.citedSources;
      const tragende = getragen.flatMap((id) => {
        const ko = prefiltered.find((k) => k.id === id);
        return ko ? [ko] : [];
      });
      const begriffe =
        zuschnitt.fachsprache === "allgemein" && zuschnitt.begriffe
          ? await zuschnitt.begriffe(locale).catch(() => [])
          : [];
      const zugeschnitten = schneideAntwortZu(basisText, tragende, zuschnitt, begriffe, locale);
      zugeschnittenerText = zugeschnitten.text;
      antwortZuschnitt = {
        tiefe: zuschnitt.tiefe,
        fachsprache: zuschnitt.fachsprache,
        reihenfolge: [...zuschnitt.reihenfolge],
        ergaenzungen: zugeschnitten.ergaenzungen,
        quellengebundenerText: zugeschnitten.quellengebunden,
        abschnitte: zugeschnitten.abschnitte,
      };
    }
    const result = { ...resultCore, answer: zugeschnittenerText, captionSources };
    const zuschnittFeld: { antwortZuschnitt?: AskAntwortZuschnitt } = antwortZuschnitt
      ? { antwortZuschnitt }
      : {};
    // R-0338: die gelesene Fassung jeder herangezogenen Quelle — aus `prefiltered`, den Objekten,
    // aus denen die Antwort entstand. Eine Quelle ohne Objekt dort (nicht erwartbar) fehlt im Stand;
    // die Fläche behandelt eine Antwort mit unvollständigem Stand dann wie eine ohne Stand.
    const quellenStand: Record<string, number> = {};
    for (const id of result.sources) {
      const fassung = prefiltered.find((ko) => ko.id === id)?.version;
      if (fassung !== undefined) {
        quellenStand[id] = fassung;
      }
    }
    // R-1633 — „Sichtbar im UI": je herangezogener Quelle Geltung und Passung, aus denselben
    // Objekten (`prefiltered`) und derselben Regel, die den Rang gesetzt hat. Ohne Kontext fehlt
    // das Feld; eine Quelle ohne Objekt in `prefiltered` gilt als ohne Geltungsangabe.
    const geltungFeld: { geltung?: AskGeltungsauskunft } = fragekontext
      ? {
          geltung: {
            fragekontext,
            quellen: result.sources.map((id) => {
              const g = prefiltered.find((ko) => ko.id === id)?.geltung;
              return {
                id,
                passung: geltungFuerFrage(g, fragekontext).passung,
                ...(g ? { geltung: g } : {}),
              };
            }),
          },
        }
      : {};
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
                    const projektion = await this.suchprojektion(ko.id, "ergebnis", kiBeginn);
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
    // D5: nach dem Warten auf die Volltext-Blicke oben — vor dem Beleg, der die Antwort ablegt.
    this.pruefeKiSperre("ergebnis", kiBeginn);
    const answerId = await this.schreibeAntwortbeleg(result, prefiltered, aufrufer, kiBeginn);
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
    // R-1099: „Weichen sie voneinander ab, ist das ein Warnzeichen, dem jemand nachgehen muss."
    // Damit dieses Warnzeichen nicht nur auf einem Bildschirm steht, der gleich wieder zu ist, wird
    // die Gegenüberstellung protokolliert — als eigener Eintrag, damit `ask.query` seine
    // inventarisierte Feldmenge behält (docs/datenschutz/pruefprotokoll-nutzdaten.md). Ziel ist die
    // tragende Quelle, an der man der Abweichung nachgeht. Nur Zustände, kein Frage- oder
    // Antworttext, kein Anbieter- oder Modellname.
    const zweitmeinung = zweitmeinungFeld.zweitmeinung;
    if (zweitmeinung) {
      await this.audit?.record({
        actor: actorId,
        action: "ask.zweitmeinung",
        target: result.citedSources[0] ?? result.sources[0] ?? "-",
        payload:
          zweitmeinung.status === "verglichen"
            ? {
                status: zweitmeinung.status,
                abweichend: zweitmeinung.abweichend,
                abweichungen: zweitmeinung.abweichungen.join(","),
                ersteStufe: zweitmeinung.ersteStufe,
                zweiteStufe: zweitmeinung.zweiteStufe,
              }
            : { status: zweitmeinung.status, grund: zweitmeinung.grund },
      });
    }
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
        return {
          result,
          answerId,
          gap: null,
          receipt,
          quellenStand,
          ...ungeprueftFeld,
          ...verschlossenFeld,
          ...zweitmeinungFeld,
          ...geltungFeld,
          ...zuschnittFeld,
          pruefrahmen,
        };
      }
      // GAP-SPRACHHERKUNFT: `locale` steuert schon die Antwortsprache des Reasoners und liegt hier
      // ohnehin vor — es ging bisher nur verloren. Mitgegeben, damit die Oberfläche einen
      // fremdsprachigen Lückentitel erklären kann, statt ihn wie einen Fehler aussehen zu lassen.
      // D5: nach Beleg und Protokoll — vor der Lückensuche, die den Lückenbestand liest.
      this.pruefeKiSperre("ergebnis", kiBeginn);
      // R-0291: welcher Beleg fehlen würde — aus DERSELBEN Vorauswahl wie die Torlage
      // (`dropConfidential(prefilteredRaw)`, also nur Sichtbares und nie Vertrauliches) und mit
      // denselben Tormessungen. Regel und Bedeutung: `gap-belegbedarf.ts`.
      const belegbedarf = leiteBelegbedarfAb(
        await Promise.all(
          dropConfidential(prefilteredRaw).map(async (ko) => {
            const projektion = await this.suchprojektion(ko.id, "ergebnis", kiBeginn);
            return {
              freigabeFehlt: ko.status !== "validiert",
              stufeFehlt: ko.confidentiality === null || ko.confidentiality === undefined,
              volltextFehlt: !projektion?.bodyText.trim(),
            };
          }),
        ),
      );
      // produkt:20261010:wissenskreislauf-schliessen: dieselbe Frage ist schon fachlich gelöst und
      // ihr Eintrag trägt HEUTE für diesen Fragenden → keine neue Lücke, sondern genau dieser
      // Eintrag (Begründung am Feld `geloesteLuecke`). Nur mit Betrachter; ohne ihn ist das Recht
      // nicht prüfbar, und es bleibt beim bisherigen Weg.
      if (grundlageSichtbarFuer) {
        const geloest = await this.geloesterEintragFuer(frageImZusammenhang, grundlageSichtbarFuer);
        this.pruefeKiSperre("ergebnis", kiBeginn);
        if (geloest) {
          return {
            result,
            answerId,
            gap: null,
            receipt,
            quellenStand,
            ...ungeprueftFeld,
            ...verschlossenFeld,
            ...zweitmeinungFeld,
            ...geltungFeld,
            ...zuschnittFeld,
            pruefrahmen,
            geloesteLuecke: geloest,
          };
        }
      }
      // R-0348: eine Lücke „Und bei Teilzeit?" wäre für den Experten unlesbar — sie trägt deshalb
      // die Frage im Zusammenhang (ohne Faden ist das die Frage selbst).
      const gap = await this.createGap(
        frageImZusammenhang,
        actorId,
        opts?.demoSeed,
        locale,
        () => this.pruefeKiSperre("ergebnis", kiBeginn),
        belegbedarf,
      );
      return {
        result,
        answerId,
        gap,
        receipt,
        quellenStand,
        ...ungeprueftFeld,
        ...verschlossenFeld,
        ...zweitmeinungFeld,
        ...geltungFeld,
        ...zuschnittFeld,
        pruefrahmen,
      };
    }
    return {
      result,
      answerId,
      gap: null,
      receipt,
      quellenStand,
      ...ungeprueftFeld,
      ...verschlossenFeld,
      ...zweitmeinungFeld,
      ...geltungFeld,
      ...zuschnittFeld,
      pruefrahmen,
    };
  }

  /**
   * ============================================================================================
   * R-1630 / R-2176 — DIESELBE FRAGE, BEANTWORTET AUS DEM WISSENSSTAND ZUM STICHTAG.
   * ============================================================================================
   *
   * Regeln und Grenzen stehen in `wissensstand-vergleich.ts`. Hier läuft der Weg selbst:
   *   1. dieselbe Vorauswahl wie `ask` (heutiger Suchbestand) und derselbe Sichtfilter;
   *   2. je Kandidat die Fassung zum Stichtag (Verlauf + Versionsabbild) und ihre Freigabe
   *      (Prüfprotokoll);
   *   3. ZWEI Antworten über denselben Antwortweg — eine aus den heute freigegebenen Fassungen, eine
   *      aus den damals belegt freigegebenen Fassungen;
   *   4. je Quelle beider Antworten der Grund des Unterschieds.
   *
   * KEINE NEBENWIRKUNG WIE BEI `ask`: keine Wissenslücke, kein Antwortbeleg, kein Receipt. Der
   * Vergleich ist eine Auskunft über zwei Bestände, keine neue Frage an das Firmenwissen. Ins
   * Protokoll geht nur, DASS verglichen wurde (Zahlen, kein Fragetext) — wie `ask.query`.
   *
   * DIESELBEN GRENZEN WIE `ask` (Konsolenweg): nur freigegebenes Wissen, nichts Vertrauliches, nur was
   * der Fragende sehen darf. Eine damalige Fassung muss diese Grenzen HEUTE wie DAMALS einhalten,
   * sonst bleibt sie draussen; Schutzdaten werden an ihrem Inhalt mit der heutigen Regel geprüft.
   */
  async vergleicheWissensstand(
    question: string,
    actor: string,
    locale: ReasonerLocale,
    stichtagMs: number,
    grundlageSichtbarFuer: (ko: KnowledgeObject) => boolean,
  ): Promise<WissensstandVergleich> {
    const kiBeginn = this.kiSperre?.stand();
    const frageterme = queryTokens(question);
    const relevanz = zugeordneteSuchterme(frageterme);
    const suchterme = [...frageterme, ...relevanz.flatMap((paar) => [...paar.ergaenzt])];
    this.pruefeKiSperre("vorauswahl", kiBeginn);
    const vorauswahl = await this.prefilterCandidates(suchterme, kiBeginn);
    // BEN (Nacharbeit 4): die heutige Suchprojektion kennt nur heutige Texte. Wurde ein Fragebegriff
    // seither aus einem noch vorhandenen Objekt entfernt, fände sie es nicht — und die damals
    // tragende Fassung fehlte. Deshalb zusätzlich die Objekte, deren Fassungen bis zum Stichtag die
    // Begriffe trugen. Nachgeladen wird über `get` (Papierkorb bleibt draussen); danach gelten
    // dieselben Filter wie für die Vorauswahl. Ein Objekt in Schutzdaten-Quarantäne bleibt draussen,
    // wie es die Suche ebenfalls auslässt.
    this.pruefeKiSperre("vorauswahl", kiBeginn);
    const bekannt = new Set(vorauswahl.map((ko) => ko.id));
    const fruehereIds = await this.koService.koIdsMitPassenderFassung(
      suchterme.slice(0, ASK_PREFILTER_MAX_TERMS),
      new Date(stichtagMs).toISOString(),
      ASK_CANDIDATE_PREFILTER_LIMIT,
      () => this.pruefeKiSperre("vorauswahl", kiBeginn),
    );
    const nachgeladen = (
      await Promise.all(
        fruehereIds
          .filter((id) => !bekannt.has(id))
          .map((id) =>
            this.koService
              .get(id, () => this.pruefeKiSperre("vorauswahl", kiBeginn))
              .catch((fehler: unknown) => {
                if (fehler instanceof AskError) {
                  throw fehler;
                }
                return undefined;
              }),
          ),
      )
    ).filter((ko): ko is KnowledgeObject => ko !== undefined && !inSchutzdatenQuarantaene(ko));
    const kandidaten = dropConfidential(
      [...vorauswahl, ...nachgeladen].filter((ko) => grundlageSichtbarFuer(ko)),
    );
    // Verlauf, Abbilder und Protokoll lesen Kundeninhalt — dieselbe Sperre wie vor der Vorauswahl.
    this.pruefeKiSperre("vorauswahl", kiBeginn);
    const seiten: VergleichsSeiten[] = await Promise.all(
      kandidaten.map(async (ko) => {
        const fassung = fassungZumStichtag(
          ko,
          await this.koService.versionsOf(ko.id).catch(() => []),
          stichtagMs,
        );
        // Ohne Protokoll gibt es keinen Freigabebeleg — dann trägt keine damalige Fassung.
        const protokoll =
          fassung.art === "fassung" && this.audit
            ? await this.audit.list({ target: ko.id }).catch(() => [])
            : [];
        const frueher = fassung.art === "fassung" ? fassung.ko : null;
        return {
          heute: ko,
          grundlageHeute: ko.status === "validiert",
          fassung,
          freigabeDamals:
            fassung.art === "fassung" &&
            freigabeZumStichtagBelegt(ko, fassung.version, protokoll, stichtagMs),
          damalsZulaessig:
            frueher !== null &&
            !isConfidential(frueher.confidentiality) &&
            grundlageSichtbarFuer(frueher) &&
            !inSchutzdatenQuarantaene(frueher) &&
            erkenneSchutzdaten([
              frueher.title,
              frueher.statement,
              visibleTextFromBodyHtml(frueher.bodyHtml),
              ...(frueher.conditions ?? []),
              ...(frueher.measures ?? []),
            ]).length === 0,
        };
      }),
    );
    // Der Vertrauenswert wird nicht historisch geführt — beide Seiten tragen den heutigen, damit er
    // keinen Unterschied erzeugt, den es im Wissen nicht gibt.
    const heute = await this.antwortAusFassungen(
      question,
      seiten.filter((s) => s.grundlageHeute).map((s) => ({ ko: s.heute, trust: s.heute.trust })),
      locale,
      relevanz,
      actor,
      kiBeginn,
    );
    const damals = await this.antwortAusFassungen(
      question,
      seiten.flatMap((s) => {
        const ko = grundlageDamals(s);
        return ko ? [{ ko, trust: s.heute.trust }] : [];
      }),
      locale,
      relevanz,
      actor,
      kiBeginn,
    );
    const quellen = seiten
      .filter((s) => heute.sources.includes(s.heute.id) || damals.sources.includes(s.heute.id))
      .map((s) => {
        const id = s.heute.id;
        return vergleichsQuelle(s, heute.sources.includes(id), damals.sources.includes(id));
      });
    const geaendert = antwortGeaendert(heute, damals);
    await this.audit?.record({
      actor,
      action: "ask.vergleich",
      target: "-",
      payload: {
        stichtag: new Date(stichtagMs).toISOString(),
        kandidaten: kandidaten.length,
        grundlageHeute: seiten.filter((s) => s.grundlageHeute).length,
        grundlageDamals: seiten.filter((s) => grundlageDamals(s) !== null).length,
        antwortGeaendert: geaendert,
      },
    });
    return {
      stichtag: new Date(stichtagMs).toISOString(),
      heute,
      damals,
      antwortGeaendert: geaendert,
      quellen,
    };
  }

  /**
   * Eine Antwort aus einer festen Menge von Fassungen — derselbe Weg wie in `ask` ab der
   * Suchprojektion: Volltext aus derselben Projektionsregel, beide Auswahltore, Antwortweg, und
   * die Quellenpflicht danach. Der Volltext entsteht hier aus dem Inhalt der übergebenen Fassung
   * (`buildSearchProjection`), weil die gespeicherte Projektion nur die heutige Fassung kennt.
   */
  private async antwortAusFassungen(
    question: string,
    grundlage: readonly { ko: KnowledgeObject; trust: number }[],
    locale: ReasonerLocale,
    relevanz: Relevanztext,
    actor: string,
    kiBeginn: number | undefined,
  ): Promise<AnswerResult> {
    const jetzt = new Date(this.now()).toISOString();
    const refs = grundlage.map(({ ko, trust }): KnowledgeRef => {
      const bodyText = buildSearchProjection(ko, jetzt).bodyText;
      return {
        id: ko.id,
        title: ko.title,
        statement: ko.statement,
        status: "validiert",
        trust,
        ...(ko.captionTexts?.length ? { captionTexts: ko.captionTexts } : {}),
        ...(bodyText.trim() ? { bodyText } : {}),
      };
    });
    const ordnung = new Map<string, string[]>(
      grundlage.map(({ ko }): [string, string[]] => [ko.id, [ko.category, ...(ko.tags ?? [])]]),
    );
    const vollstaendig = refs.filter((ref) =>
      decktAlleFragebegriffe(
        question,
        [
          ref.title,
          ref.statement,
          ...(ref.captionTexts ?? []),
          ref.bodyText ?? "",
          ...(ordnung.get(ref.id) ?? []),
        ].join(" "),
        relevanz,
      ),
    );
    const candidates = waehleKandidaten(question, vollstaendig, DEFAULT_TOP_K, relevanz);
    const kontextVertraulich = grundlage.some(({ ko }) => isConfidential(ko.confidentiality));
    this.pruefeKiSperre("antwortweg", kiBeginn);
    const roh = await this.mitUebertragungssperre(() =>
      this.reasoner.answer(question, candidates, locale, kontextVertraulich, { actor }, relevanz),
    );
    this.pruefeKiSperre("ergebnis", kiBeginn);
    const { abgeschnitten: _abgeschnittenVerworfen, ...ohneAbbruch } = roh;
    return roh.answered && roh.sources.length === 0
      ? { ...ohneAbbruch, answered: false, answer: null, citedSources: [] }
      : roh;
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
    kiBeginn: number | undefined,
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
      // D5 (Runde 3, Bens Befund): zwischen den beiden Schreibaufrufen liegt ein Warten. Wurde
      // inzwischen abgeschaltet, wird der Beleg nicht fortgeschrieben.
      this.pruefeKiSperre("ergebnis", kiBeginn);
      // D5 (Lauf 3 Runde 2, Bens Befund): die Sperre reist in die Ablage — in PostgreSQL liegen
      // darin vier Anweisungen mit Wartepunkten dazwischen.
      await repo.appendSnapshot(snapshot, () => this.pruefeKiSperre("ergebnis", kiBeginn));
    } catch (fehler) {
      // Die Abschaltung ist KEIN Ablagefehler: sie wird durchgereicht, nicht zu „kein Beleg"
      // verschluckt — sonst ginge die Antwort trotz Abschaltung hinaus.
      if (fehler instanceof AskError && fehler.code === "KI_ABGESCHALTET") {
        throw fehler;
      }
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
    // RECHERCHE:pmo-fea-0002: `koOriginalAuthor` hält den Urheber zum Zeitpunkt des Danks fest.
    // Nach einer Autor-Übergabe (FR-LIF-02, `setAuthor`) zeigt `author` auf die neue Person; ohne
    // dieses Feld erführe der ursprüngliche Autor nichts mehr von der Wirkung seines Wissens.
    await this.serializeHelpful(() =>
      this.recordHelpful(koId, actor, {
        koTitle: ko.title,
        koAuthor: ko.author,
        koOriginalAuthor: ko.originalAuthor || ko.author,
      }),
    );
  }

  // R-0235 / R-0749: „Hat geholfen" für ein ANGEWENDETES Wissensobjekt, ohne vorausgehende Antwort.
  // Der Antwortbeleg entfällt hier, weil der Gegenstand nicht eine Antwort, sondern genau dieses
  // Objekt ist: die Person meldet es selbst, am Objekt (PUT /api/kos/:id, `action: "helpful"`). Die
  // Berechtigung (`ko.read` + Sichtbarkeitstor) entscheidet die Route VOR diesem Aufruf. R-0313 bleibt
  // gewahrt: das Antwortfeedback (`markHelpful`) wirkt weiterhin nur auf tragende Quellen; dieser Weg
  // wirkt nur auf das eine Objekt, das gemeldet wird, nie auf Nachbarn.
  // Derselbe gekoppelte Kern wie `markHelpful` — und derselbe Idempotenzschlüssel (actor+koId): wer
  // ein Objekt schon über eine Antwort gedankt hat, bewirkt hier nichts mehr und umgekehrt. Ein
  // Trust-Schritt je Person und Objekt, gleich über welchen Weg. Keine Prüfstimme: weder Status noch
  // Validierungen werden berührt.
  async markKoHelpful(koId: string, actor: string): Promise<void> {
    const ko = await this.koService.get(koId);
    if (!ko || ko.deletedAt) {
      throw new AskError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    await this.serializeHelpful(() =>
      this.recordHelpful(koId, actor, {
        koTitle: ko.title,
        koAuthor: ko.author,
        koOriginalAuthor: ko.originalAuthor || ko.author,
        via: "wissensobjekt",
      }),
    );
  }

  // R-1649 (ROADMAP 7.3): „Das war nicht hilfreich, ich habe es so gemacht …" — die NEGATIV-
  // BEWÄHRUNG zu genau der tragenden Quelle einer Antwort, an die sich ein abweichender Weg als
  // Wissensentwurf anschliessen kann. Dieselbe Bindung wie `markHelpful`: ohne gültigen Answer-Receipt,
  // der GENAU dieses KO diesem Nutzer als Quelle belegt, wird nichts geschrieben (403) — auch kein
  // Entwurf. Erst danach läuft `entwurf` (vom Aufrufer, die Route kennt den Erfassungsdienst), und
  // seine Kennung reist in den Audit-Beleg: so ist der neue Entwurf mit dem misslungenen Vorschlag
  // verbunden.
  // Bewusst KEIN Trust-Abzug und keine Prüfstimme: die Rückmeldung wird registriert, nicht als Urteil
  // über die Gültigkeit vollzogen. Genau ein Beleg je Person und Objekt (recordOnce); eine spätere
  // zweite Meldung derselben Person legt ihren Entwurf trotzdem an — neues Wissen geht nicht verloren
  // —, schreibt aber keinen zweiten Beleg (`vermerkt: false`).
  async markNotHelpful(
    receipt: string,
    koId: string,
    actor: string,
    entwurf?: () => Promise<string>,
  ): Promise<{ vermerkt: boolean; entwurfId: string | null }> {
    const bound = verifyAnswerReceipt(this.receiptSecret, receipt, this.now());
    if (!bound || bound.userId !== actor || !bound.sources.includes(koId)) {
      throw new AskError("FORBIDDEN", "Kein gültiger Antwort-Beleg für dieses Wissensobjekt.");
    }
    const ko = await this.koService.get(koId);
    if (!ko || ko.deletedAt) {
      throw new AskError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    const entwurfId = entwurf ? await entwurf() : null;
    const audit = this.audit;
    if (!audit) {
      // Degenerationsfall ohne Audit (Dev/Tests): es gibt keinen Ort, an dem der Vermerk stünde.
      return { vermerkt: false, entwurfId };
    }
    const vermerkt = await this.serializeHelpful(() =>
      audit.recordOnce(`answer.not_helpful:${actor}:${koId}`, {
        actor,
        action: "answer.not_helpful",
        target: koId,
        payload: {
          koTitle: ko.title,
          koAuthor: ko.author,
          koOriginalAuthor: ko.originalAuthor || ko.author,
          ...(entwurfId ? { entwurfId } : {}),
        },
      }),
    );
    return { vermerkt, entwurfId };
  }

  // FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): der gekoppelte Kern des „Danke". recordOnce (Event-CAS) und
  // der atomare Trust-Inkrement liegen in DERSELBEN Persistenz-Transaktion (gemeinsamer TxContext), so
  // dass entweder BEIDE oder KEINE wirksam werden. Fail-forward: schlägt der Trust-Schritt fehl, rollt
  // die Transaktion den bereits geschriebenen Event-Beleg zurück — ein Retry zieht sauber nach (kein
  // „Beleg ohne Trust", nach dem jeder Retry ein No-op wäre).
  private async recordHelpful(
    koId: string,
    actor: string,
    // `via` nur beim Objektweg (markKoHelpful); das Antwortfeedback trägt es nicht.
    payload: { koTitle: string; koAuthor: string; koOriginalAuthor: string; via?: "wissensobjekt" },
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

  // R-1089 / R-1721: „Antwort falsch" bzw. „Quelle passt nicht" melden. Dieselbe Beleg-Bindung wie
  // `markHelpful` — nur eine in DIESEM Antwortvorgang ausgelieferte Quelle ist meldbar. Zugestellt
  // wird an `responsibleOf(ko)`; die Glocke dieser Person liest den Eintrag (notifications-routes).
  // Kein Trust-Abzug: eine Meldung ist ein Hinweis an einen Menschen, kein Urteil über das Objekt.
  async reportAnswer(
    receipt: string,
    koId: string,
    grund: unknown,
    actor: string,
  ): Promise<AntwortMeldungQuittung> {
    if (!isAntwortMeldeGrund(grund)) {
      throw new AskError("BAD_REQUEST", "Unbekannter Meldegrund.");
    }
    const bound = verifyAnswerReceipt(this.receiptSecret, receipt, this.now());
    if (!bound || bound.userId !== actor || !bound.sources.includes(koId)) {
      throw new AskError("FORBIDDEN", "Kein gültiger Antwort-Beleg für dieses Wissensobjekt.");
    }
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new AskError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    // Ohne Protokoll gibt es keinen Weg zum Verantwortlichen — dann wird nichts quittiert, was
    // niemand je sehen würde. In Produktion ist das Protokoll immer verdrahtet.
    const audit = this.audit;
    if (!audit) {
      throw new AskError("NOT_FOUND", "Meldeweg nicht verfügbar.");
    }
    const eventId = antwortMeldungEventId(actor, koId, grund, receipt);
    const meldungId = antwortMeldungId(eventId);
    const won = await audit.recordOnce(eventId, {
      actor,
      action: ANTWORT_MELDUNG_ACTION,
      target: koId,
      payload: {
        meldungId,
        grund,
        koTitle: ko.title,
        responsible: responsibleOf(ko),
        responsibleKind: responsibleKindOf(ko),
      },
    });
    // Ben (Nacharbeit 3): die Quittung beschreibt die Zustellung, die TATSÄCHLICH gilt — und das
    // ist die gespeicherte. Bei einer Wiederholung hat `recordOnce` das erste Ereignis behalten;
    // wurde inzwischen ein Eigentümer benannt oder der Titel geändert, liegt die Meldung trotzdem
    // beim damaligen Empfänger (die Glocke liest `responsible` aus genau diesem Ereignis). Zustellart
    // und Titel kommen deshalb aus dem Ereignis, nicht aus dem heutigen Objekt.
    const eintrag = (await audit.list({ action: ANTWORT_MELDUNG_ACTION, target: koId })).find(
      (e) => e.eventId === eventId,
    );
    const gespeichert = eintrag?.payload ?? {};
    const kind = gespeichert.responsibleKind;
    return {
      meldungId,
      koId,
      koTitle: typeof gespeichert.koTitle === "string" ? gespeichert.koTitle : ko.title,
      grund,
      at: eintrag?.at ?? new Date(this.now()).toISOString(),
      zugestelltAn: kind === "owner" || kind === "author-fallback" ? kind : responsibleKindOf(ko),
      bereitsGemeldet: !won,
    };
  }

  // FR-ASK-05: Wissenslücken verwalten.
  //
  // produkt:20261010:wissenskreislauf-schliessen: jede Zuordnung wird mit Handelndem, Zeitpunkt und
  // Art festgehalten (`zuordnungen`) — die nachvollziehbare Neuzuordnung, wenn die zuständige Person
  // nicht mehr verfügbar ist. DIESELBE Person ein zweites Mal zuzuordnen (Doppelklick, Wiederholung)
  // ändert nichts und schreibt keinen zweiten Eintrag. Eine geschlossene Lücke wird nicht mehr
  // zugeordnet. Ob die Person BERECHTIGT ist, entscheidet die Route (Konto freigegeben, `ko.create`).
  async assignGap(
    id: string,
    expertId: string,
    actor?: string,
    art: "zuordnung" | "uebergabe" = "zuordnung",
  ): Promise<Gap> {
    const von = aufruferBeschriftung(aufruferAus(actor));
    const { gap, geschrieben } = await this.aendereLuecke(id, (aktuell) => {
      if (aktuell.status !== "offen") {
        throw new AskError(
          "BAD_REQUEST",
          "Eine geschlossene Wissenslücke wird nicht mehr zugeordnet.",
        );
      }
      if (aktuell.assignee === expertId) {
        return null;
      }
      const zuordnung: GapZuordnung = {
        an: expertId,
        von,
        at: new Date(this.now()).toISOString(),
        art: aktuell.assignee ? "neuzuordnung" : art,
      };
      return {
        ...aktuell,
        assignee: expertId,
        zuordnungen: [...(aktuell.zuordnungen ?? []), zuordnung],
      };
    });
    const geschriebeneArt = gap.zuordnungen?.[gap.zuordnungen.length - 1]?.art;
    if (geschrieben && geschriebeneArt) {
      await this.audit?.record({
        actor: von,
        action: "gap.assigned",
        target: id,
        payload: { an: expertId, art: geschriebeneArt },
      });
    }
    return gap;
  }

  // ==============================================================================================
  // R-0846 / L6 → produkt:20261010:wissenskreislauf-schliessen — FACHLICHER ABSCHLUSS NUR MIT
  // NUTZBAREM, FREIGEGEBENEM WISSEN.
  // ==============================================================================================
  //
  // Der Bezug kommt aus dem Aufruf oder, fehlt er dort, aus dem an der Lücke verknüpften Entwurf.
  // Bis hierher genügte, dass das Objekt existiert und nicht im Papierkorb liegt — damit schloss ein
  // ungeprüfter Entwurf die Lücke als „gelöst". Jetzt muss es HEUTE für die abschliessende Person
  // ein nutzbares Ergebnis sein (`pruefeFachlicheNutzbarkeit`): sichtbar, validiert, vorgeschriebene
  // Bewertungen der AKTUELLEN Fassung, keine rote Stimme, nicht abgelaufen. Sonst wird NICHTS
  // geschrieben, die Lücke bleibt offen, der Aufrufer bekommt die Gründe (`GapAbschlussVerweigert`).
  //
  // Festgehalten wird die geprüfte FASSUNG (`abschluss.koVersion`). Geschrieben wird nur, solange die
  // Lücke offen ist: ein Doppelklick, ein zweiter Abschliessender oder ein Neustart erzeugt keinen
  // zweiten Abschluss und damit keine zweite Meldung. Ein zweiter Aufruf mit demselben Eintrag bekommt
  // den bestehenden Abschluss zurück.
  //
  // Ben, Nacharbeit 3: die Abschlussfelder werden am AKTUELLEN Datensatz gesetzt (`aendereLuecke`,
  // Vergleichen-und-Setzen), nicht an der Momentaufnahme vom Anfang. Wer während der Fachprüfabfrage
  // dieselbe Frage stellte, bleibt Fragender — mit Vorgangszugriff und Abschlussmeldung — und der
  // Zähler bleibt, wie er ist. Zurück kommt der tatsächlich gespeicherte Stand.
  //
  // Ohne `sichtbar` (Systemaufruf ohne Betrachter) gilt die Sichtbarkeitsfrage als beantwortet — es
  // gibt keinen Menschen, dessen Recht zu prüfen wäre. Die Fachprüfung gilt trotzdem vollständig.
  //
  // Ben, Nacharbeit 5: Das Vergleichen-und-Setzen schützt nur den Lückendatensatz. Eintrag und
  // Bewertungen liegen in anderen Ablagen und können sich zwischen Prüfung und Schreiben ändern
  // (neue Fassung, rote Stimme).
  //
  // Ben, Nacharbeit 7/8: Ein Abschluss wird erst gespeichert, wenn er auf dem Stand beruht, der beim
  // Schreiben gilt — es gibt keinen vorläufigen Zwischenstand, und eine Änderung an Eintrag oder
  // Bewertungen nach der letzten Prüfung verhindert das Schreiben. Deshalb läuft JEDER Versuch
  // vollständig in der Schreibklammer des Eintrags (`KoService.unterSchreibsperre`), in der auch
  // Bewertungen und Überarbeitungen schreiben:
  //   1. Lücke frisch lesen; Status, Entwurfsbezug und — bei `rolleVerlangt` — das Abschlussrecht
  //      an der AKTUELLEN Zuordnung prüfen;
  //   2. Eintrag, Fachprüfstand der aktuellen Fassung und Nutzbarkeit frisch erheben;
  //   3. die Lücke schreiben, nur wenn sie noch genau den Stand aus 1 hält (Vergleichen-und-Setzen).
  // Während 1–3 wird an diesem Eintrag nichts gespeichert: eine Bewertung oder neue Fassung kommt
  // vorher (dann sieht 2 sie und verweigert) oder nachher (dann ist sie eine Änderung NACH dem
  // Abschluss, und Meldung, Vorgang und Wiederholungsfrage prüfen sie bei jedem Abruf). Ein
  // paralleler Abschlussaufruf wartet auf die Klammer und sieht danach den fertigen Abschluss.
  // Scheitert ein Schritt oder bricht der Prozess ab, ist nichts geschrieben. Protokolliert wird
  // erst nach 3.
  async closeGap(
    id: string,
    koId?: string,
    beteiligter?: {
      readonly id: string;
      readonly sichtbar: (ko: KnowledgeObject) => boolean;
      readonly verwaltend?: boolean;
    },
    optionen: { readonly rolleVerlangt?: boolean } = {},
  ): Promise<Gap> {
    const gap = await this.require(id);
    const bezug = koId?.trim() || gap.koId?.trim();
    if (!bezug) {
      throw new AskError(
        "BAD_REQUEST",
        "Eine Wissenslücke wird mit dem Wissensobjekt geschlossen, das sie beantwortet (koId).",
      );
    }
    const sichtbar = beteiligter?.sichtbar ?? (() => true);
    const von = aufruferBeschriftung(aufruferAus(beteiligter?.id));
    // Am Stand, gegen den geschrieben wird.
    const vorbedingung = (aktuell: Gap): void => {
      // Ben, Nacharbeit 5: das Abschlussrecht an der Zuordnung, die JETZT gilt — nicht an der vom
      // Anfang. Nach einer Neuzuordnung schliesst die frühere zuständige Person nicht mehr ab.
      if (optionen.rolleVerlangt) {
        this.verlangeZustaendigOderVerwaltend(aktuell, {
          id: beteiligter?.id ?? "",
          verwaltend: beteiligter?.verwaltend === true,
          sichtbar,
        });
      }
      // Ohne mitgeschickten Bezug trägt der verknüpfte Entwurf — er darf sich seit der Prüfung
      // nicht geändert haben, sonst schlösse ein ungeprüfter Eintrag.
      if (!koId?.trim() && aktuell.koId?.trim() !== bezug) {
        throw new AskError(
          "CONFLICT",
          "Der verknüpfte Antwortentwurf hat sich geändert — bitte erneut abschliessen.",
        );
      }
    };
    for (let versuch = 0; versuch < LUECKE_SCHREIBVERSUCHE; versuch += 1) {
      const ergebnis = await this.unterKoSperre(
        bezug,
        async (): Promise<{ gap: Gap; geschrieben: boolean } | null> => {
          const gelesen = await this.gaps.findById(id);
          if (!gelesen) {
            throw new AskError("NOT_FOUND", "Wissenslücke nicht gefunden.");
          }
          const aktuell = withPriority(gelesen);
          if (aktuell.status !== "offen") {
            // Ein anderer Abschluss kam zuvor. Ist es derselbe Eintrag, ist das Ergebnis dasselbe.
            if (aktuell.abschluss?.art === "fachlich" && aktuell.abschluss.koId === bezug) {
              return { gap: aktuell, geschrieben: false };
            }
            throw new AskError("BAD_REQUEST", "Die Wissenslücke ist bereits geschlossen.");
          }
          vorbedingung(aktuell);
          const { ko, nutzbarkeit } = await this.abschlussPruefung(bezug, sichtbar);
          if (!ko) {
            throw new AskError(
              "BAD_REQUEST",
              "Das Wissensobjekt existiert nicht oder liegt im Papierkorb — die Lücke bleibt offen.",
            );
          }
          if (!nutzbarkeit.nutzbar) {
            throw new GapAbschlussVerweigert(nutzbarkeit.gruende);
          }
          const neu: Gap = {
            ...aktuell,
            status: "geschlossen",
            koId: bezug,
            abschluss: {
              art: "fachlich",
              koId: bezug,
              koVersion: ko.version,
              von,
              at: new Date(this.now()).toISOString(),
            },
          };
          // Die Lücke hat sich seit 1 geändert (weitere Fragende, Zuordnung …): neu, vollständig.
          return (await this.ersetzeWenn(gelesen, neu)) ? { gap: neu, geschrieben: true } : null;
        },
      );
      if (ergebnis === null) {
        continue;
      }
      if (ergebnis.geschrieben && ergebnis.gap.abschluss?.art === "fachlich") {
        await this.audit?.record({
          actor: von,
          action: "gap.closed",
          target: id,
          payload: { koId: bezug, koVersion: ergebnis.gap.abschluss.koVersion },
        });
      }
      return ergebnis.gap;
    }
    throw new AskError(
      "CONFLICT",
      "Die Wissenslücke wurde gerade mehrfach geändert — der Abschluss wurde nicht ausgeführt.",
    );
  }

  /** Eintrag, Fachprüfstand der aktuellen Fassung und Nutzbarkeit — frisch erhoben. */
  private async abschlussPruefung(
    koId: string,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<{ ko: KnowledgeObject | undefined; nutzbarkeit: FachlicheNutzbarkeit }> {
    const ko = await this.koService.get(koId);
    const stand = await this.pruefstandVon(ko);
    return { ko, nutzbarkeit: await this.nutzbarkeitMit(ko, stand, sichtbar) };
  }

  /**
   * `fn` in der Schreibklammer des Eintrags (`KoService.unterSchreibsperre`) — dieselbe, in der
   * Bewertungen und Überarbeitungen schreiben. Eine Attrappe ohne die Methode (Testdoppel) läuft
   * ohne Klammer.
   */
  private unterKoSperre<T>(koId: string, fn: () => Promise<T>): Promise<T> {
    const sperre = (this.koService as Partial<Pick<KoService, "unterSchreibsperre">>)
      .unterSchreibsperre;
    return sperre ? this.koService.unterSchreibsperre(koId, fn) : fn();
  }

  /**
   * Ein FRAGENDER übergibt seine Lücke an eine Fachzuständigkeit — solange niemand zuständig ist
   * oder die zuständige Person nicht mehr verfügbar ist. Eine laufende Zuständigkeit nimmt ein
   * Fragender nicht weg; das bleibt eine Neuzuordnung durch Verwaltende. Dass die Zielperson
   * berechtigt ist, hat die Route vorher festgestellt.
   */
  async handOverGap(
    id: string,
    expertId: string,
    beteiligter: GapBeteiligter,
    zustaendigVerfuegbar: boolean | null,
  ): Promise<Gap> {
    const gap = await this.require(id);
    if (!istFragender(gap, beteiligter.id)) {
      throw new AskError("FORBIDDEN", "Übergeben können die Fragenden dieser Lücke.");
    }
    if (gap.assignee === expertId) {
      return gap;
    }
    if (gap.assignee !== null && zustaendigVerfuegbar !== false) {
      throw new AskError(
        "FORBIDDEN",
        "Die Lücke hat eine verfügbare zuständige Person — eine Neuzuordnung nehmen Verwaltende vor.",
      );
    }
    return this.assignGap(id, expertId, beteiligter.id, "uebergabe");
  }

  /** Der fachliche Abschluss durch die zuständige Person oder Verwaltende (`closeGap`). */
  async closeGapAlsBeteiligter(
    id: string,
    koId: string | undefined,
    beteiligter: GapBeteiligter,
  ): Promise<Gap> {
    // Früh abweisen, was schon jetzt nicht darf — massgeblich ist aber die Prüfung im Schreibschritt
    // an der dann geltenden Zuordnung (Ben, Nacharbeit 5).
    this.verlangeZustaendigOderVerwaltend(await this.require(id), beteiligter);
    return this.closeGap(id, koId, beteiligter, { rolleVerlangt: true });
  }

  /**
   * Die ADMINISTRATIVE Rücknahme — ausdrücklich KEIN fachlicher Abschluss. Sie schliesst die Lücke
   * mit einem geschlossenen Grund (`GAP_RUECKNAHME_GRUENDE`), ohne Wissenseintrag; die Fragenden
   * sehen „zurückgenommen" mit Grund, nie „gelöst", und es entsteht keine Erfolgsmeldung.
   */
  async withdrawGap(id: string, grund: GapRuecknahmeGrund, actor: string): Promise<Gap> {
    if (!isGapRuecknahmeGrund(grund)) {
      throw new AskError("BAD_REQUEST", "Unbekannter Grund der Rücknahme.");
    }
    const von = aufruferBeschriftung(aufruferAus(actor));
    const { gap, geschrieben } = await this.aendereLuecke(id, (aktuell) => {
      if (aktuell.status !== "offen") {
        if (aktuell.abschluss?.art === "administrativ" && aktuell.abschluss.grund === grund) {
          return null;
        }
        throw new AskError("BAD_REQUEST", "Die Wissenslücke ist bereits geschlossen.");
      }
      return {
        ...aktuell,
        status: "geschlossen",
        abschluss: { art: "administrativ", grund, von, at: new Date(this.now()).toISOString() },
      };
    });
    if (geschrieben) {
      await this.audit?.record({
        actor: von,
        action: "gap.withdrawn",
        target: id,
        payload: { grund },
      });
    }
    return gap;
  }

  /**
   * Die zuständige Person verknüpft ihren Antwortentwurf — das Wissensobjekt, das über die
   * vorhandene Erfassung entstanden ist und jetzt die vorhandene Fachprüfung durchläuft. Die Lücke
   * bleibt OFFEN: eine Verknüpfung ist kein Abschluss. Nur die zuständige Person oder Verwaltende,
   * nur mit einem Objekt, das sie sehen darf. Dieselbe Verknüpfung ein zweites Mal ändert nichts.
   */
  async linkGapDraft(id: string, koId: string, beteiligter: GapBeteiligter): Promise<Gap> {
    const gap = await this.require(id);
    this.verlangeZustaendigOderVerwaltend(gap, beteiligter);
    if (gap.status !== "offen") {
      throw new AskError("BAD_REQUEST", "Die Wissenslücke ist bereits geschlossen.");
    }
    const bezug = koId.trim();
    const ko = bezug ? await this.koService.get(bezug) : null;
    if (!ko || !beteiligter.sichtbar(ko)) {
      throw new AskError(
        "BAD_REQUEST",
        "Das Wissensobjekt existiert nicht oder ist für dich nicht zugänglich.",
      );
    }
    // Ben, Nacharbeit 3: Zustand und Rolle werden am AKTUELLEN Datensatz erneut geprüft — eine
    // verspätete Verknüpfung öffnet keinen inzwischen geschlossenen Vorgang wieder.
    const ergebnis = await this.aendereLuecke(id, (aktuell) => {
      this.verlangeZustaendigOderVerwaltend(aktuell, beteiligter);
      if (aktuell.status !== "offen") {
        throw new AskError("BAD_REQUEST", "Die Wissenslücke ist bereits geschlossen.");
      }
      return aktuell.koId === bezug ? null : { ...aktuell, koId: bezug };
    });
    if (ergebnis.geschrieben) {
      await this.audit?.record({
        actor: beteiligter.id,
        action: "gap.draft-linked",
        target: id,
        payload: { koId: bezug },
      });
    }
    return ergebnis.gap;
  }

  /**
   * Eine Rückfrage der zuständigen Person an die Fragenden. Höchstens EINE ist zugleich offen;
   * dieselbe Rückfrage ein zweites Mal (Doppelklick) ändert nichts. Der Text steht NUR an der Lücke
   * (Fragende und zuständige Person) — nicht im Prüfprotokoll.
   */
  async askGapFollowUp(id: string, beteiligter: GapBeteiligter, frage: string): Promise<Gap> {
    const text = rueckfrageText(frage);
    const rueckfrageId = this.genId();
    const { gap, geschrieben } = await this.aendereLuecke(id, (aktuell) => {
      if (!istZustaendig(aktuell, beteiligter.id)) {
        throw new AskError("FORBIDDEN", "Rückfragen stellt die zuständige Person.");
      }
      if (aktuell.status !== "offen") {
        throw new AskError("BAD_REQUEST", "Die Wissenslücke ist bereits geschlossen.");
      }
      const offen = (aktuell.rueckfragen ?? []).find((r) => r.antwort === undefined);
      if (offen) {
        if (offen.frage === text) {
          return null;
        }
        throw new AskError("BAD_REQUEST", "Es ist bereits eine Rückfrage offen.");
      }
      const rueckfrage: GapRueckfrage = {
        id: rueckfrageId,
        frage: text,
        von: beteiligter.id,
        at: new Date(this.now()).toISOString(),
      };
      return { ...aktuell, rueckfragen: [...(aktuell.rueckfragen ?? []), rueckfrage] };
    });
    if (geschrieben) {
      await this.audit?.record({
        actor: beteiligter.id,
        action: "gap.followup-asked",
        target: id,
        payload: { rueckfrageId },
      });
    }
    return gap;
  }

  /** Ein Fragender beantwortet die offene Rückfrage. Eine beantwortete bleibt beantwortet. */
  async answerGapFollowUp(
    id: string,
    rueckfrageId: string,
    beteiligter: GapBeteiligter,
    antwort: string,
  ): Promise<Gap> {
    const text = rueckfrageText(antwort);
    // Ben, Nacharbeit 3: eine VERSPÄTETE Antwort trifft den aktuellen Datensatz. Ist der Vorgang
    // inzwischen geschlossen, wird nichts geschrieben — Abschluss und Abschlussdaten bleiben.
    const { gap, geschrieben } = await this.aendereLuecke(id, (aktuell) => {
      if (!istFragender(aktuell, beteiligter.id)) {
        throw new AskError("FORBIDDEN", "Rückfragen beantworten die Fragenden.");
      }
      const ziel = (aktuell.rueckfragen ?? []).find((r) => r.id === rueckfrageId);
      if (!ziel) {
        throw new AskError("NOT_FOUND", "Rückfrage nicht gefunden.");
      }
      if (ziel.antwort !== undefined) {
        if (ziel.antwort === text) {
          return null;
        }
        throw new AskError("BAD_REQUEST", "Die Rückfrage ist bereits beantwortet.");
      }
      if (aktuell.status !== "offen") {
        throw new AskError("BAD_REQUEST", "Die Wissenslücke ist bereits geschlossen.");
      }
      return {
        ...aktuell,
        rueckfragen: (aktuell.rueckfragen ?? []).map((r) =>
          r.id === rueckfrageId
            ? {
                ...r,
                antwort: text,
                beantwortetVon: beteiligter.id,
                beantwortetAm: new Date(this.now()).toISOString(),
              }
            : r,
        ),
      };
    });
    if (geschrieben) {
      await this.audit?.record({
        actor: beteiligter.id,
        action: "gap.followup-answered",
        target: id,
        payload: { rueckfrageId },
      });
    }
    return gap;
  }

  /**
   * ============================================================================================
   * DER VORGANG, WIE EIN BETEILIGTER IHN SIEHT — FRISCH AUS DEM HEUTIGEN STAND.
   * ============================================================================================
   *
   * Beteiligt ist, wer gefragt hat, wer zuständig ist, und wer verwaltet (`ko.assign`). Allen
   * anderen antwortet der Vorgang mit NOT_FOUND — dieselbe Auskunft wie für eine unbekannte
   * Kennung, damit die Existenz einer fremden Lücke nicht über diesen Weg erfragt werden kann.
   * Verwaltende ohne eigene Beteiligung bekommen den Ablauf, aber keinen Fragetext und keine
   * Rückfragetexte (R-0585: das Rollenrecht öffnet keinen Fragetext).
   *
   * Ergebnis und Entwurf werden bei JEDEM Abruf neu gegen die Rechte DIESES Betrachters und den
   * heutigen Fachprüfstand geprüft: ein inzwischen entzogenes Recht zeigt „nicht zugänglich", eine
   * inzwischen veränderte oder gesperrte Fassung zeigt „nicht nutzbar" — nie ein altes „gelöst".
   */
  async gapVorgang(
    id: string,
    beteiligter: GapBeteiligter,
    zustaendigVerfuegbar?: (personId: string) => Promise<boolean | null>,
  ): Promise<GapVorgangSicht> {
    const gap = await this.require(id);
    const rollen: GapVorgangsrolle[] = [];
    if (istFragender(gap, beteiligter.id)) {
      rollen.push("fragend");
    }
    if (istZustaendig(gap, beteiligter.id)) {
      rollen.push("zustaendig");
    }
    if (beteiligter.verwaltend) {
      rollen.push("verwaltend");
    }
    if (rollen.length === 0) {
      throw new AskError("NOT_FOUND", "Wissenslücke nicht gefunden.");
    }
    const textBerechtigt = rollen.includes("fragend") || rollen.includes("zustaendig");
    const verfuegbar =
      gap.status === "offen" && gap.assignee !== null && zustaendigVerfuegbar
        ? await zustaendigVerfuegbar(gap.assignee).catch(() => null)
        : null;
    const eintragFuer = async (
      koId: string,
    ): Promise<GapVorgangEintrag | { readonly zugaenglich: false }> => {
      const ko = await this.koService.get(koId);
      const nutzbarkeit = await this.nutzbarkeitVon(ko, beteiligter.sichtbar);
      if (!ko || nutzbarkeit.gruende.includes("kein_zugriff")) {
        return { zugaenglich: false };
      }
      return vorgangEintrag(ko, nutzbarkeit);
    };
    const entwurf = gap.status === "offen" && gap.koId ? await eintragFuer(gap.koId) : null;
    const ergebnis =
      gap.status === "geschlossen" && gap.abschluss?.art === "fachlich"
        ? await eintragFuer(gap.abschluss.koId)
        : null;
    const entwurfNutzbar =
      entwurf === null ? null : "nutzbarkeit" in entwurf ? entwurf.nutzbarkeit.nutzbar : false;
    const phase = vorgangsphase(gap, { zustaendigVerfuegbar: verfuegbar, entwurfNutzbar });
    return {
      id: gap.id,
      question: textBerechtigt ? gap.question : "",
      status: gap.status,
      phase,
      rollen,
      naechsterSchritt: naechsterSchritt(phase, rollen),
      zustaendig: gap.assignee ? { id: gap.assignee, verfuegbar } : null,
      fragende: Math.max(1, fragendeVon(gap).length),
      askCount: typeof gap.askCount === "number" ? gap.askCount : null,
      zuordnungen: (gap.zuordnungen ?? []).map(({ an, art, at }) => ({ an, art, at })),
      rueckfragen: (gap.rueckfragen ?? []).map((r) => ({
        id: r.id,
        frage: textBerechtigt ? r.frage : "",
        at: r.at,
        ...(r.antwort !== undefined ? { antwort: textBerechtigt ? r.antwort : "" } : {}),
        ...(r.beantwortetAm ? { beantwortetAm: r.beantwortetAm } : {}),
        ...(r.beantwortetVon === beteiligter.id ? { vonMirBeantwortet: true } : {}),
      })),
      entwurf,
      ergebnis,
      abschluss: abschlussSicht(gap.abschluss),
    };
  }

  /**
   * ============================================================================================
   * DIE RÜCKMELDUNGEN AN DIESE PERSON — ABGELEITET, NICHT ZUGESTELLT.
   * ============================================================================================
   *
   * Es gibt keinen zweiten Meldungsspeicher und keinen Versand, der unabhängig vom Abschluss scheitern
   * könnte: die Meldung ist eine Sicht auf den gespeicherten Lückenstand, gebaut bei jedem Abruf der
   * Glocke. Daraus folgt, was der Auftrag verlangt:
   *   · je Lücke, Eintrag und Fassung GENAU EINE Meldung je Fragendem (`abschlussMeldungId`) —
   *     Wiederholung und Neustart erzeugen keine zweite;
   *   · eine Erfolgsmeldung NUR, wenn der Eintrag HEUTE für diese Person nutzbar ist. Ein entzogenes
   *     Recht, eine abgelaufene oder gesperrte Fassung, ein Lesefehler: keine Erfolgsmeldung — der
   *     Vorgang selbst sagt dann, warum;
   *   · Rückfragen erscheinen bei den Fragenden, beantwortete Rückfragen bei der zuständigen Person.
   */
  async gapMeldungenFuer(
    nutzerId: string,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<GapMeldung[]> {
    const meldungen: GapMeldung[] = [];
    for (const gap of await this.listGaps()) {
      const fragend = istFragender(gap, nutzerId);
      if (fragend && gap.status === "geschlossen" && gap.abschluss?.art === "fachlich") {
        const abschluss = gap.abschluss;
        try {
          const ko = await this.koService.get(abschluss.koId);
          const nutzbarkeit = await this.nutzbarkeitVon(ko, sichtbar);
          if (ko && nutzbarkeit.nutzbar) {
            meldungen.push({
              id: abschlussMeldungId(gap.id, ko.id, ko.version),
              art: "geloest",
              gapId: gap.id,
              at: abschluss.at,
              title: ko.title,
              koId: ko.id,
            });
          }
        } catch {
          // Nicht lesbar heisst nicht gemeldet — kein Erfolg ohne Beleg.
        }
      }
      if (gap.status !== "offen") {
        continue;
      }
      for (const r of gap.rueckfragen ?? []) {
        if (fragend && r.antwort === undefined) {
          meldungen.push({
            id: rueckfrageMeldungId(gap.id, r.id),
            art: "rueckfrage",
            gapId: gap.id,
            at: r.at,
            title: gap.question,
          });
        }
        if (istZustaendig(gap, nutzerId) && r.antwort !== undefined && r.beantwortetAm) {
          meldungen.push({
            id: `${rueckfrageMeldungId(gap.id, r.id)}-antwort`,
            art: "rueckfrage_beantwortet",
            gapId: gap.id,
            at: r.beantwortetAm,
            title: gap.question,
          });
        }
      }
    }
    return meldungen;
  }

  /** Die fachliche Nutzbarkeit eines Eintrags mit FRISCH erhobenem Prüfstand (fail-closed). */
  private async nutzbarkeitVon(
    ko: KnowledgeObject | null | undefined,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<FachlicheNutzbarkeit> {
    return this.nutzbarkeitMit(ko, await this.pruefstandVon(ko), sichtbar);
  }

  /** Der Fachprüfstand der Fassung dieses Objekts; nicht ermittelbar → `null` (fail-closed). */
  private async pruefstandVon(
    ko: KnowledgeObject | null | undefined,
  ): Promise<GapPruefstand | null> {
    if (!ko || !this.pruefstand) {
      return null;
    }
    return this.pruefstand(ko.id, ko.version).catch(() => null);
  }

  private async nutzbarkeitMit(
    ko: KnowledgeObject | null | undefined,
    stand: GapPruefstand | null,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<FachlicheNutzbarkeit> {
    const gelernt = this.halbwertszeiten
      ? await this.halbwertszeiten().catch(() => undefined)
      : undefined;
    return pruefeFachlicheNutzbarkeit({
      ko,
      pruefstand: stand,
      jetztMs: this.now(),
      gelernt,
      sichtbar,
    });
  }

  /** Der Eintrag einer fachlich gelösten gleichen Frage — wenn er HEUTE für diesen Betrachter trägt. */
  private async geloesterEintragFuer(
    frage: string,
    sichtbar: (ko: KnowledgeObject) => boolean,
  ): Promise<AskResult["geloesteLuecke"] | null> {
    const schluessel = gapCompareKey(frage);
    if (!schluessel) {
      return null;
    }
    const kandidaten = (await this.gaps.all())
      .filter(
        (g) =>
          g.status === "geschlossen" &&
          g.abschluss?.art === "fachlich" &&
          g.compareKey === schluessel,
      )
      .sort((a, b) => ((a.abschluss?.at ?? "") < (b.abschluss?.at ?? "") ? 1 : -1));
    for (const g of kandidaten) {
      if (g.abschluss?.art !== "fachlich") {
        continue;
      }
      const ko = await this.koService.get(g.abschluss.koId);
      if (ko && (await this.nutzbarkeitVon(ko, sichtbar)).nutzbar) {
        return { koId: ko.id, koVersion: ko.version, titel: ko.title };
      }
    }
    return null;
  }

  private verlangeZustaendigOderVerwaltend(gap: Gap, beteiligter: GapBeteiligter): void {
    if (!istZustaendig(gap, beteiligter.id) && !beteiligter.verwaltend) {
      throw new AskError("FORBIDDEN", "Diesen Schritt führt die zuständige Person aus.");
    }
  }

  /**
   * ============================================================================================
   * produkt:20261010:wissenskreislauf-schliessen (Ben, Nacharbeit 3) — JEDER SCHRITT AM AKTUELLEN STAND.
   * ============================================================================================
   *
   * Bis hierher schrieben die Vorgangsschritte die Lücke als GANZES zurück, so wie sie am Anfang
   * des Schritts gelesen war. Lag dazwischen ein `await` (Fachprüfabfrage, Ablage), überschrieb
   * die alte Momentaufnahme, was inzwischen geschehen war: weitere Fragende und Zähler gingen
   * verloren, und eine verspätete Rückfrageantwort konnte einen fachlichen Abschluss entfernen.
   *
   * Jetzt rechnet `schritt` den neuen Stand aus dem GERADE gelesenen, und geschrieben wird nur,
   * wenn die Ablage noch genau diesen Stand hält (`GapRepo.ersetzeWenn`, Vergleichen-und-Setzen).
   * Sonst beginnt der Schritt am frischen Stand von vorn — dort greifen seine Prüfungen erneut
   * (geschlossen bleibt geschlossen). `schritt` gibt `null` zurück, wenn nichts zu schreiben ist;
   * er darf werfen. Zurück kommt der TATSÄCHLICH gespeicherte Stand.
   */
  private async aendereLuecke(
    id: string,
    schritt: (aktuell: Gap) => Gap | null,
  ): Promise<{ gap: Gap; geschrieben: boolean }> {
    for (let versuch = 0; versuch < LUECKE_SCHREIBVERSUCHE; versuch += 1) {
      const gelesen = await this.gaps.findById(id);
      if (!gelesen) {
        throw new AskError("NOT_FOUND", "Wissenslücke nicht gefunden.");
      }
      const aktuell = withPriority(gelesen);
      const neu = schritt(aktuell);
      if (neu === null) {
        return { gap: aktuell, geschrieben: false };
      }
      if (await this.ersetzeWenn(gelesen, neu)) {
        return { gap: neu, geschrieben: true };
      }
    }
    throw new AskError(
      "CONFLICT",
      "Die Wissenslücke wurde gerade mehrfach geändert — der Schritt wurde nicht ausgeführt.",
    );
  }

  /** Vergleichen-und-Setzen über die Ablage; ohne die Methode mit Vergleich direkt davor. */
  private async ersetzeWenn(erwartet: Gap, neu: Gap): Promise<boolean> {
    if (this.gaps.ersetzeWenn) {
      return this.gaps.ersetzeWenn(erwartet, neu);
    }
    if (!gleicherLueckenstand(await this.gaps.findById(neu.id), erwartet)) {
      return false;
    }
    await this.gaps.update(neu);
    return true;
  }

  // SCRUM-115 / FE-RISK-02: Priorität einer Wissenslücke setzen.
  //
  // P-PRUEFEN-VOLLTEXT / JOB 3290 B: der Handelnde kommt vom AUFRUFER. Bis hierher stand im
  // Protokoll fest „system", auch wenn ein Mensch über `PUT /api/gaps/:id` geändert hatte, und der
  // Filter auf das eigene Konto fand die eigene Änderung nicht. Ohne Aufrufer (Demo-Seed) bleibt
  // es Systemausführung — dieselbe Regel `aufruferAus` wie an `ask()`, kein Wortvergleich.
  async setGapPriority(id: string, priority: GapPriority, actor?: string): Promise<Gap> {
    if (!isGapPriority(priority)) {
      throw new AskError("BAD_REQUEST", "Ungültige Priorität.");
    }
    // Am aktuellen Stand gesetzt — eine Prioritätsänderung nimmt weder einen Abschluss noch
    // zwischenzeitliche Fragende zurück.
    const { gap: saved } = await this.aendereLuecke(id, (aktuell) => ({ ...aktuell, priority }));
    await this.audit?.record({
      actor: aufruferBeschriftung(aufruferAus(actor)),
      action: "gap.priority-changed",
      target: id,
    });
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

  /**
   * ============================================================================================
   * R-0142 (Confluence-Import, Lauf 5 R3, Bens B7) — WELCHE OFFENEN LÜCKEN EIN WISSENSOBJEKT BETREFFEN.
   * ============================================================================================
   *
   * Eine Lücke entsteht, wenn die Antwortsuche eine Frage nicht beantworten konnte. Sie trägt
   * keinen Objektbezug — und hier wird KEINE neue Zuordnungsregel erfunden. Der Bezug ist genau
   * die Rechnung, die diese Domäne für die Frage ohnehin anstellt: die deterministische
   * Vorauswahl (`prefilterCandidates` über die Inhaltstoken der Frage, `queryTokens`). Eine
   * offene Lücke betrifft ein Objekt, wenn die Antwortsuche es für ihre Frage HEUTE heranzieht —
   * es lag also auf dem Tisch, als die Frage offen blieb, oder liegt es jetzt.
   *
   * KEIN KI-AUFRUF, KEIN SCHREIBEN: weder Reasoner noch Lückenanlage noch Beleg. Ohne Inhaltstoken
   * (nur Stoppwörter) hat eine Frage keine Vorauswahl und betrifft kein Objekt.
   *
   * GEDECKELT UND AUSGEWIESEN: je Aufruf werden höchstens `deckel` offene Lücken (die jüngsten)
   * geprüft; `geprueft < offen` heisst, die Antwort ist eine Untergrenze. Die Fragetexte verlassen
   * diese Methode als `Gap` — die Redaktion je Betrachter (`redactGapForViewer`) ist Sache des
   * Aufrufers an der Route, wie bei `/api/gaps`.
   */
  async offeneLueckenZu(
    koIds: readonly string[],
    opts: { readonly deckel?: number } = {},
  ): Promise<{ bezug: Map<string, Gap[]>; geprueft: number; offen: number }> {
    const gesucht = new Set(koIds);
    const bezug = new Map<string, Gap[]>();
    const offene = (await this.listGaps())
      .filter((g) => g.status === "offen")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    const deckel = Math.max(0, Math.floor(opts.deckel ?? OFFENE_LUECKEN_BEZUG_DECKEL));
    const geprueft = offene.slice(0, deckel);
    if (gesucht.size > 0) {
      for (const gap of geprueft) {
        const kandidaten = await this.prefilterCandidates(queryTokens(gap.question), undefined);
        for (const ko of kandidaten) {
          if (gesucht.has(ko.id)) {
            bezug.set(ko.id, [...(bezug.get(ko.id) ?? []), gap]);
          }
        }
      }
    }
    return { bezug, geprueft: geprueft.length, offen: offene.length };
  }

  /**
   * R-1663 / R-2178 — passende Ansprechpartner zu EINER Lücke, begründet aus Wissensspuren
   * (Regeln in `ansprechpartner.ts`).
   *
   * Die Objektgrundlage ist dieselbe Rechnung wie bei `offeneLueckenZu`: die deterministische
   * Vorauswahl über die Inhaltstoken der Frage — KEIN KI-Aufruf, KEIN Schreiben, keine neue
   * Zuordnungsregel. Davon zählen nur die `DEFAULT_TOP_K` relevantesten Objekte, die der Betrachter
   * sehen darf (`sichtbar`, die fertige Entscheidung der Route) und die NICHT vertraulich sind: eine
   * Person darf nicht deshalb vorgeschlagen werden, weil sie an vertraulichem Wissen beteiligt ist —
   * schon der Vorschlag verriete dessen Existenz.
   *
   * Der Fragetext verlässt diese Methode nicht; die Antwort trägt nur Kennungen, Zahlen und die
   * Titel sichtbarer Objekte.
   */
  async ansprechpartnerZuLuecke(
    id: string,
    opts: { readonly sichtbar: (ko: KnowledgeObject) => boolean },
  ): Promise<AnsprechpartnerAuskunft> {
    const gap = await this.require(id);
    const frageterme = queryTokens(gap.question);
    const objekte = dropConfidential(await this.prefilterCandidates(frageterme, undefined))
      .filter((ko) => opts.sichtbar(ko))
      .slice(0, DEFAULT_TOP_K);
    const geschlosseneLuecken = (await this.listGaps())
      .filter((g) => g.id !== gap.id && g.status === "geschlossen" && g.assignee)
      .map((g) => ({ assignee: g.assignee as string, terme: queryTokens(g.question) }));
    return leiteAnsprechpartnerAb({ frageterme, objekte, geschlosseneLuecken });
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
    // D5: die Sperre des Fragewegs — bis vor jede Anweisung der Lückenablage (`insertOrIncrement`).
    vorInhaltsabruf?: () => void,
    // R-0291: der Belegbedarf aus der Vorauswahl; fehlt nur bei Aufrufern ohne Vorauswahl.
    belegbedarf?: GapBelegbedarf[],
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
      ...(belegbedarf?.length ? { belegbedarf } : {}),
    };
    // ============================================================================================
    // JOB 1111 / D-032 — HIER ENTSCHEIDET SICH: NEUE LÜCKE ODER EINE WEITERE STIMME.
    // ============================================================================================
    // Die Unteilbarkeit liegt in der Ablage (`insertOrIncrement`), nicht hier — ein Suchen im
    // Dienst mit anschliessendem Einfügen verlöre jedes Rennen zweier gleichzeitiger Fragen.
    // Eine Ablage ohne diesen Weg führt nicht zusammen und legt wie bisher an. Das betrifft keine
    // Betriebsablage, sondern nur speicherlose Testattrappen (Begründung am Interface in `repo.ts`).
    const { gap: gespeichert, created } = this.gaps.insertOrIncrement
      ? await this.gaps.insertOrIncrement(gap, vorInhaltsabruf)
      : await (async () => {
          vorInhaltsabruf?.();
          await this.gaps.insert(gap);
          return { gap, created: true };
        })();
    if (created) {
      await this.audit?.record({ actor: "system", action: "gap.created", target: gespeichert.id });
    }
    // BEWUSST KEIN Audit-Eintrag bei der Wiederholung: es wurde keine Lücke angelegt, und
    // `gap.created` für einen nicht angelegten Datensatz wäre eine falsche Auskunft. Ein eigener
    // Vorgang (`gap.repeated`) bräuchte eine Beschriftung in `apps/web/src/i18n.ts`; diese Datei
    // liegt nicht in der Lease dieses Auftrags. Als kleiner Folgeschritt in der Rückgabe benannt.
    return fuerDenFragenden(gespeichert, createdBy);
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
