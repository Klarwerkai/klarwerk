// WP-SHIP8-CLOSE-3 (bens ROT-1 + ROT-2): der Review-Claim ist crash-sicher und bleibt Teil des
// offenen Idempotenzraums.
//
// ROT-1 (Lease/opId-Recovery): jeder Claim persistiert opId + claimedAt; der Accept stempelt die
// opId ans NEU erzeugte KO (importOpId), BEVOR der Endstatus geschrieben wird. Die Recovery
// (recoverStaleReviewClaims, lazy am Queue-Load) prüft nach Lease-Ablauf: KO mit dieser opId
// vorhanden → Operation VOLLENDEN (angenommen + koId, Audit recovered:true); keines → Claim
// sicher auf 'neu' zurückgeben. Crash-Snapshots per Gate-Abbruch + NEUEM Service-Durchlauf auf
// DEMSELBEN Repo-Zustand — der hängende Erst-Fluss wird nie fortgesetzt (kein Abwarten).
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
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
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
  it("(a) Abbruch NACH Claim, VOR KO-Erzeugung → Recovery gibt auf 'neu' zurück; Retry erzeugt GENAU EIN KO", async () => {
    const ctx = harness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Pumpe", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // Gate: die KO-Anlage hängt für immer — der Fluss ist IN acceptToKo abgebrochen, das KO
    // existiert noch nicht. Der Erst-Fluss wird nie fortgesetzt (Crash-Simulation).
    const origCreate = ctx.koService.create.bind(ctx.koService);
    let createStarted = false;
    (ctx.koService as { create: KoCreate }).create = () => {
      createStarted = true;
      return new Promise(() => {});
    };
    ctx.library.reviewImportCandidate(id, "accept", "rev-1").catch(() => {});
    await vi.waitFor(() => {
      expect(createStarted).toBe(true);
    });
    const during = await ctx.candidates.findById(id);
    expect(during?.status).toBe("in_bearbeitung");
    expect(during?.opId).toBeTruthy();

    // Lease NOCH NICHT abgelaufen → die Recovery fasst einen LAUFENDEN Claim nie an.
    const fresh = ctx.restart();
    expect(await fresh.recoverStaleReviewClaims()).toEqual({ completed: 0, released: 0 });
    expect((await ctx.candidates.findById(id))?.status).toBe("in_bearbeitung");

    // „Neustart" nach Lease-Ablauf: kein KO mit dieser opId → Claim sicher auf 'neu' zurück.
    (ctx.koService as { create: KoCreate }).create = origCreate;
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    const recovered = ctx.restart();
    expect(await recovered.recoverStaleReviewClaims()).toEqual({ completed: 0, released: 1 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("neu");
    expect(after?.opId).toBeUndefined();
    expect(after?.claimedAt).toBeUndefined();
    // Kein stiller Erfolg: KEIN KO entstanden.
    expect((await ctx.koService.list()).map((k) => k.title)).not.toContain("Pumpe");

    // Retry gelingt normal — GENAU EIN KO.
    const reviewed = await recovered.reviewImportCandidate(id, "accept", "rev-1");
    expect(reviewed.status).toBe("angenommen");
    expect((await ctx.koService.list()).filter((k) => k.title === "Pumpe")).toHaveLength(1);
  });

  it("(b) Abbruch NACH KO-Erzeugung, VOR Endstatus → Recovery VOLLENDET (kein blindes Reset, kein Doppel-KO)", async () => {
    const ctx = harness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Ventil", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // Gate: der Endstatus-Write (resolveClaim) hängt für immer — die KO-Anlage ist da bereits
    // GELUNGEN (mit opId-Stempel), nur der Abschluss fehlt. Exakt bens kritisches Fenster:
    // ein blindes Reset auf 'neu' würde beim Retry ein ZWEITES KO erzeugen (kein Anker).
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
    // Crash-Zustand: KO existiert (gestempelt), Kandidat hängt ohne Endstatus.
    const created = (await ctx.koService.list()).filter((k) => k.title === "Ventil");
    expect(created).toHaveLength(1);
    expect(created[0]?.importOpId).toBe((await ctx.candidates.findById(id))?.opId);
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
