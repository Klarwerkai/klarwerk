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

// SCRUM-492: optionaler kollision-Block. Additiv — fehlt/kaputt er, bleibt der Konflikt gültig.
const kollisionJson = (kollision: string): string =>
  `{"relation":"widerspruch","older":null,"confidence":0.9,"begruendung":"Andere Pflichtfarbe.","zitat_a":"Die Markierung muss blau sein.","zitat_b":"Die Markierung muss rot sein.","kollision":${kollision}}`;

describe("SCRUM-492: parseConflictResponse — Kollisionsfelder", () => {
  it("übernimmt gültige kollision und markiert wörtlich belegte Streitwerte", () => {
    const res = parseConflictResponse(
      kollisionJson(
        '{"streitpunkt":"Pflichtfarbe","seite_a":{"kernaussage":"Markierung blau","streitwert":"blau"},"seite_b":{"kernaussage":"Markierung rot","streitwert":"rot"}}',
      ),
    );
    expect(res?.kollision?.streitpunkt).toBe("Pflichtfarbe");
    expect(res?.kollision?.seiteA.streitwert).toBe("blau");
    // "blau"/"rot" stehen wörtlich in zitat_a/zitat_b → belegt.
    expect(res?.kollision?.seiteA.streitwertWoertlich).toBe(true);
    expect(res?.kollision?.seiteB.streitwertWoertlich).toBe(true);
  });

  it("streitwert NICHT im Zitat → gilt als Zusammenfassung (nicht verworfen, nur Flag false)", () => {
    const res = parseConflictResponse(
      kollisionJson(
        '{"streitpunkt":"Pflichtfarbe","seite_a":{"kernaussage":"Kaltes Farbschema","streitwert":"kühl"},"seite_b":{"kernaussage":"Warmes Farbschema","streitwert":"warm"}}',
      ),
    );
    expect(res?.kollision?.seiteA.streitwert).toBe("kühl");
    expect(res?.kollision?.seiteA.streitwertWoertlich).toBe(false);
    expect(res?.kollision?.seiteB.streitwertWoertlich).toBe(false);
  });

  it("fehlende kollision → Konflikt bleibt gültig, kollision undefined", () => {
    const res = parseConflictResponse(conflictJson);
    expect(res?.relation).toBe("widerspruch");
    expect(res?.kollision).toBeUndefined();
  });

  it("kaputte kollision (Seite ohne streitwert) → kollision undefined, Konflikt bleibt gültig", () => {
    const res = parseConflictResponse(
      kollisionJson(
        '{"streitpunkt":"Pflichtfarbe","seite_a":{"kernaussage":"Markierung blau"},"seite_b":{"kernaussage":"Markierung rot","streitwert":"rot"}}',
      ),
    );
    expect(res?.relation).toBe("widerspruch");
    expect(res?.kollision).toBeUndefined();
  });

  it("kollision ohne streitpunkt-String → undefined", () => {
    const res = parseConflictResponse(
      kollisionJson(
        '{"seite_a":{"kernaussage":"a","streitwert":"blau"},"seite_b":{"kernaussage":"b","streitwert":"rot"}}',
      ),
    );
    expect(res?.kollision).toBeUndefined();
  });
});

describe("Berater-Konzept 04.07. (Stufe 2): judgeConflict über die Provider-Kette", () => {
  it("ModelProvider.judgeConflict liefert das geparste Urteil", async () => {
    // aistate-fix3 (bens V1): locale + confidential sind an der Provider-Fläche PFLICHT.
    const res = await new ModelProvider(fakeClient(conflictJson)).judgeConflict(
      "Farbe blau",
      "Farbe rot",
      "de",
      false,
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
