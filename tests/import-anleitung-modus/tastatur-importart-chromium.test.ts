// ==================================================================================================
// JOB 3196 R2 · A6 — DIE IMPORTART WIRD MIT ECHTEN TASTEN GEWÄHLT.
// ==================================================================================================
//
// bens Befund zu Runde 1: der Tastaturfall hat einen `MouseEvent("click")` verschickt und damit
// nichts über die Tastatur bewiesen. Nachgemessen, warum das in jsdom auch gar nicht anders geht:
// ein `<button>` in jsdom reagiert auf `keydown` „Enter" und „ " mit NULL Klicks, und ein
// `keydown` „Tab" bewegt den Fokus nicht (gemessen 07.09. mit einer Sonde in dieser Bühne:
// `enterDown=0 enterUp=0 space=0 tabFokus=a`). jsdom kennt die Standardaktion des User-Agents
// nicht — dieselbe Grenze, die `tests/app/mobile-drawer-keyboard-reach-mounted.test.tsx:10-17`
// ausdrücklich benennt.
//
// Also wird hier die ECHTE gebaute Anwendung in einem ECHTEN Chromium bedient, auf derselben Bühne
// wie die H3-Messungen (`tests/design/h3-blatt-buehne.ts`): Playwright drückt Tab, Enter und die
// Leertaste; Chromium löst die Standardaktion aus, nicht der Test. Nichts wird nachgebaut.
//
// GEPRÜFT WIRD DIE KETTE, die ein Mensch ohne Maus geht:
//   1. Tab erreicht die Auswahlkarte „Ganzes Dokument übernehmen" überhaupt.
//   2. Enter schaltet sie — und die Anleitung darunter wechselt mit.
//   3. Shift+Tab zurück, Leertaste schaltet auf „In Punkte analysieren" — die Anleitung wechselt
//      zurück. Beide Richtungen, beide Tasten.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { type Buehne, buehneAufbauen, fn } from "../design/h3-blatt-buehne";

/**
 * Die Bühne gibt ihre Seite als schmales `Seite`-Interface heraus (nur das, was die H3-Messungen
 * brauchen). Playwright liefert dort eine vollwertige `Page`; hier wird ausschliesslich die
 * Tastatur nachdeklariert — kein neues Verhalten, nur der Zugang zu dem, was schon da ist.
 */
interface Tastatur {
  press(taste: string): Promise<void>;
}
type SeiteMitTastatur = Buehne["seite"] & { keyboard: Tastatur };

let b: Buehne;
let seite: SeiteMitTastatur;

async function sichtbareAnleitungen(): Promise<string[]> {
  return seite.evaluate<string[]>(
    fn(`(texte) => [...document.querySelectorAll('span')].filter(el => el.getClientRects().length > 0)
      .map(el => el.textContent.trim()).filter(text => texte.includes(text))`),
    [i18n.t(CAPTURE_FILE_TEXT.hint), i18n.t(CAPTURE_FILE_TEXT.hintWhole)],
  );
}

async function warteAufImportart(gewaehlt: string, andere: string): Promise<void> {
  await seite.waitForFunction(
    fn(`([an, aus]) => {
      const karten = [...document.querySelectorAll('button[aria-pressed]')];
      const passt = (name, wert) => karten.filter(k => k.textContent.includes(name)
        && k.getAttribute('aria-pressed') === wert).length === 1;
      return passt(an, 'true') && passt(aus, 'false');
    }`),
    [gewaehlt, andere],
    { timeout: 10_000 },
  );
}

/** Trägt das gerade fokussierte Element diese Beschriftung? */
const FOKUS_TEXT = `() => {
  const el = document.activeElement;
  return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '';
}`;

/**
 * Drückt Tab, bis die Fläche mit `teil` im Text den Fokus hat. Gibt die Zahl der Anschläge zurück
 * oder -1, wenn sie in `grenze` Anschlägen nicht erreichbar war — das ist der Fang: eine Fläche,
 * die nur die Maus erreicht, kommt hier nie an.
 */
async function tabBis(teil: string, grenze = 60): Promise<number> {
  await seite.evaluate(fn("() => { document.activeElement && document.activeElement.blur(); }"));
  for (let n = 1; n <= grenze; n++) {
    await seite.keyboard.press("Tab");
    const text = await seite.evaluate<string>(fn(FOKUS_TEXT));
    if (text.includes(teil)) {
      return n;
    }
  }
  return -1;
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  b = await buehneAufbauen("/erfassen");
  seite = b.seite as SeiteMitTastatur;
}, 180_000);

afterAll(async () => {
  await b?.schliessen();
});

describe("JOB 3196 · A6 — die Importart mit echten Tasten wählen (Chromium)", () => {
  it("A6a · die Bühne steht: die echte gebaute Seite ist geladen, ohne Seitenfehler", () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    expect(b.seitenfehler, "die Seite hat beim Mounten geworfen").toEqual([]);
  });

  it("A6b · Tab erreicht die Auswahlkarte „Ganzes Dokument übernehmen“, Enter schaltet sie, und die Anleitung wechselt mit", async () => {
    if (b.fehler !== null) {
      return;
    }
    // Den Dateiimport über den echten Weg öffnen: Werkzeugzeile „Datei" → „Datei importieren".
    await seite.evaluate(
      fn(`(w) => {
        const knopf = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === w);
        knopf && knopf.click();
      }`),
      i18n.t("erfassen.werkzeug.datei"),
    );
    await seite.evaluate(
      fn(`(w) => {
        const eintrag = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === w);
        eintrag && eintrag.click();
      }`),
      i18n.t("erfassen.weg.datei"),
    );
    const punkte = String(i18n.t(CAPTURE_FILE_TEXT.importModePoints));
    const ganzes = String(i18n.t(CAPTURE_FILE_TEXT.importModeWhole));
    const punkteAnleitung = i18n.t(CAPTURE_FILE_TEXT.hint);
    const ganzesAnleitung = i18n.t(CAPTURE_FILE_TEXT.hintWhole);
    await warteAufImportart(punkte, ganzes);
    expect(await sichtbareAnleitungen()).toEqual([punkteAnleitung]);

    // NUR TASTATUR ab hier.
    const anschlaege = await tabBis(ganzes);
    expect(anschlaege, `„${ganzes}“ war mit Tab nicht erreichbar`).toBeGreaterThan(0);

    await seite.keyboard.press("Enter");
    await warteAufImportart(ganzes, punkte);
    expect(await sichtbareAnleitungen()).toEqual([ganzesAnleitung]);

    // ------------------------------------------------------------------------------------------
    // UND ZURÜCK — mit Shift+Tab und der LEERTASTE, der zweiten Taste, die einen Knopf auslöst.
    // ------------------------------------------------------------------------------------------
    // Bewusst in derselben Tastatursitzung und ohne neuen Tab-Gang: die beiden Karten liegen im
    // Baum nebeneinander, ein Shift+Tab ist genau der Weg, den ein Mensch hier geht.
    await seite.keyboard.press("Shift+Tab");
    const fokusText = await seite.evaluate<string>(fn(FOKUS_TEXT));
    expect(fokusText, "Shift+Tab hat die Punkte-Karte nicht erreicht").toContain(punkte);

    await seite.keyboard.press("Space");
    await warteAufImportart(punkte, ganzes);
    expect(await sichtbareAnleitungen()).toEqual([punkteAnleitung]);
  }, 120_000);
});
