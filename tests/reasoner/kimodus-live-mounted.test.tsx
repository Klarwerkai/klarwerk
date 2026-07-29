// @vitest-environment jsdom
// AUFTRAG kimodus-live (Nachtlauf-Bug, 24.07.) — Beweis, dass Topbar-KI-Badge UND die
// Admin-Zeile „Modus" nach dem Übernehmen einer Global-Änderung LIVE (ohne Reload) den neuen
// effektiven Modus zeigen.
//
//  - Unit: invalidateAiState() invalidiert GENAU die beiden Queries, die den AI-STATE speisen
//    (["reasoner","config"] + ["reasoner","status"]) — die eine Quelle, die Admin nach dem
//    Übernehmen aufruft.
//  - Mounted: ein faithful Nachbau der KiModePill (REALE Hooks useReasonerConfig + REALE Ableitung
//    kiHeaderStatus) plus die „Modus"-Zeile. Nach dem Übernehmen (updateConfig + invalidateAiState,
//    exakt wie in Admin) refetcht die config-Query und BEIDE Anzeigen kippen deterministisch↔Modell
//    — im selben Root, ohne Remount. Der zweite config-Aufruf (Refetch) ist der Beleg.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      config: vi.fn(),
      status: vi
        .fn()
        .mockResolvedValue({ active: false, mode: "deterministic", reachable: "none" }),
      updateConfig: vi.fn().mockResolvedValue({ ok: true }),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { useTranslation } from "../../apps/web/node_modules/react-i18next";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { useReasonerConfig, useReasonerStatus } from "../../apps/web/src/api/hooks";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import { AI_STATE_QUERY_KEYS, invalidateAiState } from "../../apps/web/src/lib/aiStateInvalidate";
import { kiHeaderStatus } from "../../apps/web/src/lib/kiHeaderStatus";
import { reasonerReachabilityBadge } from "../../apps/web/src/lib/reasonerReachability";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const configMock = endpoints.reasoner.config as unknown as ReturnType<typeof vi.fn>;
// ben-Auflage B.1: Handle auf den status-Mock, um den ZWEITEN (Refetch-)Aufruf zu zählen.
const statusMock = endpoints.reasoner.status as unknown as ReturnType<typeof vi.fn>;

// Minimal-gültige Konfigurationen (Metadaten, keine Secrets) für die beiden Modi.
function makeConfig(kind: "deterministic" | "cloud"): ReasonerConfigStatus {
  const provider = kind === "cloud" ? "cloud" : "deterministic";
  return {
    provider: kind === "cloud" ? "anthropic" : "deterministisch",
    ...(kind === "cloud" ? { model: "claude" } : {}),
    configured: kind === "cloud",
    mode: kind === "cloud" ? "model" : "demo",
    fallbackAvailable: true,
    supportsLocales: ["de", "en"],
    tasks: ["structure"],
    taskConfig: { global: kind, perTask: {} },
    effective: { structure: kind === "cloud" ? "model" : "deterministic" },
    cloudConfigured: kind === "cloud",
    localConfigured: false,
    effectiveProvider: { structure: provider },
    persisted: false,
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Faithful Nachbau der Topbar-KiModePill (Admin-Sicht) + der Admin-Zeile „Modus":
// GLEICHE Hooks, GLEICHE Ableitung wie im Produktivcode — nur DOM-schlank für den Test.
function KiModeProbe(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const config = useReasonerConfig(true);
  const status = kiHeaderStatus(config.data);
  const modeLabel = config.data
    ? config.data.mode === "model"
      ? t("adm.ai.modeModel")
      : t("adm.ai.modeDemo")
    : "…";
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "badge" }, t(status.labelKey)),
    createElement("span", { "data-testid": "mode" }, modeLabel),
    // „Zuordnung übernehmen" — exakt wie Admin: erst persistieren, dann AI-STATE invalidieren.
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "apply",
        onClick: async () => {
          await endpoints.reasoner.updateConfig({ global: "deterministic", perTask: {} });
          invalidateAiState(qc);
        },
      },
      "übernehmen",
    ),
  );
}

async function mount(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(KiModeProbe)));
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

const badge = (c: HTMLElement) => c.querySelector("[data-testid=badge]")?.textContent;
const mode = (c: HTMLElement) => c.querySelector("[data-testid=mode]")?.textContent;

// ben-Auflage B.1: ein AKTIVER useReasonerStatus()-Konsument — faithful Nachbau der Topbar-
// ReasonerStatusPill (GLEICHER Hook useReasonerStatus + GLEICHE Ableitung reasonerReachabilityBadge),
// DOM-schlank. Bleibt im selben Root gemountet; sein „übernehmen"-Klick ruft exakt wie Admin
// updateConfig + invalidateAiState. Belegt, dass invalidateAiState AUCH die status-Query refetcht.
function ReasonerStatusProbe(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useReasonerStatus();
  const reach = reasonerReachabilityBadge(data);
  return createElement(
    "div",
    null,
    createElement("span", { "data-testid": "reach" }, t(reach.labelKey)),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "apply",
        onClick: async () => {
          await endpoints.reasoner.updateConfig({ global: "deterministic", perTask: {} });
          invalidateAiState(qc);
        },
      },
      "übernehmen",
    ),
  );
}

