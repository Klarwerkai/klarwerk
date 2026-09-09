// ================================================================================================
// JOB 3337 · RUNDE 7 — DIE MARKIERUNG BLEIBT IM FENSTER, UND DAS WIRD IM BROWSER GEMESSEN.
// ================================================================================================
//
// DER BEFUND (BEN, Runde 6): „Die letzte Palettenzeile verschwindet bei geringer Fensterhöhe
// vollständig unter dem sichtbaren Rand." Gemessen bei 683×384 CSS-Pixeln — dem Platz, den ein
// 1366×768-Bildschirm bei 200 % Zoom übriglässt: letzte Zeile bei y=395,58 bis 441,95, Fensterende
// bei 384. Wer mit der Tastatur ans Ende wanderte, wählte etwas aus, das er nicht sah.
//
// WARUM DIE VORHANDENEN PRÜFUNGEN DAS NICHT GEFANGEN HABEN — die Lehre dieser Runde, und es ist
// dieselbe Familie wie R6:
//   · `adressierbarkeit.test.tsx` F2 prüft, DASS `scrollIntoView` gerufen wurde. jsdom hat kein
//     Layout; der Aufruf beweist die Absicht, nicht die Wirkung. Und die Wirkung wäre hier auch
//     nicht eingetreten: `scrollIntoView` zieht die Zeile innerhalb der LISTE in Sicht — die Liste
//     selbst ragte aus dem Fenster, und daran ändert kein Scrollen innerhalb von ihr etwas.
//   · Die Zoomabnahme lief bis hierher über die BREITE (390 px). BENs Promptverbesserung sagt,
//     warum das zu wenig ist: „Zoomabnahme mit konkreter Fensterbreite UND Höhe durchführen."
//
// WAS HIER GEMESSEN WIRD: die gebaute Anwendung (`apps/web/dist`) in Chromium bei genau BENs Maß,
// 683×384. Nach JEDEM Pfeilanschlag wird die tatsächliche Lage der markierten Zeile geholt
// (`getBoundingClientRect`) und gegen zwei Grenzen gehalten — das Fenster UND den sichtbaren
// Ausschnitt der Liste. Am Ende wird gedrückt und die Route verglichen: Sichtbarkeit ohne den
// Beleg, dass dieselbe Zeile auch öffnet, wäre wieder nur die halbe Zusage (R6).
//
// EHRLICHE GRENZE: gemessen wird ein verkleinertes CSS-Fenster, nicht die native Zoomstufe des
// Browsers. Das ist derselbe Weg, den BEN gegangen ist, und dieselbe Grenze — sie steht hier, statt
// verschwiegen zu werden.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, fn, starte, wechsle } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

/** BENs Maß: der Platz, den 1366×768 bei 200 % Zoom für das Layout übriglässt. */
const BREITE = 683;
const HOEHE = 384;

/** Die Bühne reicht die rohe Playwright-Seite durch — Fenstergröße und echte Tastenanschläge. */
interface SeiteMitViewport {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}
interface SeiteMitTastatur {
  keyboard: { press(taste: string): Promise<void> };
}

let stand: Stand;

beforeAll(async () => {
  stand = await starte("/start", '[data-testid="page-start"], main', BREITE, HOEHE);
}, 120_000);

afterAll(async () => {
  try {
    await schliesseChromium(
      "tests/design/job3337-palette-flaches-fenster-chromium.test.ts",
      stand?.browser,
    );
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

function seiteRoh(): Seite & SeiteMitViewport & SeiteMitTastatur {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport & SeiteMitTastatur;
}

/** Die Lage der markierten Zeile, der Liste und des Fensters — alles in EINER Messung. */
interface Lage {
  /** Gibt es überhaupt eine Markierung? */
  markiert: boolean;
  stelle: string;
  pfad: string;
  name: string;
  zeileOben: number;
  zeileUnten: number;
  listeOben: number;
  listeUnten: number;
  fensterHoehe: number;
  /** Wie viele Zeilen stehen insgesamt da? */
  anzahl: number;
}

const LAGE = fn(`() => {
  const zeile = document.querySelector('[data-cmd-aktiv="true"]');
  const liste = document.querySelector('[data-cmd="suchfeld"]')?.closest('div')?.querySelector('ul');
  const alle = document.querySelectorAll('[data-cmd-ziel]');
  const zr = zeile ? zeile.getBoundingClientRect() : null;
  const lr = liste ? liste.getBoundingClientRect() : null;
  return {
    markiert: zeile !== null,
    stelle: zeile ? (zeile.getAttribute('data-cmd-stelle') ?? '') : '',
    pfad: zeile ? (zeile.getAttribute('data-cmd-pfad') ?? '') : '',
    name: zeile ? (zeile.querySelector('[data-cmd-name]')?.textContent ?? '') : '',
    zeileOben: zr ? zr.top : -1,
    zeileUnten: zr ? zr.bottom : -1,
    listeOben: lr ? lr.top : -1,
    listeUnten: lr ? lr.bottom : -1,
    fensterHoehe: window.innerHeight,
    anzahl: alle.length,
  };
}`);

/** Die Palette frisch öffnen — über das echte Kürzel, nicht über einen Testhaken. */
async function paletteOeffnen(): Promise<void> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: BREITE, height: HOEHE });
  await wechsle(stand, "/start", "body");
  expect(stand.fehler, "die Seite kam nicht hoch").toBeNull();
  await seite.evaluate(fn(`() => window.dispatchEvent(new Event('open-command-palette'))`));
  await seite.waitForFunction(
    fn(`() => document.querySelector('[data-cmd="suchfeld"]') !== null`),
    undefined,
    { timeout: 15_000 },
  );
}

