#!/usr/bin/env node
// Regulärer Ship-Weg. Nur explizite Unterbefehle wirken; status liest ausschließlich.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseVertrag as contract } from "./release-vertrag.mjs";
import {
  assertEvidence,
  assertProof,
  environment,
  git,
  hash,
  integrationSelection,
  same,
  selection,
} from "./release.mjs";

export const metadataRule =
  "Metadatenregel: ein Child, identischer Baum, unveränderte Identitäten und echte Trailer.";
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const save = (path, data, flag = "w") =>
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { flag });
export function assertReview(review, commit, tree, proofSha, writer) {
  assert(
    review.completed === true && review.exit === 0 && review.decision === "APP0",
    "kein abgeschlossenes unabhängiges APP0",
  );
  assert.equal(review.commit, commit);
  assert.equal(review.tree, tree);
  assert.equal(review.proofSha, proofSha);
  assert(typeof review.reviewer === "string" && /^ben:/.test(review.reviewer));
  assert(
    review.reviewer !== writer && review.writer === writer,
    "Reviewer und Autor müssen unabhängig sein",
  );
  assert.equal(
    hash(readFileSync(review.evidence)),
    review.evidenceSha,
    "Urteilsoriginal fehlt oder geändert",
  );
  const original = readFileSync(review.evidence, "utf8");
  assert(/\bAPP0\b/.test(original), "Original enthält kein APP0");
  assert(
    review.allowAttestationChild === true && original.includes(metadataRule),
    "Urteil deckt den engen Attestierungschild nicht ab",
  );
}
export function assertCi(data, commit) {
  for (const name of [contract.ciJob, "integration"]) {
    const runs = (data.check_runs ?? []).filter(
      (r) => r.name === name && r.head_sha === commit && r.app?.slug === "github-actions",
    );
    runs.sort((a, b) => b.id - a.id);
    assert(
      runs.length > 0 && runs[0].status === "completed" && runs[0].conclusion === "success",
      `aktueller CI-Pflichtjob ${name} des exakten Commit nicht grün`,
    );
  }
}
function command(root, program, args) {
  const result = spawnSync(program, args, {
    cwd: root,
    env: environment(),
    encoding: "utf8",
    timeout: 240000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, `${program}: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function checked(root, proofPath) {
  const proof = read(proofPath);
  const commit = git(root, "rev-parse", "HEAD");
  const tree = git(root, "rev-parse", "HEAD^{tree}");
  assert.equal(git(root, "status", "--porcelain=v1", "--untracked-files=all"), "");
  assertProof(proof, tree);
  assertEvidence(proof);
  assert.equal(git(root, "rev-parse", `${proof.commit}^{tree}`), tree);
  const changed = git(root, "diff", "--name-only", "--diff-filter=ACMR", proof.base, proof.commit)
    .split("\n")
    .filter(Boolean);
  assert(
    same(changed, proof.changedPaths) &&
      same(selection(changed), proof.tests) &&
      same(integrationSelection(changed), proof.integrationTests),
    "Testauswahl stimmt nicht mit echtem Gitdiff überein",
  );
  const writer = git(root, "var", "GIT_AUTHOR_IDENT").replace(/ \d+ [+-]\d+$/, "");
  const committer = git(root, "var", "GIT_COMMITTER_IDENT").replace(/ \d+ [+-]\d+$/, "");
  assert(
    /^Codex\b/.test(writer) && writer === committer && writer === proof.writer,
    "wahrheitsgemäße Codex-Rollenidentität erforderlich",
  );
  if (commit !== proof.commit) {
    assert.equal(
      git(root, "rev-parse", "HEAD^"),
      proof.commit,
      "nur ein baumgleicher Attestierungscommit zulässig",
    );
    const message = git(root, "log", "-1", "--format=%B");
    assert(message.includes(`Tor-Ergebnis: ${hash(readFileSync(proofPath))}`));
    const attestationPath = resolve(dirname(proofPath), "attestierung-urteil.json");
    assertReview(read(attestationPath), proof.commit, tree, hash(readFileSync(proofPath)), writer);
    assert(message.includes(`Tor-Baum: ${tree}`));
    assert(message.includes(`Review-Ergebnis: ${hash(readFileSync(attestationPath))}`));
    assert.equal(git(root, "log", "-1", "--format=%an <%ae>%n%cn <%ce>"), `${writer}\n${writer}`);
  }
  return { proof, commit, tree, writer, proofSha: hash(readFileSync(proofPath)) };
}
export async function publishMain(root, args) {
  const [mode, path, proofPath, reviewPath, repository] = args;
  if (mode === "attest") {
    const current = checked(root, path);
    assert.equal(current.commit, current.proof.commit);
    const review = read(proofPath);
    assertReview(review, current.commit, current.tree, current.proofSha, current.writer);
    writeFileSync(resolve(dirname(path), "attestierung-urteil.json"), readFileSync(proofPath), {
      flag: "wx",
    });
    const message = `KLARWERK Ship: Pflichtvertrag tatsächlich grün\n\nTor-Ergebnis: ${current.proofSha}\nTor-Baum: ${current.tree}\nReview-Ergebnis: ${hash(readFileSync(proofPath))}\n`;
    const messagePath = resolve(dirname(path), "attestierung.txt");
    writeFileSync(messagePath, message, { flag: "wx" });
    git(root, "commit", "--allow-empty", "-F", messagePath);
    assert.equal(git(root, "rev-parse", "HEAD^{tree}"), current.tree);
    return;
  }
  if (mode === "intent") {
    assert(/^[\w.-]+\/[\w.-]+$/.test(repository), "GitHub-Repository owner/name fehlt");
    const current = checked(root, proofPath);
    assert(current.commit !== current.proof.commit, "tatsächlicher Attestierungscommit fehlt");
    assertReview(
      read(reviewPath),
      current.proof.commit,
      current.tree,
      current.proofSha,
      current.writer,
    );
    save(
      path,
      {
        state: "prepared",
        createdAt: new Date().toISOString(),
        commit: current.commit,
        tree: current.tree,
        proofPath: resolve(proofPath),
        proofSha: current.proofSha,
        reviewPath: resolve(reviewPath),
        reviewSha: hash(readFileSync(reviewPath)),
        repository,
        transportDir: resolve(`${path}.p3`),
      },
      "wx",
    );
    return;
  }
  assert(
    ["push", "publish", "status"].includes(mode),
    "publish.mjs attest|intent|push|publish|status …",
  );
  const intent = read(path);
  if (mode === "status") {
    console.log(JSON.stringify(intent));
    if (intent.transportDir) {
      console.log(command(root, "python3", ["tools/publish-transport.py", "status", root, path]));
    }
    return;
  }
  const current = checked(root, intent.proofPath);
  assert.equal(current.commit, intent.commit);
  assert.equal(current.proofSha, intent.proofSha);
  assert.equal(hash(readFileSync(intent.reviewPath)), intent.reviewSha);
  assertReview(
    read(intent.reviewPath),
    current.proof.commit,
    current.tree,
    current.proofSha,
    current.writer,
  );
  const remote = git(root, "ls-remote", "github", "refs/heads/main").split(/\s/)[0];
  assert(/^[a-f0-9]{40}$/.test(remote));
  git(root, "merge-base", "--is-ancestor", remote, current.commit);
  if (mode === "push") {
    assert.equal(intent.state, "prepared");
    command(root, "bash", ["tools/abhaengigkeiten-audit.sh"]);
    writeFileSync(`${path}.push`, current.commit, { flag: "wx" });
    save(path, { ...intent, state: "push-started", at: new Date().toISOString() });
    git(root, "push", "github", `${current.commit}:refs/heads/main`);
    assert.equal(
      git(root, "ls-remote", "github", "refs/heads/main").split(/\s/)[0],
      current.commit,
    );
    save(path, { ...intent, state: "pushed", at: new Date().toISOString() });
  } else {
    assert.equal(
      intent.state,
      "pushed",
      "keine neue unversandte Absicht; unklaren Ausgang nur lesen",
    );
    assert.equal(remote, current.commit);
    assert(/^[\w.-]+\/[\w.-]+$/.test(intent.repository));
    const response = await fetch(
      `https://api.github.com/repos/${intent.repository}/commits/${current.commit}/check-runs?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Klarwerk-Release",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    assert(response.ok, `CI-Nachweis nicht lesbar: HTTP ${response.status}`);
    const ci = await response.json();
    assertCi(ci, current.commit);
    const result = JSON.parse(
      command(root, "python3", ["tools/publish-transport.py", "publish", root, path]),
    );
    save(path, {
      ...intent,
      state: result.sent ? "send-started" : "pushed",
      at: new Date().toISOString(),
      ci,
      transport: result,
    });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await publishMain(
      resolve(dirname(fileURLToPath(import.meta.url)), ".."),
      process.argv.slice(2),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
