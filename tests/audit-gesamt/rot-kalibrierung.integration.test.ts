// Aufnahme gesamt-auditprotokoll · ROT-KALIBRIERUNG AUF POSTGRESQL (Ben, Nacharbeit 4).
//
// Die Kriterien zu beleg:6818bd52 und beleg:1ea197ac verlangen Tests, die VOR der Behebung
// fehlschlagen und danach bestehen — auf dem PostgreSQL-Weg. Die grünen Fälle stehen in
// `kette-und-beleg-atomar.integration.test.ts`. Diese Datei zeigt den ROTEN Ausgang derselben
// Auslöser an der Fassung VOR der Behebung, und zwar so:
//
//   WAS „FASSUNG VOR DER BEHEBUNG" HIER HEISST. Der Prüfweg führt ausschliesslich Dateien des
//   Kandidaten aus; ein Checkout von `41fad46c` (Basis vor Lauf 3) ist darin nicht vorgesehen.
//   Ausgeführt wird deshalb der ALGORITHMUS dieser Fassung, nicht ihr Quelltext-Stand:
//     · `AuditService.record`/`recordOnce` in `41fad46c` lasen `repo.last()` und schrieben danach
//       `repo.append()`/`appendOnce()` — zwei Schritte, keine Sperre. Genau dieser Weg steht im
//       Kandidaten unverändert als Rückfall für Ablagen ohne `appendNext` (services/audit/src/
//       service.ts, `recordUngeteilt`). `altweg()` unten nimmt der echten `PgAuditRepo` nur
//       `appendNext` weg; `last`/`append`/`appendOnce` führen seit `41fad46c` dasselbe SQL
//       (`git diff 41fad46c -- services/audit/src/repo-pg.ts`: nur in Konstanten ausgelagert).
//     · Die Erstanlage in `41fad46c` (`createPlain` → `finishCreated`) schrieb `repo.insert(ko)`
//       in EIGENER Transaktion und `ko.created` danach über `recordOnce` — ebenfalls in eigener.
//       Diese Folge wird unten mit der echten `PgKoRepo` und dem Altweg des Audit-Dienstes
//       nachgefahren (die Schritte Snapshot/Projektion/Belegkette dazwischen ändern am Befund nichts
//       und sind weggelassen).
//
// Jeder Fall nennt sein grünes Gegenstück im Kandidaten. Der erwartete fachliche Fehler wird
// AUSDRÜCKLICH geprüft — ein Fall, der „irgendwie" scheitert, ist keine Kalibrierung.
//
// Datenbankwahl wie in den übrigen Integrationsdateien: lokale URL über die Sicherung, sonst
// Container, sonst sichtbarer Skip (ein Skip ist KEIN Beleg).
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices, createPool, migrate } from "../../services/app";
import { type AuditRepo, AuditService, PgAuditRepo, inspectChain } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
import { type KnowledgeObject, PgKoRepo } from "../../services/knowledge-object";

const PREFIX = "[KLARWERK][gesamt-auditprotokoll Rot-Kalibrierung]";
const DB = "klarwerk_test_auditprotokoll_rot";

function mitDatenbank(url: string, name: string): string {
  const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
  if (!treffer) {
    throw new Error(`${PREFIX} die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen.`);
  }
  return `${treffer[1]}${name}${treffer[3]}`;
}

// Ein Ausfall IN der Datenbank für den Fall „Beleg der Erstanlage scheitert" (wie in
// `kette-und-beleg-atomar.integration.test.ts`, eigener Name).
const PROBE_DDL = `
CREATE TABLE IF NOT EXISTS rot_probe (ziel text PRIMARY KEY);
CREATE OR REPLACE FUNCTION rot_probe_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM rot_probe WHERE ziel = 'audit:' || NEW.action) THEN
    RAISE EXCEPTION 'Probe: Auditeintrag % abgewiesen', NEW.action;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS rot_probe_audit ON audit;
CREATE TRIGGER rot_probe_audit BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION rot_probe_audit();
`;

