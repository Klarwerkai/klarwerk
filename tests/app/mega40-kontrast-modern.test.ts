// ================================================================================================
// AUFTRAG-mega40 H3 / AUFTRAG-mega41 BLOCK B — KONTRAST IM MODERN-THEMA: GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// Teil 1 (mega40): dieselbe WCAG-Rechnung wie tests/app/contrast-tokens-d5.test.ts (dort: klassische
// Token), hier gegen den [data-theme="modern"]-Block der Token-Datei.
//
// Teil 2 (mega41, bens sammel39-Blocker): mega40 behandelte Weiß auf reinem Funke (#E8630A, 3,38:1)
// als GRAFIK-Grenze und pinnte sie auf ≥3:1. Das war falsch — im Produkt trägt diese Fläche mehrere
// kleine Texte (aktiver Nav-Eintrag, Rollenname, Benachrichtigungszahl, Palette-Treffer, Facetten-
// Zähler, Filter-Knopf). Der Pin ist deshalb durch einen SAMMLER ersetzt: er findet texttragende
// Akzentflächen über die BAUFORM in apps/web/src (nicht als Liste der heutigen Fälle) und misst für
// jeden Text darauf den Kontrast gegen die im modern-Thema TATSÄCHLICH wirksame Fläche.
//
// ZWEI BAUFORMEN (mega41 Kopf-Entscheidung, nach der Badge-Frage erweitert — nicht die Fall-Liste):
//  (1) MARKENFLÄCHE — `bg-brand` / `bg-brand/NN`.
//  (2) HALBTRANSPARENTE HELLE FLÄCHE — `bg-white/NN`. Dieselbe Klasse von Fehler: die Fläche ist
//      hell, der Text darauf oft ebenfalls hell. Die aktive Nav-Badge (`bg-white/20 text-white`)
//      ist formal keine Markenfläche, trägt aber eine Zahl und lag mit 3,42:1 in genau bens Klasse.
//
// Wie der Sammler arbeitet:
//  1. Roh-Scan: jede Fundstelle beider Bauformen in apps/web/src/**/*.{ts,tsx} (Kommentarzeilen
//     ausgenommen; bei `bg-white/NN` nur die GRUNDklasse, nicht `hover:bg-white/NN`).
//  2. AST-Scan (TypeScript-Parser, ScriptKind.TSX): zu jeder Fundstelle das JSX-Element, seine
//     Klassenmenge, seine JSX-Vorfahren im selben Bauteil und alle Textknoten darin — samt geerbter
//     Textfarbe und Abschwächungen (`text-white/70`, `opacity-90`). Klassen aus einer lokalen
//     Konstanten (`const cls = active ? … : …`) werden aufgelöst; ein doppelt vergebener Name gilt
//     als nicht auflösbar (→ Punkt 3).
//  3. Abgleich 1 ↔ 2: jede Roh-Fundstelle MUSS im AST-Scan auftauchen. Eine Fläche, die der Sammler
//     nicht lesen kann (Klassen aus einem Import, Fläche in einer .ts-Hilfsdatei), ist rot — sie
//     darf nicht still an der Messung vorbeilaufen.
//  4. Wirksame Fläche/Textfarbe: aus styles/modern.css werden die Regeln unter [data-theme="modern"]
//     gelesen und auf den Klassenpfad angewandt. Es wird also die ÜBERSCHRIEBENE Farbe gemessen,
//     nicht die behauptete.
//  5. Texttragend → ≥ 4,5:1. Ohne Text → nur mit benannter, begründeter Ausnahme (GRAFISCH, unten).
//
// Benannte Grenzen des Sammlers (bewusst, damit sie nicht als Abdeckung durchgehen):
//  · Kind-Elemente mit EIGENER Deckfläche (`bg-…`) verlassen die Fläche; ihr Kontrast ist eine
//    andere Frage und wird dort gemessen, wo sie selbst als Fläche auftauchen.
//  · Fremde Komponenten (`<Badge …/>`) als Kinder werden nicht verfolgt — ihr Inhalt steht in einer
//    anderen Funktion. Sie werden gezählt und unten als Grenze festgehalten. (Genau deshalb reicht
//    Bauform 1 nicht: die Badge sitzt zwar auf der Markenfläche, steht aber in einer eigenen
//    Funktion — sie wird als eigene Fläche nach Bauform 2 gemessen.)
//  · Zustandsflächen (`hover:bg-…`) sind keine GRUNDflächen und werden nicht gemessen; für die
//    Markenfläche ist zusätzlich gepinnt, dass es sie dort überhaupt nicht gibt.
//  · Halbtransparente Flächen (`bg-brand/5`, `bg-white/20`) werden über den nächsten DECKENDEN
//    JSX-Vorfahren im selben Bauteil gerechnet; findet sich keiner, gilt die dokumentierte Annahme
//    UNTERGRUND_FUER_ALPHA (Papier). Diese Annahme ist bewusst rot, sobald so eine Fläche HELLEN
//    Text trägt: dann ist der Untergrund nicht mehr bestimmbar, und genau das muss auffallen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(__dirname, "../../apps/web/src");
const REPO = join(__dirname, "../..");

