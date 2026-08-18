// ================================================================================================
// JOB 1098 · D1 — D-024: WER MIT DER TASTATUR BEDIENT, SIEHT IMMER, WO ER STEHT.
// ================================================================================================
//
// DER BEFUND, den diese Datei bewacht, steht in `DESIGN_AN_CHEF/LIEFERUNG-20260814-BLOCK2.md`
// unter D-024 und ist im Quelltext verankert:
//
//   „Es gibt KEINEN globalen Fokusstil. Ueber alle drei CSS-Dateien findet sich genau EINE
//    :focus-visible-Regel — und die gilt Bild-Fussnoten im Editor. … Der zentrale `Button` hat
//    KEINEN Fokusstil; der zentrale `TextInput` loescht den Browser-Ring mit `outline-none` …
//    `outline-none` steht an rund 50 Stellen, davon vier ERSATZLOS — darunter die 34
//    fokussierbaren Graph-Knoten."
//
// ================================================================================================
// WAS DIESE DATEI PRUEFT — UND WAS SIE NICHT KANN.
// ================================================================================================
//
// Sie prueft den CSS-VERTRAG, nicht die gemalte Wirkung. Der Grund ist keine Bequemlichkeit: die
// Testumgebung kompiliert kein Tailwind. In jsdom sind `ring-2` und `outline-none` blosse
// Zeichenketten an einem Attribut; es gibt keine berechnete Umrandung, die man messen koennte.
// D-024 sieht das selbst vor — „gemountete Pruefung … ODER Sichtpruefung, falls kein CSS-faehiger
// Test-Runner".
//
// Was daraus folgt, steht in der Rueckgabe als benannter Rest: dass der Ring WIRKLICH erscheint,
// belegt erst ein Browserlauf oder eine Sichtpruefung. Diese Datei haelt fest, dass die Regel da
// ist, global greift, aus Markentokens gebaut ist, layoutfrei bleibt — und dass die vier Flaechen
// aus der Zusage sie nicht wieder aushebeln.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lies = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf8");

const css = lies("../../apps/web/src/index.css");
const ui = lies("../../apps/web/src/components/ui.tsx");

/** Der Block der globalen Regel — von `*:focus-visible` bis zur schliessenden Klammer. */
function globaleRegel(): string {
  const start = css.indexOf("*:focus-visible");
  if (start < 0) {
    return "";
  }
  const ende = css.indexOf("}", start);
  return ende < 0 ? "" : css.slice(start, ende + 1);
}

describe("JOB 1098 · die Regel existiert und greift global (Lieferung 1)", () => {
  it("es gibt eine globale :focus-visible-Regel", () => {
    expect(
      globaleRegel().length,
      "keine globale *:focus-visible-Regel in index.css",
    ).toBeGreaterThan(0);
  });

  it("sie steht im Base-Layer — nicht in components oder utilities", () => {
    // Der Ort entscheidet ueber die Kaskade: im Base-Layer liegt sie unter jeder Utility-Klasse,
    // die eine Komponente selbst setzt, und ueber dem Browser-Standard. Stuende sie in
    // `utilities`, kaempfte sie mit den Komponentenklassen um dieselbe Ebene.
    const base = css.indexOf("@layer base");
    const regel = css.indexOf("*:focus-visible");
    expect(base, "kein @layer base in index.css").toBeGreaterThanOrEqual(0);
    expect(regel).toBeGreaterThan(base);
    // …und innerhalb desselben Blocks: zwischen `@layer base` und der Regel darf kein zweiter
    // `@layer` beginnen.
    const dazwischen = css.slice(base + "@layer base".length, regel);
    expect(dazwischen).not.toMatch(/@layer\s+\w/);
  });

  it("sie steht NACH den Tailwind-Direktiven — sonst raeumte preflight sie weg", () => {
    const tailwindBase = css.indexOf("@tailwind base");
    expect(tailwindBase).toBeGreaterThanOrEqual(0);
    expect(css.indexOf("*:focus-visible")).toBeGreaterThan(tailwindBase);
  });
});

