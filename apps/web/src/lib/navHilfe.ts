// ================================================================================================
// JOB 3028 · U3 — DER MENÜPUNKT SAGT VOR DEM KLICK, WAS HINTER IHM LIEGT.
// ================================================================================================
//
// Nataschas dritte Hürde ist die Navigation: „Meine Aufgaben" ist systemzentriert benannt, und wer
// nicht geschult ist, erfährt erst NACH dem Klick, was dahinter liegt. Die Erklärungen dafür gibt
// es längst — sie stehen seit SCRUM-219 als Hilfekapitel im Produkt (`lib/helpTopics.ts`), nur an
// der einen Stelle, an der jemand, der die Navigation nicht versteht, zuletzt nachsieht.
//
// Diese Datei bringt sie an die Stelle, an der die Frage entsteht. Sie erfindet dafür KEINEN Satz:
// sie liefert zu einem Pfad die i18n-Schlüssel des VORHANDENEN Kapitels — oder `null`.
//
// WARUM ABGELEITET UND NICHT ABGESCHRIEBEN. Eine Tabelle „Route → Text" wäre eine zweite Wahrheit
// neben `HELP_TOPICS` und liefe beim nächsten neuen Kapitel auseinander, ohne dass es jemand
// merkte. Deshalb wird `HELP_TOPICS` IMPORTIERT und `topic.to` mit dem Pfad verglichen. Kommt
// später ein Kapitel dazu, zieht der Hinweis von selbst mit.
//
// EHRLICHKEIT VOR OPTIK: wo es kein Kapitel gibt, sagt der Menüpunkt NICHTS. Ein Hinweis, der
// überall steht, ist kein Hinweis; ein erfundener Halbsatz wäre eine Behauptung ohne Deckung.
import { HELP_TOPICS } from "./helpTopics";

/** Die Schlüssel des Kapitels, das zu einem Menüpunkt gehört. Kein Text — nur die Herkunft. */
export interface NavHilfe {
  titleKey: string;
  bodyKey: string;
}

// ------------------------------------------------------------------------------------------------
// DIE EINE AUSGESCHRIEBENE AUSNAHME: `/admin`.
// ------------------------------------------------------------------------------------------------
//
// Auf dieser Route liegt genau ein Kapitel, `firststart` (`helpTopics.ts:15-21`, Schlagwörter
// „demodaten", „seed", „erststart", „onboarding", „setup"). Es beantwortet „wie richte ich das
// System das erste Mal ein" — und NICHT „was liegt unter dem Menüpunkt Verwaltung". Sein Text
// lautet (de): „Frische Instanzen sind zunächst leer. Als Admin kannst du unter Admin 'Demodaten
// laden', um Beispiel-Wissen, Validierung, Lücken und Konflikte sichtbar zu machen — ideal für
// Review und Einarbeitung."
//
// Ein Kapitel, das eine ANDERE Frage beantwortet, ist keine ehrliche Vorschau: Wer den Menüpunkt
// berührt, bekäme eine Einrichtungsanleitung statt einer Auskunft darüber, wohin der Klick führt.
// Entscheidung dieses Auftrags (JOB 3028): `/admin` bekommt deshalb keinen Hinweis. Fällt das
// Urteil eines Tages anders aus, wird diese eine Zeile gestrichen — nicht ein Satz erfunden.
const OHNE_HINWEIS: readonly string[] = ["/admin"];

/**
 * Das Hilfekapitel zu einem Menüpunkt-Pfad, oder `null`.
 *
 * Vier Regeln, und keine davon rät:
 *   · genau EIN Kapitel mit `to === path`  → dieses Kapitel,
 *   · kein Kapitel                          → `null`,
 *   · MEHRERE Kapitel auf derselben Route   → `null` (mehrdeutig — es wird nicht das erste genommen),
 *   · Pfad in `OHNE_HINWEIS`                → `null` (die begründete Ausnahme oben).
 */
export function navHilfeFor(path: string): NavHilfe | null {
  if (OHNE_HINWEIS.includes(path)) {
    return null;
  }
  const treffer = HELP_TOPICS.filter((topic) => topic.to === path);
  const einziges = treffer.length === 1 ? treffer[0] : undefined;
  if (!einziges) {
    return null;
  }
  return { titleKey: einziges.titleKey, bodyKey: einziges.bodyKey };
}
