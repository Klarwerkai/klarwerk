// @vitest-environment jsdom
// ================================================================================================
// JOB 1612 · D1 (M-6, Anker D44) — DER KLICK TRIFFT DIE RICHTIGE UEBERSCHRIFT.
// ================================================================================================
//
// BENs Abnahmesatz, woertlich (BEN-PRUEFUNG-JOB-1521-D1.md:18):
//
//   „Ein ueber mehrere Viewport-Hoehen langes Dokument mit genau zwei Ueberschriften zeigt die
//    Leiste; Klick auf Eintrag 2 scrollt zu Ueberschrift 2."
//
// Die Zaehlung dazu prueft `d44-gliederung.test.ts`. **Diese Datei prueft den Sprung selbst** —
// am gemounteten Baum, mit einem echten Klick. Denn die Positionszusage kann an einer Stelle
// brechen, die keine reine Funktion sieht: zwischen dem Index der Leiste und dem, was
// `querySelectorAll("h2, h3")` im Editor findet.
//
// ================================================================================================
// ZUR DATEIENDUNG — eine gemeldete Abweichung, kein Versehen.
// ================================================================================================
//
// Das Namensmuster der Lease lautet `tests/web/d44-*.test.ts`. Diese Datei heisst `.test.tsx`,
// **weil eine `.test.ts` kein JSX uebersetzen kann** (`error TS6142`, gemessen in JOB 1521 D1).
// Ordner und Praefix sind eingehalten; `.tsx`-Tests sind im Haus die Regel (87 Dateien unter
// `tests/app/`). BEN hat dieselbe Abweichung in JOB 1521 als „technisch begruendet und kein
// Sachmangel" eingeordnet. Sie steht trotzdem in der Rueckgabe.
//
// Das Mountmuster ist das des Hauses: `createRoot` + `act` aus `apps/web/node_modules`
// (`tests/app/a30-suchraum-grenze-mounted.test.tsx:98-100`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { D44Gliederung, D44_EDITOR_MARKE } from "../../apps/web/src/components/D44Gliederung";
// Nur importiert, nicht veraendert: ohne initialisiertes i18n scheitert `useTranslation` beim
// Laden des Moduls, und der Export kommt als `undefined` an (gemessen). Dasselbe Vorgehen wie
// `tests/app/a30-suchraum-grenze-mounted.test.tsx:101`.
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt `scrollIntoView` nicht — das Haus stubbt es (`mega17-quellen-hinweis-mounted:72`).
// Hier wird daraus ein SPY, denn die Frage ist nicht „wurde gesprungen", sondern **wohin**.
const gesprungen: HTMLElement[] = [];
Element.prototype.scrollIntoView = function scrollIntoViewStub(this: HTMLElement): void {
  gesprungen.push(this);
};

/** Ein Dokument ueber mehrere Bildschirmhoehen mit GENAU ZWEI Ueberschriften. */
const LANG_MIT_ZWEI = [
  "<h2>Konstruktion</h2>",
  "<p>Absatz</p>".repeat(200),
  "<h2>Pruefung</h2>",
  "<p>Absatz</p>".repeat(200),
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let editor: HTMLDivElement;

beforeEach(() => {
  gesprungen.length = 0;
  // Die Editorflaeche, wie das Studio sie rendert: ein Kasten mit der Marke, darin das Body-HTML.
  editor = document.createElement("div");
  editor.setAttribute(D44_EDITOR_MARKE, "true");
  editor.innerHTML = LANG_MIT_ZWEI;
  document.body.appendChild(editor);

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  editor.remove();
});

function rendern(bodyHtml: string): void {
  act(() => root.render(createElement(D44Gliederung, { bodyHtml })));
}

describe("D44 · M — der Sprung am gemounteten Baum", () => {
  it("M1 · ein langes Dokument mit genau zwei Ueberschriften ZEIGT die Leiste", () => {
    // Der Fall, an dem JOB 1521 D1 scheiterte: dort unterdrueckte eine Mindestschwelle die Leiste.
    rendern(LANG_MIT_ZWEI);
    const leiste = container.querySelector('[data-testid="d44-gliederung"]');
    expect(leiste, "die Leiste fehlt bei zwei Ueberschriften").not.toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(2);
  });

  it("M2 · Klick auf Eintrag 2 springt zu Ueberschrift 2 — dasselbe Element", () => {
    // Der Kern. `toBe` und nicht `toEqual`: es geht um Elementidentitaet, nicht um gleichen Text.
    rendern(LANG_MIT_ZWEI);
    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="d44-sprung-1"]');
    expect(knopf, "kein Knopf fuer Position 1").not.toBeNull();

    act(() => knopf?.click());

    const ueberschriften = editor.querySelectorAll<HTMLElement>("h2, h3");
    expect(gesprungen).toHaveLength(1);
    expect(gesprungen[0]).toBe(ueberschriften[1]);
    expect(gesprungen[0]?.textContent).toBe("Pruefung");
  });

  it("M3 · Klick auf Eintrag 1 springt zu Ueberschrift 1", () => {
    rendern(LANG_MIT_ZWEI);
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="d44-sprung-0"]')?.click());
    expect(gesprungen[0]).toBe(editor.querySelectorAll<HTMLElement>("h2, h3")[0]);
    expect(gesprungen[0]?.textContent).toBe("Konstruktion");
  });

  it("M4 · eine LEERE Ueberschrift dazwischen verschiebt das Sprungziel nicht", () => {
    // Die Positionszusage unter Belastung: die leere h3 erscheint nicht in der Leiste, zaehlt im
    // DOM aber mit. Der zweite SICHTBARE Eintrag muss die DRITTE Ueberschrift treffen.
    const mitLeerer = "<h2>Eins</h2><h3></h3><h2>Drei</h2>";
    editor.innerHTML = mitLeerer;
    rendern(mitLeerer);

    const knoepfe = container.querySelectorAll<HTMLButtonElement>("button");
    expect(knoepfe).toHaveLength(2);
    act(() => knoepfe[1]?.click());

    const ueberschriften = editor.querySelectorAll<HTMLElement>("h2, h3");
    expect(gesprungen[0]).toBe(ueberschriften[2]);
    expect(gesprungen[0]?.textContent).toBe("Drei");
  });

  it("M5 · ohne Ueberschrift wird nichts gerendert", () => {
    rendern("<p>Nur Text</p>");
    expect(container.querySelector('[data-testid="d44-gliederung"]')).toBeNull();
  });

  it("M6 · aus dem Body wird kein Markup in die Leiste uebernommen", () => {
    const html = "<h2>Der <strong>wichtige</strong> Teil</h2>";
    editor.innerHTML = html;
    rendern(html);
    const knopf = container.querySelector<HTMLButtonElement>("button");
    expect(knopf?.textContent).toBe("Der wichtige Teil");
    expect(knopf?.querySelector("strong")).toBeNull();
  });
});
