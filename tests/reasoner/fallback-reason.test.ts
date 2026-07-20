// WP-D8 (Pedis Live-ROT B): das FALLBACK-Badge erschien ohne Erklärung — demo:true verschluckte, OB kein
// Modell konfiguriert war oder ein Modell scheiterte (Timeout/HTTP/Quota). Jetzt trägt das Structure-
// Ergebnis eine ehrliche, PII-freie Ursache (fallbackReason), die Route reicht sie unverändert durch und
// die Front-Door-UI erklärt das Badge. Getestet gegen den ECHTEN Reasoner (Provider-Kette, kein Mock der
// Entscheidungslogik).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import type { StructureResult } from "../../services/reasoner";

describe("WP-D8: fallbackReason am Structure-Ergebnis (echter Reasoner)", () => {
  it("kein Modell in der Kette → demo:true + fallbackReason no-model", async () => {
    const reasoner = new Reasoner(); // kein primärer Provider → nur deterministischer Fallback
    const result = await reasoner.structure("Ventil vor der Prüfung entlasten.");
    expect(result.demo).toBe(true);
    expect(result.fallbackReason).toBe("no-model");
  });

  it("Modell versucht, aber gescheitert → demo:true + fallbackReason model-error", async () => {
    const failingModel = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        throw new Error("Modell-API antwortete mit 500");
      },
    });
    const reasoner = new Reasoner(failingModel);
    const result = await reasoner.structure("Ventil vor der Prüfung entlasten.");
    expect(result.demo).toBe(true);
    expect(result.fallbackReason).toBe("model-error");
  });

  it("Erfolgspfad unverändert: Modell antwortet → demo:false, KEIN fallbackReason", async () => {
    const okModel = {
      name: "fake-model",
      isAvailable: () => true,
      structure: async (): Promise<StructureResult> => ({
        title: "Titel",
        statement: "Aussage",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 1,
        demo: false,
      }),
    } as unknown as ConstructorParameters<typeof Reasoner>[0];
    const reasoner = new Reasoner(okModel);
    const result = await reasoner.structure("Ventil vor der Prüfung entlasten.");
    expect(result.demo).toBe(false);
    expect(result.fallbackReason).toBeUndefined();
  });
});

describe("WP-D8: UI erklärt das FALLBACK-Badge ehrlich", () => {
  it("CaptureFrontDoor rendert die Ursachen-Erklärung; Keys existieren DE/EN/NL", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/CaptureFrontDoor.tsx"),
      "utf8",
    );
    expect(page).toContain("fd.fallbackNoModel");
    expect(page).toContain("fd.fallbackModelError");
    expect(page).toContain('fallbackReason === "model-error"');
    for (const lng of ["de", "en", "nl"]) {
      for (const key of ["fd.fallbackNoModel", "fd.fallbackModelError"]) {
        expect(
          String(i18n.getResource(lng, "translation", key)).length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("das Diagnose-Log ist PII-frei (nur die Ursache, nie der Eingabetext)", () => {
    const svc = readFileSync(resolve(process.cwd(), "services/reasoner/src/service.ts"), "utf8");
    expect(svc).toContain("Reasoner-Fallback (structure): reason=");
    // Das Log interpoliert AUSSCHLIESSLICH fallbackReason — kein rawText im Log-Template.
    expect(svc).not.toMatch(/Reasoner-Fallback[^\n]*rawText/);
  });
});
