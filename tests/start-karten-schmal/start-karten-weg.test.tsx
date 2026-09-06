// @vitest-environment jsdom
// ================================================================================================
// JOB 3118 (UX-17) — DIE ZWEITE HÄLFTE DES TASTATURWEGS: WELCHER BERICHT WIRKLICH AUFGEHT.
// ================================================================================================
//
// BENS KORREKTURPFLICHT 3 (Runde 1), wörtlich: „Ergänzen: Enter bis zum erwarteten Bericht."
// BENS KORREKTURPFLICHT 2 (Runde 2), wörtlich: „Den Berichtsnachweis mit der echten Produktzielseite
// führen … Ein ausgegebener Routenparameter darf nicht als dargestellter Bericht gelten."
//
// Runde 2 hatte hier einen Platzhalter, der die Routenkennung ausgab. Der bewies die Kennung und
// nannte sich Bericht — genau die Sorte Beleg, die mehr behauptet als sie misst. Jetzt steht an
// `/wissen/:id` die ECHTE Seite des Produkts (`pages/KnowledgeDetail` → `BibliothekFlaeche`), und
// gemessen wird ihr INHALT: der Aussagesatz des geöffneten Wissensobjekts, der sich vom Nachbarn
// unterscheidet. Ein Test, der nur die Kennung liest, wäre auch dann grün, wenn die Seite den
// falschen Bestand zeigte.
//
// Der Weg zerfällt in zwei Hälften, und jede braucht eine andere Bühne:
//   1. TASTE → ADRESSE. Dass Chromium aus einem `Enter` auf der fokussierten Zeile wirklich eine
//      Navigation macht, misst `start-karten-schmal-chromium.test.tsx` (B-4b) am echten Browser.
//      jsdom kann das nicht: es übersetzt `Enter` auf einem Link nicht in einen Klick, und ein
//      Test, der das behauptete, würde seine eigene Nachbildung prüfen.
//   2. ADRESSE → BERICHT. Dass unter genau dieser Adresse der gewollte Bericht AUFGEHT, misst DIESE
//      Datei am echten Router und an der echten Zielseite — mit der Aktivierung, die der Browser
//      aus dem `Enter` erzeugt (`click` auf dem Anker, HTML-Standard „activation behavior").
//
// Zusammen: Tab bis zur Zeile → Enter → `/wissen/<koId>` → der Bericht dieses Eintrags, lesbar am
// Text. Die Naht zwischen den zwei Hälften ist die Adresse; das steht so auch in der Rückgabe.
import { afterEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

const VOR_TAGEN = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

/**
 * Zwei Wissensobjekte mit dem spät unterschiedlichen Titelpaar aus Bens Gegenprobe — und mit
 * DEUTLICH verschiedenen Aussagesätzen. Der Satz ist der Beleg: er kann nicht aus der Adresse
 * geraten werden, er muss aus dem geladenen Objekt kommen.
 */
const BERICHTE = [
  {
    id: "ko-nord",
    title:
      "Notfallplan Standort mit Anlagen Fluchtwegen Sammelplätzen und Meldeketten Ausgabe Nord 2026",
    statement: "Sammelplatz Nord liegt an Tor 3; die Werkleitung meldet an die Feuerwehr Nord.",
  },
  {
    id: "ko-sued",
    title:
      "Notfallplan Standort mit Anlagen Fluchtwegen Sammelplätzen und Meldeketten Ausgabe Süd 2026",
    statement: "Sammelplatz Sued liegt am Kesselhaus; die Meldekette laeuft ueber die Pforte Sued.",
  },
] as const;

function ko(vorlage: (typeof BERICHTE)[number]): KnowledgeObject {
  return {
    id: vorlage.id,
    title: vorlage.title,
    statement: vorlage.statement,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  } as unknown as KnowledgeObject;
}

const box = vi.hoisted(() => ({ wall: {} as unknown }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

/**
 * Die Zielseite hängt an vielen Endpunkten, die mit diesem Nachweis nichts zu tun haben. Deshalb
 * ein Proxy mit leerer Vorgabe: benannt wird NUR, was den Bericht ausmacht (`ko.list`, `ko.get`) —
 * eine handgepflegte Vollliste wäre eine zweite, driftende Wahrheit über `api/endpoints`.
 */
vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  const benannt: Record<string, unknown> = {
    ko: {
      list: vi.fn(async () => BERICHTE.map(ko)),
      get: vi.fn(async (id: string) => {
        const treffer = BERICHTE.find((b) => b.id === id);
        if (!treffer) {
          throw new Error(`unbekannte Kennung: ${id}`);
        }
        return ko(treffer);
      }),
      versions: leer,
      evidence: leer,
      neighbors: leer,
    },
    gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0 } })) },
    learningPaths: { byRole: vi.fn(async () => null), progress: leer },
    livewall: { get: vi.fn(async () => box.wall) },
    admin: { demoStatus: vi.fn(async () => ({ present: false, count: 0 })) },
    analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
  };
  const endpoints = new Proxy(benannt, {
    get(ziel, gruppe) {
      if (gruppe in ziel) {
        return ziel[gruppe as string];
      }
      return new Proxy({}, { get: () => vi.fn(async () => []) });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  await i18n.changeLanguage("de");
  box.wall = {
    saved: BERICHTE.map((b) => ({
      koId: b.id,
      title: b.title,
      author: "Eva",
      at: VOR_TAGEN,
      status: "offen" as const,
    })),
    helped: [],
    helpedToday: 0,
  };
  window.localStorage.clear();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/start"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      key: "s",
                      path: "/start",
                      element: createElement(Start),
                    }),
                    // DIESELBE Zuordnung wie `routes.tsx:206` — Pfad und Komponente sind aus dem
                    // Produkt übernommen, nicht für den Test erfunden.
                    createElement(Route, {
                      key: "w",
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

const zeilen = (): HTMLAnchorElement[] => [
  ...container.querySelectorAll<HTMLAnchorElement>('[data-testid="h5-zuletzt-zeile"]'),
];
const bericht = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="page-wissen"]');
const berichtText = (): string => (bericht()?.textContent ?? "").replace(/\s+/g, " ");

/** Was der Browser aus `Enter` auf einem fokussierten Link macht (B-4b misst genau diesen Schritt). */
async function aktivieren(zeile: HTMLAnchorElement): Promise<void> {
  zeile.focus();
  expect(document.activeElement, "die Zeile nimmt den Fokus nicht an").toBe(zeile);
  await act(async () => {
    zeile.click();
    await flush();
  });
  await act(flush);
}

afterEach(() => {
  const alt = root;
  if (alt !== undefined) {
    act(() => alt.unmount());
    container.remove();
  }
  root = undefined;
  vi.clearAllMocks();
});

describe("JOB 3118 · W · vom fokussierten Eintrag zum wirklich geöffneten Bericht", () => {
  it("W-1 · KALIBRIERUNG: beide Zeilen stehen da, tragen ihr eigenes Ziel, und kein Bericht ist offen", async () => {
    await mount();
    const z = zeilen();
    expect(z).toHaveLength(2);
    expect(z.map((a) => a.getAttribute("href"))).toEqual(["/wissen/ko-nord", "/wissen/ko-sued"]);
    expect(bericht(), "die Zielseite steht schon vor der Auswahl da").toBeNull();
  });

  it("W-2 · die ZWEITE Zeile öffnet den ZWEITEN Bericht — lesbar an seinem Aussagesatz", async () => {
    await mount();
    await aktivieren(zeilen()[1] as HTMLAnchorElement);

    expect(bericht(), "der Weg führte nirgendwohin").not.toBeNull();
    // DER EIGENTLICHE BELEG: der Inhalt des geöffneten Objekts, nicht seine Kennung.
    expect(berichtText()).toContain(BERICHTE[1].statement);
    expect(berichtText(), "der Bericht des Nachbarn steht da").not.toContain(BERICHTE[0].statement);
    // Und die Startfläche ist wirklich verlassen — kein zweiter Baum daneben.
    expect(container.querySelector('[data-testid="h5-zuletzt"]')).toBeNull();
  });

  it("W-3 · und die ERSTE Zeile öffnet den ERSTEN — die Zuordnung ist nicht zufällig", async () => {
    await mount();
    await aktivieren(zeilen()[0] as HTMLAnchorElement);

    expect(berichtText()).toContain(BERICHTE[0].statement);
    expect(berichtText()).not.toContain(BERICHTE[1].statement);
  });
});
