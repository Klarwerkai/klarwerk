// ================================================================================================
// AUFTRAG-mega62 BLOCK D — DIE PFLICHTFLÄCHEN ERFÜLLEN AA, GEMESSEN STATT BEHAUPTET.
// ================================================================================================
//
// WARUM DAS KEINE GESCHMACKSFRAGE IST: Artikel 50 Absatz 5 der KI-Verordnung verlangt ausdrücklich,
// dass die Transparenzhinweise die Barrierefreiheitsanforderungen erfüllen. Seit mega61 stehen
// genau diese Hinweise im Produkt — Hinweisbanner, Impressum, Datenschutzerklärung, der
// Entwurfsvermerk darauf. Damit gehört der Kontrast dieser Flächen zur Pflicht und nicht zur Optik.
//
// DREI BEFUNDE, DIE DIESER BLOCK GESCHLOSSEN HAT (Werte vorher → nachher):
//   · --kw-brand-text auf --kw-funke-soft   4,497 → 5,046   (Register F27)
//   · --kw-muted auf --kw-hairline-soft     4,448 → 4,788   (der Banner selbst)
//   · --kw-trust-warn-text auf -warn-bg     4,201 → 4,760   (Entwurfsvermerk, Ablehnungshinweis)
//
// DIE WERTE WERDEN GERECHNET, NICHT ABGESCHRIEBEN: gelesen wird die EINE Token-Datei
// (apps/web/src/styles/themes.css), gerechnet wird mit der WCAG-Formel. Eine hier eingetragene
// Zahl wäre genau die Sorte Behauptung, gegen die dieser Auftrag antritt.
//
// UND DIE LISTE DER PAARUNGEN IST BEWACHT: Der zweite Teil sammelt aus den Rechtsflächen ALLE
// benutzten Farbklassen ein und verlangt, dass jede von ihnen in der Paarungsliste vorkommt. Wer
// künftig auf einer Pflichtfläche ein Token benutzt, das hier niemand gemessen hat, wird rot.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const LEGAL = join(WURZEL, "apps", "web", "src", "legal");

