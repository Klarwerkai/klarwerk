// ================================================================================================
// AUFTRAG-mega52 BLOCK A3 — DIE ANTWORT SAGT, WORAUF SIE STEHT.
// ================================================================================================
//
// DER BEFUND (Pedi, Word-Handlauf 28.07.; am Code erhoben). Die Antwort wusste nicht, welche Quelle
// sie getragen hat. Es gab nur `sources`, pauschal aus allen bis zu acht Kandidaten gefüllt. Der
// Prompt nummerierte die Quellen und ERLAUBTE Verweise — zurückgelesen wurden die Marken nie.
// mega39 D2 hat diese Lücke bereits benannt und die zweite, nichtssagende Liste ausgeblendet; die
// echte Trennung von ZITIERTEN gegen HERANGEZOGENE Quellen war ausdrücklich vertagt. Hier ist sie.
//
// DIE FORM, und warum diese (A3 überlässt sie mir, verlangt aber die Begründung):
//
//  1. EINE Liste, nicht zwei. Zwei Listen untereinander sind genau der Fehler, den mega39 D2 gerade
//     beseitigt hat — dieselben Einträge zweimal lesen sich als Fülltext, nicht als Nachweis. Die
//     bestehende Quellenliste bleibt also die eine Liste; sie bekommt eine Ordnung und ein
//     Kennzeichen.
//  2. TRAGENDE ZUERST, in der Rangfolge des Rankings. Was die Antwort trägt, steht oben und ist als
//     solches beschriftet. Die übrigen folgen darunter und heißen, was sie sind: angesehen, nicht
//     verwendet. Kein Ausblenden — eine herangezogene Quelle zu verschweigen wäre ein neuer blinder
//     Fleck, und `ask.sourcesHint` verspricht seit jeher die vollständige Liste.
//  3. UNBEKANNT IST EIN EIGENER ZUSTAND, nicht „keine". Liefert das Modell keine oder unbrauchbare
//     Marken (A5), trägt KEINE Quelle ein Kennzeichen und die Oberfläche sagt ausdrücklich, dass die
//     Zuordnung nicht möglich war. Niemals raten, niemals stillschweigend auf alle zurückfallen.
//     Genau deshalb sind `undefined` (alter Server, Feld fehlt) und `[]` (Modell ohne Marken) hier
//     DERSELBE Zustand: `unattributed`. Beide heißen „wir wissen es nicht".
//
// WARUM DOM-FREI UND HIER: dieselbe Bauform wie `askSteps.ts`/`askView.ts` — die Entscheidung ist
// eine reine Funktion über Daten, testbar ohne Mount, und Desktop wie Mobil lesen dieselbe eine
// Quelle statt sich je ein eigenes Urteil zu bilden.

/** Minimal, was eine Quellenzeile zum Sortieren braucht — bewusst strukturell (s. askSteps.ts). */
export interface CitableSourceLike {
  id: string;
}

/**
 * `attributed`   — das Modell hat markiert, und mindestens eine Marke war verwertbar.
 * `unattributed` — keine verwertbare Marke ODER der Server kennt das Feld nicht (A5).
 */
export type CitationState = "attributed" | "unattributed";

export function citationState(citedSources: readonly string[] | undefined): CitationState {
  return citedSources !== undefined && citedSources.length > 0 ? "attributed" : "unattributed";
}

/** Eine Quellenzeile plus die eine Frage, die diesen Auftrag ausgelöst hat. */
export type AttributedSource<T> = T & {
  // true  → diese Quelle trägt die Antwort (ihre Marke stand im Antworttext).
  // false → herangezogen, aber nicht verwendet — ODER die Zuordnung ist unbekannt.
  // Wer „unbekannt" von „nicht verwendet" unterscheiden muss, liest `citationState` dazu; ein
  // drittes Flag je Zeile wäre dieselbe Aussage doppelt und könnte auseinanderlaufen.
  carrying: boolean;
};

/**
 * Ordnet die Quellen: tragende zuerst, danach die übrigen. Innerhalb beider Gruppen bleibt die
 * Eingabereihenfolge (die Rangfolge des Rankings) erhalten — stabil, kein Neusortieren nach
 * Titel oder Trust.
 *
 * Ist die Zuordnung unbekannt (A5), trägt KEINE Quelle das Kennzeichen und die Reihenfolge bleibt
 * unverändert. Das ist der Punkt: ohne Wissen wird nichts umsortiert und nichts behauptet.
 */
export function attributeSources<T extends CitableSourceLike>(
  sources: readonly T[],
  citedSources: readonly string[] | undefined,
): AttributedSource<T>[] {
  if (citationState(citedSources) === "unattributed") {
    return sources.map((s) => ({ ...s, carrying: false }));
  }
  const cited = new Set(citedSources ?? []);
  const marked = sources.map((s) => ({ ...s, carrying: cited.has(s.id) }));
  return [...marked.filter((s) => s.carrying), ...marked.filter((s) => !s.carrying)];
}

/**
 * Darf für DIESE Quelle gedankt werden?
 *
 * mega52 A4: der Answer-Receipt bindet serverseitig nur noch die TRAGENDEN Quellen — ein „Danke"
 * auf eine bloß angesehene Quelle würde dort mit 403 enden. Die Oberfläche bietet ihn deshalb gar
 * nicht erst an, statt den Nutzer in einen Fehler laufen zu lassen. Ist die Zuordnung unbekannt,
 * ist für KEINE Quelle ein Danke möglich — ein Vertrauensplus auf Verdacht ist genau die stille
 * Verfälschung, die dieser Block beseitigt.
 */
export function canThank(source: { carrying: boolean }): boolean {
  return source.carrying;
}
