import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-426 (Pedi 03.07.): Public-KI-Anreicherung — Modell-Beitrag (Weltwissen), NUR wenn der
// Admin-Regler „externe Wissensabfrage" (SCRUM-414) auf „offen" steht. HTTP end-to-end.
describe("SCRUM-426: Public-KI-Anreicherung (Gate + Rechte)", () => {
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

  async function setStage(app: App, admin: { headers: Record<string, string> }, stage: string) {
    await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: admin.headers,
      payload: { stage },
    });
  }

  it("unterhalb von offen ist die Anreicherung gesperrt (403)", async () => {
    const { app, admin, erik } = await setup();
    // Standard ist „search_on_click" → nicht offen.
    const blockedDefault = await app.inject({
      method: "POST",
      url: "/api/reasoner/enrich",
      headers: erik.headers,
      payload: { query: "Wälzlager Lebensdauer" },
    });
    expect(blockedDefault.statusCode).toBe(403);
    expect(blockedDefault.json().error).toBe("PUBLIC_AI_ENRICHMENT_BLOCKED");

    await setStage(app, admin, "search_attach");
    const stillBlocked = await app.inject({
      method: "POST",
      url: "/api/reasoner/enrich",
      headers: erik.headers,
      payload: { query: "Wälzlager Lebensdauer" },
    });
    expect(stillBlocked.statusCode).toBe(403);
  });

  it("bei offen ist die Route freigegeben; ohne verbundenes Modell ehrlich leer (demo=true)", async () => {
    const { app, admin, erik } = await setup();
    await setStage(app, admin, "open");
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/enrich",
      headers: erik.headers,
      payload: { query: "Wälzlager Lebensdauer" },
    });
    expect(res.statusCode).toBe(200);
    // Im Test ist kein echtes Modell verdrahtet → ehrlich leer, kein erfundener Beitrag.
    expect(res.json().demo).toBe(true);
    expect(res.json().text).toBe("");
  });

  it("leere query wird abgewiesen (400), auch bei offen", async () => {
    const { app, admin, erik } = await setup();
    await setStage(app, admin, "open");
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/enrich",
      headers: erik.headers,
      payload: { query: "   " },
    });
    expect(res.statusCode).toBe(400);
  });
});
