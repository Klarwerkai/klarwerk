import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { overlapRoutes } from "../../services/app/src/routes/overlap-routes";
import type { SichtbarkeitsFakten } from "../../services/app/src/sichtbarkeit";
import {
  InMemoryOverlapRepo,
  InMemoryOverlapSettingsRepo,
  type OverlapEntry,
  OverlapService,
} from "../../services/conflicts";

const at = "2026-09-09T12:00:00.000Z";
const nichtGefunden = { error: "NOT_FOUND", message: "Überschneidung nicht gefunden." };
const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function lage(
  patch: Partial<OverlapEntry> = {},
  objekte: Record<string, SichtbarkeitsFakten> = {},
  user: SessionUser = { id: "nora", role: "experte" },
) {
  const repo = new InMemoryOverlapRepo();
  const entry: OverlapEntry = {
    id: "vorgang",
    koA: "geheimes-objekt-a",
    koB: "geheimes-objekt-b",
    pairKey: "dup|geheimes-objekt-a|geheimes-objekt-b",
    status: "geschlossen",
    relation: "identisch",
    aspects: [{ beschreibung: "Geheimnis", zitatA: "Zitat A", zitatB: "Zitat B" }],
    eigenanteilA: "Inhalt A",
    eigenanteilB: "Inhalt B",
    recommendation: "zusammenfuehren",
    origin: "auto",
    detector: {
      trigger: "background",
      method: "model",
      lexicalScore: 0.9,
      rationale: "Geschützte Modellbegründung",
    },
    resolution: { reason: "dismissed", by: "nora", note: "Geschützte Notiz", at },
    createdAt: at,
    closedAt: at,
    ...patch,
  };
  await repo.insert(entry);
  const app = Fastify();
  apps.push(app);
  await app.register(
    overlapRoutes(
      {
        overlaps: new OverlapService({ repo }),
        settings: new InMemoryOverlapSettingsRepo(),
        kos: { get: async (id) => objekte[id] },
      },
      { requireUser: async () => user, requirePermission: async () => user },
    ),
  );
  return { app, entry, repo };
}

describe("Q7: der Abschlussnachweis am bestehenden Detailweg", () => {
  it("eigener geschlossener Vorgang liefert ausschließlich Grund, Urheber und Abschlusszeit", async () => {
    const { app, entry, repo } = await lage();
    const res = await app.inject("/api/duplicates/vorgang");
    expect(res.statusCode).toBe(200);
    // Vollständige Ausgabe statt Negativliste: auch künftige Inhaltsfelder dürfen nicht mitkommen.
    expect(res.json()).toEqual({
      id: "vorgang",
      status: "geschlossen",
      resolution: { reason: "dismissed", by: "nora", at },
    });
    expect(await repo.findById(entry.id)).toEqual(entry);
  });

  it("auch eine vorhandene fremde geschützte Gegenseite gibt keine Inhalte preis", async () => {
    const { app } = await lage(
      {},
      {
        "geheimes-objekt-a": { author: "nora", confidentiality: "intern" },
        "geheimes-objekt-b": { author: "frida", confidentiality: "streng_vertraulich" },
      },
    );
    const res = await app.inject("/api/duplicates/vorgang");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "vorgang",
      status: "geschlossen",
      resolution: { reason: "dismissed", by: "nora", at },
    });
  });

  it.each(["frida", null, ""])(
    "Abschluss durch %s bleibt wie eine unbekannte Kennung bei 404",
    async (by) => {
      const { app } = await lage({ resolution: { reason: "dismissed", by, note: null, at } });
      const res = await app.inject("/api/duplicates/vorgang?by=nora");
      const unbekannt = await app.inject("/api/duplicates/unbekannt");
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(nichtGefunden);
      expect(res.body).toBe(unbekannt.body);
      expect(unbekannt.statusCode).toBe(404);
    },
  );

  it("ohne gespeicherten Abschluss entsteht kein Nachweis", async () => {
    const { app, entry, repo } = await lage();
    delete entry.resolution;
    await repo.update(entry);
    expect((await app.inject("/api/duplicates/vorgang")).statusCode).toBe(404);
  });

  it.each(["offen", "in_bearbeitung"] as const)(
    "%s bleibt ohne sichtbares Paar bei 404, auch mit altem Abschlussfeld",
    async (status) => {
      const { app } = await lage({ status });
      const res = await app.inject("/api/duplicates/vorgang");
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual(nichtGefunden);
      expect((await app.inject("/api/duplicates")).json()).toEqual([]);
    },
  );

  it.each(["offen", "in_bearbeitung", "geschlossen"] as const)(
    "sichtbares Paar bleibt bei %s vollständig abrufbar",
    async (status) => {
      const { app, entry } = await lage(
        { status },
        {
          "geheimes-objekt-a": { confidentiality: "intern" },
          "geheimes-objekt-b": { confidentiality: "intern" },
        },
      );
      const res = await app.inject("/api/duplicates/vorgang");
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(entry);
    },
  );

  it("leere Nutzerkennung ist kein Nachweis einer Autorschaft", async () => {
    const { app } = await lage(
      { resolution: { reason: "dismissed", by: "", note: null, at } },
      {},
      { id: "", role: "experte" },
    );
    expect((await app.inject("/api/duplicates/vorgang")).statusCode).toBe(404);
  });
});
