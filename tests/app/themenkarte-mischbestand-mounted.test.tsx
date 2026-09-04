// @vitest-environment jsdom
// ================================================================================================
// JOB 2600 · D4 — DER GEMOUNTETE MISCHBESTAND.
// ================================================================================================
//
// BENs Auflage zu D3, woertlich: D3 „laesst gerade den geforderten GEMOUNTETEN MISCHBESTAND
// unbestimmt und bietet mit Fassung A erneut einen nicht fuer alle Zustaende wahrheitsgemaessen
// Nutzertext an."
//
// WAS DIESER TEST ANDERS MACHT ALS `themenkarte-mounted.test.tsx`. Der Nachbar mountet eine
// FERTIGE Karte — ein von Hand geschriebenes `themenkarte`-Objekt. Damit prueft er den Renderer,
// aber nicht die Aussage. Zwischen einem Bestand und dem Bild liegt jedoch die ganze Rechnung:
// Rechte, Groesse, Farbe, Ubiquitaet, Kantenauswahl. Wer die Karte von Hand schreibt, prueft
// genau diese Strecke NICHT.
//
// Hier laeuft deshalb der DURCHSTICH: ein roher, GEMISCHTER Bestand geht durch die echte
// `themenkarte()` aus `services/wissensnetz/src/themenkarte.ts` und von dort in die Seite. Was
// unten geprueft wird, ist das gerenderte Bild — und die Frage lautet jedes Mal: sagt es fuer
// GENAU DIESEN Bestand die Wahrheit?
//
// DER BESTAND IST ABSICHTLICH GEMISCHT (§2.1 des Auftrags):
//   · freigegebene UND unfreigegebene Objekte nebeneinander
//   · belegte UND unbelegte Objekte nebeneinander
//   · ein Thema ueber der Ubiquitaetsschwelle und mehrere darunter
//   · ein Thema, das AUSSCHLIESSLICH an unfreigegebenen Objekten haengt
// Ein Test auf sauberen Bestand beweist wenig; die Wahrheit zeigt sich im Mischfall.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const state = { resolve: (_v: unknown) => {} };
  const fn = vi.fn(
    () =>
      new Promise((resolve) => {
        state.resolve = resolve;
      }),
  );
  return { fn, resolve: (v: unknown) => state.resolve(v) };
});

// JOB 3052 D6: die Seitenleiste fragt die Bibliothekssuche nach dem gewaehlten Thema; hier
// antwortet sie leer — geprueft wird sie in tests/wissensnetz-flaeche/seitenleiste-mounted.test.tsx.
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { wissensnetz: { luecken: d.fn }, library: { search: async () => [] } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Wissensnetz } from "../../apps/web/src/pages/Wissensnetz";
// DIE ECHTE RECHNUNG — nicht nachgebaut, nicht von Hand geschrieben.
import { themenkarte } from "../../services/wissensnetz/src/themenkarte";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Ko {
  status: string;
  sources: string[];
  tags: string[];
}
const ko = (status: string, quellen: number, ...tags: string[]): Ko => ({
  status,
  sources: Array.from({ length: quellen }, (_, i) => `q${i}`),
  tags,
});

/**
 * DER MISCHBESTAND — zwoelf sichtbare Objekte, jede Kombination vertreten.
 *
 * `wartung` traegt 7 von 12 (58 %, >50 %, ≥5) → ueber der Ubiquitaetsschwelle, bekommt KEINE
 * Kanten. `pumpe` und `dichtung` liegen darunter und teilen zwei freigegebene Objekte → eine
 * Kante. `entwurf` haengt AUSSCHLIESSLICH an unfreigegebenen Objekten → Farbe `offen`.
 * `frostschutz` ist freigegeben, aber ohne Quelle → Farbe `freigegeben`.
 */
const MISCHBESTAND: Ko[] = [
  // freigegeben UND belegt — traegt `pumpe` und `dichtung` gemeinsam (stiftet die Kante)
  ko("validiert", 2, "pumpe", "dichtung", "wartung"),
  ko("validiert", 1, "pumpe", "dichtung", "wartung"),
  // freigegeben, aber OHNE Quelle
  ko("validiert", 0, "frostschutz", "wartung"),
  ko("validiert", 0, "frostschutz"),
  // freigegeben und belegt, nur ein Thema
  ko("validiert", 3, "pumpe", "wartung"),
  // NICHT freigegeben — zaehlen fuer die Groesse, nie fuer Kanten
  ko("offen", 0, "entwurf", "wartung"),
  ko("offen", 2, "entwurf", "wartung"),
  ko("offen", 0, "entwurf"),
  ko("offen", 1, "dichtung", "wartung"),
  ko("offen", 0, "randthema"),
  ko("offen", 0, "randthema"),
  ko("validiert", 1, "pumpe"),
];

