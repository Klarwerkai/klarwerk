import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  FALLBACK_NEEDED_VALIDATIONS,
  normalizeDefaultNeeded,
} from "../../services/validation/src/settings";

// SCRUM-395: Prüfer-Zuweisung beim Einreichen + Standard-Prüferanzahl (Admin-Default).
// HTTP end-to-end über die echten Routen (Muster wie tests/app/notifications-assignment-e2e).
describe("SCRUM-395: Standard-Prüferanzahl + Prüfer-Vorschlag beim Einreichen", () => {
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
    // Demo-Seed legt Carla (controller) + Erik (experte) als eigenständige Nutzer an.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, carla, erik };
  }

  const KO_PAYLOAD = {
    title: "Hydraulikfilter rechtzeitig tauschen",
    statement: "Bei Druckabfall über 0,4 bar den Filter tauschen.",
    type: "best_practice",
    category: "Anlage 2",
  };

  it("Normalisierung: nur ganze Zahlen 1–5, alles andere wird ehrlich abgelehnt", () => {
    expect(normalizeDefaultNeeded(1)).toBe(1);
    expect(normalizeDefaultNeeded(5)).toBe(5);
    for (const bad of [0, 6, 2.5, Number.NaN, "3", null, undefined]) {
      expect(() => normalizeDefaultNeeded(bad)).toThrow();
    }
  });

  it("GET liefert vor jedem Setzen den Fallback; PUT (Admin) ändert ihn; Experte darf lesen, nicht setzen", async () => {
    const { app, admin, erik } = await setup();
    const before = await app.inject({
      method: "GET",
      url: "/api/validation/settings",
      headers: erik.headers,
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().defaultNeededValidations).toBe(FALLBACK_NEEDED_VALIDATIONS);

    const put = await app.inject({
      method: "PUT",
      url: "/api/validation/settings",
      headers: admin.headers,
      payload: { defaultNeededValidations: 2 },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().defaultNeededValidations).toBe(2);

    const after = await app.inject({
      method: "GET",
      url: "/api/validation/settings",
      headers: erik.headers,
    });
    expect(after.json().defaultNeededValidations).toBe(2);

    // Experte darf den Standard NICHT ändern (users.manage).
    const forbidden = await app.inject({
      method: "PUT",
      url: "/api/validation/settings",
      headers: erik.headers,
      payload: { defaultNeededValidations: 1 },
    });
    expect(forbidden.statusCode).toBe(403);

    // Ungültige Werte werden abgelehnt und ändern nichts.
    for (const bad of [0, 6, 2.5]) {
      const res = await app.inject({
        method: "PUT",
        url: "/api/validation/settings",
        headers: admin.headers,
        payload: { defaultNeededValidations: bad },
      });
      expect(res.statusCode).toBe(400);
    }
    const still = await app.inject({
      method: "GET",
      url: "/api/validation/settings",
      headers: admin.headers,
    });
    expect(still.json().defaultNeededValidations).toBe(2);
  });

  it("neue Einreichung ohne Angabe bekommt den Admin-Standard; explizite Angabe gewinnt", async () => {
    const { app, admin, erik } = await setup();
    await app.inject({
      method: "PUT",
      url: "/api/validation/settings",
      headers: admin.headers,
      payload: { defaultNeededValidations: 2 },
    });

    const implicit = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik.headers,
      payload: KO_PAYLOAD,
    });
    expect(implicit.statusCode).toBe(201);
    expect(implicit.json().neededValidations).toBe(2);

    const explicit = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik.headers,
      payload: { ...KO_PAYLOAD, title: "Zweiter Beitrag", neededValidations: 4 },
    });
    expect(explicit.json().neededValidations).toBe(4);
  });

  it("Entwurfs-Weg (Promote) bekommt den Admin-Standard ebenfalls — kein hartes 3 mehr", async () => {
    const { app, admin, erik } = await setup();
    await app.inject({
      method: "PUT",
      url: "/api/validation/settings",
      headers: admin.headers,
      payload: { defaultNeededValidations: 5 },
    });
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: erik.headers,
      payload: KO_PAYLOAD,
    });
    const promoted = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.json().id}/promote`,
      headers: erik.headers,
    });
    expect(promoted.statusCode).toBe(201);
    expect(promoted.json().neededValidations).toBe(5);
  });

  it("Prüfer-Vorschlag beim Einreichen: Zuweisung + Meldung für die Gewählten, nie für den Autor selbst", async () => {
    const { app, carla, erik } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: erik.headers,
      // Erik nennt Carla als Prüferin — und (fälschlich) sich selbst: das wird gefiltert.
      payload: { ...KO_PAYLOAD, reviewerIds: [carla.id, carla.id, erik.id] },
    });
    expect(created.statusCode).toBe(201);
    const koId = created.json().id as string;

    const carlaNotes = (await app
      .inject({ method: "GET", url: "/api/notifications", headers: carla.headers })
      .then((r) => r.json())) as Array<{ koId?: string }>;
    expect(carlaNotes.some((n) => n.koId === koId)).toBe(true);

    const erikNotes = (await app
      .inject({ method: "GET", url: "/api/notifications", headers: erik.headers })
      .then((r) => r.json())) as Array<{ koId?: string }>;
    expect(erikNotes.some((n) => n.koId === koId)).toBe(false);
  });

  it("Prüfer-Vorschlag funktioniert auch auf dem Entwurfs-Weg (Promote)", async () => {
    const { app, carla, erik } = await setup();
    const draft = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: erik.headers,
      payload: { ...KO_PAYLOAD, title: "Entwurf mit Prüferin" },
    });
    const promoted = await app.inject({
      method: "POST",
      url: `/api/drafts/${draft.json().id}/promote`,
      headers: erik.headers,
      payload: { reviewerIds: [carla.id] },
    });
    expect(promoted.statusCode).toBe(201);
    const koId = promoted.json().id as string;

    const carlaNotes = (await app
      .inject({ method: "GET", url: "/api/notifications", headers: carla.headers })
      .then((r) => r.json())) as Array<{ koId?: string }>;
    expect(carlaNotes.some((n) => n.koId === koId)).toBe(true);
  });
});
