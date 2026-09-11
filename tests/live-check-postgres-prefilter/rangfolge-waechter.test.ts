// ================================================================================================
// JOB 3583 · V2 — DER STRUKTURWÄCHTER DER KANDIDATEN-RANGFOLGE IN POSTGRES.
// ================================================================================================
//
// WAS ER BEWEIST — und der Satz gehört hierher und nicht in die Rückgabe allein:
//   Er beweist NICHT, dass Postgres die Kandidaten in der Reihenfolge liefert, die der
//   Speicherbestand liefert. Das beweist einzig der Lauf gegen eine echte Datenbank
//   (`services/knowledge-object/src/repo-pg-kandidaten.integration.test.ts`, V1).
//   Er verhindert den STILLEN RÜCKFALL: verschwindet die Term-Trefferzahl wieder aus der Abfrage,
//   rutscht sie hinter die Validiert-Stufe oder zählt sie einen Term doppelt, wird diese Datei rot —
//   im REGULÄREN Testlauf, also auch ohne Docker.
//
// GEMESSEN WIRD, WAS LÄUFT: `PgKoRepo.findCandidates` wird über den Produktpfad gerufen, mit einem
// Stellvertreter für den Pool, der die abgesetzte Anweisung samt Parameterliste festhält. Es wird
// keine Zeichenkette nachgebaut und keine Regel zweitgeschrieben; die Such-Ausdrücke kommen aus der
// einen Quelle des Produkts (`KO_CANDIDATE_SEARCH_EXPRESSIONS`).
//
// DIE KALIBRIERUNG am Ende der Datei misst die SCHÄRFE des Prüfwerkzeugs selbst: sie ersetzt in der
// ECHTEN Abfrage die Trefferstufe durch die drei Formen, die eine Zeichenkettensuche hereinlegen
// (Kommentar, Stringliteral, Alias auf eine Konstante) und verlangt, dass jede einzeln beanstandet
// wird — während ein ehrlich UMBENANNTER echter Summenausdruck grün bleiben muss (kein Falsch-Rot).
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  KO_CANDIDATE_SEARCH_EXPRESSIONS,
  PgKoRepo,
} from "../../services/knowledge-object/src/repo-pg";
import {
  type Rangfolgevertrag,
  ausschnitt,
  maskiere,
  pruefeRangfolge,
  sortierstufen,
} from "./abfrage-analyse";

interface Mitschrift {
  readonly sql: string;
  readonly params: readonly unknown[];
}

