// ================================================================================================
// JOB 3667 · RUNDE 5 — DIE FÄLLE DES FLIESSTEXTS, EINMAL AUFGESCHRIEBEN.
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT UND KEINE ZWEITE LISTE DANEBEN: die Nachführung vom 14.09. verlangt
// zwei Aussagen, die zusammengehören —
//
//   1. die ÜBERNAHME schreibt das Richtige (der Dienst; gemessen an der echten Route),
//   2. die VORSCHAU zeigt genau das, was die Übernahme schreibt (die Web-Fläche; gemessen am
//      gemounteten Bild).
//
// Stünden die Fälle zweimal, könnten beide Seiten grün sein und trotzdem Verschiedenes meinen —
// genau der Fehler, den Runde 4 sichtbar gemacht und Runde 5 behoben hat. Beide Prüfungen lesen
// deshalb DIESE Liste: `tests/word-rueckweg/rumpf-erhalt.test.ts` (Wirkung) und
// `tests/word-rueckweg/web-einreichweg-mounted.test.tsx` (Bild).
//
// DIE REGEL, DIE SIE ABBILDEN (`services/knowledge-object/src/service.ts`, `rumpfAusVorschlag` /
// `rumpfDerFassung`): ausgelassen ist nicht gelöscht. Ein Vorschlag ohne `bodyHtml` lässt den
// bestehenden Fließtext stehen; geleert wird nur auf das ausdrückliche `clearBody`.

/** Was NACH der Übernahme im Eintrag steht — als Herkunft, nicht als Zeichenkette. */
export type RumpfErgebnis = "bestand" | "vorschlag" | "keiner";

export interface RumpfFall {
  /** Der Name, unter dem beide Prüfungen den Fall melden. */
  name: string;
  /** Der ausführliche Inhalt, den der EINTRAG vor der Entscheidung trägt. */
  bestand: string | null;
  /** Genau die Rumpffelder, die über die Leitung gehen (`proposal` im PUT). */
  vorschlag: { bodyHtml?: string; clearBody?: true };
  /** Die Lage, die die Vorschlagsanzeige nennt (`data-rumpf`). */
  lage: "neu" | "gleich" | "bleibt" | "entfernt" | "keiner";
  /** Woher der Fließtext NACH der Übernahme stammt. */
  ergebnis: RumpfErgebnis;
}

/** Der Fließtext, den ein Eintrag in diesen Fällen trägt — ein Absatz, wiedererkennbar. */
export const BESTAND_RUMPF = "<p>Der freigegebene ausführliche Inhalt des Eintrags.</p>";
/** Der Fließtext, den ein Vorschlag mitbringen kann. */
export const VORSCHLAG_RUMPF = "<p>Ein anderer, eingereichter ausführlicher Inhalt.</p>";

export const RUMPF_FAELLE: readonly RumpfFall[] = [
  {
    // DER FALL DIESER RUNDE: genau so reicht das Word-Fenster ein (`rwEinreichen` schickt
    // statement/baseVersion/origin). Vor R5 hätte die Übernahme hier den ganzen Inhalt entfernt.
    name: "Textvorschlag aus Word an einem Eintrag MIT Inhalt — der Inhalt bleibt",
    bestand: BESTAND_RUMPF,
    vorschlag: {},
    lage: "bleibt",
    ergebnis: "bestand",
  },
  {
    name: "ausdrückliche Löschung — und nur sie leert den Inhalt",
    bestand: BESTAND_RUMPF,
    vorschlag: { clearBody: true },
    lage: "entfernt",
    ergebnis: "keiner",
  },
  {
    name: "ein mitgeschickter Inhalt ersetzt den bestehenden",
    bestand: BESTAND_RUMPF,
    vorschlag: { bodyHtml: VORSCHLAG_RUMPF },
    lage: "neu",
    ergebnis: "vorschlag",
  },
  {
    name: "derselbe Inhalt bleibt derselbe",
    bestand: BESTAND_RUMPF,
    vorschlag: { bodyHtml: BESTAND_RUMPF },
    lage: "gleich",
    ergebnis: "vorschlag",
  },
  {
    name: "kein Inhalt auf beiden Seiten — es wird nichts behauptet",
    bestand: null,
    vorschlag: {},
    lage: "keiner",
    ergebnis: "keiner",
  },
];
