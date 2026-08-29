// ================================================================================================
// JOB 2685 D5 (Review R2-30, Entscheidung des Kopfes: Weg A) — EINE TRANSAKTION: Schreibstand und
// fachliches Schreiben werden gemeinsam sichtbar. Der Zwischenpunkt, den BEN anhalten wollte,
// existiert nicht mehr — und dieser Test zeigt, warum.
// ================================================================================================
//
// BEN an D4: „Kein gelaufener Test hält Prozess B zwischen Datenmutation und Standfortschaltung
// an." Und: „bei einem `nextval` innerhalb einer noch offenen fachlichen Transaktion [kann] A
// bereits den neuen Sequenzwert sehen, noch den alten Datenstand suchen und ihn unter diesem neuen
// Wert cachen." Und: „`last_value` ist anfangs bereits 1 und der erste `nextval` liefert ebenfalls 1."
//
// Hier läuft `PgKoRepo`/`PgKoVersionRepo`/`PgEvidenceRepo` SELBST gegen ein POOL-DOPPEL, das das
// Sichtbarkeitsmodell von Postgres unter READ COMMITTED nachbildet: jeder Client hat einen
// Arbeitsbereich; was er schreibt, sieht ein ANDERER Client erst nach seinem COMMIT — Daten und
// Standzeile gleichermaßen, als EINE Menge. Das Doppel erfindet keine Semantik, es hält nur die
// eine Regel ein, auf der Weg A beruht: „ein Commit macht alles auf einmal sichtbar". Ob Postgres
// diese Regel einhält, ist Postgres-Dokumentation, nicht dieser Test — der echte Lauf steht in
// tests/ko/job2685-anhang-traeger.integration.test.ts (zwei Pools) und ist hier NICHT gelaufen.
//
//   A · INITIALSEMANTIK: der Stand ist „0" vor der ersten Mutation und „1" danach — BENs Sequenzfall.
//   B · DIE INVARIANTE, an jedem Punkt geprüft: während einer Schreibtransaktion sieht ein zweiter
//       Client zu KEINEM Zeitpunkt „Daten neu, Stand alt" oder „Stand neu, Daten alt". Der Prüfstand
//       liest nach JEDEM Statement des Schreibers mit einer zweiten Verbindung Daten und Stand.
//   C · BENs ZWISCHENPUNKT: „B nach Daten-Commit, vor Standveröffentlichung anhalten" — gibt es
//       nicht: es gibt genau einen Commit, und der trägt beides. Der Versuch, den Punkt zu
//       konstruieren, findet keinen Zustand, in dem die Daten committet sind und der Stand nicht.
//   D · ROLLBACK: ein Schreiben ohne Treffer (STALE_WRITE, NOT_FOUND) lässt den Stand unverändert —
//       nicht „erhöht und dann zurück", sondern nie erhöht.
//   E · ÜBERGEBENE TRANSAKTION (Papierkorb-Endlöschung): `delete(id, tx)` erhöht auf dem Client des
//       Aufrufers; sichtbar wird beides erst mit DESSEN Commit — kein zweiter Weg über den Pool.
import { describe, expect, it } from "vitest";
import { withPgTx } from "../../services/db-tx";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  KO_SCHREIBSTAND_ERHOEHEN_SQL,
  KO_SCHREIBSTAND_LESEN_SQL,
  PgEvidenceRepo,
  PgKoRepo,
  PgKoVersionRepo,
} from "../../services/knowledge-object/src/repo-pg";

type Pool = ConstructorParameters<typeof PgKoRepo>[0];

interface Bestand {
  kos: Map<string, string>; // id → JSON
  versionen: Set<string>; // `${koId}:${version}`
  belege: Set<string>; // id
  stand: number;
}

function kopie(b: Bestand): Bestand {
  return {
    kos: new Map(b.kos),
    versionen: new Set(b.versionen),
    belege: new Set(b.belege),
    stand: b.stand,
  };
}

/**
 * Das Doppel: EIN committeter Bestand; jeder Client arbeitet auf einer Kopie und schreibt sie beim
 * COMMIT als Ganzes zurück. `sicht()` ist, was eine ANDERE Verbindung jetzt lesen würde.
 * `nachJedemStatement` wird nach jedem Statement eines Transaktionsclients gerufen — der Haltepunkt,
 * den BEN verlangt hat, an jeder Stelle, die es gibt.
 */
