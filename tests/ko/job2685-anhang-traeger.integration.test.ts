// ================================================================================================
// JOB 2685 D1 (Review R2-30) — DIE SQL-ARME UND DIE NODE-PRÄDIKATE LIEFERN DIESELBE MENGE.
// ================================================================================================
//
// Der schnelle Beweis (tests/app/job2685-traegersuche-gleichheit.test.ts) übersetzt die vier Arme
// von KO_ANHANG_TRAEGER_SQL nach Node und zeigt, dass das URTEIL gleich bleibt. Was er nicht zeigen
// kann: dass Postgres die Arme so liest, wie sie gemeint sind — JSONB-Enthaltensein, LIKE mit
// Entwertung, die beiden EXISTS. Das zeigt nur ein echtes Postgres, über einen Kreuzbestand, mit
// MENGENGLEICHHEIT je Kennung: die Menge der Ids aus `listAnhangTraeger` muss ZEICHENGLEICH die
// Menge sein, die die Node-Übersetzung über denselben Bestand liefert.
//
// Braucht Docker (Testcontainers); läuft unter `npm run test:integration`, nicht im schnellen Tor —
// dasselbe Muster wie tests/security/380-trim-paritaet.integration.test.ts.
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  PgEvidenceRepo,
  PgKoRepo,
  PgKoVersionRepo,
} from "../../services/knowledge-object/src/repo-pg";

const HOCHLADENDER = "u-anna";
const FREMDER = "u-bert";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Lieferzeiten",
    statement: "Fuenf Werktage.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Logistik",
    tags: [],
    confidence: 50,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: HOCHLADENDER,
    author: HOCHLADENDER,
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    bodyHtml: "<p>Anlage freischalten.</p>",
    ...overrides,
  } as KnowledgeObject;
}

function text(objectId: string): string {
  return `<p>Siehe <img src="/api/objects/${objectId}/raw"></p>`;
}

interface Fall {
  objectId: string;
  ko: KnowledgeObject;
  fassungen: { author: string; snapshot: KnowledgeObject }[];
  belege: { objectId: string; createdBy: string }[];
}

// Elf Fundarten (wie im schnellen Test), je einmal lebend und einmal im Papierkorb; dazu zwei
// Sonderfälle für die LIKE-Entwertung: eine Kennung MIT `%`/`_`, und ein Objekt, dessen Text einer
// nicht entwerteten Fassung dieser Kennung entspräche.
function faelle(): Fall[] {
  const out: Fall[] = [];
  let n = 0;
  for (const fundart of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
    for (const getrasht of [false, true]) {
      n += 1;
      const objectId = `obj-${n}`;
      const koId = `ko-${n}`;
      const trash = getrasht ? { deletedAt: "2026-08-01T00:00:00.000Z" } : {};
      const basis = ko({ id: koId, ...trash });
      const fall: Fall = { objectId, ko: basis, fassungen: [], belege: [] };
      const att = (author: string) => [
        { id: `att-${n}`, name: "b.png", mime: "image/png", objectId, author },
      ];
      switch (fundart) {
        case 2:
          fall.ko = ko({ id: koId, attachments: att(HOCHLADENDER) as never, ...trash });
          break;
        case 3:
          fall.ko = ko({ id: koId, attachments: att(FREMDER) as never, ...trash });
          break;
        case 4:
          fall.ko = ko({ id: koId, bodyHtml: text(objectId), ...trash });
          break;
        case 5:
        case 6:
          fall.fassungen.push({
            author: fundart === 5 ? HOCHLADENDER : FREMDER,
            snapshot: ko({ id: koId, bodyHtml: text(objectId) }),
          });
          break;
        case 7:
          fall.fassungen.push(
            { author: FREMDER, snapshot: ko({ id: koId }) },
            { author: HOCHLADENDER, snapshot: ko({ id: koId, bodyHtml: text(objectId) }) },
          );
          break;
        case 8:
          fall.fassungen.push(
            { author: FREMDER, snapshot: ko({ id: koId, bodyHtml: text(objectId) }) },
            { author: HOCHLADENDER, snapshot: ko({ id: koId, bodyHtml: text(objectId) }) },
          );
          break;
        case 9:
        case 10:
          fall.belege.push({ objectId, createdBy: fundart === 9 ? HOCHLADENDER : FREMDER });
          break;
        case 11:
          fall.fassungen.push({
            author: HOCHLADENDER,
            snapshot: ko({ id: koId, attachments: att(FREMDER) as never }),
          });
          break;
        default:
          break;
      }
      out.push(fall);
    }
  }
  // LIKE-Entwertung: die Kennung `obj%son_der` darf NUR ihr eigenes Objekt finden — nicht das
  // Nachbarobjekt, dessen Text `objXsonYder` einem nicht entwerteten Muster entspräche.
  out.push({
    objectId: "obj%son_der",
    ko: ko({ id: "ko-sonder", bodyHtml: text("obj%son_der") }),
    fassungen: [],
    belege: [],
  });
  out.push({
    objectId: "obj-nachbar",
    ko: ko({ id: "ko-nachbar", bodyHtml: text("objXsonYder") }),
    fassungen: [],
    belege: [],
  });
  return out;
}

