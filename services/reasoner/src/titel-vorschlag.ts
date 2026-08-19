// ================================================================================================
// JOB 508 · D9 — DER TITELVORSCHLAG. EINE REINE ABLEITUNG, KEIN ZWEITER MODELLAUFRUF.
// ================================================================================================
//
// ------------------------------------------------------------------------------------------------
// REICHWEITE: SERVERINTERNE VORARBEIT. KEIN SICHTBARER NUTZEN.
// ------------------------------------------------------------------------------------------------
//
// Bis D8 stand hier: „DAS NUTZERVERSPRECHEN: Wer ein Wissensobjekt ablegt, bekommt einen
// brauchbaren Titelvorschlag statt eines leeren Feldes." DAS WAR EINE BEHAUPTUNG, KEINE MESSUNG —
// BEN hat D8 genau dafür mit PRODUKT ROT beurteilt: „erreicht weder die reale Reasoner-Fassade
// noch Wire, Client oder Renderer".
//
// Was heute wirklich gilt, in D9 an der Quelle nachgemessen:
//
//   · Die Ableitung ist gebaut und über `services/reasoner/index.ts` an der Dienstgrenze
//     erreichbar. Das ist die Voraussetzung einer Anbindung — nicht die Anbindung.
//   · `describeImage` in `./src/service` ruft sie NICHT.
//   · `DescribeImageResult` trägt kein Titelfeld, also führt auch kein Wiretyp einen Titel.
//   · Der Client holt in `apps/web/src/api/endpoints.ts` dasselbe Ergebnis ohne Titel.
//   · Der Renderer schreibt eine Bildbeschreibung in die FIGCAPTION
//     (`apps/web/src/components/RichTextEditor.tsx`) — nicht in ein Titelfeld.
//
// KEIN ANWENDER SIEHT HEUTE EINEN TITELVORSCHLAG, und diese Datei darf nichts anderes behaupten.
// Wer die Kette schliessen will, braucht die in der D9-Rückgabe namentlich aufgeführten Pfade;
// sie waren in diesem Durchgang nicht geleast.
//
// WAS DIESE DATEI IST: eine reine Funktion von einem bereits vorhandenen `DescribeImageResult` auf
// einen Titelvorschlag. Sie ruft KEIN Modell, sie öffnet KEINE Verbindung, sie liest KEINE Umgebung.
// Derselbe Eingang ergibt immer denselben Ausgang — deshalb ist sie ohne Dienst prüfbar, und genau
// das verlangt der Auftrag (§4: „muss ohne externen Dienst funktionieren und prüfbar sein").
//
// WAS SIE AUSDRÜCKLICH NICHT TUT — und das ist der eigentliche Gegenstand:
//
//   Sie erfindet nichts. Es gibt vier Lagen, in denen ein Titel eine Behauptung wäre statt einer
//   Ableitung, und in allen vieren liefert sie `null` MIT GRUND statt eines Textes:
//
//     · kein Modellergebnis (`text: null`)          → `kein_text`
//     · ein Demo-Ergebnis (`demo: true`)            → `demo`
//     · ein vertraulich ausgeschlossenes Bild        → `vertraulich`
//     · leerer oder reiner Leerraum-Text            → `leer`
//
//   DER WICHTIGSTE DAVON IST DER DRITTE. Ein vertrauliches Bild wird bewusst NICHT an die
//   Cloud-Vision gegeben (`fallbackReason: "confidential"`, s. `types.ts`). Entstünde daraus über
//   den Umweg eines Titels doch noch eine Aussage, wäre der Egress-Ausschluss unterlaufen — nicht
//   technisch, aber inhaltlich. Deshalb wird `vertraulich` VOR allen anderen Gründen geprüft: Er
//   darf niemals von `demo` oder `leer` überdeckt werden, sonst ließe sich „vertraulich, deshalb
//   nichts" nicht mehr von „nichts da" unterscheiden.
//
// WARUM DER GRUND MITREIST, auch im Erfolgsfall: Ein Vorschlag ohne Begründung ist für die Fläche
// nicht von einem Zufall zu unterscheiden. Der Aufrufer soll „abgeleitet" sehen und nicht raten
// müssen, ob überhaupt etwas gerechnet wurde.
import type { DescribeImageResult } from "./types";

/**
 * Die Obergrenze eines Titels in Zeichen.
 *
 * Sie ist eine ANZEIGEGRENZE, keine fachliche Aussage: Ein Titel ist eine Benennung, und eine
 * Benennung, die über eine Zeile hinausgeht, ist keine mehr. Der Schnitt fällt auf eine Wortgrenze
 * — ein abgeschnittenes Wort wäre eine falsche Benennung, keine gekürzte.
 */
export const TITEL_MAX_ZEICHEN = 80;

/** Warum kein Titel entstand — oder dass einer entstand. Geschlossene Menge, fail-closed lesbar. */
export type TitelVorschlagGrund = "abgeleitet" | "kein_text" | "demo" | "vertraulich" | "leer";

