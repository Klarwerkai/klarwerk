// Aufnahme gesamt-auditprotokoll · Lauf 3 — Bens zwei Befunde aus Lauf 2, GEGEN ECHTES POSTGRESQL.
//
// B1 (beleg:6818bd52, Commit 758e76c1): gleichzeitige `GET /api/audit/export` vergaben dieselbe
//    `seq`. Auf PostgreSQL hielt der Primärschlüssel die Kette zwar ganz, der zweite Schreiber bekam
//    aber 500 (`audit_pkey`) — und zwei Instanzen gegen dieselbe Datenbank konnte die prozessinterne
//    Schreibfolge aus Lauf 2 gar nicht ordnen. Hier laufen die Exporte über ZWEI App-Instanzen mit je
//    eigenem Pool gegen DIESELBE Datenbank: alle 200, lückenlose und eindeutige Folge, jeder Eintrag
//    verweist auf die Prüfsumme seines tatsächlichen Vorgängers. Der choreografierte Fall zeigt, WO
//    der zweite Schreiber wartet: an der Kettensperre (`advisory`), nicht an `audit_pkey`.
//
// BEN-B1 (Lauf 3, Runde 1): dasselbe für die Validierung — Peer-Bewertung und Admin-Validierung.
//    Weist die Datenbank den Entscheidungsbeleg ab, bleiben Status, Vertrauen, Bewertung,
//    Zuweisungen und `validationDecisionRef` bitgleich.
//
// BEN-R3-B1 (Lauf 5): Gelb/Rot der selbst bewertenden verantwortlichen Person mit schon offener
//    Zuweisung hinterlässt eine OFFENE Nacharbeitsaufgabe und genau einen passenden Rückgabebeleg.
//
// B2 (beleg:1ea197ac, Commit d3c1bc09): Wissensobjekt und Auditeintrag werden gemeinsam
//    festgeschrieben oder gemeinsam verworfen. Der Ausfall ist ECHT: ein Trigger der Datenbank weist
//    den Eintrag (bzw. das Speichern am Objekt) ab — kein Test-Double im Dienst. Dazu der gemeldete
//    Auslöser selbst: eine Anlage gegen einen offenen Fremdschreiber (vorher 500, Objekt ohne
//    `ko.created`).
//
// Verdrahtung wie im Betrieb: `buildPgServices` + `migrate` auf einer frischen Wegwerfdatenbank.
// Auswahl der Datenbank wie `tests/pg-erstaufbau-konkurrenz/…`: lokale URL über die Sicherung,
// sonst Container, sonst sichtbarer Skip.
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices, createPool, migrate } from "../../services/app";
import { AuditService, PgAuditRepo, inspectChain } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";

const PREFIX = "[KLARWERK][gesamt-auditprotokoll L3]";
const DB = "klarwerk_test_auditprotokoll_l3";

function mitDatenbank(url: string, name: string): string {
  const treffer = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(url);
  if (!treffer) {
    throw new Error(`${PREFIX} die Verbindungszeichenkette trägt keinen lesbaren Datenbanknamen.`);
  }
  return `${treffer[1]}${name}${treffer[3]}`;
}

// Die Probe: ein echter Ausfall IN der Datenbank. `probe_ausfall` nennt, was abgewiesen wird —
// `audit:<action>` für einen Auditeintrag, `kos:update` für das Speichern einer Änderung am Objekt.
const PROBE_DDL = `
CREATE TABLE IF NOT EXISTS probe_ausfall (ziel text PRIMARY KEY);
CREATE OR REPLACE FUNCTION probe_audit_ausfall() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM probe_ausfall WHERE ziel = 'audit:' || NEW.action) THEN
    RAISE EXCEPTION 'Probe: Auditeintrag % abgewiesen', NEW.action;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS probe_audit ON audit;
CREATE TRIGGER probe_audit BEFORE INSERT ON audit FOR EACH ROW EXECUTE FUNCTION probe_audit_ausfall();
CREATE OR REPLACE FUNCTION probe_kos_ausfall() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM probe_ausfall WHERE ziel = 'kos:update') THEN
    RAISE EXCEPTION 'Probe: Speichern der Änderung abgewiesen';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS probe_kos ON kos;
CREATE TRIGGER probe_kos BEFORE UPDATE ON kos FOR EACH ROW EXECUTE FUNCTION probe_kos_ausfall();
`;

