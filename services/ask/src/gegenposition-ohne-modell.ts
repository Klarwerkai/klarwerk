// ================================================================================================
// P05-AC08 (Peters Entscheidung 11.10.2026 · Claude-Prüfnachtrag B-02/B-05) — OHNE MODELL WIRD
// NICHT STILL EINE VON MEHREREN BESTÄTIGTEN AUSKÜNFTEN GEWÄHLT.
// ================================================================================================
//
// DER BEFUND (.909, modellfreier Weg, synthetische Testdaten):
//   B-02 · KF1 „Motor aus = sicher" (irrtümlich bestätigt) und K1 (bestätigte Gegennotiz) treffen
//          beide die Frage. Der deterministische Ersatz gab NUR `best.statement` aus — „gesichert",
//          eine Quelle, die Gegenposition verschwiegen.
//   B-05 · Zwei bestätigte Testblätter VT-1 Rev A / Rev B mit abweichenden Werten: keine gezielte
//          Typ-/Revisionsrückfrage, die Blätter wurden verschwiegen.
//
// DIE REGEL IST KEINE NEUE: es ist die aus JOB 3365 (`rueckfallStand`, reasoner/provider-model.ts)
// — „nie still eine von zwei Auskünften wählen". Sie galt bisher nur dort, wo ein Modelltext
// verworfen wurde. Auf dem Weg OHNE Modell gilt dieselbe Lage sogar von vornherein: es gibt keine
// Widerspruchsprüfung, und eine fachliche Bestätigung ersetzt sie nicht.
//
// WAS HIER ENTSTEHT, und nur das: trägt neben der gewählten bestätigten Quelle mindestens eine
// WEITERE bestätigte Quelle aus derselben Kandidatenauswahl (dieselbe Relevanzregel, dieselben
// Sichtbarkeitsfilter) einen ANDEREN Wortlaut, nennt die Antwort alle diese Quellen mit Titel und
// Wortlaut, sagt, dass ohne Modell keine Widerspruchsprüfung stattfand, und fragt gezielt nach dem
// Geltungsfall (Typ, Revision, Einsatz). Sie ist dann NICHT „gesichert".
//
// DIE GRENZEN:
//  · KEINE BEHAUPTUNG ÜBER DIE SACHE. Gemessen ist nur: verschiedene Wortlaute. Ob sie sich
//    widersprechen oder ergänzen, sagt der Text ausdrücklich nicht.
//  · KEIN VORRANG DURCH DATUM ODER REVISION. Die Reihenfolge ist die der Kandidatenauswahl; kein
//    Zeitstempel und keine Revisionsangabe wird gelesen oder gewichtet.
//  · KEIN WERT OHNE BINDUNG. Jeder Wortlaut steht hinter dem Titel seiner Quelle — ein Wert
//    erscheint nur gebunden an das Blatt, aus dem er stammt, und nie als die Antwort.
//  · NUR BESTÄTIGTE GEGENQUELLEN. Ungeprüfte Objekte bleiben, wo sie waren (Hinweisliste
//    `ungeprueft`); eine einzelne bestätigte Quelle antwortet unverändert.
//  · NUR DER MODELLFREIE WEG (`demo`) DES KONSOLENWEGS. Der wörtliche Add-in-Weg (`retrievalOnly`)
//    und der Modellweg (dort `rueckfallStand`) bleiben unberührt.
import type { AnswerResult, KnowledgeRef, ReasonerLocale } from "../../reasoner";

const OHNE_PRUEFUNG: Record<ReasonerLocale, string> = {
  de: "Mehrere bestätigte Quellen sagen dazu Verschiedenes. Ohne KI-Modell fand keine Widerspruchsprüfung statt, und eine fachliche Bestätigung ersetzt sie nicht — die Frage ist damit nicht geklärt. Hier steht, was jede Quelle im Wortlaut sagt:",
  en: "Several confirmed sources say different things about this. Without an AI model no contradiction check took place, and a domain confirmation does not replace it — the question is therefore not settled. Here is what each source says, verbatim:",
  nl: "Meerdere bevestigde bronnen zeggen hier iets verschillends over. Zonder AI-model vond geen controle op tegenspraak plaats, en een inhoudelijke bevestiging vervangt die niet — de vraag is daarmee niet beslecht. Dit is wat elke bron letterlijk zegt:",
};

