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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  importStatusFor,
  importedAnchorVersions,
  pendingCandidateVersions,
} from "../../services/app/src/confluence-import";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
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

// PRODUKTIONSVERDRAHTUNG (wie build-app): EIN gemeinsamer Auditdienst für KoService UND
// LibraryService + echtes Versions-Repo. Fehler werden gezielt injiziert und können HEILEN —
// damit prüfen die Tests den BESTAND (v1-Snapshot, ko.created), nicht nur den Fehlerwurf.
// (Modulweit: CLOSE-5 UND CLOSE-6 testen auf derselben Harness.)
function sideEffectHarness() {
  const clock = { nowMs: T0 };
  const faults = {
    snapshotFailOnce: false,
    // WP-SHIP8-CLOSE-6 (ROT-2): dauerhaft werfender Snapshot-Store — heilbar per false.
    snapshotFailAlways: false,
    auditFailOnceActions: new Set<string>(),
    // "*" = jede Aktion (Auditdienst komplett ausgefallen); heilbar per clear().
    auditFailAlwaysActions: new Set<string>(),
  };
  const versionsRepo = new InMemoryKoVersionRepo();
  const versions: KoVersionRepo = {
    append: async (snapshot) => {
      if (faults.snapshotFailAlways) {
        throw new Error("SnapshotDown");
      }
      if (faults.snapshotFailOnce) {
        faults.snapshotFailOnce = false;
        throw new Error("SnapshotDown");
      }
      return versionsRepo.append(snapshot);
    },
    listByKo: (koId) => versionsRepo.listByKo(koId),
    remove: (koId, version) => versionsRepo.remove(koId, version),
  };
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const auditFaultArmed = (action: string): boolean =>
    faults.auditFailAlwaysActions.has("*") ||
    faults.auditFailAlwaysActions.has(action) ||
    faults.auditFailOnceActions.delete(action);
  const origRecord = audit.record.bind(audit);
  (audit as { record: AuditService["record"] }).record = async (entry, tx) => {
    if (auditFaultArmed(entry.action)) {
      throw new Error("AuditDown");
    }
    return origRecord(entry, tx);
  };
  // WP-SHIP8-CLOSE-6: create/ensure/Abschluss-Audit laufen jetzt über recordOnce — die
  // Fehlerinjektion MUSS auch diese Fläche treffen, sonst wären die Fault-Tests vakuos.
  const origRecordOnce = audit.recordOnce.bind(audit);
  (audit as { recordOnce: AuditService["recordOnce"] }).recordOnce = async (eventId, input, tx) => {
    if (auditFaultArmed(input.action)) {
      throw new Error("AuditDown");
    }
    return origRecordOnce(eventId, input, tx);
  };
  const koService = new KoService({ repo: new InMemoryKoRepo(), versions, audit });
  const candidates = new InMemoryCandidateRepo();
  const library = new LibraryService({
    koService,
    candidates,
    audit,
    externalUpsert: true,
    now: () => clock.nowMs,
  });
  return { clock, faults, versionsRepo, audit, koService, candidates, library };
}

