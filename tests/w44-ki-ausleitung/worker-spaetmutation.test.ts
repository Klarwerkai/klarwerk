import { expect, it } from "vitest";
import { createAiCheckRunner, createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import {
  cappedModelClient,
  resetModelBudgetForTests,
} from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { GOOD_DUPLICATE } from "../review26-teilpruefung-ursache/fixture";
it("echter Runner trägt das Abbruchsignal bis zum Modell und übernimmt dessen spätes Konflikturteil nicht", async () => {
  resetModelBudgetForTests();
  const services = buildServices();
  let release: () => void = () => {};
  let begun: () => void = () => {};
  let signal: AbortSignal | undefined;
  const started = new Promise<void>((r) => {
    begun = r;
  });
  const hold = new Promise<void>((r) => {
    release = r;
  });
  const client = cappedModelClient(
    {
      name: "lokal:fake",
      complete: async (system, _user, _c, _m, s) => {
        if (system.includes('"relation"')) {
          signal = s;
          begun();
          await hold;
          return JSON.stringify({
            relation: "widerspruch",
            older: null,
            confidence: 0.95,
            begruendung: "fiktiver Widerspruch",
            zitat_a: "muss vor der Wartung geschlossen werden",
            zitat_b: "muss vor der Wartung geschlossen werden",
          });
        }
        return GOOD_DUPLICATE;
      },
    },
    { rejectsConfidential: false },
  );
  services.reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(services.reasoner);
  for (let i = 0; i < 2; i++)
    await services.ko.create({
      title: `Fiktivpumpe-K${i} im Kühlkreis`,
      statement: `Die Fiktivpumpe-K${i} muss vor der Wartung geschlossen werden.`,
      type: "best_practice",
      category: "Betrieb",
      author: "konto-A",
      confidentiality: "intern",
    });
  const ko = await services.ko.create({
    title: "Fiktivventil-S7 im Kühlkreis",
    statement: "Das Fiktivventil-S7 muss vor der Wartung geschlossen werden.",
    type: "best_practice",
    category: "Betrieb",
    author: "konto-A",
    confidentiality: "intern",
  });
  await services.ko.markAiCheckPending(ko.id);
  const worker = createAiCheckWorker({
    ko: services.ko,
    run: createAiCheckRunner(services),
    jobTimeoutMs: 20,
    log: () => {},
  });
  worker.enqueue(ko.id, ko.version, "vollstaendig");
  await started;
  await new Promise((r) => setTimeout(r, 40));
  expect(signal?.aborted).toBe(true);
  expect(worker.laeuft(ko.id)).toBe(true);
  const before = await services.conflicts.unresolved();
  release();
  await worker.idle();
  expect(await services.conflicts.unresolved()).toEqual(before);
  expect((await services.ko.get(ko.id))?.aiCheck).toMatchObject({
    status: "failed",
    fallbackReason: "timeout",
  });
  resetModelBudgetForTests();
});
