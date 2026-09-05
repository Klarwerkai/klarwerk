// ================================================================================================
// JOB 3085 · Q4 — DER KONTO-KREIS TRÄGT DEN FUNKE, UND SEINE INITIALEN TRAGEN NACHT.
// ================================================================================================
//
// PEDIS ENTSCHEIDUNG 21 (05.09.2026, Option b): der Konto-Kreis im Kopfband bekommt die Farbe des
// Mockups (`design/klarwerk/Main.dc.html` Z.32: `background: #E8630A`) — und weil Weiß darauf nur
// 3,38:1 misst und damit unter AA liegt, werden die Initialen Nacht (#0E1626, 5,36:1).
//
// Der Kreis war damit die EINE benannte Ausnahme zur Hausregel mega41 („texttragende Markenfläche
// → Funke dunkel", styles/modern.css `.bg-brand.text-white`). Er hebelt sie nicht aus, er verlässt
// sie: ohne `text-white` greift der Selektor an diesem Element gar nicht mehr, `bg-brand` liefert
// den reinen Funke — kein `!important`, kein zweites Farb-Token, keine zweite Wahrheit.
//
// WIE DIESER TEST MISST (Bauart: tests/app/mega40-kontrast-modern.test.ts):
//  1. Die Klassen des realen Elements `data-testid="kopfband-konto"` kommen aus dem TSX-BAUM
//     (TypeScript-Parser, ScriptKind.TSX) — nicht aus einer Regex über die Datei.
//  2. Sein DOM-Pfad wird über die JSX-Vorfahren BEIDER Bauteile gebildet: `<KontoMenue />` sitzt in
//     shell/Kopfband.tsx unter dem `<header class="kw-kopfband …">`. Ohne diesen Pfad ließen sich
//     Nachfahren-Regeln wie `.kw-kopfband .kw-konto-punkt` gar nicht anwenden.
//  3. Die wirksamen Deklarationen kommen aus styles/modern.css, in DATEIREIHENFOLGE ausgewertet
//     (spätere Regel gewinnt) — gemessen wird also die überschriebene Farbe, nicht die behauptete.
//  4. Die Farbwerte kommen aus der Token-Datei styles/themes.css; im klassischen Thema gilt der
//     :root-Wert, im modernen der Wert aus [data-theme="modern"] (sonst der geerbte).
//  5. Der Kontrast ist die WCAG-2.x-Rechnung (Relativluminanz), dieselbe wie in den mega40-Sammlern.
//
// Dieser Test ist die STATISCHE Messung. Die zweite, unabhängige steht an der GEBAUTEN Seite in
// Chromium (tests/design/zielbild-h1-huelle.test.ts, Fälle V16 und „konto-grund"); der eine ersetzt
// den anderen nicht, er trägt ihn.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(__dirname, "../../apps/web/src");

// ------------------------------------------------------------------------------------------------
// Die Token-Datei als Farbquelle.
// ------------------------------------------------------------------------------------------------
type Rgb = [number, number, number];