const THEMES = readFileSync(join(WEB_SRC, "styles/themes.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

function block(selector: string): string {
  const start = THEMES.indexOf(`${selector} {`);
  const end = THEMES.indexOf("}", start);
  return THEMES.slice(start, end);
}

const MODERN_BLOCK = block('[data-theme="modern"]');
const ROOT_BLOCK = block(":root");

type Rgb = [number, number, number];

function tokenAus(quelle: string, name: string): Rgb | null {
  const m = quelle.match(new RegExp(`--kw-${name}:\\s*(\\d+) (\\d+) (\\d+);`));
  if (!m?.[1] || !m[2] || !m[3]) {
    return null;
  }
  return [Number.parseInt(m[1], 10), Number.parseInt(m[2], 10), Number.parseInt(m[3], 10)];
}

// Im modern-Thema gilt der modern-Wert, sonst der geerbte klassische (:root).
function modernToken(name: string): Rgb {
  const wert = tokenAus(MODERN_BLOCK, name) ?? tokenAus(ROOT_BLOCK, name);
  if (!wert) {
    throw new Error(`Token --kw-${name} fehlt in themes.css`);
  }
  return wert;
}

function modernTokenStreng(name: string): Rgb {
  const wert = tokenAus(MODERN_BLOCK, name);
  if (!wert) {
    throw new Error(`modern-Token --kw-${name} fehlt`);
  }
  return wert;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// Halbtransparente Farbe auf einem Untergrund: das, was das Auge sieht.
function ueber(farbe: Rgb, alpha: number, grund: Rgb): Rgb {
  return [0, 1, 2].map((i) =>
    Math.round(alpha * (farbe[i] as number) + (1 - alpha) * (grund[i] as number)),
  ) as Rgb;
}

const WEISS: Rgb = [255, 255, 255];

// ================================================================================================
// TEIL 1 (mega40) — die Token selbst.
// ================================================================================================
describe("mega40 H3 · Kontrast der modern-Token (WCAG AA)", () => {
  const papier = modernTokenStreng("page");
  const karte = modernTokenStreng("surface");

  it("Tinte auf Papier und auf Karte: ≥4,5:1", () => {
    const tinte = modernTokenStreng("text");
    expect(contrast(tinte, papier)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tinte, karte)).toBeGreaterThanOrEqual(4.5);
  });

  it("Weiß auf Nacht (Shell-Flächen): ≥4,5:1 — auch die gedämpften Shell-Texte tragen", () => {
    const nacht = modernTokenStreng("night");
    expect(contrast(WEISS, nacht)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(modernTokenStreng("shell-fg"), nacht)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(modernTokenStreng("shell-muted"), nacht)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(modernTokenStreng("shell-muted-2"), nacht)).toBeGreaterThanOrEqual(4.5);
  });

  it("Weiß auf dem Funke-Knopf (Aktionsfläche, Funke dunkel): ≥4,5:1", () => {
    expect(contrast(WEISS, modernTokenStreng("funke-deep"))).toBeGreaterThanOrEqual(4.5);
  });

  it("gedämpfte Texte (muted/muted-2) auf Papier und Karte: ≥4,5:1", () => {
    for (const name of ["muted", "muted-2"]) {
      const ton = modernTokenStreng(name);
      expect(contrast(ton, papier), `${name} auf Papier`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ton, karte), `${name} auf Karte`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("Status-Texte auf ihren Flächen (Gesichert/Warnung/Fehler): ≥4,5:1", () => {
    for (const ton of ["pos", "warn", "crit"]) {
      expect(
        contrast(modernTokenStreng(`trust-${ton}-text`), modernTokenStreng(`trust-${ton}-bg`)),
        `trust-${ton}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("brand-text bleibt im modern-Block unüberschrieben (Funke dunkel wäre auf Papier <4,5:1)", () => {
    expect(MODERN_BLOCK).not.toMatch(/--kw-brand-text:/);
    // Und die Entscheidung stimmt weiterhin: das GEERBTE klassische brand-text trägt auf dem
    // modernen Papier.
    const geerbt = tokenAus(ROOT_BLOCK, "brand-text");
    if (!geerbt) {
      throw new Error("klassisches brand-text fehlt");
    }
    expect(contrast(geerbt, papier)).toBeGreaterThanOrEqual(4.5);
  });
});

// ================================================================================================
// TEIL 2 (mega41 BLOCK B) — der Sammler.
// ================================================================================================

// ---- modern.css als anwendbare Regeln lesen ----------------------------------------------------
type Regel = {
  teile: string[][]; // je Selektor-Teil die geforderten Klassen; [] = Universalselektor `*`
  deklarationen: Map<string, string>;
};

function modernRegeln(): Regel[] {
  const css = readFileSync(join(WEB_SRC, "styles/modern.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const regeln: Regel[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selektorListe = (m[1] ?? "").trim();
    const koerper = m[2] ?? "";
    if (!selektorListe.includes('[data-theme="modern"]')) {
      continue;
    }
    const deklarationen = new Map<string, string>();
    for (const d of koerper.split(";")) {
      const i = d.indexOf(":");
      if (i > 0) {
        deklarationen.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
      }
    }
    for (const einzeln of selektorListe.split(",")) {
      const roh = einzeln.trim().replace('[data-theme="modern"]', "").trim();
      if (roh === "" || /[>+~:[]/.test(roh)) {
        // Kombinatoren/Pseudo/Attribute versteht der Sammler nicht → konservativ ignorieren
        // (er rechnet dann OHNE diese Regel, also eher zu streng als zu milde).
        continue;
      }
      const teile = roh.split(/\s+/).map((teil) => {
        if (teil === "*") {
          return [];
        }
        return teil
          .split(".")
          .filter((k) => k !== "")
          .map((k) => k.replace(/\\/g, ""));
      });
      if (
        teile.some((teil, i) => teil.length === 0 && i === teile.length - 1 && teile.length === 1)
      ) {
        continue; // ein alleinstehendes `*` ist zu grob, um es zuzuordnen
      }
      regeln.push({ teile, deklarationen });
    }
  }
  return regeln;
}

const MODERN_REGELN = modernRegeln();

// Passt eine Regel auf das letzte Element eines Klassen-Pfades? (Nachkommen-Kombinator, in Reihenfolge.)
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
      return false; // Vorfahre außerhalb des bekannten Pfades → Regel nicht sicher anwendbar
    }
  }
  return true;
}

// Letzte passende Deklaration (Dateireihenfolge = Kaskade; alle Regeln hier sind Klassen-Selektoren
// unter demselben Attribut, also gleich spezifisch genug für „später gewinnt").
function deklarationFuer(pfad: string[][], eigenschaft: string): string | null {
  let wert: string | null = null;
  for (const regel of MODERN_REGELN) {
    const d = regel.deklarationen.get(eigenschaft);
    if (d !== undefined && regelPasst(regel, pfad)) {
      wert = d;
    }
  }
  return wert;
}

// `rgb(var(--kw-x))`, `rgb(var(--kw-x) / 0.3)`, `rgb(255 255 255)`, `rgb(255 255 255 / 0.14)`
function farbeAusCss(wert: string): { farbe: Rgb; alpha: number } | null {
  const varM = wert.match(/rgb\(\s*var\(--kw-([a-z0-9-]+)\)\s*(?:\/\s*([0-9.]+)\s*)?\)/);
  if (varM?.[1]) {
    return { farbe: modernToken(varM[1]), alpha: varM[2] ? Number.parseFloat(varM[2]) : 1 };
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

// ---- Tailwind-Klassen als Farben lesen ---------------------------------------------------------
// `text-…`/`bg-…` bilden 1:1 auf `--kw-…` ab (tailwind.config.ts: token(name)); dazu Weiß/Schwarz
// und der Alpha-Modifier `/NN`. Alles andere hinter `text-` muss eine BEKANNTE Nicht-Farbe sein —
// sonst ist der Sammler rot, statt eine unbekannte Textfarbe stillschweigend zu übergehen.
const KEINE_FARBE = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "micro",
  "left",
  "center",
  "right",
  "justify",
  "start",
  "end",
  "nowrap",
  "wrap",
  "balance",
  "pretty",
  "ellipsis",
  "clip",
  "transparent",
]);

function farbKlasse(klasse: string, praefix: "text" | "bg"): { farbe: Rgb; alpha: number } | null {
  if (!klasse.startsWith(`${praefix}-`)) {
    return null;
  }
  const rest = klasse.slice(praefix.length + 1);
  const [name, alphaTeil] = rest.split("/");
  if (name === undefined || name.startsWith("[")) {
    return null;
  }
  const alpha = alphaTeil ? Number.parseInt(alphaTeil, 10) / 100 : 1;
  if (name === "white") {
    return { farbe: WEISS, alpha };
  }
  if (name === "black") {
    return { farbe: [0, 0, 0], alpha };
  }
  const token = tokenAus(MODERN_BLOCK, name) ?? tokenAus(ROOT_BLOCK, name);
  if (token) {
    return { farbe: token, alpha };
  }
  if (praefix === "text" && !KEINE_FARBE.has(name)) {
    throw new Error(
      `unbekannte Textklasse \`${klasse}\` — Farbe oder Nicht-Farbe? (Sammler-Lücke)`,
    );
  }
  return null;
}

function opacityKlasse(klasse: string): number | null {
  const m = klasse.match(/^opacity-(\d+)$/);
  return m?.[1] ? Number.parseInt(m[1], 10) / 100 : null;
}

// ---- Der TSX-Scan ------------------------------------------------------------------------------
type Textfund = {
  quelle: string; // was da steht (gekürzt) — für lesbare Fehlermeldungen
  farbe: Rgb;
  alpha: number;
};

type Akzentflaeche = {
  datei: string;
  zeile: number;
  klassen: string[]; // die Klassen des Elements selbst
  zweige: string[]; // unter welchen bedingten Zweigen die Fläche steht (Paarung mit Kind/Vorfahr)
  vorfahren: string[][]; // Klassenmengen der JSX-Vorfahren im selben Bauteil, außen → innen
  flaechenKlasse: string; // bg-brand, bg-brand/NN oder bg-white/NN
  texte: Textfund[];
  komponentenKinder: string[];
  eigenflaechenKinder: string[];
};

function dateienUnter(dir: string, endungen: string[]): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir)) {
    const p = join(dir, eintrag);
    if (statSync(p).isDirectory()) {
      out.push(...dateienUnter(p, endungen));
    } else if (endungen.some((e) => eintrag.endsWith(e))) {
      out.push(p);
    }
  }
  return out;
}

// Bauform 1: Markenfläche. Bauform 2: halbtransparente helle Fläche (s. Kopf).
const BRAND_FLAECHE = /^bg-brand(\/\d+)?$/;
const ALPHA_WEISS_FLAECHE = /^bg-white\/\d+$/;

function istBrandKlasse(klasse: string): boolean {
  return BRAND_FLAECHE.test(klasse);
}

function istFlaechenKlasse(klasse: string): boolean {
  return BRAND_FLAECHE.test(klasse) || ALPHA_WEISS_FLAECHE.test(klasse);
}

// Lokale Klassen-Konstanten der gerade gelesenen Datei (`const cls = active ? "…" : "…"`).
// Ein doppelt vergebener Name ist NICHT auflösbar (null) — der Sammler rät nicht, welcher gilt;
// die Fläche fällt dann in Punkt 3 des Kopfes (unlesbar → rot).
let AKTUELLE_KONSTANTEN = new Map<string, ts.Node | null>();
const KONSTANTEN_STAPEL = new Set<string>();

function klassenKonstanten(quelle: ts.SourceFile): Map<string, ts.Node | null> {
  const map = new Map<string, ts.Node | null>();
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      map.set(n.name.text, map.has(n.name.text) ? null : n.initializer);
    }
    ts.forEachChild(n, besuche);
  };
  besuche(quelle);
  return map;
}

// Klassen-Strings eines className-Ausdrucks. Jeder String merkt sich, unter WELCHEN Zweigen er
// steht: `<Bedingungstext>#t` / `#f`. Damit lassen sich Fläche und Kind PAAREN — steht die
// Markenfläche unter `isActive#t`, dann gilt für den Text darauf auch nur der `isActive#t`-Zweig.
// Ohne diese Paarung meldete der Sammler die Farbe des INAKTIVEN Zustands (gemessen an
// CommandPalette: 2,03:1 statt der wahren 2,36:1) — dieselbe Fläche, die falsche Zahl.
type Klassenteil = { text: string; zweige: string[]; pos: number };

function klassenStrings(node: ts.Node, zweige: string[], out: Klassenteil[]): void {
  if (ts.isIdentifier(node)) {
    const init = AKTUELLE_KONSTANTEN.get(node.text);
    if (init && !KONSTANTEN_STAPEL.has(node.text)) {
      KONSTANTEN_STAPEL.add(node.text);
      klassenStrings(init, zweige, out);
      KONSTANTEN_STAPEL.delete(node.text);
    }
    return;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push({ text: node.text, zweige, pos: node.getStart() });
    return;
  }
  if (ts.isTemplateExpression(node)) {
    out.push({ text: node.head.text, zweige, pos: node.getStart() });
    for (const span of node.templateSpans) {
      klassenStrings(span.expression, zweige, out);
      out.push({ text: span.literal.text, zweige, pos: span.literal.getStart() });
    }
    return;
  }
  if (ts.isConditionalExpression(node)) {
    const bedingung = node.condition.getText().replace(/\s+/g, " ");
    klassenStrings(node.whenTrue, [...zweige, `${bedingung}#t`], out);
    klassenStrings(node.whenFalse, [...zweige, `${bedingung}#f`], out);
    return;
  }
  if (ts.isBinaryExpression(node)) {
    const bedingung = node.left.getText().replace(/\s+/g, " ");
    klassenStrings(node.right, [...zweige, `${bedingung}#t`], out);
    return;
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const el of node.elements) {
      klassenStrings(el, zweige, out);
    }
    return;
  }
  if (ts.isCallExpression(node)) {
    for (const arg of [node.expression, ...node.arguments]) {
      klassenStrings(arg, zweige, out);
    }
    return;
  }
  if (ts.isPropertyAccessExpression(node)) {
    klassenStrings(node.expression, zweige, out);
    return;
  }
  if (ts.isParenthesizedExpression(node)) {
    klassenStrings(node.expression, zweige, out);
    return;
  }
  if (ts.isArrowFunction(node)) {
    klassenStrings(node.body, zweige, out);
    return;
  }
  if (ts.isJsxExpression(node) && node.expression) {
    klassenStrings(node.expression, zweige, out);
  }
}

// Widerspricht ein Klassenteil den Zweigen der Fläche? (Gleiche Bedingung, anderer Ausgang.)
function widerspricht(teil: Klassenteil, aktiv: string[]): boolean {
  return teil.zweige.some((z) => {
    const bedingung = z.slice(0, z.lastIndexOf("#"));
    return aktiv.some((a) => a.slice(0, a.lastIndexOf("#")) === bedingung && a !== z);
  });
}

function tags(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxTagNameExpression {
  return ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
}

function classNameAusdruck(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.Node | null {
  const attrs = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
  for (const a of attrs.properties) {
    if (ts.isJsxAttribute(a) && a.name.getText() === "className" && a.initializer) {
      return a.initializer;
    }
  }
  return null;
}

function klassenteile(node: ts.JsxElement | ts.JsxSelfClosingElement): Klassenteil[] {
  const ausdruck = classNameAusdruck(node);
  if (!ausdruck) {
    return [];
  }
  const teile: Klassenteil[] = [];
  klassenStrings(ausdruck, [], teile);
  return teile;
}

// Klassenmenge einer FLÄCHE: unbedingte Teile + der Zweig, der die Flächenklasse trägt.
// Rückgabe zusätzlich: unter welchen Zweigen diese Fläche steht (für die Paarung mit Kindern).
function flaechenKlassen(node: ts.JsxElement | ts.JsxSelfClosingElement): {
  klassen: string[];
  zweige: string[];
  pos: number | null;
} {
  const teile = klassenteile(node);
  const traeger = teile.find((t) => t.text.split(/\s+/).some(istFlaechenKlasse));
  const aktiv = traeger?.zweige ?? [];
  const klassen: string[] = [];
  for (const t of teile) {
    const tokens = t.text.split(/\s+/).filter((k) => k !== "");
    if (t.zweige.length > 0 && !tokens.some(istFlaechenKlasse)) {
      continue;
    }
    klassen.push(...tokens);
  }
  return { klassen, zweige: aktiv, pos: traeger?.pos ?? null };
}

// Klassenmenge eines VORFAHREN oder KINDES, gepaart mit den Zweigen der Fläche: Teile aus einem
// widersprechenden Zweig (gleiche Bedingung, anderer Ausgang) fallen weg. Alles Übrige zählt —
// konservativ: mehr Farbquellen sichtbar. Bleibt eine Bedingung ohne Gegenstück, gilt weiter
// „letzte gewinnt"; das ist die benannte Restgrenze dieser Paarung.
function klassenVon(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  aktiveZweige: string[],
): string[] {
  const klassen: string[] = [];
  for (const t of klassenteile(node)) {
    if (widerspricht(t, aktiveZweige)) {
      continue;
    }
    klassen.push(...t.text.split(/\s+/).filter((k) => k !== ""));
  }
  return klassen;
}

type Sammelzustand = {
  pfad: string[][];
  farbe: Rgb | null;
  farbAlpha: number;
  opacity: number;
};

function farbzustand(klassen: string[], vorher: Sammelzustand): Sammelzustand {
  let farbe = vorher.farbe;
  let farbAlpha = vorher.farbAlpha;
  let opacity = vorher.opacity;
  for (const k of klassen) {
    const f = farbKlasse(k, "text");
    if (f) {
      farbe = f.farbe;
      farbAlpha = f.alpha;
    }
    const o = opacityKlasse(k);
    if (o !== null) {
      opacity *= o;
    }
  }
  const pfad = [...vorher.pfad, klassen];
  // Was modern.css für DIESEN Knoten setzt, schlägt die Utility-Klasse (Spezifität: Attribut + Klassen).
  const cssFarbe = deklarationFuer(pfad, "color");
  if (cssFarbe) {
    const parsed = farbeAusCss(cssFarbe);
    if (parsed) {
      farbe = parsed.farbe;
      farbAlpha = parsed.alpha;
    }
  }
  const cssOpacity = deklarationFuer(pfad, "opacity");
  if (cssOpacity) {
    opacity = Number.parseFloat(cssOpacity);
  }
  return { pfad, farbe, farbAlpha, opacity };
}

// Ein Kind mit eigener Deckfläche verlässt die Fläche des Elternteils. `bg-brand` auf `bg-brand`
// ist dieselbe Farbe und damit kein Verlassen; eine halbtransparente helle Fläche dagegen SCHON —
// sie wird als eigene Fläche gesammelt und dort gemessen.
function hatEigenflaeche(klassen: string[]): boolean {
  return klassen.some((k) => /^bg-/.test(k) && k !== "bg-transparent" && !istBrandKlasse(k));
}

function textQuelle(node: ts.Node): string {
  return node.getText().replace(/\s+/g, " ").trim().slice(0, 60);
}

// Läuft die Kinder eines Elements ab und sammelt jeden Textknoten mit seiner geerbten Farbe.
function sammleTexte(
  kinder: readonly ts.JsxChild[],
  zustand: Sammelzustand,
  fund: Akzentflaeche,
): void {
  for (const kind of kinder) {
    if (ts.isJsxText(kind)) {
      if (kind.text.trim() !== "") {
        pushText(kind, zustand, fund);
      }
      continue;
    }
    if (ts.isJsxExpression(kind)) {
      const e = kind.expression;
      if (!e) {
        continue;
      }
      const jsxDrin: ts.Node[] = [];
      const suche = (n: ts.Node): void => {
        if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) {
          jsxDrin.push(n);
          return;
        }
        ts.forEachChild(n, suche);
      };
      ts.forEachChild(e, suche);
      if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) {
        jsxDrin.push(e);
      }
      if (jsxDrin.length === 0) {
        pushText(kind, zustand, fund); // {count}, {t("…")}, {it.label} → Text
        continue;
      }
      for (const n of jsxDrin) {
        besucheKind(n, zustand, fund);
      }
      continue;
    }
    besucheKind(kind, zustand, fund);
  }
}

function besucheKind(kind: ts.Node, zustand: Sammelzustand, fund: Akzentflaeche): void {
  if (ts.isJsxFragment(kind)) {
    sammleTexte(kind.children, zustand, fund);
    return;
  }
  if (!ts.isJsxElement(kind) && !ts.isJsxSelfClosingElement(kind)) {
    return;
  }
  const name = tags(kind).getText();
  if (/^[A-Z]/.test(name)) {
    fund.komponentenKinder.push(name); // fremde Komponente → Grenze, nicht verfolgbar
    return;
  }
  const klassen = klassenVon(kind, fund.zweige);
  if (hatEigenflaeche(klassen)) {
    fund.eigenflaechenKinder.push(`<${name} class="${klassen.join(" ")}">`); // eigene Fläche → Grenze
    return;
  }
  const naechster = farbzustand(klassen, zustand);
  if (ts.isJsxElement(kind)) {
    sammleTexte(kind.children, naechster, fund);
  }
}

function pushText(node: ts.Node, zustand: Sammelzustand, fund: Akzentflaeche): void {
  if (!zustand.farbe) {
    throw new Error(
      `${fund.datei}:${fund.zeile} — Text \`${textQuelle(node)}\` auf einer Brand-Fläche ohne bestimmbare Textfarbe`,
    );
  }
  fund.texte.push({
    quelle: textQuelle(node),
    farbe: zustand.farbe,
    alpha: zustand.farbAlpha * zustand.opacity,
  });
}

// Die JSX-Vorfahren eines Elements INNERHALB desselben Bauteils (außen → innen). Über die
// Funktionsgrenze hinaus gibt es keinen Pfad — genau das macht die Badge zu einer eigenen Fläche.
function vorfahrenKlassen(node: ts.Node, aktiveZweige: string[]): string[][] {
  const pfad: string[][] = [];
  let p: ts.Node | undefined = node.parent;
  while (p) {
    if (ts.isJsxElement(p)) {
      pfad.unshift(klassenVon(p, aktiveZweige));
    }
    p = p.parent;
  }
  return pfad;
}

// Eine Quelle (Datei ODER Prüfstück aus dem Test) nach beiden Bauformen absuchen.
function scanneQuelle(rel: string, text: string): Akzentflaeche[] {
  const quelle = ts.createSourceFile(rel, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const vorher = AKTUELLE_KONSTANTEN;
  AKTUELLE_KONSTANTEN = klassenKonstanten(quelle);
  const funde: Akzentflaeche[] = [];
  const besuche = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const { klassen, zweige, pos: treffer } = flaechenKlassen(node);
      const flaeche = klassen.find(istFlaechenKlasse);
      if (flaeche) {
        const pos = treffer ?? node.getStart();
        const vorfahren = vorfahrenKlassen(node, zweige);
        const fund: Akzentflaeche = {
          datei: rel,
          zeile: quelle.getLineAndCharacterOfPosition(pos).line + 1,
          klassen,
          zweige,
          vorfahren,
          flaechenKlasse: flaeche,
          texte: [],
          komponentenKinder: [],
          eigenflaechenKinder: [],
        };
        // Textfarbe wird vererbt: der Zustand beginnt bei den Vorfahren, nicht bei der Fläche.
        let zustand: Sammelzustand = { pfad: [], farbe: null, farbAlpha: 1, opacity: 1 };
        for (const k of vorfahren) {
          zustand = farbzustand(k, zustand);
        }
        const start = farbzustand(klassen, zustand);
        if (ts.isJsxElement(node)) {
          sammleTexte(node.children, start, fund);
        }
        funde.push(fund);
      }
    }
    ts.forEachChild(node, besuche);
  };
  besuche(quelle);
  AKTUELLE_KONSTANTEN = vorher;
  return funde;
}

// Roh-Fundstellen der Bauformen in EINER Zeile. `bg-white/NN` zählt nur als GRUNDklasse — mit
// Zustandspräfix (`hover:`) ist es keine Grundfläche (s. Kopf).
const ROH_BRAND = /\bbg-brand\b/;
const ROH_ALPHA_WEISS = /(^|[^:\w-])bg-white\/\d+/;

function sammleAkzentflaechen(): { funde: Akzentflaeche[]; rohZeilen: string[] } {
  const dateien = dateienUnter(WEB_SRC, [".ts", ".tsx"]);
  const funde: Akzentflaeche[] = [];
  const rohZeilen: string[] = [];

  for (const datei of dateien) {
    const text = readFileSync(datei, "utf8");
    const rel = relative(REPO, datei);
    text.split("\n").forEach((zeile, i) => {
      const t = zeile.trim();
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) {
        return;
      }
      if (ROH_BRAND.test(zeile) || ROH_ALPHA_WEISS.test(zeile)) {
        rohZeilen.push(`${rel}:${i + 1}`);
      }
    });
    if (!datei.endsWith(".tsx") || !(ROH_BRAND.test(text) || ROH_ALPHA_WEISS.test(text))) {
      continue;
    }
    funde.push(...scanneQuelle(rel, text));
  }
  return { funde, rohZeilen };
}

