import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Pool } from "pg";
import { expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { type KlaraGespraech, PgKlaraGespraechRepo } from "../../services/app/src/klara-gespraech";
it("echte PG-JSON-Adapter und API erhalten Kandidatenindizes über neue Instanzen am kontrollierten Speicherport (kein PG)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "w44-quellen-"));
  const file = join(dir, "j.jsonl");
  let app: ReturnType<typeof buildApp> | undefined;
  try {
    const query = async (sql: string, werte: unknown[]) => {
      const g = existsSync(file)
        ? (JSON.parse(readFileSync(file, "utf8")) as KlaraGespraech)
        : null;
      if (
        sql.startsWith("INSERT INTO klara_gespraeche") ||
        sql.startsWith("UPDATE klara_gespraeche")
      ) {
        if (sql.startsWith("UPDATE") && g?.fassung !== werte[5]) return { rowCount: 0, rows: [] };
        writeFileSync(file, String(werte[4]));
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes("count(*)")) return { rows: [{ n: g ? 1 : 0 }] };
      if (sql.startsWith("SELECT data"))
        return {
          rows:
            g &&
            ((sql.includes("WHERE id") && g.id === werte[0] && g.kontoId === werte[1]) ||
              (!sql.includes("WHERE id") && g.kontoId === werte[0]))
              ? [{ data: g }]
              : [],
        };
      throw new Error("Unerwarteter Test-SQL-Befehl");
    };
    const pool = { query } as unknown as Pool;
    const s = assembleServices(inMemoryRepos(), {
      klaraGespraeche: new PgKlaraGespraechRepo(pool),
    });
    const u = await s.auth.register({
      name: "Ada",
      email: "ada@attrappe.test",
      password: "Fiktiv-geheim-123",
    });
    const { token } = await s.auth.login({ email: u.email, password: "Fiktiv-geheim-123" });
    const kos = [];
    for (const title of ["A", "B", "C"])
      kos.push(
        await s.ko.create({
          title,
          statement: `Regel ${title}`,
          type: "best_practice",
          category: "Betrieb",
          author: u.id,
          confidentiality: "intern",
        }),
      );

    await s.answerSnapshots.createRecord({
      answerId: "antwort-1",
      askExecutionId: "lauf-1",
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      owner: { kind: "user", userId: u.id },
    });
    const snap = {
      answerId: "antwort-1",
      snapshotRevision: 1,
      supersedesSnapshotRevision: null,
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      citedSources: kos.slice(1).map((k) => k.id),
      evidence: kos.slice(1).map((k) => ({
        knowledgeObjectId: k.id,
        knowledgeObjectVersion: k.version,
        evidenceRole: "carrying",
        sourceRecordId: null,
        sourceRecordIdReason: "no_source_anchor",
        locator: null,
        locatorReason: "no_source_anchor",
        validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
      })),
      resolutionId: null,
      resolutionIdReason: "w1_not_on_answer_path",
      validationDecisionRef: null,
      validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
      status: "INCOMPLETE",
      integrityHash: "",
      generationMode: "deterministic",
    } as AnswerEvidenceSnapshot;
    await s.answerSnapshots.appendSnapshot({ ...snap, integrityHash: hashAnswerSnapshot(snap) });
    app = buildApp(s);
    const headers = { authorization: `Bearer ${token}` };
    const bezug = { pfad: "/fragen", seitenName: "Fragen", objekt: "Gespräch" };
    const created = await app.inject({
      method: "POST",
      url: "/api/me/klara/gespraeche",
      headers,
      payload: { objektbezug: bezug },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().gespraech.id;
    await app.inject({
      method: "PUT",
      url: `/api/me/klara/gespraeche/${id}/einwilligung`,
      headers,
      payload: { erteilt: true },
    });
    const added = await app.inject({
      method: "POST",
      url: `/api/me/klara/gespraeche/${id}/nachrichten`,
      headers,
      payload: {
        von: "klara",
        modus: "ki",
        text: "Regel [2], Ausnahme [3].",
        objektbezug: bezug,
        antwortId: "antwort-1",
        quellen: [kos[1]?.id, kos[2]?.id],
        quellenAngaben: [
          { koId: kos[1]?.id, titel: "B", fassung: 1, geprueft: false, kandidatenIndex: 2 },
          { koId: kos[2]?.id, titel: "C", fassung: 1, geprueft: false, kandidatenIndex: 3 },
        ],
      },
    });
    expect(added.statusCode, added.body).toBe(201);
    await app.close();
    app = undefined;
    expect(readFileSync(file, "utf8")).toContain('"kandidatenIndex":2');
    s.klaraGespraeche = new PgKlaraGespraechRepo(pool);
    app = buildApp(s);
    const loaded = await app.inject({
      method: "GET",
      url: `/api/me/klara/gespraeche/${id}`,
      headers,
    });
    expect(loaded.statusCode, loaded.body).toBe(200);
    expect(
      loaded
        .json()
        .gespraech.nachrichten.at(-1)
        .quellenAngaben.map((a: { titel: string; kandidatenIndex: number }) => [
          a.titel,
          a.kandidatenIndex,
        ]),
    ).toEqual([
      ["B", 2],
      ["C", 3],
    ]);
  } finally {
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
