// Mutation: providerFailure in einem App-Adapter verwerfen → dessen Klassenfälle werden rot.
import { expect, it, vi } from "vitest";
import { reasonFromModelFailure } from "../../services/app/src/ai-check-worker";
import {
  ModelHttpError,
  ModelProvider,
  ModelTimeoutError,
  Reasoner,
} from "../../services/reasoner";
import { classifyModelFailure } from "../../services/reasoner/src/model-errors";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { fixture } from "./fixture";

for (const kind of ["conflict", "duplicate"] as const) {
  for (const error of [
    new Error("ECONNREFUSED"),
    new SyntaxError("Unexpected token"),
    new ModelTimeoutError("timeout", 10),
    new ModelHttpError("HTTP 401", 401),
    new Error("unbekannter Ausfall"),
  ]) {
    it(`${kind}: ${error.name}/${error.message} bleibt best-effort und nennt die Produktklasse`, async () => {
      const f = await fixture([error]);
      const expected = reasonFromModelFailure(classifyModelFailure(error));
      await expect(f.detect(kind)).resolves.toMatchObject({
        skipped: 1,
        aborted: false,
        skippedReasons: { [expected]: 1 },
      });
      expect((await f.run()).fallbackReason).toBe(expected);
    });
  }
  it(`${kind}: kein zulässiges Modell`, async () => {
    const f = await fixture([undefined]);
    f.services.reasoner = new Reasoner();
    expect(await f.detect(kind)).toMatchObject({ skipped: 1, skippedReasons: { "no-model": 1 } });
    expect(await f.run()).toMatchObject({ ok: false, fallbackReason: "no-model" });
  });
  it(`${kind}: vertraulicher Kandidat sperrt Cloud auch bei internem Subjekt`, async () => {
    const f = await fixture([undefined], true);
    expect(await f.detect(kind)).toMatchObject({ skipped: 1, skippedReasons: { confidential: 1 } });
    expect(await f.run()).toMatchObject({ ok: false, fallbackReason: "confidential" });
    expect(f.calls[kind]).toBe(0);
  });

  // Mutation: no-model bei status().active ignorieren → der Lauf meldet fälschlich Erfolg.
  it(`${kind}: eingerichtetes Modell ohne Freigabe schließt mit no-model statt done`, async () => {
    const f = await fixture([undefined]);
    const reasoner = f.services.reasoner;
    await reasoner.setTaskConfig({ ...reasoner.getTaskConfig(), kiFreigabe: {} });
    expect(reasoner.status().active).toBe(true);
    expect(await f.detect(kind)).toMatchObject({ skipped: 1, skippedReasons: { "no-model": 1 } });
    expect(await f.run()).toMatchObject({ ok: false, fallbackReason: "no-model" });
    expect(f.calls).toEqual({ conflict: 0, duplicate: 0 });
  });

  // Mutation: lokalen Fehler durch die Cloud-Sperre ersetzen → vollständiger Outcome wird rot.
  it(`${kind}: Cloud ausgeschlossen und lokaler Netzfehler ergeben unreachable`, async () => {
    const f = await fixture([undefined], true);
    let cloudCalls = 0;
    let localCalls = 0;
    const networkError = new Error("ECONNREFUSED");
    f.services.reasoner = new Reasoner(
      new ModelProvider({
        name: "test-cloud",
        rejectsConfidential: true,
        async complete() {
          cloudCalls += 1;
          throw new Error("Das Routing muss diesen Aufruf verhindern");
        },
      }),
      undefined,
      undefined,
      undefined,
      new ModelProvider({
        name: "local:test",
        rejectsConfidential: false,
        async complete() {
          localCalls += 1;
          throw networkError;
        },
      }),
    );
    // Grundfreigabe allein: vertrauliche Paare schließen die Cloud bereits im Routing aus.
    // Der lokale Provider wird wirklich befragt; dessen Fehler muss bis zum Runner reisen.
    await erteileKiFreigabe(f.services.reasoner);
    const judge = kind === "conflict" ? "judgeConflictOutcome" : "judgeDuplicateOutcome";
    expect(await f.services.reasoner[judge]("A", "B", "de", true)).toEqual({
      verdict: null,
      failure: "model-error",
      providerFailure: { failureClass: "network" },
    });
    const expected = reasonFromModelFailure(classifyModelFailure(networkError));
    expect(await f.detect(kind)).toMatchObject({ skippedReasons: { [expected]: 1 } });
    expect(await f.run()).toMatchObject({ ok: false, fallbackReason: expected });
    expect(cloudCalls).toBe(0);
    expect(localCalls).toBe(4);
  });

  // Mutation: outcome.failure vor providerFailure wählen → beide Adapter/Runner werden rot.
  // Der widersprüchliche Drahtausgang wird hier direkt injiziert. Ihn über die echte Cloud-Kette
  // zu erzeugen erforderte eine Vertraulichkeitsfreigabe; die steht diesem Test nicht zu.
  // Der echte Routing-/Providerweg bleibt im vorherigen Fall mit Cloud-Null separat gemessen.
  it(`${kind}: strukturierter Providerfehler gewinnt vor grobem confidential-Ausgang`, async () => {
    const f = await fixture([undefined]);
    const judge = kind === "conflict" ? "judgeConflictOutcome" : "judgeDuplicateOutcome";
    const outcome = vi.spyOn(f.services.reasoner, judge).mockResolvedValue({
      verdict: null,
      failure: "confidential",
      providerFailure: { failureClass: "network" },
    });
    try {
      const expected = reasonFromModelFailure({ failureClass: "network" });
      expect(await f.detect(kind)).toMatchObject({ skipped: 1, skippedReasons: { [expected]: 1 } });
      expect(await f.run()).toMatchObject({ ok: false, fallbackReason: expected });
      expect(outcome).toHaveBeenCalledTimes(2);
    } finally {
      outcome.mockRestore();
    }
  });

  // Mutation: die Detection liest status() oder eine verdichtete Judge-Methode → Zugriffsliste rot.
  it(`${kind}: die Detection benötigt ausschließlich ihre Outcome-Methode`, async () => {
    const f = await fixture([undefined]);
    const judge = kind === "conflict" ? "judgeConflictOutcome" : "judgeDuplicateOutcome";
    const accesses: PropertyKey[] = [];
    f.services.reasoner = new Proxy(f.services.reasoner, {
      get(target, property) {
        accesses.push(property);
        if (property !== judge)
          throw new Error(`Unerwarteter Reasoner-Zugriff: ${String(property)}`);
        return target[judge].bind(target);
      },
    });
    expect(await f.detect(kind)).toMatchObject({ completed: 1, skipped: 0, aborted: false });
    expect(accesses).toEqual([judge]);
    expect(f.calls[kind]).toBe(1);
  });
}
