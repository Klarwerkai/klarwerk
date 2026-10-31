import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";

let app: ReturnType<typeof buildApp> | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
});
const offen = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const INHALT = {
  title: "KO17 Quellen",
  statement: "Fiktiver Quellen-Prüfbeitrag.",
  type: "best_practice" as const,
  category: "Prüfstand",
  confidentiality: "intern" as const,
};
async function setup() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  app = buildApp(services);
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@ko17.test", password: "Fiktiv-KO17-123!" },
  });
  expect(registriert.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@ko17.test", password: "Fiktiv-KO17-123!" },
  });
  expect(login.statusCode).toBe(200);
  await services.externalKnowledge.setStage("search_attach");
  return { app, repos, services, headers: { authorization: `Bearer ${login.json().token}` } };
}
type Welt = Awaited<ReturnType<typeof setup>>;
const quelle = (label: string) => ({
  label,
  url: `https://example.test/${encodeURIComponent(label)}`,
  excerpt: `Auszug ${label}`,
});
function put(w: Welt, id: string, payload: object) {
  return w.app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: w.headers, payload });
}
async function anlegen(w: Welt) {
  const r = await w.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: w.headers,
    payload: INHALT,
  });
  expect(r.statusCode).toBe(201);
  await w.services.aiCheckWorker?.idle();
  return r.json<KnowledgeObject>().id;
}
async function lesen(w: Welt, id: string) {
  const r = await w.app.inject({ method: "GET", url: `/api/kos/${id}`, headers: w.headers });
  expect(r.statusCode).toBe(200);
  return r.json<KnowledgeObject>();
}
async function parallel(w: Welt, id: string, ersterRumpf: object, zweitesLabel: string) {
  const erreicht = offen();
  const weiter = offen();
  const zweiterGestartet = offen();
  const update = w.repos.koRepo.update.bind(w.repos.koRepo);
  const finden = w.repos.koRepo.findById.bind(w.repos.koRepo);
  const add = w.services.ko.addSource.bind(w.services.ko);
  let ersterWrite = true;
  let zweiteImDienst = false;
  let freigegeben = false;
  let vorzeitigGelesen = 0;
  vi.spyOn(w.repos.koRepo, "update").mockImplementation(async (ko, tx) => {
    if (ko.id === id && ersterWrite) {
      ersterWrite = false;
      erreicht.resolve();
      await weiter.promise;
    }
    return update(ko, tx);
  });
  vi.spyOn(w.repos.koRepo, "findById").mockImplementation((...args) => {
    if (args[0] === id && zweiteImDienst && !freigegeben) vorzeitigGelesen += 1;
    return finden(...args);
  });
  vi.spyOn(w.services.ko, "addSource").mockImplementation((...args) => {
    if (args[2].label === zweitesLabel) zweiteImDienst = true;
    const lauf = add(...args);
    if (args[2].label === zweitesLabel) zweiterGestartet.resolve();
    return lauf;
  });
  const erster = put(w, id, ersterRumpf).then((r) => r);
  let zweiter: ReturnType<typeof erster.then> | undefined;
  let nachlauf: Promise<boolean> | undefined;
  onTestFinished(async () => {
    freigegeben = true;
    weiter.resolve();
    await Promise.allSettled([
      erster,
      ...(zweiter ? [zweiter] : []),
      ...(nachlauf ? [nachlauf] : []),
    ]);
  });
  try {
    await erreicht.promise;
    const lauf = put(w, id, { action: "add-source", source: quelle(zweitesLabel) }).then((r) => r);
    zweiter = lauf;
    await zweiterGestartet.promise;
    // Auch ein Quellen-Nachlauf muss hinter dem bereits laufenden Quellen-Write lesen.
    // Leere IDs ändern keine Daten, durchlaufen aber den echten bisherigen Leseweg.
    nachlauf = w.services.ko.merkeNeubewertungOffen(id, [], false);
    // Der zweite Eintritt ist bewiesen; ein gesperrter zweiter Read wird NICHT abgewartet.
    expect(vorzeitigGelesen).toBe(0);
    freigegeben = true;
    weiter.resolve();
    const antworten = await Promise.all([erster, lauf]);
    expect(antworten.map((r) => r.statusCode)).toEqual([200, 200]);
    expect(await nachlauf).toBe(false);
  } finally {
    freigegeben = true;
    weiter.resolve();
    await Promise.allSettled([
      erster,
      ...(zweiter ? [zweiter] : []),
      ...(nachlauf ? [nachlauf] : []),
    ]);
  }
}