describe("WP-SHIP8-CLOSE-5 ROT-1A: kein halber KO-Zustand — Belege werden fail-closed nachgezogen", () => {
  it("Snapshot wirft (transient) → Adoption zieht nach: v1-Snapshot + ko.created NACHWEISLICH da, genau EIN KO", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Filter", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    ctx.faults.snapshotFailOnce = true; // create: Insert ok → Snapshot wirft → Audit läuft nie
    const reviewed = await ctx.library.reviewImportCandidate(id, "accept", "rev-1");
    expect(reviewed.status).toBe("angenommen");
    const koId = reviewed.koId as string;
    // BESTAND, nicht nur Behauptung: der Version-1-Snapshot existiert (als Nachzug markiert) …
    const snapshots = await ctx.versionsRepo.listByKo(koId);
    expect(snapshots.filter((s) => s.version === 1)).toHaveLength(1);
    expect(snapshots[0]?.note).toBe("erstellt (nachgezogen)");
    expect(snapshots[0]?.snapshot.title).toBe("Filter");
    // … und ko.created + der Abschluss-Audit sind da.
    expect(await ctx.audit.list({ action: "ko.created", target: koId })).toHaveLength(1);
    expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(1);
    // Eindeutiger Kandidat, genau EIN KO.
    expect((await ctx.candidates.findById(id))?.status).toBe("angenommen");
    expect((await ctx.koService.list()).filter((k) => k.title === "Filter")).toHaveLength(1);
  });

  it("ko.created wirft (transient) → Adoption zieht nach: Snapshot aus create bleibt, ko.created nachweislich da", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Ventil", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    ctx.faults.auditFailOnceActions.add("ko.created"); // create: Insert + Snapshot ok → Audit wirft
    const reviewed = await ctx.library.reviewImportCandidate(id, "accept", "rev-1");
    expect(reviewed.status).toBe("angenommen");
    const koId = reviewed.koId as string;
    // Der ORIGINAL-Snapshot aus create steht (kein Nachzug nötig) …
    const snapshots = await ctx.versionsRepo.listByKo(koId);
    expect(snapshots.filter((s) => s.version === 1)).toHaveLength(1);
    expect(snapshots[0]?.note).toBe("erstellt");
    // … ko.created wurde nachgezogen, der Abschluss-Audit steht, genau EIN KO.
    expect(await ctx.audit.list({ action: "ko.created", target: koId })).toHaveLength(1);
    expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(1);
    expect((await ctx.candidates.findById(id))?.status).toBe("angenommen");
    expect((await ctx.koService.list()).filter((k) => k.title === "Ventil")).toHaveLength(1);
  });

  it("Auditdienst KOMPLETT ausgefallen → FAIL-CLOSED (kein angenommen ohne Belege); nach Heilung vollendet die Recovery MIT Belegen", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Pumpe", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    ctx.faults.auditFailAlwaysActions.add("*");
    // Accept scheitert EHRLICH: KO + Snapshot existieren, aber ko.created ist nicht belegbar —
    // der Claim bleibt fail-closed stehen (kein halber, als angenommen deklarierter Zustand).
    await expect(ctx.library.reviewImportCandidate(id, "accept", "rev-1")).rejects.toBeDefined();
    const during = await ctx.candidates.findById(id);
    expect(during?.status).toBe("in_bearbeitung");
    expect(during?.opId).toBeTruthy();
    const stamped = await ctx.koService.findByImportCandidateId(id);
    expect(stamped).toBeDefined();
    expect(
      await ctx.audit.list({ action: "ko.created", target: (stamped as { id: string }).id }),
    ).toHaveLength(0);
    // HEILUNG + Lease-Ablauf: die Recovery zieht die Belege nach und vollendet erst dann.
    ctx.faults.auditFailAlwaysActions.clear();
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await ctx.library.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    expect(after?.koId).toBe((stamped as { id: string }).id);
    // Belege VOLLSTÄNDIG: v1-Snapshot (aus create), ko.created (nachgezogen), Recovery-Audit.
    const koId = (stamped as { id: string }).id;
    expect((await ctx.versionsRepo.listByKo(koId)).filter((s) => s.version === 1)).toHaveLength(1);
    expect(await ctx.audit.list({ action: "ko.created", target: koId })).toHaveLength(1);
    const accepts = await ctx.audit.list({ action: "import.candidate-accept", target: id });
    expect(accepts).toHaveLength(1);
    expect(accepts[0]?.payload).toMatchObject({ koId, recovered: true });
    expect((await ctx.koService.list()).filter((k) => k.title === "Pumpe")).toHaveLength(1);
  });

  it("bens Konsistenz-Punkt: NUR der äußere import.candidate-accept-Audit wirft → Antwort bleibt ERFOLG + lauter Log", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const ctx = sideEffectHarness();
      const [cand] = await ctx.library.createImportCandidates(
        [{ title: "Dichtung", statement: "s", type: "best_practice", category: "K" }],
        "tester",
      );
      const id = (cand as { id: string }).id;
      ctx.faults.auditFailAlwaysActions.add("import.candidate-accept");
      // KEIN Fehler nach außen: Statuswechsel + harte Belege sind persistiert; nur das
      // Aktionsprotokoll fehlt — laut geloggt statt angenommen-aber-Fehlerantwort.
      const reviewed = await ctx.library.reviewImportCandidate(id, "accept", "rev-1");
      expect(reviewed.status).toBe("angenommen");
      const koId = reviewed.koId as string;
      expect((await ctx.candidates.findById(id))?.status).toBe("angenommen");
      expect(await ctx.audit.list({ action: "ko.created", target: koId })).toHaveLength(1);
      expect((await ctx.versionsRepo.listByKo(koId)).filter((s) => s.version === 1)).toHaveLength(
        1,
      );
      expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(
        0,
      );
      const logged = warnSpy.mock.calls.some((call) =>
        String(call[0]).includes("Abschluss-Audit der Review-Aktion fehlgeschlagen"),
      );
      expect(logged).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("bens Negativtest: Anker-Lookup wirft ZWEIMAL (acceptToKo + äußerer Catch) → Claim bleibt in_bearbeitung, Fehler nach außen", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Sensor", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    let lookupCalls = 0;
    (
      ctx.koService as { findByImportCandidateId: KoService["findByImportCandidateId"] }
    ).findByImportCandidateId = async () => {
      lookupCalls += 1;
      throw new Error("LookupDown");
    };
    await expect(ctx.library.reviewImportCandidate(id, "accept", "rev-1")).rejects.toThrow(
      "LookupDown",
    );
    // BEIDE Lookup-Stellen liefen (Vorab-Adoption in acceptToKo + äußerer Catch) und scheiterten.
    expect(lookupCalls).toBe(2);
    // FAIL-CLOSED: kein Reset auf 'neu', der Claim steht sichtbar; kein KO entstanden.
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("in_bearbeitung");
    expect(after?.opId).toBeTruthy();
    expect((await ctx.koService.list()).filter((k) => k.title === "Sensor")).toHaveLength(0);
  });
});

