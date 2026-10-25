// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender) · KALENDERSPERRE AN DER STEUERUNG GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Nacharbeit 44 (Ben, K5/K10): Dieselben Ablagen wie im Betrieb (`pgErinnerungAblage`,
// `PgKalenderZuordnungRepo`), das ausgeführte `migrate()` mit `KLARA_ERINNERUNG_SCHEMA` und
// `KLARA_KALENDER_SCHEMA`, verdrahtet wie in `buildApp`: EINE Steuerung, die vor jeder Wirkung die
// Vorkommenssperre der Kalenderanbindung liest, und der Anschluss `erinnerungsLaufAnschluss` für
// ausdrückliche Entscheidungen. Jeder Schritt läuft in einem NEUEN „Prozess“ (frischer Pool) — so
// sieht ein Neustart aus. Der Kalender ist das strenge Vertragsdouble (kein Microsoft 365); das
// Konto hat eine fiktive Kontozeile, weil jede Zustellung sie in der Datenbank verlangt.
//
//   P1 (P07-AC05, AW17-K05) Serie mit zwei Vorkommen plus unabhängige Erinnerung: externe Löschung
//      EINES Vorkommens → nur dessen Lauf wartet; verspäteter Abgleich, Neustart, Fälligkeit und
//      Dialogschließen geben nichts frei; ausdrückliche Fortführung → genau dieses Vorkommen wirkt
//      einmal, ein weiterer Takt wiederholt nichts.
//   P2 (P07-AC06) „Ganze Serie beenden“: die Erinnerung ist beendet, und die gespeicherte
//      Serienbeendigung sperrt auch ein nie eingetragenes Vorkommen (`zuAuftrag`).
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  KlaraErinnerungDienst,
  KlaraErinnerungSteuerung,
  pgErinnerungAblage,
} from "../../services/app/src/klara-erinnerung";
import {
  KalenderAnbindungDienst,
  PgKalenderZuordnungRepo,
  pruefeInternenTermin,
} from "../../services/app/src/klara-kalender-anbindung";
import { erinnerungsLaufAnschluss } from "../../services/app/src/klara-kalender-lauf";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { DOUBLE_KALENDER, StrengerTestkalender } from "./vertragsdouble";

const ANNA = "u-pg-kalsperre-anna";
const BERLIN = "Europe/Berlin";

