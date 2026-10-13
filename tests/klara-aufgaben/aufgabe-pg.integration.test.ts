// ================================================================================================
// KLARA 07 (produkt:20261008:klara-aufgaben) · PERSÖNLICHE AUFGABEN GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `aufgabe-am-server.test.ts` misst an der Speicherfassung. Dass eine Aufgabe samt Bezug, Ort,
// Priorität, Status und Fassung einen NEUSTART übersteht (das ist „erneute Anmeldung" am Server),
// dass ein fremdes Konto nichts liest, ändert oder löscht, dass zwei GLEICHZEITIGE Anlagen desselben
// Vorgangs genau eine Zeile ergeben (eindeutiger Index) und zwei gleichzeitige Änderungen derselben
// Fassung nicht beide gewinnen, ist erst hier belegt: dieselbe Ablage (`PgKlaraAufgabeRepo`), das
// ausgeführte `migrate()` mit `KLARA_AUFGABE_SCHEMA`, ein neuer Pool je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { KlaraAufgabeDienst, PgKlaraAufgabeRepo } from "../../services/app/src/klara-aufgabe";
import { KlaraNotizDienst, PgKlaraNotizRepo } from "../../services/app/src/klara-notiz";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-aufgabe-anna";
const BERT = "u-pg-aufgabe-bert";
const CARL = "u-pg-aufgabe-carl";
const BEZUG = {
  pfad: "/wissen/ko-presse-4",
  seitenName: "Lesen",
  objekt: "Ölwechsel Presse 4",
  koId: "ko-presse-4",
  fassung: 3,
  absatz: 2,
};

