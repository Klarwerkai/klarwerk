// ================================================================================================
// JOB 3587 R2 · DIE KALIBRIERUNG DER ERKENNUNG — jede Handprobe BENs ist hier ein Dauerfall.
// ================================================================================================
//
// WOZU DIESE DATEI. Ein Wächter ist nur so viel wert wie seine Erkennung, und die ist in Runde 1
// zweimal danebengetroffen. Gegen den echten Bestand kann man das nicht messen: dort gibt es die
// Quelltexte, an denen sie scheitert, ja gerade NICHT. Diese Datei füttert die Erkennung deshalb mit
// erfundenen, aber realistischen Quelltexten — den beiden von BEN gemessenen zuerst
// (`ben.md`, Korrekturpflichten 1 und 2) — und hält sie in BEIDE Richtungen fest: harmloser Text
// bleibt grün, echter Code wird gesehen, auch wenn er über eine Variable oder ein Nachbarmodul kommt.
//
// Kein Browser, kein Dateizugriff, kein Bestandsbezug: reine Ableitung, bei jedem Lauf gleich.
import { describe, expect, it } from "vitest";
import {
  ACHSEN,
  AUSFUEHRENDE_AUFRUFE,
  SPRACHE_SCHLUESSEL,
  listeAus,
  sammleAufweichungen,
  untersucheQuelle,
} from "./sprachweg-ast";

/** Ein Quelltext, wie er in einer h6-Testdatei stünde — ohne Rahmenwerk, nur die fragliche Zeile. */
const quelle = (rumpf: string): string =>
  [
    'import { fn } from "../design/h6-chromium";',
    "async function tueWas(seite: any, sprache: string) {",
    rumpf,
    "}",
  ].join("\n");

