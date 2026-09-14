// ================================================================================================
// JOB 3811 · DER MESSER DER FLÄCHE — keine Zusage, kein Testfall.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie ist der Aufbau der Messung dieses Auftrags
// (`flaeche-folgt-dem-fenster-chromium.test.ts`) und steht getrennt, weil sie Vorrichtung ist und
// keine Aussage: was hier steht, MISST, es behauptet nichts (dieselbe Lehre, die Fenster und
// Tastatur in JOB 3584 in die H3-Bühne gebracht hat, `h3-blatt-buehne.ts:82-93`).
//
// IN RUNDE 1 HATTE SIE ZWEI VERBRAUCHER: daneben stand `befund-flaeche-folgt-dem-eigenen-inhalt-
// nicht-chromium.test.ts`. Dessen Mangel ist mit JOB 3769 D2 (`3b27c44`) behoben, seine Fälle sind
// umgedreht und in die Zusicherungsdatei gewandert (dort im Kopf, Abschnitt „DER BEFUND AUS
// RUNDE 1"). Damit fährt dieser Auftrag EINEN Browser und EINE Seite, wie §7.6 es verlangt.
//
// DIE H3-BÜHNE SELBST WIRD IMPORTIERT, NICHT ABGESCHRIEBEN (`tests/design/h3-blatt-buehne.ts`, sie
// ist Zielpfad von JOB 3809): die ECHTE gebaute Anwendung aus `apps/web/dist` in echtem Chromium,
// jeder `/api/*`-Aufruf an die ECHTE Fastify-App. Hier steht nur, was diesem Auftrag gehört: das
// „…"-Menü des Erfassungsblattes, seine zwei Stufen, und der Messer.
//
// ZEILENANGABEN. Jede Angabe `Menue.tsx:<n>` / `Blatt.tsx:<n>` in dieser Datei ist am Stand von
// `main` gelesen (mit JOB 3769 D2, `3b27c44`) — dem Stand, auf den dieser Auftrag vor dem Tor
// gesetzt wird (`rebase_vor_tor: true`).
import { expect } from "vitest";

import { ORIGIN, type Seite, fn } from "../design/h3-blatt-buehne";

/** Die Wurzel, auf die jede Fahrt wartet — das gemountete Blatt. */
export const BLATT = '[data-testid="blatt"]';
/** Text im Blatt, damit es im Zustand eines echten Erfassungsvorgangs steht und nicht leer. */
const INHALT = "Der Kunde hat den Router am Montag übernommen.";
export const PFAD = `/erfassen/neu?text=${encodeURIComponent(INHALT)}`;

/**
 * Das gerahmte „…"-Werkzeug und seine Fläche (`Blatt.tsx:2304-2313`).
 *
 * GERAHMT heisst `right-0` (`Menue.tsx:393`) — die Fläche hängt rechtsbündig am KNOPF. Genau diese
 * Verankerung ist der Grund, warum am Telefon überhaupt etwas hinausläuft: dort bricht die
 * Werkzeugzeile um, der Knopf steht am linken Zeilenanfang, und die 330 px breite Fläche reicht von
 * ihm aus nach links über den Rand hinaus (`Menue.tsx:121-128`).
 */
export const WERKZEUG = '[data-testid="blatt-werkzeug-mehr"]';
export const FLAECHE = '[data-testid="blatt-menue-mehr"]';

/** Die Ausgangsgrösse jedes Falls — das Telefon hochkant, wie in JOB 3584. */
export const HOCH = { width: 390, height: 844 };
/** Die Drehung: dasselbe Gerät quer. */
export const QUER = { width: 844, height: 390 };
/** Das Schrumpfen: das schmalste Fenster, das das Produkt zusagt. */
export const SCHMAL = { width: 320, height: 568 };

