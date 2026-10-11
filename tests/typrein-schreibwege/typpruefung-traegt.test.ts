// ================================================================================================
// R-1152 / R-1406 — DIE TYPPRÜFUNG TRÄGT EINE ECHTE AUSSAGE, UND SCHREIBENDE WEGE BLEIBEN TYPREIN.
// ================================================================================================
//
// `tools/build` fährt `tsc --noEmit` über `services` und `tests` (tsconfig.json), über die
// gemounteten Komponententests (tsconfig.tests-tsx.json) und über `apps/web` (eigene tsconfig).
// Ein grüner Lauf sagt aber nur dann etwas, wenn der Typprüfer nicht abgeschaltet wird. Genau das
// misst diese Datei am Produktcode (ohne Testdateien), mit dem TypeScript-Parser statt Textsuche:
//
//   T1 — Beide Konfigurationen laufen `strict`, und Biome weist `noExplicitAny` als Fehler ab.
//   T2 — Im Produktcode steht KEIN `any` als Typ — weder in `services` noch in `apps/web/src`.
//   T3 — Kein `@ts-ignore`, `@ts-expect-error` oder `@ts-nocheck` im Produktcode.
//   T4 — Doppelte Umwandlungen `x as unknown as T` umgehen den Typprüfer. In `services` (dort liegen
//        alle schreibenden Datenbankwege) sind sie ein GESCHLOSSENES Register: je Datei die Zahl,
//        die der Abgleich zu R-1152 vorgefunden hat. Eine neue Umwandlung macht diesen Fall rot und
//        muss eingetragen und begründet — oder besser vermieden — werden.
//
// DER ABGLEICH ZU R-1152, wie er sich am Stand darstellt (Fassung des Kandidaten nach f357bb76):
// die historischen Lieferungen JOB 515 und JOB 2245 („Typtor") haben im Repository keine Spur
// hinterlassen — kein Verweis, keine eigene Datei. Ihre Wirkung ist trotzdem prüfbar und wird hier
// geprüft: T1–T3 sind heute erfüllt. Die schreibenden Pg-Adapter (`*/repo-pg.ts`) tragen keine
// einzige Doppelumwandlung; die eine Stelle im Transaktionskern (`db-tx/src/tx.ts`) betrifft nur die
// Methodensignatur von `pg` und ist dort begründet. Die einzige Stelle, an der ein schreibender Weg
// Daten ohne Typprüfung weiterreicht, ist das Wiedereinspielen des Desktop-Journals
// (`services/app/src/dev-persist.ts`, `wendeAn`): Zeilen aus einer Datei werden gegen das Register
// der schreibenden Methoden geprüft und dann als `unknown[]` übergeben. Das ist eine
// Laufzeitgrenze (Datei → Speicher), keine übersehene Typlücke; sie steht unten benannt im Register.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function quelldateien(verzeichnis: string): string[] {
  const raus: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name === "dist") {
      continue;
    }
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      raus.push(...quelldateien(pfad));
    } else if (
      /\.tsx?$/.test(eintrag.name) &&
      !eintrag.name.includes(".test.") &&
      !eintrag.name.endsWith(".d.ts")
    ) {
      raus.push(pfad.split("\\").join("/"));
    }
  }
  return raus.sort();
}

interface Befund {
  readonly anyTypen: number;
  readonly doppelUmwandlungen: number;
}

function befundVon(pfad: string): Befund {
  const text = readFileSync(pfad, "utf8");
  const art = pfad.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true, art);
  let anyTypen = 0;
  let doppelUmwandlungen = 0;
  const gehe = (n: ts.Node): void => {
    if (n.kind === ts.SyntaxKind.AnyKeyword) {
      anyTypen += 1;
    }
    if (
      ts.isAsExpression(n) &&
      ts.isAsExpression(n.expression) &&
      n.expression.type.kind === ts.SyntaxKind.UnknownKeyword
    ) {
      doppelUmwandlungen += 1;
    }
    ts.forEachChild(n, gehe);
  };
  gehe(sf);
  return { anyTypen, doppelUmwandlungen };
}

const PRODUKTCODE = [...quelldateien("services"), ...quelldateien("apps/web/src")];
const DIENSTE = PRODUKTCODE.filter((p) => p.startsWith("services/"));

