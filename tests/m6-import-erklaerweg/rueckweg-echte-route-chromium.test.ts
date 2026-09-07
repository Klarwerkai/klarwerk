// ==================================================================================================
// JOB 3194 · M6b R2 — DER RÜCKWEG-ANKER AN DER ECHTEN ROUTE, NICHT AN EINER FIXTURE.
// ==================================================================================================
//
// WARUM ES DIESE DATEI GIBT. JOB 3138 belegte „der Rückweg trifft die Galerie" an einer SSR-Fixture,
// die NUR den Zielabschnitt ausliefert (`gallery-fixture.tsx`). Dort trifft jeder Anker, weil nichts
// anderes auf der Seite steht und nichts nachgeladen wird. Die echte Route ist ein anderer Fall:
// `/import` wird über `routes.tsx` (`lazy(() => import("./pages/Stufe2"))`) nachgeladen, die Galerie
// (`ImportSourceGallery.tsx:30`, `id="import-source-gallery"`) entsteht also ERST NACH dem Parsen der
// Seite. Der native Ankersprung des Browsers greift zu diesem Zeitpunkt ins Leere.
// Codex' Lehre zu 3138 R2: „Wo ein Link auf einen Anker `#…` zeigt, ist die Wirkung an der ECHTEN
// Route zu belegen (Element im Sichtbereich oder fokussiert), nicht an einer Fixture, die nur den
// Zielabschnitt enthält."
//
// GEMESSEN WIRD die GEBAUTE App aus `apps/web/dist` in echtem Chromium, über den vorhandenen
// Prüfstand `tests/design/h6-chromium.ts` (echte Fastify-App dahinter, echte Anmeldung). Bauform des
// nach `${breite}/${sprache}` geschlüsselten Laufs: `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts`.
// EINE Browserinstanz für alle vier Fälle — mehr Instanzen haben im Gesamttor fremde Browsertests
// umgeworfen (siehe Kommentar zu `wechsle` in h6-chromium.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";

const ANKER = "import-source-gallery";
const ANKER_URL = `/import#${ANKER}`;

/** h6 beschreibt nur, was h6 braucht; die Fenstergröße gehört zu dieser Messung. */
interface SeiteMitFenster extends Seite {
  setViewportSize(groesse: { width: number; height: number }): Promise<void>;
}

interface Messung {
  breite: number;
  hoehe: number;
  sprache: string;
  fenster: string;
  seitensprache: string;
  oben: number;
  unten: number;
  links: number;
  rechts: number;
  imSichtbereich: boolean;
  fokusMarke: string;
  fokusImAnker: boolean;
  /** Wie oft der Anker den Fokus bekam — „genau einmal je Ankeraufruf" ist die Zusage. */
  spruenge: number;
  /** Ist die Suspense-Ladefläche noch da? Ein weißer Zwischenzustand wäre ein Fehlschlag. */
  ladeflaeche: boolean;
}

let stand: Stand | undefined;
const messungen = new Map<string, Messung>();

/**
 * React 18 spült passive Effekte NACH dem Zeichnen. `wechsle` wartet nur darauf, dass der Anker im
 * DOM steht — zwei Einzelbilder plus eine kurze Ruhe warten darauf, dass der Effekt gelaufen ist.
 * In BEIDEN Zuständen (mit und ohne Fokussprung) endet diese Wartezeit gleich; sie kann den roten
 * Ausgangslauf also nicht künstlich grün machen.
 */
const RUHE =
  "() => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(fertig, 120))))";

const MESSEN = `() => {
  const anker = document.getElementById("import-source-gallery");
  if (!anker) throw new Error("Galerie-Anker fehlt");
  const r = anker.getBoundingClientRect();
  const aktiv = document.activeElement;
  const marke = aktiv === null
    ? "(kein activeElement)"
    : aktiv.id !== "" ? "#" + aktiv.id : aktiv.tagName.toLowerCase();
  return {
    fenster: innerWidth + "x" + innerHeight,
    seitensprache: document.documentElement.lang,
    oben: Math.round(r.top),
    unten: Math.round(r.bottom),
    links: Math.round(r.left),
    rechts: Math.round(r.right),
    imSichtbereich:
      r.top >= 0 && r.top < innerHeight && r.bottom > 0 && r.left >= 0 && r.right <= innerWidth + 1,
    fokusMarke: marke,
    fokusImAnker: aktiv !== null && (aktiv === anker || anker.contains(aktiv)),
    spruenge: window.__m6Ankerfokus ?? -1,
    ladeflaeche: document.body.textContent.includes("Lädt"),
  };
}`;