async function mountStatus(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, createElement(ReasonerStatusProbe)));
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

const reach = (c: HTMLElement) => c.querySelector("[data-testid=reach]")?.textContent;

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("invalidateAiState: eine Quelle für die AI-STATE-Queries", () => {
  it("invalidiert GENAU config + status (die Topbar-/Statuszeilen-Queries)", () => {
    const calls: unknown[] = [];
    const qc = {
      invalidateQueries: (arg: unknown) => {
        calls.push(arg);
        return Promise.resolve();
      },
    } as unknown as QueryClient;
    invalidateAiState(qc);
    expect(calls).toEqual([
      { queryKey: ["reasoner", "config"] },
      { queryKey: ["reasoner", "status"] },
    ]);
    // Absicherung gegen versehentliches Abweichen der Schlüssel-Liste.
    expect(AI_STATE_QUERY_KEYS).toEqual([
      ["reasoner", "config"],
      ["reasoner", "status"],
    ]);
  });
});

describe("Modus-Wechsel deterministisch → Modell spiegelt sich LIVE (ohne Remount)", () => {
  it("Topbar-Badge UND Modus-Zeile kippen nach Übernehmen dank Refetch", async () => {
    // Start: deterministisch. Nach dem Übernehmen liefert die config-Query „cloud/model".
    configMock.mockResolvedValueOnce(makeConfig("deterministic"));
    configMock.mockResolvedValue(makeConfig("cloud"));

    const { container, unmount } = await mount();
    // Vorher: neutraler „Keine KI"-Badge, Modus „Deterministisch".
    expect(badge(container)).toBe("Keine KI");
    expect(mode(container)).toBe("Deterministisch");
    expect(configMock).toHaveBeenCalledTimes(1);

    // Übernehmen → updateConfig + invalidateAiState → Refetch derselben Query.
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=apply]")?.click();
      await flush();
    });

    // Belegter Refetch (zweiter config-Aufruf) und updateConfig genau einmal.
    expect(endpoints.reasoner.updateConfig).toHaveBeenCalledTimes(1);
    expect(configMock).toHaveBeenCalledTimes(2);
    // Live, ohne Reload: Badge zeigt jetzt den WAHREN Modus, Modus-Zeile „Modell".
    expect(badge(container)).toBe("KI rechnet in der Cloud");
    expect(mode(container)).toBe("Modell");
    unmount();
  });

  it("Gegenrichtung Modell → deterministisch kippt ebenso live", async () => {
    configMock.mockResolvedValueOnce(makeConfig("cloud"));
    configMock.mockResolvedValue(makeConfig("deterministic"));

    const { container, unmount } = await mount();
    expect(badge(container)).toBe("KI rechnet in der Cloud");
    expect(mode(container)).toBe("Modell");

    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=apply]")?.click();
      await flush();
    });

    expect(configMock).toHaveBeenCalledTimes(2);
    expect(badge(container)).toBe("Keine KI");
    expect(mode(container)).toBe("Deterministisch");
    unmount();
  });
});

// ben-Auflage B.1: der bisher fehlende Mounted-Beleg für die ZWEITE Query. Der Unit-Test oben
// zeigt, dass invalidateAiState BEIDE Schlüssel invalidiert; hier wird belegt, dass ein aktiver
// useReasonerStatus()-Konsument nach invalidateAiState() tatsächlich einen ZWEITEN status-Netzaufruf
// (Refetch) auslöst und live kippt — ohne Remount.
describe("ben-Auflage B.1: status-Query refetcht live nach invalidateAiState (ohne Remount)", () => {
  it("aktiver useReasonerStatus()-Konsument löst zweiten endpoints.reasoner.status-Aufruf aus", async () => {
    // Start: offline. Nach dem Übernehmen liefert die status-Query „aktiv/erreichbar".
    statusMock.mockResolvedValueOnce({ active: false, mode: "deterministic", reachable: "none" });
    statusMock.mockResolvedValue({ active: true, mode: "cloud", reachable: "active" });

    const { container, unmount } = await mountStatus();
    // Vorher: ein einziger initialer status-Fetch, Badge „Reasoner offline".
    // AUFTRAG-mega51 BLOCK G1: „Reasoner" ist ein Fachwort — in der Oberfläche steht „KI-Modell".
    expect(reach(container)).toBe("Kein KI-Modell");
    expect(statusMock).toHaveBeenCalledTimes(1);

    // Übernehmen → updateConfig + invalidateAiState → Refetch der status-Query.
    await act(async () => {
      container.querySelector<HTMLButtonElement>("[data-testid=apply]")?.click();
      await flush();
    });

    // Der zweite status-Aufruf (Refetch) ist der geforderte Beleg; die Pille kippt live.
    expect(endpoints.reasoner.updateConfig).toHaveBeenCalledTimes(1);
    expect(statusMock).toHaveBeenCalledTimes(2);
    expect(reach(container)).toBe("KI-Modell antwortet");
    unmount();
  });
});