// ---- WP-SHIP8-CLOSE-6 (bens sammel33): Beleg-Kanten — exactly-once, Re-Sync-Vollendung, ----
// ---- unverlierbarer Review-Aktionsbeleg. Alles auf der PRODUKTIONS-Harness von CLOSE-5.  ----

describe("WP-SHIP8-CLOSE-6 ROT-1: ko.created atomar GENAU EINMAL (paralleler Nachzug)", () => {
  it("bens Pflichttest: zwei Nachzüge passieren eine Barriere NACH leerem Read und schreiben parallel → exakt EIN ko.created-Eintrag", async () => {
    const ctx = sideEffectHarness();
    // Teilpersistenz herstellen: create legt KO + v1-Snapshot an, der ko.created-Beleg wirft.
    ctx.faults.auditFailOnceActions.add("ko.created");
    await expect(
      ctx.koService.create({
        title: "Kompressor",
        statement: "s",
        type: "best_practice",
        category: "K",
        author: "a",
      }),
    ).rejects.toBeDefined();
    const [ko] = await ctx.koService.list();
    if (!ko) {
      throw new Error("Testaufbau: teilpersistiertes KO fehlt");
    }
    expect(await ctx.audit.list({ action: "ko.created", target: ko.id })).toHaveLength(0);
    // BARRIERE hinter dem Vorab-Read: BEIDE Nachzüge sehen den leeren Bestand, bevor einer
    // schreibt — genau das Query-then-Write-Race, das früher doppelte Belege erzeugte.
    const origList = ctx.audit.list.bind(ctx.audit);
    let reads = 0;
    let releaseBoth: () => void = () => {};
    const bothRead = new Promise<void>((r) => {
      releaseBoth = r;
    });
    (ctx.audit as { list: AuditService["list"] }).list = async (filter = {}) => {
      const result = await origList(filter);
      if (filter.action === "ko.created" && reads < 2) {
        reads += 1;
        if (reads === 2) {
          releaseBoth();
        }
        await bothRead;
      }
      return result;
    };
    await Promise.all([
      ctx.koService.ensureCreatedSideEffects(ko),
      ctx.koService.ensureCreatedSideEffects(ko),
    ]);
    expect(reads).toBe(2);
    // Exactly-once: der persistenzgestützte Guard (recordOnce) entscheidet, nicht der Read.
    expect(await ctx.audit.list({ action: "ko.created", target: ko.id })).toHaveLength(1);
    expect(await ctx.audit.verify()).toBe(true);
    // Der v1-Snapshot aus create blieb einmalig (kein Doppel-Nachzug).
    expect((await ctx.versionsRepo.listByKo(ko.id)).filter((s) => s.version === 1)).toHaveLength(1);
  });
});