async function messen(breite: number, sprache: "de" | "en", mitAnker: boolean): Promise<Messung> {
  const schluessel = `${breite}/${sprache}/${mitAnker ? "anker" : "ohne"}`;
  const vorhanden = messungen.get(schluessel);
  if (vorhanden) return vorhanden;
  if (!stand?.seite) throw new Error(`Chromium-Prüfstand fehlt: ${stand?.fehler ?? "unbekannt"}`);
  const seite = stand.seite as SeiteMitFenster;
  const hoehe = breite === 390 ? 844 : 900;
  await seite.setViewportSize({ width: breite, height: hoehe });
  // Produktsprache und Stufe-2-Schalter sind die echten Schalter des Produkts
  // (`lib/sprachwahl.ts`, `lib/stufe2Storage.ts`); beide werden VOR dem Aufruf gesetzt, weil die
  // Route `/import` sonst am Stufe-2-Gate endet (navigation.ts: minRole admin, stufe2 true).
  await seite.evaluate(
    fn(
      `(s) => { localStorage.setItem("kw.sprache", s); localStorage.setItem("kw.stufe2.v1", "1"); }`,
    ),
    sprache,
  );
  // ERST WEG VON DER ROUTE. Ohne diesen Zwischenschritt wäre der zweite Aufruf derselben Adresse
  // eine Sprungmarken-Navigation IM SELBEN Dokument: der Browser scrollte dann zu einem Anker, den
  // die schon laufende App längst gezeichnet hat — genau die Bequemlichkeit, die es beim echten
  // Rückweg aus der Erklärseite (fremdes Dokument) NICHT gibt. Gemessen im Ausgangslauf: 1440/de
  // (erster, echter Aufruf) oben 982, alle folgenden oben 56 — das wäre ein grüner Schein gewesen.
  await wechsle(stand, "/start", "body");
  expect(stand.fehler).toBeNull();
  // Echter Vollaufruf der Route — genau das, was der Rückweg-Link der Erklärseite auslöst.
  await wechsle(stand, mitAnker ? ANKER_URL : "/import", `#${ANKER}`);
  expect(stand.fehler).toBeNull();
  await seite.evaluate(fn(RUHE));
  const m = await seite.evaluate<Omit<Messung, "breite" | "hoehe" | "sprache">>(fn(MESSEN));
  const voll: Messung = { breite, hoehe, sprache, ...m };
  console.info(`JOB 3194 R2 · ${schluessel}: ${JSON.stringify(voll)}`);
  expect(voll.fenster).toBe(`${breite}x${hoehe}`);
  expect(voll.seitensprache).toBe(sprache);
  messungen.set(schluessel, voll);
  return voll;
}

beforeAll(async () => {
  // Startpfad nur, um Browser, echte App und Anmeldung hochzufahren; `body` steht immer.
  // Die eigentlichen Aufrufe fahren danach über `wechsle` — jeder ein echter Vollaufruf.
  stand = await starte("/start", "body", 1440, 900);
  if (stand.seite) {
    // Der Zähler steht VOR jedem Seitenskript: er zählt JEDEN Fokusgewinn des Ankers, auch einen,
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

describe("M6b R2 · /import#import-source-gallery an der echten Route", () => {
  it("Prüfstand steht: gebaute App, echte Route, kein Seitenfehler", async () => {
    await messen(1440, "de", true);
    expect(stand?.fehler).toBeNull();
    expect(stand?.seitenfehler).toEqual([]);
  }, 120_000);

  for (const breite of [1440, 390]) {
    for (const sprache of ["de", "en"] as const) {
      it(`${breite}px · ${sprache}: der Anker liegt im Sichtbereich und trägt den Fokus`, async () => {
        const m = await messen(breite, sprache, true);
        // Der Zweck: wer aus der Erklärseite zurückkommt, hat die Galerie vor sich …
        expect(m.imSichtbereich).toBe(true);
        expect(m.oben).toBeGreaterThanOrEqual(0);
        expect(m.oben).toBeLessThan(m.hoehe);
        // … und kann sofort weitertippen.
        expect(m.fokusImAnker).toBe(true);
        // Genau EIN Sprung je Ankeraufruf — nicht bei jeder Neuzeichnung.
        expect(m.spruenge).toBe(1);
        // Kein weißer Zwischenzustand und keine stehengebliebene Ladefläche.
        expect(m.ladeflaeche).toBe(false);
      }, 120_000);
    }
  }

  // Gegenprobe G4 als eigener Fall: ein gewöhnlicher Aufruf klaut keinen Fokus.
  it("ohne Anker: /import verschiebt den Fokus nicht (kein Fokusklau)", async () => {
    const m = await messen(1440, "de", false);
    expect(m.fokusImAnker).toBe(false);
    expect(m.fokusMarke).toBe("body");
    expect(m.spruenge).toBe(0);
  }, 120_000);
});
