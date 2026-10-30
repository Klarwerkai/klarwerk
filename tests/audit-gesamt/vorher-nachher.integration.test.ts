// Aktuelle PostgreSQL-Regression für den jeweiligen Kandidaten.
// Die drei fachlichen NACHHER-Sollprüfungen bleiben unverändert. Sie benötigen keine historische
// Quellmaterialisierung. Alte Gegenproben und Patchbelege: HISTORISCHE-GEGENPROBEN.md.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as kandidat from "../../services/app";
import { AuditService, PgAuditRepo, inspectChain } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";

const PREFIX = "[KLARWERK][gesamt-auditprotokoll vorher/nachher]";
const WURZEL = fileURLToPath(new URL("../../", import.meta.url));
/** Was die Sollprüfungen von einer Fassung brauchen — beide Fassungen bieten genau das an. */
interface AppModul {
  buildApp(services: unknown): FastifyInstance;
  buildPgServices(pool: Pool): unknown;
  migrate(pool: Pool): Promise<void>;
}

const PROBE_DDL = `
CREATE TABLE IF NOT EXISTS vn_probe (ziel text PRIMARY KEY);
CREATE OR REPLACE FUNCTION vn_probe_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM vn_probe WHERE ziel = 'audit:' || NEW.action) THEN
    RAISE EXCEPTION 'Probe: Auditeintrag % abgewiesen', NEW.action;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vn_probe_audit ON audit;
CREATE TRIGGER vn_probe_audit BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION vn_probe_audit();
`;

const KO = (titel: string) => ({
  confidentiality: "intern",
  title: titel,
  statement: `${titel} — Dichtung vor jedem Anlauf prüfen.`,
  type: "best_practice",
  category: "Instandhaltung",
});

function git(...args: string[]): string {
  return execFileSync("git", ["-C", WURZEL, ...args], { encoding: "utf8" }).trim();
}

interface Buehne {
  name: string;
  db: string;
  pa: Pool;
  a: FastifyInstance;
  b: FastifyInstance;
  headers: Record<string, string>;
}

