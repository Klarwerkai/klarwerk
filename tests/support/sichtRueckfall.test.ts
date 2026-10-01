// ================================================================================================
// GRAPH-BROWSER-RECHTE · DIE KALIBRIERUNG DES SICHT-RÜCKFALLS, DOM-FREI UND IM TOR.
// ================================================================================================
//
// `SICHT_RUECKFALL` ist Browser-Quelltext. Hier läuft er gegen nachgebaute Elemente, deren Stil,
// Kasten und Hit-Test der Fall selbst festlegt — so ist JEDER Ausgang einzeln erzwingbar, auch die,
// die ein echter Browser nur selten liefert (kein Treffer, Treffer am Vorfahren). Denselben Rückfall
// im echten Chromium kalibriert `tests/wissensbeziehungen-browser-rechte/
// tastatur-schmal-rechte-im-echten-browser.test.ts` (K3, K4, K6, K8, K9).
//
// DIE GEGENFÄLLE AUS BEN R1 (Befund B1) stehen hier wörtlich: eine SVG-Linie, an der der alte
// Rückfall `elementFromPoint` KEIN EINZIGES MAL rief und trotzdem „sichtbar" meldete (Fall 7), und
// ein Hit-Test ohne Treffer, der ebenfalls „sichtbar" ergab (Fall 8).
import { describe, expect, it } from "vitest";
import { SICHT_RUECKFALL } from "./sichtRueckfall";

interface Stil {
  display?: string;
  opacity?: string;
  visibility?: string;
  color?: string;
  contentVisibility?: string;
}
interface Kasten {
  left: number;
  top: number;
  width: number;
  height: number;
}

class El {
  nodeType = 1;
  parentElement: El | null = null;
  stil: Stil = {};
  kasten: Kasten = { left: 10, top: 10, width: 100, height: 20 };
  zeilen: Kasten[] | null = null;
  gerollt = 0;
  constructor(
    public tagName: string,
    private testid = "",
  ) {}
  getAttribute(n: string): string | null {
    return n === "data-testid" && this.testid ? this.testid : null;
  }
  haenge(kind: El): El {
    kind.parentElement = this;
    return kind;
  }
  contains(x: El | null): boolean {
    for (let v = x; v; v = v.parentElement) if (v === this) return true;
    return false;
  }
  getBoundingClientRect(): Kasten {
    return this.kasten;
  }
  getClientRects(): Kasten[] {
    return this.zeilen ?? [this.kasten];
  }
  scrollIntoView(): void {
    this.gerollt += 1;
  }
}

/** Die SVG-Basisklasse der Messung — `instanceof SVGElement` muss für `Linie` gelten. */
class SvgEl extends El {}
class Linie extends SvgEl {
  // Von (20,100) nach (220,100) in eigenen Koordinaten; die Bildschirmmatrix verschiebt um (5,7).
  getTotalLength(): number {
    return 200;
  }
  getPointAtLength(l: number): { x: number; y: number } {
    return { x: 20 + l, y: 100 };
  }
  getScreenCTM(): { a: number; b: number; c: number; d: number; e: number; f: number } {
    return { a: 1, b: 0, c: 0, d: 1, e: 5, f: 7 };
  }
}

type Treffer = (x: number, y: number) => El | null;
interface Messung {
  sichtRueckfall: (e: El) => {
    sichtbar: boolean;
    messbar: boolean;
    grund: string;
    verfahren: string;
  };
  sichtbarOhneCheck: (e: El) => boolean;
  aufrufe: { x: number; y: number }[];
}

function messung(treffer: Treffer | undefined, ohneStil = false): Messung {
  const aufrufe: { x: number; y: number }[] = [];
  const document = {
    elementFromPoint: treffer
      ? (x: number, y: number) => {
          aufrufe.push({ x, y });
          return treffer(x, y);
        }
      : undefined,
  };
  const getComputedStyle = ohneStil
    ? undefined
    : (e: El) => ({
        display: "block",
        opacity: "1",
        visibility: "visible",
        color: "rgb(0, 0, 0)",
        contentVisibility: "visible",
        ...e.stil,
      });
  const baue = new Function(
    "getComputedStyle",
    "document",
    "SVGElement",
    "innerWidth",
    "innerHeight",
    `${SICHT_RUECKFALL}\nreturn { sichtRueckfall, sichtbarOhneCheck };`,
  ) as (...a: unknown[]) => Omit<Messung, "aufrufe">;
  return { ...baue(getComputedStyle, document, SvgEl, 360, 780), aufrufe };
}

/** Seite → Kachel → Satz; dazu eine Decke, die kein Vorfahre ist. */
function seite(): { body: El; kachel: El; satz: El; decke: El } {
  const body = new El("BODY");
  const kachel = body.haenge(new El("LI", "wb-kante"));
  const satz = kachel.haenge(new El("P"));
  const decke = body.haenge(new El("DIV", "decke"));
  return { body, kachel, satz, decke };
}

