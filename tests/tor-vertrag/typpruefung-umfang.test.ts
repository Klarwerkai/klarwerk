// ================================================================================================
// aufnahme:20260922:gesamt-prueftor-einheitlich · R-1405 — DIE TYPPRÜFUNG WEIST IHREN UMFANG AUS.
// ================================================================================================
//
// Bens Befund zu nacharbeit-2: eine statische Zweckzeile im Vertrag sagt nicht, welchen Umfang die
// Typprüfung im jeweiligen Lauf tatsächlich abgedeckt hat. tools/typpruefung-umfang.mjs zählt ihn je
// Lauf aus `tsc --listFilesOnly` und bindet ihn an die Fassung; tools/build ruft es nach den Läufen.
//
//   U1  die erkannten Läufe sind genau die vier, die der Bau heute fährt (gegen die echten Dateien)
//   U2  Sandkasten: Läufe aus `npm run build` samt `cd` und aus tools/build, Zählung je Bereich,
//       Bericht und JSON-Ablage mit Fassung
//   U3  Gegenfall: ein Typprogramm ohne eine einzige Datei macht den Schritt rot
//   U4  Gegenfall: kein erkennbarer Typlauf ist Code 2
//   U5  die Fassung trägt Commit und Baumabweichung
//   U6  tools/build ruft den Schritt NACH der letzten Typprüfung
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const WERKZEUG = join(WURZEL, "tools", "typpruefung-umfang.mjs");

interface Ablage {
  fassung: { commit: string | null };
  laeufe: { projekt: string; dateien: number }[];
}

function fahre(wurzel: string, ...args: string[]) {
  const umgebung: NodeJS.ProcessEnv = { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() };
  delete umgebung.GIT_DIR;
  delete umgebung.GIT_WORK_TREE;
  const lauf = spawnSync(process.execPath, [WERKZEUG, "--wurzel", wurzel, ...args], {
    encoding: "utf8",
    env: umgebung,
  });
  return { code: lauf.status, aus: `${lauf.stdout}${lauf.stderr}` };
}

let sandkasten: string;

beforeEach(() => {
  sandkasten = realpathSync(mkdtempSync(join(tmpdir(), "typumfang-")));
});

afterEach(() => {
  rmSync(sandkasten, { recursive: true, force: true });
});

function datei(pfad: string, inhalt: string): void {
  mkdirSync(join(sandkasten, pfad, ".."), { recursive: true });
  writeFileSync(join(sandkasten, pfad), inhalt);
}

const TSCONFIG = (include: string[]) =>
  JSON.stringify({ compilerOptions: { noEmit: true, skipLibCheck: true, types: [] }, include });

/** Ein kleiner Bestand mit drei Typläufen: zwei aus `npm run build`, einer aus tools/build. */
function bestand(): void {
  datei(
    "package.json",
    JSON.stringify({ scripts: { build: "tsc --noEmit && cd web && npx tsc --noEmit" } }),
  );
  datei("tools/build", "bash tools/fassung-vorab.sh\nnpm run --silent build\n# npx tsc -p x\n");
  datei("tsconfig.json", TSCONFIG(["services", "tests"]));
  datei("services/a.ts", "export const a = 1;\n");
  datei("services/b.ts", "export const b = 2;\n");
  datei("tests/c.ts", "export const c = 3;\n");
  datei("web/tsconfig.json", TSCONFIG(["src"]));
  datei("web/src/x.ts", "export const x = 1;\n");
}

