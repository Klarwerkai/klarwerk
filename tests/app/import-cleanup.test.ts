// WP-D-CLEAN (Pedis Entscheid: alle Testdaten löschen, auch Confluence und Jira): der zweistufige
// Admin-Aufräumweg. Vorschau zählt korrekt und verändert NICHTS; confirm löscht GENAU den Umfang
// (Queue komplett leer, Import-KOs mit Confluence-/Jira-Provenienz in den PAPIERKORB, KOs ohne
// Import-Provenienz bleiben unangetastet); Audit-Eintrag mit Zählern; users.manage-Guard.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { IMPORT_CLEANUP_TEXT } from "../../apps/web/src/lib/importCleanup";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KoSource } from "../../services/knowledge-object";

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

describe("WP-D-CLEAN: POST /api/admin/import/cleanup", () => {
  it("VORSCHAU (ohne confirm): zählt korrekt und löscht NICHTS", async () => {
    const { app, services, headers } = await cleanupApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ preview: true, candidates: 2, importedKos: 2 });
    // Nichts passiert: Queue und Bestand unverändert, Papierkorb leer.
    expect((await services.library.listImportCandidates()).length).toBe(2);
    expect((await services.ko.list()).length).toBe(3);
    expect(await services.ko.trashed()).toEqual([]);
  });

  it("confirm:true löscht GENAU den Umfang — Queue leer, Import-KOs im Papierkorb, eigenes KO bleibt", async () => {
    const { app, services, headers, ownKoId } = await cleanupApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers,
      payload: { confirm: true },
    });
    expect(res.statusCode).toBe(200);
    // Ehrliche Bilanz.
    expect(res.json()).toEqual({
      preview: false,
      removedCandidates: 2,
      trashedKos: 2,
      skipped: [],
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
    expect(entry?.payload).toEqual({ removedCandidates: 2, trashedKos: 2, skipped: 0 });
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

  it("die Aufräum-Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(IMPORT_CLEANUP_TEXT)) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});