describe("KO17: Quellen serialisieren und CAS ehrlich beantworten", () => {
  it("behält zwei parallel authentifiziert angefügte Quellen samt Belegen", async () => {
    const w = await setup();
    const id = await anlegen(w);
    await parallel(w, id, { action: "add-source", source: quelle("Eins") }, "Zwei");
    const ko = await lesen(w, id);
    expect(ko.sources.map((q) => q.label).sort()).toEqual(["Eins", "Zwei"]);
    expect(new Set(ko.sources.map((q) => q.id)).size).toBe(2);
    for (const q of ko.sources)
      expect(q).toMatchObject({ ...quelle(q.label), kind: "external", peerValidated: false });
    const belege = (await w.repos.evidence.listByKo(id)).filter((b) => b.kind === "source");
    expect(belege.map((b) => b.sourceId).sort()).toEqual(ko.sources.map((q) => q.id).sort());
    expect(
      (await w.repos.auditRepo.all()).filter(
        (a) => a.target === id && a.action === "ko.source-added",
      ),
    ).toHaveLength(2);
  });

  it("behält beim parallelen Entfernen und Anfügen die unbetroffene und die neue Quelle", async () => {
    const w = await setup();
    const id = await anlegen(w);
    for (const label of ["Bleibt", "Weg"])
      expect((await put(w, id, { action: "add-source", source: quelle(label) })).statusCode).toBe(
        200,
      );
    const vorher = await lesen(w, id);
    const bleibt = vorher.sources.find((q) => q.label === "Bleibt");
    const weg = vorher.sources.find((q) => q.label === "Weg");
    expect(weg).toBeDefined();
    await parallel(w, id, { action: "remove-source", sourceId: weg?.id }, "Neu");
    const ko = await lesen(w, id);
    expect(ko.sources.map((q) => q.label).sort()).toEqual(["Bleibt", "Neu"]);
    expect(ko.sources.find((q) => q.label === "Bleibt")).toEqual(bleibt);
  });

  it("liefert für beide Quellenaktionen beim echten Repo-CAS-Verlust 409 ohne Phantom-Beleg", async () => {
    const w = await setup();
    for (const action of ["add-source", "remove-source"] as const) {
      const id = await anlegen(w);
      const seed = await put(w, id, { action: "add-source", source: quelle("Bestand") });
      expect(seed.statusCode).toBe(200);
      const vorher = await lesen(w, id);
      const belege = await w.repos.evidence.listByKo(id);
      const audit = (await w.repos.auditRepo.all()).filter(
        (a) => a.target === id && a.action.startsWith("ko.source-"),
      );
      const update = w.repos.koRepo.update.bind(w.repos.koRepo);
      const spy = vi
        .spyOn(w.repos.koRepo, "update")
        .mockImplementationOnce((ko, tx) =>
          update({ ...ko, rowVersion: (ko.rowVersion ?? 0) - 1 }, tx),
        );
      const antwort = await put(
        w,
        id,
        action === "add-source"
          ? { action, source: quelle("Nicht bestaetigt") }
          : { action, sourceId: vorher.sources[0]?.id },
      );
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      expect(antwort.statusCode).toBe(409);
      expect(antwort.json().error).toBe("STALE_WRITE");
      expect((await lesen(w, id)).sources).toEqual(vorher.sources);
      expect(await w.repos.evidence.listByKo(id)).toEqual(belege);
      expect(
        (await w.repos.auditRepo.all()).filter(
          (a) => a.target === id && a.action.startsWith("ko.source-"),
        ),
      ).toEqual(audit);
    }
  });
});