// Die wirksame Fläche im modern-Thema: was modern.css für den Klassenpfad setzt, sonst das
// Tailwind-Token. Halbtransparente Flächen werden über den nächsten deckenden JSX-Vorfahren
// gerechnet; gibt es keinen, gilt die dokumentierte Annahme (Papier) — s. Kopf.
const UNTERGRUND_FUER_ALPHA = modernTokenStreng("page");

// Deckende Fläche einer Klassenmenge (an ihrer Stelle im Pfad), sonst null.
function deckendeFlaeche(pfad: string[][]): { farbe: Rgb; herkunft: string } | null {
  const klassen = pfad[pfad.length - 1] ?? [];
  const ausCss = deklarationFuer(pfad, "background-color");
  const parsed = ausCss ? farbeAusCss(ausCss) : null;
  if (parsed) {
    return parsed.alpha >= 1 ? { farbe: parsed.farbe, herkunft: `modern.css → ${ausCss}` } : null;
  }
  for (const k of klassen) {
    const f = farbKlasse(k, "bg");
    if (f?.alpha === 1) {
      return { farbe: f.farbe, herkunft: `Tailwind ${k}` };
    }
  }
  return null;
}

function wirksameFlaeche(fund: Akzentflaeche): { farbe: Rgb; herkunft: string } {
  const pfad = [...fund.vorfahren, fund.klassen];
  const ausCss = deklarationFuer(pfad, "background-color");
  const parsed = ausCss ? farbeAusCss(ausCss) : null;
  const basis = parsed ?? farbKlasse(fund.flaechenKlasse, "bg");
  if (!basis) {
    throw new Error(`Fläche von ${fund.datei}:${fund.zeile} nicht auflösbar`);
  }
  const herkunft = parsed ? `modern.css → ${ausCss}` : `Tailwind ${fund.flaechenKlasse}`;
  if (basis.alpha >= 1) {
    return { farbe: basis.farbe, herkunft };
  }
  for (let i = fund.vorfahren.length; i > 0; i--) {
    const grund = deckendeFlaeche(fund.vorfahren.slice(0, i));
    if (grund) {
      return {
        farbe: ueber(basis.farbe, basis.alpha, grund.farbe),
        herkunft: `${herkunft} über ${grund.herkunft}`,
      };
    }
  }
  return {
    farbe: ueber(basis.farbe, basis.alpha, UNTERGRUND_FUER_ALPHA),
    herkunft: `${herkunft} über Papier (ANNAHME: kein deckender Untergrund im Bauteil bestimmbar)`,
  };
}

