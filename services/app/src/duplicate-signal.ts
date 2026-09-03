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
//
// (4) DIE DECKUNG WIRD HEREINGEREICHT, NICHT HIER ENTSCHIEDEN (JOB 3032, N5). Dieselbe Bauart wie
//     (3): der Kern entscheidet NICHTS über Prüfläufe. Er importiert weder aus `conflicts` noch aus
//     `knowledge-object` und kennt die kanonische Vollständigkeitsregel `isCompleteRun`
//     (conflicts/src/coverage.ts:203) nicht einmal dem Namen nach. Der Aufrufer leitet die Lage aus
//     dem Objekt ab, das er ohnehin geladen hat, und reicht sie je eigener Kennung herein.

/** Die Art des Befundes. Mehr sagt das Signal über die Gegenseite nie. */
export type BefundArt = "dublette" | "konflikt";

/**
 * JOB 3032 (N5) — WIE WEIT DER PRÜFLAUF REICHTE, DER DIESES EIGENE OBJEKT ANGESEHEN HAT.
 *
 * Pedis Zeile N5 verlangt neben „dauerhaft" und „ohne fremden Inhalt" ein Drittes: einen EHRLICHEN
 * Satz, gegen wie viel geprüft wurde. Bis hierher trug der Befund drei Felder und damit keine Zahl
 * und keine Lage, auf die so ein Satz sich stützen könnte — er hätte behauptet werden müssen.
 *
 * DIE VIER WERTE SIND EINS ZU EINS die Vierteilung des Hauses (knowledge-object/src/types.ts:55-66),
 * nur auf Deutsch. Kein fünfter Wert, kein „unbekannt": jede Lage ist eine Aussage, die getroffen
 * werden kann.
 *   `kein_lauf`      = `unchecked`  — gar kein Vermerk. Über dieses Objekt sagt KEIN Lauf etwas.
 *                      Das heißt ausdrücklich NICHT „geprüft, nichts gefunden".
 *   `unvollstaendig` = `incomplete` — ein Lauf, der nicht als vollständig BELEGT ist: `pending`/
 *                      `failed`, oder ein Protokoll, das die kanonische Invariante nicht erfüllt.
 *   `ohne_protokoll` = `noCoverage` — abgeschlossen gemeldet, aber OHNE Abdeckungsprotokoll. Ein
 *                      Lauf ist nachweisbar, seine REICHWEITE nicht. Das ist NICHT dasselbe wie
 *                      „gar kein Lauf" (types.ts:62-65) — die beiden dürfen nie zusammenfallen.
 *   `vollstaendig`   = was in keinen der drei fällt, und nur DAS darf schweigen.
 */
export type DeckungsLage = "vollstaendig" | "unvollstaendig" | "ohne_protokoll" | "kein_lauf";

/**
 * Die Deckungslage EINES eigenen Objekts, samt den beiden Zahlen, die ein ehrlicher Satz braucht.
 *
 * `null` IST NICHT `0`, und das ist der ganze Punkt der beiden Felder: `0` heißt „gegen null
 * geprüft" (eine Auskunft), `null` heißt „darüber liegt keine Auskunft vor" (keine). Fielen die
 * beiden zusammen, entstünde aus einem fehlenden Protokoll die Aussage „gegen 0 von 0 geprüft" —
 * eine Zahl, die niemand gemessen hat. „Wissenslücke statt Erfindung."
 */
export interface Deckung {
  lage: DeckungsLage;
  /** `coverage.completed`, roh. `null`, wenn kein Abdeckungsprotokoll vorliegt. */
  geprueft: number | null;
  /** `coverage.available`, roh. `null`, wenn kein Abdeckungsprotokoll vorliegt. */
  bestand: number | null;
}

/**
 * Was gilt, wenn der Aufrufer zu einer eigenen Kennung KEINE Lage hereingereicht hat.
 *
 * Fail-honest und nicht fail-optimistisch: die Abwesenheit einer Auskunft ist selbst eine Auskunft,
 * und zwar die schwächste. Ein Rückfall auf `vollstaendig` wäre genau die stille Entwarnung, gegen
 * die der Deckel-Ehrlichkeitsvertrag steht (conflicts/src/coverage.ts:5-9).
 *
 * Bewusst eine Fabrik und keine geteilte Konstante: jeder Eintrag bekommt sein eigenes Objekt,
 * damit eine spätere Änderung an einem Befund nicht alle anderen mitzieht.
 */
