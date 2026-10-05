// Aufnahme gesamt-auditprotokoll · VORHER/NACHHER GEGEN DEN TATSÄCHLICHEN PRODUKTSTAND (Ben,
// Nacharbeit 6).
//
// Die Kriterien zu beleg:6818bd52 und beleg:1ea197ac verlangen PostgreSQL-Tests, die VOR der
// Behebung fehlschlagen und danach bestehen. Diese Datei führt DIESELBEN fachlichen Sollprüfungen
// zweimal aus, jeweils auf einer frischen Datenbank mit dem Schema der jeweiligen Fassung:
//
//   VORHER   der Produktcode der Fassung `41fad46c` (Basis vor Lauf 3, letzte Fassung VOR der
//            Behebung, Vorfahr des Kandidaten). Er wird zur Laufzeit mit `git archive` aus dem
//            Prüfbaum entpackt (`services/`, `apps/web/src/`, `package.json`) und GELADEN — es ist
//            sein `buildPgServices`/`buildApp`/`migrate`, kein Nachbau. Die Kennung wird mit
//            `git rev-parse` vollständig aufgelöst und im Lauf ausgegeben (Fassungsbindung).
//   NACHHER  der Kandidat selbst (statische Importe unten).
//
// Erwartung: VORHER verletzt jede Sollprüfung FACHLICH (die Verletzungen werden benannt und
// geprüft), NACHHER verletzt keine. Ein Fehler beim Bereitstellen der alten Fassung (kein git, ein
// flacher Klon ohne `41fad46c`) lässt die VORHER-Fälle ROT werden — mit dem Grund „Prüfmittel fehlt";
// er wird nicht übersprungen und nicht als Produktbefund ausgegeben.
//
// FASSUNGSWAHL, ehrlich benannt: Ben meldete beide Befunde an den Lauf-2-Fassungen `758e76c1` und
// `d3c1bc09`. Diese sind von keinem Branch oder Tag des Repositories aus erreichbar und liegen deshalb
// auf keinem Prüfbaum vor; `41fad46c` ist die letzte erreichbare Fassung vor der Behebung. Den
// Exportweg (`GET /api/audit/export`, Auslöser von beleg:6818bd52) gibt es dort noch nicht. Der
// zugrunde liegende Fehler — zwei Schreiber berechnen dieselbe `seq`, der zweite scheitert am
// Primärschlüssel — wird deshalb am Anlageweg gemessen, der in BEIDEN Fassungen besteht: die Anlage
// gegen einen offenen Fremdschreiber (zugleich der gemeldete Auslöser von beleg:1ea197ac).
//
// Ergänzend (nicht Ersatz) bleibt `rot-kalibrierung.integration.test.ts`: dort der nachgebildete
// Altweg AM KANDIDATEN, einschliesslich des Exportwegs.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as kandidat from "../../services/app";
import { AuditService, PgAuditRepo, inspectChain } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";

const PREFIX = "[KLARWERK][gesamt-auditprotokoll vorher/nachher]";
const VORHER = "41fad46c";
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

/** Entpackt die Fassung und lädt ihren Produktcode. Wirft mit „Prüfmittel fehlt", wenn das nicht geht. */
async function ladeFassung(
  kennung: string,
): Promise<{ modul: AppModul; voll: string; ordner: string }> {
  let voll: string;
  let ordner: string;
  try {
    voll = git("rev-parse", "--verify", `${kennung}^{commit}`);
    ordner = mkdtempSync(join(tmpdir(), `kw-fassung-${kennung}-`));
    const archiv = join(ordner, "fassung.tar");
    git("archive", "--format=tar", "-o", archiv, voll, "services", "apps/web/src", "package.json");
    execFileSync("tar", ["-xf", archiv, "-C", ordner]);
  } catch (fehler) {
    throw new Error(
      `${PREFIX} Prüfmittel fehlt: die Fassung ${kennung} lässt sich im Prüfbaum nicht bereitstellen (git/Historie). ${String(fehler)}`,
    );
  }
  // Die Pakete der alten Fassung sind die des Prüfbaums (gleiche Abhängigkeiten, s. package.json).
  for (const teil of ["node_modules", "apps/web/node_modules"]) {
    if (existsSync(join(WURZEL, teil)) && !existsSync(join(ordner, teil))) {
      symlinkSync(join(WURZEL, teil), join(ordner, teil), "dir");
    }
  }
  const eintritt = join(ordner, "services/app/index.ts");
  const modul = (await import(/* @vite-ignore */ eintritt)) as AppModul;
  return { modul, voll, ordner };
}