// ---- Benannte, begründete Ausnahmen: REIN GRAFISCHE Akzentflächen ------------------------------
// Nur Flächen OHNE jeden Text. Jede Ausnahme nennt Datei, Klassenmenge und Grund und passt nur auf
// GENAU diese Klassenmenge (keine Teilmenge — eine Ausnahme darf nicht nebenbei die nächste Fläche
// mitbefreien, die zufällig dieselben Klassen plus Text trägt). Eine Ausnahme, die doch Text trägt,
// ist rot — und eine Ausnahme, die niemand mehr braucht, ebenfalls.
const GRAFISCHE_AUSNAHMEN: { datei: string; klassen: string; grund: string }[] = [
  {
    datei: "apps/web/src/pages/Analytics.tsx",
    klassen: "h-full rounded-full bg-brand",
    grund:
      "Balkenfüllung im Wissensarten-Diagramm: reine Länge auf bg-page-Schiene, kein Text darin " +
      "(die Zahl steht als text-muted-2 DANEBEN, auf Papier).",
  },
  {
    datei: "apps/web/src/pages/Lifecycle.tsx",
    klassen: "h-full rounded-full bg-brand",
    grund:
      "Fortschrittsbalken des Lebenszyklus-Pfades: reine Länge auf bg-page-Schiene, kein Text darin " +
      "(der Zähler steht als text-muted-2 daneben).",
  },
  {
    datei: "apps/web/src/shell/Sidebar.tsx",
    klassen: "ml-auto grid h-[17px] w-[17px] place-items-center rounded-pill bg-white/20",
    grund:
      "Ladepunkt-Rahmen der Nav-Badge (BadgeLoading): trägt KEINE Zahl, sondern nur den pulsierenden " +
      "Punkt als eigenes Kind. Die Bedeutung liegt in title/aria-label, nicht auf der Fläche.",
  },
  {
    datei: "apps/web/src/shell/Sidebar.tsx",
    klassen: "h-1.5 w-1.5 animate-pulse rounded-full bg-white/70",
    grund:
      "Der pulsierende Punkt selbst (BadgeLoading): reine Form ohne Text; auf der aktiven Nav-Zeile " +
      "(Funke dunkel) misst er als NICHT-Text 3,79:1 und liegt damit über der 3:1-Grenze.",
  },
  {
    datei: "apps/web/src/shell/Sidebar.tsx",
    klassen:
      "grid h-[27px] w-[27px] shrink-0 place-items-center rounded-[8px] bg-white/15 text-white",
    grund:
      "Icon-Kachel der aktiven Nav-Zeile: trägt ein Symbol (lucide, currentColor), keinen Text. Weiß " +
      "auf dieser Kachel über Funke dunkel misst 3,72:1 — über der 3:1-Grenze für Nicht-Text (1.4.11).",
  },
];

