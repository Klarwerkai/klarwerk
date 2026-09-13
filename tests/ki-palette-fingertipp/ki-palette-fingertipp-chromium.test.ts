// ================================================================================================
// JOB 3809 · DIE BÜHNE BEKOMMT EINEN FINGER — die KI-Palette, mit einem echten Zeigegerät bedient.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Für die KI-Palette auf `/erfassen` war bis heute ausschliesslich
// belegt, dass ein PROGRAMM sie öffnen und auslösen kann: jeder bestehende Fall geht über
// `element.click()` in der Seite (`tests/ki-freie-anweisung/ki-palette-390px-chromium.test.ts:438`
// und `:1262`). Die Bahn von JOB 3769 hat die Lücke selbst benannt (`jobs/3769/runde-2/
// RUECKGABE.md:34`, Prüfpunkt 6): „kein echtes `pointerdown`/`touchstart` (die Bühne trägt kein
// Zeigegerät und ist kein Zielpfad — geklickt wird über `element.click()`, denselben Weg, auf dem
// auch die Palette aufgeht)". Genau das ist aber die Bedienart des Geräts, für das diese Fläche
// zuletzt zweimal umgebaut wurde.
//
// WAS HIER ANDERS IST ALS IN JEDEM BISHERIGEN FALL. Die Bühne wird mit `zeigegeraet = true`
// aufgebaut (`h3-blatt-buehne.ts`, fünfter Parameter), und jeder Bedienschritt läuft über
// `seite.touchscreen.tap(x, y)` — Chromiums Touch-Emulation, die echte `touchstart`- und
// `pointerdown`-Ereignisse erzeugt. `element.click()` und `dispatchEvent(new MouseEvent(...))`
// kommen in dieser Datei NICHT vor; der einzige `click()`-Aufruf steht im Kalibrierungsfall K und
// dient dort dem Beweis, dass der Ereignisrichter ihn ABLEHNT.
//
// UND DER NACHWEIS IST EIN GERÄTEEREIGNIS, KEINE VERMUTUNG. Die Seite schreibt selbst mit, was bei
// ihr ankommt (`SAMMLER`, über `addInitScript`): Art des Ereignisses, `isTrusted` und `pointerType`.
// Ein Fall ist nur grün, wenn nach dem Tippen `touchstart` UND `pointerdown` gezählt wurden, beide
// vertrauenswürdig und der Zeiger vom Typ `touch`. `element.click()` erzeugt weder ein `touchstart`
// noch ein `pointerdown` und setzt `isTrusted` auf `false` — Fall K führt das vor.
//
// FÄLLE
// T1 · Das Zeigegerät ist wirklich angeschaltet — gemessen an der Seite, nicht am Aufrufargument.
// T2 · Die Palette geht per TIPPEN auf (freie Anweisung und „Ausführen" stehen danach im Dokument).
// T3 · Eine VORLAGE wird per Tippen ausgelöst: die Anfrage geht heraus, die Vorschau steht da.
// T4 · Die FREIE ANWEISUNG wird per Tippen abgeschickt: Feld fokussiert, getippt, Knopf frei, Lauf.
// T5 · Der Finger trifft, was er sieht — Mittelpunkt im Fenster UND `elementFromPoint` am Ziel.
//      Dazu: `MITTE` auf ein Element, das es nicht gibt, liefert `null` und der Griff scheitert laut.
// K  · DIE KALIBRIERUNG: derselbe Weg mit `element.click()` — der Ereignisrichter MUSS ihn ablehnen.
// P  · Die Seite hat während aller Messungen nichts geworfen.
//
// WAS DIESE DATEI AUSDRÜCKLICH NICHT BELEGT (und in der Rückgabe als Prüflücke steht): 320 px, EN
// und NL, echtes Wischen (`swipe`), Mausbedienung — und dass Chromiums Touch-Emulation kein echtes
// Gerät ist. Sie erzeugt die Ereignisse, die ein Gerät erzeugt; sie ist kein Glas und kein Finger.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  type Buehne,
  MITTE,
  ORIGIN,
  type Seite,
  buehneAufbauen,
  fn,
} from "../design/h3-blatt-buehne";

/** Das Fenster dieses Auftrags — dasselbe Handymaß, für das die Fläche umgebaut wurde. */
const FENSTER = { width: 390, height: 844 };

/** Die Wurzel, auf die jede Fahrt wartet — das gemountete Blatt. */
const BLATT = '[data-testid="blatt"]';

/** Der Text im Blatt — ohne ihn ist die KI-Palette gesperrt (`Blatt.tsx:1312`, `hasAssistInput`). */
const INHALT = "Der Kunde hat den Router am Montag übernommen.";
const PFAD = `/erfassen/neu?text=${encodeURIComponent(INHALT)}`;

/** Der Griff des KI-Werkzeugs in der Werkzeugzeile (`Menue.tsx:269`, `Blatt.tsx:2109`). */
const WERKZEUG = '[data-testid="blatt-werkzeug-ki"]';
/** Die geöffnete Palette (`Menue.tsx:282`). */
const PALETTE = '[data-testid="blatt-menue-ki"]';
/**
 * Die Vorschau, die ein ausgelöster Lauf auf DIESER Fläche erzeugt (`Blatt.tsx:2957`).
 *
 * Der Auftrag nennt in §6 T3/T4 `capture.ai.previewTitle` (`AiAssistBox.tsx:127`). Das ist die
 * Vorschau der Box `AiAssistBox` — und die rendert `/erfassen` gar nicht: das Blatt bindet nur den
 * unteren Teil ein (`AiAssistInstructions`, `Blatt.tsx:2140`) und zeigt das Ergebnis in seiner
 * eigenen Karte `blatt-ki-vorschlag`. Gemessen wird deshalb die Karte, die auf dieser Fläche
 * WIRKLICH aufgeht; die Abweichung steht in der Rückgabe.
 */
