// ================================================================================================
// JOB 1155 · D1 — DER TESTPFAD-HELFER HÄNGT AM REPOSITORY, NICHT AM AUFRUFVERZEICHNIS.
// ================================================================================================
//
// WAS HIER GEPRÜFT WIRD UND WARUM ES NICHT TRIVIAL IST.
//
// Über hundert Bestandsstellen lesen ihre Produktdatei über `resolve(process.cwd(), …)`. Das ist
// keine Eigenschaft des Repositories, sondern eine Eigenschaft des AUFRUFS: derselbe Test ist grün
// oder rot, je nachdem, aus welchem Verzeichnis Vitest gestartet wurde. `tests/support/repoPfad.ts`
// löst das, indem es die Wurzel aus der Lage der Helferdatei selbst ableitet.
//
// Der naheliegende Test dazu wäre wertlos: Ruft man einen einmal geladenen Helfer zweimal auf, ist
// eine eingefrorene Konstante natürlich konstant — das beweist nichts über die BINDUNG. Dieser Test
// schließt beide Lücken:
//
//   1. Der Helfer wird unter JEDEM Arbeitsverzeichnis FRISCH ausgewertet (`vi.resetModules()` plus
//      eindeutiger Query-Suffix am Spezifizierer, damit keine Cachestufe die zweite Auswertung
//      unterschlägt). Damit läuft die Wurzelberechnung wirklich erneut — unter dem neuen `cwd`.
//   2. Unter EXAKT DEMSELBEN Verzeichniswechsel wird der naive Weg mitgemessen. Läuft er
//      auseinander, war der Wechsel real und wirksam; bleibt der Helfer dabei gleich, ist das eine
//      Aussage über die Bindung und nicht über zwei zufällig gleiche Dinge (`G-1`).
//
// BEWUSST OHNE `new URL(relativ, import.meta.url)` — gemessen, nicht vermutet, und im Bestand unter
// `tests/library/support/wissensraum-ort-vertrag.ts:35-44` dokumentiert: In der jsdom-Umgebung ist
// `URL` global die jsdom-Fassung und löst eine relative Basis gegen den DOKUMENT-Ursprung auf statt
// gegen die `file:`-URL. `fileURLToPath` geht durch Nodes eigenen Parser, `resolve` kennt keine
// URL-Semantik — beide rechnen in jeder Umgebung gleich.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

// Die Wurzel wird hier UNABHÄNGIG vom Helfer bestimmt — aus der Lage DIESER Datei
// (`tests/app/` → zwei Ebenen). Hätte der Helfer eine Ebene zu viel oder zu wenig, fiele das auf.
const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, "../..");

const HELFER_REL = "tests/support/repoPfad.ts";
const HELFER_ABS = resolve(WURZEL, HELFER_REL);
const HELFER_SPEZIFIZIERER = "../support/repoPfad";

// Drei Arbeitsverzeichnisse: die Wurzel, ein Unterverzeichnis des Repositories und ein Ort ganz
// ausserhalb. `realpathSync`, weil `/tmp` unter macOS ein Verweis auf `/private/tmp` ist und
// `process.cwd()` immer den aufgelösten Pfad meldet.
const CWD_WURZEL = realpathSync(WURZEL);
const CWD_UNTERVERZEICHNIS = realpathSync(resolve(WURZEL, "tests/support"));
const CWD_AUSSERHALB = realpathSync(tmpdir());

const START_CWD = process.cwd();
afterEach(() => {
  // Wiederherstellen ist Pflicht: ein hängengebliebener Wechsel würde JEDE nachfolgende Datei
  // dieses Workers vergiften — und zwar genau über den Fehler, den dieser Test bekämpft.
  process.chdir(START_CWD);
});

interface Helfer {
  REPO_WURZEL: string;
  repoPfad: (relativ: string) => string;
}

/**
 * Führt `fn` unter einem anderen Arbeitsverzeichnis aus und stellt das alte zwingend wieder her.
 *
 * Der Wechsel wird NACHGEMESSEN statt angenommen: liefe `process.chdir` ins Leere, wären alle
 * Vergleiche unten trivial grün — der Test hätte dann bewiesen, dass zwei gleiche Dinge gleich
 * sind. Fail-closed.
 */
async function unterVerzeichnis<T>(verzeichnis: string, fn: () => Promise<T> | T): Promise<T> {
  expect(
    typeof process.chdir,
    "process.chdir muss verfügbar sein (Vitest-Pool `forks`); in `threads` gäbe es sie nicht und dieser Nachweis wäre wertlos",
  ).toBe("function");
  process.chdir(verzeichnis);
  try {
    expect(process.cwd(), `Der Wechsel nach ${verzeichnis} muss wirklich stattgefunden haben`).toBe(
      verzeichnis,
    );
    return await fn();
  } finally {
    process.chdir(START_CWD);
  }
}

let ladelauf = 0;