describe("WP-SHIP8-CLOSE-6 ROT-2: der Re-Sync ist eine Vollendungsstelle", () => {
  it("bens Pflichttest: A bleibt nach Teilpersistenz offen, B (höhere Source-Version) schließt erst mit vollständigen Belegen ab — v1 = Erstanlagezustand, nicht Bs Revision", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const ctx = sideEffectHarness();
      // A: Snapshot-Store dauerhaft kaputt → create-Teilpersistenz (KO da, v1/ko.created fehlen),
      // der Accept bleibt fail-closed stehen (Claim in_bearbeitung).
      const [candA] = await ctx.library.createImportCandidates([anchorItem()], "tester");
      const idA = (candA as { id: string }).id;
      ctx.faults.snapshotFailAlways = true;
      await expect(ctx.library.reviewImportCandidate(idA, "accept", "rev-A")).rejects.toBeDefined();
      expect((await ctx.candidates.findById(idA))?.status).toBe("in_bearbeitung");
      const stamped = await ctx.koService.findByImportCandidateId(idA);
      if (!stamped) {
        throw new Error("Testaufbau: teilpersistiertes KO fehlt");
      }
      const koId = stamped.id;
      expect(await ctx.versionsRepo.listByKo(koId)).toHaveLength(0);
      expect(await ctx.audit.list({ action: "ko.created", target: koId })).toHaveLength(0);

      // B: gleicher Anker (provider+externalId), HÖHERE Source-Version → Re-Sync-Zweig.
      const [candB] = await ctx.library.createImportCandidates(
        [anchorItem({ sourceVersion: 4, statement: "Pumpe alle 100h entlüften (überarbeitet)." })],
        "tester",
      );
      const idB = (candB as { id: string }).id;
      // Solange die Belege NICHT herstellbar sind, schließt B NICHT ab — und weil der Nachzug
      // ZWINGEND VOR der Revision läuft, wurde auch nichts revidiert (Reihenfolge-Beweis).
      await expect(ctx.library.reviewImportCandidate(idB, "accept", "rev-B")).rejects.toBeDefined();
      expect((await ctx.koService.get(koId))?.statement).toBe("Pumpe alle 200h entlüften.");
      expect(await ctx.versionsRepo.listByKo(koId)).toHaveLength(0);
      // Sicher kein neues KO entstanden → Bs Claim wurde ehrlich freigegeben (Retry möglich).
      expect((await ctx.candidates.findById(idB))?.status).toBe("neu");

      // HEILUNG: Bs Accept vollendet — Nachzug (v1 aus dem Erstanlagezustand) VOR der Revision.
      ctx.faults.snapshotFailAlways = false;
      const reviewedB = await ctx.library.reviewImportCandidate(idB, "accept", "rev-B");
      expect(reviewedB.status).toBe("angenommen");
      expect(reviewedB.koId).toBe(koId);
      const v1 = (await ctx.versionsRepo.listByKo(koId)).filter((s) => s.version === 1);
      expect(v1).toHaveLength(1);
      expect(v1[0]?.note).toBe("erstellt (nachgezogen)");
      // v1 trägt As TATSÄCHLICHEN Erstanlagezustand — NICHT Bs Revision.
      expect(v1[0]?.snapshot.statement).toBe("Pumpe alle 200h entlüften.");
      // Die Revision selbst ist danach gelaufen: das Live-KO trägt Bs Stand.
      expect((await ctx.koService.get(koId))?.statement).toBe(
        "Pumpe alle 100h entlüften (überarbeitet).",
      );
      // Belege VOLLSTÄNDIG, genau EIN KO; As offener Claim bleibt unangetastet.
      expect(await ctx.audit.list({ action: "ko.created", target: koId })).toHaveLength(1);
      expect(await ctx.audit.list({ action: "import.candidate-accept", target: idB })).toHaveLength(
        1,
      );
      expect((await ctx.candidates.findById(idA))?.status).toBe("in_bearbeitung");
      expect(await ctx.koService.list()).toHaveLength(1);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("WP-SHIP8-CLOSE-6 ROT-3: Review-Aktionsbeleg darf nicht dauerhaft fehlen", () => {
  // Aufbau: Accept gelingt, NUR das Abschluss-Audit wirft dauerhaft → der Kandidat trägt die
  // persistente auditPending-Markierung. Liefert Kandidaten-Id + Antwort für die Nachzug-Tests.
  async function acceptWithPendingAudit(ctx: ReturnType<typeof sideEffectHarness>) {
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Dichtung", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    ctx.faults.auditFailAlwaysActions.add("import.candidate-accept");
    const reviewed = await ctx.library.reviewImportCandidate(id, "accept", "rev-1");
    ctx.faults.auditFailAlwaysActions.clear();
    return { id, reviewed };
  }

  it("bens Pflichttest: nur das Abschluss-Audit wirft → Erfolg MIT reviewedBy/reviewedAt + auditPending; der Retry erzeugt EXAKT EINEN Beleg und löscht die Markierung", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const ctx = sideEffectHarness();
      const { id, reviewed } = await acceptWithPendingAudit(ctx);
      // (a) Wer/Wann reiste IM Statuswrite mit — unverlierbar, auch in der Antwort.
      expect(reviewed.status).toBe("angenommen");
      expect(reviewed.reviewedBy).toBe("rev-1");
      expect(reviewed.reviewedAt).toBe(new Date(T0).toISOString());
      // (c) die Antwort weist den schwebenden Beleg aus (Muster Cleanup auditFailed).
      expect(reviewed.auditPending?.eventId.startsWith(`import.candidate-accept:${id}:`)).toBe(
        true,
      );
      // (b) die Markierung ist PERSISTENT am Kandidaten (nicht nur in der Antwort) …
      const persisted = await ctx.candidates.findById(id);
      expect(persisted?.reviewedBy).toBe("rev-1");
      expect(persisted?.reviewedAt).toBe(new Date(T0).toISOString());
      expect(persisted?.auditPending).toEqual(reviewed.auditPending);
      expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(
        0,
      );
      // … und der Nachzug (lazy am Queue-Load verdrahtet) erzeugt EXAKT EINEN Beleg.
      expect(await ctx.library.retryPendingReviewAudits()).toBe(1);
      const after = await ctx.candidates.findById(id);
      expect(after?.status).toBe("angenommen");
      expect(after?.auditPending).toBeUndefined();
      const belege = await ctx.audit.list({ action: "import.candidate-accept", target: id });
      expect(belege).toHaveLength(1);
      expect(belege[0]?.payload).toMatchObject({ koId: reviewed.koId, retried: true });
      expect(belege[0]?.eventId).toBe(reviewed.auditPending?.eventId);
      // Ohne Markierung ist der nächste Lauf ein No-op (kein zweiter Beleg).
      expect(await ctx.library.retryPendingReviewAudits()).toBe(0);
      expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(
        1,
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("kein Doppel-Beleg bei PARALLELEM Retry — recordOnce entscheidet, die Markierung endet gelöscht", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const ctx = sideEffectHarness();
      const { id } = await acceptWithPendingAudit(ctx);
      // Zwei Queue-Loads gleichzeitig: beide sehen die Markierung, beide versuchen den Nachzug.
      const [r1, r2] = await Promise.all([
        ctx.library.retryPendingReviewAudits(),
        ctx.library.retryPendingReviewAudits(),
      ]);
      expect(r1 + r2).toBeGreaterThanOrEqual(1);
      expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(
        1,
      );
      expect((await ctx.candidates.findById(id))?.auditPending).toBeUndefined();
      expect(await ctx.audit.verify()).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("Verdrahtungs-Pin: der Queue-Load (GET /api/library/import/candidates) ruft den Beleg-Nachzug auf", () => {
    const routeSource = readFileSync(
      resolve(process.cwd(), "services/app/src/routes/library-routes.ts"),
      "utf8",
    );
    expect(routeSource).toContain("retryPendingReviewAudits");
  });
});

// ---- WP-SHIP8-CLOSE-7 (bens sammel34): auditPending vorbeugend im Statuswrite (ROT-1), ----
// ---- Claim kennt Akteur+Aktion (ROT-2), reviewedAction wirklich persistiert (GELB).     ----

describe("WP-SHIP8-CLOSE-7 ROT-1: auditPending reist VORBEUGEND im selben resolveClaim-CAS", () => {
  it("bens Pflichttest: Crash DIREKT nach resolveClaim, VOR Audit/Clear → Queue-Load erzeugt EXAKT EINEN Beleg (gespeicherte Event-Id) und räumt die Markierung aus dem Statuswrite", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Riemen", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // „Prozessabbruch": das Abschluss-Audit dieses Laufs kehrt NIE zurück — der Lauf stirbt
    // exakt zwischen Statuswrite und recordOnce/Clear (bens Crash-Fenster, das vor CLOSE-7
    // weder Beleg noch Markierung hinterließ).
    const origRecordOnce = ctx.audit.recordOnce.bind(ctx.audit);
    let crashArmed = true;
    (ctx.audit as { recordOnce: AuditService["recordOnce"] }).recordOnce = async (
      eventId,
      input,
      tx,
    ) => {
      if (crashArmed && input.action === "import.candidate-accept") {
        crashArmed = false;
        return new Promise<never>(() => {});
      }
      return origRecordOnce(eventId, input, tx);
    };
    void ctx.library.reviewImportCandidate(id, "accept", "rev-1"); // hängt für immer
    await vi.waitFor(async () => {
      expect((await ctx.candidates.findById(id))?.status).toBe("angenommen");
    });
    // Der EINE Statuswrite trägt bereits ALLES: Endstatus, Wer/Wann/Aktion UND die Markierung.
    const during = await ctx.candidates.findById(id);
    expect(during?.reviewedBy).toBe("rev-1");
    expect(during?.reviewedAction).toBe("accept");
    const marker = during?.auditPending;
    expect(marker?.eventId.startsWith(`import.candidate-accept:${id}:`)).toBe(true);
    expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(0);
    // „Neustart": frische Service-Instanz auf DENSELBEN Repos — der Queue-Load zieht den Beleg
    // über die GESPEICHERTE Event-Id nach (die opId des toten Laufs ist längst ausgeräumt).
    const restarted = new LibraryService({
      koService: ctx.koService,
      candidates: ctx.candidates,
      audit: ctx.audit,
      externalUpsert: true,
      now: () => ctx.clock.nowMs,
    });
    expect(await restarted.retryPendingReviewAudits()).toBe(1);
    const belege = await ctx.audit.list({ action: "import.candidate-accept", target: id });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.eventId).toBe(marker?.eventId);
    expect(belege[0]?.payload).toMatchObject({ retried: true });
    expect((await ctx.candidates.findById(id))?.auditPending).toBeUndefined();
    // Kein Doppel-Beleg: der nächste Load ist ein No-op.
    expect(await restarted.retryPendingReviewAudits()).toBe(0);
    expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(1);
    expect(await ctx.audit.verify()).toBe(true);
  });

  it("Crash NACH gelungenem Audit, VOR dem Clear → der Nachzug räumt die Markierung OHNE Doppel-Beleg (recordOnce meldet false)", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Lager", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // Crash-Punkt diesmal HINTER recordOnce: das bedingte Räumen kehrt nie zurück.
    const origClear = ctx.candidates.clearAuditPending.bind(ctx.candidates);
    let crashArmed = true;
    (
      ctx.candidates as { clearAuditPending: typeof ctx.candidates.clearAuditPending }
    ).clearAuditPending = (cid, eventId) => {
      if (crashArmed) {
        crashArmed = false;
        return new Promise<never>(() => {});
      }
      return origClear(cid, eventId);
    };
    void ctx.library.reviewImportCandidate(id, "accept", "rev-1"); // hängt für immer
    await vi.waitFor(async () => {
      expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(
        1,
      );
    });
    // Beleg da, Markierung noch nicht geräumt — der Queue-Load räumt exactly-once nach.
    expect((await ctx.candidates.findById(id))?.auditPending).toBeTruthy();
    expect(await ctx.library.retryPendingReviewAudits()).toBe(1);
    expect((await ctx.candidates.findById(id))?.auditPending).toBeUndefined();
    expect(await ctx.audit.list({ action: "import.candidate-accept", target: id })).toHaveLength(1);
  });
});

describe("WP-SHIP8-CLOSE-7 ROT-2: der Claim kennt Akteur + Aktion — die Recovery verliert den Reviewer nicht", () => {
  it("bens Pflichttest: Accept von xenia crasht nach KO-Erzeugung → Recovery vollendet mit reviewedBy=xenia (nicht system), Event-Id passt zur geclaimten Aktion", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Kupplung", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // Crash NACH KO-Erzeugung, VOR Endstatus: resolveClaim hängt einmalig (Muster CLOSE-4).
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
    ctx.library.reviewImportCandidate(id, "accept", "xenia").catch(() => {});
    await vi.waitFor(() => {
      expect(intercepted).toBe(true);
    });
    // ROT-2: der Claim trägt den ECHTEN Akteur und die geclaimte Aktion.
    const during = await ctx.candidates.findById(id);
    expect(during?.status).toBe("in_bearbeitung");
    expect(during?.claimedBy).toBe("xenia");
    expect(during?.claimedAction).toBe("accept");
    const opId = during?.opId as string;
    expect(opId).toBeTruthy();

    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await ctx.library.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    // Der ECHTE Reviewer, nicht system — und die Aktion wirklich persistiert (GELB).
    expect(after?.reviewedBy).toBe("xenia");
    expect(after?.reviewedAction).toBe("accept");
    // resolveClaim räumt die Claim-Felder wie bisher aus; die Markierung ist nach dem
    // gelungenen Recovery-Beleg ebenfalls geräumt.
    expect(after?.claimedBy).toBeUndefined();
    expect(after?.claimedAction).toBeUndefined();
    expect(after?.auditPending).toBeUndefined();
    const belege = await ctx.audit.list({ action: "import.candidate-accept", target: id });
    expect(belege).toHaveLength(1);
    // Die Event-Id passt zur GECLAIMTEN Aktion (und zur opId des gecrashten Laufs).
    expect(belege[0]?.eventId).toBe(`import.candidate-accept:${id}:${opId}`);
    expect(belege[0]?.actor).toBe("xenia");
    // Ehrlicher Ausweis der TECHNISCHEN Vollendung im Beleg-Payload.
    expect(belege[0]?.payload).toMatchObject({ recovered: true, recoveredBy: "system" });
    expect(belege[0]?.payload).not.toHaveProperty("reviewerUnknown");
  });

  it("Altclaim-Fallback: Claim ohne claimedBy/claimedAction → Recovery vollendet ehrlich als system MIT Kennzeichnung", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Welle", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    // Altclaim (vor CLOSE-7) direkt am Repo: NUR opId + claimedAt (3-Argumente-Form).
    await ctx.candidates.claim(id, "op-alt", new Date(ctx.clock.nowMs).toISOString());
    // Der Altlauf hatte sein KO bereits materialisiert (gestempelt), dann Crash.
    await ctx.koService.create({
      title: "Welle",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "alt-reviewer",
      importCandidateId: id,
    });
    ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
    expect(await ctx.library.recoverStaleReviewClaims()).toEqual({ completed: 1, released: 0 });
    const after = await ctx.candidates.findById(id);
    expect(after?.status).toBe("angenommen");
    expect(after?.reviewedBy).toBe("system");
    expect(after?.reviewedAction).toBe("accept");
    const belege = await ctx.audit.list({ action: "import.candidate-accept", target: id });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.eventId).toBe(`import.candidate-accept:${id}:op-alt`);
    expect(belege[0]?.actor).toBe("system");
    // Kennzeichnung: der echte Reviewer ist bei Altclaims ehrlich unbekannt.
    expect(belege[0]?.payload).toMatchObject({
      recovered: true,
      recoveredBy: "system",
      reviewerUnknown: true,
    });
  });

  it("defensiv: Stempel-KO vorhanden, aber geclaimt war NICHT accept → Claim bleibt fail-closed stehen (lautes Log)", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const ctx = sideEffectHarness();
      const [cand] = await ctx.library.createImportCandidates(
        [{ title: "Bolzen", statement: "s", type: "best_practice", category: "K" }],
        "tester",
      );
      const id = (cand as { id: string }).id;
      await ctx.candidates.claim(
        id,
        "op-r",
        new Date(ctx.clock.nowMs).toISOString(),
        "rev-1",
        "reject",
      );
      await ctx.koService.create({
        title: "Bolzen",
        statement: "s",
        type: "best_practice",
        category: "K",
        author: "a",
        importCandidateId: id,
      });
      ctx.clock.nowMs += REVIEW_CLAIM_LEASE_MS + 1;
      // Eine Vollendung als „angenommen" würde die geclaimte reject-Entscheidung verfälschen.
      expect(await ctx.library.recoverStaleReviewClaims()).toEqual({ completed: 0, released: 0 });
      expect((await ctx.candidates.findById(id))?.status).toBe("in_bearbeitung");
      const logged = warnSpy.mock.calls.some((call) =>
        String(call[0]).includes("geclaimte Aktion ist reject"),
      );
      expect(logged).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe("WP-SHIP8-CLOSE-7 GELB: reviewedAction wird WIRKLICH persistiert", () => {
  it("auch reject trägt reviewedAction (nicht aus dem Status abgeleitet); Markierung nach gelungenem Beleg geräumt", async () => {
    const ctx = sideEffectHarness();
    const [cand] = await ctx.library.createImportCandidates(
      [{ title: "Feder", statement: "s", type: "best_practice", category: "K" }],
      "tester",
    );
    const id = (cand as { id: string }).id;
    const reviewed = await ctx.library.reviewImportCandidate(id, "reject", "rev-r");
    expect(reviewed.status).toBe("abgelehnt");
    expect(reviewed.reviewedBy).toBe("rev-r");
    expect(reviewed.reviewedAction).toBe("reject");
    // Beleg gelungen → kein Schwebezustand in Antwort UND Bestand.
    expect(reviewed.auditPending).toBeUndefined();
    const persisted = await ctx.candidates.findById(id);
    expect(persisted?.reviewedAction).toBe("reject");
    expect(persisted?.auditPending).toBeUndefined();
    expect(await ctx.audit.list({ action: "import.candidate-reject", target: id })).toHaveLength(1);
  });
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