const { funde: AKZENTFLAECHEN, rohZeilen: ROH_ZEILEN } = sammleAkzentflaechen();

function signatur(fund: Akzentflaeche): string {
  return `${fund.datei}::${fund.klassen.join(" ")}`;
}

// Die Messung selbst — von den Produktflächen UND von der Kalibrierung im Test benutzt.
function messeTexte(flaechen: Akzentflaeche[]): string[] {
  const rot: string[] = [];
  for (const fund of flaechen) {
    if (fund.texte.length === 0) {
      continue;
    }
    const flaeche = wirksameFlaeche(fund);
    for (const text of fund.texte) {
      const sichtbar = text.alpha >= 1 ? text.farbe : ueber(text.farbe, text.alpha, flaeche.farbe);
      const wert = contrast(sichtbar, flaeche.farbe);
      if (wert < 4.5) {
        rot.push(
          `${fund.datei}:${fund.zeile} [${fund.flaechenKlasse}] Text \`${text.quelle}\` → ` +
            `${wert.toFixed(2)}:1 (Fläche: ${flaeche.herkunft})`,
        );
      }
    }
  }
  return rot;
}

function klassenSchluessel(klassen: string[]): string {
  return [...new Set(klassen)].sort().join(" ");
}

function ausnahmeFuer(fund: Akzentflaeche): (typeof GRAFISCHE_AUSNAHMEN)[number] | undefined {
  const schluessel = klassenSchluessel(fund.klassen);
  return GRAFISCHE_AUSNAHMEN.find(
    (a) => a.datei === fund.datei && klassenSchluessel(a.klassen.split(/\s+/)) === schluessel,
  );
}

