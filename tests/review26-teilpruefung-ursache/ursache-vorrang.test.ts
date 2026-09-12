// Mutationen: ersten statt häufigsten Grund wählen / Stichentscheid umdrehen → Vorrangfälle rot.
// Fristausgang durch verspäteten Providergrund überschreiben → timeout-Fall rot.
// Normale Abnahmetests: fehlende Funktion darf nicht durch it.fails als bestanden erscheinen.
import { expect, it, vi } from "vitest";
import { classifyAiCheckFailure, runWithTimeout } from "../../services/app/src/ai-check-worker";
import { ModelHttpError } from "../../services/reasoner";
import { fixture } from "./fixture";

it("häufigste Klasse gewinnt auch wenn bad-response zuerst auftritt", async () => {
  const f = await fixture([
    new SyntaxError("Unexpected token"),
    new Error("ECONNREFUSED"),
    new Error("ECONNREFUSED"),
  ]);
  expect((await f.run()).fallbackReason).toBe("unreachable");
});
it("bei Gleichstand gewinnt auth vor rate-limit unabhängig von der Reihenfolge", async () => {
  const f = await fixture([
    new ModelHttpError("HTTP 429", 429),
    new ModelHttpError("HTTP 401", 401),
  ]);
  expect((await f.run()).fallbackReason).toBe("auth");
});

// Mutation: Einzelvergleichsgrund vor dem klassifizierten Laufabbruch wählen → auth-Fall rot.
// Echte Best-effort-Kante: der Einstellungsabruf bricht den Duplikatlauf vor seinen Paaren ab.
it("klassifizierter Laufabbruch gewinnt vor einem Einzelvergleichsgrund", async () => {
  const f = await fixture([new Error("ECONNREFUSED")], false, "conflict");
  const failure = new ModelHttpError("HTTP 401", 401);
  const settings = vi.spyOn(f.services.overlapSettings, "get").mockRejectedValueOnce(failure);
  try {
    const outcome = await f.run();
    expect(f.calls.conflict).toBe(1);
    expect(f.calls.duplicate).toBe(0);
    expect(settings).toHaveBeenCalledOnce();
    expect(outcome.coverage).toMatchObject({ skipped: 1, aborted: true });
    expect(outcome.fallbackReason).toBe(classifyAiCheckFailure(failure));
  } finally {
    settings.mockRestore();
  }
});
it("Job-Frist behält timeout trotz späterem echten Teilausfall", async () => {
  const f = await fixture([new Error("ECONNREFUSED")]);
  vi.useFakeTimers();
  try {
    const pending = runWithTimeout(
      new Promise<Awaited<ReturnType<typeof f.run>>>((resolve) => {
        setTimeout(() => {
          void f.run().then(resolve);
        }, 20);
      }),
      10,
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toEqual({ ok: false, fallbackReason: "timeout" });
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toEqual({ ok: false, fallbackReason: "timeout" });
  } finally {
    vi.useRealTimers();
  }
});