/** Der Stellvertreter des Pools: er hält fest, was wirklich abgesetzt wurde. */
function poolDoppel(): { pool: Pool; abfragen: Mitschrift[] } {
  const abfragen: Mitschrift[] = [];
  const doppel = {
    query: (sql: string, params: readonly unknown[] = []) => {
      abfragen.push({ sql, params });
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
  };
  return { pool: doppel as unknown as Pool, abfragen };
}

const TERME = ["ventil", "pumpe", "dichtung", "filter"];
const LIMIT = 3;

const VERTRAG: Rangfolgevertrag = {
  termParameter: TERME.map((_, i) => i + 1),
  limitParameter: TERME.length + 1,
  ausdruecke: KO_CANDIDATE_SEARCH_EXPRESSIONS,
};

/** Ein echter Lauf über den Produktpfad; zurück kommt die abgesetzte Anweisung. */
async function abfrage(
  terms: readonly string[] = TERME,
  limit: number = LIMIT,
): Promise<Mitschrift[]> {
  const { pool, abfragen } = poolDoppel();
  await new PgKoRepo(pool).findCandidates({ terms: [...terms], limit });
  return abfragen;
}

describe("JOB 3583 · V2 Strukturwächter: die Rangfolge steht IN der Abfrage", () => {
  it("die abgesetzte Abfrage führt die Term-Trefferzahl vor validiert und Trust", async () => {
    const abfragen = await abfrage();
    expect(abfragen).toHaveLength(1);
    const sql = abfragen[0]?.sql ?? "";
    const befund = pruefeRangfolge(sql, VERTRAG);
    expect(befund.beanstandungen).toEqual([]);
    // Vier Stufen wären eine Stufe zu viel: genau Trefferzahl, validiert, Trust.
    expect(befund.stufen).toHaveLength(3);
  });

  it("die Trefferstufe summiert über ALLE Termparameter — und nur über sie", async () => {
    const abfragen = await abfrage();
    const sql = abfragen[0]?.sql ?? "";
    const m = maskiere(sql);
    const erste = sortierstufen(m)[0];
    expect(erste).toBeDefined();
    const stufe = ausschnitt(m, erste ?? { von: 0, bis: 0 });
    for (const nummer of VERTRAG.termParameter) {
      expect(stufe).toContain(`$${nummer}`);
    }
    // Der LIMIT-Platzhalter hat in der Sortierung nichts zu suchen.
    expect(stufe).not.toContain(`$${VERTRAG.limitParameter}`);
  });

  it("die Terme bleiben Parameter: kein Term steht im Anweisungstext", async () => {
    const abfragen = await abfrage();
    const eintrag = abfragen[0];
    expect(eintrag).toBeDefined();
    expect(eintrag?.params).toEqual([...TERME.map((t) => `%${t}%`), LIMIT]);
    for (const term of TERME) {
      expect(eintrag?.sql ?? "").not.toContain(term);
    }
  });

  it("Zustandsmodell: ohne Term wird gar nicht gefragt, mit limit 0 bleibt der Deckel hart", async () => {
    expect(await abfrage([], 10)).toEqual([]);
    expect(await abfrage(["  ", ""], 10)).toEqual([]);
    const gedeckelt = await abfrage(TERME, 0);
    expect(gedeckelt).toHaveLength(1);
    const params = gedeckelt[0]?.params ?? [];
    expect(params[params.length - 1]).toBe(0);
    expect(pruefeRangfolge(gedeckelt[0]?.sql ?? "", VERTRAG).beanstandungen).toEqual([]);
  });

  it("ein einzelner Term braucht keine Addition — der Vertrag gilt trotzdem", async () => {
    const abfragen = await abfrage(["ventil"], 5);
    const befund = pruefeRangfolge(abfragen[0]?.sql ?? "", {
      termParameter: [1],
      limitParameter: 2,
      ausdruecke: KO_CANDIDATE_SEARCH_EXPRESSIONS,
    });
    expect(befund.beanstandungen).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// KALIBRIERUNG — die Schärfe des Prüfwerkzeugs, an der ECHTEN Abfrage gemessen.
// ------------------------------------------------------------------------------------------------
// Ersetzt wird jeweils NUR die erste Sortierstufe der Anweisung, die der Produktpfad eben abgesetzt
// hat. Damit misst die Kalibrierung das Werkzeug und nicht eine Nachbildung des Produkts.

/** Die erste Sortierstufe der echten Anweisung durch `neu` ersetzen. */
function mitAndererTrefferstufe(sql: string, neu: string): string {
  const m = maskiere(sql);
  const erste = sortierstufen(m)[0];
  if (erste === undefined) {
    throw new Error("Die echte Anweisung hat keine Sortierstufe — die Kalibrierung trägt nicht.");
  }
  return `${sql.slice(0, erste.von)} ${neu}${sql.slice(erste.bis)}`;
}

/** Die erste Sortierstufe ersatzlos streichen (die Fassung VOR diesem Auftrag). */
function ohneTrefferstufe(sql: string): string {
  const m = maskiere(sql);
  const stufen = sortierstufen(m);
  const erste = stufen[0];
  const zweite = stufen[1];
  if (erste === undefined || zweite === undefined) {
    throw new Error("Die echte Anweisung hat weniger als zwei Sortierstufen.");
  }
  return `${sql.slice(0, erste.von)} ${sql.slice(zweite.von)}`;
}

/**
 * Eine NACHGEBAUTE Summe — ausschliesslich als Eingabe für die Kalibrierung (fehlender Term,
 * doppelt gezählter Term). Der positive Beleg oben benutzt sie NICHT.
 */
function summeUeber(nummern: readonly number[]): string {
  return nummern
    .map(
      (k) =>
        `CASE WHEN (${KO_CANDIDATE_SEARCH_EXPRESSIONS.map((e) => `${e} ILIKE $${k}`).join(
          " OR ",
        )}) THEN 1 ELSE 0 END`,
    )
    .join(" + ");
}

describe("JOB 3583 · V2 Kalibrierung: was den Wächter NICHT befriedigen darf", () => {
  it("Kommentar, Stringliteral, Konstante und Alias-auf-Konstante werden je einzeln beanstandet", async () => {
    const sql = (await abfrage())[0]?.sql ?? "";
    const faelle: Array<[string, string]> = [
      ["ersatzlos gestrichen", ohneTrefferstufe(sql)],
      [
        "Kommentar",
        mitAndererTrefferstufe(sql, `/* ${summeUeber(VERTRAG.termParameter)} */ 0 DESC`),
      ],
      [
        "Stringliteral",
        // Sauber entwertet (`''`), damit das Literal wirklich eines ist: es SIEHT aus wie die
        // Summe, ist aber keine.
        mitAndererTrefferstufe(
          sql,
          `'${summeUeber(VERTRAG.termParameter).replace(/'/g, "''")}' DESC`,
        ),
      ],
      ["Konstante", mitAndererTrefferstufe(sql, "0 DESC")],
      [
        "Alias auf eine Konstante",
        mitAndererTrefferstufe(sql, "treffer DESC").replace(" FROM kos", ", 0 AS treffer FROM kos"),
      ],
      ["ein Term fehlt", mitAndererTrefferstufe(sql, `(${summeUeber([1, 2, 3])}) DESC`)],
      [
        "ein Term doppelt gezählt",
        mitAndererTrefferstufe(sql, `(${summeUeber([1, 2, 3, 4, 1])}) DESC`),
      ],
    ];
    for (const [name, verstellt] of faelle) {
      const befund = pruefeRangfolge(verstellt, VERTRAG);
      expect(befund.beanstandungen, `${name} wurde NICHT beanstandet`).not.toEqual([]);
    }
  });

  it("die Trefferstufe hinter der Validiert-Stufe ist ebenfalls rot", async () => {
    const sql = (await abfrage())[0]?.sql ?? "";
    const m = maskiere(sql);
    const stufen = sortierstufen(m);
    const erste = stufen[0];
    const zweite = stufen[1];
    expect(erste).toBeDefined();
    expect(zweite).toBeDefined();
    const getauscht = ohneTrefferstufe(sql).replace(
      "(status='validiert') DESC,",
      `(status='validiert') DESC, ${ausschnitt(m, erste ?? { von: 0, bis: 0 })},`,
    );
    const befund = pruefeRangfolge(getauscht, VERTRAG);
    expect(befund.beanstandungen).not.toEqual([]);
  });

  it("ein ehrlich UMBENANNTER echter Summenausdruck bleibt grün (kein Falsch-Rot)", async () => {
    const sql = (await abfrage())[0]?.sql ?? "";
    const m = maskiere(sql);
    const erste = sortierstufen(m)[0];
    const echt = ausschnitt(m, erste ?? { von: 0, bis: 0 }).replace(/\s+desc$/i, "");
    const umbenannt = mitAndererTrefferstufe(sql, "treffer DESC").replace(
      " FROM kos",
      `, ${echt} AS treffer FROM kos`,
    );
    expect(pruefeRangfolge(umbenannt, VERTRAG).beanstandungen).toEqual([]);
  });
});
