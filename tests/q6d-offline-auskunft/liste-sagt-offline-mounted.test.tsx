// @vitest-environment jsdom
// ================================================================================================
// JOB 3531 · Q6d — TEILFALL (a): DAS SCHWEIGEN IM ZWEIG `pausiert` WIRD EIN SATZ.
// ================================================================================================
//
// AUSGANGSLAGE, im Code belegt. `BibliothekListe.tsx` schloss die Lage `pausiert` seit JOB 3099
// aus dem Leerzweig aus („gesucht, nichts gefunden" darf ohne Abruf nicht dastehen) und setzte
// NICHTS an ihre Stelle. Der Kommentar über dem Zweig benannte die Restschuld wörtlich: der bessere
// Satz brauche einen neuen Schlüssel in `i18n.ts`, und die Datei sei belegt. Diese Sperre ist weg.
// Sichtbar wurde in dieser Lage also gar nichts — eine leere Fläche, aus der niemand ablesen kann,
// ob gesucht wurde, ob es nichts gibt oder ob die Verbindung fehlt.
//
// WAS HIER GEMESSEN WIRD und was ausdrücklich nicht: F1/F2 messen die AUSWERTUNG der Lage, also die
// zweite Hälfte der Naht — die Liste bekommt `pausiert` als Eigenschaft gereicht und entscheidet,
// was sie zeigt. Die BILDUNG der Lage (`BibliothekFlaeche.tsx`, `angehalten(query) && …`) ist die
// erste Hälfte und wird in `veralteter-leerer-cache-mounted.test.tsx` an der echten Fläche mit
// echtem `onlineManager` gemessen. Zwei Hälften, zwei Dateien, zwei Gegenproben (Auftrag §6).
//
// DIE LISTE WIRD DIREKT GEMOUNTET, nicht über die Fläche: nur so lässt sich GENAU die eine Lage
// herstellen (`pausiert` wahr, `laedt`/`fehler` falsch, kein Eintrag) und von den Nachbarlagen
// trennen. Der Suchtext läuft dabei durch einen echten Zustand im Testwirt (`useState`), sonst wäre
// „der Text bleibt stehen" die Behauptung des Tests über sich selbst und nicht über das Bauteil.
//
// UNABHÄNGIGE SOLLWERTE (Korrekturpflicht aus JOB 3034 R2, wie in `tests/bibliothek-offline-suche`):
// die Pflichttexte stehen unten als Literale und werden gegen `i18n.ts` gepinnt. Der Test liest den
// WERT, nicht den Schlüssel — ein entfernter Schlüssel würde sonst als durchgereichter Schlüsselname
// stumm grün bleiben (Auftrag §8 Punkt 2).
import { afterEach, describe, expect, it } from "vitest";

import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { BibliothekListe } from "../../apps/web/src/components/bibliothek/BibliothekListe";
import i18n from "../../apps/web/src/i18n";
import { tippe } from "../library/support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der neue Offline-Block — der Knoten, den es vor diesem Auftrag nicht gab. */
const OFFLINE = '[data-testid="bib-offline"]';
/** Der Leerzustand („Nichts gefunden.") — er darf offline gerade NICHT dastehen. */
const LEER = '[data-testid="bib-leer"]';

/** Die Pflichttexte, unabhängig von der Produktquelle hingeschrieben. */
const KLARTEXT = {
  offline: "Ohne Verbindung kann gerade nicht gesucht werden.",
  offlineWeiter: "Sobald die Verbindung wieder steht, wird die Suche von selbst fortgesetzt.",
  nichtsGefunden: "Nichts gefunden.",
} as const;

/** Der Suchbegriff, der im Feld stehen bleiben muss. */
const BEGRIFF = "Lieferanten";

function de(key: string): unknown {
  return i18n.getResource("de", "translation", key);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

/**
 * Der Testwirt um die Liste: er hält den Suchtext wirklich (`useState`) und reicht ihn zurück in
 * `q` — genau die Aufgabe, die im Produkt die Fläche übernimmt. Alles andere ist die eine Lage,
 * die dieser Test messen will.
 */
function Wirt({ pausiert }: { pausiert: boolean }): JSX.Element {
  const [q, setQ] = useState("");
  return createElement(BibliothekListe, {
    q,
    onQ: setQ,
    ortszeile: null,
    segment: "alle" as const,
    onSegment: () => {},
    menues: { punkte: null, bereich: null, filter: null },
    posten: [],
    gewaehlt: null,
    onWaehle: () => {},
    laedt: false,
    fehler: false,
    pausiert,
    hinweis: null,
    onErneut: () => {},
    gesamt: null,
    onNachladen: () => {},
    leerAktion: null,
    lage: "spalte" as const,
  });
}

function mounten(pausiert: boolean): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(Wirt, { pausiert }));
  });
}