// ---- Der Messer ---------------------------------------------------------------------------------
//
// GEMESSEN WIRD LAGE UND VERSATZ, und beides an der Fläche UND an jedem Stück darin. Die Fläche
// allein genügt nicht: die Entwurfsliste ist eine `MenueFlaeche` mit FESTER Breite
// (`Menue.tsx:457`, `w-[320px] max-w-full`) und kann über den Rand ihres Elternteils hinausstehen —
// dann meldete der Elternteil eine heile Lage, während der Mensch die Titel nicht lesen kann. Ein
// `toBeVisible()` wäre hier wertlos: es ist auch für ein Stück wahr, das vollständig ausserhalb des
// Fensters liegt (genau Bens x = −237 px).
//
// DER VERSATZ WIRD ZWEIMAL GEHOLT, weil zwei Fragen dahinterstehen: `versatzStil` ist das, was
// `Menue.tsx:398-402` GESCHRIEBEN hat (`translate(<x>px, <y>px)` oder gar nichts), `versatzMatrix`
// das, was der Browser daraus WIRKLICH macht. Weichen sie ab, nähme eine spätere Regel die
// Verschiebung zurück — genau der Fall, den der Deckel `versuche` (`Menue.tsx:218`) fürchtet.
//
// NUR DIE WAAGERECHTE ZAHL (`m41`) WIRD ALS `versatzMatrix` GEFÜHRT, und das ist Absicht: seit
// JOB 3769 D2 schreibt dieselbe Zeile BEIDE Achsen in EINE Verschiebung (`translate(47px,
// -152.688px)` bei 320×568 gemessen). Dieser Auftrag misst die WAAGERECHTE Lage; die senkrechte
// Erreichbarkeit ist Gegenstand von `tests/ki-freie-anweisung/**` und hier ausdrücklich NICHT
// gedeckt. Der volle Stil steht trotzdem in `versatzStil` und damit in jeder Ausgabe.
const MASSE = `() => {
  const rd = (z) => Math.round(z * 10) / 10;
  const r = (el) => {
    if (!el) { return null; }
    const b = el.getBoundingClientRect();
    return {
      links: rd(b.left), rechts: rd(b.right), oben: rd(b.top), unten: rd(b.bottom),
      breite: rd(b.width), hoehe: rd(b.height),
      text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
    };
  };
  const flaeche = document.querySelector('${FLAECHE}');
  const knopf = document.querySelector('${WERKZEUG}');
  const grund = {
    fenster: document.documentElement.clientWidth,
    fensterhoehe: document.documentElement.clientHeight,
    innen: window.innerWidth,
    innenhoehe: window.innerHeight,
    sichtfenster: window.visualViewport
      ? rd(window.visualViewport.width) + 'x' + rd(window.visualViewport.height)
      : 'kein visualViewport',
    seitenbreite: document.documentElement.scrollWidth,
    knopf: r(knopf),
  };
  if (!flaeche) {
    return Object.assign(grund, { flaeche: null, versatzStil: null, versatzMatrix: null,
      deckel: null, anker: null, eintraege: 0, stuecke: [], schlimmstesLinks: null, schlimmstesRechts: null });
  }
  const s = getComputedStyle(flaeche);
  // Was der Browser aus dem transform wirklich macht — m41 ist die Verschiebung in x.
  let m41 = 0;
  try { m41 = rd(new DOMMatrix(s.transform === 'none' ? '' : s.transform).m41); } catch (e) { m41 = NaN; }
  const stuecke = [...flaeche.querySelectorAll('*')]
    .map((el) => ({
      marke: el.getAttribute('data-testid') || el.tagName + '.' + String(el.className || '').slice(0, 30),
      lage: r(el),
    }))
    .filter((x) => x.lage && x.lage.breite > 0 && x.lage.hoehe > 0);
  const alle = [r(flaeche)].concat(stuecke.map((x) => x.lage));
  return Object.assign(grund, {
    flaeche: r(flaeche),
    versatzStil: flaeche.style.transform || '',
    versatzMatrix: m41,
    deckel: s.maxWidth,
    anker: s.right,
    eintraege: flaeche.querySelectorAll('[role="menuitem"]').length,
    stuecke: stuecke,
    schlimmstesLinks: rd(Math.min.apply(null, alle.map((x) => x.links))),
    schlimmstesRechts: rd(Math.max.apply(null, alle.map((x) => x.rechts))),
  });
}`;

export interface Lage {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  breite: number;
  hoehe: number;
  text: string;
}

