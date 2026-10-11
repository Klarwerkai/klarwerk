// ================================================================================================
// produkt:20261010:antwort-beanstandung-korrektur — DIE BEANSTANDUNG GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// Die Beanstandung liegt im bestehenden Lückendatensatz (`gaps.data`, jsonb) — keine neue Tabelle,
// keine Migration. Was nur eine echte Datenbank belegen kann:
//
//   P1 · Zwei Personen beanstanden dieselbe Aussage GLEICHZEITIG: EINE Zeile, beide Meldungen mit
//        ihrer Meldekennung und Fassung, beide Personen Fragende, die verantwortliche Person zuständig
//        (`INSERT … ON CONFLICT` + `UPDATE … jsonb_set` + Vergleichen-und-Setzen).
//   P2 · Nach einem Neustart (neuer Pool, neue Dienste) stehen Bindung, Zuständigkeit und Begründungen
//        unverändert da; eine begründete Zurückweisung ist gespeichert, erzeugt je Melder genau eine
//        Rückmeldung und lässt das Wissensobjekt unverändert.
//   P3 · (Ben, Nacharbeit 2) Eine Rückfrage an eine Meldung ist mit Adressat gespeichert; nach
//        Neustart sieht, erfährt und beantwortet sie nur dieser Melder.
//   P4 · (Ben, Nacharbeit 2) Eine weitere, heute nicht lesbare Quellenabhängigkeit im gespeicherten
//        Vorgang hält nach Neustart Aussage und Begründungen vor der Fachzuständigkeit zurück.
//
// INFRASTRUKTUR wie `tests/wissenskreislauf/vorgang-pg.integration.test.ts`: `KLARWERK_PG_TEST_URL`
// (Datenbankname mit `test`), sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf. Alle
// Kennungen und Inhalte sind erfundene Testdaten.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const TITEL = "Spindel SP-7 schmieren";
const FALSCH = "Die Spindel SP-7 wird alle 40 Betriebsstunden im laufenden Betrieb geschmiert.";
const ALLE = (): boolean => true;

/** Wie in `vorgang-pg.integration.test.ts`: erst abbauen, wenn jede Verbindung wirklich zu ist. */
async function poolSchliessen(pool: Pool): Promise<void> {
  const offen = pool.totalCount;
  let geschlossen = 0;
  const alleZu = new Promise<void>((fertig, scheitern) => {
    const frist = setTimeout(() => {
      const rest = offen - geschlossen;
      scheitern(new Error(`Pool-Abbau: ${rest} von ${offen} Verbindungen nicht geschlossen`));
    }, 30_000);
    const pruefen = (): void => {
      if (geschlossen >= offen) {
        clearTimeout(frist);
        fertig();
      }
    };
    pool.on("remove", () => {
      geschlossen += 1;
      pruefen();
    });
    pruefen();
  });
  await pool.end();
  await alleZu;
}