describe("JOB 3337 · L · die Liste „Gehe zu …“ passt ins flache Fenster", () => {
  it("L0 · die Bühne steht: gebautes dist, echte App, Chromium, 683×384", async () => {
    expect(stand.fehler, "Bühne nicht bereit").toBeNull();
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
    await paletteOeffnen();
    const lage = await seiteRoh().evaluate<Lage>(LAGE);
    expect(lage.fensterHoehe, "das Fenster hat nicht BENs Maß").toBe(HOEHE);
    // Ohne genügend Zeilen misst der Fall nichts: bei drei Treffern passt jede Liste ins Fenster.
    expect(lage.anzahl, "zu wenige Ziele — der Fall wäre auch mit dem Fehler grün").toBeGreaterThan(
      10,
    );
  }, 60_000);

  it("L1 · nach JEDEM Pfeilanschlag liegt die Markierung im Fenster und im Listenausschnitt", async () => {
    await paletteOeffnen();
    const seite = seiteRoh();
    const start = await seite.evaluate<Lage>(LAGE);

    // Einmal durch die ganze Liste — nicht bis zur zehnten Zeile, sondern bis zur letzten. Genau
    // die letzte war es, die BEN unter dem Rand gefunden hat.
    for (let stelle = 0; stelle < start.anzahl; stelle += 1) {
      if (stelle > 0) {
        await seite.keyboard.press("ArrowDown");
      }
      const lage = await seite.evaluate<Lage>(LAGE);
      expect(lage.markiert, `bei Stelle ${stelle} ist nichts markiert`).toBe(true);
      expect(lage.stelle, "die Markierung ist nicht mitgewandert").toBe(String(stelle));

      // (1) IM FENSTER — die Grenze, an der R6 gescheitert ist.
      expect(
        lage.zeileUnten,
        `„${lage.name}" (Stelle ${stelle}) endet bei ${lage.zeileUnten}, das Fenster bei ${lage.fensterHoehe}`,
      ).toBeLessThanOrEqual(lage.fensterHoehe);
      expect(lage.zeileOben, `„${lage.name}" liegt über dem oberen Rand`).toBeGreaterThanOrEqual(0);

      // (2) IM SICHTBAREN AUSSCHNITT DER LISTE — sonst stünde sie zwar im Fenster, aber hinter dem
      //     Rand der scrollenden Liste. Eine halbe Zeile Toleranz für Teilpixel und Rundung.
      expect(
        lage.zeileUnten,
        `„${lage.name}" steht unter dem sichtbaren Rand der Liste (${lage.listeUnten})`,
      ).toBeLessThanOrEqual(lage.listeUnten + 1);
      expect(
        lage.zeileOben,
        `„${lage.name}" steht über dem sichtbaren Rand der Liste (${lage.listeOben})`,
      ).toBeGreaterThanOrEqual(lage.listeOben - 1);
    }
  }, 120_000);

  it("L2 · die letzte Zeile ist nicht nur sichtbar, sie öffnet auch ihr Ziel", async () => {
    await paletteOeffnen();
    const seite = seiteRoh();
    const start = await seite.evaluate<Lage>(LAGE);
    for (let i = 1; i < start.anzahl; i += 1) {
      await seite.keyboard.press("ArrowDown");
    }
    const lage = await seite.evaluate<Lage>(LAGE);
    expect(lage.stelle, "die Markierung steht nicht auf der letzten Zeile").toBe(
      String(start.anzahl - 1),
    );
    expect(
      lage.zeileUnten,
      `die letzte Zeile „${lage.name}" endet bei ${lage.zeileUnten}, das Fenster bei ${lage.fensterHoehe}`,
    ).toBeLessThanOrEqual(lage.fensterHoehe);

    await seite.keyboard.press("Enter");
    await seite.waitForFunction(
      fn(`() => document.querySelector('[data-cmd="suchfeld"]') === null`),
      undefined,
      { timeout: 15_000 },
    );
    const ort = await seite.evaluate<string>(
      fn("() => location.pathname + location.search + location.hash"),
    );
    expect(ort, `markiert war „${lage.name}" (${lage.pfad}), geöffnet wurde etwas anderes`).toBe(
      lage.pfad,
    );
  }, 120_000);

  it("L3 · KALIBRIERUNG: bei hohem Fenster bleibt die gewohnte Listenhöhe erhalten", async () => {
    const seite = seiteRoh();
    await seite.setViewportSize({ width: 1280, height: 900 });
    await wechsle(stand, "/start", "body");
    await seite.evaluate(fn(`() => window.dispatchEvent(new Event('open-command-palette'))`));
    await seite.waitForFunction(
      fn(`() => document.querySelector('[data-cmd="suchfeld"]') !== null`),
      undefined,
      { timeout: 15_000 },
    );
    const lage = await seite.evaluate<Lage>(LAGE);
    // 320 px ist die gewollte Obergrenze (`max-h-80`). Sie soll NICHT verschwunden sein — sonst
    // hätte die Reparatur die Liste auf hohen Bildschirmen unbemerkt wachsen lassen.
    const hoehe = lage.listeUnten - lage.listeOben;
    expect(hoehe, `die Liste ist bei 900 px Fensterhöhe ${hoehe} px hoch`).toBeLessThanOrEqual(321);
    expect(hoehe, "die Liste ist auf hohem Fenster zusammengefallen").toBeGreaterThan(200);
  }, 60_000);
});
