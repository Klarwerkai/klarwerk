import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner } from "../../services/reasoner";

// Key-Test (Pedi 02.07.): POST /api/reasoner/test macht einen ECHTEN Mini-Modellaufruf
// und meldet ehrlich, ob der Schlüssel funktioniert. Anzeige („Modus: Modell") ist kein
// Beweis — erst die Antwort des Modells zählt.
describe("Reasoner-Key-Test (probe)", () => {
  it("meldet ok, wenn das Modell antwortet", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => "OK",
    });
    const reasoner = new Reasoner(provider);
    const res = await reasoner.probe();
    expect(res.ok).toBe(true);
    expect(res.mode).toBe("model");
    expect(res.provider).toBe("anthropic:test");
  });

  it("meldet den ehrlichen Grund, wenn der Schlüssel ungültig ist (401)", async () => {
    const provider = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        throw new Error("Modell-API antwortete mit 401");
      },
    });
    const reasoner = new Reasoner(provider);
    const res = await reasoner.probe();
    expect(res.ok).toBe(false);
    expect(res.mode).toBe("model");
    expect(res.detail).toContain("401");
  });

  it("meldet ohne Modell den deterministischen Betrieb — kein Fake-Erfolg", async () => {
    const reasoner = new Reasoner();
    const res = await reasoner.probe();
    expect(res.ok).toBe(false);
    expect(res.mode).toBe("deterministic");
  });

  it("HTTP: nur Admin (users.manage) — 401 ohne Login", async () => {
    const app = buildApp(buildServices());
    const anon = await app.inject({ method: "POST", url: "/api/reasoner/test" });
    expect(anon.statusCode).toBe(401);

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    const res = await app.inject({ method: "POST", url: "/api/reasoner/test", headers });
    expect(res.statusCode).toBe(200);
    // In der Testumgebung ist kein Key gesetzt → ehrlicher deterministischer Befund.
    const body = res.json() as { ok: boolean; mode: string };
    expect(body.ok).toBe(false);
    expect(body.mode).toBe("deterministic");
  });

  it("HTTP config trennt aktive Provider von Cloud-/Local-Verfügbarkeit", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "config@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "config@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    const res = await app.inject({ method: "GET", url: "/api/reasoner/config", headers });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      cloudConfigured: boolean;
      localConfigured: boolean;
      effectiveProvider: Record<string, string>;
    };
    expect(body.cloudConfigured).toBe(false);
    expect(body.localConfigured).toBe(false);
    expect(new Set(Object.values(body.effectiveProvider))).toEqual(new Set(["deterministic"]));
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/apikey|secret|token|password/);
  });
});
