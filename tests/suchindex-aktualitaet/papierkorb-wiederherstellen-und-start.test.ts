// ================================================================================================
// REVIEW 21.10.2026 · PAKET 3.2 — SUCHPROJEKTION UND START (K1, K2, DAT-1)
// ================================================================================================
//
// K1: Papierkorb → Neuaufbau der Suchprojektion (Recover) → Wiederherstellen. Der Neuaufbau
// überspringt Objekte im Papierkorb; ihre Zeile behält die alte Generation. Bis hierher stempelte
// das Wiederherstellen sie nicht neu, `missingActive` kannte keine Generationsbedingung — das
// Objekt fehlte danach dauerhaft in Bibliothek und Klara, und die Bereitschaftsprüfung meldete
// „aktive Zeilen nicht durchgängig in Generation 2". Beleg:
// produktcode-review-20261021/belege/pruefer/sept/k1-k2-projektion.mts (Fall A).
//
// K2: Zustand `V2_READY` und eine Freigabe, die das Gate ablehnt. Der Start kannte dort nur die
// Freigabe; lehnte sie ab, blieb der Zustand stehen und jeder Start warf erneut (server.ts beendet
// den Prozess). Beleg: k1-k2-projektion.mts (Fall B), daten/dat-02-suchprojektion.mts.
//
// DAT-1: der vollständige Neuaufbau läuft im `onReady`-Haken unter Fastifys `pluginTimeout`
// (Vorgabe 10 s) und war nicht fortsetzbar — jeder Start begann von vorn und riss dieselbe Frist.
// Beleg: daten/dat-04-startschleife.mts.
import { describe, expect, it, vi } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { TxContext } from "../../services/db-tx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { stelleSuchprojektionBereit } from "../../services/app/src/search-projection-startup";
import {
  InMemoryKoMetadataProjectionRepo,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  classificationFromVersionSnapshot,
  type KnowledgeObject,
  KoService,
  neuerProjektionsSpeicher,
} from "../../services/knowledge-object";

function objekt(id: string, koerper: string): KnowledgeObject {
  return {
    id,
    title: `Objekt ${id}`,
    statement: "Aussage ohne Zielwort.",
    bodyHtml: `<p>${koerper}</p>`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    createdAt: "2024-03-01T08:00:00.000Z",
    history: [],
  } as unknown as KnowledgeObject;
}

function stapel() {
  const repo = new InMemoryKoRepo();
  const metadata = new InMemoryKoMetadataProjectionRepo();
  const speicher = neuerProjektionsSpeicher();
  const projections = new InMemoryKoSearchProjectionRepo(repo, metadata, speicher);
  const ko = new KoService({ repo, searchProjections: projections });
  return { repo, projections, speicher, ko };
}

type Stapel = ReturnType<typeof stapel>;

const treffer = async (s: Stapel, wort: string): Promise<string[]> =>
  (await s.ko.findSearchHits({ terms: [wort] })).map((h) => h.koId);

// Der Weg nach `V2_READY` wie im Beleg (Fall B): Bau gebaut und geprüft, aber nicht freigegeben.
async function bisV2Ready(s: Stapel): Promise<void> {
  await s.ko.failSearchProjectionBuild("Probe");
  await s.ko.beginSearchProjectionBuild();
  await s.ko.rebuildSearchProjections();
  const nach = await s.ko.searchProjectionControl();
  await s.projections.compareAndSetControlState("V2_BUILDING", {
    ...nach,
    lastSuccessfulRebuild: new Date().toISOString(),
  });
  await s.ko.reconcileSearchProjections();
  const fertig = await s.ko.finishSearchProjectionBuild();
  expect(fertig.control.projectionState).toBe("V2_READY");
}

