// ================================================================================================
// AUFNAHME 20260922 · gesamt-suchkandidaten-menge — DER KANDIDATENDECKEL WÄCHST MIT DEM BESTAND.
// ================================================================================================
//
// DIE ORIGINALPUNKTE, die diese Datei belegt:
//   R-0316  Wie viele Kandidaten Klara heranzieht, richtet sich nach der Bestandsgröße.
//   R-0430  Die Vorauswahl bleibt eine begrenzte Trefferliste an der Datenquelle (kein Volllauf).
//   S7      Eine Titelquelle mit Trust 83 geht gegen 60 Körpertreffer mit Trust 99 nicht verloren.
// R-0344 (gesamter Bestand als Modellkontext) ist GESTRICHEN und wird hier nicht gebaut.
//
// GEMESSEN WIRD AM ECHTEN DIENST. `KoService.findCandidates` läuft über die echte In-Memory-
// Projektion. Ersetzt ist genau EINE Zahl: die Bestandszählung (`metadata.count()`), damit ein
// Bestand von 10.000 oder 1.000.000 Objekten nicht angelegt werden muss. Alles andere — Anlage,
// Validierung, Suche, Güteauswahl, Deckel — ist der Produktweg. Klaras Vereinigung (K-4) wird an
// `AskService` mit einer Quelle gemessen, die den Deckel mit derselben Produktfunktion bildet.
//
// NICHT GEMESSEN: der PostgreSQL-Adapter mit echtem SQL-Plan und ein echter, gewachsener
// Kundenbestand. Beides steht in dieser Sandkiste nicht zur Verfügung.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { InMemoryGapRepo } from "../../services/ask/src/repo";
import { AskService } from "../../services/ask/src/service";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  InMemoryKoMetadataProjectionRepo,
  InMemoryKoRepo,
  InMemoryKoSearchProjectionRepo,
  InMemoryKoVersionRepo,
  type KnowledgeObject,
  type KoCandidateQuery,
  KoService,
} from "../../services/knowledge-object";
import {
  KANDIDATENDECKEL_BESTAND_JE_PLATZ,
  KANDIDATENDECKEL_HOECHSTFAKTOR,
  bestandsgerechterKandidatendeckel,
} from "../../services/knowledge-object/src/search-projection";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import { Reasoner } from "../../services/reasoner";

/** Klaras Grunddeckel je Fragebegriff (`ASK_PREFILTER_TERM_LIMIT`, services/ask/src/service.ts). */
const KLARA_GRUNDDECKEL = 50;

// ------------------------------------------------------------------------------------------------
// K-1 — DIE REGEL, rein
// ------------------------------------------------------------------------------------------------

describe("K-1 · bestandsgerechterKandidatendeckel", () => {
  it("bleibt bis 5.000 Objekte beim Grunddeckel und wächst darüber mit 1 % des Bestands", () => {
    expect(KANDIDATENDECKEL_BESTAND_JE_PLATZ).toBe(100);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 0)).toBe(50);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 122)).toBe(50);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 5_000)).toBe(50);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 5_001)).toBe(51);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 10_000)).toBe(100);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 30_000)).toBe(300);
  });

  it("R-0430: bleibt begrenzt — nie mehr als das Zehnfache des Grunddeckels, nie unter ihm", () => {
    expect(KANDIDATENDECKEL_HOECHSTFAKTOR).toBe(10);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 50_000)).toBe(500);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, 1_000_000)).toBe(500);
    expect(bestandsgerechterKandidatendeckel(KLARA_GRUNDDECKEL, Number.NaN)).toBe(50);
    expect(bestandsgerechterKandidatendeckel(20, 1_000)).toBe(20);
    expect(bestandsgerechterKandidatendeckel(0, 1_000_000)).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// DER BESTAND für K-2/K-3 — echter Dienst, nur die Zählung ist einstellbar
// ------------------------------------------------------------------------------------------------

/** Die echte Metadatenprojektion; nur `count()` kann einen größeren Bestand behaupten. */
class EinstellbareZaehlung extends InMemoryKoMetadataProjectionRepo {
  behauptet: number | undefined;
  override count(): Promise<number> {
    return this.behauptet === undefined ? super.count() : Promise.resolve(this.behauptet);
  }
}

const VORLAGE: Omit<CreateKoInput, "title" | "statement"> = {
  type: "best_practice",
  category: "Handbuch",
  author: "anna",
};

/** R-0316: 60 gleich starke TITELtreffer mit Trust 99 und die gesuchte Quelle mit Trust 83. */
const TITELBEGRIFF = "urlaubsregelung";
/** S7: 60 Körpertreffer mit Trust 99 und die Titelquelle mit Trust 83. */
const KOERPERBEGRIFF = "betriebsvereinbarung";
const KONKURRENTEN = 60;

