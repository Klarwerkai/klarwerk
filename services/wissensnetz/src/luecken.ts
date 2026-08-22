// SPEZIFIKATIONSSTAND JOB 1577 D7 — gemessen in einer Arbeitskopie, NICHT im Produkt.
//
// KORREKTUR ZU D6 (BENs Korrekturpflicht 1). D6 gab `LueckenArt = "thema-ohne-beitragende" |
// "objekte-ohne-thema"` aus und nannte das Ergebnis `LueckenBefund`. Das war eine fachliche
// Klassifikation — genau die, die dem Owner vorbehalten ist. Der Hinweis „nur mechanische
// Ablesung" im Dateikopf hat daran nichts geaendert; ausgegeben wurde trotzdem eine Kategorie.
//
// BENs fachlicher Einwand trifft und ist der Grund fuer die Umstellung:
//
//     „bei ausschliesslich unsichtbaren Beitragenden koennte Sichtbeschraenkung sonst als
//      Wissensluecke erscheinen."
//
// Das ist kein Randfall, sondern die Bauart dieses Moduls: Die Sicht ist VOR der Auswertung
// getrimmt. Wer nicht sehen darf, ist nicht bloss ausgeblendet — er ist weg. Ein Thema, dessen
// Beitragende saemtlich vertraulich sind, sieht danach exakt aus wie ein Thema ohne Beitragende.
// Eine Funktion auf dieser Ebene KANN die beiden Faelle nicht unterscheiden.
//
// Deshalb gibt diese Datei bis zur Ownerentscheidung nur ROHE SICHTMETRIK aus: Zahlen, die
// beschreiben, was sichtbar war — und kein Wort darueber, was das bedeutet. Jedes Feld sagt im
// Namen, dass es sich auf das SICHTBARE bezieht.
import type { WissensnetzSicht } from "./lesemodell-ports";

/** Was von einem Thema sichtbar war. Keine Bewertung — nur Ablesung. */
export interface ThemenMetrik {
  readonly thema: string;
  /** Sichtbare Objekte dieses Themas. */
  readonly objekte: number;
  /**
   * Anzahl der SICHTBAREN Beitragenden. Ausdruecklich nicht „die Beitragenden": Unsichtbare
   * sind vor dieser Zaehlung entfernt worden. `0` heisst „keiner sichtbar", nicht „keiner da".
   */
  readonly sichtbareBeitragende: number;
  /**
   * `true`, wenn die Beitragendenliste am Deckel beschnitten wurde. Dann ist selbst
   * `sichtbareBeitragende` eine Untergrenze und keine Zahl.
   */
  readonly beitragendeAbgeschnitten: boolean;
}

/**
 * Rohe Sichtmetrik — die Zahlen, aus denen eine spaetere Lueckendefinition schoepfen kann.
 *
 * BEWUSST KEIN `LueckenBefund`: Solange nicht entschieden ist, was fachlich als Luecke zaehlt,
 * darf diese Ebene keine Faelle klassifizieren.
 */
export interface Sichtmetrik {
  /** Sichtbare Objekte insgesamt, nach dem Trimm. */
  readonly objekteGesamt: number;
  /** Sichtbare Objekte ohne Thema. */
  readonly ohneThema: number;
  /** Verschiedene sichtbare Beitragende insgesamt. */
  readonly sichtbareBeitragendeGesamt: number;
  readonly themen: readonly ThemenMetrik[];
}

/**
 * MODULINTERN. Steht nicht im Paket-Index: Wer eine Sicht besitzt, soll sie nicht auswerten
 * koennen — die Sicherheitsgrenze liegt in `wissensnetzLuecken`, das die Sicht selbst erzeugt.
 *
 * Rechnet ausschliesslich um; trifft keine Sichtbarkeitsentscheidung und keine fachliche.
 */
export function sichtmetrik(sicht: WissensnetzSicht): Sichtmetrik {
  return {
    objekteGesamt: sicht.objekteGesamt,
    ohneThema: sicht.ohneThema,
    sichtbareBeitragendeGesamt: sicht.beitragendeGesamt,
    themen: sicht.themen.map((t) => ({
      thema: t.thema,
      objekte: t.objekte,
      sichtbareBeitragende: t.beitragende.length,
      beitragendeAbgeschnitten: t.beitragendeAbgeschnitten,
    })),
  };
}
