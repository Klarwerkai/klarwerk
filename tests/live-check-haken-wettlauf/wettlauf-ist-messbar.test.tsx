// @vitest-environment jsdom
// Derselbe H1/H2/H3-Bestand, keine Abschrift: die Wiederaufnahme nach asynchronem act wird
// künstlich um mindestens 30 echte ms verzögert (Bestandsentprellung: 5 ms). Dabei dürfen
// Antworten eintreffen. Die Testuhr der reparierten Sofort-Messung bleibt davon unberührt.
import { afterAll, expect, vi } from "vitest";

const last = vi.hoisted(() => ({ abgaben: 0, kuerzeste: Number.POSITIVE_INFINITY }));

vi.mock("../../apps/web/node_modules/react", async () => {
  const echt = await vi.importActual<typeof import("../../apps/web/node_modules/react")>(
    "../../apps/web/node_modules/react",
  );
  const { setTimeout: pause } = await import("node:timers/promises");
  const { performance } = await import("node:perf_hooks");
  return {
    ...echt,
    act: (callback: () => void | Promise<void>) => {
      if (callback.constructor.name !== "AsyncFunction") return echt.act(callback);
      return (async () => {
        await echt.act(callback);
        const start = performance.now();
        await echt.act(async () => {
          // Erneut abgeben, falls eine Plattform ihren Zeitgeber geringfügig zu früh weckt.
          while (performance.now() - start < 30) await pause(30);
        });
        last.abgaben += 1;
        last.kuerzeste = Math.min(last.kuerzeste, performance.now() - start);
      })();
    },
  };
});

import "../live-check-verdrahtung/hook-schluessel.test";

afterAll(() => {
  expect(last.abgaben).toBeGreaterThan(0);
  expect(last.kuerzeste).toBeGreaterThanOrEqual(30);
  console.info(`LAST: ${last.abgaben} Abgaben, Minimum ${last.kuerzeste.toFixed(1)} ms > 5 ms`);
});
