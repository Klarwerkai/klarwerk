// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DER SEITENWEG AUF ECHTEM POSTGRES.
// ================================================================================================
//
// Produktiv liest die Verwalteransicht über `PgAuditRepo.findPage` (`ORDER BY seq DESC LIMIT`) und
// `findNamensbelege` (`payload ? 'actorName'`). Diese Datei misst, dass die SQL-Fassung DIESELBE
// Menge in DERSELBEN Reihenfolge liefert wie die Regel in Node (`auditSeiteTrifft` in der
// Speicherablage) — über dieselbe fiktive Kette, für jede Filterart einzeln und kombiniert, über
// alle Seiten hinweg. Dazu: die Kette bleibt nach allen Lesewegen prüfbar.
//
// Quelle wie in `services/audit/src/repo-pg.integration.test.ts`: eine per GELB-Sicherung
// freigegebene lokale Testinstanz (KLARWERK_PG_TEST_URL) oder ein Testcontainer. Ohne beides wird
// übersprungen — mit Grund auf stderr und einem Zeugen, der den Zustand bezeugt.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  type AuditInput,
  type AuditSeitenAnfrage,
  AuditService,
  InMemoryAuditRepo,
  PgAuditRepo,
} from "../../services/audit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

type Laufzustand =
  | { readonly gelaufen: true; readonly quelle: string }
  | { readonly gelaufen: false; readonly grund: string };

/** Eine fiktive Kette mit Personen, System, Dienstzugang, Löschung und Objektzielen. */
const KETTE: readonly (readonly [string, AuditInput])[] = [
  ["2026-10-01T08:00:00.000Z", { actor: "system", action: "gap.created", target: "gap-1" }],
  ["2026-10-02T08:00:00.000Z", { actor: "u-anna", action: "auth.login", target: "u-anna" }],
  [
    "2026-10-03T08:00:00.000Z",
    { actor: "u-anna", action: "ko.revised", target: "ko-1", payload: { version: 2 } },
  ],
  [
    "2026-10-04T08:00:00.000Z",
    {
      actor: "u-admin",
      action: "user.role-change",
      target: "u-gerd",
      payload: { role: "admin", previousRole: "experte", actorName: "Ada", targetName: "Gerd" },
    },
  ],
  ["2026-10-05T08:00:00.000Z", { actor: "dienst:wiki", action: "ko.revised", target: "ko-2" }],
  ["2026-10-06T08:00:00.000Z", { actor: "u-gerd", action: "auth.login", target: "u-gerd" }],
  [
    "2026-10-07T08:00:00.000Z",
    {
      actor: "u-admin",
      action: "user.delete",
      target: "u-gerd",
      payload: { targetName: "Gerd", actorName: "Ada" },
    },
  ],
  [
    "2026-10-08T08:00:00.000Z",
    { actor: "u-anna", action: "ko.revised", target: "ko-1", payload: { version: 3 } },
  ],
];

/** Die Anfragen, deren Ergebnis in beiden Ablagen gleich sein muss. */
const ANFRAGEN: readonly AuditSeitenAnfrage[] = [
  {},
  { limit: 3 },
  { actor: "u-anna" },
  { action: "ko.revised" },
  { target: "ko-1" },
  { actions: ["auth.login", "user.delete"] },
  { from: "2026-10-03T00:00:00.000Z", to: "2026-10-06T00:00:00.000Z" },
  { actor: "u-anna", action: "ko.revised", target: "ko-1", from: "2026-10-04T00:00:00.000Z" },
  { to: "2026-10-03T08:00:00.000Z" },
  { actor: "u-niemand" },
];

