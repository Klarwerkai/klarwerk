import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-443 (Berater-Audit, kritisch vor VIP): der VIP wird per Erstanmeldung Admin. Die
// verdrahteten Routen müssen Selbst-Aussperrung verhindern — FR-RBAC-03 + Last-Admin-Schutz.
describe("SCRUM-443: Last-Admin-/Selbst-Entzug-Schutz (verdrahtete Routen)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { headers: { authorization: `Bearer ${res.json().token}` } };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    const list = await app.inject({ method: "GET", url: "/api/users", headers: admin.headers });
    const adminId = list.json()[0].id as string;
    return { app, admin, adminId };
  }

  it("Admin kann sich per Route nicht selbst herabstufen (403)", async () => {
    const { app, admin, adminId } = await setup();
    const res = await app.inject({
      method: "PUT",
      url: `/api/users/${adminId}`,
      headers: admin.headers,
      payload: { role: "viewer" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Der letzte aktive Admin kann per Route nicht gelöscht werden (403)", async () => {
    const { app, admin, adminId } = await setup();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/users/${adminId}`,
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(403);
  });

  it("Guard-Matrix: ein Experte darf die Nutzerverwaltung nicht (403)", async () => {
    const { app, admin, adminId } = await setup();
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name: "Erik", email: "erik@x.de", password: "secret123", role: "experte" },
    });
    const erik = await login(app, "erik@x.de", "secret123");
    const res = await app.inject({
      method: "PUT",
      url: `/api/users/${adminId}`,
      headers: erik.headers,
      payload: { role: "viewer" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("Rollenwechsel für andere Nutzer bleibt möglich (200)", async () => {
    const { app, admin } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.headers,
      payload: { name: "Nina", email: "nina@x.de", password: "secret123", role: "experte" },
    });
    const ninaId = created.json().id as string;
    const res = await app.inject({
      method: "PUT",
      url: `/api/users/${ninaId}`,
      headers: admin.headers,
      payload: { role: "controller" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("controller");
  });
});
