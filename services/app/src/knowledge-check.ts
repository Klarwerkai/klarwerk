// SCRUM-527 (Live-Check): echte Ähnlichkeits-/Widerspruchsprüfung eines ENTWURFSTEXTES gegen den
// Bestand — die Datenquelle der Live-Reaktion in „Wissen erfassen". Hier — und nur hier — treffen sich
// knowledge-object (Kandidaten), conflicts (Scoring/Dry-Run) und der Konflikt-Judge. Modulgrenzen bleiben
// sauber: conflicts bekommt modul-reine Kerntext-Subjekte + einen judge-Callback.
//
// EHRLICHKEIT & KEIN EGRESS OHNE VERTRAG (SCRUM-527 WP3 — voller Provenienz-Vertrag):
//  - similar: rein LEXIKALISCH (Trigramm) gegen den Bestand — deterministisch, KEIN Modell, KEIN
//    Embedding-Egress von Nutzer-Freitext.
//  - conflicts: side-effect-freier Dry-Run (ConflictService.assessAgainstPool) mit dem Reasoner-Judge —
//    NUR echte Verdachte (G-2-Zitatprüfung sitzt in decideFromVerdict), nie erfunden. Der Judge läuft
//    über die bestehende, 502-gecappte Modellkette.
//  - Der Judge wird NUR ausgeführt, wenn die ROUTE ihn übergibt. Die fail-safe Contract-Entscheidung
//    (Freitext sicher NICHT-vertraulich klassifiziert UND Modell verfügbar — sonst vertraulich) liegt in
//    knowledge-check-routes, exakt wie bei /api/check-text. Fehlt der Judge → KEIN Cloud-/Modell-Aufruf
//    mit Freitext: conflicts = [] und Gesamtstatus "pending" (ehrlich „nicht geprüft"). similar bleibt.
import type { ConflictService, ConflictVerdict, DetectSubject } from "../../conflicts";
import { trigramSimilarity } from "../../conflicts";
import type { KnowledgeObject, KoService, KoStatus } from "../../knowledge-object";
import { dropConfidential } from "../../knowledge-object";
// JOB 3298: DIESELBE Zerlegung in Inhaltstoken, die Ask/Reasoner benutzen — der Live-Check wählt die
// Sätze des Dokumenttexts (`dokumentAuszug`) nach derselben Wortauffassung aus wie der Antwortweg.
// Diese hier ist die öffentliche Fläche des Reasoner-Moduls.
//
// JOB 3574 — BERICHTIGUNG. Hier stand „Es gibt keine zweite Tokenisierung in diesem Haus". Das war
// schon beim Schreiben falsch: zwölf Zeilen tiefer zerlegt `terms()` denselben Entwurfstext ein
// zweites Mal, für die Kandidaten-Vorauswahl. Gemessen wurde (Lieferung 4, Testfälle T1/T1b in
// tests/live-check-suchwoerter/), ob `queryTokens` diese zweite Zerlegung ABLÖSEN kann — sie kann es
// an dieser Stelle nicht, ohne eine Schwelle zu verstellen:
//   · Mindestlänge: `queryTokens` nimmt Wörter ab drei Zeichen (provider.ts:1183, `w.length > 2`),
//     die Vorauswahl hier nur ÜBER drei (`TERM_MIN_LAENGE`). „Gas" wäre neu ein Suchwort — eine
//     Schwellenänderung, und die ist ausdrücklich nicht Gegenstand.
//   · Grundformen: `queryTokens` liefert Stämme („leitung" → „leit", „entleeren" → „entleer"), die
//     Vorauswahl hier Oberflächenformen. Beide finden über `includes` denselben Bestand, aber die
//     Wortliste wäre eine andere — und die Zusage „für höchstens zwölf Wörter Zeichen für Zeichen
//     die alte Liste" (Testfall V1) wäre gebrochen.
// Es bleiben deshalb ZWEI Zerlegungen in dieser Datei, mit zwei verschiedenen Aufgaben: `queryTokens`
// für die Satzauswahl im Dokumenttext (Wortgleichheit gegen den Antwortweg zählt), `terms()` für den
// Repo-Prefilter (Schwellentreue gegen den Bestand zählt). Das ist der gemessene Stand, nicht der
// erwünschte; die Zusammenlegung bliebe ein eigener Auftrag mit eigener Schwellenentscheidung.
import { queryTokens } from "../../reasoner";