/** Was ein Schreiber des Altwegs als Datenbankfehler bekam: `<code>:<constraint>`. */
type Fehlerspur = string[];

/**
 * Die Ablage, wie sie der Audit-Dienst in `41fad46c` benutzte: ohne `appendNext`. Optional hält
 * `schranke` jeden Leser nach `last()` an, bis beide gelesen haben — damit ist das Rennen der
 * zwei Schreiber nicht Glückssache, sondern geführt.
 */
function altweg(repo: PgAuditRepo, spur: Fehlerspur, schranke?: () => Promise<void>): AuditRepo {
  const merke = (f: unknown): never => {
    const pg = f as { code?: string; constraint?: string };
    spur.push(`${pg.code ?? "?"}:${pg.constraint ?? String(f)}`);
    throw f;
  };
  return {
    append: (e, tx) => repo.append(e, tx).catch(merke),
    appendOnce: (e, tx) => repo.appendOnce(e, tx).catch(merke),
    all: () => repo.all(),
    last: async (tx) => {
      const letzter = await repo.last(tx);
      await schranke?.();
      return letzter;
    },
    findBy: (f) => repo.findBy(f),
    existsBy: (f) => repo.existsBy(f),
    findBySeq: (s, tx) => repo.findBySeq(s, tx),
  };
}

/** Lässt die ersten zwei Aufrufer erst weiter, wenn beide da sind (Frist 10 s). */
function zweiGelesen(): () => Promise<void> {
  let da = 0;
  let frei: () => void = () => undefined;
  const beide = new Promise<void>((r) => {
    frei = r;
  });
  return async () => {
    da += 1;
    if (da === 2) {
      frei();
    }
    if (da <= 2) {
      await Promise.race([beide, new Promise((r) => setTimeout(r, 10_000))]);
    }
  };
}

