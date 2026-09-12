// ==================================================================================================
// JOB 3668 — DERSELBE PAPIERKORB GEGEN ECHTES POSTGRESQL.
// ==================================================================================================
//
// WARUM ES DIESE DATEI BRAUCHT: `ablage-vertrag.test.ts` misst das VERHALTEN an der Speicherablage
// und PINNT für PostgreSQL nur den Anweisungstext. Ein Pin belegt, was der Adapter absetzt — nicht,
// dass PostgreSQL es so ausführt. Der Auftrag verlangt in §6(e) ausdrücklich, dass sich BEIDE
// Ablagen gleich verhalten, und genau das steht hier: dieselben Fälle, dieselben Erwartungen, nur
// mit `PgDraftRepo` gegen eine echte Datenbank.
//
// STATUS IN DIESER UMGEBUNG: NICHT AUSGEFÜHRT. Gemessen in Runde 2 (12.09.2026) durch den Lauf
// selbst — `npx vitest run --config vitest.integration.config.ts` auf diese Datei meldete
// `[KLARWERK] JOB 3668 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit
// verfügbar.` und `Tests 7 skipped (7)`. Der Skip ist SICHTBAR auf stderr — ein stiller Skip sähe
// aus wie ein bestandener Lauf. Was hier steht, ist damit ZUGESAGT, aber nicht gemessen; die
// Rückgabe der Runde nennt das ausdrücklich als Prüfgrenze und behauptet keinen grünen PG-Lauf.
//
// SIE IST STARTBAR, ohne dass eine Zeile geändert werden muss:
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/entwurfs-papierkorb/papierkorb-pg.integration.test.ts
//
// Der Datenbankname MUSS `test` enthalten — `guardedLocalPgTestUrl` weist sonst ab
// (`services/db-tx/src/pg-test-guard.ts`), weil diese Suite eine Tabelle anlegt und abräumt.
//
// DAS GERÜST IST DAS EINGEFÜHRTE, nicht ein zweites: lokale URL mit Vorrang, sonst Testcontainers,
// sonst sichtbarer Skip — wörtlich wie `services/capture/src/repo-pg.integration.test.ts`.
//
// KEINE SCHEMASTUFE, und das ist hier der Beleg dafür: diese Suite legt die Tabelle mit dem
// UNVERÄNDERTEN `CAPTURE_SCHEMA` an. Der ganze Papierkorb arbeitet auf der `data`-Spalte, die es
// seit der ersten Stunde gibt — es gibt nichts zu migrieren und deshalb auch keinen Rückweg.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CAPTURE_SCHEMA, PgDraftRepo } from "../../services/capture/src/repo-pg";
import type { Draft } from "../../services/capture/src/types";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

function entwurf(id: string, over: Partial<Draft> = {}): Draft {
  return {
    id,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
      confidentiality: "intern",
      origin: "studio",
      pendingSources: [{ label: "Prüfbericht", url: "https://x.invalid/p", objectId: "obj-1" }],
    },
    originalAuthor: "anna",
    lastEditor: "anna",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T09:00:00.000Z",
    ...over,
  };
}

