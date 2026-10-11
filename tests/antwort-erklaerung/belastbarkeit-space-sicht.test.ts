// ================================================================================================
// INTEGRATION mit main e04ae5ea (produkt:20261007:spaces) — DIE KONFLIKT-GEGENSEITE FOLGT DER
// SPACE-GRUNDLAGE.
// ================================================================================================
//
// Konfliktstelle: `services/app/src/routes/ask-routes.ts`. main beschränkt die Antwortgrundlage
// ohne Sitzungsnutzer (Add-on-Schlüssel) auf Inhalt ohne Space oder aus offenen Spaces; die
// Belastbarkeit (R-0321) nennt zusätzlich die GEGENSEITE eines Konflikts — ein Objekt, das der
// Aufrufer nicht als Quelle bekommen hat. Sie darf deshalb nicht weiter reichen als die Grundlage.
// Auf dem Sitzungsweg gilt `sichtbarkeitsfilterFuer`, das main um den führenden Space erweitert hat.
import { describe, expect, it } from "vitest";
import { belastbarkeitsSicht } from "../../services/app/src/routes/ask-routes";
import type { KnowledgeObject } from "../../services/knowledge-object";

function ko(teil: Partial<KnowledgeObject> & { spaceId?: string }): KnowledgeObject {
  return {
    id: "g",
    title: "Gegenseite",
    statement: "Aussage",
    status: "validiert",
    confidentiality: "intern",
    author: "u1",
    ...teil,
  } as unknown as KnowledgeObject;
}

describe("Integration spaces × Belastbarkeit · Gegenseite auf dem Add-on-Weg", () => {
  const offen = new Set(["offen-1"]);
  const grundlage = (k: KnowledgeObject): boolean => {
    const spaceId = (k as { spaceId?: unknown }).spaceId;
    return typeof spaceId !== "string" || offen.has(spaceId);
  };

  it("validiert und in einem GESCHLOSSENEN Space: nicht einsehbar", () => {
    const sicht = belastbarkeitsSicht(null, "frage", grundlage);
    expect(sicht.seiteSichtbar(ko({ spaceId: "geschlossen-1" }))).toBe(false);
  });

  it("validiert ohne Space oder in einem offenen Space: einsehbar (Kalibrierung)", () => {
    const sicht = belastbarkeitsSicht(null, "frage", grundlage);
    expect(sicht.seiteSichtbar(ko({}))).toBe(true);
    expect(sicht.seiteSichtbar(ko({ spaceId: "offen-1" }))).toBe(true);
  });

  it("die Validierungsgrenze bleibt: ungeprüft ist auch im offenen Space nicht einsehbar", () => {
    const sicht = belastbarkeitsSicht(null, "frage", grundlage);
    expect(
      sicht.seiteSichtbar(ko({ spaceId: "offen-1", status: "offen" } as Partial<KnowledgeObject>)),
    ).toBe(false);
    expect(sicht.mitPersonen).toBe(false);
    expect(sicht.zuschnitt.rolle).toBe("unbekannt");
  });
});
