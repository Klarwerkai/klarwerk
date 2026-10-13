// ================================================================================================
// KLARA 06 (produkt:20261007:klara-notizen-aufgaben) · PRIVATE NOTIZEN GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `notiz-am-server.test.ts` misst an der Speicherfassung. Dass eine Notiz samt Rücklink, offenen
// Fragen und Fassung einen NEUSTART übersteht (das ist „erneute Anmeldung" am Server), dass die
// Suche im SQL dieselbe Regel hat wie im Speicher (klein/groß egal, UND, `%`/`_` wörtlich), dass
// ein fremdes Konto nichts liest und nichts löscht und dass zwei GLEICHZEITIGE Versuche desselben
// Vorgangs genau eine Zeile ergeben (eindeutiger Index), ist erst hier belegt: dieselbe Ablage
// (`PgKlaraNotizRepo`), das ausgeführte `migrate()` mit `KLARA_NOTIZ_SCHEMA`, ein neuer Pool je
// „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { KlaraGespraechDienst, PgKlaraGespraechRepo } from "../../services/app/src/klara-gespraech";
import { KlaraNotizDienst, PgKlaraNotizRepo } from "../../services/app/src/klara-notiz";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-notiz-anna";
const BERT = "u-pg-notiz-bert";
const BEZUG = {
  pfad: "/wissen/ko-presse-4",
  seitenName: "Lesen",
  objekt: "Ölwechsel Presse 4",
  koId: "ko-presse-4",
  fassung: 3,
  absatz: 2,
  bezug: "markierung",
  auswahl: "Den Ölstand nur bei stehender Presse prüfen.",
};

