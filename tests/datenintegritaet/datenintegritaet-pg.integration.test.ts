// ================================================================================================
// R-0846 / L6 und R-1437 / I10 — GEGEN ECHTES POSTGRES.
// ================================================================================================
//
//   F1 — Nach `migrate()` stehen beide Fremdschlüssel; ein zweiter Lauf ist folgenlos.
//   F2 — Eine Fassung und ein Beleg ohne Objekt weist die Datenbank ab (23503).
//   F3 — Die Endlöschung nimmt Fassungen und Belege mit; die Prüfspur bleibt und ist belegt.
//   F4 — Altbestand: verwaiste Zeilen aus der Zeit vor dem Schlüssel lassen den Start zu (NOT
//        VALID); der Bericht findet sie, die Bereinigung entfernt sie und validiert die Schlüssel.
//   F5 — Lücken: geschlossen ohne Bezug wird gezählt, ein Bezug ohne Objekt einzeln genannt; das
//        Schliessen über die Route speichert nur einen Bezug auf ein vorhandenes Objekt.
//   F6 — Prüfspur: ein `ko.*`-Ziel ohne Objekt und ohne `ko.purged` ist ein Widerspruch.
//   F7 — Waisen: nur ein Objekt ohne jeden Bezug und ausserhalb der Schutzfrist; ein Bezug im
//        Text, im Papierkorb oder eine laufende Frist schützt. Die Bereinigung entfernt genau sie.
//   B1 — Die begrenzte Prüfung kann nicht schreiben (READ ONLY).
//   B2 — Die Anweisungsgrenze greift; danach ist der Vorrat sauber.
//   B3 — Hängt eine Sitzung `idle in transaction`, beginnt die Prüfung nicht und nennt ihre PID.
//
// Läuft NUR unter `test:integration` (Testcontainers oder gesicherte KLARWERK_PG_TEST_URL). Ohne
// beides wird EHRLICH übersprungen; ein Überspringen ist kein Prüfbeleg.
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildPgServices } from "../../services/app/src/build-app";
import {
  bereinigeBestand,
  erhebeIntegritaet,
  ermittleWaisen,
} from "../../services/app/src/datenintegritaet";
import { createPool, migrate } from "../../services/app/src/db";
import {
  HaengendeSitzungError,
  begrenztePruefung,
  guardedLocalPgTestUrl,
  pgQueryable,
  withPgTx,
} from "../../services/db-tx";

const TAG = 24 * 60 * 60 * 1000;
const INSERT_REFERENZ = "INSERT INTO gaps(id, data) VALUES ($1, $2)";