describe("K1 · Papierkorb → Neuaufbau → Wiederherstellen: das Objekt ist wieder suchbar", () => {
  it("Papierkorb → Recover → Restore → Suche findet wieder", async () => {
    const s = stapel();
    await s.repo.insert(objekt("a", "Alphawort"));
    await s.repo.insert(objekt("b", "Betawort"));
    await s.ko.activateSearchProjectionV2();
    // Kalibrierung: vor dem Papierkorb trifft das Wort.
    expect(await treffer(s, "alphawort")).toEqual(["a"]);

    await s.ko.delete("a", "anna");
    const recover = await s.ko.recoverSearchProjectionV2("Nachprüfung K1");
    expect(recover.control.projectionState).toBe("V2_ACTIVE");
    expect(recover.control.activeGeneration).toBe(2);

    await s.ko.restore("a", "anna");

    expect(await s.projections.generationOf("a", 1)).toBe(2);
    expect(await treffer(s, "alphawort")).toEqual(["a"]);
    expect(await s.projections.missingActive(10)).toEqual([]);
    const readiness = await s.ko.searchProjectionReadiness();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  });

  it("missingActive meldet eine Zeile fremder Generation, der Nachzug stempelt sie neu", async () => {
    // Ausgangslage, wie sie ein Wiederherstellen VOR dieser Behebung hinterlassen hat: die Zeile
    // ist da, Fassung 2, aber mit der Generation eines früheren Baus. Am Adapter vorbei gesetzt —
    // das In-Memory-Gegenstück zu einem `UPDATE` direkt in der Datenbank.
    const s = stapel();
    await s.repo.insert(objekt("a", "Alphawort"));
    await s.repo.insert(objekt("b", "Betawort"));
    await s.ko.activateSearchProjectionV2();
    await s.ko.recoverSearchProjectionV2("zweite Generation");
    s.speicher.generationen.set("a@1", 1);
    expect(await treffer(s, "alphawort")).toEqual([]);

    expect(await s.projections.missingActive(10)).toEqual(["a"]);
    const bilanz = await s.ko.backfillSearchProjections({ limit: 10 });
    expect(bilanz.geprueft).toBe(1);

    expect(await s.projections.generationOf("a", 1)).toBe(2);
    expect(await s.projections.missingActive(10)).toEqual([]);
    expect(await treffer(s, "alphawort")).toEqual(["a"]);
    const readiness = await s.ko.searchProjectionReadiness();
    expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  });
});

describe("K2 · Start aus V2_READY mit abgelehnter Freigabe", () => {
  it("Wiederherstellen während V2_READY: die Freigabe beim Start gelingt (Beleg Fall B)", async () => {
    const s = stapel();
    await s.repo.insert(objekt("a", "Alphawort"));
    await s.repo.insert(objekt("b", "Betawort"));
    await s.ko.activateSearchProjectionV2();
    await s.ko.delete("a", "anna");
    await bisV2Ready(s);
    await s.ko.restore("a", "anna");

    const control = await stelleSuchprojektionBereit(s.ko);
    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(await treffer(s, "alphawort")).toEqual(["a"]);
  });

  it("abgelehnte Freigabe → FAILED → Neuaufbau: der Start kommt nach genau einem Start hoch", async () => {
    const s = stapel();
    await s.repo.insert(objekt("a", "Alphawort"));
    await s.repo.insert(objekt("b", "Betawort"));
    await s.ko.activateSearchProjectionV2();
    await bisV2Ready(s);
    // Ein Objekt an der Persistenz vorbei (Journal-Replay, Fremdwerkzeug): ohne Projektionszeile
    // lehnt das Gate die Freigabe ab („unvollständige Projektion").
    await s.repo.insert(objekt("c", "Gammawort"));
    const vorher = await s.ko.searchProjectionControl();
    expect(vorher.projectionState).toBe("V2_READY");
    expect((await s.ko.searchProjectionReadiness()).alle).toBe(false);

    const control = await stelleSuchprojektionBereit(s.ko);

    expect(control.projectionState).toBe("V2_ACTIVE");
    expect(control.activeGeneration).toBe(vorher.buildGeneration + 1);
    // Der Grund der Ablehnung steht für den Betreiber im Zustand.
    expect(control.lastFailure ?? "").toContain("Freigabe");
    expect(await treffer(s, "gammawort")).toEqual(["c"]);
    expect(await treffer(s, "alphawort")).toEqual(["a"]);
  });
});

