// ================================================================================================
// JOB 4303 · DER DECKEL ZÄHLT NUR NOCH, WAS DER MENSCH SEHEN DARF — DIE NAHT, OHNE BROWSER.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEM GROSSEN LAUF STEHT. Der ausgeführte Nutzerweg
// (`findet-im-grossbestand.integration.test.ts`, G1b) braucht 10.000 Zeilen in einer echten
// PostgreSQL, einen echten Chromium und eine gebaute Fläche. Er ist der Nachweis, dass ein MENSCH
// sein Dokument findet — und er ist zu teuer und zu grob, um die eine Naht zu bewachen, an der der
// Fehler sitzt. Diese Datei hält genau diese Naht fest, im Tor, in Sekunden:
//
//   `LibraryService.search` deckelt die Trefferabfrage (`findSearchHits`, 200 Plätze). Steht der
//   Sichtbarkeitstrim NICHT vor dem Deckel, belegen Einträge, die dieser Mensch nie zu sehen
//   bekommt, seine Plätze — und herausfällt das Dokument, das er sucht.
//
// WAS SIE AUSDRÜCKLICH NICHT ERSETZT: den ausgeführten Weg. Sie misst keinen Browser, keine Fläche,
// keinen HTTP-Socket und keine echte Datenbank. Sie misst die Dienstnaht — und für den
// PostgreSQL-Adapter die ERZEUGTE Anweisung (Fake-Pool, SQL-Pin, Muster
// `tests/suchraum-deckel/deckel-paritaet-pg.test.ts`), nicht ihren Vollzug.
//
// DIE ZAHLEN SIND DIE DES HAUSES, importiert statt abgeschrieben: der Serverdeckel
// `LIBRARY_SEARCH_HIT_LIMIT` (200) und die echte Sichtbarkeitsregel `sqlSichtbarkeitFuer`
// (services/app/src/sichtbarkeit.ts) — ein nachgebautes Prädikat prüfte hier die Attrappe statt die
// Regel, gegen die die Route entscheidet.
import type { Pool } from "pg";
import { beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import {
  LIBRARY_SEARCH_HIT_LIMIT,
  LibraryService,
} from "../../services/library-analytics/src/service";

const JOB = "[KLARWERK] JOB 4303";

/** Frei erfunden: kein Stoppwort, keine deklarierte Entsprechung, kein Fixture-Wort. */
const BEGRIFF = "Zwirbelkopplung";

/** Der Mensch, der sucht. `experte` trägt `ko.read`, aber NICHT `ko.validate` (rbac/policy.ts:33). */
const NEULING: SessionUser = { id: "neuling-4303", role: "experte" };
const FREMDER_EIGNER = "fremd-eigner-4303";
const ZIEL_AUTOR = "anna-4303";

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Handbuch",
  author: ZIEL_AUTOR,
};

/** Die Steuerzeile im Normalbetrieb (V2 freigegeben) — Muster: deckel-paritaet-pg.test.ts:45. */
const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: 5,
  active_generation: 5,
  integrity_marker: "V2-READY:5",
  activated_at: "2026-08-01T00:00:00.000Z",
};

/** Ein Pool, der jede Anweisung mitschreibt und die Steuerzeile beantwortet — führt nichts aus. */
function fakePool(): { pool: Pool; calls: { sql: string; params: unknown[] }[] } {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      return { rows: [STEUERZEILE_V2_ACTIVE], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };
  return { pool: { query } as unknown as Pool, calls };
}

/** Die Suchabfrage selbst — ohne den vorangestellten Blick auf die Steuerzeile. */
function suchanweisung(calls: { sql: string; params: unknown[] }[]): {
  sql: string;
  params: unknown[];
} {
  const anweisung = calls.find((c) => !c.sql.includes("ko_projection_control"));
  expect(anweisung, "keine Suchabfrage abgesetzt").toBeDefined();
  return anweisung as { sql: string; params: unknown[] };
}

interface Bestand {
  ko: KoService;
  bibliothek: LibraryService;
  /** Die 200 fremden vertraulichen Einträge — höchster Trust, Begriff im TITEL. */
  fremde: string[];
  /** Das eine sichtbare Ziel — niedrigster Trust, Begriff NUR im Fliesstext. */
  ziel: string;
}

/**
 * DIE LAGE AUS DEM AUFTRAG, auf das kleinste Maß gebracht, an dem sie noch entsteht:
 * `LIBRARY_SEARCH_HIT_LIMIT` fremde vertrauliche Einträge füllen den Deckel VOLLSTÄNDIG, das
 * sichtbare Ziel ist der 201. Anwärter und trägt den niedrigsten Trust — es ist damit der Eintrag,
 * den die Ordnung `validiert ↓, trust ↓, koId` als ERSTEN wegwirft.
 *
 * Kein Doppelgänger: der `KoService` ist der echte, die Projektionsfassung wird über den
 * Produktweg freigegeben (`activateSearchProjectionV2`), die Bibliothek ist der echte Dienst.
 */
