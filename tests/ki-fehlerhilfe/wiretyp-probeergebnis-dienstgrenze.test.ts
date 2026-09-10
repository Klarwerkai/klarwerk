// ================================================================================================
// JOB 3420 · RUNDE 3/4 — DIE DIENSTGRENZE DES PRÜFERGEBNISSES BEKOMMT IHREN EIGENEN WÄCHTER.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT: Der Auftrag (§5.1, §8.6a) nennt
// `tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts` als den Wächter, der rot wird, wenn nur EINE
// der beiden Typformen die neuen Felder bekommt. Das ist nachgemessen FALSCH — jener Wächter prüft
// `DescribeImageResult`, nicht `ReasonerProbeResult` (job1164:56-60, `describeRumpf`). BEN hat die
// Lücke in Runde 1 und Runde 2 als Hinweis stehen lassen; hier wird sie geschlossen.
//
// WARUM ÜBER DEN QUELLTEXT UND NICHT ÜBER EINEN IMPORT: `apps/web/src` darf nicht aus `services/`
// importieren (Begründung an Ort und Stelle: `apps/web/src/api/types.ts:1742-1746`). Der Client
// schreibt die Form deshalb selbst aus — und genau daraus entsteht die Gefahr der stillen Drift:
// eine Seite bekommt ein Feld, die andere nicht, und niemand merkt es, weil beide für sich
// typprüfen. Dieser Vergleich IST der Ersatz für den verbotenen Import.
//
// ================================================================================================
// RUNDE 4 — WARUM HIER JETZT DER SYNTAXBAUM LIEST UND NICHT MEHR DER ZEILENTEXT.
// ================================================================================================
//
// DER BEFUND (BENs Korrekturpflicht an Runde 3, seine Gegenprobe): Runde 3 hat die Kommentare
// zeilenweise mit `zeile.replace(/\/\/.*$/, "")` entfernt und daraus „Kommentare zählen nicht mit"
// zugesichert. Das war zu viel behauptet: bei einem MEHRZEILIGEN Blockkommentar
//
//     /*
//     status?: number;
//     */
//
// steht die mittlere Zeile unverändert da — sie trägt kein `//`. Der Wächter hätte ein Feld gezählt,
// das der Compiler nicht sieht; BEN hat genau das gemessen („dieselbe Deklaration ausschließlich
// innerhalb von `/*` und `*/` auf eigenen Zeilen → `Tests 5 passed (5)`", dazu „Compiler erkennt
// status: false").
//
// JETZT LIEST DER TYPESCRIPT-PARSER SELBST: `ts.createSourceFile` baut den Syntaxbaum, gezählt werden
// die `PropertySignature`-Glieder der Schnittstelle. Ein Kommentar — einzeilig, mehrzeilig, im
// Fließtext — ist im Baum gar kein Glied und kann den Wächter darum grundsätzlich nicht grün halten.
// Dasselbe Verfahren und dieselbe Begründung wie in `tests/tor-inventar/browser-gruppe.ts:20-29`
// („Warum über den Syntaxbaum und nicht über Zeichenketten") und dieselbe Lehre wie Codex' Auflage
// aus JOB 3401 R1: einen Wächter an der ausführbaren Zeile verankern, nie an einer Zeichenkette, die
// auch in einem Kommentar stehen kann.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SERVER_TYPES = join(__dirname, "../../services/reasoner/src/types.ts");
const WEB_TYPES = join(__dirname, "../../apps/web/src/api/types.ts");
const SERVER_FEHLERKLASSEN = join(__dirname, "../../services/reasoner/src/model-errors.ts");

