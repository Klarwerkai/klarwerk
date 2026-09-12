// ================================================================================================
// JOB 3641 · CHR-NAVIGATION-SCHMAL REST — 1000 px MIT FIRMEN-CI: EINE WAHRHEIT STATT DREI.
// ================================================================================================
//
// DER ANLASS. Über die Breite 1000 px mit aktiver Firmen-CI standen im Bestand DREI Aussagen, und
// sie waren nicht miteinander vereinbar:
//
//   1. `tests/navigation-schmal/kopfband-ci-chromium.test.ts` sichert 1000 px seit JOB 3605 zu
//      (`ZUGESICHERT`, Fall CI1 mit `STRENG_ALLES`) — der Fall ist grün.
//   2. Derselbe Job hat an derselben Breite einen ÜBERSCHUSS gemessen und in seiner Rückgabe
//      festgehalten: „Bei 1000 px MIT Firmen-CI läuft es um 10 px über"
//      (`archiv/3605/runde-1/RUECKGABE.md:59`, `scrollWidth 1010 / clientWidth 1000`).
//   3. `apps/web/src/shell/Logo.tsx` behauptet für dieselbe Breite Reserve („rund 31 px").
//
// Eine grüne Zusage über einen gemessenen Überschuss ist der gefährlichste Zustand, den diese
// Maschine kennt. Diese Datei entscheidet die Frage, wie sie zu entscheiden ist: durch MESSUNG am
// heutigen Stand, an BEIDEN Achsen, mit und ohne Firmen-CI, im selben Lauf.
//
// ------------------------------------------------------------------------------------------------
// DIE ZWEI ACHSEN — sie sagen zwei verschiedene Dinge, und ein Mensch sieht beide
// ------------------------------------------------------------------------------------------------
//   (a) DER RECHTESTE GEZEICHNETE KASTEN gegen `window.innerWidth`. Das ist der Konto-Kreis, der
//       rechts über die Fensterkante ragt — die Zahl, die Pedi sieht.
//   (b) `scrollWidth` gegen `clientWidth` DES DOKUMENTS. Das ist der waagerechte Rollbalken, und
//       das ist die Achse, die bis zu diesem Job KEIN Werkzeug dieser Messfamilie erhoben hat:
//       `MESSUNG` in `tests/navigation-schmal/kopfband-messung.ts` misst `scrollWidth`/`clientWidth`
//       AM `<header>`, nicht am Dokument. Ob das eine Lücke IST, ist hier zu messen und nicht zu
//       raten — deshalb steht die Dokumentachse neben der Bandachse und nicht an ihrer Stelle.
//
// KEIN ZWEITER MESSWEG (Auftrag §5.7). Die Kästenlage, der Logobefund, der freie Raum und der
// Schalter für die Firmen-CI kommen ALLE aus dem gemeinsamen Werkzeug
// (`tests/navigation-schmal/kopfband-messung.ts`); die Firmen-CI wird über den echten Adminweg
// geschaltet (`PUT /api/admin/branding`), nicht über eine zweite Attrappe. Neu ist hier genau eine
// Frage: die Achse des Dokuments. Sie steht deshalb als einzige eigene Browserfunktion da.
//
// ------------------------------------------------------------------------------------------------
// WANN GEMESSEN WIRD — und warum weder ein Zeitgeber noch ein Abrufzähler das entscheidet
// ------------------------------------------------------------------------------------------------
// Die Kopfbandzeile ist beim ersten Zeichnen noch nicht fertig: der Zähler am Punkt „Prüfen" kommt
// erst mit der Antwort seiner Abfrage (`apps/web/src/app/useNavBadges.ts` → `useValidationBoard`)
// und macht den Punkt dann messbar breiter. Wer davor misst, misst einen Zwischenstand — und zwar
// einen SCHMALEREN: eine Messung davor kann „passt" sagen, wo es nicht passt.
//
// DIE ANTWORT IST NICHT EIN WARTEN AUF ZEIT. Zwei gleiche Stichproben im Abstand von 250 ms
// beweisen keinen Endzustand — das ist Codex' Befund an JOB 3616 R1 (11.09.2026, `LEHREN.md`:
// „die Ruhemessung der Firmen-CI beweist keinen Endzustand", Korrekturpflicht 1: „Antwortankunft
// im Browser nachweisen, AUCH BEI LEEREM BOARD und ohne gezeichneten Prüfpunkt"). Diese Datei baut
// deshalb keine zweite Ruhemessung.
//
// UND SIE IST AUCH NICHT DER ABRUFZÄHLER DER BÜHNE. In Runde 1 stand genau das hier: gewartet wurde
// auf eine Zunahme von `Stand.abrufe`. Das war falsch, und BEN hat es in Runde 1 mit einer eigenen
// Chromium-Gegenprobe widerlegt (11.09.2026): jener Zähler steigt in der Weiche
// (`tests/design/h6-chromium.ts:293`), BEVOR `app.inject` gefragt und `route.fulfill` ausgeliefert
// hat. Eine fünf Sekunden zurückgehaltene Board-Antwort gab die Bereitschaft trotzdem frei
// („Bereitschaft freigegeben, 1 Board-Antworten noch vor Auslieferung blockiert"), und K1 war grün.
// EIN ABGESETZTER ABRUF IST KEINE ANGEKOMMENE ANTWORT.
//
// SEIT RUNDE 2 HÄNGT DIE BEREITSCHAFT AM EMPFANG IM BROWSER, gemessen an der Stelle, an der der
// Empfang wirklich stattfindet: vor jedem Seitenskript wird ein Vermerkschreiber eingesetzt
// (`addInitScript`), der `window.fetch` einen Zwilling umlegt und jede Antwort erst dann einträgt,
// wenn ihr Rumpf in DIESEM Dokument vollständig gelesen ist (`response.clone().text()`). Der
// Vermerk wohnt im Dokument; jeder Seitenaufbau beginnt mit einem leeren Vermerk, ein Eintrag aus
// einem früheren Aufbau kann also nicht mitzählen.
//
// Die Bereitschaft verlangt danach DREI Dinge, jedes einzeln (`warteAufEndbreite`):
//   · Der Browser hat in DIESEM Aufbau eine Antwort auf `/api/validation/board` EMPFANGEN — Rumpf
//     vollständig gelesen, HTTP 200.
//   · Die empfangene Antwort ist dieselbe, die der Server gibt: ihre Länge wird gegen
//     `GET /api/validation/board` an der echten App verglichen.
//   · Der gezeichnete Baum passt zu ihr: bei leerem Board steht KEIN Zähler, bei gefülltem genau
//     einer mit genau dieser Zahl (`.kw-kopfband-zaehler`).
//
// K2 hält diese Bereitschaft dauerhaft an ihrer eigenen Gegenprobe fest: die Board-Antwort wird auf
// dem echten Auslieferungsweg zurückgehalten (`Stand.antworten.vorAuslieferung`, JOB 3130), und der
// Fall zeigt in EINEM Lauf beides — der Abrufzähler steigt, während nichts empfangen ist, die
// Bereitschaft SPERRT in diesem Zustand, und sie öffnet unmittelbar nach der Freigabe.
//
// WAS DAMIT NICHT BEHAUPTET WIRD, weil es die Grenze ist: auf dieser Bühne ist das Board LEER
// (gemessen, Lauf 0a0a3b33…: ein Warten auf einen gezeichneten Zähler lief 30 s in den Abbruch).
// Bei leerem Board ist „kein Zähler" vor und nach dem Empfang DERSELBE Baum — die Zeichnung kann
// den Empfang dort nicht bezeugen, sie kann ihm nur nicht widersprechen. Bewiesen ist deshalb:
// gemessen wird NACH dem Empfang. Nicht bewiesen und nirgends behauptet: dass die Zeile mit einem
// GEZEICHNETEN Zähler an dieser Breite ebenfalls passt — dafür müsste das Board gefüllt sein, und
// sein Bestand gehört nicht diesem Auftrag.
//
// Zusätzlich wird die Zeile als ÜBERSETZT nachgewiesen (der Knopf trägt „Gehe zu …", nicht seinen
// Schlüssel): eine noch nicht geladene Sprachfassung ist die zweite Art, zu früh zu messen.
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · Gemessen wird DEUTSCH und das heute einzige Firmenprofil (`advisor`) — dieselbe Grenze wie in
//     den Schwesterdateien (JOB 3525/3571), von diesem Job weder geschlossen noch verschlechtert.
//   · Gemessen wird die Breite 1000 px. Über 1001–1279 px sagt diese Datei nichts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Stand, fn, starte } from "../design/h6-chromium";
import {
  type LogoBefund,
  type Messung,
  freierRaum,
  liesLogoBefund,
  meldeAn,
  messe,
  messeMitCi,
  messeStehend,
  schalteCi,
  seiteRoh,
} from "../navigation-schmal/kopfband-messung";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const HOEHE = 800;
/** Die Breite, um die es geht: ein halbierter Bildschirm, kein Sonderfall. */
const BREITE = 1000;
/** Die Kennung, unter der die gemessenen Zahlen im Lauf stehen. */
const KENNUNG = "JOB 3641";
/**
 * Die Fuge der BREITEN Bauform (`gap-9` am `<header>`, `shell/Kopfband.tsx`).
 *
 * Sie gehört zum Bau und ist keine Reserve — `freierRaum` zieht sie deshalb ab. Ohne diesen Abzug
 * hiesse „36 px frei" in Wahrheit „nichts frei".
 */
