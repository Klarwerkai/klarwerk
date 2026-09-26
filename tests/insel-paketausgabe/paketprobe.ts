// ================================================================================================
// JOB 4285 — DER EINE PRÜFSTAND DER PAKETAUSGABE.
// ================================================================================================
//
// WARUM DIESE DATEI ENTSTEHT. `fremdquellen-im-paket.test.ts` (JOB 4241) hat sich ihren Prüfstand
// selbst gebaut: Wegwerfordner, Aufruf des Prüflings im KINDPROZESS, die Kopierfilter des Bauers,
// ein echter `node`-Start. JOB 4285 braucht für die drei Lesegrenzen (`require`, JSX, berechneter
// Pfad) genau denselben Stand. Ihn ein zweites Mal zu schreiben wäre dieselbe Krankheit, die der
// Prüfling gerade hinter sich hat: zwei Leser derselben Sache, von denen einer weniger weiß
// (`paketinhalt.mjs:119-139`, Befunde der Runden 4 und 5 von JOB 4241). Er steht deshalb EINMAL
// hier und wird von beiden Testdateien eingeführt.
//
// Diese Datei enthält KEINE Erwartung und keinen Fall — nur den Stand. Was gemessen wird, steht in
// den Testdateien daneben. Die einzige Ausnahme ist die Statusprüfung in `modulJson`: ein
// gescheiterter Kindprozess hat kein JSON zu liefern, und sein `stderr` gehört in die Meldung.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { expect } from "vitest";

export const WURZEL = resolve(import.meta.dirname, "../..");
export const MODUL = join(WURZEL, "scripts/insel/paketinhalt.mjs");
export const EINSTIEG = "services/app/src/server.ts";

const arbeitsordner: string[] = [];

/** Ein Wegwerfordner; `raeumeAuf` entfernt alle wieder (in `afterAll` der jeweiligen Testdatei). */
export function wegwerfordner(): string {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-paketausgabe-"));
  arbeitsordner.push(ordner);
  return ordner;
}

export function raeumeAuf(): void {
  for (const ordner of arbeitsordner) {
    rmSync(ordner, { recursive: true, force: true });
  }
  arbeitsordner.length = 0;
}

// ------------------------------------------------------------------------------------------------
// Das Modul wird im KINDPROZESS gefahren — genau so, wie `build-current-release.mjs` es laedt.
// Dieselbe Bauart wie `tests/insel-update/insel-probe.ts:505` und `release-inhalt.test.ts:31`:
// die Insel-Skripte sind `.mjs` und werden von `node` gefahren, nicht vom TypeScript-Baum.
// ------------------------------------------------------------------------------------------------
function imModul(ausdruck: string): { status: number | null; stdout: string; stderr: string } {
  const lauf = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as m from ${JSON.stringify(MODUL)};
const WURZEL = ${JSON.stringify(WURZEL)};
process.stdout.write(JSON.stringify(${ausdruck}));`,
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  return { status: lauf.status, stdout: lauf.stdout ?? "", stderr: lauf.stderr ?? "" };
}

export function modulJson<T>(ausdruck: string): T {
  const lauf = imModul(ausdruck);
  expect(lauf.status, lauf.stderr).toBe(0);
  return JSON.parse(lauf.stdout) as T;
}

/** Wie `modulJson`, aber fuer Rumpfe, die scheitern DUERFEN — der Aufrufer wertet den Ausgang. */
export function fahreModul(rumpf: string): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const lauf = spawnSync(
    "node",
    ["--input-type=module", "-e", `import * as m from ${JSON.stringify(MODUL)};\n${rumpf}`],
    { encoding: "utf8", timeout: 120_000 },
  );
  return { status: lauf.status, stdout: lauf.stdout ?? "", stderr: lauf.stderr ?? "" };
}

// ------------------------------------------------------------------------------------------------
// Die Kopierfilter des Bauers, woertlich (`build-current-release.mjs:41-42, :48-61`). Sie werden
// hier nachgebaut und nicht eingefuehrt: der Bauer raeumt beim Laden Verzeichnisse ab.
// ------------------------------------------------------------------------------------------------
const SKIP_NAMEN = new Set(["node_modules", ".git", ".localdb", "dist", ".DS_Store"]);
const SKIP_ENDUNGEN = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".log"];

export function kopiereGefiltert(quelle: string, ziel: string): void {
  const name = basename(quelle);
  if (SKIP_NAMEN.has(name)) return;
  if (SKIP_ENDUNGEN.some((endung) => name.endsWith(endung))) return;
  if (statSync(quelle).isDirectory()) {
    mkdirSync(ziel, { recursive: true });
    for (const kind of readdirSync(quelle)) {
      kopiereGefiltert(join(quelle, kind), join(ziel, kind));
    }
    return;
  }
  cpSync(quelle, ziel);
}

/** Startet ein gebautes Paket wirklich — `node <paket>/<einstieg>`, ohne Umweg. */
export function starte(paket: string, einstieg: string): { status: number | null; aus: string } {
  const lauf = spawnSync("node", [join(paket, einstieg)], { encoding: "utf8", timeout: 60_000 });
  return { status: lauf.status, aus: `${lauf.stdout ?? ""}${lauf.stderr ?? ""}` };
}

/**
 * Der Lader, mit dem das ausgelieferte `start.command` den Server fährt (`release-texte.mjs`,
 * `exec "$NODE_BIN" "$ROOT/node_modules/tsx/dist/cli.mjs" …`). Er kommt über `npm ci`, nicht über
 * den Quellbaum — deshalb darf er hier aus dem Repo stammen, ohne dem Paket eine Quelldatei zu leihen.
 */
export const TSX_CLI = join(WURZEL, "node_modules/tsx/dist/cli.mjs");

/**
 * Wie `starte`, aber mit dem Ordner selbst als Arbeitsverzeichnis und wahlweise über `tsx` — so
 * greift kein `tsconfig.json` und kein Pfad des Repos in den Start ein (Aufnahme 20260922).
 */
export function starteIsoliert(
  ordner: string,
  einstieg: string,
  lader: "node" | "tsx",
): { status: number | null; aus: string } {
  const argumente = lader === "tsx" ? [TSX_CLI, join(ordner, einstieg)] : [join(ordner, einstieg)];
  const lauf = spawnSync("node", argumente, { cwd: ordner, encoding: "utf8", timeout: 60_000 });
  return { status: lauf.status, aus: `${lauf.stdout ?? ""}${lauf.stderr ?? ""}` };
}
