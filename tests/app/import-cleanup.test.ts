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
    });
    const remaining = await services.library.listImportCandidates();
    expect(remaining.map((c) => c.item.title)).toEqual(["Parallel eingereiht"]);
  });

  it("WP-NIGHT-FIX: CandidateRepo.removeByIds — InMemory-Vertrag + Pg-Query-Pin (Fake-Pool)", async () => {
    // InMemory: nur die genannten Ids fallen, unbekannte Ids zählen nicht.
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
    await repo.insert(cand("b"));
    await repo.insert(cand("c"));
    expect(await repo.removeByIds(["a", "c", "gibt-es-nicht"])).toBe(2);
    expect((await repo.all()).map((c) => c.id)).toEqual(["b"]);
    // Pg: EIN atomares DELETE über ANY($1) mit den bestätigten Ids; leere Liste → kein Query.
    const calls: { sql: string; params: unknown[] }[] = [];
    const pool = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        return { rowCount: 2, rows: [] };
      },
    } as unknown as import("pg").Pool;
    const pg = new PgCandidateRepo(pool);
    expect(await pg.removeByIds(["a", "c"])).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toBe("DELETE FROM import_candidates WHERE id = ANY($1)");
    expect(calls[0]?.params).toEqual([["a", "c"]]);
    expect(await pg.removeByIds([])).toBe(0);
    expect(calls).toHaveLength(1); // leere Bestätigung → kein DELETE
  });

  it("die Aufräum-Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(IMPORT_CLEANUP_TEXT)) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});
