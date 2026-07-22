import { describe, expect, it } from "vitest";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

// IC-3 (Import-Cockpit): der Reasoner leitet aus einem Freitext-Prompt Auswahl-Kriterien ab — NUR
// über ein echtes Modell. WP-SAMMEL20-FIX (bens Fix 1+2): das Ergebnis ist jetzt EHRLICH
// strukturiert (criteria + fallbackReason statt stillem null) und `confidential` nimmt die Cloud
// aus der Provider-Kette (derselbe zentrale providerChain-Weg wie alle anderen Tasks).

function client(out: string): ModelClient {
  return { name: "anthropic:test", complete: async () => out };
}

describe("IC-3: Reasoner.deriveImportCriteria (ehrlicher Ausfall-Vertrag)", () => {
  it("Modell liefert JSON → geparstes Roh-Objekt, kein fallbackReason", async () => {
    const r = new Reasoner(
      new ModelProvider(
        client('Hier ist die Auswahl: {"themes":["wartung"],"keywords":["e5"]} — fertig.'),
      ),
    );
    expect(await r.deriveImportCriteria("alles zu Wartung und E5", "de", false)).toEqual({
      criteria: { themes: ["wartung"], keywords: ["e5"] },
      fallbackReason: null,
    });
  });

  it("kein Modell (deterministischer Ersatz) → criteria null + fallbackReason no-model", async () => {
    const r = new Reasoner(); // ohne Provider → nur Fallback
    expect(await r.deriveImportCriteria("egal", "de", false)).toEqual({
      criteria: null,
      fallbackReason: "no-model",
    });
  });

  it("leerer Prompt → nichts gefragt (criteria null, KEIN Ausfall)", async () => {
    let calls = 0;
    const counting: ModelClient = {
      name: "anthropic:test",
      complete: async () => {
        calls += 1;
        return "{}";
      },
    };
    const r = new Reasoner(new ModelProvider(counting));
    expect(await r.deriveImportCriteria("   ", "de", false)).toEqual({
      criteria: null,
      fallbackReason: null,
    });
    expect(calls).toBe(0);
  });

  it("Modell ohne JSON → ehrlich model-error (kein Raten)", async () => {
    const r = new Reasoner(new ModelProvider(client("Ich bin mir nicht sicher.")));
    expect(await r.deriveImportCriteria("x", "de", false)).toEqual({
      criteria: null,
      fallbackReason: "model-error",
    });
  });

  it("Modellfehler → ehrlich model-error (statt still leer)", async () => {
    const boom: ModelClient = {
      name: "anthropic:test",
      complete: async () => {
        throw new Error("500");
      },
    };
    const r = new Reasoner(new ModelProvider(boom));
    expect(await r.deriveImportCriteria("x", "de", false)).toEqual({
      criteria: null,
      fallbackReason: "model-error",
    });
  });

  it("WP-SAMMEL20-FIX (bens Fix 1, P0): confidential=true nimmt die CLOUD aus der Kette — 0 Cloud-Calls, ehrlich no-model", async () => {
    let cloudCalls = 0;
    const spy: ModelClient = {
      name: "anthropic:test",
      complete: async () => {
        cloudCalls += 1;
        return '{"themes":["geheim"]}';
      },
    };
    const r = new Reasoner(new ModelProvider(spy));
    const result = await r.deriveImportCriteria("alles Vertrauliche", "de", true);
    expect(cloudCalls).toBe(0); // der Satz verlässt die Maschine NIE Richtung Cloud
    expect(result).toEqual({ criteria: null, fallbackReason: "no-model" });
    // Gegenprobe: ohne confidential darf dasselbe Modell arbeiten.
    const open = await r.deriveImportCriteria("alles Freigegebene", "de", false);
    expect(cloudCalls).toBe(1);
    expect(open.fallbackReason).toBeNull();
  });
});
