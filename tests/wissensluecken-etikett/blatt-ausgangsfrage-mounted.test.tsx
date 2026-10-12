// @vitest-environment jsdom
// ================================================================================================
// N-0084 — DIE AUSGANGSFRAGE STEHT ÜBER DEM EDITOR, WENN DAS BLATT AUS EINER LÜCKE KOMMT.
// ================================================================================================
//
// Befund (Seiteninventar 08.09., 28-luecke-erfassen): „Wissen erfassen öffnet einen leeren Editor
// ohne sichtbaren Wortlaut der Ausgangsfrage." Der Einstieg trägt die Lücken-KENNUNG
// (`/erfassen?gap=<id>`, `lib/captureFromGap.ts`), den Text löst die Seite erst aus der
// berechtigungsgefilterten Lückenliste auf — eine redigierte Lücke zeigt deshalb nichts.
//
// Gemessen am gemounteten Blatt (Bauart aus `tests/legal/blatt-kostenhinweis-je-aufgabe.test.tsx`).
import { afterEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({ gaps: [] as unknown[], gapsAbgefragt: 0 }));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      status: vi.fn(async () => null),
      config: vi.fn(async () => null),
      structure: vi.fn(() => new Promise(() => {})),
      assist: vi.fn(() => new Promise(() => {})),
    },
    drafts: {
      get: vi.fn(async () => {
        throw new Error("kein Entwurf");
      }),
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => {}),
      promote: vi.fn(async () => ({})),
    },
    uploadLimits: {
      get: vi.fn(async () => ({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 })),
    },
    gaps: {
      list: vi.fn(async () => {
        lage.gapsAbgefragt += 1;
        return lage.gaps;
      }),
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { Blatt } from "../../apps/web/src/components/erfassen/Blatt";
import i18n from "../../apps/web/src/i18n";
import { captureGapHref } from "../../apps/web/src/lib/captureFromGap";
import { einzelquelleErfassenHref } from "../../apps/web/src/lib/meineEinzelquellen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const FRAGE = "Wie lange muss die Pumpe nach dem Anfahren entlüftet werden?";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(adresse: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            AuthProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [adresse] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(Blatt, {
                    arbeitsraum: () => createElement("div", { "data-testid": "arbeitsraum" }),
                  }),
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
}

afterEach(async () => {
  if (root) {
    const r = root;
    await act(async () => {
      r.unmount();
    });
    root = null;
    container.remove();
  }
  lage.gaps = [];
  lage.gapsAbgefragt = 0;
  vi.clearAllMocks();
});

const ausgangsfrage = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="blatt-ausgangsfrage"]');

describe("N-0084 · die Ausgangsfrage über dem Antworteditor", () => {
  it("aus der Lücke geöffnet: die Frage steht im Wortlaut über dem Blatt", async () => {
    lage.gaps = [
      {
        id: "g1",
        question: FRAGE,
        status: "offen",
        assignee: "u1",
        priority: "hoch",
        createdAt: "2026-09-08T00:00:00.000Z",
      },
    ];
    await mount(captureGapHref("g1"));
    const el = ausgangsfrage();
    expect(el, "die Ausgangsfrage fehlt über dem Blatt").not.toBeNull();
    expect(el?.textContent).toContain(FRAGE);
    expect(el?.textContent).toContain(i18n.t("gap.ausgangsfrage"));
    // ÜBER dem Editor: die Ausgangsfrage steht im Dokument vor dem Blatt mit Titel und Schreibfläche.
    const blatt = container.querySelector('[data-testid="blatt"]');
    expect(blatt).not.toBeNull();
    expect(
      el && blatt ? el.compareDocumentPosition(blatt) & Node.DOCUMENT_POSITION_FOLLOWING : 0,
    ).toBeTruthy();
  }, 20000);

  it("redigierte Lücke: kein Fragetext ohne Berechtigung — die Zeile bleibt weg", async () => {
    lage.gaps = [
      {
        id: "g2",
        question: "",
        redacted: true,
        status: "offen",
        assignee: null,
        priority: "mittel",
        createdAt: "2026-09-08T00:00:00.000Z",
      },
    ];
    await mount(captureGapHref("g2"));
    expect(lage.gapsAbgefragt, "KALIBRIERUNG: die Lückenliste wurde gefragt").toBeGreaterThan(0);
    expect(ausgangsfrage()).toBeNull();
  }, 20000);

  it("R-1626: aus „Wissen, das nur bei dir liegt“ geöffnet — das Thema steht über dem Blatt", async () => {
    await mount("/erfassen?thema=Pumpen");
    expect(container.querySelector('[data-testid="blatt"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="blatt-thema"]')?.textContent).toContain("Pumpen");
  }, 20000);

  it("R-1626: auch das geöffnete Interview trägt das Thema als Kontext", async () => {
    await mount(einzelquelleErfassenHref("Pumpen"));
    expect(
      container.querySelector('[data-testid="blatt-arbeitsraum"]'),
      "KALIBRIERUNG: der Einstieg öffnet den Arbeitsraum des Interviews",
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="blatt-thema"]')?.textContent).toContain("Pumpen");
  }, 20000);

  it("ohne Lücke: das ruhende Blatt fragt die Lückenliste gar nicht erst ab", async () => {
    await mount("/erfassen");
    expect(container.querySelector('[data-testid="blatt"]')).not.toBeNull();
    expect(ausgangsfrage()).toBeNull();
    expect(lage.gapsAbgefragt).toBe(0);
  }, 20000);
});
