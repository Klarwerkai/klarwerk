#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessFindings, assessStage, policyHash } from "./release-ausnahmen.mjs";
import { releaseVertrag as contract } from "./release-vertrag.mjs";
export { policyHash } from "./release-ausnahmen.mjs";

export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const contractHash = hash(JSON.stringify(contract));
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const controls = {
  KLARWERK_SKIP_KEYCHAIN: "1",
  EXTERNAL_SEARCH: "off",
  NODE_ENV: "test",
  KLARWERK_DEV_PERSIST: "0",
};
export function environment() {
  const names = [
    "PATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "USER",
    "LOGNAME",
    "SHELL",
  ];
  return {
    ...Object.fromEntries(names.filter((n) => process.env[n]).map((n) => [n, process.env[n]])),
    ...controls,
  };
}
export function git(root, ...args) {
  const run = spawnSync("git", args, { cwd: root, env: environment(), encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args[0]}: ${run.stderr}`);
  return run.stdout.trim();
}
export function selection(paths) {
  return [
    ...new Set([
      ...contract.causalTests,
      ...paths.filter(
        (p) =>
          /\.test\.tsx?$/.test(p) &&
          !p.endsWith(".integration.test.ts") &&
          !contract.deferredTests.some((d) => d.path === p),
      ),
    ]),
  ].sort();
}
export function deferredSelection(paths) {
  return contract.deferredTests.filter((d) => paths.includes(d.path));
}
export function integrationSelection(paths) {
  return paths.filter((p) => p.endsWith(".integration.test.ts")).sort();
}
export function stageCommand(stage, tests, output) {
  return stage.name === "test"
    ? [
        ...stage.command,
        ...tests,
        "--config",
        "vitest.config.ts",
        "--allowOnly=false",
        "--pool=forks",
        "--minWorkers=1",
        "--maxWorkers=1",
        "--poolOptions.forks.minForks=1",
        "--poolOptions.forks.maxForks=1",
        "--no-file-parallelism",
        "--testTimeout=60000",
        "--reporter=default",
        "--reporter=json",
        `--outputFile=${join(output, "tests.json")}`,
      ]
    : stage.command;
}
export function assertTests(report, tests, root) {
  const files = report.testResults ?? [];
  const assertions = files.flatMap((f) => f.assertionResults ?? []);
  assert(
    tests.length > 0 && files.length === tests.length,
    "leere oder unvollständige Testauswahl",
  );
  assert(same(files.map((f) => resolve(f.name)).sort(), tests.map((p) => resolve(root, p)).sort()));
  assert(assertions.length > 0 && report.success === true);
  assert.equal(report.numTotalTests, assertions.length);
  assert.equal(report.numPassedTests, assertions.length);
  assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests ?? 0, 0);
  assert(files.every((f) => f.status === "passed" && f.assertionResults.length > 0));
  assert(assertions.every((a) => a.status === "passed" && a.failureMessages.length === 0));
}
export function assertProof(proof, tree) {
  assert.equal(proof.version, contract.version);
  assert.equal(proof.contractHash, contractHash);
  assert.equal(proof.tree, tree, "anderer geprüfter Baum");
  assert(proof.sourceUnchanged === true && proof.success === true);
  assert(/^[a-f0-9]{40}$/.test(proof.commit) && /^[a-f0-9]{40}$/.test(proof.base));
  assert(same(proof.tests, selection(proof.changedPaths)));
  assert(same(proof.integrationTests, integrationSelection(proof.changedPaths)));
  assert(same(proof.deferredTests, deferredSelection(proof.changedPaths)));
  assert.equal(proof.policyHash, policyHash);
  assert(
    assessFindings(proof.exceptions).accepted,
    "unbekannte, geänderte oder abgelaufene Ausnahme",
  );
  const began = Date.parse(proof.startedAt);
  const ended = Date.parse(proof.endedAt);
  assert(ended >= began && ended - began <= contract.maxSeconds * 1000);
  assert.equal(proof.stages.length, contract.stages.length, "fehlende Pflichtstufe");
  let previous = began;
  for (const [i, stage] of contract.stages.entries()) {
    const actual = proof.stages[i];
    assert.equal(actual.name, stage.name);
    assert(same(actual.command, stageCommand(stage, proof.tests, proof.output)));
    const approvedExit =
      actual.exit === 0 ||
      (["lint", "architecture"].includes(stage.name) &&
        actual.exit === 1 &&
        actual.approvedExceptions?.length > 0);
    assert(approvedExit && actual.success === true && actual.sourceUnchanged === true);
    const start = Date.parse(actual.startedAt);
    const end = Date.parse(actual.endedAt);
    assert(start >= previous && end >= start && end <= ended && end - start <= 240000);
    assert(/^[a-f0-9]{64}$/.test(actual.logSha));
    previous = end;
  }
  assertTests(proof.testReport, proof.tests, proof.root);
}
export function assertEvidence(proof) {
  for (const stage of proof.stages) {
    const log = readFileSync(stage.log);
    assert.equal(hash(log), stage.logSha, "verändertes Laufprotokoll");
    const assessment = assessStage(stage.name, stage.exit, log.toString("utf8"), proof.root);
    assert(assessment.accepted, "neue, geänderte oder abgelaufene Diagnose");
    assert(same(assessment.approved, stage.approvedExceptions ?? []));
  }
  assert.equal(hash(readFileSync(proof.testReportPath)), proof.testReportSha);
  assert(same(JSON.parse(readFileSync(proof.testReportPath, "utf8")), proof.testReport));
}
export function runRelease(root, base, output) {
  assert.equal(
    git(root, "status", "--porcelain=v1", "--untracked-files=all"),
    "",
    "Quelle muss committet sein",
  );
  const commit = git(root, "rev-parse", "HEAD");
  const tree = git(root, "rev-parse", "HEAD^{tree}");
  const changedPaths = git(root, "diff", "--name-only", "--diff-filter=ACMR", base, commit)
    .split("\n")
    .filter(Boolean);
  const tests = selection(changedPaths);
  const startedAt = new Date().toISOString();
  const limit = Date.now() + contract.maxSeconds * 1000;
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "einmaliger-start.txt"), `${commit} ${tree}\n`, { flag: "wx" });
  const proof = {
    version: contract.version,
    contractHash,
    root,
    output,
    base,
    commit,
    tree,
    changedPaths,
    tests,
    integrationTests: integrationSelection(changedPaths),
    deferredTests: deferredSelection(changedPaths),
    policyHash,
    writer:
      process.env.GITHUB_ACTIONS === "true"
        ? "github-actions:Pflichtprüfung"
        : git(root, "var", "GIT_AUTHOR_IDENT").replace(/ \d+ [+-]\d+$/, ""),
    startedAt,
    stages: [],
    exceptions: [],
    success: false,
  };
  try {
    for (const stage of contract.stages) {
      const command = stageCommand(stage, tests, output);
      const start = new Date().toISOString();
      console.log(
        JSON.stringify({ event: "stage-invocation", name: stage.name, at: start, command }),
      );
      const run = spawnSync("bash", ["tools/browserdeckel.sh", "smoke", ...command], {
        cwd: root,
        env: environment(),
        encoding: "utf8",
        timeout: Math.min(240000, Math.max(1, limit - Date.now())),
        killSignal: "SIGTERM",
        maxBuffer: 32 * 1024 * 1024,
      });
      const log = join(output, `${stage.name}.log`);
      const body = `${run.stdout ?? ""}${run.stderr ?? ""}`;
      writeFileSync(log, body, { flag: "wx" });
      const sourceUnchanged =
        git(root, "rev-parse", "HEAD") === commit &&
        git(root, "status", "--porcelain=v1", "--untracked-files=all") === "";
      const actual = {
        name: stage.name,
        command,
        startedAt: start,
        endedAt: new Date().toISOString(),
        exit: run.status,
        success: false,
        actualPid: run.pid ?? null,
        actualWaitCompleted: true,
        signal: run.signal,
        controls,
        sourceUnchanged,
        log,
        logSha: hash(body),
      };
      proof.stages.push(actual);
      console.log(
        JSON.stringify({
          event: "stage-wait-completed",
          name: actual.name,
          actualPid: actual.actualPid,
          exit: actual.exit,
          endedAt: actual.endedAt,
        }),
      );
      const assessment = assessStage(stage.name, run.status, body, root);
      actual.success = assessment.accepted && !run.error;
      actual.approvedExceptions = assessment.approved;
      actual.rejectedDiagnostics = assessment.rejected;
      proof.exceptions.push(...assessment.approved);
      assert(
        actual.success && sourceUnchanged && Date.now() <= limit,
        `Pflichtstufe ${stage.name} rot oder Quelle geändert`,
      );
      if (stage.name === "test") {
        proof.testReportPath = join(output, "tests.json");
        proof.testReport = JSON.parse(readFileSync(proof.testReportPath, "utf8"));
        assertTests(proof.testReport, tests, root);
        proof.testReportSha = hash(readFileSync(proof.testReportPath));
      }
    }
    proof.sourceUnchanged = true;
    proof.success = true;
  } catch (error) {
    proof.error = error.message;
  }
  proof.endedAt = new Date().toISOString();
  proof.approvalBasis =
    proof.exceptions.length > 0 ? "specific_temporary_exceptions" : "no_exceptions";
  proof.deferred = contract.deferred.map((d) => ({
    ...d,
    due: new Date(Date.parse(startedAt) + d.withinHours * 3600000).toISOString(),
  }));
  writeFileSync(join(output, "pflicht.json"), `${JSON.stringify(proof, null, 2)}\n`, {
    flag: "wx",
  });
  return proof;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  try {
    assert(
      process.argv[2] === "check" && process.argv[3] && process.argv[4],
      "release.mjs check <Basiscommit> <neuer Ergebnisordner>",
    );
    const proof = runRelease(root, process.argv[3], resolve(process.argv[4]));
    console.log(
      JSON.stringify({
        commit: proof.commit,
        tree: proof.tree,
        success: proof.success,
        error: proof.error,
        deferred: proof.deferred,
      }),
    );
    process.exitCode = proof.success ? 0 : 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