const VORSCHAU = '[data-testid="blatt-ki-vorschlag"]';

/** Eine gestellte Vorlage. Kurz und ohne Umbruchpunktnot: gemessen wird hier der Finger, nicht das Layout. */
const VORLAGE = {
  id: "f1",
  name: "Übergabe kurz",
  instruction: "Fasse die Übergabe in zwei Sätzen.",
};

/** Die gestellte Antwort des Assist-Laufs — wörtlich wiedererkennbar in der Vorschau. */
const ANTWORT = "Der Router ging am Montag an den Kunden.";

const SKRIPT = {
  // Ohne gestellte Vorlage gibt es im leeren Bestand keinen Vorlagenknopf, auf den ein Finger
  // tippen könnte (T3).
  "GET /api/reasoner/assist-presets": [VORLAGE],
  // Dieselbe Stellung wie in JOB 3584: ein nutzbares Modell, damit die Palette nicht in ihrem
  // zweiten Aufrufer ausgraut.
  "GET /api/reasoner/status": {
    active: true,
    mode: "cloud",
    reachable: "active",
    tasks: { assist: true, structure: true },
  },
  // Die ANTWORT des Servers wird gestellt, nicht das Verhalten des Clients: gemessen wird, was der
  // echte Client daraus macht (die Bühne erlaubt das ausdrücklich, `h3-blatt-buehne.ts:145-158`).
  // Ohne sie hinge T3/T4 an einem Modell, das im hermetischen Betrieb nicht da ist.
  "POST /api/reasoner": { text: ANTWORT, demo: true },
};

// ------------------------------------------------------------------------------------------------
// DER SAMMLER — die Seite schreibt selbst mit, WAS bei ihr ankommt.
// ------------------------------------------------------------------------------------------------
//
// Ohne ihn hiesse „per Tippen bedient" nur „wir haben `tap` gerufen und danach war etwas anders".
// Das wäre genau die Sorte Scheinbeleg, gegen die dieser Auftrag steht: ein `element.click()` hätte
// dieselbe Wirkung und dieselbe grüne Zeile. Mitgeschrieben wird deshalb in der ERFASSUNGSPHASE
// (`capture: true`) am Fenster — dort kommt jedes Ereignis an, auch wenn ein Handler es später
// aufhält —, und zwar mit den drei Angaben, die einen Finger von einem Skript trennen:
//   · `art`        — `touchstart` gibt es bei einem Dokumentklick überhaupt nicht.
//   · `vertrauen`  — `element.click()` erzeugt `isTrusted: false` (HTML-Standard: das Ereignis ist
//                    skriptgemacht). Ein Geräteereignis ist `true`.
//   · `zeigerart`  — `pointerType`, bei Touch-Emulation `touch`, bei einer Maus `mouse`.
const SAMMLER = `(() => {
  const liste = [];
  window.__fingerSammler = {
    liste: liste,
    zuruecksetzen: function () { liste.length = 0; },
  };
  const arten = ['touchstart', 'pointerdown', 'mousedown', 'click'];
  for (let i = 0; i < arten.length; i++) {
    (function (art) {
      window.addEventListener(art, function (e) {
        const z = e.target;
        liste.push({
          art: art,
          vertrauen: e.isTrusted === true,
          zeigerart: typeof e.pointerType === 'string' ? e.pointerType : null,
          ziel: (z && z.getAttribute ? (z.getAttribute('data-finger') || z.getAttribute('data-testid') || '') : '') +
            '<' + (z && z.tagName ? z.tagName : '?') + '>',
        });
      }, true);
    })(arten[i]);
  }
})();`;

interface Ereignis {
  art: string;
  vertrauen: boolean;
  zeigerart: string | null;
  ziel: string;
}

/**
 * In der Seite: liegt der Mittelpunkt wirklich auf dem Stück, das getippt werden soll?
 *
 * `elementFromPoint` beantwortet die Frage, die ein Rechteck allein NICHT beantwortet: ob an dieser
 * Stelle etwas ANDERES obenauf liegt (eine Fläche, ein Überzug, ein Nachbar). Ein Treffer auf einem
 * Nachkommen des Ziels zählt — das ist der Regelfall bei einem Knopf mit Text oder Symbol, und das
 * Ereignis steigt von dort zum Knopf auf. Ein Treffer AUSSERHALB des Ziels zählt nicht: dann hätte
 * der Fall zufällig gearbeitet.
 */
const TREFFER = `([sel, x, y]) => {
  const ziel = document.querySelector(sel);
  if (!ziel) { return { lage: 'KEIN ZIEL', getroffen: '' }; }
  const g = document.elementFromPoint(x, y);
  if (!g) { return { lage: 'NICHTS GETROFFEN', getroffen: '' }; }
  const name = g.tagName + (g.getAttribute('data-testid') ? '#' + g.getAttribute('data-testid') : '') +
    ' „' + (g.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + '"';
  return { lage: g === ziel ? 'ZIEL' : ziel.contains(g) ? 'IM ZIEL' : 'DANEBEN', getroffen: name };
}`;

interface Treffer {
  lage: string;
  getroffen: string;
}

/**
 * In der Seite: EIN Stück der Palette bekommt die Marke `data-finger`, damit ein Selektor es greift.
 *
 * Die Palette führt ihre Stücke ohne eigene Marken (die Griffe aus JOB 3769 sind noch nicht LIVE und
 * dürfen hier nicht vorausgesetzt werden, AUFTRAG §10). Markiert wird deshalb vom Test aus, an
 * denselben Wegen, auf denen JOB 3584 die Stücke schon holt: die Vorlage über ihren sichtbaren
 * Namen, das Feld als `input` der Palette, der Knopf als `button` neben dem Feld
 * (`AiAssistBox.tsx:286-301`). Das ist keine Produktänderung — die Marke lebt nur in dieser
 * laufenden Seite, wie die Griffe `data-k3-deckel`/`data-k4-deckel` der Kalibrierungen von 3584.
 */
