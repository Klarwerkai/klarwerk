import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-525 P.5 (WP-C): Befund 3(a) — PUT /api/reasoner/config überschrieb bisher eine per Deploy-ENV
// (KLARWERK_REASONER_POLICY) gesetzte Policy sofort im laufenden Prozess UND in der DB. Diese Tests
// beweisen die Sperre auf HTTP-Ebene: bei ENV-gebootetem Reasoner lehnt die Route mit 409 ab (statt
// still zu übernehmen oder generisch 400 zu melden); ohne ENV funktioniert der Schreibpfad unverändert.
// GET /api/reasoner/config zeigt in beiden Fällen die korrekte policySource, damit die Admin-UI den
// Zustand anzeigen kann.
describe("SCRUM-525 P.5 (WP-C): ENV-Sperre für PUT /api/reasoner/config", () => {
  async function loginAsAdmin(app: ReturnType<typeof buildApp>, email: string) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email, password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${login.json().token}` };
  }

  it("ENV-gebootet: PUT liefert 409 REASONER_POLICY_ENV_LOCKED, die Policy bleibt unverändert", async () => {
    const services = buildServices();
    // Genau der Boot-Schritt aus server.ts: ENV-Override VOR app.listen laden.
    const loaded = await services.reasoner.loadPersistedPolicy({ envGlobal: "deterministic" });
    expect(loaded.source).toBe("env");
    const app = buildApp(services);
    const headers = await loginAsAdmin(app, "env-lock@x.de");

    const before = await app.inject({ method: "GET", url: "/api/reasoner/config", headers });
    expect((before.json() as { policySource: string }).policySource).toBe("env");
    expect((before.json() as { taskConfig: { global: string } }).taskConfig.global).toBe(
      "deterministic",
    );

    const put = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers,
      payload: { global: "cloud", perTask: {} },
    });
    expect(put.statusCode).toBe(409);
    const body = put.json() as { error: string; message: string };
    expect(body.error).toBe("REASONER_POLICY_ENV_LOCKED");
    expect(body.message).toMatch(/Deploy-Konfiguration/);

    // Kein stilles Übernehmen: die Zuordnung ist danach unverändert.
    const after = await app.inject({ method: "GET", url: "/api/reasoner/config", headers });
    expect((after.json() as { taskConfig: { global: string } }).taskConfig.global).toBe(
      "deterministic",
    );
    expect((after.json() as { policySource: string }).policySource).toBe("env");
  });

  it("ohne ENV: PUT funktioniert wie bisher (200), policySource danach 'db'", async () => {
    const services = buildServices();
    const loaded = await services.reasoner.loadPersistedPolicy();
    expect(loaded.source).toBe("default");
    const app = buildApp(services);
    const headers = await loginAsAdmin(app, "no-env@x.de");

    const beforeGet = await app.inject({ method: "GET", url: "/api/reasoner/config", headers });
    expect((beforeGet.json() as { policySource: string }).policySource).toBe("default");

    const put = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers,
      payload: { global: "cloud", perTask: {} },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json() as { taskConfig: { global: string }; policySource: string };
    expect(body.taskConfig.global).toBe("cloud");
    expect(body.policySource).toBe("db");

    const afterGet = await app.inject({ method: "GET", url: "/api/reasoner/config", headers });
    expect((afterGet.json() as { policySource: string }).policySource).toBe("db");
  });
});