describe("Aktuelle Audit-Regression auf PostgreSQL · drei fachliche Sollprüfungen", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let basisUrl = "";
  let grund = "";
  const pools: Pool[] = [];
  const apps: FastifyInstance[] = [];
  const datenbanken: string[] = [];
  let nachher: Buehne | undefined;

  function mitDatenbank(url: string, name: string): string {
    const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
    if (!treffer) {
      throw new Error(
        `${PREFIX} die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen.`,
      );
    }
    return `${treffer[1]}${name}${treffer[3]}`;
  }

  async function buehne(name: string, modul: AppModul): Promise<Buehne> {
    const v = verwaltung as Pool;
    const db = `klarwerk_test_vn_${name}`;
    await v.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`);
    await v.query(`CREATE DATABASE ${db}`);
    datenbanken.push(db);
    const url = mitDatenbank(basisUrl, db);
    const pa = new Pool({ connectionString: url, max: 6 });
    const pb = new Pool({ connectionString: url, max: 6 });
    pools.push(pa, pb);
    await modul.migrate(pa);
    await pa.query(PROBE_DDL);
    const a = modul.buildApp(modul.buildPgServices(pa));
    const b = modul.buildApp(modul.buildPgServices(pb));
    apps.push(a, b);
    await a.ready();
    await b.ready();
    const reg = await a.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "vn@x.de", password: "secret123" },
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const login = await a.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "vn@x.de", password: "secret123" },
    });
    expect(login.statusCode, login.body).toBe(200);
    const headers = { authorization: `Bearer ${login.json().token}` };
    // aufnahme:20260922:gesamt-leserechte (Nacharbeit 19, Variante B): die unveränderte Kette geht
    // nur an, wer alles lesen darf. Der Admin bekommt deshalb das persönliche Niveau „streng
    // vertraulich" — die Vorher-Fassungen kennen das Feld nicht und lassen es unbeachtet.
    const konto = reg.json() as { id?: string; user?: { id: string } };
    const kontoId = konto.id ?? konto.user?.id;
    expect(kontoId, reg.body).toBeTruthy();
    const freigabe = await a.inject({
      method: "PUT",
      url: `/api/users/${kontoId}`,
      headers,
      payload: { freigabe: "streng_vertraulich" },
    });
    expect([200, 204], freigabe.body).toContain(freigabe.statusCode);
    // Nacharbeit 28 (Ben): die unveränderte Kette gibt es nur noch mit ausdrücklich erteilter
    // Ketteneinsicht (Betriebseinstellung). Mehrere Bühnen laufen nebeneinander — deshalb wird das
    // Konto ERGÄNZT, nicht ersetzt. Die Vorher-Fassungen lesen die Einstellung nicht.
    const bisher = process.env.KLARWERK_AUDIT_KETTENEINSICHT;
    process.env.KLARWERK_AUDIT_KETTENEINSICHT = bisher ? `${bisher},${kontoId}` : String(kontoId);
    return { name, db, pa, a, b, headers };
  }

  beforeAll(async () => {
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
      const kandidatPool = kandidat.createPool(basisUrl);
      try {
        await kandidatPool.query("SELECT 1");
        verwaltung = kandidatPool;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
        await kandidatPool.end().catch(() => undefined);
      }
    }
    if (!verwaltung) {
      throw new Error(`${PREFIX} PostgreSQL-Prüfmittel fehlt: ${grund}`);
    }
    nachher = await buehne("nachher", kandidat as unknown as AppModul);
    try {
      process.stderr.write(`${PREFIX} NACHHER-Fassung (Kandidat): ${git("rev-parse", "HEAD")}\n`);
    } catch {
      process.stderr.write(`${PREFIX} NACHHER-Fassung: Kandidat (Kennung nicht lesbar)\n`);
    }
  }, 60_000);

  afterAll(async () => {
    for (const app of apps.splice(0)) {
      await app.close().catch(() => undefined);
    }
    for (const p of pools.splice(0)) {
      await p.end().catch(() => undefined);
    }
    // `Pool.end()` ist fertig, sobald die Clients aus dem Pool genommen sind — nicht erst, wenn ihre
    // Verbindungen geschlossen sind. Ein sofortiges `DROP … WITH (FORCE)` beendet die noch
    // schließenden Sitzungen mit 57P01, und der Client meldet das als unbehandelten Fehler
    // (Nacharbeit 18, aufnahme:20260922:gesamt-leserechte). Erst warten, dann löschen.
    for (const db of datenbanken.splice(0)) {
      if (verwaltung) {
        await warteBisOhneVerbindung(verwaltung, db);
      }
      await verwaltung?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await verwaltung?.end();
    await container?.stop();
  });

  /** Wartet (höchstens ~10 s, ohne Ausnahme), bis keine Sitzung mehr an `db` hängt. */
  async function warteBisOhneVerbindung(admin: Pool, db: string): Promise<void> {
    for (let versuch = 0; versuch < 100; versuch++) {
      const { rows } = await admin.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
        [db],
      );
      if ((rows[0]?.n ?? 0) === 0) {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /**
   * SOLL (beleg:6818bd52, gemeldeter Auslöser: gleichzeitige `GET /api/audit/export`) — dieselbe
   * fachliche Sollprüfung wie „B1 · zwölf gleichzeitige Exporte über zwei Instanzen …" in
   * `kette-und-beleg-atomar.integration.test.ts`, erweitert um einen geführten Fall:
   *   (a) ein Export, während ein zweiter Schreiber die nächste `seq` offen hält (der Export liest
   *       denselben Vorgänger wie der andere — die Konkurrenz ist geführt, nicht Glückssache);
   *   (b) zwölf gleichzeitige Exporte über zwei Instanzen.
   * Soll: jede Antwort 200, jeder Abruf als `audit.exported` belegt (13), die Folge lückenlos und
   * eindeutig, jeder Eintrag verweist auf die Prüfsumme seines tatsächlichen Vorgängers.
   */
  async function sollGleichzeitigeExporte(s: Buehne): Promise<string[]> {
    const verletzt: string[] = [];
    const fremd = new AuditService({ repo: new PgAuditRepo(s.pa) });
    let einzel: { statusCode: number; body: string } | undefined;
    let lauf: Promise<void> | undefined;
    await withPgTx(s.pa, async (tx) => {
      await fremd.record({ actor: "vn", action: "vn.fremd", target: "offen" }, tx);
      lauf = s.b
        .inject({ method: "GET", url: "/api/audit/export", headers: s.headers })
        .then((r) => {
          einzel = { statusCode: r.statusCode, body: r.body.slice(0, 200) };
        });
      await warteAufSperre(s.db);
    });
    await lauf;
    if (einzel?.statusCode !== 200) {
      verletzt.push(`Export antwortete ${einzel?.statusCode}: ${einzel?.body}`);
    }
    const antworten = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 === 0 ? s.a : s.b).inject({
          method: "GET",
          url: "/api/audit/export",
          headers: s.headers,
        }),
      ),
    );
    const fehl = antworten.map((r) => r.statusCode).filter((c) => c !== 200);
    if (fehl.length > 0) {
      verletzt.push(`Gleichzeitige Exporte: ${fehl.length} von 12 nicht 200 (${fehl.join(", ")})`);
    }
    const belegt = await s.pa.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE action = 'audit.exported'",
    );
    if ((belegt.rows[0]?.n ?? 0) !== 13) {
      verletzt.push(`audit.exported ${belegt.rows[0]?.n} statt 13`);
    }
    verletzt.push(...(await ketteVerletzt(s.pa)));
    return verletzt;
  }

  async function warteAufSperre(db: string): Promise<void> {
    const v = verwaltung as Pool;
    const frist = Date.now() + 20_000;
    while (Date.now() < frist) {
      const res = await v.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = $1 AND wait_event_type = 'Lock'`,
        [db],
      );
      if ((res.rows[0]?.n ?? 0) >= 1) {
        return;
      }
      await new Promise((weiter) => setTimeout(weiter, 50));
    }
    throw new Error(`${PREFIX} nach 20 s wartete in ${db} niemand an einer Sperre.`);
  }

  /** Lückenlos, eindeutig, jeder Eintrag verweist auf die Prüfsumme seines tatsächlichen Vorgängers. */
  async function ketteVerletzt(p: Pool): Promise<string[]> {
    const z = (
      await p.query<{ seq: number; prev_hash: string; hash: string }>(
        "SELECT seq, prev_hash, hash FROM audit ORDER BY seq",
      )
    ).rows;
    const verletzt: string[] = [];
    z.forEach((e, i) => {
      if (e.seq !== i + 1) {
        verletzt.push(`Folgenummer ${e.seq} an Stelle ${i + 1}`);
      }
      if (i > 0 && e.prev_hash !== z[i - 1]?.hash) {
        verletzt.push(`seq ${e.seq} verweist nicht auf seinen Vorgänger`);
      }
    });
    const bericht = inspectChain(await new PgAuditRepo(p).all());
    if (bericht.linkageBreaks !== 0) {
      verletzt.push(`Kettenprüfung: ${bericht.linkageBreaks} echte Brüche`);
    }
    return verletzt;
  }

  /**
   * SOLL (beleg:1ea197ac, gemeldeter Auslöser; Kern von beleg:6818bd52): eine Anlage gegen einen
   * offenen Fremdschreiber — zwei Schreiber wollen die nächste `seq`. Soll: 201, das Objekt trägt
   * genau ein `ko.created`, die Kette ist lückenlos und verweist je auf den tatsächlichen Vorgänger.
   */
  async function sollAnlageGegenFremdschreiber(s: Buehne): Promise<string[]> {
    const verletzt: string[] = [];
    // Der Fremdschreiber ist absichtlich versionsunabhängig: ein Eintrag in eigener, offener
    // Transaktion über die Ablage des Kandidaten (das Tabellenschema ist in beiden Fassungen gleich).
    const fremd = new AuditService({ repo: new PgAuditRepo(s.pa) });
    let antwort: { statusCode: number; body: string; id?: string } | undefined;
    let lauf: Promise<void> | undefined;
    await withPgTx(s.pa, async (tx) => {
      await fremd.record({ actor: "vn", action: "vn.fremd", target: "offen" }, tx);
      lauf = s.b
        .inject({ method: "POST", url: "/api/kos", headers: s.headers, payload: KO("Fremd") })
        .then((r) => {
          antwort = {
            statusCode: r.statusCode,
            body: r.body.slice(0, 200),
            ...(r.statusCode === 201 ? { id: r.json().id as string } : {}),
          };
        });
      await warteAufSperre(s.db);
    });
    await lauf;
    if (antwort?.statusCode !== 201) {
      verletzt.push(`Anlage antwortete ${antwort?.statusCode}: ${antwort?.body}`);
    }
    const ohne = await s.pa.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM kos k
        WHERE (SELECT count(*) FROM audit a WHERE a.action = 'ko.created' AND a.target = k.id) <> 1`,
    );
    if ((ohne.rows[0]?.n ?? 0) !== 0) {
      verletzt.push(`Objekt ohne genau ein ko.created: ${ohne.rows[0]?.n}`);
    }
    verletzt.push(...(await ketteVerletzt(s.pa)));
    return verletzt;
  }

  /**
   * SOLL (beleg:1ea197ac, die Probe): weist die Datenbank `ko.created` ab, entsteht weder Objekt noch
   * Fassung noch Beleg.
   */
  async function sollErfassenOhneBeleg(s: Buehne): Promise<string[]> {
    const verletzt: string[] = [];
    const zaehle = async () =>
      (
        await s.pa.query<{ kos: number; versionen: number; audit: number }>(
          `SELECT (SELECT count(*) FROM kos)::int AS kos,
                  (SELECT count(*) FROM ko_versions)::int AS versionen,
                  (SELECT count(*) FROM audit)::int AS audit`,
        )
      ).rows[0];
    const vor = await zaehle();
    await s.pa.query("INSERT INTO vn_probe(ziel) VALUES ('audit:ko.created')");
    try {
      const res = await s.a.inject({
        method: "POST",
        url: "/api/kos",
        headers: s.headers,
        payload: KO("Abgewiesen"),
      });
      if (res.statusCode < 500) {
        verletzt.push(`Anlage antwortete ${res.statusCode} statt eines Fehlers`);
      }
    } finally {
      await s.pa.query("DELETE FROM vn_probe");
    }
    const nach = await zaehle();
    if (nach?.kos !== vor?.kos) {
      verletzt.push(`Objekt ohne Beleg im Bestand (kos ${vor?.kos} → ${nach?.kos})`);
    }
    if (nach?.versionen !== vor?.versionen) {
      verletzt.push(`Fassung ohne Beleg (ko_versions ${vor?.versionen} → ${nach?.versionen})`);
    }
    if (nach?.audit !== vor?.audit) {
      verletzt.push(`Auditzeilen ${vor?.audit} → ${nach?.audit}`);
    }
    return verletzt;
  }

  function melde(fall: string, s: Buehne, verletzt: string[]): void {
    process.stderr.write(
      `${PREFIX} ${s.name} · ${fall}: ${verletzt.length === 0 ? "keine Verletzung" : verletzt.join(" | ")}\n`,
    );
  }

  it("NACHHER Kandidat · Anlage gegen offenen Fremdschreiber: dieselbe Sollprüfung besteht", async () => {
    const s = nachher as Buehne;
    const verletzt = await sollAnlageGegenFremdschreiber(s);
    melde("Anlage gegen Fremdschreiber", s, verletzt);
    expect(verletzt).toEqual([]);
  });

  it("NACHHER Kandidat · Datenbank weist ko.created ab: dieselbe Sollprüfung besteht", async () => {
    const s = nachher as Buehne;
    const verletzt = await sollErfassenOhneBeleg(s);
    melde("ko.created abgewiesen", s, verletzt);
    expect(verletzt).toEqual([]);
  });

  it("NACHHER Kandidat · gleichzeitige Exporte: dieselbe Sollprüfung besteht", async () => {
    const s = nachher as Buehne;
    const verletzt = await sollGleichzeitigeExporte(s);
    melde("gleichzeitige Exporte", s, verletzt);
    expect(verletzt).toEqual([]);
  });
});
