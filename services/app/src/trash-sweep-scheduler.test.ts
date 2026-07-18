import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRASH_SWEEP_INTERVAL_MS,
  type IntervalHandle,
  MIN_TRASH_SWEEP_INTERVAL_MS,
  resolveTrashSweepIntervalMs,
  startTrashSweepScheduler,
} from "./trash-sweep-scheduler";

// SCRUM-523 P.3 (WP1-Batch3): der periodische Papierkorb-Sweep. Timer-Abstraktion einspritzbar →
// deterministisch testbar ohne echte Zeit.

describe("resolveTrashSweepIntervalMs", () => {
  it("fehlend/ungültig → Default", () => {
    expect(resolveTrashSweepIntervalMs(undefined)).toBe(DEFAULT_TRASH_SWEEP_INTERVAL_MS);
    expect(resolveTrashSweepIntervalMs("quatsch")).toBe(DEFAULT_TRASH_SWEEP_INTERVAL_MS);
    expect(resolveTrashSweepIntervalMs("0")).toBe(DEFAULT_TRASH_SWEEP_INTERVAL_MS);
    expect(resolveTrashSweepIntervalMs("-5")).toBe(DEFAULT_TRASH_SWEEP_INTERVAL_MS);
  });

  it("zu klein → auf die Untergrenze angehoben (kein Dauerlauf)", () => {
    expect(resolveTrashSweepIntervalMs("100")).toBe(MIN_TRASH_SWEEP_INTERVAL_MS);
  });

  it("gültig → übernommen", () => {
    expect(resolveTrashSweepIntervalMs("3600000")).toBe(3_600_000);
  });
});

describe("startTrashSweepScheduler", () => {
  // Eine Fake-Timer-Fabrik: fängt den Callback ein, damit der Test die Ticks manuell auslöst.
  function fakeTimers() {
    let captured: (() => void) | null = null;
    let cleared = false;
    const setIntervalFn = (cb: () => void, _ms: number): IntervalHandle => {
      captured = cb;
      return 1 as unknown as IntervalHandle;
    };
    const clearIntervalFn = (_h: IntervalHandle): void => {
      cleared = true;
    };
    return {
      setIntervalFn,
      clearIntervalFn,
      tick: () => captured?.(),
      isCleared: () => cleared,
    };
  }

  it("ruft runSweep bei jedem Tick + meldet Löschungen an onSwept", async () => {
    const timers = fakeTimers();
    let sweeps = 0;
    const swept: number[] = [];
    startTrashSweepScheduler({
      intervalMs: 1000,
      runSweep: async () => {
        sweeps += 1;
        return sweeps; // 1, 2, ...
      },
      onSwept: (n) => swept.push(n),
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });

    timers.tick();
    await Promise.resolve(); // Microtask für das .then() abwarten
    timers.tick();
    await Promise.resolve();

    expect(sweeps).toBe(2);
    expect(swept).toEqual([1, 2]);
  });

  it("purged=0 → onSwept wird NICHT gerufen (kein Rausch-Log)", async () => {
    const timers = fakeTimers();
    let sweptCalls = 0;
    startTrashSweepScheduler({
      intervalMs: 1000,
      runSweep: async () => 0,
      onSwept: () => {
        sweptCalls += 1;
      },
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    timers.tick();
    await Promise.resolve();
    expect(sweptCalls).toBe(0);
  });

  it("ein Sweep-Fehler geht an onError, nicht als unbehandelte Rejection", async () => {
    const timers = fakeTimers();
    const errors: unknown[] = [];
    startTrashSweepScheduler({
      intervalMs: 1000,
      runSweep: async () => {
        throw new Error("sweep down");
      },
      onError: (e) => errors.push(e),
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    timers.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("sweep down");
  });

  it("stop() beendet den Timer", () => {
    const timers = fakeTimers();
    const handle = startTrashSweepScheduler({
      intervalMs: 1000,
      runSweep: async () => 0,
      setIntervalFn: timers.setIntervalFn,
      clearIntervalFn: timers.clearIntervalFn,
    });
    expect(timers.isCleared()).toBe(false);
    handle.stop();
    expect(timers.isCleared()).toBe(true);
  });
});