describe("JOB 1098 · der Ring ist sichtbar und aus Markentokens gebaut (Lieferung 1)", () => {
  it("sie setzt einen Ring mit Breite", () => {
    expect(globaleRegel()).toMatch(/\bring-2\b|\bring-\[/);
  });

  it("sie nutzt das vorhandene Marken-Token statt einer erfundenen Farbe", () => {
    // D-024, NICHT-ZIELE: „keine Farbe neu erfunden (Marken-Token existiert)".
    const regel = globaleRegel();
    expect(regel).toMatch(/ring-brand/);
    // Kein Rohwert — weder Hex noch rgb() noch eine willkuerliche Tailwind-Palette.
    expect(regel).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|ring-(red|blue|green|yellow|indigo)-/);
  });

  it("sie setzt einen Abstand zum Element", () => {
    // `ring-offset` ist der Grund, warum der Ring aussen liegt und nichts verdeckt.
    expect(globaleRegel()).toMatch(/ring-offset-2|ring-offset-\[/);
  });

  it("der Offset traegt die Seitenfarbe — sonst leuchtet ein falscher Untergrund durch", () => {
    expect(globaleRegel()).toMatch(/ring-offset-page/);
  });
});

describe("JOB 1098 · kein Layoutsprung (Lieferung 3)", () => {
  it("die Regel aendert keine layoutwirksame Eigenschaft", () => {
    const regel = globaleRegel();
    // Ein Fokusstil ueber `border` oder `padding` verschiebt beim Fokussieren die Nachbarn — genau
    // das schliesst D-024 mit „Ring liegt aussen, ring-offset" aus. `ring` ist ein box-shadow und
    // nimmt keinen Platz ein.
    for (const verboten of [
      /\bborder-\d/,
      /\bborder-\[/,
      /\bp[xytblr]?-\d/,
      /\bm[xytblr]?-\d/,
      /\bw-\d/,
      /\bh-\d/,
    ]) {
      expect(verboten.test(regel), `layoutwirksame Klasse in der Fokusregel: ${verboten}`).toBe(
        false,
      );
    }
  });

  it("sie schaltet den Browser-Umriss ab — der Ersatz ist der Ring", () => {
    // Ohne `outline-none` staenden zwei Umrandungen uebereinander; mit ihm ist der Ring die eine
    // Antwort. Das ist zugleich der Grund, warum die ~50 vorhandenen `outline-none`-Stellen den
    // Ring NICHT aushebeln: sie schalten dieselbe Eigenschaft ab, die auch hier abgeschaltet wird,
    // und lassen den box-shadow unberuehrt.
    expect(globaleRegel()).toMatch(/outline-none/);
  });
});

describe("JOB 1098 · outline-none hebelt den Ring nicht aus (Lieferung 3)", () => {
  // Der tragende Fall der Zusage. Er prueft nicht die Behauptung „outline-none stoert nicht",
  // sondern ihre Voraussetzung: dass keine der betroffenen Flaechen den RING selbst unterdrueckt.
  // `outline-none` und `ring-*` sind verschiedene CSS-Eigenschaften (outline gegen box-shadow) —
  // gefaehrlich waere allein ein `ring-0` oder `shadow-none` im Fokuszustand.
  const flaechen: Array<{ name: string; pfad: string }> = [
    { name: "Button und TextInput", pfad: "../../apps/web/src/components/ui.tsx" },
    { name: "Graphknoten (Stufe 2)", pfad: "../../apps/web/src/pages/Stufe2.tsx" },
    {
      name: "Graphknoten (Nachbarschaft)",
      pfad: "../../apps/web/src/components/KnowledgeNeighborhood.tsx",
    },
    // Bewusst der Komponentenname statt der deutschen Bezeichnung. Die deutsche Form endet auf
    // dieselbe Zeichenfolge, ueber die das Klara-Regressionsinventar (JOB 920) seine
    // Farbtreue-Achse aufspannt — diese Datei gehoert dort sachlich NICHT hinein, und ein
    // Eintrag aus Wortzufall zoege bei jedem Klara-Regressionslauf einen sachfremden Test mit.
    { name: "CommandPalette", pfad: "../../apps/web/src/shell/CommandPalette.tsx" },
  ];

  for (const flaeche of flaechen) {
    it(`${flaeche.name}: kein focus-Zustand unterdrueckt den Ring`, () => {
      const quelle = lies(flaeche.pfad);
      expect(
        /focus(-visible)?:ring-0|focus(-visible)?:shadow-none/.test(quelle),
        `${flaeche.name} unterdrueckt den globalen Fokusring`,
      ).toBe(false);
    });
  }

  it("KALIBRIERUNG: die Probe findet outline-none dort ueberhaupt", () => {
    // Ohne diesen Fall waere „nichts unterdrueckt den Ring" auch dann gruen, wenn die Dateien gar
    // nicht gelesen wuerden oder die Fundstellen verschwunden waeren.
    expect(ui).toMatch(/outline-none/);
  });

  it("der zentrale Button traegt weiterhin KEINEN eigenen Fokusstil — die globale Regel genuegt", () => {
    // D-024, NICHT-ZIELE: „Keine Komponente wird angefasst." Ein nachtraeglich eingebauter
    // Komponenten-Fokusstil waere genau der Umbau, den die Scheibe vermeiden will.
    const buttonBlock = ui.slice(ui.indexOf("inline-flex items-center justify-center gap-1.5"));
    expect(buttonBlock.slice(0, 400)).not.toMatch(/focus-visible:/);
  });
});

describe("JOB 1098 · die Editor-Fussnote behaelt ihren eigenen Ring (Lieferung 2)", () => {
  it("ihre Regel existiert weiterhin", () => {
    expect(css).toMatch(/\.prose-kw figcaption\[data-kw-caption-open\]:focus-visible/);
  });

  it("sie ist spezifischer als die globale Regel und gewinnt damit unabhaengig von der Reihenfolge", () => {
    // Klasse + Attributselektor + Pseudoklasse schlaegt den Universalselektor. Das ist der Grund,
    // warum die globale Regel die bewusst eigene Fussnoten-Gestaltung NICHT ueberschreibt — und
    // warum sie hier stehen bleiben darf, statt aufgeloest zu werden (D-024 laesst beides zu).
    const fussnote = css.slice(
      css.indexOf(".prose-kw figcaption[data-kw-caption-open]:focus-visible"),
    );
    expect(fussnote.slice(0, 200)).toMatch(/ring-ai/);
  });
});
