// ==================================================================================================
// JOB 3194 · M6b R3 — DER GANZE RUNDWEG MIT DER TASTATUR, AN DER ECHTEN ROUTE.
// ==================================================================================================
//
// Der Weg, wie ein Mensch ihn geht, in EINEM Lauf je `${breite}/${sprache}`:
//   1. GEWÖHNLICHER Einstieg auf `/import` — ohne Anker in der Adresse. Kein Fokus wird verschoben.
//   2. Nur mit der Tastatur zum Erklärlink, Enter → Erklärseite.
//   3. BROWSER-ZURÜCK → die Galerie muss im Sichtbereich stehen UND den Fokus tragen.
//   4. Wieder zur Erklärseite, dort Rückweg-Link per Tab/Shift+Tab, Enter → dasselbe Ergebnis.
// Alles an der GEBAUTEN App (`apps/web/dist`) und an der AUSGELIEFERTEN Erklärseite
// (`dist/demonstration/importwege.html`) in echtem Chromium, über den vorhandenen Prüfstand
// `tests/design/h6-chromium.ts`. Bauform: `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts`.
//
// WARUM SCHRITT 1 OHNE ANKER BEGINNT (BENs Korrekturpflicht 2 zu Runde 2): Bis Runde 2 begann dieser
// Test auf `/import#import-source-gallery`. Damit war der Verlaufseintrag, zu dem das Browser-Zurück
// führt, VORBEREITET — der Test prüfte einen Weg, den ein Mensch so nie geht. BENs eigene Messung am
// gewöhnlichen Einstieg: Galerie nach dem Zurück bei 982/962/1208/1188 px, Fokus auf `body`.
// Ein vorab gesetzter Zielanker ersetzt diesen Fall nicht.
//
// R2 belegt den DIREKTEN Vollaufruf von `/import#import-source-gallery`. DIESE Datei belegt den Weg
// dorthin — beide Male, über den Verlauf und über den Rückweg-Link.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";

const ANKER = "import-source-gallery";
const ANKER_URL = `/import#${ANKER}`;
const ERKLAERSEITE = "/demonstration/importwege.html";
const ERKLAERLINK = `a[href="${ERKLAERSEITE}"]`;

interface SeiteMitTastatur extends Seite {
  setViewportSize(groesse: { width: number; height: number }): Promise<void>;
  keyboard: { press(taste: string): Promise<void> };
  goBack(opts?: Record<string, unknown>): Promise<unknown>;
}

interface Fokus {
  marke: string;
  umrissStil: string;
  umrissBreite: number;
}

interface Ankunft {
  url: string;
  oben: number;
  imSichtbereich: boolean;
  fokusMarke: string;
  fokusImAnker: boolean;
  /** Wie oft der Anker in DIESEM Dokument den Fokus bekam — die Zusage ist „genau einmal". */
  spruenge: number;
  /** Steht noch die Suspense-Ladefläche? Ein weißer Zwischenzustand wäre ein Fehlschlag. */
  ladeflaeche: boolean;
  /** `history.length` — für die Zusage „der Rückkehrpunkt erzeugt KEINEN Verlaufseintrag". */
  verlauf: number;
}

interface Station {
  /** Schritt 1: gewöhnlicher Aufruf von `/import`, ohne Anker. */
  einstieg: Ankunft;
  /** Wie viele Tabulatorschritte vom Seitenanfang bis zum Erklärlink nötig waren. */
  tabsBisErklaerlink: number;
  erklaerlink: Fokus;
  /** Schritt 3: nach Browser-Zurück von der Erklärseite. */
  zurueck: Ankunft;
  rueckwegNachTab: Fokus;
  rueckwegNachShiftTab: Fokus;
  /** Schritt 4: nach Enter auf dem ausdrücklichen Rückweg-Link. */
  ankunft: Ankunft;
}

let stand: Stand | undefined;
const laeufe = new Map<string, Station>();

/**
 * React 18 spült passive Effekte NACH dem Zeichnen. Die Wartezeit ist in BEIDEN Zuständen (mit und
 * ohne Fokussprung) dieselbe; sie kann einen roten Ausgangslauf nicht künstlich grün machen.
 */
const RUHE =
  "() => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fertig, 120))))";

const FOKUS = `() => {
  const el = document.activeElement;
  if (el === null) return { marke: "(kein activeElement)", umrissStil: "none", umrissBreite: 0 };
  const stil = getComputedStyle(el);
  const marke = el.id !== "" ? "#" + el.id
    : el.tagName.toLowerCase() + (el.getAttribute("href") ? "[href=" + el.getAttribute("href") + "]" : "");
  return {
    marke: marke,
    umrissStil: stil.outlineStyle,
    umrissBreite: Number.parseFloat(stil.outlineWidth) || 0,
  };
}`;

