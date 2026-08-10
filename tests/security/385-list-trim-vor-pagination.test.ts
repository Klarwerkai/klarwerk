// ================================================================================================
// AUFTRAG-BASIC-391 (Plan aus BASIC 385) — AUCH DIE NORMALE KO-LISTE TRIMMT IN SQL, VOR DEM DECKEL.
// ================================================================================================
//
// DER BEFUND, den BASIC 380 als `R-3` benannt und BASIC 385 vermessen hat: `GET /api/kos` filtert
// Papierkorb und Sichtbarkeit weiterhin OBERHALB von SQL —
//
//   1. `KoService.list()` wirft getrashte Zeilen im Anwendungsspeicher weg,
//   2. `sichtbareFuer(user, …)` filtert danach an der Route.
//
// Solange beide dort stehen, wäre jede spätere Zählung oder Paginierung falsch gebaut: ein `LIMIT`
// liefert Zeilen, von denen danach noch welche abgezogen werden — kurze Seiten, überspringende
// Cursor, und jeder Zähler wäre eine Existenzauskunft (REF-0001 :48/:49).
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT (Auftrag 391 §Verboten): kein Cursor, kein Count, keine
// Facetten, keine Migration. Deckel und Zähler in diesem Test sind TESTMITTEL — sie belegen die
// Wirkung des Prädikats vor einem Deckel, ohne dem Produkt einen zu geben.
//
// UND DER SCHARFE FALL, den BASIC 385 §2 gefunden hat: `repo.list` hat sieben Aufrufer, VIER davon
// brauchen die getrashten Zeilen zwingend (Papierkorb, Import-Anker, Sweep, Quellanker). Der Trim
// darf deshalb NIE ein Default sein — nur ein ausdrücklich übergebener Parameter. Das prüft
// `T-385-6` unten, und es ist der tragende Fall dieser Datei.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  InMemoryKoRepo,
  type KnowledgeObject,
  KoService,
  PgKoRepo,
} from "../../services/knowledge-object";

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

// ------------------------------------------------------------------------------------------------
// 1 · T-385-1 bis T-385-3 — DAS PRÄDIKAT STEHT IN DER WHERE-KLAUSEL DERSELBEN ANWEISUNG.
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

describe("BASIC 391 · PgKoRepo.list nimmt den injizierten Trim in das SQL auf", () => {
  it("T-385-1: das Prädikat steht in der WHERE-Klausel; die Fachfilter behalten ihre Platzhalter", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool (nur `query` wird benutzt).
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.list(
      { type: "best_practice", status: "validiert" },
      sqlSichtbarkeitFuer(CONTROLLER),
    );
    const abfrage = abfragen[0];
    expect(abfrage).toBeDefined();
    expect(abfrage?.text).toMatch(/\bWHERE\b/i);
    expect(abfrage?.text).toContain("type=$1");
    expect(abfrage?.text).toContain("status=$2");
    expect(abfrage?.text).toContain("deleted_at_key");
    expect(abfrage?.text).toContain("confidentiality_key");
    expect(abfrage?.text).toContain("author_key");
    expect(abfrage?.params).toEqual(["best_practice", "validiert", true, "u-cara"]);
  });

  it("T-385-1: der Trim steht VOR einem etwaigen Deckel — er ist Teil der WHERE-Klausel", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.list({}, sqlSichtbarkeitFuer(FREMDER));
    const text = abfragen[0]?.text ?? "";
    const wo = text.search(/\bWHERE\b/i);
    const trimStelle = text.indexOf("deleted_at_key");
    const deckel = text.search(/\bLIMIT\b/i);
    expect(wo).toBeGreaterThanOrEqual(0);
    expect(trimStelle).toBeGreaterThan(wo);
    // Heute trägt dieser Weg keinen Deckel. Trägt er je einen, steht er hinter dem Trim.
    expect(deckel === -1 || deckel > trimStelle).toBe(true);
  });

  it("T-385-2: `list` bleibt bei `SELECT data FROM kos` — die Body-Projektion gilt NUR dem Suchpfad", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.list({}, sqlSichtbarkeitFuer(FREMDER));
    expect(abfragen[0]?.text).toContain("SELECT data FROM kos");
    expect(abfragen[0]?.text).not.toContain("- 'bodyHtml'");
  });

  it("T-385-3: OHNE Trim ist die Abfrage zeichengleich der heutigen (Altvertrag)", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.list({});
    expect(abfragen[0]?.text).toBe("SELECT data FROM kos");
    expect(abfragen[0]?.params).toEqual([]);
  });

  it("das Prädikat liest die LEBENDE kos-Zeile — nie den classification_snapshot (G-TRIM-LIVE)", async () => {
    const abfragen: AufgezeichneteAbfrage[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test-Doppel für pg.Pool.
    const repo = new PgKoRepo(fakePool(abfragen) as any);
    await repo.list({}, sqlSichtbarkeitFuer(FREMDER));
    const text = abfragen[0]?.text ?? "";
    // Der Listenweg joint die Projektion gar nicht — der Beleg ist strukturell.
    expect(text).not.toContain("classification_snapshot");
    expect(text).not.toContain("ko_search_projection");
    expect(text).not.toMatch(/\bJOIN\b/i);
  });
});