describe("JOB 3587 · K · was die Erkennung als ausgeführten Sprachsetzer zählt", () => {
  it("K1 · ein harmloser Beispielsatz in `console.log` ist KEIN Setzer (BENs erste Gegenprobe)", () => {
    const befund = untersucheQuelle(
      quelle(`  console.log('Dokubeispiel: localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl")');`),
    );
    expect(
      befund.setztSprache,
      `harmloser Text wurde als Setzer gezählt: ${JSON.stringify(befund)}`,
    ).toBe(false);
    expect(befund.verdaechtig, "harmloser Text gilt als verdächtig").toBe(false);
  });

  it("K2 · derselbe Text als Argument eines ausführenden Aufrufs IST ein Setzer", () => {
    const befund = untersucheQuelle(
      quelle(
        `  await seite.evaluate(fn('(s) => localStorage.setItem("${SPRACHE_SCHLUESSEL}", s)'), sprache);`,
      ),
    );
    expect(befund.setztSprache, "der direkte Setzer wurde nicht gesehen").toBe(true);
    expect(befund.sicher.length, "der Schlüssel steht am Aufruf — der Fund ist sicher").toBe(1);
    expect(befund.geparsteBrowserquellen).toBe(1);
  });

  it("K3 · über eine VARIABLE übergebener Browsercode ist ein Setzer (BENs zweite Gegenprobe)", () => {
    const befund = untersucheQuelle(
      quelle(
        `  const code = '(s) => localStorage.setItem("${SPRACHE_SCHLUESSEL}", s)';\n  await seite.evaluate(fn(code), sprache);`,
      ),
    );
    expect(
      befund.setztSprache,
      "Browsercode aus einer Variablen blieb unentdeckt — genau BENs Fund",
    ).toBe(true);
  });

  it("K4 · ein `setItem` im KOMMENTAR des Browsercodes ist kein Aufruf", () => {
    const befund = untersucheQuelle(
      quelle(
        `  await seite.evaluate(fn('() => { /* localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl") */ return null; }'));`,
      ),
    );
    expect(befund.setztSprache, "ein Kommentar wurde als Aufruf gezählt").toBe(false);
  });

  it("K5 · ein `setItem` in einer ZEICHENKETTE innerhalb des Browsercodes ist kein Aufruf", () => {
    const befund = untersucheQuelle(
      quelle(
        `  await seite.evaluate(fn('() => "localStorage.setItem(\\'${SPRACHE_SCHLUESSEL}\\', 1)"'));`,
      ),
    );
    expect(befund.setztSprache, "eine Zeichenkette im Browsercode wurde als Aufruf gezählt").toBe(
      false,
    );
  });

  it("K6 · der gemeinsame Weg (`setzeSprache`) ist kein eigener Setzer", () => {
    const befund = untersucheQuelle(
      [
        'import { setzeSprache } from "../design/h6-chromium";',
        "async function tueWas(stand: any) {",
        '  await setzeSprache(stand, "nl", "/start", "header");',
        "}",
      ].join("\n"),
    );
    expect(befund.setztSprache, "der gemeinsame Weg wurde als eigener Setzer gezählt").toBe(false);
    expect(befund.verdaechtig).toBe(false);
  });

  it("K7 · in ein Nachbarmodul verschobener Browsercode wird über EINEN Sprung gefunden", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        'import { SPRACH_CODE } from "./nachbar";',
        "async function tueWas(seite: any, sprache: string) {",
        "  await seite.evaluate(fn(SPRACH_CODE), sprache);",
        "}",
      ].join("\n"),
      {
        nachbarText: (spez) =>
          spez === "./nachbar"
            ? `export const SPRACH_CODE = '(s) => localStorage.setItem("${SPRACHE_SCHLUESSEL}", s)';`
            : undefined,
      },
    );
    expect(befund.setztSprache, "der Sprung ins Nachbarmodul wurde nicht verfolgt").toBe(true);
  });

  it("K8 · ein `setItem` auf einen ANDEREN Schlüssel ist kein Sprachsetzer", () => {
    const befund = untersucheQuelle(
      quelle(
        `  const gelesen = localStorage.getItem("${SPRACHE_SCHLUESSEL}");\n  await seite.evaluate(fn('() => localStorage.setItem("kw.designTheme", "modern")'));`,
      ),
    );
    expect(
      befund.setztSprache,
      "ein Theme-Setzer in einer Datei, die die Sprache nur LIEST, wurde als Sprachsetzer gezählt",
    ).toBe(false);
  });

  it("K9 · die Bauform des Bestands (Schlüssel als Wert, Setzer im Browsercode) wird gesehen", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        `const SPRACHE_STORAGE_KEY = "${SPRACHE_SCHLUESSEL}";`,
        "async function tueWas(seite: any, sprache: string) {",
        '  await seite.evaluate(fn("([k, v]) => { localStorage.setItem(k, v); return null; }"), [SPRACHE_STORAGE_KEY, sprache]);',
        "}",
      ].join("\n"),
    );
    expect(befund.setztSprache, "die Bauform des Bestands blieb unentdeckt").toBe(true);
    expect(
      befund.moeglich.length,
      "der Schlüssel kommt von aussen — der Fund ist nur ein möglicher",
    ).toBe(1);
    expect(befund.schluessel.length).toBeGreaterThan(0);
  });

  it("K10 · BERECHNETER Browsercode in einer Sprachdatei gilt als verdächtig, nicht als harmlos", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        `const K = "${SPRACHE_SCHLUESSEL}";`,
        "function baue(k: string) { return '(v) => localStorage.setItem(' + k + ', v)'; }",
        "async function tueWas(seite: any, sprache: string) {",
        "  await seite.evaluate(fn(baue(K)), sprache);",
        "}",
      ].join("\n"),
    );
    expect(befund.unklar.length, "der berechnete Browsercode wurde nicht benannt").toBeGreaterThan(
      0,
    );
    expect(befund.verdaechtig, "berechneter Browsercode mit dem Schlüssel gilt als harmlos").toBe(
      true,
    );
  });

  it("K11 · die Liste der ausführenden Aufrufe trägt die Hülle dieses Hauses", () => {
    for (const pflicht of ["fn", "evaluate", "addInitScript", "Function"]) {
      expect(AUSFUEHRENDE_AUFRUFE as readonly string[]).toContain(pflicht);
    }
  });
});