/**
 * Das Register der Doppelumwandlungen in `services`, je Datei die vorgefundene Zahl. Nur der
 * Eintrag `dev-persist.ts` liegt auf einem schreibenden Weg (s. Kopf); die übrigen betreffen
 * Fremdschnittstellen (fetch, Fastify, DNS-Auflösung) oder Lesefassungen und sind beim Abgleich
 * vorgefunden, nicht einzeln neu begründet.
 */
const DOPPELUMWANDLUNGEN: Readonly<Record<string, number>> = {
  "services/app/src/ai-check-worker.ts": 1,
  "services/app/src/dev-persist.ts": 2,
  // Lesezugriff, kein Schreibweg: `lesevarianten.ts:259` schlägt eine Sprache in einem
  // Lokalisierungssatz nach und prüft den Fund danach (`istLokalisierungsText`). Beim ersten Abgleich
  // per Textsuche übersehen, weil die Datei ein Nullbyte trägt und als binär übersprungen wurde —
  // der Parser hier zählt sie, genau dafür steht T4 auf dem Syntaxbaum.
  "services/app/src/lesevarianten.ts": 1,
  "services/app/src/routes/addin-static-routes.ts": 1,
  "services/app/src/routes/confluence-import-routes.ts": 1,
  "services/app/src/routes/ko-routes.ts": 1,
  "services/auth/src/oidc.ts": 1,
  "services/db-tx/src/tx.ts": 1,
  "services/external-search/src/wikipedia.ts": 2,
  "services/knowledge-object/src/schutzdaten.ts": 2,
  "services/knowledge-object/src/service.ts": 1,
  "services/sharepoint/src/graph-client.ts": 1,
};

describe("R-1152 / R-1406 · die Typprüfung trägt eine echte Aussage", () => {
  it("T0 · der Sammler liest wirklich Produktcode — sonst prüfte alles darunter nichts", () => {
    expect(DIENSTE.length).toBeGreaterThan(100);
    expect(PRODUKTCODE.length - DIENSTE.length).toBeGreaterThan(100);
    expect(DIENSTE).toContain("services/db-tx/src/tx.ts");
    expect(DIENSTE.some((p) => p.endsWith(".test.ts"))).toBe(false);
  });

  it("T1 · strict in beiden Konfigurationen, noExplicitAny als Fehler", () => {
    expect(readFileSync("tsconfig.json", "utf8")).toMatch(/"strict"\s*:\s*true/);
    expect(readFileSync("apps/web/tsconfig.json", "utf8")).toMatch(/"strict"\s*:\s*true/);
    expect(readFileSync("biome.json", "utf8")).toMatch(/"noExplicitAny"\s*:\s*"error"/);
  });

  it("T2 · kein `any` als Typ im Produktcode", () => {
    const funde = PRODUKTCODE.filter((p) => befundVon(p).anyTypen > 0);
    expect(funde).toEqual([]);
  });

  it("T3 · keine Abschaltung des Typprüfers im Produktcode", () => {
    const funde = PRODUKTCODE.filter((p) =>
      /@ts-(ignore|expect-error|nocheck)\b/.test(readFileSync(p, "utf8")),
    );
    expect(funde).toEqual([]);
  });

  it("T4 · Doppelumwandlungen in services: genau das Register, keine neue", () => {
    const gezaehlt: Record<string, number> = {};
    for (const pfad of DIENSTE) {
      const zahl = befundVon(pfad).doppelUmwandlungen;
      if (zahl > 0) {
        gezaehlt[pfad] = zahl;
      }
    }
    expect(gezaehlt).toEqual(DOPPELUMWANDLUNGEN);
  });

  it("T5 · KALIBRIERUNG: der Parser sieht `any` und die Doppelumwandlung wirklich", () => {
    const quelle = "const a: any = 1; const b = a as unknown as string; export { b };";
    const sf = ts.createSourceFile("probe.ts", quelle, ts.ScriptTarget.Latest, true);
    let anyTypen = 0;
    let doppel = 0;
    const gehe = (n: ts.Node): void => {
      if (n.kind === ts.SyntaxKind.AnyKeyword) {
        anyTypen += 1;
      }
      if (ts.isAsExpression(n) && ts.isAsExpression(n.expression)) {
        doppel += 1;
      }
      ts.forEachChild(n, gehe);
    };
    gehe(sf);
    expect(anyTypen).toBe(1);
    expect(doppel).toBe(1);
  });
});
