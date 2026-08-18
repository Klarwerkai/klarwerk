// @vitest-environment jsdom
// ================================================================================================
// JOB 577 · D6 — BEN-AUFLAGE 2: DIE SICHTBAREN VERBRAUCHER ALLER DREI HOOKS, ABGENOMMEN.
// ================================================================================================
//
// Wörtlich gerügt: „Die sichtbaren Verbraucher aller drei normalisierten Hooks … sind nicht
// unabhängig abgenommen." In D5 musste nur `Risk.tsx` typseitig angepasst werden; die beiden
// anderen Flächen blieben ungeprüft — und „hat nicht gebrochen" ist keine Abnahme.
//
// DIESE DATEI MISST DIE FLÄCHE, NICHT DEN HOOK. Der Hook-Vertrag steht in
// `577-abwesenheit-hooks-mounted.test.tsx`. Hier geht es um die Frage dahinter, die diesen Job
// überhaupt ausgelöst hat: Erscheint bei einer 404-Antwort irgendwo eine Auskunft — eine Fläche,
// eine Fehlermeldung, ein Hinweis? Denn eine Fehlermeldung IST die Auskunft.
//
// JEDER FALL HAT SEINE KALIBRIERUNG. „Nichts sichtbar" ist trivial erfüllt, wenn eine Fläche
// grundsätzlich nichts rendert. Zu jedem Abwesenheitsfall steht deshalb der Gegenfall mit echten
// Daten: dieselbe Fläche, dieselbe Montage, und dann erscheint sie sehr wohl.
//
// Die drei Verbraucher, gemessen aus dem Bestand:
//   useExpertise               → apps/web/src/pages/Risk.tsx:57
//   useFeatures                → apps/web/src/components/FeatureGate.tsx:30
//                                (dazu legal/NoticeBanner.tsx:84, legal/LegalPages.tsx:49)
//   useImportAccessConfluence  → apps/web/src/components/ImportAccessPanel.tsx:57

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const antwort = vi.hoisted(() => ({
  expertise: "404" as "404" | "daten",
  features: "404" as "404" | "daten",
  importAccess: "404" as "404" | "daten",
}));

// Wirft die ECHTE `ApiError`-Klasse — `istAbwesend` prüft `instanceof`, ein nachgebauter Fehler
// mit passenden Feldern gälte also nicht als Abwesenheit (genau so gewollt, s. abwesenheit.test.ts,
// Fall „ein Fremdobjekt mit status 404"). Über `vi.hoisted`, weil `vi.mock` gehoistet wird und die
// Fabrik unten sonst auf eine noch nicht initialisierte Bindung zugriffe.
const nichtGefunden = vi.hoisted(() => async (text: string): Promise<never> => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  throw new ApiError(404, "NOT_FOUND", text);
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  // `<T,>` statt `<T>`: In einer .tsx-Datei läse der Parser `<T>` als JSX-Element.
  const leer = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      analytics: {
        expertise: vi.fn(async () => {
          if (antwort.expertise === "404") {
            await nichtGefunden("Flag aus");
          }
          return [{ category: "Vertragsrecht", contributors: [{ authorId: "u1" }] }];
        }),
        overview: leer({}),
        impact: leer({}),
        busfactor: leer([]),
      },
      features: {
        get: vi.fn(async () => {
          if (antwort.features === "404") {
            await nichtGefunden("keine Auskunft");
          }
          return { features: { demodaten: true } };
        }),
      },
      importAccess: {
        confluence: vi.fn(async () => {
          if (antwort.importAccess === "404") {
            await nichtGefunden("kein Zugang");
          }
          // Vollständig nach dem echten Vertrag `ImportAccessStatus` (api/types.ts:1263-1273) —
          // eine verkürzte Antwort würde die Fläche an einer anderen Stelle abreißen lassen und
          // dieser Kalibrierung ihren Wert nehmen.
          return {
            system: "confluence",
            enabled: true,
            credentials: [{ name: "KLARWERK_CONFLUENCE_TOKEN", present: true }],
            credentialsUsable: true,
            blocker: null,
            lastConnectedAt: null,
          };
        }),
      },
      ko: { list: leer([]) },
      gaps: { list: leer([]), summary: leer({}) },
      conflicts: { list: leer([]) },
      directory: { list: leer([]) },
      // `Risk` zieht den Abdeckungs-Vorbehalt mit (AiCheckBoardCaveat). Er gehört nicht zum
      // Gegenstand dieses Tests, muss aber antworten — sonst reißt die Seite ab, bevor die
      // gemessene Fläche überhaupt gerendert wird.
      aiCheck: { coverageSummary: leer({ total: 0, checked: 0, failed: 0 }) },
    },
  };
});

