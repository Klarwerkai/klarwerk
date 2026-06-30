import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-363 / AG-15 / FR-VAL-05/06: der In-App-Feed (/api/notifications) zeigt die persönlichen
// offenen Review-Zuweisungen — nur die der angemeldeten Person, keine fremden. Konflikt-/Lücken-
// Benachrichtigungen bleiben stabil. HTTP-E2E über die echten Routen (kein Service-Direktaufruf).
describe("SCRUM-363: Assignment-Notification im Feed (HTTP end-to-end)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${res.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    return { headers, id: me.json().id as string };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    // Demo-Seed legt Carla (controller, ko.validate) + Erik (experte) als eigenständige Nutzer an.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, carla, erik };
  }

  const notifications = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/notifications", headers })
      .then((r) => r.json() as Array<{ id: string; kind: string; koId?: string; title: string }>);

  it("zeigt der zugewiesenen Person die Review-Zuweisung — anderen Nutzern nicht", async () => {
    const { app, admin, carla, erik } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: {
        title: "Presse P2 entlüften",
        statement: "Vor Wartung Druck ablassen.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 2,
      },
    });
    const koId = created.json().id as string;

    // Admin weist Carla die Review zu (ko.assign).
    const assign = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [carla.id] },
    });
    expect(assign.statusCode).toBe(204);

    // Carla sieht ihre Review-Zuweisung im Feed (eigene Kategorie + Bezug zum KO).
    const carlaFeed = await notifications(app, carla.headers);
    const mine = carlaFeed.find((n) => n.id === `assign-${koId}`);
    expect(mine).toBeDefined();
    expect(mine?.kind).toBe("assignment");
    expect(mine?.koId).toBe(koId);
    expect(mine?.title).toBe("Presse P2 entlüften");

    // Erik (nicht zugewiesen) sieht diese Zuweisung NICHT.
    const erikFeed = await notifications(app, erik.headers);
    expect(erikFeed.some((n) => n.id === `assign-${koId}`)).toBe(false);

    // Admin (nicht zugewiesen) ebenfalls nicht.
    const adminFeed = await notifications(app, admin.headers);
    expect(adminFeed.some((n) => n.id === `assign-${koId}`)).toBe(false);
  });

  it("Konflikt-/Lücken-Benachrichtigungen bleiben erhalten (keine Regression)", async () => {
    const { app, admin } = await setup();
    // Frage ohne passendes Wissen → ehrliche Wissenslücke (Gap) entsteht.
    await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin.headers,
      payload: { question: "Wie hoch ist der aktuelle Wechselkurs heute?" },
    });
    const feed = await notifications(app, admin.headers);
    expect(feed.some((n) => n.kind === "gap")).toBe(true);
  });
});
