// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega67 BLOCK G — DER KOSTENHINWEIS WIRD AN SEINE BEDINGUNG GEBUNDEN.
// ================================================================================================
//
// DER BEFUND (Pedi 30.07.): „Die kostenpflichtige sollte nur kommen, wenn eine öffentliche KI
// aktiviert ist." Seit mega62 steht `ai.costHint` — „Ein Klick startet sofort eine echte,
// KOSTENPFLICHTIGE KI-Anfrage" — an allen Auslösestellen UNBEDINGT. Läuft die Aufgabe über den
// deterministischen Ersatzweg oder über das LOKALE Modell, kostet der Klick nichts, und der Satz
// ist dann eine falsche Tatsachenaussage in der Oberfläche — dieselbe Klasse wie die
// 24-Stunden-Zusage, die mega65 entfernt hat.
//
// DIE ABGRENZUNG, DIE HIER MITGEPRÜFT WIRD UND DIE DER EIGENTLICHE GRUND FÜR DEN TEST IST:
// Der KI-Satz nach Artikel 50 (`ai.generatedNotice`) hängt am KI-ERZEUGNIS, NICHT am Preis. Ein
// lokal erzeugter Text ist genauso kennzeichnungspflichtig wie ein Cloud-erzeugter. Wer beide
// Sätze zusammen bedingt, baut eine Rechtslücke. Deshalb belegt JEDER Fall unten BEIDE Sätze:
// der Kostenhinweis folgt der Bedingung, der KI-Satz steht IMMER.
import { afterEach, describe, expect, it, vi } from "vitest";

// Nicht-Admin: die per-Aufgabe-Auflösung (/api/reasoner/config, users.manage) wird gar nicht erst
// gezogen (vip2-gate) — genau der Weg, den die überwiegende Mehrheit der Nutzer sieht. Die Auskunft
// muss also aus dem ÖFFENTLICHEN, abstrahierten Status kommen.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      config: vi.fn(),
      status: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ReasonerStatus } from "../../apps/web/src/api/types";
import { AiModelInfo } from "../../apps/web/src/components/AiModelInfo";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const statusMock = endpoints.reasoner.status as unknown as ReturnType<typeof vi.fn>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(task: string): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(AiModelInfo, { task })),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const kostenhinweis = (c: HTMLElement): boolean =>
  c.querySelector("[data-testid=ai-cost-hint]") !== null;
const kiSatz = (c: HTMLElement): boolean =>
  c.querySelector("[data-testid=ai-generated-notice]") !== null;

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega67 G · der Kostenhinweis erscheint NUR, wenn der Klick wirklich kostet", () => {
  it("Cloud-Modell für DIESE Aufgabe aktiv und erreichbar → Hinweis steht", async () => {
    const status: ReasonerStatus = {
      active: true,
      mode: "cloud",
      reachable: "active",
      tasks: { structure: true },
      billable: { structure: true },
    };
    statusMock.mockResolvedValue(status);
    const { container, unmount } = await mount("structure");
    expect(kostenhinweis(container)).toBe(true);
    // Artikel 50: der KI-Satz steht ebenfalls — er hängt am Erzeugnis, nicht am Preis.
    expect(kiSatz(container)).toBe(true);
    unmount();
  });

  it("deterministischer Betrieb → KEIN Kostenhinweis, aber der KI-Satz bleibt", async () => {
    const status: ReasonerStatus = {
      active: false,
      mode: "deterministic",
      reachable: "none",
      tasks: { structure: false },
      billable: { structure: false },
    };
    statusMock.mockResolvedValue(status);
    const { container, unmount } = await mount("structure");
    expect(kostenhinweis(container)).toBe(false);
    expect(kiSatz(container)).toBe(true);
    unmount();
  });

  // DER FALL, DER DEN GLOBALEN `mode` ALS QUELLE AUSSCHLIESST: `mode` ist die HAUSWEITE Stufe
  // (usingPrimary() ? cloud : …) und sagt nichts über die Kette DIESER Aufgabe. Eine Installation
  // kann Cloud verdrahtet haben (mode="cloud") und trotzdem `structure` ausdrücklich lokal oder
  // deterministisch stellen — dann kostet dieser Klick nichts, und der Satz muss schweigen.
  it("mode=cloud, aber DIESE Aufgabe läuft lokal → kein Kostenhinweis", async () => {
    const status: ReasonerStatus = {
      active: true,
      mode: "cloud",
      reachable: "active",
      tasks: { structure: true }, // nutzbar — aber über das LOKALE Modell
      billable: { structure: false },
    };
    statusMock.mockResolvedValue(status);
    const { container, unmount } = await mount("structure");
    expect(kostenhinweis(container)).toBe(false);
    expect(kiSatz(container)).toBe(true);
    unmount();
  });

  // Solange der Status nicht da ist, wird NICHTS behauptet. Ein Kostenhinweis, der beim Laden
  // aufblitzt und dann verschwindet, wäre für den Moment seines Aufblitzens genau die falsche
  // Tatsachenaussage, die dieser Block beseitigt. Der KI-Satz braucht keinen Status und steht.
  it("Status noch nicht geladen → kein Kostenhinweis (keine unbelegte Behauptung)", async () => {
    statusMock.mockImplementation(() => new Promise(() => {})); // antwortet nie
    const { container, unmount } = await mount("structure");
    expect(kostenhinweis(container)).toBe(false);
    expect(kiSatz(container)).toBe(true);
    unmount();
  });
});