// Die Rolle wird fest auf `admin` gesetzt: Dieser Test prüft die Abwesenheits-Zusage der Fläche,
// nicht die Auflösung der Anmeldung. `admin` ist die einzige Rolle, die BEIDE gemessenen Flächen
// überhaupt anfragt — `canSeeExpertise` (ko.assign) und die Zugangstafel (`role === "admin"`).
//
// DAS IST TRAGEND UND KEINE BEQUEMLICHKEIT: Mit einer Rolle, die nicht anfragt, wäre „nichts
// sichtbar" schon deshalb erfüllt, weil gar kein Abruf stattfindet — der Test würde die
// Rollenregel messen statt der Abwesenheitsregel. Die Fälle unten belegen deshalb zusätzlich, dass
// der Abruf WIRKLICH lief.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin" }),
  RoleProvider: ({ children }: { children: unknown }) => children,
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { FeatureGate } from "../../apps/web/src/components/FeatureGate";
import { ImportAccessPanel } from "../../apps/web/src/components/ImportAccessPanel";
// Registriert die echte i18n-Instanz (initReactI18next). Ohne sie gäbe `t()` nur den Schlüssel
// zurück, und der Test würde gegen „expertise.title" statt gegen die echte sichtbare Beschriftung
// messen — also gegen etwas, das der Nutzer nie sieht.
import "../../apps/web/src/i18n";
import { Risk } from "../../apps/web/src/pages/Risk";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mounte(element: ReactNode): Promise<string> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: ["/risiko"] }, element),
      ),
    );
  });
  await act(async () => {
    await flush();
  });
  return container.textContent ?? "";
}

beforeEach(() => {
  antwort.expertise = "404";
  antwort.features = "404";
  antwort.importAccess = "404";
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
});

describe("V — Verbraucher 1: die Experten-Sicht auf der Risikoseite (useExpertise)", () => {
  it("V1: bei 404 erscheint WEDER die Flaeche NOCH eine Fehlermeldung", async () => {
    const text = await mounte(createElement(Risk));

    // Erst der Beleg, dass ueberhaupt gefragt wurde — sonst waere „nichts sichtbar" schon durch
    // einen unterlassenen Abruf erfuellt und dieser Fall wertlos.
    expect(endpoints.analytics.expertise).toHaveBeenCalled();
    expect(text).not.toContain("Wen einbeziehen");
    // Und nichts, was die Existenz verraten wuerde: kein Fehlerwort, kein Statuscode.
    expect(text).not.toMatch(/404|Fehler|nicht gefunden|NOT_FOUND/i);
  });

  it("V2 (Kalibrierung): mit echten Daten erscheint dieselbe Flaeche sehr wohl", async () => {
    antwort.expertise = "daten";

    const text = await mounte(createElement(Risk));

    expect(text).toContain("Wen einbeziehen");
    expect(text).toContain("Vertragsrecht");
  });
});

describe("V — Verbraucher 2: der Schalter-Baustein (useFeatures)", () => {
  it("V3: bei 404 bleiben die Kinder ungerendert — fail-closed", async () => {
    const text = await mounte(
      createElement(FeatureGate, {
        feature: "demodaten",
        children: createElement("span", null, "GESCHALTETE-FLAECHE"),
      }),
    );

    expect(endpoints.features.get).toHaveBeenCalled();
    expect(text).not.toContain("GESCHALTETE-FLAECHE");
    expect(text).not.toMatch(/404|Fehler|NOT_FOUND/i);
  });

  it("V4 (Kalibrierung): bei aktivem Schalter werden dieselben Kinder gerendert", async () => {
    antwort.features = "daten";

    const text = await mounte(
      createElement(FeatureGate, {
        feature: "demodaten",
        children: createElement("span", null, "GESCHALTETE-FLAECHE"),
      }),
    );

    expect(text).toContain("GESCHALTETE-FLAECHE");
  });
});

describe("V — Verbraucher 3: die Zugangs-Tafel des Imports (useImportAccessConfluence)", () => {
  it("V5: bei 404 erscheint die Tafel gar nicht — keine Auskunft, keine Behauptung", async () => {
    const text = await mounte(createElement(ImportAccessPanel));

    // Die Rolle `admin` fragt die Tafel wirklich an (s. Kopf dieser Datei) — die Leere unten kommt
    // also aus der 404-Antwort und nicht aus einem unterlassenen Abruf.
    expect(endpoints.importAccess.confluence).toHaveBeenCalled();
    expect(text).toBe("");
  });

  it("V6 (Kalibrierung): mit echter Auskunft erscheint dieselbe Tafel", async () => {
    antwort.importAccess = "daten";

    const text = await mounte(createElement(ImportAccessPanel));

    expect(text).toContain("Zugang");
  });
});
