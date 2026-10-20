#!/usr/bin/env node
// ================================================================================================
// tools/typpruefung-umfang.mjs — welchen Umfang die Typprüfungen dieses Laufs TATSÄCHLICH abdecken.
// ================================================================================================
//
// aufnahme:20260922:gesamt-prueftor-einheitlich · R-1405: „Auch die Typprüfung soll ausweisen,
// welchen Umfang sie tatsächlich abgedeckt hat, statt nur grün zu melden.“ Die Vorgeschichte steht in
// tools/build (mega59 Block G): 45 von 389 Web-Dateien lagen ausserhalb jedes Typprogramms, und das
// Tor meldete trotzdem grün. Eine Zweckzeile im Vertrag sagt darüber nichts; gezählt wird hier.
//
// WOHER DIE LÄUFE KOMMEN: nicht aus einer eigenen Liste, sondern aus den Befehlen, die der Bau
// wirklich fährt — `tools/build` (jede `tsc`-Zeile, und `npm run build`, aufgelöst über
// package.json samt `cd`). Kommt eine Typprüfung dazu oder fällt eine weg, folgt dieser Bericht.
//
// WAS GEZÄHLT WIRD: je Lauf die Programmdateien, die `tsc -p <config> --listFilesOnly` mit derselben
// Konfiguration im selben Verzeichnis sammelt (ohne node_modules und Standardbibliotheken),
// gruppiert nach Bereich. Die Zählung prüft keine Typen — das hat der Lauf davor getan.
//
// FASSUNG: Commit und Zahl der abweichenden, nicht ignorierten Dateien; beides steht in der Ausgabe
// und in `.local/run/typpruefung-umfang.json`.
//
// FAIL-CLOSED: keine Typprüfung gefunden (Code 2), ein Lauf ohne eine einzige eigene Datei oder eine
// fehlgeschlagene Erhebung (Code 1). `--nur-plan` druckt nur die erkannten Läufe. `--wurzel <dir>`
// nur für die Gegenfälle in tests/tor-vertrag/typpruefung-umfang.test.ts.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const WURZEL = argv.includes("--wurzel")
  ? argv[argv.indexOf("--wurzel") + 1]
  : join(dirname(fileURLToPath(import.meta.url)), "..");

/** Ein `tsc`-Aufruf → sein Projekt (`-p`/`--project`, sonst tsconfig.json im Verzeichnis). */
function tscProjekt(befehl) {
  const t = befehl.trim().split(/\s+/);
  const i = t.findIndex((x) => x === "-p" || x === "--project");
  return i >= 0 && t[i + 1] ? t[i + 1] : "tsconfig.json";
}

const IST_TSC = /(?:^|\s)(?:npx\s+)?tsc(?:\s|$)/;

/** Die Typprüfungen aus `npm run build`: Glieder an `&&`, `cd` verschiebt das Verzeichnis. */
function ausNpmBuild() {
  const pkg = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8"));
  const laeufe = [];
  let ort = ".";
  for (const glied of (pkg.scripts?.build ?? "").split("&&")) {
    const cd = /^\s*cd\s+(\S+)\s*$/.exec(glied);
    if (cd?.[1]) {
      ort = join(ort, cd[1]);
    } else if (IST_TSC.test(glied)) {
      laeufe.push({ quelle: "npm run build", ort, projekt: tscProjekt(glied) });
    }
  }
  return laeufe;
}

