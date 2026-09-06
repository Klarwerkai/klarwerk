import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type DateiErhebung,
  WEB_SRC,
  WURZEL,
  erhebeDatei,
  posix,
  quelldateien,
  quelleAus,
} from "../../tools/modalgrenze";
import { BESTAND_UNTERGRENZE, erhebeBestand } from "./t1c-bestand";

const SAMMLER = "tests/app/mega47-modale-flaechen-sammler.test.tsx";
const quelle = ts.createSourceFile(
  SAMMLER,
  readFileSync(join(WURZEL, SAMMLER), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

/** Originale aus Block J/K ausführen: keine Kopie der Werkbank oder der neuen Zusicherung. */
function originalBlock(aufruf: string, titel: string): string {
  const funde: ts.Block[] = [];
  function besuche(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(quelle) === aufruf &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text.startsWith(titel)
    ) {
      const callback = node.arguments[1];
      if (callback && ts.isArrowFunction(callback) && ts.isBlock(callback.body)) {
        funde.push(callback.body);
      }
    }
    ts.forEachChild(node, besuche);
  }
  besuche(quelle);
  expect(funde, `genau ein Original: ${titel}`).toHaveLength(1);
  return funde[0]!.getText(quelle).slice(1, -1);
}

function ausfuehren(code: string, kontext: Record<string, unknown>): unknown {
  const javascript = ts.transpileModule(`(() => { ${code}\n })()`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return runInNewContext(javascript, kontext, { timeout: 10_000 });
}

type Werkbank = {
  lege(pfad: string, inhalt: string): void;
  erhebeBaum(): DateiErhebung[];
  wurzel(): string;
};

let werkbank: Werkbank;
let aufraeumen: () => void;

beforeEach(() => {
  const temporaer = join(WURZEL, ".local", "run");
  mkdirSync(temporaer, { recursive: true });
  werkbank = ausfuehren(
    `${originalBlock("describe", "JOB 1181 · BENs Prüflücken zu D3")}\nreturn { lege, erhebeBaum, wurzel: () => baum };`,
    {
      mkdirSync,
      mkdtempSync,
      readFileSync,
      rmSync,
      writeFileSync,
      join,
      // Gleiche Werkbank; nur der temporäre Ort bleibt innerhalb unseres Arbeitsbaums.
      tmpdir: () => temporaer,
      quelldateien,
      erhebeDatei,
      quelleAus,
      posix,
      beforeEach: (fn: () => void) => fn(),
      afterEach: (fn: () => void) => {
        aufraeumen = fn;
      },
      it: () => {},
    },
  ) as Werkbank;
});

afterEach(() => aufraeumen?.());

function pruefeOriginal(erhebungen = werkbank.erhebeBaum()): void {
  ausfuehren(originalBlock("it", "die Grundgesamtheit ist nicht geschrumpft"), {
    expect,
    ALLE_ERHEBUNGEN: erhebungen,
    KANDIDATEN: Array(6), // Die unveränderte Kandidatenprüfung wird im vollständigen Sammler gemessen.
    WURZEL: werkbank.wurzel(),
    WEB_SRC,
    BESTAND_UNTERGRENZE,
    erhebeBestand,
  });
}

function fuelleBisUntergrenze(): void {
  for (let n = 0; n < BESTAND_UNTERGRENZE; n++) {
    werkbank.lege(`${posix(WEB_SRC)}/datei-${n}.ts`, "");
  }
}

function bestandsHash(wurzel: string): string {
  const hash = createHash("sha256");
  for (const pfad of erhebeBestand(wurzel, WEB_SRC).sort()) {
    hash
      .update(pfad)
      .update("\0")
      .update(readFileSync(join(wurzel, pfad)))
      .update("\0");
  }
  return hash.digest("hex");
}

describe("JOB 3159 · unabhängiger Bestandszähler", () => {
  it("F1 — die unabhängige Erhebung trifft die Auswahlregel", () => {
    for (const pfad of [
      "a.ts",
      "b.tsx",
      "c.test.ts",
      "d.test.tsx",
      "e.md",
      "node_modules/x.ts",
      "dist/y.ts",
      ".hidden/z.ts",
      "unter/tief/f.ts",
      "unter/node_modules/x.ts",
      "unter/dist/y.ts",
      "unter/.hidden/z.ts",
      ".versteckt.ts",
    ]) {
      werkbank.lege(pfad, "");
    }
    expect(erhebeBestand(werkbank.wurzel()).sort()).toEqual(["a.ts", "b.tsx", "unter/tief/f.ts"]);
  });

  it("F2 — Gleichlauf am echten Bestand, gleiche Pfade statt gleicher Anzahl", () => {
    expect(erhebeBestand(WURZEL, WEB_SRC).sort()).toEqual(quelldateien(WEB_SRC).map(posix).sort());
  });

  it("F3 — Obermengen-Nachweis: Austausch bleibt alt grün, wird neu rot mit beiden Pfaden", () => {
    fuelleBisUntergrenze();
    const erhebungen = werkbank.erhebeBaum();
    const fehlend = erhebungen[0]!.quelle.datei;
    const fremd = "apps/web/src/fremd.ts";
    erhebungen[0] = erhebeDatei(quelleAus(fremd, ""));
    // Vergleichsfassung der alten Regel, auf derselben Eingabe wie das Original aus Block K.
    expect(erhebungen.length).toBe(BESTAND_UNTERGRENZE);
    expect(() => pruefeOriginal(erhebungen)).toThrow(`nur im Sammler: ${fremd}`);
    expect(() => pruefeOriginal(erhebungen)).toThrow(`nur im Baum: ${fehlend}`);
  });

  it("F4 — Schrumpfung bleibt trotz Mengengleichheit rot", () => {
    fuelleBisUntergrenze();
    expect(() => pruefeOriginal()).not.toThrow();
    rmSync(join(werkbank.wurzel(), WEB_SRC, "datei-0.ts"));
    expect(() => pruefeOriginal()).toThrow("Bestand unter gemessener Untergrenze");
  });

  it("F5 — Zuwachs am kopierten echten Bestand ist grün und hashgleich rücknehmbar", () => {
    cpSync(join(WURZEL, WEB_SRC), join(werkbank.wurzel(), WEB_SRC), { recursive: true });
    const vorher = bestandsHash(werkbank.wurzel());
    const anzahl = werkbank.erhebeBaum().length;
    expect(() => pruefeOriginal()).not.toThrow();
    const zusatz = `${posix(WEB_SRC)}/lib/job3159-zuwachs.ts`;
    try {
      werkbank.lege(zusatz, "");
      expect(werkbank.erhebeBaum()).toHaveLength(anzahl + 1);
      expect(() => pruefeOriginal()).not.toThrow();
    } finally {
      rmSync(join(werkbank.wurzel(), zusatz));
    }
    expect(bestandsHash(werkbank.wurzel())).toBe(vorher);
    expect(() => pruefeOriginal()).not.toThrow();
  });
});
