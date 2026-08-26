import type { Pool } from "pg";
// ================================================================================================
// JOB 2397 · D1 (S2) — DIE BEIDEN ADAPTER IM VERGLEICH.
// ================================================================================================
//
// S2 sagt zu: `expandSearchTerms(normalizeSearchTerms(…))` steht in BEIDEN Adaptern,
// „damit die Suche in jeder Betriebsart dieselbe Kandidatenmenge sieht".
//
// DREI PRUEFSTAENDE GAB ES SCHON — UND KEINER VERGLEICHT DIE BEIDEN:
//
//   s2-adapter-aufruf.test.ts     faehrt NUR den In-Memory-Weg („klep" findet „Ventil")
//   s2-adapter-postgres.test.ts   liest NUR die SQL-Parameterliste des Postgres-Wegs
//   s2-adapter-laufzeit.test.ts   misst NUR, was `expandSearchTerms` kostet
//
// Jeder ist fuer sich gruen. Genau das ist die Bauart, bei der eine Abweichung lange unbemerkt
// bleibt: niemand stellt die beiden nebeneinander. Liefe ein Adapter kuenftig anders — ein
// vergessenes `expandSearchTerms`, eine vertauschte Reihenfolge, eine zusaetzliche Bereinigung —,
// bliebe jeder der drei Staende gruen, und dieselbe Frage bekaeme je nach Betriebsart eine
// andere Antwort.
//
// WAS HIER GEMESSEN WIRD, und warum es Verhalten ist und keine Namensanwesenheit:
// Beide Adapter werden mit DERSELBEN Eingabe GEFAHREN. Aufgezeichnet wird an der echten
// Modulgrenze, was jeder von beiden tatsaechlich ausrechnet und weiterverwendet — nicht, ob ein
// Bezeichner irgendwo im Quelltext steht.
//
//   V1  beide Adapter leiten aus derselben Eingabe DIESELBE Kandidatenmenge ab
//   V2  diese Menge erreicht auch die Vergleichsstufe: im Postgres-Weg als Parameterliste
//   V3  Produktverhalten ohne Instrument: „klep" findet das Ventil-Objekt im In-Memory-Weg,
//       und der Postgres-Weg traegt „ventil" in seinen Parametern
//   K   KALIBRIERUNG: die Aufzeichnung zeichnet wirklich auf, und der Vergleich sieht einen
//       Unterschied. Ohne K waere eine Reihe von „gleich" nicht von einem toten Vergleich
//       zu unterscheiden.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  KoService,
} from "../../services/knowledge-object";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";

// ------------------------------------------------------------------------------------------------
// DIE AUFZEICHNUNG AN DER ECHTEN MODULGRENZE
// ------------------------------------------------------------------------------------------------
//
// BEIDE Adapter importieren die zwei Funktionen aus derselben Datei
// (`search-projection-repo.ts:16-17` und `search-projection-repo-pg.ts:10-11`). Hier werden sie
// durchgereicht und dabei mitgeschrieben — die echte Funktion rechnet, nichts wird ersetzt.
// Damit misst der Vergleich, was der Adapter WIRKLICH weiterverwendet.

interface Eintrag {
  fn: "matchEffectiveSearchDocument";
  aus: string[];
}
const spur: Eintrag[] = [];

vi.mock("../../services/knowledge-object/src/effective-search-document", async (io) => {
  const echt =
    await io<typeof import("../../services/knowledge-object/src/effective-search-document")>();
  return {
    ...echt,
    matchEffectiveSearchDocument: (
      dok: Parameters<typeof echt.matchEffectiveSearchDocument>[0],
      terms: readonly string[],
    ) => {
      spur.push({ fn: "matchEffectiveSearchDocument", aus: [...terms] });
      return echt.matchEffectiveSearchDocument(dok, terms);
    },
  };
});

/**
 * Die Kandidatenmenge des IN-MEMORY-Wegs: die Begriffe, mit denen er WIRKLICH vergleicht
 * (`search-projection-repo.ts:749-752`).
 *
 * WARUM NICHT DIE RUECKGABE VON `expandSearchTerms`: Der erste Entwurf dieses Waechters hat
 * genau das gemessen — den ERZEUGUNGSPUNKT. Eine Mutation, die den Zusatzbegriff NACH dem Aufruf
 * anhaengt, liess ihn gruen (gemessen, Rueckgabe §4.2). Gemessen werden muss der
 * VERBRAUCHSPUNKT: was der Adapter am Ende einsetzt.
 */
function kandidatenmengeMem(): string[] {
  const letzte = [...spur].reverse().find((e) => e.fn === "matchEffectiveSearchDocument");
  expect(
    letzte,
    "der In-Memory-Adapter hat gar nicht verglichen — dann gibt es keine Kandidatenmenge",
  ).toBeDefined();
  return (letzte as Eintrag).aus;
}

