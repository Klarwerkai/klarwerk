// @vitest-environment jsdom
// ================================================================================================
// PETER-20261011-P13 · DIE WISSENSKENNZAHLEN (ADMIN-11) MIT DEN P13-ERGÄNZUNGEN, GEMOUNTET.
// ================================================================================================
//
// Gefahren wird die echte Komponente `Wissenskennzahlen` gegen einen ersetzten Draht mit fiktiver
// Antwort (Agentenprüfung, keine realen Anwender):
//   L1  K3  jede Kennzahl nennt Kontext (die Auswahl), Quellenstand und Messart neben Grundmenge,
//           Zeitraum und Datenstand
//   L2  K2  Zeitraumzahlen sagen, dass das Protokoll Agentenprüfung und echte Nutzung nicht
//           unterscheidet — kein Nachweis von Alltagsnutzen
//   L3  K5  Klärbedarf: ältester offener Fall und je Vorgang die Zuständigkeit; keine hinterlegte
//           heisst ausdrücklich so, eine unbekannte nie „niemand“
//   L4  K8  die Detailliste zeigt genau die gelieferten Fälle; zurückgehaltene Titel bleiben
//           zurückgehalten
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Wissenskennzahlen as Antwort,
  Kennzahl,
} from "../../apps/web/src/api/wissenskennzahlen";

const d = vi.hoisted(() => ({ antwort: null as unknown }));

vi.mock("../../apps/web/src/api/wissenskennzahlen", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/api/wissenskennzahlen")>();
  return {
    ...echt,
    wissenskennzahlenApi: { laden: vi.fn(async () => d.antwort) },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { Wissenskennzahlen } from "../../apps/web/src/components/Wissenskennzahlen";
import i18n from "../../apps/web/src/i18n";
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STAND = "2026-10-12T12:00:00.000Z";

const KONFLIKT: Kennzahl = {
  schluessel: "konflikt",
  art: "momentaufnahme",
  einheit: "anzahl",
  wert: 3,
  zaehler: null,
  nenner: null,
  lage: "gemessen",
  erhobenSeit: null,
  trend: null,
  trendGrund: "momentaufnahme",
  arbeitsliste: "/qualitaetsaufgaben?typ=konflikt&space=space-a",
  eintraege: [
    {
      schluessel: "konflikt:c-neu",
      typ: "konflikt",
      zustand: "offen",
      titel: "Fiktiv: Drehmoment Flansch Z-1 widerspricht sich",
      arbeitsweg: "/konflikte?fall=c-neu",
      spaces: ["space-a"],
      seit: "2026-10-10T08:00:00.000Z",
      ueberfaellig: false,
      zustaendig: [],
    },
    {
      schluessel: "konflikt:c-alt",
      typ: "konflikt",
      zustand: "in_arbeit",
      titel: null,
      arbeitsweg: "/konflikte?fall=c-alt",
      spaces: ["space-a"],
      seit: "2026-09-01T08:00:00.000Z",
      ueberfaellig: false,
      zustaendig: [{ id: "u-1", name: "Fiktiv Erika Prüferin", art: "zugewiesen" }],
    },
    {
      schluessel: "konflikt:c-quelle",
      typ: "konflikt",
      zustand: "offen",
      titel: "Fiktiv: Ölstand Getriebe G-9",
      arbeitsweg: "/konflikte?fall=c-quelle",
      spaces: ["space-a"],
      seit: "2026-10-01T08:00:00.000Z",
      ueberfaellig: false,
      zustaendig: null,
    },
  ],
};

const FRAGEN: Kennzahl = {
  schluessel: "fragen",
  art: "zeitraum",
  einheit: "anzahl",
  wert: null,
  zaehler: null,
  nenner: null,
  lage: "unbekannt",
  erhobenSeit: null,
  trend: null,
  trendGrund: "unbekannt",
  arbeitsliste: null,
};

function antwort(): Antwort {
  return {
    stand: STAND,
    anfrage: { tage: 30, space: "space-a", team: null },
    zeitraum: { von: "2026-09-12T12:00:00.000Z", bis: STAND },
    vorperiode: { von: "2026-08-13T12:00:00.000Z", bis: "2026-09-12T12:00:00.000Z" },
    handlungsbedarf: [KONFLIKT],
    nutzung: [FRAGEN],
    bedarf: { lage: "nicht_erhoben", offen: null, ohneZaehlung: null, eintraege: [] },
    suche: { lage: "nicht_erhoben", deckel: 20, zuordnung: "bekannt", eintraege: [] },
    filterwerte: {
      spaces: [{ id: "space-a", name: "Fiktiv Montage" }],
      teams: [],
    },
    quellen: { vorgaenge: "ok", fragen: "fehler", luecken: "ok" },
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
          { initialEntries: ["/analytics?tage=30&space=space-a"] },
          createElement(Wissenskennzahlen),
        ),
      ),
    );
  });
  await act(flush);
}

