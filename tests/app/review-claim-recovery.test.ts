// WP-SHIP8-CLOSE-3 (bens ROT-1 + ROT-2) + WP-SHIP8-CLOSE-4 (bens ROT-1A/1B/1C): der Review-Claim
// ist crash-sicher, fencing-fest und bleibt Teil des offenen Idempotenzraums.
//
// ROT-1 (Lease/Anker-Recovery): jeder Claim persistiert opId + claimedAt (opId NUR fürs
// Kandidaten-CAS); der Accept stempelt den STABILEN Kandidaten-Anker (importCandidateId =
// candidate.id, DB-unique inkl. Papierkorb) ans NEU erzeugte KO, BEVOR der Endstatus geschrieben
// wird. Die Recovery (recoverStaleReviewClaims, lazy am Queue-Load) prüft nach Lease-Ablauf: KO
// mit diesem Anker vorhanden (auch getrasht) → Operation VOLLENDEN; keines → Claim sicher auf
// 'neu' zurückgeben — der Unique-Anker macht selbst einen SPÄTER fortsetzenden abgelösten Lauf
// unschädlich (Kollision → Adoption statt Doppel-KO; bens ROT-1B-Fortsetzungstest unten).
//
// ROT-2 (offener Idempotenzraum): 'neu' UND 'in_bearbeitung' belegen denselben
// (provider, externalId, sourceVersion)-Schlüssel — ein paralleler Importlauf kann während einer
// Review-Aktion keinen zweiten offenen Kandidaten einreihen, und die Import-Statuskarte zeigt die
// Quelle während des Claims weiter als „bereits importiert".
import { describe, expect, it, vi } from "vitest";
import {
  importStatusFor,
  importedAnchorVersions,
  pendingCandidateVersions,
} from "../../services/app/src/confluence-import";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryKoRepo,
  KO_IMPORT_ANCHOR_SCHEMA,
  KoService,
  type KoVersionRepo,
} from "../../services/knowledge-object";
import {
  IMPORT_CANDIDATES_SCHEMA,
  type ImportItem,
  InMemoryCandidateRepo,
  LibraryService,
  PgCandidateRepo,
  REVIEW_CLAIM_LEASE_MS,
  openCandidateKey,
  reviewClaimLeaseExpired,
} from "../../services/library-analytics";

const T0 = Date.parse("2026-07-22T06:00:00.000Z");

function anchorItem(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: "Pumpe entlüften",
    statement: "Pumpe alle 200h entlüften.",
    type: "best_practice",
    category: "Wartung",
    externalId: "P1",
    sourceScope: "WART",
    sourceVersion: 3,
    provider: "Confluence",
    ...over,
  };
}

// Gemeinsamer Zustand (KO-Repo + Kandidaten-Repo) mit steuerbarer Uhr; restart() = „neuer
// Prozess": frische Service-Instanz auf DEMSELBEN Repo-Zustand (der Crash-Fluss bleibt hängen).
function harness() {
  const clock = { nowMs: T0 };
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const candidates = new InMemoryCandidateRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const library = new LibraryService({
    koService,
    candidates,
    externalUpsert: true,
    now: () => clock.nowMs,
  });
  const restart = (): LibraryService =>
    new LibraryService({
      koService,
      candidates,
      audit,
      externalUpsert: true,
      now: () => clock.nowMs,
    });
  return { clock, koService, candidates, audit, library, restart };
}

type KoCreate = KoService["create"];

