// AUFTRAG-mega11 Block D (bens SB-4): der reine Vertrag der Formular-Zielbindung.
//
// Der gemountete Beleg (angehaltene Antwort, Bildtausch, Quellenwechsel, entfernter Bildblock,
// externer Wertwechsel) steht in caption-form-deferred-mounted.test.tsx. Hier steht jede der fünf
// Bedingungen EINZELN — damit ein späterer Umbau nicht eine davon still fallen lassen kann, ohne
// dass genau diese Zeile rot wird.
import { describe, expect, it } from "vitest";
import {
  type CaptionFormCurrent,
  captionFormResponseApplicable,
  captionFormTargetIntact,
  captionResponseApplicable,
} from "../../apps/web/src/lib/captionAiSuggest";

const OPENED = { imageId: "kw-a", src: "data:image/png;base64,AAAA", run: 7, generation: 3 };

const CURRENT: CaptionFormCurrent & { generation: number } = {
  open: true,
  sameCaption: true,
  inDom: true,
  imageId: "kw-a",
  src: "data:image/png;base64,AAAA",
  run: 7,
  generation: 3,
};

describe("Block D: die Formular-Bindung prüft alle fünf Bedingungen", () => {
  it("unverändertes Ziel ⇒ Antwort gilt und darf gespeichert werden", () => {
    expect(captionFormResponseApplicable(OPENED, CURRENT)).toBe(true);
    expect(captionFormTargetIntact(OPENED, CURRENT)).toBe(true);
  });

  // Jede EINZELNE Abweichung muss reichen — das war der Fehler: mega9 prüfte nur `sameCaption`.
  const BREAKS: { name: string; patch: Partial<typeof CURRENT> }[] = [
    { name: "Formular geschlossen", patch: { open: false } },
    { name: "andere Fußnote", patch: { sameCaption: false } },
    { name: "Fußnote nicht mehr im Editor-DOM", patch: { inDom: false } },
    { name: "andere Bild-Kennung", patch: { imageId: "kw-b" } },
    { name: "andere Bildquelle", patch: { src: "data:image/png;base64,BBBB" } },
    { name: "neuer Formular-Lauf (geschlossen und neu geöffnet)", patch: { run: 8 } },
  ];

  for (const brk of BREAKS) {
    it(`${brk.name} ⇒ weder anzeigen noch speichern`, () => {
      const current = { ...CURRENT, ...brk.patch };
      expect(captionFormResponseApplicable(OPENED, current)).toBe(false);
      expect(captionFormTargetIntact(OPENED, current)).toBe(false);
    });
  }

  it("gewechselte Auswahl-Generation ⇒ Antwort gilt nicht, das ZIEL bleibt aber beschreibbar", () => {
    // Die Generation ist eine Aussage über den laufenden REQUEST, nicht über das Ziel: der Nutzer
    // hat woanders hingeklickt, sein Formular zeigt aber weiterhin dieselbe Fußnote am selben Bild.
    // Die späte Antwort ist damit ungültig — sein selbst getippter Text bleibt speicherbar.
    const current = { ...CURRENT, generation: 4 };
    expect(captionFormResponseApplicable(OPENED, current)).toBe(false);
    expect(captionFormTargetIntact(OPENED, current)).toBe(true);
  });

  it("die Formular-Prüfung ENTHÄLT die Prüfung des Inline-Wegs (eine Quelle, nicht zwei)", () => {
    // Genau der Punkt aus bens Widerlegung: der Egress-Kern war geteilt, die Geltungsprüfung nicht.
    for (const patch of [{ imageId: "kw-b" }, { generation: 9 }]) {
      const current = { ...CURRENT, ...patch };
      expect(
        captionResponseApplicable(
          { imageId: OPENED.imageId, generation: OPENED.generation },
          { imageId: current.imageId, generation: current.generation },
        ),
      ).toBe(false);
      expect(captionFormResponseApplicable(OPENED, current)).toBe(false);
    }
  });
});
