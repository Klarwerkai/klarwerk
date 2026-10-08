// ================================================================================================
// package:sprache · „Beide Sprachen auf Browser und Word" — DIE WORD-SPRACHUMSCHALTUNG IST VOLLSTÄNDIG.
// ================================================================================================
//
// Auftrag gesamt-sprache-begriffe, K22 (Bens Befund, Nacharbeit 7): dem Word-Weg war bisher nur
// der Spracheintritt zugeordnet (`?lang=` beim Eintritt aus Word, `tests/app-sprachschalter/`).
// Die Umschaltung selbst gibt es im Seitenfenster schon: `setLang("de"|"en"|"nl")` in
// `apps/web/public/word-addin/taskpane.js`, bedient über `#lang-de`/`#lang-en`/`#lang-nl` in den
// Einstellungen des Fensters und auf der Anmeldeseite `anmeldung.html`. Sie zeichnet die festen
// Texte (`renderStatics`) und jeden gehaltenen Zustand in der neuen Sprache neu; die Blöcke
// KA7, Wortvergleich und Firmenwörterbuch hängen sich an `setLang`. Gemountete Belege dafür
// stehen in den Prüfständen der Blöcke (z. B. `tests/app/job2621-panel-wahrheiten.test.ts` W1:
// derselbe Satz in DE → EN → NL).
//
// WAS BISHER NIEMAND PRÜFTE: Das Fenster übersetzt mit
//     t(key) = STRINGS[lang][key] || STRINGS.de[key] || key
// — fehlt ein Schlüssel im englischen oder niederländischen Wörterbuch, steht dort STILL der
// deutsche Text. Kein vorhandener Test vergleicht die Schlüsselmengen; nur der Block Wortvergleich
// hat eine eigene Paritätsprüfung (`tests/app/word-addin-wortvergleich.test.ts` V5).
//
// DIESER WÄCHTER liest die ausgelieferten Dateien mit dem TypeScript-Parser (ohne sie auszuführen)
// und prüft JEDES Wörterbuch — erkannt an mindestens einem Sprachblock `de`/`en`/`nl` als Objekt —
// auf Vollständigkeit: alle drei Blöcke da, dieselben Schlüssel, keine weitere Sprache, kein leerer
// Text in irgendeiner Sprache. Erkennung und Vollständigkeit sind getrennt (Nacharbeit 9, Ben): ein
// neues Wörterbuch ohne NL fiel vorher gar nicht auf, ein leerer deutscher Wert auch nicht (S-5,
// S-6). Die Wörterbücher werden aus der Quelle gefunden, nicht aus einer Liste; die Liste unten
// ist nur die Kalibrierung, dass die bekannten wirklich gelesen werden.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const ADDIN = "apps/web/public/word-addin";
const SPRACHEN = ["de", "en", "nl"] as const;

interface Woerterbuch {
  name: string;
  sprachen: Map<string, Map<string, ts.Expression>>;
}

function eigenschaftsname(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
    return name.text;
  }
  return null;
}

/** Eine Eigenschaft, die wie ein Sprachkürzel heißt („de", „fr" …). */
const SPRACHKUERZEL = /^[a-z]{2}$/;

/**
 * ERKENNUNG (getrennt von der Vollständigkeit, Nacharbeit 9): Wörterbuch ist jedes Objektliteral
 * mit MINDESTENS EINEM Block `de`, `en` oder `nl`, der selbst ein Objektliteral ist. Ob alle drei
 * Blöcke da sind, entscheidet erst `abweichungen` — ein neues Wörterbuch ohne NL wird so gefunden
 * und gemeldet, statt still übersehen. Ein Objekt mit Zeichenketten unter `de`/`en`/`nl`
 * (Sprachnamen wie `KW_SPRACHNAMEN`) ist kein Wörterbuch.
 */
