// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega29 C4 (bens M28-3) — DIE ERFASSEN-KARTE BEKOMMT IHREN EIGENEN PIN.
// ================================================================================================
//
// mega28 hat die Abdeckungs-Einschränkung an zwei Stellen sichtbar gemacht — und nur EINE davon
// gemountet belegt: `tests/validation/ai-check-coverage-visible-mounted.test.tsx` prüft das
// AiCheckBadge. Die Bestätigungskarte auf /erfassen, die denselben Satz trägt, war unbelegt: dass
// sie ihn rendert, stand nur im Quelltext.
//
// Hier steht der Beleg. Gemountet an der ECHTEN Erfassen-Seite, über den echten Klickpfad bis zur
// Bestätigungskarte. Und beidseitig kalibriert: ein wirklich vollständiger Lauf schweigt weiterhin —
// ohne diese Gegenprobe belegte der Test nur, dass irgendwo ein Text auftaucht.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiCheckCoverage } from "../../apps/web/src/api/types";

const data = vi.hoisted(() => ({ coverage: null as unknown }));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const created = () => ({
    id: "k1",
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf pruefen.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
    tags: [],
    confidence: 0.8,
    trust: 40,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    confidentiality: "intern",
    asset: null,
    createdAt: "2026-07-26T06:00:00.000Z",
    history: [],
    // Genau das Feld, um das es geht: die Abdeckung des Laufs, der zu diesem Beitrag gehört.
    aiCheck: {
      status: "done",
      requestedAt: "2026-07-26T06:00:00.000Z",
      finishedAt: "2026-07-26T06:01:00.000Z",
      coverage: data.coverage,
    },
  });
  // Die Erfassen-Seite liest sehr viele Endpunkte; für DIESEN Beleg zählt genau einer (ko.create,
  // dessen Antwort die Abdeckung trägt). Alles nicht ausdrücklich Genannte antwortet deshalb
  // neutral mit `null` — die Ladeverträge der Seite behandeln das als „nichts vorhanden", und der
  // Test hängt nicht an einer Liste fremder Endpunkte, die er gar nicht prüft.
  const leer = () => vi.fn(async () => null);
  const neutraleGruppe = new Proxy({} as Record<string, unknown>, { get: () => leer() });
  const explizit: Record<string, unknown> = {
    ko: {
      create: vi.fn(async () => created()),
      get: vi.fn(async () => created()),
      list: vi.fn(async () => []),
    },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "ok",
        tasks: { structure: true, extract: true },
      })),
      config: vi.fn(async () => null),
      structure: vi.fn(async () => ({
        title: "Dichtungswechsel L4",
        statement: "Dichtung vor jedem Anlauf pruefen.",
        type: "best_practice",
        category: "Instandhaltung",
        tags: ["dichtung"],
        conditions: [],
        measures: [],
      })),
    },
    drafts: {
      list: vi.fn(async () => []),
      save: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    directory: { list: vi.fn(async () => []) },
    gaps: { summary: vi.fn(async () => ({ items: [] })) },
    uploadLimits: {
      get: vi.fn(async () => ({
        maxImageBytes: 1_000_000,
        maxDocumentBytes: 1_000_000,
        maxRawBytes: 1_000_000,
        maxBodyBytes: 1_000_000,
      })),
    },
    external: { policy: vi.fn(async () => ({ stage: "blocked" })) },
    objects: { upload: vi.fn(async () => ({ id: "o1" })) },
  };
  return {
    endpoints: new Proxy(explizit, {
      get: (target, prop: string) => (prop in target ? target[prop] : neutraleGruppe),
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const pageText = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

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
          { initialEntries: ["/erfassen"] },
          createElement(
            AuthProvider,
            null,
            createElement(
              RoleProvider,
              null,
              createElement(
                ToastProvider,
                null,
                createElement(NavGuardProvider, null, createElement(Capture)),
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

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function buttonByText(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(label),
  );
  const btn = found[found.length - 1];
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${label}" nicht gefunden. Sichtbar: ${pageText().slice(0, 800)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
  await act(flush);
}

async function change(el: HTMLElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Der Klickpfad bis zur Bestätigungskarte: erzählen → strukturieren → einreichen. */
async function bisZurKarte(): Promise<void> {
  await mount();
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error(`Erzähl-Feld nicht gefunden. Sichtbar: ${pageText().slice(0, 800)}`);
  }
  await change(textarea, "Die Dichtung an Linie 4 muss regelmäßig getauscht werden.");
  await click(buttonByText(i18n.t("capture.structure")));
  await click(buttonByText(i18n.t("capture.submit")));
}

const CAPPED: AiCheckCoverage = {
  available: 12479,
  selected: 20,
  alreadyOpen: 0,
  attempted: 20,
  completed: 20,
  skipped: 0,
  capped: true,
  aborted: false,
};

describe("mega29 C4 · die Bestätigungskarte auf /erfassen trägt die Einschränkung nachweislich", () => {
  it("gedeckelter Lauf → der Satz steht auf der Karte, direkt unter dem „geprüft“", async () => {
    data.coverage = CAPPED;
    await bisZurKarte();

    expect(pageText()).toContain(i18n.t("capture.savedTitle"));
    // mega29 B3: die Zahl ist eine konservative Mindestabdeckung — und heißt auch so.
    expect(pageText()).toContain("mindestens");
    expect(pageText()).toContain("12479");
    expect(pageText()).toContain("Konflikten und Duplikaten");
  });

  it("mega29 B4 · Abbruch UND Übersprünge stehen NEBENEINANDER auf der Karte", async () => {
    data.coverage = { ...CAPPED, completed: 5, skipped: 3, aborted: true };
    await bisZurKarte();

    expect(pageText()).toContain(i18n.t("capture.savedTitle"));
    // Bis mega28 verdrängte der Abbruchtext den Übersprung-Text vollständig.
    expect(pageText()).toContain("Abgebrochen");
    expect(pageText()).toContain("ausgelassen");
    expect(pageText()).toContain("3");
  });

  it("KALIBRIERUNG: vollständiger Lauf → die Karte schweigt (kein Dauerrauschen)", async () => {
    data.coverage = {
      available: 12,
      selected: 12,
      alreadyOpen: 0,
      attempted: 12,
      completed: 12,
      skipped: 0,
      capped: false,
      aborted: false,
    } satisfies AiCheckCoverage;
    await bisZurKarte();

    expect(pageText()).toContain(i18n.t("capture.savedTitle"));
    expect(pageText()).not.toContain("Konflikten und Duplikaten");
  });
});
