// ================================================================================================
// AUFTRAG-mega40 BLOCK A — INVARIANZ: OHNE data-theme ÄNDERT SICH KEIN EINZIGER WERT.
// ================================================================================================
//
// Am Freitag sitzt eine Testerin vor dem Produkt und sieht den STANDARD. Das Token-Fundament
// (styles/themes.css + tailwind.config.ts auf var()-Bindung) darf die heutigen berechneten Werte
// deshalb nur UMZIEHEN, nicht verändern. Dieser Test pinnt:
//
//  1. Die klassischen :root-Token sind EXAKT die bisherigen Hex-Werte aus tailwind.config.ts
//     (Stand d3fe69d) — Kanal für Kanal. Wer ein classic-Token mutiert, wird hier rot
//     (Kalibrierung im Bericht vorgeführt).
//  2. tailwind.config.ts bindet jeden Farbnamen an genau diese Token (rgb(var(--kw-…) /
//     <alpha-value>)) — keine zweite Farbquelle.
//  3. Die Kicker-Schriftfamilie im Standard bleibt IBM Plex Mono (tailwind fontFamily.mono) und
//     der Sans-Spiegel in themes.css läuft nicht auseinander.
//  4. SAMMLER: JEDE Regel in styles/modern.css hängt unter [data-theme="modern"] — auch künftige.
//     Erlaubt sind daneben nur @media-Hüllen (deren innere Selektoren ebenfalls gebunden sind)
//     und @keyframes. themes.css kennt nur :root und [data-theme="modern"].
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WEB = join(__dirname, "../../apps/web");
const THEMES = readFileSync(join(WEB, "src/styles/themes.css"), "utf8");
const MODERN = readFileSync(join(WEB, "src/styles/modern.css"), "utf8");
const TAILWIND = readFileSync(join(WEB, "tailwind.config.ts"), "utf8");

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Alle --kw-Deklarationen eines Selektorblocks („:root" oder „[data-theme="modern"]").
function tokensOf(css: string, selector: string): Map<string, string> {
  const clean = stripComments(css);
  const start = clean.indexOf(`${selector} {`);
  expect(start, `Block ${selector} fehlt in der Token-Datei`).toBeGreaterThanOrEqual(0);
  const end = clean.indexOf("}", start);
  const body = clean.slice(start, end);
  const map = new Map<string, string>();
  for (const m of body.matchAll(/--kw-([a-z0-9-]+):\s*([^;]+);/g)) {
    const name = m[1];
    const value = m[2];
    if (name && value) {
      map.set(name, value.trim().replace(/\s+/g, " "));
    }
  }
  return map;
}

function channelsToHex(channels: string): string {
  const parts = channels.split(" ").map((p) => Number.parseInt(p, 10));
  expect(parts, `keine RGB-Kanäle: „${channels}"`).toHaveLength(3);
  return `#${parts.map((p) => p.toString(16).padStart(2, "0")).join("")}`;
}

// DIE HEUTIGEN WERTE — wörtlich aus tailwind.config.ts, Stand d3fe69d. Das ist bewusst eine
// abgeschriebene Erwartung: sie ist der Pin, gegen den die Token-Datei gehalten wird.
const KLASSISCH: Record<string, string> = {
  page: "#f3f4f6",
  surface: "#ffffff",
  ink: "#16222c",
  text: "#1b1e21",
  "text-soft": "#23272b",
  muted: "#687078",
  "muted-2": "#616a72",
  hairline: "#e4e7ea",
  "hairline-soft": "#f0f1f3",
  brand: "#ed7d0e",
  "brand-300": "#f5a04a",
  "brand-text": "#a8560a",
  "trust-pos-text": "#256b46",
  "trust-pos-fill": "#3aa06a",
  "trust-pos-bg": "#e2f1e8",
  "trust-warn-text": "#9a6a12",
  "trust-warn-fill": "#c8861a",
  "trust-warn-bg": "#faf1db",
  "trust-crit-text": "#9e352e",
  "trust-crit-fill": "#c0473f",
  "trust-crit-bg": "#f8e7e5",
  "trust-info-text": "#1c5d70",
  "trust-info-bg": "#e4eef1",
  ai: "#5b50c4",
  "ai-light": "#9d93f0",
  "ai-surface-1": "#ecebfb",
  "ai-surface-2": "#f6f4fd",
  "ai-dashed": "#b9b2ec",
};

