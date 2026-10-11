// ================================================================================================
// K2b-RESTABGLEICH · DIE LEERTEXTFARBE DER KLARA-ERFASSEN-FLAECHE — WAS DA IST, WAS FEHLT.
// ================================================================================================
//
// Aufnahme 20260922 · k2b-konkreter-rest (Arbeitsart Klaerung). Die Zeile priority:K2b nennt vier
// Teile (Bereich-Zeile, „?"-Menue, Dokumentlink, Leertextfarbe #9AA2B1); 1–3 sind geliefert
// (JOB 3555 / 3506), Teil 4 stand unter Pedis Vorbehalt „nicht vor der Vorfuehrung"
// (tests/erfassung-einstieg/README.md, Zeile priority:K2b). Ergebnis und Belegstellen:
// docs/entscheidungen/k2b-erfassen-leertextfarbe.md.
//
// DIESE DATEI HAELT DEN ABGLEICH FEST, statt ihn als Prosa stehen zu lassen:
//   A · der Farbwert ist SCHON DA — genau ein Token `--hint: #9AA2B1` im Panel-Stil, kein zweites
//       Literal, kein zweiter Token. Ein Nachzug darf ihn nur BENUTZEN, nicht neu einfuehren.
//   B · die Erfassen-Flaeche benutzt ihn NICHT: `#capture-leer` traegt `var(--muted)`.
//   C · der Kontrast beider Kandidaten auf dem Kartengrund, nachgerechnet aus denselben Token.
//   D · der LIVE-Demoweg (JOB 3801, JOB 4337) beruehrt das Word-Panel nicht — er ist die BEDINGUNG
//       des Vorbehalts, kein Messnachweis fuer die Farbe.
//
// Kein Browser: gelesen werden die ausgelieferten Dateien. Den berechneten Stil im echten Chromium
// misst tests/design/zielbild-k2-erfassen.test.ts (OFFEN · §5.1), wo das Mockup vorliegt.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(__dirname, "../..");
const PANEL = join(REPO, "apps/web/public/word-addin");
const CSS = readFileSync(join(PANEL, "taskpane.css"), "utf8");
const HTML = readFileSync(join(PANEL, "taskpane.html"), "utf8");
const JS = readFileSync(join(PANEL, "taskpane.js"), "utf8");

/** Stil ohne Kommentare — die Kommentare nennen #9AA2B1 mehrfach und sind keine Deklaration. */
const STIL = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

type Regel = { selektor: string; rumpf: string };

/** Flache Regeln `selektor { rumpf }`; bei @media zaehlt nur der innere Block. */
function regeln(stil: string): Regel[] {
  const raus: Regel[] = [];
  for (const m of stil.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    raus.push({ selektor: (m[1] ?? "").trim(), rumpf: m[2] ?? "" });
  }
  return raus;
}

const REGELN = regeln(STIL);

function wertVon(rumpf: string, eig: string): string | null {
  const m = new RegExp(`(?:^|;|\\s)${eig}\\s*:\\s*([^;]+)`).exec(rumpf);
  return m ? (m[1] ?? "").trim() : null;
}

function rootVar(name: string): string {
  const root = REGELN.filter((r) => r.selektor === ":root");
  const werte = root.map((r) => wertVon(r.rumpf, `--${name}`)).filter((w) => w !== null);
  expect(werte, `:root --${name}`).toHaveLength(1);
  return werte[0] as string;
}

function regelFuer(selektor: string): Regel {
  const treffer = REGELN.filter((r) =>
    r.selektor
      .split(",")
      .map((s) => s.trim())
      .includes(selektor),
  );
  expect(treffer, `Regel ${selektor}`).toHaveLength(1);
  return treffer[0] as Regel;
}