function datenbankDoppel(opts: { nachJedemStatement?: (sql: string) => void } = {}) {
  let committed: Bestand = { kos: new Map(), versionen: new Set(), belege: new Set(), stand: 0 };
  const sicht = () => kopie(committed);
  const protokoll: string[] = [];

  const fuehreAus = (b: Bestand, sql: string, werte: unknown[]) => {
    protokoll.push(sql);
    if (sql === KO_SCHREIBSTAND_LESEN_SQL) {
      return { rows: [{ stand: String(b.stand) }], rowCount: 1 };
    }
    if (sql === KO_SCHREIBSTAND_ERHOEHEN_SQL) {
      b.stand += 1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO kos")) {
      b.kos.set(werte[0] as string, werte[4] as string);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("UPDATE kos SET")) {
      const vorhanden = b.kos.has(werte[0] as string);
      if (vorhanden) {
        b.kos.set(werte[0] as string, werte[4] as string);
      }
      return { rows: [], rowCount: vorhanden ? 1 : 0 };
    }
    if (sql.startsWith("DELETE FROM kos")) {
      const vorhanden = b.kos.delete(werte[0] as string);
      return { rows: [], rowCount: vorhanden ? 1 : 0 };
    }
    if (sql.startsWith("SELECT data FROM kos WHERE id")) {
      const roh = b.kos.get(werte[0] as string);
      return { rows: roh ? [{ data: JSON.parse(roh) }] : [], rowCount: roh ? 1 : 0 };
    }
    if (sql.includes("INSERT INTO ko_versions")) {
      b.versionen.add(`${werte[0]}:${werte[1]}`);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM ko_versions")) {
      b.versionen.delete(`${werte[0]}:${werte[1]}`);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO ko_evidence")) {
      b.belege.add(werte[0] as string);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`unerwartete Abfrage: ${sql}`);
  };

  const pool = {
    // Pool-Query ohne Transaktion: liest/schreibt den committeten Bestand direkt (Autocommit).
    query: async (sql: string, werte: unknown[] = []) => fuehreAus(committed, sql, werte),
    connect: async () => {
      let arbeit: Bestand | null = null;
      return {
        query: async (sql: string, werte: unknown[] = []) => {
          let ergebnis: { rows: unknown[]; rowCount: number | null };
          if (sql === "BEGIN") {
            arbeit = kopie(committed);
            protokoll.push(sql);
            ergebnis = { rows: [], rowCount: null };
          } else if (sql === "COMMIT") {
            if (arbeit) {
              committed = arbeit;
            }
            arbeit = null;
            protokoll.push(sql);
            ergebnis = { rows: [], rowCount: null };
          } else if (sql === "ROLLBACK") {
            arbeit = null;
            protokoll.push(sql);
            ergebnis = { rows: [], rowCount: null };
          } else {
            if (!arbeit) {
              throw new Error("Statement ausserhalb einer Transaktion auf dem Client");
            }
            ergebnis = fuehreAus(arbeit, sql, werte);
          }
          opts.nachJedemStatement?.(sql);
          return ergebnis;
        },
        release: () => undefined,
      };
    },
  };
  return { pool: pool as unknown as Pool, sicht, protokoll };
}

const KO = {
  id: "ko-x",
  title: "t",
  statement: "s",
  type: "best_practice",
  category: "c",
  author: "u-anna",
  version: 1,
  attachments: [{ objectId: "obj-1", author: "u-anna" }],
} as unknown as KnowledgeObject;

describe("JOB 2685 D5 · A · Initialsemantik: 0 vor der ersten Mutation, 1 danach", () => {
  it("BENs Sequenzfall gibt es nicht mehr: die erste Mutation nach der Schemaeinführung ändert den Stand", async () => {
    const db = datenbankDoppel();
    const kos = new PgKoRepo(db.pool);
    expect(await kos.anhangSchreibstand()).toBe("0");
    await kos.insert(KO);
    expect(await kos.anhangSchreibstand()).toBe("1");
    await kos.update({ ...KO, rowVersion: 0 } as KnowledgeObject);
    expect(await kos.anhangSchreibstand()).toBe("2");
  });
});