interface Buehne {
  name: string;
  db: string;
  pa: Pool;
  a: FastifyInstance;
  b: FastifyInstance;
  headers: Record<string, string>;
}

describe("Vorher/Nachher auf PostgreSQL · dieselben Sollprüfungen an 41fad46c und am Kandidaten", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let basisUrl = "";
  let grund = "";
  const pools: Pool[] = [];
  const apps: FastifyInstance[] = [];
  const datenbanken: string[] = [];
  const ordner: string[] = [];
  let vorher: Buehne | undefined;
  let vorherFehler: unknown;
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
    return { name, db, pa, a, b, headers: { authorization: `Bearer ${login.json().token}` } };
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
      process.stderr.write(`${PREFIX} ÜBERSPRUNGEN — Grund: ${grund}\n`);
      return;
    }
    nachher = await buehne("nachher", kandidat as unknown as AppModul);
    try {
      const fassung = await ladeFassung(VORHER);
      ordner.push(fassung.ordner);
      process.stderr.write(`${PREFIX} VORHER-Fassung: ${VORHER} = ${fassung.voll}\n`);
      vorher = await buehne("vorher", fassung.modul);
    } catch (fehler) {
      vorherFehler = fehler;
    }
    try {
      process.stderr.write(`${PREFIX} NACHHER-Fassung (Kandidat): ${git("rev-parse", "HEAD")}\n`);
    } catch {
      process.stderr.write(`${PREFIX} NACHHER-Fassung: Kandidat (Kennung nicht lesbar)\n`);
    }
  }, 300_000);

  afterAll(async () => {
    for (const app of apps.splice(0)) {
      await app.close().catch(() => undefined);
    }
    for (const p of pools.splice(0)) {
      await p.end().catch(() => undefined);
    }
    for (const db of datenbanken.splice(0)) {
      await verwaltung?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await verwaltung?.end();
    await container?.stop();
    for (const o of ordner.splice(0)) {
      rmSync(o, { recursive: true, force: true });
    }
  });

  function datenbankDa(ctx: { skip: () => void }): void {
    if (!verwaltung) {
      ctx.skip();
    }
  }

  function vorherBuehne(): Buehne {
    if (!vorher) {
      throw vorherFehler instanceof Error
        ? vorherFehler
        : new Error(`${PREFIX} Prüfmittel fehlt: ${String(vorherFehler)}`);
    }
    return vorher;
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

  it("VORHER 41fad46c · Anlage gegen offenen Fremdschreiber: die Sollprüfung schlägt fachlich fehl", async (ctx) => {
    datenbankDa(ctx);
    const s = vorherBuehne();
    const verletzt = await sollAnlageGegenFremdschreiber(s);
    melde("Anlage gegen Fremdschreiber", s, verletzt);
    // Der gemeldete Befund: der zweite Schreiber scheitert an derselben `seq`, das Objekt bleibt
    // ohne `ko.created`.
    expect(verletzt).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Anlage antwortete 5\d\d/),
        expect.stringMatching(/^Objekt ohne genau ein ko\.created: [1-9]/),
      ]),
    );
  });

  it("NACHHER Kandidat · Anlage gegen offenen Fremdschreiber: dieselbe Sollprüfung besteht", async (ctx) => {
    datenbankDa(ctx);
    const s = nachher as Buehne;
    const verletzt = await sollAnlageGegenFremdschreiber(s);
    melde("Anlage gegen Fremdschreiber", s, verletzt);
    expect(verletzt).toEqual([]);
  });

  it("VORHER 41fad46c · Datenbank weist ko.created ab: die Sollprüfung schlägt fachlich fehl", async (ctx) => {
    datenbankDa(ctx);
    const s = vorherBuehne();
    const verletzt = await sollErfassenOhneBeleg(s);
    melde("ko.created abgewiesen", s, verletzt);
    expect(verletzt).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Objekt ohne Beleg im Bestand/)]),
    );
  });

  it("NACHHER Kandidat · Datenbank weist ko.created ab: dieselbe Sollprüfung besteht", async (ctx) => {
    datenbankDa(ctx);
    const s = nachher as Buehne;
    const verletzt = await sollErfassenOhneBeleg(s);
    melde("ko.created abgewiesen", s, verletzt);
    expect(verletzt).toEqual([]);
  });
});
