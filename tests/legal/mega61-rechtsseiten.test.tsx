// ================================================================================================
// AUFTRAG-mega61 BLOCK A — WO DIE GEMOUNTETEN TORWÄCHTER-TESTS WOHNEN, UND WARUM DORT.
// ================================================================================================
//
// DIE EIGENTLICHEN FÄLLE stehen in `apps/web/src/legal/mega61-rechtsseiten.test.tsx`. Hier steht
// nur der Wächter, der sie dort HÄLT — und der Grund dafür, weil er sonst beim nächsten Aufräumen
// verlorengeht:
//
// `tsconfig.tests-tsx.json` typprüft alle `.tsx` unter `tests/**` in einem EIGENEN Programm mit den
// Einstellungen und Typen der WURZEL. Für kleine, gemountete Bausteine reicht das. Sobald ein Test
// dort aber `apps/web/src/App` importiert, zieht er über `routes.tsx` die GANZE Anwendung in dieses
// Programm — und dann prüft der Wurzel-Typprüfer Web-Dateien mit Wurzel-Einstellungen. Ergebnis
// gemessen, nicht vermutet: acht Fehler in fünf Dateien (fehlendes `vite/client` für
// `import.meta.env`, `override` an der Fehlergrenze, `exactOptionalPropertyTypes` gegen die
// i18next-Typen), von denen KEINER ein echter Defekt ist. Der Typprüfer der Anwendung
// (`apps/web/tsconfig.json`) ist über dieselben Dateien grün — er hat DOM, jsx, `vite/client` und
// die passenden @types.
//
// Deshalb wohnen Tests, die den Torwächter oder die Anwendungshülle MONTIEREN, unter
// `apps/web/src/**`. Der Testlauf sieht sie dort genauso (vitest.config.ts schließt
// `apps/web/src/**/*.test.{ts,tsx}` seit mega59 ein), und der richtige Typprüfer auch.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// AUFTRAG-mega86 BLOCK D — DIESER WÄCHTER HAT NAMENSANWESENHEIT GEMESSEN.
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// DER BEFUND (ben, sammel84-mega85, GELB): hier stand `inhalt.includes("apps/web/src/App")` — eine
// Suche nach einer ZEICHENFOLGE im Dateitext, die weder Importdeklarationen noch Kommentare noch
// Stringliterale unterschied. Zwei Fehler in einem:
//   · Er wurde bei bloßer DOKUMENTATION falsch rot. Genau das ist in mega85 passiert: der Sammler
//     `tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx` musste den Pfad NENNEN, um ihn
//     auszuschließen, und hat ihn deshalb aus Teilstücken zusammengesetzt. Eine Ausweichkonvention,
//     die zur zweiten Wahrheit geworden wäre — sie ist mit mega86 zurückgebaut.
//   · Und er übersah zugleich andere Importformen (`import type`, `export … from`, dynamisches
//     `import()`, `require`), die den Rahmen genauso in das Programm ziehen.
//
// JETZT WERDEN ECHTE IMPORTDEKLARATIONEN ERKANNT, über den TypeScript-Baum statt über Textsuche.
// Der SCHUTZZWECK ist unverändert und wird NICHT aufgeweicht — er wird genauer: mehr Importformen
// werden erfasst, und Erwähnungen in Kommentar oder Zeichenkette lösen ihn nicht mehr aus. Weil das
// so ist, prüft der Wächter seit mega86 auch SICH SELBST mit (die Selbstausnahme ist weg) — obwohl
// diese Datei den Pfad mehrfach nennt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