interface Bestand {
  ko: KoService;
  zaehlung: EinstellbareZaehlung;
  titelZiel: string;
  koerperZiel: string;
  koerper: string[];
}

async function bestand(): Promise<Bestand> {
  const repo = new InMemoryKoRepo();
  const zaehlung = new EinstellbareZaehlung();
  const ko = new KoService({
    repo,
    versions: new InMemoryKoVersionRepo(),
    searchProjections: new InMemoryKoSearchProjectionRepo(repo, zaehlung),
  });
  const { readiness } = await ko.activateSearchProjectionV2();
  expect(readiness.alle, readiness.befunde.join("; ")).toBe(true);

  const anlegen = async (title: string, statement: string, trust: number, bodyHtml?: string) => {
    const eintrag = await ko.create({
      ...VORLAGE,
      title,
      statement,
      ...(bodyHtml ? { bodyHtml } : {}),
    });
    await ko.setValidationState(eintrag.id, { trust, status: "validiert" });
    return eintrag.id;
  };

  for (let i = 0; i < KONKURRENTEN; i += 1) {
    const nr = String(i).padStart(2, "0");
    await anlegen(`Urlaubsregelung Standort ${nr}`, `Regel ${nr}.`, 99);
  }
  const titelZiel = await anlegen("Urlaubsregelung des Hauses", "30 Tage Jahresurlaub.", 83);

  const koerper: string[] = [];
  for (let i = 0; i < KONKURRENTEN; i += 1) {
    const nr = String(i).padStart(2, "0");
    koerper.push(
      await anlegen(
        `Protokoll ${nr}`,
        `Beschluss ${nr}.`,
        99,
        `<p>Die Betriebsvereinbarung wurde beilaeufig erwaehnt (${nr}).</p>`,
      ),
    );
  }
  const koerperZiel = await anlegen("Betriebsvereinbarung Homeoffice", "Gilt ab Januar.", 83);

  return { ko, zaehlung, titelZiel, koerperZiel, koerper };
}

let b: Bestand;

beforeAll(async () => {
  b = await bestand();
}, 180_000);

async function kandidaten(query: KoCandidateQuery, behauptet?: number): Promise<string[]> {
  b.zaehlung.behauptet = behauptet;
  try {
    return (await b.ko.findCandidates(query)).map((k) => k.id);
  } finally {
    b.zaehlung.behauptet = undefined;
  }
}

// ------------------------------------------------------------------------------------------------
// K-2 — R-0316 / R-0430 am echten Kandidatenweg
// ------------------------------------------------------------------------------------------------

describe("K-2 · findCandidates: die Kandidatenzahl folgt dem Bestand", () => {
  it("Kalibrierung: mit festem Deckel 50 fällt die Titelquelle (Trust 83) hinter 60 gleich starken Titeltreffern weg", async () => {
    const ids = await kandidaten({ terms: [TITELBEGRIFF], limit: KLARA_GRUNDDECKEL }, 10_000);
    expect(ids).toHaveLength(KLARA_GRUNDDECKEL);
    expect(ids).not.toContain(b.titelZiel);
  });

  it("kleiner Bestand (122 Objekte, echt gezählt): der Deckel bleibt 50 — nichts verschiebt sich", async () => {
    const ids = await kandidaten({
      terms: [TITELBEGRIFF],
      limit: KLARA_GRUNDDECKEL,
      deckelWaechstMitBestand: true,
    });
    expect(ids).toHaveLength(KLARA_GRUNDDECKEL);
    expect(ids).not.toContain(b.titelZiel);
  });

  it("gewachsener Bestand (10.000): der Deckel steht bei 100 und die Titelquelle ist Kandidat", async () => {
    const ids = await kandidaten(
      { terms: [TITELBEGRIFF], limit: KLARA_GRUNDDECKEL, deckelWaechstMitBestand: true },
      10_000,
    );
    expect(ids).toHaveLength(KONKURRENTEN + 1);
    expect(ids).toContain(b.titelZiel);
  });

  it("R-0430: die Datenquelle bekommt auch bei 1.000.000 Objekten ein hartes Limit (500)", async () => {
    const spion = vi.spyOn(b.ko, "findSearchHits");
    try {
      await kandidaten(
        { terms: [TITELBEGRIFF], limit: KLARA_GRUNDDECKEL, deckelWaechstMitBestand: true },
        1_000_000,
      );
      await kandidaten({ terms: [TITELBEGRIFF], limit: KLARA_GRUNDDECKEL }, 1_000_000);
      expect(spion.mock.calls.map(([query]) => query.limit)).toEqual([500, KLARA_GRUNDDECKEL]);
    } finally {
      spion.mockRestore();
    }
  });

  it("ohne Anforderung bleibt der Deckel des Aufrufers (Textprüfung/Wissensprüfung melden ihn als Prüfumfang)", async () => {
    const ids = await kandidaten({ terms: [TITELBEGRIFF], limit: 40 }, 1_000_000);
    expect(ids).toHaveLength(40);
  });
});

