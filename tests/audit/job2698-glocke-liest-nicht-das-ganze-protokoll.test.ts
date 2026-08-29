// ================================================================================================
// JOB 2698 · D1 — DIE GLOCKE LIEST JEDES MAL DAS GANZE PROTOKOLL (Review-Befund R2-32)
// ================================================================================================
//
// PEDIS FRAGE: „Warum wird die Startseite langsamer, je länger Klara läuft?"
//
// DER BEFUND, gemessen an 71d3c2b: `AuditService.list(filter)` lud IMMER das ganze Protokoll
// (`repo.all()` = `SELECT * FROM audit ORDER BY seq`) und filterte danach in Node. Aufrufer: die
// Glocke, die Wirkungsansicht, die Live-Wall, das Admin-Protokoll — und je Wissensobjekt eine
// Abfrage (`ko.created`-Nachzug). Das Protokoll ist die einzige Tabelle, die nie kleiner wird.
//
// WAS DIESER TEST BELEGT — die harte Hälfte zuerst (der Auftrag: „Belege die Gleichheit, statt sie
// anzunehmen"): Was bis 2698 in Node gefiltert wurde, ergibt in der Ablage DIESELBE Menge in
// DERSELBEN Reihenfolge — Speicherablage (A), SQL-Fassung gegen ein Doppel mit den Regeln von
// PostgreSQL für `=` auf `text`, `IS NULL` und `ORDER BY` (B), Rückfall im Dienst für Doubles ohne
// `findBy` (D). Dazu die Pins am SQL, am Index und an der Migrationsklasse (C) und das EXISTS (E).
// Was das Doppel NICHT belegt: dass PostgreSQL den Index auch wählt — das steht im Integrationstest
// (`tests/audit/job2698-findby.integration.test.ts`, läuft nur mit erreichbarem PostgreSQL).
import { describe, expect, it } from "vitest";
import { klassifiziereStufe } from "../../services/app/src/migrationsbeleg";
import {
  type AuditRepo,
  InMemoryAuditRepo,
  auditFilterTrifft,
} from "../../services/audit/src/repo";
import {
  AUDIT_ACTION_TARGET_INDEX_DDL,
  AUDIT_EXISTS_BY_SQL,
  AUDIT_FIND_BY_SQL,
  AUDIT_SCHEMA,
  PgAuditRepo,
  auditFilterParams,
} from "../../services/audit/src/repo-pg";
import { AuditService } from "../../services/audit/src/service";
import type { AuditEntry, AuditFilter } from "../../services/audit/src/types";

// ------------------------------------------------------------------------------------------------
// Ein Bestand, der die Fallen trägt: gleiche Wörter in anderer Schreibung, leere Filterwerte,
// derselbe Actor mit verschiedenen Aktionen, dasselbe Ziel unter verschiedenen Aktionen.
// ------------------------------------------------------------------------------------------------
const AKTIONEN = ["answer.helpful", "ask.query", "ko.created", "Answer.Helpful", "ko.rated"];
const AKTEURE = ["u1", "u2", "U1", "admin"];
const ZIELE = ["ko-1", "ko-2", "KO-1", "settings", ""];

function bestand(n: number): AuditEntry[] {
  const out: AuditEntry[] = [];
  for (let i = 1; i <= n; i++) {
    out.push({
      seq: i,
      at: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      actor: AKTEURE[i % AKTEURE.length] as string,
      action: AKTIONEN[(i * 7) % AKTIONEN.length] as string,
      target: ZIELE[(i * 3) % ZIELE.length] as string,
      payload: { i },
      prevHash: `h${i - 1}`,
      hash: `h${i}`,
      hashVersion: 2,
    });
  }
  return out;
}

const FILTER: AuditFilter[] = [
  {},
  { action: "answer.helpful" },
  { action: "Answer.Helpful" },
  { action: "ask.query" },
  { action: "ko.created", target: "ko-1" },
  { action: "ko.created", target: "KO-1" },
  { action: "ko.created", target: "gibt-es-nicht" },
  { actor: "u1" },
  { actor: "U1", action: "ko.rated" },
  { actor: "", action: "", target: "" },
  { action: "", target: "settings" },
  { target: "" },
  { actor: "admin", action: "ask.query", target: "ko-2" },
];

/** Die Referenz: der alte Weg — alles laden, in Node filtern (Regel wörtlich aus 71d3c2b). */
function alterWeg(alle: AuditEntry[], f: AuditFilter): AuditEntry[] {
  return alle.filter(
    (e) =>
      (!f.actor || e.actor === f.actor) &&
      (!f.action || e.action === f.action) &&
      (!f.target || e.target === f.target),
  );
}