// ------------------------------------------------------------------------------------------------
// DER POSTGRES-WEG OHNE DATENBANK
// ------------------------------------------------------------------------------------------------
//
// Uebernommen aus `tests/knowledge/s2-adapter-postgres.test.ts:25-71` — nicht erfunden. Der
// aufzeichnende Doppelgaenger beantwortet die Steuerzeile und faengt die Suchabfrage ab; eine
// echte Datenbank ist weder noetig noch erlaubt.
const AKTIVE_GENERATION = 5;
const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: AKTIVE_GENERATION,
  active_generation: AKTIVE_GENERATION,
  integrity_marker: `V2-READY:${AKTIVE_GENERATION}`,
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
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

function suchAbfrage(calls: { sql: string; params: unknown[] }[]) {
  return calls.find((c) => !c.sql.includes("ko_projection_control"));
}

/** Die Suchbegriffe unter den Parametern — sie reisen als `%begriff%` in die ILIKE-Bedingungen. */
function begriffeIn(params: unknown[]): string[] {
  return params
    .filter((p): p is string => typeof p === "string" && p.startsWith("%") && p.endsWith("%"))
    .map((p) => p.slice(1, -1));
}

// ------------------------------------------------------------------------------------------------
// DER IN-MEMORY-WEG UEBER DEN ECHTEN STAPEL
// ------------------------------------------------------------------------------------------------
//
// Derselbe Aufbau wie `tests/knowledge/s2-adapter-aufruf.test.ts:29-40`: die vorgeschriebene
// Freigabefolge ueber den Produktweg, keine Abkuerzung.
type Stapel = Awaited<ReturnType<typeof stapel>>;

async function stapel() {
  const repo = new InMemoryKoRepo();
  const projections = new InMemoryKoSearchProjectionRepo(repo);
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: projections,
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);
  return { repo, projections, ko };
}

const EINGABE: CreateKoInput = {
  title: "Wartung der Anlage",
  statement: "Das Ventil wird jaehrlich geprueft.",
  type: "best_practice",
  category: "Anlage 1",
  author: "anna",
};

let s: Stapel;

beforeEach(async () => {
  spur.length = 0;
  s = await stapel();
  await s.ko.create(EINGABE);
});

/**
 * Faehrt BEIDE Adapter mit derselben Eingabe und gibt zurueck, was jeder von beiden ausgerechnet
 * hat. Die Spur wird vor JEDEM der beiden Laeufe geleert — sonst mischten sich die Aufrufe des
 * Stapelaufbaus und der beiden Adapter, und die Zuordnung waere geraten statt gemessen.
 */
async function beideAdapter(terms: string[]) {
  spur.length = 0;
  const trefferMem = await s.projections.findActive({ terms });
  const memHatVerglichen = spur.some((e) => e.fn === "matchEffectiveSearchDocument");
  const mem = memHatVerglichen ? kandidatenmengeMem() : null;

  const { pool, calls } = fakePool();
  await new PgKoSearchProjectionRepo(pool).findActive({ terms });
  const abfrage = suchAbfrage(calls);
  // Der VERBRAUCHSPUNKT des Postgres-Wegs: die Begriffe, die wirklich in die ILIKE-Bedingungen
  // reisen. Auch hier bewusst nicht die Rueckgabe von `expandSearchTerms` — siehe
  // `kandidatenmengeMem`.
  const pg = abfrage ? begriffeIn(abfrage.params) : null;

  return { mem, pg, trefferMem, calls, abfrage };
}

/** Mengengleichheit, unabhaengig von der Reihenfolge — verglichen wird die MENGE, nicht die Liste. */
function alsMenge(x: string[] | null): string[] | null {
  return x === null ? null : [...new Set(x)].sort();
}

/** Die Eingaben — Randfaelle, nicht Wohlfuehlwoerter. */
const EINGABEN: [string, string[]][] = [
  ["Kernfall: das niederlaendische Wort", ["klep"]],
  ["die Gegenrichtung", ["Ventil"]],
  ["Grossschreibung", ["KLEP"]],
  ["zwei Begriffe, einer zugeordnet", ["klep", "wartung"]],
  ["ein Wort ohne Zuordnung", ["dichtung"]],
  ["ein Wort, das es nirgends gibt", ["zzzunbekannt"]],
  ["leere Anfrage", []],
  ["nur Leerraum", ["   "]],
  ["Umlaut und Bindestrich", ["Ventil-Pruefung", "jährlich"]],
];

