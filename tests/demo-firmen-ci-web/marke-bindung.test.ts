// ================================================================================================
// JOB 3511 · L2/L3/L4/L6 — DIE MARKENEBENE HÄNGT AUSSCHLIESSLICH UNTER [data-brand="advisor"].
// ================================================================================================
//
// Diese Datei ist der statische Wächter der Firmen-CI, gebaut in derselben Beweisform wie
// `tests/app/mega40-theme-invarianz.test.ts`: nicht ein Katalog von Fällen, sondern ein SAMMLER
// über die Quelle. Der Auftrag verlangt in Lieferung 6, dass das Ausschalten der Firmen-CI wirklich
// wiederherstellt — „ohne `data-brand` ist KEIN berechneter Wert anders als vor dem Einschalten".
//
// DAS IST KEIN MESS-, SONDERN EIN BINDUNGSBEWEIS, und zwar der stärkere von beiden: eine Regel,
// deren Prelude das Attribut VERLANGT, kann ohne das Attribut gar nicht matchen. Wer alle Regeln
// der Markendatei als gebunden nachweist, hat damit jeden berechneten Wert erledigt — auch die,
// die noch niemand gemessen hat. Ein Messtest über eine Auswahl von Tokens könnte das nie.
//
// WAS HIER GEPRÜFT WIRD:
//   B1  Jede Regel in styles/marke.css ist unter [data-brand="advisor"] gebunden (Sammler).
//   B2  Kalibrierung: eine ungebundene Regel würde gefunden.
//   B3  Die Markendatei führt KEIN neues Token ein — sie überschreibt nur, was themes.css kennt.
//   B4  Die semantischen Farben (Warnung, Fehler, Erfolg, Info, KI) sind NICHT darunter.
//   B5  Genau ein belegter Farbwert (#0578b7) und daraus abgeleitete Abstufungen; jede Abstufung
//       trägt ihre Herleitung als Kommentar.
//   B6  Keine Hex-Farbe außerhalb der Kommentare (mega40 H2 gilt hier genauso).
//   B7  Das Logo ist eine FESTE eigene Datei; keine Adresse zeigt nach advisor.nl.
//   B8  index.css bindet marke.css NACH themes.css/modern.css ein (sonst gewinnt der Bestand).
//   B9  Die Markenebene fasst die Darstellungswahl nicht an: keine Regel nennt data-theme, und
//       styles/modern.css kennt kein data-brand.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = join(__dirname, "../../apps/web");
const MARKE = readFileSync(join(WEB, "src/styles/marke.css"), "utf8");
const THEMES = readFileSync(join(WEB, "src/styles/themes.css"), "utf8");
const MODERN = readFileSync(join(WEB, "src/styles/modern.css"), "utf8");
const INDEX = readFileSync(join(WEB, "src/index.css"), "utf8");

const ANKER = '[data-brand="advisor"]';

