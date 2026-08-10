// AUFTRAG-mega89 Block B — DER SAMMLER FÜR DIE PAARUNGSSTELLEN.
//
// WARUM ES IHN BRAUCHT, und das ist die ehrliche Begründung: Block A sorgt dafür, dass im Editor
// gar keine verschachtelte Struktur mehr ENTSTEHT. Genau deshalb kann eine Gegenmutation an einer
// AUFRUFSTELLE — „such die Fußnote wieder über einen beliebigen Nachfahren" — am Verhalten des
// Editors nicht mehr auffallen: die Lage, in der sie schadet, kommt dort nicht mehr vor. Die
// Wirkung der beiden Paarungsfunktionen selbst ist gemessen
// (`tests/capture/mega89-paarung-einheiten.test.ts`, an verschachteltem Markup, beide Zweige
// einzeln). Was hier hinzukommt, ist die Zusage, dass NIEMAND an ihnen vorbei wieder eine eigene
// Paarung baut.
//
// DIE ERHEBUNG IST AUTORITATIV, KEINE GEPFLEGTE LISTE. Über den TypeScript-Baum aller
// Produktquellen wird jede DOM-Abfrage gesucht, deren Selektor `img` oder `figcaption` nennt UND
// deren Empfänger aus einem figure-/Fußnoten-/Bild-Bezug stammt (`closest("figure")`,
// `parentElement`, eine figure-/caption-/img-Variable). Genau das ist die Form einer PAARUNG: von
// einem der beiden Partner zum anderen. Eine Abfrage über die Grundmenge (`root.querySelectorAll(
// "img")`) hat einen anderen Empfänger und wird bewusst nicht eingesammelt — ein Wächter, der bei
// jeder Bewegung schreit, wird abgeschaltet.
//
// DAS URTEIL JE FUND: „eng" ist ein Selektor, der über DIREKTE KINDER geht (`:scope >`) oder über
// die stabile Kennung (`[data-image-id]`). Alles andere ist „weit" — ein beliebiger Nachfahre — und
// braucht eine ausdrückliche Disposition mit Begründung. Heute gibt es keine.
//
// DIE GRENZEN, benannt statt verschwiegen:
//   · Indirektion entgeht der Erhebung (wie in mega86/mega88): wird ein Selektor als Variable
//     gereicht, sieht der Syntaxbaum ihn an der Abfrage nicht. Dafür bräuchte es den Typprüfer.
//   · Die Galerie-Ableitung (`bodyImages.ts`) paart über Regex, nicht über das DOM — sie ist hier
//     unsichtbar und mit Absicht: ihr Verhalten ist am gespeicherten Bestand messbar und in
//     `tests/capture/mega89-galerie-paarung.test.ts` an verschachteltem Markup gemessen.
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();

function quelldateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const relativ = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...quelldateien(relativ));
    } else if (
      (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) &&
      !relativ.includes(".test.")
    ) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

function wurzelverzeichnisse(): string[] {
  const aus = [join("apps", "web", "src")];
  for (const eintrag of readdirSync(join(WURZEL, "services"), { withFileTypes: true })) {
    if (!eintrag.isDirectory()) {
      continue;
    }
    const src = join("services", eintrag.name, "src");
    try {
      readdirSync(join(WURZEL, src));
      aus.push(src);
    } catch {
      // Modul ohne src/ — nichts zu erheben.
    }
  }
  return aus;
}

function huelleVon(knoten: ts.Node): string {
  let p: ts.Node | undefined = knoten.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) {
      return p.name.text;
    }
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      p.parent &&
      ts.isVariableDeclaration(p.parent) &&
      ts.isIdentifier(p.parent.name)
    ) {
      return p.parent.name.text;
    }
    p = p.parent;
  }
  return "<modul>";
}

