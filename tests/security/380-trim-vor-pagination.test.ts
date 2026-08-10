// ================================================================================================
// AUFTRAG-BASIC-380 — PAPIERKORB UND SICHTBARKEIT STEHEN VOR DEM `LIMIT`, ALSO IM SQL.
// ================================================================================================
//
// DER BEFUND, den BASIC 379 §1.2 gemessen und benannt hat, und der diesen Test trägt:
//
//   1. Der Papierkorb wird im ANWENDUNGSSPEICHER gefiltert
//      (`knowledge-object/src/service.ts` — `listForSearch(...).filter(k => !k.deletedAt)`).
//   2. Die Sichtbarkeit wird an der ROUTE gefiltert
//      (`library-routes.ts` — `sichtbareFuer(user, await library.search(...))`).
//
// Solange BEIDE oberhalb von SQL stehen, ist jede Paginierung falsch gebaut: ein `LIMIT 50`
// liefert 50 ZEILEN, von denen danach getrashte und unsichtbare abgezogen werden. Der Nutzer
// bekommt eine kurze Seite, ein Cursor auf die 50. Zeile überspringt reale Treffer, und JEDER
// Zähler über dieser Menge ist eine Existenzauskunft (REF-0001 :48/:49).
//
// DIESER TEST IST DER ROT-ZUERST-BELEG dafür, dass der Trim jetzt IM SQL steht — und zwar in
// derselben Anweisung, die ein `LIMIT` später tragen würde, also VOR ihm.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT (BASIC 380 §Verboten): kein Cursor, keine Seitengröße,
// keine Zähler, keine Facetten. Der Deckel in `zeigtVolleSeite` unten ist ein TESTMITTEL — er
// beweist die Wirkung des Prädikats vor einem Deckel, ohne dem Produkt einen Deckel zu geben.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  InMemoryKoRepo,
  type KnowledgeObject,
  type KoFilter,
  type KoSearchHit,
  KoService,
  type KoSichtbarkeitstrim,
  PgKoRepo,
} from "../../services/knowledge-object";
import { LibraryService } from "../../services/library-analytics";

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
    originalAuthor: "u-anna",
    author: "u-anna",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...overrides,
  } as KnowledgeObject;
}

const AUTOR: SessionUser = { id: "u-anna", role: "experte" };
const FREMDER: SessionUser = { id: "u-bert", role: "experte" };
const CONTROLLER: SessionUser = { id: "u-cara", role: "controller" };

// Der Bestand, an dem sich alles entscheidet: sichtbar, getrasht, fremd-vertraulich, eigen-vertraulich.
function bestand(): KnowledgeObject[] {
  return [
    ko({ id: "a-intern", author: "u-anna" }),
    ko({ id: "b-getrasht", author: "u-anna", deletedAt: "2026-07-02T10:00:00.000Z" }),
    ko({ id: "c-fremd-vertraulich", author: "u-anna", confidentiality: "vertraulich" }),
    ko({ id: "d-fremd-streng", author: "u-anna", confidentiality: "streng_vertraulich" }),
    ko({ id: "e-intern-zwei", author: "u-bert" }),
  ];
}

// ------------------------------------------------------------------------------------------------
// 1 · DIE REGEL ENTSTEHT AN EINER STELLE — NEBEN `darfSehen`, NICHT IN EINEM ADAPTER (G-TRIM-EINS).
// ------------------------------------------------------------------------------------------------

describe("BASIC 380 · sqlSichtbarkeitFuer — dieselbe Regel wie darfSehen, als SQL", () => {
  it("das Prädikat liest die LEBENDE kos-Zeile und NIE den classification_snapshot (G-TRIM-LIVE)", () => {
    const trim = sqlSichtbarkeitFuer(FREMDER);
    const sql = trim.sql("kos", 1);
    // Die drei Schlüsselspalten der lebenden Zeile — und nichts aus der Projektion.
    expect(sql).toContain("deleted_at_key");
    expect(sql).toContain("confidentiality_key");
    expect(sql).toContain("author_key");
    expect(sql).not.toContain("classification_snapshot");
    expect(sql).not.toContain("ko_search_projection");
  });

  it("der Papierkorb steht IM Prädikat — nicht erst im Anwendungsspeicher", () => {
    expect(sqlSichtbarkeitFuer(FREMDER).sql("kos", 1)).toMatch(/deleted_at_key\s+IS\s+NULL/i);
  });

  it("die Platzhalter beginnen dort, wo der Aufrufer sie fortsetzt (kein Kollisionsraten)", () => {
    const trim = sqlSichtbarkeitFuer(FREMDER);
    expect(trim.sql("kos", 1)).toContain("$1");
    expect(trim.sql("kos", 1)).toContain("$2");
    expect(trim.sql("kos", 7)).toContain("$7");
    expect(trim.sql("kos", 7)).toContain("$8");
    expect(trim.sql("kos", 7)).not.toContain("$1 ");
    expect(trim.params).toHaveLength(2);
  });

  it("der Rollenanteil ist can(role,'ko.validate'), der Autoranteil user.id — mehr nicht", () => {
    expect(sqlSichtbarkeitFuer(CONTROLLER).params).toEqual([true, "u-cara"]);
    expect(sqlSichtbarkeitFuer(FREMDER).params).toEqual([false, "u-bert"]);
  });

  it("`trifftZu` ist DIESELBE Entscheidung für Adapter ohne SQL — Papierkorb UND darfSehen", () => {
    const trim = sqlSichtbarkeitFuer(FREMDER);
    for (const k of bestand()) {
      expect(trim.trifftZu(k)).toBe(!k.deletedAt && darfSehen(FREMDER, k));
    }
  });

  it("ein leerer Autor ist KEINE Autorschaft — auch nicht in SQL (sichtbarkeit.ts:74-76)", () => {
    const sql = sqlSichtbarkeitFuer({ id: "", role: "experte" }).sql("kos", 1);
    expect(sql).toMatch(/COALESCE\(kos\.author_key,\s*''\)\s*<>\s*''/i);
  });
});

