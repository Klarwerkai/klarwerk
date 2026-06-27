import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-223: Lernpfad-Fortschritt end-to-end über die ECHTEN HTTP-Routen verifizieren
// (Pfad abrufen → Schritt abschließen → Fortschritt erneut abrufen). Fortschritt ist pro Nutzer.
describe("SCRUM-223: Lernpfad-Fortschritt (HTTP end-to-end)", () => {
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
    const headers = { authorization: `Bearer ${login.json().token}` };
    // Demo-Seed legt Lernpfade für experte/controller/admin an (SCRUM-217/218).
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
    return { app, headers };
  }

  it("Schritt abschließen → Fortschritt steigt, ist persistent und idempotent", async () => {
    const { app, headers } = await adminApp();

    // 1) Pfad der eigenen Rolle (admin) abrufen.
    const pathRes = await app.inject({
      method: "GET",
      url: "/api/learning-paths/admin",
      headers,
    });
    expect(pathRes.statusCode).toBe(200);
    const path = pathRes.json();
    expect(path.steps.length).toBeGreaterThanOrEqual(2);
    const pathId = path.id as string;
    const step1 = path.steps[0].id as string;
    const step2 = path.steps[1].id as string;

    // 2) Fortschritt anfangs leer.
    const before = await app.inject({
      method: "GET",
      url: `/api/learning-paths/${pathId}/progress`,
      headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json()).toEqual([]);

    // 3) Ersten Schritt abschließen → Rückgabe enthält den Schritt.
    const complete1 = await app.inject({
      method: "POST",
      url: `/api/learning-paths/${pathId}/complete`,
      headers,
      payload: { stepId: step1 },
    });
    expect(complete1.statusCode).toBe(200);
    expect(complete1.json()).toContain(step1);

    // 4) Fortschritt erneut abrufen → Schritt ist dauerhaft gemerkt.
    const after1 = await app.inject({
      method: "GET",
      url: `/api/learning-paths/${pathId}/progress`,
      headers,
    });
    expect(after1.json()).toEqual([step1]);

    // 5) Idempotent: gleicher Schritt erneut → keine Dublette.
    await app.inject({
      method: "POST",
      url: `/api/learning-paths/${pathId}/complete`,
      headers,
      payload: { stepId: step1 },
    });
    const stillOne = await app.inject({
      method: "GET",
      url: `/api/learning-paths/${pathId}/progress`,
      headers,
    });
    expect(stillOne.json()).toHaveLength(1);

    // 6) Zweiter Schritt → Fortschritt = 2.
    await app.inject({
      method: "POST",
      url: `/api/learning-paths/${pathId}/complete`,
      headers,
      payload: { stepId: step2 },
    });
    const after2 = await app.inject({
      method: "GET",
      url: `/api/learning-paths/${pathId}/progress`,
      headers,
    });
    expect(after2.json().sort()).toEqual([step1, step2].sort());
  });

  it("Fortschritt ist pro Nutzer getrennt", async () => {
    const { app, headers } = await adminApp();
    const path = (
      await app.inject({ method: "GET", url: "/api/learning-paths/admin", headers })
    ).json();
    const pathId = path.id as string;
    const step1 = path.steps[0].id as string;
    await app.inject({
      method: "POST",
      url: `/api/learning-paths/${pathId}/complete`,
      headers,
      payload: { stepId: step1 },
    });

    // Zweiter, frisch angemeldeter Nutzer (über Demo-Seed-Account erik) startet bei 0.
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "erik@demo.klarwerk", password: "demo-pass-erik" },
    });
    const erik = { authorization: `Bearer ${login.json().token}` };
    const erikProgress = await app.inject({
      method: "GET",
      url: `/api/learning-paths/${pathId}/progress`,
      headers: erik,
    });
    expect(erikProgress.json()).toEqual([]);
  });
});
