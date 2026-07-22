// WP-D-CLEAN (Pedis Entscheid: alle Testdaten löschen, auch Confluence und Jira): der zweistufige
// Admin-Aufräumweg. Vorschau zählt korrekt und verändert NICHTS; confirm löscht GENAU den Umfang
// (Queue komplett leer, Import-KOs mit Confluence-/Jira-Provenienz in den PAPIERKORB, KOs ohne
// Import-Provenienz bleiben unangetastet); Audit-Eintrag mit Zählern; users.manage-Guard.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { IMPORT_CLEANUP_TEXT } from "../../apps/web/src/lib/importCleanup";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KoSource } from "../../services/knowledge-object";
import { InMemoryCandidateRepo } from "../../services/library-analytics";
import { PgCandidateRepo } from "../../services/library-analytics";

function importSource(provider: string, externalId: string): KoSource {
  return {
    id: `src-${provider}-${externalId}`,
    label: `Import aus ${provider}`,
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider,
    externalId,
    sourceVersion: 1,
    author: "importer",
    at: "2026-07-01T00:00:00.000Z",
  };
}

async function cleanupApp() {
  const services = buildServices();
  const app = buildApp(services);
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
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

  // Umfang-Fixture: je ein Confluence- und Jira-Import-KO, ein selbst erstelltes KO, 2 Kandidaten.
  await services.ko.create({
    title: "Aus Confluence importiert",
    statement: "s",
    type: "best_practice",
    category: "K",
    author: "importer",
    sources: [importSource("Confluence", "c1")],
  });
  await services.ko.create({
    title: "Aus Jira importiert",
    statement: "s",
    type: "best_practice",
    category: "K",
    author: "importer",
    sources: [importSource("Jira", "J-1")],
  });
  const own = await services.ko.create({
    title: "Selbst erstellt",
    statement: "s",
    type: "best_practice",
    category: "K",
    author: "pedi",
  });
  await services.library.createImportCandidates(
    [
      { title: "Kandidat 1", statement: "s", type: "best_practice", category: "K" },
      { title: "Kandidat 2", statement: "s", type: "best_practice", category: "K" },
    ],
    "tester",
  );
  return { app, services, headers, ownKoId: own.id };
}

// WP-SHIP8-FIX (bens F2): die Bestätigung braucht den Vorschau-Digest — der Helfer holt ihn frisch.
async function previewDigest(
  app: Awaited<ReturnType<typeof cleanupApp>>["app"],
  headers: Record<string, string>,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/admin/import/cleanup",
    headers,
    payload: {},
  });
  return (res.json() as { digest: string }).digest;
}

