// A28 (OFFEN.md:165) — DAS DAUERHAFTE SIGNAL AM EIGENEN WISSENSOBJEKT.
//
// Der Befund, aus dem A28 entstand: „Heute erfährt die Expertin es EINMAL, beim Einreichen, mit
// ehrlichem Deckungssatz — und danach nie wieder." Für ein System, dessen Versprechen „du schreibst
// nichts zweimal" lautet, ist das zu wenig. A28 verlangt deshalb: an einem EIGENEN Objekt sieht der
// Autor DAUERHAFT, DASS es eine Dublette oder einen Konflikt gibt — unabhängig von seiner Rolle.
//
// Diese Datei trägt genau die Entscheidung, an welchem eigenen Objekt ein Signal entsteht. Sie
// trägt bewusst NICHT die Anzeige und nicht die Route: die Regel soll an EINEM Ort wohnen und von
// dort injiziert werden — dasselbe Vorgehen wie bei `darfSehen` (sichtbarkeit.ts:67).
//
// ================================================================================================
// DIE GRENZE, DIE HIER BAULICH ERZWUNGEN WIRD — bitte nicht überlesen.
// ================================================================================================
//
// (1) DAS SIGNAL NENNT VORHANDENSEIN UND ART, SONST NICHTS. `EigenerBefund` hat kein Feld für die
//     Gegenseite — weder Kennung noch Titel noch Inhalt. Das ist keine Disziplin, sondern der Typ:
//     Wer die Gegenseite mitgeben wollte, müsste diese Datei ändern und käme an den Tests vorbei,
//     die genau das prüfen. A28: „das Signal nennt Vorhandensein und Art …, NICHT Inhalt, Titel
//     oder Kennung der Gegenseite, solange die Rolle diese nicht sehen darf."
//
// (2) „EIN FREMDES OBJEKT DUPLIZIERT MEINES" IST GESPERRT — und zwar bis Pedi entschieden hat.
//     A28 nennt das ausdrücklich als „zu klären VOR dem Bauauftrag: ob der Autor auch erfährt, dass
//     ein FREMDES Objekt SEINES dupliziert — dort greift bens n=1-Einwand sehr wohl."
//
//     DASS SICH DIE BEIDEN FÄLLE ÜBERHAUPT TRENNEN LASSEN, IST EINE GEMESSENE EIGENSCHAFT DES
//     BESTANDS, keine Annahme: das Paar ist GERICHTET. `koA` ist das frisch eingereichte Subjekt,
//     `koB` der im Bestand vorgefundene Kandidat — belegt an beiden Anlegestellen:
//       · Überschneidungen: services/conflicts/src/overlap-service.ts:358 `koA: subject.refId`
//       · Konflikte:        services/conflicts/src/service.ts:387        `koA: subject.refId`
//
//     Daraus folgt die Regel, und sie ist der ganze Kern dieser Datei:
//       · `koA` gehört mir            → SIGNAL. Genau das hat der Autor beim Einreichen bereits
//                                       erfahren; A28 macht es dauerhaft. Keine neue Auskunft.
//       · `koB` gehört mir, `koA` auch → SIGNAL. Beide Seiten sind mein eigener Bestand; es gibt
//                                       hier gar keine fremde Auskunft, die entstehen könnte.
//       · `koB` gehört mir, `koA` fremd → KEIN SIGNAL. Das ist „ein fremdes Objekt dupliziert
//                                       meines": eine NACHTRÄGLICHE Auskunft über fremden Bestand,
//                                       die der Autor vorher nicht hatte. Gesperrt.
//
// (3) OFFENE BEFUNDE SIND DIE EINGABE. Diese Datei filtert keinen Status. Der Aufrufer reicht die
//     offenen Befunde herein — genauso, wie die Routen heute `unresolved()` hereinreichen
//     (overlap-routes.ts:52, conflicts-routes.ts:37). Ein geschlossener Befund ist kein Signal.

