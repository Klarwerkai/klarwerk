// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0212, Test 2 von 2) · DER WIDERSPRUCH HÄLT AUCH AUF DEM SCHMALEN BILDSCHIRM.
// ================================================================================================
//
// Zielzustand: „Ein Widerspruch zwischen Wissensständen wird nicht nur in der Oberfläche gezeigt,
// sondern hält auch über die Schnittstelle und auf schmalen Bildschirmen." Test 1
// (`r0212-konflikt-ueber-schnittstelle.test.ts`) belegt, dass `/api/kos` den Konflikt liefert.
// Hier: dieselbe Auskunft erreicht die Bibliothek bei 390 px — in der Liste UND im Bericht, der
// dort die Fläche allein trägt (JOB 3121). Gegenprobe: breit zeigt dasselbe.
//
// Der Aufbau (Hook-Attrappen, `matchMedia`-Attrappe, Mount) ist der des Telefon-Tests
// `tests/bibliothek-schmal/bibliothek-auf-dem-telefon-mounted.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// k1 steht laut SERVER in einem offenen Konflikt (`anzeigestatus: "konflikt"`, erhoben — so wie
// `GET /api/kos` ihn seit R-0212 liefert). Die Konfliktliste der Fläche (`useConflicts`) ist LEER:
// die Auskunft kommt ausschließlich über die Schnittstelle. k2 ist die Gegenprobe.
const HERKUNFT_ERHOBEN = {
  status: "geprueft",
  zuweisungen: "geprueft",
  bewertungen: "geprueft",
  konflikt: "geprueft",
  revalidierung: "geprueft",
  ungeprueft: {},
};
const KOS = [
  ko({
    id: "k1",
    title: "Ventil X bei Überdruck schließen",
    anzeigestatus: "konflikt",
    anzeigestatusHerkunft: HERKUNFT_ERHOBEN,
  } as unknown as Partial<KnowledgeObject>),
  ko({
    id: "k2",
    title: "Rührwerk Y vor der Reinigung entlüften",
    anzeigestatus: "validiert",
    anzeigestatusHerkunft: HERKUNFT_ERHOBEN,
  } as unknown as Partial<KnowledgeObject>),
];

/** Der Zeitpunkt des zuletzt ERFOLGREICHEN Abrufs — die Zahl im Auffrischungssatz stammt aus ihm. */
const ZULETZT_ERFOLGREICH = Date.parse("2026-09-06T09:30:00.000Z");

const stand = vi.hoisted(() => ({ auffrischungScheitert: false, rufe: 0 }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ruf = () => {
    stand.rufe += 1;
    return Promise.resolve({});
  };
  const ok = <T,>(data: T) => ({
    data,
    isLoading: false,
    isError: false,
    isRefetchError: false,
    isFetching: false,
    isStale: false,
    fetchStatus: "idle",
    dataUpdatedAt: ZULETZT_ERFOLGREICH,
    error: null,
    refetch: ruf,
  });
  const alt = <T,>(data: T) => ({
    ...ok(data),
    isError: true,
    isRefetchError: true,
    error: new Error("Netz weg"),
  });
  return {
    useKos: () => (stand.auffrischungScheitert ? alt(KOS) : ok(KOS)),
    useLibrarySearch: () => (stand.auffrischungScheitert ? alt(KOS) : ok(KOS)),
    useDirectory: () => ok([{ id: "u9", name: "Eva" }]),
    useConflicts: () => ok([]),
    useEigeneBefunde: () => ok([]),
    useKo: (id: string) => ok(KOS.find((k) => k.id === id)),
    // JOB 4155 (WG-LUECKEN) · NACHGEFÜHRT: die Lesespalte fragt jetzt auch die gesetzten
    // Beziehungen ab. Sie antwortet hier absichtlich noch nicht — dieser Prüfstand misst die
    // schmale Anordnung samt Auffrischungssatz, und ohne Antwort bleibt der Bereich eine leere
    // Fläche. So bleibt insbesondere „genau EIN Wiederholknopf" eine Aussage über DIESE Fläche.
    useKoBeziehungen: () => ({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: () => Promise.resolve({}),
    }),
    useAudit: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "off" }),
    koQueryKey: (id: string) => ["ko", id],
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- Die Attrappe für `matchMedia` -------------------------------------------------------------
// Sie beantwortet GENAU die Abfrage der Fläche (`max-width: 759px`) und führt ihre Hörer, damit ein
// Breitenwechsel OHNE Neuladen ankommt (F9). Bauform wie `tests/wissensnetz-leseweg/leseweg.test.tsx`.
type Hoerer = () => void;
let hoerer: Hoerer[] = [];
let istSchmal = false;
function setzeBreite(schmal: boolean): void {
  hoerer = [];
  istSchmal = schmal;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    get matches() {
      return istSchmal && /max-width:\s*759px/.test(abfrage);
    },
    media: abfrage,
    addEventListener: (_typ: string, fn: Hoerer) => {
      hoerer.push(fn);
    },
    removeEventListener: (_typ: string, fn: Hoerer) => {
      hoerer = hoerer.filter((h) => h !== fn);
    },
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function flaeche(adresse: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(Library)),
      ),
    );
  });
}