// JOB 3031 — DER FUNDORT REIST AUCH AUF DIESEM WEG MIT DEM TREFFER.
// `koStatus`/`koCategory` sind wörtlich die Felder aus check-text-detection.ts:80-83 (JOB 3020):
// derselbe Name, dieselbe Bedeutung, dieselbe null-Regel — dies ist die Spiegelung jenes Vertrags,
// KEINE zweite Wahrheit und keine eigene Statusableitung (der rohe KoStatus reist, nichts wird
// hergeleitet oder umbenannt).
// Beide Werte stammen aus dem bei checkKnowledge bereits geladenen Kandidaten; es wird nichts
// nachgeladen und nichts geraten.
// `null` heißt „der Bestand sagt dazu nichts": eine fehlende Kategorie, oder ein Befund ohne
// passenden Kandidaten. Es heißt NICHT „offen" und NICHT „keine Kategorie vorhanden" — kein
// Platzhalter, kein Standardwert.
export interface KnowledgeCheckSimilar {
  id: string;
  title: string;
  score: number; // 0..1, lexikalisch
  koStatus: KoStatus | null;
  koCategory: string | null;
}
export interface KnowledgeCheckConflict {
  id: string;
  title: string;
  reason: string;
  koStatus: KoStatus | null;
  koCategory: string | null;
}
export interface KnowledgeCheckResult {
  status: "done" | "pending" | "failed";
  similar: KnowledgeCheckSimilar[];
  conflicts: KnowledgeCheckConflict[];
}

// Der Konflikt-Judge-Callback (modul-rein): zwei Kerntexte → Verdikt. Signatur-kompatibel mit
// Reasoner.judgeConflict; die Route bindet das konkrete Modell (oder null) daran.
export type DraftConflictJudge = (coreA: string, coreB: string) => Promise<ConflictVerdict | null>;

export interface KnowledgeCheckDeps {
  ko: KoService;
  conflicts: ConflictService;
  // SCRUM-527 (WP3): der Judge läuft NUR, wenn er hier übergeben wird. Die fail-safe Entscheidung
  // (nicht-vertraulich klassifiziert + Modell verfügbar) trifft die Route. Fehlt er (vertraulich/unklar/
  // kein Modell) → KEIN Egress von Freitext: conflicts = [] mit status "pending".
  judge?: DraftConflictJudge | null;
}

// Kerntext-Subjekt aus dem Freitext (kein KO-Anker). Nur statement trägt den Text; der Rest ist leer.
function subjectFromText(text: string): DetectSubject {
  return {
    refId: "__intake_draft__",
    title: "",
    statement: text,
    conditions: [],
    measures: [],
    category: "",
    tags: [],
    asset: null,
  };
}

// ================================================================================================
// JOB 3298 · ASK-VOLLTEXT — DER LIVE-CHECK VERGLICH BIS HEUTE NUR DEN ERSTEN ABSATZ.
// ================================================================================================
//
// DER BEFUND (Codex b65c00b4). `koToSubject` reichte Titel, Aussage, Bedingungen und Maßnahmen
// weiter; der DOKUMENTTEXT eines importierten Bestandsobjekts kam weder in die Ähnlichkeit
// (`trigramSimilarity` über `title + statement`) noch in den Kerntext, den der Konflikt-Judge liest
// (`coreText`). Ein Entwurf, der genau dem widerspricht, was auf Seite zwei einer importierten
// Confluence-Seite steht, galt deshalb als unbekannt und konfliktfrei.
//
// WOHER DER TEXT KOMMT: aus der SUCHPROJEKTION (`searchProjectionOf` → `bodyText`), also aus
// derselben kanonisch geschnittenen Quelle, aus der ihn der Ask-Dienst holt. Kein zweiter Scanner,
// kein `bodyHtml`-Vollload.
//
// DER DECKEL IST DERSELBE wie im Antwortweg (3 Sätze / 600 Zeichen je Objekt, Begründung der Zahlen
// bei `dokumentAuszuege` in services/reasoner/src/provider-model.ts). Ausgewählt werden auch hier
// nur die Sätze, die mit dem ENTWURFSTEXT Inhaltstoken teilen — deterministisch, ohne Modell, ohne
// Egress: es wird nichts abgefragt, was nicht ohnehin im Haus liegt.
//
// WARUM DIE AUSWAHLREGEL HIER EIN ZWEITES MAL STEHT und nicht aus dem Reasoner geholt wird: sie ist
// dort nicht Teil der öffentlichen Modulfläche (`services/reasoner/index.ts`), und diese Datei darf
// per dependency-cruiser nur über die Modul-index gehen. Der Export dort liegt AUSSERHALB der
// Zielpfade dieses Auftrags und ist als Folgeaufgabe benannt (Rückgabe, ABWEICHUNGEN). Was NICHT
// gedoppelt ist, ist die Zerlegung in Inhaltstoken: `queryTokens` kommt aus dem Reasoner.
const AUSZUG_MAX_SAETZE = 3;
const AUSZUG_MAX_ZEICHEN = 600;

