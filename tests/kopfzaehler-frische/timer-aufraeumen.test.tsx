// @vitest-environment jsdom
// ================================================================================================
// JOB 3113 · H1b (Runde 2) — DIE UHR IST EINE UHR UND KEIN LECK.
// ================================================================================================
//
// Codex' Prüflücke an Runde 1: der gemountete Test räumt zwar ab, „behauptet aber keine
// Timerfreiheit". Genau das wird hier gezählt — und zwar in einer Fläche, in der es NUR unseren
// Timer gibt: die fünf Lese-Hooks sind durch feste Objekte ersetzt, react-query läuft gar nicht mit.
//
// Gemessen werden die drei Zusagen aus Lieferung 4:
//   · genau EIN Timer, solange eine Frist bevorsteht (kein Sekundenticker),
//   · KEIN Timer mehr, wenn nichts mehr zu befristen ist,
//   · KEIN Timer mehr nach dem Abmelden (kein Leck in einer Fläche, die auf jeder Seite lebt).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STAND = vi.hoisted(() => 1_700_000_000_000);

vi.mock("../../apps/web/src/api/hooks", () => {
  const quelle = (daten: unknown) => () => ({
    data: daten,
    isError: false,
    dataUpdatedAt: STAND,
    refetch: () => {},
  });
  return {
    useValidationBoard: quelle([{ id: "a" }, { id: "b" }]),
    useConflicts: quelle([]),
    useDuplicates: quelle([]),
    useGapsSummary: quelle({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } }),
    useLifecyclePending: quelle([]),
  };
});

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { useNavBadges } from "../../apps/web/src/app/useNavBadges";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Eine Sonde, die nichts anzeigt und nur den Hook am Leben hält. */
function Sonde(): null {
  useNavBadges();
  return null;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.useFakeTimers();
  // Die Uhr steht auf demselben Zeitpunkt wie die Bestätigung der Quellen: die Frist steht bevor.
  vi.setSystemTime(STAND);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  container.remove();
  vi.useRealTimers();
});

describe("JOB 3113 H1b: der Fristtimer läuft einmal und räumt sich weg", () => {
  it("genau EIN Timer solange die Frist läuft, keiner mehr nach ihrem Ablauf, keiner nach dem Abmelden", () => {
    const ohneSonde = vi.getTimerCount();

    act(() => {
      root.render(createElement(Sonde));
    });
    expect(vi.getTimerCount(), "genau ein Fristtimer, kein Sekundenticker").toBe(ohneSonde + 1);

    // Die Frist läuft ab: der Timer feuert, zeichnet einmal neu — und danach ist NICHTS mehr zu
    // befristen (alle Quellen sind abgelaufen), also läuft auch kein neuer Timer.
    act(() => {
      vi.advanceTimersByTime(ZAEHLER_FRISCHE_MS + 1_000);
    });
    expect(vi.getTimerCount(), "nach dem Ablauf läuft kein Timer weiter").toBe(ohneSonde);

    act(() => {
      root.unmount();
    });
    expect(vi.getTimerCount(), "nach dem Abmelden bleibt kein Timer übrig").toBe(ohneSonde);
  });

  it("das Abmelden MITTEN in der laufenden Frist räumt den Timer weg", () => {
    const ohneSonde = vi.getTimerCount();
    act(() => {
      root.render(createElement(Sonde));
    });
    expect(vi.getTimerCount()).toBe(ohneSonde + 1);

    act(() => {
      vi.advanceTimersByTime(ZAEHLER_FRISCHE_MS / 2);
    });
    expect(vi.getTimerCount(), "die Frist läuft noch — der Timer steht").toBe(ohneSonde + 1);

    act(() => {
      root.unmount();
    });
    expect(vi.getTimerCount(), "abgemeldet mitten in der Frist: kein Timer übrig").toBe(ohneSonde);
    // Und die Zeit darf danach weiterlaufen, ohne dass irgendetwas nachschlägt.
    expect(() => vi.advanceTimersByTime(ZAEHLER_FRISCHE_MS * 2)).not.toThrow();
  });
});