/**
 * Lädt den Helfer FRISCH — unter dem gerade gesetzten Arbeitsverzeichnis.
 *
 * Fehlt die Datei, wird der Fall ROT mit einer Meldung, die den Pfad nennt. Ausdrücklich KEIN
 * `describe.skip`, kein `it.todo` und kein `try/catch`, das ein fehlendes Modul in Grün verwandelt:
 * Vor dem Bau ist dieser Test rot, und genau das ist sein Sinn.
 */
async function ladeHelferFrisch(): Promise<Helfer> {
  if (!existsSync(HELFER_ABS)) {
    throw new Error(
      `ROT (erwartet vor dem Bau, JOB 1155 D1): ${HELFER_REL} existiert im Arbeitsbaum nicht. Der Fall wird grün, sobald der Helfer gebaut ist — kein Test darf dafür künstlich grün gemacht werden.`,
    );
  }
  vi.resetModules();
  ladelauf += 1;
  const modul = (await import(
    /* @vite-ignore */ `${HELFER_SPEZIFIZIERER}?frisch=${ladelauf}`
  )) as Partial<Helfer>;

  expect(
    typeof modul.REPO_WURZEL,
    `${HELFER_REL} muss REPO_WURZEL als Zeichenkette exportieren`,
  ).toBe("string");
  expect(
    typeof modul.repoPfad,
    `${HELFER_REL} muss repoPfad(relativ) als Funktion exportieren`,
  ).toBe("function");
  return modul as Helfer;
}

/** Der naive Weg, wörtlich so, wie er heute an über hundert Bestandsstellen steht. */
function naiverPfad(relativ: string): string {
  return resolve(process.cwd(), relativ);
}

// ================================================================================================
// N — DER NACHWEIS: dieselbe Wurzel aus mehreren Arbeitsverzeichnissen.
// ================================================================================================
describe("JOB 1155 N: repoPfad liefert aus jedem Arbeitsverzeichnis dieselbe Wurzel", () => {
  it("N-1 · zwei verschiedene Arbeitsverzeichnisse, zwei frische Auswertungen, eine Wurzel", async () => {
    const ausWurzel = await unterVerzeichnis(CWD_WURZEL, ladeHelferFrisch);
    const ausUnterverzeichnis = await unterVerzeichnis(CWD_UNTERVERZEICHNIS, ladeHelferFrisch);

    expect(
      ausUnterverzeichnis.REPO_WURZEL,
      "Die Wurzel darf sich durch einen Verzeichniswechsel nicht ändern",
    ).toBe(ausWurzel.REPO_WURZEL);
    expect(ausWurzel.REPO_WURZEL, "und sie muss die echte Repowurzel sein").toBe(CWD_WURZEL);
  });

  it("N-2 · auch von ganz ausserhalb des Repositories aufgerufen", async () => {
    const ausserhalb = await unterVerzeichnis(CWD_AUSSERHALB, ladeHelferFrisch);

    expect(ausserhalb.REPO_WURZEL).toBe(CWD_WURZEL);
    // Und der aufgelöste Pfad zeigt wirklich auf die Datei, nicht bloss auf eine gleiche Zeichenkette.
    expect(ausserhalb.repoPfad(HELFER_REL)).toBe(HELFER_ABS);
    expect(existsSync(ausserhalb.repoPfad(HELFER_REL))).toBe(true);
  });

  it("N-3 · die Wurzel ist an echten Ankern des Baums festgemacht, nicht an sich selbst", async () => {
    const helfer = await ladeHelferFrisch();
    for (const anker of ["package.json", "vitest.config.ts", "tests/support/demoZugang.ts"]) {
      expect(
        existsSync(helfer.repoPfad(anker)),
        `${anker} muss von der aufgelösten Wurzel aus erreichbar sein — sonst zeigt sie daneben`,
      ).toBe(true);
    }
  });
});

// ================================================================================================
// G — DIE GEGENPROBE: derselbe Wechsel, der den naiven Weg zerreisst, lässt den Helfer kalt.
// ================================================================================================
describe("JOB 1155 G: der naive Weg läuft unter demselben Wechsel auseinander", () => {
  it("G-1 · resolve(process.cwd(), …) divergiert, repoPfad(…) bleibt gleich", async () => {
    const naivWurzel = await unterVerzeichnis(CWD_WURZEL, () => naiverPfad(HELFER_REL));
    const naivUnter = await unterVerzeichnis(CWD_UNTERVERZEICHNIS, () => naiverPfad(HELFER_REL));
    const naivAussen = await unterVerzeichnis(CWD_AUSSERHALB, () => naiverPfad(HELFER_REL));

    // (a) Der Wechsel war real und wirksam — sonst könnten diese drei nicht auseinanderlaufen.
    expect(naivUnter, "aus dem Unterverzeichnis zeigt der naive Weg woandershin").not.toBe(
      naivWurzel,
    );
    expect(naivAussen, "und von ausserhalb erst recht").not.toBe(naivWurzel);

    // (b) Und der Schaden ist konkret, nicht bloss kosmetisch: die Datei ist dort nicht.
    expect(existsSync(naivWurzel), "aus der Wurzel findet der naive Weg die Datei").toBe(true);
    expect(existsSync(naivUnter), "aus dem Unterverzeichnis findet er sie NICHT").toBe(false);
    expect(existsSync(naivAussen), "von ausserhalb findet er sie NICHT").toBe(false);

    // (c) Unter genau denselben drei Wechseln bleibt der Helfer unbewegt.
    const helferWurzel = await unterVerzeichnis(CWD_WURZEL, ladeHelferFrisch);
    const helferUnter = await unterVerzeichnis(CWD_UNTERVERZEICHNIS, ladeHelferFrisch);
    const helferAussen = await unterVerzeichnis(CWD_AUSSERHALB, ladeHelferFrisch);
    const aufgeloest = [helferWurzel, helferUnter, helferAussen].map((h) => h.repoPfad(HELFER_REL));
    expect(new Set(aufgeloest).size, "drei Verzeichnisse, ein Ergebnis").toBe(1);
    expect(aufgeloest[0]).toBe(HELFER_ABS);
  });
});

