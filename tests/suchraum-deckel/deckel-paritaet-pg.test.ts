// ================================================================================================
// JOB 3048 — DER POSTGRES-ADAPTER WÄHLT NACH DERSELBEN REGEL (Fake-Pool, SQL-Pin).
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. Der Live-Weg ist PostgreSQL. Änderte nur der Speicher-Adapter sein
// Verhalten, verhielte sich jeder Unit-Test anders als die Datenbank — und der Fehler bliebe genau
// dort, wo Pedi ihn erlebt (Auftrag §8.4). Gemessen wird deshalb die ERZEUGTE Anweisung.
//
// WIE — und ehrlich, wo die Grenze liegt (Muster: `repo-pg-search.test.ts`, `g27-welle1-pg-
// paritaet.test.ts`): ein Fake-Pool zeichnet SQL und Parameter auf. Ein AUSFÜHRENDER Postgres
// (Planner, Indexnutzung, echte Sortierung) läuft hier NICHT — dafür bräuchte es Docker, und das
// ist in der Bahn-Sandkiste nicht messbar. Was diese Datei leistet, ist deshalb:
//
//   1  Die Anweisung ist Zeichen für Zeichen die bisherige, solange niemand die Güteauswahl
//      anfordert — ohne Deckel (P1) UND mit Deckel (P1b). Der Bibliotheksweg (`limit: 200`, keine
//      Anforderung) ist damit durch die Bauform unberührt und nicht durch eine Behauptung.
//   2  Die Anweisung MIT angeforderter Güte trennt AUSWAHL (Güte) und AUSGABE (validiert/Trust) in
//      zwei Ebenen, und das LIMIT sitzt an der Auswahl (P2–P4).
//   3  Es gibt KEINEN zweiten Güte-Ausdruck: die `WHEN`-Bedingungen des `CASE` sind wörtlich
//      dieselben Ausdrücke, aus denen der Adapter `matched` füllt (P5).
//   4  DIE PARITÄT: die Güteleiter wird AUS DER ERZEUGTEN SQL GELESEN und gegen dieselbe
//      Trefferlage gehalten, die der Speicher-Adapter wirklich verarbeitet — gleiche Eingabe,
//      gleiches `limit`, gleiche Überlebendenmenge (P6/P7).
import type { Pool } from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KoSearchHit,
  type KoSearchQuery,
  KoService,
} from "../../services/knowledge-object";
import {
  SUCH_TREFFERGUETE,
  suchTrefferguete,
} from "../../services/knowledge-object/src/search-projection";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";

const TERM = "ruettelfrequenz"; // ohne deklarierte Entsprechung — die Abfrage trägt genau EINEN Parameter
const GENERATION = 5;

// Die Steuerzeile im Normalbetrieb (V2 freigegeben) — ohne sie käme `findActive` fail-closed gar
// nicht bis zur Suchabfrage (Muster: tests/ko/g27-welle1-pg-paritaet.test.ts).
const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: GENERATION,
  active_generation: GENERATION,
  integrity_marker: `V2-READY:${GENERATION}`,
  activated_at: "2026-08-01T00:00:00.000Z",
};

function fakePool(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      return { rows: [STEUERZEILE_V2_ACTIVE], rowCount: 1 };
    }
    return { rows, rowCount: rows.length };
  };
  return { pool: { query } as unknown as Pool, calls };
}

/** Die Güteauswahl wird ANGEFORDERT, nie angenommen — dieselbe Angabe wie im Kandidatenweg. */
const GUETE = { deckelauswahl: "trefferguete" } as const;

/** Die Suchabfrage selbst — ohne den vorangestellten Blick auf die Steuerzeile. */
async function suchanweisung(query: KoSearchQuery, rows = []) {
  const { pool, calls } = fakePool(rows);
  const treffer = await new PgKoSearchProjectionRepo(pool).findActive(query);
  const anweisung = calls.find((c) => !c.sql.includes("ko_projection_control"));
  expect(anweisung, "keine Suchabfrage abgesetzt").toBeDefined();
  return { ...(anweisung as { sql: string; params: unknown[] }), treffer };
}