function ohneKommentare(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Selektor-Preludes je Verschachtelungstiefe — wörtlich die Bauform aus mega40-theme-invarianz. */
function preludes(css: string): Array<{ prelude: string; parents: string[] }> {
  const clean = ohneKommentare(css);
  const found: Array<{ prelude: string; parents: string[] }> = [];
  const stack: string[] = [];
  let buf = "";
  for (const ch of clean) {
    if (ch === "{") {
      const prelude = buf.trim().replace(/\s+/g, " ");
      found.push({ prelude, parents: [...stack] });
      stack.push(prelude);
      buf = "";
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else {
      buf += ch;
    }
  }
  return found;
}

/** Jeder Komma-Teil jedes Selektors, der NICHT unter dem Markenanker hängt. */
function ungebundene(css: string): string[] {
  const raus: string[] = [];
  for (const { prelude, parents } of preludes(css)) {
    if (parents.some((p) => p.startsWith("@keyframes"))) {
      continue;
    }
    if (prelude.startsWith("@")) {
      continue; // Hüllen; ihre inneren Selektoren werden einzeln geprüft
    }
    if (parents.some((p) => p.split(",").every((t) => t.trim().startsWith(ANKER)))) {
      continue; // steht innerhalb eines bereits gebundenen Blocks
    }
    for (const teil of prelude.split(",")) {
      if (!teil.trim().startsWith(ANKER)) {
        raus.push(teil.trim());
      }
    }
  }
  return raus;
}

/** Alle `--kw-…`-Deklarationen einer Quelle, nach Kommentaren. */
function tokenNamen(css: string): string[] {
  return [...ohneKommentare(css).matchAll(/--kw-([a-z0-9-]+)\s*:/g)].map((m) => m[1] as string);
}

function hexFarbenIn(css: string): string[] {
  return [...ohneKommentare(css).matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
}

describe("JOB 3511 B · die Markenebene ist gebunden", () => {
  it("B1 · JEDE Regel in styles/marke.css hängt unter [data-brand=advisor]", () => {
    expect(
      ungebundene(MARKE),
      "Regel außerhalb des Markenankers — sie würde auch OHNE Firmen-CI wirken und Lieferung 6 " +
        "(Ausschalten stellt wieder her) brechen",
    ).toEqual([]);
  });

  it("B2 · Kalibrierung: eine ungebundene Regel würde gefunden — der Sammler ist keine Zierde", () => {
    expect(ungebundene(`${MARKE}\n.kw-probe { color: red; }`)).toEqual([".kw-probe"]);
    // Und ein Komma-Teil, der aus der Bindung fällt, ebenfalls.
    expect(ungebundene(`${ANKER} .a, .b { color: red; }`)).toEqual([".b"]);
  });

  it("B3 · die Markenebene führt KEIN eigenes Token ein — sie überschreibt nur Bekanntes", () => {
    const bekannt = new Set(tokenNamen(THEMES));
    const neu = tokenNamen(MARKE).filter((n) => !bekannt.has(n));
    expect(
      neu,
      "Token, das es nur mit eingeschalteter Marke gibt — beim Ausschalten fiele es auf einen " +
        "undefinierten Wert zurück, nicht auf den vorherigen",
    ).toEqual([]);
  });

  it("B4 · Warnung, Fehler, Erfolg, Info und die KI-Kennfarbe bleiben unangetastet", () => {
    const angefasst = tokenNamen(MARKE);
    const semantisch = angefasst.filter((n) => /^(trust-|ai$|ai-)/.test(n));
    expect(
      semantisch,
      "Eine rote Fehlermeldung muss rot bleiben — semantische Farben sind keine Markenfarben",
    ).toEqual([]);
  });

  it("B5 · genau der belegte Blauwert, jede Abstufung mit Herleitung im Kommentar", () => {
    // Der belegte Wert steht als Kommentar neben seinen Kanälen (Hex ist in CSS verboten, s. B6).
    expect(MARKE).toContain("#0578b7");
    expect(MARKE, "die Kanäle von #0578b7 (5 120 183) fehlen").toContain("5 120 183");
    // Keine erfundene dritte Advisor-Farbe: jede weitere Hex-Nennung im Kommentar ist entweder
    // der zweite belegte Wert oder eine Abstufung, die ihre Rechnung danebenstehen hat.
    const abstufungen = tokenNamen(MARKE);
    expect(abstufungen.length, "die Markenebene überschreibt kein einziges Token").toBeGreaterThan(
      0,
    );
    for (const name of abstufungen) {
      const zeile = new RegExp(`--kw-${name}\\s*:[^;]+;\\s*/\\*([^*]|\\*(?!/))*\\*/`);
      expect(zeile.test(MARKE), `--kw-${name} steht ohne Herleitung/Beleg im Kommentar`).toBe(true);
    }
  });

  it("B6 · keine Hex-Farbe außerhalb der Kommentare (mega40 H2)", () => {
    expect(hexFarbenIn(MARKE), "Hex-Farbe in marke.css — Farbwerte stehen als RGB-Kanäle").toEqual(
      [],
    );
  });

  it("B7 · die Markenebene lädt nichts nach und kennt keine zweite Logo-Adresse", () => {
    expect(MARKE, "Laufzeitabhängigkeit von advisor.nl").not.toMatch(/advisor\.nl/);
    expect(MARKE, "externes Stylesheet oder Webfont").not.toMatch(/@import|https?:\/\//);
    // Die Adresse des Logos kommt aus dem VERTRAG (`marke.logo`) und steht im Markup
    // (`shell/Logo.tsx`). Stünde sie zusätzlich hier, gäbe es zwei Wahrheiten darüber, welche
    // Datei das Firmenlogo ist — und nur eine davon ließe sich vom Server umschalten.
    expect(
      ohneKommentare(MARKE),
      "Logo-Adresse in der Stilquelle — sie gehört in den Vertrag, nicht ins CSS",
    ).not.toMatch(/url\(|adv-logo/);
  });

  it("B8 · index.css bindet marke.css NACH themes.css und modern.css ein", () => {
    const marke = INDEX.indexOf('@import "./styles/marke.css"');
    const themes = INDEX.indexOf('@import "./styles/themes.css"');
    const modern = INDEX.indexOf('@import "./styles/modern.css"');
    expect(marke, "marke.css ist in index.css nicht eingebunden").toBeGreaterThan(-1);
    // Gleiche Spezifität (ein Attributselektor) — dann entscheidet die Quellreihenfolge. Stünde
    // marke.css vorn, gewänne [data-theme="modern"] und die Firmen-CI bliebe im Vorgabethema wirkungslos.
    expect(marke).toBeGreaterThan(themes);
    expect(marke).toBeGreaterThan(modern);
  });

  it("B10 · jede Überschreibung ist auch eine: kein Token trägt denselben Wert wie vorher", () => {
    // Zusammen mit B3 (das Token ist bekannt) und B8 (marke.css lädt zuletzt, gleiche Spezifität)
    // ist DAS der Kaskadenbeweis: bekannter Name + spätere Quelle + anderer Wert = wirksam.
    const werte = (css: string, selektor: string): Map<string, string> => {
      const clean = ohneKommentare(css);
      const start = clean.indexOf(`${selektor} {`);
      const map = new Map<string, string>();
      if (start < 0) {
        return map;
      }
      const body = clean.slice(start, clean.indexOf("}", start));
      for (const m of body.matchAll(/--kw-([a-z0-9-]+):\s*([^;]+);/g)) {
        map.set(m[1] as string, (m[2] as string).trim().replace(/\s+/g, " "));
      }
      return map;
    };
    const advisor = werte(MARKE, ANKER);
    const klassisch = werte(THEMES, ":root");
    const modern = werte(THEMES, '[data-theme="modern"]');
    expect(advisor.size, "die Markenebene überschreibt kein einziges Token").toBeGreaterThan(0);
    const wirkungslos: string[] = [];
    for (const [name, wert] of advisor) {
      if (klassisch.get(name) === wert || modern.get(name) === wert) {
        wirkungslos.push(`--kw-${name}`);
      }
    }
    expect(wirkungslos, "Überschreibung mit dem Bestandswert — sie tut nichts").toEqual([]);
  });

  it("B11 · das kopierte Logo ist die unveränderte Originaldatei", () => {
    const svg = readFileSync(join(WEB, "public/marke/advisor/adv-logo.svg"));
    // 5567 Bytes und viewBox 0 0 173.1 39.19 — beides wörtlich aus AUFTRAGSGRUNDLAGE.md.
    expect(svg.byteLength, "die Kopie ist nicht mehr byte-gleich").toBe(5567);
    const text = svg.toString("utf8");
    expect(text).toContain('viewBox="0 0 173.1 39.19"');
    // Die beiden im SVG hinterlegten Farben sind der BELEG für die Werte in marke.css.
    expect(text).toContain("#0578b7");
    expect(text).toContain("#161417");
  });

  it("B9 · Markenebene und Darstellungswahl fassen einander nicht an", () => {
    expect(
      ohneKommentare(MARKE),
      "marke.css nennt data-theme — die Firmen-CI hinge dann an der klassisch/modern-Wahl",
    ).not.toContain("data-theme");
    expect(
      ohneKommentare(MODERN),
      "styles/modern.css nennt data-brand — die Darstellungswahl hinge dann an der Firmen-CI",
    ).not.toContain("data-brand");
    expect(
      ohneKommentare(THEMES),
      "styles/themes.css nennt data-brand — die Marke gehört in ihre eigene Datei",
    ).not.toContain("data-brand");
  });
});