const ANKUNFT = `() => {
  const anker = document.getElementById("import-source-gallery");
  if (!anker) throw new Error("Galerie-Anker fehlt");
  const r = anker.getBoundingClientRect();
  const aktiv = document.activeElement;
  return {
    url: location.pathname + location.hash,
    oben: Math.round(r.top),
    imSichtbereich: r.top >= 0 && r.top < innerHeight && r.bottom > 0,
    fokusMarke: aktiv === null ? "(kein activeElement)" : (aktiv.id !== "" ? "#" + aktiv.id : aktiv.tagName.toLowerCase()),
    fokusImAnker: aktiv !== null && (aktiv === anker || anker.contains(aktiv)),
    spruenge: window.__m6Ankerfokus ?? -1,
    ladeflaeche: document.body.innerText.includes("Lädt"),
    verlauf: history.length,
  };
}`;

/** Nur mit der Tastatur bis zum Erklärlink der Galerie — keine Maus, kein Klick. */
async function tabBisErklaerlink(seite: SeiteMitTastatur): Promise<number> {
  for (let i = 1; i <= 60; i++) {
    await seite.keyboard.press("Tab");
    const da = await seite.evaluate<boolean>(
      fn("(sel) => document.activeElement === document.querySelector(sel)"),
      ERKLAERLINK,
    );
    if (da) return i;
  }
  return -1;
}

async function zurErklaerseite(seite: SeiteMitTastatur): Promise<void> {
  await seite.keyboard.press("Enter");
  await seite.waitForFunction(fn("(p) => location.pathname === p"), ERKLAERSEITE, {
    timeout: 30_000,
  });
  await seite.waitForFunction(fn(`() => document.querySelector("a[data-return]") !== null`));
}

async function anKommen(seite: SeiteMitTastatur): Promise<Ankunft> {
  await seite.waitForFunction(fn(`() => location.pathname === "/import"`), undefined, {
    timeout: 30_000,
  });
  await seite.waitForFunction(fn("(s) => document.querySelector(s) !== null"), `#${ANKER}`, {
    timeout: 30_000,
  });
  await seite.evaluate(fn(RUHE));
  return await seite.evaluate<Ankunft>(fn(ANKUNFT));
}

async function rundweg(breite: number, sprache: "de" | "en"): Promise<Station> {
  const schluessel = `${breite}/${sprache}`;
  const vorhanden = laeufe.get(schluessel);
  if (vorhanden) return vorhanden;
  if (!stand?.seite) throw new Error(`Chromium-Prüfstand fehlt: ${stand?.fehler ?? "unbekannt"}`);
  const seite = stand.seite as SeiteMitTastatur;
  const hoehe = breite === 390 ? 844 : 900;
  await seite.setViewportSize({ width: breite, height: hoehe });
  // Die echten Schalter des Produkts (`lib/sprachwahl.ts`, `lib/stufe2Storage.ts`); ohne Stufe 2
  // endet `/import` am Rollen-Gate (navigation.ts: minRole admin, stufe2 true).
  await seite.evaluate(
    fn(
      `(s) => { localStorage.setItem("kw.sprache", s); localStorage.setItem("kw.stufe2.v1", "1"); }`,
    ),
    sprache,
  );

  // Schritt 1: erst ein fremdes Dokument (sonst wäre der nächste Aufruf derselben Adresse eine
  // Sprungmarke IM SELBEN Dokument), dann der GEWÖHNLICHE Einstieg — ohne Anker.
  await wechsle(stand, "/start", "body");
  await wechsle(stand, "/import", `#${ANKER}`);
  expect(stand.fehler).toBeNull();
  await seite.evaluate(fn(RUHE));
  const einstieg = await seite.evaluate<Ankunft>(fn(ANKUNFT));

  // Schritt 2: nur mit der Tastatur zum Erklärlink, Enter.
  const tabsBisErklaerlink = await tabBisErklaerlink(seite);
  expect(tabsBisErklaerlink, "Erklärlink mit Tab erreichbar").toBeGreaterThan(0);
  const erklaerlink = await seite.evaluate<Fokus>(fn(FOKUS));
  await zurErklaerseite(seite);

  // Schritt 3: BROWSER-ZURÜCK. Der Verlaufseintrag ist der gewöhnliche `/import`-Einstieg.
  await seite.goBack({ waitUntil: "load" });
  const zurueck = await anKommen(seite);

  // Schritt 4: derselbe Weg noch einmal, diesmal über den ausdrücklichen Rückweg-Link.
  const tabsErneut = await tabBisErklaerlink(seite);
  expect(tabsErneut, "Erklärlink nach der Rückkehr wieder mit Tab erreichbar").toBeGreaterThan(0);
  await zurErklaerseite(seite);
  await seite.keyboard.press("Tab");
  const rueckwegNachTab = await seite.evaluate<Fokus>(fn(FOKUS));
  await seite.keyboard.press("Tab");
  await seite.keyboard.press("Shift+Tab");
  const rueckwegNachShiftTab = await seite.evaluate<Fokus>(fn(FOKUS));
  await seite.keyboard.press("Enter");
  const ankunft = await anKommen(seite);

  const station: Station = {
    einstieg,
    tabsBisErklaerlink,
    erklaerlink,
    zurueck,
    rueckwegNachTab,
    rueckwegNachShiftTab,
    ankunft,
  };
  console.info(`JOB 3194 R3 · ${schluessel}: ${JSON.stringify(station)}`);
  laeufe.set(schluessel, station);
  return station;
}

