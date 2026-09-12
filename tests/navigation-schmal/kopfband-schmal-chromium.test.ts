// ================================================================================================
// JOB 3525 · LIEFERUNG 3 — „KEIN LAYOUTBRUCH" WIRD GEMESSEN, NICHT ERZÄHLT.
// ================================================================================================
//
// Die Schwesterdatei `kopfband-schmal.test.tsx` sagt, WAS im Baum steht. Sie kann nicht sagen, ob
// es PASST: jsdom hat keine Layout-Maschine, jede Pixelzahl daraus wäre erfunden — die Lehre aus
// JOB 3337 Runde 7, wo ein gemounteter Fall die ABSICHT (`scrollIntoView` wurde gerufen) für die
// WIRKUNG hielt und der Befund erst im Browser sichtbar wurde. Diese Datei misst deshalb die
// GEBAUTE Anwendung (`apps/web/dist`) in Chromium, an denselben Breiten, an denen der Auftrag seine
// Zusage macht.
//
// (Die Nachbardatei jenes Jobs unter `tests/design/` wird hier bewusst NICHT beim Namen genannt:
// ihr Dateiname trägt ein Wort, auf das eine der sechs Inhaltsachsen des Klara-Regressionsinventars
// anspringt — eine blosse Nennung im Fliesstext zöge diese Kopfbandmessung in jede Klara-Regression,
// mit der sie nichts zu tun hat. Der Sachverhalt steht oben, der Job ist genannt, nichts geht
// verloren. Nachgewiesen: `tests/app/klara-regressionsinventar.test.ts`, Fall K2, wurde an dieser
// Datei rot, solange der Dateiname hier stand.)
//
// WAS GEMESSEN WIRD, je Breite:
//   L1  die Kopfbandhöhe ist exakt 56 px — der Wert aus dem Mockup, unverändert
//   L2  nichts bricht um: JEDES Bedienelement des Kopfbands liegt vollständig INNERHALB des
//       Kopfbands (kein zweiter Zeilenumbruch nach unten)
//   L3  nichts läuft über: `scrollWidth` des Kopfbands übersteigt seine `clientWidth` nicht
//   L4  nichts überlappt: die Elemente stehen der Reihe nach nebeneinander, ohne einander zu
//       schneiden — der Fall, den ein reiner „ist da"-Test nie fände
//
// UND DIE ZUSAGE DES AUFTRAGS, an der Breite, für die sie gebaut ist:
//   B1  760 px (die untere Kante des Bands, der ENGSTE Fall): „Gehe zu …" steht sichtbar im
//       Fenster, nicht angeschnitten — und KEIN Navigationspunkt steht daneben (JOB 3605)
//   B2  390 px: der Menü-Knopf trägt ein Wort, das der Browser wirklich ZEICHNET (`innerText` —
//       nicht `textContent`, das auch Verborgenes trüge)
//   B3  1280 px: kein Menü-Knopf, die volle Punktreihe — die breite Ansicht ist unberührt
//
// NACHGEFÜHRT JOB 3605 (11.09.2026, Pedis Vorgabe über Codex, Nachricht 0bd3a41e): B1 verlangte bis
// dahin, dass „Meine Entwürfe" bei 760 px IM KOPFBAND steht. Genau das hat Pedi als Sonderstellung
// beanstandet („normaler Teil der gesamten Navigation, keine Sonderstellung / kein immer sichtbarer
// Sonderknopf"). Der Fall ist umgedreht, nicht gestrichen: er misst jetzt, dass dort KEIN Punkt
// steht — in Chromium, am gezeichneten Baum. Die Zeile ist dadurch KÜRZER geworden; L1–L4 bleiben
// unverändert und beissen weiter.
//
// 800 px UND 1000 px SIND NEU in der Breitenliste — §5 des Auftrags JOB 3605 verlangt sie
// ausdrücklich. 800 liegt mitten im Band und war bisher nur in jsdom gemessen; 1000 liegt in der
// BREITEN Bauform und steht deshalb, wie 900, unter derselben benannten Ausnahme (`STRENG`).
//
// UND SEIT JOB 3587 WIRD DIESELBE ZEILE IN DREI SPRACHEN GEMESSEN (Fälle S0–S4, unten):
//   S0  die Voraussetzung: der Sprachschritt hat den Zustand am Rückkehrpunkt selbst belegt,
//       `<html lang>` trägt die Sprache an jeder Breite UND ein sichtbares Wort der Zeile ist
//       nachweislich ein anderes als auf Deutsch — sonst misst der Lauf still weiter Deutsch
//   S1  dieselben vier Achsen wie L1–L4, je Sprache und Breite
//   S2  die Prüfmenge selbst: jede zugesagte Kombination Sprache × Breite wurde wirklich gefahren
//   S3  der VERGLEICH: englisch und niederländisch sind an keiner Breite schlechter als deutsch
//   S4  die zwei Stellen, an denen dieser Vergleich AUSFÄLLT — ausgemessen, benannt und gepinnt
//
// WAS DIE MESSUNG GEFUNDEN HAT (11.09.2026, freier Raum in px, Schriften geladen):
//
//        390     600     760     768     899     900            1280
//   de    57,8   267,8   168,8   176,8   307,8   0,0 (passt)     70,8
//   en    57,8   267,8   225,8   233,8   364,8   0,0 (passt)    164,8
//   nl    57,8   267,8   172,8   180,8   311,8   0,0 · 65 px ÜBER   16,8
//
//   · Auf dem BAND, um das es Pedi ging (760–899 px), trägt jede der drei Sprachen. Englisch hat
//     dort mehr Luft als Deutsch, Niederländisch ebenfalls — die alte Rechnung „Deutsch ist der
//     längste Fall" stimmt für dieses Band, sie war nur nie gemessen.
//   · ZWEI BEFUNDE, beide in der BREITEN Bauform und beide NICHT behoben (die Ursache liegt in
//     `shell/Kopfband.tsx`/`shell/Logo.tsx`, ausserhalb der Zielpfade von JOB 3587):
//     bei 900 px läuft die niederländische Zeile um 65 px über — dort hat auch Deutsch mit 0,0 px
//     keinerlei Reserve; bei 1280 px bleiben ihr nur 16,8 statt 70,8 px. Sie stehen unten in
//     `ZEILE_BEFUND`/`VERGLEICH_BEFUND`, werden in S4 Kasten für Kasten ausgemessen und sind
//     gepinnt: wer sie behebt, macht S4 rot und führt sie nach.
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · BIS JOB 3587 STAND HIER EINE RECHNUNG STATT EINER MESSUNG, wörtlich: „Gemessen wird DEUTSCH.
//     Das ist der bindende Fall: ‚Meine Entwürfe' und ‚Gehe zu …' sind länger als ‚My drafts' und
//     ‚Go to …', die englische Zeile passt also erst recht." Über Niederländisch sagte der Satz
//     nichts — und für DIESE Sprache trug er nachweislich nicht: gezählt in Zeichen ist die
//     niederländische Punktreihe LÄNGER als die deutsche (57 zu 49: „Vastleggen", „Controleren",
//     „Bibliotheek"). Zeichen sind aber keine Pixel; entschieden hat es die Messung unten, nicht
//     die Zählung. Der Satz ist damit abgelöst, nicht ergänzt.
//   · Gemessen wird hier OHNE Firmen-CI. MIT ihr misst seit JOB 3571 der Schwesterlauf
//     `kopfband-ci-chromium.test.ts` dieselben Breiten mit demselben Werkzeug.
//     Was OFFEN BLEIBT: die KOMBINATION Sprache × Firmen-CI. Diese Datei misst drei Sprachen ohne
//     CI, die Schwesterdatei eine Sprache mit CI; ob das Firmenlogo in der längeren
//     niederländischen Zeile noch trägt, ist auf keiner der beiden Seiten gemessen. Das ist der
//     benannte Rest von JOB 3587 und ausdrücklich keine Rechnung mehr.
//   · Eine Instanz je Datei (Kopf von `tests/design/h6-chromium.ts`); die Breiten werden an
//     DERSELBEN Seite durchgefahren.
//   · Bei 900 px — der schmalsten Breite der BREITEN Bauform — werden L3/L4 gemessen und
//     ausgegeben, aber NICHT zugesichert. Die Begründung steht bei `STRENG` weiter unten; kurz:
//     das ist der Bestand von JOB 3060, den §5.3 dieses Auftrags ausdrücklich unberührt lässt.
//
// DAS MESSWERKZEUG SELBST WOHNT SEIT JOB 3571 NEBENAN (`kopfband-messung.ts`) und wird von beiden
// Läufen importiert — eine zweite Kopie hiesse zwei Wahrheiten über dieselbe Zeile. Was hier bleibt,
// ist die ZUSAGE dieses Jobs: die Breitenliste, `STRENG` und der Wortlaut der Fälle.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  NARROW_QUERY,
  SCHMAL_GEHEZU_QUERY,
  erwartetePunkte,
} from "../chr-navigation-sprachen/zusage-quelle";
import { type SprachLage, type Stand, fn, setzeSprache, starte } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";
import {
  type Bereitschaft,
  type Messung,
  STRENG_ALLES,
  type Zusage,
  freierRaum,
  messe as messeZeile,
  nurGemessen,
  pruefeZeile as pruefeZeileMit,
  seiteRoh,
} from "./kopfband-messung";

