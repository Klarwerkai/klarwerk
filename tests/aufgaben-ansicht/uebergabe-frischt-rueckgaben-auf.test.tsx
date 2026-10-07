// @vitest-environment jsdom
// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG, K3/K4 (Ben, Nacharbeit 4) — NACH DER ÜBERGABE STIMMEN LISTE UND ZAHL.
// ================================================================================================
//
// DER BEFUND: Die Übergabe (`MehrAbschnitte.tsx`, `transfer`) entwertete nach Erfolg nur `ko`,
// `validation`, `kos`, `library` und `conflicts`. Die an MICH zurückgegebenen Entwürfe liegen unter
// `["me", "returned-tasks", "list" | "summary"]` (`api/hooks.ts`) und gelten im Produkt 30 s als
// frisch (`main.tsx`, `staleTime: ZAEHLER_FRISCHE_MS`). Wer übergab und sofort zurückging, sah die
// alte eigene Rückgabe weiter, in der Liste wie im Kopfband.
//
// WIE GEMESSEN WIRD:
//   · EIN QueryClient mit der produktiven Frist als `staleTime`. Er bleibt über den ganzen Weg
//     derselbe und wird nicht geleert.
//   · Echte Lese-Hooks und echte Flächen: die Zeile „Offene Aufgaben" mit Zahl
//     (`WeitereBereicheZeilen`, `useNavBadges`), die Aufgabenseite (`MyTasks`) und die
//     Detailseite (`KnowledgeDetail` → … → `MehrAbschnitte`). Nur das Netz darunter
//     (`api/endpoints`) ist ein Doppel. Es zählt die Abrufe und ändert bei erfolgreicher Übergabe
//     seinen Bestand, wie es der Server täte.
//   · Der Weg ist der eines Menschen:
//     - Aufgabenseite mit Filter `?art=returned`,
//     - Klick auf die Aufgabenzeile (echter Absprung),
//     - „Mehr" → „Provenienz" → neuen Autor wählen → „Übertragen",
//     - sofort zurück (`navigate(-1)`).
//   · Der Test entwertet NICHTS selbst, ruft kein `refetch` und wartet keine Frist ab. Ohne die
//     Entwertung im Produkt bleibt die Liste beim ersten Abruf, und R1 ist rot.
//
// DIE FÄLLE:
//   R1  Übergabe gelingt: nach dem Rückweg ist die Rückgabe aus der Liste weg, die Zahl im
//       Kopfband ist weg (echte 0), der Filter steht noch in der Adresse.
//   R2  Übergabe scheitert: die eigene Rückgabe bleibt in Liste und Kopfband stehen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TITEL = "Reinigung Spritzzone Linie 3";