afterEach(() => {
  if (root) {
    const alt = root;
    act(() => {
      alt.unmount();
    });
    root = null;
  }
  container?.remove();
});

function suchfeld(): HTMLInputElement {
  const feld = container.querySelector('[data-testid="bib-suche"]');
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Suchfeld fehlt");
  }
  return feld;
}

// ------------------------------------------------------------------------------------------------
// Der Wortlaut-Pin — die Sätze stehen fest, und zwar in allen drei geführten Sprachen.
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Wortlaut-Pin — die zwei neuen Sätze der Liste", () => {
  it.each([
    ["lib.liste.offline", KLARTEXT.offline],
    ["lib.liste.offlineWeiter", KLARTEXT.offlineWeiter],
  ])("%s lautet auf Deutsch genau so", (key, soll) => {
    expect(de(key)).toBe(soll);
  });

  it.each(["lib.liste.offline", "lib.liste.offlineWeiter"])(
    "%s ist in allen drei geführten Sprachen gesetzt und je Sprache eigen",
    (key) => {
      const werte = (["de", "en", "nl"] as const).map((lng) =>
        i18n.getResource(lng, "translation", key),
      );
      for (const wert of werte) {
        expect(typeof wert).toBe("string");
        expect(String(wert).trim().length).toBeGreaterThan(0);
      }
      // Kein durchgereichter deutscher Wortlaut in EN/NL — der Sprachwertewächter des Hauses in
      // Kurzform, damit ein vergessenes Übersetzen hier auffällt und nicht erst live.
      expect(new Set(werte).size).toBe(3);
    },
  );
});

// ------------------------------------------------------------------------------------------------
// F1 — das Schweigen wird zum Satz
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Q6d F1 — offline steht in der Liste ein Satz über die VERBINDUNG", () => {
  it("pausiert, leer, mit Suchbegriff → `bib-offline` trägt den Übersetzungswert, `bib-leer` fehlt", () => {
    mounten(true);
    tippe(suchfeld(), BEGRIFF);

    const block = container.querySelector(OFFLINE);
    expect(block, "der Offline-Block steht da").not.toBeNull();
    // Der WERT, nicht der Schlüssel: ein fehlender Schlüssel darf nicht als „lib.liste.offline"
    // stumm durchlaufen.
    expect(block?.textContent).toContain(KLARTEXT.offline);
    expect(block?.textContent).not.toContain("lib.liste.");

    // Und keine Aussage über den BESTAND: der Leerzustand bleibt aus, sein Satz kommt nicht vor.
    expect(
      container.querySelector(LEER),
      "offline wird nichts über den Bestand behauptet",
    ).toBeNull();
    expect(container.textContent).not.toContain(KLARTEXT.nichtsGefunden);
  });

  it("Gegenrichtung: ohne `pausiert` entsteht der Block nicht — dann greift der Leerzweig wie bisher", () => {
    mounten(false);
    tippe(suchfeld(), BEGRIFF);
    expect(container.querySelector(OFFLINE), "der Block hängt wirklich an `pausiert`").toBeNull();
    expect(container.querySelector(LEER), "der unveränderte Leerzweig").not.toBeNull();
    expect(container.textContent).toContain(KLARTEXT.nichtsGefunden);
  });
});

// ------------------------------------------------------------------------------------------------
// F2 — Wiederaufnahme erklärt, Suchtext erhalten, kein Knopf ohne Wirkung
// ------------------------------------------------------------------------------------------------
describe("JOB 3531 · Q6d F2 — der Block erklärt die Wiederaufnahme und nimmt nichts weg", () => {
  it("nennt die Wiederaufnahme, behält den Suchtext im Feld und trägt KEINEN Knopf", () => {
    mounten(true);
    tippe(suchfeld(), BEGRIFF);

    const block = container.querySelector(OFFLINE);
    expect(block, "der Offline-Block steht da").not.toBeNull();
    expect(block?.textContent, "N-0036: die Wiederaufnahme wird erklärt").toContain(
      KLARTEXT.offlineWeiter,
    );

    // N-0036: der eingetippte Suchtext bleibt stehen, während der Block sichtbar ist.
    expect(suchfeld().value).toBe(BEGRIFF);

    // Der Abruf ist `paused`, nicht gescheitert: ein „Erneut"-Knopf wäre eine Handlung ohne
    // Wirkung. Im Block steht deshalb kein bedienbares Element (Auftrag §5 Punkt 2).
    expect(block?.querySelectorAll("button, a, input").length).toBe(0);
  });
});