const HOEHE = 800;
/** Die Kennung, unter der die gemessenen Zahlen von JOB 3525 im Lauf stehen. */
const KENNUNG = "JOB 3525";
/** Die Kennung der Sprachmessung (JOB 3587) — jede ihrer Zahlen steht unter ihr im Lauf. */
const KENNUNG_SPRACHEN = "JOB 3587";
/** Die Startbreite ist die engste des oberen schmalen Bands — dort entscheidet sich die Schwelle. */
const START_BREITE = 760;
/** Der Anker, an dem jede Messung dieser Datei hängt. */
const KOPFBAND = 'header[data-testid="kopfband"]';

/**
 * DIE BREITEN, die diese Datei fährt — eine Liste, zwei Verbraucher.
 *
 * Bis JOB 3587 stand sie als Literal in der `for`-Schleife von L. Sie steht jetzt hier, weil die
 * Sprachmessung DIESELBEN Breiten fahren muss und nicht eine eigene, zweite Liste: eine zweite
 * Liste wäre am Tag ihrer Entstehung gleich und beim nächsten Umbau verschieden. Der Wächter
 * `tests/chr-navigation-sprachen/sprachweg-waechter.test.ts` liest genau diese Liste.
 */
const BREITEN = [390, 600, 760, 768, 800, 899, 900, 1000, 1280] as const;

/** Die Sprachen, die dieser Lauf zusagt (`apps/web/src/lib/htmlLang.ts`, `ERLAUBTE_SPRACHEN`). */
const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

let stand: Stand;

