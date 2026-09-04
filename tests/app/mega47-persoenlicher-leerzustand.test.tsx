// @vitest-environment jsdom
// AUFTRAG-mega47 Block D — DER PERSÖNLICHE LEERZUSTAND LÜGT NICHT MEHR.
//
// bens zweiter Befund (sammel44, kein Blocker): `mineEmpty` wurde aus der bereits FACETTIERTEN
// Endmenge berechnet (`visible`) und hat Vorrang vor dem Filter-Leerzustand. Sind einer Person
// Aufgaben zugewiesen, die eine aktive Facette gerade ausblendet, meldete die Seite sinngemäß
// „keine persönliche Arbeit" — obwohl nur der Filter zu eng war.
//
// DIE ENTSCHEIDUNG (D1, erste Variante): der persönliche Leerzustand wird VOR den additiven
// Facetten bestimmt (`nachFokus`). Begründung: die persönliche Linse beantwortet eine
// ZUSTANDSFRAGE — „ist mir überhaupt Review-Arbeit zugewiesen?" —, die Facetten eine
// ANSICHTSFRAGE — „was davon zeige ich gerade?". Beides in einen Satz zu mischen macht den Satz
// falsch. Für die Ansichtsfrage steht der generische Filter-Leerzustand schon bereit; er greift
// jetzt, weil `mineEmpty` in genau diesem Fall null ist. Es braucht dafür KEINEN neuen Text.
//
// GEGENPROBE, die dieser Test mitträgt: der Fall „gar nichts zugewiesen" muss weiterhin die
// persönliche Copy zeigen — sonst hätte die Reparatur den Leerzustand nur woanders hin verschoben.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// AUFTRAG-mega48 Block D (bens P2): mega47 hat NUR die Facetten vorgezogen. `boardFiltered` wendet
// aber schon vorher Suche, Typ, Kategorie und Schlagwort an, danach folgen Herkunft und
// Review-Fokus. Blendet EINER davon die zugewiesene Arbeit aus, sagte die Seite weiterhin „keine
// dir zugewiesene Review-Arbeit" — und das ist sachlich falsch, egal wie eng der Auftrag war.
//
// Die Entscheidung ist deshalb dieselbe, nur konsequent zu Ende geführt: die persönliche
// ZUSTANDSFRAGE wird gegen die Menge beantwortet, auf die AUSSCHLIESSLICH die persönliche Linse
// angewandt ist. Alles andere auf dieser Seite ist Sicht. Die unteren Fälle in dieser Datei fahren
// jeweils EINEN dieser vorgelagerten Sichtfilter über die echte Seite — kein Attrappen-Aufbau, kein
// direkter Aufruf der reinen Funktion.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/AuthContext")>()),
  useSession: () => ({ user: { id: "u1", name: "Pia" }, isLoading: false }) as never,
}));
vi.mock("../../apps/web/src/app/RoleContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/RoleContext")>()),
  useRole: () => ({ role: "experte", stufe2: false, setStufe2: () => {} }) as never,
}));
vi.mock("../../apps/web/src/app/ToastContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/app/ToastContext")>()),
  useToast: () => ({ push: () => {} }) as never,
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

vi.spyOn(endpoints.validation, "board").mockResolvedValue([] as never);
vi.spyOn(endpoints.directory, "list").mockResolvedValue([] as never);
vi.spyOn(endpoints.ko, "act").mockResolvedValue({} as never);

const de = (key: string): string => String(i18n.getResource("de", "translation", key));

// Zwei KOs, BEIDE der Person u1 zugewiesen — die persönliche Linse hat also echte Arbeit. Sie
// trennen sich in zwei Facetten-Dimensionen, damit eine Kreuzauswahl die Menge auf NULL bringt,
// ohne dass eine einzelne Option leer wäre (leere Optionen sind in der Schiene deaktiviert).
function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: ["u1"],
    reviewVotes: { up: 0, warn: 0, down: 0 },
    staleVotes: 0,
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// A trägt „Trust 70+" und „Öffentlich-intern", B „Trust 0" und „Vertraulich".
const A = ko({ id: "a", title: "PROBE-A", trust: 90, confidentiality: "intern" });
const B = ko({ id: "b", title: "PROBE-B", trust: 0, confidentiality: "vertraulich" });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

