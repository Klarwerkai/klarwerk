// ================================================================================================
// JOB 2489 · D1 — DIE RANGFOLGE DER TITELQUELLEN. RANG 1: DER OBJEKTTEXT.
// ================================================================================================
//
// DIE ENTSCHEIDUNG, IM WORTLAUT (`00_CONTROL/ENTSCHEIDUNGEN/JOB-508.md`, Nachtrag 19.08.2026,
// Punkt 2):
//
//   „Die Quelle eines kuenftigen Titelvorschlags ist der Inhalt des Wissensobjekts: der Objekttext,
//    wenn er vorhanden ist; sonst die Bildbeschreibung (`DescribeImageResult`), also der Bildweg.
//    Nicht zwei Vorschlaege, nicht eine Mischung — eine Quelle je Objekt, in dieser Rangfolge."
//
// WARUM DIE ENTSCHEIDUNG HIER FÄLLT UND NICHT IM DIENST — gemessen, nicht gewählt:
//
//   Eine Rangfolge kann nur dort entstehen, wo BEIDE Quellen bekannt sind. Der Dienst kennt nur
//   das Bild: `titelVorschlag()` in `services/reasoner/src/titel-vorschlag.ts` nimmt ein
//   `DescribeImageResult` und sonst nichts, und `describeImage` bekommt vom Objekt nur den
//   budgetierten Kontext um die Figur herum (`collectImageContext`) — nicht den ganzen Text.
//   Die Fläche dagegen hat beides: den Rumpf im Editor und die Antwort vom Dienst.
//
//   UND ES SPART EINEN EGRESS. Würde die Rangfolge im Dienst entschieden, müsste der ganze
//   Objekttext dorthin reisen — für eine Ableitung, die rein rechnerisch ist und kein Modell
//   braucht. Der Titel entsteht hier aus Text, der den Rechner ohnehin nicht verlässt.
//
// WARUM DIE REGELN HIER EIN ZWEITES MAL STEHEN, statt importiert zu werden: `apps/web/src` darf
// nicht aus `services/` importieren — der webbuild-Stage im Dockerfile kopiert NUR `apps/web`, ein
// solcher Import bricht den Produktions-Build. Dieselbe Grenze wie beim Wiretyp in `api/types.ts`,
// und dieselbe Antwort darauf: die Form steht doppelt, und ein Wächter vergleicht beide Seiten im
// Quelltext (`tests/reasoner/tv1-titelregeln-dienstgrenze.test.ts`). Gemessen am 26.08.: es gibt im
// ganzen Baum keine einzige Ausnahme von dieser Grenze.

import { htmlToPlainText } from "./richText";

/** Woher ein Titelvorschlag stammt. Geschlossene Menge, in der Rangfolge der Entscheidung. */
export type TitelQuelle = "objekttext" | "bild";

export interface TitelMitQuelle {
  readonly titel: string;
  readonly quelle: TitelQuelle;
}

/** Die Obergrenze eines Titels in Zeichen. Spiegel von `TITEL_MAX_ZEICHEN` im Dienst. */
export const TITEL_MAX_ZEICHEN = 80;

