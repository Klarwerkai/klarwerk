#!/usr/bin/env node
// Nur der bestehende CI-Integrationsweg führt diese Auswahl aus; lokal nur Quellenmetadaten.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertTests, environment, git, hash, integrationSelection } from "./release.mjs";

export function pgSelection(paths) {
  return integrationSelection(paths);
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
            env: { ...environment(), KLARWERK_PG_PFLICHT: "1" },
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
          assert.equal(run.status, 0);
          const raw = readFileSync(einzelRaw);
          part.rawSha256 = hash(raw);
          const report = JSON.parse(raw);
          assertTests(report, [file], root);
          assert(report.wasInterrupted !== true, "abgebrochener PG-Rohbericht");
          assert.equal(report.numRuntimeErrorTestSuites ?? 0, 0);
          reports.push(report);
          part.success = true;
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
      assertTests(combined, files, root);
      const raw = `${JSON.stringify(combined, null, 2)}\n`;
      writeFileSync(rawPath, raw, { flag: "wx" });
      result.rawSha256 = hash(raw);
      result.success = true;
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
