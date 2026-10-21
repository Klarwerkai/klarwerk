// Neue Gegenfälle des selektiven Anschlusses an 510574. Keine Wiederholung der alten L1–L3.
// In-Memory-CAS und HTTP-inject; kein PostgreSQL-, Prozessneustart- oder Provider-Nachweis.
import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { runConfluenceImport } from "../../services/app/src/confluence-import";
import { redigiereKonflikt } from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";
import { adapterFromConfig } from "../support/confluence-adapter";

const apps: ReturnType<typeof buildApp>[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function quellAnker() {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({ repo });
  const item = await ko.create({
    title: "Regel",
    statement: "Für diese Maschine gilt die Regel.",
    type: "best_practice",
    category: "Anlage",
    author: "pruefperson",
    sources: [
      {
        id: "quelle-cas",
        label: "Seite",
        url: null,
        excerpt: null,
        kind: "external",
        peerValidated: false,
        author: "pruefperson",
        at: "2026-10-21T00:00:00.000Z",
        provider: "Confluence",
        externalId: "P-CAS",
        spaceKey: "K",
      },
    ],
  });
  return { repo, ko, item };
}

async function routen() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  // Der Nachlauf dieses Vertrags ruft kein Modell. Auch der sonstige App-Prüfworker bleibt stumm.
  services.aiCheckWorker = {
    enqueue: vi.fn(),
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => {},
  };
  const app = buildApp(services);
  apps.push(app);
  const identity = { name: "Prüfperson", email: "quelle@fixture.example", password: "fixture-pass-123" };
  expect((await app.inject({ method: "POST", url: "/api/auth/register", payload: identity })).statusCode)
    .toBe(201);
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: identity });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  const anlegen = async (title: string) => {
    const response = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title, statement: title, type: "best_practice", category: "Anlage", confidentiality: "intern" },
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().id as string;
  };
  const koA = await anlegen("Erste Regel");
  const koB = await anlegen("Zweite Regel");
  const conflict = await services.conflicts.create(
    { koA, koB, type: "context", description: "Die Anwendungsbedingungen sind zu klären." },
    "pruefperson",
  );
  await services.conflicts.resolve(conflict.id, "pruefperson", "Die frühere Regel gilt im benannten Fall.");
  const nachholen = (id: string, sourceIds: string[]) => app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "konflikt-neubewertung", neubewertung: { art: "quelle_entfernt", sourceIds } },
  });
  return { app, repos, services, headers, koB, conflict, nachholen };
}

