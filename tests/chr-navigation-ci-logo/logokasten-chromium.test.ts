// ================================================================================================
// JOB 3582 · CHR-NAVIGATION-SCHMAL REST — MIT FIRMEN-CI BLEIBT DER KONTO-KREIS IM FENSTER.
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI SCHLIESST, war gemessen und ausdrücklich übergeben. JOB 3571 hat die
// Kopfbandzeile mit eingeschalteter Firmen-CI in Chromium vermessen und dabei zwei Breiten gefunden,
// an denen sie nicht mehr ins Fenster passt: bei 390 px stand der Konto-Kreis 20,5 px, bei 900 px
// 109,5 px rechts AUSSERHALB des Fensters. Ursache war nicht das Layout und nicht der Konto-Kreis,
// sondern die Breite des Logokastens selbst: das Firmenlogo neben der Wortmarke hing mit `w-auto`
// am Seitenverhältnis der Bilddatei und kostete 110,3 px statt der früher überschlagenen „rund
// 45 px". `shell/Logo.tsx` lag ausserhalb der Zielpfade jenes Jobs; er hat den Befund deshalb
// gemessen und gepinnt und die Behebung an einen Auftrag übergeben, der jene Datei tragen darf.
// Das ist dieser.
//
// WAS DER MENSCH DAVON HAT: Admin → Vorführdaten → Demo-Erscheinungsbild einschalten, Fenster auf
// 390 px oder 900 px ziehen, oben rechts schauen — der Konto-Kreis steht im Fenster, und die
// Wortmarke KLARWERK steht unverändert da.
//
// DREI REGELN TRAGEN DAS, ALLE IN `shell/Logo.tsx` BENANNT, ALLE HIER GEMESSEN:
//
//   1. `LOGO_MAX_BREITE_PX` — der Logokasten bekommt in der SCHMALEN Zeile eine Obergrenze.
//      Gedeckelt wird der KASTEN, nicht das heutige Seitenverhältnis: heute gibt es genau ein
//      Firmenprofil, ein zweites, breiteres Logo wäre morgen dieselbe Lücke. Das Bild wird in der
//      Grenze EINGEPASST (`object-contain`) statt beschnitten. Fall L6 misst das mit einem
//      künstlich sehr breiten Bild.
//   2. `LOGO_MAX_BREITE_BREIT_PX` mit `LOGO_BREITE_ZEILE_QUERY` — die zweite Stufe, und ihr Zweck
//      ist, bei 1280 px NICHT zu greifen. §5.4 des Auftrags verlangt die unveränderte Bauform der
//      Mockup-Breite; Runde 1 hatte dort mit einer einzigen Stufe gedeckelt und dem Logo die halbe
//      Breite genommen (88,3 px → 44 px). Fall L4 misst beides: dass das Bild bei 1280 px in seiner
//      ursprünglichen Grösse steht, und dass die Zeile dort Kasten für Kasten dieselbe ist wie ganz
//      ohne Deckelung.
//   3. `LOGO_OHNE_PLATZ_QUERY` — die eine Breitenspanne, in der die Zeile den Kasten in KEINER
//      Grösse trägt. Bei 900 px beginnt die BREITE Bauform (volle Punktreihe, Suchfeld); dort
//      bleiben schon OHNE Firmen-CI nur 15,8 px bis zur Fensterkante (Fall L9), der Kasten kostet
//      aber allein 22 px für Aussenabstand und Plattenpolster. Also steht er dort nicht — als
//      benannte Regel mit gemessener Kante (Fall L2), nicht als stilles `hidden`.
//
// NICHTS WIRD VERSTECKT: `overflow: hidden` hätte dieselben Fälle grün gemacht und wäre die Lüge
// gewesen — das Element stünde weiter draussen, man sähe es nur nicht mehr. Und der Konto-Kreis,
// das Zahnrad und die Punkte werden nicht angefasst; sie sind nicht die Ursache, und an ihnen zu
// drehen wäre das Überdecken in einem fremden Zielpfad, das JOB 3571 ausdrücklich abgelehnt hat.
//
// DIE PFLICHT KOMMT AUS DER ZUSAGE, NICHT AUS DEM GEMESSENEN BAUM — die Lehre aus JOB 3571 R2. Ob
// an einer Breite ein Logo stehen MUSS, entscheidet nicht, ob dort eines steht, sondern
// `LOGO_OHNE_PLATZ_QUERY`: die Zeichenkette wird aus `Logo.tsx` gelesen und von der
// Medienabfrage-Maschine desselben Chromium ausgewertet, der die Seite zeichnet (`matchMedia`).
// Beide Richtungen beissen — ein fehlendes Logo, wo es zugesagt ist, ebenso wie ein Logo, wo die
// Zeile es nicht trägt.
//
// DIE VORAUSSETZUNG WIRD SELBST GEMESSEN (Fall L0). Ein Lauf, der „mit CI" behauptet, während die
// CI still aus blieb, misst nichts und wäre trotzdem grün — der gefährlichste Zustand. Deshalb: das
// Logo muss GEZEICHNET sein, sein Bild geladen, und die Wortmarke dadurch messbar breiter als ohne
// CI. Der Vergleichswert entsteht im selben Lauf am selben Stand (CI aus → messen → CI an → messen).
//
// WERKZEUG UND SCHALTER SIND DIE VORHANDENEN: `tests/design/h6-chromium.ts` (eine Browser-Instanz je
// Datei) und `tests/navigation-schmal/kopfband-messung.ts` — dort wohnen seit JOB 3571 die Messung
// und seit JOB 3582 auch der Schalter für die Firmen-CI. Weder entsteht hier ein zweites Messraster
// noch ein zweiter Weg, die CI einzuschalten; die CI kommt denselben Weg wie beim Kunden
// (`PUT /api/admin/branding` an der echten App, kein Route-Mock, keine Attrappe).
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · Gemessen wird DEUTSCH — der längste und damit bindende Fall. Englisch und Niederländisch MIT
//     Firmen-CI sind hier NICHT gemessen; dieser Rest stammt aus JOB 3571 und bleibt offen.
//   · Gemessen wird das heute EINZIGE Firmenprofil (`advisor`). Ein zweites gibt es nicht. Was
//     stattdessen gemessen wird, ist die REGEL: L6 fährt denselben Lauf mit einem künstlich sehr
//     breiten Bild am gezeichneten `<img>`. Das ist die Robustheit der Deckelung, nicht ein neues
//     Profil.
//   · Bei 900 px wird NUR zugesichert, dass nichts ausserhalb des Fensters steht und kein Überschuss
//     bleibt. Die volle Zusage über die ZUSAMMENSETZUNG der breiten Bauform gehört JOB 3060 und wird
//     hier nicht neu erhoben.
//   · Der Ladenachweis (JOB 3616, siehe unten) liest in der SCHMALEN Bauform keinen gezeichneten
//     Zähler ab, weil das Kopfband dort nur den Punkt „Entwürfe" zeigt (`SCHMAL_PUNKT_IDS` in
//     `shell/KopfbandPunkte.tsx`). Unter 900 px trägt ihn deshalb allein die ausgelieferte Antwort;
//     der gezeichnete Zähler wird ab 900 px gemessen. Der Lauf sagt je Breite, welche Hälfte trug.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORIGIN, type Stand, fn, starte } from "../design/h6-chromium";
import {
  type Bereitschaft,
  LOGO_STEHT,
  type LogoBefund,
  type Messung,
  liesLogoBefund,
  meldeAn,
  messe,
  messeStehend,
  schalteCi,
  seiteRoh,
} from "../navigation-schmal/kopfband-messung";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import {
  BREITE_ZEILE_NAME,
  DECKELUNG_BREIT_NAME,
  DECKELUNG_NAME,
  SPANNE_NAME,
  regelnOderAbbruch,
} from "./deckelung-quelle";
import {
  type AnkunftBefund,
  type Ankunftsurteil,
  type Rechteck,
  type SichtBefund,
  beurteileAnkunft,
  beurteileSicht,
  statusListe,
  zeilenUnterschied,
} from "./ruhe-und-sicht";

const HOEHE = 800;
/** Die Startbreite ist die engste gemessene — dort war der Befund am sichtbarsten. */
const START_BREITE = 390;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3582";
/** Die Kennung der Zahlen, die JOB 3616 dazugestellt hat (Ladenachweis, Sichtbarkeit, L7). */
const KENNUNG_3616 = "JOB 3616";

/**
 * Die vier Regeln, wörtlich aus dem Produkt.
 *
 * GELESEN statt importiert: diese Datei läuft in der Node-Umgebung, und ein Import von `Logo.tsx`
 * zöge React, den Navigationswächter und die Markenquelle in einen Lauf, der vier Werte braucht.
 * Fehlt eine der Regeln, bricht der Lauf HIER ab — er läuft nicht still mit einer Annahme weiter.
 */
const {
  grenze: LOGO_GRENZE,
  grenzeBreit: LOGO_GRENZE_BREIT,
  spanne: OHNE_PLATZ,
  breiteZeile: BREITE_ZEILE,
} = regelnOderAbbruch();

/**
 * Die obere Kante der Spanne, aus der Zusage selbst gelesen.
 *
 * Sie steht nicht als eigene Zahl da: verschiebt jemand die Spanne in `Logo.tsx`, wandern die zwei
 * Messbreiten von Fall L2 von selbst mit. Eine hier eingetragene Zahl wäre die zweite Wahrheit.
 */
const OBERE_KANTE = Number(/max-width:\s*(\d+)px/.exec(OHNE_PLATZ)?.[1] ?? Number.NaN);
const UNTERE_KANTE = Number(/min-width:\s*(\d+)px/.exec(OHNE_PLATZ)?.[1] ?? Number.NaN);

/**
 * Die sieben Breiten — dieselbe Liste wie `tests/navigation-schmal/kopfband-ci-chromium.test.ts`.
 *
 * Eine kürzere Liste (nur 390 und 900, die zwei roten) liesse offen, ob die Deckelung an den fünf
 * bisher grünen Breiten etwas kaputtmacht. Sie werden deshalb alle gefahren.
 */
const ALLE = [390, 600, 760, 768, 899, 900, 1280] as const;

/** Die Breite, an der die BREITE Bauform gegen ihr Mockup gemessen wird (JOB 3060). */
const BREITE_BAUFORM = 1280;

/**
 * Ein künstlich sehr breites Bild für L6.
 *
 * WARUM ALS BILDQUELLE UND NICHT ALS ZWEITES PROFIL: der echte Weg (`PUT /api/admin/branding`)
 * lässt heute nur `advisor` zu, und §10 des Auftrags legt ausdrücklich kein zweites Profil an.
 * Geprüft werden soll auch nicht ein Profil, sondern die REGEL: hält die Deckelung, wenn die
 * Bilddatei ein vielfaches Seitenverhältnis hat? Dafür genügt — und dafür taugt nur — ein
 * ausgetauschtes Bild am gezeichneten `<img>`. 2000 × 39 ist rund das Zwölffache des heutigen
 * Verhältnisses (Datei 300 × 68); ungedeckelt wäre das Bild bei 20 px Höhe über 1000 px breit.
 *
 * `width`/`height` stehen ausdrücklich AM `<svg>` und nicht nur als `viewBox`: ohne sie gibt
 * Chromium einer SVG-Grafik die Ersatzgrösse 300 px und `naturalWidth` wäre 300 — der Fall hätte
 * dann ein schmales Bild vermessen und „breit" dazu behauptet.
 */