const MARKE = `([was, text]) => {
  const alt = document.querySelectorAll('[data-finger]');
  for (let i = 0; i < alt.length; i++) { alt[i].removeAttribute('data-finger'); }
  if (was === 'werkzeug') {
    const w = document.querySelector('[data-testid="blatt-werkzeug-ki"]');
    if (!w) { return 'NICHT GEFUNDEN'; }
    w.setAttribute('data-finger', was);
    return 'MARKIERT';
  }
  const p = document.querySelector('[data-testid="blatt-menue-ki"]');
  if (!p) { return 'KEINE PALETTE'; }
  const feld = p.querySelector('input');
  let el = null;
  if (was === 'vorlage') {
    const k = p.querySelectorAll('button');
    for (let i = 0; i < k.length; i++) {
      if ((k[i].textContent || '').replace(/\\s+/g, ' ').trim() === text) { el = k[i]; break; }
    }
  } else if (was === 'feld') {
    el = feld;
  } else if (was === 'knopf') {
    el = feld && feld.parentElement ? feld.parentElement.querySelector('button') : null;
  }
  if (!el) { return 'NICHT GEFUNDEN'; }
  el.setAttribute('data-finger', was);
  return 'MARKIERT';
}`;

/** Der markierte Griff — ein Selektor, den `MITTE`, `TREFFER` und jede Messung gleichermaßen greifen. */
const GRIFF = "[data-finger]";

/** In der Seite: steht dieser Selektor im Dokument? Einmal geschrieben, von jedem Warten benutzt. */
const IM_DOKUMENT = "(sel) => document.querySelector(sel) !== null";
/** In der Seite: ist der Knopf hinter diesem Selektor gesperrt? (`null`, wenn er gar nicht da ist.) */
const GESPERRT =
  "(sel) => { const k = document.querySelector(sel); return k ? k.disabled === true : null; }";

let b: Buehne | null = null;
/** Jeder ausgehende `POST /api/reasoner` — der Rumpf im Wortlaut, nicht das Aussehen der Fläche. */
const gesendet: { url: string; rumpf: string | null }[] = [];

function buehne(): Buehne {
  const gefunden = b;
  expect(gefunden, "Prüfstand nicht aufgebaut").not.toBeNull();
  // Der Ausfall wird BENANNT und nicht übersprungen: ein übersprungener Prüfstand ist grün und
  // belegt nichts (Lehre JOB 3578 R1, 3573/3581).
  expect((gefunden as Buehne).fehler, "Prüfstand nicht aufgebaut").toBeNull();
  return gefunden as Buehne;
}

function seite(): Seite {
  return buehne().seite;
}

/** Das Blatt MIT Inhalt fahren — über den echten Deep-Link des Produkts. */
async function blattFahren(): Promise<Seite> {
  const s = seite();
  await s.goto(`${ORIGIN}${PFAD}`, { waitUntil: "load", timeout: 60_000 });
  await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), BLATT, {
    timeout: 30_000,
  });
  return s;
}

/** Das Stück markieren und sicherstellen, dass die Marke wirklich sitzt. */
async function markieren(was: string, text: string | null, lage: string): Promise<void> {
  const ergebnis = await seite().evaluate<string>(fn(MARKE), [was, text]);
  expect(ergebnis, `${lage}: „${was}" liess sich nicht markieren`).toBe("MARKIERT");
}

interface Punkt {
  x: number;
  y: number;
}

/**
 * HERANROLLEN. Bei 390×844 liegen die freie Eingabe und der Ausführen-Knopf UNTERHALB des Fensters
 * — JOB 3584 hat es nachgemessen (B1b, y≈849 in einem 844 px hohen Fenster) und belegt, dass beide
 * durch senkrechtes Rollen GANZ zu erreichen sind. `tap(x, y)` rechnet in FENSTERkoordinaten: ohne
 * das Heranrollen träfe der Finger eine Stelle, an der das Stück gar nicht liegt. Gerollt wird mit
 * `scrollIntoView` und nicht mit einem Wisch — `swipe` gibt es in dieser Bühne nicht und ist
 * ausdrücklich nicht Teil dieses Auftrags (AUFTRAG §10). Das steht als Prüflücke in der Rückgabe.
 */
async function heranrollen(sel: string): Promise<void> {
  await seite().evaluate(
    fn(
      `(sel) => { const el = document.querySelector(sel); if (el) { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } }`,
    ),
    sel,
  );
}