describe("JOB 3668 · Entwurfs-Papierkorb gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let verfuegbar = false;

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      try {
        pool = new Pool({ connectionString: lokal });
        await pool.query("SELECT 1");
        verfuegbar = true;
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 3668 ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        verfuegbar = false;
      }
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
      verfuegbar = false;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        pool = new Pool({
          connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
        });
        verfuegbar = true;
      } catch {
        process.stderr.write(
          "[KLARWERK] JOB 3668 ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
        );
        verfuegbar = false;
      }
    }
    if (verfuegbar && pool) {
      await pool.query(CAPTURE_SCHEMA);
    }
  }, 180_000);

  afterAll(async () => {
    if (verfuegbar && pool) {
      await pool.query("DROP TABLE IF EXISTS drafts");
    }
    await pool?.end();
    await container?.stop();
  });

  const repo = (): PgDraftRepo => new PgDraftRepo(pool as Pool);
  const leeren = async () => {
    await (pool as Pool).query("DELETE FROM drafts");
  };

  it("P1 · Löschen ist umkehrbar: fort aus der lebenden Sicht, vollständig im Papierkorb", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    const vorher = entwurf("d-1");
    await r.insert(vorher);

    await r.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    expect(await r.findById("d-1")).toBeUndefined();
    const getrasht = await r.findTrashed("d-1");
    expect(getrasht?.deletedAt).toBe("2026-09-12T07:00:00.000Z");
    expect(getrasht?.deletedBy).toBe("anna");
    // Das ganze Dokument steht noch — `data || $2::jsonb` hat ergänzt, nicht ersetzt.
    expect(getrasht?.payload).toEqual(vorher.payload);

    const zurueck = await r.restore("d-1");
    expect(zurueck).toEqual(vorher);
    expect(await r.findById("d-1")).toEqual(vorher);
    expect(await r.findTrashed("d-1")).toBeUndefined();
  });

  it("P2 · Ein zweites Löschen verschiebt den Zeitpunkt nicht und löscht nicht hart", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    await r.insert(entwurf("d-1"));
    await r.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");
    await r.delete("d-1", "bodo", "2026-09-12T09:00:00.000Z");

    const getrasht = await r.findTrashed("d-1");
    expect(getrasht?.deletedAt).toBe("2026-09-12T07:00:00.000Z");
    expect(getrasht?.deletedBy).toBe("anna");
  });

  it("P3 · Endgültig löschen ist der zweite Griff — ein lebender Entwurf ist so nicht erreichbar", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    await r.insert(entwurf("d-1"));

    // RUNDE 2 — GENAU DIESE ZEILE IST IM ECHTEN POSTGRES-LAUF VOM 12.09. ROT GEWESEN: Sie erwartet
    // `false`, bekam aber `true` und löschte dabei den lebenden Entwurf, den sie zu schützen
    // behauptet. Der Test hatte recht und die Ablage unrecht — die Bedingung stand im Dienst, also
    // einen Schritt zu spät. Sie steht jetzt in der Anweisung selbst; die Zeile bleibt, wie sie
    // war, und ist zum ersten Mal eine Zusage statt einer Hoffnung.
    expect(await r.purge("d-1")).toBe(false);
    expect(await r.findById("d-1")).toBeDefined();

    await r.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");
    expect(await r.purge("d-1")).toBe(true);
    expect(await r.list()).toEqual([]);
    expect(await r.purge("d-1")).toBe(false);
  });

  it("P8 · Der VERBRAUCH nimmt einen lebenden Entwurf — er muss dafür nicht erst gelöscht werden", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    await r.insert(entwurf("d-1"));

    // Die Gegenrichtung zu P3, und sie ist genauso wichtig: Wäre der Verbrauch an den
    // Papierkorbstatus gebunden, müsste ein übernommener Entwurf erst „gelöscht" werden, um gehen
    // zu dürfen — und wäre dazwischen wiederherstellbar. Genau die Dublette, die dieser Auftrag
    // verhindert. `auchLebende` sagt an dieser einen Stelle ausdrücklich, was geschieht.
    expect(await r.purge("d-1", true)).toBe(true);
    expect(await r.list()).toEqual([]);
    expect(await r.findTrashed("d-1")).toBeUndefined();
  });

  it("P7 · Zurückholen gegen endgültig Löschen, gleichzeitig: genau einer gewinnt, keiner verliert Daten", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    const vorher = entwurf("d-1");
    await r.insert(vorher);
    await r.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    // ECHTER NEBENLAUF, nicht nachgestellt: zwei Anweisungen über denselben Pool, ohne `await`
    // dazwischen. Welche zuerst am Server ankommt, entscheidet PostgreSQL — die Zusage gilt für
    // BEIDE Ausgänge, und genau das ist der Punkt. In Runde 1 gab es einen dritten Ausgang:
    // beide gelingen, der Entwurf ist fort.
    const [entfernt, zurueck] = await Promise.all([r.purge("d-1"), r.restore("d-1")]);

    const bestand = await r.list();
    if (entfernt) {
      // Endgültig gelöscht hat gewonnen — dann darf `restore` NICHTS zurückgegeben haben.
      expect(zurueck).toBeUndefined();
      expect(bestand).toEqual([]);
    } else {
      // Zurückholen hat gewonnen — dann steht der Entwurf vollständig und lebendig da.
      expect(zurueck).toEqual(vorher);
      expect(await r.findById("d-1")).toEqual(vorher);
      expect(bestand).toHaveLength(1);
    }
    // Der eine Ausgang, den es nicht geben darf: „wiederhergestellt" gemeldet und trotzdem weg.
    expect(zurueck !== undefined && bestand.length === 0).toBe(false);
  });

  it("P4 · Der Papierkorb ist eingegrenzt: ein FREMDER Entwurf ist nicht darin sichtbar", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    await r.insert(entwurf("d-anna", { originalAuthor: "anna" }));
    await r.insert(entwurf("d-bodo", { originalAuthor: "bodo" }));
    await r.insert(entwurf("d-lebt", { originalAuthor: "anna" }));
    await r.delete("d-anna", "anna", "2026-09-12T07:00:00.000Z");
    await r.delete("d-bodo", "bodo", "2026-09-12T08:00:00.000Z");

    expect((await r.listTrashed("anna")).map((d) => d.id)).toEqual(["d-anna"]);
    // Ohne Eingrenzung die Admin-Sicht, jüngste Löschung zuerst.
    expect((await r.listTrashed()).map((d) => d.id)).toEqual(["d-bodo", "d-anna"]);
  });

  it("P5 · Kein Schreibweg holt einen getrashten Entwurf zurück ins Leben", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    const vorher = entwurf("d-1");
    await r.insert(vorher);
    await r.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    const versuch = { ...vorher, payload: { ...vorher.payload, title: "Untergeschoben" } };
    expect(await r.updateWennStand(versuch, vorher.updatedAt)).toBe(false);
    await r.update(versuch);

    expect(await r.findById("d-1")).toBeUndefined();
    expect((await r.findTrashed("d-1"))?.payload.title).toBe("Dichtungswechsel L4");
  });

  it("P6 · `list` trägt den Papierkorb weiter — der Anker eines getrashten Entwurfs zählt", async (ctx) => {
    if (!verfuegbar) {
      ctx.skip();
      return;
    }
    await leeren();
    const r = repo();
    await r.insert(entwurf("d-1"));
    await r.delete("d-1", "anna", "2026-09-12T07:00:00.000Z");

    expect((await r.list()).map((d) => d.id)).toEqual(["d-1"]);
    expect((await r.listByAuthor("anna")).map((d) => d.id)).toEqual(["d-1"]);
    expect((await r.list())[0]?.payload.pendingSources?.[0]?.objectId).toBe("obj-1");
  });
});