// ------------------------------------------------------------------------------------------------
// Das PostgreSQL-Doppel: ein Pool, der GENAU die Anweisungen dieses Repos versteht und dabei die
// Regeln nachbildet, an denen die Gleichheit hängt — `$n::text IS NULL` (Parameter null → wahr),
// `=` auf `text` (byteweise, Groß-/Kleinschreibung zählt), `ORDER BY seq` aufsteigend, EXISTS als
// boolescher Wert. Es zählt außerdem, wie viele Zeilen es je Abfrage AUSLIEFERT — die Messgröße.
// ------------------------------------------------------------------------------------------------
function poolDoppel(zeilen: AuditEntry[]) {
  const geliefert: { sql: string; zeilen: number }[] = [];
  const rows = zeilen.map((e) => ({
    seq: e.seq,
    at: e.at,
    actor: e.actor,
    action: e.action,
    target: e.target,
    payload: e.payload,
    prev_hash: e.prevHash,
    hash: e.hash,
    event_id: e.eventId ?? null,
    hash_version: e.hashVersion ?? 1,
  }));
  const trifft = (r: (typeof rows)[number], p: unknown[]): boolean => {
    const [actor, action, target] = p as [string | null, string | null, string | null];
    return (
      (actor === null || r.actor === actor) &&
      (action === null || r.action === action) &&
      (target === null || r.target === target)
    );
  };
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql === AUDIT_FIND_BY_SQL) {
        const res = rows.filter((r) => trifft(r, params)).sort((a, b) => a.seq - b.seq);
        geliefert.push({ sql: "findBy", zeilen: res.length });
        return { rows: res, rowCount: res.length };
      }
      if (sql === AUDIT_EXISTS_BY_SQL) {
        geliefert.push({ sql: "existsBy", zeilen: 1 });
        return { rows: [{ vorhanden: rows.some((r) => trifft(r, params)) }], rowCount: 1 };
      }
      if (sql === "SELECT * FROM audit ORDER BY seq") {
        const res = [...rows].sort((a, b) => a.seq - b.seq);
        geliefert.push({ sql: "all", zeilen: res.length });
        return { rows: res, rowCount: res.length };
      }
      throw new Error(`Doppel kennt diese Anweisung nicht: ${sql.slice(0, 60)}`);
    },
  };
  return { pool, geliefert };
}

describe("JOB 2698 A — Speicherablage: findBy liefert exakt die Menge des alten Weges", () => {
  it("A1 — für jeden Filter dieselben Einträge in derselben Reihenfolge (aufsteigend nach seq)", async () => {
    const repo = new InMemoryAuditRepo();
    const alle = bestand(97);
    for (const e of alle) {
      await repo.append(e);
    }
    for (const f of FILTER) {
      const neu = await repo.findBy(f);
      const alt = alterWeg(await repo.all(), f);
      expect(neu, JSON.stringify(f)).toEqual(alt);
      expect(
        neu.map((e) => e.seq),
        "Reihenfolge",
      ).toEqual([...neu.map((e) => e.seq)].sort((a, b) => a - b));
      expect(await repo.existsBy(f), `existsBy ${JSON.stringify(f)}`).toBe(alt.length > 0);
    }
    // Die Kalibrierung des Bestands: die Fallen sind wirklich drin — mindestens ein Filter trennt
    // Groß- von Kleinschreibung, mindestens einer liefert leer, mindestens einer alles.
    const groessen = FILTER.map((f) => alterWeg(alle, f).length);
    expect(groessen).toContain(0);
    expect(groessen).toContain(alle.length);
    const klein = alterWeg(alle, { action: "answer.helpful" }).map((e) => e.seq);
    const gross = alterWeg(alle, { action: "Answer.Helpful" }).map((e) => e.seq);
    expect(klein.length).toBeGreaterThan(0);
    expect(gross.length).toBeGreaterThan(0);
    expect(klein, "Groß-/Kleinschreibung trennt die Mengen").not.toEqual(gross);
  });

  it("A2 — die eine Regel: auditFilterTrifft ist wortgleich mit dem alten Node-Filter", () => {
    const alle = bestand(50);
    for (const f of FILTER) {
      expect(alle.filter((e) => auditFilterTrifft(e, f))).toEqual(alterWeg(alle, f));
    }
  });
});

describe("JOB 2698 B — PostgreSQL-Fassung: WHERE statt Vollscan, gleiche Menge, gezählte Zeilen", () => {
  it("B1 — findBy über die SQL-Fassung ergibt für jeden Filter dieselbe Menge wie all() plus Node-Filter — und liefert nur die Treffer aus", async () => {
    const alle = bestand(500);
    const { pool, geliefert } = poolDoppel(alle);
    const repo = new PgAuditRepo(pool as never);
    const referenz = await repo.all();
    expect(referenz).toHaveLength(500);
    for (const f of FILTER) {
      const neu = await repo.findBy(f);
      const alt = alterWeg(referenz, f);
      expect(neu, JSON.stringify(f)).toEqual(alt);
    }
    // Die Messgröße: der alte Weg lieferte je Aufruf 500 Zeilen aus; der neue nur die Treffer.
    const findBys = geliefert.filter((g) => g.sql === "findBy");
    expect(findBys).toHaveLength(FILTER.length);
    const helpful = alterWeg(alle, { action: "answer.helpful" }).length;
    expect(findBys[1]?.zeilen).toBe(helpful);
    expect(helpful).toBeLessThan(500);
    expect(geliefert.find((g) => g.sql === "all")?.zeilen).toBe(500);
  });

  it("B2 — existsBy liefert einen booleschen Wert und lädt keine Zeile", async () => {
    const alle = bestand(120);
    const { pool, geliefert } = poolDoppel(alle);
    const repo = new PgAuditRepo(pool as never);
    expect(await repo.existsBy({ action: "ko.created", target: "ko-1" })).toBe(
      alterWeg(alle, { action: "ko.created", target: "ko-1" }).length > 0,
    );
    expect(await repo.existsBy({ action: "ko.created", target: "gibt-es-nicht" })).toBe(false);
    expect(geliefert.every((g) => g.sql === "existsBy" && g.zeilen === 1)).toBe(true);
  });
});

