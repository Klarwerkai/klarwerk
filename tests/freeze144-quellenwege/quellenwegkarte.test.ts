// ================================================================================================
// QUELLENWEGKARTE ZUM EINGEFRORENEN STAND — R-1468 (FREEZE144-QUELLENWEGKARTE, FREEZE144-WAECHTER).
// ================================================================================================
//
// WOZU. `tests/library-analytics-freeze144.test.ts` sichert sechs Dateien per Hash. Was der Hash
// nicht zeigt: woher der eingefrorene Stand seine Inhalte bezieht. `index.ts` leitet etwa Funktionen
// aus `service.ts`, `explore.ts` und weiteren Dateien aus, die NICHT eingefroren sind, und
// `types.ts` bezieht Typen aus `knowledge-object`. Die Karte `docs/freeze144/quellenwegkarte.json`
// nennt diese Wege je Datei und ordnet jedes Ziel ein (eingefroren / modul / nachbarmodul / paket).
//
// WAS DER WAECHTER MELDET.
//   · NEUER QUELLWEG     die Datei bezieht aus einer Stelle, die die Karte nicht nennt.
//   · ENTFALLENER WEG    die Karte nennt einen Weg, den die Datei nicht mehr hat.
//   · ABWEICHUNG         Ziel oder Einordnung eines Wegs stimmen nicht mehr.
//   · GLEICHLAUF         die Karte fuehrt genau die Dateien des FREEZE-144-Manifests. Kommt dort
//                        eine Datei hinzu oder faellt eine weg, ist die Karte rot (R-1351: dieselbe
//                        Dateiliste steht an zwei Stellen und darf nicht auseinanderlaufen).
//
// GRENZE. Erhoben werden die direkten Wege jeder eingefrorenen Datei, nicht die transitive Huelle.
// Was sich INNERHALB eines nicht eingefrorenen Ziels aendert, meldet die Karte nicht; sie macht nur
// sichtbar, dass dieser Teil des eingefrorenen Stands nicht vom Freeze gedeckt ist.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const KARTE_PFAD = "docs/freeze144/quellenwegkarte.json";
const FREEZE_WAECHTER = "tests/library-analytics-freeze144.test.ts";
const MODUL = "services/library-analytics/";

type Art = "eingefroren" | "modul" | "nachbarmodul" | "paket";

interface Quellweg {
  readonly von: string;
  readonly ziel: string;
  readonly art: Art;
}

interface KartenDatei {
  readonly pfad: string;
  readonly quellwege: Quellweg[];
}

interface Karte {
  readonly dateien: KartenDatei[];
}

/** Liest eine Datei relativ zur Wurzel; `undefined`, wenn es sie nicht gibt. */
type Leser = (pfad: string) => string | undefined;

/** Ein Verzeichnis ist keine Datei: `../../audit` loest erst ueber `index.ts` auf. */
const echterLeser: Leser = (pfad) => {
  const absolut = join(REPO_WURZEL, pfad);
  if (!existsSync(absolut) || !statSync(absolut).isFile()) {
    return undefined;
  }
  return readFileSync(absolut, "utf8");
};

/** Die Dateiliste des FREEZE-144-Manifests, gelesen aus dem Freeze-Waechter selbst. */
function eingefroreneDateien(leser: Leser): string[] {
  const quelle = leser(FREEZE_WAECHTER) ?? "";
  return [...quelle.matchAll(/^ {4}pfad: "([^"]+)",$/gm)].map((m) => m[1] as string);
}

