import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { notificationTarget } from "../../apps/web/src/lib/notificationTarget";
import {
  EMPTY_VALIDATION_FILTER,
  matchesValidationFilter,
  readMineOnlyFilter,
} from "../../apps/web/src/lib/validationFilters";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-364 / AG-15 follow-up / FR-VAL-05/06 / VC-P1-2: der vollständige persönliche Review-Work-Queue-
// Fluss end-to-end — Assignment-Benachrichtigung → fokussierte „Mir zugewiesen"-Linse → Bewertung →
// Zuweisung erledigt → Benachrichtigung verschwindet. HTTP über die echten Routen (build-app), die
// fokussierende Linse + Filter über die echten FE-Helfer (kein DOM). Kein neues Backend, kein neues
// Rollen-/Assignee-Modell — nur Sicht + Fluss auf vorhandenen Assignment-/KO-Daten.
describe("SCRUM-364: Review Queue Execution & Assignment Completion (HTTP end-to-end)", () => {
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
      .then((r) => r.json() as Array<{ id: string; kind: string; koId?: string }>);

  const board = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/validation/board", headers })
      .then((r) => r.json() as KnowledgeObject[]);

  it("Notification → fokussierte Linse → Bewertung → erledigt → Notification weg", async () => {
    const { app, admin, carla, erik } = await setup();

    // KO mit Quorum 2 anlegen und Carla zur Review zuweisen.
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

    const assign = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [carla.id] },
    });
    expect(assign.statusCode).toBe(204);

    // 1) Carla erhält die Assignment-Benachrichtigung im Feed.
    const carlaFeed = await notifications(app, carla.headers);
    const notice = carlaFeed.find((n) => n.id === `assign-${koId}`);
    expect(notice).toBeDefined();
    expect(notice?.kind).toBe("assignment");

    // 2) Das Sprungziel führt in die fokussierte persönliche Review-Linse (/validierung?mine=1).
    const target = notificationTarget({ kind: "assignment" });
    expect(target).toBe("/validierung?mine=1");
    const targetParams = new URL(`https://app.test${target}`).searchParams;
    expect(readMineOnlyFilter(targetParams)).toBe(true);

    // 3) Die Linse zeigt GENAU Carlas Zuweisung — Erik sieht sie nicht als „seine" Arbeit.
    const mineFilter = { ...EMPTY_VALIDATION_FILTER, mineOnly: true };
    const carlaBoard = await board(app, carla.headers);
    const koOnBoard = carlaBoard.find((k) => k.id === koId);
    expect(koOnBoard).toBeDefined();
    expect(koOnBoard?.assignments).toContain(carla.id);
    expect(matchesValidationFilter(koOnBoard as KnowledgeObject, mineFilter, carla.id)).toBe(true);
    expect(matchesValidationFilter(koOnBoard as KnowledgeObject, mineFilter, erik.id)).toBe(false);

    // 4) Carla arbeitet die Review ab (grüne Bewertung).
    const rated = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: carla.headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rated.statusCode).toBe(200);

    // 5) Carlas persönliche Queue ist leer — die Benachrichtigung ist verschwunden.
    const carlaAfter = await notifications(app, carla.headers);
    expect(carlaAfter.some((n) => n.id === `assign-${koId}`)).toBe(false);

    // 6) Ehrlichkeit: erledigte Zuweisung ≠ automatisch validiert — Quorum (2) ist noch nicht erfüllt,
    //    das KO bleibt „offen" (eine grüne Stimme von zwei).
    const after = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
    });
    expect(after.json().status).toBe("offen");
  });

  it("fremde Zuweisung erscheint nicht als eigene Review-Arbeit (keine Fake-Ownership)", async () => {
    const { app, admin, carla, erik } = await setup();
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: {
        title: "Lager schmieren",
        statement: "Intervall einhalten.",
        type: "best_practice",
        category: "Anlage 2",
        neededValidations: 2,
      },
    });
    const koId = created.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [carla.id] },
    });

    // Erik ist nicht zugewiesen: weder im Feed noch in seiner persönlichen Linse.
    const erikFeed = await notifications(app, erik.headers);
    expect(erikFeed.some((n) => n.id === `assign-${koId}`)).toBe(false);

    const erikBoard = await board(app, erik.headers);
    const ko = erikBoard.find((k) => k.id === koId);
    expect(ko).toBeDefined();
    const mineFilter = { ...EMPTY_VALIDATION_FILTER, mineOnly: true };
    expect(matchesValidationFilter(ko as KnowledgeObject, mineFilter, erik.id)).toBe(false);
  });
});
