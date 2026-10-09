// ================================================================================================
// R-1133 — DER ENTWURFSINDEX GEGEN ECHTES POSTGRESQL
// ================================================================================================
//
// Was nur ein ausführender PostgreSQL beantwortet, kein Speicher-Doppel:
//
//   P1  `migrate()` legt die Indexspalten an; Anlegen indiziert, und ein NEU AUFGEBAUTER Dienst auf
//       derselben Datenbank liest denselben Index (er lebt in der Zeile, nicht im Prozess).
//   P2  Speichern bindet den Index an den neuen Stand; eine verspätete Ableitung des alten Stands
//       wird von der Standbedingung im `WHERE` abgewiesen.
//   P3  Altbestand (eine Zeile ohne Index): der Abgleich zieht nach, ein zweiter Lauf ist ein No-op,
//       und `data` bleibt Byte für Byte, wie es war.
//   P4  Duplikatsfrage, Papierkorb, Wiederherstellen, endgültiges Löschen — an der echten Zeile.
//   P5  Die Duplikatsfrage ist ein Zugriff über `drafts_index_hash_idx` (Plan, mit derselben
//       Messregel wie `tests/suchprojektion-vorauswahl/`: volle Durchläufe gesperrt).
//
// Die Datenbank kommt aus `../ko/pg-pruefplatz` (isoliert über `KLARWERK_PG_TEST_URL`, sonst
// Testcontainer, sonst ROT).
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { CaptureService, type Draft, PgDraftRepo } from "../../services/capture";
import { entwurfsIndexVon } from "../../services/capture/src/entwurfs-index";
import { type IsoliertePg, oeffneIsoliertePg } from "../ko/pg-pruefplatz";

const SICHTBAR = () => true;

