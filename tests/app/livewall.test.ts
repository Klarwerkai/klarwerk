import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { buildLiveWall } from "../../services/app/src/livewall";
import type { KnowledgeObject } from "../../services/knowledge-object";

// Audit-P4 (SCRUM-398): Live-Wall — „frisch gesichert / hat heute geholfen".
// Reine Aggregation aus echten Ereignissen; nichts erfinden, leere Zustände ehrlich.
describe("SCRUM-398: Live-Wall", () => {
  const ko = (id: string, title: string, createdAt: string): KnowledgeObject =>
    ({
      id,
      title,
      statement: "s",
      conditions: [],
      measures: [],
      type: "best_practice",
      category: "Allgemein",
      tags: [],
      confidence: 0,
      trust: 0,
      status: "offen",
      version: 1,
      originalAuthor: "u1",
      author: "u1",
      neededValidations: 3,
      assignments: [],
      asset: null,
      createdAt,
      history: [],
      comments: [],
      attachments: [],
      sources: [],
    }) as KnowledgeObject;

  it("sortiert frisch Gesichertes absteigend und begrenzt die Liste", () => {
    const kos = [
      ko("a", "Alt", "2026-07-01T08:00:00.000Z"),
      ko("b", "Neu", "2026-07-02T09:00:00.000Z"),
      ko("c", "Mittel", "2026-07-01T18:00:00.000Z"),
    ];
    const wall = buildLiveWall({ kos, helpful: [], today: "2026-07-02", limit: 2 });
    expect(wall.saved.map((s) => s.koId)).toEqual(["b", "c"]);
    expect(wall.helped).toEqual([]);
    expect(wall.helpedToday).toBe(0);
  });

  it("zählt „hat geholfen“ nur für heute und verwirft Einträge ohne Titel-Payload", () => {
    const helpful = [
      { target: "a", at: "2026-07-02T10:00:00.000Z", payload: { koTitle: "A hilft" } },
      { target: "b", at: "2026-07-01T10:00:00.000Z", payload: { koTitle: "B half gestern" } },
      { target: "c", at: "2026-07-02T11:00:00.000Z", payload: {} }, // ehrlich: ohne Titel kein Eintrag
    ];
    const wall = buildLiveWall({ kos: [], helpful, today: "2026-07-02" });
    expect(wall.helped.map((h) => h.koId)).toEqual(["a", "b"]);
    expect(wall.helpedToday).toBe(1);
  });

  it("HTTP: liefert die Wall an Angemeldete mit ko.read — und 401 ohne Login", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    const anon = await app.inject({ method: "GET", url: "/api/livewall" });
    expect(anon.statusCode).toBe(401);

    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Presse P2 entlüften",
        statement: "Vor Wartung Druck ablassen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(created.statusCode).toBe(201);

    const res = await app.inject({ method: "GET", url: "/api/livewall", headers });
    expect(res.statusCode).toBe(200);
    const wall = res.json() as { saved: Array<{ title: string }>; helpedToday: number };
    expect(wall.saved.some((s) => s.title === "Presse P2 entlüften")).toBe(true);
    expect(wall.helpedToday).toBe(0);
  });
});