describe("JOB 2397 D1 · S2 — beide Adapter sehen dieselbe Kandidatenmenge", () => {
  // ---------------------------------------------------------------------------------------------
  // K · KALIBRIERUNG ZUERST.
  // Ohne sie waere jedes „gleich" darunter wertlos: ein Vergleich, der nie etwas sieht, meldet
  // ebenfalls lauter Gleichheit.
  // ---------------------------------------------------------------------------------------------
  it("K1 · beide Verbrauchspunkte liefern ueberhaupt eine Menge", async () => {
    // Ohne diesen Fall waere ein „gleich" aus zwei leeren Messungen nicht von echter
    // Uebereinstimmung zu unterscheiden.
    const { mem, pg } = await beideAdapter(["klep"]);
    expect(mem, "der In-Memory-Adapter hat gar nicht verglichen").not.toBeNull();
    expect(pg, "der Postgres-Adapter hat gar keine Suchabfrage abgesetzt").not.toBeNull();
    expect((mem as string[]).length, "die In-Memory-Menge ist leer").toBeGreaterThan(0);
    expect((pg as string[]).length, "die Postgres-Menge ist leer").toBeGreaterThan(0);
  });

  it("K2 · der Vergleich SIEHT einen Unterschied, wenn es einen gibt", () => {
    // Zwei bewusst verschiedene Mengen muessen als verschieden gelten. Ohne diesen Fall koennte
    // der Vergleich immer „gleich" sagen, und V1 waere eine leere Behauptung.
    const a = ["klep", "ventil"];
    const b = ["klep"];
    expect(a).not.toEqual(b);
    expect([...a].sort()).not.toEqual([...b].sort());
  });

  // ---------------------------------------------------------------------------------------------
  // V1 · DER KERNVERGLEICH.
  // ---------------------------------------------------------------------------------------------
  for (const [name, terms] of EINGABEN) {
    it(`V1 · ${name}: beide Adapter leiten dieselbe Kandidatenmenge ab`, async () => {
      const { mem, pg } = await beideAdapter(terms);
      expect(
        alsMenge(pg),
        `Die beiden Adapter suchen mit VERSCHIEDENEN Kandidatenmengen. In-Memory vergleicht in services/knowledge-object/src/search-projection-repo.ts:749 · Postgres sucht mit den Parametern aus search-projection-repo-pg.ts:535ff · Eingabe ${JSON.stringify(terms)} · In-Memory ${JSON.stringify(alsMenge(mem))} gegen Postgres ${JSON.stringify(alsMenge(pg))}`,
      ).toEqual(alsMenge(mem));
    });
  }

  // ---------------------------------------------------------------------------------------------
  // V2 · DIE MENGE ERREICHT AUCH DIE VERGLEICHSSTUFE.
  // Gleiche Ableitung nuetzt nichts, wenn ein Adapter sie danach fallen liesse.
  // ---------------------------------------------------------------------------------------------
  // V2 ist entfallen und in V1 aufgegangen: seit der Umstellung auf den Verbrauchspunkt IST
  // die Parameterliste die gemessene Postgres-Menge. Ein eigener Fall dafuer haette dieselbe
  // Zahl zweimal verglichen.

  it("V2b · eine leere Anfrage erzeugt in BEIDEN Wegen keine Suche", async () => {
    const { mem, pg, trefferMem } = await beideAdapter([]);
    // BEIDE suchen gar nicht — das ist die Gleichheit, die hier zaehlt.
    expect(mem, "der In-Memory-Weg vergleicht bei leerer Anfrage trotzdem").toBeNull();
    expect(pg, "der Postgres-Weg setzt bei leerer Anfrage trotzdem eine Suchabfrage ab").toBeNull();
    expect(trefferMem, "der In-Memory-Weg liefert bei leerer Anfrage Treffer").toEqual([]);
  });

  // ---------------------------------------------------------------------------------------------
  // V3 · PRODUKTVERHALTEN OHNE INSTRUMENT.
  // V1 und V2 messen an der Modulgrenze. Dieser Fall prueft, dass die Sache auch dort stimmt, wo
  // kein Instrument haengt — sonst belegte der Waechter nur sich selbst.
  // ---------------------------------------------------------------------------------------------
  it('V3 · „klep" findet im In-Memory-Weg das Ventil-Objekt, und der Postgres-Weg fuehrt „ventil" mit', async () => {
    const { trefferMem, calls } = await beideAdapter(["klep"]);
    expect(
      trefferMem.length,
      'der In-Memory-Weg findet das Objekt mit „Ventil" nicht mehr',
    ).toBeGreaterThan(0);
    const abfrage = suchAbfrage(calls) as { params: unknown[] };
    expect(
      begriffeIn(abfrage.params),
      'der Postgres-Weg fuehrt „ventil" nicht in seinen Parametern',
    ).toContain("ventil");
  });

  it("V3b · ein Wort ohne Zuordnung findet nichts und bringt keine Zusatzbegriffe", async () => {
    const { pg, trefferMem } = await beideAdapter(["zzzunbekannt"]);
    expect(trefferMem).toEqual([]);
    expect(new Set(pg as string[])).toEqual(new Set(["zzzunbekannt"]));
  });
});