/** Die Art des Befundes. Mehr sagt das Signal über die Gegenseite nie. */
export type BefundArt = "dublette" | "konflikt";

/**
 * Die MINDESTFORM eines Befundpaares.
 *
 * Bewusst strukturell und nicht `OverlapEntry`/`Conflict` — dieselbe Überlegung wie bei
 * `SichtbarkeitsFakten` (sichtbarkeit.ts:51): die Frage wird auch für Projektionen gestellt, die
 * das volle Objekt nicht tragen. Und sie hält diese Datei frei von einer Modulabhängigkeit auf
 * `conflicts`, obwohl beide Entitäten dieselben zwei Felder tragen (overlap-types.ts:41-42,
 * conflicts/src/types.ts:54-55).
 */
export interface BefundPaar {
  /** Das eingereichte Subjekt. Gerichtet — siehe Grenze (2) im Kopf. */
  koA: string;
  /** Der im Bestand vorgefundene Kandidat. */
  koB: string;
}

/**
 * Das Signal an EINEM eigenen Wissensobjekt.
 *
 * Kein Feld für die Gegenseite, und das ist Absicht — siehe Grenze (1) im Kopf.
 */
export interface EigenerBefund {
  /** Das eigene Objekt, an dem das Signal hängt. */
  koId: string;
  /** Es gibt mindestens eine offene Dublette an diesem Objekt. */
  dublette: boolean;
  /** Es gibt mindestens einen offenen Konflikt an diesem Objekt. */
  konflikt: boolean;
}

/**
 * Was dieses Signal zusichert — als Datum, nicht als Kommentar.
 *
 * Hausidiom, wie `DUPLICATE_COMPARE_SAFETY` (apps/web/src/lib/duplicateCompare.ts:27): eine
 * Zusicherung, die ein Test lesen kann, überlebt einen Umbau; ein Satz im Kommentar nicht.
 */
export const A28_SIGNAL_GRENZE = {
  /** Vorhandensein wird genannt. */
  nenntVorhandensein: true,
  /** Die Art (Dublette / Konflikt) wird genannt. */
  nenntArt: true,
  /** Kennung der Gegenseite: nie. */
  nenntGegenseite: false,
  /** Inhalt, Titel, Zitate der Gegenseite: nie. */
  nenntInhalt: false,
  /** „Ein fremdes Objekt dupliziert meines": gesperrt bis zu Pedis Entscheidung (A28). */
  fremdesDupliziertMeines: false,
} as const;

/**
 * Gehört mir dieses Objekt, und darf an ihm ein Signal entstehen?
 *
 * Getrennte, benannte Funktion statt einer Bedingung im Schleifenrumpf — damit die Regel aus
 * Grenze (2) an einer Stelle steht und der Test sie einzeln treffen kann.
 */
function signalStelle(paar: BefundPaar, eigene: ReadonlySet<string>): string | null {
  const aIstMeins = eigene.has(paar.koA);
  const bIstMeins = eigene.has(paar.koB);
  if (aIstMeins) {
    // Mein eigenes Einreichen hat etwas gefunden — das kennt der Autor bereits aus dem Moment des
    // Einreichens. A28 macht es dauerhaft, ohne neue Auskunft zu erzeugen.
    return paar.koA;
  }
  if (bIstMeins) {
    // Fremdes Subjekt, mein Kandidat: „ein fremdes Objekt dupliziert meines". Gesperrt.
    return null;
  }
  return null;
}

/**
 * Zusätzliche Stelle, wenn BEIDE Seiten mir gehören.
 *
 * Getrennt gehalten, weil es ein eigener Gedanke ist: haben mein Objekt A und mein Objekt B eine
 * Überschneidung, entsteht an B keinerlei fremde Auskunft — beide Seiten sind mein Bestand, ich
 * kenne beide. Deshalb trägt auch das ältere eigene Objekt das Signal, und der Autor findet den
 * Befund von BEIDEN Seiten seiner eigenen Ablage aus. Das fällt nicht unter die Sperre aus
 * Grenze (2), die ausdrücklich vom FREMDEN Gegenüber handelt.
 */