beforeAll(async () => {
  stand = await starte("/start", KOPFBAND, START_BREITE, HOEHE);
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium(
      "tests/navigation-schmal/kopfband-schmal-chromium.test.ts",
      stand?.browser,
    );
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

// ================================================================================================
// JOB 3587 · DIE VORAUSSETZUNG JEDER BREITENMESSUNG: DIE SCHRIFT MUSS DA SEIN.
// ================================================================================================
//
// GEMESSEN, NICHT VORSORGLICH. Die erste Messreihe dieses Jobs fand zwischen zwei Läufen einen
// Unterschied von 10 px am selben Kasten derselben Sprache — die Wortmarke KLARWERK war einmal
// 82,2 px und einmal 92,2 px breit. Die Diagnose steht im Lauf und ist eindeutig:
// `document.fonts.status` war beim Messen „loading". Die Seite rechnet dann mit der ERSATZSCHRIFT,
// und jede daraus gewonnene Pixelzahl ist ein Zufallswert — ein Vergleich zwischen zwei Sprachen
// misst dann die Ladereihenfolge der Schriften und nicht die Sprache.
//
// DESHALB WARTET JEDE MESSUNG DIESER DATEI auf den ZUSTAND „Schriften geladen", bevor sie liest.
// Der Warteschritt ist der vorhandene der Vorrichtung (`Bereitschaft` in `kopfband-messung.ts`,
// von JOB 3571 für das Firmenlogo gebaut) — kein zweiter Weg, nur eine zweite Voraussetzung.
const SCHRIFTEN_STEHEN: Bereitschaft = {
  pruefung: fn("() => !!document.fonts && document.fonts.status === 'loaded'"),
  was: "die Schriften der Seite sind geladen (sonst misst die Zeile in der Ersatzschrift)",
};

/** Die Seite auf `breite` stellen, `/start` neu aufbauen und messen. */
async function messe(breite: number): Promise<Messung> {
  return messeZeile(stand, breite, HOEHE, SCHRIFTEN_STEHEN);
}

// ================================================================================================
// WELCHE BREITEN STRENG GEMESSEN WERDEN — und die eine, die es NICHT wird.
// ================================================================================================
//
// L1 (Höhe) und L2 (kein Umbruch) gelten überall: sie sagen, dass die Zeile EINE Zeile bleibt, und
// das ist an jeder Breite die Zusage des Auftrags.
//
// L3 (kein Überlauf) und L4 (keine Überlappung) werden auf den SCHMALEN Breiten und auf 1280 px
// streng gehalten — das sind die Breiten, die dieser Auftrag baut, plus die Zielbildbreite.
//
// 900 px IST AUSGENOMMEN, und das ist eine bewusste, benannte Entscheidung statt einer stillen
// Lücke: 900 ist die SCHMALSTE Breite, auf der die BREITE Bauform gilt (`NARROW_QUERY` endet bei
// 899). Dort steht die volle Punktreihe, das 260-px-Suchfeld, „Gehe zu …", Zahnrad und Konto in
// einer Zeile; ob das restlos passt, hat JOB 3060 mit der Wahl der Schwelle entschieden, nicht
// dieser Auftrag. §5.3 verlangt hier ausdrücklich, dass sich an der breiten Ansicht NICHTS ändert —
// eine Zusicherung, die den Bestand von JOB 3060 unter der Kennung von JOB 3525 misst, wäre eine
// fremde Aussage: sie könnte diesen Job rot machen für etwas, das er weder verursacht noch
// verändert hat. Gemessen wird die Enge trotzdem, sie steht als Zahl im Lauf (`console.log`
// unten) — verschwiegen wird nichts, nur nicht behauptet.
//
// 1000 px IST AUS DEMSELBEN GRUND AUSGENOMMEN (JOB 3605, §5): auch das ist die breite Bauform von
// JOB 3060, nur eine Handbreit weiter. Gemessen wird sie, weil Pedis Auftrag sie nennt; zugesichert
// wird sie nicht, weil ihr Platzbedarf diesem Job nicht gehört und JOB 3605 an ihr nichts ändert.
const STRENG = new Set([390, 600, 760, 800, 768, 899, 1280]);

/** L1–L4 in einem Stück: die vier Aussagen gehören zusammen, sie beschreiben EINE Zeile. */
function pruefeZeile(m: Messung, breite: number): void {
  pruefeZeileMit(
    m,
    breite,
    STRENG.has(breite) ? STRENG_ALLES : nurGemessen("breite Bauform, JOB 3060"),
    KENNUNG,
  );
}

describe("JOB 3525 · L · die Kopfbandzeile trägt auf jeder Breite", () => {
  for (const breite of BREITEN) {
    it(`${breite} px: 56 px hoch, kein Umbruch${STRENG.has(breite) ? ", kein Überlauf, keine Überlappung" : " (Überlauf gemessen, nicht zugesichert)"}`, async () => {
      const m = await messe(breite);
      pruefeZeile(m, breite);
    }, 90_000);
  }
});

describe("JOB 3525 · B · die gesuchten Wege stehen da, wo der Auftrag sie verlangt", () => {
  // B1 fährt seit JOB 3605 das GANZE Band ab (760, 800, 899) statt nur seine untere Kante. Die
  // Kante bleibt der engste Fall und damit der wichtigste; die zwei anderen Breiten nennt §5 des
  // Auftrags ausdrücklich, und eine Zusage über ein Band, die nur an einem Rand gemessen ist,
  // schweigt über seine Mitte.
  for (const breite of [760, 800, 899]) {
    it(`B1 · ${breite} px: „Gehe zu …“ steht sichtbar, und KEIN Punkt steht bevorzugt daneben`, async () => {
      const m = await messe(breite);
      pruefeZeile(m, breite);
      // DIE ZUSAGE VON JOB 3605, in Chromium am gezeichneten Baum: kein Navigationspunkt oben.
      expect(
        m.punkte,
        `${breite}px: im Kopfband steht ein bevorzugter Punkt (${m.punkte.join(", ")})`,
      ).toEqual([]);
      expect(m.entwuerfeText, `${breite}px: „Meine Entwürfe“ wird oben noch gezeichnet`).toBe("");
      // GEZEICHNET, nicht nur im Baum: `innerText` ist leer, wenn der Browser nichts malt.
      expect(m.geheZuText, `${breite}px: „Gehe zu …“ steht nicht im Kopfband`).toContain("Gehe zu");
      expect(m.geheZuText, `${breite}px: das Kürzel fehlt`).toContain("⌘K");
      // Und der Menü-Knopf steht daneben — die Punkte bleiben über ihn erreichbar. DASS sie es
      // wirklich sind, misst `kein-sonderpunkt-schmal.test.tsx` (N2/N3); hier geht es um die Zeile.
      expect(m.menueText, `${breite}px: der Menü-Knopf fehlt`).toBe("Menü");
    }, 90_000);
  }

  it("B2 · 390 px: der Menü-Knopf trägt ein WORT, das der Browser zeichnet", async () => {
    const m = await messe(390);
    pruefeZeile(m, 390);
    expect(m.menueText, "auf 390px zeichnet der Browser am Menü-Knopf kein Wort").toBe("Menü");
    expect(m.punkte, "auf 390px stehen Punkte oben").toEqual([]);
  });

  it("B3 · 1280 px: kein Menü-Knopf, die volle Punktreihe, die Suche — unberührt", async () => {
    const m = await messe(1280);
    pruefeZeile(m, 1280);
    expect(m.menueText, "breit steht ein Menü-Knopf im Kopfband").toBe("");
    expect(m.punkte).toEqual([
      "start",
      "fragen",
      "bibliothek",
      "erfassen",
      "entwuerfe",
      "validierung",
    ]);
    expect(
      m.kaesten.map((k) => k.name),
      "das Suchfeld fehlt breit",
    ).toContain("suche");
  });
});

// ================================================================================================
// JOB 3587 · S · DIESELBE ZEILE, IN DREI SPRACHEN GEMESSEN.
// ================================================================================================
//
// WAS DIE ZAHLEN SOLLEN. Die Lieferung dieses Abschnitts sind nicht die Häkchen, sondern die
// GEMESSENEN Zahlen im Lauf: für jede Sprache und jede Breite steht dort, wie viel freier Raum die
// Zeile noch hat und ob sie überläuft. Vorher stand an dieser Stelle eine Zeichenzählung.
//
// ERHOBEN WIRD EINMAL, VERGLICHEN WIRD DANACH. Alle 27 Kombinationen werden in EINEM Durchgang an
// DERSELBEN Seite gemessen (`beforeAll` unten) und gemerkt. Das ist nicht Sparsamkeit, sondern die
// Voraussetzung von S3: ein Vergleich zwischen zwei Sprachen trägt nur, wenn beide Werte am selben
// Stand entstanden sind — der rechte Rand der Zeile misst den Kontobestand mit, und der wächst
// zwischen zwei Bühnenaufbauten.
//
// ZUGESICHERT WIRD DER VERGLEICH, NICHT DIE ABSOLUTE ZAHL. Jede heute gepinnte Pixelzahl wäre
// falsch, sobald sich die Breite des Logokastens ändert (JOB 3582 baut gerade daran,
// `shell/Logo.tsx`); die Aussage „nicht schlechter als auf Deutsch" gilt vorher wie nachher.
// Absolute Zahlen stehen deshalb im Lauf, nicht in einer Zusicherung.
//
// DIE PFLICHT KOMMT AUS DER ZUSAGE DES PRODUKTS, NICHT AUS DEM GEZEICHNETEN BAUM — die Lehre aus
// JOB 3571 R1 wörtlich: ein Wächter, den der bewachte Fehler abschalten kann, ist keiner. Welche
// Punkte an einer Breite stehen MÜSSEN, beantwortet `chr-navigation-sprachen/zusage-quelle.ts` aus
// den zwei Medienabfragen des Produkts, ausgewertet von derselben `matchMedia`-Maschine des
// Chromium, der die Seite zeichnet.

/** Der Spaltenabstand, der zum Bau gehört und keine Reserve ist (`shell/Kopfband.tsx`). */
const FUGE_SCHMAL = 20;
const FUGE_BREIT = 36;

/** Was an dieser Breite in dieser Sprache gemessen wurde — samt der Lage, in der es gemessen wurde. */
interface Erhebung {
  m: Messung;
  /** `<html lang>` am Zeitpunkt der Messung — der Beleg, dass wirklich diese Sprache stand. */
  lang: string;
  /** Sagt `NARROW_QUERY` an dieser Breite die schmale Bauform zu? */
  narrow: boolean;
  /**
   * Sagt `SCHMAL_GEHEZU_QUERY` an dieser Breite das obere schmale Band zu?
   *
   * Seit JOB 3605 sagt dieser Wert nichts mehr über PUNKTE aus (die zweite, schmale Auswahl ist
   * ersatzlos fort), sondern nur noch darüber, ob „Gehe zu …" oben steht — deshalb heisst er nicht
   * mehr `punkteSchmal`. Die Begründung im Produkt: `shell/Kopfband.tsx:20-26`.
   */
  geheZuSchmal: boolean;
  /** Der Schriftschnitt der Wortmarke beim Messen — die Diagnose der ersten Messreihe (s. u.). */
  marke: string;
}

/** In der Seite: die angewandte Sprache und die zwei Zusagen, an der STEHENDEN Breite ausgewertet. */
const LAGE = fn(`([schmal, narrow]) => {
  const marke = document.querySelector('.kw-kopfband-marke');
  const stil = marke ? getComputedStyle(marke) : null;
  return {
    lang: document.documentElement.lang,
    narrow: window.matchMedia(narrow).matches,
    geheZuSchmal: window.matchMedia(schmal).matches,
    marke: stil === null
      ? "keine Wortmarke"
      : stil.fontWeight + "/" + stil.fontSize + "/" + stil.fontFamily.split(",")[0] + " · Schriften " + (document.fonts ? document.fonts.status : "unbekannt"),
  };
}`);

const erhoben = new Map<string, Erhebung>();
/** Was WIRKLICH gefahren wurde — die Gegenmenge zur Zusage, gezählt in S2. */
const gefahren: string[] = [];
/**
 * Was der Sprachschritt selbst zurückgemeldet hat, am RÜCKKEHRPUNKT gelesen.
 *
 * Der Unterschied zu `erhoben` ist der ganze Zweck dieser Karte: `erhoben` entsteht NACH einem
 * weiteren Seitenaufbau (`messe(...)` lädt `/start` neu), und dieser Aufbau wendet die Sprachwahl
 * seinerseits an. Ein `setzeSprache`, das gar nicht auf den Zustand wartet, wäre an `erhoben`
 * unsichtbar — genau das hat BEN an Runde 1 gemessen (Gegenprobe A). Diese Karte trägt deshalb die
 * Lage VOR jedem weiteren Aufbau; S0 urteilt über sie.
 */
const bestaetigt = new Map<Sprache, SprachLage>();

const kombination = (sprache: Sprache, breite: number): string => `${sprache}/${breite}`;

function hole(sprache: Sprache, breite: number): Erhebung {
  const e = erhoben.get(kombination(sprache, breite));
  if (!e) {
    throw new Error(
      `${kombination(sprache, breite)} wurde nicht erhoben — die Erhebung ist unvollständig`,
    );
  }
  return e;
}

/** Der Abstand, der an dieser Lage zum Bau gehört (schmal 20 px, breit 36 px `gap-9`). */
const fuge = (e: Erhebung): number => (e.narrow ? FUGE_SCHMAL : FUGE_BREIT);

// ================================================================================================
// DIE BEFUNDE — WO EINE SPRACHE TRÄGT, WAS DEUTSCH NICHT TRÄGT, ODER UMGEKEHRT.
// ================================================================================================
//
// Beide Karten sind am 11.09.2026 durch die Messung selbst gefüllt worden und nicht vorsorglich:
// ein Eintrag heisst „hier ist die Zusage schwächer, und zwar aus DIESEM gemessenen Grund". Ein
// grüner Lauf, der einen solchen Befund verschweigt, wäre eine Falschaussage (Auftrag §5.7).
// Behoben wird ein Befund hier NICHT: seine Ursache läge in `shell/Kopfband.tsx` oder
// `shell/Logo.tsx`, beide ausserhalb der Zielpfade dieses Auftrags.

/** Breiten, an denen eine Sprache die drei engen Achsen nicht hält — mit gemessenem Grund. */
const ZEILE_BEFUND: ReadonlyMap<string, string> = new Map<string, string>([
  [
    "nl/900",
    "BEFUND (gemessen 11.09.2026 mit geladenen Schriften): die niederländische Zeile läuft in der BREITEN Bauform bei 900 px um 65 px über — scrollWidth 965 / clientWidth 900, wo die deutsche mit 900/900 genau aufgeht. Die Punkte stehen trotzdem alle da, nichts bricht um, nichts überlappt; welcher Punkt den Zuwachs trägt, steht in S4",
  ],
]);

/** Breiten, an denen der Vergleich gegen Deutsch ausfällt — mit gemessenem Grund. */
const VERGLEICH_BEFUND: ReadonlyMap<string, string> = new Map<string, string>([
  [
    "nl/900",
    "BEFUND (gemessen 11.09.2026): 65 px Überschuss, wo Deutsch mit 0 px genau aufgeht. Die breite Bauform hat bei 900 px KEINE Reserve — auch die deutsche Zeile geht dort auf den Pixel auf; jede längere Sprache läuft damit über. Die Kante ist der Bestand von JOB 3060, den §10 dieses Auftrags unberührt lässt",
  ],
  [
    "nl/1280",
    "BEFUND (gemessen 11.09.2026): 54 px weniger freier Raum als auf Deutsch (70,8 → 16,8 px) — die längere niederländische Punktreihe. Die Zeile trägt: kein Überlauf, nichts angeschnitten",
  ],
]);

/**
 * Was an dieser Breite in dieser Sprache zugesichert wird.
 *
 * Die schwächere Aussage steht immer genau an der Achse, an der sie hingehört: Höhe und Umbruch
 * prüft `pruefeZeile` ohnehin überall, und die ÜBERLAPPUNG bleibt auch an den ungesicherten
 * Breiten zugesichert — dass eine Zeile zu breit ist, heisst nicht, dass ihre Elemente einander
 * schneiden, und das sind für einen Menschen zwei verschiedene Fehler (dieselbe Auftrennung wie in
 * `kopfband-ci-chromium.test.ts`, `TROTZ_BEFUND`).
 */
function zusageFuer(sprache: Sprache, breite: number): Zusage {
  const befund = ZEILE_BEFUND.get(kombination(sprache, breite));
  if (befund !== undefined) {
    return { ueberlauf: false, fenster: false, ueberlappung: true, grund: befund };
  }
  // Dieselbe Ausnahme wie bei L (`STRENG`): 900 ist der Bestand von JOB 3060, 1000 ist dieselbe
  // breite Bauform „eine Handbreit weiter" (JOB 3605, §5) — beide bleiben hier ungesichert.
  if (!STRENG.has(breite)) {
    return {
      ueberlauf: false,
      fenster: false,
      ueberlappung: true,
      grund: "breite Bauform, JOB 3060 — §10 dieses Auftrags lässt sie ausdrücklich unberührt",
    };
  }
  return STRENG_ALLES;
}

/**
 * Die Punkte, die die ZUSAGE an dieser Breite vorsieht, gegen die gezeichnete Zeile — und der Name
 * dessen, was fehlt oder zu viel ist. Ein Name statt zweier Listen: wer den Fall rot sieht, soll
 * lesen können, WELCHER Punkt fort ist, nicht zwei Aufzählungen vergleichen müssen.
 *
 * SEIT JOB 3605 TRÄGT DIE ZWEITE HÄLFTE DIE LAST (Nachführung JOB 3587 R4). Die Zusage lautet auf
 * jeder schmalen Breite „oben steht GENAU KEIN Navigationspunkt" (Pedi, 11.09.2026: keine
 * Sonderstellung; Begründung in `zusage-quelle.ts`). Damit fängt `fehlend` schmal nichts mehr — und
 * `zuviel` alles: ein wiedergekehrter Sonderpunkt ist der Rückfall, um den es Pedi ging. Breit
 * bleibt es umgekehrt, dort verlangt die Zusage die volle Punktreihe und `fehlend` greift.
 * Dass „schmal leer" nicht heimlich „nichts zu prüfen" bedeutet, hält `zusage-quelle.ts` mit
 * `belegeAbwesenheit` fest: kehrt die Auswahl im Produkt zurück, bricht dieser Lauf ab.
 */
function pruefePunkte(e: Erhebung, lage: string): void {
  const erwartet = erwartetePunkte(e.narrow);
  const fehlend = erwartet.filter((p) => !e.m.punkte.includes(p));
  expect(
    fehlend,
    `${lage}: die Zusage („${e.narrow ? NARROW_QUERY : "breite Bauform"}") verlangt hier den Punkt „${fehlend.join('", „')}" — im gezeichneten Kopfband steht er nicht`,
  ).toEqual([]);
  const zuviel = e.m.punkte.filter((p) => !erwartet.includes(p));
  const schmalZusatz = e.narrow
    ? ` — schmal (Band „${e.geheZuSchmal ? SCHMAL_GEHEZU_QUERY : NARROW_QUERY}") gehört seit JOB 3605 KEIN Navigationspunkt nach oben, sondern jeder ins beschriftete Menü`
    : "";
  expect(
    zuviel,
    `${lage}: im Kopfband steht der Punkt „${zuviel.join('", „')}", den die Zusage hier nicht vorsieht${schmalZusatz}`,
  ).toEqual([]);
  // Und was gezeichnet ist, trägt auch ein Wort: `innerText` ist leer, wenn der Browser nichts malt.
  if (erwartet.includes("entwuerfe")) {
    expect(e.m.entwuerfeText, `${lage}: der Punkt „entwuerfe" ist leer`).not.toBe("");
  }
  // Der Menü-Knopf gehört zur schmalen Bauform — und nur zu ihr (`shell/Kopfband.tsx:169`).
  if (e.narrow) {
    expect(e.m.menueText, `${lage}: der beschriftete Menü-Knopf fehlt`).not.toBe("");
  } else {
    expect(e.m.menueText, `${lage}: breit steht ein Menü-Knopf im Kopfband`).toBe("");
  }
  // „Gehe zu …" entfällt genau auf dem UNTEREN schmalen Band (`nurMenue`, `Kopfband.tsx:118`).
  const nurMenue = e.narrow && !e.geheZuSchmal;
  if (nurMenue) {
    expect(e.m.geheZuText, `${lage}: „Gehe zu …" steht auf dem unteren Band trotzdem oben`).toBe(
      "",
    );
  } else {
    // Das Kürzel ist keine Übersetzung, es ist ein Zeichen — es steht in jeder Sprache gleich da.
    expect(e.m.geheZuText, `${lage}: „Gehe zu …" fehlt (oder ohne sein Kürzel)`).toContain("⌘K");
  }
}

describe("JOB 3587 · S · die schmale Kopfbandzeile in de, en und nl", () => {
  beforeAll(async () => {
    expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
    const seite = seiteRoh(stand);
    for (const sprache of SPRACHEN) {
      // Auch „de" wird AUSDRÜCKLICH gesetzt: der Vergleichswert von S3 soll denselben Weg genommen
      // haben wie die zwei anderen Sprachen, sonst verglichen wir zwei verschiedene Verfahren.
      // Die zurückgegebene Lage wird SOFORT gemerkt — sie ist die einzige Angabe, die noch vor
      // jedem weiteren Seitenaufbau entstanden ist (s. `bestaetigt` oben).
      bestaetigt.set(sprache, await setzeSprache(stand, sprache, "/start", KOPFBAND));
      for (const breite of BREITEN) {
        const m = await messe(breite);
        const lage = await seite.evaluate<Omit<Erhebung, "m">>(LAGE, [
          SCHMAL_GEHEZU_QUERY,
          NARROW_QUERY,
        ]);
        const e: Erhebung = { m, ...lage };
        erhoben.set(kombination(sprache, breite), e);
        gefahren.push(kombination(sprache, breite));
        const markeKasten = m.kaesten.find((k) => k.name === "marke");
        console.log(
          `${KENNUNG_SPRACHEN} · ${sprache} · ${breite}px · lang=${lage.lang} · scrollWidth ${m.scrollBreite} / clientWidth ${m.clientBreite} · ` +
            `freier Raum ${freierRaum(m, fuge(e)).toFixed(1)} px · Punkte [${m.punkte.join(", ")}] · ` +
            `Menü „${m.menueText}" · Entwürfe „${m.entwuerfeText}" · Gehe zu „${m.geheZuText}" · ` +
            `Wortmarke ${markeKasten === undefined ? "—" : (markeKasten.rechts - markeKasten.links).toFixed(1)} px, ${lage.marke}`,
        );
      }
    }
    // Zurück auf die Vorgabe des Produkts: was nach dieser Erhebung noch misst, misst wieder
    // Deutsch — eine fremde Sprache, die im Speicher stehen bliebe, wäre eine stille Erblast.
    await setzeSprache(stand, "de", "/start", KOPFBAND);
  }, 900_000);

  // ==============================================================================================
  // S0 — DIE VORAUSSETZUNG WIRD SELBST GEMESSEN, SONST MISST DER LAUF STILL DEUTSCH.
  // ==============================================================================================
  //
  // Ein Lauf, der „auf Niederländisch" behauptet, während still Deutsch stand, wäre grün und
  // wertlos — der gefährlichste Zustand (Vorbild und Begründung: `kopfband-ci-chromium.test.ts`,
  // Fall CI0). DREI Belege, alle im selben Lauf am selben Stand gewonnen und keiner gepinnt:
  //   · der SPRACHSCHRITT SELBST hat den Zustand abgewartet und meldet ihn zurück — gelesen VOR
  //     jedem weiteren Seitenaufbau. Ohne diesen Beleg prüfte S0 nur das Ergebnis des nächsten
  //     Aufbaus, und ein Schritt, der gar nicht wartet, käme damit durch (BENs Gegenprobe A an
  //     Runde 1). Dass das Warten selbst trägt, messen die Fälle in
  //     `tests/chr-navigation-sprachen/sprachschritt-ausgaenge.test.ts` (A1–A8) an einer Seite, die
  //     die Sprache absichtlich verzögert, gar nicht oder fehlerhaft anwendet.
  //   · das PRODUKT sagt selbst, dass es die Sprache spricht (`<html lang>`, `lib/htmlLang.ts`),
  //     und zwar an JEDER gefahrenen Breite, nicht nur an einer;
  //   · ein SICHTBARES Wort der Zeile ist ein anderes als das deutsche. Der deutsche Wert kommt
  //     aus der Erhebung oben, nicht aus `i18n.ts`: ein Sollwert aus derselben Laufzeitquelle wie
  //     der Istwert vergleicht die Quelle mit sich selbst und ist immer grün.
  for (const sprache of SPRACHEN.filter((s) => s !== "de")) {
    it(`S0 · ${sprache}: die Seite spricht die Sprache wirklich — und man sieht es der Zeile an`, () => {
      const lage = bestaetigt.get(sprache);
      const lageDe = bestaetigt.get("de");
      expect(lage, `${sprache}: der Sprachschritt hat keine Lage zurückgemeldet`).toBeDefined();
      expect(lageDe, "für Deutsch hat der Sprachschritt keine Lage zurückgemeldet").toBeDefined();
      if (lage === undefined || lageDe === undefined) {
        throw new Error("unerreichbar");
      }
      console.log(
        `${KENNUNG_SPRACHEN} · S0 · ${sprache} · Rückkehrpunkt des Sprachschritts: lang=${lage.lang} nach ${lage.versuche} Blicken / ${lage.wartedauer} ms · Kopfband „${lage.text.slice(0, 60)}"`,
      );
      expect(
        lage.lang,
        `${sprache}: der Sprachschritt kam zurück, während die Seite noch „${lage.lang}" sprach — gewartet wurde nicht auf den Zustand`,
      ).toBe(sprache);
      expect(
        lage.text,
        `${sprache}: am Rückkehrpunkt zeichnete das Kopfband kein Wort — dann ist über die Sprache der ZEILE nichts gesagt`,
      ).not.toBe("");
      expect(
        lage.text,
        `${sprache}: das Kopfband zeigte am Rückkehrpunkt wörtlich dasselbe wie auf Deutsch („${lageDe.text.slice(0, 60)}") — die Umstellung hat die Zeile nicht erreicht`,
      ).not.toBe(lageDe.text);
      for (const breite of BREITEN) {
        const e = hole(sprache, breite);
        expect(
          e.lang,
          `${sprache} bei ${breite}px: erwartet <html lang="${sprache}">, angewandt "${e.lang}" — gemessen wurde damit eine andere Sprache`,
        ).toBe(sprache);
      }
      const deutsch = hole("de", START_BREITE).m;
      const fremd = hole(sprache, START_BREITE).m;
      // WELCHE WORTE HIER STEHEN DÜRFEN, HAT JOB 3605 ENTSCHIEDEN (nachgeführt JOB 3587 R4).
      // Bis dahin stand hier „Meine Entwürfe" — der Punkt, der auf diesem Band allein neben dem
      // Logo stand. Pedi hat genau das als Sonderstellung beanstandet, JOB 3605 hat ihn ersatzlos
      // ins Menü zurückgeholt (`shell/KopfbandPunkte.tsx:188-215`). Bei `START_BREITE` (760 px)
      // zeichnet der Browser ihn seitdem NICHT mehr, `entwuerfeText` ist dort leer — der Beleg lief
      // ins Leere und machte S0 rot, ohne dass an der Sprachmessung etwas falsch war.
      // Gewählt sind deshalb die zwei Worte, die auf DIESEM Band nachweislich stehen und die die
      // Zusage des Produkts dort auch verlangt (`pruefePunkte`: Menü-Knopf schmal, „Gehe zu …" auf
      // dem oberen Band). „Gehe zu …" trägt die Last, denn es unterscheidet sich in allen drei
      // Sprachen deutlich („Gehe zu …" / „Go to …" / „Ga naar …"); der Menü-Knopf steht daneben,
      // weil er in `en`/`nl` zwar gleich lautet („Menu"), gegen das deutsche „Menü" aber trägt.
      const worte = [
        { was: "Menü-Knopf", de: deutsch.menueText, fremd: fremd.menueText },
        { was: "Gehe zu …", de: deutsch.geheZuText, fremd: fremd.geheZuText },
      ];
      const gegenueber = worte.map((w) => `${w.was}: „${w.de}" → „${w.fremd}"`).join(" · ");
      console.log(`${KENNUNG_SPRACHEN} · S0 · ${sprache} bei ${START_BREITE}px · ${gegenueber}`);
      for (const w of worte) {
        expect(w.fremd, `${sprache}: „${w.was}" ist gar nicht gezeichnet`).not.toBe("");
      }
      const anders = worte.filter((w) => w.de !== w.fremd);
      expect(
        anders.length,
        `${sprache}: kein sichtbares Wort der Zeile unterscheidet sich vom deutschen (${worte
          .map((w) => `${w.was} „${w.fremd}"`)
          .join(" · ")}) — die Umstellung hat die Fläche nicht erreicht`,
      ).toBeGreaterThan(0);
    });
  }

  // ==============================================================================================
  // S1 — DIE VIER ACHSEN VON L1–L4, JE SPRACHE UND BREITE.
  // ==============================================================================================
  for (const sprache of SPRACHEN) {
    for (const breite of BREITEN) {
      const zusage = zusageFuer(sprache, breite);
      it(`S1 · ${sprache} / ${breite} px: 56 px hoch, kein Umbruch, keine Überlappung${zusage.grund === undefined ? ", kein Überlauf" : " (Überlauf gemessen, nicht zugesichert)"}`, () => {
        const e = hole(sprache, breite);
        pruefeZeileMit(e.m, breite, zusage, `${KENNUNG_SPRACHEN} · ${sprache}`);
        pruefePunkte(e, `${sprache} bei ${breite}px`);
      });
    }
  }

  // ==============================================================================================
  // S2 — DIE PRÜFMENGE SELBST. Eine still ausgelassene Sprache darf nicht als grüner Lauf durchgehen.
  // ==============================================================================================
  //
  // Die naheliegende Halbheit dieses Auftrags wäre gewesen, nur `en` zu messen (die kürzere Sprache,
  // die bequem grün wird) und `nl` mit demselben Überschlag zu überspringen, der schon die erste
  // Lücke war. Dieser Fall zählt deshalb, was WIRKLICH gefahren wurde, gegen die zugesagte Liste —
  // dieselbe Bauart wie der Mengen-Pin von JOB 3576 (Fall 11).
  it("S2 · jede zugesagte Kombination Sprache × Breite wurde wirklich gefahren", () => {
    const zugesagt = SPRACHEN.flatMap((s) => BREITEN.map((b) => kombination(s, b)));
    expect([...gefahren].sort(), "die gefahrene Prüfmenge weicht von der zugesagten ab").toEqual(
      [...zugesagt].sort(),
    );
    expect(erhoben.size, "eine Kombination wurde zweimal gefahren oder überschrieben").toBe(
      zugesagt.length,
    );
    console.log(
      `${KENNUNG_SPRACHEN} · S2 · ${zugesagt.length} Kombinationen gefahren (${SPRACHEN.join(", ")} × ${BREITEN.join(", ")} px)`,
    );
  });

  // ==============================================================================================
  // S3 — DER VERGLEICH: ist die fremdsprachige Zeile schlechter dran als die deutsche?
  // ==============================================================================================
  //
  // ZWEI ZAHLEN, weil sie zwei verschiedene Dinge sagen: der ÜBERSCHUSS (`scrollWidth` über
  // `clientWidth`) sagt, OB es nicht passt; der FREIE RAUM sagt, wie viel Luft noch da ist —
  // `scrollWidth === clientWidth` heisst nur „es passt", nicht „um wie viel".
  for (const sprache of SPRACHEN.filter((s) => s !== "de")) {
    for (const breite of BREITEN) {
      const befund = VERGLEICH_BEFUND.get(kombination(sprache, breite));
      it(`S3 · ${sprache} / ${breite} px: freier Raum und Überschuss${befund === undefined ? " nicht schlechter als auf Deutsch" : " — gemessen, NICHT zugesichert"}`, () => {
        const d = hole("de", breite);
        const f = hole(sprache, breite);
        const raumDe = freierRaum(d.m, fuge(d));
        const raumF = freierRaum(f.m, fuge(f));
        const ueberDe = d.m.scrollBreite - d.m.clientBreite;
        const ueberF = f.m.scrollBreite - f.m.clientBreite;
        console.log(
          `${KENNUNG_SPRACHEN} · S3 · ${sprache} / ${breite}px · freier Raum de ${raumDe.toFixed(1)} px → ${sprache} ${raumF.toFixed(1)} px · ` +
            `Überschuss de ${ueberDe} px → ${sprache} ${ueberF} px${befund === undefined ? "" : ` (nicht zugesichert: ${befund})`}`,
        );
        if (befund !== undefined) {
          return;
        }
        expect(
          ueberF,
          `${sprache} bei ${breite}px: die Zeile läuft weiter über als auf Deutsch (de ${ueberDe} px, ${sprache} ${ueberF} px)`,
        ).toBeLessThanOrEqual(ueberDe + 1);
        expect(
          raumF,
          `${sprache} bei ${breite}px: es bleibt weniger freier Raum als auf Deutsch (de ${raumDe.toFixed(1)} px, ${sprache} ${raumF.toFixed(1)} px)`,
        ).toBeGreaterThanOrEqual(raumDe - 1);
      });
    }
  }

  // ==============================================================================================
  // S4 — DER BEFUND WIRD AUSGEMESSEN, KASTEN FÜR KASTEN. Und er wird gepinnt.
  // ==============================================================================================
  //
  // Eine nicht zugesicherte Achse OHNE Messung wäre genau die stille Lücke, gegen die dieser ganze
  // Auftrag steht. Also: für jede Kombination, die in S3 ausgesetzt ist, steht hier im Lauf, WELCHER
  // Kasten der Zeile den Unterschied trägt — mit seiner Breite auf Deutsch, in der anderen Sprache
  // und der Differenz.
  //
  // DIESER FALL WIRD AUCH ROT, WENN JEMAND DEN BEFUND BEHEBT, und das ist Absicht: dann ist die
  // Aussage „hier ist die fremdsprachige Zeile schlechter dran" nicht mehr wahr, und wer sie behoben
  // hat, führt den Pin nach. Dieselbe Bauart wie CI5 in der Schwesterdatei; ein Befund, den niemand
  // nachführen muss, verschwindet stillschweigend aus dem Gedächtnis.
  for (const [schluessel, grund] of VERGLEICH_BEFUND) {
    const [spracheRoh, breiteRoh] = schluessel.split("/");
    const sprache = spracheRoh as Sprache;
    const breite = Number(breiteRoh);
    it(`S4 · ${schluessel} px: welcher Kasten der Zeile den Unterschied trägt`, () => {
      const d = hole("de", breite);
      const f = hole(sprache, breite);
      const namen = [...new Set([...d.m.kaesten, ...f.m.kaesten].map((k) => k.name))];
      const kaesten = namen.map((name) => {
        const breiteVon = (m: Messung): number => {
          const k = m.kaesten.find((x) => x.name === name);
          return k === undefined ? 0 : k.rechts - k.links;
        };
        const aufDeutsch = breiteVon(d.m);
        const inSprache = breiteVon(f.m);
        const delta = inSprache - aufDeutsch;
        return `${name} ${aufDeutsch.toFixed(1)} → ${inSprache.toFixed(1)} px (${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`;
      });
      const raumDe = freierRaum(d.m, fuge(d));
      const raumF = freierRaum(f.m, fuge(f));
      const ueberDe = d.m.scrollBreite - d.m.clientBreite;
      const ueberF = f.m.scrollBreite - f.m.clientBreite;
      console.log(
        `${KENNUNG_SPRACHEN} · S4 · ${schluessel}px · ${grund} · je Kasten: ${kaesten.join(" · ")}`,
      );
      expect(
        raumF < raumDe - 1 || ueberF > ueberDe + 1,
        `${schluessel}px: der Befund ist nicht mehr messbar (freier Raum de ${raumDe.toFixed(1)} px → ${raumF.toFixed(1)} px, Überschuss de ${ueberDe} px → ${ueberF} px) — er ist behoben, dieser Pin gehört nachgeführt`,
      ).toBe(true);
    });
  }
});
