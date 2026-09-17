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
import type { VerknuepfungAusgelassenGrund, WissensnetzSicht } from "./lesemodell-ports";
import type { Themenkarte } from "./themenkarte";

// JOB 4155 (WG-LUECKEN): Der Grund reist als TYP weiter nach oben, damit die Fläche ihn als Satz
// ausgeben kann. Er wird hier NICHT neu deklariert — eine zweite, abgeschriebene Union wäre genau
// die zweite Wahrheit, gegen die `lesemodell-ports.ts:244-247` sie als geschlossene Union baut.
export type { VerknuepfungAusgelassenGrund };

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
  /**
   * ==============================================================================================
   * JOB 4155 (WG-LUECKEN) — DIE KANTENZAEHLER KOMMEN HIER AN, IN DERSELBEN BAUFORM WIE EINE EBENE
   * TIEFER.
   * ==============================================================================================
   *
   * Sichtbare Objekte dieses Themas MIT mindestens einer sichtbaren kuratierten Kante — und ohne.
   * Beide Schluessel FEHLEN, wenn nicht erhoben wurde (`WissensnetzThema.verknuepft`,
   * `lesemodell-ports.ts:231-240`): eine `0` waere hier eine Aussage, und zwar eine falsche.
   *
   * Bis zu diesem Auftrag warf `sichtmetrik()` beide Felder ersatzlos weg. Der Aufrufer konnte
   * eine fehlende Zahl nicht von einer nicht gestellten Frage unterscheiden — genau die stille
   * Differenz, gegen die `lesemodell-ports.ts:297-303` eine Ebene tiefer gebaut ist.
   *
   * DURCHGEREICHT, NICHT NEU GERECHNET: keine zweite Zaehlung, keine Schwelle, keine Rangfolge.
   * Ob ein unverknuepftes Objekt eine Luecke IST, entscheidet diese Ebene weiterhin nicht
   * (Dateikopf, `:18-20`).
   */
  readonly verknuepft?: number;
  readonly unverknuepft?: number;
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
  /**
   * JOB 2600 D1 — die Themenkarte dieses Betrachters. Sie ist eine ABLESUNG wie alles andere hier:
   * Knoten mit Groesse und Farbe, Kanten mit Gewicht — kein Urteil darueber, was das bedeutet.
   *
   * Der Schluessel fehlt, wenn die Karte nicht erhoben wurde. Sie enthaelt ausdruecklich KEINE
   * globalen Mengen: keine Gesamtzahl, keine vollstaendige Schlagwortliste, keine Traegerzahl
   * ausserhalb der gezeichneten Knoten.
   */
  readonly themenkarte?: Themenkarte;
  /**
   * ==============================================================================================
   * JOB 4155 (WG-LUECKEN) — „NICHT ERHOBEN" IST EINE AUSKUNFT UND KEINE LUECKE IN DER ANTWORT.
   * ==============================================================================================
   *
   * `true`, wenn die Kantenzaehler oben ausgelassen wurden. Wortgleich uebernommen von
   * `WissensnetzSicht.verknuepfungAusgelassen` (`lesemodell-ports.ts:297-304`) — dieselbe
   * Begruendung, dieselbe Bauform, keine zweite Rechnung.
   *
   * **Nicht optional**, anders als die Zaehler selbst: die Frage „wurde erhoben?" ist IMMER
   * beantwortbar, und ein `undefined` waere hier keine ehrliche Auslassung, sondern eine fehlende
   * Auskunft. Ohne dieses Feld saehe „nicht gefragt" aus wie „gefragt und nichts gefunden".
   */
  readonly verknuepfungAusgelassen: boolean;
  /**
   * **Warum** ausgelassen wurde — der Schluessel FEHLT ohne Auslassung (nicht `undefined` als
   * Wert): ein Grund ohne Auslassung waere eine Aussage ueber nichts.
   *
   * Die beiden Gruende verlangen entgegengesetzte Reaktionen: `kein-kantenport` ist ein Fehler der
   * Kompositionswurzel und gehoert repariert, `zu-viele-objekte` ist erwartetes Verhalten und
   * verlangt eine engere Abfrage (`lesemodell-ports.ts:305-318`). Die Flaeche sagt deshalb den
   * GRUND und nicht bloss „keine Angabe" — und ausdruecklich KEINE 0.
   */
  readonly verknuepfungAusgelassenGrund?: VerknuepfungAusgelassenGrund;
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
      // JOB 4155: Schluessel FEHLT, wenn nicht erhoben — nie `0`. Beide haengen an DERSELBEN
      // Bedingung wie eine Ebene tiefer (`lesemodell.ts:296-300`); sie werden hier weder einzeln
      // aufgefuellt noch aus der anderen Zahl abgeleitet.
      ...(t.verknuepft !== undefined ? { verknuepft: t.verknuepft } : {}),
      ...(t.unverknuepft !== undefined ? { unverknuepft: t.unverknuepft } : {}),
    })),
    // Durchgereicht, nicht neu gerechnet: die Karte entsteht in `themenkarte.ts` aus derselben
    // getrimmten Menge. Der Schluessel fehlt, wenn sie nicht erhoben wurde.
    ...(sicht.themenkarte !== undefined ? { themenkarte: sicht.themenkarte } : {}),
    // JOB 4155: der Schalter IMMER, der Grund nur mit Auslassung — wortgleich die Bauform der
    // Sicht (`lesemodell.ts:313-328`). Ein `verknuepfungAusgelassenGrund` ohne Auslassung waere
    // eine Aussage ueber nichts.
    verknuepfungAusgelassen: sicht.verknuepfungAusgelassen,
    ...(sicht.verknuepfungAusgelassenGrund !== undefined
      ? { verknuepfungAusgelassenGrund: sicht.verknuepfungAusgelassenGrund }
      : {}),
  };
}
