import { afterEach, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import {
  cappedModelClient,
  resetModelBudgetForTests,
} from "../../services/reasoner/src/model-concurrency";
afterEach(() => {
  vi.unstubAllEnvs();
  resetModelBudgetForTests();
});
it("echter App-Zugang bindet Übertragungen an angemeldete Konten auch bei ausgeschaltetem HTTP-Anfragezähler", async () => {
  resetModelBudgetForTests();
  vi.stubEnv("KLARWERK_KI_ANFRAGEN_MAX", "aus");
  vi.stubEnv("KLARWERK_LOG_LEVEL", "silent");
  const s = buildServices();
  let calls = 0;
  const client = cappedModelClient(
    {
      name: "lokal:attrappe",
      model: "fake",
      complete: async () => {
        calls++;
        return JSON.stringify({
          title: "Pumpe",
          statement: "Alle 200 Stunden schmieren.",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 0.9,
        });
      },
    },
    { rejectsConfidential: false },
  );
  const d = new DeterministicProvider();
  s.reasoner = new Reasoner(d, d, undefined, undefined, new ModelProvider(client));
  await s.reasoner.setTaskConfig({ global: "local", perTask: {} });
  const pw = "Fiktiv-geheim-123";
  const a = await s.auth.register({ name: "Anna", email: "anna@app.attrappe.test", password: pw });
  const b = await s.auth.register({ name: "Bert", email: "bert@app.attrappe.test", password: pw });
  await s.auth.approveUser(b.id, a.id);
  const anna = await s.auth.login({ email: a.email, password: pw });
  const bert = await s.auth.login({ email: b.email, password: pw });
  const app = buildApp(s);
  const request = (token: string) =>
    app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: { authorization: `Bearer ${token}`, "x-user-id": b.id },
      payload: {
        task: "structure",
        text: "Alle 200 Stunden schmieren.",
        locale: "de",
        source: "draft",
        confidentiality: "intern",
      },
    });
  try {
    for (let i = 0; i < 30; i++) {
      const r = await request(anna.token);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().demo).toBe(false);
    }
    expect(calls).toBe(30);
    for (let i = 0; i < 10; i++) {
      const r = await request(anna.token);
      expect(r.statusCode, r.body).toBe(503);
      expect(r.json().error).toBe("MODEL_BUSY");
      expect(Number(r.headers["retry-after"])).toBeGreaterThanOrEqual(1);
    }
    expect(calls).toBe(30);
    const other = await request(bert.token);
    expect(other.statusCode, other.body).toBe(200);
    expect(other.json().demo).toBe(false);
    expect(calls).toBe(31);
  } finally {
    await app.close();
  }
});
