// ================================================================================================
// VERSTÄNDNISFRAGEN · DIE POSTGRESQL-ABLAGE UNTER ECHTER DATENBANK.
// ================================================================================================
//
// Gegen ein frisches Postgres (Testcontainers) mit der produktiven Migration (`migrate`). Gemessen
// wird die Ablage, auf die der Betrieb sich verlässt — getrennte, fiktive Beispieldaten:
//
//   P1  (K15/K19) Eine Fragensatzversion wird nie überschrieben: zwei gleichzeitige Schreiber
//       derselben Version — genau einer gewinnt. Der Statuswechsel ist Vergleich-und-Setzen und
//       lässt Fragen und Antworten unberührt.
//   P2  (K18) Dieselbe Versuchskennung zweimal (auch gleichzeitig) ist EIN Versuch; zwei
//       verschiedene Versuche mit derselben Nummer: genau einer wird abgelegt.
//   P3  (K18/K19) Eine NEUE Ablage auf demselben Pool (Neustart) liest denselben Stand; die
//       Rollenzuordnung wird über die gespeicherte Version gefunden.
//   P4  Die Migration ist wiederholbar.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  type FragensatzFassung,
  PgVerstaendnisfragenRepo,
  type Versuch,
} from "../../services/app/src/verstaendnisfragen";

describe("Verständnisfragen · PostgreSQL-Ablage", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    pool = createPool(
      `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
    );
    pool.options.max = 6;
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  beforeEach(async () => {
    // Nur die eigenen Testdaten zurücksetzen; die Tabellen legt die produktive Migration an.
    await pool.query("TRUNCATE verstaendnis_versuche, verstaendnis_fragensaetze");
  });

  const fassung = (version: number, teil: Partial<FragensatzFassung> = {}): FragensatzFassung => ({
    id: "satz-beispiel-1",
    version,
    koId: "ko-beispiel-1",
    koVersion: 2,
    titel: "Druckluft · Beispiel",
    rollen: ["viewer"],
    fragen: [
      {
        id: "f1",
        text: "Was wird angelüftet?",
        optionen: [
          { id: "o1", text: "Das Sicherheitsventil" },
          { id: "o2", text: "Der Kompressor" },
        ],
        richtig: ["o1"],
        erlaeuterung: "Die Anweisung nennt das Sicherheitsventil.",
        beleg: "das Sicherheitsventil von Hand angelüftet",
      },
    ],
    regel: { mindestRichtig: 1, hoechstVersuche: 2 },
    status: "entwurf",
    geaendertVon: "konto-erik",
    geaendertAm: "2026-10-11T08:00:00.000Z",
    vorgelegtVon: null,
    vorgelegtAm: null,
    entschiedenVon: null,
    entschiedenAm: null,
    begruendung: null,
    ...teil,
  });

  const versuch = (id: string, nummer: number, personId = "konto-vera"): Versuch => ({
    id,
    personId,
    fragensatzId: "satz-beispiel-1",
    fragensatzVersion: 1,
    koId: "ko-beispiel-1",
    koVersion: 2,
    nummer,
    abgegebenAm: "2026-10-11T09:00:00.000Z",
    antworten: [{ frageId: "f1", gewaehlt: ["o1"] }],
    bewertung: {
      je: [{ frageId: "f1", urteil: "richtig" }],
      richtig: 1,
      fragen: 1,
      unbeantwortet: 0,
      mindestRichtig: 1,
      bestanden: true,
      unvollstaendig: false,
    },
  });

  it("P1 · eine Version wird nie überschrieben; der Status wechselt ohne Inhalt", async () => {
    const repo = new PgVerstaendnisfragenRepo(pool);
    const [a, b] = await Promise.all([
      repo.legeFassung(fassung(1)),
      repo.legeFassung(fassung(1, { titel: "anderer Titel" })),
    ]);
    expect([a, b].sort()).toEqual([false, true]);
    expect(await repo.legeFassung(fassung(1))).toBe(false);

    const neu = {
      status: "angenommen" as const,
      vorgelegtVon: null,
      vorgelegtAm: null,
      entschiedenVon: "konto-clara",
      entschiedenAm: "2026-10-11T08:30:00.000Z",
      begruendung: null,
    };
    const [x, y] = await Promise.all([
      repo.setzeStatus("satz-beispiel-1", 1, ["entwurf", "vorgelegt"], neu),
      repo.setzeStatus("satz-beispiel-1", 1, ["entwurf", "vorgelegt"], neu),
    ]);
    expect([x, y].filter((z) => z !== undefined)).toHaveLength(1);
    // Aus „angenommen" heraus gibt es keinen zweiten Wechsel nach demselben Muster.
    expect(await repo.setzeStatus("satz-beispiel-1", 1, ["entwurf"], neu)).toBeUndefined();
    const [gelesen] = await repo.fassungen("satz-beispiel-1");
    expect(gelesen?.status).toBe("angenommen");
    expect(gelesen?.fragen).toEqual(fassung(1).fragen);
    expect(gelesen?.entschiedenVon).toBe("konto-clara");
  });

  it("P2 · dieselbe Kennung ist ein Versuch; eine Nummer wird nur einmal vergeben", async () => {
    const repo = new PgVerstaendnisfragenRepo(pool);
    const [a, b] = await Promise.all([
      repo.legeVersuch(versuch("versuch-a", 1)),
      repo.legeVersuch(versuch("versuch-a", 1)),
    ]);
    expect([a.art, b.art].sort()).toEqual(["neu", "vorhanden"]);

    const [c, d] = await Promise.all([
      repo.legeVersuch(versuch("versuch-b", 2)),
      repo.legeVersuch(versuch("versuch-c", 2)),
    ]);
    expect([c.art, d.art].sort()).toEqual(["neu", "nummer_belegt"]);
    expect(await repo.versucheVon("konto-vera")).toHaveLength(2);
    // Eine andere Person hat ihre eigene Zählung.
    expect((await repo.legeVersuch(versuch("versuch-d", 1, "konto-wim"))).art).toBe("neu");
  });

  it("P3 · eine neue Ablage auf demselben Pool liest denselben Stand", async () => {
    const vorher = new PgVerstaendnisfragenRepo(pool);
    await vorher.legeFassung(fassung(1));
    await vorher.legeFassung(fassung(2, { rollen: ["experte"] }));
    await vorher.legeVersuch(versuch("versuch-neustart", 1));

    const nachher = new PgVerstaendnisfragenRepo(pool);
    expect((await nachher.fassungen("satz-beispiel-1")).map((f) => f.version)).toEqual([1, 2]);
    expect((await nachher.fassungenZu("ko-beispiel-1")).length).toBe(2);
    expect((await nachher.fassungenFuerRolle("viewer")).map((f) => f.version)).toEqual([1]);
    expect((await nachher.fassungenFuerRolle("experte")).map((f) => f.version)).toEqual([2]);
    const gelesen = await nachher.versuch("versuch-neustart");
    expect(gelesen).toEqual(versuch("versuch-neustart", 1));
    expect(await nachher.versucheZu("satz-beispiel-1")).toHaveLength(1);
  });

  it("P4 · die Migration ist wiederholbar", async () => {
    await migrate(pool);
    await migrate(pool);
    const tabellen = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE 'verstaendnis_%' ORDER BY table_name`,
    );
    expect(tabellen.rows.map((z) => z.table_name)).toEqual([
      "verstaendnis_fragensaetze",
      "verstaendnis_versuche",
    ]);
  });
});