describe("Klara 06 · Notizen gegen echtes PostgreSQL", () => {
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
  function neuerDienst(): KlaraNotizDienst {
    const pool = neuePool();
    return new KlaraNotizDienst({
      repo: new PgKlaraNotizRepo(pool),
      gespraeche: new PgKlaraGespraechRepo(pool),
      jetzt,
    });
  }

  function vorgang(): string {
    vorgaenge += 1;
    return `pg-vorgang-${String(vorgaenge).padStart(4, "0")}`;
  }

  async function zeilen(kontoId: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_notizen WHERE konto_id = $1",
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
      await pool.query("DELETE FROM klara_notizen WHERE konto_id = ANY($1)", [[ANNA, BERT]]);
      await pool.query("DELETE FROM klara_gespraeche WHERE konto_id = ANY($1)", [[ANNA, BERT]]);
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

  it("K1/K2 · Inhalt, Rücklink, offene Fragen und Fassung überstehen den Neustart", async () => {
    const inhalt = "Ölstand nur bei Stillstand prüfen.\nGilt das auch für Presse 5?  ";
    const { notiz } = await neuerDienst().lege(ANNA, {
      vorgang: vorgang(),
      weg: "ausschnitt",
      inhalt,
      offeneFragen: ["Wer bestätigt Presse 5?"],
      objektbezug: BEZUG,
    });
    const nachNeustart = await neuerDienst().hole(ANNA, notiz.id);
    expect(nachNeustart).toEqual(notiz);
    expect(nachNeustart.inhalt).toBe(inhalt);
    expect(nachNeustart.objektbezug).toEqual(BEZUG);
    expect(nachNeustart.art).toBe("arbeitszettel");

    const { notiz: geaendert } = await neuerDienst().aendere(ANNA, notiz.id, {
      fassung: 1,
      titel: "Presse 5 klären",
      offeneFragen: ["Wer bestätigt Presse 5?", "Bis wann?"],
    });
    expect(geaendert.fassung).toBe(2);
    const wieder = await neuerDienst().hole(ANNA, notiz.id);
    expect(wieder).toMatchObject({
      fassung: 2,
      titel: "Presse 5 klären",
      offeneFragen: ["Wer bestätigt Presse 5?", "Bis wann?"],
      objektbezug: BEZUG,
      inhalt,
    });
    // Eine veraltete Fassung aus einem zweiten „Server" überschreibt nicht still.
    await expect(
      neuerDienst().aendere(ANNA, notiz.id, { fassung: 1, inhalt: "Aus Tab B" }),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    expect((await neuerDienst().hole(ANNA, notiz.id)).inhalt).toBe(inhalt);
  });

  it("K2 · die Suche im SQL: klein/groß egal, alle Wörter, Platzhalter wörtlich, nur eigene", async () => {
    const { notiz } = await neuerDienst().lege(BERT, {
      vorgang: vorgang(),
      weg: "geschrieben",
      inhalt: "Kühlmittel 50% tauschen",
      titel: "ÜBERHOLUNG Kühlung",
      objektbezug: { pfad: "/erfassen", seitenName: "Erfassung", objekt: "Entwurf Kühlung" },
    });
    const finde = async (konto: string, q: string) =>
      (await neuerDienst().liste(konto, q, undefined)).map((n) => n.id);
    expect(await finde(BERT, "überholung")).toEqual([notiz.id]);
    expect(await finde(BERT, "KÜHLMITTEL tauschen")).toEqual([notiz.id]);
    expect(await finde(BERT, "50%")).toEqual([notiz.id]);
    expect(await finde(BERT, "5_%")).toEqual([]);
    expect(await finde(BERT, "Kühlmittel Getriebe")).toEqual([]);
    expect(await finde(ANNA, "Kühlmittel")).toEqual([]);
  });

  it("K3 · ein fremdes Konto liest, ändert und löscht nichts — die Zeile bleibt", async () => {
    const { notiz } = await neuerDienst().lege(BERT, {
      vorgang: vorgang(),
      weg: "diktiert",
      inhalt: "Nur für Bert",
      objektbezug: BEZUG,
    });
    const vorher = await zeilen(BERT);
    await expect(neuerDienst().hole(ANNA, notiz.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      neuerDienst().aendere(ANNA, notiz.id, { fassung: 1, inhalt: "übernommen" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await neuerDienst().loesche(ANNA, notiz.id)).toBe(false);
    expect(await zeilen(BERT)).toBe(vorher);
    expect((await neuerDienst().hole(BERT, notiz.id)).inhalt).toBe("Nur für Bert");
    // Auch aus Berts Gespräch kann Anna keine Notiz machen.
    const gespraeche = new KlaraGespraechDienst({ repo: new PgKlaraGespraechRepo(neuePool()) });
    const g = await gespraeche.beginne(BERT, BEZUG);
    const { nachricht } = await gespraeche.fuegeHinzu(BERT, g.id, {
      von: "klara",
      modus: "hilfetext",
      text: "Berts Hilfetext",
      objektbezug: BEZUG,
    });
    await expect(
      neuerDienst().lege(ANNA, {
        vorgang: vorgang(),
        weg: "gespraech",
        quelle: { gespraechId: g.id, nachrichtId: nachricht.id },
      }),
    ).rejects.toMatchObject({ status: 404, grund: "quelle_unbekannt" });
    // Bert selbst kann es — Wortlaut aus der eigenen Nachricht, nach Neustart gleich.
    const { notiz: ausGespraech } = await neuerDienst().lege(BERT, {
      vorgang: vorgang(),
      weg: "gespraech",
      quelle: { gespraechId: g.id, nachrichtId: nachricht.id },
    });
    expect((await neuerDienst().hole(BERT, ausGespraech.id)).inhalt).toBe("Berts Hilfetext");
  });

  it("K4 · fünf gleichzeitige Versuche desselben Vorgangs auf fünf Pools: genau eine Zeile", async () => {
    const v = vorgang();
    const vorher = await zeilen(ANNA);
    const ergebnisse = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        neuerDienst().lege(ANNA, {
          vorgang: v,
          weg: "geschrieben",
          inhalt: "Einmal, auch bei fünf Versuchen",
          objektbezug: BEZUG,
        }),
      ),
    );
    expect(new Set(ergebnisse.map((r) => r.notiz.id)).size).toBe(1);
    expect(ergebnisse.filter((r) => !r.wiederholt)).toHaveLength(1);
    expect(await zeilen(ANNA)).toBe(vorher + 1);
  });
});
