// Prüft die ausführbare Übergabe der PR-Teile ohne GitHub-Zugang, mit echten Dateien und Git-SHAs.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aufteilung, laufzustand } from "../../tools/pflicht-pr.mjs";
import { releaseVertrag } from "../../tools/release-vertrag.mjs";
import { assertProof, git, schmalansichtsTest } from "../../tools/release.mjs";

const produkt = fileURLToPath(new URL("../../", import.meta.url));
const work = mkdtempSync(join(tmpdir(), "pflicht-pr-probe-"));
function pfad(datei) {
  return join(work, datei);
}
function lege(datei, text) {
  mkdirSync(dirname(pfad(datei)), { recursive: true });
  writeFileSync(pfad(datei), text);
}
function kopiere(datei) {
  mkdirSync(dirname(pfad(datei)), { recursive: true });
  copyFileSync(join(produkt, datei), pfad(datei));
}
function json(datei) {
  return JSON.parse(readFileSync(pfad(datei), "utf8"));
}
function commit(text) {
  git(work, "add", ".");
  git(work, "commit", "-qm", text);
  return git(work, "rev-parse", "HEAD");
}

function probe() {
  for (const n of [63, 64, 65, 184, 185, 346]) {
    const dates = Array.from({ length: n }, (_, i) => `tests/fall-${i}.test.ts`);
    const teile = aufteilung(dates);
    if (n < 64) {
      assert.deepEqual(teile, []);
      continue;
    }
    assert.deepEqual(teile.flatMap((t) => t.tests).sort(), [...dates].sort());
    assert.equal(teile[0].id, "vorstufen");
    assert.equal(teile.length, Math.ceil(n / 16) + 1);
    assert(teile.every((t) => t.tests.length <= 16));
  }
  const langsam = [
    schmalansichtsTest,
    "tests/backup-drill/restore-drill.test.ts",
    "tests/backup-drill/restore-drill-belege.test.ts",
    "tests/app/modalgrenze-abweichende-bauformen.test.ts",
    "tests/tor-inventar/browserdeckel.test.ts",
    "tests/capture/aufrufer-waechter.test.ts",
  ];
  const gemischt = [
    ...langsam,
    ...Array.from({ length: 64 - langsam.length }, (_, i) => `tests/fall-${i}.test.ts`),
  ];
  const teile = aufteilung(gemischt);
  assert.deepEqual(teile.flatMap((t) => t.tests).sort(), [...gemischt].sort());
  assert.deepEqual(teile.find((teil) => teil.id === "schmalansicht").tests, [schmalansichtsTest]);
  for (const p of langsam) assert.deepEqual(teile.find((t) => t.tests.includes(p)).tests, [p]);
  for (const status of ["cancelled", "failure", "skipped"]) {
    assert.throws(() => laufzustand(true, status, "success"));
    assert.throws(() => laufzustand(true, "success", status));
  }
  assert.throws(() => laufzustand(false, "success", "success"));
  laufzustand(false, "success", "skipped");
  git(work, "init", "-q");
  git(work, "config", "user.name", "Pflichtprobe");
  git(work, "config", "user.email", "probe@example.invalid");
  for (const datei of [
    "tools/pflicht-pr.mjs",
    "tools/release.mjs",
    "tools/release-vertrag.mjs",
    "tools/release-ausnahmen.mjs",
    "tools/release-ausnahmen.json",
    "tools/word-addin-fassung.mjs",
    "tests/tor-inventar/browser-gruppe.ts",
    "tests/support/repoPfad.ts",
  ])
    kopiere(datei);
  lege("package.json", '{"type":"module"}');
  lege("vitest.config.ts", "export default {}");
  lege(".gitignore", "node_modules/\n.local/\n");
  lege("tools/browserdeckel.sh", 'shift\nexec "$@"\n');
  lege(
    "tools/lint",
    'echo \'{"summary":{"diagnosticsNotPrinted":0,"errors":0},"diagnostics":[]}\'\n',
  );
  lege("tools/geheimnis-scan.sh", "exit 0\n");
  for (const datei of releaseVertrag.causalTests) lege(datei, "export {};\n");
  const base = commit("Basis");
  const ursache = releaseVertrag.causalTests[0];
  lege(ursache, "// Auch im Gitdiff\nexport {};\n");
  lege(schmalansichtsTest, "export {};\n");
  for (let i = 0; i < 48; i++) lege(`tests/auswahl/${i}.test.ts`, "export {};\n");
  const sha = commit("genau 64 verschiedene Pflichtdateien");
  const out = ".local/run";
  mkdirSync(pfad("node_modules/.bin"), { recursive: true });
  symlinkSync(join(produkt, "node_modules/typescript"), pfad("node_modules/typescript"));
  const bin = pfad("node_modules/.bin");
  writeFileSync(join(bin, "tsc"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  writeFileSync(
    join(bin, "depcruise"),
    '#!/bin/sh\necho \'{"summary":{"violations":[],"error":0}}\'\n',
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "vitest"),
    `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
const files=process.argv.slice(3,process.argv.indexOf('--config'));
const reportPath=process.argv.find(a=>a.startsWith('--outputFile=')).slice('--outputFile='.length);
if (files.includes(${JSON.stringify(schmalansichtsTest)})) {
  require('node:assert/strict').equal(process.env.KLARWERK_BROWSERDECKEL_LOCK,
    require('node:path').join(require('node:path').dirname(reportPath), 'browser-kind.lock'));
}
const testResults=files.map(file=>({name:require('node:path').resolve(file),status:'passed',assertionResults:[{status:'passed',failureMessages:[]}]}));
writeFileSync(reportPath,JSON.stringify({success:true,testResults,numTotalTests:files.length,numPassedTests:files.length,numFailedTests:0,numPendingTests:0}));
`,
    { mode: 0o755 },
  );
  // Ausführliche Stufenprotokolle und Resultate werden durch die produktive Stufenmaschine erzeugt.
  const ausgabe = pfad(".local/github-output");
  mkdirSync(dirname(ausgabe), { recursive: true });
  function cli(args, expected, env = {}) {
    const run = spawnSync(process.execPath, ["tools/pflicht-pr.mjs", ...args], {
      cwd: work,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        GITHUB_EVENT_NAME: "pull_request",
        GITHUB_SHA: sha,
        GITHUB_OUTPUT: ausgabe,
        PLAN_ERGEBNIS: "success",
        MATRIX_ERGEBNIS: "success",
        PLAN_VERTEILT: "true",
        ...env,
      },
    });
    assert.equal(run.status, expected, run.stderr + run.stdout);
    return run;
  }
  cli(["plan", base, `${out}/plan`], 0);
  const plan = json(`${out}/plan/auswahl.json`);
  assert.equal(plan.tests.length, 64);
  assert.deepEqual(plan.ueberlappung, [ursache]);
  assert.equal(plan.commit, sha);
  assert.equal(plan.tree, git(work, "rev-parse", "HEAD^{tree}"));
  cli(["plan", sha, `${out}/klein`], 0);
  const klein = json(`${out}/klein/auswahl.json`);
  assert.deepEqual(klein.tests, [...releaseVertrag.causalTests].sort());
  assert.deepEqual(klein.teile, []);
  cli(["abschluss", sha, `${out}/klein-ende`], 0, {
    PLAN_VERTEILT: "false",
    MATRIX_ERGEBNIS: "skipped",
  });
  cli(["abschluss", sha, `${out}/klein-ende`], 1, {
    PLAN_VERTEILT: "false",
    MATRIX_ERGEBNIS: "skipped",
    LAUF_ABGEBROCHEN: "true",
  });
  const matrix = JSON.parse(readFileSync(ausgabe, "utf8").match(/^matrix=(.+)$/m)[1]).teil;
  assert.deepEqual(
    matrix,
    plan.teile.map((t) => t.id),
  );
  cli(["plan", base, `${out}/falsch`], 1, { GITHUB_SHA: base });
  cli(["teil", base, `${out}/falsch`, "test-5"], 1);
  cli(["plan", base, `${out}/falsch`], 1, { GITHUB_EVENT_NAME: "push" });
  function teilOrdner(id) {
    return `${out}/ende/teile/pflicht-pr-${sha}-${id}`;
  }
  for (const id of matrix) cli(["teil", base, teilOrdner(id), id], 0);
  const ende = () => cli(["abschluss", base, `${out}/ende`], 0);
  ende();
  const datei = `${out}/ende/pr-pflichtbericht.json`;
  const bericht = json(datei);
  assert(bericht.success);
  assert.equal(
    bericht.teile.reduce((n, t) => n + t.faelle, 0),
    64,
  );
  assert(!existsSync(pfad(`${out}/ende/pflicht.json`)));
  assert.throws(() => assertProof(bericht, plan.tree));
  const teil = teilOrdner("test-1");
  const beleg = `${teil}/teil.json`;
  const gut = json(beleg);
  assert.throws(() => assertProof(gut, plan.tree));
  const befehl = gut.stages[0].command;
  for (const arg of [
    "--minWorkers=1",
    "--maxWorkers=1",
    "--no-file-parallelism",
    "--allowOnly=false",
  ])
    assert(befehl.includes(arg));
  function rot(aenderung, folger, erwartet) {
    rmSync(pfad(datei), { force: true });
    aenderung();
    cli(["abschluss", base, `${out}/ende`], 1);
    const schlecht = json(datei);
    assert(!schlecht.success);
    assert.match(schlecht.fehler.join("\n"), erwartet);
    folger();
  }
  function fake(mutieren) {
    const kopie = structuredClone(gut);
    mutieren(kopie);
    lege(beleg, JSON.stringify(kopie));
  }
  const restore = () => lege(beleg, JSON.stringify(gut));
  rot(
    () =>
      fake((v) => {
        v.commit = base;
      }),
    restore,
    /test-1/,
  );
  rot(
    () =>
      fake((v) => {
        v.tests[0] = v.tests[1];
      }),
    restore,
    /test-1/,
  );
  rot(
    () =>
      fake((v) => {
        v.stages[0].endedAt = new Date(Date.parse(v.stages[0].startedAt) + 240001).toISOString();
        v.endedAt = v.stages[0].endedAt;
      }),
    restore,
    /test-1/,
  );
  rot(
    () =>
      fake((v) => {
        v.stages[0].exit = 1;
      }),
    restore,
    /test-1/,
  );
  rot(
    () =>
      fake((v) => {
        v.testReport.testResults.pop();
      }),
    restore,
    /test-1/,
  );
  const log = readFileSync(pfad(`${teil}/test.log`), "utf8");
  rot(
    () => lege(`${teil}/test.log`, `${log}verändert`),
    () => lege(`${teil}/test.log`, log),
    /verändertes Laufprotokoll/,
  );
  rot(() => rmSync(pfad(beleg)), restore, /test-1/);
  rmSync(pfad(datei));
  cli(["abschluss", base, `${out}/ende`], 1, { MATRIX_ERGEBNIS: "cancelled" });
  assert(json(datei).fehler.includes("GitHub-Matrix: cancelled"));
  rmSync(pfad(datei));
  cli(["abschluss", base, `${out}/ende`], 1, { PLAN_ERGEBNIS: "failure" });
  assert(!existsSync(pfad(datei)));
}
try {
  probe();
} finally {
  rmSync(work, { recursive: true, force: true });
}