// Die vier Arme, nach Node übersetzt — dieselbe Übersetzung wie im schnellen Test.
function armAnhang(s: KnowledgeObject, objectId: string): boolean {
  return Array.isArray(s.attachments) && s.attachments.some((a) => a.objectId === objectId);
}
function armText(s: KnowledgeObject, objectId: string): boolean {
  return typeof s.bodyHtml === "string" && s.bodyHtml.includes(objectId);
}
function erwartet(alle: Fall[], objectId: string): string[] {
  return alle
    .filter(
      (f) =>
        armAnhang(f.ko, objectId) ||
        armText(f.ko, objectId) ||
        f.belege.some((b) => b.objectId === objectId) ||
        f.fassungen.some((v) => armAnhang(v.snapshot, objectId) || armText(v.snapshot, objectId)),
    )
    .map((f) => f.ko.id)
    .sort();
}

describe("JOB 2685 D1 · listAnhangTraeger gegen echtes Postgres: Mengengleichheit je Kennung", () => {
  let container: StartedTestContainer;
  let url: string;
  const alle = faelle();

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    const pool = createPool(url);
    try {
      await migrate(pool);
      await pool.query("DELETE FROM ko_evidence");
      await pool.query("DELETE FROM ko_versions");
      await pool.query("DELETE FROM kos");
      const kos = new PgKoRepo(pool);
      const versionen = new PgKoVersionRepo(pool);
      const belege = new PgEvidenceRepo(pool);
      for (const f of alle) {
        await kos.insert(f.ko);
        for (const [i, v] of f.fassungen.entries()) {
          await versionen.append({
            koId: f.ko.id,
            version: i + 1,
            snapshot: v.snapshot,
            at: `2026-07-0${i + 1}T10:00:00.000Z`,
            author: v.author,
            note: "",
          });
        }
        for (const [i, b] of f.belege.entries()) {
          await belege.append({
            id: `ev-${f.ko.id}-${i}`,
            koId: f.ko.id,
            koVersion: 1,
            kind: "attachment",
            objectId: b.objectId,
            createdBy: b.createdBy,
            createdAt: "2026-07-01T10:00:00.000Z",
          } as never);
        }
      }
    } finally {
      await pool.end();
    }
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("für JEDE Kennung liefert SQL genau die Objekte, die die Node-Übersetzung der vier Arme liefert", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      let treffer = 0;
      for (const f of alle) {
        const sql = (await repo.listAnhangTraeger(f.objectId)).map((k) => k.id).sort();
        const node = erwartet(alle, f.objectId);
        expect(sql, `Kennung ${f.objectId}`).toEqual(node);
        treffer += sql.length;
      }
      // Nicht leer: alle Fundarten außer F1 finden ihr Objekt (10 × 2 + 2 Sonderfälle).
      expect(treffer).toBe(22);
    } finally {
      await pool.end();
    }
  });

  it("D2 · die MEHRFACHSUCHE liefert für eine Kennungsmenge genau die Vereinigung der Einzelmengen — eine Obermenge für jede Kennung", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      const kennungen = alle.map((f) => f.objectId);
      const sql = (await repo.listAnhangTraegerFuer(kennungen)).map((k) => k.id).sort();
      const vereinigung = [...new Set(kennungen.flatMap((id) => erwartet(alle, id)))].sort();
      expect(sql).toEqual(vereinigung);
      // Und die Teilmenge eines einzelnen Bildes steckt darin (Obermenge je Kennung).
      for (const f of alle) {
        for (const id of erwartet(alle, f.objectId)) {
          expect(sql).toContain(id);
        }
      }
    } finally {
      await pool.end();
    }
  });

  it("D2 · der Index ist wirklich angelegt (drei Namen) und der Planer kennt ihn für den Anhangs-Arm", async () => {
    const pool = createPool(url);
    try {
      const res = await pool.query<{ indexname: string }>(
        "SELECT indexname FROM pg_indexes WHERE indexname = ANY($1::text[]) ORDER BY indexname",
        [["idx_kos_anhang_traeger", "idx_ko_versions_anhang_traeger", "idx_ko_evidence_object_id"]],
      );
      expect(res.rows.map((r) => r.indexname)).toEqual([
        "idx_ko_evidence_object_id",
        "idx_ko_versions_anhang_traeger",
        "idx_kos_anhang_traeger",
      ]);
      // EXPLAIN des Anhangs-Arms allein: mit dem GIN erscheint ein Bitmap-Index-Scan auf dem Index.
      // (Bei einem Bestand von wenigen Zeilen darf der Planer auch sequenziell lesen — deshalb wird
      // `enable_seqscan` für diese eine Sitzung ausgeschaltet, um die INDEXIERBARKEIT zu zeigen.)
      await pool.query("SET enable_seqscan = off");
      const plan = await pool.query<{ "QUERY PLAN": string }>(
        "EXPLAIN SELECT id FROM kos WHERE data->'attachments' @> ANY($1::jsonb[])",
        [['[{"objectId":"obj-3"}]']],
      );
      const text = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
      expect(text).toContain("idx_kos_anhang_traeger");
    } finally {
      await pool.end();
    }
  });

  it("D5 · der Schreibstand ist eine Zeile der Datenbank, in derselben Transaktion erhöht: ein Schreiben über Verbindung A ist über Verbindung B als neuer Stand sichtbar — genau +1 je Mutation, gemeinsam mit den Daten", async () => {
    const poolA = createPool(url);
    const poolB = createPool(url);
    try {
      const repoA = new PgKoRepo(poolA);
      const repoB = new PgKoRepo(poolB);
      const vorher = await repoB.anhangSchreibstand();
      // Prozess A schreibt (ein neuer Träger); Prozess B liest nur den Stand.
      const f = alle[0];
      if (!f) {
        throw new Error("kein Fall");
      }
      await repoA.insert({ ...f.ko, id: "ko-d4-sequenz" });
      const nachher = await repoB.anhangSchreibstand();
      expect(Number(nachher)).toBe(Number(vorher) + 1);
      // Und B sieht mit dem neuen Stand auch die neuen Daten (derselbe Commit).
      expect(await repoB.findById("ko-d4-sequenz")).toBeDefined();
      // Die Tabelle existiert im Schema (additiv, IF NOT EXISTS), keine Sequenz mehr.
      const tab = await poolB.query<{ relname: string; relkind: string }>(
        "SELECT relname, relkind FROM pg_class WHERE relname = 'ko_schreibstand'",
      );
      expect(tab.rows).toEqual([{ relname: "ko_schreibstand", relkind: "r" }]);
      await poolA.query("DELETE FROM kos WHERE id = 'ko-d4-sequenz'");
    } finally {
      await poolA.end();
      await poolB.end();
    }
  });

  it("Papierkorb-Objekte sind ENTHALTEN — der Aufrufer trimmt, wie KoService.list es tut", async () => {
    const pool = createPool(url);
    try {
      const repo = new PgKoRepo(pool);
      // F2, getrasht: obj-4 → ko-4 trägt deletedAt.
      const t = await repo.listAnhangTraeger("obj-4");
      expect(t.map((k) => k.id)).toEqual(["ko-4"]);
      expect(t[0]?.deletedAt).toBe("2026-08-01T00:00:00.000Z");
    } finally {
      await pool.end();
    }
  });

  it("eine Kennung ohne Träger liefert die leere Menge — kein Voll-Load als Rückfall", async () => {
    const pool = createPool(url);
    try {
      expect(await new PgKoRepo(pool).listAnhangTraeger("obj-gibt-es-nicht")).toEqual([]);
    } finally {
      await pool.end();
    }
  });
});
