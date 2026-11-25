import { afterEach, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import {
  cappedModelClient,
  resetModelBudgetForTests,
} from "../../services/reasoner/src/model-concurrency";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetModelBudgetForTests();
});
it("öffentliche Statusabfragen lesen nur Cache; ausschließlich der geschützte bewusste Admin-Test ruft den Modellport", async () => {
  resetModelBudgetForTests();
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    throw new Error("Netz im Test unzulässig");
  });
  const s = buildServices();
  s.reasoner = new Reasoner(
    new ModelProvider(
      cappedModelClient(
        {
          name: "anthropic:fake",
          model: "fake",
          complete: async () => {
            calls++;
            return "OK";
          },
        },
        { rejectsConfidential: true },
      ),
    ),
  );
  await erteileKiFreigabe(s.reasoner);
  const refresh = vi.spyOn(s.reasoner, "refreshReachabilityIfStale");
  const u = await s.auth.register({
    name: "Ada",
    email: "a@attrappe.test",
    password: "Fiktiv-geheim-123",
  });
  const login = await s.auth.login({ email: u.email, password: "Fiktiv-geheim-123" });
  const app = buildApp(s);
  try {
    for (let i = 0; i < 3; i++)
      for (const url of ["/api/reasoner/status", "/api/ai-status"])
        expect((await app.inject({ method: "GET", url })).statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(0);
    expect(refresh).not.toHaveBeenCalled();
    expect((await app.inject({ method: "POST", url: "/api/reasoner/test" })).statusCode).toBe(401);
    const probe = await app.inject({
      method: "POST",
      url: "/api/reasoner/test",
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(probe.statusCode, probe.body).toBe(200);
    expect(calls).toBe(1);
    const ziel = "/api/reasoner/test?ziel=antwort";
    const leser = await s.auth.register({
      name: "Leser",
      email: "leser@example.test",
      password: "Fiktiv-geheim-456",
    });
    await s.auth.approveUser(leser.id, u.id);
    await s.auth.changeRole(leser.id, "viewer", u.id);
    const leserLogin = await s.auth.login({ email: leser.email, password: "Fiktiv-geheim-456" });
    const leserHeader = { authorization: `Bearer ${leserLogin.token}` };
    expect((await app.inject({ method: "POST", url: ziel })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: ziel, headers: leserHeader })).statusCode).toBe(
      403,
    );
    const lage = await app.inject({ method: "GET", url: "/api/ki-lage", headers: leserHeader });
    expect(lage.statusCode).toBe(200);
    expect(lage.json().zuletztBestaetigtAm).toMatch(/^\d{4}-/);
    expect(calls).toBe(1);
    const kopftest = await app.inject({
      method: "POST",
      url: ziel,
      headers: { authorization: `Bearer ${login.token}` },
    });
    expect(kopftest.json().ok).toBe(true);
    expect(calls).toBe(2);
  } finally {
    await app.close();
  }
});
