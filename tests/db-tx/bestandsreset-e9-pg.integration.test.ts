// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSRESET (E9) — DER RESET GEGEN DIE PRODUKTIVE MIGRATION.
// ================================================================================================
//
// E9, entschieden: „Der Bestandsreset schließt den Papierkorb ein — aber die registrierten Nutzer
// bleiben bestehen. Gelöscht werden Wissensobjekte und Papierkorb, nicht die Konten."
//
// `bestandsreset.test.ts` beweist die Ablauflogik gegen ein Doppel. Was nur hier beweisbar ist:
//
//   P1  Jede Tabelle des Standard-Löschgraphen gibt es nach `migrate()` wirklich. Fehlte eine,
//       scheiterte jedes `DELETE` an ihr, und der Reset rollte IMMER zurück.
//   P2  Nach dem Reset sind lebende UND getrashte KOs samt wissensgebundener Tabellen leer; Konten
//       und Sitzungen stehen unverändert; der Schreibstand ist gestiegen; der Befund ist OK.
//   P3  Hält jemand die exklusive Sperre, beginnt ein zweiter Reset nicht — gegen echte
//       Advisory-Sperren, nicht gegen ein Doppel (die in `bestandsreset.test.ts` offen benannte
//       Hypothese).
//
// GRENZE: `SQL_SCHEMA_BESTANDSRESET` steht nicht in `migrate()` (der Aufrufer-Wächter führt den
// Reset bewusst ohne Produktaufrufer). Dieser Test legt die Lauftabelle deshalb selbst an.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgKenntnisnahmeRepo } from "../../services/app/src/kenntnisnahme";
import {
  BESTANDSRESET_LOESCHGRAPH,
  BestandsresetGesperrtError,
  SQL_SCHEMA_BESTANDSRESET,
  SQL_SPERRE_EXKLUSIV,
  fuehreBestandsresetAus,
} from "../../services/db-tx";

describe("E9 · Bestandsreset gegen echtes Postgres: Wissen und Papierkorb weg, Konten bleiben", () => {
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
    pool.options.max = 4;
    await migrate(pool);
    await pool.query(SQL_SCHEMA_BESTANDSRESET);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  const anzahl = async (tabelle: string): Promise<number> =>
    Number((await pool.query(`SELECT count(*)::int AS n FROM ${tabelle}`)).rows[0].n);

  const schreibstand = async (): Promise<number> =>
    Number((await pool.query("SELECT stand FROM ko_schreibstand WHERE id = 1")).rows[0].stand);

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE users, sessions, bestandsreset_laeufe, kos, dokument_fassungen,
                kenntnisnahme_empfaenger, kenntnisnahme_anforderungen`,
    );
    await pool.query(
      `INSERT INTO users(id, name, email, password_salt, password_hash, role, approved, created_at)
       VALUES ('konto-testerin', 'Testerin', 'testerin@example.invalid', 's', 'h', 'editor', true,
               '2026-07-30T08:00:00.000Z')`,
    );
    await pool.query(
      "INSERT INTO sessions(token, user_id, expires_at) VALUES ('sitzung-1', 'konto-testerin', 9999999999999)",
    );
    const ko = (id: string, extra: Record<string, unknown>) =>
      pool.query(
        "INSERT INTO kos(id, type, status, category, data) VALUES ($1, 'wiki', 'published', 'allgemein', $2::jsonb)",
        [id, JSON.stringify({ id, title: `Testtitel ${id}`, ...extra })],
      );
    await ko("ko-lebend", {});
    await ko("ko-papierkorb", { deletedAt: "2026-07-01T00:00:00.000Z" });
    await pool.query(
      `INSERT INTO dokument_fassungen(fassung_id, dokument_id, fassung, data)
       VALUES ('fassung-1', 'ko-lebend', 1, '{}'::jsonb)`,
    );
    await new PgKenntnisnahmeRepo(pool).anlegen(
      {
        id: "anf-1",
        koId: "ko-lebend",
        fassung: 1,
        angefordertVon: "konto-testerin",
        angefordertAm: "2026-07-30T08:00:00.000Z",
        frist: null,
        erinnertAm: null,
      },
      ["konto-testerin"],
    );
  });

  it("P1 · jede Tabelle des Standard-Löschgraphen legt die produktive Migration an", async () => {
    const fehlend: string[] = [];
    for (const tabelle of BESTANDSRESET_LOESCHGRAPH) {
      const res = await pool.query("SELECT to_regclass($1) AS r", [tabelle]);
      if (res.rows[0].r === null) {
        fehlend.push(tabelle);
      }
    }
    expect(fehlend).toEqual([]);
  });

  it("P2 · Wissen und Papierkorb sind weg, Konten und Sitzungen stehen, der Schreibstand steigt", async () => {
    expect(await anzahl("kos")).toBe(2);
    const standVorher = await schreibstand();

    const befund = await fuehreBestandsresetAus(pool, "lauf-e9");

    expect(befund).toMatchObject({ zustand: "OK", erfolgMeldbar: true });
    for (const tabelle of [
      "kos",
      "dokument_fassungen",
      "kenntnisnahme_empfaenger",
      "kenntnisnahme_anforderungen",
    ]) {
      expect(await anzahl(tabelle), tabelle).toBe(0);
    }
    const konten = await pool.query("SELECT id, email, approved FROM users");
    expect(konten.rows).toEqual([
      { id: "konto-testerin", email: "testerin@example.invalid", approved: true },
    ]);
    expect(await anzahl("sessions")).toBe(1);
    expect(await schreibstand()).toBeGreaterThan(standVorher);
    const lauf = await pool.query(
      "SELECT status, payload_committed_at FROM bestandsreset_laeufe WHERE id = 'lauf-e9'",
    );
    expect(lauf.rows[0].status).toBe("OK");
    expect(lauf.rows[0].payload_committed_at).not.toBeNull();
  });

  it("P3 · hält jemand die exklusive Sperre, beginnt ein zweiter Reset nicht — der Bestand steht", async () => {
    const halter = await pool.connect();
    try {
      await halter.query("BEGIN");
      const erworben = await halter.query<{ erworben: boolean }>(SQL_SPERRE_EXKLUSIV);
      expect(erworben.rows[0]?.erworben).toBe(true);

      await expect(fuehreBestandsresetAus(pool, "lauf-zweiter")).rejects.toBeInstanceOf(
        BestandsresetGesperrtError,
      );
    } finally {
      await halter.query("ROLLBACK").catch(() => undefined);
      halter.release();
    }

    expect(await anzahl("kos")).toBe(2);
    expect(await anzahl("users")).toBe(1);
    const lauf = await pool.query(
      "SELECT status, payload_committed_at FROM bestandsreset_laeufe WHERE id = 'lauf-zweiter'",
    );
    expect(lauf.rows[0]).toEqual({ status: "ROLLED_BACK", payload_committed_at: null });
  });
});