describe("DAT-1 · der Neuaufbau beim Start ist je Generation fortsetzbar", () => {
  it("Start 1 bricht im Neuaufbau ab, Start 2 schreibt nur die fehlenden Zeilen und kommt hoch", async () => {
    const s = stapel();
    const ids = ["k1", "k2", "k3", "k4", "k5", "k6"];
    for (const id of ids) {
      await s.repo.insert(objekt(id, `Wort${id}`));
    }
    await s.ko.activateSearchProjectionV2();
    // Anlass wie im Beleg: Integritätsbefund → FAILED; der nächste Start baut alles neu.
    await s.ko.failSearchProjectionBuild("Probe: Integritätsbefund beim Start");

    const original = s.projections.replace.bind(s.projections);
    let schreibvorgaenge = 0;
    const spion = vi.spyOn(s.projections, "replace").mockImplementation(async (projection) => {
      schreibvorgaenge += 1;
      if (schreibvorgaenge > 3) {
        throw new Error("Probe: Prozess endet mitten im Neuaufbau");
      }
      await original(projection);
    });
    await expect(stelleSuchprojektionBereit(s.ko)).rejects.toThrow(/mitten im Neuaufbau/);
    const nachStart1 = await s.ko.searchProjectionControl();
    expect(nachStart1.projectionState).toBe("V2_BUILDING");

    schreibvorgaenge = 0;
    spion.mockImplementation(async (projection) => {
      schreibvorgaenge += 1;
      await original(projection);
    });
    const control = await stelleSuchprojektionBereit(s.ko);

    expect(control.projectionState).toBe("V2_ACTIVE");
    // Dieselbe Generation fortgesetzt — und nur die drei Zeilen, die Start 1 nicht mehr schrieb.
    expect(control.activeGeneration).toBe(nachStart1.buildGeneration);
    expect(schreibvorgaenge).toBe(ids.length - 3);
    for (const id of ids) {
      expect(await treffer(s, `wort${id}`)).toEqual([id]);
    }
    spion.mockRestore();
  });

  it("Fastify bekommt eine ausdrückliche, großzügige Startfrist (pluginTimeout)", async () => {
    const app = buildApp(buildServices());
    try {
      // Fastifys Vorgabe ist 10 s; der vollständige Neuaufbau im onReady-Haken reißt sie ab rund
      // 2.300 Objekten. Verlangt sind mindestens 30 Minuten.
      expect(app.initialConfig.pluginTimeout).toBeGreaterThanOrEqual(30 * 60 * 1000);
    } finally {
      await app.close();
    }
  });
});

// Der lokale Fall prüft den Tx-Port des tatsächlichen Restore-Stempels, keine PG-Wirkung.
vi.mock("testcontainers", () => { throw new Error("NOPULL_INIT1STOP"); });
vi.mock("dockerode", () => { throw new Error("NOPULL_INIT1STOP"); });

it("KO15 PG-Nacharbeit: Restore bindet Steuerung, Inhalt, Klassifizierung und Metadaten an denselben Tx", async () => {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const versions = new InMemoryKoVersionRepo();
  const tx: TxContext = { brand: "TxContext" };
  const ko = new KoService({
    repo,
    versions,
    searchProjections: projections,
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
    withTx: async (fn) => fn(tx),
  });
  const a = await ko.create({ title: "Restore Alphawort", statement: "Alphawort", type: "best_practice", category: "Wartung", tags: ["Bereitschaft"], author: "anna", confidentiality: "intern" });
  await ko.activateSearchProjectionV2();
  const snapshots = await versions.listByKo(a.id);
  const snapshot = snapshots.find((s) => s.version === a.version);
  if (!snapshot) throw new Error("Versionssnapshot für Restore fehlt");
  const metadataVorher = await projections.metadata.find(a.id);
  if (!metadataVorher) throw new Error("Metadaten vor Restore fehlen");
  await ko.delete(a.id, "anna");
  const recover = await ko.recoverSearchProjectionV2("KO15: aktive Restore-Generation");
  expect(recover.control.projectionState).toBe("V2_ACTIVE");
  await projections.removeByKo(a.id);

  const control = vi.spyOn(projections, "controlState");
  const find = vi.spyOn(projections, "find");
  const classification = vi.spyOn(versions, "listByKo");
  const metadata = vi.spyOn(projections.metadata, "upsert");
  try {
    await ko.restore(a.id, "anna");
    expect(control.mock.calls).toEqual([[tx]]);
    expect(find.mock.calls).toEqual([[a.id, a.version, tx]]);
    expect(classification.mock.calls).toEqual([[a.id, tx]]);
    expect(metadata).toHaveBeenCalledWith(expect.anything(), tx);
    const restored = await projections.find(a.id, a.version);
    expect(restored?.classificationSnapshot).toEqual(classificationFromVersionSnapshot(snapshot));
    expect(await projections.generationOf(a.id, a.version)).toBe(recover.control.activeGeneration);
    const metadataNachher = await projections.metadata.find(a.id);
    expect(metadataNachher?.categoryText).toBe(metadataVorher.categoryText);
    expect(metadataNachher?.tagText).toBe(metadataVorher.tagText);
    expect((await ko.findSearchHits({ terms: ["alphawort"] })).map((h) => h.koId)).toEqual([a.id]);
  } finally { vi.restoreAllMocks(); }
});
