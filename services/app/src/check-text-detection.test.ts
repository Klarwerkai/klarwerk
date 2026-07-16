import { describe, expect, it, vi } from "vitest";
import {
  ConflictService,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
} from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { type CheckTextDeps, checkText } from "./check-text-detection";

// SCRUM-491 Slice 4: der side-effect-freie Dry-Run-Kern (kein Endpunkt). Prüft transienten Freitext
// gegen den VALIDIERTEN Bestand, ohne irgendetwas anzulegen.
const TEXT_IDENTISCH = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
const TEXT_MITTEL = "Nach dem Anfahren zehn Sekunden warten.";

function ko(id: string, status: "validiert" | "offen", statement: string): KnowledgeObject {
  return {
    id,
    title: "Pumpe entlüften",
    statement,
    status,
    conditions: [],
    measures: [],
    tags: [],
    category: "Wartung",
    asset: null,
  } as unknown as KnowledgeObject;
}

// Minimaler KoService: der Orchestrator ruft nur list().
function koService(list: KnowledgeObject[]): KoService {
  return { list: async () => list } as unknown as KoService;
}

// Fake-Duplikat-Urteil (G-2: die Zitate stehen wörtlich in beiden Kerntexten → verifiziert).
const teilweiseVerdict: OverlapVerdict = {
  beziehung: "teilweise",
  aspects: [
    { beschreibung: "Titel deckt sich", zitatA: "Pumpe entlüften", zitatB: "Pumpe entlüften" },
  ],
  nurInA: "nur A",
  nurInB: "nur B",
  empfehlung: "zusammenfuehren_pruefen",
  confidence: 0.9,
  begruendung: "Teilweiser gemeinsamer Kern.",
};

describe("SCRUM-491: checkText — Dry-Run-Kern (kein Endpunkt, keine Persistenz)", () => {
  it("Pool ist validated-only: unvalidierte KOs sind ausgeschlossen; deterministischer Treffer, KEINE Persistenz", async () => {
    const overlapRepo = new InMemoryOverlapRepo();
    const deps: CheckTextDeps = {
      ko: koService([
        ko("v1", "validiert", TEXT_IDENTISCH),
        ko("u1", "offen", TEXT_IDENTISCH), // unvalidiert → darf NIE in den Pool
      ]),
      overlaps: new OverlapService({ repo: overlapRepo }),
    };

    const result = await checkText({ text: TEXT_IDENTISCH, title: "Pumpe entlüften" }, deps);

    // Nur das validierte KO taucht auf (deterministisch, ohne Modell).
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.koId).toBe("v1");
    expect(result.duplicates[0]?.method).toBe("deterministic");
    expect(result.duplicates.map((d) => d.koId)).not.toContain("u1");
    expect(result.conflicts).toHaveLength(0);
    // NULL Persistenz: kein Board-Eintrag angelegt.
    expect(await overlapRepo.all()).toHaveLength(0);
  });

  it("mit injiziertem Fake-judge → judge wird aufgerufen, Modell-Urteil im Ergebnis, weiterhin KEINE Persistenz", async () => {
    const overlapRepo = new InMemoryOverlapRepo();
    const judge = vi.fn(async (): Promise<OverlapVerdict | null> => teilweiseVerdict);
    const deps: CheckTextDeps = {
      ko: koService([ko("v2", "validiert", TEXT_MITTEL)]), // mittlere Deckung → Modell-Pfad
      overlaps: new OverlapService({ repo: overlapRepo }),
      duplicateJudge: judge,
    };

    const result = await checkText({ text: TEXT_IDENTISCH, title: "Pumpe entlüften" }, deps);

    expect(judge).toHaveBeenCalled();
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.koId).toBe("v2");
    expect(result.duplicates[0]?.method).toBe("model");
    expect(result.duplicates[0]?.confidence).toBe(0.9);
    expect(await overlapRepo.all()).toHaveLength(0);
  });

  it("leerer validierter Bestand → leeres Ergebnis, kein Fehler", async () => {
    const overlapRepo = new InMemoryOverlapRepo();
    const deps: CheckTextDeps = {
      ko: koService([ko("u1", "offen", TEXT_IDENTISCH)]), // nur unvalidiert
      overlaps: new OverlapService({ repo: overlapRepo }),
    };
    const result = await checkText({ text: TEXT_IDENTISCH }, deps);
    expect(result.duplicates).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(await overlapRepo.all()).toHaveLength(0);
  });
});

// Kanaltest, dass InMemoryConflictRepo importierbar/koexistent bleibt (Konflikt-Dry-Run klinkt
// symmetrisch ein; hier ohne conflictJudge → leer). Beweist die Struktur ohne Modell.
describe("SCRUM-491: checkText — Konflikt-Zweig klinkt symmetrisch ein (ohne judge leer)", () => {
  it("ohne conflictJudge bleibt conflicts leer, keine Persistenz", async () => {
    const conflictRepo = new InMemoryConflictRepo();
    const deps: CheckTextDeps = {
      ko: koService([ko("v1", "validiert", TEXT_IDENTISCH)]),
      overlaps: new OverlapService({ repo: new InMemoryOverlapRepo() }),
      conflicts: new ConflictService({ repo: conflictRepo }),
    };
    const result = await checkText({ text: TEXT_IDENTISCH, title: "Pumpe entlüften" }, deps);
    expect(result.conflicts).toHaveLength(0);
    expect(await conflictRepo.all()).toHaveLength(0);
  });
});