const KO = (titel: string) => ({
  confidentiality: "intern",
  title: titel,
  statement: `${titel} — Dichtung vor jedem Anlauf prüfen.`,
  type: "best_practice",
  category: "Instandhaltung",
});

interface Zeile {
  seq: number;
  prev_hash: string;
  hash: string;
  action: string;
  target: string;
}

describe("Aufnahme gesamt-auditprotokoll · Lauf 3 · Kette und Beleg gemeinsam (echtes PostgreSQL)", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let url = "";
  let poolA: Pool | undefined;
  let poolB: Pool | undefined;
  let appA: FastifyInstance | undefined;
  let appB: FastifyInstance | undefined;
  let headers: Record<string, string> = {};
  let servicesA: ReturnType<typeof buildPgServices> | undefined;
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
    url = mitDatenbank(basisUrl, DB);
    poolA = new Pool({ connectionString: url, max: 6 });
    poolB = new Pool({ connectionString: url, max: 6 });
    await migrate(poolA);
    await poolA.query(PROBE_DDL);
    // ZWEI Instanzen gegen DIESELBE Datenbank — die Lage, die eine prozessinterne Schreibfolge
    // nicht ordnen kann.
    servicesA = buildPgServices(poolA);
    appA = buildApp(servicesA);
    appB = buildApp(buildPgServices(poolB));
    await appA.ready();
    await appB.ready();
    const reg = await appA.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "l3@x.de", password: "secret123" },
    });
    expect(reg.statusCode, reg.body).toBe(201);
    const angelegt = reg.json() as { id?: string; user?: { id: string } };
    adminId = angelegt.user?.id ?? angelegt.id ?? "";
    const login = await appA.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "l3@x.de", password: "secret123" },
    });
    headers = { authorization: `Bearer ${login.json().token}` };
  }, 180_000);

  afterAll(async () => {
    await appA?.close().catch(() => undefined);
    await appB?.close().catch(() => undefined);
    await poolA?.end().catch(() => undefined);
    await poolB?.end().catch(() => undefined);
    await verwaltung?.query(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE)`).catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  function bereit(ctx: { skip: () => void }): {
    a: FastifyInstance;
    b: FastifyInstance;
    pa: Pool;
    pb: Pool;
  } {
    if (!verwaltung || !appA || !appB || !poolA || !poolB) {
      ctx.skip();
      throw new Error("unerreichbar");
    }
    return { a: appA, b: appB, pa: poolA, pb: poolB };
  }

  async function zeilen(p: Pool): Promise<Zeile[]> {
    return (
      await p.query<Zeile>("SELECT seq, prev_hash, hash, action, target FROM audit ORDER BY seq")
    ).rows;
  }

  /** Lückenlos, eindeutig, jeder Eintrag verweist auf die Prüfsumme seines tatsächlichen Vorgängers. */
  async function pruefeKette(p: Pool): Promise<void> {
    const z = await zeilen(p);
    expect(z.map((e) => e.seq)).toEqual(z.map((_, i) => i + 1));
    z.forEach((e, i) => {
      if (i > 0) {
        expect(e.prev_hash, `seq ${e.seq}`).toBe(z[i - 1]?.hash);
      }
    });
    const bericht = inspectChain(await new PgAuditRepo(p).all());
    expect(bericht.linkageBreaks).toBe(0);
    expect(bericht.ok).toBe(true);
  }

  async function probe(p: Pool, ziele: string[]): Promise<void> {
    await p.query("DELETE FROM probe_ausfall");
    for (const ziel of ziele) {
      await p.query("INSERT INTO probe_ausfall(ziel) VALUES ($1)", [ziel]);
    }
  }

  async function warteAufSperre(art: string): Promise<number> {
    const v = verwaltung as Pool;
    const frist = Date.now() + 20_000;
    while (Date.now() < frist) {
      const res = await v.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = $1 AND wait_event_type = 'Lock' AND wait_event = $2`,
        [DB, art],
      );
      const n = res.rows[0]?.n ?? 0;
      if (n >= 1) {
        return n;
      }
      await new Promise((weiter) => setTimeout(weiter, 50));
    }
    throw new Error(`${PREFIX} nach 20 s wartete niemand an einer Sperre der Art ${art}.`);
  }

  it("B1 · zwölf gleichzeitige Exporte über zwei Instanzen: alle 200, lückenlose eindeutige Folge, kein Kettenbruch", async (ctx) => {
    const { a, b, pa } = bereit(ctx);
    const vorher = (await zeilen(pa)).length;
    const antworten = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 === 0 ? a : b).inject({ method: "GET", url: "/api/audit/export", headers }),
      ),
    );
    expect(
      antworten.map((r) => r.statusCode),
      antworten.map((r) => r.body.slice(0, 200)).join("\n"),
    ).toEqual(Array(12).fill(200));
    const z = await zeilen(pa);
    expect(z.length).toBe(vorher + 12);
    expect(z.slice(vorher).every((e) => e.action === "audit.exported")).toBe(true);
    await pruefeKette(pa);
  });

  it("B1 · choreografiert: der zweite Schreiber wartet an der Kettensperre und hängt danach an — kein audit_pkey", async (ctx) => {
    const { pa, pb } = bereit(ctx);
    const auditA = new AuditService({ repo: new PgAuditRepo(pa) });
    const auditB = new AuditService({ repo: new PgAuditRepo(pb) });
    let bSeq: number | undefined;
    let bFehler: unknown;
    let lauf: Promise<void> | undefined;
    let aSeq = 0;
    await withPgTx(pa, async (tx) => {
      aSeq = (await auditA.record({ actor: "l3", action: "l3.a", target: "offen" }, tx)).seq;
      lauf = auditB.record({ actor: "l3", action: "l3.b", target: "daneben" }).then(
        (e) => {
          bSeq = e.seq;
        },
        (f) => {
          bFehler = f;
        },
      );
      // B hängt NACHWEISLICH an der Beratungssperre, solange A offen ist.
      expect(await warteAufSperre("advisory")).toBeGreaterThanOrEqual(1);
    });
    await lauf;
    expect(bFehler).toBeUndefined();
    expect(bSeq).toBe(aSeq + 1);
    await pruefeKette(pa);
  });

  it("B2 · gemeldeter Auslöser: Anlage gegen einen offenen Fremdschreiber → 201 und genau ein ko.created", async (ctx) => {
    const { a, b, pa } = bereit(ctx);
    const auditA = new AuditService({ repo: new PgAuditRepo(pa) });
    let antwort: { statusCode: number; body: string; id?: string } | undefined;
    let lauf: Promise<void> | undefined;
    await withPgTx(pa, async (tx) => {
      await auditA.record({ actor: "l3", action: "l3.fremd", target: "offen" }, tx);
      lauf = b
        .inject({ method: "POST", url: "/api/kos", headers, payload: KO("Fremdschreiber") })
        .then((r) => {
          antwort = {
            statusCode: r.statusCode,
            body: r.body.slice(0, 300),
            ...(r.statusCode === 201 ? { id: r.json().id as string } : {}),
          };
        });
      expect(await warteAufSperre("advisory")).toBeGreaterThanOrEqual(1);
    });
    await lauf;
    expect(antwort?.statusCode, JSON.stringify(antwort)).toBe(201);
    const id = antwort?.id as string;
    const belege = await pa.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE action = 'ko.created' AND target = $1",
      [id],
    );
    expect(belege.rows[0]?.n).toBe(1);
    // Jedes Objekt im Bestand trägt genau einen ko.created.
    const ohne = await pa.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM kos k
        WHERE (SELECT count(*) FROM audit a WHERE a.action = 'ko.created' AND a.target = k.id) <> 1`,
    );
    expect(ohne.rows[0]?.n).toBe(0);
    // Die frei laufende Variante über beide Instanzen: jede Anlage 201 mit genau einem Beleg.
    const frei = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        (i % 2 === 0 ? a : b).inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: KO(`Parallel ${i}`),
        }),
      ),
    );
    expect(frei.map((r) => r.statusCode)).toEqual(Array(6).fill(201));
    const ohneNachher = await pa.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM kos k
        WHERE (SELECT count(*) FROM audit a WHERE a.action = 'ko.created' AND a.target = k.id) <> 1`,
    );
    expect(ohneNachher.rows[0]?.n).toBe(0);
    await pruefeKette(pa);
  });

  it("B2 · Erfassen: weist die Datenbank ko.created ab, entsteht weder Objekt noch Fassung noch Beleg", async (ctx) => {
    const { a, pa } = bereit(ctx);
    const zaehle = async () =>
      (
        await pa.query<{
          kos: number;
          versionen: number;
          audit: number;
          projektionen: number;
          belegzeilen: number;
        }>(
          `SELECT (SELECT count(*) FROM kos)::int AS kos,
                  (SELECT count(*) FROM ko_versions)::int AS versionen,
                  (SELECT count(*) FROM audit)::int AS audit,
                  (SELECT count(*) FROM ko_search_projections)::int AS projektionen,
                  (SELECT count(*) FROM ko_evidence)::int AS belegzeilen`,
        )
      ).rows[0];
    const vorher = await zaehle();
    await probe(pa, ["audit:ko.created"]);
    try {
      const res = await a.inject({
        method: "POST",
        url: "/api/kos",
        headers,
        payload: KO("Abgewiesen"),
      });
      expect(res.statusCode, res.body).toBe(500);
    } finally {
      await probe(pa, []);
    }
    expect(await zaehle()).toEqual(vorher);
    const titel = await pa.query("SELECT 1 FROM kos WHERE data->>'title' = 'Abgewiesen'");
    expect(titel.rowCount).toBe(0);
    await pruefeKette(pa);
  });

  // Lauf 5 (BEN-L5-R3-B3, Nacharbeit 2): jede Anlage über `POST /api/kos` reiht eine KI-Prüfung ein,
  // die NACH der Antwort `aiCheck` an derselben Objektzeile fortschreibt (pending → failed ohne
  // Modell). Lief sie während eines Vorher/Nachher-Vergleichs, brach dieser ab, ohne dass am
  // Rollback etwas falsch war; lief sie während einer `kos:update`-Probe, scheiterte stattdessen
  // ihr eigenes Schreiben. Deshalb beginnt jeder Fall mit Vergleich oder Probe erst, wenn dieser
  // zweite Schreiber fertig ist — die Vergleiche der ganzen Zeile bleiben unverändert streng.
  async function kiPruefungFertig(id: string): Promise<void> {
    await (servicesA as ReturnType<typeof buildPgServices>).aiCheckWorker?.idle();
    const nachKi = await (poolA as Pool).query<{ data: { aiCheck?: { status?: string } } }>(
      "SELECT data FROM kos WHERE id=$1",
      [id],
    );
    expect(nachKi.rows[0]?.data.aiCheck?.status, "KI-Prüfung abgeschlossen").not.toBe("pending");
  }

  it("B2 · Ändern: weist die Datenbank den Beleg ab, bleibt das Objekt unverändert (Kommentar, Vertraulichkeit)", async (ctx) => {
    const { a, pa } = bereit(ctx);
    const id = (
      await a.inject({ method: "POST", url: "/api/kos", headers, payload: KO("Ändern") })
    ).json().id as string;
    await kiPruefungFertig(id);
    const stand = async () =>
      (
        await pa.query<{ data: Record<string, unknown> }>("SELECT data FROM kos WHERE id = $1", [
          id,
        ])
      ).rows[0]?.data;
    const vorher = await stand();
    const auditVorher = (await zeilen(pa)).length;
    await probe(pa, ["audit:ko.commented", "audit:ko.confidentiality"]);
    try {
      const kommentar = await a.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "comment", text: "Gilt das auch für L5?" },
      });
      expect(kommentar.statusCode).toBeGreaterThanOrEqual(500);
      const stufe = await a.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(stufe.statusCode).toBeGreaterThanOrEqual(500);
    } finally {
      await probe(pa, []);
    }
    // Bitgleich — auch die rowVersion ist nicht geklettert: es wurde nichts festgeschrieben.
    expect(await stand()).toEqual(vorher);
    expect((await zeilen(pa)).length).toBe(auditVorher);
    await pruefeKette(pa);
  });

  it("B2 · umgekehrt: weist die Datenbank das Speichern der Änderung ab, entsteht kein Beleg", async (ctx) => {
    const { a, pa } = bereit(ctx);
    const id = (
      await a.inject({ method: "POST", url: "/api/kos", headers, payload: KO("Umgekehrt") })
    ).json().id as string;
    await kiPruefungFertig(id);
    const auditVorher = await zeilen(pa);
    await probe(pa, ["kos:update"]);
    try {
      const stufe = await a.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(stufe.statusCode).toBeGreaterThanOrEqual(500);
    } finally {
      await probe(pa, []);
    }
    // Bis Lauf 3 lief `ko.confidentiality` VOR dem Speichern und in eigener Transaktion — hier
    // stand danach ein Beleg für eine Stufe, die nie gespeichert wurde.
    expect(await zeilen(pa)).toEqual(auditVorher);
    const gespeichert = await pa.query<{ stufe: string }>(
      "SELECT data->>'confidentiality' AS stufe FROM kos WHERE id = $1",
      [id],
    );
    expect(gespeichert.rows[0]?.stufe).toBe("intern");
  });

  // --------------------------------------------------------------------------------------------
  // BEN-B1 · Validierung und Entscheidungsbeleg gemeinsam oder gar nicht.
  // --------------------------------------------------------------------------------------------
  async function validierungsStand(p: Pool, id: string) {
    const ko = await p.query<{ data: Record<string, unknown> }>(
      "SELECT data FROM kos WHERE id=$1",
      [id],
    );
    const bewertungen = await p.query("SELECT 1 FROM ratings WHERE ko_id=$1", [id]);
    const zuweisungen = await p.query<{ data: unknown }>(
      "SELECT data FROM assignments WHERE ko_id=$1 ORDER BY user_id",
      [id],
    );
    return {
      ko: ko.rows[0]?.data,
      bewertungen: bewertungen.rowCount,
      zuweisungen: zuweisungen.rows.map((z) => z.data),
      audit: (await zeilen(p)).length,
    };
  }

  async function offenesObjekt(a: FastifyInstance, titel: string): Promise<string> {
    // Eine Stimme genügt — so validiert schon die erste grüne Bewertung (Bens Gegenprobe).
    await (servicesA as ReturnType<typeof buildPgServices>).validation.setDefaultNeededValidations(
      1,
      "l3",
    );
    const res = await a.inject({ method: "POST", url: "/api/kos", headers, payload: KO(titel) });
    expect(res.statusCode, res.body).toBe(201);
    const id = res.json().id as string;
    await kiPruefungFertig(id);
    return id;
  }

  for (const fall of [
    {
      name: "Peer-Bewertung Grün (ko.rated)",
      ziele: ["audit:ko.rated"],
      payload: { action: "rate", verdict: "up" },
    },
    {
      name: "Peer-Bewertung Rot (ko.returned-to-*)",
      ziele: ["audit:ko.returned-to-author", "audit:ko.returned-to-owner"],
      payload: { action: "rate", verdict: "down" },
    },
    {
      name: "Admin-Validierung (ko.admin-validated)",
      ziele: ["audit:ko.admin-validated"],
      payload: { action: "admin-validate" },
    },
  ]) {
    it(`BEN-B1 · ${fall.name}: weist die Datenbank den Entscheidungsbeleg ab, bleibt alles, wie es war`, async (ctx) => {
      const { a, pa } = bereit(ctx);
      const id = await offenesObjekt(a, `Validierung ${fall.name}`);
      const vorher = await validierungsStand(pa, id);
      expect(vorher.ko?.status).toBe("offen");
      await probe(pa, fall.ziele);
      try {
        const res = await a.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers,
          payload: fall.payload,
        });
        expect(res.statusCode, res.body).toBeGreaterThanOrEqual(500);
      } finally {
        await probe(pa, []);
      }
      // Bitgleich: Status, Vertrauen, rowVersion, kein validationDecisionRef, keine Bewertung,
      // keine geänderte Zuweisung, kein Auditeintrag.
      expect(await validierungsStand(pa, id)).toEqual(vorher);
      await pruefeKette(pa);

      // Gegenprobe ohne Ausfall: dieselbe Handlung wirkt — mit Beleg und Verweis darauf.
      const ok = await a.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: fall.payload,
      });
      expect(ok.statusCode, ok.body).toBe(200);
      const nachher = await validierungsStand(pa, id);
      const ref = nachher.ko?.validationDecisionRef as { auditSeq: number; auditHash: string };
      const eintrag = await pa.query<{ hash: string }>("SELECT hash FROM audit WHERE seq=$1", [
        ref.auditSeq,
      ]);
      expect(eintrag.rows[0]?.hash).toBe(ref.auditHash);
      await pruefeKette(pa);
    });
  }

  // --------------------------------------------------------------------------------------------
  // BEN-R3-B1 · Gelb/Rot der selbst bewertenden verantwortlichen Person mit SCHON OFFENER
  // Zuweisung. `rate` erledigt sie in der Transaktion; die Rückgabe muss diesen Stand sehen und
  // wieder öffnen. Vorher las sie über den Pool „offen", unterließ das Wiederöffnen, und die
  // Transaktion schrieb „erledigt" fest — neben einem `ko.returned-to-*`.
  // --------------------------------------------------------------------------------------------
  for (const verdict of ["down", "warn"]) {
    it(`BEN-R3-B1 · ${verdict} mit schon offener Zuweisung: offene Nacharbeit und passender Rückgabebeleg`, async (ctx) => {
      const { a, pa } = bereit(ctx);
      const id = await offenesObjekt(a, `Rückgabe offen ${verdict}`);
      await (servicesA as ReturnType<typeof buildPgServices>).validation.assign(
        id,
        [adminId],
        adminId,
      );
      expect((await validierungsStand(pa, id)).zuweisungen).toEqual([
        expect.objectContaining({ userId: adminId, status: "open" }),
      ]);
      const res = await a.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "rate", verdict },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect((await validierungsStand(pa, id)).zuweisungen).toEqual([
        expect.objectContaining({ userId: adminId, status: "open" }),
      ]);
      const belege = await pa.query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM audit
          WHERE target = $1 AND action IN ('ko.returned-to-author', 'ko.returned-to-owner')`,
        [id],
      );
      expect(belege.rowCount).toBe(1);
      expect(belege.rows[0]?.payload).toEqual(
        expect.objectContaining({ verdict, responsible: adminId }),
      );
      await pruefeKette(pa);
    });
  }

  // --------------------------------------------------------------------------------------------
  // BEN-R2-B1 · gleichzeitige Peer-Bewertungen über ZWEI Instanzen — die Validierungsregeln halten.
  // Die Stimmenlage wird in der Schreibklammer bestimmt; verliert eine Transaktion den
  // Compare-and-Set an die andere Instanz, rollt sie zurück und rechnet mit der festgeschriebenen
  // fremden Stimme neu.
  // --------------------------------------------------------------------------------------------
  let zweiteKopf: Record<string, string> | undefined;
  async function zweitePrueferin(a: FastifyInstance): Promise<Record<string, string>> {
    if (zweiteKopf) {
      return zweiteKopf;
    }
    const s = servicesA as ReturnType<typeof buildPgServices>;
    const zweite = await s.auth.register({
      name: "Prüferin",
      email: "l3-zwei@x.de",
      password: "secret123",
    });
    await s.auth.approveUser(zweite.id, adminId);
    await s.auth.changeRole(zweite.id, "controller", adminId);
    const login = await a.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "l3-zwei@x.de", password: "secret123" },
    });
    zweiteKopf = { authorization: `Bearer ${login.json().token}` };
    return zweiteKopf;
  }

  for (const fall of [
    { name: "up + up, Quorum 2", needed: 2, stimmen: ["up", "up"], status: "validiert", trust: 99 },
    { name: "down + up, Quorum 1", needed: 1, stimmen: ["down", "up"], status: "offen", trust: 0 },
  ]) {
    it(`BEN-R2-B1 · ${fall.name} gleichzeitig über zwei Instanzen → ${fall.status}/${fall.trust}`, async (ctx) => {
      const { a, b, pa } = bereit(ctx);
      const zweite = await zweitePrueferin(a);
      await (
        servicesA as ReturnType<typeof buildPgServices>
      ).validation.setDefaultNeededValidations(fall.needed, "l3");
      const id = (
        await a.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: KO(`Parallel ${fall.name}`),
        })
      ).json().id as string;
      const antworten = await Promise.all([
        a.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers,
          payload: { action: "rate", verdict: fall.stimmen[0] },
        }),
        b.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers: zweite,
          payload: { action: "rate", verdict: fall.stimmen[1] },
        }),
      ]);
      expect(
        antworten.map((r) => r.statusCode),
        antworten.map((r) => r.body.slice(0, 200)).join("\n"),
      ).toEqual([200, 200]);
      const stand = await validierungsStand(pa, id);
      expect({ status: stand.ko?.status, trust: stand.ko?.trust }).toEqual({
        status: fall.status,
        trust: fall.trust,
      });
      expect(stand.bewertungen).toBe(2);
      const belege = await pa.query(
        "SELECT 1 FROM audit WHERE action = 'ko.rated' AND target = $1",
        [id],
      );
      expect(belege.rowCount).toBe(2);
      await pruefeKette(pa);
    });
  }
});
