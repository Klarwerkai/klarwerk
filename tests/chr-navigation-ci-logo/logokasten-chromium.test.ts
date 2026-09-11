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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Stand, fn, starte } from "../design/h6-chromium";
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

const HOEHE = 800;
/** Die Startbreite ist die engste gemessene — dort war der Befund am sichtbarsten. */
const START_BREITE = 390;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3582";

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
 * DIE RUHEMESSUNG — JEDE Zahl dieser Datei stammt aus einer Zeile, die sich nicht mehr ändert.
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
 * Zähler am Punkt „Prüfen" kommt erst mit seiner Abfrage (`app/useNavBadges.ts`) und macht den Punkt
 * dann rund 15 px breiter; der aktive Punkt trägt `font-semibold` (`shell/KopfbandPunkte.tsx`). Wer
 * misst, bevor das steht, misst einen Zwischenstand — und einen, den kein Mensch je sieht.
 *
 * DIE ANTWORT IST NICHT EINE GRÖSSERE TOLERANZ. Eine Toleranz, die 15 px schluckt, schluckt auch
 * einen echten Layoutfehler von 15 px — und genau solche Fehler soll diese Datei finden. Gemessen
 * wird stattdessen erst, wenn die Zeile SICH NICHT MEHR ÄNDERT: zwei aufeinanderfolgende Messungen
 * im Abstand von 250 ms müssen in Namen und Breiten aller Kästen übereinstimmen. Kommt sie nicht
 * zur Ruhe, bricht der Fall ab — mit Grund, statt mit einer Zufallszahl.
 *
 * WAS DAS FÜR DIE ZAHLEN BEDEUTET: sie sind der ENDZUSTAND, also der engste. Bei 900 px sind das
 * 899,2 px bei 900 px Fensterbreite — 0,8 px Luft. Diese 0,8 px sind der Bestand von JOB 3060 und
 * gelten dort auch ohne jede Firmen-CI; dieser Job sorgt dafür, dass die Firmen-CI sie nicht
 * aufbraucht.
 */
const pause = (ms: number): Promise<void> => new Promise((fertig) => setTimeout(fertig, ms));

/** Zwei Messungen gelten als gleich, wenn jeder Kasten denselben Namen und dieselbe Breite hat. */
function zeileGleich(a: Messung, b: Messung): boolean {
  if (a.kaesten.length !== b.kaesten.length) {
    return false;
  }
  return a.kaesten.every((k, i) => {
    const anderer = b.kaesten[i];
    return (
      anderer !== undefined &&
      anderer.name === k.name &&
      Math.abs(anderer.rechts - anderer.links - (k.rechts - k.links)) < 0.01
    );
  });
}

/** An der STEHENDEN Seite messen, bis sich zwei Messungen in Folge gleichen. */
async function beruhige(breite: number, erste: Messung): Promise<Messung> {
  let vorher = erste;
  for (let versuch = 0; versuch < 12; versuch++) {
    await pause(250);
    const jetzt = await messeStehend(stand);
    if (zeileGleich(vorher, jetzt)) {
      return jetzt;
    }
    vorher = jetzt;
  }
  throw new Error(
    `bei ${breite}px kam die Kopfbandzeile in 3 s nicht zur Ruhe — zwei Messungen in Folge waren nie gleich`,
  );
}

/** Seite an der Breite aufbauen und erst messen, wenn die Zeile steht. */
async function messeRuhig(breite: number, bereit?: Bereitschaft): Promise<Messung> {
  return await beruhige(breite, await messe(stand, breite, HOEHE, bereit));
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
 * Messen MIT eingeschalteter Firmen-CI an einer beliebigen Breite — und dabei die ZUSAGE prüfen.
 *
 * Der Ablauf ist bewusst zweistufig: erst fragt Chromium seine eigene `matchMedia`, ob das Produkt
 * an dieser Breite überhaupt ein Logo zusagt; sagt es eines zu, wird zusätzlich auf das gezeichnete,
 * geladene Bild gewartet — sonst hinge jede Zahl davon ab, ob die Markenantwort rechtzeitig kam.
 * Sagt es keines zu, muss auch keines dastehen. In beiden Fällen wird RUHIG gemessen (siehe oben).
 */
async function messeMitZusage(
  breite: number,
): Promise<{ m: Messung; logo: LogoBefund; zugesagt: boolean; grenze: number }> {
  const seite = seiteRoh(stand);
  // Die Breite muss stehen, bevor `matchMedia` etwas Gültiges sagen kann — deshalb erst eine
  // Messung an der Breite, dann die Frage nach der Zusage, dann die eigentliche Ruhemessung.
  await messe(stand, breite, HOEHE);
  const ohnePlatz = await seite.evaluate<boolean>(PASST, OHNE_PLATZ);
  const zugesagt = !ohnePlatz;
  const { grenze } = await geltendeGrenze();
  const m = await messeRuhig(breite, zugesagt ? LOGO_STEHT : undefined);
  const logo = await liesLogoBefund(stand);
  // BEIDE RICHTUNGEN BEISSEN. Ein fehlendes Logo an einer zugesagten Breite ebenso wie ein Logo an
  // einer Breite, an der die Zeile es nicht trägt.
  expect(
    logo.logoGezeichnet,
    zugesagt
      ? `${breite}px: „${OHNE_PLATZ}" sagt hier ein Firmenlogo zu — im gezeichneten Kopfband steht keines`
      : `${breite}px: „${OHNE_PLATZ}" sagt hier KEIN Firmenlogo zu — im gezeichneten Kopfband steht trotzdem eines`,
  ).toBe(zugesagt);
  if (zugesagt) {
    expect(logo.bildGeladen, `${breite}px: das Firmenlogo ist ein leeres Bild`).toBe(true);
    expect(logo.logoBreite, `${breite}px: das Firmenlogo ist 0 px breit`).toBeGreaterThan(0);
  }
  return { m, logo, zugesagt, grenze };
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
    const ohne = await messe(stand, START_BREITE, HOEHE);
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
    const ohneDeckel = await beruhige(BREITE_BAUFORM, await messeStehend(stand));
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
// gezeichnet, geladen und grösser als null.
describe("JOB 3582 · L5 · KLARWERK bleibt stehen, das Firmenlogo bleibt erkennbar", () => {
  for (const breite of ALLE) {
    it(`L5 · ${breite} px mit Firmen-CI: Wortmarke gezeichnet, Firmenlogo wie zugesagt`, async () => {
      const { logo, zugesagt } = await messeMitZusage(breite);
      // `markeText` ist `innerText` — er ist leer, wenn der Browser nichts malt. `textContent`
      // trüge auch Verborgenes und wäre hier die schwächere Aussage.
      expect(logo.markeText, `${breite}px: die Wortmarke zeichnet kein Wort`).toContain("KLARWERK");
      if (!zugesagt) {
        return;
      }
      expect(logo.bildGeladen, `${breite}px: das Firmenlogo ist ein leeres Bild`).toBe(true);
      expect(logo.bildBreite, `${breite}px: das Firmenlogo ist 0 px breit`).toBeGreaterThan(0);
      expect(
        logo.bildHoehe,
        `${breite}px: das Firmenlogo ist 0 px hoch — eingepasst heisst nicht zusammengedrückt`,
      ).toBeGreaterThan(0);
    }, 120_000);
  }
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
      const m = await beruhige(breite, await messeStehend(stand));
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
        const m = await messe(stand, breite, HOEHE);
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
