// WP-D8 (Pedis Live-ROT B): das FALLBACK-Badge erschien ohne Erklärung — demo:true verschluckte, OB kein
// Modell konfiguriert war oder ein Modell scheiterte (Timeout/HTTP/Quota). Jetzt trägt das Structure-
// Ergebnis eine ehrliche, PII-freie Ursache (fallbackReason), die Route reicht sie unverändert durch und
// die Front-Door-UI erklärt das Badge. Getestet gegen den ECHTEN Reasoner (Provider-Kette, kein Mock der
// Entscheidungslogik).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ModelHttpError,
  ModelProvider,
  ModelTimeoutError,
  Reasoner,
  classifyModelFailure,
} from "../../services/reasoner";
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

  // WP-D10 (Fix 3): Zeitüberschreitung ist eine EIGENE Ursache — vorher im Sammelbegriff
  // model-error verschluckt (die UI konnte „langsam" nicht von „kaputt" unterscheiden).
  it("Modell-Timeout → demo:true + fallbackReason model-timeout (nicht model-error)", async () => {
    const timeoutModel = new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        throw new ModelTimeoutError("Modell-API überschritt das Zeitlimit von 30000 ms", 30_000);
      },
    });
    const reasoner = new Reasoner(timeoutModel);
    const result = await reasoner.structure("Ventil vor der Prüfung entlasten.");
    expect(result.demo).toBe(true);
    expect(result.fallbackReason).toBe("model-timeout");
  });

  // WP-D10 (Fix 3): auch generische Fehler mit Timeout-Meldung (fremde/injizierte Clients) werden
  // korrekt als Timeout erkannt (Meldungs-Heuristik der Klassifizierung).
  it("generischer Error mit Zeitlimit-Meldung → ebenfalls model-timeout", async () => {
    const timeoutModel = new ModelProvider({
      name: "local:test",
      complete: async () => {
        throw new Error("Lokaler LLM überschritt das Zeitlimit von 15000 ms");
      },
    });
    const reasoner = new Reasoner(timeoutModel);
    const result = await reasoner.structure("Ventil vor der Prüfung entlasten.");
    expect(result.fallbackReason).toBe("model-timeout");
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

// WP-D10 (Fix 3): die Klassifizierung eines gescheiterten Modellaufrufs — typisierte Fehler zuerst,
// Meldungs-Heuristik als robustes Netz für generische Errors.
describe("WP-D10: classifyModelFailure (timeout|http|network|parse)", () => {
  it("typisierte Fehler → exakte Klasse (HTTP mit Status)", () => {
    expect(classifyModelFailure(new ModelTimeoutError("x", 30_000))).toEqual({
      failureClass: "timeout",
    });
    expect(classifyModelFailure(new ModelHttpError("x", 429))).toEqual({
      failureClass: "http",
      status: 429,
    });
  });

  it("generische Fehler → Meldungs-Heuristik; Unbekanntes ist network, kaputtes JSON ist parse", () => {
    expect(classifyModelFailure(new Error("Modell-API antwortete mit 500"))).toEqual({
      failureClass: "http",
      status: 500,
    });
    expect(
      classifyModelFailure(new Error("Modell-API überschritt das Zeitlimit von 30000 ms"))
        .failureClass,
    ).toBe("timeout");
    expect(classifyModelFailure(new TypeError("fetch failed")).failureClass).toBe("network");
    // JSON.parse einer kaputten Modellantwort wirft SyntaxError → parse.
    let parseErr: unknown = null;
    try {
      JSON.parse("{kaputt");
    } catch (e) {
      parseErr = e;
    }
    expect(classifyModelFailure(parseErr).failureClass).toBe("parse");
  });
});

// WP-D10 (Fix 3): das stderr-Diagnose-Log trägt jetzt Klasse/Status/elapsed/Modell-ID/Prompt-LÄNGE —
// alles PII-frei (nur Zahlen/Metadaten, NIE der Eingabetext).
describe("WP-D10: angereichertes, PII-freies Fallback-Log", () => {
  async function captureFallbackLog(complete: () => Promise<string>): Promise<string> {
    const failingModel = new ModelProvider({ name: "anthropic:test", complete });
    const reasoner = new Reasoner(failingModel);
    const lines: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      await reasoner.structure("Ventil vor der Prüfung entlasten — GEHEIMER ANLAGENTEXT.");
    } finally {
      process.stderr.write = originalWrite;
    }
    return lines.find((l) => l.includes("Reasoner-Fallback")) ?? "";
  }

  it("HTTP-Fehler: reason=model-error + class=http + Status + elapsed + Modell-ID + promptLength", async () => {
    const line = await captureFallbackLog(async () => {
      throw new ModelHttpError("Modell-API antwortete mit 529", 529);
    });
    expect(line).toContain("reason=model-error");
    expect(line).toContain("class=http");
    expect(line).toContain("status=529");
    expect(line).toMatch(/elapsedMs=\d+/);
    expect(line).toContain("model=anthropic:test");
    expect(line).toMatch(/promptLength=\d+/);
    // NIE Prompt-Inhalt im Log.
    expect(line).not.toContain("GEHEIMER");
    expect(line).not.toContain("Ventil");
  });

  it("Timeout: reason=model-timeout + class=timeout", async () => {
    const line = await captureFallbackLog(async () => {
      throw new ModelTimeoutError("Modell-API überschritt das Zeitlimit von 30000 ms", 30_000);
    });
    expect(line).toContain("reason=model-timeout");
    expect(line).toContain("class=timeout");
    expect(line).toContain("status=-");
    expect(line).not.toContain("GEHEIMER");
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
    // WP-D10 (Fix 3): eigener Text für die Zeitüberschreitung.
    expect(page).toContain("fd.fallbackModelTimeout");
    expect(page).toContain('fallbackReason === "model-error"');
    expect(page).toContain('fallbackReason === "model-timeout"');
    for (const lng of ["de", "en", "nl"]) {
      for (const key of [
        "fd.fallbackNoModel",
        "fd.fallbackModelError",
        "fd.fallbackModelTimeout",
      ]) {
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
    // Das Log interpoliert AUSSCHLIESSLICH Metadaten — kein rawText im Log-Template.
    expect(svc).not.toMatch(/Reasoner-Fallback[^\n]*rawText/);
  });
});