function zweiteEigeneStelle(paar: BefundPaar, eigene: ReadonlySet<string>): string | null {
  if (eigene.has(paar.koA) && eigene.has(paar.koB) && paar.koA !== paar.koB) {
    return paar.koB;
  }
  return null;
}

function markiere(ziel: Map<string, EigenerBefund>, koId: string, art: BefundArt): void {
  const vorhanden = ziel.get(koId) ?? { koId, dublette: false, konflikt: false };
  if (art === "dublette") {
    vorhanden.dublette = true;
  } else {
    vorhanden.konflikt = true;
  }
  ziel.set(koId, vorhanden);
}

function sammle(
  ziel: Map<string, EigenerBefund>,
  paare: readonly BefundPaar[],
  eigene: ReadonlySet<string>,
  art: BefundArt,
): void {
  for (const paar of paare) {
    const stelle = signalStelle(paar, eigene);
    if (stelle !== null) {
      markiere(ziel, stelle, art);
    }
    const zweite = zweiteEigeneStelle(paar, eigene);
    if (zweite !== null) {
      markiere(ziel, zweite, art);
    }
  }
}

/**
 * Das dauerhafte A28-Signal für den eigenen Bestand eines Autors.
 *
 * @param eigeneKoIds  Die Kennungen der Objekte, deren Autor der Betrachter ist. Die Autorschaft
 *                     wird NICHT hier entschieden — sie ist dieselbe Zeichenkettenprüfung, die
 *                     `darfSehen` (sichtbarkeit.ts:76) trägt, und der Aufrufer reicht das Ergebnis
 *                     herein. Eine zweite Auslegung derselben Regel soll es nicht geben.
 * @param offeneDubletten Offene Überschneidungen (wie `overlaps.unresolved()`).
 * @param offeneKonflikte Offene Konflikte (wie `conflicts.unresolved()`).
 *
 * @returns Je eigenem Objekt MIT Befund ein Eintrag. Objekte ohne Befund erscheinen nicht — das
 *          Signal ist eine Meldung, keine Bestandsliste.
 */
export function eigeneBefunde(
  eigeneKoIds: readonly string[],
  offeneDubletten: readonly BefundPaar[],
  offeneKonflikte: readonly BefundPaar[],
): EigenerBefund[] {
  // Leerer/fehlender Bezeichner ist KEINE Kennung — dieselbe Vorsicht wie bei der Autorschaft in
  // `darfSehen` (sichtbarkeit.ts:74-76), sonst würde ein Altobjekt ohne Kennung mit einem leeren
  // `koA` zusammenfallen und ein fremdes Paar als eigenes ausweisen.
  const eigene = new Set(eigeneKoIds.filter((id) => typeof id === "string" && id.length > 0));
  const ziel = new Map<string, EigenerBefund>();
  if (eigene.size === 0) {
    return [];
  }
  sammle(ziel, offeneDubletten, eigene, "dublette");
  sammle(ziel, offeneKonflikte, eigene, "konflikt");
  return [...ziel.values()];
}

/**
 * Dasselbe für ein einzelnes Objekt — die Form, die eine Detailansicht braucht.
 *
 * Gibt `null` zurück, wenn es keinen Befund gibt. Bewusst `null` und kein Eintrag mit zwei
 * falschen Werten: „kein Befund" und „Befund, aber beides falsch" sind zwei verschiedene Aussagen,
 * und nur die erste ist wahr.
 */
export function befundFuerEigenesKo(
  koId: string,
  eigeneKoIds: readonly string[],
  offeneDubletten: readonly BefundPaar[],
  offeneKonflikte: readonly BefundPaar[],
): EigenerBefund | null {
  return (
    eigeneBefunde(eigeneKoIds, offeneDubletten, offeneKonflikte).find(
      (befund) => befund.koId === koId,
    ) ?? null
  );
}