describe("JOB 2685 D5 · B · die Invariante an jedem Punkt: nie (Daten neu, Stand alt), nie (Stand neu, Daten alt)", () => {
  it("während jeder der sechs Schreibtransaktionen sieht eine zweite Verbindung nach JEDEM Statement entweder beides alt oder beides neu", async () => {
    const beobachtungen: { sql: string; datenNeu: boolean; standNeu: boolean }[] = [];
    let vorher: Bestand | null = null;
    let db: ReturnType<typeof datenbankDoppel> | null = null;
    let erwarteteAenderung: (b: Bestand) => boolean = () => false;
    db = datenbankDoppel({
      nachJedemStatement: (sql) => {
        if (!db || !vorher) {
          return;
        }
        const jetzt = db.sicht(); // was eine ANDERE Verbindung jetzt liest
        beobachtungen.push({
          sql,
          datenNeu: erwarteteAenderung(jetzt),
          standNeu: jetzt.stand !== vorher.stand,
        });
      },
    });
    const kos = new PgKoRepo(db.pool);
    const versionen = new PgKoVersionRepo(db.pool);
    const belege = new PgEvidenceRepo(db.pool);

    const schritte: {
      name: string;
      lauf: () => Promise<void>;
      geaendert: (b: Bestand) => boolean;
    }[] = [
      { name: "insert", lauf: () => kos.insert(KO), geaendert: (b) => b.kos.has("ko-x") },
      {
        name: "update",
        lauf: () => kos.update({ ...KO, title: "neu", rowVersion: 0 } as KnowledgeObject),
        geaendert: (b) => (b.kos.get("ko-x") ?? "").includes('"title":"neu"'),
      },
      {
        name: "version",
        lauf: () =>
          versionen.append({
            koId: "ko-x",
            version: 1,
            snapshot: KO,
            at: "x",
            author: "u",
            note: "",
          }),
        geaendert: (b) => b.versionen.has("ko-x:1"),
      },
      {
        name: "version-remove",
        lauf: () => versionen.remove("ko-x", 1),
        geaendert: (b) => !b.versionen.has("ko-x:1"),
      },
      {
        name: "evidence",
        lauf: () =>
          belege.append({
            id: "e-1",
            koId: "ko-x",
            koVersion: 1,
            kind: "attachment",
            objectId: "obj-1",
            createdBy: "u",
            createdAt: "2026-08-29T00:00:00.000Z",
          } as never),
        geaendert: (b) => b.belege.has("e-1"),
      },
      { name: "delete", lauf: () => kos.delete("ko-x"), geaendert: (b) => !b.kos.has("ko-x") },
    ];
    for (const s of schritte) {
      vorher = db.sicht();
      erwarteteAenderung = s.geaendert;
      beobachtungen.length = 0;
      await s.lauf();
      // Der Prüfstand hat nach BEGIN, Schreiben, Stand und COMMIT gelesen — vier Punkte.
      expect(beobachtungen.map((b) => b.sql)[0]).toBe("BEGIN");
      expect(beobachtungen[beobachtungen.length - 1]?.sql).toBe("COMMIT");
      for (const b of beobachtungen) {
        // DIE INVARIANTE: an keinem Punkt sind Daten und Stand verschieden alt/neu.
        expect(
          b.datenNeu === b.standNeu,
          `${s.name} nach „${b.sql}": datenNeu=${b.datenNeu} standNeu=${b.standNeu}`,
        ).toBe(true);
      }
      // Vor dem COMMIT: beides alt. Nach dem COMMIT: beides neu.
      const vorCommit = beobachtungen.slice(0, -1);
      expect(vorCommit.every((b) => !b.datenNeu && !b.standNeu)).toBe(true);
      const nachCommit = beobachtungen[beobachtungen.length - 1];
      expect(nachCommit?.datenNeu && nachCommit?.standNeu).toBe(true);
    }
  });
});

