import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { OVERLAP_SCHEMA, PgOverlapRepo } from "./overlap-repo-pg";
import type { OverlapEntry } from "./overlap-types";
import { CONFLICTS_SCHEMA, PgConflictRepo } from "./repo-pg";
// JOB 3914: der Entscheidungsweg selbst — `dismiss`/`resolve` schreiben über `save()` →
// `repo.update()`. Ohne ihn misse dieser Lauf einen nachgebauten Datensatz statt der Ablage,
// die der Mensch auslöst.
import { ConflictService } from "./service";
import type { Conflict } from "./types";

// D-AISTATE PAKET 4 (bens V5, aistate-fix4): echte Postgres-Belege für den ATOMAREN,
// versionsgebundenen Insert (insertIfVersionsCurrent) — das Versions-Prädikat steht als
// WHERE-Bedingung IM Insert; ein zwischenzeitlich revidiertes KO lässt den Insert scheitern,
// ohne dass je ein Datensatz committed wird. Muster/Gating wie repo-pg.integration.test.ts im
// knowledge-object-Modul: braucht Docker (Testcontainers) bzw. KLARWERK_PG_TEST_URL, läuft NUR
// unter `test:integration`, wird ohne Infrastruktur sauber übersprungen, nie gefälscht.
// Die kos-Tabelle wird hier als minimaler Stand-in angelegt (id + data->>'version' — genau die
// Fläche, die das Prädikat liest); die echte Tabelle des KO-Moduls ist strukturell identisch.
const KOS_STANDIN_SCHEMA = `
CREATE TABLE IF NOT EXISTS kos (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

function conflict(id: string, over: Partial<Conflict> = {}): Conflict {
  return {
    id,
    koA: "a",
    koB: "b",
    type: "truth",
    description: "Widerspruch",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    origin: "auto",
    createdAt: "2026-07-23T00:00:00.000Z",
    ...over,
  };
}

function overlap(id: string, over: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id,
    koA: "a",
    koB: "b",
    relation: "identisch",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren",
    status: "offen",
    pairKey: "a|b",
    origin: "auto",
    createdAt: "2026-07-23T00:00:00.000Z",
    ...over,
  };
}

describe("aistate-fix4 (bens V5): insertIfVersionsCurrent gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    // Lokale Instanz hat Vorrang (Docker-lose Evidence-Läufe); sonst Testcontainers; sonst Skip.
    // Die lokale URL läuft durch die Sicherung in pg-test-guard — nie eine echte DB.
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      available = false; // kein Docker/PG → skip statt Fehlschlag
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS conflicts CASCADE");
    await p.query("DROP TABLE IF EXISTS ko_overlaps CASCADE");
    await p.query("DROP TABLE IF EXISTS kos CASCADE");
    await p.query(KOS_STANDIN_SCHEMA);
    await p.query(CONFLICTS_SCHEMA);
    await p.query(OVERLAP_SCHEMA);
    await p.query("INSERT INTO kos(id,data) VALUES('a','{\"version\":2}'),('b','{\"version\":3}')");
  }

  // Das Prädikat muss die Autorität der DB nutzen — ein (veraltetes) isCurrent-Urteil des
  // Aufrufers darf den Insert NIE tragen. Deshalb lügt der Callback hier bewusst "true".
  const luegnerischesIsCurrent = () => true;

  it("Konflikt: beide gebundenen Versionen aktuell ⇒ Insert committet genau einen offenen Datensatz", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    const ok = await repo.insertIfVersionsCurrent(
      conflict("c1", { koAVersion: 2, koBVersion: 3 }),
      luegnerischesIsCurrent,
    );
    expect(ok).toBe(true);
    const rows = await p.query("SELECT data FROM conflicts");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].data.status).toBe("offen");
  });

  it("Konflikt: eine Seite revidiert ⇒ rowCount 0, GAR KEIN Datensatz — auch wenn isCurrent 'true' lügt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    // b steht in der DB auf Version 3 — der Lauf ist an Version 2 gebunden (stale).
    const ok = await repo.insertIfVersionsCurrent(
      conflict("c2", { koAVersion: 2, koBVersion: 2 }),
      luegnerischesIsCurrent,
    );
    expect(ok).toBe(false);
    expect((await p.query("SELECT id FROM conflicts")).rowCount).toBe(0);
  });

  it("Konflikt: KO fehlt oder Versionsbindung fehlt ⇒ fail-closed kein Insert", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    const geist = await repo.insertIfVersionsCurrent(
      conflict("c3", { koB: "geist", koAVersion: 2, koBVersion: 1 }),
      luegnerischesIsCurrent,
    );
    expect(geist).toBe(false);
    const ungebunden = await repo.insertIfVersionsCurrent(conflict("c4"), luegnerischesIsCurrent);
    expect(ungebunden).toBe(false);
    expect((await p.query("SELECT id FROM conflicts")).rowCount).toBe(0);
  });

  it("Overlap: aktuell ⇒ Insert; revidiert ⇒ rowCount 0, GAR KEIN Datensatz", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgOverlapRepo(p);
    expect(
      await repo.insertIfVersionsCurrent(
        overlap("o1", { koAVersion: 2, koBVersion: 3 }),
        luegnerischesIsCurrent,
      ),
    ).toBe(true);
    expect(
      await repo.insertIfVersionsCurrent(
        overlap("o2", { koAVersion: 1, koBVersion: 3 }),
        luegnerischesIsCurrent,
      ),
    ).toBe(false);
    const rows = await p.query("SELECT id FROM ko_overlaps ORDER BY id");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].id).toBe("o1");
  });

  // aistate-fix6 (bens fix5-Recheck §4): der Lese-GC-STATUS-CAS gegen ECHTES Postgres — das bedingte
  // UPDATE gewinnt nur, solange die Zeile offen ist; PostgreSQLs Zeilensperre liefert unter echter
  // Nebenläufigkeit genau EINEN Gewinner (kein Mehrfach-Schließen, kein Lost Update).
  const supersededConflict: Partial<Conflict> = {
    status: "geloest",
    decidedBy: null,
    resolutionReason: "superseded",
  };
  const supersededOverlap: Partial<OverlapEntry> = {
    status: "geschlossen",
    resolution: { reason: "superseded", by: null, note: null, at: "2026-07-24T00:00:00.000Z" },
    closedAt: "2026-07-24T00:00:00.000Z",
  };

  it("Konflikt-CAS: offen ⇒ genau EIN Gewinner unter Nebenläufigkeit; ein zweiter Lauf no-op", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    await repo.insert(conflict("cas1", { koAVersion: 2, koBVersion: 3 }));
    // Zwei parallel ausgeführte CAS-Statements auf DERSELBEN offenen Zeile.
    const [a, b] = await Promise.all([
      repo.supersedeIfOpen("cas1", supersededConflict),
      repo.supersedeIfOpen("cas1", supersededConflict),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1); // exakt EIN Gewinner
    const row = (await p.query("SELECT data FROM conflicts WHERE id='cas1'")).rows[0].data;
    expect(row.status).toBe("geloest");
    expect(row.resolutionReason).toBe("superseded");
    expect(row.decidedBy).toBeNull();
    // Ein weiterer Lauf schließt nichts erneut (bereits geschlossen ⇒ false).
    expect(await repo.supersedeIfOpen("cas1", supersededConflict)).toBe(false);
  });

  it("Konflikt-CAS: eine menschliche Entscheidung (Status ≠ offen) gewinnt ⇒ GC no-op, kein Overwrite", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    // Mensch hat bereits eskaliert — der GC darf das NICHT als superseded überschreiben.
    await repo.insert(
      conflict("cas2", { koAVersion: 2, koBVersion: 3, status: "eskaliert", decidedBy: "mensch" }),
    );
    expect(await repo.supersedeIfOpen("cas2", supersededConflict)).toBe(false);
    const row = (await p.query("SELECT data FROM conflicts WHERE id='cas2'")).rows[0].data;
    expect(row.status).toBe("eskaliert");
    expect(row.decidedBy).toBe("mensch");
  });

  it("Overlap-CAS: offen ⇒ genau EIN Gewinner unter Nebenläufigkeit; ein zweiter Lauf no-op", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgOverlapRepo(p);
    await repo.insert(overlap("ocas1", { koAVersion: 2, koBVersion: 3 }));
    const [a, b] = await Promise.all([
      repo.supersedeIfOpen("ocas1", supersededOverlap),
      repo.supersedeIfOpen("ocas1", supersededOverlap),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const row = (await p.query("SELECT data FROM ko_overlaps WHERE id='ocas1'")).rows[0].data;
    expect(row.status).toBe("geschlossen");
    expect(row.resolution.reason).toBe("superseded");
    expect(row.resolution.by).toBeNull();
    expect(await repo.supersedeIfOpen("ocas1", supersededOverlap)).toBe(false);
  });

  // ==============================================================================================
  // JOB 3914 — DER MENSCHLICHE VERMERK NACH EINEM NEUEN VERBINDUNGSAUFBAU.
  // ==============================================================================================
  // Bestellt von BEN zweimal: zu JOB 3887 (Prüfpunkt 6 — „Postgres: später Entscheidung nach
  // erneuter Datenbankverbindung zurücklesen") und zu JOB 3888 („PostgreSQL-Vermerk nach erneutem
  // Verbindungsaufbau"). Die sieben Bestandsfälle darüber rufen `update()` NIE auf, und der
  // gemeinsame Bauer `conflict()` (:25-40) setzt `decision`/`decidedBy` fest auf null — der
  // Freitext eines Menschen wurde hier also nie geschrieben und nie zurückgelesen. Genau das
  // schließen die zwei Fälle hier, auf dem Schreibweg, den `ConflictService.save()`
  // (service.ts:638-641) für JEDE Entscheidung nimmt: `repo.update()`, sonst nichts.
  //
  // WARUM EIN EIGENER POOL UND NICHT DER DER SUITE: „neuer Verbindungsaufbau" heißt, dass zwischen
  // Schreiben und Lesen weder Verbindung noch Pool-Zustand überleben. Der Suite-Pool trägt aber
  // Container und alle weiteren Fälle (afterAll :102-105) — ihn hier zu schließen, nähme jedem
  // folgenden Fall die Datenbank. Geschrieben wird deshalb über einen EIGENEN Pool, der danach
  // geschlossen wird, gelesen über einen FRISCHEN Pool auf dieselbe Datenbank mit einem frischen
  // `PgConflictRepo`. Gating, `reset` und `requirePool` bleiben unverändert; ohne Infrastruktur
  // wird sauber übersprungen, nie gefälscht.
  //
  // DER BELEG, DER IM TOR MITFÄHRT (ohne Docker, Paritätsteil): siehe
  // `tests/konflikt-vermerk-postgres/vermerk-ueberlebt-die-postgres-ablage.test.ts`.
  function verbindung(p: Pool): string {
    const url = p.options.connectionString;
    if (!url) {
      throw new Error(
        "Pool ohne connectionString — ein neuer Verbindungsaufbau wäre nicht messbar, also wird hier nichts behauptet.",
      );
    }
    return url;
  }

  // Der Schreibvorgang läuft über den ECHTEN Entscheidungsweg, nicht über einen nachgebauten
  // Datensatz: `ConflictService.dismiss`/`.resolve` (service.ts:153-164 / :189-200) gehen durch
  // `save()` (:638-641), und `save()` ruft ausschliesslich `repo.update()` — also genau das
  // Vollobjekt-UPDATE aus repo-pg.ts:108-113, um das es hier geht. Damit rötet auch eine
  // Verstellung IM DIENST (etwa ein erfundener Notiztext) diese Fälle, statt an ihnen vorbeizugehen.
  //
  // JEDER Fall, der hierüber einen Datensatz ZURÜCKLIEST, prüft alle vier Felder einer menschlichen
  // Entscheidung — `status`, `decidedBy`, `decision`, `resolutionReason`. Drei von vier genügen
  // nicht: ohne `status` bliebe ein Fall grün, während die Entscheidung nach dem Neustart unwirksam
  // wäre (BEN zu JOB 3914, Prüfpunkt 6). Diese Zusage wird nicht nur hier eingehalten, sondern IM
  // TOR festgehalten — ohne Docker und ohne Datenbank, am Quelltext dieser Datei:
  // `tests/konflikt-vermerk-postgres/integrationsfaelle-lesen-alle-vier-felder.test.ts` (JOB 3940).
  async function mitNeuemPool<T>(
    p: Pool,
    fn: (repo: PgConflictRepo, dienst: ConflictService) => Promise<T>,
  ): Promise<T> {
    const frisch = new Pool({ connectionString: verbindung(p) });
    try {
      const repo = new PgConflictRepo(frisch);
      return await fn(repo, new ConflictService({ repo }));
    } finally {
      await frisch.end();
    }
  }

  it("JOB 3914: die Entscheidung mit Freitext ist nach NEUEM Verbindungsaufbau vollständig lesbar", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    await new PgConflictRepo(p).insert(conflict("vermerk1", { koAVersion: 2, koBVersion: 3 }));

    await mitNeuemPool(p, (_repo, dienst) =>
      dienst.resolve(
        "vermerk1",
        "controller-1",
        "Quelle B gilt; A galt nur für die alte Baureihe.",
      ),
    );

    // Neue Verbindung, neuer Pool, neues Repo — nichts aus dem Schreibvorgang überlebt im Prozess.
    const zurueck = await mitNeuemPool(p, (repo) => repo.findById("vermerk1"));
    expect(zurueck?.status).toBe("geloest");
    expect(zurueck?.decidedBy).toBe("controller-1");
    expect(zurueck?.decision).toBe("Quelle B gilt; A galt nur für die alte Baureihe.");
    expect(zurueck?.resolutionReason).toBe("decided");
  });

  it('JOB 3914: „Fehlalarm ohne Notiz" bleibt null, „entschieden" trägt den Freitext — beides über eine neue Verbindung', async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const start = new PgConflictRepo(p);
    await start.insert(conflict("ohne"));
    await start.insert(conflict("mit"));

    await mitNeuemPool(p, async (_repo, dienst) => {
      await dienst.dismiss("ohne", "controller-1"); // OHNE Notiz — `decision: note ?? null` (:159)
      await dienst.resolve("mit", "controller-1", "Quelle B gilt.");
    });

    const gelesen = await mitNeuemPool(p, async (repo) => ({
      ohne: await repo.findById("ohne"),
      mit: await repo.findById("mit"),
    }));
    // Weder "" noch fehlend: die Ablage erfindet keinen Text und verliert auch keinen. Und der
    // STATUS steht dabei (JOB 3940): fiele er im Adapter weg, stünde der Konflikt nach dem
    // Neustart wieder auf "offen" — die Entscheidung wäre getroffen und trotzdem unwirksam, und
    // dieser Fall hätte es mit drei von vier Feldern nicht gemerkt.
    expect(gelesen.ohne?.status).toBe("geloest");
    expect(gelesen.ohne?.decision).toBeNull();
    expect(gelesen.ohne?.decidedBy).toBe("controller-1");
    expect(gelesen.ohne?.resolutionReason).toBe("dismissed");
    expect(gelesen.mit?.status).toBe("geloest");
    expect(gelesen.mit?.decision).toBe("Quelle B gilt.");
    expect(gelesen.mit?.decidedBy).toBe("controller-1");
    expect(gelesen.mit?.resolutionReason).toBe("decided");
  });
});
