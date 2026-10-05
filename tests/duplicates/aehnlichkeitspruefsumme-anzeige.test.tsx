// @vitest-environment jsdom
// R-0194 · K5 (bens Befund, Nacharbeit 1) — die GERENDERTE Vergleichsseite zeigt die Kandidatenquelle.
//
// Gemountet wird die echte `DuplicateCompare` mit Router, QueryClient und den echten Übersetzungen;
// vorgegeben sind nur die API-Antworten. Gerüst nach
// `tests/review26-duplikat-prozente/flaechen-benennen-die-metrik-mounted.test.tsx`.
//
// MUTATIONSFREIHEIT: jeder Endpunktaufruf wird mitgeschrieben, und ein Zugriff auf einen hier nicht
// vorgegebenen Endpunkt (etwa ein Schreibweg) wird ebenfalls verzeichnet. Erwartet wird, dass das
// bloße Anzeigen ausschließlich lesende Endpunkte berührt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const daten = vi.hoisted(() => ({ duplikate: [] as unknown[], aufrufe: [] as string[] }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "controller" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const bereich = (name: string, lesend: Record<string, () => unknown>): object =>
    new Proxy(
      Object.fromEntries(
        Object.entries(lesend).map(([fn, wert]) => [
          fn,
          vi.fn(async () => {
            daten.aufrufe.push(`${name}.${fn}`);
            return wert();
          }),
        ]),
      ),
      {
        get(ziel, schluessel) {
          if (typeof schluessel === "string" && !(schluessel in ziel)) {
            daten.aufrufe.push(`UNBEKANNT:${name}.${schluessel}`);
          }
          return Reflect.get(ziel, schluessel);
        },
      },
    );
  return {
    endpoints: {
      duplicates: bereich("duplicates", {
        list: () => daten.duplikate,
        settings: () => ({ minConfidence: 0.5 }),
      }),
      conflicts: bereich("conflicts", { list: () => [] }),
      validation: bereich("validation", { board: () => [], overview: () => [] }),
      lifecycle: bereich("lifecycle", { pending: () => [] }),
      ko: bereich("ko", { list: () => KOS }),
      gaps: bereich("gaps", {
        list: () => [],
        summary: () => ({ total: 0, byPriority: {} }),
      }),
      directory: bereich("directory", { list: () => [] }),
      analytics: bereich("analytics", { busfactor: () => [], expertise: () => [] }),
      aiCheck: bereich("aiCheck", {
        coverageSummary: () => ({ total: 2, incomplete: 0, unchecked: 0, noCoverage: 0 }),
      }),
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { DuplicateCompare } from "../../apps/web/src/pages/DuplicateCompare";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ko = (id: string, titel: string, aussage: string) => ({
  id,
  title: titel,
  statement: aussage,
  bodyHtml: null,
  status: "validiert",
  type: "technik",
  category: "Betrieb",
  trust: 80,
  conditions: [],
  measures: [],
  sources: [],
  attachments: [],
  comments: [],
  tags: [],
  neededValidations: 3,
  createdAt: "2026-09-01T06:00:00.000Z",
  updatedAt: "2026-09-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", "Schmierintervall Pumpe", "Schmierfett alle 500 Betriebsstunden nachfüllen."),
  ko("ko-b", "Fettpresse verwenden", "Alle 500 Betriebsstunden Schmierfett nachfüllen."),
];

function befund(patch: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "r0194-1",
    koA: "ko-a",
    koB: "ko-b",
    relation: "teilweise",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren_pruefen",
    status: "offen",
    pairKey: "dup|ko-a|ko-b",
    origin: "auto",
    detector: { trigger: "validation", method: "model", lexicalScore: 0.4, confidence: 0.9 },
    createdAt: "2026-10-03T09:00:00.000Z",
    ...patch,
  };
}

function mitQuellen(quellen: string[]): Record<string, unknown> {
  return befund({
    detector: {
      trigger: "validation",
      method: "model",
      lexicalScore: 0.4,
      confidence: 0.9,
      candidateSources: quellen,
    },
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mounteVergleich(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const seite = createElement(
    Routes,
    null,
    createElement(Route, {
      path: "/duplikate/:id/vergleich",
      element: createElement(DuplicateCompare, { kind: "duplicate" }),
    }),
  );
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
                MemoryRouter,
                { initialEntries: ["/duplikate/r0194-1/vergleich"] },
                seite,
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

function textVon(selektor: string): string {
  const el = container.querySelector(selektor);
  if (!el) {
    throw new Error(
      `Kein Element für ${selektor}. Vorhandene Kennungen: ${[
        ...container.querySelectorAll("[data-testid]"),
      ]
        .map((x) => x.getAttribute("data-testid"))
        .join(", ")}`,
    );
  }
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

const PILLE = '[data-testid="pruefen-pille-quelle"]';
const HINWEIS = '[data-testid="dcmp-quelle"]';
const LESEND =
  /^(duplicates\.(list|settings)|conflicts\.list|ko\.list|validation\.\w+|lifecycle\.pending|gaps\.\w+|directory\.list|analytics\.\w+|aiCheck\.coverageSummary)$/;

function nurGelesen(): void {
  expect(daten.aufrufe.length).toBeGreaterThan(0);
  for (const aufruf of daten.aufrufe) {
    expect(aufruf).toMatch(LESEND);
  }
}

beforeEach(async () => {
  daten.aufrufe = [];
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("R-0194 · K5 — gerenderte Kandidatenquelle auf der Vergleichsseite", () => {
  for (const [quelle, bezeichnung] of [
    ["metadaten", "Metadaten"],
    ["text", "Text"],
    ["pruefsumme", "Prüfsumme"],
    ["abschnitt", "Abschnitt"],
  ] as const) {
    it(`einzelne Quelle „${quelle}“ steht ausgeschrieben in der Pille`, async () => {
      daten.duplikate = [mitQuellen([quelle])];
      await mounteVergleich();
      expect(textVon(PILLE)).toBe(`Kandidatenquelle: ${bezeichnung}`);
      expect(textVon(HINWEIS)).toContain("entscheidest du auf dem Brett");
      nurGelesen();
    });
  }

  it("kombiniert Text und Prüfsumme: beide Bezeichnungen stehen da", async () => {
    daten.duplikate = [mitQuellen(["text", "pruefsumme"])];
    await mounteVergleich();
    expect(textVon(PILLE)).toBe("Kandidatenquelle: Text · Prüfsumme");
    expect(textVon(HINWEIS)).toContain("kein Urteil");
    nurGelesen();
  });

  it("Altbefund ohne notierte Herkunft: Text (der einzige Weg vor R-0194)", async () => {
    daten.duplikate = [befund({})];
    await mounteVergleich();
    expect(textVon(PILLE)).toBe("Kandidatenquelle: Text");
    nurGelesen();
  });

  it("von Hand gemeldeter Befund: keine erfundene Quelle, sondern „von Hand gemeldet“", async () => {
    daten.duplikate = [befund({ origin: "manual", detector: undefined })];
    await mounteVergleich();
    expect(textVon(PILLE)).toBe("Kandidatenquelle: von Hand gemeldet");
    expect(textVon(HINWEIS)).toContain("entscheidest du auf dem Brett");
    nurGelesen();
  });

  it("englisch: übersetzte Bezeichnungen, kein deutsches Quellenwort", async () => {
    await i18n.changeLanguage("en");
    daten.duplikate = [mitQuellen(["text", "pruefsumme"])];
    await mounteVergleich();
    expect(textVon(PILLE)).toBe("Candidate source: Text · Checksum");
    expect(textVon(PILLE)).not.toContain("Prüfsumme");
  });
});