const THEMES = readFileSync(join(WURZEL, "apps/web/src/styles/themes.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);
const MODERN_START = THEMES.indexOf('[data-theme="modern"]');
const KLASSISCH_BLOCK = THEMES.slice(0, MODERN_START);
const MODERN_BLOCK = THEMES.slice(MODERN_START);

/** Ein Token im gegebenen Block — der modern-Block ERBT, was er nicht selbst überschreibt. */
function token(name: string, modern: boolean): [number, number, number] {
  const suche = (block: string): RegExpMatchArray | null =>
    block.match(new RegExp(`--kw-${name}:\\s*(\\d+) (\\d+) (\\d+);`));
  const treffer = (modern ? suche(MODERN_BLOCK) : null) ?? suche(KLASSISCH_BLOCK);
  if (!treffer?.[1] || !treffer[2] || !treffer[3]) {
    throw new Error(`Token --kw-${name} nicht gefunden`);
  }
  return [Number(treffer[1]), Number(treffer[2]), Number(treffer[3])];
}

function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function leuchtdichte([r, g, b]: [number, number, number]): number {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function kontrast(vorne: [number, number, number], hinten: [number, number, number]): number {
  const a = leuchtdichte(vorne);
  const b = leuchtdichte(hinten);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const AA = 4.5;

// ------------------------------------------------------------------------------------------------
// Die Paarungen der Pflichtflächen: welcher Text auf welcher Fläche wirklich vorkommt.
// `nurModern` für Token, die es im klassischen Thema nicht gibt (funke-soft).
// ------------------------------------------------------------------------------------------------
const PAARUNGEN: ReadonlyArray<{ text: string; flaeche: string; wo: string; nurModern?: true }> = [
  // Der Hinweisbanner: bg-hairline-soft, darauf der Titel (text-text) und beide Pflichtabsätze
  // (text-muted) sowie die Verweise auf die Rechtsseiten (text-muted).
  { text: "muted", flaeche: "hairline-soft", wo: "Hinweisbanner, Pflichtabsätze und Verweise" },
  { text: "text", flaeche: "hairline-soft", wo: "Hinweisbanner, Titelzeile" },
  // Die beiden Rechtsseiten stehen auf Weiß (bg-white → surface).
  { text: "muted", flaeche: "surface", wo: "Rechtsseiten, Zurück-Verweis und Beschriftungen" },
  { text: "muted-2", flaeche: "surface", wo: "Rechtsseiten, Registerhinweise" },
  { text: "text", flaeche: "surface", wo: "Rechtsseiten, Fließtext" },
  { text: "ink", flaeche: "surface", wo: "Rechtsseiten, Überschriften" },
  // Der Entwurfsvermerk auf beiden Rechtsseiten, der Hinweis nach einer Ablehnung auf der
  // Anmeldemaske und die Sperrfläche aus Block C teilen sich dieselbe Paarung.
  {
    text: "trust-warn-text",
    flaeche: "trust-warn-bg",
    wo: "Entwurfsvermerk, Ablehnungshinweis, Sperrfläche",
  },
  // Die Sperrfläche liegt auf der Seitenfläche.
  { text: "trust-warn-text", flaeche: "page", wo: "Sperrfläche auf der Seitenfläche" },
  // Register F27: der Markentext auf der Markenfläche — der Befund, der diesen Block ausgelöst hat.
  {
    text: "brand-text",
    flaeche: "funke-soft",
    wo: "Markentext auf der Markenfläche",
    nurModern: true,
  },
  { text: "brand-text", flaeche: "surface", wo: "Markentext auf Weiß" },
  { text: "brand-text", flaeche: "page", wo: "Markentext auf der Seitenfläche" },
  // AUFTRAG-mega63 Block C: die REALE dunkle Paarung, die mega62 D mitgezogen hat — der ·2-Marker
  // der Gruppentitel in der modernen Seitenleiste (shell/Sidebar.tsx:295) auf --kw-night. Sie
  // steht hier mit dem Token, der dort nach dem lokalen Override WIRKLICH gilt; dass der Override
  // existiert und genau diesen Token setzt, prüft der mega63-Teil unten aus der CSS-Datei.
  {
    text: "brand-300",
    flaeche: "night",
    wo: "·2-Marker in der modernen Seitenleiste",
    nurModern: true,
  },
];

describe("mega62 D · die Pflichtflächen erfüllen WCAG AA", () => {
  for (const thema of ["klassisch", "modern"] as const) {
    const modern = thema === "modern";
    for (const paar of PAARUNGEN) {
      if (paar.nurModern && !modern) {
        continue;
      }
      it(`${thema}: ${paar.text} auf ${paar.flaeche} (${paar.wo})`, () => {
        const wert = kontrast(token(paar.text, modern), token(paar.flaeche, modern));
        expect(
          wert,
          `${paar.text} auf ${paar.flaeche} misst ${wert.toFixed(3)}:1`,
        ).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it("KALIBRIERUNG: die Rechnung erkennt einen Verstoß — sonst wäre alles oben wertlos", () => {
    // Ein Paar, von dem feststeht, dass es DURCHFALLEN muss: die reine Markenfarbe als Text auf
    // Weiß (#ED7D0E, ~2,4:1). Ohne diesen Schritt wäre grün auch dann grün, wenn `kontrast()`
    // immer 21 lieferte.
    expect(kontrast(token("brand", false), token("surface", false))).toBeLessThan(AA);
    // Und die Formel trifft die bekannten Eckwerte.
    expect(kontrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(kontrast([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  });
});

describe("mega62 D · die Paarungsliste bleibt vollständig", () => {
  /** Alle Farbklassen, die auf den Rechtsflächen wirklich stehen — eingesammelt, nicht aufgezählt. */
  function klassenAusRechtsflaechen(): { flaechen: Set<string>; texte: Set<string> } {
    const flaechen = new Set<string>();
    const texte = new Set<string>();
    for (const datei of readdirSync(LEGAL)) {
      if (!datei.endsWith(".tsx") || datei.includes(".test.")) {
        continue;
      }
      // Kommentarzeilen raus: eine in Prosa erwähnte Klasse ist keine benutzte Klasse.
      const inhalt = readFileSync(join(LEGAL, datei), "utf8").replace(/^\s*\/\/.*$/gm, "");
      for (const treffer of inhalt.matchAll(/\bbg-([a-z][a-z0-9-]*)/g)) {
        flaechen.add(treffer[1] ?? "");
      }
      for (const treffer of inhalt.matchAll(/\btext-([a-z][a-z0-9-]*)/g)) {
        texte.add(treffer[1] ?? "");
      }
    }
    return { flaechen, texte };
  }

  it("jedes auf einer Rechtsfläche benutzte Farb-Token ist oben gemessen", () => {
    const { flaechen, texte } = klassenAusRechtsflaechen();
    // Selbstschutz: findet der Sammler nichts, wäre er grün ohne zu prüfen.
    expect(flaechen.size, "keine Flächenklassen gefunden").toBeGreaterThan(1);
    expect(texte.size, "keine Textklassen gefunden").toBeGreaterThan(2);

    // `text-white` steht ausschließlich auf der dunklen Markenspalte der Anmeldemaske und hat dort
    // keine Token-Fläche unter sich; `bg-white` ist derselbe Wert wie `surface`.
    const gemesseneFlaechen = new Set([...PAARUNGEN.map((p) => p.flaeche), "white"]);
    const gemesseneTexte = new Set([...PAARUNGEN.map((p) => p.text), "white"]);

    for (const name of flaechen) {
      expect(gemesseneFlaechen.has(name), `Fläche bg-${name} ist ungemessen`).toBe(true);
    }
    for (const name of texte) {
      expect(gemesseneTexte.has(name), `Textfarbe text-${name} ist ungemessen`).toBe(true);
    }
  });
});

// ================================================================================================
// AUFTRAG-mega63 BLOCK C — EINE ECHTE DOM-PAARUNG, AUS DER CSS-DATEI GERECHNET.
// ================================================================================================
//
// DIE LÜCKE, DIE BEN GEFUNDEN HAT (BERICHT-ben-sammel60-mega62.md, Abschnitt 4): Der Sammler oben
// bildet MENGEN von Text- und Flächentokens, nicht deren PAARUNGEN. Eine neue, falsche
// Kreuzkombination bereits bekannter Tokens bliebe grün — und genau eine solche Kombination war
// der Befund: `text-brand-text` auf `--kw-night`, beide Tokens längst „gemessen", die Paarung nie.
//
// DER VOLLSTÄNDIGE FIX WÄRE EIN PAARUNGSMODELL ÜBER DEN ECHTEN DOM und gehört nicht in eine
// Korrekturscheibe. Was hier steht, ist der begrenzte Schritt: EINE reale Paarung, aber nicht als
// abgeschriebene Zahl, sondern aus der CSS-Datei aufgelöst — welcher Ton in der Seitenleiste für
// `text-brand-text` WIRKLICH gilt und welche Fläche dort WIRKLICH darunter liegt. Was danach offen
// bleibt, steht im Bericht zu mega63.
describe("mega63 C · der Markentext in der modernen Seitenleiste", () => {
  const MODERN_CSS = readFileSync(join(WURZEL, "apps/web/src/styles/modern.css"), "utf8");
  const SIDEBAR_TSX = readFileSync(join(WURZEL, "apps/web/src/shell/Sidebar.tsx"), "utf8");

  /** Liest den Token aus einer `.kw-sidebar`-Regel des modernen Themas — oder null. */
  function sidebarRegel(auswahl: string, eigenschaft: string): string | null {
    const muster = new RegExp(
      `\\[data-theme="modern"\\]\\s+\\.kw-sidebar${auswahl}\\s*\\{[^}]*${eigenschaft}:\\s*rgb\\(var\\(--kw-([a-z0-9-]+)\\)\\)`,
    );
    return MODERN_CSS.match(muster)?.[1] ?? null;
  }

  it("die Leiste steht auf einer Nachtfläche, und der Marker steht wirklich darauf", () => {
    // Beides sind Voraussetzungen der Rechnung. Werden sie falsch, ist die Rechnung darunter eine
    // Antwort auf eine Frage, die niemand mehr stellt — deshalb hier und nicht als Kommentar.
    expect(sidebarRegel("", "background-color")).toBe("night");
    expect(SIDEBAR_TSX).toContain("text-brand-text");
    expect(SIDEBAR_TSX).toContain('className="kw-sidebar');
  });

  it("für text-brand-text gilt dort ein lokaler Override — und der erreicht AA", () => {
    const flaeche = sidebarRegel("", "background-color");
    const ton = sidebarRegel("\\s+\\.text-brand-text", "color");
    expect(ton, "kein lokaler Override für text-brand-text in der modernen Seitenleiste").not.toBe(
      null,
    );
    const wert = kontrast(token(ton as string, true), token(flaeche as string, true));
    expect(
      wert,
      `text-brand-text → --kw-${ton} auf --kw-${flaeche} misst ${wert.toFixed(3)}:1`,
    ).toBeGreaterThanOrEqual(AA);
  });

  it("KALIBRIERUNG: OHNE den Override wäre dieselbe Paarung rot — der Befund, nachgerechnet", () => {
    // Ohne diesen Schritt bewiese der Fall darüber nichts: Er wäre auch dann grün, wenn auf der
    // Nachtfläche ohnehin jeder Ton bestünde. Das ist der Zustand, den ben gemessen hat — der
    // geerbte --kw-brand-text auf --kw-night, 3,069:1.
    const ohneOverride = kontrast(token("brand-text", true), token("night", true));
    expect(ohneOverride).toBeLessThan(AA);
    expect(ohneOverride).toBeCloseTo(3.069, 2);
    // Und die Verdunkelung aus mega62 D hat es messbar schlechter gemacht (vorher #a8560a).
    expect(kontrast([168, 86, 10], token("night", true))).toBeCloseTo(3.444, 2);
  });

  it("die Textfarben der Seitenleiste bleiben ein geprüfter Satz", () => {
    // Der Rest der Lücke, so weit eine Korrekturscheibe ihn schließen kann: Ein NEUES Text-Token in
    // der Seitenleiste wird rot und zwingt jemanden, die Fläche darunter nachzusehen. Das ersetzt
    // kein Paarungsmodell — es verhindert nur, dass die nächste Kreuzkombination unbemerkt entsteht.
    const benutzt = new Set(
      [...SIDEBAR_TSX.replace(/^\s*\/\/.*$/gm, "").matchAll(/\btext-([a-z][a-z0-9-]*)\b/g)].map(
        (m) => m[1] ?? "",
      ),
    );
    // `text-sm` ist eine Größe, keine Farbe.
    benutzt.delete("sm");
    expect(benutzt.size, "keine Textklassen gefunden").toBeGreaterThan(3);
    // Jede dieser Klassen ist einzeln angesehen worden (mega63 C):
    //   brand-text        → lokal überschrieben, oben gerechnet
    //   text/ink/muted/muted-2 → lokal auf shell-* überschrieben (modern.css:181-192)
    //   trust-crit-text   → steht auf bg-trust-crit-bg (Sidebar.tsx:26,78,109) — gemessene Paarung
    //   trust-warn-text   → steht auf bg-trust-warn-bg (Sidebar.tsx:133,220-221) — dito
    //   white             → steht auf bg-brand bzw. bg-white/20 und bg-ink (Sidebar.tsx:24,156,316)
    const geprueft = new Set([
      "brand-text",
      "text",
      "ink",
      "muted",
      "muted-2",
      "trust-crit-text",
      "trust-warn-text",
      "white",
    ]);
    for (const name of benutzt) {
      expect(
        geprueft.has(name),
        `text-${name} ist neu in der Seitenleiste — welche Fläche liegt darunter?`,
      ).toBe(true);
    }
  });
});