/** Die Typprüfungen, die tools/build tatsächlich fährt — in Laufreihenfolge. */
function erhebeLaeufe() {
  const laeufe = [];
  for (const roh of readFileSync(join(WURZEL, "tools", "build"), "utf8").split("\n")) {
    const zeile = roh.replace(/(^|\s)#.*$/, "$1").trim();
    if (/^npm\s+run\s+(?:--\S+\s+)*build(?:\s|$)/.test(zeile)) {
      laeufe.push(...ausNpmBuild());
    } else if (/^npx\s+tsc(?:\s|$)/.test(zeile)) {
      laeufe.push({ quelle: "tools/build", ort: ".", projekt: tscProjekt(zeile) });
    }
  }
  return laeufe;
}

/** Derselbe Compiler, den `npx tsc` im Laufverzeichnis nähme; sonst der der Wurzel. */
function tscPfad(ort) {
  for (const basis of [join(WURZEL, ort, "package.json"), fileURLToPath(import.meta.url)]) {
    try {
      return createRequire(basis).resolve("typescript/bin/tsc");
    } catch {
      // nächster Kandidat
    }
  }
  throw new Error("kein TypeScript-Compiler auflösbar");
}

function bereich(datei) {
  const teile = datei.split(sep);
  if (teile.length === 1) {
    return "(wurzel)";
  }
  return teile[0] === "apps" && teile.length > 2 ? `${teile[0]}/${teile[1]}` : teile[0];
}

function fassung() {
  try {
    const opt = { cwd: WURZEL, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    const commit = execFileSync("git", ["rev-parse", "HEAD"], opt).trim();
    const status = execFileSync("git", ["status", "--porcelain"], opt);
    const abweichend = status.split("\n").filter((z) => z.length > 0).length;
    return { commit, abweichend };
  } catch {
    return { commit: null, abweichend: null };
  }
}

const laeufe = erhebeLaeufe();
if (laeufe.length === 0) {
  console.error("✖ Typprüfungsumfang: tools/build fährt keine erkennbare Typprüfung.");
  process.exit(2);
}
if (argv.includes("--nur-plan")) {
  for (const l of laeufe) {
    console.log(`${l.ort} ${l.projekt} ${l.quelle}`);
  }
  process.exit(0);
}

const stand = fassung();
let fassungText = "unbekannt (kein git-Stand lesbar)";
if (stand.commit !== null && stand.abweichend === 0) {
  fassungText = `${stand.commit} (Baum gleich dem Commit)`;
} else if (stand.commit !== null) {
  fassungText = `${stand.commit} + ${stand.abweichend} abweichende Dateien`;
}
console.log(`▷ Typprüfung, tatsächlich abgedeckter Umfang · Fassung ${fassungText}`);

let fehler = 0;
const ergebnis = [];
for (const l of laeufe) {
  const verzeichnis = join(WURZEL, l.ort);
  const name = join(l.ort, l.projekt);
  let dateien = [];
  try {
    const args = [tscPfad(l.ort), "-p", l.projekt, "--listFilesOnly"];
    const aus = execFileSync(process.execPath, args, {
      cwd: verzeichnis,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    dateien = aus
      .split("\n")
      .map((z) => z.trim())
      .filter((z) => z.length > 0 && existsSync(z) && !z.split(/[\\/]/).includes("node_modules"))
      .map((z) => relative(WURZEL, z));
  } catch (err) {
    const grund = String(err).split("\n")[0];
    console.log(`  ✖ ${name} (${l.quelle}): Umfang nicht erhebbar — ${grund}`);
    fehler = 1;
    ergebnis.push({ ...l, dateien: null });
    continue;
  }
  const je = {};
  for (const d of dateien) {
    je[bereich(d)] = (je[bereich(d)] ?? 0) + 1;
  }
  const aufteilung = Object.entries(je)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([b, n]) => `${b} ${n}`)
    .join(" · ");
  if (dateien.length === 0) {
    console.log(`  ✖ ${name} (${l.quelle}): 0 eigene Dateien — diese Typprüfung deckt nichts ab`);
    fehler = 1;
  } else {
    console.log(`  · ${name} (${l.quelle}): ${dateien.length} Dateien — ${aufteilung}`);
  }
  ergebnis.push({ ...l, dateien: dateien.length, bereiche: je });
}

const ablage = join(WURZEL, ".local", "run");
mkdirSync(ablage, { recursive: true });
writeFileSync(
  join(ablage, "typpruefung-umfang.json"),
  `${JSON.stringify({ fassung: stand, laeufe: ergebnis }, null, 2)}\n`,
);
process.exit(fehler);