const BREITE_FUGE = 36;

/**
 * DIE ACHSE DES DOKUMENTS — die einzige Frage, die kein vorhandenes Werkzeug beantwortet.
 *
 * `MESSUNG` (gemeinsames Werkzeug) liest `scrollWidth`/`clientWidth` am `<header>`. Das sagt, ob
 * die ZEILE mehr Platz verlangt, als sie hat. Ob die SEITE dadurch einen waagerechten Rollbalken
 * bekommt, ist eine andere Frage — sie hängt am Dokument, und genau sie stellt das
 * Nutzerversprechen dieses Auftrags („kein waagerechter Rollbalken").
 */
interface DokumentAchse {
  scrollBreite: number;
  clientBreite: number;
  koerperScrollBreite: number;
  fensterBreite: number;
}

const DOKUMENT_ACHSE = fn(`() => {
  const w = document.documentElement;
  return {
    scrollBreite: w.scrollWidth,
    clientBreite: w.clientWidth,
    koerperScrollBreite: document.body.scrollWidth,
    fensterBreite: window.innerWidth,
  };
}`);

/**
 * Passt der gezeichnete Zähler zu dem, was der Server über das Prüf-Board sagt?
 *
 * Beide Richtungen beissen: ein fehlender Zähler bei gefülltem Board heisst „die Antwort ist noch
 * nicht gezeichnet", ein stehender Zähler bei leerem Board hiesse, der Baum zeigt etwas, das die
 * Antwort nicht deckt.
 */
