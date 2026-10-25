#!/usr/bin/env node
// Nur der bestehende CI-Integrationsweg führt diese Auswahl aus; lokal nur Quellenmetadaten.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { guardedLocalPgTestUrl } from "../services/db-tx/src/pg-test-guard.ts";
import { assertTests, environment, git, hash, integrationSelection } from "./release.mjs";

const kandidatPfad = join(
  dirname(realpathSync(fileURLToPath(import.meta.url))),
  "../tests/fe003-tutorial-fragen/kandidat.ts",
);
const { FE003_DATEIEN, oberflaechenBindung, pruefeBauvorbereitung, saubererBaustand } =
  await import(pathToFileURL(kandidatPfad).href);

export function pgSelection(paths) {
  return integrationSelection(paths);
}
function assertFehlgeschlageneTests(report, tests, root) {
  assert(report && typeof report === "object" && report.success === false);
  const files = report.testResults;
  assert(Array.isArray(files) && tests.length > 0 && files.length === tests.length);
  assert(files.every((file) => typeof file.name === "string"));
  assert.deepEqual(
    files.map((file) => resolve(file.name)).sort(),
    tests.map((file) => resolve(root, file)).sort(),
  );
  assert(
    files.every((file) => Array.isArray(file.assertionResults) && file.assertionResults.length > 0),
  );
  const assertions = files.flatMap((file) => file.assertionResults);
  assert(
    assertions.every(
      (a) =>
        ["passed", "failed"].includes(a.status) &&
        Array.isArray(a.failureMessages) &&
        (a.status === "passed"
          ? a.failureMessages.length === 0
          : a.failureMessages.length > 0 &&
            a.failureMessages.every((message) => typeof message === "string" && message.trim())),
    ),
  );
  const failed = assertions.filter((a) => a.status === "failed").length;
  assert(failed > 0, "kein vollständig gemessener fachlicher Rotbefund");
  for (const key of Object.keys(report).filter((key) => /^num[A-Z]/.test(key))) {
    assert(Number.isSafeInteger(report[key]) && report[key] >= 0, key);
  }
  assert.equal(report.numTotalTests, assertions.length);
  assert.equal(report.numFailedTests, failed);
  assert.equal(report.numPassedTests, assertions.length - failed);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests ?? 0, 0);
  assert.equal(report.numPendingTestSuites, 0);
  assert.equal(report.numRuntimeErrorTestSuites ?? 0, 0);
  assert.equal(report.wasInterrupted ?? false, false);
  assert.deepEqual(report.unhandledErrors ?? [], []);
  assert(files.every((file) => file.testExecError === undefined || file.testExecError === null));
  const failedFiles = files.filter((file) =>
    file.assertionResults.some((a) => a.status === "failed"),
  ).length;
  assert(
    files.every(
      (file) =>
        file.status ===
        (file.assertionResults.some((a) => a.status === "failed") ? "failed" : "passed"),
    ),
  );
  assert(report.numFailedTestSuites >= failedFiles);
  assert(report.numPassedTestSuites >= files.length - failedFiles);
  assert.equal(report.numTotalTestSuites, report.numPassedTestSuites + report.numFailedTestSuites);
}

function gesamtbericht(reports) {
  const combined = {
    success: reports.every((report) => report.success === true),
    testResults: reports.flatMap((report) => report.testResults),
  };
  const counters = new Set(
    reports.flatMap((report) => Object.keys(report).filter((key) => /^num[A-Z]/.test(key))),
  );
  for (const key of counters) {
    const values = reports.map((report) => report[key]);
    assert(
      values.every((value) => Number.isSafeInteger(value) && value >= 0),
      key,
    );
    const total = values.reduce((sum, value) => sum + value, 0);
    assert(Number.isSafeInteger(total), key);
    combined[key] = total;
  }
  return combined;
}