/** Ein Feld der Schnittstelle, wie der Parser es sieht: `status?: number`. */
function felderAusQuelle(quelle: string, name = "ReasonerProbeResult"): string[] {
  // `setParentNodes: true` — sonst liefert `getText()` am Typknoten nichts.
  const baum = ts.createSourceFile(
    "wiretyp.ts",
    quelle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const gefunden: string[] = [];
  let gesehen = false;
  const besuche = (knoten: ts.Node): void => {
    if (ts.isInterfaceDeclaration(knoten) && knoten.name.text === name) {
      gesehen = true;
      for (const glied of knoten.members) {
        if (!ts.isPropertySignature(glied) || !ts.isIdentifier(glied.name)) {
          continue;
        }
        const optional = glied.questionToken === undefined ? "" : "?";
        const typ = glied.type === undefined ? "" : glied.type.getText(baum).replace(/\s+/g, " ");
        gefunden.push(`${glied.name.text}${optional}: ${typ}`);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  ts.forEachChild(baum, besuche);
  expect(gesehen, `Schnittstelle ${name} nicht gefunden`).toBe(true);
  return gefunden.sort();
}

/** Dasselbe aus einer Datei. */
const felder = (datei: string): string[] => felderAusQuelle(readFileSync(datei, "utf8"));

/** Die Werte der geschlossenen Vereinigung `ModelFailureClass` — auch das aus dem Baum. */
function fehlerklassen(datei: string): string[] {
  const baum = ts.createSourceFile(
    "klassen.ts",
    readFileSync(datei, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const werte: string[] = [];
  let gesehen = false;
  const besuche = (knoten: ts.Node): void => {
    if (ts.isTypeAliasDeclaration(knoten) && knoten.name.text === "ModelFailureClass") {
      gesehen = true;
      const glieder = ts.isUnionTypeNode(knoten.type) ? knoten.type.types : [knoten.type];
      for (const glied of glieder) {
        if (ts.isLiteralTypeNode(glied) && ts.isStringLiteral(glied.literal)) {
          werte.push(glied.literal.text);
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  ts.forEachChild(baum, besuche);
  expect(gesehen, `ModelFailureClass nicht gefunden in ${datei}`).toBe(true);
  return werte.sort();
}

/** Die neun Felder, die beide Seiten führen müssen — die Sollform, ausgeschrieben. */
const SOLL = [
  "anbieter?: ReasonerCloudAnbieter",
  "anbieterGrund?: string",
  "at: string",
  "detail: string",
  "fehlerklasse?: ModelFailureClass",
  'mode: "model" | "deterministic"',
  "ok: boolean",
  "provider: string",
  "status?: number",
];

describe("JOB 3420 · Dienstgrenze — Server und Client führen dasselbe Prüfergebnis", () => {
  it("beide Seiten führen GENAU dieselben Felder, mit Optionalität UND Typ", () => {
    // Die schärfste Form: kein Feld mehr, kein Feld weniger, keines, das auf einer Seite Pflicht
    // und auf der anderen optional wäre, und keines mit einem anderen Typ.
    expect(felder(SERVER_TYPES)).toEqual(SOLL);
    expect(felder(WEB_TYPES)).toEqual(SOLL);
  });

  it("die Fehlerklassen sind auf beiden Seiten dieselbe geschlossene Menge", () => {
    const server = fehlerklassen(SERVER_FEHLERKLASSEN);
    expect(server).toEqual(["http", "network", "parse", "timeout", "unknown"]);
    expect(fehlerklassen(WEB_TYPES)).toEqual(server);
  });

  // ==============================================================================================
  // DIE GEGENPROBEN — am ECHTEN Dateitext, ohne die Produktdatei anzufassen.
  // ==============================================================================================
  // Jede nimmt die wirkliche Client-Datei, schreibt GENAU EINE Deklaration in einen Kommentar um und
  // prüft, dass der Wächter das bemerkt. Das ist BENs Testvorschlag, Feld für Feld ausgeführt.
  for (const feld of [
    "fehlerklasse?: ModelFailureClass;",
    "status?: number;",
    "anbieterGrund?: string;",
  ] as const) {
    const name = feld.split("?")[0] as string;
    /**
     * Die Vorbedingung jeder Gegenprobe, ausdrücklich geprüft: im UNVERSTELLTEN Client-Typ ist das
     * Feld wirklich eine Deklaration. Fehlt sie (weil jemand das Feld entfernt oder auskommentiert
     * hat), sagt der Fall genau das — und nicht ein verwirrendes „beide Listen sind gleich".
     */
    const vorbedingung = (echt: string): string[] => {
      const vorher = felderAusQuelle(echt);
      expect(vorher, `Vorbedingung: ${name} ist im Client-Typ deklariert`).toContain(
        feld.replace(/;$/, ""),
      );
      return vorher;
    };

    it(`GEGENPROBE: ${name} nur in einem MEHRZEILIGEN Blockkommentar → der Wächter sieht es nicht mehr`, () => {
      const echt = readFileSync(WEB_TYPES, "utf8");
      // Verglichen wird gegen den UNVERSTELLTEN Stand derselben Datei und nicht gegen `SOLL`:
      // dieser Fall misst die WIRKUNG der Verstellung, nicht die Vollständigkeit des Produkts —
      // sonst spräche er über zwei Dinge zugleich und wäre bei einem echten Drift-Befund doppelt rot.
      const vorher = vorbedingung(echt);
      // Genau die Form, an der Runde 3 gescheitert ist: die Deklarationszeile trägt KEIN `//`.
      const verstellt = echt.replace(`  ${feld}`, `  /*\n  ${feld}\n  */`);
      expect(verstellt).not.toBe(echt);
      const gesehen = felderAusQuelle(verstellt);
      expect(gesehen, `der Parser zählt ${name} trotz Blockkommentar`).not.toContain(
        feld.replace(/;$/, ""),
      );
      expect(gesehen).not.toEqual(vorher);
      expect(gesehen.length).toBe(vorher.length - 1);
    });

    it(`GEGENPROBE: ${name} nur in einem Zeilenkommentar → der Wächter sieht es nicht mehr`, () => {
      const echt = readFileSync(WEB_TYPES, "utf8");
      const vorher = vorbedingung(echt);
      const verstellt = echt.replace(`  ${feld}`, `  // ${feld}`);
      expect(verstellt).not.toBe(echt);
      expect(felderAusQuelle(verstellt)).not.toEqual(vorher);
    });
  }

  it("GEGENPROBE: ein Feld, das nur im erklärenden Fließtext vorkommt, zählt nicht", () => {
    // Beide Typen tragen lange Begründungsblöcke, in denen die Feldnamen vorkommen (z. B.
    // `types.ts:617-628`). Genau deshalb darf der Wächter nicht nach Namen SUCHEN, sondern muss
    // Glieder ZÄHLEN — sonst genügte ein Kommentar als Nachweis.
    const erfunden = [
      "export interface ReasonerProbeResult {",
      "  ok: boolean;",
      "  /**",
      "   * Hier stand früher `status?: number;` und `anbieterGrund?: string;`.",
      "   * fehlerklasse?: ModelFailureClass;",
      "   */",
      "}",
    ].join("\n");
    expect(felderAusQuelle(erfunden)).toEqual(["ok: boolean"]);
  });
});
