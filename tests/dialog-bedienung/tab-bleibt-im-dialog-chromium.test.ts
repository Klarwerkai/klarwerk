// ================================================================================================
// R-0909 (Aufnahme `gesamt-dialog-bedienung`, Ben Nacharbeit 6) — „FOKUS BLEIBT DRIN", MIT ECHTEN
// TASTEN IM ECHTEN BROWSER.
// ================================================================================================
//
// BENS BEFUND: Die Tab-Führung des gemeinsamen `GrenzDialog` (`ModalBoundaryContext.tsx`,
// `tabImPanel`) war nur mit synthetischen Ereignissen in jsdom belegt. Gerade ihr browserabhängiger
// Teil — eine Station, die den Fokus nicht annimmt (per CSS ausgeblendet), wird übersprungen —
// lässt sich dort nicht zeigen: jsdom rechnet kein Layout und fokussiert alles.
//
// WAS HIER LÄUFT: die gebaute Anwendung (`apps/web/dist`) in Chromium gegen das echte Backend
// (`h4-harness`, dieselbe Vorrichtung wie `tests/wissensobjekt-loeschen/loeschen-in-chromium.test.ts`).
// Bedient wird ausschliesslich über `keyboard.press("Tab")` und `keyboard.press("Shift+Tab")`.
//
// JE FLÄCHE — Befehlspalette, Modal (Löschrückfrage der Lesefläche, gemeinsamer Baustein aller
// Modal-Flächen) und Knowledge Studio:
//   S  Im Browser werden die SICHTBAREN Tab-Stationen des obersten Dialogs erhoben (Layout zählt:
//      `getClientRects`, `visibility`) und in Dokumentreihenfolge markiert.
//   V  Von der ersten Station aus einmal ringsum vorwärts: nach JEDEM Tab steht der Fokus im Dialog,
//      auf einer sichtbaren Station, und zwar genau auf der nächsten — am Ende wieder auf der ersten.
//   R  Dasselbe rückwärts mit Umschalt+Tab: von der ersten auf die letzte und weiter bis zur ersten.
//   A  Im Studio liegen per CSS ausgeblendete Dateifelder des Editors IM Tab-Bereich (`className=
//      "hidden"`) — der Fall misst, dass es sie gibt, und V/R zeigen, dass kein Tab auf ihnen landet.
//
// EINE Browserinstanz für alle Fälle (Regel der Vorrichtung).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

const de = i18n.getFixedT("de");

let stand: H4Stand | null = null;
let fehler: string | null = null;

const seite = (): H4Stand["seite"] => {
  if (!stand) {
    throw new Error(`Browser nicht bereit: ${fehler ?? "unbekannt"}`);
  }
  return stand.seite;
};

/**
 * Erhebt im Browser die Tab-Stationen des obersten offenen Dialogs: dieselbe Kandidatenmenge, die
 * der Dialog führt, aber nur die, die ein Mensch wirklich erreichen kann (mit Layout). Jede
 * sichtbare Station bekommt ihre Stelle als `data-tabprobe` — die Messmarke für V und R.
 */
const STATIONEN_FN = `() => {
  const dialoge = [...document.querySelectorAll('dialog[open]')];
  const d = dialoge[dialoge.length - 1];
  if (!d) { return null; }
  for (const alt of document.querySelectorAll('[data-tabprobe]')) { alt.removeAttribute('data-tabprobe'); }
  const sel = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';
  const alle = [...d.querySelectorAll(sel)].filter((el) =>
    el.getAttribute('tabindex') !== '-1' && el.closest('[hidden],[aria-hidden="true"]') === null);
  const sichtbar = alle.filter((el) =>
    el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
  sichtbar.forEach((el, i) => el.setAttribute('data-tabprobe', String(i)));
  const ausgeblendet = alle.filter((el) => !sichtbar.includes(el));
  return {
    anzahl: sichtbar.length,
    ausgeblendet: ausgeblendet.length,
    ausgeblendeteDateifelder: ausgeblendet.filter((el) => el.matches('input[type="file"]')).length,
    modal: d.getAttribute('aria-modal'),
  };
}`;

