// ================================================================================================
// JOB 3586 · DIE VIER PROBEN, AN DENEN JOB 3570 GESCHEITERT IST — dauerhaft, an echtem Material.
// ================================================================================================
//
// WAS HIER STEHT UND WARUM ES HIER STEHT. Der Freigabe-Wächter (F4 und F7 in
// `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`) schützt Bestandserwartungen: eine
// geschützte Prüfung darf nicht still verschwinden. Prüfer BEN hat in JOB 3570 dreimal gemessen,
// dass sie es doch kann — jedes Mal, indem er die ECHTE Erwartung durch ihren WORTLAUT ersetzte:
//
//   Runde 1   als KOMMENTAR                   → alle 38 Fälle blieben grün
//   Runde 2   als ZEICHENKETTE                → alle 38 Fälle blieben grün
//   Runde 3   als REGEX-LITERAL nach `void`   → F4 und F7 blieben grün
//
// Und die vierte Probe ist die einfachste: die geschützte Erwartung ersatzlos LÖSCHEN. Alle vier
// laufen hier gegen dieselbe Stelle, an der BEN gemessen hat: die Fehlerstatus-Prüfung von V3c in
// `tests/ki-lauf-verbrauch/ehrlich.test.ts` — die teuerste Erwartung dieser Datei (der Lauf
// scheitert, NACHDEM die API abgerechnet hat; ohne sie wäre „Verbrauch da" nicht mehr von „alles
// gut" zu unterscheiden). Sie ist in F7 namentlich geführt.
//
// DIE PROBEN ÄNDERN KEINE DATEI. Sie lesen die echte Quelle und verstellen sie IM SPEICHER. Damit
// bleibt die Gegenprobe erhalten, statt einmal von Hand gefahren und danach vergessen zu werden —
// und niemand muss zum Prüfen eine Bestandsdatei anfassen.
//
// WAS „DER WÄCHTER WIRD ROT" HIER HEISST. F4 und F7 stützen sich auf genau zwei Entscheidungen aus
// `./erwartungsstellen`, und beide werden je Probe gemessen:
//
//   BODEN (F4)        `zaehleErwartungen` — die Zahl der ausgeführten Erwartungen im Fall. F4 hält
//                     sie gegen einen am Basisstand ausgezählten Eintrag und ist rot, sobald sie
//                     ihn unterschreitet. Hier wird der Rückgang selbst gemessen: eine weniger.
//   NAMENTLICH (F7)   `erwartungLaeuft` — steht der geführte Wortlaut da UND beginnt dort ein
//                     Aufruf? F7 verlangt mindestens eine Fundstelle und ist rot bei null.
//
// F4 grenzt den Fall zusätzlich ein (nur der Bereich von V3c zählt); das kann nur strenger sein als
// die ganze Datei, die hier gemessen wird. Beide Entscheidungen sind DIESELBEN Funktionen, die der
// Wächter ruft — keine Nachbildung, sonst prüfte diese Datei ihren eigenen Nachbau.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { erwartungLaeuft, erwartungsstellen, zaehleErwartungen } from "./erwartungsstellen";

/** Die echte Datei, an der Prüfer BEN alle drei Löcher gemessen hat. */
const DATEI = "tests/ki-lauf-verbrauch/ehrlich.test.ts";

/** Die namentlich geführte Erwartung aus V3c — wörtlich, wie F7 sie führt. */
const V3C = 'expect(datensatz.status).toBe("error");';

const quelle = readFileSync(join(process.cwd(), DATEI), "utf8");
const ganzeDatei = { von: 0, bis: quelle.length };

/** Was der Wächter an einer (ggf. verstellten) Fassung der Datei entscheidet. */
function befund(fassung: string): { readonly boden: number; readonly namentlich: number } {
  const stellen = erwartungsstellen(fassung, DATEI);
  return {
    boden: zaehleErwartungen(stellen, 0, fassung.length),
    namentlich: erwartungLaeuft(fassung, stellen, V3C, {
      von: 0,
      bis: fassung.length,
    }).length,
  };
}

/** Die echte Zeile durch etwas anderes ersetzen — genau einmal, sonst misst die Probe nichts. */
function statt(ersatz: string): string {
  expect([V3C, quelle.split(V3C).length - 1], "V3c steht genau einmal in der Datei").toEqual([
    V3C,
    1,
  ]);
  return quelle.replace(V3C, ersatz);
}