function luminanz(hex: string): number {
  const kanal = (i: number): number => {
    const c = Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(0) + 0.7152 * kanal(1) + 0.0722 * kanal(2);
}

function kontrast(a: string, b: string): number {
  const [h, d] = [luminanz(a), luminanz(b)].sort((x, y) => y - x) as [number, number];
  return (h + 0.05) / (d + 0.05);
}

describe("K2b-Restabgleich · Leertextfarbe der Klara-Erfassen-Flaeche", () => {
  it("A · #9AA2B1 ist genau EIN vorhandener Token (--hint), kein zweites Literal", () => {
    expect(HTML).toMatch(/<link rel="stylesheet" href="taskpane\.css[^"]*"/);
    expect(rootVar("hint").toUpperCase()).toBe("#9AA2B1");
    const vorkommen = STIL.match(/#9AA2B1/gi) ?? [];
    expect(vorkommen, "#9AA2B1 ausserhalb von --hint deklariert").toHaveLength(1);
    expect(HTML.replace(/<!--[\s\S]*?-->/g, "")).not.toMatch(/#9AA2B1/i);
  });

  it("B · die Erfassen-Flaeche benutzt --hint nicht: #capture-leer traegt var(--muted)", () => {
    expect(HTML).toContain('<p id="capture-leer" data-t="captureEmpty"></p>');
    const leer = regelFuer("#capture-leer");
    expect(wertVon(leer.rumpf, "color")).toBe("var(--muted)");
    expect(wertVon(leer.rumpf, "font-size")).toBe("15px");
    const erfassenMitHint = REGELN.filter(
      (r) => /#(capture-|section-capture)/.test(r.selektor) && /var\(--hint\)/.test(r.rumpf),
    ).map((r) => r.selektor);
    expect(erfassenMitHint, "Erfassen-Regeln mit var(--hint)").toEqual([]);
    const saetze = [
      ["de", "Markiere Text in Word."],
      ["en", "Select text in Word."],
      ["nl", "Selecteer tekst in Word."],
    ] as const;
    for (const [sprache, satz] of saetze) {
      expect(JS, `captureEmpty ${sprache}`).toContain(`captureEmpty: "${satz}"`);
    }
  });

  it("C · Kontrast auf dem Kartengrund: --hint unter AA, --muted ueber AA", () => {
    expect(wertVon(regelFuer(".card").rumpf, "background")).toBe("var(--surface)");
    const grund = rootVar("surface");
    const hint = kontrast(rootVar("hint"), grund);
    const muted = kontrast(rootVar("muted"), grund);
    console.info(
      `K2b-Restabgleich · #capture-leer auf ${grund}: --hint ${hint.toFixed(2)}:1 · ` +
        `--muted ${muted.toFixed(2)}:1 (AA Text 4,5:1)`,
    );
    expect(hint).toBeLessThan(4.5);
    expect(hint).toBeGreaterThan(2.5);
    expect(muted).toBeGreaterThanOrEqual(4.5);
  });

  it("D · der LIVE-Demoweg (3801, 4337) faehrt die Web-App, nicht das Word-Panel", () => {
    const erster = "tests/demo-erster-nutzerweg";
    const pgBrowser = "tests/demo-nutzerweg-pg-browser";
    for (const ordner of [erster, pgBrowser]) {
      const dateien = readdirSync(join(REPO, ordner)).filter((d) => d.endsWith(".ts"));
      expect(dateien.length, ordner).toBeGreaterThan(0);
      for (const d of dateien) {
        const text = readFileSync(join(REPO, ordner, d), "utf8");
        expect(text, `${ordner}/${d}`).not.toMatch(/word-addin|taskpane|capture-leer/);
      }
    }
    const durchstich = readFileSync(join(REPO, erster, "durchstich.test.ts"), "utf8");
    expect(durchstich).toContain('describe("JOB 3801 · der erste Nutzerweg, am Stück"');
    const strecke = readFileSync(
      join(REPO, pgBrowser, "demo-nutzerweg-pg-browser.integration.test.ts"),
      "utf8",
    );
    expect(strecke).toContain('describe("JOB 4337 S · der erste Nutzerweg der Demo im Browser');
  });
});
