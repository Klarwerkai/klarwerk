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
// JOB 3954 — WAS DIESE DATEI SEITHER ZUSÄTZLICH KANN, UND WARUM SIE ES KÖNNEN MUSS.
// Bis hierher mass der Prüfstand die Entwurfsliste OHNE einen einzigen Entwurf darin: die Bühne legt
// genau ein Wissensobjekt an (`h3-blatt-buehne.ts:241-248`) und keinen Entwurf, das Blatt fährt über
// den Deep-Link `/erfassen/neu?text=…` (`:31` unten) — ein NEUES Blatt, nichts Gespeichertes. Die
// 320 px Breite kamen allein aus der Hülle (`Menue.tsx:457`, `w-[320px]`), nicht aus einem Titel.
// Seit JOB 3954 stehen hier drei Griffe, die genau das ändern, und sie sind ALLE laut:
//   · `entwuerfeAnlegen` legt Entwürfe über den ECHTEN Schreibweg an (`POST /api/drafts` aus der
//     Seite heraus, durch die Bühnenroute an die echte Fastify-App, `h3-blatt-buehne.ts:273-305`)
//     und gilt erst als belegt, wenn der ECHTE Listenabruf des Produkts dieselben Titel zeigt.
//   · `listenStand` und `titelMasse` lesen, was auf der Fläche WIRKLICH steht (Anzahl, Leersatz,
//     Titeltext, Beschneidung, Zeilenzahl) — kein `toBeVisible`, sondern Zahlen.
//   · Die SCHALTVORRICHTUNG (`VORSPANN`, `schaltungSetzen`, `schaltbefund`) trennt die zwei Auslöser
//     des Ausgleichs voneinander, OHNE eine Produktdatei anzufassen, und WEIST DIE ABSCHALTUNG NACH.
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

// ================================================================================================
// JOB 3954 · DIE DREI TITEL, DIE WIRKLICH IN DER LISTE STEHEN — und warum genau diese drei.
// ================================================================================================
//
// An einem kurzen Wort fiele weder ein Überlauf noch ein abgeschnittenes Ende auf. Gebraucht werden
// deshalb die drei Fälle, für die der Produktkommentar (`CaptureDraftList.tsx:353-374`) ausdrücklich
// steht:
//   (a) ein LANGER, mehrwortiger Titel, der auf den 262 px der 320-px-Fläche sicher umbricht;
//   (b) ein überlanges Wort OHNE Leerzeichen — ein gewöhnlicher Umbruch findet darin keine Stelle,
//       nur `overflow-wrap: break-word` bricht innerhalb des Wortes, statt es über den Rand zu
//       schieben;
//   (c) ZWEI Titel, die sich erst am ENDE unterscheiden („… Nord 2026" / „… Süd 2026") — genau das
//       Paar, das eine Kürzung mit Auslassungspunkten ununterscheidbar machen würde.
// (a) und (c) fallen in denselben zwei Titeln zusammen: sie sind lang UND enden verschieden.
//
// SIE SIND NICHT DIE DREI AUS `tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`. Dort steht
// ein anderer Bestand („Freigabe Notfallplan …"), und die beiden Prüfstände legen ihre Entwürfe in
// getrennten Fastify-Instanzen an. Eigene Wörter hier, damit eine Meldung sofort sagt, WELCHER
// Prüfstand sie geschrieben hat.
const VORHABEN = "Wartungsfenster Lackieranlage mit Absaugung und Brandschutz — Ausgabe";
export const TITEL_NORD = `${VORHABEN} Nord 2026`;
export const TITEL_SUED = `${VORHABEN} Süd 2026`;
export const TITEL_WORT = "Wartungsfenster_Lackieranlage_Absaugung_Brandschutz_Ausgabe_2026.docx";
/** Der Bestand, den dieser Prüfstand anlegt und an dem T1/T2 messen. */
export const TITEL: readonly string[] = [TITEL_NORD, TITEL_SUED, TITEL_WORT];
/**
 * Weniger als drei Titel misst dieser Prüfstand nicht — und er sagt es LAUT, statt über eine leere
 * Schleife still grün zu werden (Lehre JOB 3489). Die Zahl steht hier und nicht in den Fällen,
 * damit eine geleerte Titelliste an EINER Stelle rot wird und nicht an keiner.
 */