const RUECKFRAGE: Record<ReasonerLocale, string> = {
  de: "Rückfrage: Welche dieser Quellen gilt für Ihren Fall? Bitte nennen Sie Typ, Revision bzw. Einsatzbereich. Ein neueres Datum oder eine höhere Revision allein entscheidet das nicht; einen Wert ohne passende Typbindung gibt diese Antwort nicht aus.",
  en: "Follow-up question: Which of these sources applies to your case? Please state the type, revision or area of use. A newer date or a higher revision alone does not decide this; this answer gives no value without a matching type binding.",
  nl: "Wedervraag: Welke van deze bronnen geldt voor uw geval? Noem type, revisie of toepassingsgebied. Een nieuwere datum of een hogere revisie alleen beslist dat niet; dit antwoord geeft geen waarde zonder passende typebinding.",
};

function quellLabel(title: string, locale: ReasonerLocale): string {
  if (locale === "en") {
    return `Source: ${title}`;
  }
  return locale === "nl" ? `Bron: ${title}` : `Quelle: ${title}`;
}

/**
 * Derselbe Wortlaut, unabhängig NUR von Unicode-Form und Leerraum.
 *
 * Ben, Nacharbeit 3: bewusst NICHT über `queryTokens`. Die Suchtokenisierung wirft Stoppwörter weg —
 * darunter „nicht" —, und „Der Hubtisch ist sicher" und „Der Hubtisch ist nicht sicher" wären dann
 * derselbe Wortlaut: die Gegenposition fiele weg und die Antwort bliebe „gesichert".
 * Ben, Nacharbeit 4: auch Zeichen tragen Bedeutung — Vorzeichen („-10 °C" gegen „+10 °C"),
 * Vergleichsoperatoren („< 5 bar" gegen „> 5 bar"), Einheiten und Dezimaltrenner. Deshalb bleibt
 * JEDES Zeichen außer Leerraum stehen; angeglichen werden nur Unicode-Form und Leerraumfolgen.
 * Ben, Nacharbeit 6: auch die Groß-/Kleinschreibung trägt Bedeutung — Einheiten („10 mW" gegen
 * „10 MW"), Kennungen und Formelzeichen. Die sichere Richtung: zwei Texte, die sich nur in einem
 * Zeichen unterscheiden, werden lieber einmal zu viel gegenübergestellt als einmal zu wenig.
 */
export function wortlautSchluessel(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

/**
 * Die modellfreie Antwort mit sichtbarer Gegenposition — oder `null`, wenn es nichts abzuwägen gibt
 * (dann bleibt die Antwort des deterministischen Ersatzes Zeichen für Zeichen bestehen).
 *
 * `kandidaten` ist die Kandidatenauswahl, die der Antwortweg bekommen hat, in ihrer Rangfolge.
 */
export function gegenpositionOhneModell(
  antwort: AnswerResult,
  kandidaten: readonly KnowledgeRef[],
  locale: ReasonerLocale,
): AnswerResult | null {
  if (!antwort.demo || !antwort.answered) {
    return null;
  }
  const gewaehltId = antwort.citedSources[0];
  const gewaehlt = kandidaten.find((k) => k.id === gewaehltId);
  if (!gewaehlt || gewaehlt.status !== "validiert" || !gewaehlt.statement.trim()) {
    return null;
  }
  const gesehen = new Set([wortlautSchluessel(gewaehlt.statement)]);
  const stimmen: KnowledgeRef[] = [gewaehlt];
  for (const ref of kandidaten) {
    if (ref.id === gewaehlt.id || ref.status !== "validiert" || !ref.statement.trim()) {
      continue;
    }
    const schluessel = wortlautSchluessel(ref.statement);
    if (gesehen.has(schluessel)) {
      continue;
    }
    gesehen.add(schluessel);
    stimmen.push(ref);
  }
  if (stimmen.length < 2) {
    return null;
  }
  const ids = stimmen.map((s) => s.id);
  return {
    ...antwort,
    // Absatzweise, wie `rueckfallStand`: die Fläche rendert Markdown, jede Quelle steht für sich.
    answer: [
      OHNE_PRUEFUNG[locale],
      ...stimmen.map((s) => `${s.title}: ${s.statement}`),
      RUECKFRAGE[locale],
    ].join("\n\n"),
    // Nicht „gesichert": welche Quelle gilt, ist ungeprüft. Der Vertrauenswert ist der der
    // schwächsten genannten Quelle — dieselbe Minimumregel wie `answerStanding`.
    knowledgeClass: "ungeprueft",
    trust: Math.min(...stimmen.map((s) => s.trust)),
    sources: ids,
    citedSources: ids,
    steps: stimmen.map((s) => ({
      description: quellLabel(s.title, locale),
      sourceId: s.id,
      snippet: s.statement,
    })),
    argumentation: stimmen.map((s) => ({
      aussage: s.statement,
      quellen: [s.id],
      belegtDurch: s.id,
    })),
  };
}
