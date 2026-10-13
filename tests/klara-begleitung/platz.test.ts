// ================================================================================================
// BPA-05 · NACHARBEIT 9/10 — die Platzregel der Leiste neben der verschiebbaren Figur (G10, K3).
// ================================================================================================
//
// Maße aus Bens Bildbeleg (390 × 700): Leiste unten links, etwa 360 × 314 px; Figur samt
// Namensschild rechts unten, etwa x 284–378, y 475–575. Ob die Fläche im echten Browser dann frei
// ist, misst `begleitleiste-deckend-chromium.test.ts`; hier steht die Regel selbst.
//
// NACHARBEIT 10 (Ben): die Regel entschied mit der GEMESSENEN, nach eigener Begrenzung schon
// gekürzten Höhe — sie pendelte zwischen begrenzt und voll, und weil die Leiste nach jedem Rendern
// misst, drohte eine Renderschleife. Sie entscheidet jetzt mit der ungekürzten Inhaltshöhe. Der
// Fall unten wendet das Ergebnis wiederholt an, genau wie die Messung im Produkt, und verlangt,
// dass es sich nicht mehr ändert.
import { describe, expect, it } from "vitest";
import {
  GRUND_UNTEN,
  type Platz,
  type Rechteck,
  platzNebenFigur,
} from "../../apps/web/src/components/klara-begleitung/platz";

const H = 700;
const WAAGERECHT = { left: 16, right: 376 };
const INHALT = 314;
const FIGUR_RECHTS_UNTEN: Rechteck = { left: 284, right: 378, top: 475, bottom: 575 };

describe("G10 · die Leiste weicht der Figur aus", () => {
  it("ohne sichtbare Figur bleibt sie an der Grundposition", () => {
    expect(platzNebenFigur(WAAGERECHT, INHALT, null, H).unten).toBe(GRUND_UNTEN);
    const versteckt: Rechteck = { left: 0, right: 0, top: 0, bottom: 0 };
    expect(platzNebenFigur(WAAGERECHT, INHALT, versteckt, H).unten).toBe(GRUND_UNTEN);
  });

  it("überdeckt die Figur die Grundposition, rückt die Leiste über die Figur", () => {
    const p = platzNebenFigur(WAAGERECHT, INHALT, FIGUR_RECHTS_UNTEN, H);
    // Unterkante der Leiste über der Oberkante der Figur (mit Luft)
    expect(H - p.unten).toBeLessThan(FIGUR_RECHTS_UNTEN.top);
    // und sie passt mit ihrer vollen Höhe darüber, ohne zu scrollen
    expect(p.maxHoehe).toBeGreaterThanOrEqual(INHALT);
  });

  it("eine Figur oben im Bild oder neben der Leiste verschiebt nichts", () => {
    const oben: Rechteck = { left: 284, right: 378, top: 80, bottom: 180 };
    expect(platzNebenFigur(WAAGERECHT, INHALT, oben, H).unten).toBe(GRUND_UNTEN);
    const schmal = { left: 16, right: 250 };
    expect(platzNebenFigur(schmal, INHALT, FIGUR_RECHTS_UNTEN, H).unten).toBe(GRUND_UNTEN);
  });

  it("reicht der Platz über der Figur nicht, wird die Höhe begrenzt — die Leiste scrollt", () => {
    const tief: Rechteck = { left: 284, right: 378, top: 250, bottom: 350 };
    const p = platzNebenFigur(WAAGERECHT, 484, tief, H);
    expect(H - p.unten).toBeLessThan(tief.top);
    expect(p.maxHoehe).toBe(234);
  });
});

describe("K3/G10 · Nacharbeit 10 — die Platzierung bleibt nach ihrer Anwendung stabil", () => {
  /** Ein Messzyklus wie im Produkt: Ergebnis anwenden, Kasten neu messen, erneut entscheiden. */
  function zyklen(inhalt: number, figur: Rechteck, runden: number): Platz[] {
    const ergebnisse: Platz[] = [];
    let p = platzNebenFigur(WAAGERECHT, inhalt, figur, H);
    for (let i = 0; i < runden; i += 1) {
      ergebnisse.push(p);
      // Der gemessene Kasten ist jetzt gekürzt — die Inhaltshöhe bleibt dieselbe.
      p = platzNebenFigur(WAAGERECHT, inhalt, figur, H);
    }
    return ergebnisse;
  }

  it("Bens Fall (Fenster 700, Inhalt 484, Figur y 250–350): begrenzt und bleibt begrenzt", () => {
    const tief: Rechteck = { left: 284, right: 378, top: 250, bottom: 350 };
    const ergebnisse = zyklen(484, tief, 6);
    for (const p of ergebnisse) {
      expect(p).toEqual(ergebnisse[0]);
    }
    expect(ergebnisse[0]?.maxHoehe).toBe(234);
  });

  it("Gegenprobe: mit der gekürzten Kastenhöhe als Eingabe wäre die Regel gekippt", () => {
    const tief: Rechteck = { left: 284, right: 378, top: 250, bottom: 350 };
    const begrenzt = platzNebenFigur(WAAGERECHT, 484, tief, H);
    // Genau der alte Fehler: die gekürzte Höhe (234) als Höhe eingesetzt → „frei", Grundposition.
    const gekippt = platzNebenFigur(WAAGERECHT, begrenzt.maxHoehe, tief, H);
    expect(gekippt.unten).toBe(GRUND_UNTEN);
    expect(gekippt).not.toEqual(begrenzt);
  });

  it("auch bei der Figur rechts unten (Bildbeleg) ändert sich nach der Anwendung nichts mehr", () => {
    const ergebnisse = zyklen(INHALT, FIGUR_RECHTS_UNTEN, 6);
    for (const p of ergebnisse) {
      expect(p).toEqual(ergebnisse[0]);
    }
  });
});
