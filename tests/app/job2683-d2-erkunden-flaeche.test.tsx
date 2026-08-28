// @vitest-environment jsdom
// ================================================================================================
// JOB 2683 D2 — DER SPINNER ENDET UND SAGT WARUM: „Erkunden" (Import-Cockpit), gemountet.
// ================================================================================================
//
// BENs Prüflücken 1 und 3 zu D1, wörtlich: „der erste Netzaufruf löst nie auf. Erwartung:
// Pending/Spinner endet innerhalb der Testfrist und ein hostfreier Text mit klarer
// Zeitüberschreitungsdiagnose wird gerendert" — und: „die zweite Ergebnisseite überschreitet die
// Frist. Erwartung: bereits gelesene Seiten bleiben sichtbar und die Fläche kennzeichnet das Ergebnis
// wahrheitsgemäß als unvollständig; … auch [der Abbruchgrund] wird angezeigt."
//
// Hier läuft das ECHTE Bauteil `ImportExplore` im echten Provider-Gerüst (wie pages/Stufe2.tsx).
// Ersetzt ist nur der Endpunkt: er antwortet so, wie die Route seit D2 antwortet — mit dem Wiretext,
// den `tests/app/job2683-zwei-knoepfe-flaeche.test.ts` an der echten Route pinnt. Die Kette ist damit
// geschlossen: Client → Route (dort gepinnt) → Renderer (hier gepinnt).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const endpunkt = vi.hoisted(() => ({
  explore: async (): Promise<unknown> => {
    throw new Error("nicht konfiguriert");
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        explore: vi.fn(() => endpunkt.explore()),
        select: vi.fn(async () => ({ criteria: {}, total: 0, preview: [] })),
      },
    },
    // Die Auswahl-Vorschau (ImportSelect) fragt beim Mounten die Reasoner-Lage ab — ohne Modell.
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "cloud", reachable: "inactive" })),
      config: vi.fn(async () => null),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import type { ImportExploreResponse } from "../../apps/web/src/api/types";
import { ImportExplore } from "../../apps/web/src/components/ImportExplore";
import {
  ImportCockpitProvider,
  ImportStepperBar,
} from "../../apps/web/src/components/ImportStepper";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const HOST = "acme.atlassian.net";
// Genau der Wiretext der Route bei einer Frist (rest-client.ts `abbruchMeldung`, Standardfrist 15 s).
const ZEITUEBERSCHREITUNG = "Confluence antwortet nicht — Zeitüberschreitung nach 15 s.";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/import"] },
          createElement(
            ImportCockpitProvider,
            null,
            createElement(ImportStepperBar),
            createElement(ImportExplore),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

function erkundenKnopf(): HTMLButtonElement {
  const gesucht = [
    i18n.t("imp.explore.cta"),
    i18n.t("imp.explore.ctaAgain"),
    i18n.t("imp.explore.exploring"),
  ];
  const btn = [...container.querySelectorAll("button")].find((b) =>
    gesucht.some((t) => (b.textContent ?? "").includes(t)),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Erkunden-Knopf nicht gefunden");
  }
  return btn;
}

function pending(): boolean {
  return (erkundenKnopf().textContent ?? "").includes(i18n.t("imp.explore.exploring"));
}

function text(testid: string): string | null {
  const el = container.querySelector(`[data-testid="${testid}"]`);
  return el ? (el.textContent ?? "").replace(/\s+/g, " ").trim() : null;
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

async function klickErkunden(): Promise<void> {
  await act(async () => {
    erkundenKnopf().click();
    await flush();
  });
}

function keinHost(t: string): void {
  expect(t).not.toContain(HOST);
  expect(t).not.toMatch(/https?:\/\//);
  expect(t).not.toMatch(/ENOTFOUND|getaddrinfo|ECONNREFUSED/);
}

const LANDKARTE = (over: Partial<ImportExploreResponse> = {}): ImportExploreResponse => ({
  summary: {
    totalCount: 2,
    distinctSources: 1,
    dateRange: null,
    authors: [{ name: "anna", count: 2 }],
    themes: [],
    spaces: [{ name: "K", count: 2 }],
  } as unknown as ImportExploreResponse["summary"],
  truncated: false,
  alreadyImported: 0,
  alreadyQueued: 0,
  mappedPages: 2,
  failedPages: 0,
  ...over,
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2683 D2 · Erkunden, gemountet — der erste Netzaufruf löst nie auf", () => {
  it("GEGENPROBE: solange die Route nicht antwortet, dreht der Knopf — die Fläche kann das Warten nicht selbst beenden", async () => {
    endpunkt.explore = () => new Promise(() => undefined); // nie
    await mount();
    await klickErkunden();
    await warte(300);
    await act(flush);
    expect(pending()).toBe(true); // „Erkunde …" — das ist der Zustand, den D1/D2 zeitlich begrenzen
    expect(text("explore-error")).toBeNull();
  });

  it("die Route antwortet nach ihrer Frist mit 504 CONFLUENCE_TIMEOUT → der Spinner endet, der Mensch liest die Zeitüberschreitung, keinen Host", async () => {
    endpunkt.explore = () =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new ApiError(504, "CONFLUENCE_TIMEOUT", ZEITUEBERSCHREITUNG)), 100),
      );
    await mount();
    await klickErkunden();
    expect(pending()).toBe(true); // erst dreht er …
    await warte(300);
    await act(flush);
    expect(pending()).toBe(false); // … dann endet er
    const fehler = text("explore-error");
    expect(fehler).toBe(ZEITUEBERSCHREITUNG);
    expect(fehler).toContain("Zeitüberschreitung");
    expect(fehler).not.toContain("fehlgeschlagen"); // nicht mehr der pauschale Alttext
    keinHost(pageText());
  });

  it("KALIBRIERUNG: ein anderer Fehler zeigt weiterhin den pauschalen Text — die Diagnose kommt nur, wenn es eine ist", async () => {
    endpunkt.explore = () =>
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new ApiError(502, "EXPLORE_FAILED", "Confluence-Erkundung fehlgeschlagen.")),
          50,
        ),
      );
    await mount();
    await klickErkunden();
    await warte(200);
    await act(flush);
    expect(text("explore-error")).toBe("Confluence-Erkundung fehlgeschlagen.");
  });
});