function bereiteFe003Vor(root, base, files, output, logPath, commit, tree) {
  const ordner = join(output, "fe003-bau");
  mkdirSync(ordner);
  const part = {
    command: ["tools/build"],
    capMs: 240000,
    startedAt: new Date().toISOString(),
    actualWaitCompleted: false,
    success: false,
    logPath: join(ordner, "build.log"),
    proofPath: join(ordner, "beleg.json"),
  };
  try {
    const stand = saubererBaustand(root);
    assert.equal(stand.commit, commit);
    assert.equal(stand.tree, tree);
    const run = spawnSync("bash", ["tools/browserdeckel.sh", "smoke", ...part.command], {
      cwd: root,
      env: environment(),
      encoding: "utf8",
      timeout: 240000,
      maxBuffer: 32 * 1024 * 1024,
    });
    Object.assign(part, {
      pid: run.pid,
      exit: run.status,
      signal: run.signal,
      processError: run.error ? { name: run.error.name, message: run.error.message } : null,
      actualWaitCompleted: true,
      endedAt: new Date().toISOString(),
    });
    const log = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    writeFileSync(part.logPath, log, { flag: "wx" });
    part.logSha256 = hash(log);
    appendFileSync(
      logPath,
      `\n=== FE003 Kandidatenbau ===\n${log}\n=== build exit=${run.status} ===\n`,
    );
    if (run.error) throw run.error;
    assert.equal(run.signal, null);
    assert.equal(run.status, 0);
    assert.deepEqual(saubererBaustand(root), stand);
    const beleg = {
      version: 1,
      stand,
      auswahl: { id: randomUUID(), base: git(root, "rev-parse", base), files },
      bau: {
        command: part.command,
        capMs: part.capMs,
        pid: part.pid,
        exit: part.exit,
        signal: part.signal,
        processError: part.processError,
        actualWaitCompleted: part.actualWaitCompleted,
        startedAt: part.startedAt,
        endedAt: part.endedAt,
        logPath: part.logPath,
        logSha256: part.logSha256,
      },
      oberflaeche: oberflaechenBindung(root),
    };
    const roh = `${JSON.stringify(beleg, null, 2)}\n`;
    writeFileSync(part.proofPath, roh, { flag: "wx" });
    part.proofSha256 = hash(roh);
    part.selectionId = beleg.auswahl.id;
    part.success = true;
  } catch (error) {
    part.error = error.message;
  } finally {
    part.finishedAt = new Date().toISOString();
    writeFileSync(join(ordner, "run.json"), `${JSON.stringify(part, null, 2)}\n`, { flag: "wx" });
  }
  return part;
}