// ==================================================================================================
// JOB 3587 R3 · ZUSAMMENGESETZTER BROWSERCODE — BENs Umgehung aus Runde 2 als Dauerfall.
// ==================================================================================================
//
// Was in Runde 2 geschah: die Erkennung nahm von einer Schablone nur die FESTEN Teile und warf die
// Einsetzungen weg. Aus `` `() => { ${rumpf}; }` `` wurde `"() => {  ; }"` — ein Text, der
// vollständig aussah und den Setzer nicht mehr enthielt. BEN hat genau das eingefügt und der
// Wächter blieb grün (`ben.md`, Korrekturpflicht 1). Dieselbe Lücke hatte die Verkettung: ein
// unbekanntes Glied wurde still durch Leertext ersetzt.
//
// Die Fälle hier halten BEIDE Richtungen fest, denn nur zusammen taugen sie etwas: was lesbar ist,
// wird vollständig gelesen (K12, K16, K17) — was nicht lesbar ist, wird laut unklar und benennt den
// fehlenden Teil, statt sich eine Lesart zurechtzukürzen (K14, K15).
describe("JOB 3587 · K · zusammengesetzter Browsercode wird ganz gelesen oder gar nicht", () => {
  it("K12 · BENs Schablone: ein Setzer in der Einsetzung wird gesehen (Korrekturpflicht 1)", () => {
    // Wörtlich der Quelltext, mit dem BEN den Wächter der Runde 2 umgangen hat.
    const befund = untersucheQuelle(
      quelle(
        [
          `  const rumpf = 'localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl")';`,
          "  const code = `() => { ${rumpf}; }`;",
          "  await seite.evaluate(code);",
        ].join("\n"),
      ),
    );
    expect(
      befund.setztSprache,
      `die Schablone verschluckte den Setzer erneut: ${JSON.stringify(befund)}`,
    ).toBe(true);
    expect(befund.sicher.length, "der Schlüssel steht am Aufruf — der Fund ist sicher").toBe(1);
  });

  it("K13 · dieselbe Schablone in `console.log` bleibt harmlos", () => {
    const befund = untersucheQuelle(
      quelle(
        [
          `  const rumpf = 'localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl")';`,
          "  console.log(`So sähe der falsche Weg aus: ${rumpf}`);",
        ].join("\n"),
      ),
    );
    expect(befund.setztSprache, "ein Beispielsatz wurde als Setzer gezählt").toBe(false);
    expect(befund.verdaechtig, "ein Beispielsatz gilt als verdächtig").toBe(false);
  });

  it("K14 · eine UNBEKANNTE Einsetzung macht die Stelle unklar — und die Meldung nennt sie", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        `const K = "${SPRACHE_SCHLUESSEL}";`,
        "function baueRumpf(k: string) { return `localStorage.setItem('${k}', 'nl')`; }",
        "async function tueWas(seite: any) {",
        "  await seite.evaluate(fn(`() => { ${baueRumpf(K)}; }`));",
        "}",
      ].join("\n"),
    );
    expect(
      befund.setztSprache,
      "ein NICHT auflösbarer Text wurde als gelesener Setzer ausgegeben — das wäre erfunden",
    ).toBe(false);
    expect(befund.unklar.length, "die unlesbare Stelle wurde verschwiegen").toBeGreaterThan(0);
    expect(
      befund.unklar[0]?.was,
      `die Meldung nennt den fehlenden Teil nicht: ${befund.unklar[0]?.was}`,
    ).toContain("baueRumpf");
    expect(befund.verdaechtig, "unlesbarer Code in einer Sprachdatei gilt als harmlos").toBe(true);
  });

  it("K15 · ein unbekanntes Glied einer VERKETTUNG wird nicht durch Leertext ersetzt", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        `const K = "${SPRACHE_SCHLUESSEL}";`,
        "function mitte() { return 'localStorage.setItem(K, v)'; }",
        "async function tueWas(seite: any) {",
        '  await seite.evaluate(fn("(v) => { " + mitte() + " }"));',
        "}",
      ].join("\n"),
    );
    // Bis Runde 2 ergab das den Text `"(v) => {  }"` — lesbar, harmlos, falsch.
    expect(befund.unklar.length, "die Verkettung wurde still verkürzt").toBeGreaterThan(0);
    expect(befund.unklar[0]?.was).toContain("mitte()");
    expect(befund.verdaechtig).toBe(true);
  });

  it("K16 · eine AUFLÖSBARE Einsetzung bleibt lesbar (kein falscher Alarm)", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        'const SEL = "header";',
        "const BREITE = 760;",
        "async function tueWas(seite: any) {",
        "  await seite.evaluate(fn(`() => document.querySelector('${SEL}').clientWidth === ${BREITE}`));",
        "}",
      ].join("\n"),
    );
    expect(
      befund.unklar,
      `lesbarer Code wurde als unklar gemeldet: ${JSON.stringify(befund.unklar)}`,
    ).toEqual([]);
    expect(befund.setztSprache).toBe(false);
    expect(befund.verdaechtig).toBe(false);
  });

  it("K17 · eine Einsetzung aus einem NACHBARMODUL wird über den einen Sprung gelesen", () => {
    const befund = untersucheQuelle(
      [
        'import { fn } from "../design/h6-chromium";',
        'import { RUMPF } from "./nachbar";',
        "async function tueWas(seite: any) {",
        "  await seite.evaluate(fn(`() => { ${RUMPF}; }`));",
        "}",
      ].join("\n"),
      {
        nachbarText: (spez) =>
          spez === "./nachbar"
            ? `export const RUMPF = 'localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl")';`
            : undefined,
      },
    );
    expect(
      befund.setztSprache,
      "der Sprung ins Nachbarmodul greift in einer Einsetzung nicht — dort wird derselbe Code ausgeführt",
    ).toBe(true);
  });
});

