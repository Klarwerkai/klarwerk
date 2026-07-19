import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type AuditRepo, AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { TxContext } from "../../services/db-tx";
import {
  InMemoryKoRepo,
  type KoRepo,
  KoService,
  TRASH_RETENTION_DAYS,
  type WithTx,
} from "../../services/knowledge-object";

// SCRUM-422 (Pedi 03.07.): Papierkorb — gelöschte Artikel sind wiederherstellbar (Admin),
// nach 4 Wochen automatische Endlöschung; Demo-Daten werden IMMER sofort endgültig gelöscht.
describe("SCRUM-422: Papierkorb für gelöschte Wissensobjekte", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${res.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    return { headers, id: me.json().id as string };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const erik = await login(app, "erik@demo.klarwerk", "demo-pass-erik");
    return { app, admin, erik };
  }

  async function createKo(app: App, headers: Record<string, string>, title: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement: "Bei Überdruck zuerst Ventil V3 schließen.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    return res.json().id as string;
  }

  it("Löschen legt den Beitrag in den Papierkorb: überall verschwunden, für den Admin sichtbar", async () => {
    const { app, admin, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Ventil V3 zuerst");

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${koId}`,
      headers: erik.headers,
    });
    expect(del.statusCode).toBe(204);

    // Weg aus Detail + Liste …
    const got = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik.headers });
    expect(got.statusCode).toBe(404);
    const list = (await app
      .inject({ method: "GET", url: "/api/kos", headers: erik.headers })
      .then((r) => r.json())) as Array<{ id: string }>;
    expect(list.some((k) => k.id === koId)).toBe(false);

    // … aber im Admin-Papierkorb, mit Löscher und Ablauf-Frist.
    const trash = (await app
      .inject({ method: "GET", url: "/api/kos/trash", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string; deletedBy: string; expiresAt: string }>;
    const entry = trash.find((e) => e.id === koId);
    expect(entry?.deletedBy).toBe(erik.id);
    expect(entry?.expiresAt).toBeTruthy();
  });

  it("Papierkorb ist Admin-Sache: Experte bekommt 403 (Liste, Wiederherstellen, Endlöschung)", async () => {
    const { app, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Rechte-Test");
    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: erik.headers });

    for (const req of [
      { method: "GET" as const, url: "/api/kos/trash" },
      { method: "POST" as const, url: `/api/kos/${koId}/restore` },
      { method: "DELETE" as const, url: `/api/kos/trash/${koId}` },
    ]) {
      const res = await app.inject({ ...req, headers: erik.headers });
      expect(res.statusCode).toBe(403);
    }
  });

  it("Wiederherstellen bringt den Beitrag unversehrt zurück (Version + Historie bleiben)", async () => {
    const { app, admin, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Comeback");
    const before = await app
      .inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik.headers })
      .then((r) => r.json());

    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: erik.headers });
    const restored = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/restore`,
      headers: admin.headers,
    });
    expect(restored.statusCode).toBe(200);

    const after = await app
      .inject({ method: "GET", url: `/api/kos/${koId}`, headers: erik.headers })
      .then((r) => r.json());
    expect(after.version).toBe(before.version);
    expect(after.history.length).toBe(before.history.length);
    expect(after.deletedAt).toBeUndefined();

    // Und der Papierkorb ist ihn los.
    const trash = (await app
      .inject({ method: "GET", url: "/api/kos/trash", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string }>;
    expect(trash.some((e) => e.id === koId)).toBe(false);
  });

  it("Admin kann einen Papierkorb-Eintrag sofort endgültig löschen", async () => {
    const { app, admin, erik } = await setup();
    const koId = await createKo(app, erik.headers, "Sofort weg");
    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers: erik.headers });

    const purge = await app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${koId}`,
      headers: admin.headers,
    });
    expect(purge.statusCode).toBe(204);

    const restoreGone = await app.inject({
      method: "POST",
      url: `/api/kos/${koId}/restore`,
      headers: admin.headers,
    });
    expect(restoreGone.statusCode).toBe(404);
  });

  it("Demo-Daten landen NIE im Papierkorb — Löschen ist sofort endgültig", async () => {
    const { app, admin } = await setup();
    const kos = (await app
      .inject({ method: "GET", url: "/api/kos", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string; demoSeed?: boolean }>;
    const demo = kos.find((k) => k.demoSeed === true);
    expect(demo).toBeTruthy();
    if (!demo) {
      return;
    }

    await app.inject({ method: "DELETE", url: `/api/kos/${demo.id}`, headers: admin.headers });
    const trash = (await app
      .inject({ method: "GET", url: "/api/kos/trash", headers: admin.headers })
      .then((r) => r.json())) as Array<{ id: string }>;
    expect(trash.some((e) => e.id === demo.id)).toBe(false);
    const gone = await app.inject({
      method: "POST",
      url: `/api/kos/${demo.id}/restore`,
      headers: admin.headers,
    });
    expect(gone.statusCode).toBe(404);
  });

  // SCRUM-523 P.3 (WP2): Die Endlöschung abgelaufener Einträge ist jetzt eine EXPLIZITE Operation
  // (runTrashSweep) — Lesen (trashed()/list()) löscht NIE mehr. So bleibt jeder Lesepfad (inkl.
  // Import-Dry-Run) schreibfrei. Der Sweep wird beim Serverstart (und ggf. per Scheduler) angestoßen.
  it("nach Ablauf der Frist entfernt der explizite Sweep endgültig — Lesen löscht nie", async () => {
    // Deterministisch über die injizierbare Uhr des KoService — kein Cron, kein Warten.
    let clock = Date.parse("2026-07-03T12:00:00.000Z");
    const service = new KoService({ repo: new InMemoryKoRepo(), now: () => clock });
    const ko = await service.create({
      title: "Frist-Test",
      statement: "Läuft ab.",
      type: "best_practice",
      category: "Anlage 1",
      author: "erik",
    });
    await service.delete(ko.id, "erik");
    expect(await service.trashed()).toHaveLength(1);

    // Einen Tag VOR Ablauf: bleibt erhalten; ein Sweep löscht nichts.
    clock += (TRASH_RETENTION_DAYS - 1) * 86_400_000;
    expect(await service.runTrashSweep()).toBe(0);
    expect(await service.trashed()).toHaveLength(1);

    // Nach Ablauf: Lesen allein entfernt NICHT (schreibfrei) — der Eintrag ist weiter sichtbar.
    clock += 2 * 86_400_000;
    expect(await service.trashed()).toHaveLength(1);
    expect(await service.list()).toHaveLength(0); // aus dem normalen Bestand ausgeblendet (deletedAt)

    // Erst der EXPLIZITE Sweep löscht endgültig — auch aus dem Papierkorb.
    expect(await service.runTrashSweep()).toBe(1);
    expect(await service.trashed()).toHaveLength(0);
    await expect(service.restore(ko.id, "admin")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // SCRUM-523 P.3 (WP2): Read-only-Garantie. Selbst mit einem ABGELAUFENEN Papierkorb-Eintrag schreibt
  // KEIN Lesepfad (list()/trashed()) — kein Delete, kein Audit. Das ist die Grundlage für den
  // schreibfreien Import-Dry-Run (der über koService.list() geht). Ohne den Fix (Sweep beim Lesen) würde
  // list()/trashed() den abgelaufenen Eintrag löschen + ein ko.purged-Audit schreiben → Test scheitert.
  it("Read-Pfad ist schreibfrei — trotz abgelaufenem Papierkorb kein Delete/Audit beim Lesen", async () => {
    let clock = Date.parse("2026-07-03T12:00:00.000Z");
    const repo = new InMemoryKoRepo();
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    let purgeHookCalls = 0;
    const service = new KoService({
      repo,
      audit,
      now: () => clock,
      onPurge: async () => {
        purgeHookCalls++;
      },
    });
    const ko = await service.create({
      title: "Abgelaufen",
      statement: "im Papierkorb, Frist vorbei",
      type: "best_practice",
      category: "Anlage 1",
      author: "erik",
    });
    await service.delete(ko.id, "erik");
    // Frist überschreiten.
    clock += (TRASH_RETENTION_DAYS + 5) * 86_400_000;
    const auditCountBefore = (await auditRepo.all()).length;

    // Mehrfach lesen — inkl. der Pfade, die der Dry-Run nutzt.
    await service.list();
    await service.list();
    await service.trashed();
    await service.findCandidates({ terms: ["abgelaufen"], limit: 10 });

    // Nichts geschrieben: kein neues Audit, kein Purge-Hook, der Eintrag existiert noch.
    expect((await auditRepo.all()).length).toBe(auditCountBefore);
    expect(purgeHookCalls).toBe(0);
    expect(await service.trashed()).toHaveLength(1);
    expect(await repo.findById(ko.id)).toBeDefined();
  });

  // SCRUM-523 P.3 (WP2): der zentrale Purge-Vertrag ruft den injizierten Aufräum-Hook — für den
  // AUTOMATISCHEN (abgelaufenen) UND den MANUELLEN Purge, genau einmal je gelöschtem KO. Ohne den Fix
  // (repo.delete direkt im Sweep) liefe der Hook beim automatischen Pfad NIE → Konflikt/Overlap/Embedding
  // verwaisten. Dieser Test scheitert ohne die zentrale Verdrahtung.
  it("zentraler Purge ruft den Aufräum-Hook — automatisch (Ablauf) UND manuell", async () => {
    let clock = Date.parse("2026-07-03T12:00:00.000Z");
    const purged: Array<{ id: string; actor: string }> = [];
    const service = new KoService({
      repo: new InMemoryKoRepo(),
      now: () => clock,
      onPurge: async (id, actor) => {
        purged.push({ id, actor });
      },
    });
    const auto = await service.create({
      title: "Auto",
      statement: "läuft ab",
      type: "best_practice",
      category: "Anlage 1",
      author: "erik",
    });
    const manual = await service.create({
      title: "Manuell",
      statement: "wird sofort gelöscht",
      type: "best_practice",
      category: "Anlage 1",
      author: "erik",
    });
    await service.delete(auto.id, "erik");
    await service.delete(manual.id, "erik");

    // Manueller Purge → Hook mit Actor.
    await service.purgeTrashed(manual.id, "admin");
    expect(purged).toContainEqual({ id: manual.id, actor: "admin" });

    // Automatischer Purge nach Ablauf über den expliziten Sweep → Hook mit system-Actor.
    clock += (TRASH_RETENTION_DAYS + 1) * 86_400_000;
    await service.runTrashSweep();
    expect(purged).toContainEqual({ id: auto.id, actor: "system" });
    expect(purged).toHaveLength(2);
  });

  // SCRUM-523 P.3 (WP1-Batch3): AUCH die HARTEN Direktlöschwege laufen über purgeKo (den einzigen
  // Chokepoint) → der Aufräum-Hook greift auch bei delete({hard}) UND beim Demo-Purge (demoSeed). Ohne
  // die Umleitung (früher: repo.delete direkt in delete()) liefe der Hook hier NIE → Test scheitert.
  it("WP1: delete({hard}) UND demoSeed-Löschung rufen den Aufräum-Hook (Chokepoint)", async () => {
    const purged: string[] = [];
    const service = new KoService({
      repo: new InMemoryKoRepo(),
      onPurge: async (id) => {
        purged.push(id);
      },
    });
    const hard = await service.create({
      title: "Hart",
      statement: "hart weg",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
    const demo = await service.create({
      title: "Demo",
      statement: "demo weg",
      type: "best_practice",
      category: "A",
      author: "erik",
      demoSeed: true,
    });
    await service.delete(hard.id, "admin", { hard: true });
    await service.delete(demo.id, "system"); // demoSeed → hart, ohne opts.hard
    expect(purged).toContain(hard.id);
    expect(purged).toContain(demo.id);
    // Beide sind wirklich weg (harte Löschung, kein Papierkorb).
    expect(await service.get(hard.id)).toBeUndefined();
    expect(await service.get(demo.id)).toBeUndefined();
  });

  // SCRUM-523 P.3 (WP1-Batch3): CLEANUP-FIRST + Rollback. Schlägt der Aufräum-Hook fehl, wird das KO
  // NICHT gelöscht (Bestand bleibt), es entsteht KEIN ko.purged-Audit — kein Zwischenstand „KO weg,
  // Folgeartefakte leben". Ohne den Reorder (früher: delete ZUERST) wäre das KO schon weg, wenn der Hook
  // wirft → dieser Test scheitert.
  it("WP1: Cleanup-Fehler → KO bleibt bestehen, kein ko.purged-Audit (Rollback)", async () => {
    const auditRepo = new InMemoryAuditRepo();
    const audit = new AuditService({ repo: auditRepo });
    const service = new KoService({
      repo: new InMemoryKoRepo(),
      audit,
      onPurge: async () => {
        throw new Error("conflicts-cleanup down");
      },
    });
    const ko = await service.create({
      title: "Bleibt",
      statement: "cleanup scheitert",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
    // Harter Löschversuch scheitert am Cleanup → wirft.
    await expect(service.delete(ko.id, "admin", { hard: true })).rejects.toThrow("cleanup down");
    // KO ist NICHT gelöscht (Rollback-Äquivalent).
    expect(await service.get(ko.id)).toBeDefined();
    // Und KEIN ko.purged-Audit (nichts wurde endgültig gelöscht).
    const purgedAudits = (await auditRepo.all()).filter((e) => e.action === "ko.purged");
    expect(purgedAudits).toHaveLength(0);
  });

  // SCRUM-523 P.3 (WP1-Batch3): der Hook läuft VOR dem Bestands-Delete (cleanup-first). Zum Hook-
  // Zeitpunkt existiert das KO noch → so ist garantiert nie „KO weg, Artefakte leben".
  it("WP1: Aufräum-Hook läuft VOR dem KO-Delete (cleanup-first)", async () => {
    let koPresentDuringHook: boolean | null = null;
    const repo = new InMemoryKoRepo();
    const service = new KoService({
      repo,
      onPurge: async (id) => {
        koPresentDuringHook = (await repo.findById(id)) !== undefined;
      },
    });
    const ko = await service.create({
      title: "Reihenfolge",
      statement: "hook vor delete",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
    await service.delete(ko.id, "admin", { hard: true });
    expect(koPresentDuringHook).toBe(true); // beim Cleanup existierte das KO noch
    expect(await repo.findById(ko.id)).toBeUndefined(); // danach ist es weg
  });

  // SCRUM-523 P.3 (WP1-Batch3): ein Cleanup-Fehler an EINEM KO bricht den periodischen Sweep NICHT ab —
  // das fehlerhafte KO bleibt (Rollback), die übrigen abgelaufenen werden weiter gelöscht; der Fehler
  // geht an onSweepError (ehrlich), nicht still verloren.
  it("WP1: Sweep überspringt ein KO mit Cleanup-Fehler und räumt den Rest auf", async () => {
    let clock = Date.parse("2026-07-03T12:00:00.000Z");
    let failFor = "";
    const service = new KoService({
      repo: new InMemoryKoRepo(),
      now: () => clock,
      onPurge: async (id) => {
        if (id === failFor) {
          throw new Error("cleanup boom");
        }
      },
    });
    const bad = await service.create({
      title: "Bad",
      statement: "cleanup scheitert",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
    const good = await service.create({
      title: "Good",
      statement: "geht durch",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
    failFor = bad.id;
    await service.delete(bad.id, "erik");
    await service.delete(good.id, "erik");
    clock += (TRASH_RETENTION_DAYS + 1) * 86_400_000;

    const errors: string[] = [];
    const purged = await service.runTrashSweep("system", (id) => errors.push(id));
    expect(purged).toBe(1); // nur good
    expect(errors).toEqual([bad.id]); // bad ehrlich gemeldet
    expect(await service.get(good.id)).toBeUndefined(); // good weg
    // bad bleibt im Papierkorb (Rollback), nicht endgültig gelöscht.
    expect((await service.trashed()).some((t) => t.id === bad.id)).toBe(true);
  });
});

// SCRUM-523 P.3 (WP1-Batch3): End-to-End über die ECHTE Verdrahtung (buildServices → onPurge wired):
// eine harte KO-Löschung räumt die Folgeartefakte (hier: eine offene Überschneidung) über den zentralen
// Purge-Vertrag wirklich mit auf. Beweist, dass der Chokepoint + die App-Verdrahtung zusammenspielen.
describe("SCRUM-523 P.3 (WP1-Batch3): Purge-Kaskade end-to-end (echte Verdrahtung)", () => {
  it("delete({hard}) schließt offene Überschneidungen des KO (participant_deleted)", async () => {
    const services = buildServices();
    // buildApp verdrahtet den Purge-Aufräum-Hook (setPurgeCleanup) auf services.ko — genau wie im
    // Produktions-Bootstrap. Ohne diesen Schritt liefe die Kaskade nicht (Wiring lebt in buildApp).
    buildApp(services);
    const a = await services.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    const b = await services.ko.create({
      title: "KO B",
      statement: "Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    // Eine offene Überschneidung zwischen A und B anlegen (deterministischer Eintrag, kein Modell).
    await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    expect(await services.overlaps.unresolved()).toHaveLength(1);

    // KO A hart löschen → über purgeKo → onPurge → overlaps.onKoRemoved schließt den Eintrag.
    await services.ko.delete(a.id, "admin", { hard: true });

    expect(await services.overlaps.unresolved()).toHaveLength(0); // Überschneidung geschlossen (kein Geist)
    expect(await services.ko.get(a.id)).toBeUndefined(); // KO wirklich weg
  });
});

// SCRUM-523 P.3 (WP-A2): externe Review-Auflage — das reine „Audit vor Delete" aus WP-A schloss nur
// EINE Richtung der Race (Delete ohne Audit-Beleg). Die Umkehr-Richtung blieb offen: committet der
// Audit-Schritt, scheitert der NACHFOLGENDE Delete, bleibt ein ko.purged-Beleg stehen, der eine
// Löschung behauptet, die in Wahrheit NICHT stattfand. Fix: repo.delete + audit.record laufen jetzt
// (wenn die Kompositionswurzel einen echten Pg-Pool hat, s. build-app.ts buildPgServices) in EINER
// echten DB-Transaktion (services/db-tx, s. Kommentar an KoService.purgeKo) — entweder committen BEIDE,
// oder es rollt BEIDE zurück. Die Tests hier bilden diese Commit/Rollback-Semantik am Unit-Level nach
// (kein echtes Postgres im Standard-Testlauf verfügbar) und beweisen die Invariante AKTIV in BEIDE
// Richtungen, für alle drei Purge-Wege (purgeTrashed, delete({hard}), runTrashSweep):
//   (a) scheitert repo.delete INNERHALB der Transaktion → kein ko.purged-Beleg (Rollback), KO bleibt.
//   (b) scheitert audit.record INNERHALB der Transaktion → repo.delete bleibt UNSICHTBAR (Rollback),
//       KO bleibt — genau die Richtung, die WP-A nicht beweisen konnte.
//   (c) Erfolgsfall: genau EIN ko.purged-Beleg + KO wirklich weg.
// Ein zusätzlicher Integrationstest gegen ECHTES Postgres (beweist echte Transaktionsgrenzen, die eine
// In-Memory-Fake-Transaktion strukturell nicht beweisen kann) steht separat in
// tests/ko/trash-tx-pg.integration.test.ts — bewusst NICHT Teil dieses Laufs (braucht Docker/
// Testcontainers, s. Kommentar dort).
describe("SCRUM-523 P.3 (WP-A2): repo.delete + audit.record committen/rollbacken ATOMAR (services/db-tx)", () => {
  type TxOp = () => void;

  // Bildet die COMMIT/ROLLBACK-Semantik von withPgTx (services/db-tx/src/tx.ts) im Unit-Test nach, ohne
  // echtes Postgres: bei vorhandenem TxContext puffert repo.delete/audit.append die Schreibung nur
  // ("staged") statt sie sofort anzuwenden. withTx wendet die gepufferten Schreibungen NUR an, wenn fn
  // (der purgeKo-Transaktionskörper) OHNE Fehler durchläuft (Commit); wirft fn — unabhängig davon,
  // WELCHER der beiden Schreiber den Fehler auslöst — werden ALLE gepufferten Schreibungen verworfen
  // (Rollback), genau wie bei withPgTx (BEGIN…COMMIT/ROLLBACK auf demselben Client).
  function makeTxHarness(inner: InMemoryKoRepo, auditInner: InMemoryAuditRepo) {
    const staging = new WeakMap<TxContext, TxOp[]>();

    function stage(tx: TxContext | undefined, op: TxOp): void {
      const ops = tx && staging.get(tx);
      if (ops) {
        ops.push(op);
      } else {
        op();
      }
    }

    const koRepo: KoRepo = {
      insert: (ko) => inner.insert(ko),
      findById: (id) => inner.findById(id),
      update: (ko) => inner.update(ko),
      list: (filter) => inner.list(filter),
      findCandidates: (query) => inner.findCandidates(query),
      delete: (id, tx) => {
        stage(tx, () => {
          void inner.delete(id);
        });
        return Promise.resolve();
      },
    };

    const auditRepo: AuditRepo = {
      append: (entry, tx) => {
        stage(tx, () => {
          void auditInner.append(entry);
        });
        return Promise.resolve();
      },
      all: () => auditInner.all(),
      last: (tx) => auditInner.last(tx),
    };

    const withTx: WithTx = async (fn) => {
      const tx: TxContext = { brand: "TxContext" };
      staging.set(tx, []);
      try {
        const result = await fn(tx);
        for (const op of staging.get(tx) ?? []) {
          op();
        }
        return result;
      } finally {
        staging.delete(tx);
      }
    };

    return { koRepo, auditRepo, withTx };
  }

  // Scharfschaltbarer Einmal-Fehler (danach wieder normales Verhalten) — dieselbe Bauart wie die
  // flakyRepo-Fakes aus WP-A, nur wiederverwendbar für sowohl repo.delete als auch audit.append.
  function failOnce(): { arm: () => void; consume: () => boolean } {
    let armed = false;
    return {
      arm: () => {
        armed = true;
      },
      consume: () => {
        if (!armed) {
          return false;
        }
        armed = false;
        return true;
      },
    };
  }

  function withDeleteFailure(
    repo: KoRepo,
    fail: { consume: () => boolean },
    message: string,
  ): KoRepo {
    return {
      ...repo,
      delete: async (id, tx) => {
        if (fail.consume()) {
          throw new Error(message);
        }
        return repo.delete(id, tx);
      },
    };
  }

  function withAuditFailure(
    repo: AuditRepo,
    fail: { consume: () => boolean },
    message: string,
  ): AuditRepo {
    return {
      ...repo,
      append: async (entry, tx) => {
        if (fail.consume()) {
          throw new Error(message);
        }
        return repo.append(entry, tx);
      },
    };
  }

  const PURGE_PATHS = ["purgeTrashed", "delete-hard", "runTrashSweep"] as const;
  type PurgePath = (typeof PURGE_PATHS)[number];

  // SCRUM-523 P.3 (WP-A2, Fehleranalyse): "in den Papierkorb legen" (service.delete(id,"erik")) und der
  // eigentliche Purge-CHOKEPOINT (purgeTrashed/delete({hard})/runTrashSweep → purgeKo) sind ZWEI
  // GETRENNTE Schritte — das Trashen ist NICHT wiederholbar (ein bereits getrashtes KO ist über
  // require()/delete() nicht mehr erreichbar, s. service.ts require(): "getrashte KOs sind für alle
  // normalen Pfade nicht vorhanden"). Ein Retry nach einem zurückgerollten Purge-Versuch ruft in der
  // Praxis NIE erneut delete() auf ein bereits getrashtes KO — er wiederholt nur den Purge-Chokepoint
  // selbst (das KO bleibt ja unverändert im Papierkorb, s. Kommentar an purgeKo, Fenster (A)). prepare
  // trashed daher GENAU EINMAL; attempt ist der wiederholbare Chokepoint-Aufruf.
  function purgeSteps(path: PurgePath) {
    return {
      prepare: async (service: KoService, id: string): Promise<void> => {
        if (path !== "delete-hard") {
          await service.delete(id, "erik");
        }
      },
      // Für runTrashSweep: ein Purge-Fehler an EINEM KO bricht den Sweep-Lauf NIE ab (s. Kommentar an
      // runTrashSweep — "never block") und wird stattdessen an onSweepError gereicht; hier zu einer
      // regulären Exception vereinheitlicht, damit dieselbe .rejects/.resolves-Assertion für alle drei
      // Wege gilt.
      attempt: async (service: KoService, id: string, clock: { value: number }): Promise<void> => {
        if (path === "purgeTrashed") {
          await service.purgeTrashed(id, "admin");
          return;
        }
        if (path === "delete-hard") {
          await service.delete(id, "admin", { hard: true });
          return;
        }
        clock.value += (TRASH_RETENTION_DAYS + 1) * 86_400_000;
        const sweepErrors: unknown[] = [];
        await service.runTrashSweep("system", (_id, error) => sweepErrors.push(error));
        if (sweepErrors.length > 0) {
          throw sweepErrors[0];
        }
      },
    };
  }

  it("(c) Erfolgsfall: genau ein ko.purged-Beleg + KO wirklich weg — für alle drei Purge-Wege", async () => {
    for (const path of PURGE_PATHS) {
      const inner = new InMemoryKoRepo();
      const auditInner = new InMemoryAuditRepo();
      const { koRepo, auditRepo, withTx } = makeTxHarness(inner, auditInner);
      const audit = new AuditService({ repo: auditRepo });
      const clock = { value: Date.parse("2026-07-03T12:00:00.000Z") };
      const service = new KoService({ repo: koRepo, audit, withTx, now: () => clock.value });

      const ko = await service.create({
        title: `Erfolg (${path})`,
        statement: "transaktionaler Purge gelingt",
        type: "best_practice",
        category: "A",
        author: "erik",
      });

      const steps = purgeSteps(path);
      await steps.prepare(service, ko.id);
      await expect(steps.attempt(service, ko.id, clock)).resolves.toBeUndefined();

      expect(await inner.findById(ko.id)).toBeUndefined();
      expect(
        (await auditInner.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
      ).toHaveLength(1);
    }
  });

  it("(a) scheitert repo.delete INNERHALB der Transaktion: kein ko.purged-Beleg (Rollback), KO bleibt, Retry räumt idempotent auf — für alle drei Purge-Wege", async () => {
    for (const path of PURGE_PATHS) {
      const inner = new InMemoryKoRepo();
      const auditInner = new InMemoryAuditRepo();
      const { koRepo, auditRepo, withTx } = makeTxHarness(inner, auditInner);
      const deleteFail = failOnce();
      const clock = { value: Date.parse("2026-07-03T12:00:00.000Z") };
      const service = new KoService({
        repo: withDeleteFailure(koRepo, deleteFail, "delete-storage down (in tx)"),
        audit: new AuditService({ repo: auditRepo }),
        withTx,
        now: () => clock.value,
      });

      const ko = await service.create({
        title: `Delete scheitert (${path})`,
        statement: "repo.delete scheitert in der Transaktion",
        type: "best_practice",
        category: "A",
        author: "erik",
      });

      const steps = purgeSteps(path);
      await steps.prepare(service, ko.id);

      deleteFail.arm();
      await expect(steps.attempt(service, ko.id, clock)).rejects.toThrow(
        "delete-storage down (in tx)",
      );

      // Rollback bewiesen: KEIN ko.purged-Beleg (obwohl audit.record im Code NACH repo.delete käme —
      // die Transaktion als Ganzes hat nie committet), KO existiert unverändert weiter (im Papierkorb,
      // je nach Weg — s. purgeSteps.prepare).
      expect(
        (await auditInner.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
      ).toHaveLength(0);
      expect(await inner.findById(ko.id)).toBeDefined();

      // Retry (kein erneuter Fehler): derselbe Purge-Chokepoint wird erneut versucht (das KO ist ja
      // unverändert im selben Zustand wie vor dem gescheiterten Versuch) — jetzt committet die
      // Transaktion, KO ist weg, genau EIN Beleg.
      await expect(steps.attempt(service, ko.id, clock)).resolves.toBeUndefined();
      expect(await inner.findById(ko.id)).toBeUndefined();
      expect(
        (await auditInner.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
      ).toHaveLength(1);
    }
  });

  it("(b) scheitert audit.record INNERHALB der Transaktion: repo.delete bleibt unsichtbar (Rollback), KO bleibt — die Richtung, die WP-A nicht bewies — für alle drei Purge-Wege", async () => {
    for (const path of PURGE_PATHS) {
      const inner = new InMemoryKoRepo();
      const auditInner = new InMemoryAuditRepo();
      const { koRepo, auditRepo, withTx } = makeTxHarness(inner, auditInner);
      const auditFail = failOnce();
      const clock = { value: Date.parse("2026-07-03T12:00:00.000Z") };
      const service = new KoService({
        repo: koRepo,
        audit: new AuditService({
          repo: withAuditFailure(auditRepo, auditFail, "audit-storage down (in tx)"),
        }),
        withTx,
        now: () => clock.value,
      });

      const ko = await service.create({
        title: `Audit scheitert (${path})`,
        statement: "audit.record scheitert in der Transaktion",
        type: "best_practice",
        category: "A",
        author: "erik",
      });

      const steps = purgeSteps(path);
      await steps.prepare(service, ko.id);

      auditFail.arm();
      await expect(steps.attempt(service, ko.id, clock)).rejects.toThrow(
        "audit-storage down (in tx)",
      );

      // Rollback bewiesen: repo.delete lief im Code VOR audit.record und wurde bereits "gestaged" —
      // weil audit.record danach scheiterte, wurde die gepufferte Löschung NIE angewendet. KO existiert
      // unverändert weiter, KEIN Geister-Delete ohne Beleg (genau die Lücke, die WP-A offen ließ).
      expect(await inner.findById(ko.id)).toBeDefined();
      expect(
        (await auditInner.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
      ).toHaveLength(0);

      // Retry (kein erneuter Fehler): derselbe Purge-Chokepoint wird erneut versucht — jetzt committet
      // die Transaktion, KO ist weg, genau EIN Beleg.
      await expect(steps.attempt(service, ko.id, clock)).resolves.toBeUndefined();
      expect(await inner.findById(ko.id)).toBeUndefined();
      expect(
        (await auditInner.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
      ).toHaveLength(1);
    }
  });
});
