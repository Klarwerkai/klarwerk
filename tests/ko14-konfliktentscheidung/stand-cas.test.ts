import { expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  type Conflict,
  ConflictService,
  InMemoryConflictMemoryRepo,
  InMemoryConflictRepo,
} from "../../services/conflicts";

async function welt() {
  const repo = new InMemoryConflictRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo(), now: () => 0 });
  const memory = new InMemoryConflictMemoryRepo();
  const dienst = new ConflictService({ repo, audit, memory, now: () => 0 });
  const konflikt = await dienst.create(
    { koA: "a", koB: "b", type: "truth", description: "KO14: gleiche Anlage, andere Angabe." },
    "autor",
  );
  await memory.put({
    pairKey: "ko:a|ko:b",
    stand: "1".repeat(64),
    outcome: "created",
    conflictId: konflikt.id,
    at: "2026-10-28T00:00:00.000Z",
  });
  return { repo, audit, memory, dienst, konflikt };
}

// Beide echten Reads halten denselben Stand; erst danach schreibt der erste reale Caller.
async function gleicheBasis(
  repo: InMemoryConflictRepo,
  erster: () => Promise<Conflict>,
  zweiter: () => Promise<Conflict>,
) {
  const lesen = repo.findById.bind(repo);
  let beideDa: () => void = () => undefined;
  let ersterWeiter: () => void = () => undefined;
  let zweiterWeiter: () => void = () => undefined;
  const bereit = new Promise<void>((resolve) => {
    beideDa = resolve;
  });
  const tor1 = new Promise<void>((resolve) => {
    ersterWeiter = resolve;
  });
  const tor2 = new Promise<void>((resolve) => {
    zweiterWeiter = resolve;
  });
  const gelesen: Array<Conflict | undefined> = [];
  repo.findById = async (id) => {
    const stand = await lesen(id);
    if (gelesen.length >= 2) return stand;
    const platz = gelesen.length;
    gelesen.push(structuredClone(stand));
    if (gelesen.length === 2) beideDa();
    await (platz === 0 ? tor1 : tor2);
    return stand;
  };
  const a = erster();
  const b = zweiter();
  const fertig = Promise.allSettled([a, b]);
  try {
    await bereit;
    expect(gelesen).toHaveLength(2);
    expect(gelesen[0]).toEqual(gelesen[1]);
    ersterWeiter();
    await a;
    zweiterWeiter();
    return await fertig;
  } finally {
    ersterWeiter();
    zweiterWeiter();
    repo.findById = lesen;
    await fertig;
  }
}

it("KO14: normale Klärung bleibt nach späterer Eskalation vollständig abgeschlossen", async () => {
  const w = await welt();
  const id = w.konflikt.id;
  await w.dienst.einordnen(id, "version", "controller");
  expect((await w.dienst.escalate(id, "controller")).status).toBe("eskaliert");
  await w.dienst.secondOpinion(id, "Quelle B beschreibt die neue Baureihe.", "pruefer");
  const entscheidung = await w.dienst.resolve(id, "controller", "B gilt für Baureihe B.", {
    art: "schraenkt_ein",
    gilt: "b",
    geltungsbereich: "Baureihe B",
  });
  expect(entscheidung).toMatchObject({
    status: "geloest",
    arbeitsart: "version",
    secondOpinion: "Quelle B beschreibt die neue Baureihe.",
    decidedBy: "controller",
    decision: "B gilt für Baureihe B.",
    resolutionReason: "decided",
    vorrang: { vorrangKo: "b", nachrangKo: "a", geltungsbereich: "Baureihe B" },
  });
  const vorher = structuredClone({
    konflikt: await w.repo.findById(id),
    audit: await w.audit.list({ target: id }),
    memory: await w.memory.find(["ko:a|ko:b"]),
  });
  expect(vorher.memory[0]?.outcome).toBe("decided");
  await expect(w.dienst.escalate(id, "spaeter")).rejects.toMatchObject({
    code: "ALREADY_RESOLVED",
  });
  expect({
    konflikt: await w.repo.findById(id),
    audit: await w.audit.list({ target: id }),
    memory: await w.memory.find(["ko:a|ko:b"]),
  }).toEqual(vorher);
});

it("KO14: nur ein konkurrierender Abschluss schreibt Beschluss, Audit und Gedächtnis", async () => {
  const w = await welt();
  const id = w.konflikt.id;
  await w.dienst.escalate(id, "controller");
  const zuvor = (await w.audit.list({ target: id })).length;
  const ergebnisse = await gleicheBasis(
    w.repo,
    () => w.dienst.resolve(id, "gewinner", "Quelle A gilt."),
    () => w.dienst.dismiss(id, "verlierer", "Fehlalarm"),
  );
  const gewinner = ergebnisse[0];
  const verlierer = ergebnisse[1];
  if (gewinner?.status !== "fulfilled" || verlierer?.status !== "rejected") {
    throw new Error("Die echten konkurrierenden Aufrufe haben keinen eindeutigen Gewinner");
  }
  expect(verlierer.reason).toMatchObject({ code: "CONFLICT" });
  expect(await w.repo.findById(id)).toEqual(gewinner.value);
  expect(gewinner.value).toMatchObject({
    status: "geloest",
    decidedBy: "gewinner",
    decision: "Quelle A gilt.",
    resolutionReason: "decided",
  });
  const belege = (await w.audit.list({ target: id })).slice(zuvor);
  expect(belege).toHaveLength(1);
  expect(belege[0]).toMatchObject({ action: "conflict.resolved", actor: "gewinner" });
  expect(await w.memory.find(["ko:a|ko:b"])).toMatchObject([
    { stand: "1".repeat(64), outcome: "decided", conflictId: id },
  ]);
});

it("KO14: eine konkurrierende Einordnung bindet den ganzen Stand", async () => {
  const w = await welt();
  const id = w.konflikt.id;
  const zuvor = (await w.audit.list({ target: id })).length;
  const memory = structuredClone(await w.memory.find(["ko:a|ko:b"]));
  const ergebnisse = await gleicheBasis(
    w.repo,
    () => w.dienst.einordnen(id, "regel", "gewinner"),
    () => w.dienst.einordnen(id, "sache", "verlierer"),
  );
  expect(ergebnisse[0]?.status).toBe("fulfilled");
  expect(ergebnisse[1]).toMatchObject({ status: "rejected", reason: { code: "CONFLICT" } });
  expect(await w.repo.findById(id)).toMatchObject({ status: "offen", arbeitsart: "regel" });
  const belege = (await w.audit.list({ target: id })).slice(zuvor);
  expect(belege).toHaveLength(1);
  expect(belege[0]).toMatchObject({ action: "conflict.classified", actor: "gewinner" });
  expect(await w.memory.find(["ko:a|ko:b"])).toEqual(memory);
});