function woerterbuecher(quelltext: string, datei = "probe.js"): Woerterbuch[] {
  const quelle = ts.createSourceFile(
    datei,
    quelltext,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const funde: Woerterbuch[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (ts.isObjectLiteralExpression(knoten)) {
      const sprachen = new Map<string, Map<string, ts.Expression>>();
      for (const eigenschaft of knoten.properties) {
        if (!ts.isPropertyAssignment(eigenschaft)) {
          continue;
        }
        const sprache = eigenschaftsname(eigenschaft.name);
        if (sprache === null || !SPRACHKUERZEL.test(sprache)) {
          continue;
        }
        if (!ts.isObjectLiteralExpression(eigenschaft.initializer)) {
          continue;
        }
        const texte = new Map<string, ts.Expression>();
        for (const eintrag of eigenschaft.initializer.properties) {
          const schluessel =
            ts.isPropertyAssignment(eintrag) || ts.isShorthandPropertyAssignment(eintrag)
              ? eigenschaftsname(eintrag.name)
              : `…${ts.SyntaxKind[eintrag.kind]}`;
          if (schluessel !== null) {
            texte.set(schluessel, ts.isPropertyAssignment(eintrag) ? eintrag.initializer : knoten);
          }
        }
        sprachen.set(sprache, texte);
      }
      if (SPRACHEN.some((s) => sprachen.has(s))) {
        const eltern = knoten.parent;
        const zeile = quelle.getLineAndCharacterOfPosition(knoten.getStart()).line + 1;
        const name =
          eltern && ts.isVariableDeclaration(eltern) && ts.isIdentifier(eltern.name)
            ? eltern.name.text
            : `(ohne Namen, Zeile ${zeile})`;
        funde.push({ name, sprachen });
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(quelle);
  return funde;
}

/**
 * VOLLSTÄNDIGKEIT: jede Abweichung eines erkannten Wörterbuchs als lesbarer Satz — fehlender
 * Sprachblock, unbekannte Sprache, fehlender oder überzähliger Schlüssel gegenüber DE und ein
 * leerer Text in JEDER der drei Sprachen (auch Deutsch: ein leerer deutscher Wert ist zugleich der
 * Rückfall aller anderen).
 */
function abweichungen(datei: string, woerterbuch: Woerterbuch): string[] {
  const funde: string[] = [];
  const name = `${datei} · ${woerterbuch.name}`;
  for (const sprache of woerterbuch.sprachen.keys()) {
    if (!(SPRACHEN as readonly string[]).includes(sprache)) {
      funde.push(`${name}: unbekannte Sprache „${sprache}"`);
    }
  }
  for (const sprache of SPRACHEN) {
    if (!woerterbuch.sprachen.has(sprache)) {
      funde.push(`${name}: fehlt Sprachblock „${sprache}"`);
    }
  }
  const de = woerterbuch.sprachen.get("de") ?? new Map<string, ts.Expression>();
  for (const sprache of ["en", "nl"]) {
    const texte = woerterbuch.sprachen.get(sprache);
    if (texte === undefined || !woerterbuch.sprachen.has("de")) {
      continue;
    }
    for (const schluessel of de.keys()) {
      if (!texte.has(schluessel)) {
        funde.push(`${name}.${sprache}: fehlt „${schluessel}"`);
      }
    }
    for (const schluessel of texte.keys()) {
      if (!de.has(schluessel)) {
        funde.push(`${name}.${sprache}: nur hier „${schluessel}"`);
      }
    }
  }
  for (const sprache of SPRACHEN) {
    for (const [schluessel, wert] of woerterbuch.sprachen.get(sprache) ?? []) {
      if (ts.isStringLiteralLike(wert) && wert.text.trim() === "") {
        funde.push(`${name}.${sprache}: leer „${schluessel}"`);
      }
    }
  }
  return funde;
}

function lies(relativ: string): string {
  return readFileSync(join(WURZEL, relativ), "utf8");
}

/** Das Inline-Skript der Anmeldeseite (das einzige `<script>` ohne `src`). */
function inlineSkript(html: string): string {
  const start = html.indexOf("<script>");
  const ende = html.indexOf("</script>", start);
  if (start < 0 || ende < 0) {
    throw new Error("anmeldung.html: kein Inline-Skript gefunden");
  }
  return html.slice(start + "<script>".length, ende);
}

const QUELLEN: ReadonlyArray<{ datei: string; text: string; erwartet: readonly string[] }> = [
  {
    datei: `${ADDIN}/taskpane.js`,
    text: lies(`${ADDIN}/taskpane.js`),
    erwartet: [
      "STRINGS",
      "KA1_TEXTE",
      "KA3_TEXTE",
      "M5_BILD_TEXTE",
      "KA6_TEXTE",
      "KA6_MEMO_TEXTE",
      "KA7_TEXTE",
      "WV_TEXTE",
    ],
  },
  {
    datei: `${ADDIN}/begriffe.js`,
    text: lies(`${ADDIN}/begriffe.js`),
    erwartet: ["BEGRIFFE_TEXTE"],
  },
  {
    datei: `${ADDIN}/anmeldung.html`,
    text: inlineSkript(lies(`${ADDIN}/anmeldung.html`)),
    erwartet: ["TEXTE"],
  },
];

describe("K22 · package:sprache — die Word-Sprachumschaltung lässt keine Sprache still zurückfallen", () => {
  it("S-1 Kalibrierung: die bekannten Wörterbücher des Seitenfensters werden wirklich gelesen", () => {
    for (const { datei, text, erwartet } of QUELLEN) {
      const namen = woerterbuecher(text, datei).map((w) => w.name);
      expect(namen, datei).toEqual(expect.arrayContaining([...erwartet]));
    }
    // Abgrenzung: die Sprachnamen des Fensters (Zeichenketten unter de/en/nl) sind kein Wörterbuch.
    const panelNamen = woerterbuecher(QUELLEN[0]?.text ?? "").map((w) => w.name);
    expect(panelNamen).not.toContain("KW_SPRACHNAMEN");
    // Das Hauptwörterbuch ist nicht klein — sonst wäre die Parität trivial.
    const strings = woerterbuecher(QUELLEN[0]?.text ?? "").find((w) => w.name === "STRINGS");
    expect(strings?.sprachen.get("de")?.size ?? 0).toBeGreaterThan(300);
  });

  it("S-2 jedes Wörterbuch hat in DE, EN und NL dieselben Schlüssel und keinen leeren Text", () => {
    const funde = QUELLEN.flatMap(({ datei, text }) =>
      woerterbuecher(text, datei).flatMap((w) => abweichungen(datei, w)),
    );
    expect(funde).toEqual([]);
  });

  it("S-3 die Umschaltung ist an allen drei Sprachen verdrahtet — im Fenster und bei der Anmeldung", () => {
    const panelHtml = lies(`${ADDIN}/taskpane.html`);
    const panelJs = lies(`${ADDIN}/taskpane.js`);
    const anmeldung = lies(`${ADDIN}/anmeldung.html`);
    for (const sprache of SPRACHEN) {
      expect(panelHtml, `taskpane.html: Knopf ${sprache}`).toContain(`id="lang-${sprache}"`);
      expect(anmeldung, `anmeldung.html: Knopf ${sprache}`).toContain(`id="lang-${sprache}"`);
      const klick =
        `getElementById("lang-${sprache}").addEventListener("click", ` +
        `function () { setLang("${sprache}"); });`;
      expect(panelJs, `taskpane.js: Klick ${sprache}`).toContain(klick);
    }
    // setLang zeichnet die festen Texte neu und setzt die Dokumentsprache (R-0911 im Fenster).
    expect(panelJs).toContain("function setLang(next) {");
    expect(panelJs).toContain("renderStatics();");
    expect(panelJs).toContain("document.documentElement.lang = lang;");
  });

  it("S-4 Rotprobe: ein fehlender, ein überzähliger und ein leerer Text werden gemeldet", () => {
    const probe = `var PROBE = {
      de: { a: "Eins", b: "Zwei" },
      en: { a: "One", c: "Three" },
      nl: { a: "", b: "Twee" }
    };
    var NAMEN = { de: "Deutsch", en: "English", nl: "Nederlands" };`;
    const gefunden = woerterbuecher(probe);
    // NAMEN hat Zeichenketten statt Objekten — es ist kein Wörterbuch.
    expect(gefunden.map((w) => w.name)).toEqual(["PROBE"]);
    expect(gefunden.flatMap((w) => abweichungen("probe.js", w)).sort()).toEqual([
      'probe.js · PROBE.en: fehlt „b"',
      'probe.js · PROBE.en: nur hier „c"',
      'probe.js · PROBE.nl: leer „a"',
    ]);
    const mitFr = `var X = { de: { a: "A" }, en: { a: "A" }, nl: { a: "A" }, fr: { a: "A" } };`;
    expect(woerterbuecher(mitFr).flatMap((w) => abweichungen("probe.js", w))).toEqual([
      'probe.js · X: unbekannte Sprache „fr"',
    ]);
  });

  it("S-5 Gegenfall (Nacharbeit 9): ein neues Wörterbuch ohne NL-Block wird erkannt und gemeldet", () => {
    const quelle = 'var NEU = { de: { a: "Probe" }, en: { a: "Sample" } };';
    const entdeckt = woerterbuecher(quelle);
    expect(entdeckt.map((w) => w.name)).toContain("NEU");
    expect(entdeckt.flatMap((w) => abweichungen("probe.js", w))).toEqual([
      'probe.js · NEU: fehlt Sprachblock „nl"',
    ]);
  });

  it("S-6 Gegenfall (Nacharbeit 9): ein leerer deutscher Wert wird gemeldet", () => {
    const quelle = 'var NEU = { de: { a: "  " }, en: { a: "Sample" }, nl: { a: "Voorbeeld" } };';
    const funde = woerterbuecher(quelle).flatMap((w) => abweichungen("probe.js", w));
    expect(funde).toEqual(['probe.js · NEU.de: leer „a"']);
  });
});