describe("mega41 B · SAMMLER: texttragende Akzentflächen tragen im modern-Thema AA", () => {
  it("der Sammler erreicht JEDE Fundstelle beider Bauformen in apps/web/src (keine stille Lücke)", () => {
    const erfasst = new Set(AKZENTFLAECHEN.map((f) => `${f.datei}:${f.zeile}`));
    const entwischt = ROH_ZEILEN.filter((z) => !erfasst.has(z));
    expect(entwischt, "Akzentflächen-Stelle, die der Sammler nicht lesen konnte").toEqual([]);
    expect(AKZENTFLAECHEN.length).toBeGreaterThan(0);
  });

  it("keine Zustands-Brandfläche (hover:/focus:) — der Sammler misst nur Grundflächen", () => {
    const zustand: string[] = [];
    for (const datei of dateienUnter(WEB_SRC, [".ts", ".tsx"])) {
      const text = readFileSync(datei, "utf8");
      for (const m of text.matchAll(/[a-z-]+:bg-brand(\/\d+)?\b/g)) {
        zustand.push(`${relative(REPO, datei)}: ${m[0]}`);
      }
    }
    expect(zustand, "Zustandsfläche in Markenfarbe — vom Sammler nicht gemessen").toEqual([]);
  });

  it("JEDER Text auf einer Akzentfläche misst ≥4,5:1 gegen die wirksame Fläche", () => {
    expect(messeTexte(AKZENTFLAECHEN), "texttragende Akzentfläche unter AA").toEqual([]);
  });

  it("Akzentflächen OHNE Text nur mit benannter, begründeter Ausnahme", () => {
    const ohneAusnahme: string[] = [];
    for (const fund of AKZENTFLAECHEN) {
      if (fund.texte.length > 0) {
        continue;
      }
      const a = ausnahmeFuer(fund);
      if (!a || a.grund.trim().length < 40) {
        ohneAusnahme.push(`${signatur(fund)} (${fund.datei}:${fund.zeile})`);
      }
    }
    expect(ohneAusnahme, "grafische Akzentfläche ohne benannte Begründung").toEqual([]);
  });

  it("keine Ausnahme deckt eine Fläche, die doch Text trägt — und keine Ausnahme ist unbenutzt", () => {
    const falschBefreit = AKZENTFLAECHEN.filter((f) => f.texte.length > 0 && ausnahmeFuer(f)).map(
      (f) => `${f.datei}:${f.zeile}`,
    );
    expect(falschBefreit, "Ausnahme über einer texttragenden Fläche").toEqual([]);
    const unbenutzt = GRAFISCHE_AUSNAHMEN.filter(
      (a) => !AKZENTFLAECHEN.some((f) => ausnahmeFuer(f) === a),
    ).map((a) => `${a.datei} :: ${a.klassen}`);
    expect(unbenutzt, "Ausnahme ohne Fundstelle — Leiche").toEqual([]);
  });

  it("Kalibrierung: die Rechnung trifft die bekannten Werte (Weiß auf Funke vs. Funke dunkel)", () => {
    expect(contrast(WEISS, modernTokenStreng("brand"))).toBeCloseTo(3.38, 1);
    expect(contrast(WEISS, modernTokenStreng("funke-deep"))).toBeCloseTo(4.72, 1);
    // Und die Abschwächungs-Rechnung: Weiß mit 70 % auf Funke dunkel wäre unter AA — der Sammler
    // erkennt solche Abschwächungen also überhaupt als Problem.
    const schwach = ueber(WEISS, 0.7, modernTokenStreng("funke-deep"));
    expect(contrast(schwach, modernTokenStreng("funke-deep"))).toBeLessThan(4.5);
  });

  it("die Nav-Badge: der alte Weiß-Schleier lag unter AA, die Umkehrung trägt (gemessen)", () => {
    const funkeTief = modernTokenStreng("funke-deep");
    // ALT: `bg-white/20 text-white` auf der aktiven Nav-Zeile (die im modern-Thema Funke dunkel ist).
    const schleier = ueber(WEISS, 0.2, funkeTief);
    expect(contrast(WEISS, schleier)).toBeCloseTo(3.42, 1);
    expect(contrast(WEISS, schleier)).toBeLessThan(4.5);
    // NEU: Papierfläche mit Funke-dunkel-Text — dasselbe Token-Paar wie kw-cta-primary, umgekehrt.
    expect(contrast(funkeTief, modernTokenStreng("surface"))).toBeGreaterThanOrEqual(4.5);
    // Und die beiden benannten NICHT-Text-Ausnahmen derselben Zeile liegen über der 3:1-Grenze.
    expect(contrast(ueber(WEISS, 0.7, funkeTief), funkeTief)).toBeGreaterThanOrEqual(3);
    expect(contrast(WEISS, ueber(WEISS, 0.15, funkeTief))).toBeGreaterThanOrEqual(3);
  });

  // ---- Kalibrierung des SAMMLERS ---------------------------------------------------------------
  // mega41-Regel des Kopfes: die Probe entsteht IM TEST, nicht als Datei im Produktbaum. Sie läuft
  // durch exakt dieselbe Bauform-Erkennung und dieselbe Messung wie die echten Flächen.
  const PROBE = `
export function Probe(): JSX.Element {
  const pille = aktiv ? "rounded-pill bg-white/25 text-white" : "bg-hairline text-muted";
  return (
    <div className="rounded-card bg-surface p-3">
      <span className="rounded-pill bg-brand px-2 py-0.5 text-[11px] text-surface">7</span>
      <span className={\`ml-auto font-mono text-[10.5px] \${pille}\`}>3</span>
      <span className="rounded-pill bg-white/20 px-1.5 text-[10.5px] text-white">4</span>
      <div className="h-2 w-full rounded-full bg-brand" />
      <button type="button" className="rounded-btn bg-brand px-3 text-white">Los</button>
    </div>
  );
}`;

  it("Kalibrierung: die texttragenden Proben schlagen an, die grafische und die geheilte nicht", () => {
    const funde = scanneQuelle("PROBE.tsx", PROBE);
    // Beide Bauformen werden erkannt — auch die, deren Klassen in einer lokalen Konstanten stehen.
    expect(funde.map((f) => f.flaechenKlasse)).toEqual([
      "bg-brand",
      "bg-white/25",
      "bg-white/20",
      "bg-brand",
      "bg-brand",
    ]);
    const rot = messeTexte(funde);
    // (a) Heller Text auf HELLEM Funke schlägt an — die Bauform-Regel in modern.css greift nur für
    //     `text-white`; `text-surface` läuft an ihr vorbei und muss genau deshalb auffallen.
    expect(rot.some((r) => r.includes("[bg-brand] Text `7`") && r.includes("3.38:1"))).toBe(true);
    // (b) Eine halbtransparente helle Fläche mit hellem Text, für die es KEINE modern-Regel gibt:
    //     der Untergrund ist im Bauteil nicht bestimmbar → rot. So wäre die Nav-Badge aufgefallen,
    //     und so fällt die nächste auf, die jemand in einer anderen Alpha-Stufe baut.
    expect(rot.some((r) => r.includes("[bg-white/25] Text `3`"))).toBe(true);
    // (c) KEIN Treffer, wo modern.css die Fläche deckend macht: der Knopf (Funke dunkel) und die
    //     geheilte Badge-Bauform (`bg-white/20 text-white` → Papier + Funke-dunkel-Text).
    expect(rot.some((r) => r.includes("Text `Los`"))).toBe(false);
    expect(rot.some((r) => r.includes("Text `4`"))).toBe(false);
    expect(rot).toHaveLength(2);
    const ohneText = funde.filter((f) => f.texte.length === 0);
    expect(ohneText.map((f) => f.klassen.join(" "))).toEqual(["h-2 w-full rounded-full bg-brand"]);
    // …und eine grafische Fläche ohne benannte Ausnahme bleibt unbefreit.
    expect(ohneText.every((f) => ausnahmeFuer(f) === undefined)).toBe(true);
  });

  // ---- mega42 BLOCK B: DIE VERSCHACHTELTE PROBE — die Kaskaden-Kippkante wird prüfbar ----------
  // bens sammel40-Befund: die Badge-Regel (`.bg-white/20.text-white`, invertiert) MUSS in
  // modern.css NACH der Nachfahrenregel `.bg-brand.text-white *` stehen — gleiche Spezifität,
  // spätere gewinnt. Der Kommentar in modern.css sagt das selbst, aber KEIN Test hielt es fest:
  //  · im Produkt sitzt die Badge als eigene Funktion (`<Badge/>`) auf der aktiven Nav-Zeile — der
  //    Sammler beendet die Verfolgung an fremden Komponenten, der Vorfahrenpfad reißt genau dort ab;
  //  · die geheilte Probe oben liegt in einem `bg-surface`-Container, nicht auf einer Markenfläche.
  // Eine reine Umsortierung der beiden Regelblöcke hätte deshalb den Produktionskontrast der
  // aktiven Nav-Badge gebrochen, während alles Bestehende grün blieb.
  //
  // Diese Probe stellt die Badge als KIND einer texttragenden Markenfläche auf — im Test erzeugt,
  // keine Datei im Produktbaum. Sie läuft durch dieselbe Bauform-Erkennung und dieselbe Messung wie
  // jede echte Fläche; um sie richtig zu rechnen, MUSS der Sammler beide Regeln in Dateireihenfolge
  // auswerten. Das macht die Reihenfolge zu einer Verhaltensprobe statt zu einem Zeilen-Pin.
  const PROBE_VERSCHACHTELT = `
export function ProbeVerschachtelt(): JSX.Element {
  return (
    <div className="rounded-card bg-surface p-2">
      <a className="flex items-center gap-2 rounded-btn bg-brand px-3 py-2 text-[13px] text-white">
        Wissen
        <span className="ml-auto rounded-pill bg-white/20 px-1.5 text-[10.5px] text-white">9</span>
      </a>
    </div>
  );
}`;

  it("Kalibrierung: die verschachtelte Badge auf der Markenfläche trägt (Badge-Regel gewinnt)", () => {
    const funde = scanneQuelle("PROBE-VERSCHACHTELT.tsx", PROBE_VERSCHACHTELT);
    expect(funde.map((f) => f.flaechenKlasse)).toEqual(["bg-brand", "bg-white/20"]);

    const marke = funde.find((f) => f.flaechenKlasse === "bg-brand");
    const badge = funde.find((f) => f.flaechenKlasse === "bg-white/20");
    if (!marke || !badge) {
      throw new Error("verschachtelte Probe nicht erfasst — der Sammler sieht die Bauform nicht");
    }
    // Die Badge steht wirklich INNERHALB der Markenfläche (sonst prüft die Probe nichts) …
    expect(badge.vorfahren.some((v) => v.includes("bg-brand"))).toBe(true);
    // … und ist für die Markenfläche eine Grenze: eigene Fläche, eigener Kontrast.
    expect(marke.eigenflaechenKinder).toHaveLength(1);
    expect(marke.texte.map((t) => t.quelle)).toEqual(["Wissen"]);

    // Gemessen über denselben Codepfad wie alles andere: Papierfläche, Funke-dunkel-Text = 4,72:1.
    // Beides kommt aus der SPÄTEREN Badge-Regel; stünde sie vor `.bg-brand.text-white *`, zöge der
    // Nachfahren-Weißton den Text zurück auf Weiß — auf heller Fläche.
    const flaeche = wirksameFlaeche(badge);
    const text = badge.texte[0];
    if (!text) {
      throw new Error("Badge ohne Text — die Probe misst nichts");
    }
    // Die MESSUNG zuerst: sie ist die Aussage. Vertauscht man die beiden Regelblöcke, meldet sie
    // die Badge mit 1,00:1 — Weiß auf der weißen Papierfläche, die Zahl verschwindet vollständig.
    // Die Meldung nennt Datei, Zeile, Wert und Herkunft der Fläche (mega42 B, vorgeführt im Bericht).
    expect(messeTexte(funde), "verschachtelte Probe unter AA").toEqual([]);
    expect(contrast(text.farbe, flaeche.farbe)).toBeCloseTo(4.72, 1);
    // Und dieselbe Aussage noch einmal als Identität, damit im Rot sofort lesbar ist, WELCHE der
    // beiden Regeln gewonnen hat.
    expect(flaeche.farbe).toEqual(modernTokenStreng("surface"));
    expect(text.farbe).toEqual(modernTokenStreng("funke-deep"));
  });
});