const BREITES_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="39" viewBox="0 0 2000 39"><rect width="2000" height="39" fill="#0578b7"/></svg>',
)}`;

const SETZE_BILD = fn(`(quelle) => {
  const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
  if (!bild) return false;
  bild.src = quelle;
  return true;
}`);

/**
 * Die Obergrenze am GEZEICHNETEN Bild verstellen — der Griff, mit dem L4 den Stand VOR JOB 3582
 * herstellt (`none`) und danach wieder zurückstellt.
 *
 * Er greift am Inline-Stil, den `Logo.tsx` selbst setzt, und wirkt deshalb genau solange, bis React
 * das Element neu zeichnet. Das ist hier gewollt: gemessen wird an der stehenden Seite, und der
 * nächste Fall baut sie ohnehin neu auf.
 */
const SETZE_DECKEL = fn(`(wert) => {
  const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
  if (!bild) return false;
  bild.style.maxWidth = wert;
  return true;
}`);

const BREITES_BILD_STEHT = fn(`(quelle) => {
  const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
  return bild !== null && bild.src === quelle && bild.complete && bild.naturalWidth > 1000;
}`);

/** Gilt die Zusage an der STEHENDEN Breite? Chromium beantwortet das mit seiner eigenen Maschine. */
const PASST = fn("(q) => window.matchMedia(q).matches");

let stand: Stand;
let bearer = "";

/** Wie weit der rechteste gemessene Kasten aus dem Fenster ragt (negativ = er steht drinnen). */
function draussen(m: Messung): number {
  return Math.max(...m.kaesten.map((k) => k.rechts)) - m.fensterBreite;
}

/** Der Name des rechtesten Kastens — für die Fehlermeldung, die ein Mensch lesen soll. */
function rechtester(m: Messung): string {
  return m.kaesten.reduce((a, b) => (a.rechts >= b.rechts ? a : b)).name;
}

/** Der Überschuss der Zeile über das Fenster — `scrollWidth` minus `clientWidth`. */
function ueberschuss(m: Messung): number {
  return m.scrollBreite - m.clientBreite;
}

function protokolliere(fall: string, breite: number, m: Messung, logo: LogoBefund | null): void {
  const logoTeil =
    logo === null || !logo.logoDa
      ? "kein Logokasten"
      : `Logokasten ${logo.logoBreite.toFixed(1)} px, Bild ${logo.bildBreite.toFixed(1)} × ${logo.bildHoehe.toFixed(1)} px ` +
        `(Datei ${logo.bildNaturBreite} × ${logo.bildNaturHoehe}), Wortmarke ${logo.markeBreite.toFixed(1)} px`;
  console.log(
    `${KENNUNG} · ${fall} · ${breite}px · rechtester Kasten ${Math.max(...m.kaesten.map((k) => k.rechts)).toFixed(1)} px ` +
      `bei Fensterbreite ${m.fensterBreite} px (${draussen(m).toFixed(1)} px ausserhalb) · ` +
      `scrollWidth ${m.scrollBreite} / clientWidth ${m.clientBreite} · ${logoTeil}`,
  );
}

/**
 * ================================================================================================
 * DIE RUHEMESSUNG — JEDE Zahl dieser Datei stammt aus einem NACHGEWIESENEN Endzustand.
 * ================================================================================================
 *
 * DER ANLASS IST GEMESSEN, NICHT VERMUTET, und er ist zweimal aufgetreten:
 *
 *   · Im vollen Torlauf (also unter Last) meldete L4 „`punkt:start` ist mit Firmen-CI 4,0 px anders
 *     breit als ohne", während dieselbe Messung in ruhigen Läufen Kasten für Kasten übereinstimmte.
 *   · Bei 900 px mass dieselbe Zeile in zwei Fällen desselben Laufs einmal 884,2 px und einmal
 *     899,2 px als rechten Rand — 15 px Unterschied.
 *
 * BEIDES HAT DIESELBE URSACHE: die Kopfbandzeile ist beim ersten Zeichnen noch nicht fertig. Der
 * Zähler am Punkt „Prüfen" kommt erst mit seiner Abfrage (`app/useNavBadges.ts` → `GET
 * /api/validation/board`) und macht den Punkt dann rund 15 px breiter; der aktive Punkt trägt
 * `font-semibold` (`shell/KopfbandPunkte.tsx`). Wer misst, bevor das steht, misst einen
 * Zwischenstand — und einen, den kein Mensch je sieht.
 *
 * WAS DAVON IN DIESER BÜHNE GEMESSEN IST, gehört an dieselbe Stelle wie die Behauptung: das
 * Prüf-Board dieser Bühne ist LEER (`GET /api/validation/board` → 0 Einträge, Fall L7 gibt die Zahl
 * aus). Ein Zähler mit 0 wird nicht gezeichnet; die 15 px oben stammen aus den Läufen von JOB 3582
 * und sind hier nicht nachstellbar. Die Ursache der zwei Befunde ist damit NICHT nachgemessen — der
 * Ladenachweis unten hängt deshalb am nachgewiesenen EINTREFFEN der Antwort, nicht an einer
 * erwarteten Breite.
 *
 * DIE ANTWORT IST NICHT EINE GRÖSSERE TOLERANZ. Eine Toleranz, die 15 px schluckt, schluckt auch
 * einen echten Layoutfehler von 15 px — und genau solche Fehler soll diese Datei finden.
 *
 * UND SIE IST SEIT JOB 3616 AUCH NICHT MEHR EINE UHR. Bis dahin genügten zwei gleiche Stichproben
 * im Abstand von 250 ms. Das beweist keinen Ladezustand: kommt die Zähler-Antwort NACH der zweiten
 * Stichprobe, waren die ersten zwei gleich — und die Datei mass still den Stand VOR dem Zähler.
 * Genau das hat der Prüfer an JOB 3582 benannt (`archiv/3582/runde-2/ben.md:30`: „Die Ruhemessung
 * beweist keinen endgültigen Ladezustand: Badge-Antwort gezielt verzögern und anschließend
 * messen"). Gemessen wird deshalb erst, wenn BEIDES gilt:
 *
 *   1. DIE ANTWORT IST ERFOLGREICH IM BROWSER ANGEKOMMEN — abgelesen an der Ressourcen-Zeitleiste
 *      DES DOKUMENTS (`performance.getEntriesByType("resource")`). Ein Eintrag entsteht dort erst,
 *      wenn die Ressource fertig empfangen ist (`responseEnd`); die Zeitleiste gehört dem Dokument
 *      und beginnt mit jedem Seitenaufbau neu, die Zuordnung ist also baulich gegeben.
 *
 *      RUNDE 2 HAT DORT AUFGEHÖRT, UND DAS WAR ZU FRÜH: „empfangen“ ist nicht „erfolgreich“. Eine
 *      mit HTTP 503 beantwortete Abfrage erzeugt denselben Eintrag — der Prüfer hat die
 *      Zähler-Quelle gestört und bekam `nachweisErbracht:true` nach 355 ms bei
 *      `timing:[{status:503,ende:65.5}]`: eine nicht geladene Zeile bekam einen fertigen Messwert
 *      (BEN, JOB 3616 R2, Korrekturpflicht 1). Gezählt wird deshalb nur ein Eintrag mit 2xx
 *      (`responseStatus`, gleiche Quelle); ein empfangener Fehler lässt den Lauf weiter warten und
 *      steht im Abbruchgrund. Geurteilt wird in `beurteileAnkunft` (`ruhe-und-sicht.ts`), gemessen
 *      am gebauten Produkt in L11a (dauerhaftes 503) und L11b (503, dann verzögerter Erfolg).
 *
 *      RUNDE 1 HAT DAS AN DER FALSCHEN STELLE GEMESSEN, und der Prüfer hat es nachgewiesen: dort
 *      zählte ein Schritt IN `stand.antworten.vorAuslieferung`, also VOR `route.fulfill`. Wer die
 *      echte Auslieferung danach weitere 2000 ms zurückhielt, bekam eine fertige Ruhemessung nach
 *      424 ms — mit `nachweisErbracht:true`, obwohl im Browser nichts angekommen war (BEN, JOB 3616
 *      R1, Korrekturpflicht 1). Ein Zählschritt am Server ist kein Ankunftsnachweis. Was vom Server
 *      bleibt, ist reine Diagnose: `stand.abrufe` sagt, ob die FRAGE überhaupt gestellt wurde, und
 *      steht nur in den Meldungen — nie in der Bedingung.
 *   2. WO DER PUNKT „PRÜFEN" GEZEICHNET IST, STEHT SEIN ZÄHLER — am Browser abgelesen und gegen die
 *      Zahl gelegt, die die echte Route `GET /api/validation/board` im selben Lauf liefert. In der
 *      schmalen Bauform zeigt das Kopfband diesen Punkt gar nicht (`SCHMAL_PUNKT_IDS`, nur
 *      „entwuerfe"); dort trägt allein 1. den Nachweis, und der Lauf sagt das.
 *
 * DANACH ERST kommt die alte Bedingung dazu: zwei aufeinanderfolgende Messungen müssen in Namen,
 * Breiten UND LAGEN aller Kästen übereinstimmen (`zeilenUnterschied`; die Lage kam mit JOB 3616
 * dazu). Bleibt der Nachweis aus oder kommt die Zeile nicht zur Ruhe, bricht der Fall ab — MIT
 * GRUND und mit Zahl, statt mit einem Zwischenstand.
 *
 * WAS DAS FÜR DIE ZAHLEN BEDEUTET: sie sind der ENDZUSTAND, also der engste. Bei 900 px sind das
 * 899,2 px bei 900 px Fensterbreite — 0,8 px Luft. Diese 0,8 px sind der Bestand von JOB 3060 und
 * gelten dort auch ohne jede Firmen-CI; dieser Job sorgt dafür, dass die Firmen-CI sie nicht
 * aufbraucht.
 */
const pause = (ms: number): Promise<void> => new Promise((fertig) => setTimeout(fertig, ms));

/** Die Abfrage, mit der der Zähler am Punkt „Prüfen" kommt (`app/useNavBadges.ts`). */
const ZAEHLER_PFAD = "/api/validation/board";
/** Der Kopfbandpunkt, der diesen Zähler trägt (`app/navigation.ts`, `badgeKey: "validation"`). */
const ZAEHLER_PUNKT = "validierung";
/**
 * Wie lange auf die Ankunft der Antwort gewartet wird, bevor der Fall mit Grund abbricht.
 *
 * Veränderlich, weil Fall L8 den Abbruch selbst misst: er hält die Antwort an und stellt die Frist
 * kurz, statt den Lauf 20 s lang anzuhalten. Ausserhalb von L8 steht hier immer `NACHWEIS_FRIST_MS`.
 */
const NACHWEIS_FRIST_MS = 20_000;
let nachweisFristMs = NACHWEIS_FRIST_MS;
/** Wie lange danach auf den gezeichneten Zähler gewartet wird. */
const ZAEHLER_FRIST_MS = 10_000;
/** Die Ruhemessung: höchstens zwölf Stichproben im Abstand von 250 ms. */
const RUHE_VERSUCHE = 12;
const RUHE_PAUSE_MS = 250;

/** Ist der Nachweis für den laufenden Seitenaufbau schon erbracht? */
let nachweisErbracht = false;
/** Künstlicher Verzug der Zähler-Antwort in ms — nur Fall L7 stellt ihn. */
let zaehlerVerzugMs = 0;
/** Solange gesetzt, hält die Auslieferung der Zähler-Antwort an — nur Fall L8 stellt sie. */
let zaehlerSperre: Promise<void> | null = null;
let zaehlerFreigabe: (() => void) | null = null;
/**
 * Wie viele der nächsten Zähler-Abfragen mit HTTP 503 beantwortet werden — nur Fall L11b stellt es.
 *
 * WARUM NICHT `stand.stoerung`: der Schalter der Bühne stört DAUERHAFT (`h6-chromium.ts:295`), und
 * L11a nutzt ihn genau dafür. L11b braucht die andere Hälfte — eine Fehlerantwort, der ein ECHTER
 * Wiederholungsabruf des Produkts folgt (`retry: 1`, `apps/web/src/main.tsx:44`). Gezählt statt
 * über die Uhr geschaltet, weil ein Zeitgeber ein Wettrennen mit genau jenem Abruf wäre: käme er
 * zu früh, liefe der Fall grün, ohne je einen Fehler gemessen zu haben.
 */
let zaehlerFehlerMale = 0;
/** Wie viele Fehlerantworten dieser Lauf wirklich ausgeliefert hat — Beleg, keine Annahme. */
let zaehlerFehlerGeliefert = 0;
/** Die Zahl, die der Zähler zeigen muss — aus der echten Route, einmal je Lauf gelesen. */
let zaehlerSoll: number | null = null;

/**
 * Den Auslieferungspunkt der Bühne anzapfen — ausschliesslich, um die Antwort ZURÜCKZUHALTEN.
 *
 * `stand.antworten.vorAuslieferung` ist der dafür vorgesehene Griff (`tests/design/h6-chromium.ts`:
 * „dieselbe echte Antwort gezielt verzögern"). Er läuft unmittelbar VOR `route.fulfill`. Der Körper
 * wird nicht angefasst, und es wird hier NICHTS gezählt: ein Schritt an dieser Stelle sagt nur,
 * dass die Antwort abgeschickt WIRD, nicht dass sie angekommen ist (Korrekturpflicht 1). Das Warten
 * ist die letzte Handlung vor der Rückgabe — es gibt in dieser Datei keine Stelle „danach" mehr.
 */
function zapfeAuslieferungAn(): void {
  const vorher = stand.antworten.vorAuslieferung;
  stand.antworten.vorAuslieferung = async (url: URL, body: string): Promise<string> => {
    const weiter = vorher ? await vorher(url, body) : body;
    if (url.pathname === ZAEHLER_PFAD) {
      if (zaehlerVerzugMs > 0) {
        await pause(zaehlerVerzugMs);
      }
      if (zaehlerSperre !== null) {
        await zaehlerSperre;
      }
    }
    return weiter;
  };
}

/** Die Zähler-Antwort anhalten, bis sie ausdrücklich freigegeben wird (Fall L8). */
function halteZaehlerAntwortAn(): void {
  if (zaehlerSperre !== null) {
    return;
  }
  zaehlerSperre = new Promise<void>((frei) => {
    zaehlerFreigabe = frei;
  });
}

/**
 * Die Weiche, die die nächsten `zaehlerFehlerMale` Zähler-Abfragen mit HTTP 503 beantwortet.
 *
 * Sie wird EINMAL gelegt (`beforeAll`) und ist im Normalfall wirkungslos: steht der Zähler auf 0,
 * reicht sie die Abfrage unverändert an die Weiche der Bühne weiter (`fallback`), die sie wie jede
 * andere an die echte App stellt. Playwright ruft die zuletzt gelegte Weiche zuerst.
 */
async function legeFehlerWeiche(): Promise<void> {
  await seiteRoh(stand).route(`${ORIGIN}${ZAEHLER_PFAD}*`, async (route) => {
    if (zaehlerFehlerMale > 0) {
      zaehlerFehlerMale -= 1;
      zaehlerFehlerGeliefert += 1;
      await route.fulfill({
        status: 503,
        body: JSON.stringify({ error: "job3616-fehlerantwort" }),
        headers: { "content-type": "application/json" },
      });
      return;
    }
    await (route as unknown as { fallback(): Promise<void> }).fallback();
  });
}

/** Die angehaltene Zähler-Antwort freigeben — im `finally` jedes Falls, der sie angehalten hat. */
function gibZaehlerAntwortFrei(): void {
  const frei = zaehlerFreigabe;
  zaehlerSperre = null;
  zaehlerFreigabe = null;
  if (frei) {
    frei();
  }
}

/** Vor jedem Seitenaufbau: der Nachweis des vorigen Dokuments gilt nicht mehr. */
function neuerSeitenaufbau(): void {
  nachweisErbracht = false;
}

/** Die Zahl am Punkt „Prüfen", wie die echte Route sie hergibt — einmal je Lauf. */
async function zaehlerSollwert(): Promise<number> {
  if (zaehlerSoll !== null) {
    return zaehlerSoll;
  }
  const app = stand.app;
  if (!app) {
    throw new Error("keine App an der Bühne");
  }
  const antwort = await app.inject({
    method: "GET",
    url: ZAEHLER_PFAD,
    headers: { authorization: `Bearer ${bearer}` },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(`GET ${ZAEHLER_PFAD}: HTTP ${antwort.statusCode}`);
  }
  const liste = antwort.json() as unknown[];
  zaehlerSoll = liste.length;
  return zaehlerSoll;
}

/** In der Seite: steht der Punkt „Prüfen", und welche Zahl trägt sein Zähler? */
const ZAEHLER_STAND = fn(`(punkt) => {
  const a = document.querySelector('[data-kopfband-punkt="' + punkt + '"]');
  if (!a) return { punktDa: false, zaehlerDa: false, text: '' };
  const z = a.querySelector('.kw-kopfband-zaehler');
  return {
    punktDa: a.offsetParent !== null,
    zaehlerDa: z !== null,
    text: z ? (z.textContent || '').trim() : '',
  };
}`);

const ZAEHLER_STEHT = fn(`(arg) => {
  const a = document.querySelector('[data-kopfband-punkt="' + arg.punkt + '"]');
  if (!a) return false;
  const z = a.querySelector('.kw-kopfband-zaehler');
  return z !== null && (z.textContent || '').trim() === arg.soll;
}`);

interface ZaehlerStand {
  punktDa: boolean;
  zaehlerDa: boolean;
  text: string;
}

/**
 * IST DIE ANTWORT IM BROWSER ANGEKOMMEN? Gefragt wird die Ressourcen-Zeitleiste DES DOKUMENTS.
 *
 * Ein `PerformanceResourceTiming`-Eintrag entsteht erst, wenn der Browser die Antwort vollständig
 * empfangen hat; `responseEnd` ist der Zeitpunkt. Die Zeitleiste gehört dem Dokument und beginnt
 * bei jeder Navigation neu — ein Eintrag stammt also zwangsläufig aus DIESEM Seitenaufbau.
 *
 * MITGELESEN WIRD DER EMPFANGENE STATUS (`responseStatus`, gleiche Quelle, gleicher Eintrag), denn
 * „empfangen" und „erfolgreich" sind zwei Aussagen. Geurteilt wird nicht hier, sondern in
 * `beurteileAnkunft` (`ruhe-und-sicht.ts`) — dort, wo dasselbe Urteil mit gebauten Zeitleisten
 * gegengeprüft wird.
 *
 * `pufferVoll` ist die ehrliche Grenze dieser Quelle: läuft die Zeitleiste über, fehlen Einträge,
 * und „nicht angekommen" wäre eine Falschaussage. Der Puffer wird beim Aufbau auf 1000 gestellt
 * (`beforeAll`), und wenn er trotzdem voll läuft, bricht der Nachweis mit diesem Grund ab, statt
 * weiterzuraten. `statusLesbar` ist die zweite Grenze: gäbe dieser Browser den Status nicht her,
 * wäre ein empfangener Fehler von einer erfolgreichen Antwort nicht zu unterscheiden.
 */
const ANKUNFT = fn(`(pfad) => {
  let statusLesbar = false;
  try {
    statusLesbar = typeof PerformanceResourceTiming !== 'undefined'
      && 'responseStatus' in PerformanceResourceTiming.prototype;
  } catch (x) { statusLesbar = false; }
  let eintraege = [];
  try {
    eintraege = performance.getEntriesByType('resource').filter((e) => {
      try { return new URL(e.name, location.href).pathname === pfad; } catch (x) { return false; }
    });
  } catch (x) { eintraege = []; }
  return {
    eintraege: eintraege.map((e) => ({
      responseEnd: e.responseEnd,
      status: typeof e.responseStatus === 'number' ? e.responseStatus : 0,
    })),
    pufferVoll: window.__kwPufferVoll === true,
    statusLesbar: statusLesbar,
  };
}`);

/** Ein Befund ohne jeden Eintrag — der Stand vor der ersten Ablesung. */
const KEINE_ANKUNFT: AnkunftBefund = { eintraege: [], pufferVoll: false, statusLesbar: true };

/** Die Ankunft an der STEHENDEN Seite ablesen. */
async function liesAnkunft(): Promise<AnkunftBefund> {
  return await seiteRoh(stand).evaluate<AnkunftBefund>(ANKUNFT, ZAEHLER_PFAD);
}

/**
 * DER LADENACHWEIS — ohne ihn wird nicht gemessen.
 *
 * Er gilt je Seitenaufbau genau einmal; die Fälle, die nach einem Eingriff an der STEHENDEN Seite
 * noch einmal beruhigen (L4b, L6), erben ihn und warten nicht ein zweites Mal.
 */
async function ladeNachweis(breite: number): Promise<void> {
  if (nachweisErbracht) {
    return;
  }
  const begonnen = Date.now();
  let urteil: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
  for (;;) {
    urteil = beurteileAnkunft(await liesAnkunft());
    if (urteil.art === "abbruch") {
      throw new Error(
        `bei ${breite}px trägt der Ankunftsnachweis für ${ZAEHLER_PFAD} nicht: ${urteil.meldung}`,
      );
    }
    if (urteil.art === "angekommen") {
      break;
    }
    if (Date.now() - begonnen > nachweisFristMs) {
      throw new Error(
        `bei ${breite}px liegt nach ${(nachweisFristMs / 1000).toFixed(1)} s keine erfolgreich empfangene Antwort auf ${ZAEHLER_PFAD} vor — ${urteil.meldung} ` +
          `(${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server seit Laufbeginn) — es wird NICHT still zu früh gemessen`,
      );
    }
    await pause(25);
  }
  const seite = seiteRoh(stand);
  const soll = await zaehlerSollwert();
  const jetzt = await seite.evaluate<ZaehlerStand>(ZAEHLER_STAND, ZAEHLER_PUNKT);
  if (jetzt.punktDa && soll > 0) {
    try {
      await seite.waitForFunction(
        ZAEHLER_STEHT,
        { punkt: ZAEHLER_PUNKT, soll: String(soll) },
        { timeout: ZAEHLER_FRIST_MS },
      );
    } catch (e) {
      const stand2 = await seite.evaluate<ZaehlerStand>(ZAEHLER_STAND, ZAEHLER_PUNKT);
      const gezeichnet = stand2.zaehlerDa ? `„${stand2.text}“` : "kein Zähler";
      throw new Error(
        `bei ${breite}px steht der Zähler am Punkt „${ZAEHLER_PUNKT}“ nicht auf ${soll} (gezeichnet: ${gezeichnet}), ` +
          `obwohl die Antwort da ist — gemessen würde sonst ein Zwischenstand. Eine Zahl gilt im Produkt nur 30 s lang als frisch (ZAEHLER_FRISCHE_MS, lib/loadingState.ts); danach verschwindet der Zähler wieder. — ${String(e)}`,
      );
    }
  }
  const dauer = Date.now() - begonnen;
  console.log(
    `${KENNUNG_3616} · Ladenachweis · ${breite}px · Antwort auf ${ZAEHLER_PFAD} im Browser angekommen nach ${dauer} ms ` +
      `(${urteil.meldung}; ` +
      `${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server) · Punkt „${ZAEHLER_PUNKT}“ ` +
      `${jetzt.punktDa ? `gezeichnet, Zähler soll ${soll} sein` : "in dieser Bauform nicht gezeichnet — Nachweis allein über die Ankunft"}`,
  );
  nachweisErbracht = true;
}

/**
 * An der STEHENDEN Seite messen, bis der Ladenachweis steht UND sich zwei Messungen in Folge
 * gleichen — in Namen, Breiten und Lagen.
 */
async function beruhige(breite: number): Promise<Messung> {
  await ladeNachweis(breite);
  let vorher = await messeStehend(stand);
  let letzter = "keine zweite Messung";
  for (let versuch = 0; versuch < RUHE_VERSUCHE; versuch++) {
    await pause(RUHE_PAUSE_MS);
    const jetzt = await messeStehend(stand);
    const unterschied = zeilenUnterschied(vorher, jetzt);
    if (unterschied === null) {
      return jetzt;
    }
    letzter = unterschied;
    vorher = jetzt;
  }
  throw new Error(
    `bei ${breite}px kam die Kopfbandzeile in ${((RUHE_VERSUCHE * RUHE_PAUSE_MS) / 1000).toFixed(1)} s nicht zur Ruhe — zuletzt: ${letzter}`,
  );
}

/** Seite an der Breite aufbauen und erst messen, wenn die Zeile nachweislich steht. */
async function messeRuhig(breite: number, bereit?: Bereitschaft): Promise<Messung> {
  neuerSeitenaufbau();
  await messe(stand, breite, HOEHE, bereit);
  return await beruhige(breite);
}

/**
 * WELCHE STUFE DER OBERGRENZE AN DIESER BREITE GILT — beantwortet vom Produkt, nicht vom Test.
 *
 * Seit Runde 2 hat die Deckelung zwei Stufen, und WO welche gilt, sagt `LOGO_BREITE_ZEILE_QUERY`.
 * Ausgewertet wird die Zusage von der Medienabfrage-Maschine desselben Chromium, der die Seite
 * zeichnet — dieselbe Maschine, an der im Produkt `useMediaQuery.ts` hängt. Eine hier eingetragene
 * Kante wäre die zweite Wahrheit: verschiebt jemand sie in `Logo.tsx`, wandert diese Messung mit.
 */
async function geltendeGrenze(): Promise<{ grenze: number; breitZugesagt: boolean }> {
  const breitZugesagt = await seiteRoh(stand).evaluate<boolean>(PASST, BREITE_ZEILE);
  return { grenze: breitZugesagt ? LOGO_GRENZE_BREIT : LOGO_GRENZE, breitZugesagt };
}

/**
 * ================================================================================================
 * „DAS FIRMENLOGO STEHT" HEISST: EIN MENSCH SIEHT ES (JOB 3616).
 * ================================================================================================
 *
 * BIS JOB 3616 HIESS ES: das Bild ist geladen und breiter als 0 px. Der Prüfer hat das an JOB 3582
 * benannt (`archiv/3582/runde-2/ben.md:30`: „beweist positive Bildmaße, keine Erkennbarkeit"), und
 * eine Woche später stand dieselbe Krankheit als Korrekturpflicht in LEHREN.md (11.09. 08:21:35,
 * JOB 3584: „Sichtbarkeitsmesser vervollständigen: Höhe, Fenstergrenzen und abschneidende Vorfahren
 * berücksichtigen"). Ein Logo mit Höhe 0, mit `opacity: 0`, hinter einem abschneidenden Vorfahren
 * oder aus dem Fenster geschoben war für diese Datei vorhanden.
 *
 * DIESE FUNKTION SAMMELT DESHALB ZAHLEN, KEIN URTEIL: das Rechteck des gezeichneten Bildes, das
 * seines Kastens, das Fenster und die ganze Kette der Vorfahren mit `display`, `visibility`,
 * `opacity` und beiden Überlaufachsen. Geurteilt wird in `ruhe-und-sicht.ts` — dort, wo dasselbe
 * Urteil mit gebauten Lagen gegengeprüft wird (`ruhe-und-sicht-waechter.test.ts`, S0–S14). Eine
 * visuelle Referenzaufnahme wäre die andere Möglichkeit gewesen; sie wäre eine neue Infrastruktur
 * und eine neue Fehlerquelle, und sie könnte „ausserhalb des Fensters" gar nicht sehen.
 */
const SICHT_BEFUND = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const kasten = band.querySelector('[data-testid="kopfband-firmenlogo"]');
  const bild = kasten ? kasten.querySelector('img') : null;
  const viereck = (el) => {
    const r = el.getBoundingClientRect();
    return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom };
  };
  // DIE FLÄCHE, DIE EIN ABSCHNEIDENDES ELEMENT WIRKLICH ZEIGT: Polsterkante statt äusserer Kante.
  // \`clientLeft\`/\`clientTop\` sind die Rahmenbreiten, \`clientWidth\`/\`clientHeight\` ziehen Rahmen UND
  // Rollleisten schon ab. Genau daran ist Runde 1 gescheitert (Prüfer: 20 px Rahmen, 15 px des
  // Bildes abgeschnitten, Befund trotzdem „sichtbar").
  const innenViereck = (el) => {
    const r = el.getBoundingClientRect();
    const links = r.left + (typeof el.clientLeft === 'number' ? el.clientLeft : 0);
    const oben = r.top + (typeof el.clientTop === 'number' ? el.clientTop : 0);
    const breite = typeof el.clientWidth === 'number' ? el.clientWidth : (r.right - r.left);
    const hoehe = typeof el.clientHeight === 'number' ? el.clientHeight : (r.bottom - r.top);
    return { links: links, rechts: links + breite, oben: oben, unten: oben + hoehe };
  };
  const benenne = (el) => {
    const id = el.getAttribute ? el.getAttribute('data-testid') : null;
    const klasse = typeof el.className === 'string' ? el.className.trim().split(/\\s+/)[0] : '';
    return el.tagName.toLowerCase() + (id ? '[data-testid=' + id + ']' : (klasse ? '.' + klasse : ''));
  };
  const kette = [];
  for (let e = bild; e; e = e.parentElement) {
    const s = getComputedStyle(e);
    const deckkraft = Number.parseFloat(s.opacity);
    kette.push({
      name: benenne(e),
      rechteck: viereck(e),
      innen: innenViereck(e),
      display: s.display,
      sichtbarkeit: s.visibility,
      deckkraft: Number.isFinite(deckkraft) ? deckkraft : 1,
      ueberlaufX: s.overflowX,
      ueberlaufY: s.overflowY,
    });
  }
  return {
    gefunden: kasten !== null && bild !== null,
    bildGeladen: bild ? (bild.complete && bild.naturalWidth > 0) : false,
    gezeichnet: bild !== null && bild.offsetParent !== null,
    kette,
    kastenRechteck: kasten ? viereck(kasten) : null,
    fenster: { breite: window.innerWidth, hoehe: window.innerHeight },
  };
}`);

/** Den Sichtbefund an der STEHENDEN Seite lesen. */
async function liesSicht(): Promise<SichtBefund> {
  const b = await seiteRoh(stand).evaluate<SichtBefund | null>(SICHT_BEFUND);
  if (b === null) {
    throw new Error("kein Kopfband in der Seite");
  }
  return b;
}

/**
 * Die EINE Zusicherung „das Firmenlogo steht" — eine Regel, ein Ort, beide Aufrufer (die
 * Ruhemessung jedes Falls und L5) fällen dasselbe Urteil mit denselben Zahlen.
 */
function verlangeSichtbar(breite: number, sicht: SichtBefund): void {
  const urteil = beurteileSicht(sicht);
  expect(
    urteil.sichtbar,
    `${breite}px: das Firmenlogo ist nicht sichtbar — ${urteil.gruende.join(" · ")} (${urteil.masse})`,
  ).toBe(true);
}

/**
 * Messen MIT eingeschalteter Firmen-CI an einer beliebigen Breite — und dabei die ZUSAGE prüfen.
 *
 * Der Ablauf ist bewusst zweistufig: erst fragt Chromium seine eigene `matchMedia`, ob das Produkt
 * an dieser Breite überhaupt ein Logo zusagt; sagt es eines zu, wird zusätzlich auf das gezeichnete,
 * geladene Bild gewartet — sonst hinge jede Zahl davon ab, ob die Markenantwort rechtzeitig kam.
 * Sagt es keines zu, muss auch keines dastehen. In beiden Fällen wird RUHIG gemessen (siehe oben).
 */
async function messeMitZusage(breite: number): Promise<{
  m: Messung;
  logo: LogoBefund;
  sicht: SichtBefund;
  zugesagt: boolean;
  grenze: number;
}> {
  const seite = seiteRoh(stand);
  // Die Breite muss stehen, bevor `matchMedia` etwas Gültiges sagen kann — deshalb erst eine
  // Messung an der Breite, dann die Frage nach der Zusage, dann die eigentliche Ruhemessung.
  await messe(stand, breite, HOEHE);
  const ohnePlatz = await seite.evaluate<boolean>(PASST, OHNE_PLATZ);
  const zugesagt = !ohnePlatz;
  const { grenze } = await geltendeGrenze();
  const m = await messeRuhig(breite, zugesagt ? LOGO_STEHT : undefined);
  const logo = await liesLogoBefund(stand);
  const sicht = await liesSicht();
  // BEIDE RICHTUNGEN BEISSEN. Ein fehlendes Logo an einer zugesagten Breite ebenso wie ein Logo an
  // einer Breite, an der die Zeile es nicht trägt.
  expect(
    logo.logoGezeichnet,
    zugesagt
      ? `${breite}px: „${OHNE_PLATZ}" sagt hier ein Firmenlogo zu — im gezeichneten Kopfband steht keines`
      : `${breite}px: „${OHNE_PLATZ}" sagt hier KEIN Firmenlogo zu — im gezeichneten Kopfband steht trotzdem eines`,
  ).toBe(zugesagt);
  if (zugesagt) {
    verlangeSichtbar(breite, sicht);
  }
  return { m, logo, sicht, zugesagt, grenze };
}

beforeAll(async () => {
  stand = await starte(
    "/start",
    'header[data-testid="kopfband"]',
    START_BREITE,
    HOEHE,
    async (app) => {
      bearer = await meldeAn(app);
      await schalteCi(app, bearer, true);
    },
  );
  // Der Auslieferungspunkt wird angezapft, BEVOR der erste Fall misst — sonst hätte der erste
  // Seitenaufbau keinen Ladenachweis.
  if (stand.fehler === null) {
    zapfeAuslieferungAn();
    await legeFehlerWeiche();
    // Die Ressourcen-Zeitleiste trägt vorgabegemäss 250 Einträge. Der Ankunftsnachweis liest sie;
    // liefe sie über, fehlte der gesuchte Eintrag. Sie wird deshalb vergrössert, und ein Überlauf
    // wird gemerkt, damit der Nachweis ihn melden kann statt „nicht angekommen" zu behaupten.
    // `addInitScript` wirkt ab der nächsten Navigation — jeder Fall baut die Seite neu auf.
    await seiteRoh(stand).addInitScript(
      `try {
         performance.setResourceTimingBufferSize(1000);
         window.__kwPufferVoll = false;
         performance.addEventListener("resourcetimingbufferfull", () => { window.__kwPufferVoll = true; });
       } catch (e) {}`,
    );
  }
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium(
      "tests/chr-navigation-ci-logo/logokasten-chromium.test.ts",
      stand?.browser,
    );
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

describe("JOB 3582 · L0 · die Voraussetzung wird selbst gemessen, nicht geglaubt", () => {
  it("L0 · das Firmenlogo steht gezeichnet im Kopfband und macht die Wortmarke messbar breiter", async () => {
    expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
    expect(
      Number.isFinite(OBERE_KANTE) && Number.isFinite(UNTERE_KANTE),
      `aus „${OHNE_PLATZ}" liessen sich die zwei Kanten nicht lesen`,
    ).toBe(true);
    const app = stand.app;
    if (!app) {
      throw new Error("keine App an der Bühne");
    }
    console.log(
      `${KENNUNG} · L0 · die vier Regeln aus Logo.tsx: ${DECKELUNG_NAME} = ${LOGO_GRENZE} px · ` +
        `${DECKELUNG_BREIT_NAME} = ${LOGO_GRENZE_BREIT} px · ${SPANNE_NAME} = „${OHNE_PLATZ}" · ` +
        `${BREITE_ZEILE_NAME} = „${BREITE_ZEILE}"`,
    );

    // AUS → messen. Der Vergleichswert entsteht am SELBEN Stand, in DIESEM Lauf.
    await schalteCi(app, bearer, false);
    // RUHIG, wie jede Zahl dieser Datei seit JOB 3616 — auch der Vergleichswert ohne CI. Ein
    // Zwischenstand als Vergleichswert machte die Aussage „mit CI ist die Marke breiter" wertlos.
    const ohne = await messeRuhig(START_BREITE);
    const logoOhne = await liesLogoBefund(stand);
    expect(logoOhne.logoGezeichnet, "ausgeschaltet steht trotzdem ein Firmenlogo im Kopfband").toBe(
      false,
    );
    expect(logoOhne.markeBreite, "die Wortmarke wurde ohne CI gar nicht gemessen").toBeGreaterThan(
      0,
    );
    protokolliere("L0 ohne CI", START_BREITE, ohne, null);

    // AN → messen. Das Umschalten geschieht OHNE Neuladen der Anwendung; dass die Seite es
    // mitbekommt, ist die ausdrückliche Zusage von `useSyncExternalStore` in `Logo.tsx`.
    const gestellt = await schalteCi(app, bearer, true);
    expect(gestellt.profil, "der Server hat ein anderes Profil gesetzt").toBe("advisor");
    const { m, logo } = await messeMitZusage(START_BREITE);
    protokolliere("L0 mit CI", START_BREITE, m, logo);
    console.log(
      `${KENNUNG} · L0 · Wortmarke ohne CI ${logoOhne.markeBreite.toFixed(1)} px → mit CI ${logo.markeBreite.toFixed(1)} px ` +
        `(Zuwachs ${(logo.markeBreite - logoOhne.markeBreite).toFixed(1)} px)`,
    );

    // Die eigentliche Aussage: die CI ist nicht nur „gesetzt", sie WIRKT auf die Breite. Ohne
    // diesen Satz misst der ganze Lauf eine Zeile ohne Logo und ist trotzdem grün.
    expect(
      logo.markeBreite,
      `die Wortmarke ist mit CI nicht breiter (ohne ${logoOhne.markeBreite}, mit ${logo.markeBreite})`,
    ).toBeGreaterThan(logoOhne.markeBreite + 1);
  }, 180_000);
});

// ================================================================================================
// L1/L3 — DIE ZUSAGE DES AUFTRAGS: AUF JEDER GEMESSENEN BREITE PASST DIE ZEILE INS FENSTER.
// ================================================================================================
//
// Zwei Achsen, weil sie zwei verschiedene Dinge sagen und ein Mensch beide sieht:
//   · KEIN ELEMENT AUSSERHALB — das ist der Konto-Kreis, der rechts über die Fensterkante ragt.
//     Das ist die Zahl, die zählt.
//   · KEIN ÜBERSCHUSS (`scrollWidth` ≤ `clientWidth`) — die Zeile verlangt keinen Platz, den es
//     nicht gibt. Ohne diese zweite Achse liesse sich die erste durch Wegschneiden „erfüllen".
//
// 390 px und 900 px sind die zwei Breiten, an denen beide Achsen vor JOB 3582 ROT waren (Befund CI5
// in `kopfband-ci-chromium.test.ts`). Sie stehen hier nicht getrennt, sondern als Teil derselben
// Liste: dieselbe Ursache, dieselbe Zusage.
describe("JOB 3582 · L1 · mit Firmen-CI steht auf keiner Breite mehr etwas ausserhalb", () => {
  for (const breite of ALLE) {
    it(`L1 · ${breite} px mit Firmen-CI: der rechteste Kasten endet im Fenster`, async () => {
      const { m, logo } = await messeMitZusage(breite);
      protokolliere("L1", breite, m, logo);
      expect(
        draussen(m),
        `${breite}px: „${rechtester(m)}“ steht ${draussen(m).toFixed(1)} px rechts ausserhalb des Fensters`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.min(...m.kaesten.map((k) => k.links)),
        `${breite}px: ein Kasten steht links ausserhalb des Fensters`,
      ).toBeGreaterThanOrEqual(-1);
    }, 120_000);
  }
});

describe("JOB 3582 · L3 · mit Firmen-CI bleibt kein Überschuss", () => {
  for (const breite of ALLE) {
    it(`L3 · ${breite} px mit Firmen-CI: scrollWidth − clientWidth ≤ 1`, async () => {
      const { m, logo } = await messeMitZusage(breite);
      protokolliere("L3", breite, m, logo);
      expect(
        ueberschuss(m),
        `${breite}px: das Kopfband läuft über (${m.scrollBreite} > ${m.clientBreite})`,
      ).toBeLessThanOrEqual(1);
    }, 120_000);
  }
});

// ================================================================================================
// L2 — DIE SPANNE OHNE LOGOKASTEN: BEIDE KANTEN, BEIDE SEITEN, GEMESSEN.
// ================================================================================================
//
// §5.3 des Auftrags erlaubt, das Logo wegzulassen — aber nur unterhalb einer im Quelltext
// BENANNTEN, BEGRÜNDETEN und an BEIDEN SEITEN GEMESSENEN Schwelle. Genau das steht hier. Die vier
// Breiten kommen aus der Zusage selbst (`LOGO_OHNE_PLATZ_QUERY`), nicht aus einer zweiten Liste:
//
//   · UNTERE_KANTE − 1 (899 px) — noch die schmale Bauform: das Logo steht, gedeckelt.
//   · UNTERE_KANTE     (900 px) — die breite Bauform an ihrem engen Ende: kein Logo.
//   · OBERE_KANTE      (999 px) — noch zu eng: kein Logo.
//   · OBERE_KANTE + 1 (1000 px) — die Zeile trägt ihn wieder: das Logo steht, gedeckelt.
//
// AN ALLEN VIER wird zusätzlich gemessen, dass nichts ausserhalb des Fensters steht — sonst wäre
// die Spanne nur eine Behauptung darüber, wo es eng wird.
describe("JOB 3582 · L2 · die Spanne ohne Logokasten ist an beiden Kanten gemessen", () => {
  for (const breite of [UNTERE_KANTE - 1, UNTERE_KANTE, OBERE_KANTE, OBERE_KANTE + 1]) {
    it(`L2 · ${breite} px: die Zusage „${OHNE_PLATZ}" und der gezeichnete Baum stimmen überein`, async () => {
      const { m, logo, zugesagt, grenze } = await messeMitZusage(breite);
      protokolliere("L2", breite, m, logo);
      // `messeMitZusage` hat die Übereinstimmung schon gemessen; hier steht, was zusätzlich gilt.
      expect(
        draussen(m),
        `${breite}px: „${rechtester(m)}“ steht ausserhalb des Fensters`,
      ).toBeLessThanOrEqual(1);
      expect(ueberschuss(m), `${breite}px: das Kopfband läuft über`).toBeLessThanOrEqual(1);
      if (zugesagt) {
        expect(
          logo.bildBreite,
          `${breite}px: das Bild ist breiter als die hier geltende Obergrenze (${grenze} px)`,
        ).toBeLessThanOrEqual(grenze + 1);
      }
    }, 120_000);
  }
});

// ================================================================================================
// L4 — BEI 1280 px BLEIBT DIE CI-BAUFORM VON VOR DIESEM JOB. Gemessen, nicht behauptet.
// ================================================================================================
//
// WAS HIER IN RUNDE 1 STAND UND WARUM ES FALSCH WAR. Der Fall verglich die Zeile MIT Firmen-CI
// gegen die Zeile OHNE Firmen-CI und verlangte, dass jeder Kasten ausser der Wortmarke gleich breit
// ist. Erfüllen liess sich das nur, indem die Deckelung auch bei 1280 px zupackte — das Logo stand
// dort mit 44 statt seinen 88,3 px, und das Suchfeld bekam die 19,7 px zurück, die es mit
// Firmen-CI schon immer abgegeben hatte. Der Prüfer hat gemessen, dass das ein Umbau der
// geschützten Bauform ist und nicht ihre Erhaltung (BEN, JOB 3582 R1, Korrekturpflicht 1 und 2):
// „Die bisherige CI-Bauform bei 1280 px erhalten … L4 gegen den bisherigen Stand MIT CI prüfen,
// einschliesslich Wortmarke und Logo."
//
// DER RICHTIGE VERGLEICH IST DESHALB MIT-CI GEGEN MIT-CI-OHNE-DECKELUNG (Fall L4b), und er wird im
// selben Lauf an derselben Seite gefahren: gemessen wird die gezeichnete Zeile, dann wird dem Bild
// die Obergrenze am gezeichneten `<img>` weggenommen (`maxWidth: none` — genau der Zustand vor JOB
// 3582), und dann wird noch einmal gemessen. Stimmen beide Messungen Kasten für Kasten überein,
// WORTMARKE UND BILD EINGESCHLOSSEN, dann greift die Deckelung hier nicht. Das ist die Aussage von
// §5.4, und sie hängt an keiner gepinnten Zahl: sie vergleicht den Endstand mit dem Ausgangsstand.
//
// UND DIE ZWEITE, UNABHÄNGIGE HÄLFTE (Fall L4a): das Bild steht in seiner URSPRÜNGLICHEN Grösse —
// der Breite, die sich aus den Massen der Bilddatei bei 20 px Höhe (`h-5`) ergibt. Diese Rechnung
// kommt ohne die Deckelung aus und ohne den Eingriff in die Seite; sie wäre auch dann rot, wenn
// jemand die Obergrenze so knapp über den heutigen Wert legte, dass der Eingriff nichts änderte.
//
// BEIDE KANTEN WERDEN GEMESSEN (Fall L4c): bei 1279 px gilt die schmale Stufe und das Bild IST
// gedeckelt, bei 1280 px gilt die breite und es ist es nicht. Ohne die Gegenrichtung wäre nicht zu
// unterscheiden, ob die Kante wirkt oder ob die Deckelung überall stillliegt.
describe("JOB 3582 · L4 · bei 1280 px greift die Deckelung nicht", () => {
  // ZWEI FÄLLE STATT EINEM, und das ist kein Zierrat: die zwei Aussagen sind unabhängig, und in
  // EINEM Fall bräche die erste Zusicherung ab, bevor die zweite überhaupt misst. Die Gegenprobe
  // (breite Stufe auf die schmale gestellt) belegt dann nur die halbe Strenge. Getrennt wird jede
  // von ihnen für sich rot — gemessen, nicht behauptet.
  it("L4a · 1280 px mit Firmen-CI: das Bild steht in seiner ursprünglichen Grösse", async () => {
    const { m, logo, zugesagt, grenze } = await messeMitZusage(BREITE_BAUFORM);
    expect(zugesagt, `${BREITE_BAUFORM}px: hier steht gar kein Logokasten`).toBe(true);
    const { breitZugesagt } = await geltendeGrenze();
    expect(
      breitZugesagt,
      `${BREITE_BAUFORM}px: „${BREITE_ZEILE}" sagt hier NICHT die breite Stufe zu — dann gilt die Zusage des Mockups für eine Breite, die das Produkt anders behandelt`,
    ).toBe(true);
    protokolliere("L4a mit CI", BREITE_BAUFORM, m, logo);

    // DIE URSPRÜNGLICHE GRÖSSE, aus den Massen der Bilddatei gerechnet — nicht gepinnt.
    const ursprungsBreite =
      (logo.bildNaturBreite / Math.max(logo.bildNaturHoehe, 1)) * logo.bildHoehe;
    console.log(
      `${KENNUNG} · L4a · ${BREITE_BAUFORM}px · geltende Stufe ${grenze} px · Bild ${logo.bildBreite.toFixed(1)} px, ` +
        `ungedeckelt wären es ${ursprungsBreite.toFixed(1)} px (Datei ${logo.bildNaturBreite}×${logo.bildNaturHoehe} bei ${logo.bildHoehe.toFixed(1)} px Höhe)`,
    );
    expect(
      logo.bildBreite,
      `${BREITE_BAUFORM}px: das Firmenlogo ist auf ${logo.bildBreite.toFixed(1)} px gestutzt, ungedeckelt wäre es ${ursprungsBreite.toFixed(1)} px breit — die Deckelung greift in die Bauform des Mockups hinein`,
    ).toBeCloseTo(ursprungsBreite, 0);
  }, 180_000);

  it("L4b · 1280 px mit Firmen-CI: die Zeile ist Kasten für Kasten die ungedeckelte", async () => {
    const { m, logo, zugesagt, grenze } = await messeMitZusage(BREITE_BAUFORM);
    expect(zugesagt, `${BREITE_BAUFORM}px: hier steht gar kein Logokasten`).toBe(true);
    protokolliere("L4b mit CI", BREITE_BAUFORM, m, logo);

    // DER VERGLEICH GEGEN DEN UNGEDECKELTEN STAND, an derselben stehenden Seite.
    const seite = seiteRoh(stand);
    const genommen = await seite.evaluate<boolean>(SETZE_DECKEL, "none");
    expect(genommen, "am gezeichneten Kopfband war kein Firmenlogo zu finden").toBe(true);
    const ohneDeckel = await beruhige(BREITE_BAUFORM);
    const logoOhneDeckel = await liesLogoBefund(stand);
    protokolliere("L4b ohne Deckelung", BREITE_BAUFORM, ohneDeckel, logoOhneDeckel);

    const breiteVon = (mm: Messung, name: string): number => {
      const k = mm.kaesten.find((x) => x.name === name);
      expect(
        k,
        `${BREITE_BAUFORM}px: „${name}“ wurde ohne Deckelung gar nicht gemessen`,
      ).toBeDefined();
      return k ? k.rechts - k.links : Number.NaN;
    };
    expect(
      m.kaesten.map((k) => k.name).sort(),
      `${BREITE_BAUFORM}px: ohne Deckelung stehen andere Kästen im Kopfband als mit`,
    ).toEqual(ohneDeckel.kaesten.map((k) => k.name).sort());
    // KEIN Kasten wird übersprungen — die Wortmarke ist der, um den es geht: an ihr hängt das Logo.
    // 1 px Teilpixel-Toleranz, wie überall in dieser Messfamilie (`pruefeZeile` in
    // `kopfband-messung.ts`). Die Sache, um die es geht, liegt weit darüber: eine Deckelung, die
    // hier zupackte, nähme der Wortmarke 44,3 px und gäbe dem Suchfeld 19,7 px.
    for (const k of ohneDeckel.kaesten) {
      const unterschied = Math.abs(breiteVon(m, k.name) - (k.rechts - k.links));
      expect(
        unterschied,
        `${BREITE_BAUFORM}px: „${k.name}“ ist mit der Deckelung ${unterschied.toFixed(1)} px anders breit als ohne sie — die Bauform von vor JOB 3582 ist nicht erhalten`,
      ).toBeLessThanOrEqual(1);
    }
    expect(
      logoOhneDeckel.bildBreite,
      `${BREITE_BAUFORM}px: ohne Deckelung wird das Bild ${logoOhneDeckel.bildBreite.toFixed(1)} px breit statt der gemessenen ${logo.bildBreite.toFixed(1)} px`,
    ).toBeCloseTo(logo.bildBreite, 0);
    // Und die Zeile steht auch im Vergleichsstand im Fenster — sonst vergliche der Fall gegen eine
    // kaputte Zeile und nennte das „erhalten".
    expect(
      draussen(ohneDeckel),
      `${BREITE_BAUFORM}px: ohne Deckelung steht „${rechtester(ohneDeckel)}“ ausserhalb des Fensters`,
    ).toBeLessThanOrEqual(1);

    // Die Deckelung wieder einsetzen — der nächste Fall baut die Seite zwar neu auf, aber ein
    // Eingriff, den niemand zurücknimmt, ist eine Falle für jeden, der später etwas dazwischenlegt.
    await seite.evaluate<boolean>(SETZE_DECKEL, `${grenze}px`);
  }, 180_000);

  it(`L4c · ${BREITE_BAUFORM - 1} px: an der Kante darunter gilt die schmale Stufe — und die Zeile passt`, async () => {
    const kante = BREITE_BAUFORM - 1;
    const { m, logo, zugesagt, grenze } = await messeMitZusage(kante);
    expect(zugesagt, `${kante}px: hier steht gar kein Logokasten`).toBe(true);
    const { breitZugesagt } = await geltendeGrenze();
    expect(
      breitZugesagt,
      `${kante}px: „${BREITE_ZEILE}" sagt schon hier die breite Stufe zu — die Kante liegt nicht, wo sie liegen soll`,
    ).toBe(false);
    protokolliere("L4c", kante, m, logo);
    const ursprungsBreite =
      (logo.bildNaturBreite / Math.max(logo.bildNaturHoehe, 1)) * logo.bildHoehe;
    expect(
      logo.bildBreite,
      `${kante}px: das Bild ist ${logo.bildBreite.toFixed(1)} px breit statt der hier geltenden ${grenze} px — die schmale Stufe greift an ihrer eigenen Kante nicht`,
    ).toBeCloseTo(grenze, 0);
    expect(
      ursprungsBreite,
      `${kante}px: das Bild wäre ungedeckelt nicht breiter als die Stufe — dann misst dieser Fall nichts`,
    ).toBeGreaterThan(grenze + 1);
    expect(
      draussen(m),
      `${kante}px: „${rechtester(m)}“ steht ausserhalb des Fensters`,
    ).toBeLessThanOrEqual(1);
    expect(ueberschuss(m), `${kante}px: das Kopfband läuft über`).toBeLessThanOrEqual(1);
  }, 180_000);
});

// ================================================================================================
// L5 — WER DEN ÜBERLAUF DURCH WEGLASSEN „BEHEBT", HAT DIE AUFGABE NICHT ERFÜLLT.
// ================================================================================================
//
// Pedis Vorgabe „Produktidentität erkennbar halten" und die Zusage „NEBEN, NICHT ANSTELLE" gelten
// unverändert. Diese Datei misst deshalb ausdrücklich BEIDES an jeder Breite: die Wortmarke trägt
// ihr Wort — IMMER, auch in der Spanne ohne Logokasten —, und wo die Zeile das Logo trägt, ist es
// SICHTBAR.
//
// WAS „SICHTBAR" SEIT JOB 3616 HEISST, steht nicht hier, sondern an der einen Stelle, an der es
// auch gegengeprüft wird (`ruhe-und-sicht.ts` · `beurteileSicht`): Breite UND Höhe grösser als
// null, das Bild geladen und im Layout, kein `display: none` / `visibility: hidden` / `opacity: 0`
// an ihm oder einem Vorfahren, innerhalb des Fensters, und kein Vorfahr schneidet es ab —
// ROLLBARE VORFAHREN EINGESCHLOSSEN. Vorher genügten „geladen" und „breiter als 0 px": ein Logo
// mit Höhe 0 oder hinter einer Rollfläche galt als vorhanden. Die Zahlen des Urteils stehen im
// Lauf, auch wenn der Fall grün ist.
describe("JOB 3582 · L5 · KLARWERK bleibt stehen, das Firmenlogo bleibt SICHTBAR", () => {
  for (const breite of ALLE) {
    it(`L5 · ${breite} px mit Firmen-CI: Wortmarke gezeichnet, Firmenlogo wie zugesagt sichtbar`, async () => {
      const { logo, sicht, zugesagt } = await messeMitZusage(breite);
      // `markeText` ist `innerText` — er ist leer, wenn der Browser nichts malt. `textContent`
      // trüge auch Verborgenes und wäre hier die schwächere Aussage.
      expect(logo.markeText, `${breite}px: die Wortmarke zeichnet kein Wort`).toContain("KLARWERK");
      if (!zugesagt) {
        console.log(
          `${KENNUNG_3616} · L5 · ${breite}px · kein Logokasten zugesagt — nichts zu sehen`,
        );
        return;
      }
      const urteil = beurteileSicht(sicht);
      console.log(`${KENNUNG_3616} · L5 · ${breite}px · ${urteil.masse}`);
      verlangeSichtbar(breite, sicht);
    }, 120_000);
  }
});

// ================================================================================================
// L7 — DER RUHEBEWEIS WIRD SELBST GEMESSEN: EINE VERZÖGERTE ZÄHLER-ANTWORT DARF DIE ZAHL NICHT
// VERÄNDERN.
// ================================================================================================
//
// DAS IST DER VORSCHLAG DES PRÜFERS, ausgeführt (`archiv/3582/runde-2/ben.md:30`: „Badge-Antwort
// gezielt verzögern und anschließend messen"). Ohne diesen Fall wäre der Ladenachweis eine
// Behauptung: er liefe jedes Mal durch, weil die Antwort ohnehin früh kommt, und niemand wüsste,
// ob er überhaupt etwas trägt.
//
// DER FALL MISST DREI ZAHLEN AN DERSELBEN BREITE:
//   · ENDE — der ruhige Lauf ohne Verzug.
//   · NAIV — wie die Datei bis JOB 3616 gemessen hätte: zwei Stichproben im Abstand von 250 ms,
//     ohne jeden Ladenachweis, WÄHREND die Zähler-Antwort künstlich zurückgehalten wird. Das ist
//     hier kein Prüfweg, sondern der GEGENSTAND der Messung — die Zahl, die der alte Stand
//     geliefert hätte.
//   · SPÄT — derselbe Seitenaufbau, aber zu Ende gemessen mit dem Nachweis von JOB 3616.
//
// DREI AUSSAGEN, JEDE FÜR SICH:
//   1. Als die alte Art „Ruhe" meldete, war die Antwort nachweislich NOCH NICHT IM BROWSER: die
//      Ressourcen-Zeitleiste des Dokuments trug keinen Eintrag für `/api/validation/board`, obwohl
//      der Server die Frage längst gesehen hatte (`stand.abrufe` > 0). Das ist der Satz des
//      Prüfers, gemessen — und zwar an der Stelle, an der Runde 1 danebengriff: die Antwort wird
//      zurückgehalten, NACHDEM der Server sie erzeugt hat, unmittelbar vor `route.fulfill`. Ein
//      Zählschritt an dieser Stelle hätte sie schon als „da" gewertet (BEN, R1, Korrekturpflicht 1).
//   2. Der neue Weg hat auf die Ankunft GEWARTET — der Lauf dauert mindestens so lange wie der
//      Verzug. Ohne den Ladenachweis ist genau diese Zusicherung rot (gemessen: 644 ms statt
//      2500 ms, Lauf ae68849d…).
//   3. Und er misst trotzdem denselben Endzustand wie der ruhige Lauf, Kasten für Kasten.
//
// WAS DIESER BESTAND NICHT HERGIBT, und das steht hier, weil ein Kommentar, der das Gegenteil der
// Messung sagt, selbst ein Befund ist: die Bühne dieser Datei hat KEIN Prüfobjekt —
// `GET /api/validation/board` liefert eine leere Liste (der Fall gibt die Zahl aus). Ein Zähler mit
// 0 wird im Kopfband nicht gezeichnet (`sichtbarerZaehler` in `shell/KopfbandPunkte.tsx`), also
// verändert die zurückgehaltene Antwort HIER die Geometrie nicht. Die 15 px, die JOB 3582 als
// Anlass gemessen hat (884,2 px gegen 899,2 px bei 900 px), kommen deshalb aus diesem Bestand nicht
// zustande; der vierte Vergleich (NAIV ≠ SPÄT) steht darum unter der Bedingung, dass überhaupt eine
// Zahl zu zeichnen ist, und sagt es im Lauf, wenn er ausfällt.
//
// GEMESSEN WIRD BEI 900 px: dort steht die BREITE Bauform mit der vollen Punktreihe, dort wäre der
// Zähler gezeichnet, und dort ist die Zeile am engsten (0,8 px Luft).
const ZAEHLER_BREITE = 900;
/**
 * Der Verzug ist länger als die alte Ruhemessung im ungünstigsten Fall dauern kann
 * (`RUHE_VERSUCHE` × `RUHE_PAUSE_MS` = 3 s). Nur so ist sicher, dass die alte Art fertig ist,
 * BEVOR die Antwort da sein kann — sonst bewiese Aussage 1 nichts.
 */
const VERZUG_MS = 4_000;

/**
 * DIE ALTE ART ZU MESSEN, absichtlich erhalten — aber NICHT als Prüfweg.
 *
 * Sie steht ausschliesslich hier, als GEGENSTAND von L7: zwei Stichproben im Abstand von 250 ms,
 * ohne jeden Ladenachweis. Kein anderer Fall dieser Datei ruft sie; gemessen und zugesichert wird
 * überall mit `beruhige`.
 */
async function zweiStichproben(): Promise<Messung> {
  let vorher = await messeStehend(stand);
  for (let versuch = 0; versuch < RUHE_VERSUCHE; versuch++) {
    await pause(RUHE_PAUSE_MS);
    const jetzt = await messeStehend(stand);
    if (zeilenUnterschied(vorher, jetzt) === null) {
      return jetzt;
    }
    vorher = jetzt;
  }
  throw new Error("die zwei Stichproben kamen nie überein — der Vergleichswert von L7 fehlt");
}

describe("JOB 3616 · L7 · eine verzögerte Zähler-Antwort verändert die gemessene Zahl nicht mehr", () => {
  it(`L7 · ${ZAEHLER_BREITE} px: mit ${VERZUG_MS} ms zurückgehaltener Zähler-Antwort wird der ENDZUSTAND gemessen`, async () => {
    const soll = await zaehlerSollwert();
    const ende = await messeRuhig(ZAEHLER_BREITE);
    protokolliere("L7 ohne Verzug", ZAEHLER_BREITE, ende, await liesLogoBefund(stand));

    // Der Verzug wirkt ab dem NÄCHSTEN Seitenaufbau; es steht kein zweiter Aufbau davor, dessen
    // späte Antwort den Nachweis fälschlich erfüllen könnte.
    zaehlerVerzugMs = VERZUG_MS;
    const begonnen = Date.now();
    let naiv: Messung;
    let spaet: Messung;
    let abrufeBeiNaiv = 0;
    let ankunftBeiNaiv: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
    try {
      neuerSeitenaufbau();
      await messe(stand, ZAEHLER_BREITE, HOEHE);
      naiv = await zweiStichproben();
      // DER STAND IN DEM AUGENBLICK, in dem die alte Art „Ruhe" gemeldet hat.
      abrufeBeiNaiv = stand.abrufe.get(ZAEHLER_PFAD) ?? 0;
      ankunftBeiNaiv = beurteileAnkunft(await liesAnkunft());
      // UND DIE NEUE ART: derselbe Seitenaufbau, zu Ende gemessen.
      spaet = await beruhige(ZAEHLER_BREITE);
    } finally {
      zaehlerVerzugMs = 0;
    }
    const dauer = Date.now() - begonnen;
    protokolliere("L7 naiv (alte Art)", ZAEHLER_BREITE, naiv, null);
    protokolliere("L7 mit Verzug", ZAEHLER_BREITE, spaet, null);
    console.log(
      `${KENNUNG_3616} · L7 · ${ZAEHLER_BREITE}px · Zähler soll ${soll} sein · Verzug ${VERZUG_MS} ms · ` +
        `verzögerter Lauf ${dauer} ms · bei „Ruhe" der alten Art: ${abrufeBeiNaiv} Abrufe am Server / ${ankunftBeiNaiv.fertig} Antworten im Browser · ` +
        `rechtester Kasten: ohne Verzug ${Math.max(...ende.kaesten.map((k) => k.rechts)).toFixed(1)} px · ` +
        `naiv ${Math.max(...naiv.kaesten.map((k) => k.rechts)).toFixed(1)} px · mit Nachweis ${Math.max(...spaet.kaesten.map((k) => k.rechts)).toFixed(1)} px`,
    );

    // 1. DIE ALTE ART HAT NACHWEISLICH GEMESSEN, BEVOR DIE ANTWORT IM BROWSER WAR.
    expect(
      abrufeBeiNaiv,
      `${ZAEHLER_BREITE}px: der Server hat die Zähler-Abfrage gar nicht gesehen — dann hält dieser Fall nichts zurück`,
    ).toBeGreaterThan(0);
    expect(
      ankunftBeiNaiv.fertig,
      `${ZAEHLER_BREITE}px: als die zwei Stichproben „Ruhe" meldeten, war die Antwort schon im Browser (${ankunftBeiNaiv.fertig} Einträge in der Zeitleiste) — dann misst dieser Fall nichts`,
    ).toBe(0);
    // 2. DER NEUE WEG HAT AUF SIE GEWARTET.
    expect(
      dauer,
      `${ZAEHLER_BREITE}px: der verzögerte Lauf war kürzer als der Verzug — auf die Antwort wurde nicht gewartet`,
    ).toBeGreaterThanOrEqual(VERZUG_MS);
    // 3. UND MISST TROTZDEM DENSELBEN ENDZUSTAND.
    expect(
      zeilenUnterschied(ende, spaet),
      `${ZAEHLER_BREITE}px: mit zurückgehaltener Zähler-Antwort wurde eine ANDERE Zeile gemessen als im ruhigen Lauf`,
    ).toBeNull();
    // 4. Die geometrische Hälfte — nur dort aussagekräftig, wo überhaupt eine Zahl zu zeichnen ist.
    if (soll > 0) {
      expect(
        zeilenUnterschied(naiv, spaet),
        `${ZAEHLER_BREITE}px: die zwei Stichproben ohne Ladenachweis lieferten schon denselben Endzustand — dann kostet der Zähler keine Breite (Zähler soll ${soll} sein)`,
      ).not.toBeNull();
    } else {
      console.log(
        `${KENNUNG_3616} · L7 · das Prüf-Board dieser Bühne ist leer (${soll}), der Zähler wird also gar nicht gezeichnet — die GEOMETRISCHE Hälfte ist in diesem Bestand NICHT gemessen; gemessen sind der Ladezustand (1) und das Warten (2)`,
      );
    }
  }, 180_000);
});

// ================================================================================================
// L8 — BLEIBT DIE ANTWORT GANZ AUS, BRICHT DER FALL AB. MIT GRUND, NICHT MIT EINER ZUFALLSZAHL.
// ================================================================================================
//
// Die dritte Korrekturpflicht-Hälfte des Prüfers („dauerhaft ausbleibende Antwort führt zum
// begründeten Abbruch", BEN JOB 3616 R1). Ohne diesen Fall wäre der Abbruchweg des Ladenachweises
// ungefahrener Code — und ein Abbruch, den nie jemand ausgelöst hat, ist eine Behauptung.
//
// DIE ANTWORT WIRD ANGEHALTEN, NICHT VERZÖGERT: ein Halt, den der Fall selbst freigibt, lässt
// keinen Zeitgeber im Lauf zurück. Die Frist wird für diesen einen Fall kurz gestellt (1,5 s statt
// 20 s), damit der Beleg nicht 20 s kostet; die Frist ist die einzige Grösse, die sich ändert.
const ABBRUCH_FRIST_MS = 1_500;

describe("JOB 3616 · L8 · ohne Antwort im Browser wird nicht gemessen", () => {
  it(`L8 · ${START_BREITE} px: die angehaltene Zähler-Antwort führt zum begründeten Abbruch`, async () => {
    halteZaehlerAntwortAn();
    nachweisFristMs = ABBRUCH_FRIST_MS;
    let fehler: unknown = null;
    let ankunft: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
    try {
      neuerSeitenaufbau();
      await messe(stand, START_BREITE, HOEHE);
      ankunft = beurteileAnkunft(await liesAnkunft());
      await beruhige(START_BREITE);
    } catch (e) {
      fehler = e;
    } finally {
      nachweisFristMs = NACHWEIS_FRIST_MS;
      gibZaehlerAntwortFrei();
    }
    console.log(
      `${KENNUNG_3616} · L8 · ${START_BREITE}px · angehaltene Antwort · ${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server, ` +
        `${ankunft.fertig} Antworten im Browser · Abbruch: ${fehler === null ? "KEINER" : String(fehler).split("\n")[0]}`,
    );
    expect(
      fehler,
      `${START_BREITE}px: die Ruhemessung wurde fertig, obwohl die Zähler-Antwort den Browser nie erreicht hat — genau das darf nicht sein`,
    ).not.toBeNull();
    expect(String(fehler), "der Abbruch nennt seinen Grund nicht").toContain(
      "NICHT IM BROWSER ANGEKOMMEN",
    );
    expect(String(fehler), "der Abbruch nennt die Abfrage nicht").toContain(ZAEHLER_PFAD);
    // Die Gegenrichtung: derselbe Aufbau mit freigegebener Antwort kommt durch. Ohne sie wäre ein
    // Nachweis, der IMMER abbricht, von einem tragenden nicht zu unterscheiden.
    const m = await messeRuhig(START_BREITE);
    expect(
      m.kaesten.length,
      `${START_BREITE}px: nach der Freigabe wurde nichts gemessen`,
    ).toBeGreaterThan(2);
  }, 180_000);
});

// ================================================================================================
// L11 — EINE EMPFANGENE FEHLERANTWORT IST KEIN LADENACHWEIS.
// ================================================================================================
//
// DER ANLASS IST GEMESSEN, NICHT VERMUTET (BEN, JOB 3616 R2, Korrekturpflicht 1). Der Nachweis der
// Runde 2 fragte die Ressourcen-Zeitleiste nur, OB ein Eintrag fertig empfangen ist. Der Prüfer hat
// die Zähler-Quelle gestört und bekam `nachweisErbracht:true` nach 355 ms mit
// `timing:[{status:503,ende:65.5}]`: eine nicht geladene Zeile bekam einen fertigen Messwert. Und
// die zweite Hälfte des Nachweises fing das nicht auf — sie hängt am GEZEICHNETEN Zähler, und der
// entfällt bei leerem Prüf-Board (Sollwert 0) und in der schmalen Bauform ohnehin.
//
// GEMESSEN WIRD DESHALB BEI 390 px, also genau dort: schmale Bauform, der Punkt „Prüfen" ist gar
// nicht gezeichnet, das Board ist leer. Wenn der Nachweis HIER trägt, trägt er ohne jede Hilfe.
//
// ZWEI FÄLLE, WEIL ES ZWEI AUSSAGEN SIND:
//   · L11a — die Quelle antwortet DAUERHAFT mit 503 (der Störschalter der Bühne, derselbe Griff,
//     mit dem der Prüfer gemessen hat). Erwartet wird ein Abbruch MIT GRUND, der den Status nennt —
//     und danach, als Gegenrichtung am selben Stand, ein grüner Lauf mit der erfolgreichen LEEREN
//     Antwort. Ohne die Gegenrichtung wäre ein Nachweis, der jede Zeitleiste ablehnt, von einem
//     tragenden nicht zu unterscheiden.
//   · L11b — die Quelle antwortet EINMAL mit 503, und danach folgt der echte Wiederholungsabruf des
//     Produkts, künstlich verzögert. Erwartet wird, dass der erste Eintrag KEINE vorzeitige
//     Freigabe bewirkt: solange nur der Fehler dasteht, wird nicht gemessen, und der Messwert
//     entsteht erst mit der erfolgreichen Antwort.
const FEHLER_FRIST_MS = 2_500;
/** Der Verzug des Wiederholungsabrufs — deutlich über den 250 ms zweier Stichproben. */
const WIEDERHOLUNG_VERZUG_MS = 1_200;

/** Was der Browser über den Punkt „Prüfen" hergibt — für die Protokollzeile der L11-Fälle. */
async function zaehlerLage(): Promise<string> {
  const z = await seiteRoh(stand).evaluate<ZaehlerStand>(ZAEHLER_STAND, ZAEHLER_PUNKT);
  return `Punkt „${ZAEHLER_PUNKT}“ ${z.punktDa ? "gezeichnet" : "in dieser Bauform NICHT gezeichnet"}, ${z.zaehlerDa ? `Zähler „${z.text}“` : "kein Zähler"}`;
}

/** Warten, bis der Fehlereintrag wirklich in der Zeitleiste steht — vorher misst L11b nichts. */
async function warteAufEintrag(frist: number): Promise<AnkunftBefund> {
  const begonnen = Date.now();
  for (;;) {
    const befund = await liesAnkunft();
    if (befund.eintraege.some((e) => e.responseEnd > 0)) {
      return befund;
    }
    if (Date.now() - begonnen > frist) {
      throw new Error(
        `in ${(frist / 1000).toFixed(1)} s kam gar kein Eintrag für ${ZAEHLER_PFAD} in die Zeitleiste — dann misst L11b nichts`,
      );
    }
    await pause(25);
  }
}

describe("JOB 3616 · L11 · ein empfangener HTTP-Fehler ist kein fertiger Ladezustand", () => {
  it(`L11a · ${START_BREITE} px: dauerhaftes HTTP 503 auf die Zähler-Abfrage bricht mit Grund ab`, async () => {
    const soll = await zaehlerSollwert();
    stand.stoerung = ZAEHLER_PFAD;
    nachweisFristMs = FEHLER_FRIST_MS;
    let fehler: unknown = null;
    let urteil: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
    let lage = "nicht gelesen";
    try {
      neuerSeitenaufbau();
      await messe(stand, START_BREITE, HOEHE);
      await beruhige(START_BREITE);
    } catch (e) {
      fehler = e;
    } finally {
      urteil = beurteileAnkunft(await liesAnkunft());
      lage = await zaehlerLage();
      nachweisFristMs = NACHWEIS_FRIST_MS;
      stand.stoerung = null;
    }
    console.log(
      `${KENNUNG_3616} · L11a · ${START_BREITE}px · Zähler soll ${soll} sein · ${lage} · ` +
        `Zeitleiste: ${urteil.fertig} empfangen (${statusListe(urteil.status)}), davon ${urteil.erfolgreich} erfolgreich · ` +
        `${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server · Abbruch: ${fehler === null ? "KEINER" : String(fehler).split("\n")[0]}`,
    );

    // DIE VORAUSSETZUNG: die Antwort IST angekommen — dieser Fall ist nicht L8 mit anderem Namen.
    expect(
      urteil.fertig,
      `${START_BREITE}px: es kam gar keine Antwort in der Zeitleiste an — dann misst dieser Fall die ausbleibende Antwort (L8) statt die empfangene Fehlerantwort`,
    ).toBeGreaterThan(0);
    expect(
      urteil.status.every((s) => s === 503),
      `${START_BREITE}px: die Zeitleiste trägt andere Status als 503 (${statusListe(urteil.status)}) — die Störung hat nicht gegriffen`,
    ).toBe(true);
    // UND DIE LAGE, IN DER DIE ZWEITE HÄLFTE DES NACHWEISES NICHTS BEITRÄGT.
    expect(
      soll,
      `${START_BREITE}px: das Prüf-Board dieser Bühne ist nicht mehr leer (${soll}) — dann trüge auch der gezeichnete Zähler, und dieser Fall misst nicht mehr die Lücke, aus der er entstanden ist`,
    ).toBe(0);

    // DIE AUSSAGE.
    expect(
      fehler,
      `${START_BREITE}px: mit HTTP 503 auf ${ZAEHLER_PFAD} wurde zu Ende gemessen — eine nicht geladene Zeile bekam einen fertigen Messwert`,
    ).not.toBeNull();
    expect(String(fehler), "der Abbruch nennt den empfangenen Status nicht").toContain("HTTP 503");
    expect(String(fehler), "der Abbruch nennt die Abfrage nicht").toContain(ZAEHLER_PFAD);
    expect(String(fehler), "der Abbruch nennt seinen Grund nicht").toContain(
      "kein fertiger Ladezustand",
    );

    // DIE GEGENRICHTUNG: dieselbe Abfrage, erfolgreich und LEER beantwortet.
    const m = await messeRuhig(START_BREITE);
    const nachher = beurteileAnkunft(await liesAnkunft());
    console.log(
      `${KENNUNG_3616} · L11a · Gegenrichtung · ${nachher.meldung} · ${m.kaesten.length} Kästen gemessen`,
    );
    expect(
      nachher.art,
      `${START_BREITE}px: die erfolgreiche leere Antwort trug den Nachweis nicht — ${nachher.meldung}`,
    ).toBe("angekommen");
    expect(nachher.erfolgreich, "kein erfolgreicher Eintrag nach der Freigabe").toBeGreaterThan(0);
    expect(
      m.kaesten.length,
      `${START_BREITE}px: nach der Freigabe wurde nichts gemessen`,
    ).toBeGreaterThan(2);
  }, 180_000);

  it(`L11b · ${START_BREITE} px: erst nach dem verzögerten Wiederholungsabruf wird gemessen`, async () => {
    zaehlerFehlerMale = 1;
    zaehlerFehlerGeliefert = 0;
    zaehlerVerzugMs = WIEDERHOLUNG_VERZUG_MS;
    let befundBeimFehler: AnkunftBefund = KEINE_ANKUNFT;
    let nachher: Ankunftsurteil = beurteileAnkunft(KEINE_ANKUNFT);
    let dauer = 0;
    let lage = "nicht gelesen";
    try {
      neuerSeitenaufbau();
      await messe(stand, START_BREITE, HOEHE);
      befundBeimFehler = await warteAufEintrag(30_000);
      const begonnen = Date.now();
      await beruhige(START_BREITE);
      dauer = Date.now() - begonnen;
      nachher = beurteileAnkunft(await liesAnkunft());
      lage = await zaehlerLage();
    } finally {
      zaehlerFehlerMale = 0;
      zaehlerVerzugMs = 0;
    }
    const urteilBeimFehler = beurteileAnkunft(befundBeimFehler);
    const fehlerEnde = Math.max(
      ...befundBeimFehler.eintraege.filter((e) => e.responseEnd > 0).map((e) => e.responseEnd),
    );
    console.log(
      `${KENNUNG_3616} · L11b · ${START_BREITE}px · ${lage} · ${zaehlerFehlerGeliefert} Fehlerantwort(en) ausgeliefert · ` +
        `beim Fehlereintrag: ${urteilBeimFehler.art} (${statusListe(urteilBeimFehler.status)}, responseEnd ${fehlerEnde.toFixed(0)} ms) · ` +
        `danach: ${nachher.art} (${statusListe(nachher.status)}, responseEnd ${nachher.responseEnd.toFixed(0)} ms) · ` +
        `nach dem Fehlereintrag noch ${dauer} ms gewartet · ${stand.abrufe.get(ZAEHLER_PFAD) ?? 0} Abrufe am Server`,
    );

    // DIE VORAUSSETZUNG: es gab wirklich eine Fehlerantwort, und sie stand in der Zeitleiste.
    expect(zaehlerFehlerGeliefert, "es wurde gar keine Fehlerantwort ausgeliefert").toBe(1);
    expect(
      urteilBeimFehler.status,
      `${START_BREITE}px: der erste Eintrag trug nicht den Status 503 (${statusListe(urteilBeimFehler.status)})`,
    ).toContain(503);

    // 1. DER ERSTE EINTRAG GIBT NICHTS FREI.
    expect(
      urteilBeimFehler.art,
      `${START_BREITE}px: mit nur einer empfangenen Fehlerantwort in der Zeitleiste galt der Ladenachweis als erbracht — genau das ist die vorzeitige Freigabe`,
    ).toBe("wartet");

    // 2. GEMESSEN WIRD ERST MIT DER ERFOLGREICHEN ANTWORT — und die kam nachweislich später.
    expect(
      nachher.art,
      `${START_BREITE}px: nach dem Wiederholungsabruf trug der Nachweis nicht — ${nachher.meldung}`,
    ).toBe("angekommen");
    expect(nachher.erfolgreich, "kein erfolgreicher Eintrag nach der Wiederholung").toBeGreaterThan(
      0,
    );
    expect(
      nachher.responseEnd - fehlerEnde,
      `${START_BREITE}px: die erfolgreiche Antwort kam nicht messbar nach der Fehlerantwort (${nachher.responseEnd.toFixed(0)} ms gegen ${fehlerEnde.toFixed(0)} ms)`,
    ).toBeGreaterThanOrEqual(WIEDERHOLUNG_VERZUG_MS);
    expect(
      dauer,
      `${START_BREITE}px: nach dem Fehlereintrag wurde nur ${dauer} ms gewartet — kürzer als der Verzug des Wiederholungsabrufs`,
    ).toBeGreaterThanOrEqual(WIEDERHOLUNG_VERZUG_MS);
  }, 180_000);
});

// ================================================================================================
// L6 — DIE REGEL HÄNGT NICHT AN DER BREITE DER HEUTIGEN BILDDATEI.
// ================================================================================================
//
// Heute gibt es genau ein Firmenprofil. Eine Deckelung, die auf dessen Seitenverhältnis gerechnet
// wäre, wäre morgen dieselbe Lücke — deshalb misst dieser Fall die REGEL: dasselbe Kopfband, an
// derselben Breite, mit einem Bild von rund dem zwölffachen Seitenverhältnis. Ungedeckelt wäre es
// über 1000 px breit; die Zeile muss trotzdem ins Fenster passen.
//
// UND DIE ZAHL WIRD NACHGERECHNET, nicht geglaubt: der gedeckelte Kasten ist genau so breit, wie
// die an dieser Breite geltende Stufe in `Logo.tsx` es sagt. Welche das ist, sagt das Produkt selbst
// (`LOGO_BREITE_ZEILE_QUERY`, ausgewertet von Chromiums `matchMedia`); die Zahlen werden in
// `deckelung-quelle.ts` GELESEN und stehen hier nicht ein zweites Mal.
//
// GEMESSEN WIRD AN DER ENGSTEN (390 px) UND AN DER BREITESTEN (1280 px) BREITE: an der engsten,
// weil dort der Befund lag; an der breitesten, weil die Deckelung für das HEUTIGE Bild dort NICHT
// bindet (Fall L4) — und genau deshalb wäre dort ein sehr breites Bild ungebremst. Dass die breite
// Stufe trotzdem eine Grenze IST und nicht bloss eine grosse Zahl, sagt nur dieser Fall.
describe("JOB 3582 · L6 · auch ein sehr breites Logo sprengt die Zeile nicht", () => {
  for (const breite of [START_BREITE, BREITE_BAUFORM] as const) {
    it(`L6 · ${breite} px mit einem zwölffach breiten Bild: die Zeile passt weiterhin`, async () => {
      const seite = seiteRoh(stand);
      const vorher = await messeMitZusage(breite);
      expect(vorher.zugesagt, `${breite}px: hier steht gar kein Logokasten zum Austauschen`).toBe(
        true,
      );

      const gesetzt = await seite.evaluate<boolean>(SETZE_BILD, BREITES_LOGO);
      expect(gesetzt, "am gezeichneten Kopfband war kein Firmenlogo zu finden").toBe(true);
      await seite.waitForFunction(BREITES_BILD_STEHT, BREITES_LOGO, {
        timeout: 30_000,
      });

      // Auch hier RUHIG: der Bildtausch geschieht an der stehenden Seite, ein Neuaufbau würde ihn
      // wegwerfen — beruhigt wird deshalb ohne Neuaufbau.
      const m = await beruhige(breite);
      const logo = await liesLogoBefund(stand);
      protokolliere("L6", breite, m, logo);

      expect(
        logo.bildNaturBreite / Math.max(logo.bildNaturHoehe, 1),
        "das breite Ersatzbild ist gar nicht breiter als das echte",
      ).toBeGreaterThan(10);
      const stufe = vorher.grenze === LOGO_GRENZE_BREIT ? DECKELUNG_BREIT_NAME : DECKELUNG_NAME;
      expect(
        logo.bildBreite,
        `${breite}px: das sehr breite Bild wird nicht auf ${stufe} (${vorher.grenze} px) gedeckelt, sondern ist ${logo.bildBreite.toFixed(1)} px breit`,
      ).toBeCloseTo(vorher.grenze, 0);
      expect(
        draussen(m),
        `${breite}px: mit einem sehr breiten Bild steht „${rechtester(m)}“ ausserhalb des Fensters`,
      ).toBeLessThanOrEqual(1);
      expect(
        ueberschuss(m),
        `${breite}px: mit einem sehr breiten Bild läuft das Kopfband über`,
      ).toBeLessThanOrEqual(1);
    }, 180_000);
  }
});

// ================================================================================================
// L10 — DER SICHTMESSER WIRD AM GEZEICHNETEN PRODUKT KALIBRIERT: RAHMEN UND ROLLFLÄCHE.
// ================================================================================================
//
// DER ANLASS IST EINE GEMESSENE FEHLFREIGABE, keine Vermutung. Der Prüfer hat in Runde 1 dem
// Logokasten im Browser `overflow: auto` und einen 20-px-Rahmen gegeben: das Bild begann bei
// 125,47 px, die innere Begrenzung lag bei 140,47 px — 15 px waren abgeschnitten, und der Befund
// sagte `sichtbar:true, gruende:[]`. Ursache: geprüft wurde gegen `getBoundingClientRect()`, also
// gegen die ÄUSSERE Kante samt Rahmen (BEN, JOB 3616 R1, Korrekturpflicht 2).
//
// DIESER FALL STELLT GENAU DAS HER UND HÄLT ES FEST. Er misst in beide Richtungen am selben
// gezeichneten Kopfband:
//   (a) die Rollfläche ist SCHMALER als das Bild → der Befund muss rot sein, und die Voraussetzung
//       wird vorher gemessen: das Bild liegt noch INNERHALB der äusseren Kante (sonst hätte auch
//       der alte Stand rot gesagt und der Fall bewiese nichts);
//   (b) dieselbe Rollfläche, nur breit genug → grün. Ohne die Gegenrichtung wäre ein Messer, der
//       jeden rollbaren Vorfahren ablehnt, von einem richtigen nicht zu unterscheiden.
//
// Der Eingriff geschieht am Inline-Stil der gezeichneten Elemente — derselbe Griff wie L4b und L6 —
// und wird am Ende zurückgenommen; der nächste Fall baut die Seite ohnehin neu auf.
const SETZE_ROLLFLAECHE = fn(`(arg) => {
  const kasten = document.querySelector('[data-testid="kopfband-firmenlogo"]');
  const bild = kasten ? kasten.querySelector('img') : null;
  if (!kasten || !bild) return null;
  const vorher = bild.getBoundingClientRect();
  // Das Bild behält seine gezeichnete Grösse, damit der Kasten es nicht einfach mitschrumpft —
  // gemessen werden soll die Beschneidung, nicht eine neue Bildbreite.
  bild.style.width = vorher.width + 'px';
  bild.style.minWidth = vorher.width + 'px';
  bild.style.maxWidth = 'none';
  bild.style.flexShrink = '0';
  kasten.style.boxSizing = 'content-box';
  kasten.style.overflow = 'auto';
  kasten.style.border = arg.rahmen + 'px solid rgba(0,0,0,0)';
  kasten.style.width = (vorher.width - arg.fehlend) + 'px';
  kasten.style.height = (vorher.height + 10) + 'px';
  return { bildBreite: vorher.width, bildHoehe: vorher.height };
}`);

const NIMM_ROLLFLAECHE_ZURUECK = fn(`() => {
  const kasten = document.querySelector('[data-testid="kopfband-firmenlogo"]');
  const bild = kasten ? kasten.querySelector('img') : null;
  if (!kasten || !bild) return false;
  for (const eigenschaft of ['width', 'minWidth', 'maxWidth', 'flexShrink']) { bild.style[eigenschaft] = ''; }
  for (const eigenschaft of ['boxSizing', 'overflow', 'border', 'width', 'height']) { kasten.style[eigenschaft] = ''; }
  return true;
}`);

/** Die Zahlen des Logokastens aus dem Sichtbefund — äussere Kante und Schnittfläche. */
function logoKnoten(sicht: SichtBefund): { rechteck: Rechteck; innen: Rechteck } {
  const k = sicht.kette.find((x) => x.name.includes("kopfband-firmenlogo"));
  if (k === undefined) {
    throw new Error(
      `die Kette des Sichtbefundes trägt keinen Logokasten: ${sicht.kette.map((x) => x.name).join(" → ")}`,
    );
  }
  return { rechteck: k.rechteck, innen: k.innen };
}

describe("JOB 3616 · L10 · ein gerahmter, rollbarer Vorfahr schneidet ab — und das wird gemessen", () => {
  it(`L10 · ${START_BREITE} px: 20 px Rahmen und zu schmale Rollfläche machen den Befund rot`, async () => {
    const { sicht, zugesagt } = await messeMitZusage(START_BREITE);
    expect(zugesagt, `${START_BREITE}px: hier steht gar kein Logokasten`).toBe(true);
    verlangeSichtbar(START_BREITE, sicht);
    const seite = seiteRoh(stand);
    const RAHMEN = 20;
    const FEHLEND = 15;
    try {
      // (a) DIE BESCHNEIDUNG.
      const gesetzt = await seite.evaluate<{ bildBreite: number; bildHoehe: number } | null>(
        SETZE_ROLLFLAECHE,
        { rahmen: RAHMEN, fehlend: FEHLEND },
      );
      expect(gesetzt, "am gezeichneten Kopfband war kein Firmenlogo zu finden").not.toBeNull();
      const eng = await liesSicht();
      const bildEng = eng.kette[0];
      const kastenEng = logoKnoten(eng);
      if (bildEng === undefined) {
        throw new Error("der Sichtbefund trägt kein Bild");
      }
      const urteilEng = beurteileSicht(eng);
      console.log(
        `${KENNUNG_3616} · L10 · ${START_BREITE}px · Rahmen ${RAHMEN} px · Bild ${bildEng.rechteck.links.toFixed(2)} … ${bildEng.rechteck.rechts.toFixed(2)} px · ` +
          `Schnittfläche ${kastenEng.innen.links.toFixed(2)} … ${kastenEng.innen.rechts.toFixed(2)} px · äussere Kante ${kastenEng.rechteck.links.toFixed(2)} … ${kastenEng.rechteck.rechts.toFixed(2)} px · ` +
          `abgeschnitten ${(bildEng.rechteck.rechts - kastenEng.innen.rechts).toFixed(2)} px · Urteil: ${urteilEng.sichtbar ? "sichtbar" : urteilEng.gruende.join(" · ")}`,
      );
      // DIE VORAUSSETZUNG, die diesen Fall überhaupt tragen: das Bild ragt über die SCHNITTFLÄCHE
      // hinaus, liegt aber noch innerhalb der ÄUSSEREN Kante. Genau dazwischen lag die Fehlfreigabe.
      expect(
        bildEng.rechteck.rechts - kastenEng.innen.rechts,
        `${START_BREITE}px: die Rollfläche schneidet das Bild gar nicht ab — dann misst dieser Fall nichts`,
      ).toBeGreaterThan(1);
      expect(
        bildEng.rechteck.rechts,
        `${START_BREITE}px: das Bild ragt schon über die ÄUSSERE Kante hinaus — dann wäre auch der Stand vor dieser Runde rot, und der Fall belegt die Rahmenkorrektur nicht`,
      ).toBeLessThanOrEqual(kastenEng.rechteck.rechts + 1);
      expect(
        urteilEng.sichtbar,
        `${START_BREITE}px: ein um ${(bildEng.rechteck.rechts - kastenEng.innen.rechts).toFixed(1)} px beschnittenes Firmenlogo gilt als sichtbar`,
      ).toBe(false);
      expect(urteilEng.gruende.join(" · "), "der Grund nennt die Beschneidung nicht").toContain(
        "schneidet das Firmenlogo ab",
      );

      // (b) DIE GEGENRICHTUNG: dieselbe Rollfläche, nur breit genug.
      await seite.evaluate(SETZE_ROLLFLAECHE, { rahmen: RAHMEN, fehlend: -20 });
      const weit = await liesSicht();
      const urteilWeit = beurteileSicht(weit);
      const kastenWeit = logoKnoten(weit);
      console.log(
        `${KENNUNG_3616} · L10 · ${START_BREITE}px · Gegenrichtung · Schnittfläche ${kastenWeit.innen.links.toFixed(2)} … ${kastenWeit.innen.rechts.toFixed(2)} px · ` +
          `Urteil: ${urteilWeit.sichtbar ? "sichtbar" : urteilWeit.gruende.join(" · ")}`,
      );
      expect(
        urteilWeit.sichtbar,
        `${START_BREITE}px: ein rollbarer Vorfahr, der NICHTS abschneidet, wurde abgelehnt: ${urteilWeit.gruende.join(" · ")}`,
      ).toBe(true);
    } finally {
      await seite.evaluate<boolean>(NIMM_ROLLFLAECHE_ZURUECK);
    }
    // UND DER EINGRIFF IST ZURÜCKGENOMMEN: derselbe Kasten ist wieder sichtbar.
    verlangeSichtbar(START_BREITE, await liesSicht());
  }, 180_000);
});

// ================================================================================================
// L9 — OHNE FIRMEN-CI ÄNDERT SICH NICHTS. Der Beleg, dass die Regeln nur dort wirken, wo sie sollen.
// ================================================================================================
//
// Er steht ZULETZT, weil er als einziger Block die CI ausschaltet — und er schaltet sie am Ende
// wieder ein. Die 900-px-Zahl dieses Falls ist zugleich die Begründung der Spanne: dort bleiben
// schon OHNE Firmen-CI nur rund 16 px bis zur Fensterkante.
describe("JOB 3582 · L9 · ohne Firmen-CI ist die Zeile unverändert", () => {
  it("L9 · 390/760/900 px ohne CI: kein Logokasten, nichts ausserhalb, kein Überschuss", async () => {
    const app = stand.app;
    if (!app) {
      throw new Error("keine App an der Bühne");
    }
    try {
      await schalteCi(app, bearer, false);
      for (const breite of [390, 760, 900] as const) {
        // Auch hier RUHIG (JOB 3616): dieser Fall sichert bei 900 px zu, dass nichts ausserhalb des
        // Fensters steht — eine solche Aussage über einen Zwischenstand wäre eine Zufallszahl.
        const m = await messeRuhig(breite);
        const logo = await liesLogoBefund(stand);
        protokolliere("L9 ohne CI", breite, m, logo);
        expect(logo.logoDa, `${breite}px: ohne Firmen-CI steht trotzdem ein Logokasten da`).toBe(
          false,
        );
        expect(
          draussen(m),
          `${breite}px: ohne Firmen-CI steht etwas ausserhalb des Fensters`,
        ).toBeLessThanOrEqual(1);
        expect(
          ueberschuss(m),
          `${breite}px: ohne Firmen-CI läuft das Kopfband über`,
        ).toBeLessThanOrEqual(1);
      }
    } finally {
      await schalteCi(app, bearer, true);
    }
  }, 180_000);
});