describe("JOB 2685 D5 · C · BENs Zwischenpunkt lässt sich nicht konstruieren", () => {
  it("B nach Daten-Commit und vor Standveröffentlichung anhalten — es gibt genau EINEN Commit, und er trägt beides: kein Zustand hat committete neue Daten und alten Stand", async () => {
    const db = datenbankDoppel();
    const kos = new PgKoRepo(db.pool);
    // Der Versuch: nach jedem Statement die committete Sicht festhalten und nach dem Zustand
    // „Daten committet, Stand alt" suchen.
    const zustaende: { datenDa: boolean; stand: number }[] = [];
    const db2 = datenbankDoppel({
      nachJedemStatement: () => {
        const s = db2.sicht();
        zustaende.push({ datenDa: s.kos.has("ko-x"), stand: s.stand });
      },
    });
    await new PgKoRepo(db2.pool).insert(KO);
    expect(zustaende.some((z) => z.datenDa && z.stand === 0)).toBe(false); // der gesuchte Zwischenpunkt
    expect(zustaende.some((z) => !z.datenDa && z.stand === 1)).toBe(false); // der umgekehrte (D4-Sequenz)
    expect(zustaende[zustaende.length - 1]).toEqual({ datenDa: true, stand: 1 });
    // Und die Kandidaten-Logik dazu: wer unter Stand 0 gesucht hat, hat den alten Bestand gesehen;
    // wer Stand 1 liest, sieht auch die Daten von Stand 1. Ein Eintrag „Stand 0 + alter Bestand"
    // wird beim nächsten Abruf verworfen (Stand ist 1) — ein Eintrag „Stand 1 + alter Bestand" kann
    // nicht entstehen, weil Stand 1 ohne die neuen Daten nie lesbar war.
    expect(await kos.anhangSchreibstand()).toBe("0"); // das erste Doppel blieb unberührt
  });
});

describe("JOB 2685 D5 · D · Rollback: ein Schreiben ohne Treffer erhöht den Stand nie", () => {
  it("STALE_WRITE und NOT_FOUND rollen die Transaktion zurück — der Stand bleibt, kein Zwischenwert war je sichtbar", async () => {
    const gesehen: number[] = [];
    const db = datenbankDoppel({ nachJedemStatement: () => gesehen.push(db.sicht().stand) });
    const kos = new PgKoRepo(db.pool);
    await expect(kos.update({ ...KO, rowVersion: 0 } as KnowledgeObject)).rejects.toMatchObject({
      code: "STALE_WRITE",
    });
    await expect(kos.delete("ko-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await kos.anhangSchreibstand()).toBe("0");
    expect(gesehen.every((s) => s === 0)).toBe(true);
    expect(db.protokoll.filter((q) => q === "ROLLBACK")).toHaveLength(2);
    expect(db.protokoll.filter((q) => q === KO_SCHREIBSTAND_ERHOEHEN_SQL)).toHaveLength(0);
  });
});

describe("JOB 2685 D5 · E · übergebene Transaktion: der Stand steigt auf dem Client des Aufrufers", () => {
  it("delete(id, tx) erhöht in der Transaktion des Aufrufers; sichtbar wird beides erst mit dessen COMMIT — nichts läuft nebenher über den Pool", async () => {
    const db = datenbankDoppel();
    const kos = new PgKoRepo(db.pool);
    await kos.insert(KO);
    expect(db.sicht().stand).toBe(1);
    let waehrend: { datenDa: boolean; stand: number } | null = null;
    await withPgTx(db.pool as never, async (tx) => {
      await kos.delete("ko-x", tx);
      // Noch in der Transaktion des Aufrufers: eine andere Verbindung sieht beides ALT.
      const s = db.sicht();
      waehrend = { datenDa: s.kos.has("ko-x"), stand: s.stand };
    });
    expect(waehrend).toEqual({ datenDa: true, stand: 1 });
    const danach = db.sicht();
    expect(danach.kos.has("ko-x")).toBe(false);
    expect(danach.stand).toBe(2);
    // Genau eine Transaktion für das Löschen (die des Aufrufers), keine eigene daneben.
    expect(db.protokoll.filter((q) => q === "BEGIN")).toHaveLength(2); // insert + Aufrufer
  });
});
