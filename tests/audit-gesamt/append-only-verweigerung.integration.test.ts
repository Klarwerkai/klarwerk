// Aufnahme gesamt-auditprotokoll · Lauf 5 — BEN-L5-B2: die Append-only-Verweigerungsmatrix auf
// ECHTEM PostgreSQL (FR-AUD-02, R-2126, R-2206, R-0613).
//
// Für jede schreibende Methode der Audit-Schnittstelle und jeden Produktweg, über den ein Auditeintrag
// geändert oder gelöscht werden könnte, versucht ein Fall genau das an einem VORHANDENEN Eintrag —
// und belegt danach Zeile für Zeile (`to_jsonb(audit)`, alle Spalten), dass die Tabelle unverändert ist:
//
//   Schnittstelle             Versuch                                              Erwartung
//   ───────────────────────── ──────────────────────────────────────────────────── ─────────────────────
//   HTTP POST/PUT/PATCH/DELETE jede Adresse unter /api/audit                        404/405, bitgleich
//   AuditService.record       Eintrag schreiben                                    nur angehängt (n+1)
//   AuditService.recordOnce   vorhandene eventId mit anderem Inhalt                false, bitgleich
//   AuditService.exportChain  Export (schreibt audit.exported)                     nur angehängt (n+1)
//   PgAuditRepo.append        gefälschter Eintrag mit vorhandener seq (± tx)       abgewiesen, bitgleich
//   PgAuditRepo.appendOnce    vorhandene seq, neue eventId / vorhandene eventId    abgewiesen/false
//   PgAuditRepo.appendNext    Bauer liefert vorhandene seq statt Nachfolger (± tx) abgewiesen, bitgleich
//   Produktwege mit Löschung  DELETE /api/kos/:id, /api/kos/trash/:id,             2xx, alle früheren
//                             /api/admin/demo-seed, /api/users/:id                 Einträge bitgleich
//
// Dazu: AuditService und PgAuditRepo haben KEINE weitere Methode — jede Methode am Prototyp ist hier
// als lesend oder schreibend eingeordnet; eine neue, nicht eingeordnete Methode lässt den Test fallen.
//
// GRENZE (R-0613, ausdrücklich so aufgenommen): wer die Datenbank selbst beherrscht, kann eine Zeile
// per SQL ändern. Das wird NICHT verhindert, sondern beim Prüflauf erkannt — der letzte Fall zeigt
// genau das und stellt die Zeile danach wieder her. Kein Produktweg setzt ein solches SQL ab
// (statischer Beleg in `append-only-http.test.ts`).
//
// Verdrahtung wie im Betrieb: `buildPgServices` + `migrate` auf einer frischen Wegwerfdatenbank.
// Datenbankwahl wie `kette-und-beleg-atomar.integration.test.ts`: lokale URL über die Sicherung,
// sonst Container, sonst sichtbarer Skip (ein Skip ist KEIN Beleg).
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices, createPool, migrate } from "../../services/app";
import { type AuditEntry, AuditService, PgAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";

const PREFIX = "[KLARWERK][gesamt-auditprotokoll L5 append-only]";
const DB = "klarwerk_test_auditprotokoll_l5_appendonly";

function mitDatenbank(url: string, name: string): string {
  const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
  if (!treffer) {
    throw new Error(`${PREFIX} die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen.`);
  }
  return `${treffer[1]}${name}${treffer[3]}`;
}

/** Jede Methode am Prototyp, eingeordnet. Schreibend heißt: kann eine Zeile in `audit` erzeugen. */
const AUDIT_SERVICE_METHODEN = {
  schreibend: ["record", "recordOnce", "exportChain"],
  lesend: ["list", "exists", "kopfSeq", "verify", "verifyReport", "baue"],
};
const PG_AUDIT_REPO_METHODEN = {
  schreibend: ["append", "appendOnce", "appendNext"],
  lesend: ["queryable", "all", "findBy", "existsBy", "last", "findBySeq"],
};

const METHODEN = ["POST", "PUT", "PATCH", "DELETE"] as const;

describe("BEN-L5-B2 · Append-only-Verweigerung (echtes PostgreSQL)", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let pool: Pool | undefined;
  let app: FastifyInstance | undefined;
  let services: ReturnType<typeof buildPgServices> | undefined;
  let headers: Record<string, string> = {};
  let adminId = "";

  beforeAll(async () => {
    let basisUrl = "";
    let grund = "";
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basisUrl = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt.";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        basisUrl = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar: ${String(fehler)}`;
      }
    }
    if (basisUrl) {
      const kandidat = createPool(basisUrl);
      try {
        await kandidat.query("SELECT 1");
        verwaltung = kandidat;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
        await kandidat.end().catch(() => undefined);
      }
    }
    if (!verwaltung) {
      process.stderr.write(`${PREFIX} ÜBERSPRUNGEN — Grund: ${grund}\n`);
      return;
    }
    await verwaltung.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`);
    await verwaltung.query(`CREATE DATABASE ${DB}`);
    pool = new Pool({ connectionString: mitDatenbank(basisUrl, DB), max: 6 });
    await migrate(pool);
    services = buildPgServices(pool);
    app = buildApp(services);
    await app.ready();
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "l5@x.de", password: "secret123" },
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const angelegt = reg.json() as { id?: string; user?: { id: string } };
    adminId = angelegt.user?.id ?? angelegt.id ?? "";
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "l5@x.de", password: "secret123" },
    });
    headers = { authorization: `Bearer ${login.json().token}` };
    // Bestand: ein Objekt (ko.created …) und ein Eintrag mit eventId.
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Bestand für die Verweigerungsmatrix",
        statement: "Dichtung vor jedem Anlauf prüfen.",
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    expect(
      await services.audit.recordOnce("l5:bestand", {
        actor: adminId,
        action: "l5.bestand",
        target: "l5",
        payload: { wert: "original" },
      }),
    ).toBe(true);
  }, 180_000);

  afterAll(async () => {
    await app?.close().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    await verwaltung?.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`).catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  function bereit(ctx: { skip: () => void }): {
    a: FastifyInstance;
    p: Pool;
    s: ReturnType<typeof buildPgServices>;
  } {
    if (!verwaltung || !app || !pool || !services) {
      ctx.skip();
      throw new Error("unerreichbar");
    }
    return { a: app, p: pool, s: services };
  }

  /** Die ganze Tabelle, jede Spalte, in Reihenfolge. */
  async function abbild(p: Pool): Promise<Array<Record<string, unknown>>> {
    return (
      await p.query<{ z: Record<string, unknown> }>(
        "SELECT to_jsonb(a) AS z FROM audit a ORDER BY seq",
      )
    ).rows.map((r) => r.z);
  }

  async function kette(p: Pool): Promise<void> {
    const bericht = await new AuditService({ repo: new PgAuditRepo(p) }).verifyReport();
    expect(bericht.linkageBreaks).toBe(0);
    expect(bericht.ok).toBe(true);
  }

  /** Ein vorhandener Eintrag mit geändertem Inhalt und OHNE eventId — der Fälschungsversuch an `seq`. */
  async function faelschung(p: Pool, seq: number): Promise<AuditEntry> {
    const echt = await new PgAuditRepo(p).findBySeq(seq);
    expect(echt, `seq ${seq} vorhanden`).toBeDefined();
    const { eventId: _eventId, ...ohneEvent } = echt as AuditEntry;
    return { ...ohneEvent, actor: "jemand-anders", payload: { gefaelscht: true } };
  }

  /** Erwartet, dass der Versuch abgewiesen wird oder nichts schreibt, und die Tabelle bitgleich ist. */
  async function verweigert(
    p: Pool,
    versuch: () => Promise<unknown>,
    erlaubt: "wirft" | "false",
  ): Promise<void> {
    const vorher = await abbild(p);
    if (erlaubt === "wirft") {
      await expect(versuch()).rejects.toThrow(/audit_pkey|duplicate key/);
    } else {
      expect(await versuch()).toBe(false);
    }
    expect(await abbild(p)).toEqual(vorher);
    await kette(p);
  }

  it("Inventar: jede Methode von AuditService und PgAuditRepo ist eingeordnet, keine ändert oder löscht", () => {
    for (const [Klasse, liste] of [
      [AuditService, AUDIT_SERVICE_METHODEN],
      [PgAuditRepo, PG_AUDIT_REPO_METHODEN],
    ] as const) {
      const vorhanden = Object.getOwnPropertyNames(Klasse.prototype)
        .filter((n) => n !== "constructor")
        .sort();
      expect(vorhanden, `${Klasse.name}: Methode ohne Einordnung`).toEqual(
        [...liste.schreibend, ...liste.lesend].sort(),
      );
    }
    process.stderr.write(
      `${PREFIX} geprüfte Schreibmethoden: AuditService.{${AUDIT_SERVICE_METHODEN.schreibend.join(",")}} · PgAuditRepo.{${PG_AUDIT_REPO_METHODEN.schreibend.join(",")}} · HTTP ${METHODEN.join("/")} /api/audit/** · DELETE /api/kos/:id, /api/kos/trash/:id, /api/admin/demo-seed, /api/users/:id\n`,
    );
  });

  it("HTTP: POST/PUT/PATCH/DELETE auf jede /api/audit-Adresse → 404/405, Tabelle bitgleich", async (ctx) => {
    const { a, p } = bereit(ctx);
    const vorher = await abbild(p);
    const erster = vorher[0] as { seq: number; target: string };
    const adressen = [
      "/api/audit",
      `/api/audit/${erster.seq}`,
      "/api/audit/verify",
      "/api/audit/export",
      `/api/audit/ko/${erster.target}/findings`,
      `/api/audit?seq=${erster.seq}`,
    ];
    for (const url of adressen) {
      for (const method of METHODEN) {
        const res = await a.inject({
          method,
          url,
          headers,
          payload: { seq: erster.seq, actor: "jemand-anders", action: "ko.deleted" },
        });
        expect([404, 405], `${method} ${url} → ${res.statusCode}`).toContain(res.statusCode);
      }
    }
    expect(await abbild(p)).toEqual(vorher);
    await kette(p);
  });

  it("AuditService.record und exportChain hängen nur an: frühere Zeilen bitgleich, neue an n+1", async (ctx) => {
    const { p, s } = bereit(ctx);
    for (const schreibe of [
      () => s.audit.record({ actor: adminId, action: "l5.record", target: "l5", payload: {} }),
      () => s.audit.exportChain(adminId),
    ]) {
      const vorher = await abbild(p);
      await schreibe();
      const nachher = await abbild(p);
      expect(nachher.slice(0, vorher.length)).toEqual(vorher);
      expect(nachher).toHaveLength(vorher.length + 1);
      const neu = nachher.at(-1) as { seq: number; prev_hash: string };
      expect(neu.seq).toBe((vorher.at(-1) as { seq: number }).seq + 1);
      expect(neu.prev_hash).toBe((vorher.at(-1) as { hash: string }).hash);
      await kette(p);
    }
  });

  it("AuditService.recordOnce: vorhandene eventId mit anderem Inhalt → false, Tabelle bitgleich", async (ctx) => {
    const { p, s } = bereit(ctx);
    await verweigert(
      p,
      () =>
        s.audit.recordOnce("l5:bestand", {
          actor: "jemand-anders",
          action: "l5.bestand",
          target: "l5",
          payload: { wert: "gefaelscht" },
        }),
      "false",
    );
  });

  it("PgAuditRepo.append: vorhandene seq überschreiben → abgewiesen (ohne und mit Transaktion)", async (ctx) => {
    const { p } = bereit(ctx);
    const repo = new PgAuditRepo(p);
    const f = await faelschung(p, 1);
    await verweigert(p, () => repo.append(f), "wirft");
    await verweigert(p, () => withPgTx(p, (tx) => repo.append(f, tx)), "wirft");
  });

  it("PgAuditRepo.appendOnce: vorhandene seq mit neuer eventId → abgewiesen; vorhandene eventId → false", async (ctx) => {
    const { p } = bereit(ctx);
    const repo = new PgAuditRepo(p);
    const f = await faelschung(p, 1);
    await verweigert(p, () => repo.appendOnce({ ...f, eventId: "l5:neu" }), "wirft");
    // Dieselbe eventId an einer FREIEN seq: allein der Idempotenzschlüssel entscheidet.
    const frei = ((await abbild(p)).at(-1) as { seq: number }).seq + 1000;
    const g: AuditEntry = { ...f, seq: frei, eventId: "l5:bestand" };
    await verweigert(p, () => repo.appendOnce(g), "false");
    await verweigert(p, () => withPgTx(p, (tx) => repo.appendOnce(g, tx)), "false");
  });

  it("PgAuditRepo.appendNext: Bauer liefert eine vorhandene seq → abgewiesen (ohne und mit Transaktion)", async (ctx) => {
    const { p } = bereit(ctx);
    const repo = new PgAuditRepo(p);
    const f = await faelschung(p, 1);
    await verweigert(p, () => repo.appendNext(() => f), "wirft");
    await verweigert(p, () => withPgTx(p, (tx) => repo.appendNext(() => f, tx)), "wirft");
  });

  it("Produktwege mit Löschung (Papierkorb, Endlöschung, Demodaten, Nutzer) lassen jeden früheren Eintrag bitgleich", async (ctx) => {
    const { a, p, s } = bereit(ctx);
    const ko = await a.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Wird gelöscht",
        statement: "Dieses Objekt wird endgültig gelöscht.",
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const id = ko.json().id as string;
    const nutzer = await s.auth.register({
      name: "Wird gelöscht",
      email: "l5-weg@x.de",
      password: "secret123",
    });
    for (const url of [
      `/api/kos/${id}`,
      `/api/kos/trash/${id}`,
      "/api/admin/demo-seed",
      `/api/users/${nutzer.id}`,
    ]) {
      const vorher = await abbild(p);
      const res = await a.inject({ method: "DELETE", url, headers });
      expect(res.statusCode, `${url}: ${res.body.slice(0, 200)}`).toBeLessThan(300);
      const nachher = await abbild(p);
      expect(nachher.slice(0, vorher.length), url).toEqual(vorher);
      await kette(p);
    }
  });

  it("GRENZE R-0613: direktes SQL durch die Datenbank wird nicht verhindert, aber beim Prüflauf erkannt", async (ctx) => {
    const { p, s } = bereit(ctx);
    const vorher = await abbild(p);
    const erste = vorher[0] as { seq: number; actor: string };
    await p.query("UPDATE audit SET actor = 'jemand-anders' WHERE seq = $1", [erste.seq]);
    try {
      expect(await s.audit.verify()).toBe(false);
    } finally {
      await p.query("UPDATE audit SET actor = $2 WHERE seq = $1", [erste.seq, erste.actor]);
    }
    expect(await abbild(p)).toEqual(vorher);
    await kette(p);
  });
});