describe("WP-D-CLEAN: POST /api/admin/import/cleanup", () => {
  it("VORSCHAU (ohne confirm): zählt korrekt, liefert den bindenden Digest und löscht NICHTS", async () => {
    const { app, services, headers } = await cleanupApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      preview: true,
      candidates: 2,
      importedKos: 2,
      // WP-SHIP8-FIX (bens F2): SHA-256 über die sortierte Zielmenge — bindet die Bestätigung.
      digest: expect.stringMatching(/^[0-9a-f]{64}$/),
      claimedKos: 0,
      auditPendingCandidates: 0,
    });
    // Nichts passiert: Queue und Bestand unverändert, Papierkorb leer.
    expect((await services.library.listImportCandidates()).length).toBe(2);
    expect((await services.ko.list()).length).toBe(3);
    expect(await services.ko.trashed()).toEqual([]);
  });

  it("confirm:true (mit Vorschau-Digest) löscht GENAU den Umfang — Queue leer, Import-KOs im Papierkorb, eigenes KO bleibt", async () => {
    const { app, services, headers, ownKoId } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    // Ehrliche Bilanz.
    expect(res.json()).toEqual({
      preview: false,
      removedCandidates: 2,
      trashedKos: 2,
      skipped: [],
      auditFailed: false,
      newCandidates: 0,
      claimedKos: 0,
      auditPendingCandidates: 0,
    });
    // Queue KOMPLETT leer (jeder Status).
    expect(await services.library.listImportCandidates()).toEqual([]);
    // Nicht-Import-KO bleibt unangetastet; die Import-KOs sind NICHT hart weg, sondern im
    // Papierkorb (bestehende Löschlogik — Original ist heilig, Wiederherstellung möglich).
    const remaining = await services.ko.list();
    expect(remaining.map((k) => k.id)).toEqual([ownKoId]);
    const trashed = await services.ko.trashed();
    expect(trashed.length).toBe(2);
    // Audit-Eintrag mit Zählern (wer/wann kommen vom Audit-Service).
    const audit = await services.audit.list();
    const entry = audit.find((e) => e.action === "import.cleanup");
    expect(entry?.payload).toEqual({
      removedCandidates: 2,
      trashedKos: 2,
      skipped: 0,
      newCandidates: 0,
      claimedKos: 0,
      auditPendingCandidates: 0,
    });
  });

  it("GUARD: ohne users.manage → 403 (nichts passiert)", async () => {
    const { app, services } = await cleanupApp();
    const second = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Normalo", email: "n@x.de", password: "secret123" },
    });
    // Zweitkonto (Rolle experte, KEIN users.manage) freigeben, damit der Login gelingt.
    const admin = (await services.auth.listUsers()).find((u) => u.role === "admin");
    await services.auth.approveUser(
      (second.json() as { id: string }).id,
      (admin as { id: string }).id,
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "n@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
      payload: { confirm: true },
    });
    expect(res.statusCode).toBe(403);
    expect((await services.library.listImportCandidates()).length).toBe(2);
    expect((await services.ko.list()).length).toBe(3);
  });

  it("WP-SHIP8-FIX (bens F2): Drift zwischen Vorschau und confirm → 409 CLEANUP_DRIFT, NICHTS wird gelöscht", async () => {
    const { app, services, headers } = await cleanupApp();
    const staleDigest = await previewDigest(app, headers);
    // Zwischen Vorschau und Bestätigung kommt ein WEITERES Import-KO dazu (Drift der Zielmenge).
    await services.ko.create({
      title: "Nachzügler aus Confluence",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "importer",
      sources: [importSource("Confluence", "c-neu")],
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest: staleDigest },
    });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { error: string }).error).toBe("CLEANUP_DRIFT");
    // NICHTS gelöscht: Queue voll, alle 4 KOs live, Papierkorb leer.
    expect((await services.library.listImportCandidates()).length).toBe(2);
    expect((await services.ko.list()).length).toBe(4);
    expect(await services.ko.trashed()).toEqual([]);
    // confirm GANZ OHNE Digest bindet nichts und wird ebenso abgelehnt.
    const noDigest = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true },
    });
    expect(noDigest.statusCode).toBe(409);
    expect((await services.ko.list()).length).toBe(4);
  });

  it("WP-SHIP8-FIX (bens F1): Soft-Delete wirft MITTEN im Lauf → ehrliche Bilanz, die unwiderrufliche Queue bleibt stehen", async () => {
    const { app, services, headers } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    // Der Soft-Delete des JIRA-KOs scheitert wirklich (nichts wird getrasht) — Injektion am Service.
    const jiraKo = (await services.ko.list()).find((k) => k.title === "Aus Jira importiert");
    const realDelete = services.ko.delete.bind(services.ko);
    services.ko.delete = async (id, actor, opts) => {
      if (id === jiraKo?.id) {
        const err = new Error("Repo nicht erreichbar");
        err.name = "RepoDown";
        throw err;
      }
      return realDelete(id, actor, opts);
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    // Bilanz = echter Endzustand: 1 getrasht, 1 ehrlich übersprungen (Nachlese bestätigt: lebt noch),
    // und die UNWIDERRUFLICHE Queue-Leerung fand NICHT statt (KO-Phase war nicht vollständig gut).
    expect(res.json()).toEqual({
      preview: false,
      removedCandidates: 0,
      trashedKos: 1,
      skipped: [{ id: jiraKo?.id, reason: "RepoDown" }],
      auditFailed: false,
      newCandidates: 0,
      claimedKos: 0,
      auditPendingCandidates: 0,
    });
    expect((await services.library.listImportCandidates()).length).toBe(2);
    expect((await services.ko.list()).map((k) => k.title).sort()).toEqual([
      "Aus Jira importiert",
      "Selbst erstellt",
    ]);
    expect((await services.ko.trashed()).length).toBe(1);
  });

  it("WP-SHIP8-FIX (bens F1, bens Fenster): KO IST im Papierkorb, aber der Audit-Schreiber warf → zählt als trashed, NIE als skipped", async () => {
    const { app, services, headers, ownKoId } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    // Der Audit-Schreiber des Soft-Deletes wirft NACH dem Trash-Write (genau bens Fenster);
    // der Abschluss-Audit (import.cleanup) bleibt intakt.
    const realRecord = services.audit.record.bind(services.audit);
    services.audit.record = async (entry, tx) => {
      if (entry.action === "ko.deleted") {
        throw new Error("Audit-Senke weg");
      }
      return realRecord(entry, tx);
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    // Die Nachlese erkennt: beide KOs sind in Wahrheit im Papierkorb → trashed, skipped LEER —
    // und weil die KO-Phase damit vollständig gut ging, wird auch die Queue geleert.
    expect(res.json()).toEqual({
      preview: false,
      removedCandidates: 2,
      trashedKos: 2,
      skipped: [],
      auditFailed: false,
      newCandidates: 0,
      claimedKos: 0,
      auditPendingCandidates: 0,
    });
    expect(await services.library.listImportCandidates()).toEqual([]);
    expect((await services.ko.trashed()).length).toBe(2);
    expect((await services.ko.list()).map((k) => k.id)).toEqual([ownKoId]);
  });

  it("WP-SHIP8-FIX (bens F1): der ABSCHLUSS-Audit wirft → Antwort bleibt ERFOLG mit auditFailed:true (kein Retry-Provokateur)", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const { app, services, headers } = await cleanupApp();
      const digest = await previewDigest(app, headers);
      const realRecord = services.audit.record.bind(services.audit);
      services.audit.record = async (entry, tx) => {
        if (entry.action === "import.cleanup") {
          throw new Error("Audit-Senke weg");
        }
        return realRecord(entry, tx);
      };
      const res = await app.inject({
        method: "POST",
        url: "/api/admin/import/cleanup",
        headers,
        payload: { confirm: true, digest },
      });
      // Die Mutationen SIND passiert — ein Fehler-Response würde nur einen sinnlosen Retry
      // provozieren. Erfolg + ehrliches auditFailed:true + PII-freies Log.
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        preview: false,
        removedCandidates: 2,
        trashedKos: 2,
        skipped: [],
        auditFailed: true,
        newCandidates: 0,
        claimedKos: 0,
        auditPendingCandidates: 0,
      });
      expect(await services.library.listImportCandidates()).toEqual([]);
      expect((await services.ko.trashed()).length).toBe(2);
      const logged = warnSpy.mock.calls.some((call) =>
        String(call[0]).includes("Cleanup-Abschluss-Audit fehlgeschlagen"),
      );
      expect(logged).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("WP-SHIP8-FIX (bens F2, demoSeed-Kante): ein demoSeed-KO mit Import-Provenienz landet im PAPIERKORB, nie in der Endlöschung", async () => {
    const { app, services, headers } = await cleanupApp();
    const demo = await services.ko.create({
      title: "Demo-Seed aus Confluence",
      statement: "s",
      type: "best_practice",
      category: "K",
      author: "importer",
      demoSeed: true,
      sources: [importSource("Confluence", "c-demo")],
    });
    const digest = await previewDigest(app, headers);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { trashedKos: number }).trashedKos).toBe(3);
    // forceTrash: das demoSeed-KO ist WIEDERHERSTELLBAR im Papierkorb — nicht hart gelöscht.
    const trashed = await services.ko.trashed();
    expect(trashed.map((t) => t.id)).toContain(demo.id);
    const restored = await services.ko.restore(demo.id, "admin");
    expect(restored.id).toBe(demo.id);
  });

  it("WP-NIGHT-FIX (bens F2-TOCTOU): ein ZWISCHEN Digest-Vergleich und Löschung eingereihter Kandidat überlebt", async () => {
    const { app, services, headers } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    // Injektion GENAU im TOCTOU-Fenster: die KO-Phase läuft NACH dem Digest-Vergleich und VOR der
    // Queue-Löschung — der erste Soft-Delete reiht nebenläufig einen NEUEN Kandidaten ein.
    const realDelete = services.ko.delete.bind(services.ko);
    let injected = false;
    services.ko.delete = async (id, actor, opts) => {
      if (!injected) {
        injected = true;
        await services.library.createImportCandidates(
          [{ title: "Parallel eingereiht", statement: "s", type: "best_practice", category: "K" }],
          "parallel",
        );
      }
      return realDelete(id, actor, opts);
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    // Gelöscht wurden EXAKT die 2 BESTÄTIGTEN Ids; der Nachzügler überlebt und wird ehrlich beziffert.
    expect(res.json()).toEqual({
      preview: false,
      removedCandidates: 2,
      trashedKos: 2,
      skipped: [],
      auditFailed: false,
      newCandidates: 1,
      claimedKos: 0,
      auditPendingCandidates: 0,
    });
    const remaining = await services.library.listImportCandidates();
    expect(remaining.map((c) => c.item.title)).toEqual(["Parallel eingereiht"]);
  });

  it("WP-SHIP8-CLOSE (bens F2): CandidateRepo.removeByIds ist BEDINGT — InMemory-Vertrag + Pg-Query-Pin", async () => {
    // InMemory: gelöscht wird NUR bei exakt dem erwarteten Status; unbekannte Ids zählen nicht.
    const repo = new InMemoryCandidateRepo();
    const cand = (id: string, status: "neu" | "angenommen" = "neu") => ({
      id,
      item: { title: id, statement: "s", type: "best_practice" as const, category: "K" },
      status,
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    await repo.insert(cand("a"));
    await repo.insert(cand("b"));
    await repo.insert(cand("c", "angenommen"));
    expect(
      await repo.removeByIds([
        { id: "a", status: "neu" },
        { id: "c", status: "neu" }, // Status hat sich geändert → überlebt
        { id: "gibt-es-nicht", status: "neu" },
      ]),
    ).toEqual(["a"]);
    expect((await repo.all()).map((c) => c.id)).toEqual(["b", "c"]);
    // Pg: EIN bedingtes DELETE — Status-Bedingung IN der Löschung (kein Re-Read-Fenster),
    // RETURNING id als Wahrheit für die Bilanz; leere Liste → kein Query.
    const calls: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return { rowCount: 1, rows: [{ id: "a" }] };
      },
    } as unknown as import("pg").Pool;
    const pg = new PgCandidateRepo(pool);
    expect(
      await pg.removeByIds([
        { id: "a", status: "neu" },
        { id: "c", status: "neu" },
      ]),
    ).toEqual(["a"]);
    expect(calls).toHaveLength(1);
    // WP-SHIP8-CLOSE-8 (bens ROT-1, Pg-Query-Pin): die auditPending-Löschsperre steckt IM
    // DELETE-Statement selbst — kein Vorab-Read, kein Fenster.
    expect(calls[0]?.sql).toBe(
      "DELETE FROM import_candidates c USING unnest($1::text[], $2::text[]) AS erwartet(id, status) WHERE c.id = erwartet.id AND c.data->>'status' = erwartet.status AND c.data->'auditPending' IS NULL RETURNING c.id",
    );
    expect(calls[0]?.params).toEqual([
      ["a", "c"],
      ["neu", "neu"],
    ]);
    expect(await pg.removeByIds([])).toEqual([]);
    expect(calls).toHaveLength(1); // leere Bestätigung → kein DELETE
  });

  it("WP-SHIP8-CLOSE-8 (bens ROT-1): removeByIds löscht NIE einen Kandidaten mit auditPending — Sperre in der Löschbedingung, erst clearAuditPending gibt frei", async () => {
    const repo = new InMemoryCandidateRepo();
    await repo.insert({
      id: "p",
      item: { title: "P", statement: "s", type: "best_practice", category: "K" },
      status: "angenommen",
      duplicate: false,
      note: null,
      koId: "ko-p",
      createdAt: "2026-07-01T00:00:00.000Z",
      auditPending: { eventId: "import.candidate-accept:p:op-1", action: "accept", actor: "rev" },
    });
    // Status passt EXAKT — trotzdem überlebt der Kandidat (einziger Träger des Belegs).
    expect(await repo.removeByIds([{ id: "p", status: "angenommen" }])).toEqual([]);
    expect((await repo.findById("p"))?.auditPending).toBeTruthy();
    // Erst der gelungene Beleg-Nachzug (bedingtes Räumen) gibt die Löschung frei.
    expect(await repo.clearAuditPending("p", "import.candidate-accept:p:op-1")).toBe(true);
    expect(await repo.removeByIds([{ id: "p", status: "angenommen" }])).toEqual(["p"]);
    expect(await repo.findById("p")).toBeUndefined();
  });

  it("WP-SHIP8-CLOSE-2/3 (bens F1/ROT-1): claim ist ein atomarer Lease-CAS, resolveClaim ein opId-CAS; update behandelt 0 Zeilen als KONFLIKT", async () => {
    const repo = new InMemoryCandidateRepo();
    const cand = (id: string) => ({
      id,
      item: { title: id, statement: "s", type: "best_practice" as const, category: "K" },
      status: "neu" as const,
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
    await repo.insert(cand("a"));
    // CAS greift nur bei Status "neu"; Rückgabe ist der Stand NACH dem Claim (inkl. Lease).
    const claimed = await repo.claim("a", "op-1", "2026-07-22T06:00:00.000Z");
    expect(claimed?.status).toBe("in_bearbeitung");
    expect(claimed?.opId).toBe("op-1");
    expect(claimed?.claimedAt).toBe("2026-07-22T06:00:00.000Z");
    expect(await repo.claim("a", "op-2", "2026-07-22T06:00:01.000Z")).toBeUndefined(); // schon geclaimt
    expect(await repo.claim("fehlt", "op-3", "2026-07-22T06:00:02.000Z")).toBeUndefined();
    // DER SCHUTZ: das bedingte Delete (erwarteter Status "neu") trifft den Geclaimten nicht mehr.
    expect(await repo.removeByIds([{ id: "a", status: "neu" }])).toEqual([]);
    expect((await repo.all()).map((c) => c.id)).toEqual(["a"]);
    // resolveClaim ist an die EIGENE opId gebunden — eine fremde Operation greift nie.
    expect(await repo.resolveClaim("a", "op-fremd", { status: "neu" })).toBeUndefined();
    // Claim-Rückgabe (Fehlerpfad ohne KO): CAS zurück auf "neu", Lease ausgeräumt.
    const releasedBack = await repo.resolveClaim("a", "op-1", { status: "neu" });
    expect(releasedBack?.status).toBe("neu");
    expect(releasedBack?.opId).toBeUndefined();
    expect(releasedBack?.claimedAt).toBeUndefined();
    // Abschluss mit Endstatus + koId (Vollendungs-Pfad der Recovery).
    await repo.claim("a", "op-4", "2026-07-22T06:01:00.000Z");
    const done = await repo.resolveClaim("a", "op-4", { status: "angenommen", koId: "ko-9" });
    expect(done?.status).toBe("angenommen");
    expect(done?.koId).toBe("ko-9");
    expect(done?.opId).toBeUndefined();
    // Nach dem Abschluss greift der opId-CAS nicht mehr (kein Doppel-Abschluss).
    expect(await repo.resolveClaim("a", "op-4", { status: "neu" })).toBeUndefined();
    // update auf verschwundener Zeile → CONFLICT, kein stilles Wieder-Anlegen.
    await repo.removeAll();
    await expect(repo.update(cand("a"))).rejects.toMatchObject({ code: "CONFLICT" });

    // Pg-Query-Pins: Claim + Abschluss sind je EIN bedingtes UPDATE mit RETURNING (CAS auf
    // Status bzw. Status+opId, Lease-Felder werden ausgeräumt); update prüft den rowCount.
    const calls: { sql: string; params: unknown[] }[] = [];
    let updateRowCount = 1;
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return sql.includes("RETURNING data")
          ? { rowCount: 1, rows: [{ data: cand("a") }] }
          : { rowCount: updateRowCount, rows: [] };
      },
    } as unknown as import("pg").Pool;
    const pg = new PgCandidateRepo(pool);
    // WP-SHIP8-CLOSE-7 (bens ROT-2): der Claim-Patch reist als EIN jsonb-Parameter — Altaufrufer
    // (3 Argumente) schreiben nur das Lease-Protokoll, neue Aufrufer zusätzlich claimedBy/-Action.
    await pg.claim("a", "op-1", "2026-07-22T06:00:00.000Z");
    expect(calls[0]?.sql).toBe(
      "UPDATE import_candidates SET data = data || $2::jsonb WHERE id=$1 AND data->>'status'='neu' RETURNING data",
    );
    expect(calls[0]?.params).toEqual([
      "a",
      '{"status":"in_bearbeitung","opId":"op-1","claimedAt":"2026-07-22T06:00:00.000Z"}',
    ]);
    await pg.claim("a", "op-1", "2026-07-22T06:00:00.000Z", "rev-x", "accept");
    expect(calls[1]?.params).toEqual([
      "a",
      '{"status":"in_bearbeitung","opId":"op-1","claimedAt":"2026-07-22T06:00:00.000Z","claimedBy":"rev-x","claimedAction":"accept"}',
    ]);
    await pg.resolveClaim("a", "op-1", { status: "angenommen", koId: "ko-9" });
    expect(calls[2]?.sql).toBe(
      "UPDATE import_candidates SET data = (data - 'opId' - 'claimedAt' - 'claimedBy' - 'claimedAction') || $3::jsonb WHERE id=$1 AND data->>'status'='in_bearbeitung' AND data->>'opId'=$2 RETURNING data",
    );
    expect(calls[2]?.params).toEqual(["a", "op-1", '{"status":"angenommen","koId":"ko-9"}']);
    // WP-SHIP8-CLOSE-7 (bens ROT-1): das bedingte Räumen der Markierung ist EIN Statement,
    // gebunden an die exakte eventId — nie ein fremder/neuerer Marker.
    await pg.clearAuditPending("a", "ev-1");
    expect(calls[3]?.sql).toBe(
      "UPDATE import_candidates SET data = data - 'auditPending' WHERE id=$1 AND data->'auditPending'->>'eventId'=$2 RETURNING id",
    );
    expect(calls[3]?.params).toEqual(["a", "ev-1"]);
    await pg.update(cand("a")); // 1 Zeile getroffen → ok
    updateRowCount = 0;
    await expect(pg.update(cand("a"))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("WP-SHIP8-CLOSE (bens F2): Accept GENAU zwischen Re-Read und Delete → Kandidat überlebt, Bilanz ehrlich", async () => {
    const { app, services, headers } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    const candidates = await services.library.listImportCandidates();
    const acceptId = (candidates[0] as { id: string }).id;
    // Gate im Fake-Repo NACH dem Re-Read-Hook: der Cleanup liest die Queue im Vorab-Beleg-Retry
    // (all #1, WP-SHIP8-CLOSE-8), in der Zielermittlung (all #2) und als Vorab-Bilanz der
    // Delete-Phase (all #3) — der Accept landet EXAKT nach diesem letzten Re-Read und VOR
    // removeByIds (bens Restfenster).
    const candidatesRepo = (
      services.library as unknown as {
        candidates: { all: () => Promise<unknown[]> };
      }
    ).candidates;
    const originalAll = candidatesRepo.all.bind(candidatesRepo);
    let allCalls = 0;
    let injected = false;
    candidatesRepo.all = async () => {
      const result = await originalAll();
      allCalls += 1;
      if (allCalls === 3 && !injected) {
        injected = true;
        await services.library.reviewImportCandidate(acceptId, "accept", "reviewer-1");
      }
      return result;
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      removedCandidates: number;
      skipped: { id: string; reason: string }[];
    };
    // Die WAHRHEIT ist das bedingte Delete: der frisch angenommene Kandidat überlebt.
    expect(body.removedCandidates).toBe(1);
    expect(body.skipped).toContainEqual({ id: acceptId, reason: "zwischenzeitlich angenommen" });
    const remaining = await services.library.listImportCandidates();
    expect(remaining.map((c) => (c as { id: string }).id)).toEqual([acceptId]);
    expect((remaining[0] as { status: string }).status).toBe("angenommen");
    // Das per Accept entstandene KO lebt.
    expect((await services.ko.list()).map((k) => k.title)).toContain("Kandidat 1");
  });

  it("WP-SHIP8-CLOSE-2 (bens F1, Testauflage exakt): Accept HÄNGT in acceptToKo, das Cleanup-Delete läuft parallel → der Claim schützt den Kandidaten", async () => {
    const { app, services, headers } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    const candidates = await services.library.listImportCandidates();
    const acceptId = (candidates[0] as { id: string }).id;
    // Gate INNERHALB des Accept-Flusses, VOR der Endstatus-Persistenz: der KO-Create (Teil von
    // acceptToKo) blockiert, bis der Cleanup-Confirm KOMPLETT gelaufen ist. Der Accept wird
    // bewusst NICHT abgewartet (bens Auflage: kein Test, der den Accept erst abschließt) —
    // genau bens Restfenster: die DB kennt den Endstatus "angenommen" noch nicht.
    let releaseCreate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });
    let gateReached = false;
    const origCreate = services.ko.create.bind(services.ko);
    (services.ko as { create: typeof services.ko.create }).create = async (input) => {
      if (input.title === "Kandidat 1") {
        gateReached = true;
        await gate;
      }
      return origCreate(input);
    };
    const acceptPromise = services.library.reviewImportCandidate(acceptId, "accept", "reviewer-1");
    await vi.waitFor(() => {
      expect(gateReached).toBe(true);
    });
    // WÄHREND der Accept in acceptToKo hängt, ist der Kandidat storage-seitig geclaimt —
    // jetzt läuft der Confirm mit dem bedingten removeByIds-Delete.
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      removedCandidates: number;
      skipped: { id: string; reason: string }[];
    };
    // Der geclaimte Kandidat ÜBERLEBT (Claim war zur Bestätigungszeit sichtbar → nie löschbar);
    // nur der unberührte zweite Kandidat wurde entfernt. Bilanz ehrlich.
    expect(body.removedCandidates).toBe(1);
    expect(body.skipped).toContainEqual({ id: acceptId, reason: "in Bearbeitung" });
    const during = await services.library.listImportCandidates();
    expect(during.map((c) => (c as { id: string }).id)).toEqual([acceptId]);
    expect((during[0] as { status: string }).status).toBe("in_bearbeitung");
    // Accept freigeben: er endet NORMAL — KO erzeugt, Endstatus+koId persistiert, nichts verloren.
    releaseCreate();
    const reviewed = await acceptPromise;
    expect(reviewed.status).toBe("angenommen");
    expect(reviewed.koId).toBeTruthy();
    const remaining = await services.library.listImportCandidates();
    expect((remaining[0] as { status: string }).status).toBe("angenommen");
    expect((await services.ko.list()).map((k) => k.title)).toContain("Kandidat 1");
  });

  it("WP-SHIP8-CLOSE-8 (bens ROT-1, Pflichttest): Kandidat mit auditPending ÜBERLEBT den bestätigten Cleanup (Delete-Bedingung); nach gelungenem Beleg-Nachzug räumt der NÄCHSTE Lauf ihn ab", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const { app, services, headers } = await cleanupApp();
      const candidates = await services.library.listImportCandidates();
      const pendingId = (candidates[0] as { id: string }).id;
      // Status-CAS mit Pending: der Accept gelingt, NUR das Abschluss-Audit wirft dauerhaft →
      // der Kandidat ist angenommen und traegt die vorbeugende Markierung aus dem Statuswrite.
      const origRecordOnce = services.audit.recordOnce.bind(services.audit);
      let auditDown = true;
      (services.audit as { recordOnce: typeof services.audit.recordOnce }).recordOnce = async (
        eventId,
        input,
        tx,
      ) => {
        if (auditDown && input.action === "import.candidate-accept") {
          throw new Error("AuditDown");
        }
        return origRecordOnce(eventId, input, tx);
      };
      const reviewed = await services.library.reviewImportCandidate(pendingId, "accept", "rev-1");
      expect(reviewed.status).toBe("angenommen");
      expect(reviewed.auditPending).toBeTruthy();

      // Vorschau beziffert den schwebenden Beleg ehrlich (der Vorab-Retry des Runs wirft noch).
      const preview = await app.inject({
        method: "POST",
        url: "/api/admin/import/cleanup",
        headers,
        payload: {},
      });
      const previewBody = preview.json() as { digest: string; auditPendingCandidates: number };
      expect(previewBody.auditPendingCandidates).toBe(1);

      // Bestätigter Cleanup: der Pending-Kandidat ÜBERLEBT — die Sperre sitzt IM bedingten
      // DELETE (kein Vorab-Read filtert ihn; sein Status 'angenommen' passt ja exakt).
      const run = await app.inject({
        method: "POST",
        url: "/api/admin/import/cleanup",
        headers,
        payload: { confirm: true, digest: previewBody.digest },
      });
      expect(run.statusCode).toBe(200);
      const runBody = run.json() as {
        removedCandidates: number;
        skipped: { id: string; reason: string }[];
        auditPendingCandidates: number;
      };
      expect(runBody.removedCandidates).toBe(1); // nur Kandidat 2 fiel
      expect(runBody.auditPendingCandidates).toBe(1);
      // Kein skipped-Eintrag für den Träger (Muster claimedKos) — er zählt über das eigene Feld.
      expect(runBody.skipped).toEqual([]);
      const survived = await services.library.listImportCandidates();
      expect(survived.map((c) => (c as { id: string }).id)).toEqual([pendingId]);
      expect((survived[0] as { auditPending?: unknown }).auditPending).toBeTruthy();
      expect(await services.audit.list({ action: "import.candidate-accept" })).toHaveLength(0);

      // HEILUNG: der nächste Lauf zieht den Beleg im Vorab-Retry exactly-once nach — erst
      // DANN gibt das DELETE den Kandidaten frei.
      auditDown = false;
      const digest2 = await previewDigest(app, headers);
      const run2 = await app.inject({
        method: "POST",
        url: "/api/admin/import/cleanup",
        headers,
        payload: { confirm: true, digest: digest2 },
      });
      expect(run2.statusCode).toBe(200);
      const run2Body = run2.json() as {
        removedCandidates: number;
        auditPendingCandidates: number;
      };
      expect(run2Body.removedCandidates).toBe(1);
      expect(run2Body.auditPendingCandidates).toBe(0);
      expect(await services.library.listImportCandidates()).toEqual([]);
      // Der Beleg existiert GENAU EINMAL (recordOnce; der Kandidat durfte erst danach fallen).
      const belege = await services.audit.list({ action: "import.candidate-accept" });
      expect(belege).toHaveLength(1);
      expect(belege[0]?.payload).toMatchObject({ retried: true });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("WP-SHIP8-CLOSE-8 (bens GELB-2): Kandidaten-Ausgabe ist ein DTO — keine Lease-/Claim-Felder, keine Beleg-Interna, auditPending nur als Boolean", async () => {
    const warnSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const { app, services, headers } = await cleanupApp();
      const candidates = await services.library.listImportCandidates();
      const pendingId = (candidates[0] as { id: string }).id;
      const otherId = (candidates[1] as { id: string }).id;
      // Ein Kandidat mit SCHWEBENDEM Beleg (Audit dauerhaft down) — der interessante Fall.
      const origRecordOnce = services.audit.recordOnce.bind(services.audit);
      (services.audit as { recordOnce: typeof services.audit.recordOnce }).recordOnce = async (
        eventId,
        input,
        tx,
      ) => {
        if (input.action === "import.candidate-accept") {
          throw new Error("AuditDown");
        }
        return origRecordOnce(eventId, input, tx);
      };
      await services.library.reviewImportCandidate(pendingId, "accept", "rev-1");

      // GET-Queue: interne Felder sind NICHT auf dem Draht, der Schwebezustand nur als Boolean.
      const list = await app.inject({
        method: "GET",
        url: "/api/library/import/candidates",
        headers,
      });
      expect(list.statusCode).toBe(200);
      const items = list.json() as Record<string, unknown>[];
      const pendingItem = items.find((c) => c.id === pendingId);
      expect(pendingItem?.auditPending).toBe(true);
      expect(pendingItem?.reviewedBy).toBe("rev-1");
      expect(pendingItem?.reviewedAction).toBe("accept");
      for (const item of items) {
        for (const internalKey of ["opId", "claimedAt", "claimedBy", "claimedAction"]) {
          expect(Object.keys(item)).not.toContain(internalKey);
        }
      }
      // Keine Beleg-Interna (eventId/actor/payload) — auditPending ist ein nacktes Boolean.
      expect(typeof pendingItem?.auditPending).toBe("boolean");

      // Auch die Antwort der Review-Aktion (PUT) läuft durchs DTO: Erfolg ohne Schwebezustand →
      // kein auditPending-Feld, keine internen Felder.
      const put = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${otherId}`,
        headers,
        payload: { action: "reject" },
      });
      expect(put.statusCode).toBe(200);
      const putBody = put.json() as Record<string, unknown>;
      expect(putBody.status).toBe("abgelehnt");
      expect(putBody.reviewedAction).toBe("reject");
      for (const internalKey of ["opId", "claimedAt", "claimedBy", "claimedAction"]) {
        expect(Object.keys(putBody)).not.toContain(internalKey);
      }
      expect(Object.keys(putBody)).not.toContain("auditPending");
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("die Aufräum-Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(IMPORT_CLEANUP_TEXT)) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});

// WP-SHIP8-FINAL (bens sammel23, Bedingung 3): der Cleanup-Confirm ist je Item FAIL-CLOSED gegen
// parallele Reviews/Revisionen — ein waehrend des Confirms angenommener Kandidat und ein
// zwischenzeitlich revidiertes KO ueberleben und stehen ehrlich in der Bilanz.
describe("WP-SHIP8-FINAL Bedingung 3: Cleanup gegen paralleles Accept/Update", () => {
  interface CleanupBody {
    removedCandidates: number;
    trashedKos: number;
    skipped: { id: string; reason: string }[];
  }

  it("Accept PARALLEL zum Confirm (Gate am ersten KO-Delete) → Kandidat + sein KO ueberleben, Bilanz ehrlich", async () => {
    const { app, services, headers } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    const candidates = await services.library.listImportCandidates();
    const acceptId = (candidates[0] as { id: string }).id;
    // Gate: der ERSTE KO-Soft-Delete des Confirms loest den parallelen Reviewer-Accept aus —
    // exakt bens Szenario (Accept zwischen Digest-Vergleich und Queue-Loeschung).
    const origDelete = services.ko.delete.bind(services.ko);
    let triggered = false;
    (services.ko as { delete: typeof services.ko.delete }).delete = async (id, actor, opts) => {
      if (!triggered) {
        triggered = true;
        await services.library.reviewImportCandidate(acceptId, "accept", "reviewer-1");
      }
      return origDelete(id, actor, opts);
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as CleanupBody;
    // Der angenommene Kandidat wurde NICHT geloescht und steht ehrlich in der Bilanz.
    expect(body.skipped).toContainEqual({ id: acceptId, reason: "zwischenzeitlich angenommen" });
    expect(body.removedCandidates).toBe(1); // nur der unveraendert gebliebene zweite Kandidat
    const remaining = await services.library.listImportCandidates();
    expect(remaining.map((c) => (c as { id: string }).id)).toEqual([acceptId]);
    expect((remaining[0] as { status: string }).status).toBe("angenommen");
    // Das per Accept entstandene KO lebt (es war nie Teil der bestaetigten Zielmenge).
    expect((await services.ko.list()).map((k) => k.title)).toContain("Kandidat 1");
  });

  it("WAEHREND des Confirms revidiertes Import-KO → Versions-CAS lehnt die Loeschung ab, Queue bleibt komplett stehen", async () => {
    const { app, services, headers } = await cleanupApp();
    const digest = await previewDigest(app, headers);
    const jiraKo = (await services.ko.list()).find((k) => k.title === "Aus Jira importiert");
    expect(jiraKo).toBeDefined();
    const jiraId = (jiraKo as { id: string }).id;
    // Gate: der ERSTE KO-Soft-Delete des Confirms revidiert PARALLEL das ANDERE Ziel-KO —
    // die Revision faellt damit in das Fenster zwischen Bestaetigungs-Snapshot und Loeschung.
    const origDelete = services.ko.delete.bind(services.ko);
    let triggered = false;
    (services.ko as { delete: typeof services.ko.delete }).delete = async (id, actor, opts) => {
      if (!triggered && id !== jiraId) {
        triggered = true;
        await services.ko.revise(jiraId, { statement: "inzwischen ueberarbeitet" }, "pedi");
      }
      return origDelete(id, actor, opts);
    };
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true, digest },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as CleanupBody;
    expect(body.trashedKos).toBe(1); // nur das unveraenderte Confluence-KO
    expect(body.skipped).toContainEqual({ id: jiraId, reason: "zwischenzeitlich ueberarbeitet" });
    // Bestehende Regel (3): bei KO-Skips bleibt die unwiderrufliche Queue KOMPLETT stehen.
    expect(body.removedCandidates).toBe(0);
    expect((await services.library.listImportCandidates()).length).toBe(2);
    // Das revidierte KO lebt weiter (nicht im Papierkorb) und traegt die Revision.
    const revised = await services.ko.get(jiraId);
    expect(revised?.statement).toBe("inzwischen ueberarbeitet");
  });
});