// ================================================================================================
// TEIL 3 (mega42 BLOCK A) — DIE BAUFORM DER DECKKRAFT-REGEL: GEZIELT, NICHT PAUSCHAL.
// ================================================================================================
//
// mega41 hielt die Abschwächungen auf texttragenden Markenflächen mit `opacity: 1` an — aber auf
// dem Flächenelement SELBST und zusätzlich auf `*`, also auf ausnahmslos jedem Nachfahren.
// bens sammel40-Befund: das ist zu grob. Konkret kollidierte es mit `hover:opacity-95` am
// Filter-Aktionsknopf (FacetFilter): Attribut + zwei Klassen (0,3,0) schlägt Tailwinds
// Hover-Utility (0,2,0) — der Hover-Hinweis war im modern-Thema wirkungslos. Das widersprach dem
// Satz „kein Verhalten ändert sich"; künftige Disabled-/Hover-Zustände und fremde Komponenten mit
// eigener Opazität hätte dieselbe Regel ebenso stillgelegt.
//
// Dieser Sammler prüft deshalb die BAUFORM der Regeln, nicht ihre Zeile: keine Deckkraft-Regel
// darf ihr Ziel als bloßen `*`-Nachfahren oder als Markenflächen-Element selbst haben. WO die
// erlaubte Regel steht und wie sie heißt, ist ihm gleich — er verbietet nur die groben Formen.
type DeckkraftRegel = { selektor: string; deklarationen: Map<string, string> };