const ECHT = befund(quelle);

describe("JOB 3586 P: der Wächter unterscheidet ausgeführten Code von seinem Wortlaut", () => {
  it("P0 · der unveränderte Bestand trägt: V3c wird ausgeführt, der Boden steht", () => {
    // Ohne diese Zeile wäre jede Probe unten wertlos: ein Wächter, der IMMER rot ist, trennt nichts.
    expect(ECHT.namentlich).toBe(1);
    // 13 ausgeführte Erwartungen, ausgezählt am Basisstand (roh zählt die Datei 14 — die eine
    // Differenz ist die Erwähnung in Prosa, an der Prüfer BEN das erste Loch gemessen hat). Als
    // Schranke geführt, nicht als Gleichheit: eine NEUE Erwartung in dieser Datei ist kein Fehler.
    expect(ECHT.boden).toBeGreaterThanOrEqual(13);
    // Und die Fundstelle ist die ECHTE Zeile, nicht irgendeine: sie liegt im Fall V3c.
    const stelle = erwartungLaeuft(quelle, erwartungsstellen(quelle, DATEI), V3C, ganzeDatei)[0];
    const kopf = quelle.lastIndexOf("it(", stelle ?? 0);
    expect(quelle.slice(kopf, stelle ?? 0)).toContain(
      "V3c · gescheitert NACH gemeldetem Verbrauch",
    );
  });

  it("P1 · KOMMENTAR statt Erwartung (BEN, Runde 1): Boden fällt, der Name findet nichts", () => {
    const verstellt = statt(`// ${V3C}`);
    // Der Wortlaut ist unverändert da — nur eben als Prosa.
    expect(verstellt).toContain(V3C);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });
  });

  it("P2 · ZEICHENKETTE statt Erwartung (BEN, Runde 2): Boden fällt, der Name findet nichts", () => {
    const verstellt = statt(`void '${V3C.slice(0, -1)}';`);
    expect(verstellt).toContain('expect(datensatz.status).toBe("error")');
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });
  });

  it("P3 · REGEX-LITERAL nach `void` (BEN, Runde 3): Boden fällt, der Name findet nichts", () => {
    // DIE Probe, an der drei Runden Zeichenvergleich gescheitert sind: ein `/` beginnt ein
    // Regex-Literal oder eine Division, und welches von beidem, weiß nur ein Parser.
    const verstellt = statt(`void /${V3C}/;`);
    expect(verstellt).toContain(V3C);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });
  });

  it("P4 · die namentlich geführte Erwartung GELÖSCHT: Boden fällt, der Name findet nichts", () => {
    const verstellt = statt("");
    expect(verstellt).not.toContain(V3C);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });
  });

  it("P5 · TOTER ZWEIG: was hinter `return` oder in `if (false)` steht, zählt nicht", () => {
    // Der vierte Weg, eine Erwartung stehen zu lassen, ohne sie laufen zu lassen — syntaktisch
    // entschieden und deshalb belegbar (siehe `./erwartungsstellen`, Abschnitt TOTER_ZWEIG).
    const verstellt = statt(`if (false) ${V3C}`);
    expect(verstellt).toContain(V3C);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });

    const hinterRuecksprung = [
      "it('x', () => {",
      "  return;",
      "  expect(nachDemRuecksprung).toBe(1);",
      "});",
    ].join("\n");
    expect(erwartungsstellen(hinterRuecksprung, "PROBE.ts").stellen).toEqual([]);
  });

  it("P5b · TOTER ZWEIG, die Schleifenformen: `while (false)`, `for (; false;)` — und was doch läuft", () => {
    // KORREKTURPFLICHT 1 (Prüfer BEN, JOB 3586 Runde 1). Runde 1 behandelte `if` und `while`, nicht
    // aber `for`: BEN ersetzte V3c durch `for (; false;) { expect(datensatz.status).toBe("error"); }`
    // und alles blieb grün — die teuerste Erwartung der Datei lief nie und bezahlte den Boden
    // weiter. Diese Probe hält dieselbe Verstellung dauerhaft fest, an derselben echten Datei.
    for (const verstellung of [
      `for (; false;) { ${V3C} }`,
      `for (let i = 0; false; i += 1) { ${V3C} }`,
      `while (false) { ${V3C} }`,
      `false && ${V3C.slice(0, -1)};`,
      `true || ${V3C.slice(0, -1)};`,
      `true ? 0 : ${V3C}`,
    ]) {
      const verstellt = statt(verstellung);
      // Der Wortlaut steht unverändert da — nur eben an einer Stelle, die kein Lauf betritt.
      expect([verstellung, verstellt.includes(V3C.slice(0, -1))]).toEqual([verstellung, true]);
      expect([verstellung, befund(verstellt)]).toEqual([
        verstellung,
        { boden: ECHT.boden - 1, namentlich: 0 },
      ]);
    }

    // DIE GEGENRICHTUNG, ohne die die Zeilen oben nur Strenge wären und keine Unterscheidung: was
    // wirklich läuft, zählt weiter. `do … while (false)` läuft GENAU EINMAL, der Kopf einer
    // `for`-Schleife läuft auch bei toter Bedingung, und `for (;;)` hat gar keine Bedingung.
    for (const [lebendig, wieviele] of [
      [`do { ${V3C} } while (false);`, 1],
      [`for (let i = ${V3C.slice(0, -1)}; false; ) { }`, 1],
      [`for (;;) { ${V3C} break; }`, 1],
      [`while (true) { ${V3C} break; }`, 1],
    ] as const) {
      const verstellt = statt(lebendig);
      expect([lebendig, befund(verstellt)]).toEqual([
        lebendig,
        { boden: ECHT.boden, namentlich: wieviele },
      ]);
    }
  });

  it("P8 · BENANNTE KONSTANTE: `const AUS = false; if (AUS) …` läuft nie und zählt nicht mehr", () => {
    // JOB 3791, Lieferung 1. Die Form stand bis heute als ausdrückliche Nicht-Zusicherung im Kopf
    // von `./erwartungsstellen` und in der Rückgabe von JOB 3586 (REST): wer eine geschützte
    // Erwartung hinter einen benannten Schalter legt, schaltete sie ab, ohne den Boden zu senken.
    const verstellt = statt(`const AUS_P8 = false; if (AUS_P8) { ${V3C} }`);
    // Der Wortlaut ist unverändert da — nur eben hinter einem Schalter, der nie schaltet.
    expect(verstellt).toContain(V3C);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });

    // Über die `!`-Kette und Klammern hinweg dieselbe Antwort: es bleibt derselbe tote Zweig.
    const ueberNegation = statt(`const AN_P8 = true; if (!(AN_P8)) { ${V3C} }`);
    expect(befund(ueberNegation)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });

    // DIE GEGENRICHTUNG (Lieferung 5): eine wahre Konstante schaltet nichts ab. Ein Wächter, der
    // hier zu viel tötete, machte unschuldige Bestandsdateien rot — und wäre schlimmer als die Lücke.
    const lebendig = statt(`const AN_P8 = true; if (AN_P8) { ${V3C} }`);
    expect(befund(lebendig)).toEqual({ boden: ECHT.boden, namentlich: 1 });
  });

  it("P9 · `switch` mit konstantem Verteiler: die nicht passende Gruppe zählt nicht mehr", () => {
    // JOB 3791, Lieferung 2. Zwei Gestalten desselben Wortlauts stehen nebeneinander: die tote
    // `case`-Gruppe und der lebende `default`-Zweig. Nur so misst der Fall die UNTERSCHEIDUNG und
    // nicht bloß Strenge — vorher zählten beide.
    const verstellt = statt(`switch (false) { case true: ${V3C} break; default: ${V3C} }`);
    expect(verstellt.split(V3C).length - 1).toBe(2);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden, namentlich: 1 });

    // Und ohne `default` bleibt gar nichts übrig: der Boden fällt.
    const ohneDefault = statt(`switch (true) { case false: ${V3C} }`);
    expect(ohneDefault).toContain(V3C);
    expect(befund(ohneDefault)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });

    // DIE GEGENRICHTUNG (Lieferung 5): ein Verteiler, den kein Parser kennt, lässt jede Gruppe
    // lebend — auch die, die ein Lauf nie betritt. Im Zweifel zählt sie mit.
    const unbekannt = statt(
      `switch (datensatz.status) { case "error": ${V3C} break; default: break; }`,
    );
    expect(befund(unbekannt)).toEqual({ boden: ECHT.boden, namentlich: 1 });

    // Der Durchfall (`case` ohne `break`) bleibt erhalten: was hinter der erreichten Gruppe steht,
    // läuft mit, solange kein Abbruch dazwischen steht. IN RUNDE 1 STAND HIER EIN `break` — die
    // Zeile war als Durchfall beschriftet und maß genau das Gegenteil (Prüfer BEN, Befund 2).
    // Beide Richtungen stehen deshalb jetzt nebeneinander, sonst trennt der Fall nichts.
    const durchfall = statt(`switch (false) { case false: void 0; case true: ${V3C} }`);
    expect(befund(durchfall)).toEqual({ boden: ECHT.boden, namentlich: 1 });

    const abgebrochen = statt(`switch (false) { case false: break; case true: ${V3C} }`);
    expect(befund(abgebrochen)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });

    // KORREKTURPFLICHT 1 (Prüfer BEN, JOB 3791 Runde 1): ein `break` in einer Gruppe mit
    // UNBEKANNTEM Sprungwert beendet nur ihren EIGENEN Durchfall. Was dahinter steht, läuft,
    // sobald diese Gruppe nicht trifft. Runde 1 folgte nur dem frühesten Einstieg und erklärte
    // beides für tot — der Wächter tötete damit Lebendes, und das ist schlimmer als die Lücke.
    for (const lebendig of [
      `switch (false) { case datensatz.status: break; default: ${V3C} }`,
      `switch (false) { case datensatz.status: break; case false: ${V3C} }`,
      `switch (false) { default: break; case datensatz.status: ${V3C} }`,
    ]) {
      const verstelltLebend = statt(lebendig);
      expect([lebendig, befund(verstelltLebend)]).toEqual([
        lebendig,
        { boden: ECHT.boden, namentlich: 1 },
      ]);
    }
  });

  it("P10 · `for (const x of [])`: der Rumpf zählt nicht mehr, der Kopf weiter", () => {
    // JOB 3791, Lieferung 3.
    const verstellt = statt(`for (const x of []) { ${V3C} }`);
    expect(verstellt).toContain(V3C);
    expect(befund(verstellt)).toEqual({ boden: ECHT.boden - 1, namentlich: 0 });

    // DIE GEGENRICHTUNG (Lieferung 5), erste Hälfte: ein GEFÜLLTES Feld läuft, und alles, was kein
    // leeres Feldliteral ist, bleibt lebend — auch wenn es zur Laufzeit leer wäre.
    for (const lebendig of [
      `for (const x of [1]) { ${V3C} }`,
      `for (const x of leer) { ${V3C} }`,
      `for (const x of ([] as string[])) { ${V3C} }`,
      `for (const x of [...leer]) { ${V3C} }`,
      `for (const x of "") { ${V3C} }`,
      // NICHT gedeckt und hier festgehalten, damit die Grenze gemessen dasteht statt behauptet:
      // `for (const k in {})` läuft ebenfalls nie, zählt aber weiter mit.
      `for (const k in {}) { ${V3C} }`,
    ]) {
      const gefuellt = statt(lebendig);
      expect([lebendig, befund(gefuellt)]).toEqual([
        lebendig,
        { boden: ECHT.boden, namentlich: 1 },
      ]);
    }

    // Zweite Hälfte: der KOPF wird ausgewertet, bevor der erste Durchlauf entschieden ist — eine
    // Erwartung dort zählt weiter. Gemessen wird sie ohne Strichpunkt, denn in einem Feldliteral
    // steht keiner; deshalb hier nicht über `befund`, das den geführten Wortlaut mitsamt `;` sucht.
    const imKopf = statt(`for (const x of [${V3C.slice(0, -1)}]) { }`);
    const kopfBefund = erwartungsstellen(imKopf, DATEI);
    const ganzImKopf = { von: 0, bis: imKopf.length };
    expect(zaehleErwartungen(kopfBefund, 0, imKopf.length)).toBe(ECHT.boden);
    expect(erwartungLaeuft(imKopf, kopfBefund, V3C.slice(0, -1), ganzImKopf)).toHaveLength(1);
  });

  it("P11 · kein Fehlalarm: was nur nach Konstante AUSSIEHT, bleibt unbekannt — und zählt mit", () => {
    // JOB 3791, Lieferung 5. Die Namensauflösung ist eine reine Bindung im Baum und kennt keine
    // Geltungsbereiche. Deshalb gilt: ein Name, der mehr als einmal gebunden, neu zugewiesen,
    // als `let`/`var` geführt, eingeführt oder übergeben wird, ist UNBEKANNT — und unbekannt heißt
    // lebend. Jede dieser Quellen trägt genau eine Erwartung, und jede muss gezählt werden.
    //
    // JEDE ZEILE ISOLIERT GENAU EINEN VERDERBNISGRUND (Promptverbesserung von Prüfer BEN aus
    // Runde 1: „Jeder Invalidierungsgrund muss einen Mutationstest besitzen, den kein anderer
    // bereits erfüllt"). In Runde 1 prüfte die Zeile zur Neuzuweisung sie an einem `let`-Namen —
    // den schloss schon die `const`-Regel aus, und das Entfernen der Zuweisungserkennung blieb
    // deshalb unbemerkt. Der Name hinter jeder Zeile nennt die Regel, die sie allein hält.
    for (const [regel, quelltext] of [
      // `istConst` — `let`/`var` trägt nie, auch ohne jede weitere Berührung
      ["kein const", "let AUS = false;\nif (AUS) { expect(wert).toBe(1); }"],
      ["kein const", "var AUS = false;\nif (AUS) { expect(wert).toBe(1); }"],
      // Zuweisung an einen sonst tadellosen `const`-Namen — die `const`-Regel greift hier NICHT
      ["Zuweisung", "const AUS = false;\nAUS = true;\nif (AUS) { expect(wert).toBe(1); }"],
      ["Zuweisung", "const AUS = false;\nAUS ||= true;\nif (AUS) { expect(wert).toBe(1); }"],
      // KORREKTURPFLICHT 3: die Zerlegung LINKS ist eine Zuweisung ohne blanken Bezeichner
      [
        "Zuweisung zerlegt",
        "const AUS = false;\n[AUS] = [true];\nif (AUS) { expect(wert).toBe(1); }",
      ],
      [
        "Zuweisung zerlegt",
        "const AUS = false;\n({ AUS } = schalter);\nif (AUS) { expect(wert).toBe(1); }",
      ],
      // der Kopf `for (AUS of …)` bindet nicht, er weist zu
      [
        "Zuweisung im Schleifenkopf",
        "const AUS = false;\nfor (AUS of [true]) { }\nif (AUS) { expect(wert).toBe(1); }",
      ],
      [
        "Zuweisung im Schleifenkopf",
        "const AUS = false;\nfor (AUS in schalter) { }\nif (AUS) { expect(wert).toBe(1); }",
      ],
      // hoch- und heruntergezählt
      ["Zählung", "const AUS = false;\nAUS++;\nif (AUS) { expect(wert).toBe(1); }"],
      ["Zählung", "const AUS = false;\n--AUS;\nif (AUS) { expect(wert).toBe(1); }"],
      // DERSELBE NAME IN EINEM ANDEREN GELTUNGSBEREICH: zweimal gebunden heißt unbekannt. Beide
      // Reihenfolgen stehen hier, denn eine Tafel, die stillschweigend die erste oder die letzte
      // Bindung gewinnen ließe, käme bei genau einer von beiden durch.
      [
        "zweite Bindung",
        "function a() { const AUS = true; if (AUS) { expect(wert).toBe(1); } }\nfunction b() { const AUS = false; return AUS; }",
      ],
      [
        "zweite Bindung",
        "function a() { const AUS = false; return AUS; }\nfunction b() { const AUS = true; if (AUS) { expect(wert).toBe(1); } }",
      ],
      // als Parameter übergeben
      ["Parameter", "const AUS = false;\nfunction b(AUS) { if (AUS) { expect(wert).toBe(1); } }"],
      // eingeführt — beide Einfuhrformen, die einen Namen binden
      ["Einfuhr", 'import { AUS } from "./schalter";\nif (AUS) { expect(wert).toBe(1); }'],
      [
        "Einfuhr",
        'const AUS = false;\nimport AUS = require("./schalter");\nif (AUS) { expect(wert).toBe(1); }',
      ],
      // eine Deklaration gleichen Namens beschattet die Konstante
      ["Deklaration", "const AUS = false;\nfunction AUS() { }\nif (AUS) { expect(wert).toBe(1); }"],
      ["Deklaration", "const AUS = false;\nclass AUS { }\nif (AUS) { expect(wert).toBe(1); }"],
      ["Deklaration", "const AUS = false;\nenum AUS { A }\nif (AUS) { expect(wert).toBe(1); }"],
      // KORREKTURPFLICHT 2: der Name eines Funktions-/KlassenAUSDRUCKS bindet im eigenen Rumpf
      [
        "benannter Ausdruck",
        "const AUS = false;\nconst f = function AUS() { if (AUS) { expect(wert).toBe(1); } };",
      ],
      [
        "benannter Ausdruck",
        "const AUS = false;\nconst C = class AUS { static f() { if (AUS) { expect(wert).toBe(1); } } };",
      ],
      // zerlegt statt gebunden
      ["Bindung zerlegt", "const { AUS } = schalter;\nif (AUS) { expect(wert).toBe(1); }"],
      // an etwas gebunden, das kein `true`/`false`-Literal ist
      ["kein Literal", "const AUS = 0;\nif (AUS) { expect(wert).toBe(1); }"],
      ["kein Literal", "const AUS = irgendwas;\nif (AUS) { expect(wert).toBe(1); }"],
      // ein nicht-konstanter Verteiler lässt jede Gruppe lebend
      [
        "Verteiler unbekannt",
        "switch (wahl) { case true: expect(wert).toBe(1); break; default: break; }",
      ],
      // und ein `case`, dessen Sprungwert kein Parser kennt, könnte treffen
      ["Sprungwert unbekannt", "switch (false) { case unbekannt: expect(wert).toBe(1); break; }"],
      // `default` VOR einer Gruppe mit unbekanntem Sprungwert: er läuft, sobald sie nicht trifft
      [
        "default als eigener Einstieg",
        "switch (false) { default: expect(wert).toBe(1); case unbekannt: break; }",
      ],
      // KORREKTURPFLICHT 1: ein `break` in der unbekannten Gruppe beendet nur DEREN Durchfall
      [
        "jeder mögliche Einstieg",
        "switch (false) { case unbekannt: break; default: expect(wert).toBe(1); }",
      ],
      [
        "jeder mögliche Einstieg",
        "switch (false) { case unbekannt: break; case false: expect(wert).toBe(1); }",
      ],
      [
        "jeder mögliche Einstieg",
        "switch (false) { default: break; case unbekannt: expect(wert).toBe(1); }",
      ],
    ] as const) {
      expect([regel, quelltext, erwartungsstellen(quelltext, "PROBE.ts").stellen.length]).toEqual([
        regel,
        quelltext,
        1,
      ]);
    }

    // Und die Gegenprobe zur Gegenprobe: EIN einziges `const`-Vorkommen, an ein Literal gebunden,
    // wird aufgelöst — sonst wäre die Liste oben nur eine Liste ohne Unterscheidung.
    expect(
      erwartungsstellen("const AUS = false;\nif (AUS) { expect(wert).toBe(1); }", "PROBE.ts")
        .stellen,
    ).toEqual([]);
  });

  it("P12 · AUSGEFÜHRT gemessen: der Baum zählt genau so oft, wie der Lauf wirklich ruft", () => {
    // JOB 3791 RUNDE 2 — die Korrekturpflichten 1 bis 3 von Prüfer BEN, an ihrem eigenen Maßstab.
    //
    // WARUM DIESER FALL ANDERS PRÜFT ALS P8 BIS P11. Dort steht die erwartete Zahl im Test; hier
    // steht sie NIRGENDS — jede Quelle wird WIRKLICH AUSGEFÜHRT, die echten Aufrufe werden gezählt,
    // und der Baum muss auf dieselbe Zahl kommen. Damit kann kein Fall mehr grün sein, weil Test
    // und Wächter denselben Irrtum teilen. Genau so hat BEN in Runde 1 gemessen und drei Stellen
    // gefunden, an denen der Wächter LEBENDE Erwartungen für tot erklärte: ein `break` in einer
    // Gruppe mit unbekanntem Sprungwert tötete den `default` dahinter (Pflicht 1), und ein
    // benannter Funktions- oder Klassenausdruck tötete seinen eigenen Rumpf (Pflicht 2).
    for (const [quelltext, wieviele] of [
      // KORREKTURPFLICHT 1 — jeder mögliche Einstieg. Der unbekannte Sprungwert trifft NICHT, also
      // läuft, was dahinter steht; sein `break` sagt darüber nichts.
      [
        "const sprung = () => true; switch (false) { case sprung(): break; default: expect(1); }",
        1,
      ],
      [
        "const sprung = () => true; switch (false) { case sprung(): break; case false: expect(1); }",
        1,
      ],
      // … und andersherum: der unbekannte Sprungwert TRIFFT, der `default` davor läuft nicht.
      [
        "const sprung = () => false; switch (false) { default: break; case sprung(): expect(1); }",
        1,
      ],
      // KORREKTURPFLICHT 2 — der Name eines benannten Ausdrucks steht in seinem Rumpf für sich
      // selbst, also für etwas Wahres, und nicht für die gleichnamige äußere Konstante.
      ["const AUS = false; (function AUS() { if (AUS) { expect(1); } })();", 1],
      ["const AUS = false; const C = class AUS { static f() { if (AUS) expect(1); } }; C.f();", 1],
      // Der echte Durchfall (in Runde 1 war die so beschriftete Zeile eine mit `break`).
      ["switch (false) { case false: void 0; case true: expect(1); }", 1],
      ["switch (false) { case false: expect(1); break; case true: expect(2); }", 1],
      ["switch (false) { case true: expect(1); break; default: expect(2); }", 1],
      // Die Gegenrichtung zu den drei Umgehungen: was läuft, zählt.
      ["const AN = true; if (AN) { expect(1); }", 1],
      ["for (const x of [1]) { expect(1); }", 1],
      ["do { expect(1); } while (false);", 1],
      // Und die drei Umgehungen selbst, an derselben Waage: null Aufrufe, null gezählt.
      ["const AUS = false; if (AUS) { expect(1); }", 0],
      ["switch (false) { case true: expect(1); }", 0],
      ["for (const x of []) { expect(1); }", 0],
    ] as const) {
      let wirklich = 0;
      // Die Quelle läuft echt; `expect` ist hier der Zähler, nicht die Prüfung des Falls.
      new Function("expect", quelltext)(() => {
        wirklich += 1;
      });
      // Erst der Lauf gegen die Erwartung des Falls — sonst maße eine falsch gebaute Quelle nichts.
      expect([quelltext, "Lauf", wirklich]).toEqual([quelltext, "Lauf", wieviele]);
      // Dann der Baum gegen den Lauf: dieselbe Zahl, nicht bloß dieselbe Richtung.
      expect([quelltext, "Baum", erwartungsstellen(quelltext, "PROBE.ts").stellen.length]).toEqual([
        quelltext,
        "Baum",
        wirklich,
      ]);
    }
  });

  it("P13 · die SPRUNGWERTE eines `switch` werden der Reihe nach verglichen — und nur bis zum Treffer", () => {
    // JOB 3791 RUNDE 3 — KORREKTURPFLICHT 1 von Prüfer BEN an Runde 2.
    //
    // WAS RUNDE 2 ÜBERSAH. Sie trennte richtig, welche GRUPPE ein Lauf betritt, besuchte aber die
    // SPRUNGWERTE aller Gruppen vorweg und in einem Zug — mit dem Satz „die Sprungwerte werden
    // verglichen, also ausgewertet, sie zählen immer mit". Das ist zu weit: JavaScript vergleicht
    // die Sprungwerte NACHEINANDER und hört beim ersten Treffer auf. Was danach steht, wird nie
    // ausgewertet. BEN hat es an echtem Material gemessen:
    //
    //   switch (false) { case false: break; case expect(1): break; }   Lauf 0 · Runde 2 zählte 1
    //
    // Damit war eine geführte Erwartung erneut still abzuschalten — sie stand in einem Sprungwert
    // hinter dem Treffer, lief nie und bezahlte den Boden weiter. Genau das ist die Lücke, gegen
    // die dieses ganze Modul gebaut ist, nur eine Syntax weiter.
    //
    // WIE HIER GEPRÜFT WIRD: wie in P12 steht die erwartete Zahl NICHT im Test — jede Quelle läuft
    // wirklich, ihre echten Aufrufe werden gezählt, und der Baum muss dieselbe Zahl treffen.
    for (const [quelltext, wieviele] of [
      // VOR dem Treffer wird verglichen, also ausgewertet — der Sprungwert zählt.
      ["switch (false) { case expect(1): break; case false: break; }", 1],
      // NACH einem sicher passenden Sprungwert wird nichts mehr verglichen — BENs Fall.
      ["switch (false) { case false: break; case expect(1): break; }", 0],
      // `default` wird beim Vergleich übersprungen und ändert an der Reihenfolge nichts: der
      // Treffer davor beendet sie, der Sprungwert dahinter läuft nicht.
      ["switch (false) { case false: break; default: break; case expect(1): break; }", 0],
      // … und steht `default` VOR dem `case`, wird dessen Sprungwert trotzdem verglichen.
      ["switch (false) { default: break; case expect(1): break; }", 1],
      // Ein Sprungwert, den kein Parser kennt, der aber NICHT trifft: der nächste wird verglichen.
      [
        "const sprung = () => true; switch (false) { case sprung(): break; case expect(1): break; }",
        1,
      ],
      // Der Verteiler selbst wird immer ausgewertet, ganz gleich was danach kommt.
      ["switch (expect(1)) { case false: break; }", 1],
    ] as const) {
      let wirklich = 0;
      new Function("expect", quelltext)(() => {
        wirklich += 1;
      });
      expect([quelltext, "Lauf", wirklich]).toEqual([quelltext, "Lauf", wieviele]);
      expect([quelltext, "Baum", erwartungsstellen(quelltext, "PROBE.ts").stellen.length]).toEqual([
        quelltext,
        "Baum",
        wirklich,
      ]);
    }

    // DIE EINE STELLE, AN DER BAUM UND LAUF AUSEINANDERGEHEN — und zwar mit Absicht. Trifft ein
    // Sprungwert, den kein Parser kennt, so wird der dahinter nie verglichen; ob er trifft, weiß
    // aber erst der Lauf. Unbekannt heißt hier wie überall LEBEND, also gezählt. Die Richtung ist
    // gewählt und nicht zufällig: zählte der Wächter hier zu wenig, machte er eine unschuldige
    // Bestandsdatei rot (Fehlalarm), und ein Fehlalarm nimmt ihm den Dienst ganz. Die Zeile steht
    // hier gemessen da, damit die Grenze nicht behauptet, sondern belegt ist.
    const konservativ =
      "const sprung = () => false; switch (false) { case sprung(): break; case expect(1): break; }";
    let liefe = 0;
    new Function("expect", konservativ)(() => {
      liefe += 1;
    });
    expect([konservativ, "Lauf", liefe]).toEqual([konservativ, "Lauf", 0]);
    expect([
      konservativ,
      "Baum",
      erwartungsstellen(konservativ, "PROBE.ts").stellen.length,
    ]).toEqual([konservativ, "Baum", 1]);
  });

  it("P6 · kein Fehlalarm: eine umbenannte oder weitergereichte Erwartung zählt weiter mit", () => {
    // Lehre aus JOB 3579 R1 (Prüfer BEN an einem anderen AST-Wächter): wer nur das Wort „expect"
    // kennt, übersieht `const pruefe = expect`. Für DIESEN Wächter wäre das kein Loch, sondern ein
    // Fehlalarm — er zählte zu wenig und würde eine unschuldige Datei rot machen.
    const weitergereicht = [
      'import { expect, it } from "vitest";',
      "const pruefe = expect;",
      "it('x', () => {",
      "  pruefe(wert).toBe(1);",
      "});",
    ].join("\n");
    expect(erwartungsstellen(weitergereicht, "PROBE.ts").stellen).toHaveLength(1);

    const umbenanntEingefuehrt = [
      'import { expect as pruefe, it } from "vitest";',
      "it('x', () => {",
      "  pruefe(wert).toBe(1);",
      "});",
    ].join("\n");
    const mitNamen = erwartungsstellen(umbenanntEingefuehrt, "PROBE.ts");
    expect(mitNamen.stellen).toHaveLength(1);
    expect(mitNamen.namen).toContain("pruefe");
  });

  it("P7 · eine Erwartung in einer `${…}`-Einbettung LÄUFT und zählt deshalb mit", () => {
    // Die Gegenrichtung zu P2: nicht jedes Literal ist tot. Was in einer Einbettung steht, ist
    // Code — die alte Zählung wusste das auch, und dieser Fall hält es fest.
    const einbettung = ["void `Vorlage mit ${expect(wert).toBe(1)} darin`;"].join("\n");
    expect(erwartungsstellen(einbettung, "PROBE.ts").stellen).toHaveLength(1);
  });
});
