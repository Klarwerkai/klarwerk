import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

describe("buildApp (Composition Root)", () => {
  it("Health + Reasoner-Status (deterministisch)", async () => {
    const app = buildApp();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json().status).toBe("ok");

    const status = await app.inject({ method: "GET", url: "/api/reasoner/status" });
    expect(status.json().mode).toBe("deterministic");
    await app.close();
  });

  it("End-to-end: Registrierung → Login → geschützte KO-Liste über alle Module", async () => {
    const services = buildServices();
    const app = buildApp(services);

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "p@x.de", password: "secret123" },
    });
    const token = login.json().token as string;

    // Ohne Token verweigert die Rechteprüfung (FR-RBAC-04).
    const unauth = await app.inject({ method: "GET", url: "/api/kos" });
    expect(unauth.statusCode).toBe(401);

    // Admin (erstes Konto) hat ko.read → 200.
    const kos = await app.inject({
      method: "GET",
      url: "/api/kos",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(kos.statusCode).toBe(200);
    expect(Array.isArray(kos.json())).toBe(true);
    await app.close();
  });
});