describe("JOB 2683 D2 · Erkunden, gemountet — die zweite Ergebnisseite überschreitet die Frist", () => {
  it("die gelesenen Seiten bleiben sichtbar, das Ergebnis heißt unvollständig, der Grund steht dabei", async () => {
    endpunkt.explore = () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve(
              LANDKARTE({
                truncated: true,
                abbruch: { grund: "timeout", nachSeiten: 2, meldung: ZEITUEBERSCHREITUNG },
              }),
            ),
          100,
        ),
      );
    await mount();
    await klickErkunden();
    await warte(300);
    await act(flush);
    expect(pending()).toBe(false);
    expect(text("explore-error")).toBeNull(); // kein Fehler — ein Ergebnis mit Wahrheit
    // Die gelesenen Seiten stehen in der Landkarte (Kennzahl „Seiten" = 2) …
    expect(pageText()).toContain(i18n.t("imp.explore.pages"));
    expect(container.querySelector('[data-testid="explore-truncated"]')).not.toBeNull();
    // … und das Ergebnis ist als unvollständig gekennzeichnet, mit Grund und Seitenzahl.
    const grund = text("explore-abbruch");
    expect(grund).toBe(i18n.t("imp.explore.abbruch.timeout", { n: 2 }));
    expect(grund).toContain("unvollständig");
    expect(grund).toContain("Zeitüberschreitung");
    expect(grund).toContain("2 Seiten");
    keinHost(pageText());
  });

  it("GEGENPROBE: ohne Abbruch (Seiten-Cap) steht nur der Cap-Hinweis, kein Grund", async () => {
    endpunkt.explore = () => Promise.resolve(LANDKARTE({ truncated: true }));
    await mount();
    await klickErkunden();
    await act(flush);
    expect(container.querySelector('[data-testid="explore-truncated"]')).not.toBeNull();
    expect(text("explore-abbruch")).toBeNull();
  });

  it("GEGENPROBE: vollständige Erkundung — weder unvollständig noch Grund", async () => {
    endpunkt.explore = () => Promise.resolve(LANDKARTE());
    await mount();
    await klickErkunden();
    await act(flush);
    expect(text("explore-truncated")).toBeNull();
    expect(text("explore-abbruch")).toBeNull();
    expect(text("explore-error")).toBeNull();
  });
});
