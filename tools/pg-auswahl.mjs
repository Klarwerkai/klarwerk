#!/usr/bin/env node
// Nur der bestehende CI-Integrationsweg führt diese Auswahl aus; lokal nur Quellenmetadaten.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertTests, environment, git, hash, integrationSelection } from "./release.mjs";

export function pgSelection(paths) {
  return integrationSelection(paths);
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
  };
  try {
    if (files.length > 0) {
      const rawPath = join(output, "pg.vitest.json");
      const command = [
        "./node_modules/.bin/vitest",
        "run",
        ...files,
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
        `--outputFile=${rawPath}`,
      ];
      const run = spawnSync("bash", ["tools/browserdeckel.sh", "smoke", ...command], {
        cwd: root,
        env: { ...environment(), KLARWERK_PG_PFLICHT: "1" },
        encoding: "utf8",
        timeout: 240000,
        maxBuffer: 32 * 1024 * 1024,
      });
      result.command = command;
      result.exit = run.status;
      writeFileSync(join(output, "pg.log"), `${run.stdout ?? ""}${run.stderr ?? ""}`, {
        flag: "wx",
      });
      assert.equal(run.status, 0);
      const raw = readFileSync(rawPath);
      assertTests(JSON.parse(raw), files, root);
      result.rawSha256 = hash(raw);
      result.success = true;
    }
  } catch (error) {
    result.error = error.message;
  }
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
