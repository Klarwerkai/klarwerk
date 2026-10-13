// ================================================================================================
// BPA-05 · NACHARBEIT 9 — die Platzregel der Leiste neben der verschiebbaren Assistenzfigur (G10).
// ================================================================================================
//
// Maße aus Bens Bildbeleg (390 × 700): Leiste unten links, etwa 360 × 314 px; Figur samt
// Namensschild rechts unten, etwa x 284–378, y 475–575. Ob die Fläche im echten Browser dann frei
// ist, misst `begleitleiste-deckend-chromium.test.ts`; hier steht die Regel selbst.
import { describe, expect, it } from "vitest";
import {
  GRUND_UNTEN,
  type Rechteck,
  platzNebenFigur,
} from "../../apps/web/src/components/klara-begleitung/platz";

const H = 700;
const LEISTE: Rechteck = { left: 16, right: 376, top: 370, bottom: 684 };
const FIGUR_RECHTS_UNTEN: Rechteck = { left: 284, right: 378, top: 475, bottom: 575 };

describe("G10 · die Leiste weicht der Figur aus", () => {
  it("ohne sichtbare Figur bleibt sie an der Grundposition", () => {
    expect(platzNebenFigur(LEISTE, null, H).unten).toBe(GRUND_UNTEN);
    const versteckt: Rechteck = { left: 0, right: 0, top: 0, bottom: 0 };
    expect(platzNebenFigur(LEISTE, versteckt, H).unten).toBe(GRUND_UNTEN);
  });

  it("überdeckt die Figur die Grundposition, rückt die Leiste über die Figur", () => {
    const p = platzNebenFigur(LEISTE, FIGUR_RECHTS_UNTEN, H);
    // Unterkante der Leiste über der Oberkante der Figur (mit Luft)
    expect(H - p.unten).toBeLessThan(FIGUR_RECHTS_UNTEN.top);
    // und sie passt mit ihrer vollen Höhe darüber, ohne zu scrollen
    expect(p.maxHoehe).toBeGreaterThanOrEqual(LEISTE.bottom - LEISTE.top);
  });

  it("eine Figur oben im Bild oder neben der Leiste verschiebt nichts", () => {
    const oben: Rechteck = { left: 284, right: 378, top: 80, bottom: 180 };
    expect(platzNebenFigur(LEISTE, oben, H).unten).toBe(GRUND_UNTEN);
    const schmal: Rechteck = { ...LEISTE, right: 250 };
    expect(platzNebenFigur(schmal, FIGUR_RECHTS_UNTEN, H).unten).toBe(GRUND_UNTEN);
  });

  it("reicht der Platz über der Figur nicht, wird die Höhe begrenzt — die Leiste scrollt", () => {
    const tief: Rechteck = { left: 284, right: 378, top: 250, bottom: 350 };
    const p = platzNebenFigur({ ...LEISTE, top: 200 }, tief, H);
    expect(H - p.unten).toBeLessThan(tief.top);
    expect(p.maxHoehe).toBeLessThan(484);
    expect(p.maxHoehe).toBeGreaterThanOrEqual(0);
  });
});