describe("mega40 A · Invarianz des Standards (klassisch = die heutigen Werte)", () => {
  const root = tokensOf(THEMES, ":root");

  it("die Kernwerte des Standards sind gepinnt: Hintergrund, Textfarbe, Akzent", () => {
    expect(channelsToHex(root.get("page") ?? "")).toBe("#f3f4f6");
    expect(channelsToHex(root.get("text") ?? "")).toBe("#1b1e21");
    expect(channelsToHex(root.get("brand") ?? "")).toBe("#ed7d0e");
  });

  it("JEDES klassische Farb-Token trägt exakt den bisherigen Wert — kein Umzug darf umfärben", () => {
    for (const [name, hex] of Object.entries(KLASSISCH)) {
      const channels = root.get(name);
      expect(channels, `Token --kw-${name} fehlt im :root-Block`).toBeTruthy();
      expect(channelsToHex(channels ?? ""), `--kw-${name}`).toBe(hex);
    }
  });

  it("die klassischen Schatten sind wörtlich die bisherigen", () => {
    expect(root.get("shadow-popover")).toBe("0 14px 40px rgba(16, 24, 32, 0.16)");
    expect(root.get("shadow-tile")).toBe("0 1px 3px rgba(16, 24, 32, 0.14)");
  });

  it("die Kicker-Schriftfamilie im Standard bleibt IBM Plex Mono; der Sans-Spiegel läuft synchron", () => {
    // Klassische Kicker sind font-mono (Tailwind-Utility) — die Familie darf der Umbau nicht anfassen.
    expect(TAILWIND).toMatch(/mono:\s*\["IBM Plex Mono",\s*"ui-monospace",\s*"monospace"\]/);
    expect(TAILWIND).toMatch(/sans:\s*\["IBM Plex Sans",\s*"system-ui",\s*"sans-serif"\]/);
    expect(root.get("font-mono")).toContain("IBM Plex Mono");
    expect(root.get("font-sans")).toContain("IBM Plex Sans");
  });

  it("tailwind.config.ts bindet jeden Farbnamen an die Token-Datei (eine Quelle, keine zweite)", () => {
    expect(TAILWIND).toContain("rgb(var(--kw-${name}) / <alpha-value>)");
    for (const name of Object.keys(KLASSISCH)) {
      expect(TAILWIND, `tailwind.config.ts bindet „${name}" nicht an --kw-${name}`).toContain(
        `token("${name}")`,
      );
    }
  });
});

// ------------------------------------------------------------------------------------------------
// SAMMLER: Selektor-Preludes je Verschachtelungstiefe einsammeln (kein Fall-Katalog).
function preludes(css: string): Array<{ prelude: string; parents: string[] }> {
  const clean = stripComments(css);
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

describe("mega40 A · Sammler: modern hängt AUSSCHLIESSLICH unter [data-theme=modern]", () => {
  it("styles/modern.css: jeder Selektor (auch in @media, auch jeder Komma-Teil) ist gebunden", () => {
    const verstoesse: string[] = [];
    for (const { prelude, parents } of preludes(MODERN)) {
      if (parents.some((p) => p.startsWith("@keyframes"))) {
        continue; // from/to/%-Schritte einer Keyframe-Definition
      }
      if (prelude.startsWith("@media") || prelude.startsWith("@keyframes")) {
        continue; // Hüllen; ihre inneren Selektoren werden einzeln geprüft
      }
      for (const teil of prelude.split(",")) {
        if (!teil.trim().startsWith('[data-theme="modern"]')) {
          verstoesse.push(teil.trim());
        }
      }
    }
    expect(
      verstoesse,
      "modern.css enthält Regeln außerhalb von [data-theme=modern] — sie würden den Standard umfärben",
    ).toEqual([]);
  });

  it("styles/themes.css kennt genau zwei Blöcke: :root (klassisch) und [data-theme=modern]", () => {
    const oben = preludes(THEMES)
      .filter((p) => p.parents.length === 0)
      .map((p) => p.prelude);
    expect(oben).toEqual([":root", '[data-theme="modern"]']);
  });

  it("Kalibrierung des Sammlers: eine ungebundene Regel würde gefunden", () => {
    const probe = `${MODERN}\n.kw-probe { color: red; }`;
    const ungebunden = preludes(probe).filter(
      (p) =>
        p.parents.length === 0 &&
        !p.prelude.startsWith("@") &&
        !p.prelude.startsWith('[data-theme="modern"]'),
    );
    expect(ungebunden.map((p) => p.prelude)).toEqual([".kw-probe"]);
  });
});
