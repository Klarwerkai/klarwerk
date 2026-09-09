// @vitest-environment jsdom
// ================================================================================================
// JOB 3357 · ZWEI LAUF-BANNER AUF EINER SEITE TRAGEN ZWEI VERSCHIEDENE KENNUNGEN.
// ================================================================================================
//
// WIE DIESER FALL ENTSTANDEN IST: Auftrag §7 verlangt ausdrücklich, den vorhandenen
// Zustandsrenderer zu BENUTZEN statt einen zweiten zu bauen. Das ist geschehen — die Bilanz der
// Übernahme zeigt den Ausgang ihres Laufs über denselben `RunStateBanner`, den die Lauf-Kachel der
// Import-Seite fährt. Damit standen zwei Abschnitte mit derselben festen Kennung auf derselben
// Seite (`pages/Stufe2.tsx`: `<ImportRunPanel />` oben, weiter unten über
// `ImportExplore → ImportSelect → ImportGroups` die Bilanz):
//
//     <section aria-labelledby=…>  <h2 id=… class="sr-only">…   — beide Male derselbe feste Wert
//
// Zwei gleiche `id` sind kein Schönheitsfehler: `aria-labelledby` löst für BEIDE auf die ERSTE
// Überschrift auf, und die zweite Fläche trägt eine fremde Beschriftung. Zuerst war das hier als
// Befund festgeschrieben (die Behebung lag außerhalb der Zielpfade); die Steuerung hat den Pfad
// mit der Nachführung vom 08.09. 22:26 geöffnet und die Behebung zur Pflicht gemacht, wörtlich:
// „IDs je Instanz eindeutig …, der Test verlangt EINDEUTIGE IDs, nicht Duplikate."
//
// DIE BEHEBUNG IST `useId()` in `RunStateBanner`, nicht ein Präfix am Aufrufer: eine Kennung, an
// die ein Aufrufer denken muss, wird beim dritten Aufrufer vergessen. Was hier geprüft wird, ist
// deshalb die Eigenschaft selbst — zwei Instanzen, zwei Kennungen — und nicht die Schreibweise.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { RunStateBanner } from "../../apps/web/src/components/confluence-import/RunStateBanner";
// Die App-Instanz von i18next, damit `useTranslation` im Banner eine initialisierte Instanz findet.
import i18n from "../../apps/web/src/i18n";
import { importRunStateView } from "../../apps/web/src/lib/importResultView";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const lies = (p: string): string => readFileSync(resolve(process.cwd(), p), "utf8");

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root !== null) {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  }
});

/**
 * Alle Knoten mit dieser Kennung — BEWUSST über `[id]` und Vergleich statt über einen
 * `#…`-Selektor: `useId()` erzeugt Werte wie `:r0:`, die in einem Selektor maskiert werden müssten,
 * und `CSS.escape` gibt es in dieser jsdom-Fassung nicht (selbst gemessen: `CSS is undefined`).
 */
function knotenMitId(wurzel: Element, id: string): Element[] {
  return [...wurzel.querySelectorAll("[id]")].filter((el) => el.getAttribute("id") === id);
}

/** Zwei Banner nebeneinander — genau die Lage, die auf `/import` entstehen kann. */
function zweiBanner(): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement("div", null, [
        createElement(RunStateBanner, { key: "a", state: importRunStateView("COMPLETED") }),
        createElement(RunStateBanner, { key: "b", state: importRunStateView("FAILED") }),
      ]),
    );
  });
  return container;
}

describe("JOB 3357 · der Lauf-Banner steht zweimal auf einer Seite — und bleibt eindeutig", () => {
  it("F1 · beide Flächen derselben Seite fahren denselben Banner (das ist gewollt, §7)", () => {
    const stufe2 = lies("apps/web/src/pages/Stufe2.tsx");
    const groups = lies("apps/web/src/components/ImportGroups.tsx");
    expect({
      // Die Lauf-Kachel steht auf der Import-Seite …
      kachelAufDerSeite: stufe2.includes("<ImportRunPanel />"),
      kachelFaehrtDenBanner: stufe2.includes("<RunStateBanner"),
      // … und die Bilanz derselben Seite ab jetzt ebenfalls. Ohne diese zwei Zeilen wäre F2 ein
      // Fall über eine Lage, die es gar nicht gibt.
      bilanzFaehrtDenBanner: groups.includes("<RunStateBanner"),
    }).toEqual({
      kachelAufDerSeite: true,
      kachelFaehrtDenBanner: true,
      bilanzFaehrtDenBanner: true,
    });
  });

  it("F2 · zwei Instanzen, ZWEI Kennungen — keine steht doppelt im Dokument", () => {
    const c = zweiBanner();
    const abschnitte = [...c.querySelectorAll("section[aria-labelledby]")];
    const kennungen = abschnitte.map((s) => s.getAttribute("aria-labelledby") ?? "");
    expect({
      abschnitte: abschnitte.length,
      // Zwei verschiedene Kennungen — die eine feste `w2-run-heading` gibt es nicht mehr.
      verschieden: new Set(kennungen).size,
      leere: kennungen.filter((k) => k.length === 0).length,
      // Und keine davon steht zweimal im Dokument.
      doppelt: kennungen.filter((k) => knotenMitId(c, k).length !== 1),
    }).toEqual({ abschnitte: 2, verschieden: 2, leere: 0, doppelt: [] });
  });

  it("F3 · jede Kennung zeigt WIRKLICH auf die Überschrift des EIGENEN Abschnitts", () => {
    // Eindeutig allein genügt nicht: eine Kennung, die auf die Überschrift des Nachbarn zeigt,
    // wäre ebenso falsch und bliebe unter F2 unentdeckt.
    const c = zweiBanner();
    const treffer = [...c.querySelectorAll("section[aria-labelledby]")].map((s) => {
      const id = s.getAttribute("aria-labelledby") ?? "";
      const ueberschrift = knotenMitId(c, id)[0] ?? null;
      return {
        imEigenenAbschnitt: ueberschrift !== null && s.contains(ueberschrift),
        text: (ueberschrift?.textContent ?? "").trim(),
      };
    });
    expect(treffer).toEqual([
      { imEigenenAbschnitt: true, text: i18n.t("w2.run.heading") },
      { imEigenenAbschnitt: true, text: i18n.t("w2.run.heading") },
    ]);
  });

  it("F4 · die feste Kennung ist WEG — sie kann nicht zurückkehren, ohne dass es auffällt", () => {
    expect(lies("apps/web/src/components/confluence-import/RunStateBanner.tsx")).not.toContain(
      '"w2-run-heading"',
    );
  });
});