/** Satzweise Zerlegung — dieselbe Grenze wie im Antwortweg (`saetze`, provider-model.ts). */
function bodySaetze(text: string): string[] {
  return text
    .split(/(?<=[.!?:;]["'’‘“”»«›‹)\]}]*)\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Der Auszug aus dem Dokumenttext eines Bestandsobjekts: die Sätze mit der größten Wortüberdeckung
 * zum Entwurf, in Dokumentreihenfolge, gedeckelt. Ohne gemeinsames Inhaltstoken kein Satz — der
 * Auszug ist eine Auswahl, keine Abschrift, und leer, wenn das Objekt zum Entwurf nichts zu sagen hat.
 */
export function dokumentAuszug(bodyText: string, entwurf: string): string {
  const body = bodyText.trim();
  const worte = new Set(queryTokens(entwurf));
  if (body.length === 0 || worte.size === 0) {
    return "";
  }
  const gewaehlt = bodySaetze(body)
    .map((satz, stelle) => ({
      satz,
      stelle,
      treffer: new Set(queryTokens(satz).filter((w) => worte.has(w))).size,
    }))
    .filter((x) => x.treffer > 0)
    .sort((a, b) => (b.treffer === a.treffer ? a.stelle - b.stelle : b.treffer - a.treffer))
    .slice(0, AUSZUG_MAX_SAETZE)
    .sort((a, b) => a.stelle - b.stelle)
    .map((x) => x.satz);
  return gewaehlt.join(" ").slice(0, AUSZUG_MAX_ZEICHEN).trim();
}

/** Die Beschriftung, unter der der Dokumenttext im Kerntext des Kandidaten steht. */
const AUSZUG_MARKE = "Dokumenttext (Auszug)";

// ================================================================================================
// JOB 3298 — WO DER AUSZUG IM ERKENNUNGS-GEGENSTAND STEHT, UND WARUM DAS ZWEI ORTE SIND.
// ================================================================================================
//
// `coreText` (services/conflicts/src/detect.ts:47) baut den Text, den der Judge liest, aus
// `[title, statement, ...conditions, ...measures]`. Der Judge sieht den Auszug also aus JEDEM
// dieser Felder — für ihn ist die Wahl gleichgültig.
//
// Für die KANDIDATEN-VORAUSWAHL ist sie es nicht. `selectCandidates` (detect.ts:113-136) rechnet
// die Textnähe des Entwurfs gegen `title + statement` und lässt einen Kandidaten nur ab 0,3
// (Jaccard über Trigramme) durch, wenn Kategorie, Anlage und Tags nichts sagen — und beim
// Entwurfstext aus dem Live-Check sagen sie nie etwas (`subjectFromText` setzt sie leer). Damit
// gilt beides gleichzeitig:
//
//   · Steht der Auszug in `statement`, KANN ein Objekt, dessen Bezug nur im Dokumenttext liegt,
//     die Schwelle überhaupt erst erreichen — genau der Fall dieses Auftrags.
//   · Steht er dort, kann er einen Kandidaten aber auch VERLIEREN: Jaccard vergrößert mit dem
//     Zusatztext auch die Vereinigung, und ein Treffer knapp über 0,3 rutscht darunter.
//
// DIE ENTSCHEIDUNG: der Auszug steht in `statement`, WENN er die Textnähe nicht senkt, und sonst in
// `measures`. Der Judge bekommt den Text so oder so, GENAU EINMAL; die Vorauswahl bekommt ihn nur
// dann, wenn er ihr hilft. Die Weitung fügt hinzu und nimmt nie weg.
//
// Die Beschriftung steht davor, damit der Judge liest, was er vor sich hat. Sie hebt die wörtliche
// Zitatprüfung (G-2, `quotesVerbatim`) nicht auf: ein Satz aus dem Auszug bleibt eine
// Teilzeichenkette des Kerntexts.
//
// KORREKTURPFLICHT 1 (Runde 1, ben): DIE BESCHRIFTUNG IST TEIL DES VERGLICHENEN TEXTES.
// Runde 1 maß die Textnähe „mit Auszug" an `title statement auszug` — OHNE die Beschriftung, die
// `koToSubject` eine Zeile später wirklich hineinschreibt. Die 21 Zeichen „Dokumenttext (Auszug): "
// bringen aber eigene Trigramme in die Vereinigung und senken den Jaccard-Wert. Bens Gegenprobe
// (Entwurf „Bei Kaltstart keine Vorwärmung aktivieren.", Kandidat „Kaltstart" / „Bei Kaltstart
// zuerst die Vorwärmung aktivieren und danach den Druck am Ventil mit einem geeigneten Messgerät.",
// Dokumenttext „Bei Kaltstart zuerst die Vorwärmung aktivieren."): gemessen ohne Beschriftung
// 0,3333 ≥ 0,3333 → der Auszug ging ins Kurzfeld; tatsächlich verglichen wurden dann 0,2846, unter
// der Schwelle 0,3 — ein bisher geprüfter Kandidat fiel still aus der Vorauswahl (Judge-Aufrufe
// vorher 1, nachher 0, Status weiterhin „done").
// Deshalb wird jetzt NICHT MEHR NACHGEBILDET, was verglichen wird, sondern gemessen, was gebaut
// wird: beide Fassungen des Kandidaten entstehen durch `koToSubject`, und `vorauswahlText` liest
// aus ihnen wörtlich das Feld, auf dem `selectCandidates` rechnet. Die zwei Wege können nicht mehr
// auseinanderlaufen — es gibt keine zweite Formel mehr, die es könnte. Testfall E7.
//
// DetectSubject hat kein eigenes Feld für den Dokumenttext; eines anzulegen läge in
// `services/conflicts` und damit außerhalb der Zielpfade (Rückgabe, ABWEICHUNGEN).
function koToSubject(ko: KnowledgeObject, auszug: string, imKurzfeld: boolean): DetectSubject {
  const zeile = auszug ? `${AUSZUG_MARKE}: ${auszug}` : "";
  return {
    refId: ko.id,
    title: ko.title,
    statement: zeile && imKurzfeld ? `${ko.statement}\n${zeile}` : ko.statement,
    conditions: ko.conditions,
    measures: zeile && !imKurzfeld ? [...ko.measures, zeile] : ko.measures,
    category: ko.category,
    tags: ko.tags,
    asset: ko.asset,
  };
}

/**
 * Der Text, auf dem die Kandidaten-Vorauswahl des Konfliktwegs ihre Textnähe rechnet: wörtlich
 * `subjectText`/`c.title + " " + c.statement` aus `selectCandidates`
 * (services/conflicts/src/detect.ts:117 und :124). Er wird aus dem FERTIGEN Erkennungs-Gegenstand
 * gelesen, nie aus dem Wissensobjekt nachgebaut — genau daran scheiterte Runde 1.
 */
function vorauswahlText(s: DetectSubject): string {
  return `${s.title} ${s.statement}`;
}

// Der Fundort eines Kandidaten, gelesen BEVOR `koToSubject` das Wissensobjekt auf den Erkennungs-
// Gegenstand verengt (der kennt den Zustand nicht). Die Regel ist wortgleich die des Add-in-Wegs
// (check-text-detection.ts:143-146): der Zustand roh, die Kategorie nur, wenn der Bestand wirklich
// eine trägt.
function koToOrigin(ko: KnowledgeObject): { koStatus: KoStatus | null; koCategory: string | null } {
  const category = typeof ko.category === "string" ? ko.category.trim() : "";
  return { koStatus: ko.status, koCategory: category.length > 0 ? category : null };
}

// Schwellen: Performance-Deckel (525 P.1) — lexikalischer Vorfilter, begrenzte Kandidaten.
const SIMILAR_MIN_SCORE = 0.18;
const SIMILAR_LIMIT = 5;
const CANDIDATE_LIMIT = 40;

// ================================================================================================
// JOB 3574 · DIE ZWÖLF SUCHWÖRTER KOMMEN AUS DEM GANZEN TEXT, NICHT AUS SEINEM ANFANG.
// ================================================================================================
//
// DER BEFUND, GEMESSEN (tests/live-check-suchwoerter/suchwoerter-aus-dem-ganzen-text.test.ts).
// Bis heute stand hier `.slice(0, 12)` über die Einfügereihenfolge eines `Set` — also wörtlich die
// zwölf ERSTEN Wörter über drei Zeichen, nicht die zwölf tragenden. Diese Wortliste ist die EINZIGE
// Eingabe der Kandidaten-Vorauswahl (`deps.ko.findCandidates` unten), und die kennt keinen
// Ersatzweg: passt kein Wort, ist die Kandidatenliste leer
// (services/knowledge-object/src/repo-candidates.test.ts:72-77). Ein Entwurf mit vorangestellter
// Kopfzeile — Herkunft, Datum, Status, Kategorie, wie die Browser-Erweiterung sie setzt — verbrauchte
// damit alle zwölf Plätze für Beiwerk. Gemessen an derselben Sache mit und ohne Kopfzeile:
// ohne 7 Wörter → 1 Kandidat → 1 Ähnlichkeitstreffer → 1 Judge-Aufruf; mit Kopfzeile 12
// Kopfzeilenwörter → 0 Kandidaten → 0 Treffer → 0 Judge-Aufrufe, Status beide Male „done".
//
// DIE REGEL. Die verschiedenen Wörter über drei Zeichen werden NACH WORTLÄNGE ABSTEIGEND gereiht,
// bei gleicher Länge nach ihrem ersten Vorkommen im Text; die zwölf ersten dieser Reihung sind die
// Suchwörter. Die TEXTSTELLE spielt keine Rolle mehr — ein Wort am Textende hat dieselbe Chance wie
// eines in der ersten Zeile.
//
// WARUM DIE LÄNGE UND NICHT DIE STELLE: die Vorauswahl des Repos ist ein ODER über TEILZEICHENKETTEN
// (`koCandidateScore`, services/knowledge-object/src/repo.ts:261-270). Ein langes Wort ist dort das
// trennscharfe: „überdrucksicherheitsventil" trifft genau den einen Gegenstand, „werk" oder „stand"
// trifft alles oder nichts. Im Deutschen ist zugleich das lange Wort das fachliche — Komposita wie
// „Rueckhaltebecken" oder „Ueberdrucksicherheitsventil" tragen den Sachverhalt, während das Beiwerk
// einer Kopfzeile („Quelle", „Datum", „Status", „Werk", „Stand") kurz ist. Die Regel bleibt dabei
// INHALTSBLIND: sie kennt keine Wortliste und keine Sprache, sie zählt Zeichen.
//
// WARUM DETERMINISTISCH: eine reine Funktion. Sortiert wird nach zwei Ganzzahlen (Wortlänge, dann
// Fundstelle); der Vergleich ist total, das zweite Kriterium schließt jeden Gleichstand aus, die
// Stabilität der Sortierung wird nicht vorausgesetzt. Kein Modell, kein Egress, keine Zufallsquelle,
// keine Uhrzeit — gleiche Eingabe, gleiche Ausgabe.
//
// KEINE SCHWELLE IST ANGEFASST: es bleiben zwölf Plätze, es bleibt die Mindestlänge über drei
// Zeichen, und `SIMILAR_MIN_SCORE`, `SIMILAR_LIMIT`, `CANDIDATE_LIMIT` stehen unverändert oben. Die
// Wortlänge ist hier SORTIERSCHLÜSSEL, keine Grenze: kein Wort wird wegen seiner Länge verworfen,
// das nicht schon `TERM_MIN_LAENGE` verwarf. Die Regel führt keine einzige neue Zahl ein.
// Für einen Text mit höchstens zwölf verschiedenen Wörtern ist die Liste Wort für Wort die alte —
// dann greift die Auswahl gar nicht.
//
// WAS DIE REGEL NICHT KANN — der Zielkonflikt, gemessen in Runde 1 (BEN):
// Sie verteilt zwölf Plätze, sie schafft keine dreizehnten. Die alte Regel war „die ersten zwölf";
// jede Regel, die ein Wort von Platz 13 aufwärts aufnimmt, MUSS dafür eines der ersten zwölf
// fallen lassen. Hängt ein Bestandsgegenstand an genau diesem einen Wort, ist er verloren. Solange
// die Zwölf feststeht, ist „kein heute gefundener Kandidat geht verloren" deshalb als ALLGEMEINE
// Zusage unerfüllbar — das ist keine Schwäche dieser Regel, sondern eine Eigenschaft von zwölf
// Plätzen. Diese Regel verschiebt den Verlust dorthin, wo er am wenigsten kostet: es fallen die
// KÜRZESTEN Wörter, also die unschärfsten Sucher. Gemessen abgesichert sind der Fall „Fachinhalt
// vorne" (V2) und der Fall „der Gegenstand hängt an EINEM langen Wort auf Platz zwei" (V3, BENs
// Gegenbeispiel gegen die Vorgängerregel). Ein Verlust bleibt möglich, wenn ein Gegenstand
// ausschließlich an einem der kürzesten Wörter eines langwortreichen Entwurfs hängt; das wird hier
// nicht wegbehauptet.
const TERM_PLAETZE = 12;
const TERM_MIN_LAENGE = 3;

/** Reine Wörter für die Kandidaten-Vorauswahl (Keyword-Prefilter des Repos). */
function terms(text: string): string[] {
  const worte = Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9äöüß]+/i)
        .filter((w) => w.length > TERM_MIN_LAENGE),
    ),
  );
  if (worte.length <= TERM_PLAETZE) {
    return worte;
  }
  return worte
    .map((wort, fundstelle) => ({ wort, fundstelle }))
    .sort((a, b) => b.wort.length - a.wort.length || a.fundstelle - b.fundstelle)
    .slice(0, TERM_PLAETZE)
    .map((eintrag) => eintrag.wort);
}

