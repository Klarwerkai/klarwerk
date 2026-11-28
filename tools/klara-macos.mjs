import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { KLARA_MACOS_TESTS, aufMacGeprueft } from "../tests/tor-inventar/klara-macos.ts";

if (process.argv[2] === "--nachweis") {
  assert.deepEqual(
    aufMacGeprueft(),
    KLARA_MACOS_TESTS,
    "Die beiden nativen Klara-Fälle sind für diesen Checkout nicht erfolgreich auf macOS belegt.",
  );
} else {
  const { assertTests, git } = await import("./release.mjs");
  assert.equal(process.platform, "darwin", "Der native Klara-Nachweis braucht macOS.");
  const root = process.cwd();
  const commit = git(root, "rev-parse", "HEAD");
  if (process.env.GITHUB_ACTIONS === "true") {
    assert.equal(
      commit,
      process.env.GITHUB_SHA,
      "Der macOS-Checkout gehört zu einem anderen Lauf.",
    );
  }
  const dir = resolve(root, ".local/run/klara-macos");
  mkdirSync(dir, { recursive: true });
  const bericht = resolve(dir, "tests.json");
  rmSync(bericht, { force: true });
  execFileSync(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      ...KLARA_MACOS_TESTS,
      "--no-file-parallelism",
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${bericht}`,
    ],
    { stdio: "inherit" },
  );
  assertTests(JSON.parse(readFileSync(bericht, "utf8")), KLARA_MACOS_TESTS, root);
  assert.equal(commit, git(root, "rev-parse", "HEAD"));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `commit=${commit}\n`);
  }
}
