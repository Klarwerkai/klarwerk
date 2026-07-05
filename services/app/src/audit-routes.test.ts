import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-439: aktive Integritätsprüfung der Audit-Kette über die ECHTE Route (kein Service-Direktaufruf).
describe("SCRUM-439: Audit-Integritätsprüfung (HTTP end-to-end)", () => {
  async function adminApp() {
    const app = buildApp(buildServices());
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
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("GET /api/audit/verify → { ok: true, count > 0 } für eine intakte Kette", async () => {
    const { app, headers } = await adminApp();
    // Demo-Seed erzeugt echte auditierte Aktionen → nicht-leere Kette.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });

    const res = await app.inject({ method: "GET", url: "/api/audit/verify", headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().count).toBeGreaterThan(0);
  });

  it("anonym → Integritätsprüfung ist geschützt (Guard greift)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/audit/verify" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