describe("WP-SHIP8-CLOSE-3 ROT-1: Crash-Snapshots des Review-Claims", () => {
  it("(a→ROT-1B, bens Fencing-Test): Recovery gibt frei, B akzeptiert, der ALTE Lauf setzt FORT → weder Doppel- noch Orphan-KO", async () => {
    const ctx = harness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Pumpe", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // RELEASABLE Gate VOR der KO-Anlage: Lauf A hängt IN acceptToKo (nach Claim, vor Insert) —
    // und wird SPÄTER FORTGESETZT (bens Auflage: der alte Promise darf nicht hängen bleiben).
    const origCreate = ctx.koService.create.bind(ctx.koService);
    let releaseA: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let gated = false;
    (ctx.koService as { create: KoCreate }).create = async (input) => {
      if (!gated) {
        gated = true;
        await gate;
      }
      return origCreate(input);
    };
    const oldRun = ctx.library.reviewImportCandidate(id, "accept", "rev-A");
    const oldRunOutcome = oldRun.then(
      () => "fulfilled" as const,
      (err: unknown) => err,
    );
    await vi.waitFor(() => {
      expect(gated).toBe(true);
    });
    const during = await ctx.candidates.findById(id);
    expect(during?.status).toBe("in_bearbeitung");
    expect(during?.opId).toBeTruthy();

    // Lease NOCH NICHT abgelaufen → die Recovery fasst einen LAUFENDEN Claim nie an.
    expect(await ctx.restart().recoverStaleReviewClaims()).toEqual({ completed: 0, released: 0 });

    // Lease abgelaufen → Recovery gibt frei (kein Anker-KO existiert; As Insert lief noch nicht).
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    const recovered = ctx.restart();
    expect(await recovered.recoverStaleReviewClaims()).toEqual({ completed: 0, released: 1 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("neu");
    expect(after?.opId).toBeUndefined();
    expect((await ctx.koService.list()).map((k) => k.title)).not.toContain("Pumpe");

    // B claimt denselben Kandidaten und akzeptiert VOLLSTÄNDIG (der Wrapper lässt B durch).
    const b = await recovered.reviewImportCandidate(id, "accept", "rev-B");
    expect(b.status).toBe("angenommen");
    const bKoId = b.koId;
    expect(bKoId).toBeTruthy();

    // Der ALTE Lauf setzt FORT und versucht seinen späten KO-Write: der DB-Unique-Kandidaten-
    // Anker (InMemory-Spiegel) lehnt den zweiten Insert ab, acceptToKo ADOPTIERT Bs KO, und der
    // Kandidaten-CAS mit der ALTEN opId scheitert → der alte Lauf endet ehrlich mit CONFLICT.
    releaseA();
    const outcome = await oldRunOutcome;
    expect(outcome).toMatchObject({ code: "CONFLICT" });

    // WEDER Doppel- NOCH Orphan-KO: exakt EIN KO trägt den Kandidaten-Anker (inkl. Papierkorb-
    // Sicht), der Kandidat verweist auf GENAU dieses (Bs) KO.
    expect((await ctx.koService.list()).filter((k) => k.title === "Pumpe")).toHaveLength(1);
    expect((await ctx.koService.findByImportCandidateId(id))?.id).toBe(bKoId);
    const finalCand = await ctx.candidates.findById(id);
    expect(finalCand?.status).toBe("angenommen");
    expect(finalCand?.koId).toBe(bKoId);
  });

  it("(b) Abbruch NACH KO-Erzeugung, VOR Endstatus → Recovery VOLLENDET (kein blindes Reset, kein Doppel-KO)", async () => {
    const ctx = harness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Ventil", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // Gate: der Endstatus-Write (resolveClaim) hängt für immer — die KO-Anlage ist da bereits
    // GELUNGEN (mit Kandidaten-Anker gestempelt), nur der Abschluss fehlt. Exakt bens kritisches
    // Fenster: ein blindes Reset auf 'neu' würde beim Retry ein ZWEITES KO riskieren.
    const origResolve = ctx.candidates.resolveClaim.bind(ctx.candidates);
    let intercepted = false;
    (ctx.candidates as { resolveClaim: typeof ctx.candidates.resolveClaim }).resolveClaim = (
      rid,
      opId,
      next,
    ) => {
      if (!intercepted) {
        intercepted = true;
        return new Promise(() => {});
      }
      return origResolve(rid, opId, next);
    };
    ctx.library.reviewImportCandidate(id, "accept", "rev-1").catch(() => {});
    await vi.waitFor(() => {
      expect(intercepted).toBe(true);
    });
    // Crash-Zustand: KO existiert (mit Kandidaten-Anker gestempelt), Kandidat hängt ohne Endstatus.
    const created = (await ctx.koService.list()).filter((k) => k.title === "Ventil");
    expect(created).toHaveLength(1);
    expect(created[0]?.importCandidateId).toBe(id);
    expect((await ctx.candidates.findById(id))?.status).toBe("in_bearbeitung");

    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    const recovered = ctx.restart();
    expect(await recovered.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    // VOLLENDET — ein bloßes Startup-Reset auf 'neu' wäre hier falsch gewesen.
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    expect(after?.koId).toBe(created[0]?.id);
    expect(after?.opId).toBeUndefined();
    // Höchstens EIN KO; kein stiller Erfolg: das Audit trägt den nachgezogenen Accept.
    expect((await ctx.koService.list()).filter((k) => k.title === "Ventil")).toHaveLength(1);
    const entries = await ctx.audit.list({ action: "import.candidate-accept" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.payload).toMatchObject({ koId: created[0]?.id, recovered: true });
    // Kein Doppel-Review nach der Vollendung.
    await expect(recovered.reviewImportCandidate(id, "accept", "rev-1")).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
    });
  });

  it("(c) Abbruch VOR Endstatus MIT Anker (externalId) → Recovery vollendet; genau EIN KO mit dem Anker", async () => {
    const ctx = harness();
    const [cand] = await ctx.library.createImportCandidates([anchorItem()], "tester");
    const id = (cand as { id: string }).id;
    const origResolve = ctx.candidates.resolveClaim.bind(ctx.candidates);
    let intercepted = false;
    (ctx.candidates as { resolveClaim: typeof ctx.candidates.resolveClaim }).resolveClaim = (
      rid,
      opId,
      next,
    ) => {
      if (!intercepted) {
        intercepted = true;
        return new Promise(() => {});
      }
      return origResolve(rid, opId, next);
    };
    ctx.library.reviewImportCandidate(id, "accept", "rev-1").catch(() => {});
    await vi.waitFor(() => {
      expect(intercepted).toBe(true);
    });
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    const recovered = ctx.restart();
    expect(await recovered.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    // Genau EIN KO mit diesem Herkunfts-Anker (provider+externalId) — kein Doppel-Import.
    const anchored = (await ctx.koService.list()).filter((ko) =>
      (ko.sources ?? []).some((s) => s.externalId === "P1"),
    );
    expect(anchored).toHaveLength(1);
    expect(after?.koId).toBe(anchored[0]?.id);
  });

  it("Lease-Prüfung: fehlendes/unlesbares claimedAt zählt defensiv als abgelaufen", () => {
    expect(reviewClaimLeaseExpired(undefined, T0)).toBe(true);
    expect(reviewClaimLeaseExpired("kein-datum", T0)).toBe(true);
    expect(reviewClaimLeaseExpired(new Date(T0).toISOString(), T0 + 1)).toBe(false);
    expect(
      reviewClaimLeaseExpired(new Date(T0).toISOString(), T0 + REVIEW_CLAIM_LEASE_MS + 1),
    ).toBe(true);
  });
});

describe("WP-SHIP8-CLOSE-3 ROT-2: 'in_bearbeitung' bleibt im offenen Idempotenzraum", () => {
  function openCand(id: string, over: Partial<ImportItem> = {}) {
    return {
      id,
      item: anchorItem(over),
      status: "neu" as const,
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    };
  }

  it("InMemory: Claim A → paralleles insertIfAbsent B mit gleichem Schlüssel schlägt fehl (false)", async () => {
    const repo = new InMemoryCandidateRepo();
    expect(await repo.insertIfAbsent(openCand("a"))).toBe(true);
    await repo.claim("a", "op-1", "2026-07-22T06:00:00.000Z");
    // Der geclaimte Kandidat behält seinen offenen Schlüssel …
    const claimed = await repo.findById("a");
    expect(claimed && openCandidateKey(claimed)).toBe("confluence@P1@3");
    // … und blockiert die Doppel-Einreihung derselben (provider, externalId, sourceVersion).
    expect(await repo.insertIfAbsent(openCand("b"))).toBe(false);
    expect((await repo.all()).map((c) => c.id)).toEqual(["a"]);
    // Anderer Provider bleibt eine EIGENE Quelle (bens F3 unverändert).
    expect(await repo.insertIfAbsent(openCand("j", { provider: "Jira" }))).toBe(true);
    // Nach dem Abschluss (kein offener Status mehr) ist dieselbe Version wieder einreihbar.
    await repo.resolveClaim("a", "op-1", { status: "angenommen" });
    expect(await repo.insertIfAbsent(openCand("b2"))).toBe(true);
  });

  it("Import-Status bleibt WÄHREND des Claims 'alreadyImported' (Statuskarte lügt nicht)", async () => {
    const ctx = harness();
    const [cand] = await ctx.library.createImportCandidates([anchorItem()], "tester");
    const id = (cand as { id: string }).id;
    // Vor dem Claim: offener Kandidat → bereits importiert.
    const before = importStatusFor(
      anchorItem(),
      await importedAnchorVersions(ctx.koService),
      await pendingCandidateVersions(ctx.library),
    );
    expect(before.alreadyImported).toBe(true);
    // Accept hängt in der KO-Anlage → der Kandidat ist geclaimt (in_bearbeitung).
    let createStarted = false;
    (ctx.koService as { create: KoCreate }).create = () => {
      createStarted = true;
      return new Promise(() => {});
    };
    ctx.library.reviewImportCandidate(id, "accept", "rev-1").catch(() => {});
    await vi.waitFor(() => {
      expect(createStarted).toBe(true);
    });
    expect((await ctx.candidates.findById(id))?.status).toBe("in_bearbeitung");
    // WÄHREND des Claims: weiterhin bereits importiert (kein „nicht importiert"-Flackern).
    const during = importStatusFor(
      anchorItem(),
      await importedAnchorVersions(ctx.koService),
      await pendingCandidateVersions(ctx.library),
    );
    expect(during.alreadyImported).toBe(true);
  });

  it("Pg-Pins: Index-Migration ERSETZT die alten Prädikate wirklich; ON-CONFLICT-Inference passt zum neuen Index", async () => {
    // Migrationskette: BEIDE Altnamen werden gedroppt, der neue Index trägt das offene Prädikat.
    expect(IMPORT_CANDIDATES_SCHEMA).toContain(
      "DROP INDEX IF EXISTS import_candidates_open_external_uq;",
    );
    expect(IMPORT_CANDIDATES_SCHEMA).toContain(
      "DROP INDEX IF EXISTS import_candidates_open_provider_external_uq;",
    );
    expect(IMPORT_CANDIDATES_SCHEMA).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_claim_external_uq",
    );
    expect(IMPORT_CANDIDATES_SCHEMA).toContain(
      "WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung');",
    );
    // Kein CREATE mehr auf einen Altnamen (stilles No-op mit altem Prädikat wäre bens Punkt).
    expect(IMPORT_CANDIDATES_SCHEMA).not.toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS import_candidates_open_provider_external_uq",
    );
    // insertIfAbsent nutzt exakt das NEUE Prädikat als Inference (sonst fände Pg den Arbiter nicht).
    const calls: string[] = [];
    const pool = {
      query: async (sql: string) => {
        calls.push(sql);
        return { rowCount: 1, rows: [{ id: "x" }] };
      },
    } as unknown as import("pg").Pool;
    await new PgCandidateRepo(pool).insertIfAbsent(openCand("x"));
    expect(calls[0]).toContain(
      "WHERE external_id IS NOT NULL AND review_status IN ('neu', 'in_bearbeitung')",
    );
  });
});

// ---- WP-SHIP8-CLOSE-4 (bens ROT-1A/1C): KO-Seiteneffekt-Kanten am Kandidaten-Anker ----

describe("WP-SHIP8-CLOSE-4 ROT-1A: create-Teilpersistenz (Insert gelungen, Seiteneffekt wirft)", () => {
  function partialCreateHarness(failing: "audit" | "snapshot") {
    const clock = { nowMs: T0 };
    // Snapshot/Audit laufen NACH repo.insert — genau eine der beiden Flächen wirft.
    const koAudit = {
      record: async (entry: { action: string }) => {
        if (failing === "audit" && entry.action === "ko.created") {
          throw new Error("AuditDown");
        }
      },
    } as unknown as AuditService;
    const throwingVersions: KoVersionRepo = {
      append: async () => {
        throw new Error("SnapshotDown");
      },
      listByKo: async () => [],
      remove: async () => {},
    };
    const koService = new KoService({
      repo: new InMemoryKoRepo(),
      audit: koAudit,
      ...(failing === "snapshot" ? { versions: throwingVersions } : {}),
    });
    const candidates = new InMemoryCandidateRepo();
    const library = new LibraryService({
      koService,
      candidates,
      externalUpsert: true,
      now: () => clock.nowMs,
    });
    return { koService, candidates, library };
  }

  for (const failing of ["audit", "snapshot"] as const) {
    it(`KO-Insert gelingt, ${failing} wirft → Accept adoptiert das Insert: GENAU EIN KO, Endzustand angenommen (kein Crash nötig)`, async () => {
      const ctx = partialCreateHarness(failing);
      const [cand] = await ctx.library.createImportCandidates(
        [{ title: "Filter", statement: "s", type: "best_practice", category: "K" }],
        "tester",
      );
      const id = (cand as { id: string }).id;
      // KEIN Fehler nach außen: create warf zwar (nach dem Insert), aber der Anker-Lookup in
      // acceptToKo findet das persistierte KO und adoptiert es — der Accept ist materialisiert.
      const reviewed = await ctx.library.reviewImportCandidate(id, "accept", "rev-1");
      expect(reviewed.status).toBe("angenommen");
      expect(reviewed.koId).toBeTruthy();
      // GENAU EIN KO, eindeutiger Kandidaten-Endzustand — ein Retry wäre ehrlich abgewiesen.
      expect((await ctx.koService.list()).filter((k) => k.title === "Filter")).toHaveLength(1);
      expect((await ctx.candidates.findById(id))?.status).toBe("angenommen");
      await expect(ctx.library.reviewImportCandidate(id, "accept", "rev-1")).rejects.toMatchObject({
        code: "ALREADY_REVIEWED",
      });
      expect((await ctx.koService.list()).filter((k) => k.title === "Filter")).toHaveLength(1);
    });
  }
});

describe("WP-SHIP8-CLOSE-4 ROT-1B/1C: DB-Unique-Anker + Cleanup-Schutz + Trash-Vertrag", () => {
  // Accept bis VOR den Endstatus treiben (resolveClaim hängt einmalig) — KO existiert mit
  // Kandidaten-Anker, der Claim bleibt offen. Liefert die Kandidaten-Id.
  async function claimWithStampedKo(ctx: ReturnType<typeof harness>): Promise<string> {
    const [cand] = await ctx.library.createImportCandidates([anchorItem()], "tester");
    const id = (cand as { id: string }).id;
    const origResolve = ctx.candidates.resolveClaim.bind(ctx.candidates);
    let intercepted = false;
    (ctx.candidates as { resolveClaim: typeof ctx.candidates.resolveClaim }).resolveClaim = (
      rid,
      opId,
      next,
    ) => {
      if (!intercepted) {
        intercepted = true;
        return new Promise(() => {});
      }
      return origResolve(rid, opId, next);
    };
    ctx.library.reviewImportCandidate(id, "accept", "rev-1").catch(() => {});
    await vi.waitFor(() => {
      expect(intercepted).toBe(true);
    });
    expect((await ctx.candidates.findById(id))?.status).toBe("in_bearbeitung");
    expect((await ctx.koService.findByImportCandidateId(id))?.importCandidateId).toBe(id);
    return id;
  }

  it("DB-Unique-Anker (InMemory-Spiegel + Schema-Pin): zweiter Insert desselben Kandidaten wird abgelehnt", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    await koService.create({
      title: "Eins",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "a",
      importCandidateId: "cand-1",
    });
    await expect(
      koService.create({
        title: "Zwei",
        statement: "s",
        type: "best_practice",
        category: "K",
        author: "a",
        importCandidateId: "cand-1",
      }),
    ).rejects.toMatchObject({ code: "IMPORT_ANCHOR_TAKEN" });
    expect((await koService.list()).map((k) => k.title)).toEqual(["Eins"]);
    // Pg-Pin: EIGENE additive Migrationsstufe (KO_SCHEMA bleibt gepinnt ALTER-frei) mit
    // Generated-Spalte + partiellem UNIQUE-Index — BEWUSST ohne deletedAt-Ausschluss (auch ein
    // getrashtes KO hält seinen Anker; echtes Pg separat belegt).
    expect(KO_IMPORT_ANCHOR_SCHEMA).toContain("ADD COLUMN IF NOT EXISTS import_candidate_id text");
    expect(KO_IMPORT_ANCHOR_SCHEMA).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS kos_import_candidate_uq",
    );
    expect(KO_IMPORT_ANCHOR_SCHEMA).toContain("WHERE import_candidate_id IS NOT NULL");
  });

  it("ROT-1C: D-CLEAN läuft WÄHREND des offenen Claims → Anker-KO NIE getrasht, Bilanz ehrlich, Recovery vollendet mit dem LEBENDEN KO", async () => {
    const ctx = harness();
    const id = await claimWithStampedKo(ctx);
    // D-CLEAN (Vorschau + Confirm): das Anker-KO ist aus der Zielmenge AUSGESCHLOSSEN und wird
    // in Vorschau UND Bilanz ehrlich beziffert; der geclaimte Kandidat überlebt die Queue-Phase.
    const runner = ctx.restart();
    const preview = await runner.importCleanupPreview();
    expect(preview.claimedKos).toBe(1);
    expect(preview.importedKos).toBe(0); // die Zielmenge enthält das geschützte KO NICHT
    const result = await runner.runImportCleanup("admin", preview.digest);
    expect(result.trashedKos).toBe(0);
    expect(result.claimedKos).toBe(1);
    expect(result.skipped).toContainEqual({ id, reason: "in Bearbeitung" });
    // KEIN Reset, KEIN Trash: das Anker-KO lebt, der Claim steht unverändert.
    expect((await ctx.koService.list()).some((k) => k.importCandidateId === id)).toBe(true);
    expect((await ctx.candidates.findById(id))?.status).toBe("in_bearbeitung");
    // Recovery nach Lease-Ablauf VOLLENDET mit dem lebenden KO — kein Doppel-KO.
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await runner.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    expect(after?.koId).toBeTruthy();
    expect(
      (await ctx.koService.list()).filter((k) =>
        (k.sources ?? []).some((s) => s.externalId === "P1"),
      ),
    ).toHaveLength(1);
  });

  it("ROT-1C Trash-Vertrag: Stempel-KO liegt im PAPIERKORB → Recovery vollendet mit Verweis, KEIN neues KO", async () => {
    const ctx = harness();
    const id = await claimWithStampedKo(ctx);
    // Alt-/Randzustand: das Stempel-KO wurde (z. B. von einem Lauf VOR dem 1C-Ausschluss)
    // getrasht — die Trash-Entscheidung bleibt beim Cleanup, die Recovery legt NIE neu an.
    const stamped = await ctx.koService.findByImportCandidateId(id);
    expect(stamped).toBeDefined();
    const stampedId = (stamped as { id: string }).id;
    await ctx.koService.delete(stampedId, "admin", { forceTrash: true });
    expect(await ctx.koService.get(stampedId)).toBeUndefined(); // lebende Sicht: weg
    // Recovery: Anker-Suche INKLUSIVE Papierkorb → Vollendung mit Verweis auf das getrashte KO.
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await ctx.restart().recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    expect(after?.koId).toBe(stampedId);
    // KEIN neues KO — weder lebend noch als zweiter Anker-Träger; ein Re-Accept ist abgewiesen.
    expect((await ctx.koService.list()).filter((k) => k.title === anchorItem().title)).toHaveLength(
      0,
    );
    expect((await ctx.koService.findByImportCandidateId(id))?.id).toBe(stampedId);
    await expect(ctx.restart().reviewImportCandidate(id, "accept", "rev-1")).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
    });
  });
});