/** Der Mittelpunkt, geprüft: er ist da, er liegt im Fenster, und dort liegt wirklich das Ziel. */
async function zielpunkt(sel: string, was: string, lage: string): Promise<Punkt> {
  const s = seite();
  await heranrollen(sel);
  const mitte = await s.evaluate<Punkt | null>(fn(MITTE), sel);
  // `MITTE` liefert `null`, wenn das Element fehlt ODER keine Fläche trägt. Beides ist ein lauter
  // Fehlschlag mit genanntem Selektor — kein Tippen ins Leere (AUFTRAG §9).
  expect(
    mitte,
    `${lage}: ${was} hat keinen Mittelpunkt — „${sel}" steht nicht da oder trägt keine Fläche`,
  ).not.toBeNull();
  const p = mitte as Punkt;
  const f = await s.evaluate<{ breite: number; hoehe: number }>(
    fn(
      "() => ({ breite: document.documentElement.clientWidth, hoehe: document.documentElement.clientHeight })",
    ),
  );
  expect(p.x, `${lage}: ${was} — x=${p.x} liegt links ausserhalb`).toBeGreaterThanOrEqual(0);
  expect(
    p.x,
    `${lage}: ${was} — x=${p.x} liegt rechts ausserhalb (Fenster ${f.breite})`,
  ).toBeLessThan(f.breite);
  expect(p.y, `${lage}: ${was} — y=${p.y} liegt oben ausserhalb`).toBeGreaterThanOrEqual(0);
  expect(
    p.y,
    `${lage}: ${was} — y=${p.y} liegt unten ausserhalb (Fenster ${f.hoehe})`,
  ).toBeLessThan(f.hoehe);
  const t = await s.evaluate<Treffer>(fn(TREFFER), [sel, p.x, p.y]);
  expect(
    ["ZIEL", "IM ZIEL"],
    `${lage}: ${was} — an (${p.x}, ${p.y}) liegt nicht das Ziel, sondern ${t.getroffen} (${t.lage})`,
  ).toContain(t.lage);
  console.info(`JOB 3809 · ${lage} · ${was} · Mitte (${p.x}, ${p.y}) · ${t.lage} ${t.getroffen}`);
  return p;
}

/** Den Mitschnitt der Seite leeren — jeder Bedienschritt wird für sich beurteilt. */
async function sammlerLeeren(): Promise<void> {
  const da = await seite().evaluate<boolean>(
    fn(
      "() => { if (!window.__fingerSammler) { return false; } window.__fingerSammler.zuruecksetzen(); return true; }",
    ),
  );
  expect(
    da,
    "der Ereignissammler der Seite steht nicht — dann misst kein Fall ein Geräteereignis",
  ).toBe(true);
}

async function mitschnitt(): Promise<Ereignis[]> {
  return await seite().evaluate<Ereignis[]>(
    fn("() => (window.__fingerSammler ? window.__fingerSammler.liste.slice() : [])"),
  );
}

/**
 * DER EREIGNISRICHTER — er entscheidet, ob da ein FINGER war oder ein Skript.
 *
 * Eigene Funktion, damit der Kalibrierungsfall K sie auf denselben Weg zwingen kann, auf dem die
 * Fälle T2–T4 sie fahren: die Prüfung selbst muss an einem `element.click()` rot werden, nicht nur
 * eine Zahl daneben. Stünde sie nur inmitten der Fälle, liesse sie sich nicht kalibrieren (dieselbe
 * Lehre, die `fokusLage` in JOB 3584 R3 zu einer eigenen Funktion gemacht hat).
 */
function warEinFinger(ereignisse: Ereignis[], lage: string): void {
  const alles = JSON.stringify(ereignisse);
  const beruehrt = ereignisse.filter((e) => e.art === "touchstart");
  expect(
    beruehrt.length,
    `${lage}: es kam KEIN touchstart an — dann war da kein Zeigegerät, sondern ein Skript (${alles})`,
  ).toBeGreaterThan(0);
  const zeiger = ereignisse.filter((e) => e.art === "pointerdown");
  expect(zeiger.length, `${lage}: es kam KEIN pointerdown an (${alles})`).toBeGreaterThan(0);
  expect(
    zeiger.filter((e) => e.zeigerart === "touch").length,
    `${lage}: kein pointerdown mit pointerType „touch" — der Zeiger war keiner (${alles})`,
  ).toBeGreaterThan(0);
  // `isTrusted` trennt das Geräteereignis vom skriptgemachten: `element.click()` erzeugt nach
  // HTML-Standard ein Ereignis mit `isTrusted: false`. Fall K führt genau das vor.
  expect(
    beruehrt.filter((e) => !e.vertrauen).map((e) => e.ziel),
    `${lage}: ein touchstart war nicht vertrauenswürdig — skriptgemacht (${alles})`,
  ).toEqual([]);
  expect(
    zeiger.filter((e) => !e.vertrauen).map((e) => e.ziel),
    `${lage}: ein pointerdown war nicht vertrauenswürdig — skriptgemacht (${alles})`,
  ).toEqual([]);
}

/** Markieren, Mittelpunkt prüfen, Mitschnitt leeren, TIPPEN — und den Mitschnitt zurückgeben. */
async function tippen(
  was: string,
  text: string | null,
  benennung: string,
  lage: string,
): Promise<Ereignis[]> {
  await markieren(was, text, lage);
  const p = await zielpunkt(GRIFF, benennung, lage);
  await sammlerLeeren();
  await seite().touchscreen.tap(p.x, p.y);
  const ereignisse = await mitschnitt();
  console.info(`JOB 3809 · ${lage} · Mitschnitt ${JSON.stringify(ereignisse)}`);
  return ereignisse;
}

/** Warten, bis der Client den Assist-Lauf WIRKLICH hinausgeschickt hat. */
async function warteAufAnfrage(lage: string): Promise<void> {
  const s = seite();
  for (let i = 0; i < 60 && gesendet.length === 0; i++) {
    await s.evaluate(fn("() => new Promise((r) => setTimeout(r, 250))"));
  }
  expect(gesendet.length, `${lage}: es ging keine Assist-Anfrage hinaus`).toBeGreaterThan(0);
}

