import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { buildNotifications } from "../../services/app/src/notification-feed";
import { deriveImpacts } from "../../services/app/src/routes/notifications-routes";

// PMO-FEA-0002 / EK-19-Richtung: „Hat geholfen" erzeugt eine Wirkungs-Rückmeldung an den
// ORIGINALAUTOR — auch Monate später sichtbar, kein Selbst-Applaus, keine Zähler/Scores.
// Quelle ist das Audit-Log (answer.helpful) — keine neue Persistenz, ehrlich ableitbar.
describe("PMO-FEA-0002: Wirkungs-Rückmeldung an den Autor", () => {
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
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, erik };
  }

  const feed = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/notifications", headers })
      .then((r) => r.json() as Array<{ id: string; kind: string; koId?: string; title: string }>);

  it("fremder Hat-geholfen-Klick erscheint beim Autor im Feed — nicht beim Klickenden", async () => {
    const { app, admin, erik } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: {
        title: "Spindel SP-7 nur im Stillstand schmieren",
        statement: "Schmierung bei Drehung verteilt Fett in die Lager.",
        type: "best_practice",
      },
    });
    expect(created.statusCode).toBe(201);
    const koId = created.json().id as string;

    // Erik (nicht Autor) meldet: hat geholfen.
    const helpful = await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: erik.headers,
      payload: { koId },
    });
    expect([200, 204]).toContain(helpful.statusCode);

    const adminFeed = await feed(app, admin.headers);
    const impact = adminFeed.find((n) => n.kind === "impact" && n.koId === koId);
    expect(impact).toBeDefined();
    expect(impact?.title).toContain("Spindel SP-7");

    // Der Klickende selbst bekommt KEINE Wirkungs-Rückmeldung (kein Selbst-Applaus).
    const erikFeed = await feed(app, erik.headers);
    expect(erikFeed.some((n) => n.kind === "impact" && n.koId === koId)).toBe(false);
  });

  it("eigener Klick auf das eigene Objekt erzeugt keine Rückmeldung", async () => {
    const { app, admin } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: { title: "Eigenes Wissen", statement: "Test.", type: "best_practice" },
    });
    const koId = created.json().id as string;
    await app.inject({
      method: "POST",
      url: "/api/ask/helpful",
      headers: admin.headers,
      payload: { koId },
    });
    const adminFeed = await feed(app, admin.headers);
    expect(adminFeed.some((n) => n.kind === "impact" && n.koId === koId)).toBe(false);
  });

  it("deriveImpacts: nur payload-vollständige Fremd-Klicks, gedeckelt auf 12", () => {
    const mk = (i: number, actor: string, author: string) => ({
      actor,
      target: `ko-${i}`,
      at: `2026-07-0${(i % 9) + 1}T10:00:0${i % 10}Z`,
      payload: { koAuthor: author, koTitle: `T${i}` },
    });
    const entries = [
      ...Array.from({ length: 15 }, (_, i) => mk(i, "user-b", "user-a")),
      mk(99, "user-a", "user-a"), // Selbst-Klick
      { actor: "user-b", target: "alt", at: "2026-07-01T00:00:00Z", payload: {} }, // Alt-Eintrag ohne Payload
    ];
    const impacts = deriveImpacts(entries, "user-a");
    expect(impacts).toHaveLength(12);
    expect(impacts.every((x) => x.title.startsWith("T"))).toBe(true);
  });

  it("buildNotifications sortiert impact zeitlich ein und trägt koId", () => {
    const items = buildNotifications({
      conflicts: [],
      gaps: [],
      impacts: [{ koId: "ko-1", title: "Presse P2 entlüften", at: "2026-07-02T08:00:00Z" }],
    });
    expect(items[0]).toMatchObject({ kind: "impact", koId: "ko-1", title: "Presse P2 entlüften" });
  });
});