describe("Rot-Kalibrierung auf PostgreSQL · Fassung vor der Behebung (Algorithmus 41fad46c)", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let poolA: Pool | undefined;
  let poolB: Pool | undefined;
  const offeneApps: FastifyInstance[] = [];
  let basisUrl = "";

  beforeAll(async () => {
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
    const url = mitDatenbank(basisUrl, DB);
    poolA = new Pool({ connectionString: url, max: 6 });
    poolB = new Pool({ connectionString: url, max: 6 });
    await migrate(poolA);
    await poolA.query(PROBE_DDL);
  }, 180_000);

  afterAll(async () => {
    for (const app of offeneApps.splice(0)) {
      await app.close().catch(() => undefined);
    }
    await poolA?.end().catch(() => undefined);
    await poolB?.end().catch(() => undefined);
    await verwaltung?.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`).catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  function bereit(ctx: { skip: () => void }): { pa: Pool; pb: Pool; v: Pool } {
    if (!verwaltung || !poolA || !poolB) {
      ctx.skip();
      throw new Error("unerreichbar");
    }
    return { pa: poolA, pb: poolB, v: verwaltung };
  }

  async function auditZeilen(p: Pool): Promise<number> {
    return (await p.query<{ n: number }>("SELECT count(*)::int AS n FROM audit")).rows[0]?.n ?? 0;
  }

  async function warteAufSperre(v: Pool, art: string): Promise<void> {
    const frist = Date.now() + 20_000;
    while (Date.now() < frist) {
      const res = await v.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = $1 AND wait_event_type = 'Lock' AND wait_event = $2`,
        [DB, art],
      );
      if ((res.rows[0]?.n ?? 0) >= 1) {
        return;
      }
      await new Promise((weiter) => setTimeout(weiter, 50));
    }
    throw new Error(`${PREFIX} nach 20 s wartete niemand an einer Sperre der Art ${art}.`);
  }

  /**
   * Eine App-Instanz, deren Audit-Dienst den Altweg geht, und der angemeldete Admin. Registriert wird
   * nur einmal (`registrieren`): die erste Registrierung einer frischen Datenbank ist der Admin, jede
   * weitere wäre ein nicht freigegebenes Konto ohne Exportrecht.
   */
  async function altInstanz(
    p: Pool,
    spur: Fehlerspur,
    schranke: () => Promise<void>,
    registrieren: boolean,
  ): Promise<{ app: FastifyInstance; headers: Record<string, string> }> {
    const email = "rot-admin@x.de";
    const services = buildPgServices(p);
    services.audit = new AuditService({ repo: altweg(new PgAuditRepo(p), spur, schranke) });
    const app = buildApp(services);
    await app.ready();
    offeneApps.push(app);
    if (registrieren) {
      const reg = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Admin", email, password: "secret123" },
      });
      expect(reg.statusCode, reg.body).toBe(201);
    }
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    expect(login.statusCode, login.body).toBe(200);
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  // ----------------------------------------------------------------------------------------------
  // beleg:6818bd52 — gleichzeitige `GET /api/audit/export`. Grünes Gegenstück im Kandidaten:
  // „B1 · zwölf gleichzeitige Exporte über zwei Instanzen …" und „B1 · choreografiert …".
  // ----------------------------------------------------------------------------------------------
  it("ROT · beleg:6818bd52 · zwei gleichzeitige Exporte über zwei Instanzen auf dem Altweg → einer scheitert an audit_pkey", async (ctx) => {
    const { pa, pb } = bereit(ctx);
    const spur: Fehlerspur = [];
    // Schranke ERST nach der Anmeldung scharf stellen — Anmeldung und Registrierung schreiben selbst.
    let scharf = false;
    const schranke = zweiGelesen();
    const gate = () => (scharf ? schranke() : Promise.resolve());
    const a = await altInstanz(pa, spur, gate, true);
    const b = await altInstanz(pb, spur, gate, false);
    const vorher = await auditZeilen(pa);
    scharf = true;
    const antworten = await Promise.all([
      a.app.inject({ method: "GET", url: "/api/audit/export", headers: a.headers }),
      b.app.inject({ method: "GET", url: "/api/audit/export", headers: b.headers }),
    ]);
    scharf = false;
    // DER GEMELDETE BEFUND: beide lasen denselben Vorgänger, beide wollten dieselbe `seq` — der
    // zweite Schreiber scheitert am Primärschlüssel, die Anfrage antwortet mit einem Serverfehler.
    const codes = antworten.map((r) => r.statusCode).sort();
    expect(codes, antworten.map((r) => r.body.slice(0, 200)).join("\n")).toHaveLength(2);
    expect(codes[0]).toBe(200);
    expect(codes[1]).toBeGreaterThanOrEqual(500);
    expect(spur).toContain("23505:audit_pkey");
    // Nur EIN `audit.exported` steht — der Export des Verlierers ist unbelegt.
    expect(await auditZeilen(pa)).toBe(vorher + 1);
  });

  // ----------------------------------------------------------------------------------------------
  // beleg:1ea197ac — gemeldeter Auslöser: Anlage gegen einen offenen Fremdschreiber. Grünes
  // Gegenstück: „B2 · gemeldeter Auslöser: Anlage gegen einen offenen Fremdschreiber → 201 und genau
  // ein ko.created".
  // ----------------------------------------------------------------------------------------------
  it("ROT · beleg:1ea197ac · Erstanlage auf dem Altweg gegen einen offenen Fremdschreiber → Objekt bleibt ohne ko.created", async (ctx) => {
    const { pa, pb, v } = bereit(ctx);
    const spur: Fehlerspur = [];
    const auditAlt = new AuditService({ repo: altweg(new PgAuditRepo(pb), spur) });
    const fremd = new AuditService({ repo: altweg(new PgAuditRepo(pa), []) });
    const ko = await neuesObjekt(pa, "Rot Fremdschreiber");
    let anlage: Promise<unknown> | undefined;
    await withPgTx(pa, async (tx) => {
      // Der Fremdschreiber hält einen noch nicht festgeschriebenen Eintrag mit der nächsten `seq`.
      await fremd.record({ actor: "rot", action: "rot.fremd", target: "offen" }, tx);
      // Erstanlage wie in 41fad46c: Objekt in eigener Transaktion, dann `ko.created`.
      await new PgKoRepo(pb).insert(ko);
      anlage = auditAlt
        .recordOnce(`ko.created:${ko.id}`, { actor: "rot", action: "ko.created", target: ko.id })
        .then(
          () => "geschrieben",
          (f: unknown) => f,
        );
      // `ko.created` wartet an der Zeilensperre der gleichen `seq`, bis der Fremdschreiber festschreibt.
      await warteAufSperre(v, "transactionid");
    });
    const ausgang = await anlage;
    expect(ausgang).not.toBe("geschrieben");
    expect(spur).toContain("23505:audit_pkey");
    // DER GEMELDETE BEFUND: das Objekt steht im Bestand, sein `ko.created` fehlt.
    const objekt = await pa.query("SELECT 1 FROM kos WHERE id = $1", [ko.id]);
    expect(objekt.rowCount).toBe(1);
    const beleg = await pa.query(
      "SELECT 1 FROM audit WHERE action = 'ko.created' AND target = $1",
      [ko.id],
    );
    expect(beleg.rowCount).toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // beleg:1ea197ac — die Probe: der Beleg der Erstanlage scheitert. Grünes Gegenstück: „B2 ·
  // Erfassen: weist die Datenbank ko.created ab, entsteht weder Objekt noch Fassung noch Beleg".
  // ----------------------------------------------------------------------------------------------
  it("ROT · beleg:1ea197ac · Erstanlage auf dem Altweg, die Datenbank weist ko.created ab → Objekt bleibt ohne Beleg", async (ctx) => {
    const { pa } = bereit(ctx);
    const spur: Fehlerspur = [];
    const auditAlt = new AuditService({ repo: altweg(new PgAuditRepo(pa), spur) });
    const ko = await neuesObjekt(pa, "Rot Probe");
    await pa.query("INSERT INTO rot_probe(ziel) VALUES ('audit:ko.created')");
    try {
      await new PgKoRepo(pa).insert(ko);
      await expect(
        auditAlt.recordOnce(`ko.created:${ko.id}`, {
          actor: "rot",
          action: "ko.created",
          target: ko.id,
        }),
      ).rejects.toThrow(/Probe: Auditeintrag ko\.created abgewiesen/);
    } finally {
      await pa.query("DELETE FROM rot_probe");
    }
    const objekt = await pa.query("SELECT 1 FROM kos WHERE id = $1", [ko.id]);
    expect(objekt.rowCount).toBe(1);
    const beleg = await pa.query(
      "SELECT 1 FROM audit WHERE action = 'ko.created' AND target = $1",
      [ko.id],
    );
    expect(beleg.rowCount).toBe(0);
    // Die Kette selbst bleibt ganz — der Befund ist die LÜCKE zwischen Objekt und Beleg.
    expect(inspectChain(await new PgAuditRepo(pa).all()).linkageBreaks).toBe(0);
  });

  /**
   * Ein vollständiges Wissensobjekt für die Altfolge: über die Anlage des Kandidaten erzeugt, dann
   * mit neuer Kennung geklont. Nur so trägt es jedes Feld, das `PgKoRepo.insert` erwartet.
   */
  async function neuesObjekt(p: Pool, titel: string): Promise<KnowledgeObject> {
    const services = buildPgServices(p);
    const vorlage = await services.ko.create({
      title: `${titel} (Vorlage)`,
      statement: `${titel} — Dichtung vor jedem Anlauf prüfen.`,
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
      author: "rot",
    });
    const zeile = await p.query<{ data: KnowledgeObject }>("SELECT data FROM kos WHERE id = $1", [
      vorlage.id,
    ]);
    const daten = zeile.rows[0]?.data as KnowledgeObject;
    return { ...daten, id: randomUUID(), title: titel };
  }
});