async function mountMit(bestand: Ko[]): Promise<ReturnType<typeof themenkarte>> {
  const karte = themenkarte(bestand as never);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/wissensnetz"] },
          createElement(Wissensnetz),
        ),
      ),
    );
    await flush();
  });
  await act(async () => {
    d.resolve({
      objekteGesamt: bestand.length,
      ohneThema: 0,
      sichtbareBeitragendeGesamt: bestand.length,
      themen: [],
      themenkarte: karte,
    });
    await flush();
  });
  await act(flush);
  return karte;
}

const knotenFuer = (thema: string): Element | null =>
  container.querySelector(`[data-testid="themenknoten"][data-thema="${thema}"]`);
const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const kanten = (): Element[] => [...container.querySelectorAll('[data-testid="themenkante"]')];

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2600 D4 · der gemountete Mischbestand", () => {
  it("M1 · jede der drei Farben steht am RICHTIGEN Knoten — im selben Bild", async () => {
    // Der entscheidende Fall. Ein Bestand, in dem alle drei Zustaende gleichzeitig vorkommen:
    // Ein sauberer Bestand koennte jede Farbe zufaellig richtig treffen; hier muss die Rechnung
    // sie AUSEINANDERHALTEN.
    await mountMit(MISCHBESTAND);

    // `pumpe`: freigegebene Traeger MIT Quelle → belegt
    expect(knotenFuer("pumpe")?.getAttribute("data-farbe")).toBe("belegt");
    // `frostschutz`: freigegeben, aber KEIN Traeger hat eine Quelle → freigegeben
    expect(knotenFuer("frostschutz")?.getAttribute("data-farbe")).toBe("freigegeben");
    // `entwurf`: NUR unfreigegebene Traeger — auch der mit zwei Quellen zaehlt nicht → offen
    expect(
      knotenFuer("entwurf")?.getAttribute("data-farbe"),
      "eine Quelle an einem unfreigegebenen Objekt darf nicht als Beleg durchgehen",
    ).toBe("offen");
  });

  it("M2 · die Knotengroesse folgt dem SICHTBAREN Bestand, freigegeben oder nicht", async () => {
    const karte = await mountMit(MISCHBESTAND);

    // `wartung` traegt 7 Objekte, `entwurf` 3 — beide zaehlen unfreigegebene Traeger mit.
    expect(knotenFuer("wartung")?.getAttribute("data-objekte")).toBe("7");
    expect(knotenFuer("entwurf")?.getAttribute("data-objekte")).toBe("3");

    // Und das Bild bildet die Ordnung ab: mehr Objekte → groesserer Radius.
    const r = (thema: string): number =>
      Number(container.querySelector(`[data-thema="${thema}"] circle`)?.getAttribute("r") ?? "0");
    expect(r("wartung")).toBeGreaterThan(r("entwurf"));

    // Gegenprobe gegen eine stille Verwechslung von Bestand und Karte:
    expect(karte.themen.find((k) => k.thema === "wartung")?.objekte).toBe(7);
  });

  it("M3 · das ubiquitaere Thema traegt die Strichelung UND keine Kante", async () => {
    await mountMit(MISCHBESTAND);

    // `wartung`: 7 von 12 sichtbaren Objekten — ueber der Schwelle.
    const w = container.querySelector('[data-thema="wartung"] circle');
    expect(w?.getAttribute("stroke-dasharray"), "ubiquitaer, also gestrichelt").toBe("4 3");

    // Und KEINE Kante beruehrt es — obwohl es mit `pumpe` und `dichtung` freigegebene Objekte teilt.
    for (const k of kanten()) {
      expect(k.getAttribute("data-a")).not.toBe("wartung");
      expect(k.getAttribute("data-b")).not.toBe("wartung");
    }

    // Die nicht-ubiquitaeren Knoten sind NICHT gestrichelt — sonst saehe alles gleich aus.
    expect(
      container.querySelector('[data-thema="pumpe"] circle')?.getAttribute("stroke-dasharray"),
    ).toBeNull();
  });

  it("M4 · eine Kante entsteht nur aus FREIGEGEBENEN Objekten", async () => {
    await mountMit(MISCHBESTAND);

    const paare = kanten().map((k) => `${k.getAttribute("data-a")}—${k.getAttribute("data-b")}`);
    // `pumpe` und `dichtung` teilen zwei freigegebene Objekte → Kante.
    expect(paare).toContain("dichtung—pumpe");
    // `dichtung` und `wartung` teilen ein UNfreigegebenes Objekt — das stiftet nichts.
    expect(paare.some((p) => p.includes("wartung"))).toBe(false);
  });

  it("M5 · die Legende zeigt NUR die Farben, die im Bild vorkommen", async () => {
    // Fassung A zeigte immer alle drei Marken. Eine Legende, die eine Farbe erklaert, die nicht
    // zu sehen ist, sagt ueber DIESES Bild die Unwahrheit.
    await mountMit(MISCHBESTAND);
    for (const f of ["belegt", "freigegeben", "offen"]) {
      expect(container.querySelector(`span[data-farbe="${f}"]`), `${f} kommt vor`).not.toBeNull();
    }

    // Gegenprobe: ein Bestand OHNE unfreigegebene Objekte darf die Marke `offen` nicht zeigen.
    act(() => root.unmount());
    container.remove();
    await mountMit([
      ko("validiert", 1, "pumpe", "dichtung"),
      ko("validiert", 1, "pumpe", "dichtung"),
      ko("validiert", 0, "frostschutz"),
    ]);
    expect(container.querySelector('span[data-farbe="belegt"]')).not.toBeNull();
    expect(container.querySelector('span[data-farbe="freigegeben"]')).not.toBeNull();
    expect(
      container.querySelector('span[data-farbe="offen"]'),
      "kein Knoten ist offen — die Marke darf nicht dastehen",
    ).toBeNull();
  });

  it("M6 · der Ubiquitaetssatz steht NUR, wenn ein Knoten gestrichelt ist", async () => {
    // BENs zweiter Punkt: „Fassung A ist nicht fuer alle Zustaende wahr." Der Satz erklaerte eine
    // Strichelung, die es im Bild gar nicht geben musste.
    await mountMit(MISCHBESTAND);
    expect(marke("legende-ubiquitaer"), "hier IST ein Knoten gestrichelt").not.toBeNull();

    act(() => root.unmount());
    container.remove();
    // Kein Thema ueber der Schwelle: vier Objekte, kein Thema mit ≥5 Traegern.
    await mountMit([
      ko("validiert", 1, "pumpe", "dichtung"),
      ko("validiert", 1, "pumpe", "dichtung"),
      ko("validiert", 1, "frostschutz"),
      ko("offen", 0, "entwurf"),
    ]);
    expect(
      container.querySelector('[data-testid="themenknoten"] circle[stroke-dasharray]'),
      "kein Knoten ist gestrichelt",
    ).toBeNull();
    expect(
      marke("legende-ubiquitaer"),
      "ohne gestrichelten Knoten darf der Satz nicht dastehen",
    ).toBeNull();
  });

  it("M7 · ohne jede Kante sagt die Karte, WARUM — statt es der Strichelung zu ueberlassen", async () => {
    // Der Zustand, den Fassung A verschwieg: Wenn gar nichts verbindet, laese ein Mensch die
    // Strichelung als Grund. Hier teilt kein freigegebenes Objekt zwei Themen.
    await mountMit([
      ko("validiert", 1, "pumpe"),
      ko("validiert", 1, "dichtung"),
      ko("offen", 0, "entwurf", "randthema"),
    ]);
    expect(kanten().length, "keine Kante im Bild").toBe(0);
    expect(marke("legende-keine-kanten"), "der Grund gehoert hin").not.toBeNull();

    // Gegenprobe: sobald eine Kante da ist, verschwindet der Satz.
    act(() => root.unmount());
    container.remove();
    await mountMit(MISCHBESTAND);
    expect(kanten().length).toBeGreaterThan(0);
    expect(marke("legende-keine-kanten"), "mit Kanten waere der Satz falsch").toBeNull();
  });

  it("M8 · KALIBRIERUNG: der Durchstich misst wirklich die echte Rechnung", async () => {
    // Ohne diesen Fall waeren M1..M7 auch dann gruen, wenn `themenkarte()` gar nicht liefe und
    // die Seite eine leere Karte zeigte.
    const karte = await mountMit(MISCHBESTAND);
    expect(karte.themen.length, "die Rechnung hat Knoten erzeugt").toBeGreaterThan(3);
    expect(
      container.querySelectorAll('[data-testid="themenknoten"]').length,
      "und das Bild zeigt genau sie",
    ).toBe(karte.themen.length);
    // Die Ubiquitaetsentscheidung stammt aus der Rechnung, nicht aus diesem Test.
    expect(karte.themen.find((k) => k.thema === "wartung")?.ohneKanten).toBe(true);
    expect(karte.themen.find((k) => k.thema === "pumpe")?.ohneKanten).toBe(false);
  });
});