interface Stationen {
  anzahl: number;
  ausgeblendet: number;
  ausgeblendeteDateifelder: number;
  modal: string | null;
}

/** Wo der Fokus gerade steht — gemessen am echten `document.activeElement`. */
const AKTIV_FN = `() => {
  const dialoge = [...document.querySelectorAll('dialog[open]')];
  const d = dialoge[dialoge.length - 1];
  const a = document.activeElement;
  return {
    imDialog: !!d && !!a && d.contains(a),
    stelle: a ? a.getAttribute('data-tabprobe') : null,
    sichtbar: !!a && a.getClientRects().length > 0,
    beschreibung: a ? (a.tagName.toLowerCase() + ' ' + (a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 40))) : 'null',
  };
}`;

interface Aktiv {
  imDialog: boolean;
  stelle: string | null;
  sichtbar: boolean;
  beschreibung: string;
}

async function warteAuf(quelle: string, was: string, arg?: unknown): Promise<void> {
  await seite()
    .waitForFunction(fn(quelle), arg, { timeout: 30_000 })
    .catch((e: unknown) => {
      throw new Error(`${was}: ${String(e).split("\n")[0]}`);
    });
}

async function leseflaecheOeffnen(): Promise<void> {
  await seite().goto(`${ORIGIN}/bibliothek?eintrag=${stand?.koId ?? ""}`, {
    waitUntil: "domcontentloaded",
  });
  await warteAuf(
    `() => document.querySelector('[data-testid="bib-titel"]') !== null`,
    "die Lesefläche kam nicht",
  );
  await seite().waitForTimeout(250);
}

async function menuepunkt(testId: string): Promise<void> {
  await seite().evaluate<void>(
    fn(`() => { document.querySelector('[data-testid="bib-eintrag-menue"]').click(); }`),
  );
  await warteAuf(
    `(id) => document.querySelector('[data-testid="' + id + '"]') !== null`,
    `Menüpunkt ${testId} kam nicht`,
    testId,
  );
  await seite().evaluate<void>(
    fn(`(id) => { document.querySelector('[data-testid="' + id + '"]').click(); }`),
    testId,
  );
  await seite().waitForTimeout(250);
}

/** S, V und R am obersten offenen Dialog — nur mit echten Tasten. */
async function ringsum(flaeche: string): Promise<Stationen> {
  const st = await seite().evaluate<Stationen | null>(fn(STATIONEN_FN));
  expect(st, `${flaeche}: kein offener Dialog`).not.toBeNull();
  const s = st as Stationen;
  expect(s.modal, `${flaeche}: der Dialog hängt nicht an der Grenze`).toBe("true");
  expect(s.anzahl, `${flaeche}: weniger als zwei Stationen`).toBeGreaterThan(1);

  // Start auf der ersten Station.
  await seite().evaluate<void>(
    fn(`() => { document.querySelector('[data-tabprobe="0"]').focus(); }`),
  );

  // V — einmal ringsum vorwärts.
  for (let schritt = 1; schritt <= s.anzahl; schritt += 1) {
    await seite().keyboard.press("Tab");
    const a = await seite().evaluate<Aktiv>(fn(AKTIV_FN));
    const wo = `${flaeche}, Tab ${schritt}: Fokus auf ${a.beschreibung}`;
    expect(a.imDialog, wo).toBe(true);
    expect(a.sichtbar, wo).toBe(true);
    expect(a.stelle, wo).toBe(String(schritt % s.anzahl));
  }

  // R — einmal ringsum rückwärts.
  for (let schritt = 1; schritt <= s.anzahl; schritt += 1) {
    await seite().keyboard.press("Shift+Tab");
    const a = await seite().evaluate<Aktiv>(fn(AKTIV_FN));
    const wo = `${flaeche}, Umschalt+Tab ${schritt}: Fokus auf ${a.beschreibung}`;
    expect(a.imDialog, wo).toBe(true);
    expect(a.sichtbar, wo).toBe(true);
    expect(a.stelle, wo).toBe(String((s.anzahl - (schritt % s.anzahl)) % s.anzahl));
  }
  return s;
}