export async function checkKnowledge(
  text: string,
  deps: KnowledgeCheckDeps,
): Promise<KnowledgeCheckResult> {
  const clean = text.trim();
  if (clean.length < 12) {
    // G-2-EHRLICHKEIT (ben-Check V2): zu kurzer Text wurde NICHT auf Widerspruch geprüft → ehrlich
    // "pending" (die UI zeigt „noch nicht geprüft"), NICHT "done" (das die UI fälschlich als „neu"
    // deutet). Kein Egress-Aspekt — es lief nur kein Judge.
    return { status: "pending", similar: [], conflicts: [] };
  }
  try {
    // 1) Kandidaten lexikalisch vorfiltern (begrenzt) — kein Voll-Pool-Scan. dropConfidential hält
    //    vertrauliche KOs aus dem Ergebnis UND aus dem Modell-Pool (kein Egress ihres Kerntexts). Demo-
    //    KOs bleiben DRIN: im Live-Check sind sie regulärer Bestand (der Check persistiert nichts), sonst
    //    fände die Ähnlichkeitssuche im Demo-/Testbetrieb nichts.
    const candidates = dropConfidential(
      await deps.ko.findCandidates({ terms: terms(clean), limit: CANDIDATE_LIMIT }),
    );

    // JOB 3298: der Dokumenttext der Kandidaten, aus der Suchprojektion, je Kandidat auf den Auszug
    // geschnitten. FEHLSCHLÄGE SIND STILL UND FOLGENLOS: liefert die Projektion nichts (Altbestand
    // ohne Projektion, Testdoppel ohne diese Methode, ein Lesefehler), prüft der Live-Check exakt
    // wie vor diesem Auftrag weiter. Die Anreicherung darf den ganzen Check nie zum Scheitern
    // bringen — sie fügt hinzu, sie trägt nicht.
    const auszuege = new Map<string, string>(
      await Promise.all(
        candidates.map(async (k): Promise<[string, string]> => {
          try {
            const projektion = await deps.ko.searchProjectionOf(k.id);
            return [k.id, dokumentAuszug(projektion?.bodyText ?? "", clean)];
          } catch {
            return [k.id, ""];
          }
        }),
      ),
    );

    // JOB 3298: EINE Rechnung, ZWEI Verbraucher. Je Kandidat wird die Textnähe zum Entwurf an den
    // BEIDEN Fassungen gemessen, die `koToSubject` wirklich baut — der ohne Auszug und der mit
    // Auszug im Kurzfeld —, und zwar an genau dem Feld, auf dem die Kandidaten-Vorauswahl des
    // Konfliktwegs rechnet (`vorauswahlText`). Auch die Entwurfsseite kommt aus `subjectFromText`,
    // demselben Gegenstand, der gleich in `assessAgainstPool` geht. Gemessen wird damit der Text,
    // der verglichen wird, einschließlich der Beschriftung — nicht eine Nachbildung davon
    // (Korrekturpflicht 1, ausführlich bei `koToSubject`). Daraus folgen beide Entscheidungen:
    //   · der `similar`-Wert ist der HÖHERE der beiden — `trigramSimilarity` ist ein Jaccard-Maß,
    //     und zusätzlicher Text auf der Bestandsseite vergrößert immer auch die Vereinigung. Würde
    //     der Auszug einfach angehängt, verlöre ein heute gefundener Treffer mit langem Dokument
    //     seinen Wert und fiele unter SIMILAR_MIN_SCORE. So kann ein Marker, der NUR im
    //     Dokumenttext steht, einen Treffer ERZEUGEN, und kein bestehender Treffer wird schlechter.
    //   · `traegt` sagt, ob der Auszug ins Kurzfeld des Erkennungs-Gegenstands darf.
    // Deterministisch bleibt beides: reine Funktionen derselben Eingaben, kein Modell, kein Egress.
    const entwurf = subjectFromText(clean);
    const subjectCore = vorauswahlText(entwurf);
    const naehe = new Map(
      candidates.map((k) => {
        const auszug = auszuege.get(k.id) ?? "";
        const ohne = trigramSimilarity(subjectCore, vorauswahlText(koToSubject(k, "", false)));
        const mit = auszug
          ? trigramSimilarity(subjectCore, vorauswahlText(koToSubject(k, auszug, true)))
          : 0;
        return [k.id, { ohne, mit, traegt: auszug !== "" && mit >= ohne }] as const;
      }),
    );

    // 2) similar: deterministische Trigramm-Ähnlichkeit gegen die Kandidaten.
    const similar: KnowledgeCheckSimilar[] = candidates
      .map((k) => {
        const wert = naehe.get(k.id);
        return {
          id: k.id,
          title: k.title,
          score: Math.max(wert?.ohne ?? 0, wert?.mit ?? 0),
          ...koToOrigin(k),
        };
      })
      .filter((s) => s.score >= SIMILAR_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, SIMILAR_LIMIT);

    // 3) conflicts: NUR wenn die Route einen Judge übergeben hat (Freitext nicht-vertraulich + Modell
    //    verfügbar). Sonst ehrlich „pending" (nicht geprüft), conflicts = [] — KEIN Cloud-/Modell-Egress
    //    von Freitext. Der Dry-Run (assessAgainstPool) persistiert nichts.
    if (!deps.judge) {
      return { status: "pending", similar, conflicts: [] };
    }
    const pool = candidates.map((k) =>
      koToSubject(k, auszuege.get(k.id) ?? "", naehe.get(k.id)?.traegt ?? false),
    );
    const dry = await deps.conflicts.assessAgainstPool(entwurf, pool, deps.judge);
    // JOB 3031: der Fundort je Konflikt-Treffer kommt aus DEMSELBEN Kandidaten, der eine Zeile
    // höher in den Pool ging — kein zweiter Zugriff, kein ko.get. Was `dropConfidential` verworfen
    // hat, ist weder im Pool noch hier: die neuen Felder öffnen keinen Kanal an der Vertraulichkeit
    // vorbei. Findet sich zu einer koId kein Kandidat, sagt der Fundort ehrlich nichts (null/null),
    // statt den Wert eines anderen Treffers zu leihen.
    const origins = new Map(candidates.map((k) => [k.id, koToOrigin(k)] as const));
    const conflicts: KnowledgeCheckConflict[] = dry.map((d) => ({
      id: d.koId,
      title: d.koTitle,
      reason: d.rationale ?? "",
      ...(origins.get(d.koId) ?? { koStatus: null, koCategory: null }),
    }));
    return { status: "done", similar, conflicts };
  } catch {
    // never block: ehrlicher Fehlerstatus, keine Interna.
    return { status: "failed", similar: [], conflicts: [] };
  }
}
