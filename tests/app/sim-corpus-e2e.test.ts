import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { SIM_CORPUS, SIM_CORPUS_TAG } from "../../services/app/src/sim-corpus";

// SCRUM-501 (nacht24 Paket 7.2): Simulationskorpus — Admin-only, idempotent, demoSeed-markiert,
// über den BESTEHENDEN Demo-Purge komplett entfernbar. Nie automatisch geladen.
describe("SCRUM-501: /api/admin/sim-corpus (HTTP end-to-end)", () => {
  async function setup() {
    const services = buildServices();
    const app = buildApp(services);
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
    return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("lädt ~30 KOs je Sprache mit Sprach-Präfix + demoSeed + Tag; validierter Anteil deterministisch; idempotent", async () => {
    const { app, services, headers } = await setup();
    const res = await app.inject({ method: "POST", url: "/api/admin/sim-corpus", headers });
    expect(res.statusCode).toBe(200);
    const result = res.json();
    expect(result.seeded).toBe(true);
    expect(result.created).toBe(SIM_CORPUS.length);
    // Sprachverteilung: nahe am Ziel „~30 je Sprache" (ehrliche Ist-Zahlen aus den Daten).
    expect(result.byLanguage.de).toBeGreaterThanOrEqual(25);
    expect(result.byLanguage.en).toBeGreaterThanOrEqual(25);
    expect(result.byLanguage.nl).toBeGreaterThanOrEqual(25);
    expect(result.validated).toBeGreaterThan(0);

    const kos = (await services.ko.list()).filter((k) => (k.tags ?? []).includes(SIM_CORPUS_TAG));
    expect(kos.length).toBe(SIM_CORPUS.length);
    expect(kos.every((k) => k.demoSeed === true)).toBe(true);
    expect(kos.every((k) => /^\[(DE|EN|NL)\] /.test(k.title))).toBe(true);
    expect(kos.filter((k) => k.status === "validiert").length).toBe(result.validated);
    // Die gewollten Konflikt-Paare sind als Material vorhanden (Befund entsteht auf den
    // normalen Erkennungswegen, nicht beim Seed).
    expect(kos.some((k) => k.title.includes("MK-5") && k.title.startsWith("[DE]"))).toBe(true);
    expect(kos.some((k) => k.title.includes("MK-5") && k.title.startsWith("[EN]"))).toBe(true);

    // Idempotenz: zweiter Lauf dupliziert NICHTS.
    const again = await app.inject({ method: "POST", url: "/api/admin/sim-corpus", headers });
    expect(again.json().seeded).toBe(false);
    expect(again.json().created).toBe(0);
    expect((await services.ko.list()).length).toBe(kos.length);
  });

  it("Demo-Purge entfernt das Korpus komplett (demoSeed-Muster)", async () => {
    const { app, services, headers } = await setup();
    await app.inject({ method: "POST", url: "/api/admin/sim-corpus", headers });
    const purge = await app.inject({ method: "DELETE", url: "/api/admin/demo-seed", headers });
    expect(purge.statusCode).toBe(200);
    const remaining = (await services.ko.list()).filter((k) =>
      (k.tags ?? []).includes(SIM_CORPUS_TAG),
    );
    expect(remaining).toHaveLength(0);
  });

  it("Nicht-Admin (viewer) → 403; ohne Anmeldung → 401 — nie automatisch, nie offen", async () => {
    const { app, headers } = await setup();
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers,
      payload: { name: "Vera", email: "v@x.de", password: "secret123", role: "viewer" },
    });
    const viewerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "v@x.de", password: "secret123" },
    });
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/admin/sim-corpus",
      headers: { authorization: `Bearer ${viewerLogin.json().token}` },
    });
    expect(forbidden.statusCode).toBe(403);
    const anon = await app.inject({ method: "POST", url: "/api/admin/sim-corpus" });
    expect(anon.statusCode).toBe(401);
  });
});
