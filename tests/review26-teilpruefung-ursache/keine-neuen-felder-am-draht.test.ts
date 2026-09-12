// Mutation: interne Abdeckung unverändert in den Runner-Ausgang übernehmen → vollständige Form rot.
import { expect, it } from "vitest";
import { createAiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp } from "../../services/app/src/build-app";
import { ModelHttpError } from "../../services/reasoner";
import { fixture } from "./fixture";

it("persistierter aiCheck hat exakt die bestehende Drahtform", async () => {
  const f = await fixture([new ModelHttpError("HTTP 429", 429)]);
  const requestedAt = "2026-09-10T08:00:00.000Z";
  await f.services.ko.markAiCheckPending(f.subject.id, requestedAt);
  const worker = createAiCheckWorker({ ko: f.services.ko, run: f.run, log: () => {} });
  worker.enqueue(f.subject.id, f.subject.version);
  await worker.idle();
  const aiCheck = (await f.services.ko.get(f.subject.id))?.aiCheck;
  const expected = {
    status: "failed",
    requestedAt,
    finishedAt: expect.any(String),
    koVersion: f.subject.version,
    fallbackReason: "rate-limit",
    coverage: {
      available: 1,
      selected: 1,
      alreadyOpen: 0,
      attempted: 1,
      completed: 0,
      skipped: 2,
      capped: false,
      aborted: false,
    },
  };
  expect(aiCheck).toEqual(expected);
  const app = buildApp(f.services);
  try {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Prueferin", email: "review3484@example.test", password: "testpass3484" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "review3484@example.test", password: "testpass3484" },
    });
    expect(login.statusCode).toBe(200);
    const response = await app.inject({
      method: "GET",
      url: `/api/kos/${f.subject.id}`,
      headers: { authorization: `Bearer ${login.json().token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().aiCheck).toEqual(expected);
  } finally {
    await app.close();
  }
});
