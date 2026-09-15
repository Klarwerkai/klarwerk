#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  installBefehlText,
  releaseIdentitaet,
  rollbackText,
  startBefehlText,
} from "./release-texte.mjs";
import { stufenAusBaum, vertragstext } from "./schema-vertrag.mjs";

const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
const shortCommit = commit.slice(0, 8);
const builtAt = new Date().toISOString();
const appVersion = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
// JOB 4012 · Runde 2 — JEDER BAULAUF TRAEGT SEINEN EIGENEN NAMEN.
//
// Bis hierher stand hier EINE feste Zeichenkette. Zwei Bauläufe hießen damit gleich, und das
// Einspielen des zweiten überschrieb das Verzeichnis des ersten — also genau die Fassung, auf die
// der Rückfall gleich zurückgreifen wollte (Ben, Gegenprobe BEN1: danach Exit 9 und HTTP 500).
// Die Identität wird deshalb erzeugt und geprüft: `tests/insel-update/release-identitaet.test.ts`.
const version = releaseIdentitaet({ appVersion, commit, gebautAm: builtAt });
const outDir = join(repo, "dist", "insel");
const stagingRoot = join(outDir, "staging");
const releaseDir = join(stagingRoot, version);
const zipPath = join(outDir, `${version}.zip`);
const marker = `KW-MAC-ISLAND-03 - ${version} - ${shortCommit}`;

const skipNames = new Set(["node_modules", ".git", ".localdb", "dist", ".DS_Store"]);
const skipSuffixes = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".log"];

function run(command, args, cwd = repo) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function copyFiltered(src, dest) {
  const name = basename(src);
  if (skipNames.has(name)) return;
  if (skipSuffixes.some((suffix) => name.endsWith(suffix))) return;
  const stats = statSync(src);
  if (stats.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const child of readdirSync(src)) {
      copyFiltered(join(src, child), join(dest, child));
    }
    return;
  }
  cpSync(src, dest);
}

function writeExecutable(path, body) {
  writeFileSync(path, body, { encoding: "utf8", mode: 0o755 });
}

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

rmSync(stagingRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(releaseDir, { recursive: true });

for (const file of ["package.json", "package-lock.json"]) {
  cpSync(join(repo, file), join(releaseDir, file));
}
copyFiltered(join(repo, "services"), join(releaseDir, "services"));
mkdirSync(join(releaseDir, "apps", "web"), { recursive: true });
cpSync(join(repo, "apps", "web", "dist"), join(releaseDir, "apps", "web", "dist"), {
  recursive: true,
});

const serverPath = join(releaseDir, "services", "app", "src", "server.ts");
let serverTs = readFileSync(serverPath, "utf8");
serverTs = serverTs.replace(
  "defaultSrc: [\"'self'\"],",
  "defaultSrc: [\"'self'\"],\n        upgradeInsecureRequests: null,",
);
serverTs = serverTs.replace(
  "hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },",
  "hsts: false,",
);
writeFileSync(serverPath, serverTs);

const indexPath = join(releaseDir, "apps", "web", "dist", "index.html");
if (!existsSync(indexPath)) {
  throw new Error("apps/web/dist/index.html fehlt nach dem Web-Build.");
}
const markerMeta = `<meta name="klarwerk-island" content="${escapeHtmlAttribute(marker)}">`;
let indexHtml = readFileSync(indexPath, "utf8");
indexHtml = indexHtml.includes("</head>")
  ? indexHtml.replace("</head>", `  ${markerMeta}\n</head>`)
  : `${markerMeta}\n${indexHtml}`;
writeFileSync(indexPath, indexHtml);

writeFileSync(
  join(releaseDir, "BUILD_INFO"),
  [
    `version=${version}`,
    `built_at=${builtAt}`,
    `commit=${commit}`,
    `source=${repo}`,
    `ui_marker=${marker}`,
    "web_build=apps/web/dist",
    "service_entry=services/app/src/server.ts",
    "port=3002",
    "llm_url=http://127.0.0.1:11434/v1",
    "llm_model=mistral:latest",
    "llm_key=",
    "",
  ].join("\n"),
);

// Der Startbefehl und der Doppelklick kommen aus `release-texte.mjs` — dort sind sie ohne
// Nebenwirkung erzeugbar und werden deshalb WIRKLICH GEFAHREN geprueft
// (`tests/insel-update/abloesung.test.ts`). In dieser Datei lagen sie ungeprueft, weil sie beim
// Laden baut: Genau dort hat Ben den weggeworfenen `DATABASE_URL` und den zweiten Umschaltweg
// gefunden (Korrekturpflichten 3 und 4).
writeExecutable(join(releaseDir, "start.command"), startBefehlText());

writeExecutable(join(releaseDir, "install.command"), installBefehlText());

// ==================================================================================================
// JOB 4012 — DER BETRIEBSWEG FAEHRT MIT DEM RELEASE.
// ==================================================================================================
//
// Bis hierher enthielt ein Release seinen eigenen Rueckweg nur als ABTIPPANLEITUNG (ROLLBACK.md).
// Wer sie braucht, hat gerade eine kaputte App vor sich. Ab jetzt liegen die ausfuehrbaren Wege
// IM Release, samt dem Schema-Vertrag, gegen den das Update vor dem Umschalten prueft.
//
// `scripts/backup/*` wird MITKOPIERT, nicht veraendert: `update-einspielen.sh` ruft `backup.sh` im
// Postgres-Betrieb auf, `rueckfall.sh --daten-zurueck` uebergibt an `restore-drill.sh`. Ohne die
// Kopie haette das Release auf der Insel kein Sicherungswerkzeug — dort liegt kein Repo.
const betriebsWege = [
  ["scripts", "insel", "update-einspielen.sh"],
  ["scripts", "insel", "rueckfall.sh"],
  ["scripts", "insel", "insel-betrieb.sh"],
  ["scripts", "insel", "schema-vertrag.mjs"],
  ["scripts", "backup", "backup.sh"],
  ["scripts", "backup", "restore-drill.sh"],
];
for (const teile of betriebsWege) {
  const ziel = join(releaseDir, ...teile);
  mkdirSync(dirname(ziel), { recursive: true });
  // Der Modus wird AUSDRUECKLICH gesetzt und nicht vom Quellbaum geerbt: ein Klon ohne Ausfuehrrecht
  // lieferte sonst ein Release, dessen Rueckweg sich nicht starten laesst.
  writeExecutable(ziel, readFileSync(join(repo, ...teile), "utf8"));
}

// Der Schema-Vertrag: die Migrationsstufen, die GENAU DIESES Release kennt, plus seine App-Version
// (die `/health` meldet). `update-einspielen.sh` vergleicht ihn mit dem Stand neben den Daten.
const stufen = stufenAusBaum(repo);
writeFileSync(
  join(releaseDir, "SCHEMA-VERTRAG"),
  vertragstext({ release: version, appVersion, commit, stufen }),
);

writeFileSync(join(releaseDir, "ROLLBACK.md"), rollbackText(version));

run("npm", ["ci", "--omit=dev", "--ignore-scripts"], releaseDir);
run("zip", ["-qr", zipPath, version], stagingRoot);

const size = statSync(zipPath).size;
const relativeZip = relative(repo, zipPath);
console.log(JSON.stringify({ version, commit, marker, zipPath, relativeZip, size }, null, 2));