// ------------------------------------------------------------------------------------------------
// K-3 — S7: die Titelquelle gegen 60 Körpertreffer mit höherem Trust
// ------------------------------------------------------------------------------------------------

describe("K-3 · S7 — Trust 83 gegen 60 × 99 Körpertreffer", () => {
  it("die Titelquelle steht in Klaras Kandidatenmenge, obwohl 60 Körpertreffer mehr Trust haben", async () => {
    const ids = await kandidaten({
      terms: [KOERPERBEGRIFF],
      limit: KLARA_GRUNDDECKEL,
      deckelWaechstMitBestand: true,
    });
    expect(ids).toHaveLength(KLARA_GRUNDDECKEL);
    expect(ids).toContain(b.koerperZiel);
    // Die Ausgabeordnung bleibt validiert ↓, Trust ↓: die Quelle kommt herein, nicht nach vorn.
    expect(ids.at(-1)).toBe(b.koerperZiel);
  });

  it("und im gewachsenen Bestand stehen alle 61 drin — kein Körpertreffer muss dafür weichen", async () => {
    const ids = await kandidaten(
      { terms: [KOERPERBEGRIFF], limit: KLARA_GRUNDDECKEL, deckelWaechstMitBestand: true },
      10_000,
    );
    expect([...ids].sort()).toEqual([...b.koerper, b.koerperZiel].sort());
  });
});

// ------------------------------------------------------------------------------------------------
// K-4 — Klaras Weg: die Anforderung wird gestellt, und die Vereinigung kürzt eine Einzelliste nicht
// ------------------------------------------------------------------------------------------------

function ko(id: string, trust: number): KnowledgeObject {
  return {
    id,
    title: `Urlaubsregelung ${id}`,
    statement: "Urlaubsregelung.",
    status: "validiert",
    trust,
  } as unknown as KnowledgeObject;
}

/**
 * Die Liste, die der echte Kandidatenweg bei Bestand `bestand` liefert: Ausgabeordnung
 * validiert ↓, Trust ↓ — die Titelquelle mit Trust 83 steht deshalb ganz hinten. Den Deckel bildet
 * dieselbe Produktfunktion wie `KoService.findCandidates`.
 */
function quelle(bestand: number) {
  const aufrufe: KoCandidateQuery[] = [];
  const weitergereicht = new Set<string>();
  const liste = [
    ...Array.from({ length: 299 }, (_v, i) => ko(`stoerer-${String(i).padStart(3, "0")}`, 99)),
    ko("ziel", 83),
  ];
  const koService = {
    findCandidates(query: KoCandidateQuery): Promise<KnowledgeObject[]> {
      aufrufe.push(query);
      const deckel = query.deckelWaechstMitBestand
        ? bestandsgerechterKandidatendeckel(query.limit, bestand)
        : query.limit;
      return Promise.resolve(liste.slice(0, deckel));
    },
    list(): Promise<KnowledgeObject[]> {
      throw new Error("Klara darf den Gesamtbestand nicht laden (koService.list)");
    },
    // Jeder Kandidat, den die Vorauswahl weiterreicht, wird hier genau einmal nachgeschlagen.
    searchProjectionOf(id: string): Promise<undefined> {
      weitergereicht.add(id);
      return Promise.resolve(undefined);
    },
  } as unknown as KoService;
  const ask = new AskService({
    reasoner: new Reasoner(),
    koService,
    gaps: new InMemoryGapRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  return { ask, aufrufe, weitergereicht };
}

describe("K-4 · AskService: Klara fordert den wachsenden Deckel an", () => {
  it("jede Quellabfrage trägt Grunddeckel 50 und die Anforderung", async () => {
    const { ask, aufrufe } = quelle(1_000);
    await ask.ask("Wo steht die Urlaubsregelung?");
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const aufruf of aufrufe) {
      expect(aufruf.limit).toBe(KLARA_GRUNDDECKEL);
      expect(aufruf.deckelWaechstMitBestand).toBe(true);
    }
  });

  it("kleiner Bestand: Klara reicht 50 Kandidaten weiter, die Titelquelle nicht", async () => {
    const { ask, weitergereicht } = quelle(1_000);
    await ask.ask("Wo steht die Urlaubsregelung?");
    expect(weitergereicht.size).toBe(KLARA_GRUNDDECKEL);
    expect(weitergereicht.has("ziel")).toBe(false);
  });

  it("Bestand 30.000: die volle Einzelliste (300) wird nicht auf 200 gekürzt — die Titelquelle bleibt", async () => {
    const { ask, weitergereicht } = quelle(30_000);
    await ask.ask("Wo steht die Urlaubsregelung?");
    expect(weitergereicht.size).toBe(300);
    expect(weitergereicht.has("ziel")).toBe(true);
  });
});
