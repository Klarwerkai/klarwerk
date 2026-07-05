import { describe, expect, it } from "vitest";
import { type ModelClient, ModelProvider, parseDuplicateResponse } from "./provider-model";
import { Reasoner } from "./service";

function fakeClient(reply: string): ModelClient {
  return { name: "fake", complete: async () => reply };
}

const dupJson =
  '{"beziehung":"teilweise","gemeinsame_aussagen":[{"beschreibung":"Wartezeit","zitat_a":"10 Sekunden warten","zitat_b":"10 Sekunden warten"}],"nur_in_a":"nur A","nur_in_b":"","empfehlung":"zusammenfuehren_pruefen","confidence":0.88,"begruendung":"Gemeinsamer Kern."}';

describe("Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): parseDuplicateResponse", () => {
  it("parst gültiges Profil (Prosa drumherum) und mappt snake_case → camelCase", () => {
    const res = parseDuplicateResponse(`Urteil: ${dupJson} fertig.`);
    expect(res?.beziehung).toBe("teilweise");
    expect(res?.confidence).toBe(0.88);
    expect(res?.aspects).toHaveLength(1);
    expect(res?.aspects[0]?.zitatA).toBe("10 Sekunden warten");
    expect(res?.nurInA).toBe("nur A");
    expect(res?.empfehlung).toBe("zusammenfuehren_pruefen");
  });

  it("Aspekt ohne beide Zitate wird gestrichen", () => {
    const res = parseDuplicateResponse(
      '{"beziehung":"identisch","gemeinsame_aussagen":[{"beschreibung":"x","zitat_a":"nur a"}],"confidence":0.9,"empfehlung":"zusammenfuehren"}',
    );
    expect(res?.aspects).toHaveLength(0);
  });

  it("unbekannte Empfehlung fällt sicher auf zusammenfuehren_pruefen", () => {
    const res = parseDuplicateResponse(
      '{"beziehung":"identisch","gemeinsame_aussagen":[],"confidence":0.9,"empfehlung":"quatsch"}',
    );
    expect(res?.empfehlung).toBe("zusammenfuehren_pruefen");
  });

  it("unbekannte Beziehung → null; kein JSON → null; confidence geklemmt", () => {
    expect(
      parseDuplicateResponse('{"beziehung":"quatsch","confidence":0.9,"gemeinsame_aussagen":[]}'),
    ).toBeNull();
    expect(parseDuplicateResponse("weiß nicht")).toBeNull();
    expect(
      parseDuplicateResponse(
        '{"beziehung":"identisch","gemeinsame_aussagen":[],"confidence":1.7,"empfehlung":"zusammenfuehren"}',
      )?.confidence,
    ).toBe(1);
  });
});

describe("Berater-Konzept Duplikate 04.07. (Stufe D2): judgeDuplicate über die Provider-Kette", () => {
  it("ModelProvider.judgeDuplicate liefert das geparste Profil", async () => {
    const res = await new ModelProvider(fakeClient(dupJson)).judgeDuplicate("A-Text", "B-Text");
    expect(res?.beziehung).toBe("teilweise");
  });

  it("Reasoner mit Modell urteilt; ohne Modell ehrlich null", async () => {
    const withModel = new Reasoner(new ModelProvider(fakeClient(dupJson)));
    expect((await withModel.judgeDuplicate("A", "B"))?.beziehung).toBe("teilweise");

    const withoutModel = new Reasoner();
    expect(await withoutModel.judgeDuplicate("A", "B")).toBeNull();
  });
});