// Breite Darstellung: die Facetten-Schiene steht dann als Spalte im Baum und ist direkt bedienbar —
// Block D ist unabhängig vom mobilen Filterblatt.
function breit(): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

async function mount(items: KnowledgeObject[]): Promise<void> {
  (endpoints.validation.board as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    items as never,
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        // `mine=1` ist der deep-linkbare Einstieg in die persönliche Review-Liste (SCRUM-364).
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung?mine=1"] },
          createElement(Validation),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function text(): string {
  return container.textContent ?? "";
}

// JOB 3061 · H2: Suche, Herkunft, Review-Fokus und die Facettenschiene wohnen im Filter-Menü neben
// dem Segment (Pages-Art). Ein Mensch öffnet es mit einem Klick — der Test tut dasselbe. Zweimal
// aufrufen schadet nicht: das Menü bleibt offen, weil der zweite Aufruf nichts findet, was zu
// klicken wäre, sobald der Inhalt schon da ist.
async function oeffneFilter(): Promise<void> {
  if (container.querySelector('[data-testid="pruefen-menue-panel-filter"]')) {
    return;
  }
  await act(async () => {
    (
      container.querySelector('[data-testid="pruefen-menue-filter"]') as HTMLElement | null
    )?.click();
    await flush();
  });
}

// Eine Facetten-Option in der Schiene anhaken — über ihre sichtbare Beschriftung, so wie ein Mensch.
async function haken(beschriftung: string): Promise<void> {
  await oeffneFilter();
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(beschriftung),
  );
  const box = label?.querySelector<HTMLInputElement>("input[type=checkbox]");
  if (!box) {
    throw new Error(`Facetten-Option „${beschriftung}“ nicht in der Schiene gefunden`);
  }
  expect(box.disabled, `Option „${beschriftung}“ ist deaktiviert (0 Treffer)`).toBe(false);
  await act(async () => {
    box.click();
    await flush();
  });
}

// Die Datenlage ändert sich, während die Auswahl steht — über den echten Query-Cache.
async function setzeBoard(items: KnowledgeObject[]): Promise<void> {
  await act(async () => {
    qc.setQueriesData({ queryKey: ["validation", "board"] }, items);
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  breit();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
});

describe("mega47 Block D: der persönliche Leerzustand wird VOR den Facetten bestimmt", () => {
  it("Vorbedingung: mit zugewiesener Arbeit und ohne Facette zeigt die Seite die Arbeit", async () => {
    await mount([A, B]);
    expect(text()).toContain("PROBE-A");
    expect(text()).toContain("PROBE-B");
    expect(text()).not.toContain(de("val.mineEmpty.title"));
  });

  it("blendet eine Facette die zugewiesene Arbeit aus, sagt die Seite FILTER — nicht „nichts zugewiesen“", async () => {
    await mount([A, B]);

    // DER REALE WEG in diesen Zustand: erst eingrenzen, dann ändert sich die Datenlage. Eine leere
    // Kreuzauswahl lässt die Schiene selbst gar nicht erst zu — 0-Treffer-Optionen sind deaktiviert.
    // Die Lücke entsteht, wenn die AUSWAHL stehen bleibt und die MENGE sich darunter ändert.
    await haken(de("lib.facet.trustBucket.t70")); // trifft nur A
    expect(text()).toContain("PROBE-A");
    expect(text()).not.toContain("PROBE-B");

    // A ist durch und fällt vom Board. B bleibt der Person zugewiesen — sie hat also weiterhin
    // persönliche Arbeit, die gerade nur die aktive Facette ausblendet.
    await setzeBoard([B]);

    expect(text()).not.toContain("PROBE-A");
    expect(text()).not.toContain("PROBE-B");

    // Der Kern des Befunds: KEINE Behauptung über die persönliche Zuweisung …
    expect(
      text(),
      "die Seite meldet „keine persönliche Arbeit“, obwohl nur der Filter zu eng ist",
    ).not.toContain(de("val.mineEmpty.title"));
    // … sondern die ehrliche Aussage über den Filter.
    expect(text()).toContain(de("val.focusEmpty.filtered"));
  });

  it("Gegenprobe: ist wirklich nichts zugewiesen, bleibt die persönliche Copy stehen", async () => {
    // Dieselbe Linse, aber die Arbeit gehört jemand anderem — hier ist die Aussage wahr.
    await mount([ko({ id: "c", title: "PROBE-C", assignments: ["u2"] })]);
    expect(text()).not.toContain("PROBE-C");
    expect(text()).toContain(de("val.mineEmpty.title"));
    expect(text()).toContain(de("val.mineEmpty.cta"));
  });
});

// React verfolgt den Wert eines kontrollierten Feldes über einen eigenen Tracker — ein blankes
// `input.value = …` sieht es nicht. Der native Setter plus ein echtes `input`-Ereignis ist der Weg,
// den auch die übrigen gemounteten Tests dieses Repos gehen.
async function tippe(feld: HTMLInputElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function feldMitPlatzhalter(platzhalter: string): HTMLInputElement {
  const feld = [...container.querySelectorAll("input")].find(
    (i) => i.getAttribute("placeholder") === platzhalter,
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Feld mit Platzhalter „${platzhalter}“ nicht gefunden`);
  }
  return feld;
}

function knopfMitText(teil: string): HTMLElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(teil),
  );
  if (!(btn instanceof HTMLElement)) {
    throw new Error(`Knopf mit Text „${teil}“ nicht gefunden`);
  }
  return btn;
}

describe("mega48 Block D: die persönliche Aussage steht VOR allen Sichtfiltern", () => {
  it("die VOLLTEXTSUCHE blendet die zugewiesene Arbeit aus → Filter-Leerzustand, nicht „nichts zugewiesen“", async () => {
    await mount([A, B]);
    expect(text()).toContain("PROBE-A");

    // Suche ist der ERSTE Filter in `boardFiltered` — vor Herkunft, Review-Fokus und Facetten.
    await oeffneFilter();
    await tippe(feldMitPlatzhalter(de("val.filter")), "GIBTESHIERNICHT");

    expect(text()).not.toContain("PROBE-A");
    expect(text()).not.toContain("PROBE-B");
    expect(
      text(),
      "die Seite meldet „keine persönliche Arbeit“, obwohl nur die Suche zu eng ist",
    ).not.toContain(de("val.mineEmpty.title"));
    expect(text()).toContain(de("val.focusEmpty.filtered"));
  });

  it("der HERKUNFTS-Filter blendet sie aus → Filter-Leerzustand mit benanntem, zurücksetzbarem Fokus", async () => {
    await mount([A, B]);

    // „Demo" trifft keinen der beiden Beiträge (beide sind eigenes Wissen).
    await oeffneFilter();
    await act(async () => {
      knopfMitText(de("lib.demoFilter.demo")).click();
      await flush();
    });

    expect(text()).not.toContain("PROBE-A");
    expect(text()).not.toContain("PROBE-B");
    expect(text()).not.toContain(de("val.mineEmpty.title"));
    expect(text()).toContain(de("val.focusEmpty.filtered"));
    // Der generische Leerzustand kann hier mehr als der persönliche: er BENENNT den aktiven Filter
    // und bietet das Zurücksetzen an. Genau deshalb braucht es keinen neuen Text.
    expect(text()).toContain(de("val.focusReset"));
  });

  it("Gegenprobe zu beiden: OHNE Sichtfilter und ohne Zuweisung bleibt die persönliche Aussage", async () => {
    await mount([ko({ id: "d", title: "PROBE-D", assignments: ["u2"] })]);
    expect(text()).toContain(de("val.mineEmpty.title"));
    expect(text()).not.toContain(de("val.focusEmpty.filtered"));
  });
});