// ------------------------------------------------------------------------------------------------
// 2 · DER TRIM STEHT IN DER WHERE-KLAUSEL DERSELBEN ANWEISUNG — ALSO VOR JEDEM `LIMIT` (G-TRIM-SQL).
// ------------------------------------------------------------------------------------------------

interface AufgezeichneteAbfrage {
  text: string;
  params: unknown[];
}

function fakePool(aufzeichnung: AufgezeichneteAbfrage[]): {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number }>;
} {
  return {
    query: (text: string, params?: unknown[]) => {
      aufzeichnung.push({ text, params: params ?? [] });
      return Promise.resolve({ rows: [], rowCount: 0 });
    },
  };
}

describe("BASIC 380 · der Trim steht im SQL des Suchwegs, vor dem Deckel", () => {
  it("PgKoRepo.listForSearch nimmt den injizierten Trim in die WHERE-Klausel auf", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool (nur `query` wird benutzt).
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.listForSearch({}, sqlSichtbarkeitFuer(FREMDER));
    const [abfrage] = abfragen;
    expect(abfrage).toBeDefined();
    expect(abfrage?.text).toMatch(/\bWHERE\b/i);
    expect(abfrage?.text).toContain("deleted_at_key");
    expect(abfrage?.text).toContain("confidentiality_key");
    expect(abfrage?.params).toEqual([false, "u-bert"]);
  });

  it("der Trim reiht sich HINTER die Fachfilter ein, ohne deren Platzhalter zu verschieben", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.listForSearch(
      { type: "best_practice", status: "validiert" },
      sqlSichtbarkeitFuer(CONTROLLER),
    );
    const abfrage = abfragen[0];
    expect(abfrage?.text).toContain("type=$1");
    expect(abfrage?.text).toContain("status=$2");
    expect(abfrage?.text).toContain("$3");
    expect(abfrage?.text).toContain("$4");
    expect(abfrage?.params).toEqual(["best_practice", "validiert", true, "u-cara"]);
  });

  it("OHNE Trim bleibt die Abfrage zeichengleich zum heutigen Bestand (Altvertrag)", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.listForSearch({});
    expect(abfragen[0]?.text).toBe("SELECT data - 'bodyHtml' AS data FROM kos");
    expect(abfragen[0]?.params).toEqual([]);
  });

  it("der Trim steht VOR einem etwaigen Deckel — er ist Teil der WHERE-Klausel, nicht eine Nachfilterung", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.listForSearch({}, sqlSichtbarkeitFuer(FREMDER));
    const text = abfragen[0]?.text ?? "";
    const wo = text.search(/\bWHERE\b/i);
    const trimStelle = text.indexOf("deleted_at_key");
    const deckel = text.search(/\bLIMIT\b/i);
    expect(wo).toBeGreaterThanOrEqual(0);
    expect(trimStelle).toBeGreaterThan(wo);
    // Heute trägt dieser Weg keinen Deckel. Trägt er je einen, steht er hinter dem Trim.
    expect(deckel === -1 || deckel > trimStelle).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// 3 · DER BIBLIOTHEKS-SUCHWEG REICHT DEN TRIM BIS AN DIE DATENQUELLE DURCH.
// ------------------------------------------------------------------------------------------------

class SpyKoService extends KoService {
  public readonly gesehen: (KoSichtbarkeitstrim | undefined)[] = [];

  override async listForSearch(
    filter: KoFilter = {},
    trim?: KoSichtbarkeitstrim,
  ): Promise<KnowledgeObject[]> {
    this.gesehen.push(trim);
    return super.listForSearch(filter, trim);
  }

  // Der Treffer-Nachschlag ist hier nicht der Prüfgegenstand: er wird deterministisch bedient,
  // damit der Test die TRIM-Naht misst und nicht die Projektions-Bereitschaft.
  override findSearchHits(): Promise<KoSearchHit[]> {
    return Promise.resolve(
      bestand().map((k) => ({ koId: k.id, score: 1 }) as unknown as KoSearchHit),
    );
  }
}

async function suchdienst(): Promise<{ library: LibraryService; ko: SpyKoService }> {
  const repo = new InMemoryKoRepo();
  for (const k of bestand()) {
    await repo.insert(k);
  }
  const koService = new SpyKoService({ repo });
  return { library: new LibraryService({ koService }), ko: koService };
}

describe("BASIC 380 · LibraryService.search trimmt die GRUNDMENGE, nicht das Ergebnis", () => {
  it("die leere Suchzeile (zeig den Bestand) bekommt den Trim an die Datenquelle", async () => {
    const { library, ko: spy } = await suchdienst();
    const treffer = await library.search("", {}, { trim: sqlSichtbarkeitFuer(FREMDER) });
    expect(spy.gesehen).toHaveLength(1);
    expect(spy.gesehen[0]).toBeDefined();
    expect(treffer.map((k) => k.id)).toEqual(["a-intern", "e-intern-zwei"]);
  });

  it("die Textsuche ebenso — getrashtes und unsichtbares Wissen erreicht den Dienst gar nicht", async () => {
    const { library, ko: spy } = await suchdienst();
    const treffer = await library.search("liefer", {}, { trim: sqlSichtbarkeitFuer(FREMDER) });
    expect(spy.gesehen[0]).toBeDefined();
    expect(treffer.map((k) => k.id)).toEqual(["a-intern", "e-intern-zwei"]);
  });

  it("der Autor sieht sein eigenes vertrauliches Wissen, der Fremde nicht (Variante A, unverändert)", async () => {
    const { library } = await suchdienst();
    const fuerAutor = await library.search("", {}, { trim: sqlSichtbarkeitFuer(AUTOR) });
    expect(fuerAutor.map((k) => k.id)).toEqual([
      "a-intern",
      "c-fremd-vertraulich",
      "d-fremd-streng",
      "e-intern-zwei",
    ]);
  });

  it("ko.validate sieht alles Lebende — und den Papierkorb trotzdem nicht", async () => {
    const { library } = await suchdienst();
    const fuerController = await library.search("", {}, { trim: sqlSichtbarkeitFuer(CONTROLLER) });
    expect(fuerController.map((k) => k.id)).not.toContain("b-getrasht");
    expect(fuerController).toHaveLength(4);
  });

  it("OHNE Trim bleibt das heutige Verhalten unverändert (Altvertrag, G-SHADOW)", async () => {
    const { library, ko: spy } = await suchdienst();
    const treffer = await library.search("", {});
    expect(spy.gesehen[0]).toBeUndefined();
    // Der Papierkorb fällt weiterhin im Dienst, die Sichtbarkeit weiterhin an der Route.
    expect(treffer.map((k) => k.id)).toEqual([
      "a-intern",
      "c-fremd-vertraulich",
      "d-fremd-streng",
      "e-intern-zwei",
    ]);
  });
});

// ------------------------------------------------------------------------------------------------
// 4 · EINE SEITE IST VOLL — KEIN PLATZ WIRD VON EINEM UNSICHTBAREN EINTRAG VERBRAUCHT (Gate 3/4).
// ------------------------------------------------------------------------------------------------

describe("BASIC 380 · getrashtes und unsichtbares Wissen beeinflusst weder Seite noch Folgetreffer", () => {
  it("ein Deckel auf die GETRIMMTE Menge liefert volle Seiten; ein Deckel davor täte es nicht", async () => {
    const { library } = await suchdienst();
    const getrimmt = await library.search("", {}, { trim: sqlSichtbarkeitFuer(FREMDER) });
    const ungetrimmt = await library.search("", {});

    // Der Deckel ist hier TESTMITTEL, kein Produktverhalten (BASIC 380 §Verboten: keine Pagination).
    const seiteEins = getrimmt.slice(0, 2);
    expect(seiteEins).toHaveLength(2);
    expect(seiteEins.every((k) => !k.deletedAt && darfSehen(FREMDER, k))).toBe(true);

    // Die Gegenprobe, ohne die dieser Test nichts belegt: derselbe Deckel VOR dem Trim wäre kurz.
    const falschHerum = ungetrimmt.slice(0, 2).filter((k) => darfSehen(FREMDER, k));
    expect(falschHerum.length).toBeLessThan(seiteEins.length);
  });

  it("die Zahl der Treffer verrät nichts über Objekte, die der Betrachter nicht sehen darf", async () => {
    const { library } = await suchdienst();
    const fremd = await library.search("", {}, { trim: sqlSichtbarkeitFuer(FREMDER) });
    // Zwei vertrauliche Fremdobjekte und ein getrashtes liegen im Bestand — die Zahl kennt sie nicht.
    expect(fremd).toHaveLength(2);
  });
});
