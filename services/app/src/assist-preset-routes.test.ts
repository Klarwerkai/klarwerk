import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-386: kundeneigene KI-Assist-Funktionen über die Route — Guards wie im Prüfbereich
// der KI-Verwaltung: lesen darf jede angemeldete Rolle (Palette), schreiben nur der Admin.
describe("SCRUM-386: /api/reasoner/assist-presets", () => {
  async function appWithUsers() {
    const app = buildApp(buildServices());
    // Erstes Konto = Admin (Setup-Pfad).
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const admin = { authorization: `Bearer ${adminLogin.json().token}` };
    // Zweiter Nutzer: registrieren, per Admin freigeben (Experte, kein users.manage).
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Erik", email: "e@x.de", password: "secret123" },
    });
    await app.inject({
      method: "POST",
      url: `/api/auth/users/${reg.json().id}/approve`,
      headers: admin,
    });
    const expertLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "e@x.de", password: "secret123" },
    });
    const expert = { authorization: `Bearer ${expertLogin.json().token}` };
    return { app, admin, expert };
  }

  it("anonym → kein 200 (Guard greift)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/reasoner/assist-presets" });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("Admin legt Presets an; jede angemeldete Rolle sieht sie in der Palette", async () => {
    const { app, admin, expert } = await appWithUsers();
    const put = await app.inject({
      method: "PUT",
      url: "/api/reasoner/assist-presets",
      headers: admin,
      payload: {
        presets: [{ name: "Schichtübergabe", instruction: "Fasse in 5 Stichpunkten zusammen." }],
      },
    });
    expect(put.statusCode).toBe(200);
    const saved = put.json();
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe("Schichtübergabe");
    expect(saved[0].id.length).toBeGreaterThan(0);

    const asExpert = await app.inject({
      method: "GET",
      url: "/api/reasoner/assist-presets",
      headers: expert,
    });
    expect(asExpert.statusCode).toBe(200);
    expect(asExpert.json()).toHaveLength(1);
  });

  it("Nicht-Admin darf NICHT schreiben; ungültige Presets → 400 mit klarer Meldung", async () => {
    const { app, admin, expert } = await appWithUsers();
    const forbidden = await app.inject({
      method: "PUT",
      url: "/api/reasoner/assist-presets",
      headers: expert,
      payload: { presets: [{ name: "Hack", instruction: "Darf nicht gespeichert werden." }] },
    });
    expect(forbidden.statusCode).toBeGreaterThanOrEqual(400);

    const invalid = await app.inject({
      method: "PUT",
      url: "/api/reasoner/assist-presets",
      headers: admin,
      payload: { presets: [{ name: "X", instruction: "ok, aber Name zu kurz" }] },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().message).toMatch(/Name/);

    // Bestand unverändert (kein Teil-Schreiben).
    const list = await app.inject({
      method: "GET",
      url: "/api/reasoner/assist-presets",
      headers: admin,
    });
    expect(list.json()).toEqual([]);
  });
});