describe("JOB 3587 · G · wann ein abgeschalteter Wächter einen tragfähigen Grund hat", () => {
  const zusage = (felder: string): string => `const z = { ${felder} };\nexport default z;`;

  it('G1 · `nurGemessen("…")` mit Text: Grund vorhanden', () => {
    const [a] = sammleAufweichungen('const z = nurGemessen("breite Bauform, JOB 3060");');
    expect(a?.grund).toBe("breite Bauform, JOB 3060");
    expect(a?.achsen).toEqual([...ACHSEN]);
  });

  it('G2 · `nurGemessen("")`: kein Grund', () => {
    const [a] = sammleAufweichungen('const z = nurGemessen("");');
    expect(a?.grund).toBeNull();
    expect(a?.warum).toContain("leer");
  });

  it("G3 · ein Grund aus einer Konstante zählt", () => {
    const [a] = sammleAufweichungen(
      'const GRUND = "gemessen 11.09.: 65 px Überschuss";\nconst z = nurGemessen(GRUND);',
    );
    expect(a?.grund).toBe("gemessen 11.09.: 65 px Überschuss");
  });

  it("G4 · eine LEERE Konstante zählt nicht (BENs Gegenprobe: leerer Variablenwert)", () => {
    const [a] = sammleAufweichungen('const LEER = "";\nconst z = nurGemessen(LEER);');
    expect(a?.grund, "eine leere Variable ging als Grund durch").toBeNull();
  });

  it("G5 · ein Zusage-Objekt OHNE `grund` zählt nicht", () => {
    const [a] = sammleAufweichungen(zusage("ueberlauf: false, fenster: false, ueberlappung: true"));
    expect(a?.grund).toBeNull();
    expect(a?.warum).toContain("kein Grund angegeben");
    expect(a?.achsen).toEqual(["ueberlauf", "fenster"]);
  });

  it("G6 · `grund: undefined` zählt nicht (BENs Gegenprobe)", () => {
    const [a] = sammleAufweichungen(
      zusage("ueberlauf: false, fenster: false, ueberlappung: true, grund: undefined"),
    );
    expect(a?.grund, "`undefined` ging als Grund durch — genau BENs Fund").toBeNull();
  });

  it("G7 · ein Grund aus einer Befundkarte zählt (die Bauform der Messdatei)", () => {
    const [a] = sammleAufweichungen(
      [
        'const KARTE: ReadonlyMap<string, string> = new Map<string, string>([["nl/900", "BEFUND: 65 px Überschuss"]]);',
        'const befund = KARTE.get("nl/900");',
        "const z = { ueberlauf: false, fenster: false, ueberlappung: true, grund: befund };",
      ].join("\n"),
    );
    expect(a?.grund, `die Bauform der Messdatei wurde verworfen: ${a?.warum}`).toContain("BEFUND");
  });

  it("G8 · eine Befundkarte mit LEEREM Eintrag zählt nicht", () => {
    const [a] = sammleAufweichungen(
      [
        'const KARTE = new Map<string, string>([["nl/900", ""]]);',
        'const befund = KARTE.get("nl/900");',
        "const z = { ueberlauf: false, fenster: false, ueberlappung: true, grund: befund };",
      ].join("\n"),
    );
    expect(a?.grund).toBeNull();
  });

  it("G9 · ein Grund, der erst zur Laufzeit entsteht, zählt nicht — und die Meldung sagt es", () => {
    const [a] = sammleAufweichungen(
      "function machGrund() { return String(Date.now()); }\n" +
        "const z = { ueberlauf: false, fenster: false, ueberlappung: true, grund: machGrund() };",
    );
    expect(a?.grund).toBeNull();
    expect(a?.warum).toContain("nachvollziehbar");
  });

  it("G10 · eine Schablone ohne festen Teil ist leer", () => {
    const [a] = sammleAufweichungen(
      "const x = 1;\nconst z = { ueberlauf: false, fenster: false, ueberlappung: true, grund: `${x}` };",
    );
    expect(a?.grund).toBeNull();
  });

  it("G11 · eine Zusage, die NICHTS abschaltet, ist keine Aufweichung", () => {
    expect(
      sammleAufweichungen(zusage("ueberlauf: true, fenster: true, ueberlappung: true")),
    ).toEqual([]);
  });

  it("G13 · ein Grund MIT Einsetzung bleibt gültig — die beiden Modi sind getrennt", () => {
    // BENs Promptverbesserung aus Runde 2: die strenge Lesart des Browsercodes (K12–K17) darf die
    // nachsichtige Lesart der Begründungstexte nicht mitreissen. Ein Grund, der eine gemessene Zahl
    // einsetzt, ist ein vollwertiger Satz — die Zahl entsteht erst im Lauf.
    const [a] = sammleAufweichungen(
      "const px = 65;\n" +
        "const z = { ueberlauf: false, fenster: true, ueberlappung: true, grund: `BEFUND nl/900: ${px} px Überschuss` };",
    );
    expect(a?.grund, `ein Grund mit Einsetzung wurde verworfen: ${a?.warum}`).toContain("BEFUND");
    expect(a?.achsen).toEqual(["ueberlauf"]);
  });

  it("G12 · eine Prüfmenge wird als Liste gelesen, und eine fehlende bricht ab", () => {
    expect(listeAus("const BREITEN = [390, 760] as const;", "BREITEN")).toEqual([390, 760]);
    expect(() => listeAus("const x = 1;", "BREITEN")).toThrow(/BREITEN/);
  });
});
