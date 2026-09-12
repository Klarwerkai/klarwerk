// ================================================================================================
// JOB 3581 · WAS BEDEUTET ES, WENN DIE PROZESSMESSUNG NICHT STATTGEFUNDEN HAT?
// ================================================================================================
//
// `chromium-prozesszahl.test.ts` (C1) misst die Chromium-Prozesszahl dieses Hauses. Scheitert die
// Messung, gibt es GENAU ZWEI Lagen, und sie wiegen verschieden schwer:
//
//   UMGEBUNG · Der Browser ist gar nicht erst gestartet. Dann hat diese Maschine nichts gezeigt,
//              sondern die Umgebung hat den Start verweigert (BEN an JOB 3560: „Die Prozesszahl
//              wurde lokal wegen macOS-Sandbox-Sperre nicht gemessen", `archiv/3560/runde-2/
//              ben.md:30`). Das ist eine Grenze des Rechners und niemandem anzulasten: ERLAUBT.
//   BEFUND   · Der Browser WAR da, und danach ist etwas schiefgegangen — leere CDP-Prozessliste,
//              Zeitgrenze, gescheitertes `close()`. Jede dieser Aussagen handelt von Chromium und
//              von dieser Maschine, nicht von der Umgebung: NICHT ERLAUBT, C1 faerbt rot.
//
// DIE REGEL IST STRUKTURELL, NICHT TEXTLICH. Sie haengt allein daran, ob `chromium.launch()`
// zurueckkam — an einer beobachteten Tatsache des Laufs, nicht am Wortlaut einer Fehlermeldung.
// Eine Freitextsuche (`includes("sandbox")`, ein Muster auf „denied") waere die naheliegende und
// die falsche Antwort: solche Raster sind am Tag ihrer Entstehung richtig und zerfallen mit der
// naechsten Playwright-Fassung — dieselbe Lehre, die `browser-gruppe.ts:20-36` am Bestand belegt
// („eine Textsuche nach ‚playwright' trifft im eigenen Bestand nachweislich daneben"), und
// dieselbe, die BEN in LEHREN.md zu JOB 3345 festgehalten hat: „Fehlermeldungen aus
// Umgebungsproblemen (Browserstart, Zeitgrenzen) bitte als ‚Startabbruch, Text lastabhaengig'
// melden, nicht als feste Eigenschaft — der Pruefer sieht auf derselben Maschine oft einen anderen
// Text." Die Fehlertexte werden deshalb WEITERGETRAGEN, aber nie GELESEN.
//
// KEIN BROWSER-PAKET. Dieses Modul importiert nichts; insbesondere keines der `BROWSER_PAKETE`
// (`browser-gruppe.ts:106`). Es darf deshalb in der parallelen Gruppe laufen und zieht keine Datei,
// die es importiert, in die serielle Browser-Gruppe.
//
// WAS DIESES MODUL NICHT BEURTEILT: ob ueberhaupt ein Fehlertext vorliegt. Ein „nicht gemessen"
// ohne jeden Fehler waere ein stummer Ausfall; den faengt C1 mit seiner eigenen, unveraenderten
// Zusicherung `expect(fehler.length).toBeGreaterThan(0)` ab. Hier wird nur EINE Frage beantwortet,
// dafuer an genau einer Stelle: wie schwer wiegt der Ausfall?

/** Was vom gescheiterten Messlauf bekannt ist. */
export interface Ausfalllage {
  /** Kam `chromium.launch()` zurueck? Die einzige Tatsache, an der die Klasse haengt. */
  readonly gestartet: boolean;
  /** Die gesammelten Fehlertexte, woertlich und in der Reihenfolge ihres Auftretens. */
  readonly fehler: readonly string[];
}

/** Das Urteil ueber einen Ausfall. */
export interface Ausfallurteil {
  /** `umgebung` = der Start war nicht moeglich; `befund` = nach dem Start ging etwas schief. */
  readonly klasse: "umgebung" | "befund";
  /** Darf C1 mit diesem Ausfall gruen bleiben? */
  readonly erlaubt: boolean;
  /** Ein Satz zur Lage, gefolgt von den Fehlertexten im Wortlaut. */
  readonly grund: string;
}

/** Die Fehlertexte fuer den Grund — woertlich, ohne Kuerzung, mit ehrlichem Leerfall. */
function texte(fehler: readonly string[]): string {
  return fehler.length === 0 ? "kein Fehlertext festgehalten" : fehler.join(" | ");
}

/**
 * Wiegt einen gescheiterten Prozessmesslauf: Umgebungsgrenze oder Befund?
 *
 * Rein: gleiche Lage, gleiches Urteil, keine Uhr, keine Umgebung, kein Dateizugriff.
 */
export function klassifiziereAusfall({ gestartet, fehler }: Ausfalllage): Ausfallurteil {
  if (!gestartet) {
    return {
      klasse: "umgebung",
      erlaubt: true,
      grund: `Umgebungsgrenze: der Browserstart kam nicht zurueck, es wurde nichts gemessen — ${texte(fehler)}`,
    };
  }
  return {
    klasse: "befund",
    erlaubt: false,
    grund: `Befund: Chromium war gestartet, die Messung ist danach gescheitert — ${texte(fehler)}`,
  };
}