describe("Klara 07 · persönliche Aufgaben gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  let uhr = Date.parse("2026-10-12T08:00:00.000Z");
  let vorgaenge = 0;

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  function jetzt(): number {
    uhr += 1_000;
    return uhr;
  }

  /** Ein frischer Dienst auf einem frischen Pool — so sieht ein Neustart des Servers aus. */
  function neuerDienst(): KlaraAufgabeDienst {
    const pool = neuePool();
    return new KlaraAufgabeDienst({
      repo: new PgKlaraAufgabeRepo(pool),
      notizen: new PgKlaraNotizRepo(pool),
      jetzt,
    });
  }

  function vorgang(): string {
    vorgaenge += 1;
    return `pg-aufgabe-${String(vorgaenge).padStart(4, "0")}`;
  }

  async function notiz(konto: string, inhalt: string, titel: string): Promise<string> {
    const { notiz: n } = await new KlaraNotizDienst({
      repo: new PgKlaraNotizRepo(neuePool()),
      jetzt,
    }).lege(konto, { vorgang: vorgang(), weg: "geschrieben", inhalt, titel, objektbezug: BEZUG });
    return n.id;
  }

  async function zeilen(kontoId: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_aufgaben WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? -1;
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(
        "KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr) — kein Container-Rückfall",
      );
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error("Weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar", {
          cause,
        });
      }
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    const pool = createPool(url);
    try {
      // Zweimal: die Stufe ist wiederholbar und lässt den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      await pool.query("DELETE FROM klara_aufgaben WHERE konto_id = ANY($1)", [[ANNA, BERT]]);
      await pool.query("DELETE FROM klara_notizen WHERE konto_id = ANY($1)", [[ANNA, BERT]]);
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end();
    }
    await container?.stop();
  });

  it("K1/K2 · Bezug, Ort, Priorität, Status und Fassung überstehen den Neustart", async () => {
    const notizId = await notiz(ANNA, "Ölstand nur bei Stillstand prüfen.", "Ölstand Presse 4");
    const { aufgabe } = await neuerDienst().lege(ANNA, {
      vorgang: vorgang(),
      weg: "notiz",
      quelle: { notizId },
    });
    expect(aufgabe).toMatchObject({
      titel: "Ölstand Presse 4",
      bezug: { art: "notiz", notizId, notizTitel: "Ölstand Presse 4" },
      bereich: "persoenlich",
      status: "offen",
      fassung: 1,
    });
    expect(await neuerDienst().hole(ANNA, aufgabe.id)).toEqual(aufgabe);

    await neuerDienst().aendere(ANNA, aufgabe.id, { fassung: 1, prioritaet: "hoch" });
    await neuerDienst().aendere(ANNA, aufgabe.id, { fassung: 2, titel: "Ölstand P4 prüfen" });
    const { aufgabe: erledigt } = await neuerDienst().aendere(ANNA, aufgabe.id, {
      fassung: 3,
      status: "erledigt",
    });
    const nachNeustart = await neuerDienst().hole(ANNA, aufgabe.id);
    expect(nachNeustart).toEqual(erledigt);
    expect(nachNeustart).toMatchObject({
      titel: "Ölstand P4 prüfen",
      prioritaet: "hoch",
      status: "erledigt",
      fassung: 4,
      objektbezug: BEZUG,
    });
    expect(nachNeustart.erledigtAm).not.toBeNull();
    // Die Liste nach dem Neustart: auch mit Statusfilter aus der Datenbank.
    expect((await neuerDienst().liste(ANNA, "erledigt")).map((a) => a.id)).toEqual([aufgabe.id]);
    expect(await neuerDienst().liste(ANNA, "offen")).toEqual([]);
    // Eine veraltete Fassung aus einem zweiten „Server" überschreibt nicht still.
    await expect(
      neuerDienst().aendere(ANNA, aufgabe.id, { fassung: 2, titel: "Aus Tab B" }),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    expect((await neuerDienst().hole(ANNA, aufgabe.id)).titel).toBe("Ölstand P4 prüfen");
  });

  it("K3 · ein fremdes Konto liest, ändert und löscht nichts — auch nicht aus fremder Notiz", async () => {
    const notizId = await notiz(BERT, "Nur für Bert", "Berts Notiz");
    const { aufgabe } = await neuerDienst().lege(BERT, {
      vorgang: vorgang(),
      weg: "notiz",
      quelle: { notizId },
    });
    const vorher = await zeilen(BERT);
    await expect(neuerDienst().hole(ANNA, aufgabe.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      neuerDienst().aendere(ANNA, aufgabe.id, { fassung: 1, status: "erledigt" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await neuerDienst().loesche(ANNA, aufgabe.id)).toBe(false);
    expect((await neuerDienst().liste(ANNA, undefined)).map((a) => a.id)).not.toContain(aufgabe.id);
    // Aus Berts Notiz kann Anna keine Aufgabe machen.
    await expect(
      neuerDienst().lege(ANNA, { vorgang: vorgang(), weg: "notiz", quelle: { notizId } }),
    ).rejects.toMatchObject({ status: 404, grund: "quelle_unbekannt" });
    expect(await zeilen(BERT)).toBe(vorher);
    expect((await neuerDienst().hole(BERT, aufgabe.id)).status).toBe("offen");
  });

  it("K4 · fünf gleichzeitige Anlagen desselben Vorgangs auf fünf Pools: genau eine Zeile", async () => {
    const notizId = await notiz(ANNA, "Einmal, auch bei fünf Versuchen", "Fünf Versuche");
    const v = vorgang();
    const vorher = await zeilen(ANNA);
    const ergebnisse = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        neuerDienst().lege(ANNA, { vorgang: v, weg: "notiz", quelle: { notizId } }),
      ),
    );
    expect(new Set(ergebnisse.map((r) => r.aufgabe.id)).size).toBe(1);
    expect(ergebnisse.filter((r) => !r.wiederholt)).toHaveLength(1);
    expect(await zeilen(ANNA)).toBe(vorher + 1);
  });

  it("K4 · zwei gleichzeitige, verschiedene Änderungen derselben Fassung: nur eine gewinnt", async () => {
    const notizId = await notiz(ANNA, "Wettlauf", "Wettlauf");
    const { aufgabe } = await neuerDienst().lege(ANNA, {
      vorgang: vorgang(),
      weg: "notiz",
      quelle: { notizId },
    });
    const ergebnisse = await Promise.allSettled([
      neuerDienst().aendere(ANNA, aufgabe.id, { fassung: 1, status: "erledigt" }),
      neuerDienst().aendere(ANNA, aufgabe.id, { fassung: 1, prioritaet: "niedrig" }),
    ]);
    const gewonnen = ergebnisse.filter((r) => r.status === "fulfilled");
    const verloren = ergebnisse.filter((r) => r.status === "rejected");
    expect(gewonnen).toHaveLength(1);
    expect(verloren).toHaveLength(1);
    expect((verloren[0] as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    const stand = await neuerDienst().hole(ANNA, aufgabe.id);
    expect(stand.fassung).toBe(2);
    // Genau EINE der beiden Änderungen steht da — nie beide vermischt.
    const erledigt = stand.status === "erledigt" && stand.prioritaet === "mittel";
    const niedrig = stand.status === "offen" && stand.prioritaet === "niedrig";
    expect(erledigt !== niedrig).toBe(true);
  });

  // Nacharbeit 2 (Ben): die Ordnung gilt im SQL VOR dem LIMIT — eine Grenze schneidet nie eine
  // ältere, offene Aufgabe hoher Priorität zugunsten neuerer ab.
  it("K2 · SQL ordnet vor der Grenze: offen vor erledigt, dann Priorität, dann Änderungszeit", async () => {
    const pool = neuePool();
    await pool.query("DELETE FROM klara_aufgaben WHERE konto_id = $1", [CARL]);
    const notizId = await notiz(CARL, "Grundlage", "Grundlage");
    const lege = (titel: string, prioritaet: "hoch" | "mittel" | "niedrig") =>
      neuerDienst().lege(CARL, {
        vorgang: vorgang(),
        weg: "notiz",
        quelle: { notizId },
        titel,
        prioritaet,
      });
    const { aufgabe: alt } = await lege("Alt und wichtig", "hoch");
    const { aufgabe: erledigt } = await lege("Erledigt, aber hoch", "hoch");
    await neuerDienst().aendere(CARL, erledigt.id, { fassung: 1, status: "erledigt" });
    await lege("Neu, mittel", "mittel");
    await lege("Neuer, niedrig", "niedrig");
    const repo = new PgKlaraAufgabeRepo(neuePool());
    // Mit Grenze 1 kommt genau die älteste offene hohe — nicht die zuletzt geänderte.
    expect((await repo.liste(CARL, null, 1)).map((a) => a.titel)).toEqual(["Alt und wichtig"]);
    expect((await repo.liste(CARL, null, 10)).map((a) => a.titel)).toEqual([
      "Alt und wichtig",
      "Neu, mittel",
      "Neuer, niedrig",
      "Erledigt, aber hoch",
    ]);
    expect((await neuerDienst().liste(CARL, undefined))[0]?.id).toBe(alt.id);
  });
});