const THEMES = readFileSync(join(WEB_SRC, "styles/themes.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function tokenBlock(selektor: string): string {
  const start = THEMES.indexOf(`${selektor} {`);
  if (start < 0) {
    throw new Error(`Block ${selektor} fehlt in themes.css`);
  }
  return THEMES.slice(start, THEMES.indexOf("}", start));
}

const MODERN_BLOCK = tokenBlock('[data-theme="modern"]');
const ROOT_BLOCK = tokenBlock(":root");

function tokenAus(quelle: string, name: string): Rgb | null {
  const m = quelle.match(new RegExp(`--kw-${name}:\\s*(\\d+) (\\d+) (\\d+);`));
  if (!m?.[1] || !m[2] || !m[3]) {
    return null;
  }
  return [Number.parseInt(m[1], 10), Number.parseInt(m[2], 10), Number.parseInt(m[3], 10)];
}

type Thema = "modern" | "classic";

/** Im modernen Thema gilt der modern-Wert, sonst der geerbte klassische; classic kennt nur :root. */
function token(thema: Thema, name: string): Rgb {
  const wert =
    thema === "modern"
      ? (tokenAus(MODERN_BLOCK, name) ?? tokenAus(ROOT_BLOCK, name))
      : tokenAus(ROOT_BLOCK, name);
  if (!wert) {
    throw new Error(`Token --kw-${name} fehlt (${thema})`);
  }
  return wert;
}

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// ---- WCAG 2.x, Relativluminanz ------------------------------------------------------------------
function kanal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminanz([r, g, b]: Rgb): number {
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

function kontrast(a: Rgb, b: Rgb): number {
  const l1 = luminanz(a);
  const l2 = luminanz(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// ------------------------------------------------------------------------------------------------
// styles/modern.css als anwendbare Regeln (Dateireihenfolge = Kaskade).
// ------------------------------------------------------------------------------------------------
type Regel = { selektor: string; teile: string[][]; deklarationen: Map<string, string> };

function modernRegeln(): { regeln: Regel[]; uebersprungen: string[] } {
  const css = readFileSync(join(WEB_SRC, "styles/modern.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const regeln: Regel[] = [];
  const uebersprungen: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selektorListe = (m[1] ?? "").trim();
    if (!selektorListe.includes('[data-theme="modern"]')) {
      continue;
    }
    const deklarationen = new Map<string, string>();
    for (const d of (m[2] ?? "").split(";")) {
      const i = d.indexOf(":");
      if (i > 0) {
        deklarationen.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
      }
    }
    for (const einzeln of selektorListe.split(",")) {
      const selektor = einzeln.trim().replace(/\s+/g, " ");
      const roh = selektor.replace('[data-theme="modern"]', "").trim();
      // Kombinatoren, Pseudoklassen, Attribute und Tag-Selektoren versteht dieser Leser nicht. Er
      // zählt sie AUF, statt sie stillschweigend zu verschlucken (Fall G prüft die Liste) — und
      // rechnet ohne sie, also eher zu streng als zu milde. Der Universalselektor `*` dagegen wird
      // ausgewertet: `.bg-brand.text-white *` ist genau die Regel, die den Kreis früher erreichte,
      // und sie zu überspringen hieße, an der wichtigsten Stelle blind zu messen.
      const teile: string[][] = [];
      let lesbar = roh !== "";
      for (const teil of roh.split(" ")) {
        if (teil === "*") {
          teile.push([]); // [] = Universalselektor: trifft jedes Element
          continue;
        }
        if (!teil.startsWith(".") || /[>+~:[]/.test(teil)) {
          lesbar = false;
          break;
        }
        teile.push(
          teil
            .split(".")
            .filter((k) => k !== "")
            .map((k) => k.replace(/\\/g, "")),
        );
      }
      if (!lesbar) {
        uebersprungen.push(selektor);
        continue;
      }
      regeln.push({ selektor, teile, deklarationen });
    }
  }
  return { regeln, uebersprungen };
}

const { regeln: MODERN_REGELN, uebersprungen: NICHT_GELESEN } = modernRegeln();

/** Nachfahren-Kombinator: der letzte Teil trifft das Element, die davor müssen in Reihenfolge als
 *  Vorfahren im bekannten Pfad vorkommen. Ein Vorfahre außerhalb des Pfades → nicht anwendbar.
 *  Ein leerer Teil ist der Universalselektor und trifft immer. */
function regelPasst(regel: Regel, pfad: string[][]): boolean {
  const ziel = regel.teile[regel.teile.length - 1];
  const letzte = pfad[pfad.length - 1] ?? [];
  if (!ziel || !ziel.every((k) => letzte.includes(k))) {
    return false;
  }
  let idx = pfad.length - 2;
  for (let t = regel.teile.length - 2; t >= 0; t--) {
    const teil = regel.teile[t] as string[];
    let gefunden = false;
    while (idx >= 0) {
      const klassen = pfad[idx] as string[];
      idx--;
      if (teil.every((k) => klassen.includes(k))) {
        gefunden = true;
        break;
      }
    }
    if (!gefunden) {
      return false;
    }
  }
  return true;
}

/** Die letzte passende Deklaration gewinnt — samt der Regel, die sie gesetzt hat (für die Meldung). */
function deklaration(
  pfad: string[][],
  eigenschaft: string,
): { wert: string; selektor: string } | null {
  let treffer: { wert: string; selektor: string } | null = null;
  for (const regel of MODERN_REGELN) {
    const d = regel.deklarationen.get(eigenschaft);
    if (d !== undefined && regelPasst(regel, pfad)) {
      treffer = { wert: d, selektor: regel.selektor };
    }
  }
  return treffer;
}

/** `rgb(var(--kw-x))` / `rgb(var(--kw-x) / 0.3)` / `rgb(255 255 255)` */
function farbeAusCss(wert: string, thema: Thema): { farbe: Rgb; alpha: number } | null {
  const varM = wert.match(/rgb\(\s*var\(--kw-([a-z0-9-]+)\)\s*(?:\/\s*([0-9.]+)\s*)?\)/);
  if (varM?.[1]) {
    return { farbe: token(thema, varM[1]), alpha: varM[2] ? Number.parseFloat(varM[2]) : 1 };
  }
  const rgbM = wert.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([0-9.]+)\s*)?\)/);
  if (rgbM?.[1] && rgbM[2] && rgbM[3]) {
    return {
      farbe: [
        Number.parseInt(rgbM[1], 10),
        Number.parseInt(rgbM[2], 10),
        Number.parseInt(rgbM[3], 10),
      ],
      alpha: rgbM[4] ? Number.parseFloat(rgbM[4]) : 1,
    };
  }
  return null;
}

// ------------------------------------------------------------------------------------------------
// Tailwind-Utilities als Farben — `bg-<name>` / `text-<name>` / `outline-<name>` / `border-<name>`
// bilden 1:1 auf `--kw-<name>` ab (apps/web/tailwind.config.ts: token(name)); dazu Weiß und Schwarz.
// ------------------------------------------------------------------------------------------------
type Praefix = "text" | "bg" | "outline" | "border";

function utilityFarbe(klasse: string, praefix: Praefix, thema: Thema): Rgb | null {
  if (!klasse.startsWith(`${praefix}-`) || klasse.includes(":")) {
    return null;
  }
  const name = klasse.slice(praefix.length + 1);
  if (name === "" || name.startsWith("[") || name.includes("/")) {
    return null;
  }
  if (name === "white") {
    return [255, 255, 255];
  }
  if (name === "black") {
    return [0, 0, 0];
  }
  return thema === "modern"
    ? (tokenAus(MODERN_BLOCK, name) ?? tokenAus(ROOT_BLOCK, name))
    : tokenAus(ROOT_BLOCK, name);
}

/** Die letzte farbgebende Utility der Klassenliste gewinnt (eine Klasse, eine Farbe). */
function letzteUtilityFarbe(klassen: string[], praefix: Praefix, thema: Thema): Rgb | null {
  let farbe: Rgb | null = null;
  for (const k of klassen) {
    const f = utilityFarbe(k, praefix, thema);
    if (f) {
      farbe = f;
    }
  }
  return farbe;
}

/** Zustands-Utility (`focus-visible:outline-brand`) — die Farbe des Rings, ohne den Zustand.
 *  Die Zustandskette trägt auch Nicht-Farben (`outline-2`, `outline-offset-2`); gezählt wird
 *  ausschließlich, was sich als Farbe auflösen lässt. Genau eine — sonst rät dieser Test. */
function zustandsFarbe(klassen: string[], zustand: string, praefix: Praefix, thema: Thema): Rgb {
  const farben: { klasse: string; farbe: Rgb }[] = [];
  for (const k of klassen) {
    if (!k.startsWith(`${zustand}:${praefix}-`)) {
      continue;
    }
    const farbe = utilityFarbe(k.slice(zustand.length + 1), praefix, thema);
    if (farbe) {
      farben.push({ klasse: k, farbe });
    }
  }
  if (farben.length !== 1) {
    throw new Error(
      `genau eine farbgebende \`${zustand}:${praefix}-…\`-Klasse erwartet, gefunden: ${farben.map((f) => f.klasse).join(", ") || "keine"}`,
    );
  }
  return (farben[0] as { farbe: Rgb }).farbe;
}

// ------------------------------------------------------------------------------------------------
// Der TSX-Baum: das reale Element und sein DOM-Pfad über zwei Bauteile hinweg.
// ------------------------------------------------------------------------------------------------
type JsxEl = ts.JsxElement | ts.JsxSelfClosingElement;

function quelleVon(rel: string): ts.SourceFile {
  const pfad = join(WEB_SRC, rel);
  return ts.createSourceFile(
    rel,
    readFileSync(pfad, "utf8"),
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TSX,
  );
}

function attribute(el: JsxEl): ts.JsxAttributes {
  return ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes;
}

function tagName(el: JsxEl): string {
  return (ts.isJsxElement(el) ? el.openingElement.tagName : el.tagName).getText();
}

function attributText(el: JsxEl, name: string): string | null {
  for (const a of attribute(el).properties) {
    if (ts.isJsxAttribute(a) && a.name.getText() === name && a.initializer) {
      if (ts.isStringLiteral(a.initializer)) {
        return a.initializer.text;
      }
      // Bewusst kein Raten: ein berechnetes className kann dieser Leser nicht messen.
      throw new Error(`${el.getSourceFile().fileName}: \`${name}\` ist kein String-Literal`);
    }
  }
  return null;
}

function klassenVon(el: JsxEl): string[] {
  return (attributText(el, "className") ?? "").split(/\s+/).filter((k) => k !== "");
}

function sucheJsx(quelle: ts.SourceFile, passt: (el: JsxEl) => boolean): JsxEl {
  let treffer: JsxEl | null = null;
  const besuche = (n: ts.Node): void => {
    if ((ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && passt(n)) {
      treffer = n;
    }
    ts.forEachChild(n, besuche);
  };
  besuche(quelle);
  if (!treffer) {
    throw new Error(`Element in ${quelle.fileName} nicht gefunden`);
  }
  return treffer;
}

/** Die Klassenmengen der JSX-Vorfahren im selben Bauteil, außen → innen (das Element selbst zuletzt). */
function pfadImBauteil(el: JsxEl): string[][] {
  const pfad: string[][] = [klassenVon(el)];
  let p: ts.Node | undefined = el.parent;
  while (p) {
    if (ts.isJsxElement(p)) {
      pfad.unshift(klassenVon(p));
    }
    p = p.parent;
  }
  return pfad;
}

// Das reale Element: der Auslöser des Konto-Menüs (shell/KontoMenue.tsx).
const KONTO_QUELLE = quelleVon("shell/KontoMenue.tsx");
const KONTO_EL = sucheJsx(
  KONTO_QUELLE,
  (el) => attributText(el, "data-testid") === "kopfband-konto",
);
const KONTO_KLASSEN = klassenVon(KONTO_EL);

// Der Punkt für ungelesene Meldungen sitzt AUF dem Kreis (§9: nur nach frischem Abruf sichtbar).
const PUNKT_EL = sucheJsx(KONTO_QUELLE, (el) => attributText(el, "data-testid") === "konto-punkt");

// Der DOM-Pfad über die Bauteilgrenze: `<KontoMenue />` steht in shell/Kopfband.tsx unter dem
// `<header class="kw-kopfband …">`. Ohne diesen Teil des Pfades wären Nachfahren-Regeln blind.
const KOPFBAND_QUELLE = quelleVon("shell/Kopfband.tsx");
const KOPFBAND_EL = sucheJsx(
  KOPFBAND_QUELLE,
  (el) => attributText(el, "data-testid") === "kopfband",
);
const KONTO_MENUE_EL = sucheJsx(KOPFBAND_QUELLE, (el) => tagName(el) === "KontoMenue");
// Die Vorfahren des Einbauorts (ohne das Bauteil-Element selbst — es zeichnet kein eigenes DOM).
const HUELLE_PFAD = pfadImBauteil(KONTO_MENUE_EL).slice(0, -1);
const KREIS_PFAD = [...HUELLE_PFAD, ...pfadImBauteil(KONTO_EL)];
const PUNKT_PFAD = [...HUELLE_PFAD, ...pfadImBauteil(PUNKT_EL)];

// ------------------------------------------------------------------------------------------------
// Die wirksame Farbe: was modern.css für den Pfad setzt, schlägt die Utility (Attribut + Klassen).
// ------------------------------------------------------------------------------------------------
function wirksam(
  pfad: string[][],
  eigenschaft: "background-color" | "color" | "border-color",
  praefix: Praefix,
  thema: Thema,
): { farbe: Rgb; herkunft: string } {
  const klassen = pfad[pfad.length - 1] ?? [];
  if (thema === "modern") {
    const d = deklaration(pfad, eigenschaft);
    const geparst = d ? farbeAusCss(d.wert, thema) : null;
    if (d && geparst && geparst.alpha >= 1) {
      return { farbe: geparst.farbe, herkunft: `modern.css → ${d.selektor} { ${eigenschaft} }` };
    }
  }
  const utility = letzteUtilityFarbe(klassen, praefix, thema);
  if (!utility) {
    throw new Error(`${eigenschaft} für [${klassen.join(" ")}] nicht auflösbar (${thema})`);
  }
  return { farbe: utility, herkunft: `Tailwind ${praefix}-…` };
}

const KREIS_FLAECHE = wirksam(KREIS_PFAD, "background-color", "bg", "modern");
const KREIS_SCHRIFT = wirksam(KREIS_PFAD, "color", "text", "modern");

// ================================================================================================
describe("JOB 3085 · Q4 · der Konto-Kreis: Funke als Fläche, Nacht als Schrift (Entscheidung 21)", () => {
  // ---- Selbstschutz: misst dieser Test überhaupt das richtige Element? --------------------------
  it("Kalibrierung: das gemessene Element IST der Konto-Kreis, und sein DOM-Pfad hängt am Kopfband", () => {
    expect(tagName(KONTO_EL)).toBe("button");
    expect(KONTO_KLASSEN, "die Marker-Klasse des Kreises").toContain("kw-konto-kreis");
    expect(KONTO_KLASSEN, "die Markenfläche").toContain("bg-brand");
    // Der Pfad reicht wirklich bis zum Kopfband — sonst wären Nachfahren-Regeln unwirksam.
    expect(klassenVon(KOPFBAND_EL)).toContain("kw-kopfband");
    expect(KREIS_PFAD[0]).toEqual(klassenVon(KOPFBAND_EL));
    expect(KREIS_PFAD[KREIS_PFAD.length - 1]).toEqual(KONTO_KLASSEN);
    expect(KREIS_PFAD.length).toBeGreaterThanOrEqual(4);
    // Und die Rechnung selbst trifft die bekannten Zahlen (dieselbe Kalibrierung wie mega41):
    expect(kontrast([255, 255, 255], token("modern", "brand"))).toBeCloseTo(3.38, 2);
    expect(kontrast([255, 255, 255], token("modern", "funke-deep"))).toBeCloseTo(4.72, 2);
  });

  // ---- FALL A ----------------------------------------------------------------------------------
  it("A · die wirksame Fläche des Kreises ist im modernen Thema der Funke #E8630A", () => {
    expect(
      hex(KREIS_FLAECHE.farbe),
      `Fläche kommt aus: ${KREIS_FLAECHE.herkunft} — das Mockup Main.dc.html Z.32 nennt #E8630A`,
    ).toBe("#E8630A");
    expect(KREIS_FLAECHE.farbe).toEqual(token("modern", "brand"));
    // Und sie kommt NICHT mehr aus der mega41-Ausnahmeregel: der Kreis verlässt die Bauform,
    // statt sie auszuhebeln (Ablösung, Auftrag Prüfpunkt 7).
    expect(KREIS_FLAECHE.farbe).not.toEqual(token("modern", "funke-deep"));
    expect(
      KONTO_KLASSEN,
      "`text-white` würde den Kreis zurück in die mega41-Bauform ziehen",
    ).not.toContain("text-white");
  });

  // ---- FALL B ----------------------------------------------------------------------------------
  it("B · die wirksame Schriftfarbe im Kreis ist Nacht #0E1626", () => {
    expect(
      hex(KREIS_SCHRIFT.farbe),
      `Schrift kommt aus: ${KREIS_SCHRIFT.herkunft} — Entscheidung 21 bestimmt Nacht-Initialen`,
    ).toBe("#0E1626");
    expect(KREIS_SCHRIFT.farbe).toEqual(token("modern", "ink"));
  });

  // ---- FALL C ----------------------------------------------------------------------------------
  it("C · der gerechnete Kontrast Schrift↔Fläche ist 5,3–5,4:1 und damit über AA (4,5:1)", () => {
    const wert = kontrast(KREIS_SCHRIFT.farbe, KREIS_FLAECHE.farbe);
    const meldung = `${hex(KREIS_SCHRIFT.farbe)} auf ${hex(KREIS_FLAECHE.farbe)} = ${wert.toFixed(2)}:1`;
    expect(wert, meldung).toBeGreaterThanOrEqual(4.5);
    // Die ZAHL, nicht nur die Schwelle: eine andere Paarung, die zufällig auch über 4,5 läge,
    // fällt hier auf (Weiß auf Funke dunkel misst 4,72:1 — außerhalb dieses Fensters).
    expect(wert, meldung).toBeGreaterThan(5.3);
    expect(wert, meldung).toBeLessThan(5.4);
    console.info(`JOB 3085 Q4 · Kreis modern: ${meldung} (Fläche: ${KREIS_FLAECHE.herkunft})`);
  });

  // ---- Lieferung 4: der Fokusring, gemessen ------------------------------------------------------
  it("D · der Fokusring bleibt sichtbar: Funke gegen das Nachtband ≥3:1 (Ring sitzt wegen offset-2 dort)", () => {
    expect(KONTO_KLASSEN, "der Ring hat 2px Versatz und liegt damit auf dem Band").toContain(
      "focus-visible:outline-offset-2",
    );
    const ring = zustandsFarbe(KONTO_KLASSEN, "focus-visible", "outline", "modern");
    const band = wirksam(HUELLE_PFAD.slice(0, 1), "background-color", "bg", "modern");
    const gegenBand = kontrast(ring, band.farbe);
    const gegenKreis = kontrast(ring, KREIS_FLAECHE.farbe);
    expect(hex(band.farbe), "das Kopfband ist die Nachtfläche").toBe("#0E1626");
    expect(gegenBand, `Ring ${hex(ring)} auf Band ${hex(band.farbe)}`).toBeGreaterThanOrEqual(3);
    // Ehrlich benannt: gegen die KREISFLÄCHE hat der Ring nach Entscheidung 21 keinen Kontrast
    // mehr (gleiche Farbe). Sichtbar ist er über den 2px-Spalt auf dem Band — genau das misst der
    // Fall, und genau deshalb steht die 1,00 hier als Zusicherung, nicht als Fußnote.
    expect(gegenKreis).toBeCloseTo(1, 2);
    console.info(
      `JOB 3085 Q4 · Fokusring ${hex(ring)}: gegen Band ${gegenBand.toFixed(2)}:1 · gegen Kreisfläche ${gegenKreis.toFixed(2)}:1`,
    );
  });

  // ---- Lieferung 4/Prüfpunkt 6(d): der Meldungspunkt auf der nun helleren Fläche ------------------
  it("E · der Meldungspunkt bleibt abgesetzt: sein Nachtrand trägt gegen den Funke ≥3:1", () => {
    const punktKlassen = PUNKT_PFAD[PUNKT_PFAD.length - 1] ?? [];
    expect(punktKlassen).toContain("kw-konto-punkt");
    const fuellung = wirksam(PUNKT_PFAD, "background-color", "bg", "modern");
    const rand = wirksam(PUNKT_PFAD, "border-color", "border", "modern");
    const randGegenKreis = kontrast(rand.farbe, KREIS_FLAECHE.farbe);
    const fuellungGegenKreis = kontrast(fuellung.farbe, KREIS_FLAECHE.farbe);
    // Der Rand ist das trennende Merkmal (modern.css: `.kw-kopfband .kw-konto-punkt` → Nacht).
    expect(rand.herkunft).toContain("modern.css");
    expect(
      randGegenKreis,
      `Rand ${hex(rand.farbe)} auf ${hex(KREIS_FLAECHE.farbe)}`,
    ).toBeGreaterThanOrEqual(3);
    console.info(
      `JOB 3085 Q4 · Meldungspunkt: Füllung ${hex(fuellung.farbe)} ${fuellungGegenKreis.toFixed(2)}:1 · Rand ${hex(rand.farbe)} ${randGegenKreis.toFixed(2)}:1 — gegen den Kreis`,
    );
  });

  // ---- Lieferung 5: das klassische Thema wird ausgewiesen, nicht übergangen -----------------------
  it("F · klassisches Thema: dieselbe Klassenkette misst #16222c auf #ED7D0E und liegt über AA", () => {
    const flaeche = wirksam(KREIS_PFAD, "background-color", "bg", "classic");
    const schrift = wirksam(KREIS_PFAD, "color", "text", "classic");
    const wert = kontrast(schrift.farbe, flaeche.farbe);
    expect(hex(flaeche.farbe)).toBe("#ED7D0E");
    expect(hex(schrift.farbe)).toBe("#16222C");
    expect(wert).toBeGreaterThanOrEqual(4.5);
    // Der Vergleich zum Zustand VOR Entscheidung 21: dort stand Weiß auf demselben Funke — im
    // klassischen Thema ohne jede Hausregel, also mit 2,79:1 deutlich unter AA. Der Wechsel
    // verbessert das klassische Thema; das ist ein Befund, kein stiller Nebeneffekt.
    expect(kontrast([255, 255, 255], flaeche.farbe)).toBeLessThan(3);
    console.info(
      `JOB 3085 Q4 · Kreis klassisch: ${hex(schrift.farbe)} auf ${hex(flaeche.farbe)} = ${wert.toFixed(2)}:1 (vorher Weiß: ${kontrast([255, 255, 255], flaeche.farbe).toFixed(2)}:1)`,
    );
  });

  // ---- Der Leser selbst: keine stille Lücke -------------------------------------------------------
  it("G · der CSS-Leser verschweigt nichts: jede übersprungene Regel ist benannt", () => {
    // Übersprungen werden ausschließlich Formen, die dieser Leser nicht auswerten KANN — und keine
    // davon darf die beiden gemessenen Eigenschaften am Kreis setzen. Wächst eine solche Regel
    // nach, steht sie hier und muss sich erklären.
    const gefaehrlich = NICHT_GELESEN.filter(
      (s) => s.includes("kw-konto") || s.includes("bg-brand"),
    );
    expect(
      gefaehrlich,
      "unlesbare modern.css-Regel am Konto-Kreis oder an der Markenfläche",
    ).toEqual([]);
    expect(MODERN_REGELN.length).toBeGreaterThan(10);
    console.info(
      `JOB 3085 Q4 · modern.css: ${MODERN_REGELN.length} lesbare Regeln, ${NICHT_GELESEN.length} übersprungen (${NICHT_GELESEN.join(" | ")})`,
    );
  });
});