beforeAll(async () => {
  stand = await starte("/start", "body", 1440, 900);
  if (stand.seite) {
    // Der Zähler steht VOR jedem Seitenskript und zählt JEDEN Fokusgewinn des Ankers — auch einen,
    // den eine spätere Neuzeichnung auslösen würde. `-1` in der Messung hieße: nicht installiert.
    await stand.seite.addInitScript(
      `window.__m6Ankerfokus = 0;
       document.addEventListener("focusin", (e) => {
         if (e.target && e.target.id === "import-source-gallery") window.__m6Ankerfokus++;
       }, true);`,
    );
  }
}, 180_000);

afterAll(async () => {
  if (stand) await beende(stand);
}, 60_000);

describe("M6b R3 · Rundweg mit der Tastatur", () => {
  for (const breite of [1440, 390]) {
    for (const sprache of ["de", "en"] as const) {
      it(`${breite}px · ${sprache}: gewöhnlicher Einstieg → Erklärseite → Browser-Zurück → Galerie fokussiert`, async () => {
        const s = await rundweg(breite, sprache);

        // Schritt 1: der gewöhnliche Aufruf verschiebt keinen Fokus.
        expect(s.einstieg.url).toBe("/import");
        expect(s.einstieg.fokusImAnker).toBe(false);
        expect(s.einstieg.fokusMarke).toBe("body");
        expect(s.einstieg.spruenge).toBe(0);

        // Schritt 2: der Erklärlink ist mit der Tastatur erreichbar, mit SICHTBAREM Fokus.
        expect(s.erklaerlink.marke).toBe(`a[href=${ERKLAERSEITE}]`);
        expect(s.erklaerlink.umrissStil).toBe("solid");
        expect(s.erklaerlink.umrissBreite).toBeGreaterThanOrEqual(2);

        // Schritt 3 — BENs Gegenfall: Browser-Zurück landet WIRKLICH bei der Galerie.
        expect(s.zurueck.imSichtbereich, "Galerie nach Browser-Zurück im Sichtbereich").toBe(true);
        expect(s.zurueck.oben).toBeGreaterThanOrEqual(0);
        expect(s.zurueck.oben).toBeLessThan(breite === 390 ? 844 : 900);
        expect(s.zurueck.fokusImAnker, "Galerie nach Browser-Zurück fokussiert").toBe(true);
        expect(s.zurueck.spruenge).toBe(1);
        expect(s.zurueck.ladeflaeche).toBe(false);
        // Der Rückkehrpunkt ERSETZT den Verlaufseintrag, er legt keinen zweiten an: zwischen dem
        // gewöhnlichen Einstieg und der Rückkehr liegt GENAU EIN neuer Eintrag — die Erklärseite.
        // Ein zusätzlicher Eintrag hieße, dass ein zweites Zurück nötig wäre, um herauszukommen
        // (die Zusage aus `tests/app/navguard-history-authority.test.ts`, Kante 4).
        expect(
          s.zurueck.verlauf,
          "der Rückkehrpunkt darf keinen zusätzlichen Verlaufseintrag anlegen",
        ).toBe(s.einstieg.verlauf + 1);

        // Schritt 4: der ausdrückliche Rückweg-Link bleibt unverändert erhalten.
        for (const fokus of [s.rueckwegNachTab, s.rueckwegNachShiftTab]) {
          expect(fokus.marke).toBe("a[href=/import#import-source-gallery]");
          expect(fokus.umrissStil).toBe("solid");
          expect(fokus.umrissBreite).toBeGreaterThanOrEqual(2);
        }
        expect(s.ankunft.url).toBe(ANKER_URL);
        expect(s.ankunft.imSichtbereich).toBe(true);
        expect(s.ankunft.fokusImAnker).toBe(true);
        expect(s.ankunft.spruenge).toBe(1);
        expect(s.ankunft.ladeflaeche).toBe(false);
      }, 180_000);
    }
  }

  it("kein Seitenfehler auf dem ganzen Rundweg", async () => {
    await rundweg(1440, "de");
    expect(stand?.seitenfehler).toEqual([]);
    expect(stand?.fehler).toBeNull();
  }, 180_000);
});