const netz = vi.hoisted(() => ({
  rueckgaben: [] as { koId: string; at: string; verdict: string }[],
  uebergabeScheitert: false,
  rufe: { liste: 0, zahl: 0, uebergabe: 0 },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = async () => [];
  // Was hier nicht ausdrücklich steht, antwortet leer — aber es antwortet, statt die Flächen aus
  // einem fremden Grund in einen Fehlerzustand zu werfen.
  const gruppe = (felder: Record<string, unknown>) =>
    new Proxy(felder, {
      get: (ziel, name) => (name in ziel ? ziel[name as string] : leer),
    });
  const basis: Record<string, unknown> = {
    ko: gruppe({
      get: async () => globalThis.__k3UebergabeKo,
      list: async () => [globalThis.__k3UebergabeKo],
      evidence: leer,
      versions: leer,
      neighbors: async () => ({ center: "ko-1", neighbors: [], excludedTags: [], limit: 8 }),
      act: async (_id: string, body: { action: string; newAuthor?: string }) => {
        if (body.action !== "transfer-author") {
          return globalThis.__k3UebergabeKo;
        }
        netz.rufe.uebergabe += 1;
        if (netz.uebergabeScheitert) {
          throw new Error("Übergabe gescheitert");
        }
        // Der Server nach `setAuthor`: neuer Autor, die Rückgabe liegt nicht mehr bei Eva.
        globalThis.__k3UebergabeKo = {
          ...globalThis.__k3UebergabeKo,
          author: body.newAuthor ?? "",
        };
        netz.rueckgaben = [];
        return globalThis.__k3UebergabeKo;
      },
    }),
    me: gruppe({
      returnedTasks: async () => {
        netz.rufe.liste += 1;
        return [...netz.rueckgaben];
      },
      returnedSummary: async () => {
        netz.rufe.zahl += 1;
        return { open: netz.rueckgaben.length };
      },
    }),
    validation: gruppe({ board: leer }),
    gaps: gruppe({
      list: leer,
      summary: async () => ({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }),
    }),
    audit: gruppe({ list: leer, koFindings: async () => ({ ids: [] }) }),
    directory: gruppe({
      list: async () => [
        { id: "u1", name: "Eva", email: "e@x.de", role: "admin" },
        { id: "u2", name: "Ben", email: "b@x.de", role: "experte" },
      ],
    }),
    external: gruppe({ policy: async () => ({ stage: "blocked", enabled: false }) }),
    uploadLimits: gruppe({
      get: async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 }),
    }),
    features: gruppe({ get: async () => ({ features: {} }) }),
    reasoner: gruppe({
      status: async () => ({ active: false, mode: "off" }),
      config: async () => ({}),
    }),
    aiCheck: gruppe({ coverageSummary: async () => ({ total: 0 }) }),
  };
  return {
    endpoints: new Proxy(basis, {
      get: (ziel, name) => (name in ziel ? ziel[name as string] : gruppe({})),
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { WeitereBereicheZeilen } from "../../apps/web/src/shell/KopfbandPunkte";

declare global {
  // Der Bestand wird über den globalen Namensraum gereicht: `vi.mock` wird hochgezogen und darf
  // nichts aus dem Modulrumpf schließen.
  // eslint-disable-next-line no-var
  var __k3UebergabeKo: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

function ko(): KnowledgeObject {
  return {
    id: "ko-1",
    title: TITEL,
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung und Prüfung.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 40,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let navigiere: ((ziel: number) => void) | undefined;
let ort = { pathname: "", search: "" };

/** Hält den Rückweg und den aktuellen Ort fest — derselbe Router, kein zweiter Verlauf. */
function Lotse(): null {
  const navigate = useNavigate();
  const location = useLocation();
  navigiere = (ziel) => navigate(ziel);
  ort = { pathname: location.pathname, search: location.search };
  return null;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  globalThis.__k3UebergabeKo = ko();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
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
                  { initialEntries: ["/aufgaben?art=returned"] },
                  createElement(
                    Fragment,
                    null,
                    createElement(Lotse),
                    // Der Ort der Zahl, auf jeder Seite gemountet wie die Hülle.
                    createElement(
                      "section",
                      { "data-ort": "kopfband" },
                      createElement(WeitereBereicheZeilen),
                    ),
                    createElement(
                      "main",
                      null,
                      createElement(
                        Routes,
                        null,
                        createElement(Route, {
                          path: "/aufgaben",
                          element: createElement(MyTasks),
                        }),
                        createElement(Route, {
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
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();
const hauptflaeche = (): Element | null => container.querySelector("main");
const aufgabenZahl = (): string | null =>
  container.querySelector('[data-testid="bereich-aufgaben"] .kw-menue-wert')?.textContent ?? null;

async function klick(ziel: Element | null | undefined, wer: string): Promise<void> {
  if (!(ziel instanceof HTMLElement)) {
    throw new Error(`${wer} fehlt`);
  }
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Einen Abschnitt von „Mehr" öffnen — der Weg, den ein Mensch am `<summary>` geht. */
async function oeffneAbschnitt(schluessel: string): Promise<HTMLDetailsElement> {
  const d = container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt`);
  }
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
  return d;
}

/** Absprung über die Aufgabenzeile, Übergabe an Ben, sofort zurück. */
async function uebergebenUndZurueck(): Promise<void> {
  await klick(container.querySelector('main a[href^="/wissen/ko-1"]'), "Die Aufgabenzeile");
  expect(ort.pathname, "der Absprung führt nicht zum Objekt").toBe("/wissen/ko-1");

  await klick(container.querySelector('[data-testid="bib-mehr"]'), "„Mehr“");
  const provenienz = await oeffneAbschnitt("provenienz");
  const auswahl = provenienz.querySelector<HTMLSelectElement>(
    `select[aria-label="${i18n.t("ko.transferTitle")}"]`,
  );
  if (!auswahl) {
    throw new Error("Die Auswahl des neuen Autors fehlt");
  }
  await act(async () => {
    auswahl.value = "u2";
    auswahl.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  const knopf = [...provenienz.querySelectorAll("button")].find(
    (b) => text(b) === i18n.t("ko.transfer"),
  );
  await klick(knopf, "Der Knopf „Übertragen“");
  expect(netz.rufe.uebergabe, "die Übergabe wurde nicht ausgelöst").toBe(1);

  // Sofort zurück — weit innerhalb der Frischefrist von 30 s.
  await act(async () => {
    navigiere?.(-1);
    await flush();
  });
  await act(flush);
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  netz.rueckgaben = [{ koId: "ko-1", at: "2026-10-07T08:00:00.000Z", verdict: "warn" }];
  netz.uebergabeScheitert = false;
  netz.rufe = { liste: 0, zahl: 0, uebergabe: 0 };
  // Wie `main.tsx`: dieselbe Frist als `staleTime`. Ohne sie wäre jede Antwort sofort veraltet,
  // und der Rückweg holte auch ohne Entwertung neu — der Befund wäre unsichtbar.
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: ZAEHLER_FRISCHE_MS } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.clearAllMocks();
});

describe("K3/K4: nach der Autorenübergabe stimmen Liste und Kopfband beim Rückweg", () => {
  it("R1 · Übergabe gelingt: die alte eigene Rückgabe ist aus Liste und Kopfband weg, der Filter bleibt", async () => {
    await mount();
    // Kalibrierung: beide Quellen sind geladen und zeigen die eigene Rückgabe.
    expect(text(hauptflaeche()), "die Rückgabe steht nicht in der Liste").toContain(TITEL);
    expect(aufgabenZahl(), "die Zahl im Kopfband fehlt").toBe("1");
    expect(netz.rufe.liste).toBe(1);
    const zahlVorher = netz.rufe.zahl;

    await uebergebenUndZurueck();

    expect(ort.pathname, "der Rückweg führt nicht zur Aufgabenseite").toBe("/aufgaben");
    expect(ort.search, "der Filter ging beim Rückweg verloren").toBe("?art=returned");
    expect(netz.rufe.liste, "die Liste wurde nach der Übergabe nicht neu geholt").toBeGreaterThan(
      1,
    );
    expect(netz.rufe.zahl, "die Zahl wurde nach der Übergabe nicht neu geholt").toBeGreaterThan(
      zahlVorher,
    );
    expect(text(hauptflaeche()), "die übergebene Rückgabe steht noch in der Liste").not.toContain(
      TITEL,
    );
    expect(aufgabenZahl(), "das Kopfband zählt die übergebene Rückgabe noch").toBeNull();
  });

  it("R2 · Übergabe scheitert: die eigene Rückgabe bleibt in Liste und Kopfband stehen", async () => {
    netz.uebergabeScheitert = true;
    await mount();
    expect(text(hauptflaeche())).toContain(TITEL);
    expect(aufgabenZahl()).toBe("1");

    await uebergebenUndZurueck();

    expect(ort.pathname).toBe("/aufgaben");
    expect(text(hauptflaeche()), "eine gescheiterte Übergabe hat die Rückgabe entfernt").toContain(
      TITEL,
    );
    expect(aufgabenZahl(), "eine gescheiterte Übergabe hat die Zahl entfernt").toBe("1");
  });
});