function ohneAuskunft(): Deckung {
  return { lage: "kein_lauf", geprueft: null, bestand: null };
}

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
  /**
   * JOB 3032 (N5): wie weit der Lauf reichte, der DIESES Objekt angesehen hat.
   *
   * Eine Aussage über den EIGENEN Prüflauf — nicht über die Gegenseite. Sie verletzt Grenze (1)
   * deshalb nicht: `available`/`completed` zählen den Bestand, gegen den MEIN Objekt geprüft wurde,
   * und nennen kein fremdes Objekt. Siehe `A28_SIGNAL_GRENZE.nenntDeckung`.
   */
  deckung: Deckung;
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
  /**
   * JOB 3032 (N5): Die Deckungslage des EIGENEN Prüflaufs wird genannt — Lage und, wenn ein
   * Protokoll vorliegt, die zwei rohen Zahlen. Das ist eine Aussage über mein Objekt und nie eine
   * über ein fremdes; `nenntGegenseite` und `nenntInhalt` bleiben deshalb unverändert `false`.
   */
  nenntDeckung: true,
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

function markiere(
  ziel: Map<string, EigenerBefund>,
  koId: string,
  art: BefundArt,
  deckungJeKo: ReadonlyMap<string, Deckung>,
): void {
  const vorhanden = ziel.get(koId) ?? {
    koId,
    dublette: false,
    konflikt: false,
    // Die Lage wird NUR unter der EIGENEN Kennung nachgeschlagen. Ein Eintrag zu einem anderen
    // Objekt kann deshalb gar nicht an diesem Befund landen — auch dann nicht, wenn der Aufrufer
    // eine breitere Tabelle hereinreicht als nötig.
    deckung: deckungJeKo.get(koId) ?? ohneAuskunft(),
  };
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
  deckungJeKo: ReadonlyMap<string, Deckung>,
): void {
  for (const paar of paare) {
    const stelle = signalStelle(paar, eigene);
    if (stelle !== null) {
      markiere(ziel, stelle, art, deckungJeKo);
    }
    const zweite = zweiteEigeneStelle(paar, eigene);
    if (zweite !== null) {
      markiere(ziel, zweite, art, deckungJeKo);
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
 * @param deckungJeKo  JOB 3032 (N5): die FERTIGE Deckungslage je eigener Kennung. Grenze (4): der
 *                     Kern leitet sie nicht ab. Fehlt eine Kennung, gilt `kein_lauf` mit zwei
 *                     `null` — die Abwesenheit einer Auskunft wird nicht zur Entwarnung.
 *                     BEWUSST PFLICHT und nicht optional: ein Aufrufer, der die Lage vergisst,
 *                     soll am Übersetzer scheitern und nicht still „kein Lauf" ausliefern.
 *
 * @returns Je eigenem Objekt MIT Befund ein Eintrag. Objekte ohne Befund erscheinen nicht — das
 *          Signal ist eine Meldung, keine Bestandsliste. Die Deckung erzeugt keinen Eintrag: sie
 *          hängt an einem Befund, sie ist keiner.
 */
export function eigeneBefunde(
  eigeneKoIds: readonly string[],
  offeneDubletten: readonly BefundPaar[],
  offeneKonflikte: readonly BefundPaar[],
  deckungJeKo: ReadonlyMap<string, Deckung>,
): EigenerBefund[] {
  // Leerer/fehlender Bezeichner ist KEINE Kennung — dieselbe Vorsicht wie bei der Autorschaft in
  // `darfSehen` (sichtbarkeit.ts:74-76), sonst würde ein Altobjekt ohne Kennung mit einem leeren
  // `koA` zusammenfallen und ein fremdes Paar als eigenes ausweisen.
  const eigene = new Set(eigeneKoIds.filter((id) => typeof id === "string" && id.length > 0));
  const ziel = new Map<string, EigenerBefund>();
  if (eigene.size === 0) {
    return [];
  }
  sammle(ziel, offeneDubletten, eigene, "dublette", deckungJeKo);
  sammle(ziel, offeneKonflikte, eigene, "konflikt", deckungJeKo);
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
  deckungJeKo: ReadonlyMap<string, Deckung>,
): EigenerBefund | null {
  return (
    eigeneBefunde(eigeneKoIds, offeneDubletten, offeneKonflikte, deckungJeKo).find(
      (befund) => befund.koId === koId,
    ) ?? null
  );
}