async function bestand(): Promise<Bestand> {
  const repo = new InMemoryKoRepo();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const fremde: string[] = [];
  for (let i = 0; i < LIBRARY_SEARCH_HIT_LIMIT; i += 1) {
    const nr = String(i).padStart(3, "0");
    const eintrag = await ko.create({
      ...VORLAGE,
      title: `Vertrauliche Notiz zur ${BEGRIFF} ${nr}`,
      statement: `Messreihe ${nr} zur ${BEGRIFF}.`,
      author: FREMDER_EIGNER,
      confidentiality: "vertraulich",
    });
    await ko.setValidationState(eintrag.id, { trust: 95, status: "validiert" });
    fremde.push(eintrag.id);
  }

  const ziel = await ko.create({
    ...VORLAGE,
    title: "Betriebsanweisung Kaltstart Presse 7",
    statement: "Dokumentnummer BA-4303-07713.",
    confidentiality: "intern",
    bodyHtml: `<p>Vor dem Kaltstart wird die ${BEGRIFF} geloest und der Pruefstift entnommen.</p>`,
  });
  await ko.setValidationState(ziel.id, { trust: 1, status: "validiert" });

  return { ko, bibliothek: new LibraryService({ koService: ko }), fremde, ziel: ziel.id };
}

describe("JOB 4303 · der Trefferdeckel greift auf der sichtbaren Grundmenge", () => {
  let b: Bestand;
  beforeAll(async () => {
    b = await bestand();
  }, 120_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // D1 — DIE ZUSAGE: MIT TRIM STEHT DAS SICHTBARE ZIEL IN DER ANTWORT, OHNE TRIM NICHT.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Beide Hälften gehören zusammen. Die erste allein wäre nicht gezeigt, dass der Trim die Ursache
  // ist; die zweite allein wäre die Beschreibung eines Fehlers ohne seine Behebung.
  it("D1 · der Deckel füllt sich mit sichtbaren Anwärtern — das Ziel überlebt ihn", async () => {
    const mitTrim = await b.bibliothek.search(BEGRIFF, {}, { trim: sqlSichtbarkeitFuer(NEULING) });
    const kennungen = mitTrim.map((k) => k.id);
    expect(
      kennungen,
      `das Ziel fehlt trotz Trim — der Deckel liegt weiterhin vor der Sichtbarkeit (${kennungen.length} Treffer)`,
    ).toContain(b.ziel);

    // UND DER TRIM ERWEITERT NICHTS: kein fremder vertraulicher Eintrag reist mit heraus.
    const fremdeDrin = kennungen.filter((id) => b.fremde.includes(id));
    expect(fremdeDrin, "ein fremder vertraulicher Eintrag steht in der Antwort").toEqual([]);
    // Die sichtbare Grundmenge trägt genau EINEN Anwärter — also ist die Antwort genau er.
    expect(kennungen).toEqual([b.ziel]);
  });

  it("D1b · OHNE Trim verdrängen die 200 fremden Einträge das Ziel aus dem Deckel", async () => {
    const ohneTrim = await b.bibliothek.search(BEGRIFF, {});
    const kennungen = ohneTrim.map((k) => k.id);
    // Die Ausgangslage, die den Auftrag ausgelöst hat — sie wird hier FESTGEHALTEN, nicht behoben:
    // ohne Trim entscheidet der Trust über die 200 Plätze, und das Ziel trägt den niedrigsten.
    expect(
      kennungen.length,
      "ohne Trim wird gar nicht gedeckelt — dann misst dieser Fall nichts",
    ).toBe(LIBRARY_SEARCH_HIT_LIMIT);
    expect(
      kennungen,
      "das Ziel steht auch ohne Trim in der Antwort — dann ist der Bestand nicht überfüllt",
    ).not.toContain(b.ziel);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // D2 — DIE LEERSUCHE NIMMT DEN ANDEREN ZWEIG UND MUSS WEITER TRAGEN.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // `LibraryService.search` beantwortet die leere Suchzeile ohne Trefferabfrage
  // (`services/library-analytics/src/service.ts`, Zweig `if (!q)`) — sie ist der teuerste Weg und
  // der einzige, der den Deckel gar nicht erst sieht. Sie darf durch diesen Job weder mehr noch
  // weniger zeigen als bisher.
  it("D2 · die leere Suchzeile zeigt den sichtbaren Bestand — nicht mehr und nicht weniger", async () => {
    const bestandMitTrim = await b.bibliothek.search(
      "",
      {},
      { trim: sqlSichtbarkeitFuer(NEULING) },
    );
    expect(bestandMitTrim.map((k) => k.id)).toEqual([b.ziel]);
    const ohneTrim = await b.bibliothek.search("", {});
    expect(ohneTrim.length, "ohne Trim liefert die Leersuche nicht mehr den ganzen Bestand").toBe(
      LIBRARY_SEARCH_HIT_LIMIT + 1,
    );
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // D3 — DER SPEICHER-ADAPTER WENDET DEN TRIM AUF DIE GRUNDMENGE AN, NICHT AUF DAS ERGEBNIS.
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // Der Unterschied ist genau der des Auftrags: ein Deckel von 1 über der GESAMTmenge liefert den
  // fremden Eintrag mit dem höchsten Trust (und damit für diesen Menschen nichts); ein Deckel von 1
  // über der SICHTBAREN Menge liefert das Ziel.
  it("D3 · ein Deckel von 1 liefert mit Trim das sichtbare Ziel, ohne Trim den fremden Eintrag", async () => {
    const trim = sqlSichtbarkeitFuer(NEULING);
    const mit = await b.ko.findSearchHits({ terms: [BEGRIFF], limit: 1 }, trim);
    expect(
      mit.map((h) => h.koId),
      "der Trim wirkt erst nach dem Deckel",
    ).toEqual([b.ziel]);

    const ohne = await b.ko.findSearchHits({ terms: [BEGRIFF], limit: 1 });
    expect(ohne, "ohne Deckelplatz gibt es keinen Treffer").toHaveLength(1);
    expect(
      b.fremde,
      "ohne Trim überlebt nicht der fremde Eintrag — dann ist die Ordnung eine andere",
    ).toContain(ohne[0]?.koId);
  });

  // ══════════════════════════════════════════════════════════════════════════════════════════════
  // D4 — DER POSTGRES-ADAPTER: DAS PRÄDIKAT STEHT IM `WHERE`, VOR DEM `LIMIT` (SQL-Pin).
  // ══════════════════════════════════════════════════════════════════════════════════════════════
  //
  // GEMESSEN WIRD DIE ERZEUGTE ANWEISUNG, nicht ihr Vollzug — ein ausführender Postgres braucht
  // Docker und steht im Integrationslauf (`tests/security/380-trim-paritaet.integration.test.ts`
  // fährt die beiden Formen desselben Trims dort gegen eine echte Datenbank). Was hier zählt, ist
  // die Bauform: eine Nachfilterung des Ergebnisses wäre an dieser Anweisung nicht zu sehen.
  it("D4 · die Trefferabfrage trägt das Trimprädikat im WHERE — und seine Werte vor dem Deckel", async () => {
    const { pool, calls } = fakePool();
    const trim = sqlSichtbarkeitFuer(NEULING);
    await new PgKoSearchProjectionRepo(pool).findActive(
      { terms: [BEGRIFF], limit: LIBRARY_SEARCH_HIT_LIMIT },
      trim,
    );
    const { sql, params } = suchanweisung(calls);

    // Das Prädikat ist das des Trims, WÖRTLICH — der Adapter legt die Regel nicht aus. Seine
    // Platzhalter beginnen dort, wo der Adapter seine eigenen vergeben hatte: der Deckel ist der
    // letzte Parameter, davor stehen die Werte des Trims.
    const ersterTrimplatz = params.length - trim.params.length;
    const erwartet = trim.sql("k", ersterTrimplatz);
    expect(sql, "die Anweisung trägt das Trimprädikat nicht").toContain("k.confidentiality_key");
    expect(sql).toContain("k.deleted_at_key IS NULL");

    // UND ES STEHT VOR DEM DECKEL: das `LIMIT` kommt in der Anweisung NACH dem Prädikat.
    const stelleTrim = sql.indexOf("k.deleted_at_key IS NULL");
    const stelleLimit = sql.indexOf("LIMIT");
    expect(stelleLimit, "die Anweisung hat gar keinen Deckel").toBeGreaterThan(-1);
    expect(
      stelleTrim,
      "das Trimprädikat steht hinter dem LIMIT — dann filtert es das Ergebnis, nicht die Grundmenge",
    ).toBeLessThan(stelleLimit);

    // Die Werte des Trims stehen an genau den Plätzen, die sein eigenes Prädikat vergeben hat,
    // und der Deckel ist der LETZTE Parameter — er wird nach dem Trim vergeben.
    expect(params.at(-1), "der Deckel ist nicht der letzte Parameter").toBe(
      LIBRARY_SEARCH_HIT_LIMIT,
    );
    expect(params.slice(-1 - trim.params.length, -1)).toEqual([...trim.params]);
    expect(erwartet, "das gepinnte Prädikat ist leer").not.toBe("");
    expect(sql).toContain(erwartet);
    process.stderr.write(`${JOB} D4 SQL-Pin: ${erwartet}\n`);
  });

  it("D4b · OHNE Trim ist die Anweisung unverändert — kein Prädikat, kein Parameter", async () => {
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({
      terms: [BEGRIFF],
      limit: LIBRARY_SEARCH_HIT_LIMIT,
    });
    const { sql, params } = suchanweisung(calls);
    expect(
      sql,
      "ohne Trim steht trotzdem ein Sichtbarkeitsprädikat in der Anweisung",
    ).not.toContain("confidentiality_key");
    // Fassung, Generation, EIN Begriff, Deckel — mehr Parameter hat der Altvertrag nicht.
    expect(params).toHaveLength(4);
  });
});
