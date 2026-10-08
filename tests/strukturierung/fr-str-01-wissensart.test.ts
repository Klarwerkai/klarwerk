// FR-STR-01 / R-0315 (Auftrag aufnahme:20260922:gesamt-strukturierung): der Reasoner strukturiert
// Roh-Input zu einem KO mit Titel als Aussage, Aussage, Bedingungen, Maßnahmen, Tags, Konfidenz UND
// Wissensart. Bis zu diesem Auftrag fehlte die Wissensart im Vertrag (Prompt), im Parser und im
// Ergebnistyp. Hier gepinnt: Vertrag, Rücklesen ohne Raten, Gleichlauf der Werteliste mit dem
// KO-Modell, ehrlicher Fallback und die Vorbelegung in der Erfassung ohne Überschreiben.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  structureCardKnowledgeType,
  withDecidedKnowledgeType,
} from "../../apps/web/src/lib/bodyAiAssist";
import { adoptProposedKnowledgeType } from "../../apps/web/src/lib/draftForm";
import { KNOWLEDGE_TYPES } from "../../services/knowledge-object/src/types";
import { DeterministicProvider } from "../../services/reasoner/src/provider";
import { type ModelClient, ModelProvider } from "../../services/reasoner/src/provider-model";
import { STRUCTURE_KNOWLEDGE_TYPES } from "../../services/reasoner/src/types";

function capturingClient(reply: string): { client: ModelClient; systems: string[] } {
  const systems: string[] = [];
  return {
    systems,
    client: {
      name: "fake",
      complete: async (system) => {
        systems.push(system);
        return reply;
      },
    },
  };
}

const FULL_REPLY = JSON.stringify({
  title: "Dosierpumpe nach jedem Schichtwechsel kalibrieren",
  statement: "Die Dosierpumpe driftet nach dem Schichtwechsel und muss neu kalibriert werden.",
  conditions: ["Nach Schichtwechsel"],
  measures: ["Dosierwert prüfen", "Pumpe kalibrieren"],
  tags: ["Wartung", "Dosierung"],
  confidence: 0.7,
  knowledgeType: "best_practice",
});

describe("FR-STR-01: Strukturierungsergebnis enthält alle Felder einschließlich Wissensart", () => {
  it("der Modellvertrag verlangt die Wissensart mit den fünf gültigen Werten", async () => {
    for (const locale of ["de", "en"] as const) {
      const { client, systems } = capturingClient(FULL_REPLY);
      await new ModelProvider(client).structure("Rohtext.", locale);
      const system = systems[0] ?? "";
      for (const key of ["title", "statement", "conditions", "measures", "tags", "confidence"]) {
        expect(system).toContain(`"${key}"`);
      }
      expect(system).toContain('"knowledgeType"');
      for (const k of STRUCTURE_KNOWLEDGE_TYPES) {
        expect(system).toContain(`"${k}"`);
      }
    }
  });

  it("ein vollständiges Modellergebnis liefert alle sieben Felder", async () => {
    const res = await new ModelProvider(capturingClient(FULL_REPLY).client).structure("Rohtext.");
    expect(res).toMatchObject({
      title: "Dosierpumpe nach jedem Schichtwechsel kalibrieren",
      statement: "Die Dosierpumpe driftet nach dem Schichtwechsel und muss neu kalibriert werden.",
      conditions: ["Nach Schichtwechsel"],
      measures: ["Dosierwert prüfen", "Pumpe kalibrieren"],
      tags: ["Wartung", "Dosierung"],
      confidence: 0.7,
      knowledgeType: "best_practice",
      demo: false,
    });
  });

  it("jede der fünf Wissensarten wird übernommen", async () => {
    for (const k of STRUCTURE_KNOWLEDGE_TYPES) {
      const reply = JSON.stringify({ title: "T", statement: "S", knowledgeType: k });
      const res = await new ModelProvider(capturingClient(reply).client).structure("Rohtext.");
      expect(res.knowledgeType).toBe(k);
    }
  });

  it("eine unbekannte oder fehlende Wissensart wird nicht geraten (Feld fehlt)", async () => {
    for (const bad of ["Best Practice", "erfahrung", 3, null]) {
      const reply = JSON.stringify({ title: "T", statement: "S", knowledgeType: bad });
      const res = await new ModelProvider(capturingClient(reply).client).structure("Rohtext.");
      expect(res).not.toHaveProperty("knowledgeType");
    }
    const ohneClient = capturingClient(JSON.stringify({ title: "T", statement: "S" })).client;
    const ohne = await new ModelProvider(ohneClient).structure("Rohtext.");
    expect(ohne).not.toHaveProperty("knowledgeType");
  });

  it("die Werteliste des Reasoners ist dieselbe wie die des KO-Modells", () => {
    expect([...STRUCTURE_KNOWLEDGE_TYPES]).toEqual([...KNOWLEDGE_TYPES]);
  });

  it("der deterministische Fallback erfindet keine Wissensart (G-2)", async () => {
    const p = new DeterministicProvider();
    const normal = await p.structure("Ventil X schließt bei Überdruck nach drei Sekunden.");
    expect(normal.demo).toBe(true);
    expect(normal).not.toHaveProperty("knowledgeType");
    const leer = await p.structure("123");
    expect(leer).not.toHaveProperty("knowledgeType");
  });
});

