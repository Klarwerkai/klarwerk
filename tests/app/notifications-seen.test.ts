import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryNotificationSeenRepo, PgNotificationSeenRepo } from "../../services/notifications";

// Audit-P3 (SCRUM-397): Gelesen-Status der Glocke — serverseitig, pro Nutzer, ehrlich.
// HTTP-E2E über die echten Routen: GET liefert seen je Item, POST /seen markiert bewusst,
// fremde Nutzer bleiben unberührt, ohne Login gibt es 401.
describe("SCRUM-397: Glocke mit Gelesen-Status (HTTP end-to-end)", () => {
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
    // Demo-Seed liefert offene Konflikte/Lücken → die Glocke hat echte Einträge.
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");
    return { app, admin, carla };
  }

  const feed = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/notifications", headers })
      .then((r) => r.json() as Array<{ id: string; seen: boolean }>);

  it("liefert seen=false, markiert bewusst und lässt fremde Nutzer unberührt", async () => {
    const { app, admin, carla } = await setup();

    const before = await feed(app, admin.headers);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((n) => n.seen === false)).toBe(true);

    // Bewusstes Markieren der ersten beiden Einträge.
    const ids = before.slice(0, 2).map((n) => n.id);
    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().unseenCount).toBe(before.length - ids.length);

    const after = await feed(app, admin.headers);
    for (const n of after) {
      expect(n.seen).toBe(ids.includes(n.id));
    }

    // Fremde Sicht bleibt ungelesen — Gelesen-Status ist strikt pro Nutzer.
    const carlaFeed = await feed(app, carla.headers);
    for (const n of carlaFeed) {
      if (ids.includes(n.id)) {
        expect(n.seen).toBe(false);
      }
    }
  });

  it("ist idempotent und weist leere/kaputte Eingaben ehrlich ab", async () => {
    const { app, admin } = await setup();
    const items = await feed(app, admin.headers);
    const id = items[0]?.id as string;

    const once = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids: [id] },
    });
    const twice = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids: [id, id] },
    });
    expect(once.json().unseenCount).toBe(twice.json().unseenCount);

    const empty = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids: [] },
    });
    expect(empty.statusCode).toBe(400);
    // Nicht-Strings werden verworfen, nicht still mitmarkiert.
    const junk = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids: [42, null] },
    });
    expect(junk.statusCode).toBe(400);
  });

  it("verlangt Anmeldung (401 ohne Token)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      payload: { ids: ["con-x"] },
    });
    expect(res.statusCode).toBe(401);
  });

  it("In-Memory-Repo: markSeen ist idempotent und pro Nutzer getrennt", async () => {
    const repo = new InMemoryNotificationSeenRepo();
    await repo.markSeen("u1", ["a", "b"]);
    await repo.markSeen("u1", ["b"]);
    expect((await repo.seenFor("u1")).sort()).toEqual(["a", "b"]);
    expect(await repo.seenFor("u2")).toEqual([]);
    // Pg-Variante teilt die Schnittstelle — Typprüfung genügt hier (echte DB = Integrationslauf).
    expect(typeof PgNotificationSeenRepo).toBe("function");
  });
});