describe("R-0846 / R-1437 · Datenintegrität und begrenzte Prüfung gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let url: string | undefined;
  let pool: Pool | undefined;
  let services: AppServices | undefined;
  const nebenpools: Pool[] = [];

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      url = localUrl;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      return;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          // Name nicht frei gewählt: s. `tests/app/job2354-drei-datenbanknamen.test.ts` (E7).
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        return;
      }
    }
    try {
      pool = createPool(url);
      await migrate(pool);
      services = buildPgServices(pool);
    } catch {
      process.stderr.write(
        "[KLARWERK] Datenintegritaet-Pg-Suite UEBERSPRUNGEN: keine Verbindung zur Testinstanz.\n",
      );
      await pool?.end().catch(() => undefined);
      pool = undefined;
    }
  }, 180_000);

  afterAll(async () => {
    for (const p of nebenpools) {
      await p.end().catch(() => undefined);
    }
    await pool?.end().catch(() => undefined);
    await container?.stop();
  });

  function bereit(ctx: { skip: () => void }): { p: Pool; s: AppServices } {
    if (!pool || !services) {
      ctx.skip();
      throw new Error("unreachable");
    }
    return { p: pool, s: services };
  }

  async function neuesObjekt(s: AppServices, text: string) {
    return s.ko.create({
      title: `Integrität ${randomUUID().slice(0, 8)}`,
      statement: text,
      type: "best_practice",
      category: "Instandhaltung",
      confidentiality: "intern",
      author: "integritaet",
    });
  }

  async function legeObjektAn(p: Pool, id: string, retainUntil: string): Promise<void> {
    const ref = {
      id,
      name: `${id}.txt`,
      mime: "text/plain",
      size: 4,
      kind: "document",
      createdAt: new Date(Date.now() - 60 * TAG).toISOString(),
      lifecycle: { purpose: "attachment", retainUntil },
    };
    await p.query("INSERT INTO objects(id, ref, data) VALUES ($1, $2, $3)", [
      id,
      JSON.stringify(ref),
      "data:text/plain;base64,dGVzdA==",
    ]);
  }

  it("F1 · beide Fremdschlüssel stehen, und ein zweiter migrate()-Lauf ist folgenlos", async (ctx) => {
    const { p } = bereit(ctx);
    await migrate(p);
    const r = await p.query<{ conname: string; confdeltype: string; condeferred: boolean }>(
      "SELECT conname, confdeltype, condeferred FROM pg_constraint WHERE conname = ANY($1::text[]) ORDER BY conname",
      [["ko_evidence_ko_fk", "ko_versions_ko_fk"]],
    );
    expect(r.rows.map((z) => z.conname)).toEqual(["ko_evidence_ko_fk", "ko_versions_ko_fk"]);
    for (const z of r.rows) {
      expect(z.confdeltype, `${z.conname}: ON DELETE CASCADE`).toBe("c");
      expect(z.condeferred, `${z.conname}: INITIALLY DEFERRED`).toBe(true);
    }
  });

  it("F2 · eine Fassung und ein Beleg ohne Objekt weist die Datenbank ab", async (ctx) => {
    const { p } = bereit(ctx);
    const geist = `ko-geist-${randomUUID()}`;
    await expect(
      p.query(
        "INSERT INTO ko_versions(ko_id,version,snapshot,at,author,note) VALUES ($1,1,'{}','x','x','x')",
        [geist],
      ),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      p.query(
        "INSERT INTO ko_evidence(id,ko_id,ko_version,kind,data,created_at) VALUES ($1,$2,1,'attachment','{}','x')",
        [`ev-${geist}`, geist],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("F3 · die Endlöschung nimmt Fassungen und Belege mit — die Prüfspur bleibt, belegt", async (ctx) => {
    const { p, s } = bereit(ctx);
    const ko = await neuesObjekt(s, "Wird endgelöscht.");
    const vorher = await p.query("SELECT 1 FROM ko_versions WHERE ko_id = $1", [ko.id]);
    expect(vorher.rowCount, "die Erstanlage schreibt Fassung 1").toBeGreaterThan(0);
    await s.ko.delete(ko.id, "integritaet", { hard: true });
    const fassungen = await p.query("SELECT 1 FROM ko_versions WHERE ko_id = $1", [ko.id]);
    const belege = await p.query("SELECT 1 FROM ko_evidence WHERE ko_id = $1", [ko.id]);
    expect(fassungen.rowCount).toBe(0);
    expect(belege.rowCount).toBe(0);
    const spur = await p.query<{ action: string }>(
      "SELECT action FROM audit WHERE target = $1 ORDER BY seq",
      [ko.id],
    );
    expect(spur.rows.map((z) => z.action)).toContain("ko.created");
    expect(spur.rows.map((z) => z.action)).toContain("ko.purged");
    const { ergebnis } = await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()));
    expect(ergebnis.pruefspur.ohneLoeschbeleg.map((e) => e.ziel)).not.toContain(ko.id);
    expect(ergebnis.pruefspur.endgeloeschtBelegt).toBeGreaterThan(0);
  });

  it("F4 · Altbestand mit Waisenzeilen startet, wird gemeldet, bereinigt und danach validiert", async (ctx) => {
    const { p } = bereit(ctx);
    const geist = `ko-alt-${randomUUID()}`;
    // Der Zustand VOR dieser Stufe: kein Schlüssel, eine verwaiste Fassung und ein Beleg.
    await p.query("ALTER TABLE ko_versions DROP CONSTRAINT IF EXISTS ko_versions_ko_fk");
    await p.query("ALTER TABLE ko_evidence DROP CONSTRAINT IF EXISTS ko_evidence_ko_fk");
    await p.query(
      "INSERT INTO ko_versions(ko_id,version,snapshot,at,author,note) VALUES ($1,1,'{}','x','x','x')",
      [geist],
    );
    await p.query(
      "INSERT INTO ko_evidence(id,ko_id,ko_version,kind,data,created_at) VALUES ($1,$2,1,'attachment','{}','x')",
      [`ev-${geist}`, geist],
    );
    // Der Start: migrate() legt die Schlüssel NOT VALID an und scheitert NICHT am Altbestand.
    await migrate(p);
    const vor = (await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()))).ergebnis;
    expect(vor.fremdschluessel.map((s) => s.zustand)).toEqual(["ungeprueft", "ungeprueft"]);
    expect(vor.fassungenOhneObjekt).toBeGreaterThan(0);
    expect(vor.belegeOhneObjekt).toBeGreaterThan(0);

    const ergebnis = await withPgTx(p, (tx) => bereinigeBestand(pgQueryable(tx), Date.now()));
    expect(ergebnis.fassungenEntfernt).toBeGreaterThan(0);
    expect(ergebnis.belegeEntfernt).toBeGreaterThan(0);
    expect([...ergebnis.validiert].sort()).toEqual(["ko_evidence_ko_fk", "ko_versions_ko_fk"]);

    const nach = (await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()))).ergebnis;
    expect(nach.fremdschluessel.map((s) => s.zustand)).toEqual(["gueltig", "gueltig"]);
    expect(nach.fassungenOhneObjekt).toBe(0);
    expect(nach.belegeOhneObjekt).toBe(0);
    // Ein weiterer Start lässt den validierten Schlüssel stehen.
    await migrate(p);
    const wieder = (await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()))).ergebnis;
    expect(wieder.fremdschluessel.map((s) => s.zustand)).toEqual(["gueltig", "gueltig"]);
  });

  it("F5 · Lücken: ohne Bezug gezählt, Bezug ohne Objekt genannt, die Route speichert nur echte Bezüge", async (ctx) => {
    const { p, s } = bereit(ctx);
    const ohne = `gap-ohne-${randomUUID()}`;
    const kaputt = `gap-kaputt-${randomUUID()}`;
    const basis = {
      question: "Integritätsfrage",
      status: "geschlossen",
      assignee: null,
      priority: "mittel",
      createdAt: new Date().toISOString(),
    };
    const vor = (await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()))).ergebnis;
    await p.query("INSERT INTO gaps(id, data) VALUES ($1, $2)", [
      ohne,
      JSON.stringify({ ...basis, id: ohne }),
    ]);
    await p.query("INSERT INTO gaps(id, data) VALUES ($1, $2)", [
      kaputt,
      JSON.stringify({ ...basis, id: kaputt, koId: "ko-gibt-es-nicht" }),
    ]);
    const nach = (await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()))).ergebnis;
    expect(nach.luecken.geschlossenOhneBezug).toBe(vor.luecken.geschlossenOhneBezug + 1);
    expect(nach.luecken.bezugOhneObjekt).toContainEqual({
      gapId: kaputt,
      koId: "ko-gibt-es-nicht",
    });

    // Die Route: ein offenes Wissensobjekt wird Bezug, eine erfundene Kennung nicht.
    const offen = `gap-offen-${randomUUID()}`;
    await p.query("INSERT INTO gaps(id, data) VALUES ($1, $2)", [
      offen,
      JSON.stringify({ ...basis, id: offen, status: "offen" }),
    ]);
    const ko = await neuesObjekt(s, "Beantwortet die Integritätsfrage.");
    const app = buildApp(s);
    try {
      const email = `integritaet-${randomUUID().slice(0, 8)}@x.de`;
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Integrität", email, password: "secret123" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email, password: "secret123" },
      });
      const headers = { authorization: `Bearer ${login.json().token}` };
      const falsch = await app.inject({
        method: "PUT",
        url: `/api/gaps/${offen}`,
        headers,
        payload: { close: true, koId: "ko-gibt-es-nicht" },
      });
      // Ohne Schliessrecht (nicht das erste Konto der Instanz) antwortet die Route 403 — dann
      // trägt der Fall nichts, und das soll sichtbar sein statt grün.
      expect(falsch.statusCode, falsch.body).toBe(400);
      // Nacharbeit 4: der alte Schliessweg ohne Bezug schliesst nicht mehr.
      const ohneBezug = await app.inject({
        method: "PUT",
        url: `/api/gaps/${offen}`,
        headers,
        payload: { close: true },
      });
      expect(ohneBezug.statusCode, ohneBezug.body).toBe(400);
      const nochOffen = await p.query<{ data: { status: string } }>(
        "SELECT data FROM gaps WHERE id = $1",
        [offen],
      );
      expect(nochOffen.rows[0]?.data.status).toBe("offen");
      const richtig = await app.inject({
        method: "PUT",
        url: `/api/gaps/${offen}`,
        headers,
        payload: { close: true, koId: ko.id },
      });
      expect(richtig.statusCode, richtig.body).toBe(200);
      const zeile = await p.query<{ data: { status: string; koId?: string } }>(
        "SELECT data FROM gaps WHERE id = $1",
        [offen],
      );
      expect(zeile.rows[0]?.data.status).toBe("geschlossen");
      expect(zeile.rows[0]?.data.koId).toBe(ko.id);
    } finally {
      await app.close();
    }
  });

  it("F6 · ein ko.*-Ziel ohne Objekt und ohne ko.purged ist ein Widerspruch", async (ctx) => {
    const { p, s } = bereit(ctx);
    const ziel = `ko-ohne-beleg-${randomUUID()}`;
    await s.audit.record({ actor: "integritaet", action: "ko.revised", target: ziel });
    const { ergebnis } = await begrenztePruefung(p, (q) => erhebeIntegritaet(q, Date.now()));
    expect(ergebnis.pruefspur.ohneLoeschbeleg).toContainEqual({ ziel, eintraege: 1 });
  });

  it("F7 · Waisen: nur ohne jeden Bezug und nach der Schutzfrist — und genau die räumt die Bereinigung", async (ctx) => {
    const { p, s } = bereit(ctx);
    const abgelaufen = new Date(Date.now() - TAG).toISOString();
    const laufend = new Date(Date.now() + 10 * TAG).toISOString();
    // Der Object-Store vergibt UUIDs; nur diese Form deckt der Verweisschutz (Nacharbeit 5).
    const waise = randomUUID();
    // Eine Waise mit anderer Kennungsform (Altbestand/Beispieldaten): gemeldet, aber behalten.
    const altWaise = `alt-waise-${randomUUID()}`;
    const imText = `obj-imtext-${randomUUID()}`;
    const imPapierkorb = `obj-papierkorb-${randomUUID()}`;
    const inFrist = `obj-frist-${randomUUID()}`;
    for (const id of [waise, altWaise, imText, imPapierkorb]) {
      await legeObjektAn(p, id, abgelaufen);
    }
    await legeObjektAn(p, inFrist, laufend);
    await neuesObjekt(s, `Siehe /api/objects/${imText}/raw im Text.`);
    const geloescht = await neuesObjekt(s, `Anhang /api/objects/${imPapierkorb}/raw.`);
    await s.ko.delete(geloescht.id, "integritaet");

    const { ergebnis } = await begrenztePruefung(p, (q) => ermittleWaisen(q, Date.now()));
    const ids = ergebnis.map((w) => w.id);
    expect(ids).toContain(waise);
    expect(ids).toContain(altWaise);
    expect(ids).not.toContain(imText);
    expect(ids).not.toContain(imPapierkorb);
    expect(ids).not.toContain(inFrist);

    const bereinigt = await withPgTx(p, (tx) => bereinigeBestand(pgQueryable(tx), Date.now()));
    expect(bereinigt.waisenEntfernt).toContain(waise);
    expect(bereinigt.waisenEntfernt).not.toContain(altWaise);
    expect(bereinigt.waisenBehalten).toContain(altWaise);
    const rest = await p.query<{ id: string }>(
      "SELECT id FROM objects WHERE id = ANY($1::text[]) ORDER BY id",
      [[waise, altWaise, imText, imPapierkorb, inFrist]],
    );
    const erwartet = [altWaise, imText, imPapierkorb, inFrist].sort();
    expect(rest.rows.map((z) => z.id).sort()).toEqual(erwartet);
  });

  // ----------------------------------------------------------------------------------------------
  // F8–F10 · Nacharbeit 4 (Ben B1): die Bereinigung gegen GLEICHZEITIGE Referenzschreiber.
  // ----------------------------------------------------------------------------------------------

  /** Ein eigener Schreiber-Vorrat mit genau einer Verbindung — damit seine PID feststeht. */
  async function schreiber(ctx: { skip: () => void }): Promise<{ pool: Pool; pid: number }> {
    if (!url) {
      ctx.skip();
      throw new Error("unreachable");
    }
    const pool = new Pool({ connectionString: url, max: 1 });
    nebenpools.push(pool);
    const r = await pool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    return { pool, pid: r.rows[0]?.pid ?? -1 };
  }

  /** Eine Lückenzeile, deren Fragetext die Objektkennung trägt — eine Referenz im Sinne des Scans. */
  function referenzzeile(gapId: string, objektId: string): [string, string] {
    return [
      gapId,
      JSON.stringify({
        id: gapId,
        question: `Siehe /api/objects/${objektId}/raw`,
        status: "offen",
        assignee: null,
        priority: "mittel",
        createdAt: new Date().toISOString(),
      }),
    ];
  }

  async function wartetAufSperre(p: Pool, pid: number): Promise<boolean> {
    for (let i = 0; i < 50; i++) {
      const r = await p.query("SELECT 1 FROM pg_locks WHERE pid = $1 AND NOT granted", [pid]);
      if ((r.rowCount ?? 0) > 0) {
        return true;
      }
      await new Promise((fertig) => setTimeout(fertig, 20));
    }
    return false;
  }

  async function relationssperrenVon(p: Pool, pid: number): Promise<number> {
    const r = await p.query(
      "SELECT 1 FROM pg_locks WHERE pid = $1 AND locktype = 'relation' AND mode = 'ShareLock'",
      [pid],
    );
    return r.rowCount ?? 0;
  }

  it("F8 · ein Schreiber im früheren Fenster wartet und wird nach dem Commit abgewiesen — kein Verweis auf das gelöschte Objekt", async (ctx) => {
    const { p } = bereit(ctx);
    const w = await schreiber(ctx);
    const waise = randomUUID();
    await legeObjektAn(p, waise, new Date(Date.now() - TAG).toISOString());
    let schreibAusgang: Promise<unknown> | undefined;
    let bereinigerPid = -1;

    const ergebnis = await withPgTx(p, async (tx) => {
      const q = pgQueryable(tx);
      const eigene = await q.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      bereinigerPid = eigene.rows[0]?.pid ?? -1;
      return bereinigeBestand(q, Date.now(), {
        nachReferenzscan: async (waisen) => {
          expect(waisen).toContain(waise);
          // Genau jetzt will ein Schreiber eine Referenz auf die Waise speichern.
          const zeile = referenzzeile(`gap-${waise}`, waise);
          schreibAusgang = w.pool.query(INSERT_REFERENZ, zeile).then(
            () => "geschrieben",
            (fehler: unknown) => fehler,
          );
          expect(await wartetAufSperre(p, w.pid), "Schreiber wartet an der Sperre").toBe(true);
        },
      });
    });
    expect(ergebnis.gesperrt).toContain("gaps");
    expect(ergebnis.gesperrt).toContain("objects");
    expect(ergebnis.waisenEntfernt).toContain(waise);

    // Nach dem Commit läuft der Schreiber weiter, prüft gegen den neuen Bestand und scheitert.
    expect(await schreibAusgang).toMatchObject({ code: "23503" });

    // DER ENDZUSTAND ist widerspruchsfrei: Objekt weg, Grabstein da, KEINE gespeicherte Referenz.
    const objekt = await p.query("SELECT 1 FROM objects WHERE id = $1", [waise]);
    expect(objekt.rowCount, "die Waise ist entfernt").toBe(0);
    const grabstein = await p.query("SELECT 1 FROM objekt_grabsteine WHERE id = $1", [waise]);
    expect(grabstein.rowCount, "ihr Grabstein steht").toBe(1);
    const referenz = await p.query("SELECT 1 FROM gaps WHERE id = $1", [`gap-${waise}`]);
    expect(referenz.rowCount, "keine Referenz auf das gelöschte Objekt").toBe(0);
    const irgendwo = await p.query("SELECT 1 FROM gaps WHERE strpos(data::text, $1) > 0", [waise]);
    expect(irgendwo.rowCount).toBe(0);
    expect(await relationssperrenVon(p, bereinigerPid), "Sperren nach dem Commit frei").toBe(0);

    // Auch ein späteres ÄNDERN einer bestehenden Zeile kann den Verweis nicht nachtragen.
    const [neuId, neuDaten] = referenzzeile(`gap-spaeter-${randomUUID()}`, "nichts");
    await p.query(INSERT_REFERENZ, [neuId, neuDaten]);
    const [, verweisDaten] = referenzzeile(neuId, waise);
    await expect(
      p.query("UPDATE gaps SET data = $2 WHERE id = $1", [neuId, verweisDaten]),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("F9 · ein Schreiber, der VOR der Bereinigung begann, wird abgewartet — seine Referenz schützt", async (ctx) => {
    const { p } = bereit(ctx);
    const w = await schreiber(ctx);
    const geschuetzt = randomUUID();
    await legeObjektAn(p, geschuetzt, new Date(Date.now() - TAG).toISOString());
    const client = await w.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(INSERT_REFERENZ, referenzzeile(`gap-${geschuetzt}`, geschuetzt));
      let fertig = false;
      const bereinigung = withPgTx(p, async (tx) => {
        const e = await bereinigeBestand(pgQueryable(tx), Date.now());
        fertig = true;
        return e;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(fertig, "die Bereinigung wartet auf den offenen Schreiber").toBe(false);
      await client.query("COMMIT");
      const ergebnis = await bereinigung;
      expect(ergebnis.waisenEntfernt).not.toContain(geschuetzt);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    const steht = await p.query("SELECT 1 FROM objects WHERE id = $1", [geschuetzt]);
    expect(steht.rowCount).toBe(1);
  });

  it("F10 · scheitert die Bereinigung, rollt sie zurück, gibt die Sperren frei und löscht nichts", async (ctx) => {
    const { p } = bereit(ctx);
    const w = await schreiber(ctx);
    const waise = randomUUID();
    await legeObjektAn(p, waise, new Date(Date.now() - TAG).toISOString());
    let schreibLauf: Promise<unknown> | undefined;
    let bereinigerPid = -1;

    await expect(
      withPgTx(p, async (tx) => {
        const q = pgQueryable(tx);
        const eigene = await q.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
        bereinigerPid = eigene.rows[0]?.pid ?? -1;
        return bereinigeBestand(q, Date.now(), {
          nachReferenzscan: async () => {
            schreibLauf = w.pool.query(INSERT_REFERENZ, referenzzeile(`gap-${waise}`, waise));
            expect(await wartetAufSperre(p, w.pid)).toBe(true);
            throw new Error("Bereinigung bricht ab");
          },
        });
      }),
    ).rejects.toThrow("Bereinigung bricht ab");

    await schreibLauf;
    expect(await relationssperrenVon(p, bereinigerPid), "Sperren nach dem Rollback frei").toBe(0);
    const steht = await p.query("SELECT 1 FROM objects WHERE id = $1", [waise]);
    expect(steht.rowCount, "nichts gelöscht").toBe(1);
    const referenz = await p.query("SELECT 1 FROM gaps WHERE id = $1", [`gap-${waise}`]);
    expect(referenz.rowCount, "der Schreiber kam nach dem Rollback durch").toBe(1);
  });

  it("B1 · die begrenzte Prüfung kann nicht schreiben", async (ctx) => {
    const { p } = bereit(ctx);
    await expect(
      begrenztePruefung(p, (q) =>
        q.query("INSERT INTO gaps(id, data) VALUES ('nie', '{}'::jsonb)"),
      ),
    ).rejects.toMatchObject({ code: "25006" });
    const nie = await p.query("SELECT 1 FROM gaps WHERE id = 'nie'");
    expect(nie.rowCount).toBe(0);
  });

  it("B2 · die Anweisungsgrenze greift, und der Vorrat bleibt sauber", async (ctx) => {
    const { p } = bereit(ctx);
    await expect(
      begrenztePruefung(p, (q) => q.query("SELECT pg_sleep(2)"), {
        anweisungMs: 100,
        sperreMs: 100,
        leerlaufMs: 1000,
      }),
    ).rejects.toMatchObject({ code: "57014" });
    const danach = await p.query<{ eins: number }>("SELECT 1 AS eins");
    expect(danach.rows[0]?.eins).toBe(1);
  });

  it("B3 · hängt eine Sitzung, beginnt die Prüfung nicht und nennt ihre PID", async (ctx) => {
    const { p } = bereit(ctx);
    if (!url) {
      ctx.skip();
      return;
    }
    const halter = new Pool({ connectionString: url, max: 1 });
    nebenpools.push(halter);
    const client = await halter.connect();
    try {
      await client.query("BEGIN");
      const sitzung = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      const pid = sitzung.rows[0]?.pid;
      let gerufen = false;
      const fehler = await begrenztePruefung(p, async () => {
        gerufen = true;
      }).catch((f: unknown) => f);
      expect(fehler).toBeInstanceOf(HaengendeSitzungError);
      expect((fehler as HaengendeSitzungError).befund.pids).toContain(pid);
      expect(gerufen).toBe(false);
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });
});