// Selektor/Deklarations-Paare aus einer modern-CSS-Quelle, je Komma-Teil einzeln (Kommentare raus).
// Nur Regeln unter [data-theme="modern"] — @keyframes-Schritte (`from`/`to`) fallen damit weg.
function modernPaare(css: string): DeckkraftRegel[] {
  const rein = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const paare: DeckkraftRegel[] = [];
  for (const m of rein.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
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
      paare.push({ selektor: einzeln.trim().replace(/\s+/g, " "), deklarationen });
    }
  }
  return paare;
}

// Das ZIEL eines Selektors ist sein letzter Verbund — nur der entscheidet, WAS die Regel trifft.
function zielVerbund(selektor: string): string {
  const teile = selektor
    .replace('[data-theme="modern"]', "")
    .trim()
    .split(/\s+/)
    .filter((t) => t !== "" && t !== ">" && t !== "+" && t !== "~");
  return teile[teile.length - 1] ?? "";
}

// Trägt der Zielverbund selbst die Markenfläche (`bg-brand`, `bg-brand/NN`)?
function istMarkenflaechenVerbund(verbund: string): boolean {
  return verbund
    .split(".")
    .slice(1)
    .map((k) => k.replace(/\\/g, ""))
    .some((k) => BRAND_FLAECHE.test(k));
}

function grobeDeckkraftRegeln(css: string): string[] {
  const grob: string[] = [];
  for (const regel of modernPaare(css)) {
    if (!regel.deklarationen.has("opacity")) {
      continue;
    }
    const ziel = zielVerbund(regel.selektor);
    if (ziel === "*") {
      grob.push(`${regel.selektor} → trifft jeden Nachfahren (Universalselektor)`);
    } else if (istMarkenflaechenVerbund(ziel)) {
      grob.push(`${regel.selektor} → trifft das Markenflächen-Element selbst`);
    }
  }
  return grob;
}

const MODERN_CSS_ROH = readFileSync(join(WEB_SRC, "styles/modern.css"), "utf8");

describe("mega42 A · Deckkraft-Regeln treffen gezielt, nicht pauschal", () => {
  it("styles/modern.css: keine Deckkraft-Regel auf `*` oder auf der Markenfläche selbst", () => {
    expect(
      grobeDeckkraftRegeln(MODERN_CSS_ROH),
      "zu grobe Deckkraft-Regel — sie legt Hover-/Disabled-Zustände und fremde Opazitäten still",
    ).toEqual([]);
  });

  it("Kalibrierung: genau die alte, grobe Bauform würde gefunden (beide Formen)", () => {
    const probe = `[data-theme="modern"] .bg-brand.text-white,
[data-theme="modern"] .bg-brand.text-white * {
  color: rgb(255 255 255);
  opacity: 1;
}`;
    expect(grobeDeckkraftRegeln(probe)).toEqual([
      '[data-theme="modern"] .bg-brand.text-white → trifft das Markenflächen-Element selbst',
      '[data-theme="modern"] .bg-brand.text-white * → trifft jeden Nachfahren (Universalselektor)',
    ]);
    // Die gezielte Bauform dagegen ist erlaubt: das Ziel ist die abschwächende Klasse.
    const gezielt = `[data-theme="modern"] .bg-brand.text-white .opacity-90 { opacity: 1; }`;
    expect(grobeDeckkraftRegeln(gezielt)).toEqual([]);
    // Und eine Regel ohne Deckkraft interessiert den Sammler nicht.
    const ohne = `[data-theme="modern"] .bg-brand.text-white * { color: rgb(255 255 255); }`;
    expect(grobeDeckkraftRegeln(ohne)).toEqual([]);
  });
});
