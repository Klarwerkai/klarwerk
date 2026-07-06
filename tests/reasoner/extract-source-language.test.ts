import { describe, expect, it } from "vitest";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import { Reasoner } from "../../services/reasoner/src/service";

// SCRUM-451 (Pedi 05.07.): Ergebnis-Sprache der Dokument-Extraktion — Systemsprache (Default)
// oder Originalsprache des Dokuments. Getestet: der Prompt bekommt die Nicht-übersetzen-Regel
// NUR bei „source", in beiden UI-Sprachen; der Durchstich Reasoner→Provider; der ehrliche
// Fallback ohne Modell bleibt vom Schalter unberührt.
const DOC =
  "Maintenance report line L4.\n" +
  "The dosing value must be recalibrated after every shift change.\n" +
  "Valve X must be closed immediately above 6 bar.";

function capturingClient(): { client: ModelClient; systems: string[] } {
  const systems: string[] = [];
  const client: ModelClient = {
    name: "capture",
    complete: async (system: string) => {
      systems.push(system);
      return JSON.stringify({ points: [] });
    },
  };
  return { client, systems };
}

describe("SCRUM-451: Extraktion in Originalsprache des Dokuments", () => {
  it("DE-UI + Originalsprache → Prompt enthält die Nicht-übersetzen-Regel", async () => {
    const { client, systems } = capturingClient();
    await new ModelProvider(client).extract(DOC, "de", undefined, true);
    expect(systems.length).toBeGreaterThan(0);
    for (const s of systems) {
      expect(s).toContain("SPRACHE DES DOKUMENTS");
    }
  });

  it("EN-UI + Originalsprache → englische Fassung der Regel", async () => {
    const { client, systems } = capturingClient();
    await new ModelProvider(client).extract(DOC, "en", undefined, true);
    for (const s of systems) {
      expect(s).toContain("LANGUAGE OF THE DOCUMENT");
    }
  });

  it("Default (Systemsprache) → KEINE Sprachregel im Prompt (Verhalten unverändert)", async () => {
    const { client, systems } = capturingClient();
    await new ModelProvider(client).extract(DOC, "de");
    for (const s of systems) {
      expect(s).not.toContain("SPRACHE DES DOKUMENTS");
      expect(s).not.toContain("LANGUAGE OF THE DOCUMENT");
    }
  });

  it("Suchauftrag + Originalsprache kombinieren sich (beide Regeln im Prompt)", async () => {
    const { client, systems } = capturingClient();
    await new ModelProvider(client).extract(DOC, "de", "Grenzwerte", true);
    for (const s of systems) {
      expect(s).toContain("SPRACHE DES DOKUMENTS");
      expect(s).toContain("Grenzwerte");
    }
  });

  it("Reasoner reicht den Schalter bis zum Provider durch", async () => {
    const { client, systems } = capturingClient();
    await new Reasoner(new ModelProvider(client)).extract(DOC, "de", undefined, true);
    expect(systems.length).toBeGreaterThan(0);
    expect(systems[0]).toContain("SPRACHE DES DOKUMENTS");
  });

  it("ohne Modell bleibt der Fallback ehrlich: keine Punkte, note — Schalter ändert nichts", async () => {
    const res = await new Reasoner().extract(DOC, "de", undefined, true);
    expect(res.points).toHaveLength(0);
    expect(res.demo).toBe(true);
    expect(res.note).toBeTruthy();
  });
});