const ZAEHLER_PASST = fn(`(erwartet) => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return false;
  const z = [...band.querySelectorAll('.kw-kopfband-zaehler')];
  if (erwartet > 0) return z.length === 1 && (z[0].innerText || '').trim() === String(erwartet);
  return z.length === 0;
}`);

/** Was gerade an Zählern im Kopfband steht — für die Ausgabe, die ein Mensch lesen soll. */
const ZAEHLER_TEXTE = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return [];
  return [...band.querySelectorAll('.kw-kopfband-zaehler')].map((e) => (e.innerText || '').trim());
}`);

/** Der Pfad, den `useValidationBoard` zieht (`api/endpoints.ts`, Basis `/api`). */
const BOARD_PFAD = "/api/validation/board";

// ================================================================================================
// DER EMPFANGSVERMERK — DIE EINZIGE STELLE, AN DER „ANGEKOMMEN" ÜBERHAUPT ABLESBAR IST.
// ================================================================================================
//
// Er wird VOR jedem Seitenskript eingesetzt (`addInitScript`) und legt `window.fetch` einen
// Zwilling um. Eingetragen wird erst, wenn der Rumpf der Antwort in DIESEM Dokument vollständig
// gelesen ist — gelesen wird dafür ein `clone()`, damit die Anwendung ihre eigene Antwort
// unberührt bekommt (ein Rumpf lässt sich nur einmal lesen).
//
// WARUM IM DOKUMENT UND NICHT IM TEST: der Vermerk stirbt mit dem Dokument. Jeder Seitenaufbau
// beginnt deshalb bei null, und kein Eintrag aus einem früheren Aufbau kann eine Bereitschaft
// freigeben, die für den heutigen gilt. Genau daran ist die Bereitschaft der Runde 1 gescheitert:
// ihr Zähler lebte ausserhalb der Seite.
//
// Die Anwendung holt ihre Daten über `fetch` (`apps/web/src/api/client.ts:28`). Käme je ein
// zweiter Weg dazu (XHR), sähe dieser Vermerk ihn NICHT — der Fall wäre dann rot (kein Empfang),
// nie still grün.
const EMPFANGS_VERMERK = `(() => {
  const merk = {};
  window.__kw3641_empfang = merk;
  const echt = window.fetch;
  window.fetch = function (eingabe, init) {
    return echt.call(this, eingabe, init).then((antwort) => {
      let pfad = '';
      try {
        const roh = typeof eingabe === 'string' ? eingabe : ((eingabe && eingabe.url) || '');
        pfad = new URL(roh, window.location.href).pathname;
      } catch (e) { return antwort; }
      if (pfad === '') return antwort;
      let klon = null;
      try { klon = antwort.clone(); } catch (e) { return antwort; }
      klon.text().then((text) => {
        let laenge = -1;
        try { const d = JSON.parse(text); if (Array.isArray(d)) laenge = d.length; } catch (e) {}
        const vorher = merk[pfad];
        merk[pfad] = {
          anzahl: (vorher ? vorher.anzahl : 0) + 1,
          status: antwort.status,
          laenge: laenge,
          zeichen: text.length,
        };
      }, () => {});
      return antwort;
    });
  };
})()`;

/** Was der Browser zu EINEM Pfad in diesem Seitenaufbau wirklich empfangen hat. */
interface Empfang {
  anzahl: number;
  status: number;
  /** Länge des empfangenen JSON-Feldes, oder -1, wenn die Antwort kein Feld war. */
  laenge: number;
  zeichen: number;
}

const EMPFANG_DA = fn(`(pfad) => {
  const m = window.__kw3641_empfang;
  return Boolean(m && m[pfad] && m[pfad].anzahl > 0);
}`);

const EMPFANG_LESEN = fn(`(pfad) => {
  const m = window.__kw3641_empfang;
  return (m && m[pfad]) ? m[pfad] : null;
}`);

let stand: Stand;
let bearer = "";

/**
 * Wie weit der rechteste gemessene Kasten aus dem Fenster ragt (negativ = er steht drinnen).
 *
 * Die drei kleinen Ableitungen aus `Messung` stehen hier lokal, wie sie in
 * `tests/chr-navigation-ci-logo/logokasten-chromium.test.ts` lokal stehen: sie sind KEIN
 * Messwerkzeug (das ist `MESSUNG`), sondern die Lesart dieser Datei auf dessen Ergebnis. Jene Datei
 * gehört bis auf Weiteres JOB 3616 und wird hier ausdrücklich nur gefahren, nicht angefasst (§10).
 */
function draussen(m: Messung): number {
  return Math.max(...m.kaesten.map((k) => k.rechts)) - m.fensterBreite;
}

/** Der Name des rechtesten Kastens — für die Fehlermeldung, die ein Mensch lesen soll. */
function rechtester(m: Messung): string {
  return m.kaesten.reduce((a, b) => (a.rechts >= b.rechts ? a : b)).name;
}

/** Der Überschuss der ZEILE über ihren eigenen Platz — `scrollWidth` minus `clientWidth`. */
function bandUeberschuss(m: Messung): number {
  return m.scrollBreite - m.clientBreite;
}

async function liesDokument(): Promise<DokumentAchse> {
  return await seiteRoh(stand).evaluate<DokumentAchse>(DOKUMENT_ACHSE);
}

/** Wie viele offene Prüfungen der SERVER kennt — die Zahl, gegen die der Baum gemessen wird. */
async function liesBoardLaenge(): Promise<number> {
  const app = stand.app;
  if (!app) {
    throw new Error("keine App an der Bühne");
  }
  const antwort = await app.inject({
    method: "GET",
    url: BOARD_PFAD,
    headers: { authorization: `Bearer ${bearer}` },
  });
  if (antwort.statusCode !== 200) {
    throw new Error(
      `GET ${BOARD_PFAD}: HTTP ${antwort.statusCode} — ${antwort.body.slice(0, 160)}; ohne diese Antwort ist nicht zu sagen, ob die Zeile fertig ist`,
    );
  }
  return (antwort.json() as unknown[]).length;
}

/**
 * Wie oft die WEICHE den Board-Abruf gesehen hat.
 *
 * Diese Zahl steigt VOR `app.inject` und vor `route.fulfill` (`tests/design/h6-chromium.ts:293`).
 * Sie sagt „abgesetzt", nicht „angekommen", und sie trägt deshalb KEINE Bereitschaft mehr — sie
 * steht nur noch in K2, wo sie als das vorgeführt wird, was sie ist.
 */
function boardAbrufe(): number {
  return stand.abrufe.get(BOARD_PFAD) ?? 0;
}

const pause = (ms: number): Promise<void> => new Promise((fertig) => setTimeout(fertig, ms));

/** Warten, bis eine Bedingung ausserhalb der Seite eintritt — oder mit Klartext scheitern. */
async function warteBis(bedingung: () => boolean, grenzeMs: number, was: string): Promise<void> {
  for (let wartete = 0; !bedingung(); wartete += 50) {
    if (wartete >= grenzeMs) {
      throw new Error(`in ${grenzeMs} ms nicht eingetreten: ${was}`);
    }
    await pause(50);
  }
}

/**
 * Ein Tor, vor dem die Weiche wartet und das der Test von aussen öffnet.
 *
 * Der Rückruf eines `Promise` läuft synchron; der Wurf darunter ist trotzdem kein Zierrat, sondern
 * die Stelle, an der der Typ ohne `!` und ohne `any` auskommt.
 */
function tor(): { davor: Promise<void>; oeffnen: () => void } {
  let oeffnen: (() => void) | undefined;
  const davor = new Promise<void>((fertig) => {
    oeffnen = fertig;
  });
  if (!oeffnen) {
    throw new Error("unerreichbar: der Promise-Rückruf läuft synchron");
  }
  return { davor, oeffnen };
}

/** Der Wortlaut, mit dem eine gesperrte Bereitschaft scheitert — K2 prüft ihn wörtlich. */
const SPERRTEXT = `hat der Browser in diesem Seitenaufbau keine Antwort auf ${BOARD_PFAD} empfangen`;

/**
 * Auf den EMPFANG der Board-Antwort in diesem Seitenaufbau warten.
 *
 * Bewusst werfend: eine Messung, die ohne diesen Nachweis „weiterläuft", misst womöglich eine
 * schmalere Zeile als die, über die sie danach etwas behauptet.
 */
async function warteAufBoardEmpfang(breite: number, grenzeMs = 30_000): Promise<Empfang> {
  try {
    await seiteRoh(stand).waitForFunction(EMPFANG_DA, BOARD_PFAD, { timeout: grenzeMs });
  } catch (e) {
    throw new Error(
      `bei ${breite}px ${SPERRTEXT} (${grenzeMs} ms) — der Zähler des Punktes „Prüfen“ kann noch ` +
        `kommen, jede Zahl aus dieser Zeile wäre ein Zwischenstand (${String(e).split("\n")[0]})`,
    );
  }
  const empfang = await seiteRoh(stand).evaluate<Empfang | null>(EMPFANG_LESEN, BOARD_PFAD);
  if (empfang === null) {
    throw new Error(`bei ${breite}px steht kein Empfangsvermerk zu ${BOARD_PFAD} im Dokument`);
  }
  return empfang;
}

/**
 * Die volle Bereitschaft: empfangen, dieselbe Antwort wie der Server, und der Baum passt dazu.
 */
async function warteAufEndbreite(breite: number): Promise<number> {
  const empfang = await warteAufBoardEmpfang(breite);
  expect(
    empfang.status,
    `bei ${breite}px kam ${BOARD_PFAD} mit HTTP ${empfang.status} an — eine Fehlerantwort zeichnet nie einen Zähler, die Zeile bliebe unfertig`,
  ).toBe(200);
  const board = await liesBoardLaenge();
  expect(
    empfang.laenge,
    `bei ${breite}px hat der Browser eine ANDERE Board-Antwort empfangen als der Server gibt (Browser ${empfang.laenge}, Server ${board})`,
  ).toBe(board);
  try {
    await seiteRoh(stand).waitForFunction(ZAEHLER_PASST, board, { timeout: 30_000 });
  } catch (e) {
    throw new Error(
      `bei ${breite}px zeigt das Kopfband die Board-Antwort nicht: der Server nennt ${board} offene ` +
        `Prüfungen, im gezeichneten Baum steht dazu etwas anderes (${String(e)})`,
    );
  }
  return board;
}

/** Die fertige Zeile MIT Firmen-CI: Logo gezeichnet, Board-Antwort empfangen, dann erst gemessen. */
async function messeFertigMitCi(breite: number): Promise<{ m: Messung; logo: LogoBefund }> {
  // Der erste Schritt ist der gemeinsame Griff: er baut die Seite an der Breite auf, wartet auf das
  // gezeichnete und geladene Firmenlogo und prüft die Voraussetzung „die CI wirkt wirklich".
  await messeMitCi(stand, breite, HOEHE);
  await warteAufEndbreite(breite);
  const m = await messeStehend(stand);
  const logo = await liesLogoBefund(stand);
  return { m, logo };
}

function protokolliere(
  fall: string,
  breite: number,
  m: Messung,
  dok: DokumentAchse,
  logo: LogoBefund | null,
): void {
  const logoTeil =
    logo === null || !logo.logoDa
      ? "kein Logokasten"
      : `Logokasten ${logo.logoBreite.toFixed(1)} px, Bild ${logo.bildBreite.toFixed(1)} × ${logo.bildHoehe.toFixed(1)} px ` +
        `(Datei ${logo.bildNaturBreite} × ${logo.bildNaturHoehe}), Wortmarke ${logo.markeBreite.toFixed(1)} px`;
  console.log(
    `${KENNUNG} · ${fall} · ${breite}px · ` +
      `(a) rechtester Kasten „${rechtester(m)}" ${Math.max(...m.kaesten.map((k) => k.rechts)).toFixed(1)} px ` +
      `bei Fensterbreite ${m.fensterBreite} px → ${draussen(m).toFixed(1)} px ausserhalb · ` +
      `(b) Dokument scrollWidth ${dok.scrollBreite} / clientWidth ${dok.clientBreite} → ` +
      `${dok.scrollBreite - dok.clientBreite} px Überschuss (Körper ${dok.koerperScrollBreite} px) · ` +
      `Band scrollWidth ${m.scrollBreite} / clientWidth ${m.clientBreite} → ${bandUeberschuss(m)} px · ` +
      `freier Raum ${freierRaum(m, BREITE_FUGE).toFixed(1)} px (Fuge ${BREITE_FUGE} px abgezogen) · ${logoTeil}`,
  );
  // DIE ZEILE KASTEN FÜR KASTEN. Ohne sie sagte „freier Raum 0,0 px" zwar die Wahrheit, aber nicht,
  // WER den Platz des Logokastens bezahlt — und genau das ist die Frage, die ein Mensch als
  // nächstes stellt. Gemessen, nicht zugesichert: die Zusammensetzung der breiten Bauform gehört
  // JOB 3060 und wird hier nicht neu erhoben (Auftrag §10).
  console.log(
    `${KENNUNG} · ${fall} · ${breite}px · Kästen: ${m.kaesten
      .map((k) => `${k.name} ${(k.rechts - k.links).toFixed(1)} px`)
      .join(" · ")}`,
  );
}