export type TitelVorschlagErgebnis =
  | { readonly titel: string; readonly grund: "abgeleitet" }
  | {
      readonly titel: null;
      readonly grund: Exclude<TitelVorschlagGrund, "abgeleitet">;
    };

/**
 * Leerraum vereinheitlichen: jede Folge aus Leerzeichen, Tabulatoren und Zeilenumbrüchen wird zu
 * GENAU EINEM Leerzeichen, vorn und hinten fällt er weg.
 *
 * Dieselbe Speicherform-Regel wie in JOB 593: Zwei Titel, die sich nur in der Zahl der Leerzeichen
 * unterscheiden, sind derselbe Titel — und dürfen nicht als zwei erscheinen.
 */
function leerraumVereinheitlichen(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * Der erste Satz gewinnt.
 *
 * Eine Benennung trägt einen Gegenstand, keine Erzählung. Steht in der Beschreibung „Ein
 * Kegelradgetriebe. Daneben liegt ein Schlüssel.", ist der Gegenstand das Getriebe; der zweite Satz
 * gehört in den Text, nicht in den Titel. Gesucht wird ein Satzende, dem ein Leerzeichen folgt —
 * so bleibt „P-12.5 mm" ein Wort und wird nicht an seinem Punkt zerschnitten.
 */
function ersterSatz(text: string): string {
  const treffer = /^(.*?[.!?])\s/u.exec(text);
  return treffer?.[1] ?? text;
}

/**
 * Auf die Anzeigegrenze kürzen — an der letzten Wortgrenze davor.
 *
 * Gibt es innerhalb der Grenze keine Wortgrenze (ein einziges überlanges Wort), wird hart
 * geschnitten: ein Titel, der die Grenze sprengt, wäre in der Fläche unbrauchbar, und ein leerer
 * wäre eine Falschaussage über einen vorhandenen Text.
 */
function aufGrenzeKuerzen(text: string): string {
  if (text.length <= TITEL_MAX_ZEICHEN) {
    return text;
  }
  const stueck = text.slice(0, TITEL_MAX_ZEICHEN);
  const letzteLuecke = stueck.lastIndexOf(" ");
  return letzteLuecke > 0 ? stueck.slice(0, letzteLuecke) : stueck;
}

/**
 * Satzschlusszeichen am ENDE entfernen — innen bleiben sie stehen.
 *
 * „Eine Hydraulikpumpe im Prüfstand." wird zu „Eine Hydraulikpumpe im Prüfstand"; „Pumpe P-12,
 * Ventil V-3" bleibt unangetastet. Der Titel ist eine Benennung, keine Aussage — ein Schlusspunkt
 * würde behaupten, hier stünde ein Satz.
 */
function schlusszeichenEntfernen(text: string): string {
  return text.replace(/[.,;:!?…]+$/u, "").trimEnd();
}

/**
 * Der Titelvorschlag zu einem Bildbeschreibungs-Ergebnis.
 *
 * REIHENFOLGE DER PRÜFUNGEN, und sie ist Absicht:
 *   1. `vertraulich` — der Egress-Ausschluss wiegt am schwersten und wird nie überdeckt.
 *   2. `kein_text`   — ohne Modellergebnis gibt es nichts abzuleiten.
 *   3. `demo`        — ein deterministischer Rückfall ist kein Wissen.
 *   4. `leer`        — Text vorhanden, aber ohne Inhalt.
 *
 * Erst danach wird abgeleitet. Die Ableitung KÜRZT nur; sie fügt nie etwas hinzu. Deshalb ist der
 * Titel nie länger als die Beschreibung, und deshalb ist ein zweiter Durchlauf wirkungslos: Ein
 * bereits abgeleiteter Titel trägt keinen Leerraum zu viel, kein Satzende und keine Überlänge mehr.
 */
export function titelVorschlag(ergebnis: DescribeImageResult): TitelVorschlagErgebnis {
  if (ergebnis.fallbackReason === "confidential") {
    return { titel: null, grund: "vertraulich" };
  }
  if (ergebnis.text === null || ergebnis.text === undefined) {
    return { titel: null, grund: "kein_text" };
  }
  if (ergebnis.demo) {
    return { titel: null, grund: "demo" };
  }
  const bereinigt = leerraumVereinheitlichen(ergebnis.text);
  if (bereinigt === "") {
    return { titel: null, grund: "leer" };
  }
  const titel = schlusszeichenEntfernen(aufGrenzeKuerzen(ersterSatz(bereinigt)));
  if (titel === "") {
    // Ein Text, der nur aus Satzzeichen besteht, trägt keine Benennung. Ehrlich leer statt eines
    // Titels aus Interpunktion.
    return { titel: null, grund: "leer" };
  }
  return { titel, grund: "abgeleitet" };
}