describe("Klara 11 · Kalendersperre an der Erinnerungssteuerung gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let eigeneDb: { verwaltung: string; name: string } | undefined;
  let url = "";
  const pools: Pool[] = [];
  const kalender = new StrengerTestkalender();
  let uhr = Date.parse("2026-10-19T08:00:00.000Z");
  const jetzt = (): number => uhr;

  /** Eine frische Datenbank pro Suite; alle „Prozesse“ teilen weiterhin denselben Bestand. */
  async function frischeDatenbank(lokal: string): Promise<string> {
    const teile = /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(lokal);
    if (!teile) {
      throw new Error("KLARWERK_PG_TEST_URL ist nicht lesbar — keine eigene Datenbank anlegbar.");
    }
    const name = `klarwerk_test_kalsperre_${randomUUID().replace(/-/g, "")}`;
    const verwaltung = createPool(lokal);
    try {
      await verwaltung.query(`CREATE DATABASE "${name}"`);
      eigeneDb = { verwaltung: lokal, name };
    } catch (cause) {
      throw new Error("Auf KLARWERK_PG_TEST_URL lässt sich keine eigene Testdatenbank anlegen.", {
        cause,
      });
    } finally {
      await verwaltung.end();
    }
    return `${teile[1]}${name}${teile[3]}`;
  }

  /** Ein „Prozess“ nach einem Neustart: eigener Pool, eigene Dienste, EINE Steuerung. */
  function prozess(name: string) {
    const pool = createPool(url);
    pools.push(pool);
    const ablage = pgErinnerungAblage(pool);
    const erinnerungen = new KlaraErinnerungDienst({ ablage, jetzt });
    const kalenderDienst = new KalenderAnbindungDienst({
      repo: new PgKalenderZuordnungRepo(pool),
      anbieterFuer: async (kontoId) => (kontoId === ANNA ? kalender : null),
      laufSteuerung: erinnerungsLaufAnschluss(ablage, erinnerungen, jetzt),
      jetzt,
    });
    const steuerung = new KlaraErinnerungSteuerung({
      ablage,
      konto: () => Promise.resolve({ approved: true }),
      jetzt,
      besitzer: name,
      vorkommenSperre: (konto, erinnerung, vorkommen) =>
        kalenderDienst.vorkommenSperre(konto, erinnerung, vorkommen),
    });
    return { ablage, erinnerungen, kalenderDienst, steuerung };
  }

  const laeufe = (id: string) => prozess("lesen").ablage.laeufe.fuerErinnerung(id, 10);

  async function vorkommenLauf(id: string, vorkommenId: string) {
    return (await laeufe(id)).find((l) => l.vorkommenId === vorkommenId);
  }

  function termin(auftragId: string, datum: string) {
    return pruefeInternenTermin({
      auftragId,
      ereignisId: `${auftragId}@${datum}T09:00`,
      fassung: 1,
      serienart: "vorkommen",
      inhalt: {
        titel: "Zertifikat prüfen",
        beginn: `${datum}T09:00`,
        ende: `${datum}T09:15`,
        zeitzone: BERLIN,
      },
    });
  }

  async function serie(vorgang: string, anzahl: number): Promise<string> {
    const r = await prozess("anlage").erinnerungen.lege(ANNA, {
      vorgang,
      titel: "Zertifikat prüfen",
      zeitzone: BERLIN,
      zeitplan: {
        art: "serie",
        datum: "2026-10-20",
        uhrzeit: "09:00",
        wiederholung: { takt: "taeglich", intervall: 1, anzahl },
      },
    });
    return r.eintrag.erinnerung.id;
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = await frischeDatenbank(lokal);
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
      // Zweimal: die Stufen sind wiederholbar und lassen den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      for (const tabelle of [
        "klara_erinnerungen",
        "klara_erinnerung_laeufe",
        "klara_erinnerung_meldungen",
        "klara_kalender_anbindungen",
        "klara_kalender_zuordnungen",
      ]) {
        await pool.query(`DELETE FROM ${tabelle} WHERE konto_id = $1`, [ANNA]);
      }
      await pool.query("DELETE FROM users WHERE id = $1", [ANNA]);
      await pool.query(
        `INSERT INTO users (id, name, email, password_salt, password_hash, role, approved, created_at)
         VALUES ($1, $2, $3, 'fiktiv', 'fiktiv', 'experte', true, $4)`,
        [ANNA, "Konto Anna", `${ANNA}@pg-kalsperre.test`, new Date(0).toISOString()],
      );
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end();
    }
    if (eigeneDb) {
      const verwaltung = createPool(eigeneDb.verwaltung);
      try {
        await verwaltung.query(`DROP DATABASE IF EXISTS "${eigeneDb.name}" WITH (FORCE)`);
      } finally {
        await verwaltung.end();
      }
    }
    await container?.stop();
  });

  it("P1 · nur das betroffene Vorkommen wartet — bis zur ausdrücklichen Fortführung", async () => {
    uhr = Date.parse("2026-10-19T08:00:00.000Z");
    const s = await serie("pg-kalsperre-serie-01", 2);
    const angelegt = await prozess("anlage").erinnerungen.lege(ANNA, {
      vorgang: "pg-kalsperre-frei-0001",
      titel: "Unabhängige Erinnerung",
      zeitzone: BERLIN,
      zeitplan: { art: "einmalig", datum: "2026-10-20", uhrzeit: "09:00" },
    });
    const frei = angelegt.eintrag.erinnerung.id;
    const v1 = `${s}@2026-10-20T09:00`;
    const v2 = `${s}@2026-10-21T09:00`;
    const a = await prozess("verbinden").kalenderDienst.verbinde(ANNA, {
      kalenderId: DOUBLE_KALENDER.id,
      umfang: "lesen_schreiben",
    });
    const t1 = termin(s, "2026-10-20");
    const eintragen = prozess("eintragen").kalenderDienst;
    const r1 = await eintragen.projiziere(ANNA, a.id, t1);
    expect(r1.ok).toBe(true);
    const r2 = await eintragen.projiziere(ANNA, a.id, termin(s, "2026-10-21"));
    expect(r2.ok).toBe(true);

    // Externe Löschung, Abgleich und ein verspäteter Abgleich nach einem Neustart.
    const extern1 = r1.ok ? r1.zuordnung.externeId : null;
    kalender.termine.delete(extern1 ?? "");
    await prozess("abgleich").kalenderDienst.gleicheAlleAb(ANNA, a.id);
    await prozess("spaeter").kalenderDienst.gleicheAlleAb(ANNA, a.id);
    const auskunft = prozess("auskunft").kalenderDienst;
    expect(await auskunft.vorkommenSperre(ANNA, s, v1)).toBe("pausiert");
    expect(await auskunft.vorkommenSperre(ANNA, s, v2)).toBe("frei");

    // Fällig nach einem Neustart: nur dieses Vorkommen wartet, die unabhängige Erinnerung kommt.
    uhr = Date.parse("2026-10-20T07:05:00.000Z");
    expect(await prozess("takt-1").steuerung.lauf()).toMatchObject({ unklar: 1, zugestellt: 1 });
    expect(await vorkommenLauf(s, v1)).toMatchObject({
      status: "unklar",
      ergebnis: { grund: "kalender_pausiert" },
    });
    expect(await laeufe(frei)).toMatchObject([{ status: "zugestellt" }]);

    // Das andere Vorkommen derselben Serie wirkt unverändert.
    uhr = Date.parse("2026-10-21T07:05:00.000Z");
    await prozess("takt-2").steuerung.lauf();
    expect(await vorkommenLauf(s, v2)).toMatchObject({ status: "zugestellt", versuch: 1 });
    expect(await vorkommenLauf(s, v1)).toMatchObject({ status: "unklar" });

    // Dialogschließen ist keine Zustimmung — auch nicht über einen Neustart hinweg.
    await prozess("dialog").kalenderDienst.entscheide(ANNA, a.id, t1, {
      wahl: "dialog_geschlossen",
    });
    await prozess("takt-3").steuerung.lauf();
    expect(await vorkommenLauf(s, v1)).toMatchObject({ status: "unklar" });

    // Ausdrücklich fortgeführt: genau dieses Vorkommen wirkt — einmal.
    await prozess("entscheidung").kalenderDienst.entscheide(ANNA, a.id, t1, {
      wahl: "fortfuehren_ohne_kalender",
      umfang: "einzeltermin",
    });
    expect(await vorkommenLauf(s, v1)).toMatchObject({ status: "fehlgeschlagen", versuch: 1 });
    expect((await prozess("takt-4").steuerung.lauf()).zugestellt).toBe(1);
    expect(await vorkommenLauf(s, v1)).toMatchObject({ status: "zugestellt", versuch: 2 });
    await prozess("takt-5").steuerung.lauf();
    const meldungen = await prozess("lesen").ablage.meldungen.fuerKonto(ANNA, 100);
    expect(meldungen.filter((m) => m.erinnerungId === s)).toHaveLength(2);
    expect(meldungen.filter((m) => m.erinnerungId === frei)).toHaveLength(1);
  });

  it("P2 · „ganze Serie beenden“ hält über Neustarts — auch für nie eingetragene Vorkommen", async () => {
    uhr = Date.parse("2026-10-19T08:00:00.000Z");
    const s = await serie("pg-kalsperre-serie-02", 3);
    const anbindung = (await prozess("auskunft").kalenderDienst.anbindungen(ANNA))[0];
    expect(anbindung).toBeDefined();
    const a = anbindung?.id ?? "";
    const t1 = termin(s, "2026-10-20");
    const r1 = await prozess("eintragen").kalenderDienst.projiziere(ANNA, a, t1);
    expect(r1.ok).toBe(true);
    const extern1 = r1.ok ? r1.zuordnung.externeId : null;
    kalender.termine.delete(extern1 ?? "");
    await prozess("abgleich").kalenderDienst.gleicheAlleAb(ANNA, a);

    await prozess("entscheidung").kalenderDienst.entscheide(ANNA, a, t1, {
      wahl: "beenden",
      umfang: "serie",
    });
    const beendet = await prozess("lesen").erinnerungen.eintrag(ANNA, s);
    expect(beendet.erinnerung.status).toBe("beendet");
    const auskunft = prozess("auskunft").kalenderDienst;
    expect(await auskunft.vorkommenSperre(ANNA, s, `${s}@2026-10-22T09:00`)).toBe("beendet");

    uhr = Date.parse("2026-10-22T07:05:00.000Z");
    expect((await prozess("takt").steuerung.lauf()).zugestellt).toBe(0);
    expect(await laeufe(s)).toEqual([]);
  });
});
