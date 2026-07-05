import { describe, expect, it } from "vitest";
import { type ModelClient, ModelProvider, parseConflictResponse } from "./provider-model";
import { Reasoner } from "./service";

function fakeClient(reply: string): ModelClient {
  return { name: "fake", complete: async () => reply };
}

const conflictJson =
  '{"relation":"widerspruch","older":null,"confidence":0.95,"begruendung":"A und B legen eine andere Farbe fest.","zitat_a":"Farbe blau","zitat_b":"Farbe rot"}';

describe("Berater-Konzept 04.07. (Stufe 2, kon-v1): parseConflictResponse", () => {
  it("parst gültiges JSON, auch mit umgebender Prosa", () => {
    const res = parseConflictResponse(`Hier mein Urteil: ${conflictJson} — Ende.`);
    expect(res?.relation).toBe("widerspruch");
    expect(res?.confidence).toBe(0.95);
    expect(res?.zitat_a).toBe("Farbe blau");
  });

  it("klemmt confidence auf 0..1", () => {
    const res = parseConflictResponse(
      '{"relation":"widerspruch","older":null,"confidence":1.8,"begruendung":"x","zitat_a":"a","zitat_b":"b"}',
    );
    expect(res?.confidence).toBe(1);
  });

  it("unbekannte Relation → null", () => {
    const res = parseConflictResponse(
      '{"relation":"quatsch","older":null,"confidence":0.9,"begruendung":"x","zitat_a":"a","zitat_b":"b"}',
    );
    expect(res).toBeNull();
  });

  it("fehlende Zitate (kein String) → null", () => {
    const res = parseConflictResponse(
      '{"relation":"widerspruch","older":null,"confidence":0.9,"begruendung":"x"}',
    );
    expect(res).toBeNull();
  });

  it("kein JSON → null (kein Konflikt aus kaputter Antwort)", () => {
    expect(parseConflictResponse("Ich bin mir nicht sicher.")).toBeNull();
  });

  it("older nur a/b, sonst null", () => {
    const res = parseConflictResponse(
      '{"relation":"ueberholt","older":"a","confidence":0.9,"begruendung":"x","zitat_a":"a","zitat_b":"b"}',
    );
    expect(res?.older).toBe("a");
  });
});

describe("Berater-Konzept 04.07. (Stufe 2): judgeConflict über die Provider-Kette", () => {
  it("ModelProvider.judgeConflict liefert das geparste Urteil", async () => {
    const res = await new ModelProvider(fakeClient(conflictJson)).judgeConflict(
      "Farbe blau",
      "Farbe rot",
    );
    expect(res?.relation).toBe("widerspruch");
  });

  it("Reasoner mit echtem Modell urteilt; ohne Modell ehrlich null", async () => {
    const withModel = new Reasoner(new ModelProvider(fakeClient(conflictJson)));
    expect((await withModel.judgeConflict("Farbe blau", "Farbe rot"))?.relation).toBe(
      "widerspruch",
    );

    // Ohne konfiguriertes Modell (nur deterministischer Fallback) → kein Pseudo-Urteil.
    const withoutModel = new Reasoner();
    expect(await withoutModel.judgeConflict("Farbe blau", "Farbe rot")).toBeNull();
  });
});