export function runPgSelection(root, base, output) {
  assert.equal(
    process.env.KLARWERK_PG_PFLICHT,
    "1",
    "nur im ausdrücklich verpflichtenden CI-PG-Weg",
  );
  const commit = git(root, "rev-parse", "HEAD");
  const tree = git(root, "rev-parse", "HEAD^{tree}");
  const files = pgSelection(
    git(root, "diff", "--name-only", "--diff-filter=ACMR", base, commit)
      .split("\n")
      .filter(Boolean),
  );
  mkdirSync(output, { recursive: true });
  const result = {
    commit,
    tree,
    base,
    files,
    applicable: files.length > 0,
    success: false,
    startedAt: new Date().toISOString(),
    runs: [],
  };
  const logPath = join(output, "pg.log");
  let logBegonnen = false;
  try {
    const angebotenePgUrl = process.env.KLARWERK_PG_TEST_URL;
    const pgUrl = guardedLocalPgTestUrl({ KLARWERK_PG_TEST_URL: angebotenePgUrl });
    assert(
      angebotenePgUrl === undefined || pgUrl !== undefined,
      "angebotene KLARWERK_PG_TEST_URL nicht als Testdatenbank freigegeben",
    );
    const pgEnv = pgUrl === undefined ? {} : { KLARWERK_PG_TEST_URL: pgUrl };
    if (files.length > 0) {
      const rawPath = join(output, "pg.vitest.json");
      const teile = join(output, "dateien");
      for (const path of [rawPath, logPath, teile, join(output, "pg-auswahl.json")]) {
        assert(!existsSync(path), `Ergebnisablage existiert bereits: ${path}`);
      }
      mkdirSync(teile);
      writeFileSync(logPath, "", { flag: "wx" });
      logBegonnen = true;
      const reports = [];
      for (const [index, file] of files.entries()) {
        let bauEnv = {};
        if (FE003_DATEIEN.includes(file) && existsSync(join(root, file))) {
          result.preparation ??= bereiteFe003Vor(root, base, files, output, logPath, commit, tree);
          assert(result.preparation.success, result.preparation.error);
          bauEnv = {
            FE003_BAU_BELEG: result.preparation.proofPath,
            FE003_BAU_SHA256: result.preparation.proofSha256,
            FE003_BAU_AUSWAHL: result.preparation.selectionId,
            FE003_BAU_DATEI: file,
          };
          pruefeBauvorbereitung(root, bauEnv);
        }
        const ordner = join(teile, String(index + 1).padStart(4, "0"));
        mkdirSync(ordner);
        const einzelRaw = join(ordner, "pg.vitest.json");
        const einzelLog = join(ordner, "pg.log");
        const command = [
          "./node_modules/.bin/vitest",
          "run",
          file,
          "--config",
          "vitest.integration.config.ts",
          "--allowOnly=false",
          "--passWithNoTests=false",
          "--pool=forks",
          "--poolOptions.forks.minForks=1",
          "--poolOptions.forks.maxForks=1",
          "--minWorkers=1",
          "--maxWorkers=1",
          "--no-file-parallelism",
          "--testTimeout=60000",
          "--reporter=default",
          "--reporter=json",
          `--outputFile=${einzelRaw}`,
        ];
        const part = {
          file,
          command,
          rawPath: einzelRaw,
          logPath: einzelLog,
          startedAt: new Date().toISOString(),
          actualWaitCompleted: false,
          success: false,
        };
        result.runs.push(part);
        try {
          const run = spawnSync("bash", ["tools/browserdeckel.sh", "smoke", ...command], {
            cwd: root,
            env: { ...environment(), KLARWERK_PG_PFLICHT: "1", ...pgEnv, ...bauEnv },
            encoding: "utf8",
            timeout: 240000,
            maxBuffer: 32 * 1024 * 1024,
          });
          Object.assign(part, {
            pid: run.pid,
            exit: run.status,
            signal: run.signal,
            processError: run.error
              ? {
                  ...run.error,
                  name: run.error.name,
                  message: run.error.message,
                  stack: run.error.stack,
                }
              : null,
            actualWaitCompleted: true,
          });
          result.command = command;
          result.exit = run.status;
          const log = `${run.stdout ?? ""}${run.stderr ?? ""}`;
          writeFileSync(einzelLog, log, { flag: "wx" });
          part.logSha256 = hash(log);
          appendFileSync(
            logPath,
            `\n=== ${index + 1}/${files.length}: ${file} ===\n${log}\n=== exit=${JSON.stringify(run.status)} signal=${JSON.stringify(run.signal)} ===\n`,
          );
          if (run.error) throw run.error;
          assert.equal(run.signal, null);
          assert(run.status === 0 || run.status === 1);
          if (bauEnv.FE003_BAU_BELEG) {
            pruefeBauvorbereitung(root, bauEnv);
            assert(
              log.includes('"phase":"build-beleg-bestaetigt"'),
              "FE003-Baubeleg nicht benutzt",
            );
            assert(!log.includes('"phase":"build-beleg-abgelehnt"'), "FE003-Baubeleg abgelehnt");
          }
          const raw = readFileSync(einzelRaw);
          part.rawSha256 = hash(raw);
          const report = JSON.parse(raw);
          if (run.status === 0) assertTests(report, [file], root);
          else assertFehlgeschlageneTests(report, [file], root);
          assert(
            !/Vitest caught \d+ unhandled error/iu.test(log) &&
              !/⎯+[^\n]*(?:Unhandled Errors|Unhandled Rejection|Uncaught Exception)/iu.test(log),
            "ungeklärter PG-Laufzeitfehler",
          );
          assert(report.wasInterrupted !== true, "abgebrochener PG-Rohbericht");
          assert.equal(report.numRuntimeErrorTestSuites ?? 0, 0);
          reports.push(report);
          part.success = report.success;
        } catch (error) {
          part.error = error.message;
          throw error;
        } finally {
          part.endedAt = new Date().toISOString();
          writeFileSync(join(ordner, "run.json"), `${JSON.stringify(part, null, 2)}\n`, {
            flag: "wx",
          });
        }
      }
      const combined = gesamtbericht(reports);
      if (combined.success) assertTests(combined, files, root);
      else assertFehlgeschlageneTests(combined, files, root);
      const raw = `${JSON.stringify(combined, null, 2)}\n`;
      writeFileSync(rawPath, raw, { flag: "wx" });
      result.rawSha256 = hash(raw);
      result.success = combined.success;
      result.exit = combined.success ? 0 : 1;
      if (!combined.success) {
        result.error = `Fehlgeschlagene PG-Dateien: ${result.runs
          .filter((part) => !part.success)
          .map((part) => part.file)
          .join(", ")}`;
      }
    }
  } catch (error) {
    result.error = error.message;
  }
  if (logBegonnen) result.logSha256 = hash(readFileSync(logPath));
  result.endedAt = new Date().toISOString();
  writeFileSync(join(output, "pg-auswahl.json"), `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
  });
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert(
      process.argv[2] && process.argv[3],
      "pg-auswahl.mjs <Basiscommit> <neuer Ergebnisordner>",
    );
    const result = runPgSelection(
      resolve(dirname(fileURLToPath(import.meta.url)), ".."),
      process.argv[2],
      resolve(process.argv[3]),
    );
    console.log(JSON.stringify(result));
    process.exitCode = !result.applicable || result.success ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