/** Leerraum vereinheitlichen — Spiegel von `leerraumVereinheitlichen`. */
function leerraumVereinheitlichen(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** Der erste Satz gewinnt — Spiegel von `ersterSatz`. */
function ersterSatz(text: string): string {
  const treffer = /^(.*?[.!?])\s/u.exec(text);
  return treffer?.[1] ?? text;
}

/** Auf die Anzeigegrenze kürzen, an der letzten Wortgrenze — Spiegel von `aufGrenzeKuerzen`. */
function aufGrenzeKuerzen(text: string): string {
  if (text.length <= TITEL_MAX_ZEICHEN) {
    return text;
  }
  const stueck = text.slice(0, TITEL_MAX_ZEICHEN);
  const letzteLuecke = stueck.lastIndexOf(" ");
  return letzteLuecke > 0 ? stueck.slice(0, letzteLuecke) : stueck;
}

/** Satzschlusszeichen am Ende entfernen — Spiegel von `schlusszeichenEntfernen`. */
function schlusszeichenEntfernen(text: string): string {
  return text.replace(/[.,;:!?…]+$/u, "").trimEnd();
}

/**
 * Die Benennung zu einem Text — Spiegel von `titelAusText` im Dienst.
 *
 * `null` heisst: aus diesem Text lässt sich keine Benennung gewinnen (leer, oder nur Satzzeichen).
 * Sie KÜRZT nur und fügt nie etwas hinzu.
 */
export function titelAusObjekttext(text: string): string | null {
  const bereinigt = leerraumVereinheitlichen(text);
  if (bereinigt === "") {
    return null;
  }
  const titel = schlusszeichenEntfernen(aufGrenzeKuerzen(ersterSatz(bereinigt)));
  return titel === "" ? null : titel;
}

/**
 * DER OBJEKTTEXT eines Beitrags — sein Rumpf OHNE die Bild-Fussnoten.
 *
 * WARUM NICHT EINFACH `bodyTextForAssist`, gemessen statt vermutet: `htmlToPlainText`
 * (`apps/web/src/lib/richText.ts`) ersetzt `</figcaption>` durch ein Leerzeichen und behaelt den
 * Text der Fussnote. Eine Bild-Fussnote IST aber die Bildbeschreibung — sie traegt genau das, was
 * der Bildweg liefert, teils woertlich, weil der Nutzer den Vorschlag dort uebernommen hat.
 *
 * WAERE SIE TEIL DES OBJEKTTEXTES, gaebe es die Rangfolge nur dem Namen nach: Rang 1 gewaenne mit
 * dem Inhalt von Rang 2, und die Flaeche zeigte „aus dem Text dieses Beitrags" ueber einem Satz,
 * den die Bildbeschreibung geschrieben hat. Das ist die MISCHUNG, die die Entscheidung ausdruecklich
 * verbietet — und sie waere von aussen nicht zu erkennen. Deshalb faellt `<figure>` zuerst weg.
 */
export function objekttextAusRumpf(bodyHtml: string | null | undefined): string {
  if (!bodyHtml) {
    return "";
  }
  return htmlToPlainText(bodyHtml.replace(/<figure\b[\s\S]*?<\/figure>/giu, " "));
}

/**
 * DIE RANGFOLGE. Eine Quelle je Objekt — nie zwei, nie eine Mischung.
 *
 * `objekttext` ist der reine Text des Beitrags (über `bodyTextForAssist` aus dem Rumpf gewonnen);
 * `ausBild` der bereits abgeleitete Titel aus der Bildbeschreibung, oder `null`.
 *
 * DER FALL, DER DIE REGEL TRÄGT: Liegt BEIDES vor, gewinnt der Objekttext — auch dann, wenn das
 * Bild einen brauchbaren Titel hergäbe. Das ist keine Qualitätsaussage über die beiden Quellen,
 * sondern die Entscheidung: Der Beitrag benennt sich aus dem, was der Mensch geschrieben hat;
 * das Bild ist der Ersatz, wenn er noch nichts geschrieben hat.
 *
 * `null` heisst: keine der beiden Quellen trägt eine Benennung. Dann wird NICHTS gezeigt und
 * nichts erfunden — der ehrliche Negativfall des Bildwegs bleibt unangetastet.
 */
export function titelNachRangfolge(
  objekttext: string,
  ausBild: string | null,
): TitelMitQuelle | null {
  const ausText = titelAusObjekttext(objekttext);
  if (ausText !== null) {
    return { titel: ausText, quelle: "objekttext" };
  }
  const bild = ausBild?.trim() ?? "";
  return bild.length > 0 ? { titel: bild, quelle: "bild" } : null;
}
