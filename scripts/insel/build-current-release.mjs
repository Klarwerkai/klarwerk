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
import { fremdquellen } from "./paketinhalt.mjs";
import {
  installBefehlText,
  releaseIdentitaet,
  rollbackText,
  startBefehlText,
} from "./release-texte.mjs";
import { stufenAusBaum, vertragstext } from "./schema-vertrag.mjs";

// ==================================================================================================
// JOB 4315 — DIE VERPACKUNG IST EIN BENANNTER SCHRITT, DER STANDARD BLEIBT UNVERAENDERT.
// ==================================================================================================
//
// WARUM ES DIESEN SCHALTER GIBT. Alles bis `npm ci --omit=dev` (unten, letzter Bauschritt)
// geschieht IM Releaseverzeichnis; danach ist das Release fertig und startfaehig. Erst der Schritt
// DANACH ruft `zip`. Dieses Werkzeug gibt es auf dem Pruefstand nicht, und deshalb war dieser Bauer
// dort bis heute GAR NICHT fahrbar: `tests/insel-update/release-inhalt.test.ts:9-14` haelt woertlich
// fest, dass der volle Baulauf nicht gemessen wird. Gemessen wurde also der QUELLTEXT dieser Datei,
// nie ihr ERZEUGNIS — und ob das Erzeugnis startet, wusste niemand (Befund T-015).
//
// `--ohne-verpackung` beendet den Bau nach `npm ci --omit=dev` und meldet das AUSDRUECKLICH
// (`verpackt: false`, `zipPath: null`, `grund`). Damit ist der gebaute Stand messbar, ohne dass
// irgendwo ein unverpacktes Release als Paket durchgeht.
//
// OHNE DEN SCHALTER AENDERT SICH NICHTS AN DER SACHE: es wird gezippt, und fehlt `zip`, BRICHT DER
// BAU AB. Neu ist allein die Meldung — vorher endete `execFileSync` mit einem nackten
// `Error: spawnSync zip ENOENT` (woertlich gemessen, Cloud-Lauf d86bc9bf) und verschwieg, dass unter
// `dist/insel/staging/<version>` ein fertiges Release liegt. Ein Mensch stand vor einem
// Werkzeugfehler und wusste nicht, was fertig war und was nicht.
//
// FAIL-CLOSED BEI UNBEKANNTEN ARGUMENTEN: ein stillschweigend ignoriertes `--ohne-verpackkung`
// (Tippfehler) haette gezippt, waere auf dem Pruefstand mit ENOENT gestorben und haette wie ein
// kaputter Bauer ausgesehen. Deshalb wird JEDES nicht gekannte Argument benannt und abgelehnt —
// VOR dem ersten Seiteneffekt, also bevor `stagingRoot` abgeraeumt wird.
const ARGUMENTE = process.argv.slice(2);
const OHNE_VERPACKUNG = ARGUMENTE.includes("--ohne-verpackung");
const UNBEKANNTE_ARGUMENTE = ARGUMENTE.filter((argument) => argument !== "--ohne-verpackung");
if (UNBEKANNTE_ARGUMENTE.length > 0) {
  throw new Error(
    `Paketbau abgebrochen: unbekanntes Argument ${UNBEKANNTE_ARGUMENTE.map((a) => `„${a}"`).join(", ")}. Bekannt ist nur --ohne-verpackung (baut das Release und ueberspringt den zip-Schritt). Es wurde nichts gebaut und nichts geloescht.`,
  );
}

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