/** Die Palette per TIPPEN öffnen und auf die gestellte Vorlage warten. */
async function paletteAufTippen(lage: string): Promise<Ereignis[]> {
  const s = await blattFahren();
  const ereignisse = await tippen("werkzeug", null, "das KI-Werkzeug", lage);
  await s.waitForFunction(fn(IM_DOKUMENT), PALETTE, {
    timeout: 20_000,
  });
  // Die Vorlagen kommen aus einem Abruf und brauchen einen Wimpernschlag länger als die Palette.
  // Ohne dieses Warten misst T3 eine Palette ohne Vorlage und meldet „nicht gefunden", ohne dass
  // etwas fehlte (dieselbe Lehre wie JOB 3584 `vorlagenAbwarten`).
  await s.waitForFunction(
    fn(
      `(n) => { const p = document.querySelector('[data-testid="blatt-menue-ki"]'); if (!p) { return false; } const k = p.querySelectorAll('button'); for (let i = 0; i < k.length; i++) { if ((k[i].textContent || '').replace(/\\s+/g, ' ').trim() === n) { return true; } } return false; }`,
    ),
    VORLAGE.name,
    { timeout: 20_000 },
  );
  return ereignisse;
}

// KEIN `describe.runIf`: fehlt `apps/web/dist` oder startet Chromium nicht, wird dieser Lauf ROT und
// nennt den Ausfall wörtlich (er steht in `Buehne.fehler`).
describe("JOB 3809 · die KI-Palette mit einem echten Zeigegerät bei 390 px", () => {
  beforeAll(async () => {
    // DER FÜNFTE PARAMETER IST DER GANZE PUNKT DIESES AUFTRAGS: ohne ihn führt die Seite kein
    // Zeigegerät, `navigator.maxTouchPoints` ist 0 und `tap` ist gar nicht auslösbar.
    b = await buehneAufbauen(PFAD, BLATT, SKRIPT, FENSTER, true);
    if (b.fehler === null) {
      await b.seite.addInitScript(SAMMLER);
      b.seite.on("request", (arg: unknown) => {
        const a = arg as { url(): string; method(): string; postData(): string | null };
        if (a.method() === "POST" && a.url().includes("/api/reasoner")) {
          gesendet.push({ url: a.url(), rumpf: a.postData() });
        }
      });
    }
  }, 180_000);

  afterAll(async () => {
    await b?.schliessen();
  }, 60_000);

  // ==============================================================================================
  // T1 · DAS ZEIGEGERÄT IST WIRKLICH ANGESCHALTET.
  // ==============================================================================================
  //
  // Gemessen wird IN DER SEITE, nicht am Aufrufargument: `navigator.maxTouchPoints` und
  // `'ontouchstart' in window` sind ohne `hasTouch: true` beide falsch bzw. 0 — das ist Chromiums
  // Vorgabe und genau der Zustand, in dem die vier Bestandsverbraucher dieser Bühne weiterfahren.
  //
  // WAS DIESER FALL NICHT TUT, UND WARUM. Der Auftrag beschreibt T1 in §6 als „derselbe Aufbau, nur
  // mit ausgeschaltetem Zeigegerät". Das ginge nur mit einem ZWEITEN `buehneAufbauen` — und genau
  // den verbietet derselbe Auftrag in §5.4 und §10 (ein zweiter Browser, zweite Tor-Last).
  // `hasTouch` ist eine Eigenschaft des Browserkontextes und lässt sich in einer laufenden Seite
  // nicht abschalten. Der Nachweis „ohne den Parameter geht es nicht" ist deshalb die Gegenprobe (a)
  // der Rückgabe, von Hand gefahren und mit wörtlicher roter Zeile belegt; hier steht der Teil, der
  // dauerhaft mitläuft: das Gerät ist da, und es ist ein TOUCH-Gerät. Die Abweichung steht in der
  // Rückgabe.
  it("T1 · die Seite führt wirklich ein Zeigegerät — ohne den neuen Parameter wäre sie ohne", async () => {
    const stand = b as Buehne;
    expect(stand.fehler, `Bühne nicht aufgebaut: ${stand.fehler}`).toBeNull();
    await blattFahren();
    const geraet = await seite().evaluate<{
      punkte: number;
      ontouchstart: boolean;
      grob: boolean;
      ohneSchweben: boolean;
      fenster: string;
    }>(
      fn(`() => ({
        punkte: navigator.maxTouchPoints,
        ontouchstart: 'ontouchstart' in window,
        grob: window.matchMedia('(pointer: coarse)').matches,
        ohneSchweben: window.matchMedia('(hover: none)').matches,
        fenster: document.documentElement.clientWidth + '×' + document.documentElement.clientHeight,
      })`),
    );
    console.info(
      `JOB 3809 · T1 · Chromium ${stand.version} · Theme ${stand.theme} · Zeigegerät ${JSON.stringify(geraet)}`,
    );
    expect(
      geraet.punkte,
      `T1: navigator.maxTouchPoints ist ${geraet.punkte} — die Seite führt kein Zeigegerät`,
    ).toBeGreaterThan(0);
    expect(
      geraet.ontouchstart,
      "T1: die Seite kennt `ontouchstart` nicht — ein Tippen käme dort gar nicht an",
    ).toBe(true);
    // UND DIE ZWEI MEDIENFRAGEN, die zugleich der Grund sind, warum der Parameter ZUSCHALTBAR ist
    // und nicht immer läuft: mit Zeigegerät meldet Chromium `(pointer: coarse)` und `(hover: none)`
    // — gemessen, nicht vermutet (beide `true`, s. die Ausgabe oben). Eine Bühne, die das für ALLE
    // Verbraucher einschaltete, verschöbe damit Endwerte, die die drei Zielbild-Messungen dieser
    // Bühne gegen das Mockup vergleichen. Genau deshalb bleibt die Vorgabe AUS.
    expect(
      geraet.grob,
      "T1: `(pointer: coarse)` greift nicht — die Seite hält ihren Zeiger nicht für einen Finger",
    ).toBe(true);
    expect(
      geraet.ohneSchweben,
      "T1: `(hover: none)` greift nicht — die Seite glaubt weiter an einen schwebenden Zeiger",
    ).toBe(true);
    expect(geraet.fenster, "T1: die Bühne fährt nicht im Fenster des Auftrags").toBe("390×844");
  }, 120_000);

  // ==============================================================================================
  // T2 · DIE PALETTE GEHT PER TIPPEN AUF.
  // ==============================================================================================
  it("T2 · auf das KI-Werkzeug getippt: die Palette geht auf, und es war ein Gerät", async () => {
    const ereignisse = await paletteAufTippen("T2");
    warEinFinger(ereignisse, "T2 · das KI-Werkzeug");
    // Die Palette steht — und in ihr die zwei Stücke, die T4 braucht. Gemessen wird der ZUSTAND der
    // Fläche, nicht die Bewegung des Knopfes.
    const offen = await seite().evaluate<{ palette: boolean; feld: boolean; knopf: string | null }>(
      fn(`() => {
        const p = document.querySelector('[data-testid="blatt-menue-ki"]');
        if (!p) { return { palette: false, feld: false, knopf: null }; }
        const i = p.querySelector('input');
        const k = i && i.parentElement ? i.parentElement.querySelector('button') : null;
        return {
          palette: true,
          feld: !!i,
          knopf: k ? (k.textContent || '').replace(/\\s+/g, ' ').trim() : null,
        };
      }`),
    );
    console.info(`JOB 3809 · T2 · Palette ${JSON.stringify(offen)}`);
    expect(offen.palette, "T2: die Palette ging durch das Tippen nicht auf").toBe(true);
    expect(offen.feld, "T2: die freie Anweisung steht nach dem Tippen nicht im Dokument").toBe(
      true,
    );
    expect(
      offen.knopf,
      `T2: der Knopf „Ausführen" steht nach dem Tippen nicht im Dokument`,
    ).not.toBeNull();
    expect(
      (offen.knopf ?? "").length,
      `T2: der Knopf neben der freien Anweisung trägt keine Beschriftung (${offen.knopf})`,
    ).toBeGreaterThan(0);
  }, 120_000);

  // ==============================================================================================
  // T3 · EINE VORLAGE WIRD PER TIPPEN AUSGELÖST.
  // ==============================================================================================
  //
  // Das ist der Schritt, den ein blosses „die Palette geht auf" NICHT belegt: hier läuft wirklich
  // etwas los. Gemessen wird beides — was HINAUSGEHT (der Rumpf der Anfrage, im Wortlaut) und was
  // ZURÜCKKOMMT und auf der Fläche erscheint (die Vorschaukarte des Blattes).
  it("T3 · auf eine Vorlage getippt: die Anfrage geht heraus und die Vorschau steht da", async () => {
    await paletteAufTippen("T3 · öffnen");
    const s = seite();
    gesendet.length = 0;
    const ereignisse = await tippen("vorlage", VORLAGE.name, `die Vorlage „${VORLAGE.name}"`, "T3");
    warEinFinger(ereignisse, `T3 · die Vorlage „${VORLAGE.name}"`);
    await warteAufAnfrage("T3");
    const rumpf = JSON.parse(gesendet[0]?.rumpf ?? "{}") as Record<string, unknown>;
    console.info(`JOB 3809 · T3 · Rumpf ${JSON.stringify(rumpf)}`);
    expect(rumpf.task, "T3: die Anfrage trägt nicht die Aufgabe assist").toBe("assist");
    expect(rumpf.instruction, "T3: die Vorlage sendet eine andere Anweisung").toBe(
      VORLAGE.instruction,
    );
    expect(String(rumpf.text), "T3: der Text des Blattes fehlt in der Anfrage").toContain("Router");
    // UND DIE FLÄCHE ANTWORTET. Ohne diesen Teil wäre nur belegt, dass ein Aufruf hinausging.
    await s.waitForFunction(fn(IM_DOKUMENT), VORSCHAU, {
      timeout: 30_000,
    });
    const vorschau = await s.evaluate<{ text: string; hoehe: number; palette: boolean }>(
      fn(`(sel) => {
        const el = document.querySelector(sel);
        return {
          text: el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '',
          hoehe: el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : 0,
          palette: document.querySelector('[data-testid="blatt-menue-ki"]') !== null,
        };
      }`),
      VORSCHAU,
    );
    console.info(`JOB 3809 · T3 · Vorschau ${JSON.stringify(vorschau)}`);
    expect(vorschau.text, "T3: die Vorschau zeigt die Antwort nicht").toContain(ANTWORT);
    expect(vorschau.hoehe, "T3: die Vorschau trägt keine Fläche").toBeGreaterThan(0);
    // Der Auslösen-Weg des Produkts schliesst die Palette (`Blatt.tsx:2143`). Dass sie zu ist, ist
    // der zweite, unabhängige Beleg dafür, dass der Finger den Handler WIRKLICH erreicht hat und
    // nicht nur Ereignisse in der Gegend abgesetzt hat.
    expect(vorschau.palette, "T3: die Palette blieb offen — der Auslöseweg lief gar nicht").toBe(
      false,
    );
  }, 120_000);

  // ==============================================================================================
  // T4 · DIE FREIE ANWEISUNG WIRD PER TIPPEN ABGESCHICKT.
  // ==============================================================================================
  it(`T4 · auf das Feld getippt, getippt, auf „Ausführen" getippt: der Lauf geht los`, async () => {
    await paletteAufTippen("T4 · öffnen");
    const s = seite();
    gesendet.length = 0;

    // (a) DAS FELD. Ein Tippen auf ein `<input>` muss es fokussieren — sonst geht der getippte Text
    //     irgendwohin, nur nicht in die freie Anweisung.
    const aufsFeld = await tippen("feld", null, "die freie Anweisung", "T4 · Feld");
    warEinFinger(aufsFeld, "T4 · die freie Anweisung");
    const fokus = await s.evaluate<{ tag: string; marke: string; inPalette: boolean }>(
      fn(`() => {
        const a = document.activeElement;
        const p = document.querySelector('[data-testid="blatt-menue-ki"]');
        return {
          tag: a ? a.tagName : '',
          marke: a && a.getAttribute ? (a.getAttribute('aria-label') || '') : '',
          inPalette: !!a && !!p && p.contains(a),
        };
      }`),
    );
    console.info(`JOB 3809 · T4 · Fokus nach dem Tippen ${JSON.stringify(fokus)}`);
    expect(fokus.tag, "T4: nach dem Tippen trägt kein Eingabefeld den Fokus").toBe("INPUT");
    expect(fokus.inPalette, "T4: das fokussierte Feld liegt nicht in der KI-Palette").toBe(true);

    // (b) DER KNOPF IST VOR DEM TIPPEN GESPERRT (`AiAssistBox.tsx:296`). Ohne diese Messung wäre
    //     „er ist nicht mehr gesperrt" eine Aussage ohne Vorher.
    await markieren("knopf", null, "T4 · Knopf vorher");
    const gesperrt = await s.evaluate<boolean | null>(fn(GESPERRT), GRIFF);
    expect(gesperrt, "T4: der Ausführen-Knopf ist bei LEERER Eingabe nicht gesperrt").toBe(true);

    // (c) GETIPPT WIRD MIT DER TASTATUR DER BÜHNE — der Finger bedient, die Tastatur schreibt.
    //     Ein Zeigegerät kann keinen Text erzeugen; das ist keine Lücke, sondern die Arbeitsteilung
    //     des Geräts (Bildschirmtastatur ist in Chromiums Emulation nicht nachgebildet).
    const ANWEISUNG = "Kuerzen";
    for (const zeichen of ANWEISUNG) {
      await s.keyboard.press(zeichen);
    }
    const angekommen = await s.evaluate<string>(
      fn(
        `() => { const p = document.querySelector('[data-testid="blatt-menue-ki"]'); const i = p ? p.querySelector('input') : null; return i ? i.value : ''; }`,
      ),
    );
    expect(angekommen, "T4: die getippte Anweisung steht nicht im Feld").toBe(ANWEISUNG);

    // (d) JETZT IST DER KNOPF FREI — und der Finger löst ihn aus.
    await markieren("knopf", null, "T4 · Knopf nachher");
    const frei = await s.evaluate<boolean | null>(fn(GESPERRT), GRIFF);
    expect(frei, "T4: der Ausführen-Knopf bleibt trotz Eingabe gesperrt").toBe(false);
    const aufKnopf = await tippen("knopf", null, "der Ausführen-Knopf", "T4 · Ausführen");
    warEinFinger(aufKnopf, "T4 · der Ausführen-Knopf");

    await warteAufAnfrage("T4");
    const rumpf = JSON.parse(gesendet[0]?.rumpf ?? "{}") as Record<string, unknown>;
    console.info(`JOB 3809 · T4 · Rumpf ${JSON.stringify(rumpf)}`);
    expect(rumpf.task, "T4: die Anfrage trägt nicht die Aufgabe assist").toBe("assist");
    expect(rumpf.instruction, "T4: die freie Anweisung kam nicht wörtlich an").toBe(ANWEISUNG);
    await s.waitForFunction(fn(IM_DOKUMENT), VORSCHAU, {
      timeout: 30_000,
    });
    const vorschau = await s.evaluate<string>(
      fn(
        `(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : ''; }`,
      ),
      VORSCHAU,
    );
    console.info(`JOB 3809 · T4 · Vorschau „${vorschau}"`);
    expect(vorschau, "T4: die Vorschau zeigt die Antwort nicht").toContain(ANTWORT);
    expect(vorschau, "T4: die Vorschau nennt die abgeschickte Anweisung nicht").toContain(
      ANWEISUNG,
    );
  }, 180_000);

  // ==============================================================================================
  // T5 · DER FINGER TRIFFT, WAS ER SIEHT.
  // ==============================================================================================
  //
  // T2–T4 laufen über denselben Griff (`zielpunkt`) und prüfen das schon bei jedem Schritt. DIESER
  // Fall hält die Zusage für sich fest — und, was wichtiger ist, er belegt, dass sie ETWAS HÄLT:
  // ein Mittelpunkt für ein Element, das es nicht gibt, ist `null`, und ein Griff, der darauf tippen
  // wollte, scheitert LAUT statt still daneben zu treffen (AUFTRAG §9, Lieferung 3).
  it("T5 · jeder Mittelpunkt liegt im Fenster und trägt sein Ziel — und `null` scheitert laut", async () => {
    await paletteAufTippen("T5 · öffnen");
    const s = seite();
    for (const [was, text, benennung] of [
      ["werkzeug", null, "das KI-Werkzeug"],
      ["vorlage", VORLAGE.name, `die Vorlage „${VORLAGE.name}"`],
      ["feld", null, "die freie Anweisung"],
      ["knopf", null, "der Ausführen-Knopf"],
    ] as [string, string | null, string][]) {
      await markieren(was, text, "T5");
      await zielpunkt(GRIFF, benennung, "T5");
    }

    // (a) ES GIBT DAS ELEMENT NICHT: `MITTE` liefert `null`, und der Griff scheitert mit dem
    //     Selektor in der Meldung. Ohne diese Zeile hiesse „der Finger trifft" nur „es wurde etwas
    //     gerechnet".
    const nichts = await s.evaluate<Punkt | null>(fn(MITTE), '[data-finger="gibt-es-nicht"]');
    expect(nichts, "T5: MITTE liefert für ein fehlendes Element keinen `null`").toBeNull();
    await expect(
      zielpunkt(
        '[data-finger="gibt-es-nicht"]',
        "ein Element, das es nicht gibt",
        "T5 · Gegenprobe",
      ),
      "T5: ein Griff auf ein fehlendes Element scheitert nicht — dann tippt jeder Fall ins Leere",
    ).rejects.toThrow();

    // (b) ES TRÄGT KEINE FLÄCHE: dasselbe Urteil, anderer Grund. Der Ausführen-Knopf wird auf 0×0
    //     gestellt (`display:none` wäre der stumpfere Griff — hier bleibt er im Dokument und hat
    //     trotzdem nichts, was ein Finger treffen könnte) und danach zurückgenommen.
    await markieren("knopf", null, "T5 · ohne Fläche");
    const gesichert = await s.evaluate<string>(
      fn(
        `(sel) => { const k = document.querySelector(sel); const alt = k.getAttribute('style') || ''; k.style.width = '0px'; k.style.height = '0px'; k.style.padding = '0'; k.style.border = '0'; k.style.minWidth = '0'; k.style.overflow = 'hidden'; return alt; }`,
      ),
      GRIFF,
    );
    const ohneFlaeche = await s.evaluate<Punkt | null>(fn(MITTE), GRIFF);
    expect(
      ohneFlaeche,
      `T5: MITTE liefert für ein Element ohne Fläche einen Punkt (${JSON.stringify(ohneFlaeche)})`,
    ).toBeNull();
    await expect(
      zielpunkt(GRIFF, "der Ausführen-Knopf ohne Fläche", "T5 · Gegenprobe"),
      "T5: ein Griff auf ein flächenloses Element scheitert nicht",
    ).rejects.toThrow();
    await s.evaluate(
      fn(
        `([sel, alt]) => { const k = document.querySelector(sel); if (alt) { k.setAttribute('style', alt); } else { k.removeAttribute('style'); } }`,
      ),
      [GRIFF, gesichert],
    );
    // Zurückgenommen — und der Knopf ist wieder ein gültiges Ziel.
    await zielpunkt(GRIFF, "der Ausführen-Knopf nach der Rücknahme", "T5 · nach Rücknahme");
  }, 180_000);

  // ==============================================================================================
  // K · DIE KALIBRIERUNG: DERSELBE WEG MIT `element.click()` — UND DER RICHTER LEHNT IHN AB.
  // ==============================================================================================
  //
  // Das ist die Gegenprobe (c) aus §6 des Auftrags, und sie steht als DAUERFALL hier statt nur als
  // Zeile in einer Rückgabe: sie ist der Beweis, dass die neuen Fälle mehr messen als der alte Weg.
  // Gefahren wird GENAU der Aufruf, über den JOB 3584 die Palette öffnet
  // (`ki-palette-390px-chromium.test.ts:438`). Die WIRKUNG ist dieselbe — die Palette geht auf, und
  // genau das wird hier auch gemessen, sonst kalibrierte der Fall gegen einen Zustand, den es nicht
  // gibt. Der UNTERSCHIED liegt im Mitschnitt: kein `touchstart`, kein `pointerdown`, und der Klick
  // selbst ist `isTrusted: false`. Bliebe `warEinFinger` hier grün, sagten T2–T4 nichts über einen
  // Finger aus.
  it("K · ein `element.click()` bewirkt dasselbe — aber der Ereignisrichter ist an ihm ROT", async () => {
    const s = await blattFahren();
    await sammlerLeeren();
    await s.evaluate(fn("(sel) => { document.querySelector(sel).click(); }"), WERKZEUG);
    await s.waitForFunction(fn(IM_DOKUMENT), PALETTE, {
      timeout: 20_000,
    });
    const ereignisse = await mitschnitt();
    console.info(`JOB 3809 · K · Mitschnitt ${JSON.stringify(ereignisse)}`);
    // Die WIRKUNG ist dieselbe: die Palette steht. Der Fall kalibriert also gegen den echten
    // Altweg und nicht gegen einen Fehlschlag.
    const offen = await s.evaluate<boolean>(fn(IM_DOKUMENT), PALETTE);
    expect(
      offen,
      "K: der alte Weg öffnet die Palette gar nicht — dann kalibriert dieser Fall nichts",
    ).toBe(true);
    // Und genau die Prüfung, die T2–T4 fahren, MUSS an ihm rot werden.
    expect(
      () => warEinFinger(ereignisse, "K · element.click()"),
      "K: `warEinFinger` lässt einen Dokumentklick durch — dann belegen T2–T4 kein Zeigegerät",
    ).toThrow();
    // Und die drei Einzelaussagen, benannt statt nur gesammelt.
    expect(
      ereignisse.filter((e) => e.art === "touchstart"),
      "K: ein `element.click()` hat ein touchstart erzeugt",
    ).toEqual([]);
    expect(
      ereignisse.filter((e) => e.art === "pointerdown"),
      "K: ein `element.click()` hat ein pointerdown erzeugt",
    ).toEqual([]);
    expect(
      ereignisse.filter((e) => e.art === "click" && e.vertrauen),
      "K: der Dokumentklick gilt als vertrauenswürdig — dann trennt `isTrusted` nichts",
    ).toEqual([]);
    expect(
      ereignisse.filter((e) => e.art === "click").length,
      `K: es kam gar kein click an (${JSON.stringify(ereignisse)})`,
    ).toBeGreaterThan(0);
  }, 120_000);

  it("P · die Seite hat während aller Messungen nichts geworfen", () => {
    expect(buehne().seitenfehler).toEqual([]);
  });
});