describe("FR-STR-01 / R-0059: Vorbelegung der Wissensart — der Mensch entscheidet", () => {
  it("eine noch nicht entschiedene Auswahl übernimmt die vorgeschlagene Wissensart", () => {
    expect(adoptProposedKnowledgeType("best_practice", false, "negativwissen")).toBe(
      "negativwissen",
    );
  });

  it("eine entschiedene Auswahl wird nie überschrieben — auch nicht auf dem Standardwert", () => {
    // Bens Befund Nacharbeit 2: bewusst auf best_practice zurückgestellt oder so geladen.
    expect(adoptProposedKnowledgeType("best_practice", true, "negativwissen")).toBe(
      "best_practice",
    );
    expect(adoptProposedKnowledgeType("technik", true, "negativwissen")).toBe("technik");
  });

  it("ohne (gültigen) Vorschlag bleibt die aktuelle Auswahl", () => {
    expect(adoptProposedKnowledgeType("best_practice", false, undefined)).toBe("best_practice");
    const erfunden = "erfunden" as never;
    expect(adoptProposedKnowledgeType("best_practice", false, erfunden)).toBe("best_practice");
  });

  it("die Erfassung führt die Entscheidung ausdrücklich: Wahl, Laden, Verwerfen, Vorbelegung", () => {
    const src = readFileSync("apps/web/src/pages/Capture.tsx", "utf8");
    const start = src.indexOf("const structure = useMutation({");
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf("onError: fail", start));
    expect(block).toContain("const typeEntschieden = typeEntschiedenRef.current;");
    expect(block).toContain("adoptProposedKnowledgeType(prev, typeEntschieden, r.knowledgeType)");
    // Menschliche Wahl im Auswahlfeld markiert die Entscheidung.
    expect(src).toMatch(
      /typeEntschiedenRef\.current = true;\s*setType\(e\.target\.value as KnowledgeType\);/,
    );
    // Ein geladener Entwurf mit Wissensart gilt als entschieden.
    expect(src).toMatch(
      /setType\(p\.type \?\? "best_practice"\);[\s\S]{0,200}typeEntschiedenRef\.current = p\.type !== undefined && p\.type !== null;/,
    );
    // Verwerfen gibt die Entscheidung wieder frei.
    expect(src).toMatch(
      /setType\(CAPTURE_FIELD_DEFAULTS\.type\);\s*typeEntschiedenRef\.current = false;/,
    );
  });
});

describe("FR-STR-01 / R-0315: Wissensart im Ordnen-Hauptweg des Blatts", () => {
  it("die Karte startet mit der entschiedenen Wissensart, sonst mit dem KI-Vorschlag", () => {
    expect(structureCardKnowledgeType(undefined, { knowledgeType: "negativwissen" })).toBe(
      "negativwissen",
    );
    expect(structureCardKnowledgeType("lernkurve", { knowledgeType: "negativwissen" })).toBe(
      "lernkurve",
    );
    expect(structureCardKnowledgeType(undefined, {})).toBeUndefined();
  });

  it("nur eine entschiedene Wissensart reist in den Rumpf; ohne Entscheidung bleibt er unverändert", () => {
    const rumpf = { title: "T", statement: "S", type: "best_practice" as const };
    expect(withDecidedKnowledgeType(rumpf, "technik").type).toBe("technik");
    expect(withDecidedKnowledgeType(rumpf, undefined)).toBe(rumpf);
    const ohneTyp = { title: "T" };
    expect(withDecidedKnowledgeType(ohneTyp, undefined)).not.toHaveProperty("type");
  });
});