// ==================================================================================================
// JOB 4241 — DAS PAKET BRINGT JEDE DATEI MIT, DIE SEIN EIGENER STARTPFAD LAEDT.
// ==================================================================================================
//
// Bis hierher kopierte dieser Bauer GENAU die zwei Baeume darueber. Der Server laedt aber eine
// dritte Stelle: `services/app/src/routes/capture-routes.ts:12` fuehrt den DOM-freien DOCX-Kern aus
// `apps/web/src/lib/docx.ts` ein — ausdruecklich von dort und nicht als Kopie (`capture-routes.ts:7-11`).
// Auf der Insel liegt kein Repo daneben, das Paket endete deshalb beim ersten `start.command` mit
// `ERR_MODULE_NOT_FOUND apps/web/src/lib/docx` (Befund T-015).
//
// Die Liste wird BERECHNET und nicht gepflegt (`paketinhalt.mjs`): ein neuer Querimport wandert von
// selbst mit, statt bis zum Kunden unbemerkt zu fehlen. Kopiert wird jede gemeldete Datei unter
// ihrem UNVERAENDERTEN repo-relativen Pfad — `apps/web/src/lib/docx.ts` landet auf
// `<release>/apps/web/src/lib/docx.ts`, sonst loest die Einfuhr im Release wieder ins Leere.
// Kein pauschales `apps/web/src`, kein Entwicklerbaum, keine `node_modules`, keine `.git`.
const mitgelieferteFremdquellen = fremdquellen(repo);
for (const pfad of mitgelieferteFremdquellen) {
  const quelle = join(repo, pfad);
  if (relative(repo, quelle).startsWith("..")) {
    throw new Error(`Fremdquelle ${pfad} liegt ausserhalb des Repos (${quelle}) und wird nicht mitgeliefert.`);
  }
  if (!existsSync(quelle) || !statSync(quelle).isFile()) {
    throw new Error(`Fremdquelle ${pfad} fehlt im Baum (${quelle}) — das Paket waere unvollstaendig.`);
  }
  const ziel = join(releaseDir, pfad);
  mkdirSync(dirname(ziel), { recursive: true });
  // Dieselben Filter wie fuer `services` (`skipNames`, `skipSuffixes`) — Testdateien kommen nicht
  // mit. Greift ein Filter auf einer WIRKLICH geladenen Datei, ist das kein Grund weiterzubauen:
  // ein halbes Paket faellt sonst erst beim Betreiber auf.
  copyFiltered(quelle, ziel);
  if (!existsSync(ziel)) {
    throw new Error(`Fremdquelle ${pfad} wurde vom Kopierfilter ausgelassen — das Paket waere unvollstaendig.`);
  }
}

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
    // JOB 4241: was dieses Paket AUSSERHALB von `services` und `apps/web/dist` mitbringt, weil sein
    // Startpfad es laedt. Der Betreiber sieht damit am Paket selbst, was darin steckt.
    `fremdquellen=${mitgelieferteFremdquellen.join(",")}`,
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

// ==================================================================================================
// JOB 4315 — AB HIER IST DAS RELEASE FERTIG. Was folgt, ist nur noch die Verpackung.
// ==================================================================================================
//
// DIE MELDUNG BEI FEHLENDEM WERKZEUG NENNT DREI DINGE, weil ein Mensch genau die drei braucht: was
// FERTIG ist (das Release, mit Pfad), was NICHT entstanden ist (das Zip, mit Pfad), und WELCHES
// Werkzeug fehlt. „spawnSync zip ENOENT" nannte keines davon.
function verpacke() {
  try {
    run("zip", ["-qr", zipPath, version], stagingRoot);
  } catch (fehler) {
    const werkzeugFehlt = fehler !== null && typeof fehler === "object" && fehler.code === "ENOENT";
    throw new Error(
      [
        werkzeugFehlt
          ? 'Verpackung abgebrochen: das Werkzeug „zip" ist auf diesem Rechner nicht auffindbar.'
          : `Verpackung abgebrochen: „zip" endete mit einem Fehler (${String(fehler?.status ?? fehler?.code ?? fehler)}).`,
        `FERTIG GEBAUT ist das Release trotzdem — es liegt UNVERPACKT unter: ${releaseDir}`,
        `NICHT ENTSTANDEN ist das Paket: ${zipPath} wurde nicht geschrieben.`,
        "Wer bewusst ohne Verpackung bauen will, ruft den Bauer mit --ohne-verpackung; er meldet dann verpackt: false und zipPath: null.",
      ].join("\n"),
    );
  }
}

// EIN UNVERPACKTES PAKET WIRD NIE ALS VERPACKTES GEMELDET. `verpackt` ist das eine Feld, an dem der
// Unterschied haengt; `zipPath`, `relativeZip` und `size` sind dann `null` und nicht etwa ein Pfad
// auf eine Datei, die es nicht gibt (`zipPath` ist oben bei `:77` ausdruecklich geloescht worden).
const verpackt = !OHNE_VERPACKUNG;
if (verpackt) {
  verpacke();
}
console.log(
  JSON.stringify(
    {
      version,
      commit,
      marker,
      releaseDir,
      relativeRelease: relative(repo, releaseDir),
      verpackt,
      grund: verpackt
        ? null
        : "--ohne-verpackung: der Bau endete nach `npm ci --omit=dev`. Das Release ist fertig, ein Paket ist NICHT entstanden.",
      zipPath: verpackt ? zipPath : null,
      relativeZip: verpackt ? relative(repo, zipPath) : null,
      size: verpackt ? statSync(zipPath).size : null,
    },
    null,
    2,
  ),
);