export const MINDESTTITEL = 3;

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
  await ruheAbwarten(s);
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
    await ruheAbwarten(s);
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
  // JOB 3954, Zustandsmodell §9: KEINE AUSSAGE ÜBER EINE LISTE, DIE NOCH LÄDT. Die Entwürfe kommen
  // aus einem Abruf (`Blatt.tsx:2386-2410`); solange `blatt-entwuerfe-laedt` steht, ist weder die
  // Zahl der Einträge noch der Leersatz eine Auskunft über den Bestand. Gewartet wird auf das ENDE
  // des Ladens — was danach dasteht (leer, gefüllt oder gestört), messen die Fälle selbst.
  await s.waitForFunction(
    fn(`() => document.querySelector('[data-testid="blatt-entwuerfe-laedt"]') === null`),
    undefined,
    { timeout: 20_000 },
  );
  await bildAbwarten(s);
  await ruheAbwarten(s);
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

/**
 * JOB 3954 — WARTEN, BIS DIE FLÄCHE ZUR RUHE GEKOMMEN IST, statt ein festes Bild abzuzählen.
 *
 * Nötig geworden, weil die Fläche seit diesem Auftrag echte Entwürfe trägt: die Liste kommt aus
 * einem Abruf, sie erscheint also NACH dem ersten Bild, und jede ihrer Stufen weckt über den
 * `ResizeObserver` (`Menue.tsx:290-295`) eine weitere Nachrechnung. Ein fester `setTimeout` misst
 * dann je nach Rechnerlast einen Zwischenstand — genau die Sorte Zahl, die in der Rückgabe als
 * „schwankt" enden würde.
 *
 * GEWARTET WIRD AUF ZWEI GRÖSSEN ZUSAMMEN: den geschriebenen `transform` und die Breite der Fläche.
 * Erst wenn beide über drei aufeinanderfolgende Bilder gleich bleiben, ist der Ausgleich fertig.
 * Der Deckel von 90 Bildern (~1,5 s) verhindert ein Hängen; er läuft still aus, weil das Urteil
 * den Fällen gehört und nicht dieser Vorrichtung — was danach dasteht, MESSEN sie.
 */
