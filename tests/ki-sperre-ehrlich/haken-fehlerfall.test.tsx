import { afterEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ReasonerTask } from "../../apps/web/src/api/types";
import type { AiAvailability } from "../../apps/web/src/lib/aiAvailability";
import { useAiAvailable } from "../../apps/web/src/lib/useAiAvailable";

const query = vi.hoisted(() => ({
  data: undefined as undefined | { active: boolean; mode: string; tasks: { answer: boolean } },
  isLoading: false,
  isError: true,
}));
vi.mock("../../apps/web/src/api/hooks", () => ({ useReasonerStatus: () => query }));
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  query.data = undefined;
  query.isLoading = false;
  query.isError = true;
});

function lesen(task: ReasonerTask = "answer"): AiAvailability | undefined {
  let wert: AiAvailability | undefined;
  function Probe() {
    wert = useAiAvailable(task);
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    act(() => root.render(createElement(Probe)));
    return wert;
  } finally {
    act(() => root.unmount());
  }
}

describe("JOB 3220 · Fehlerkenntnis im bestehenden Haken", () => {
  it.each<ReasonerTask>(["answer", "structure", "extract", "assist", "group", "describe"])(
    "F1 · %s: Fehler ohne Daten bleibt gesperrt und ist ausdrücklich unbekannt",
    (task) => {
      expect(lesen(task)).toEqual({ available: false, isLoading: false, statusUnknown: true });
    },
  );
  it.each([true, false])(
    "Cache verfügbar=%s: Fehler macht bekannte Daten nicht unbekannt",
    (active) => {
      query.data = { active, mode: "cloud", tasks: { answer: active } };
      expect(lesen()).toEqual({ available: active, isLoading: false, statusUnknown: false });
    },
  );
  it("Laden ohne Daten bleibt bedienbar", () => {
    query.isError = false;
    query.isLoading = true;
    expect(lesen()).toEqual({ available: true, isLoading: true, statusUnknown: false });
  });
  it("Erfolgreich leer ist kein Abruffehler und bleibt gesperrt", () => {
    query.isError = false;
    expect(lesen()).toEqual({ available: false, isLoading: false, statusUnknown: false });
  });
});
