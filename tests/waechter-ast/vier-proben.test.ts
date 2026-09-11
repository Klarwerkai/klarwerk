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