// ================================================================================================
// W — DER WÄCHTER: die Bindung steht im AUSGEFÜHRTEN Code, nicht bloss im Kommentar.
// ================================================================================================
//
// Warum AST und nicht Textsuche: Der Helfer MUSS `process.cwd()` in seiner Begründung nennen —
// sonst wäre nicht lesbar, wogegen er gebaut ist. Eine Textsuche würde genau diese Begründung als
// Verstoss werten. Der erste Wächterentwurf von JOB 642 D3 hatte diesen Fehler; das Urteil
// `BEN-PRUEFUNG-JOB-642-D3.md` hält die Korrektur auf eine AST-Prüfung ausdrücklich fest.
function helferQuelle(): string {
  expect(
    existsSync(HELFER_ABS),
    `ROT (erwartet vor dem Bau, JOB 1155 D1): ${HELFER_REL} existiert nicht`,
  ).toBe(true);
  const quelle = readFileSync(HELFER_ABS, "utf8");
  expect(quelle.trim().length, `${HELFER_REL} ist leer`).toBeGreaterThan(0);
  return quelle;
}

function baum(quelle: string): ts.SourceFile {
  return ts.createSourceFile(HELFER_REL, quelle, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
}

function knotenZaehlen(wurzel: ts.Node, trifft: (n: ts.Node) => boolean): number {
  let treffer = 0;
  const gehe = (knoten: ts.Node): void => {
    if (trifft(knoten)) treffer += 1;
    ts.forEachChild(knoten, gehe);
  };
  gehe(wurzel);
  return treffer;
}

/** Ein WIRKLICH AUSGEFÜHRTER Aufruf `process.cwd()` — Kommentare sind im AST keine Knoten. */
function istCwdAufruf(knoten: ts.Node): boolean {
  if (!ts.isCallExpression(knoten)) return false;
  const ziel = knoten.expression;
  return (
    ts.isPropertyAccessExpression(ziel) &&
    ts.isIdentifier(ziel.expression) &&
    ziel.expression.text === "process" &&
    ziel.name.text === "cwd"
  );
}

describe("JOB 1155 W: der Helfer bindet an import.meta.url und liest kein process.cwd()", () => {
  it("W-1 · kein ausgeführter process.cwd()-Aufruf im Helfer", () => {
    const quelle = helferQuelle();
    expect(
      knotenZaehlen(baum(quelle), istCwdAufruf),
      `${HELFER_REL} darf process.cwd() nicht LESEN — genau davon soll die Wurzel unabhängig sein`,
    ).toBe(0);
  });

  it("W-2 · der Wächter ist kalibriert: er unterscheidet Begründung von Code", () => {
    // Ohne diese Kalibrierung wäre W-1 auch für einen Helfer grün, der `process` gar nicht kennt —
    // und man wüsste nicht, ob der Wächter überhaupt etwas sieht. Hier steht der Beweis, dass die
    // Erwähnung im Kommentar vorhanden ist UND vom AST korrekt ignoriert wird.
    const quelle = helferQuelle();
    expect(
      quelle,
      `${HELFER_REL} soll in seiner Begründung ausdrücklich sagen, wogegen er gebaut ist`,
    ).toContain("process.cwd()");
    // Dieselbe Zeichenkette, im Code zu einem Aufruf gemacht, WIRD gesehen:
    expect(knotenZaehlen(baum("const x = process.cwd();"), istCwdAufruf)).toBe(1);
    // …und im Kommentar nicht:
    expect(
      knotenZaehlen(baum("// hier steht process.cwd() nur als Erklärung\n"), istCwdAufruf),
    ).toBe(0);
  });

  it("W-3 · die Wurzel hängt an import.meta.url", () => {
    const quelle = helferQuelle();
    const metaEigenschaften = knotenZaehlen(
      baum(quelle),
      (knoten) =>
        knoten.kind === ts.SyntaxKind.MetaProperty &&
        (knoten as ts.MetaProperty).keywordToken === ts.SyntaxKind.ImportKeyword,
    );
    expect(
      metaEigenschaften,
      `${HELFER_REL} muss die Wurzel an import.meta binden — ein MetaProperty-Knoten ist ausgeführter Code und kein Kommentar`,
    ).toBeGreaterThan(0);
    expect(quelle).toContain("import.meta.url");
  });
});