// ------------------------------------------------------------------------------------------------
// 2 · T-385-4 / T-385-5 — PAPIERKORB, ROLLEN, AUTOR, VERTRAULICHKEIT, UNBEKANNTE STUFE.
// ------------------------------------------------------------------------------------------------

// Der Kreuzbestand: sechs Stufen (inkl. UNBEKANNT und null) × drei Autoren × lebend/getrasht.
const STUFEN = [
  undefined,
  "intern",
  "vertraulich",
  "streng_vertraulich",
  "geheim", // ungültig → normalizeConfidentiality legt auf 'intern' aus (sichtbarkeit.ts:39-43)
  null,
] as const;
const AUTOREN = ["u-anna", "u-bert", ""] as const;

function kreuzbestand(): KnowledgeObject[] {
  const out: KnowledgeObject[] = [];
  for (const [si, stufe] of STUFEN.entries()) {
    for (const [ai, autor] of AUTOREN.entries()) {
      for (const getrasht of [false, true]) {
        out.push(
          ko({
            id: `k-${si}-${ai}-${getrasht ? "trash" : "live"}`,
            author: autor,
            originalAuthor: autor,
            ...(stufe === undefined ? {} : { confidentiality: stufe as never }),
            ...(getrasht ? { deletedAt: "2026-07-02T10:00:00.000Z" } : {}),
          }),
        );
      }
    }
  }
  return out;
}

async function dienstMitKreuzbestand(): Promise<KoService> {
  const repo = new InMemoryKoRepo();
  for (const k of kreuzbestand()) {
    await repo.insert(k);
  }
  return new KoService({ repo });
}

describe("BASIC 391 · die Liste trimmt die GRUNDMENGE, nicht das Ergebnis", () => {
  it("T-385-4: ein getrashtes KO fehlt — und der Trim selbst schließt es aus, nicht erst Node", async () => {
    const ko385 = await dienstMitKreuzbestand();
    const trim = sqlSichtbarkeitFuer(CONTROLLER);
    const treffer = await ko385.list({}, trim);
    expect(treffer.some((k) => k.id.endsWith("trash"))).toBe(false);
    // Der Trim allein — ohne den nachgelagerten Node-Filter — verwirft sie bereits.
    for (const k of kreuzbestand().filter((x) => x.deletedAt)) {
      expect(trim.trifftZu(k)).toBe(false);
    }
  });

  it("T-385-5: über alle Rollen, Autoren und Stufen ist die getrimmte Menge zeichengleich der Regel", async () => {
    const ko385 = await dienstMitKreuzbestand();
    const alle = kreuzbestand();
    let geprueft = 0;
    for (const role of ["viewer", "experte", "controller", "admin"] as const) {
      for (const id of ["u-anna", "u-bert"]) {
        const user: SessionUser = { id, role };
        const ausTrim = (await ko385.list({}, sqlSichtbarkeitFuer(user))).map((k) => k.id).sort();
        const ausRegel = alle
          .filter((k) => !k.deletedAt && darfSehen(user, k))
          .map((k) => k.id)
          .sort();
        expect(ausTrim, `Rolle ${role}, Betrachter ${id}`).toEqual(ausRegel);
        // Gegenprobe: weder leer noch der ganze Bestand — sonst wäre die Gleichheit trivial.
        expect(ausTrim.length).toBeGreaterThan(0);
        expect(ausTrim.length).toBeLessThan(alle.length);
        geprueft += 1;
      }
    }
    expect(geprueft).toBe(8);
  });

  it("T-385-5: eine UNBEKANNTE Stufe gilt als intern und bleibt sichtbar — in beiden Formen gleich", async () => {
    const ko385 = await dienstMitKreuzbestand();
    const sichtbar = (await ko385.list({}, sqlSichtbarkeitFuer(FREMDER))).map((k) => k.id);
    // Index 4 = 'geheim' (ungültig), Index 5 = null. Beide sind für JEDEN sichtbar.
    expect(sichtbar).toContain("k-4-0-live");
    expect(sichtbar).toContain("k-5-0-live");
    // Und die echten Stufen sind es für den Fremden weiterhin NICHT.
    expect(sichtbar).not.toContain("k-2-0-live");
    expect(sichtbar).not.toContain("k-3-0-live");
  });

  it("T-385-5: ein leerer Autor ist keine Autorschaft — auch nicht über den Listenweg", async () => {
    const ko385 = await dienstMitKreuzbestand();
    const leer: SessionUser = { id: "", role: "experte" };
    const sichtbar = (await ko385.list({}, sqlSichtbarkeitFuer(leer))).map((k) => k.id);
    // Autor-Index 2 = "" mit vertraulicher Stufe darf NICHT durchkommen.
    expect(sichtbar).not.toContain("k-2-2-live");
    expect(sichtbar).not.toContain("k-3-2-live");
  });

  it("T-385-10: `sichtbareFuer` ist nach dem Trim ein No-op — dieselbe Menge (G-SHADOW)", async () => {
    const ko385 = await dienstMitKreuzbestand();
    for (const user of [AUTOR, FREMDER, CONTROLLER]) {
      const getrimmt = await ko385.list({}, sqlSichtbarkeitFuer(user));
      const nochmalGefiltert = getrimmt.filter((k) => darfSehen(user, k));
      expect(nochmalGefiltert.map((k) => k.id)).toEqual(getrimmt.map((k) => k.id));
    }
  });

  it("ein Deckel auf die GETRIMMTE Menge liefert volle Seiten; derselbe Deckel davor nicht", async () => {
    const ko385 = await dienstMitKreuzbestand();
    const getrimmt = await ko385.list({}, sqlSichtbarkeitFuer(FREMDER));
    // Deckel als TESTMITTEL — das Produkt bekommt hier keinen (Auftrag 391 §Verboten).
    const seite = getrimmt.slice(0, 4);
    expect(seite).toHaveLength(4);
    expect(seite.every((k) => !k.deletedAt && darfSehen(FREMDER, k))).toBe(true);

    // DIE GEGENPROBE, ohne die dieser Fall nichts belegte: derselbe Deckel VOR dem Prädikat, also
    // auf dem ROHEN Bestand — genau das, was die Datenbank ohne WHERE liefern würde. Aus vier
    // Zeilen bleiben weniger als vier übrig; die Seite wäre kurz und ein Cursor übersprungen.
    const falschHerum = kreuzbestand()
      .slice(0, 4)
      .filter((k) => !k.deletedAt && darfSehen(FREMDER, k));
    expect(falschHerum.length).toBeLessThan(seite.length);
  });
});