// Der Selektor nennt einen der beiden Partner.
const NENNT_PARTNER = /(^|[\s,>+~])(img|figcaption)\b/i;
// Der Empfänger stammt aus einem figure-/Fußnoten-/Bild-Bezug — das macht die Abfrage zu einer
// PAARUNG und unterscheidet sie von einer Abfrage über die Grundmenge.
const EMPFAENGER_PAART =
  /closest\(\s*["'`]figure|parentElement|parentNode|\b(figure|figur|caption|fussnote|img|image|bild)\b/i;
// Eng: über direkte Kinder oder über die stabile gemeinsame Kennung.
const ENG = /^:scope\s*>/;

interface Paarungsstelle {
  id: string; // stabile Identität: datei::funktion::selektor
  eng: boolean;
}

function erhebePaarungsstellen(): Paarungsstelle[] {
  const gefunden = new Map<string, boolean>();
  for (const datei of wurzelverzeichnisse().flatMap(quelldateien)) {
    const roh = readFileSync(join(WURZEL, datei), "utf8");
    if (!/figcaption/i.test(roh)) {
      continue;
    }
    const posix = datei.split(sep).join("/");
    const baum = ts.createSourceFile(datei, roh, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const gehe = (k: ts.Node): void => {
      if (ts.isCallExpression(k) && ts.isPropertyAccessExpression(k.expression)) {
        const aufruf = k.expression.name.text;
        const empfaenger = k.expression.expression.getText(baum);
        const arg = k.arguments[0];
        if (
          (aufruf === "querySelector" || aufruf === "querySelectorAll") &&
          arg !== undefined &&
          (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) &&
          NENNT_PARTNER.test(arg.text) &&
          EMPFAENGER_PAART.test(empfaenger)
        ) {
          const id = `${posix}::${huelleVon(k)}::${arg.text}`;
          gefunden.set(id, ENG.test(arg.text) || arg.text.includes("[data-image-id]"));
        }
      }
      ts.forEachChild(k, gehe);
    };
    gehe(baum);
  }
  return Array.from(gefunden, ([id, eng]) => ({ id, eng })).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

// Jede erhobene Stelle braucht genau eine Disposition. „eng" ist der Regelfall und braucht keine;
// wer eine WEITE Paarung einträgt, muss sagen, warum ein beliebiger Nachfahre dort richtig ist.
// Diese Tabelle ist heute LEER, und das ist die Aussage.
const WEIT_ERLAUBT: Readonly<Record<string, string>> = {};

describe("AUFTRAG-mega89 Block B: keine Paarung sucht über einen beliebigen Nachfahren", () => {
  const stellen = erhebePaarungsstellen();

  it("die Erhebung findet überhaupt etwas (sonst prüft dieser Wächter nichts)", () => {
    expect(
      stellen.length,
      "Die Erhebung hat keine einzige Paarungsstelle gefunden — dann ist der Wächter blind, nicht grün",
    ).toBeGreaterThan(2);
  });

  it("jede Paarung geht über DIREKTE KINDER oder über die Kennung", () => {
    const weit = stellen.filter((s) => !s.eng && WEIT_ERLAUBT[s.id] === undefined).map((s) => s.id);
    expect(
      weit,
      "Eine Paarung Bild↔Fußnote sucht über einen beliebigen Nachfahren. An einer verschachtelten Struktur bekommt damit Bild 1 die Beschreibung von Bild 2 — genau der Datenschaden aus sammel88. Erlaubt sind `:scope >` (direkte Kinder) oder `[data-image-id]` (die stabile gemeinsame Kennung).",
    ).toEqual([]);
  });

  it("die beiden zentralen Paarungsfunktionen sind da und werden erhoben", () => {
    const ids = stellen.map((s) => s.id);
    expect(
      ids.filter((id) => id.includes("captionForImage")).length,
      "Die Fußnoten-Suche zum Bild ist verschwunden oder heißt anders — dann zeigt dieser Wächter ins Leere",
    ).toBeGreaterThan(0);
    expect(
      ids.filter((id) => id.includes("imageForCaption")).length,
      "Die Bild-Suche zur Fußnote ist verschwunden oder heißt anders",
    ).toBeGreaterThan(0);
  });

  it("keine Disposition zeigt ins Leere", () => {
    const erhoben = new Set(stellen.map((s) => s.id));
    expect(
      Object.keys(WEIT_ERLAUBT).filter((id) => !erhoben.has(id)),
      "Eine Ausnahme ist eingetragen, aber die Stelle gibt es nicht mehr",
    ).toEqual([]);
  });
});