/** Alle Modulangaben einer Datei aus dem Syntaxbaum: Import, Re-Export, import(), import-Typ. */
function modulangaben(pfad: string, text: string): string[] {
  const quelle = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true);
  const gefunden = new Set<string>();
  const besuche = (knoten: ts.Node): void => {
    if (
      (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) &&
      knoten.moduleSpecifier &&
      ts.isStringLiteral(knoten.moduleSpecifier)
    ) {
      gefunden.add(knoten.moduleSpecifier.text);
    }
    if (ts.isCallExpression(knoten) && knoten.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const erstes = knoten.arguments[0];
      if (erstes && ts.isStringLiteral(erstes)) {
        gefunden.add(erstes.text);
      }
    }
    if (
      ts.isImportTypeNode(knoten) &&
      ts.isLiteralTypeNode(knoten.argument) &&
      ts.isStringLiteral(knoten.argument.literal)
    ) {
      gefunden.add(knoten.argument.literal.text);
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(quelle);
  return [...gefunden].sort();
}

/** Loest eine relative Angabe auf eine Datei auf; Pakete bleiben ihr Name. */
function aufloesen(pfad: string, von: string, leser: Leser): string | undefined {
  if (!von.startsWith(".")) {
    return von;
  }
  const basis = posix.normalize(posix.join(posix.dirname(pfad), von));
  const kandidaten = [`${basis}.ts`, `${basis}.tsx`, `${basis}/index.ts`, basis];
  return kandidaten.find((k) => leser(k) !== undefined);
}

function einordnen(von: string, ziel: string, eingefroren: ReadonlySet<string>): Art {
  if (!von.startsWith(".")) {
    return "paket";
  }
  if (eingefroren.has(ziel)) {
    return "eingefroren";
  }
  return ziel.startsWith(MODUL) ? "modul" : "nachbarmodul";
}

/** Erhebt die Karte aus dem Bestand — ohne einen Blick in die gespeicherte Karte. */
function erhebeKarte(leser: Leser): { karte: Karte; fehler: string[] } {
  const fehler: string[] = [];
  const dateien = eingefroreneDateien(leser);
  const eingefroren = new Set(dateien);
  const karte: Karte = {
    dateien: dateien.map((pfad) => {
      const text = leser(pfad);
      if (text === undefined) {
        fehler.push(`EINGEFRORENE DATEI FEHLT  ${pfad}`);
        return { pfad, quellwege: [] };
      }
      const quellwege = modulangaben(pfad, text).map((von): Quellweg => {
        const ziel = aufloesen(pfad, von, leser);
        if (ziel === undefined) {
          fehler.push(`ZIEL NICHT AUFLOESBAR  ${pfad}: ${von}`);
          return { von, ziel: "", art: "nachbarmodul" };
        }
        return { von, ziel, art: einordnen(von, ziel, eingefroren) };
      });
      return { pfad, quellwege };
    }),
  };
  return { karte, fehler };
}

/** Vergleicht gespeicherte und erhobene Karte in beide Richtungen. */
function vergleiche(gespeichert: Karte, leser: Leser): string[] {
  const { karte: erhoben, fehler } = erhebeKarte(leser);
  const meldungen = [...fehler];
  const soll = new Map(gespeichert.dateien.map((d) => [d.pfad, d]));
  const ist = new Map(erhoben.dateien.map((d) => [d.pfad, d]));
  if (ist.size === 0) {
    meldungen.push(`GLEICHLAUF  in ${FREEZE_WAECHTER} ist keine eingefrorene Datei zu finden`);
  }
  for (const pfad of ist.keys()) {
    if (!soll.has(pfad)) {
      meldungen.push(`GLEICHLAUF  ${pfad} ist eingefroren, steht aber nicht in der Karte`);
    }
  }
  for (const pfad of soll.keys()) {
    if (!ist.has(pfad)) {
      meldungen.push(`GLEICHLAUF  ${pfad} steht in der Karte, ist aber nicht eingefroren`);
    }
  }
  for (const [pfad, istDatei] of ist) {
    const sollDatei = soll.get(pfad);
    if (!sollDatei) {
      continue;
    }
    const sollWege = new Map(sollDatei.quellwege.map((w) => [w.von, w]));
    const istWege = new Map(istDatei.quellwege.map((w) => [w.von, w]));
    for (const [von, w] of istWege) {
      const s = sollWege.get(von);
      if (!s) {
        meldungen.push(`NEUER QUELLWEG  ${pfad} bezieht aus ${von} (${w.ziel}, ${w.art})`);
      } else if (s.ziel !== w.ziel || s.art !== w.art) {
        meldungen.push(
          `ABWEICHUNG  ${pfad}: ${von} — Karte ${s.ziel} (${s.art}), erhoben ${w.ziel} (${w.art})`,
        );
      }
    }
    for (const von of sollWege.keys()) {
      if (!istWege.has(von)) {
        meldungen.push(`ENTFALLENER WEG  ${pfad} bezieht nicht mehr aus ${von}`);
      }
    }
  }
  return meldungen;
}

function liesKarte(): Karte {
  return JSON.parse(readFileSync(join(REPO_WURZEL, KARTE_PFAD), "utf8")) as Karte;
}

type Umbau = (wege: Quellweg[]) => Quellweg[];

/** Eine Kopie der Karte, in der die Wege EINER Datei umgebaut sind. */
function umgebaut(karte: Karte, pfad: string, umbau: Umbau): Karte {
  const dateien = karte.dateien.map((d) => {
    if (d.pfad !== pfad) {
      return d;
    }
    return { ...d, quellwege: umbau(d.quellwege) };
  });
  return { dateien };
}

/** Ein Leser, der einzelne Dateien ersetzt und sonst den echten Bestand liest. */
function mitErsatz(ersatz: Readonly<Record<string, string | undefined>>): Leser {
  return (pfad) => (pfad in ersatz ? ersatz[pfad] : echterLeser(pfad));
}

const INDEX = "services/library-analytics/index.ts";

describe("Freeze-144 · Quellenwegkarte · der echte Bestand", () => {
  it("die gespeicherte Karte stimmt mit den erhobenen Quellwegen ueberein", () => {
    expect(vergleiche(liesKarte(), echterLeser).join("\n")).toBe("");
  });

  it("die Karte fuehrt genau die Dateien des FREEZE-144-Manifests", () => {
    const eingefroren = eingefroreneDateien(echterLeser);
    expect(eingefroren.length).toBeGreaterThan(0);
    expect(liesKarte().dateien.map((d) => d.pfad)).toEqual(eingefroren);
  });

  it("die Karte nennt, welche Inhalte NICHT vom Freeze gedeckt sind", () => {
    const wege = liesKarte().dateien.flatMap((d) => d.quellwege);
    const ungedeckteArten = new Set<Art>(["modul", "nachbarmodul"]);
    const ungedeckt = wege.filter((w) => ungedeckteArten.has(w.art)).map((w) => w.ziel);
    expect(ungedeckt).toContain("services/library-analytics/src/service.ts");
    expect(ungedeckt).toContain("services/knowledge-object/index.ts");
  });
});

describe("Freeze-144 · Quellenwegkarte · Gegenproben", () => {
  it("K1 · ein neuer Import in einer eingefrorenen Datei wird gemeldet", () => {
    const alt = echterLeser(INDEX) ?? "";
    const leser = mitErsatz({ [INDEX]: `import { x } from "./src/laufbindung";\n${alt}` });
    const text = vergleiche(liesKarte(), leser).join("\n");
    expect(text).toContain(`NEUER QUELLWEG  ${INDEX} bezieht aus ./src/laufbindung`);
    expect(text).toContain("services/library-analytics/src/laufbindung.ts, modul");
  });

  it("K2 · ein entfallener Weg wird gemeldet", () => {
    const mitExtra = umgebaut(liesKarte(), INDEX, (wege) => [...wege, extraWeg()]);
    expect(vergleiche(mitExtra, echterLeser).join("\n")).toContain(
      `ENTFALLENER WEG  ${INDEX} bezieht nicht mehr aus ./src/gibt-es-nicht`,
    );
  });

  it("K3 · eine falsche Einordnung wird gemeldet", () => {
    const alleEingefroren: Umbau = (wege) => wege.map((w) => ({ ...w, art: "eingefroren" }));
    const falsch = umgebaut(liesKarte(), INDEX, alleEingefroren);
    expect(vergleiche(falsch, echterLeser).join("\n")).toContain(
      `ABWEICHUNG  ${INDEX}: ./src/service`,
    );
  });

  it("K4 · Gleichlauf: eine siebte eingefrorene Datei ohne Kartenzeile ist rot", () => {
    const freeze = echterLeser(FREEZE_WAECHTER) ?? "";
    const zusatz = '    pfad: "services/library-analytics/src/themes.ts",\n';
    const leser = mitErsatz({ [FREEZE_WAECHTER]: `${freeze}\n${zusatz}` });
    expect(vergleiche(liesKarte(), leser).join("\n")).toContain(
      "GLEICHLAUF  services/library-analytics/src/themes.ts ist eingefroren",
    );
  });

  it("K5 · Gleichlauf: eine Kartenzeile ohne eingefrorene Datei ist rot", () => {
    const fremd: KartenDatei = { pfad: "services/x.ts", quellwege: [] };
    const mehr: Karte = { dateien: [...liesKarte().dateien, fremd] };
    expect(vergleiche(mehr, echterLeser).join("\n")).toContain(
      "GLEICHLAUF  services/x.ts steht in der Karte, ist aber nicht eingefroren",
    );
  });

  it("K6 · ein Freeze-Waechter ohne lesbare Dateiliste schaltet die Karte nicht still ab", () => {
    const leser = mitErsatz({ [FREEZE_WAECHTER]: "" });
    expect(vergleiche(liesKarte(), leser).join("\n")).toContain("keine eingefrorene Datei");
  });

  it("K7 · import(), import-Typ und Re-Export werden erhoben", () => {
    const text = [
      'export { a } from "./a";',
      'const b = await import("./b");',
      'type C = import("./c").C;',
    ].join("\n");
    expect(modulangaben("x.ts", text)).toEqual(["./a", "./b", "./c"]);
  });
});

function extraWeg(): Quellweg {
  return {
    von: "./src/gibt-es-nicht",
    ziel: "services/library-analytics/src/gibt-es-nicht.ts",
    art: "modul",
  };
}