export interface Masse {
  fenster: number;
  fensterhoehe: number;
  innen: number;
  innenhoehe: number;
  sichtfenster: string;
  seitenbreite: number;
  knopf: Lage | null;
  flaeche: Lage | null;
  /** Was `Menue.tsx:291` geschrieben hat — `translateX(…px)` oder der leere String. */
  versatzStil: string | null;
  /** Was der Browser daraus macht (`m41` der Transformationsmatrix). */
  versatzMatrix: number | null;
  deckel: string | null;
  anker: string | null;
  eintraege: number;
  stuecke: { marke: string; lage: Lage }[];
  /** Die linkeste Kante der Fläche UND aller Stücke darin. */
  schlimmstesLinks: number | null;
  /** Die rechteste Kante der Fläche UND aller Stücke darin. */
  schlimmstesRechts: number | null;
}

/**
 * Das Fenster stellen und WARTEN, bis die Seite es auch hat.
 *
 * Ohne dieses Warten misst der nächste Zug die alte Lage: `setViewportSize` kehrt zurück, bevor die
 * Seite neu gezeichnet hat, und der `resize`-Hörer (`Menue.tsx:262`) setzt React-Zustand, der erst
 * im FOLGENDEN Bild steht. Gewartet wird auf `window.innerWidth`/`innerHeight` — das ist genau das,
 * was gestellt wurde; `documentElement.clientWidth` wäre um eine etwaige Rollleiste kleiner — und
 * danach auf zwei volle Bildaufbauten.
 */
export async function fensterStellen(
  s: Seite,
  groesse: { width: number; height: number },
): Promise<void> {
  await s.setViewportSize(groesse);
  await s.waitForFunction(
    fn("([w, h]) => window.innerWidth === w && window.innerHeight === h"),
    [groesse.width, groesse.height],
    { timeout: 15_000 },
  );
  await s.evaluate(
    fn(
      "() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 60))))",
    ),
  );
}

/** Das Blatt bei `groesse` frisch fahren — über den echten Deep-Link des Produkts. */
export async function blattFahren(
  s: Seite,
  groesse: { width: number; height: number },
): Promise<void> {
  await fensterStellen(s, groesse);
  await s.goto(`${ORIGIN}${PFAD}`, { waitUntil: "load", timeout: 60_000 });
  await s.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), BLATT, {
    timeout: 30_000,
  });
}

/**
 * Das „…"-Menü öffnen — über den ECHTEN Knopf des Produkts (`Menue.tsx:375-376`).
 *
 * ERSTE STUFE: sechs Einträge (Entwürfe · Anhänge · Status · Beispiel · Klara · Eingabe verwerfen,
 * `Blatt.tsx:2323-2357`). Das ist das Werkzeug MIT INHALT, das §9 verlangt.
 *
 * `stufe: "entwuerfe"` geht eine Stufe weiter in die ENTWURFSLISTE (`Blatt.tsx:2366`): dort steht
 * die 320 px breite `MenueFlaeche`, und genau sie ist die Fläche, an der Ben in JOB 3266 R1
 * „x = −237 px" gemessen hat. Der Unterschied zwischen beiden Stufen ist NICHT kosmetisch — die
 * Fläche wird dabei von ~220 px auf ~330 px breit, ohne dass das Menü je geschlossen wurde.
 *
 * Dass Knopf und Fläche im Fenster liegen, behauptet dieser Griff nicht; das misst `messen`.
 */
export async function menueOeffnen(
  s: Seite,
  stufe: "erste" | "entwuerfe" = "erste",
): Promise<void> {
  await s.evaluate(fn(`() => { document.querySelector('${WERKZEUG}').click(); }`));
  await s.waitForFunction(fn(`() => document.querySelector('${FLAECHE}') !== null`), undefined, {
    timeout: 20_000,
  });
  // Die erste Stufe muss WIRKLICH ihre Einträge tragen, bevor irgendetwas gemessen wird (§9:
  // ein Menü ohne Einträge wird nicht gemessen).
  await s.waitForFunction(
    fn(`() => document.querySelectorAll('${FLAECHE} [role="menuitem"]').length >= 5`),
    undefined,
    { timeout: 20_000 },
  );
  if (stufe === "erste") {
    await bildAbwarten(s);
    return;
  }
  await entwuerfeOeffnen(s);
}