describe("ADMIN-03 · Seitenweg und Namensbelege: PostgreSQL ≡ Speicherablage", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let laufzustand: Laufzustand | undefined;
  const schema = `adm03_${Date.now().toString(36)}`;

  beforeAll(async () => {
    let quelle: string | undefined;
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      quelle = lokal;
      laufzustand = { gelaufen: true, quelle: "lokale Testinstanz (KLARWERK_PG_TEST_URL)" };
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL von der Sicherung abgelehnt" };
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        quelle = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        laufzustand = { gelaufen: true, quelle: "Testcontainer postgres:16-alpine" };
      } catch (fehler) {
        laufzustand = {
          gelaufen: false,
          grund: `kein Container-Runtime erreichbar (${fehler instanceof Error ? fehler.name : "unbekannt"})`,
        };
      }
    }
    if (quelle) {
      // Ein eigenes Schema je Lauf: kein fremder Bestand in `audit`, und dieser Lauf hinterlässt
      // nichts in einem fremden.
      const verwaltung = new Pool({ connectionString: quelle });
      await verwaltung.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
      await verwaltung.end();
      pool = new Pool({ connectionString: quelle, options: `-c search_path=${schema}` });
      await pool.query(AUDIT_SCHEMA);
      await pool.query(AUDIT_EVENT_ID_SCHEMA);
      await pool.query(AUDIT_HASH_VERSION_SCHEMA);
    }
    process.stderr.write(
      laufzustand?.gelaufen
        ? `[KLARWERK][ADMIN-03] Seitenweg-Pg GELAUFEN gegen ${laufzustand.quelle}.\n`
        : `[KLARWERK][ADMIN-03] Seitenweg-Pg ÜBERSPRUNGEN — ${laufzustand?.grund ?? "kein Zustand"}.\n`,
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    }
    await container?.stop();
  });

  it("Zeuge: der Lauf sagt, ob er gemessen hat", () => {
    expect(laufzustand, "beforeAll hat keinen Zustand hinterlassen").toBeDefined();
    if (laufzustand?.gelaufen) {
      expect(pool).toBeDefined();
    } else {
      expect((laufzustand as { grund: string }).grund.length).toBeGreaterThan(0);
    }
  });

  it("jede Anfrage liefert in beiden Ablagen dieselben Einträge, dieselbe Reihenfolge, denselben Zeiger", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    let uhr = 0;
    const pg = new AuditService({ repo: new PgAuditRepo(pool), now: () => uhr });
    const speicher = new AuditService({ repo: new InMemoryAuditRepo(), now: () => uhr });
    for (const [zeit, eintrag] of KETTE) {
      uhr = Date.parse(zeit);
      await pg.record(eintrag);
      await speicher.record(eintrag);
    }

    for (const anfrage of ANFRAGEN) {
      // Alle Seiten der Anfrage nacheinander, bis der Zeiger endet.
      const blaettern = async (dienst: AuditService): Promise<number[][]> => {
        const seiten: number[][] = [];
        let before: number | undefined;
        for (let runde = 0; runde < 20; runde += 1) {
          const seite = await dienst.page({
            ...anfrage,
            limit: anfrage.limit ?? 2,
            ...(before !== undefined ? { before } : {}),
          });
          seiten.push(seite.entries.map((e) => e.seq));
          if (seite.nextBefore === null) {
            break;
          }
          before = seite.nextBefore;
        }
        return seiten;
      };
      const ausPg = await blaettern(pg);
      expect(ausPg, JSON.stringify(anfrage)).toEqual(await blaettern(speicher));
      // Keine Lücke und keine Doppelung über die Seiten hinweg.
      const alle = ausPg.flat();
      expect(new Set(alle).size, JSON.stringify(anfrage)).toBe(alle.length);
    }
    // Stichprobe gegen die Erwartung, damit die Gleichheit nicht über zwei leeren Mengen steht.
    expect((await pg.page({ target: "ko-1" })).entries.map((e) => e.seq)).toEqual([8, 3]);
    expect((await pg.page({ limit: 100000 })).limit).toBe(100);

    // Namensbelege (Bens Befund Nacharbeit 3): je Kennung nur die JÜNGSTE Zuordnung — u-gerd: die
    // Löschung (7) als Zielname und Kontovorgang; u-anna: ihre Anmeldung (2) als Kontovorgang.
    const belegePg = (await pg.namensbelege(["u-gerd", "u-anna"])).map((e) => e.seq);
    const belegeSpeicher = (await speicher.namensbelege(["u-gerd", "u-anna"])).map((e) => e.seq);
    expect(belegePg).toEqual(belegeSpeicher);
    expect(belegePg).toEqual([2, 7]);
    expect(await pg.namensbelege([])).toEqual([]);

    // Die Begrenzung sitzt in der Abfrage: 200 weitere Rollenwechsel ändern nichts an der Anzahl.
    for (let i = 0; i < 200; i += 1) {
      uhr += 1000;
      const wechsel: AuditInput = {
        actor: "u-admin",
        action: "user.role-change",
        target: "u-gerd",
        payload: { role: "experte", actorName: `Ada ${i}`, targetName: `Gerd ${i}` },
      };
      await pg.record(wechsel);
      await speicher.record(wechsel);
    }
    const vielePg = await pg.namensbelege(["u-gerd", "u-admin"]);
    expect(vielePg.map((e) => e.seq)).toEqual(
      (await speicher.namensbelege(["u-gerd", "u-admin"])).map((e) => e.seq),
    );
    expect(vielePg.length).toBeLessThanOrEqual(6);
    expect(vielePg.find((e) => e.target === "u-gerd")?.payload.targetName).toBe("Gerd 199");

    // Die Lesewege ändern nichts: die Kette bleibt vollständig und prüfbar.
    const bericht = await pg.verifyReport();
    expect(bericht.ok).toBe(true);
    expect(bericht.count).toBe(KETTE.length + 200);
  });
});