function dateien(verzeichnis: string, endung: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis))) {
    if (eintrag === "node_modules" || eintrag.startsWith(".")) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag);
    if (statSync(join(WURZEL, relativ)).isDirectory()) {
      gefunden.push(...dateien(relativ, endung));
    } else if (relativ.endsWith(endung)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

// AUFTRAG-mega86 Block D: die Modulpfade, die eine Datei WIRKLICH lädt — erhoben aus dem
// TypeScript-Baum. Erfasst sind alle Formen, die den Typprüfer das Modul öffnen lassen: statischer
// Import (auch reiner Typ-Import und Seiteneffekt-Import), Re-Export, `import … = require(…)`,
// dynamisches `import()` und `require()`. Kommentare und Zeichenketten sind im Baum keine
// Modulpfade und kommen damit baulich nicht vor — nicht weil sie herausgefiltert würden.
function importierteModule(quelle: string, dateiname: string): string[] {
  const baum = ts.createSourceFile(
    dateiname,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const module: string[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) {
      const spez = knoten.moduleSpecifier;
      if (spez && ts.isStringLiteral(spez)) {
        module.push(spez.text);
      }
    } else if (
      ts.isImportEqualsDeclaration(knoten) &&
      ts.isExternalModuleReference(knoten.moduleReference) &&
      ts.isStringLiteral(knoten.moduleReference.expression)
    ) {
      module.push(knoten.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(knoten) &&
      (knoten.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(knoten.expression) && knoten.expression.text === "require"))
    ) {
      const erstes = knoten.arguments[0];
      if (erstes && ts.isStringLiteral(erstes)) {
        module.push(erstes.text);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  return module;
}

// Der Anwendungsrahmen selbst — und NUR er. Das Präfix reicht nicht: ein Nachbarmodul wie
// `apps/web/src/AppShell` ist ein anderes Modul und darf den Wächter nicht auslösen.
const RAHMEN_MODUL = /(^|\/)apps\/web\/src\/App(\.[jt]sx?)?$/;

function importiertRahmen(quelle: string, dateiname: string): boolean {
  return importierteModule(quelle, dateiname).some((pfad) => RAHMEN_MODUL.test(pfad));
}

describe("mega61 A · die gemounteten Torwächter-Tests liegen im Web-Typprüfpfad", () => {
  it("sie sind da, wo der Typprüfer der Anwendung sie sieht", () => {
    const erwartet = [
      join("apps", "web", "src", "legal", "mega61-rechtsseiten.test.tsx"),
      join("apps", "web", "src", "legal", "mega61-hinweisbanner.test.tsx"),
    ];
    const vorhanden = dateien(join("apps", "web", "src"), ".test.tsx");
    for (const datei of erwartet) {
      expect(vorhanden, `${datei} fehlt — wurde er zurückverschoben?`).toContain(datei);
    }
  });

  it("KEIN Test unter tests/** zieht die ganze Anwendung in den Wurzel-Typprüfer", () => {
    // Die Regel über die Bauform, nicht über die heutigen Dateien: Wer künftig `App` (oder den
    // Router, der alle Seiten einsammelt) aus einem `tests/**`-Test importiert, wird hier rot —
    // und zwar mit dem Grund, statt später mit acht rätselhaften Typfehlern.
    //
    // GEMESSEN, nicht geraten: `apps/web/src/routes` allein ist heute unbedenklich — ein Test
    // importiert es (tests/app/stage2-gate-mounted.test.tsx) und das Programm bleibt grün.
    // `apps/web/src/App` ist es nicht: es zieht zusätzlich den Anwendungsrahmen mit
    // `import.meta.env`, der Fehlergrenze und den Anmeldeschirmen herein, und genau dort brechen
    // die Wurzel-Einstellungen. Die Regel bleibt deshalb auf das eingeschränkt, was WIRKLICH
    // bricht; würde sie mehr behaupten, wäre sie eine Vermutung mit Testfarbe.
    //
    // AUFTRAG-mega86 Block D: KEINE Selbstausnahme mehr. Diese Datei nennt den Rahmenpfad in
    // Kommentar und Zeichenkette mehrfach — und wird davon nicht mehr rot, weil jetzt der
    // Importgraf zählt und nicht der Dateitext.
    const verstoesse: string[] = [];
    for (const datei of dateien("tests", ".tsx")) {
      const inhalt = readFileSync(join(WURZEL, datei), "utf8");
      if (importiertRahmen(inhalt, datei)) {
        verstoesse.push(
          `${datei} importiert apps/web/src/App — solche Tests gehören nach apps/web/src/**`,
        );
      }
    }
    expect(verstoesse).toEqual([]);
  });
});

// ── AUFTRAG-mega86 Block D: der Erkenner selbst wird gefahren ────────────────────────────────────
//
// Ein Wächter, dessen Erkennung niemand prüft, ist eine Behauptung mit Testfarbe. Die Sonden unten
// fahren beide Richtungen: was ein echter Import IST, und was nur wie einer AUSSIEHT.

describe("mega86 D · der Rahmen-Erkenner liest Importe, nicht Zeichenfolgen", () => {
  const ECHTE_IMPORTE = [
    { form: "gewöhnlicher Import", quelle: 'import App from "../../apps/web/src/App";' },
    { form: "benannter Import", quelle: 'import { App } from "../../apps/web/src/App";' },
    // `import type` wird zwar wegradiert, der Typprüfer LÄDT das Modul aber trotzdem — genau der
    // Fall, den die alte Textsuche zufällig traf und eine naive Import-Regex verfehlt hätte.
    { form: "reiner Typ-Import", quelle: 'import type { X } from "../../apps/web/src/App";' },
    { form: "Seiteneffekt-Import", quelle: 'import "../../apps/web/src/App";' },
    { form: "Re-Export", quelle: 'export { App } from "../../apps/web/src/App";' },
    { form: "dynamischer Import", quelle: 'const m = await import("../../apps/web/src/App");' },
    { form: "require", quelle: 'const m = require("../../apps/web/src/App.tsx");' },
    { form: "mit Endung", quelle: 'import App from "../../apps/web/src/App.tsx";' },
  ];

  for (const fall of ECHTE_IMPORTE) {
    it(`${fall.form}: wird als Rahmen-Import erkannt`, () => {
      expect(importiertRahmen(fall.quelle, "sonde.tsx")).toBe(true);
    });
  }

  const KEINE_IMPORTE = [
    { form: "Zeilenkommentar", quelle: "// dieser Test importiert apps/web/src/App NICHT\n" },
    { form: "Blockkommentar", quelle: "/* siehe apps/web/src/App für den Rahmen */\n" },
    {
      form: "Zeichenkette",
      quelle: 'const RAHMEN = "apps/web/src/App.tsx";\nexpect(x).not.toContain(RAHMEN);',
    },
    {
      form: "Nachbarmodul mit gleichem Präfix",
      quelle: 'import { AppShell } from "../../apps/web/src/AppShell";',
    },
    { form: "unbeteiligter Import", quelle: 'import { routes } from "../../apps/web/src/routes";' },
  ];

  for (const fall of KEINE_IMPORTE) {
    it(`${fall.form}: macht den Wächter NICHT rot`, () => {
      expect(
        importiertRahmen(fall.quelle, "sonde.tsx"),
        "Der Wächter misst wieder Namensanwesenheit statt Importe — genau die Klasse, die in " +
          "diesem Zyklus mehrfach nicht getragen hat.",
      ).toBe(false);
    });
  }

  it("diese Datei nennt den Rahmenpfad — und importiert ihn nicht", () => {
    // Der Selbstbeleg: ohne ihn wäre nicht gezeigt, dass die Selbstausnahme wirklich entbehrlich ist.
    const selbst = readFileSync(__filename, "utf8");
    expect(selbst).toContain("apps/web/src/App");
    expect(importiertRahmen(selbst, "mega61-rechtsseiten.test.tsx")).toBe(false);
  });
});
