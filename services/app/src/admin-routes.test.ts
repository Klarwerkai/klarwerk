import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-181: admin-geschützte Demo-Seed-Route.
describe("SCRUM-181: POST /api/admin/demo-seed", () => {
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

  it("anonym → kein 200 (Guard greift)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "POST", url: "/api/admin/demo-seed" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Admin auf leerer Instanz → seeded; zweiter Lauf → skipped (idempotent)", async () => {
    const { app, headers } = await adminApp();

    const first = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(first.statusCode).toBe(200);
    const r1 = first.json();
    expect(r1.skipped).toBe(false);
    expect(r1.kos).toBeGreaterThanOrEqual(5);
    expect(r1.validated).toBeGreaterThanOrEqual(1);

    // Bestand ist jetzt sichtbar.
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json().length).toBeGreaterThanOrEqual(5);

    // Zweiter Lauf: Wissensbasis nicht leer → ehrlich übersprungen, keine Duplikate.
    const before = kos.json().length;
    const second = await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    expect(second.json().skipped).toBe(true);
    const after = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(after.json().length).toBe(before);
  });
});
