import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryKoRepo, KoService, TRASH_RETENTION_DAYS } from "../../services/knowledge-object";

// SCRUM-422 (Pedi 03.07.): Papierkorb — gelöschte Artikel sind wiederherstellbar (Admin),
// nach 4 Wochen automatische Endlöschung; Demo-Daten werden IMMER sofort endgültig gelöscht.
describe("SCRUM-422: Papierkorb für gelöschte Wissensobjekte", () => {
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

  async function createKo(app: App, headers: Record<string, string>, title: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement: "Bei Überdruck zuerst Ventil V3 schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    return res.json().id as string;
  }

  it("Löschen legt den Beitrag in den Papierkorb: überall verschwunden, für den Admin sichtbar", async () => {
    const { app, admin, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Ventil V3 zuerst");

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${koId}`,
      headers: erik.headers,
    });
    expect(del.statusCode).toBe(204);

    // Weg aus Detail + Liste …
    const got = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik.headers });
    expect(got.statusCode).toBe(404);
    const list = (await app
      .inject({ method: "GET", url: "/api/kos", headers: erik.headers })
      .then((r) => r.json())) as Array<{ id: string }>;
    expect(list.some((k) => k.id === koId)).toBe(false);

    // … aber im Admin-Papierkorb, mit Löscher und Ablauf-Frist.
    const trash = (await app
      .inject({ method: "GET", url: "/api/kos/trash", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string; deletedBy: string; expiresAt: string }>;
    const entry = trash.find((e) => e.id === koId);
    expect(entry?.deletedBy).toBe(erik.id);
    expect(entry?.expiresAt).toBeTruthy();
  });

  it("Papierkorb ist Admin-Sache: Experte bekommt 403 (Liste, Wiederherstellen, Endlöschung)", async () => {
    const { app, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Rechte-Test");
    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: erik.headers });

    for (const req of [
      { method: "GET" as const, url: "/api/kos/trash" },
      { method: "POST" as const, url: `/api/kos/${koId}/restore` },
      { method: "DELETE" as const, url: `/api/kos/trash/${koId}` },
    ]) {
      const res = await app.inject({ ...req, headers: erik.headers });
      expect(res.statusCode).toBe(403);
    }
  });

  it("Wiederherstellen bringt den Beitrag unversehrt zurück (Version + Historie bleiben)", async () => {
    const { app, admin, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Comeback");
    const before = await app
      .inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik.headers })
      .then((r) => r.json());

    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: erik.headers });
    const restored = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/restore`,
      headers: admin.headers,
    });
    expect(restored.statusCode).toBe(200);

    const after = await app
      .inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik.headers })
      .then((r) => r.json());
    expect(after.version).toBe(before.version);
    expect(after.history.length).toBe(before.history.length);
    expect(after.deletedAt).toBeUndefined();

    // Und der Papierkorb ist ihn los.
    const trash = (await app
      .inject({ method: "GET", url: "/api/kos/trash", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string }>;
    expect(trash.some((e) => e.id === koId)).toBe(false);
  });

  it("Admin kann einen Papierkorb-Eintrag sofort endgültig löschen", async () => {
    const { app, admin, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Sofort weg");
    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: erik.headers });

    const purge = await app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${koId}`,
      headers: admin.headers,
    });
    expect(purge.statusCode).toBe(204);

    const restoreGone = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/restore`,
      headers: admin.headers,
    });
    expect(restoreGone.statusCode).toBe(404);
  });

  it("Demo-Daten landen NIE im Papierkorb — Löschen ist sofort endgültig", async () => {
    const { app, admin } = await setup();
    const kos = (await app
      .inject({ method: "GET", url: "/api/kos", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string; demoSeed?: boolean }>;
    const demo = kos.find((k) => k.demoSeed === true);
    expect(demo).toBeTruthy();
    if (!demo) {
      return;
    }

    await app.inject({ method: "DELETE", url: `/api/kos/${demo.id}`, headers: admin.headers });
    const trash = (await app
      .inject({ method: "GET", url: "/api/kos/trash", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string }>;
    expect(trash.some((e) => e.id === demo.id)).toBe(false);
    const gone = await app.inject({
      method: "POST",
      url: `/api/kos/${demo.id}/restore`,
      headers: admin.headers,
    });
    expect(gone.statusCode).toBe(404);
  });

  it("nach Ablauf der Frist wird automatisch endgültig gelöscht (Selbstheilung beim Lesen)", async () => {
    // Deterministisch über die injizierbare Uhr des KoService — kein Cron, kein Warten.
    let clock = Date.parse("2026-07-03T12:00:00.000Z");
    const service = new KoService({ repo: new InMemoryKoRepo(), now: () => clock });
    const ko = await service.create({
      title: "Frist-Test",
      statement: "Läuft ab.",
      type: "best_practice",
      category: "Anlage 1",
      author: "erik",
    });
    await service.delete(ko.id, "erik");
    expect(await service.trashed()).toHaveLength(1);

    // Einen Tag VOR Ablauf: bleibt erhalten.
    clock += (TRASH_RETENTION_DAYS - 1) * 86_400_000;
    expect(await service.trashed()).toHaveLength(1);

    // Nach Ablauf: beim nächsten Lesen endgültig entfernt — auch aus dem Papierkorb.
    clock += 2 * 86_400_000;
    expect(await service.trashed()).toHaveLength(0);
    await expect(service.restore(ko.id, "admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
