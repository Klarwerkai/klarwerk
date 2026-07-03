import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-428 (Pedi 03.07., VIP): Key-Test für den eigenen lokalen LLM — echter Mini-Aufruf.
// Ohne verdrahteten lokalen LLM (Testumgebung) muss die Route ehrlich „nicht verbunden" melden,
// nicht raten. Nur Admin darf testen.
describe("SCRUM-428: Key-Test lokaler LLM", () => {
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
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, erik };
  }

  it("ohne verdrahteten lokalen LLM: ehrlich nicht verbunden (ok=false), kein Raten", async () => {
    const { app, admin } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/test-local",
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(false);
    expect(String(res.json().detail).toLowerCase()).toContain("lokal");
  });

  it("nur Admin darf den lokalen Key-Test auslösen (Experte 403)", async () => {
    const { app, erik } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/test-local",
      headers: erik.headers,
    });
    expect(res.statusCode).toBe(403);
  });
});