describe("GRAPH-BROWSER-RECHTE · Sicht-Rückfall ohne checkVisibility", () => {
  it("HTML frei: der Messpunkt trifft das Element → sichtbar, gemessen", () => {
    const { satz } = seite();
    const m = messung((_x, _y) => satz);
    const b = m.sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([true, true]);
    expect(m.aufrufe).toEqual([{ x: 60, y: 20 }]);
    expect(satz.gerollt).toBe(1);
  });

  it("HTML verdeckt: ein fremdes Element liegt oben → nicht sichtbar, benannt", () => {
    const { satz, decke } = seite();
    const b = messung(() => decke).sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([false, true]);
    expect(b.grund).toContain("verdeckt von <div decke>");
  });

  it("Ben R1 Fall 8 · Hit-Test ohne Treffer → NICHT MESSBAR, nie „sichtbar“; der Verbraucher wirft", () => {
    const { satz } = seite();
    const m = messung(() => null);
    const b = m.sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([false, false]);
    expect(b.grund).toMatch(/^NICHT MESSBAR: /);
    expect(b.grund).toContain("kein Treffer");
    expect(() => m.sichtbarOhneCheck(satz)).toThrow(/SICHTMESSUNG NICHT MOEGLICH: NICHT MESSBAR/);
  });

  it("Treffer am Vorfahren (Hit-Test fiel durch, z. B. pointer-events:none) → NICHT MESSBAR", () => {
    const { satz, kachel } = seite();
    const b = messung(() => kachel).sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([false, false]);
    expect(b.grund).toContain("Treffer am Vorfahren <li wb-kante>");
  });

  it("ohne document.elementFromPoint → NICHT MESSBAR", () => {
    const { satz } = seite();
    const b = messung(undefined).sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([false, false]);
    expect(b.grund).toContain("document.elementFromPoint fehlt");
  });

  it("Messpunkt ausserhalb des Sichtfensters → NICHT MESSBAR, ohne Hit-Test", () => {
    const { satz } = seite();
    satz.kasten = { left: 400, top: 10, width: 100, height: 20 };
    const m = messung(() => satz);
    const b = m.sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([false, false]);
    expect(b.grund).toContain("kein Messpunkt im Sichtfenster");
    expect(m.aufrufe).toEqual([]);
  });

  it("umbrochenes Inline-Element: gemessen wird die Mitte des ERSTEN Zeilenkastens", () => {
    const { satz } = seite();
    satz.kasten = { left: 0, top: 0, width: 300, height: 40 };
    satz.zeilen = [
      { left: 200, top: 0, width: 100, height: 20 },
      { left: 0, top: 20, width: 50, height: 20 },
    ];
    const m = messung(() => satz);
    expect(m.sichtRueckfall(satz).sichtbar).toBe(true);
    expect(m.aufrufe).toEqual([{ x: 250, y: 10 }]);
  });

  it("durchsichtiger Vorfahre → nicht sichtbar mit Grund, ohne Hit-Test", () => {
    const { satz, kachel } = seite();
    kachel.stil = { opacity: "0" };
    const m = messung(() => satz);
    const b = m.sichtRueckfall(satz);
    expect([b.sichtbar, b.messbar]).toEqual([false, true]);
    expect(b.grund).toContain("Vorfahre <li wb-kante> opacity:0");
    expect(m.aufrufe).toEqual([]);
  });

  it("ohne getComputedStyle → die Messung wirft ausdrücklich", () => {
    const { satz } = seite();
    expect(() => messung(() => satz, true).sichtRueckfall(satz)).toThrow(
      /SICHTMESSUNG NICHT MOEGLICH/,
    );
  });

  describe("SVG-Linie (Ben R1 Fall 7: früher kein einziger Hit-Test, trotzdem „sichtbar“)", () => {
    const aufbau = (): { svg: El; linie: Linie; decke: El } => {
      const body = new El("BODY");
      const svg = body.haenge(new SvgEl("svg", "graph"));
      const linie = svg.haenge(new Linie("line", "graph-kante-kuratiert")) as Linie;
      linie.kasten = { left: 25, top: 107, width: 200, height: 0 };
      const decke = body.haenge(new El("DIV", "decke"));
      return { svg, linie, decke };
    };
    // 10 % bis 90 % der Länge 200, verschoben um die Bildschirmmatrix (5,7).
    const aufDerLinie = [20, 40, 60, 80, 100, 120, 140, 160, 180].map((l) => ({
      x: 20 + l + 5,
      y: 107,
    }));

    it("frei: neun Hit-Tests AUF der Linie (Bildschirmmatrix angewandt) → sichtbar", () => {
      const { linie } = aufbau();
      const m = messung(() => linie);
      const b = m.sichtRueckfall(linie);
      expect([b.sichtbar, b.messbar]).toEqual([true, true]);
      expect(m.aufrufe).toEqual(aufDerLinie);
      expect(b.grund).toContain("9/9 Punkte auf der Form");
    });

    it("verdeckt: jeder Punkt trifft die Decke → nicht sichtbar, benannt", () => {
      const { linie, decke } = aufbau();
      const b = messung(() => decke).sichtRueckfall(linie);
      expect([b.sichtbar, b.messbar]).toEqual([false, true]);
      expect(b.grund).toContain("verdeckt von <div decke>");
    });

    it("durchfallend (pointer-events:none): jeder Treffer ist das <svg> → NICHT MESSBAR, Verbraucher wirft", () => {
      const { linie, svg } = aufbau();
      const m = messung(() => svg);
      const b = m.sichtRueckfall(linie);
      expect([b.sichtbar, b.messbar]).toEqual([false, false]);
      expect(b.grund).toContain("Treffer am Vorfahren <svg graph>");
      expect(() => m.sichtbarOhneCheck(linie)).toThrow(/SICHTMESSUNG NICHT MOEGLICH/);
    });

    it("gestrichelt: einzelne Punkte fallen in Lücken, einer trifft → sichtbar", () => {
      const { linie, svg } = aufbau();
      const b = messung((x) => (x === aufDerLinie[4]?.x ? linie : svg)).sichtRueckfall(linie);
      expect([b.sichtbar, b.messbar]).toEqual([true, true]);
      expect(b.grund).toContain("1/9");
    });

    it("ohne Hit-Test-Treffer an allen Punkten → NICHT MESSBAR", () => {
      const { linie } = aufbau();
      const b = messung(() => null).sichtRueckfall(linie);
      expect([b.sichtbar, b.messbar]).toEqual([false, false]);
    });
  });
});
