// @vitest-environment jsdom
// ================================================================================================
// JOB 2600 · D7 — DER NULL-KANTEN-HINWEIS SAGT SEINE URSACHE.
// ================================================================================================
//
// BENs Auflage aus dem D5-Urteil, woertlich:
//   „Die zustandsabhaengige Legende ist weiterhin nicht in jedem Zustand wahr: Null Kanten
//    koennen aus der Ubiquitaetsunterdrueckung folgen, obwohl ein freigegebenes Wissensobjekt
//    zwei Themen teilt."
//
// Und seine Pruefluecke 1, ebenfalls woertlich:
//   „Einen Bestand mit sechs sichtbaren Objekten ergaenzen, in dem Thema A an fuenf Objekten
//    vorkommt und damit ubiquitaetshalber kantenlos ist, waehrend ein freigegebenes Objekt A und
//    Thema B gemeinsam traegt. Erwartet: keine Linie zu A, aber auch nicht der Satz, kein
//    freigegebenes Objekt teile zwei Themen; stattdessen eine fuer diesen Unterdrueckungsgrund
//    wahre Erklaerung."
//
// ------------------------------------------------------------------------------------------------
// WARUM DREI FAELLE UND NICHT EINER
// ------------------------------------------------------------------------------------------------
// Eine leere Kantenliste hat mehr als einen Grund. D6 hat den Suchraum erschoepfend durchgezaehlt
// (296.009 Bestaende, 97.227 davon kantenlos): Der alte Satz ist in 70.096 Zustaenden falsch, und
// ALLE davon gehen auf die Ubiquitaetsunterdrueckung zurueck — kein einziger auf etwas anderes.
//
// Daraus folgen genau zwei Zustaende, die die Legende auseinanderhalten muss. N2 ist der falsche,
// N1 und N3 sind die beiden wahren. N3 ist der wichtigste Test dieser Datei: Er faellt, sobald
// jemand die Unterscheidung an `hatUbiquitaere` haengt statt an `unterdruecktDurchUbiquitaet` —
// die naheliegende Loesung, die in 6.984 der 97.227 Zustaende falsch liegt.
//
// Gemessen wird am gerenderten Bild, mit der ECHTEN Rechnung dahinter: der rohe Bestand geht
// durch `themenkarte()` und von dort in die Seite. Kein Fixture-Objekt, kein Nachbau.
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

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { wissensnetz: { luecken: d.fn } },
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
 * N2 · BENS GEGENFALL, Objekt fuer Objekt nach seiner Pruefluecke 1 gebaut.
 *
 * `aktenplan` traegt 5 von 6 sichtbaren Objekten — 83 %, also ueber `UBIQUITY_MAX_SHARE` (50 %)
 * und ueber `UBIQUITY_MIN_COUNT` (5). Es bekommt deshalb keine Kanten.
 *
 * Das ERSTE Objekt ist freigegeben und traegt `aktenplan` UND `vertragsrecht`. Der gemeinsame
 * Traeger ist also da; nur die Ubiquitaetsregel verhindert die Linie. Genau hier log der alte
 * Satz.
 */
const GEGENFALL: Ko[] = [
  ko("validiert", 1, "aktenplan", "vertragsrecht"), // der gemeinsame Traeger
  ko("validiert", 1, "aktenplan"),
  ko("validiert", 0, "aktenplan"),
  ko("offen", 0, "aktenplan"),
  ko("offen", 0, "aktenplan"),
  ko("offen", 0, "datenschutz"),
];

/** N1 · Kein freigegebenes Objekt traegt zwei Themen. Hier ist der alte Satz wahr. */
const OHNE_TRAEGER: Ko[] = [
  ko("validiert", 1, "vertragsrecht"),
  ko("validiert", 1, "datenschutz"),
  ko("offen", 0, "archivierung"),
  ko("offen", 0, "aufbewahrung"),
];

/**
 * N3 · DIE GEGENPROBE ZUR GEGENPROBE.
 *
 * `aktenplan` ist ubiquitaer wie in N2 — aber KEIN Objekt traegt zwei Themen. Es gibt also
 * nichts zu unterdruecken, und der alte Satz ist wahr. Wer die Legende an „gibt es einen
 * gestrichelten Knoten?" haengt, behauptet hier eine unterdrueckte Verbindung, die es nicht
 * gibt — derselbe Fehler wie vorher, nur auf der anderen Seite.
 */