describe("Quellenneubewertung · neue Erhaltungsfälle am 510574-Anschluss", () => {
  it("C1 · ein fremder KO-Write verhindert Löschvermerk und Nachholmerker gemeinsam", async () => {
    const w = await quellAnker();
    const update = w.repo.update.bind(w.repo);
    let eingeschoben = false;
    vi.spyOn(w.repo, "update").mockImplementation(async (next, tx) => {
      if (!eingeschoben && next.sources.some((s) => s.neubewertungOffen)) {
        eingeschoben = true;
        const fresh = await w.repo.findById(w.item.id);
        if (!fresh) throw new Error("Fixture fehlt");
        await update({ ...fresh, title: "Fremde Änderung", confidentiality: "vertraulich" });
      }
      await update(next, tx);
    });
    await expect(w.ko.markSourceRemoved(
      w.item.id,
      { provider: "Confluence", externalId: "P-CAS" },
      "2026-10-21T01:00:00.000Z",
      "pruefperson",
      true,
    )).rejects.toMatchObject({ code: "STALE_WRITE" });
    const fresh = await w.repo.findById(w.item.id);
    expect(fresh).toMatchObject({ title: "Fremde Änderung", confidentiality: "vertraulich" });
    expect(fresh?.sources[0]).not.toHaveProperty("sourceRemovedAt");
    expect(fresh?.sources[0]).not.toHaveProperty("neubewertungOffen");
  });

  it("C2 · CAS-Ausfall beim Entfernen des Merkers bleibt im Importbericht ausstehend", async () => {
    const w = await quellAnker();
    await w.ko.markSourceRemoved(w.item.id, { provider: "Confluence", externalId: "P-CAS" },
      "2026-10-21T01:00:00.000Z", "pruefperson", true);
    const update = w.repo.update.bind(w.repo);
    let eingeschoben = false;
    vi.spyOn(w.repo, "update").mockImplementation(async (next, tx) => {
      if (!eingeschoben && next.sources.some((s) => s.sourceRemovedAt && !s.neubewertungOffen)) {
        eingeschoben = true;
        const fresh = await w.repo.findById(w.item.id);
        if (!fresh) throw new Error("Fixture fehlt");
        await update({ ...fresh, title: "Zwischenzeitlich geändert" });
      }
      await update(next, tx);
    });
    const adapter = adapterFromConfig({
      baseUrl: "https://fixture.atlassian.net/wiki", email: "fixture@example.invalid",
      apiToken: "fixture", spaceKey: "K",
      fetchFn: (async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) }) as Response)
        as typeof fetch,
    });
    // Nur der neue Fehlerkanal des Marker-CAS, kein Ersatz für die alte echte Konfliktkomposition.
    const nachQuellwegfall = vi.fn(async () => {});
    const result = await runConfluenceImport({
      adapter, koService: w.ko, library: new LibraryService({ koService: w.ko, externalUpsert: true }),
      actor: "pruefperson", dryRun: false, nachQuellwegfall,
    });
    expect(nachQuellwegfall).toHaveBeenCalledOnce();
    expect(result.sourceSync?.neubewertungOffen).toEqual(["P-CAS"]);
    expect(result.sourceSync?.removed).toEqual([]);
    expect((await w.repo.findById(w.item.id))?.sources[0]).toMatchObject({
      sourceRemovedAt: "2026-10-21T01:00:00.000Z", neubewertungOffen: true,
    });
    expect((await w.repo.findById(w.item.id))?.title).toBe("Zwischenzeitlich geändert");
  });

  it("Q1 · nur eine belegte frühere Quelle kann nach einem gespeicherten Entfernen nachgeholt werden", async () => {
    const w = await routen();
    expect((await w.nachholen(w.koB, ["erfundene-quelle"])).statusCode).toBe(400);
    expect((await w.services.conflicts.get(w.conflict.id))?.neupruefung).toBeUndefined();
    const sourced = await w.services.ko.addSource(w.koB, "pruefperson", { label: "Datenblatt" });
    const sourceId = sourced.sources.at(-1)?.id;
    if (!sourceId) throw new Error("Quellenfixture fehlt");
    const before = await w.services.ko.get(w.koB);
    vi.spyOn(w.services.conflicts, "vermerkeNeupruefung")
      .mockRejectedValueOnce(new Error("Konfliktablage ausgefallen"));
    const removed = await w.app.inject({ method: "PUT", url: `/api/kos/${w.koB}`, headers: w.headers,
      payload: { action: "remove-source", sourceId } });
    expect(removed.statusCode, removed.body).toBe(200);
    expect(removed.json().followUpsFailed).toEqual(["konfliktentscheidung"]);
    expect((await w.services.ko.get(w.koB))?.sources.some((s) => s.id === sourceId)).toBe(false);
    expect((await w.nachholen(w.koB, [sourceId])).statusCode).toBe(200);
    expect((await w.services.conflicts.get(w.conflict.id))).toMatchObject({
      status: "geloest", decision: "Die frühere Regel gilt im benannten Fall.",
      neupruefung: [expect.objectContaining({ koId: w.koB, sourceIds: [sourceId] })],
    });
    const after = await w.services.ko.get(w.koB);
    expect(after?.version).toBe(before?.version);
    expect(after?.trust).toBe(before?.trust);
    expect((await w.services.lifecycle.offeneFaelle([w.koB]))[0]?.anlaesse)
      .toEqual([expect.objectContaining({ grund: "konflikt" })]);
  });

  it("R1 · heutiger Rechteentzug sperrt Nachholen vor der Konfliktauflösung ohne Existenzsignal", async () => {
    const w = await routen();
    const fresh = await w.repos.koRepo.findById(w.koB);
    if (!fresh) throw new Error("Fixture fehlt");
    await w.repos.koRepo.update({ ...fresh, quellrechte: { stufe: "intern", leser: [] } });
    const review = vi.spyOn(w.services.conflicts, "vermerkeNeupruefung");
    const hidden = await w.nachholen(w.koB, ["nicht-offenlegen"]);
    const absent = await w.nachholen("nicht-vorhanden", ["nicht-offenlegen"]);
    expect(hidden.statusCode).toBe(404);
    expect(absent.statusCode).toBe(404);
    expect(hidden.json()).toEqual(absent.json());
    expect(review).not.toHaveBeenCalled();
  });

  it("R2 · Feldredaktion erhält den Anlass und entfernt Quellenkennungen der ausgeblendeten Seite", () => {
    const base = { koA: "a", koB: "b", description: "Vertrauliche Gegenüberstellung",
      neupruefung: [
        { seite: "a" as const, sourceIds: ["sichtbar"], art: "quelle_entfernt" },
        { seite: "b" as const, sourceIds: ["verborgen"], art: "quelle_entfernt" },
      ] };
    const redacted = redigiereKonflikt(base, { a: true, b: false });
    expect(redacted.description).toBe("");
    expect(redacted.neupruefung.map((n) => n.sourceIds)).toEqual([["sichtbar"], []]);
    expect(redacted.redacted).toBe(true);
    expect(base.neupruefung[1]?.sourceIds).toEqual(["verborgen"]);
  });
});
