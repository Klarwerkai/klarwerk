// AUFTRAG-mega13 Block A, Kante 1 und Kante 8 (letzter Halbsatz): zwei ARCHITEKTUR-Zusicherungen,
// die kein Ablauftest liefern kann.
//
// Kante 1 verlangt, dass JEDER von der App erzeugte History-Eintrag einen belastbaren Index trägt.
// Das ist keine Eigenschaft, die man erzeugt, sondern eine, die man nicht KAPUTT macht: der Router
// stempelt `history.state.idx` bei jedem push/replace selbst (`@remix-run/router/dist/router.js:367`
// bzw. `:397`). Ein direkter `history.pushState`/`replaceState` im App-Code erzeugt dagegen einen
// Eintrag OHNE Index — und React Router warnt ausdrücklich, dass ein POP auf so einen Eintrag danach
// STILL scheitert (`router.js:1579`). Deshalb wird hier gesperrt, dass App-Code die History anfasst.
//
// Der Wächter selbst ist die EINE begründete Ausnahme, und auch nur für `go` — er bewegt den Zeiger,
// er erzeugt keine Einträge. Genau daran hängt Kante 4 („kein zusätzlicher Verlaufseintrag").
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_SRC = join(__dirname, "../../apps/web/src");

function allSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...allSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Eine ERWÄHNUNG im Kommentar (dieses Modul ist voll davon) darf nicht als Treffer zählen.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const rel = (f: string): string => relative(WEB_SRC, f).replace(/\\/g, "/");
const files = allSourceFiles(WEB_SRC);

describe("Kante 1: der History-Index ist belastbar, weil ihn nur der Router stempelt", () => {
  it("der Scan sieht überhaupt etwas (sonst wäre er ein stiller Selbstbetrug)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.map(rel)).toContain("app/navHistory.ts");
  });

  it("KEIN App-Modul erzeugt History-Einträge von Hand (pushState/replaceState)", () => {
    const offenders = files
      .filter((f) =>
        /\bhistory\.(pushState|replaceState)\s*\(/.test(stripComments(readFileSync(f, "utf8"))),
      )
      .map(rel);
    // Ein ungestempelter Eintrag macht das Delta jedes späteren POP unbestimmbar — genau die Klasse,
    // vor der router.js:1579 warnt. Darum ohne Ausnahmeliste.
    expect(offenders).toEqual([]);
  });

  it("nur der Wächter bewegt den History-Zeiger — und nur mit go()", () => {
    const movers = files
      .filter((f) =>
        /\bhistory\.(back|forward|go)\s*\(/.test(stripComments(readFileSync(f, "utf8"))),
      )
      .map(rel)
      .sort();
    // Die EINE Autorität. `back()`/`forward()` sind bewusst nicht dabei: sie sind das pauschale
    // Ein-Schritt-Denken, das Kante 2 verbietet.
    expect(movers).toEqual(["app/NavGuardContext.tsx"]);

    const guardSrc = stripComments(readFileSync(join(WEB_SRC, "app/NavGuardContext.tsx"), "utf8"));
    expect(guardSrc).toMatch(/window\.history\.go\(delta\)/);
    expect(guardSrc).not.toMatch(/history\.(back|forward)\s*\(/);
  });

  it("der Wächter liest den Index, statt einen eigenen zu führen", () => {
    // Zwei Buchhaltungen desselben Index laufen irgendwann auseinander. Wir lesen den, den der
    // Router stempelt (`router.js:348`).
    const src = stripComments(readFileSync(join(WEB_SRC, "app/navHistory.ts"), "utf8"));
    expect(src).toMatch(/history\.state as \{ idx\?: unknown \}/);
  });
});

describe("Kante 8: Dokumentwechsel außerhalb der SPA bleiben durch beforeunload geschützt", () => {
  // Der In-App-Wächter kann einen Dokumentwechsel (Neuladen, Tab schließen, fremde URL) nicht
  // abfangen — dort lässt der Browser nur SEINEN eigenen Dialog zu. `useUnloadGuard` ist diese
  // Vorrichtung; hier wird festgeschrieben, WELCHE Dirty-Flow-Seite sie hat.
  const dirtyFlowPages = files.filter((f) =>
    stripComments(readFileSync(f, "utf8")).includes("setGuard("),
  );

  it("die Dirty-Flow-Seiten sind bekannt", () => {
    // JOB 3062 · H3: `pages/CaptureFrontDoor.tsx` meldet sich nicht mehr selbst an — die Seite ist
    // nur noch die Adresse und rendert das gemeinsame Blatt. Der Wächter ist MIT dem Editor
    // umgezogen und sitzt jetzt in `components/erfassen/Blatt.tsx`; dieselbe Fläche, derselbe
    // Schutz, ein Anmelder weniger. Die Zusage darunter (jede Dirty-Seite braucht
    // `useUnloadGuard`) gilt für den neuen Eintrag unverändert.
    expect(dirtyFlowPages.map(rel).sort()).toEqual([
      "components/erfassen/Blatt.tsx",
      "pages/Capture.tsx",
      "pages/Mobile.tsx",
    ]);
  });

  // AUFTRAG-mega14 Block B (bens SB-2): der Test ist UMGEDREHT. Bis mega13 schrieb er die Lücke als
  // erwarteten Zustand fest — die Mobil-Erfassung stand auf der Nicht-anfassen-Liste, also durfte
  // sie nur gemeldet, nicht geschlossen werden. Pedi hat sie freigegeben; jetzt sichert der Test
  // den SCHUTZ. Es gibt keine Ausnahmeliste mehr: JEDE Seite, die sich am Dirty-Wächter anmeldet,
  // MUSS auch den Dokumentwechsel abdecken. Eine neue Dirty-Seite ohne `useUnloadGuard` wird hier
  // rot, statt still einen Verlustpfad zu eröffnen.
  it("JEDE Dirty-Flow-Seite hat den beforeunload-Schutz — ohne Ausnahme", () => {
    const without = dirtyFlowPages
      .filter((f) => !stripComments(readFileSync(f, "utf8")).includes("useUnloadGuard("))
      .map(rel)
      .sort();
    expect(without).toEqual([]);
  });

  it("die drei Seiten benutzen DIESELBE Vorrichtung, keine eigene beforeunload-Verdrahtung", () => {
    // Eine zweite Autorität wäre der Anfang des Auseinanderlaufens. Der Handler hängt genau einmal
    // in `NavGuardContext.tsx` (useUnloadGuard); die Seiten reichen nur ihr Dirty-Prädikat herein.
    for (const file of dirtyFlowPages) {
      const src = stripComments(readFileSync(file, "utf8"));
      expect(src).toContain("useUnloadGuard(");
      expect(src, `${rel(file)} verdrahtet beforeunload selbst`).not.toContain(
        'addEventListener("beforeunload"',
      );
    }
  });

  it("die Vorrichtung selbst hängt am Fenster und hebt sich wieder ab", () => {
    const src = stripComments(readFileSync(join(WEB_SRC, "app/NavGuardContext.tsx"), "utf8"));
    expect(src).toMatch(/addEventListener\("beforeunload"/);
    expect(src).toMatch(/removeEventListener\("beforeunload"/);
  });
});