// ------------------------------------------------------------------------------------------------
// P1 — DER VORGABEFALL: DIE ANWEISUNG DES BASISSTANDS, MIT UND OHNE DECKEL
// ------------------------------------------------------------------------------------------------
//
// Der Erwartungstext ist aus der VORFASSUNG der Anweisung abgeschrieben — der Vorlage in
// search-projection-repo-pg.ts:633-641 auf dem Basisstand `ce536e9`, Zeile für Zeile samt
// Einrückung, mit den von `ilike`/`maskiereLikeMuster` erzeugten Bedingungen für den EINEN Begriff
// eingesetzt (beide Hilfsfunktionen rührt dieser Job nicht an).
//
// P1b IST DIE BERICHTIGUNG AUS RUNDE 1. Dort galt dieser Text nur ohne `limit`, und die Rückgabe
// nannte das „die Bibliothek" — falsch: `LibraryService.search` fragt mit `limit: 200`
// (library-analytics/src/service.ts:1334). Jetzt gilt er für JEDE Abfrage, die die Güteauswahl
// nicht anfordert, mit angehängter `LIMIT`-Klausel genau dort, wo sie auf dem Basisstand stand.
const SQL_VORGABE = `
      SELECT p.ko_id, p.ko_version, p.projection_version, p.content_hash, p.status, p.language,
             (p.title_text ILIKE $3 ESCAPE '\\') AS m_title_text, (p.statement_text ILIKE $3 ESCAPE '\\') AS m_statement_text, (COALESCE(md.category_text, '') ILIKE $3 ESCAPE '\\') AS m_category_text,
             (COALESCE(md.tag_text, '') ILIKE $3 ESCAPE '\\') AS m_tag_text, (p.caption_text ILIKE $3 ESCAPE '\\') AS m_caption_text
        FROM ko_search_projections p
        JOIN kos k ON k.id = p.ko_id AND COALESCE((k.data->>'version')::int, 1) = p.ko_version AND NOT (k.data ? 'deletedAt')
        LEFT JOIN ko_metadata_projections md ON md.ko_id = p.ko_id
       WHERE p.projection_version = $1 AND p.generation = $2 AND (p.search_text ILIKE $3 ESCAPE '\\' OR COALESCE(md.category_text, '') ILIKE $3 ESCAPE '\\' OR COALESCE(md.tag_text, '') ILIKE $3 ESCAPE '\\')
       ORDER BY (k.status='validiert') DESC, (k.data->>'trust')::int DESC NULLS LAST, p.ko_id`;

