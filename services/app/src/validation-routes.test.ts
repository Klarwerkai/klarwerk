import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-237: Validierungs-Workflow über die ECHTEN HTTP-Routen absichern (kein Service-Direktaufruf,
// keine Repo-Manipulation). Zuweisen + Bewerten laufen über den KO-Dispatcher (PUT /api/kos/:id),
// Status/Trust werden über GET /api/kos/:id nachvollzogen, Zuweisungen über /api/validation/overview.
// Regeln (services/validation/trust.ts): trust = clamp(round((up-down)/max(needed,1)*100));
// status "validiert" nur bei up >= needed UND down === 0. Bewertungen sind pro Nutzer (Upsert).
describe("SCRUM-237: Validierungs-Workflow (HTTP end-to-end)", () => {
  async function login(
    app: ReturnType<typeof buildApp>,
    email: string,
    password: string,
  ): Promise<{ headers: Record<string, string>; id: string }> {
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
    // Demo-Seed legt Carla (controller, ko.validate) + Erik (experte, nur ko.create) an.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, carla, erik };
  }

  async function createKo(
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Presse P2 entlüften",
        statement: "Vor Wartung Druck ablassen.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 2,
      },
    });
    expect(res.statusCode).toBe(201);
    const ko = res.json();
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    return ko.id as string;
  }

  const rate = (
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    id: string,
    verdict: "up" | "warn" | "down",
  ) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict },
    });

  const getKo = (app: ReturnType<typeof buildApp>, headers: Record<string, string>, id: string) =>
    app.inject({ method: "GET", url: `/api/kos/${id}`, headers });

  it("zuweisen → bewerten → genug grüne Bewertungen validieren das KO (Trust nachvollziehbar)", async () => {
    const { app, admin, carla, erik } = await setup();
    const id = await createKo(app, admin.headers);

    // 1) Zuweisen an Carla + Erik (ko.assign, controller/admin) → 204.
    const assign = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [carla.id, erik.id] },
    });
    expect(assign.statusCode).toBe(204);

    // Overview zeigt offene Zuweisungen für beide.
    const overview = await app.inject({
      method: "GET",
      url: "/api/validation/overview",
      headers: admin.headers,
    });
    const carlaRow = overview.json().find((r: { userId: string }) => r.userId === carla.id);
    expect(carlaRow.open).toBeGreaterThanOrEqual(1);

    // 2) Guard: Erik (experte) darf NICHT bewerten (kein ko.validate).
    const erikRate = await rate(app, erik.headers, id, "up");
    expect(erikRate.statusCode).toBeGreaterThanOrEqual(400);

    // 3) Erste grüne Bewertung (Admin) → up=1 < needed=2 → bleibt "offen".
    const r1 = await rate(app, admin.headers, id, "up");
    expect(r1.statusCode).toBe(200);
    expect((await getKo(app, admin.headers, id)).json().status).toBe("offen");

    // 4) Zweite grüne Bewertung (Carla, distinct user) → up=2, down=0 → "validiert", trust=100.
    const r2 = await rate(app, carla.headers, id, "up");
    expect(r2.statusCode).toBe(200);
    const validated = (await getKo(app, admin.headers, id)).json();
    expect(validated.status).toBe("validiert");
    expect(validated.trust).toBe(99); // SCRUM-359: Trust-Deckel 99 (PI-K2)

    // 5) FR-VAL-05: Carlas offene Zuweisung ist durch ihre Bewertung erledigt.
    const overview2 = await app.inject({
      method: "GET",
      url: "/api/validation/overview",
      headers: admin.headers,
    });
    const carlaAfter = overview2.json().find((r: { userId: string }) => r.userId === carla.id);
    expect(carlaAfter.done).toBeGreaterThanOrEqual(1);
  });

  it("eine rote Bewertung verhindert die Validierung trotz grüner Mehrheit", async () => {
    const { app, admin, carla } = await setup();
    const id = await createKo(app, admin.headers);

    await rate(app, admin.headers, id, "up");
    const down = await rate(app, carla.headers, id, "down");
    expect(down.statusCode).toBe(200);

    // up=1, down=1, needed=2 → nicht validiert; trust = clamp(round((1-1)/2*100)) = 0.
    const ko = (await getKo(app, admin.headers, id)).json();
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
  });

  it("Pedi 05.07.: Admin kennzeichnet als wahr → sofort validiert; Controller darf das nicht", async () => {
    const { app, admin, carla } = await setup();
    const id = await createKo(app, admin.headers);

    // Controller (ko.validate, aber NICHT users.manage) darf den Admin-Override nicht auslösen.
    const carlaTry = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: carla.headers,
      payload: { action: "admin-validate" },
    });
    expect(carlaTry.statusCode).toBeGreaterThanOrEqual(400);
    expect((await getKo(app, admin.headers, id)).json().status).toBe("offen");

    // Admin: „als wahr kennzeichnen" → sofort validiert, ganz ohne Peer-Bewertungen.
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin.headers,
      payload: { action: "admin-validate" },
    });
    expect(res.statusCode).toBe(200);
    const ko = (await getKo(app, admin.headers, id)).json();
    expect(ko.status).toBe("validiert");
    expect(ko.trust).toBe(99);
  });

  it("Guards/Fehler: anonym abgewiesen, Bewertung auf unbekanntes KO scheitert", async () => {
    const { app, admin } = await setup();
    const id = await createKo(app, admin.headers);

    // anonym → kein Zugriff auf die Bewertung.
    const anon = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      payload: { action: "rate", verdict: "up" },
    });
    expect(anon.statusCode).toBeGreaterThanOrEqual(400);

    // unbekanntes KO → Fehler (NOT_FOUND), kein stiller Erfolg.
    const unknown = await rate(app, admin.headers, "does-not-exist", "up");
    expect(unknown.statusCode).toBeGreaterThanOrEqual(400);
  });
});
