// Mutation: rohe Providerfehlermeldung statt Klasse mitführen oder loggen → Geheimnisprobe rot.
import { inspect } from "node:util";
import { expect, it, vi } from "vitest";
import { createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { ModelHttpError } from "../../services/reasoner";
import { fixture } from "./fixture";

it("Abdeckung, Abschluss und Logs enthalten ausschließlich neutrale Ursachen", async () => {
  const secrets = ["TestVendor", "https://test-provider.invalid/v1", "sk-FAKE-3484-ONLY-TEST"];
  const logs: unknown[] = [];
  const spies = [vi.spyOn(console, "warn"), vi.spyOn(console, "error"), vi.spyOn(console, "log")];
  for (const spy of spies)
    spy.mockImplementation((...args) => {
      logs.push(args);
    });
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    logs.push(chunk);
    return true;
  });
  try {
    const f = await fixture([new ModelHttpError(secrets.join(" "), 401)]);
    const coverage = await f.detect("duplicate");
    expect(coverage).toHaveProperty("skippedReasons", { auth: 1 });
    const out = await f.run();
    expect(out.fallbackReason).toBe("auth");
    await f.services.ko.markAiCheckPending(f.subject.id);
    const worker = createAiCheckWorker({
      ko: f.services.ko,
      run: f.run,
      log: (line) => {
        logs.push(line);
      },
    });
    worker.enqueue(f.subject.id, f.subject.version);
    await worker.idle();
    for (const secret of secrets)
      expect(inspect({ coverage, out, logs }, { depth: null })).not.toContain(secret);
  } finally {
    stderr.mockRestore();
    for (const spy of spies) spy.mockRestore();
  }
});