describe("R-1405 · Typprüfung mit tatsächlich abgedecktem Umfang", () => {
  it("U1 · erkannt werden genau die Typläufe, die der Bau heute fährt", () => {
    const { code, aus } = fahre(WURZEL, "--nur-plan");
    expect(code, aus).toBe(0);
    expect(aus.trim().split("\n")).toEqual([
      ". tsconfig.json npm run build",
      ". tsconfig.tests-tsx.json npm run build",
      "apps/web tsconfig.json npm run build",
      ". tsconfig.tests-smoke.json tools/build",
    ]);
  });

  it("U2 · Läufe aus npm run build (mit cd) und tools/build, je Bereich gezählt", () => {
    bestand();
    datei(
      "tools/build",
      "npm run --silent build\nnpx tsc --noEmit -p tsconfig.zwei.json\nnode tools/x.mjs\n",
    );
    const zwei = { compilerOptions: { types: [] }, files: ["tests/c.ts"] };
    datei("tsconfig.zwei.json", JSON.stringify(zwei));
    const { code, aus } = fahre(sandkasten);
    expect(code, aus).toBe(0);
    expect(aus).toContain("Fassung unbekannt (kein git-Stand lesbar)");
    expect(aus).toContain("· tsconfig.json (npm run build): 3 Dateien — services 2 · tests 1");
    expect(aus).toContain("· web/tsconfig.json (npm run build): 1 Dateien — web 1");
    expect(aus).toContain("· tsconfig.zwei.json (tools/build): 1 Dateien — tests 1");
    const ablagePfad = join(sandkasten, ".local", "run", "typpruefung-umfang.json");
    const ablage = JSON.parse(readFileSync(ablagePfad, "utf8")) as Ablage;
    expect(ablage.fassung.commit).toBeNull();
    expect(ablage.laeufe.map((l) => l.dateien)).toEqual([3, 1, 1]);
  });

  it("U3 · ein Typprogramm ohne eine einzige Datei macht den Schritt rot", () => {
    bestand();
    datei("web/tsconfig.json", TSCONFIG(["leer"]));
    const { code, aus } = fahre(sandkasten);
    expect(code, aus).toBe(1);
    expect(aus).toMatch(/✖ web\/tsconfig\.json \(npm run build\): /);
    // Der gesunde Lauf daneben bleibt ausgewiesen.
    expect(aus).toContain("· tsconfig.json (npm run build): 3 Dateien");
  });

  it("U4 · kein erkennbarer Typlauf ist Code 2", () => {
    bestand();
    datei("package.json", JSON.stringify({ scripts: { build: "vite build" } }));
    const { code, aus } = fahre(sandkasten);
    expect(code, aus).toBe(2);
    expect(aus).toContain("fährt keine erkennbare Typprüfung");
  });

  it("U5 · die Fassung trägt Commit und Baumabweichung", () => {
    bestand();
    const identitaet = ["-c", "user.name=probe", "-c", "user.email=probe@example.invalid"];
    const umgebung = { ...process.env, GIT_CEILING_DIRECTORIES: "" };
    function git(...args: string[]) {
      return spawnSync("git", [...identitaet, ...args], {
        cwd: sandkasten,
        encoding: "utf8",
        env: umgebung,
      });
    }
    expect(git("init", "-q").status).toBe(0);
    expect(git("add", ".").status).toBe(0);
    expect(git("-c", "commit.gpgsign=false", "commit", "-qm", "probe").status).toBe(0);
    const commit = git("rev-parse", "HEAD").stdout.trim();
    writeFileSync(join(sandkasten, "services", "a.ts"), "export const a = 9;\n");
    const { code, aus } = fahre(sandkasten);
    // `.local/` ist hier nicht ignoriert; die Fassung wird VOR der Ablage erhoben.
    expect(code, aus).toBe(0);
    expect(aus).toContain(`Fassung ${commit} + 1 abweichende Dateien`);
  });

  it("U6 · tools/build ruft den Schritt nach der letzten Typprüfung", () => {
    const build = readFileSync(join(WURZEL, "tools", "build"), "utf8");
    const ausfuehrbar = build.split("\n").filter((z) => !z.trim().startsWith("#"));
    const schritt = ausfuehrbar.indexOf("node tools/typpruefung-umfang.mjs");
    expect(schritt).toBeGreaterThan(-1);
    expect(schritt).toBeGreaterThan(ausfuehrbar.indexOf("npm run --silent build"));
    expect(schritt).toBeGreaterThan(
      ausfuehrbar.indexOf("npx tsc --noEmit -p tsconfig.tests-smoke.json"),
    );
  });
});