describe("Beanstandung gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let datenbank = "";
  let url = "";
  const pools: Pool[] = [];

  function dienste() {
    const pool = createPool(url);
    pools.push(pool);
    return { pool, services: buildPgServices(pool) };
  }

  beforeAll(async () => {
    let basis: string;
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      basis = lokal;
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
      basis = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    datenbank = `klarwerk_beanstandung_test_${`${Date.now()}`.slice(-9)}`;
    verwaltung = new Pool({ connectionString: basis });
    await verwaltung.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(basis);
    ziel.pathname = `/${datenbank}`;
    url = ziel.toString();
    const pool = createPool(url);
    try {
      await migrate(pool);
      await buildPgServices(pool).ko.activateSearchProjectionV2();
    } finally {
      await poolSchliessen(pool);
    }
  }, 300_000);

  afterAll(async () => {
    for (const p of pools) {
      await poolSchliessen(p);
    }
    if (verwaltung) {
      await verwaltung
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await verwaltung.end();
    }
    await container?.stop();
  }, 120_000);

  it("P1/P2 · gleichzeitig beanstandet: eine Zeile; nach Neustart Bindung und Zurückweisung gespeichert", async () => {
    const { pool, services } = dienste();
    const ko = await services.ko.create({
      title: TITEL,
      statement: FALSCH,
      type: "best_practice",
      category: "Instandhaltung",
      author: "fachmann-pg",
      confidentiality: "intern",
    });
    for (let i = 0; i < ko.neededValidations; i++) {
      await services.validation.rate(ko.id, `pruefer-pg-${i}`, "up");
    }

    const beanstande = async (wer: string, begruendung: string) => {
      const out = await services.ask.ask(TITEL, wer, "de", undefined, ALLE);
      const aussage = out.aussagen?.aussagen[0];
      expect(aussage, "KALIBRIERUNG: die Antwort trägt eine gebundene Aussage").toBeDefined();
      return services.ask.reportAnswer(out.receipt, ko.id, "antwort-falsch", wer, {
        aussageId: aussage?.aussageId ?? "",
        aussageText: aussage?.text ?? "",
        fundstelleId: null,
        quelleFehlt: false,
        begruendung,
      });
    };

    // P1 — gleichzeitig.
    const [a, b] = await Promise.all([
      beanstande("melda-pg", "Laut Wartungsblatt nur im Stillstand."),
      beanstande("melvin-pg", "Im Betrieb ist das Schmieren nicht zulässig."),
    ]);
    const gapId = a.beanstandung?.vorgangId ?? "";
    expect(gapId).not.toBe("");
    expect(b.beanstandung?.vorgangId).toBe(gapId);
    expect(a.meldungId).not.toBe(b.meldungId);

    const zeilen = await pool.query<{ id: string }>(
      "SELECT id FROM gaps WHERE data->>'compareKey' LIKE 'beanstandung:%'",
    );
    expect(zeilen.rows.map((r) => r.id)).toEqual([gapId]);

    // P2 — Neustart: gelesen wird, was in PostgreSQL steht.
    const zweite = dienste().services;
    const gelesen = (await zweite.ask.listGaps()).find((g) => g.id === gapId);
    expect(gelesen?.askCount).toBe(2);
    expect(gelesen?.assignee).toBe("fachmann-pg");
    const fragende = [gelesen?.createdBy, ...(gelesen?.weitereFragende ?? [])];
    expect(fragende.sort()).toEqual(["melda-pg", "melvin-pg"]);
    const kennungen = (gelesen?.beanstandung?.meldungen ?? []).map((m) => m.meldungId);
    expect(kennungen.sort()).toEqual([a.meldungId, b.meldungId].sort());
    expect(gelesen?.beanstandung?.meldungen.every((m) => m.koVersion === 1)).toBe(true);

    // Jede Meldung trägt ihre eigenen Quellenabhängigkeiten (Ben, Nacharbeit 2).
    expect(gelesen?.beanstandung?.meldungen.every((m) => m.aussageKoIds?.includes(ko.id))).toBe(
      true,
    );

    const fachmann = { id: "fachmann-pg", verwaltend: false, sichtbar: ALLE };
    const sicht = await zweite.ask.gapVorgang(gapId, fachmann);
    expect(sicht.beanstandung?.begruendungen).toHaveLength(2);

    // P3 — Rückfrage an GENAU EINE Meldung; nach Neustart nur beim Adressaten (Ben, Nacharbeit 2).
    const RUECKFRAGE = "Welche Ausgabe des Wartungsblatts liegt dir vor?";
    await zweite.ask.askGapFollowUp(gapId, fachmann, RUECKFRAGE, a.meldungId);
    const wieder = dienste().services;
    const melda = { id: "melda-pg", verwaltend: false, sichtbar: ALLE };
    const melvin = { id: "melvin-pg", verwaltend: false, sichtbar: ALLE };
    expect((await wieder.ask.gapVorgang(gapId, melda)).rueckfragen.map((r) => r.frage)).toEqual([
      RUECKFRAGE,
    ]);
    const fuerMelvin = await wieder.ask.gapVorgang(gapId, melvin);
    expect(fuerMelvin.rueckfragen).toEqual([]);
    expect(JSON.stringify(fuerMelvin)).not.toContain(RUECKFRAGE);
    expect(await wieder.ask.gapMeldungenFuer("melvin-pg", ALLE)).toEqual([]);
    const gespeichert = (await wieder.ask.listGaps()).find((g) => g.id === gapId);
    const rueckfrage = gespeichert?.rueckfragen?.[0];
    expect(rueckfrage).toMatchObject({ an: "melda-pg", meldungId: a.meldungId });
    await expect(
      wieder.ask.answerGapFollowUp(gapId, rueckfrage?.id ?? "", melvin, "Ich antworte."),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // P4 — eine zusätzliche, heute nicht lesbare Quelle einer weiteren Meldung, gespeichert und neu
    // gelesen: die Fachzuständigkeit bekommt weder Aussage noch Begründungen.
    const zeile = await pool.query<{ data: Record<string, unknown> }>(
      "SELECT data FROM gaps WHERE id = $1",
      [gapId],
    );
    const daten = zeile.rows[0]?.data as {
      beanstandung: { aussageKoIds: string[]; meldungen: unknown[] };
    };
    daten.beanstandung.aussageKoIds = [...daten.beanstandung.aussageKoIds, "ko-gesperrt-pg"];
    await pool.query("UPDATE gaps SET data = $2::jsonb WHERE id = $1", [
      gapId,
      JSON.stringify(daten),
    ]);
    const nachSperre = await dienste().services.ask.gapVorgang(gapId, fachmann);
    expect(nachSperre.beanstandung).toMatchObject({
      aussage: "",
      aussageZurueckgehalten: true,
      begruendungen: [],
    });

    const BEGRUENDUNG = "Für Baujahr 2024 gilt laut Ausgabe 4 das 40-Stunden-Intervall.";
    await zweite.ask.rejectBeanstandung(gapId, fachmann, BEGRUENDUNG);
    const dritte = dienste().services;
    const zu = (await dritte.ask.listGaps()).find((g) => g.id === gapId);
    expect(zu?.abschluss).toMatchObject({
      art: "zurueckgewiesen",
      begruendung: BEGRUENDUNG,
      koId: ko.id,
      koVersion: 1,
    });
    for (const wer of ["melda-pg", "melvin-pg"]) {
      const meldungen = await dritte.ask.gapMeldungenFuer(wer, ALLE);
      expect(
        meldungen.map((m) => m.art),
        wer,
      ).toEqual(["zurueckgewiesen"]);
    }
    expect(await dritte.ko.get(ko.id)).toMatchObject({ version: 1, statement: FALSCH });
  }, 180_000);
});