beforeEach(() => {
  setzeBreite(false);
  stand.auffrischungScheitert = false;
  stand.rufe = 0;
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  hoerer = [];
});

function da(marke: string): HTMLElement | null {
  const el = container.querySelector(`[data-testid="${marke}"]`);
  return el instanceof HTMLElement ? el : null;
}
function zeilen(): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="bib-zeile"]')];
}

function zeile(id: string): HTMLElement {
  const el = container.querySelector(`[data-testid="bib-zeile"][data-bib-id="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Zeile „${id}“ fehlt`);
  }
  return el;
}
/** Das Zustandswort der Listenzeile — die Meta-Zeile trägt „Bereich · Zustand". */
function zeilenWort(id: string): string {
  const meta = zeile(id).querySelector('[data-bib-text="zeile-meta"]');
  return (meta?.textContent ?? "").split("·").slice(1).join("·").trim();
}
function zeilenPunktKritisch(id: string): boolean {
  return (zeile(id).querySelector('[data-testid="bib-punkt"]')?.className ?? "").includes(
    "bg-trust-crit-fill",
  );
}
function pille(): { wort: string; herkunft: string | null } {
  const el = da("bib-pille");
  if (!el) {
    throw new Error("Pille fehlt");
  }
  return {
    wort: (el.textContent ?? "").trim(),
    herkunft: el.getAttribute("data-anzeigestatus-herkunft"),
  };
}

const KONFLIKT = (): string => i18n.t("status.konflikt") as string;

describe("R-0212 · der Konflikt aus der Schnittstelle steht auch schmal da", () => {
  it.each([
    ["schmal (390 px)", true],
    ["breit (Gegenprobe)", false],
  ] as const)("Liste %s: die Zeile trägt „Konflikt“ und den kritischen Punkt", (_n, schmal) => {
    setzeBreite(schmal);
    flaeche("/bibliothek");
    expect(zeilen()).toHaveLength(2);
    expect(zeilenWort("k1")).toBe(KONFLIKT());
    expect(zeilenPunktKritisch("k1")).toBe(true);
    expect(zeilenWort("k2")).not.toBe(KONFLIKT());
    expect(zeilenPunktKritisch("k2")).toBe(false);
  });

  it.each([
    ["schmal (390 px)", true],
    ["breit (Gegenprobe)", false],
  ] as const)("Bericht %s: die Pille sagt „Konflikt“ — mit Herkunft Server", (_n, schmal) => {
    setzeBreite(schmal);
    flaeche("/bibliothek?eintrag=k1");
    expect(da("bib-lesen")).not.toBeNull();
    // Schmal trägt der Bericht die Fläche allein (JOB 3121) — der Konflikt geht dabei nicht verloren.
    if (schmal) {
      expect(da("bib-liste")).toBeNull();
    }
    expect(pille()).toEqual({ wort: KONFLIKT(), herkunft: "server" });
  });

  it("Gegenprobe schmal: ein Eintrag ohne Konflikt trägt ihn auch nicht", () => {
    setzeBreite(true);
    flaeche("/bibliothek?eintrag=k2");
    expect(pille().wort).not.toBe(KONFLIKT());
  });
});