const UBIQUITAER_OHNE_TRAEGER: Ko[] = [
  ko("validiert", 1, "aktenplan"),
  ko("validiert", 0, "aktenplan"),
  ko("offen", 0, "aktenplan"),
  ko("offen", 0, "aktenplan"),
  ko("offen", 0, "aktenplan"),
  ko("offen", 0, "datenschutz"),
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

/** Der gestrichelte Rand sitzt am inneren `circle`, nicht an der Knotengruppe — wie in M3. */
const strichelung = (thema: string): string | null =>
  container.querySelector(`[data-thema="${thema}"] circle`)?.getAttribute("stroke-dasharray") ??
  null;
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

describe("JOB 2600 D7 · der Null-Kanten-Hinweis sagt seine Ursache", () => {
  it("N1 · ohne gemeinsamen Traeger steht der Satz, dass keiner zwei Themen teilt", async () => {
    const karte = await mountMit(OHNE_TRAEGER);

    expect(karte.kanten.length, "kein freigegebenes Paar → keine Kante").toBe(0);
    expect(karte.unterdruecktDurchUbiquitaet, "es gibt nichts zu unterdruecken").toBe(0);

    expect(marke("legende-keine-kanten")).not.toBeNull();
    expect(marke("legende-kanten-unterdrueckt")).toBeNull();
  });

  it("N2 · bei ubiquitaetshalber unterdrueckter Kante steht der WAHRE Satz, nicht der alte", async () => {
    // DER FALL, DER D5 GEKIPPT HAT — BENs Pruefluecke 1, woertlich nachgebaut.
    const karte = await mountMit(GEGENFALL);

    // die Wirkung: gar keine Linie im Bild
    expect(karte.kanten.length).toBe(0);
    expect(kanten(), "das Bild zeigt keine einzige Kante").toHaveLength(0);

    // die Ursache: `aktenplan` ist ubiquitaer und deshalb gestrichelt
    expect(strichelung("aktenplan")).toBe("4 3");

    // und der gemeinsame Traeger existiert trotzdem — genau das zaehlt der neue Wert
    expect(
      karte.unterdruecktDurchUbiquitaet,
      "ein freigegebenes Objekt traegt aktenplan UND vertragsrecht",
    ).toBe(1);

    // DER KERN DER AUFLAGE: der alte, hier FALSCHE Satz darf NICHT erscheinen.
    expect(
      marke("legende-keine-kanten"),
      "der Satz, kein freigegebenes Objekt teile zwei Themen, ist hier eine Luege",
    ).toBeNull();

    const wahr = marke("legende-kanten-unterdrueckt");
    expect(wahr).not.toBeNull();
    // Er sagt, dass es den Zusammenhang GIBT und was ihn verdeckt — nicht, dass es keinen gibt.
    expect(wahr?.textContent).toContain("verbindet hier zwei Themen");
    expect(wahr?.textContent).toContain("Mehrheit des sichtbaren Bestands");
  });

  it("N3 · ubiquitaeres Thema OHNE gemeinsamen Traeger behaelt den alten Satz", async () => {
    // Die Probe gegen die naheliegende, falsche Loesung: ein gestrichelter Knoten allein
    // rechtfertigt den Unterdrueckungssatz NICHT.
    const karte = await mountMit(UBIQUITAER_OHNE_TRAEGER);

    expect(karte.kanten.length).toBe(0);
    expect(strichelung("aktenplan")).toBe("4 3");
    expect(
      karte.unterdruecktDurchUbiquitaet,
      "ubiquitaer ja — aber kein Objekt traegt zwei Themen, also ist nichts unterdrueckt",
    ).toBe(0);

    expect(marke("legende-keine-kanten")).not.toBeNull();
    expect(
      marke("legende-kanten-unterdrueckt"),
      "hier gibt es keinen unterdrueckten Zusammenhang zu melden",
    ).toBeNull();
  });

  it("N4 · sobald eine Kante gezeichnet wird, schweigt die Legende zu beidem", async () => {
    // Der vierte Zustand, damit die Bedingung vollstaendig abgedeckt ist: mit Kante kein Satz.
    const karte = await mountMit([
      ko("validiert", 1, "pumpe", "dichtung"),
      ko("validiert", 1, "pumpe", "dichtung"),
      ko("offen", 0, "randthema"),
    ]);

    expect(karte.kanten.length).toBeGreaterThan(0);
    expect(marke("legende-keine-kanten")).toBeNull();
    expect(marke("legende-kanten-unterdrueckt")).toBeNull();
  });

  it("N5 · der wahre Satz steht in allen drei Sprachen", async () => {
    // DE/EN/NL gemeinsam — BENs Auflage nennt das ausdruecklich.
    for (const [sprache, brocken] of [
      ["de", "Mehrheit des sichtbaren Bestands"],
      ["en", "majority of the visible stock"],
      ["nl", "meerderheid van de zichtbare verzameling"],
    ] as const) {
      await i18n.changeLanguage(sprache);
      await mountMit(GEGENFALL);
      const wahr = marke("legende-kanten-unterdrueckt");
      expect(wahr, `${sprache}: der Satz fehlt`).not.toBeNull();
      expect(wahr?.textContent, `${sprache}: nicht uebersetzt`).toContain(brocken);
      act(() => root.unmount());
      container.remove();
    }
    // Fuer das afterEach wieder einen Baum stellen.
    await mountMit(GEGENFALL);
  });
});