const de = (k: string, o: Record<string, unknown> = {}): string => i18n.getFixedT("de")(k, o);
const karte = (s: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(
    `[data-testid="wkz-kennzahl"][data-schluessel="${s}"]`,
  );
  if (!el) {
    throw new Error(`Kennzahl ${s} fehlt`);
  }
  return el;
};
const feld = (el: HTMLElement, testid: string): string =>
  el.querySelector(`[data-testid="${testid}"]`)?.textContent ?? "";

beforeEach(async () => {
  d.antwort = antwort();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

describe("P13 · L1/L2 · Kontext, Quellenstand und Messart je Kennzahl", () => {
  it("K3: die Auswahl steht als Kontext, der Quellenstand je Zahl", async () => {
    await mount();
    const k = karte("konflikt");
    expect(feld(k, "wkz-kontext")).toBe(
      de("lagebild.wkz.kontext.space", { name: "Fiktiv Montage" }),
    );
    expect(feld(k, "wkz-quellenstand")).toBe(de("lagebild.wkz.quelle.ok"));
    // Eine ausgefallene Quelle ist als solche benannt — nicht als vollständig.
    expect(feld(karte("fragen"), "wkz-quellenstand")).toBe(de("lagebild.wkz.quelle.fehler"));
    // Grundmenge, Zeitraum und Datenstand stehen weiter daneben (ADMIN-11, unverändert).
    expect(k.textContent).toContain(de("wkz.details.nenner"));
    expect(k.textContent).toContain(de("wkz.details.zeitraum"));
    expect(k.textContent).toContain(de("wkz.details.datenstand"));
  });

  it("K2: Zeitraumzahlen benennen, dass Agentenprüfung und echte Nutzung nicht getrennt sind", async () => {
    await mount();
    expect(feld(karte("fragen"), "wkz-messart")).toBe(de("lagebild.wkz.messart.nutzung"));
    expect(feld(karte("konflikt"), "wkz-messart")).toBe(de("lagebild.wkz.messart.bestand"));
  });
});

describe("P13 · L3/L4 · Klärbedarf mit Zuständigkeit, nur gelieferte Fälle", () => {
  it("K5: ältester offener Fall und je Vorgang die Zuständigkeit", async () => {
    await mount();
    const k = karte("konflikt");
    // c-alt (01.09.) ist der älteste OFFENE Fall; c-neu und c-quelle sind jünger.
    const datum = formatKoTimestamp("2026-09-01T08:00:00.000Z", "de");
    expect(feld(k, "wkz-aeltester")).toBe(de("lagebild.wkz.aeltester", { datum }));

    const zeilen = [...k.querySelectorAll<HTMLElement>('[data-testid="wkz-eintrag"]')];
    const zustaendig = (s: string) =>
      feld(zeilen.find((z) => z.dataset.schluessel === s) as HTMLElement, "wkz-zustaendig");
    expect(zustaendig("konflikt:c-neu")).toBe(de("lagebild.wkz.zustaendig.niemand"));
    expect(zustaendig("konflikt:c-alt")).toBe(
      de("lagebild.wkz.zustaendig", {
        namen: `Fiktiv Erika Prüferin (${de("lagebild.wkz.zustaendig.art.zugewiesen")})`,
      }),
    );
    // Quelle unbekannt: nie als „niemand zuständig“ ausgegeben.
    expect(zustaendig("konflikt:c-quelle")).toBe(de("lagebild.wkz.quelle.fehler"));
    expect(zustaendig("konflikt:c-quelle")).not.toBe(de("lagebild.wkz.zustaendig.niemand"));
  });

  it("K8: die Liste zeigt genau die gelieferten Fälle; zurückgehaltene Titel bleiben verborgen", async () => {
    await mount();
    const k = karte("konflikt");
    const zeilen = [...k.querySelectorAll<HTMLElement>('[data-testid="wkz-eintrag"]')];
    expect(zeilen.map((z) => z.dataset.schluessel)).toEqual([
      "konflikt:c-neu",
      "konflikt:c-alt",
      "konflikt:c-quelle",
    ]);
    const alt = zeilen.find((z) => z.dataset.schluessel === "konflikt:c-alt");
    expect(alt?.textContent).toContain(de("wkz.liste.zurueckgehalten"));
    // Jeder Fall führt in seinen vorhandenen Arbeitsweg — die nächste Handlung.
    expect(alt?.querySelector("a")?.getAttribute("href")).toBe("/konflikte?fall=c-alt");
  });
});