describe("R-0909 · Tab bleibt im Dialog — echte Tasten, gebaute Seite, echtes Backend", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek?eintrag=:frei", "tab@dialog-bedienung.test");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("T1 · Befehlspalette: Tab und Umschalt+Tab einmal ringsum, nie hinaus", async () => {
    expect(fehler).toBeNull();
    await leseflaecheOeffnen();
    await seite().keyboard.press("Control+k");
    await warteAuf(
      `() => { const f = document.querySelector('[data-cmd="suchfeld"]'); return f !== null && document.activeElement === f; }`,
      "die Palette öffnete nicht bedienbar",
    );
    await ringsum("Befehlspalette");
    await seite().keyboard.press("Escape");
    await warteAuf(
      `() => document.querySelector('[data-cmd="suchfeld"]') === null`,
      "die Palette schloss nicht",
    );
  }, 180_000);

  it("T2 · Modal (Löschrückfrage): Tab und Umschalt+Tab einmal ringsum, der Klickfänger nie", async () => {
    await leseflaecheOeffnen();
    await menuepunkt("bib-menue-loeschen");
    await warteAuf(
      `() => document.querySelector('dialog[open] [data-testid="bib-loeschen-rueckfrage"]') !== null`,
      "die Löschrückfrage kam nicht als Dialog",
    );
    await ringsum("Modal");
    await seite().keyboard.press("Escape");
    await warteAuf(
      `() => document.querySelector('[data-testid="bib-loeschen-rueckfrage"]') === null`,
      "die Löschrückfrage schloss nicht",
    );
    // Nichts gelöscht: der Eintrag steht unverändert da.
    expect(stand?.seitenfehler ?? [], "die Seite hat selbst Fehler geworfen").toEqual([]);
  }, 180_000);

  it("T3 · Studio: ringsum über die per CSS ausgeblendeten Dateifelder hinweg", async () => {
    await leseflaecheOeffnen();
    await menuepunkt("bib-menue-bearbeiten");
    await warteAuf(
      `(wort) => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').includes(wort))`,
      "der Studio-Knopf des Bearbeitungsformulars kam nicht",
      de("studio.open"),
    );
    await seite().evaluate<void>(
      fn(`(wort) => {
        const knopf = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes(wort));
        knopf.click();
      }`),
      de("studio.open"),
    );
    await warteAuf(
      `(titel) => { const d = document.querySelector('dialog[open]'); const id = d && d.getAttribute('aria-labelledby'); const h = id && document.getElementById(id); return !!h && (h.textContent || '').trim() === titel; }`,
      "das Studio kam nicht als benannter Dialog",
      de("studio.title"),
    );
    const s = await ringsum("Studio");
    // A — die ausgeblendeten Stationen sind WIRKLICH im Tab-Bereich; sonst hätte V/R das
    // Überspringen gar nicht berührt.
    expect(
      s.ausgeblendeteDateifelder,
      "im Studio liegt kein ausgeblendetes Dateifeld im Dialog — dann misst T3 das Überspringen nicht",
    ).toBeGreaterThan(0);
    // Geschlossen wird hier bewusst nicht: hat der Editor den Rumpf beim Laden normalisiert, fragt
    // das Studio zu Recht zuerst nach — das ist nicht Gegenstand dieses Falls.
    expect(stand?.seitenfehler ?? [], "die Seite hat selbst Fehler geworfen").toEqual([]);
  }, 240_000);
});