export async function ruheAbwarten(s: Seite): Promise<void> {
  await s.evaluate(
    fn(`() => new Promise((r) => {
  const lesen = () => {
    const f = document.querySelector('${FLAECHE}');
    if (!f) { return 'keine Flaeche'; }
    return (f.style.transform || '-') + '|' + Math.round(f.getBoundingClientRect().width) + 'x' + Math.round(f.getBoundingClientRect().height);
  };
  let letzter = lesen();
  let gleich = 0;
  let bilder = 0;
  const takt = () => {
    bilder += 1;
    const jetzt = lesen();
    gleich = jetzt === letzter ? gleich + 1 : 0;
    letzter = jetzt;
    if (gleich >= 3 || bilder >= 90) { setTimeout(r, 30); return; }
    requestAnimationFrame(takt);
  };
  requestAnimationFrame(takt);
})`),
  );
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

// ================================================================================================
// JOB 3954 · DER BESTAND — ECHTE ENTWÜRFE, ÜBER DEN ECHTEN SCHREIBWEG.
// ================================================================================================

/** Was der Server auf EINE Anlage geantwortet hat — ungeschönt, samt Rumpf für die Fehlermeldung. */
export interface Anlage {
  titel: string;
  status: number;
  id: string | null;
  koerper: string;
}

/** Was die Entwurfsliste im offenen Menü WIRKLICH zeigt (`Blatt.tsx:2386-2444`). */
export interface Listenstand {
  flaecheDa: boolean;
  /** `blatt-entwuerfe-laedt` — nach `entwuerfeOeffnen` immer `false`, sonst wäre nichts zu sagen. */
  laedt: boolean;
  /** `blatt-entwuerfe-leer` (`Blatt.tsx:2406-2410`). */
  leersatz: boolean;
  /** `blatt-entwuerfe-fehler` (`Blatt.tsx:2391-2405`) — in diesem Prüfstand nie erwartet. */
  gestoert: boolean;
  /** `entwurfsliste-filter-leer` (`CaptureDraftList.tsx:322-328`): Bestand da, Filter zu eng. */
  filterLeer: boolean;
  eintraege: number;
  titel: string[];
}

const LISTENSTAND = `() => {
  const da = (sel) => document.querySelector(sel) !== null;
  return {
    flaecheDa: da('${FLAECHE}'),
    laedt: da('[data-testid="blatt-entwuerfe-laedt"]'),
    leersatz: da('[data-testid="blatt-entwuerfe-leer"]'),
    gestoert: da('[data-testid="blatt-entwuerfe-fehler"]'),
    filterLeer: da('[data-testid="entwurfsliste-filter-leer"]'),
    eintraege: document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]').length,
    titel: [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag-titel"]')]
      .map((e) => e.textContent || ''),
  };
}`;

/** Den Stand der offenen Entwurfsliste lesen — Zahlen, keine Behauptung. */
export async function listenStand(s: Seite, lage: string): Promise<Listenstand> {
  const stand = await s.evaluate<Listenstand>(fn(LISTENSTAND));
  console.info(`JOB 3954 · ${lage} · ${JSON.stringify(stand)}`);
  return stand;
}

/**
 * DIE ANLAGE — `POST /api/drafts` AUS DER SEITE HERAUS, damit sie den echten Weg nimmt.
 *
 * Warum aus der Seite und nicht über `Buehne.frage`: nur ein Aufruf AUS der Seite läuft durch die
 * Bühnenroute (`h3-blatt-buehne.ts:273-305`), die ihn an die ECHTE Fastify-App weiterreicht und den
 * Bearer selbst setzt (`:290`). Kein `skript`-Stub, keine erfundene Antwort — die Felder liegen
 * FLACH (`apps/web/src/api/endpoints.ts`, `DraftPayload` in `api/types.ts`), `title` und `statement`
 * genügen.
 *
 * UND SIE GILT ERST ALS BELEGT, WENN DAS PRODUKT SIE ZEIGT. Deshalb endet dieser Griff nicht bei
 * „2xx", sondern fährt das Blatt neu, öffnet die Liste und ZÄHLT NACH (Lehre JOB 3489: ein Erheber,
 * der nichts findet, ist nicht still). Drei Arten, laut zu werden:
 *   · weniger als `MINDESTTITEL` bestellte Titel — dann misst der ganze Prüfstand nichts;
 *   · eine Antwort ausserhalb 2xx oder ohne Kennung — mit Rumpf in der Meldung;
 *   · weniger Einträge in der Liste als angelegt, oder ein Titel, der nicht ankam.
 */
export async function entwuerfeAnlegen(
  s: Seite,
  titel: readonly string[],
  groesse: { width: number; height: number },
  vorher: number,
): Promise<{ anlagen: Anlage[]; stand: Listenstand }> {
  expect(
    titel.length,
    `die Entwurfsanlage ist mit ${titel.length} Titeln bestellt — unter ${MINDESTTITEL} misst ` +
      `dieser Prüfstand die Titel nicht, sondern eine leere Schleife (${JSON.stringify(titel)})`,
  ).toBeGreaterThanOrEqual(MINDESTTITEL);

  const anlagen = await s.evaluate<Anlage[]>(
    fn(`async (titel) => {
  const ergebnis = [];
  for (const t of titel) {
    let status = -1;
    let koerper = '';
    let id = null;
    try {
      const res = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: t, statement: 'JOB 3954 · über den echten Schreibweg angelegt.' }),
      });
      status = res.status;
      koerper = await res.text();
      try { id = (JSON.parse(koerper) || {}).id || null; } catch (e) { id = null; }
    } catch (e) {
      koerper = 'Wurf: ' + String(e);
    }
    ergebnis.push({ titel: t, status: status, id: id, koerper: String(koerper).slice(0, 240) });
  }
  return ergebnis;
}`),
    [...titel],
  );
  console.info(`JOB 3954 · Entwurfsanlage · ${JSON.stringify(anlagen)}`);

  for (const a of anlagen) {
    expect(
      a.status >= 200 && a.status < 300,
      `die Entwurfsanlage „${a.titel}" wurde NICHT angenommen (HTTP ${a.status}, „${a.koerper}")`,
    ).toBe(true);
    expect(
      a.id,
      `die Entwurfsanlage „${a.titel}" kam ohne Kennung zurück (HTTP ${a.status}, „${a.koerper}")`,
    ).not.toBeNull();
  }

  // DER ECHTE LISTENABRUF DES PRODUKTS, frisch: neu fahren, öffnen, nachzählen.
  await blattFahren(s, groesse);
  await menueOeffnen(s, "entwuerfe");
  const stand = await listenStand(s, "Entwurfsanlage · Nachzählung im Produkt");
  expect(
    stand.gestoert,
    "die Entwurfsliste meldet nach der Anlage einen gestörten Abruf — dann sagt ihre Zahl nichts",
  ).toBe(false);
  expect(
    stand.eintraege,
    `die Entwurfsanlage ist im Produkt nicht angekommen: vorher ${vorher} Einträge, ${titel.length} ` +
      `angelegt, jetzt ${stand.eintraege} (Leersatz ${stand.leersatz}, Filterleersatz ` +
      `${stand.filterLeer}, Titel ${JSON.stringify(stand.titel)})`,
  ).toBe(vorher + titel.length);
  for (const t of titel) {
    expect(
      stand.titel.filter((x) => x === t).length,
      `der angelegte Titel „${t}" steht nicht GENAU EINMAL in der Liste des Produkts ` +
        `(gelesen: ${JSON.stringify(stand.titel)})`,
    ).toBe(1);
  }
  return { anlagen, stand };
}

// ================================================================================================
// JOB 3954 · DAS TITELRECHTECK — der Messpunkt, den der Prüfstand bis hierher nie angefasst hat.
// ================================================================================================
//
// GEMESSEN WIRD AM TITEL SELBST (`blatt-entwurf-eintrag-titel`, `CaptureDraftList.tsx:375`) und
// nicht an seiner Zeile: ein Kind kann über den Rand seines Elternteils hinausstehen, und dann
// meldete der Elternteil eine heile Lage, während der Mensch nichts lesen kann.
//
// VIER ZAHLEN, VIER VERSCHIEDENE FRAGEN:
//   · `links`/`rechts` — liegt das Rechteck im Fenster?
//   · `textbreite`/`sichtbreite` (`scrollWidth`/`clientWidth`) — steht mehr da, als zu sehen ist?
//     Dasselbe senkrecht (`texthoehe`/`sichthoehe`), sonst fiele eine Kürzung auf eine Zeile mit
//     fester Höhe durch.
//   · `umbruch`/`kuerzung`/`umbruchWort` (`white-space`/`text-overflow`/`overflow-wrap`) — die drei
//     Regeln, mit denen diese Kürzung gemacht wird; sie stehen in der Meldung, damit sie die
//     URSACHE nennt und nicht nur die Wirkung.
//   · `zeilen` — die Zahl der Zeilenkästen des Textes. Ein `Range` über den Inhalt liefert einen
//     Kasten JE ZEILE; `getBoundingClientRect` des Blockes liefert immer genau einen und könnte
//     „mehrzeilig" gar nicht sehen. Ohne diese Zahl misst T1/T2 womöglich einen Titel, der ohnehin
//     in eine Zeile passte — und wäre still grün, statt es zu sagen.
const TITELMASSE = `() => {
  const rd = (z) => Math.round(z * 10) / 10;
  const zeilen = [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag"]')];
  return {
    fenster: document.documentElement.clientWidth,
    titel: zeilen.map((z) => {
      const el = z.querySelector('[data-testid="blatt-entwurf-eintrag-titel"]');
      if (!el) { return null; }
      const b = el.getBoundingClientRect();
      const stil = getComputedStyle(el);
      const bereich = document.createRange();
      bereich.selectNodeContents(el);
      const kaesten = [...bereich.getClientRects()].filter((k) => k.width > 0 && k.height > 0);
      return {
        text: el.textContent || '',
        links: rd(b.left), rechts: rd(b.right), oben: rd(b.top), unten: rd(b.bottom),
        breite: rd(b.width), hoehe: rd(b.height),
        sichtbreite: el.clientWidth, textbreite: el.scrollWidth,
        sichthoehe: el.clientHeight, texthoehe: el.scrollHeight,
        umbruch: stil.whiteSpace, kuerzung: stil.textOverflow, umbruchWort: stil.overflowWrap,
        zeilen: kaesten.length,
      };
    }),
  };
}`;

export interface Titelmass {
  text: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  breite: number;
  hoehe: number;
  sichtbreite: number;
  textbreite: number;
  sichthoehe: number;
  texthoehe: number;
  umbruch: string;
  kuerzung: string;
  umbruchWort: string;
  /** Die Zahl der Zeilenkästen — 1 heisst einzeilig, ≥ 2 heisst: der Titel ist umgebrochen. */
  zeilen: number;
}

export interface Titelbild {
  fenster: number;
  /** `null` steht für eine Zeile OHNE Titelanker — ein Fund, kein stilles Auslassen. */
  titel: (Titelmass | null)[];
}

export async function titelMessen(s: Seite, lage: string): Promise<Titelbild> {
  const bild = await s.evaluate<Titelbild>(fn(TITELMASSE));
  console.info(`JOB 3954 · ${lage} · ${JSON.stringify(bild)}`);
  return bild;
}

// ================================================================================================
// JOB 3954 R3 · DOKUMENT- UND KNOTENIDENTITÄT — was „dieselben Titel" WIRKLICH heisst.
// ================================================================================================
//
// WARUM ES DAS GIBT. Runde 2 verglich nach dem Fensterwechsel die Zahl der Einträge und die
// Titeltexte und nannte das „dieselben Knoten". Das ist falsch, und ben hat es widerlegt: er hat
// zwischen Fensterwechsel und zweiter Messung ein `blattFahren` samt `menueOeffnen` eingeschoben —
// ein vollständiges NEULADEN — und der Prüfstand blieb `Tests 15 passed (15)`, `✓ check grün`.
// Zahl und Text sind eben Eigenschaften des BESTANDES, nicht des Knotens: nach einem Neuladen steht
// derselbe Bestand wieder da, nur eben in neuen Knoten in einem neuen Dokument.
//
// WAS WIRKLICH TRÄGT: eine Marke, die NUR am Knoten und NUR im Dokument lebt und die kein Abruf
// wiederherstellen kann. Gesetzt wird sie als eigene Eigenschaft (`__job3954Marke`) direkt am
// Titelknoten, dazu eine am `document`. Beide sind Ausdruck des Laufzeitobjekts:
//   · ein `goto`/Neuladen wirft das ganze Dokument weg — die Dokumentmarke fehlt danach;
//   · ein Schliessen und Neuöffnen des Menüs hängt die Liste neu ein — React baut neue Knoten, und
//     die Knotenmarken fehlen;
//   · ein blosses Neuzeichnen (React rendert wegen `versatz` neu) fasst dieselben Knoten an und
//     lässt beide Marken stehen — genau das, was ein Fensterwechsel auslöst.
// Ein ATTRIBUT wäre die schlechtere Wahl: es steht im Markup, und wer es in die Fixtures schriebe,
// hätte es auch nach einem Neuladen wieder. Eine Eigenschaft am Objekt kann man nicht mitliefern.
export const IDENTITAETSMARKE = "__job3954Marke";

export interface Identitaet {
  /** Trägt das DOKUMENT noch die Marke? `false` heisst: es wurde neu geladen. */
  dokument: boolean;
  /** Wie viele Titelknoten die Marke noch tragen. */
  markiert: number;
  /** Wie viele Titelknoten es gerade gibt. */
  gesamt: number;
  /** Die Marke, die gelesen wurde (oder `null`). */
  marke: string | null;
}

/**
 * Die gerade sichtbaren Titelknoten UND das Dokument markieren. Gibt zurück, wie viele Knoten
 * getroffen wurden — null markierte Knoten wäre eine Markierung, die nichts festhält, und der
 * Aufrufer muss daran scheitern.
 */
export async function identitaetMarkieren(s: Seite, marke: string): Promise<number> {
  const gesetzt = await s.evaluate<number>(
    fn(`(marke) => {
  document[${JSON.stringify(IDENTITAETSMARKE)}] = marke;
  const knoten = [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag-titel"]')];
  for (const el of knoten) { el[${JSON.stringify(IDENTITAETSMARKE)}] = marke; }
  return knoten.length;
}`),
    marke,
  );
  console.info(`JOB 3954 · Identität markiert · ${gesetzt} Titelknoten · Marke ${marke}`);
  return gesetzt;
}

/** Nachsehen, ob Dokument und Knoten noch dieselben sind. Behauptet nichts — der Fall urteilt. */
export async function identitaetPruefen(
  s: Seite,
  marke: string,
  lage: string,
): Promise<Identitaet> {
  const befund = await s.evaluate<Identitaet>(
    fn(`(marke) => {
  const knoten = [...document.querySelectorAll('[data-testid="blatt-entwurf-eintrag-titel"]')];
  return {
    dokument: document[${JSON.stringify(IDENTITAETSMARKE)}] === marke,
    markiert: knoten.filter((el) => el[${JSON.stringify(IDENTITAETSMARKE)}] === marke).length,
    gesamt: knoten.length,
    marke: document[${JSON.stringify(IDENTITAETSMARKE)}] || null,
  };
}`),
    marke,
  );
  console.info(`JOB 3954 · ${lage} · Identität ${JSON.stringify(befund)}`);
  return befund;
}

// ================================================================================================
// JOB 3954 · DIE SCHALTVORRICHTUNG — jeder Auslöser einzeln, OHNE eine Produktzeile anzufassen.
// ================================================================================================
//
// DER AUSGLEICH HAT ZWEI WECKER, und beide rufen dieselbe Funktion `beiGroesse` (`Menue.tsx:258`):
// den Fensterhörer `window.addEventListener("resize", …)` (`:262`) und den Flächenbeobachter
// `new ResizeObserver(…)` auf die Fläche selbst (`:290-295`). Wer sagen will, WELCHER von beiden
// was trägt, muss je einen abschalten — alles andere ist eine Zuschreibung ohne Messung (bens
// Promptverbesserung zu JOB 3811 R2: „Behaupte die Wirksamkeit eines bestimmten Beobachters nur
// nach dessen isolierter Abschaltung").
//
// ABGESCHALTET WIRD IN DER SEITE, NICHT IM PRODUKT:
//   · `nur-fensterhoerer` löscht `window.ResizeObserver`. Dann ist
//     `typeof ResizeObserver === "undefined"`, und `Menue.tsx:291-292` baut gar keinen Beobachter —
//     derselbe Zweig, der in jsdom seit je gilt.
//   · `nur-flaechenbeobachter` fängt die ANMELDUNG eines `resize`-Hörers am `window` ab, sodass
//     `Menue.tsx:262` keinen wirksamen Hörer bekommt. Andere Ereignisarten bleiben unangetastet;
//     und `window.addEventListener("resize", …)` steht in `apps/web/src` GENAU EINMAL (selbst
//     durchsucht), der Eingriff trifft also den einen Hörer, um den es geht.
//
// DIE MARKE STEHT IM SPEICHER DER SEITE UND WIRD ZURÜCKGENOMMEN. `addInitScript` lässt sich nicht
// wieder entfernen — der Vorspann wird deshalb EINMAL eingebaut und liest bei jedem Dokumentbeginn
// die Marke. Ohne Marke ist er ein reiner Durchlass, der nur MITZÄHLT: `resizeDurchgelassen` ist
// dann der Beleg, dass das Produkt seinen Fensterhörer überhaupt anmeldet.
//
// UND DIE ABSCHALTUNG WIRD GEMESSEN, NICHT ANGENOMMEN (`schaltbefund`): eine Schaltprobe, die nichts
// abgeschaltet hat, wäre falsches Grün.
export const SCHALTER = "kw.job3954.schaltprobe";
export type Schaltung = "nur-fensterhoerer" | "nur-flaechenbeobachter" | null;

const VORSPANN = `(() => {
  var marke = null;
  try { marke = localStorage.getItem(${JSON.stringify(SCHALTER)}); } catch (e) { marke = null; }
  var z = { wahl: marke, resizeAbgefangen: 0, resizeDurchgelassen: 0, beobachterEntfernt: false, klage: null };
  window.__job3954 = z;
  if (marke === "nur-fensterhoerer") {
    try {
      delete window.ResizeObserver;
      z.beobachterEntfernt = typeof ResizeObserver === "undefined";
    } catch (e) { z.klage = String(e); }
  }
  var echt = window.addEventListener.bind(window);
  window.addEventListener = function (typ, hoerer, opts) {
    if (typ === "resize") {
      if (marke === "nur-flaechenbeobachter") { z.resizeAbgefangen += 1; return undefined; }
      z.resizeDurchgelassen += 1;
    }
    return echt(typ, hoerer, opts);
  };
})();`;

let vorspannDa = false;

/** Den Vorspann EINMAL einbauen — ein zweiter Einbau wäre ein zweiter Zähler auf demselben Hörer. */
export async function schaltvorrichtungEinbauen(s: Seite): Promise<void> {
  if (vorspannDa) {
    return;
  }
  await s.addInitScript(VORSPANN);
  vorspannDa = true;
}

/**
 * Die Marke setzen oder zurücknehmen. Sie wirkt erst mit der NÄCHSTEN Fahrt (`blattFahren`), weil
 * der Vorspann sie bei Dokumentbeginn liest — vorher gibt es die Seite noch nicht, in der ein
 * Beobachter zu löschen wäre.
 */
export async function schaltungSetzen(s: Seite, wahl: Schaltung): Promise<void> {
  await s.evaluate(
    fn(`(w) => {
  try {
    if (w === null) { localStorage.removeItem(${JSON.stringify(SCHALTER)}); }
    else { localStorage.setItem(${JSON.stringify(SCHALTER)}, w); }
  } catch (e) {}
}`),
    wahl,
  );
}

export interface Schaltbefund {
  /** Was der Vorspann vorgefunden hat — `"kein Vorspann"`, wenn er gar nicht lief. */
  wahl: string;
  /** Steht `ResizeObserver` in dieser Seite noch? */
  beobachterDa: boolean;
  beobachterEntfernt: boolean;
  /** Wie viele `resize`-Anmeldungen abgefangen wurden (−1: kein Vorspann). */
  resizeAbgefangen: number;
  /** Wie viele durchgelassen wurden — der Beleg, dass das Produkt den Hörer anmeldet. */
  resizeDurchgelassen: number;
  klage: string | null;
  marke: string | null;
}

export async function schaltbefund(s: Seite, lage: string): Promise<Schaltbefund> {
  const befund = await s.evaluate<Schaltbefund>(
    fn(`() => {
  var z = window.__job3954;
  var marke = null;
  try { marke = localStorage.getItem(${JSON.stringify(SCHALTER)}); } catch (e) { marke = 'kein Speicher'; }
  return {
    wahl: z === undefined ? 'kein Vorspann' : String(z.wahl),
    beobachterDa: typeof ResizeObserver !== 'undefined',
    beobachterEntfernt: z === undefined ? false : z.beobachterEntfernt,
    resizeAbgefangen: z === undefined ? -1 : z.resizeAbgefangen,
    resizeDurchgelassen: z === undefined ? -1 : z.resizeDurchgelassen,
    klage: z === undefined ? 'kein Vorspann' : z.klage,
    marke: marke,
  };
}`),
  );
  console.info(`JOB 3954 · ${lage} · Schaltbefund ${JSON.stringify(befund)}`);
  return befund;
}