/**
 * Von der ERSTEN Stufe eine weiter in die Entwurfsliste — an einem BEREITS offenen Menü.
 *
 * Eigen, weil genau dieser eine Klick DER Fall ist: kein Schliessen, kein Fensterwechsel, nur ein
 * Mensch, der auf „Entwürfe" tippt. Wer stattdessen `menueOeffnen` ein zweites Mal riefe, klickte
 * auf das Werkzeug und SCHLÖSSE das Menü (`Menue.tsx:376`, der Umschalter).
 *
 * WAS DIESER KLICK IM PRODUKT AUSLÖST — und erst seit JOB 3769 D2 (`3b27c44`): die Fläche wird
 * höher UND breiter, und der `ResizeObserver` auf ihr (`Menue.tsx:290-298`) weckt denselben
 * Ausgleich, den sonst nur `istOffen` und `resize` wecken. Bis dahin lief hier NICHTS: der
 * `useLayoutEffect` hängt an `[istOffen, versatz, versatzHoch]` (`Menue.tsx:300`), und keines der
 * drei ändert sich, wenn bloss der Inhalt wächst. Genau das war der Befund aus Runde 1.
 */
export async function entwuerfeOeffnen(s: Seite): Promise<void> {
  // Der Eintrag „Entwürfe" (`Blatt.tsx:2323`) — am sichtbaren Wort gegriffen, wie ein Mensch ihn
  // trifft. Wird er nicht gefunden, ist das ein Fehlschlag und keine stille Auslassung.
  const getroffen = await s.evaluate<boolean>(
    fn(
      `(wort) => { const e = [...document.querySelectorAll('${FLAECHE} [role="menuitem"]')].find((x) => (x.textContent || '').trim() === wort); if (!e) { return false; } e.click(); return true; }`,
    ),
    "Entwürfe",
  );
  expect(getroffen, "der Eintrag „Entwürfe“ steht nicht im „…“-Menü").toBe(true);
  // Auf die zweite Stufe warten: nur sie trägt den Rückweg „‹ Zurück" (`Blatt.tsx:2361`). Ohne
  // dieses Warten misst der nächste Zug die erste Stufe und nennt sie Entwurfsliste.
  await s.waitForFunction(
    fn(
      `(wort) => { const f = document.querySelector('${FLAECHE}'); return !!f && (f.textContent || '').includes(wort); }`,
    ),
    "Zurück",
    { timeout: 20_000 },
  );
  await bildAbwarten(s);
}

/** Das Menü schliessen — über Escape, den Weg, den `Menue.tsx:337-341` vorsieht. */
export async function menueSchliessen(s: Seite): Promise<void> {
  await s.keyboard.press("Escape");
  await s.waitForFunction(fn(`() => document.querySelector('${FLAECHE}') === null`), undefined, {
    timeout: 20_000,
  });
}

/** Ein volles Bild abwarten — React setzt den Versatz im Layout-Effekt, sichtbar wird er danach. */
export async function bildAbwarten(s: Seite): Promise<void> {
  await s.evaluate(fn("() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)))"));
}

export async function messen(s: Seite, lage: string): Promise<Masse> {
  const m = await s.evaluate<Masse>(fn(MASSE));
  console.info(`JOB 3811 · ${lage} · ${JSON.stringify(m)}`);
  return m;
}

/**
 * Die Fläche steht wirklich da und trägt Fläche — sonst ist jede Aussage über ihre Lage leer.
 *
 * §9 und `Menue.tsx:220-224` verlangen dasselbe: ohne ein von null verschiedenes Rechteck wird nicht
 * gemessen. Dazu kommt der Inhalt: ein leeres Menü wäre eine Lage ohne Gegenstand.
 */
export function gemessen(m: Masse, lage: string): Lage {
  expect(m.flaeche, `${lage}: die Fläche steht nicht da`).not.toBeNull();
  const f = m.flaeche as Lage;
  expect(f.breite, `${lage}: die Fläche ist nur ${f.breite} px breit`).toBeGreaterThan(0);
  expect(f.hoehe, `${lage}: die Fläche ist nur ${f.hoehe} px hoch`).toBeGreaterThan(0);
  expect(
    f.text.length,
    `${lage}: die Fläche ist leer — dann misst dieser Fall nichts („${f.text}")`,
  ).toBeGreaterThan(3);
  expect(
    m.stuecke.length,
    `${lage}: die Fläche hat kein einziges Stück mit eigener Fläche`,
  ).toBeGreaterThan(0);
  return f;
}
