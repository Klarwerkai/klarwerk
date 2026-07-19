import { describe, expect, it } from "vitest";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

// IC-3 (Import-Cockpit): der Reasoner leitet aus einem Freitext-Prompt Auswahl-Kriterien ab — NUR über
// ein echtes Modell; deterministisch/kein Modell → null (der Aufrufer nutzt dann leere Kriterien).

function client(out: string): ModelClient {
  return { name: "anthropic:test", complete: async () => out };
}

describe("IC-3: Reasoner.deriveImportCriteria", () => {
  it("Modell liefert JSON → geparstes Roh-Objekt", async () => {
    const r = new Reasoner(
      new ModelProvider(
        client('Hier ist die Auswahl: {"themes":["wartung"],"keywords":["e5"]} — fertig.'),
      ),
    );
    const raw = (await r.deriveImportCriteria("alles zu Wartung und E5")) as Record<
      string,
      unknown
    >;
    expect(raw).toEqual({ themes: ["wartung"], keywords: ["e5"] });
  });

  it("kein Modell (deterministischer Ersatz) → null", async () => {
    const r = new Reasoner(); // ohne Provider → nur Fallback
    expect(await r.deriveImportCriteria("egal")).toBeNull();
  });

  it("leerer Prompt → null (Modell wird nicht befragt)", async () => {
    const r = new Reasoner(new ModelProvider(client("{}")));
    expect(await r.deriveImportCriteria("   ")).toBeNull();
  });

  it("Modell ohne JSON → null (kein Raten)", async () => {
    const r = new Reasoner(new ModelProvider(client("Ich bin mir nicht sicher.")));
    expect(await r.deriveImportCriteria("x")).toBeNull();
  });

  it("Modellfehler → null (Fallback auf leere Kriterien im Aufrufer)", async () => {
    const boom: ModelClient = {
      name: "anthropic:test",
      complete: async () => {
        throw new Error("500");
      },
    };
    const r = new Reasoner(new ModelProvider(boom));
    expect(await r.deriveImportCriteria("x")).toBeNull();
  });
});
