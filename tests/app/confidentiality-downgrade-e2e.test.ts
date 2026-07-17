import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-509: Downgrade der Vertraulichkeit kontrollieren + ungültige Stufen ablehnen (fail-safe).
// - ungültige/fehlende Stufe → 400 (kein stilles Normalisieren auf „intern").
// - Herabstufung (weniger vertraulich) → nur Prüfer-/Admin-Rolle (ko.validate); experte → 403.
// - Upgrade (mehr vertraulich) bleibt für ko.create frei.
describe("SCRUM-509: Vertraulichkeits-Downgrade kontrolliert (HTTP end-to-end)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin });
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik"); // experte (ko.create)
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla"); // controller (ko.validate)
    return { app, admin, erik, carla };
  }

  // Legt ein KO an (erik), stuft es hoch auf „vertraulich" (freies Upgrade) → gibt die id zurück.
  async function confidentialKo(app: App, author: { authorization: string }): Promise<string> {
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: author,
      payload: {
        title: "Vertraulicher Beitrag",
        statement: "Sensibler Kerntext für den Downgrade-Test.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    const id = created.json().id as string;
    // Upgrade intern → vertraulich ist frei (ko.create).
    const up = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: author,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(up.statusCode).toBe(200);
    expect(up.json().confidentiality).toBe("vertraulich");
    return id;
  }

  it("Upgrade (intern → vertraulich) ist für experte (ko.create) frei erlaubt", async () => {
    const { app, erik } = await setup();
    await confidentialKo(app, erik); // die Assertion steckt im Helper
  });

  it("ungültige/fehlende Stufe → 400 (kein stilles Normalisieren auf intern)", async () => {
    const { app, erik } = await setup();
    const id = await confidentialKo(app, erik);
    const bad = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: erik,
      payload: { action: "confidentiality", level: "quatsch" },
    });
    expect(bad.statusCode).toBe(400);
    const missing = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: erik,
      payload: { action: "confidentiality" },
    });
    expect(missing.statusCode).toBe(400);
    // Stufe unverändert vertraulich.
    const still = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: erik });
    expect(still.json().confidentiality).toBe("vertraulich");
  });

  it("Downgrade durch experte (nur ko.create) → 403, Stufe bleibt vertraulich", async () => {
    const { app, erik } = await setup();
    const id = await confidentialKo(app, erik);
    const down = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: erik,
      payload: { action: "confidentiality", level: "intern" },
    });
    expect(down.statusCode).toBe(403);
    const still = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: erik });
    expect(still.json().confidentiality).toBe("vertraulich");
  });

  it("Downgrade durch controller (ko.validate) → 200 + auditiert (downgrade markiert)", async () => {
    const { app, admin, erik, carla } = await setup();
    const id = await confidentialKo(app, erik);
    const down = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: carla,
      payload: { action: "confidentiality", level: "intern" },
    });
    expect(down.statusCode).toBe(200);
    expect(down.json().confidentiality).toBe("intern");
    // Audit trägt die Herabstufung nachvollziehbar (previous/downgrade).
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers: admin });
    const entry = (audit.json() as Array<{ action: string; payload?: { downgrade?: boolean } }>)
      .filter((e) => e.action === "ko.confidentiality")
      .find((e) => e.payload?.downgrade === true);
    expect(entry).toBeTruthy();
  });
});