describe("JOB 2698 C — die Pins: SQL, Parameterübersetzung, Index, Migrationsklasse", () => {
  it("C1 — die Abfrage filtert in SQL mit NULL-als-kein-Filter und sortiert wie all()", () => {
    for (const spalte of ["actor", "action", "target"]) {
      expect(AUDIT_FIND_BY_SQL).toContain(`${spalte} = $`);
      expect(AUDIT_EXISTS_BY_SQL).toContain(`${spalte} = $`);
    }
    expect(AUDIT_FIND_BY_SQL).toContain("::text IS NULL OR");
    expect(AUDIT_FIND_BY_SQL.trim().endsWith("ORDER BY seq")).toBe(true);
    expect(AUDIT_EXISTS_BY_SQL).toContain("SELECT EXISTS(");
    // Kein Vollscan-Merkmal: keine Abfrage ohne WHERE.
    expect(AUDIT_FIND_BY_SQL).toContain("WHERE");
  });

  it("C2 — leere Filterwerte werden zu NULL (kein Filter), wie `!filter.x` in Node", () => {
    expect(auditFilterParams({})).toEqual([null, null, null]);
    expect(auditFilterParams({ actor: "", action: "", target: "" })).toEqual([null, null, null]);
    expect(auditFilterParams({ action: "answer.helpful" })).toEqual([null, "answer.helpful", null]);
    expect(auditFilterParams({ actor: "u1", target: "ko-1" })).toEqual(["u1", null, "ko-1"]);
  });

  it("C3 — der Index (action, target) steht additiv in AUDIT_SCHEMA; die Stufe bleibt ADDITIV", () => {
    expect(AUDIT_ACTION_TARGET_INDEX_DDL).toContain(
      "CREATE INDEX IF NOT EXISTS audit_action_target_idx",
    );
    expect(AUDIT_ACTION_TARGET_INDEX_DDL).toContain("ON audit (action, target)");
    expect(AUDIT_SCHEMA).toContain(AUDIT_ACTION_TARGET_INDEX_DDL);
    expect(klassifiziereStufe(AUDIT_SCHEMA)).toBe("ADDITIV");
    expect(AUDIT_SCHEMA).not.toMatch(/DROP|TRUNCATE|DELETE|UPDATE/);
  });
});

describe("JOB 2698 D — der Dienst: list nimmt findBy, wenn die Ablage es kann, und fällt sonst auf den alten Weg zurück", () => {
  /** Ein handgeschriebenes Double OHNE findBy/existsBy — wie sie in tests/** vorkommen. */
  function doubleOhneFindBy(alle: AuditEntry[]): AuditRepo & { allAufrufe: number } {
    const d = {
      allAufrufe: 0,
      append: async () => undefined,
      appendOnce: async () => true,
      all: async () => {
        d.allAufrufe += 1;
        return [...alle];
      },
      last: async () => alle[alle.length - 1],
    };
    return d;
  }

  it("D1 — mit findBy: list liest gefiltert, all() wird nicht aufgerufen; ohne findBy: dieselbe Menge über all()", async () => {
    const alle = bestand(80);
    const mit = new InMemoryAuditRepo();
    for (const e of alle) {
      await mit.append(e);
    }
    let allAufrufe = 0;
    const mitGezaehlt: AuditRepo = {
      ...mit,
      append: (e, tx) => mit.append(e, tx),
      appendOnce: (e, tx) => mit.appendOnce(e, tx),
      last: (tx) => mit.last(tx),
      findBy: (f) => mit.findBy(f),
      existsBy: (f) => mit.existsBy(f),
      all: () => {
        allAufrufe += 1;
        return mit.all();
      },
    };
    const dienstMit = new AuditService({ repo: mitGezaehlt });
    const ohne = doubleOhneFindBy(alle);
    const dienstOhne = new AuditService({ repo: ohne });
    for (const f of FILTER) {
      const a = await dienstMit.list(f);
      const b = await dienstOhne.list(f);
      expect(a, JSON.stringify(f)).toEqual(b);
      expect(a).toEqual(alterWeg(alle, f));
      expect(await dienstMit.exists(f)).toBe(a.length > 0);
      expect(await dienstOhne.exists(f)).toBe(a.length > 0);
    }
    expect(allAufrufe, "mit findBy lädt list() nie das ganze Protokoll").toBe(0);
    expect(ohne.allAufrufe).toBeGreaterThan(0);
  });
});
