// ================================================================================================
// produkt:20261011:peter-p06 · BESTÄTIGTE ROUTINEN GEGEN ECHTES POSTGRESQL (Frage 35: dauerhaft).
// ================================================================================================
//
// `vormachen-am-server.test.ts` misst an der Speicherfassung. Dass eine BESTÄTIGTE Routine einen
// NEUSTART übersteht, während Rohbeobachtungen und Lernnotiz nach ihrer Regel verschwinden, und dass
// die Privatlöschung die Zeile wirklich ENTFERNT, ist erst hier belegt: derselbe Dienst
// (`VormachenDienst`) mit `PgRoutinenRepo`, das ausgeführte `migrate()` mit
// `PERSOENLICHE_ROUTINEN_SCHEMA`, ein neuer Pool und ein neuer Dienst je „Server". Fiktive Daten.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgRoutinenRepo, VormachenDienst } from "../../services/app/src/vormachen";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-routinen-anna";
const BERT = "u-pg-routinen-bert";
const ROHWERT = "Angebot Musterfirma Beispiel GmbH 48.250 EUR";
const CLIENT = "client-pg-routinen";

describe("P06 · bestätigte Routinen gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Ein neuer „Server": frischer Pool, frischer Dienst — Lernsitzungen sind damit fort. */
  function neuerDienst(): VormachenDienst {
    return new VormachenDienst({ routinen: new PgRoutinenRepo(neuePool()) });
  }

  async function zeilen(kontoId: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM persoenliche_routinen WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? -1;
  }

  /** Vormachen über die Arbeitswege-Annahme des Dienstes und bestätigen. */
  async function lerneUndBestaetige(dienst: VormachenDienst, kontoId: string) {
    const s = dienst.starte(kontoId, {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "zur_pruefung_einreichen"],
      zweck: "Angebotsnotiz einreichen",
    });
    // Die sichtbare Lernanzeige dieses Clients meldet sich (Bedingung des Mitschreibens).
    dienst.meldeSichtbar(kontoId, "klarwerk_web", CLIENT);
    for (const [vorgang, beschreibung] of [
      ["entwurf_anlegen", "Entwurf anlegen"],
      ["zur_pruefung_einreichen", "Entwurf zur Prüfung einreichen"],
    ] as const) {
      const nr = dienst.beobachteArbeitsweg(
        kontoId,
        { host: "klarwerk_web", vorgang, beschreibung, rohwert: ROHWERT },
        CLIENT,
      );
      expect(nr).not.toBeNull();
    }
    const v = dienst.vorschau(kontoId, s.id);
    return dienst.bestaetige(kontoId, s.id, { stand: v.stand });
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
      const ablage = new PgRoutinenRepo(pool);
      await ablage.entferneAlle(ANNA);
      await ablage.entferneAlle(BERT);
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

  it("eine bestätigte Routine übersteht den Neustart — ohne Rohwerte; die Lernsitzung nicht", async () => {
    const routine = await lerneUndBestaetige(neuerDienst(), ANNA);
    expect(await zeilen(ANNA)).toBe(1);

    const nachNeustart = await neuerDienst().uebersicht(ANNA);
    expect(nachNeustart.routinen).toEqual([routine]);
    expect(nachNeustart.sitzungen).toEqual([]);
    expect(JSON.stringify(nachNeustart.routinen)).not.toContain(ROHWERT);
    // Ein anderes Konto sieht sie nicht.
    expect((await neuerDienst().uebersicht(BERT)).routinen).toEqual([]);
  });

  it("eine nur begonnene Lernsitzung hinterlässt nach dem Neustart nichts in der Datenbank", async () => {
    const dienst = neuerDienst();
    dienst.starte(BERT, {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen"],
      zweck: "Nur angefangen",
    });
    dienst.meldeSichtbar(BERT, "klarwerk_web", CLIENT);
    const nr = dienst.beobachteArbeitsweg(
      BERT,
      {
        host: "klarwerk_web",
        vorgang: "entwurf_anlegen",
        beschreibung: "Entwurf anlegen",
        rohwert: ROHWERT,
      },
      CLIENT,
    );
    expect(nr).toBe(1);
    expect(await zeilen(BERT)).toBe(0);
    const danach = await neuerDienst().uebersicht(BERT);
    expect(danach).toEqual({ sitzungen: [], routinen: [] });
  });

  it("Firmenübergabe wird fortgeschrieben; die Privatlöschung entfernt nur die eigenen Zeilen", async () => {
    const bert = await lerneUndBestaetige(neuerDienst(), BERT);
    await neuerDienst().vermerkeFirmenuebergabe(BERT, bert.id, "entwurf-pg-1");
    // Ein fremdes Konto kann die Routine nicht fortschreiben.
    await expect(
      neuerDienst().vermerkeFirmenuebergabe(ANNA, bert.id, "entwurf-fremd"),
    ).rejects.toMatchObject({ status: 404 });
    const gelesen = await neuerDienst().routine(BERT, bert.id);
    expect(gelesen.firmenuebergabe?.entwurfId).toBe("entwurf-pg-1");

    expect(await neuerDienst().privatLoeschen(BERT)).toEqual({ sitzungen: 0, routinen: 1 });
    expect(await zeilen(BERT)).toBe(0);
    expect(await zeilen(ANNA)).toBe(1);
  });

  it("zwei Server reservieren dieselbe Laufkennung atomar und erzeugen nur einen Auftrag", async () => {
    const konto = "u-pg-routinen-h-konkurrenz";
    const a = neuerDienst();
    const b = neuerDienst();
    const routine = await lerneUndBestaetige(a, konto);
    let begonnen!: () => void;
    let fortsetzen!: () => void;
    const bereit = new Promise<void>((r) => {
      begonnen = r;
    });
    const warten = new Promise<void>((r) => {
      fortsetzen = r;
    });
    let wirkungen = 0;
    const wege = {
      finde: async () => null,
      erzeuge: async () => {
        wirkungen++;
        begonnen();
        await warten;
        return "h-pg-einziger-auftrag";
      },
    };
    const lauf = {
      kennung: "h-pg-lauf",
      fassung: routine.fassung,
      abdruck: "h-gleich",
      gespraech: "h-eigen",
    };
    const erster = a.einmalJeLauf(konto, routine.id, lauf, wege);
    await bereit;
    try {
      await expect(b.einmalJeLauf(konto, routine.id, lauf, wege)).rejects.toMatchObject({
        status: 409,
      });
    } finally {
      fortsetzen();
    }
    expect((await erster).auftragId).toBe("h-pg-einziger-auftrag");
    const wieder = await neuerDienst().einmalJeLauf(konto, routine.id, lauf, wege);
    expect(wieder).toMatchObject({ auftragId: "h-pg-einziger-auftrag", wiederholt: true });
    expect(wirkungen).toBe(1);
  });
});