describe("R-1133 · der Entwurfsindex gegen echtes PostgreSQL", () => {
  let pg: IsoliertePg | undefined;
  let pool: Pool;

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("entwurfsindex");
    pool = createPool(pg.url);
    await migrate(pool);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await pg?.abraeumen();
  });

  const dienst = () => new CaptureService({ repo: new PgDraftRepo(pool) });

  async function zeile(id: string) {
    const res = await pool.query<{
      data: Draft;
      index_stand: string | null;
      index_hash: string | null;
      index_text: string | null;
    }>("SELECT data, index_stand, index_hash, index_text FROM drafts WHERE id=$1", [id]);
    return res.rows[0];
  }

  it("P1 · Anlegen indiziert, und ein neu aufgebauter Dienst liest denselben Index", async () => {
    const capture = dienst();
    const draft = await capture.createDraft(
      { title: "Kessel K1 entlüften", statement: "Ventil oben öffnen.", tags: ["Heizung"] },
      "anna",
    );
    // Die Indexarbeit läuft entkoppelt vom Speicherweg (BEN, Nacharbeit 4) — wer liest, wartet.
    await capture.indexArbeitAbgeschlossen();
    const gespeichert = await zeile(draft.id);
    expect(gespeichert?.index_stand).toBe(draft.updatedAt);
    expect(gespeichert?.index_text).toContain("Kessel K1 entlüften");
    expect(gespeichert?.index_text).toContain("Heizung");
    expect(gespeichert?.index_hash).toBe(entwurfsIndexVon(draft).inhaltsHash);

    const neu = new PgDraftRepo(pool);
    expect(await neu.entwurfsIndexVon(draft.id)).toEqual(entwurfsIndexVon(draft));
  });

  it("P2 · Speichern bindet an den neuen Stand; der alte Stand kommt nicht mehr durch", async () => {
    const capture = dienst();
    const draft = await capture.createDraft({ title: "Filter F2", statement: "Alt." }, "anna");
    const neu = await capture.continueDraft(draft.id, { statement: "Neu." }, "anna");
    await capture.indexArbeitAbgeschlossen();

    const repo = new PgDraftRepo(pool);
    expect((await repo.entwurfsIndexVon(draft.id))?.stand).toBe(neu.updatedAt);
    expect(await repo.setzeEntwurfsIndex(draft.id, entwurfsIndexVon(draft))).toBe(false);
    expect((await repo.entwurfsIndexVon(draft.id))?.text).toContain("Neu.");
    expect((await repo.entwurfsIndexVon(draft.id))?.text).not.toContain("Alt.");
  });

  it("P3 · Altbestand wird nachgezogen, ein zweiter Lauf ist ein No-op, `data` bleibt gleich", async () => {
    const alt: Draft = {
      id: "pg-alt-1",
      payload: { title: "Altentwurf PG", statement: "Vor dem Index geschrieben." },
      originalAuthor: "anna",
      lastEditor: "anna",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    await pool.query("INSERT INTO drafts(id, data) VALUES($1, $2)", [alt.id, JSON.stringify(alt)]);
    const vorher = await zeile(alt.id);
    expect(vorher?.index_stand).toBeNull();

    const repo = new PgDraftRepo(pool);
    expect(await repo.offeneEntwurfsIndizes(1000)).toContain(alt.id);
    const erster = await dienst().gleicheEntwurfsIndexAb();
    expect(erster.offenDanach).toBe(0);
    expect(erster.nachgezogen).toBeGreaterThanOrEqual(1);
    expect(await dienst().gleicheEntwurfsIndexAb()).toEqual({ nachgezogen: 0, offenDanach: 0 });

    const nachher = await zeile(alt.id);
    expect(nachher?.index_stand).toBe(alt.updatedAt);
    expect(nachher?.data).toEqual(vorher?.data);
  });

  it("P4 · Duplikatsfrage, Papierkorb, Wiederherstellen und endgültiges Löschen an der echten Zeile", async () => {
    const capture = dienst();
    const inhalt = { title: "Lager L7 schmieren", statement: "Alle 500 Stunden." };
    const eins = await capture.createDraft(inhalt, "bodo");
    const zwei = await capture.createDraft(inhalt, "bodo");
    await capture.indexArbeitAbgeschlossen();

    const ids = async () =>
      (await capture.entwuerfeMitGleichemInhalt(eins.id, SICHTBAR)).entwuerfe.map((e) => e.id);
    expect(await ids()).toEqual([zwei.id]);

    await capture.deleteDraft(zwei.id, "bodo");
    expect(await ids()).toEqual([]);
    await capture.restoreDraft(zwei.id);
    await capture.indexArbeitAbgeschlossen();
    expect(await ids()).toEqual([zwei.id]);

    await capture.deleteDraft(zwei.id, "bodo");
    await capture.purgeTrashedDraft(zwei.id);
    expect(await zeile(zwei.id)).toBeUndefined();
    expect(await ids()).toEqual([]);
  });

  it("P5 · die Duplikatsfrage läuft über drafts_index_hash_idx", async () => {
    const capture = dienst();
    const draft = await capture.createDraft({ title: "Planprobe", statement: "Hash." }, "anna");
    await capture.indexArbeitAbgeschlossen();
    await pool.query("ANALYZE drafts");
    // Die Anweisung, die die Ablage WIRKLICH absetzt — aufgezeichnet, nicht abgeschrieben.
    const abgesetzt: { sql: string; params: unknown[] }[] = [];
    const aufzeichnend = {
      query: (sql: string, params?: unknown[]) => {
        abgesetzt.push({ sql, params: params ?? [] });
        return pool.query(sql, params);
      },
    } as unknown as Pool;
    await new PgDraftRepo(aufzeichnend).entwuerfeMitInhalt(
      entwurfsIndexVon(draft).inhaltsHash,
      draft.id,
    );
    const anweisung = abgesetzt[0] as { sql: string; params: unknown[] };
    expect(anweisung.sql).toContain("index_hash = $1");
    const client = await pool.connect();
    try {
      await client.query("SET enable_seqscan = off");
      await client.query("SET enable_indexscan = off");
      const plan = await client.query<{ "QUERY PLAN": string }>(
        `EXPLAIN ${anweisung.sql}`,
        anweisung.params,
      );
      const text = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
      expect(text, text).toContain("drafts_index_hash_idx");
    } finally {
      await client.query("RESET enable_seqscan");
      await client.query("RESET enable_indexscan");
      client.release();
    }
  });
});