// ------------------------------------------------------------------------------------------------
// 3 · T-385-6 — DER TRAGENDE FALL: DER TRIM IST NIE EIN DEFAULT.
// ------------------------------------------------------------------------------------------------
//
// `repo.list` hat sieben Aufrufer, und vier brauchen die getrashten Zeilen ZWINGEND. Würde der Trim
// am Repository oder am Service zum Default, bräche das in einem Zug den Papierkorb, den
// Import-Anker (Doppel-KO beim Retry) und den Sweep (nichts würde je endgelöscht).

describe("BASIC 391 · T-385-6: die Sonderpfade bleiben ungetrimmt", () => {
  // Fester Zeitpunkt: die Papierkorbfrist des getrashten KO ist damit nachweislich ABGELAUFEN —
  // nur so ist „der Sweep sieht die Zeile" überhaupt an einer Zahl ablesbar.
  const JETZT = Date.parse("2026-08-05T00:00:00.000Z");

  async function dienstMitGetrashtem(): Promise<KoService> {
    const repo = new InMemoryKoRepo();
    await repo.insert(
      ko({
        id: "k-getrasht",
        importCandidateId: "kandidat-1",
        deletedAt: "2026-07-02T10:00:00.000Z",
        deletedBy: "u-admin",
        sources: [
          {
            id: "q-1",
            label: "Confluence",
            url: null,
            excerpt: null,
            kind: "external",
            peerValidated: false,
            provider: "confluence",
            externalId: "seite-42",
            at: "2026-07-01T10:00:00.000Z",
          },
        ] as never,
      }),
    );
    await repo.insert(ko({ id: "k-lebend" }));
    return new KoService({ repo, now: () => JETZT });
  }

  it("`trashed()` sieht das getrashte KO weiterhin (GET /api/kos/trash bleibt heil)", async () => {
    const svc = await dienstMitGetrashtem();
    expect((await svc.trashed()).map((t) => t.id)).toEqual(["k-getrasht"]);
  });

  it("`findByImportCandidateId` findet auch im Papierkorb — sonst entstünde ein Doppel-KO", async () => {
    const svc = await dienstMitGetrashtem();
    expect((await svc.findByImportCandidateId("kandidat-1"))?.id).toBe("k-getrasht");
  });

  it("`trashedSourceAnchors` sieht die Quellanker des getrashten KO", async () => {
    const svc = await dienstMitGetrashtem();
    await expect(svc.trashedSourceAnchors()).resolves.toEqual([
      { koId: "k-getrasht", provider: "confluence", externalId: "seite-42" },
    ]);
  });

  it("`runTrashSweep` sieht die abgelaufene Zeile und löscht sie endgültig — mit Default-Trim wäre es 0", async () => {
    const svc = await dienstMitGetrashtem();
    // Die Zahl IST der Beleg: wäre der Trim ein Default am Repository, sähe der Sweep gar nichts
    // mehr und meldete 0 — der Papierkorb liefe dann für immer voll.
    await expect(svc.runTrashSweep("system")).resolves.toBe(1);
  });

  it("`KoService.list()` OHNE Trim verhält sich zeichengleich wie heute", async () => {
    const svc = await dienstMitGetrashtem();
    expect((await svc.list()).map((k) => k.id)).toEqual(["k-lebend"]);
  });
});