describe("JOB 3048 · P1 — wer die Güte nicht anfordert, bekommt die Anweisung des Basisstands", () => {
  it("P1 · ohne `limit`: gleiche Anweisung, gleiche Parameter — keine Güte, keine Unterabfrage", async () => {
    const { sql, params } = await suchanweisung({ terms: [TERM] });

    expect(sql).toBe(SQL_VORGABE);
    expect(params).toEqual([2, GENERATION, `%${TERM}%`]);
    expect(sql).not.toContain("CASE");
    expect(sql).not.toContain("treffer_guete");
    expect(sql).not.toContain("LIMIT");
  });

  it("P1b · MIT `limit`, ohne Anforderung (der Bibliotheksweg): dieselbe Anweisung plus LIMIT am Ende", async () => {
    const { sql, params } = await suchanweisung({ terms: [TERM], limit: 200 });

    expect(sql).toBe(`${SQL_VORGABE} LIMIT $4`);
    expect(params).toEqual([2, GENERATION, `%${TERM}%`, 200]);
    // Keine Unterabfrage, keine Güte — es gibt in diesem Modus nichts, was die Trefferliste der
    // Bibliothek verschieben könnte.
    expect(sql).not.toContain("CASE");
    expect(sql).not.toContain(") auswahl");
    expect(sql.match(/ORDER BY/g)).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------------------------
// P2–P5 — MIT DECKEL: AUSWAHL UND AUSGABE SIND GETRENNT
// ------------------------------------------------------------------------------------------------

describe("JOB 3048 · P2–P5 — der Deckel wählt nach Güte, die Ausgabe bleibt die alte", () => {
  it("P2 · genau EIN LIMIT, und es sitzt an der AUSWAHL (in der Unterabfrage)", async () => {
    const { sql, params } = await suchanweisung({ terms: [TERM], limit: 50, ...GUETE });

    expect(sql.match(/LIMIT/g)).toHaveLength(1);
    expect(params).toEqual([2, GENERATION, `%${TERM}%`, 50]);
    // Das LIMIT steht VOR dem Ende der Unterabfrage — es deckelt also die nach Güte geordnete
    // Auswahl und nicht die Ausgabe.
    const innen = sql.indexOf("LIMIT");
    const klammerZu = sql.indexOf(") auswahl");
    expect(klammerZu).toBeGreaterThan(innen);
  });

  it("P3 · die INNERE Ordnung stellt die Güte VOR die unveränderte Ausgabeordnung", async () => {
    const { sql } = await suchanweisung({ terms: [TERM], limit: 50, ...GUETE });

    expect(sql).toContain(
      "ORDER BY treffer_guete DESC, (k.status='validiert') DESC, (k.data->>'trust')::int DESC NULLS LAST, p.ko_id",
    );
  });

  it("P4 · die ÄUSSERE Ordnung ist die Ausgabeordnung — ohne jede Güte", async () => {
    const { sql } = await suchanweisung({ terms: [TERM], limit: 50, ...GUETE });

    const aeussere = sql.slice(sql.indexOf(") auswahl"));
    expect(aeussere).toContain(
      "ORDER BY auswahl.ist_validiert DESC, auswahl.trust_wert DESC NULLS LAST, auswahl.ko_id",
    );
    expect(aeussere).not.toContain("treffer_guete");
  });

  it("P5 · KEIN ZWEITER GÜTE-AUSDRUCK: die `WHEN` sind wörtlich die Ausdrücke der `m_*`-Flags", async () => {
    const { sql } = await suchanweisung({ terms: [TERM], limit: 50, ...GUETE });

    // Aus der Anweisung SELBST gelesen, nicht nachgebaut: der geklammerte Ausdruck unmittelbar vor
    // `AS m_<feld>`. Rückwärts über die Klammertiefe, weil `COALESCE(md.…, '')` selbst klammert.
    const flagAusdruck = (feld: string) => {
      const vor = sql.slice(0, sql.indexOf(` AS m_${feld}`));
      let tiefe = 0;
      for (let i = vor.length - 1; i >= 0; i -= 1) {
        if (vor[i] === ")") {
          tiefe += 1;
        } else if (vor[i] === "(") {
          tiefe -= 1;
          if (tiefe === 0) {
            return vor.slice(i);
          }
        }
      }
      throw new Error(`kein m_${feld}-Ausdruck in der Anweisung`);
    };
    const fall = sql.slice(sql.indexOf("CASE"), sql.indexOf("END AS treffer_guete"));

    for (const feld of [
      "title_text",
      "statement_text",
      "category_text",
      "tag_text",
      "caption_text",
    ]) {
      expect(fall, `Feld ${feld}`).toContain(flagAusdruck(feld));
    }
  });
});

// ------------------------------------------------------------------------------------------------
// P6/P7 — DIE PARITÄT: DIESELBE TREFFERLAGE, DASSELBE `limit`, DIESELBEN ÜBERLEBENDEN
// ------------------------------------------------------------------------------------------------
//
// Die Güteleiter wird AUS DER ERZEUGTEN SQL GELESEN (`leiterAusSql`) und nicht daneben noch einmal
// hingeschrieben. Vertauschte jemand zwei `WHEN`-Zweige oder änderte einen `THEN`-Wert, ändert sich
// damit die hier gemessene Leiter — und P6/P7 werden rot.

interface Stufe {
  feld: keyof KoSearchHit["matched"] | "einordnung";
  wert: number;
}

function leiterAusSql(sql: string): { stufen: Stufe[]; sonst: number } {
  const fall = sql.slice(sql.indexOf("CASE"), sql.indexOf("END AS treffer_guete"));
  const stufen: Stufe[] = [];
  for (const zweig of fall.matchAll(/WHEN ([\s\S]*?) THEN (\d+)/g)) {
    const bedingung = zweig[1] as string;
    const wert = Number(zweig[2]);
    const feld = bedingung.includes("p.title_text")
      ? "title"
      : bedingung.includes("p.statement_text")
        ? "statement"
        : bedingung.includes("md.category_text") && bedingung.includes("md.tag_text")
          ? "einordnung"
          : bedingung.includes("p.caption_text")
            ? "caption"
            : undefined;
    expect(feld, `unbekannte CASE-Bedingung: ${bedingung}`).toBeDefined();
    stufen.push({ feld: feld as Stufe["feld"], wert });
  }
  const sonst = Number((fall.match(/ELSE (\d+)/) as RegExpMatchArray)[1]);
  return { stufen, sonst };
}

/** Der Rang, den die ERZEUGTE SQL einem Treffer gibt — Zweig für Zweig in ihrer Reihenfolge. */
function gueteAusSql(leiter: { stufen: Stufe[]; sonst: number }, matched: KoSearchHit["matched"]) {
  for (const stufe of leiter.stufen) {
    const trifft =
      stufe.feld === "einordnung" ? matched.category || matched.tag : matched[stufe.feld];
    if (trifft) {
      return stufe.wert;
    }
  }
  return leiter.sonst;
}

const DECKEL = 3;
const BASIS = { type: "best_practice" as const, author: "anna", category: "Handbuch" };

interface Lage {
  ko: KoService;
  /** koId → sprechender Name der Fundstelle. */
  namen: Map<string, string>;
  /** koId → Trust, wie im Bestand gesetzt. */
  trust: Map<string, number>;
}

let lage: Lage;
let leiter: { stufen: Stufe[]; sonst: number };

beforeAll(async () => {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  // SECHS OBJEKTE, EINE FUNDSTELLE JE OBJEKT — und der Trust läuft der Güte ABSICHTLICH entgegen:
  // nach der alten Regel überlebten Körper (60), Fußnote (50) und Schlagwort (40), nach der neuen
  // Titel (4), Aussage (3) und — bei Gleichstand auf Stufe 2 — das trustreichere Schlagwort.
  const namen = new Map<string, string>();
  const trust = new Map<string, number>();
  const anlegen = async (name: string, wert: number, eingabe: Record<string, unknown>) => {
    const erstellt = await ko.create({
      ...BASIS,
      title: `Anlage ${name}`,
      statement: "Ohne das gesuchte Wort.",
      ...eingabe,
    } as Parameters<KoService["create"]>[0]);
    await ko.setValidationState(erstellt.id, { trust: wert, status: "validiert" });
    namen.set(erstellt.id, name);
    trust.set(erstellt.id, wert);
  };
  await anlegen("titel", 10, { title: "Ruettelfrequenz der Anlage" });
  await anlegen("aussage", 20, { statement: "Die Ruettelfrequenz ist geregelt." });
  await anlegen("kategorie", 30, { category: "Ruettelfrequenz" });
  await anlegen("schlagwort", 40, { tags: ["Ruettelfrequenz"] });
  await anlegen("fussnote", 50, {
    bodyHtml: "<figure><img src='x'><figcaption>Ruettelfrequenz am Rad</figcaption></figure>",
  });
  await anlegen("koerper", 60, {
    bodyHtml: "<p>Die Ruettelfrequenz steht nur hier im Fliesstext.</p>",
  });

  lage = { ko, namen, trust };
  leiter = leiterAusSql((await suchanweisung({ terms: [TERM], limit: DECKEL, ...GUETE })).sql);
});

describe("JOB 3048 · P6/P7 — beide Adapter wählen dieselben Überlebenden", () => {
  it("P6 · die aus der SQL gelesene Leiter gibt jeder Fundstelle denselben Rang wie die eine Regel", async () => {
    const alle = await lage.ko.findSearchHits({ terms: [TERM] });
    expect(alle).toHaveLength(6);

    // Die Trefferlage ist BELEGT, nicht behauptet: je Objekt genau eine Fundstelle.
    const raenge = new Map(
      alle.map((h) => [lage.namen.get(h.koId) as string, suchTrefferguete(h.matched)]),
    );
    expect(Object.fromEntries(raenge)).toEqual({
      titel: SUCH_TREFFERGUETE.titel,
      aussage: SUCH_TREFFERGUETE.aussage,
      kategorie: SUCH_TREFFERGUETE.einordnung,
      schlagwort: SUCH_TREFFERGUETE.einordnung,
      fussnote: SUCH_TREFFERGUETE.fussnote,
      koerper: SUCH_TREFFERGUETE.koerper,
    });

    for (const hit of alle) {
      expect(gueteAusSql(leiter, hit.matched), lage.namen.get(hit.koId)).toBe(
        suchTrefferguete(hit.matched),
      );
    }
  });

  it("P7 · gleiche Eingabe, gleiches `limit` → gleiche Überlebendenmenge in beiden Adaptern", async () => {
    const alle = await lage.ko.findSearchHits({ terms: [TERM] });

    // DIE POSTGRES-SEITE, nachvollzogen mit der Ordnung, die die gepinnte Anweisung ausspricht
    // (P3: `treffer_guete DESC, (k.status='validiert') DESC, trust DESC NULLS LAST, ko_id`). Die
    // Güte kommt dabei aus der erzeugten SQL selbst, nicht aus einer zweiten Handfassung.
    const pgUeberlebende = [...alle]
      .sort(
        (a, b) =>
          gueteAusSql(leiter, b.matched) - gueteAusSql(leiter, a.matched) ||
          (lage.trust.get(b.koId) as number) - (lage.trust.get(a.koId) as number) ||
          a.koId.localeCompare(b.koId),
      )
      .slice(0, DECKEL)
      .map((h) => lage.namen.get(h.koId) as string);

    // DIE SPEICHER-SEITE, wirklich gefahren.
    const speicher = (await lage.ko.findSearchHits({ terms: [TERM], limit: DECKEL, ...GUETE })).map(
      (h) => lage.namen.get(h.koId) as string,
    );

    expect([...speicher].sort()).toEqual([...pgUeberlebende].sort());
    // Und die Menge ist die inhaltlich richtige — sonst wäre die Parität auch bei zwei gleich
    // falschen Adaptern grün.
    expect([...speicher].sort()).toEqual(["aussage", "schlagwort", "titel"]);
    // Die AUSGABE bleibt nach Trust geordnet: Schlagwort (40), Aussage (20), Titel (10).
    expect(speicher).toEqual(["schlagwort", "aussage", "titel"]);
  });

  it("P8 · DERSELBE Bestand OHNE Anforderung: beide Adapter wählen die alten drei — nach Trust", async () => {
    // Die Gegenrichtung zu P7 und der eigentliche Beweis, dass die Güte nicht überall wirkt. Der
    // Trust läuft der Güte in dieser Lage absichtlich entgegen, deshalb sind die beiden
    // Überlebendenmengen DISJUNKT — eine Verwechslung der Modi könnte gar nicht grün bleiben.
    const speicher = (await lage.ko.findSearchHits({ terms: [TERM], limit: DECKEL })).map(
      (h) => lage.namen.get(h.koId) as string,
    );
    expect(speicher).toEqual(["koerper", "fussnote", "schlagwort"]);

    // Und die PostgreSQL-Seite sagt dasselbe: im Vorgabemodus steht vor dem `LIMIT` die alte
    // Ordnung und keine Güte — aus der Anweisung selbst gelesen.
    const { sql } = await suchanweisung({ terms: [TERM], limit: DECKEL });
    expect(sql).not.toContain("treffer_guete");
    expect(sql).toContain(
      "ORDER BY (k.status='validiert') DESC, (k.data->>'trust')::int DESC NULLS LAST, p.ko_id LIMIT",
    );
  });
});