beforeAll(async () => {
  stand = await starte("/start", 'header[data-testid="kopfband"]', BREITE, HOEHE, async (app) => {
    bearer = await meldeAn(app);
    await schalteCi(app, bearer, true);
  });
  expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
  // Der Vermerkschreiber gilt ab dem NÄCHSTEN Seitenaufbau — und jede Messung dieser Datei baut die
  // Seite selbst neu auf (`messe` → `wechsle` → `goto`). Der Aufbau aus `starte` wird deshalb von
  // keinem Fall vermessen; er hat die Bühne nur hochgefahren.
  await seiteRoh(stand).addInitScript(EMPFANGS_VERMERK);
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium(
      "tests/chr-kopfband-1000/kopfband-1000-chromium.test.ts",
      stand?.browser,
    );
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

// ================================================================================================
// K0 — DIE VORAUSSETZUNG UND DER VERGLEICH OHNE CI, BEIDE IM SELBEN LAUF AM SELBEN STAND.
// ================================================================================================
//
// Ein Lauf, der „mit CI" behauptet, während die CI still aus blieb, misst nichts und wäre grün.
// Deshalb wird hier beides gemessen: die Zeile OHNE Firmen-CI (der Vergleich, den Lieferung 1
// ausdrücklich verlangt) und die Zeile MIT — und die CI muss die Wortmarke messbar breiter machen.
describe("JOB 3641 · K0 · die Voraussetzung wird selbst gemessen, nicht geglaubt", () => {
  it(`K0 · ${BREITE} px: ohne und mit Firmen-CI, beide Achsen, am selben Stand`, async () => {
    expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
    const app = stand.app;
    if (!app) {
      throw new Error("keine App an der Bühne");
    }
    console.log(`${KENNUNG} · K0 · Stand des Arbeitsbaums · Chromium ${stand.version}`);

    // AUS → messen. Der Vergleichswert entsteht am SELBEN Stand, in DIESEM Lauf.
    //
    // `finally`: bricht die Messung ohne CI ab, MUSS die CI trotzdem zurückkommen — sonst mässe
    // jeder folgende Fall dieser Datei eine Zeile ohne Firmenlogo und nennte sie „mit CI". Genau
    // das ist im Lauf 0a0a3b33… passiert.
    let ohne: Messung;
    let logoOhne: LogoBefund;
    try {
      await schalteCi(app, bearer, false);
      await messe(stand, BREITE, HOEHE);
      await warteAufEndbreite(BREITE);
      ohne = await messeStehend(stand);
      logoOhne = await liesLogoBefund(stand);
      const dokOhne = await liesDokument();
      protokolliere("K0 ohne CI", BREITE, ohne, dokOhne, logoOhne);
    } finally {
      await schalteCi(app, bearer, true);
    }
    expect(logoOhne.logoGezeichnet, "ausgeschaltet steht trotzdem ein Firmenlogo im Kopfband").toBe(
      false,
    );
    expect(logoOhne.markeBreite, "die Wortmarke wurde ohne CI gar nicht gemessen").toBeGreaterThan(
      0,
    );

    // AN → messen.
    const gestellt = await schalteCi(app, bearer, true);
    expect(gestellt.profil, "der Server hat ein anderes Profil gesetzt").toBe("advisor");
    const { m, logo } = await messeFertigMitCi(BREITE);
    const dok = await liesDokument();
    protokolliere("K0 mit CI", BREITE, m, dok, logo);
    console.log(
      `${KENNUNG} · K0 · Wortmarke ohne CI ${logoOhne.markeBreite.toFixed(1)} px → mit CI ` +
        `${logo.markeBreite.toFixed(1)} px (Zuwachs ${(logo.markeBreite - logoOhne.markeBreite).toFixed(1)} px) · ` +
        `Prüf-Board des Servers: ${await liesBoardLaenge()} offene Prüfungen · ` +
        `Zähler im Kopfband: ${JSON.stringify(await seiteRoh(stand).evaluate<string[]>(ZAEHLER_TEXTE))}`,
    );

    // Die eigentliche Aussage: die CI ist nicht nur „gesetzt", sie WIRKT auf die Breite.
    expect(
      logo.markeBreite,
      `die Wortmarke ist mit CI nicht breiter (ohne ${logoOhne.markeBreite}, mit ${logo.markeBreite})`,
    ).toBeGreaterThan(logoOhne.markeBreite + 1);
  }, 180_000);
});

// ================================================================================================
// K1 — DIE EINE AUSSAGE, DIE NACH DIESEM AUFTRAG ÜBER 1000 px MIT FIRMEN-CI GILT.
// ================================================================================================
//
// Beide Achsen in EINEM Fall, weil sie EINE Zeile beschreiben: kein Kasten ausserhalb des Fensters
// UND kein Überschuss auf der Dokumentachse. Ohne die zweite Achse liesse sich die erste durch
// Wegschneiden „erfüllen"; ohne die erste sagte die zweite nichts über den Konto-Kreis.
describe("JOB 3641 · K1 · bei 1000 px mit Firmen-CI steht das Kopfband restlos im Fenster", () => {
  it(`K1 · ${BREITE} px mit Firmen-CI: nichts ausserhalb, kein waagerechter Rollbalken`, async () => {
    const { m, logo } = await messeFertigMitCi(BREITE);
    const dok = await liesDokument();
    protokolliere("K1", BREITE, m, dok, logo);

    // Die Zeile ist wirklich fertig: sie trägt ihre übersetzten Wörter, nicht ihre Schlüssel.
    expect(m.geheZuText, `${BREITE}px: „Gehe zu …" steht nicht gezeichnet im Kopfband`).toContain(
      "Gehe zu",
    );
    expect(
      m.punkte.length,
      `${BREITE}px: die breite Bauform zeichnet gar keine Punkte`,
    ).toBeGreaterThan(0);

    // (a) DER RECHTESTE GEZEICHNETE KASTEN — das ist der Konto-Kreis, den Pedi sieht.
    expect(
      draussen(m),
      `${BREITE}px: „${rechtester(m)}" steht ${draussen(m).toFixed(1)} px rechts ausserhalb des Fensters`,
    ).toBeLessThanOrEqual(1);
    expect(
      Math.min(...m.kaesten.map((k) => k.links)),
      `${BREITE}px: ein Kasten steht links ausserhalb des Fensters`,
    ).toBeGreaterThanOrEqual(-1);

    // (b) DIE ACHSE DES DOKUMENTS — das ist der waagerechte Rollbalken.
    expect(
      dok.scrollBreite - dok.clientBreite,
      `${BREITE}px: die Seite verlangt mehr Breite, als sie hat (Dokument ${dok.scrollBreite} > ${dok.clientBreite}) — es steht ein waagerechter Rollbalken da`,
    ).toBeLessThanOrEqual(1);

    // Und die Zeile selbst verlangt keinen Platz, den es nicht gibt (die vorhandene Bandachse,
    // dieselbe, die `pruefeZeile`/`STRENG_ALLES` für CI1 · 1000 px prüft).
    expect(
      bandUeberschuss(m),
      `${BREITE}px: das Kopfband läuft über (${m.scrollBreite} > ${m.clientBreite})`,
    ).toBeLessThanOrEqual(1);

    expect(logo.logoGezeichnet, `${BREITE}px: hier steht gar kein Firmenlogo`).toBe(true);
    expect(logo.markeText, `${BREITE}px: die Wortmarke zeichnet kein Wort`).toContain("KLARWERK");
  }, 180_000);
});

// ================================================================================================
// K2 — DIE GEGENPROBE ZUR BEREITSCHAFT SELBST (BENs Korrekturpflicht 1, Runde 1).
// ================================================================================================
//
// K0 und K1 sind nur so viel wert wie die Zusage „gemessen wurde die FERTIGE Zeile". Diese Zusage
// hat in Runde 1 nicht getragen: sie hing am Abrufzähler der Bühne, und der steigt, bevor irgendeine
// Antwort ausgeliefert ist. BEN hat das mit einer zurückgehaltenen Board-Antwort gezeigt — K1 blieb
// grün, obwohl der Browser nichts empfangen hatte.
//
// DIESER FALL HÄLT DEN BEFUND FEST, damit er nicht ein zweites Mal zurückkommen kann. Er hält die
// Board-Antwort auf dem ECHTEN Auslieferungsweg zurück (`Stand.antworten.vorAuslieferung`, JOB 3130
// — dieselbe Weiche, dieselbe App, nur später) und misst in dieser Lage DREI Dinge:
//
//   (1) Der Abrufzähler der Bühne STEIGT — der alte Bereitschaftsbeweis wäre hier freigegeben.
//       Das ist keine Nebenbemerkung, sondern die Aussage: er belegt nichts.
//   (2) Im Dokument steht KEIN Empfangsvermerk, und die Bereitschaft SPERRT mit ihrem Wortlaut.
//   (3) Nach der Freigabe empfängt der Browser, der Baum passt zur Antwort, und die Messung läuft.
//
// (2) ist kein Zeitargument: solange `vorAuslieferung` nicht zurückgekehrt ist, KANN die Antwort den
// Browser nicht erreicht haben. Gemessen wird also nicht „es kam nichts in 4 s", sondern „die
// Bereitschaft hält genau dann, wenn nichts angekommen ist" — und (3) zeigt im selben Lauf, dass
// sie nicht etwa immer hält.
describe("JOB 3641 · K2 · die Bereitschaft hängt am EMPFANG, nicht am abgesetzten Abruf", () => {
  it("K2 · zurückgehaltene Board-Antwort sperrt die Messung, der Empfang gibt sie frei", async () => {
    const { davor, oeffnen } = tor();
    let zurueckgehalten = 0;
    const abrufeVorher = boardAbrufe();
    stand.antworten.vorAuslieferung = async (url, body) => {
      if (url.pathname === BOARD_PFAD) {
        zurueckgehalten += 1;
        await davor;
      }
      return body;
    };
    try {
      // Die Seite baut auf wie in K1 — nur die eine Antwort bleibt unterwegs stehen.
      await messeMitCi(stand, BREITE, HOEHE);

      // (1) Abgesetzt ist der Abruf: der Zähler der Bühne steigt, die Weiche hält die Antwort fest.
      await warteBis(
        () => boardAbrufe() > abrufeVorher,
        30_000,
        `die Seite hat ${BOARD_PFAD} gar nicht abgerufen`,
      );
      expect(
        zurueckgehalten,
        "die Antwort wurde nie zurückgehalten — dann prüft dieser Fall nichts",
      ).toBeGreaterThan(0);

      // (2) Empfangen ist trotzdem nichts, und die Bereitschaft gibt nicht frei.
      const vermerk = await seiteRoh(stand).evaluate<Empfang | null>(EMPFANG_LESEN, BOARD_PFAD);
      expect(
        vermerk,
        `im Dokument steht ein Empfangsvermerk zu ${BOARD_PFAD}, obwohl die Antwort noch in der Weiche hängt: ${JSON.stringify(vermerk)}`,
      ).toBeNull();
      let gesperrt: string | null = null;
      try {
        await warteAufBoardEmpfang(BREITE, 4_000);
      } catch (e) {
        gesperrt = String(e);
      }
      expect(
        gesperrt,
        `die Bereitschaft hat freigegeben, während ${zurueckgehalten} Board-Antwort(en) noch in der Weiche hingen — genau der Befund aus Runde 1`,
      ).not.toBeNull();
      expect(gesperrt ?? "", "die Sperre nennt nicht, was fehlt").toContain(SPERRTEXT);
      console.log(
        `${KENNUNG} · K2 · gesperrt bei ${zurueckgehalten} zurückgehaltenen Board-Antworten · ` +
          `Abrufzähler der Bühne ${abrufeVorher} → ${boardAbrufe()} (er wäre freigegeben) · ` +
          `Wortlaut der Sperre: ${(gesperrt ?? "").split("\n")[0]}`,
      );

      // (3) Freigabe: jetzt empfängt der Browser, der Baum passt dazu, die Messung läuft.
      oeffnen();
      const board = await warteAufEndbreite(BREITE);
      const empfangen = await seiteRoh(stand).evaluate<Empfang | null>(EMPFANG_LESEN, BOARD_PFAD);
      expect(empfangen, "nach der Freigabe steht immer noch kein Empfangsvermerk").not.toBeNull();
      expect(
        empfangen?.anzahl ?? 0,
        "nach der Freigabe ist keine Antwort vollständig gelesen worden",
      ).toBeGreaterThan(0);
      const m = await messeStehend(stand);
      const dok = await liesDokument();
      protokolliere("K2 nach Freigabe", BREITE, m, dok, await liesLogoBefund(stand));
      console.log(
        `${KENNUNG} · K2 · nach der Freigabe empfangen: HTTP ${empfangen?.status}, ` +
          `${empfangen?.laenge} Einträge, ${empfangen?.zeichen} Zeichen · Server nennt ${board} · ` +
          `Zähler im Kopfband: ${JSON.stringify(await seiteRoh(stand).evaluate<string[]>(ZAEHLER_TEXTE))}`,
      );

      // Und die Zeile, die danach gemessen wird, ist dieselbe wie in K1 — die Freigabe hat die
      // Messung nicht nur erlaubt, sie hat sie auch nicht verändert.
      expect(
        draussen(m),
        `${BREITE}px: „${rechtester(m)}" steht nach der Freigabe ${draussen(m).toFixed(1)} px rechts ausserhalb des Fensters`,
      ).toBeLessThanOrEqual(1);
      expect(
        dok.scrollBreite - dok.clientBreite,
        `${BREITE}px: nach der Freigabe steht ein waagerechter Rollbalken da (${dok.scrollBreite} > ${dok.clientBreite})`,
      ).toBeLessThanOrEqual(1);
    } finally {
      // Nichts bleibt hängen: die Weiche ist wieder die gewöhnliche, und kein Abruf wartet mehr.
      oeffnen();
      stand.antworten = {};
    }
  }, 180_000);
});
