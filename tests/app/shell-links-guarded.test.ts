// ================================================================================================
// AUFTRAG-mega39 BLOCK B (zweiter Teil) — AUS EINEM PIN AUF EINE DATEI WIRD EIN SAMMLER.
// ================================================================================================
//
// Der vorhandene Shell-Pin (tests/app/logo-home-route.test.ts) kennt GENAU EINE Datei: Logo.tsx. Er
// hat die drei neuen Chips aus mega38 BLOCK H deshalb nicht bemerkt — nicht weil er falsch war,
// sondern weil er nur die HEUTIGEN Ausgänge kannte. Genau diese Bauform hat uns diese Woche dreimal
// getroffen: ein Wächter, der jede neue Umgehung erst nach dem Schaden sieht.
//
// Dieser Test bestimmt seinen Geltungsbereich SELBST: geprüft wird jede Quelldatei unter
// `apps/web/src/shell` — das ist die Leiste, die auf JEDER Seite steht und damit auch über jeder
// Seite mit ungespeicherter Eingabe. Eine neue Shell-Komponente ist automatisch erfasst und muss
// sich nicht an eine ungeschriebene Regel erinnern.
//
// GEPRÜFT WIRD an der IMPORTZEILE: aus `react-router-dom` darf die Shell nur LESENDE Hilfen holen
// (`useLocation` & Co.). Jedes navigierende Mittel (`Link`, `NavLink`, `useNavigate`, `Navigate`)
// gehört über `app/NavGuardContext`. Dazu ein Scan auf rohes `<Link>`/`<NavLink>` im JSX. Der
// Sammler wurde vorgeführt: eine neu angelegte Shell-Datei mit rohem `Link` + `useNavigate` macht
// ihn rot, ohne dass hier eine Zeile über sie steht (Bericht mega39, Block B).
//
// NICHT geprüft wird, ob ein `GuardedLink` am Ende WIRKLICH schützt — das belegen die gemounteten
// Tests (mega39-topbar-chips-guarded-mounted.test.tsx, frontdoor-navguard-exits-mounted.test.tsx).
// Ebenfalls nicht: Navigation aus KIND-Komponenten ausserhalb von `shell/`, die in der Leiste
// gerendert werden, und dynamisch gebaute Zugriffe.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SHELL = join(__dirname, "../../apps/web/src/shell");

function shellSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...shellSources(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Kommentare raus, damit eine ERWÄHNUNG („ein roher <Link> tut das nicht") nicht als Treffer zählt.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const shellFiles = shellSources(SHELL);
const rel = (f: string): string => relative(SHELL, f).replace(/\\/g, "/");

// Rohes <Link>/<NavLink> — GuardedLink/GuardedNavLink treffen bewusst NICHT (Wortgrenze im Muster).
function rawLinks(src: string): number {
  return (src.match(/<(?:Link|NavLink)[\s>]/g) ?? []).length;
}

// Was eine Shell-Datei aus `react-router-dom` holt. Der Schnitt an der IMPORTZEILE ist bewusst: er
// ist die einzige Stelle, an der ein neues, ungeschütztes Navigationsmittel überhaupt hereinkommt —
// und er trägt keine Zähl-Budgets, die bei jeder Umbenennung nachgepflegt werden müssten. Ein Scan
// auf `navigate(` könnte das nicht: in Topbar und Palette heisst die lokale Bindung `navigate`,
// stammt aber aus `useGuardedNavigate()` und ist damit gerade der richtige Weg.
function routerImports(src: string): string[] {
  const namen: string[] = [];
  for (const treffer of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']react-router-dom["']/g)) {
    for (const roh of (treffer[1] ?? "").split(",")) {
      const name = roh
        .replace(/\btype\b/, "")
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim();
      if (name) {
        namen.push(name);
      }
    }
  }
  return namen;
}

// Erlaubt sind ausschliesslich LESENDE Router-Hilfen — sie navigieren nicht und können deshalb
// nichts verlieren. Alles, was navigiert (`Link`, `NavLink`, `useNavigate`, `Navigate`, `redirect`),
// gehört über app/NavGuardContext.
const LESEND_ERLAUBT = new Set([
  "useLocation",
  "useParams",
  "useSearchParams",
  "useInRouterContext",
  "useMatch",
  "useResolvedPath",
  "matchPath",
]);

describe("mega39 B · die Shell hat keine Navigationsquelle, die am Wächter vorbeiführt", () => {
  it("der Geltungsbereich bestimmt sich selbst und ist nicht leer", () => {
    const namen = shellFiles.map(rel).sort();
    // Fände der Scan nichts, wäre die ganze Prüfung ein stiller Selbstbetrug.
    expect(namen.length).toBeGreaterThan(0);
    // JOB 3060 · H1: Topbar.tsx und Sidebar.tsx sind mit der alten Hülle gegangen; die Leiste heißt
    // jetzt Kopfband, ihre Menüs Zahnrad und Konto — alle drei stehen auf JEDER Seite.
    expect(namen).toContain("Kopfband.tsx");
    expect(namen).toContain("ZahnradMenue.tsx");
    expect(namen).toContain("KontoMenue.tsx");
    expect(namen).toContain("Logo.tsx");
    expect(namen).not.toContain("Topbar.tsx");
    expect(namen).not.toContain("Sidebar.tsx");
  });

  it("keine Shell-Datei importiert ein NAVIGIERENDES Router-Mittel — auch keine neue", () => {
    const verstoesse: string[] = [];
    for (const file of shellFiles) {
      const src = stripComments(readFileSync(file, "utf8"));
      for (const name of routerImports(src)) {
        if (!LESEND_ERLAUBT.has(name)) {
          verstoesse.push(`${rel(file)}: ${name}`);
        }
      }
    }
    // Die Fehlermeldung nennt Datei UND Bezeichner — der nächste Umbau weiss sofort, was zu tun ist:
    // GuardedLink/GuardedNavLink/useGuardedNavigate aus app/NavGuardContext.
    expect(verstoesse).toEqual([]);
  });

  it("keine Shell-Datei rendert ein rohes <Link>/<NavLink>", () => {
    const verstoesse = shellFiles
      .map((f) => ({ name: rel(f), n: rawLinks(stripComments(readFileSync(f, "utf8"))) }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.name}: ${x.n}`);
    expect(verstoesse).toEqual([]);
  });

  it("keine Shell-Datei verlässt die Seite AM ROUTER VORBEI", () => {
    const BYPASS: { name: string; re: RegExp }[] = [
      {
        name: "window.location-Zuweisung oder -Sprung",
        re: /window\.location\s*=|window\.location\.(href|assign|replace)\s*[=(]|(?<!window\.)\blocation\.(href\s*=|assign\(|replace\()/,
      },
      {
        name: "History-API von Hand",
        re: /\bhistory\.(pushState|replaceState|back|forward|go)\s*\(/,
      },
      { name: "<a href> auf eine interne Route", re: /<a\s[^>]*href=\{?["'`]\//g },
    ];
    for (const { name, re } of BYPASS) {
      const offenders = shellFiles
        .filter((f) => re.test(stripComments(readFileSync(f, "utf8"))))
        .map(rel);
      expect(offenders, name).toEqual([]);
    }
  });
});
