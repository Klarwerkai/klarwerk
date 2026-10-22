// Eng befristete, einzeln gebundene Bestandsdiagnosen. Keine Regel wird abgeschaltet.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const hash = (value) => createHash("sha256").update(value).digest("hex");
export const policy = JSON.parse(
  readFileSync(new URL("./release-ausnahmen.json", import.meta.url), "utf8"),
);
export const policyHash = hash(JSON.stringify(policy));
export const EXCEPTION_DEADLINE = "2026-10-23T18:00:00Z";

export function reportJson(text) {
  const start = text.indexOf("{");
  assert(start >= 0, "vollständiger Maschinenbericht fehlt");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return JSON.parse(text.slice(start, index + 1));
  }
  throw new Error("unvollständiger Maschinenbericht");
}

export function findingsFor(stage, report, root) {
  if (stage === "lint") {
    assert(report.summary?.diagnosticsNotPrinted === 0, "Lintdiagnosen fehlen");
    const diagnostics = report.diagnostics ?? [];
    assert.equal(
      report.summary.errors,
      diagnostics.filter((d) => ["error", "fatal"].includes(d.severity)).length,
    );
    return diagnostics.map((diagnostic) => {
      const path = relative(root, resolve(root, diagnostic.location.path.file))
        .split(sep)
        .join("/");
      const detail = [
        diagnostic.severity,
        diagnostic.description,
        diagnostic.location.span,
        hash(diagnostic.location.sourceCode ?? readFileSync(resolve(root, path))),
      ];
      return {
        stage,
        path,
        rule: diagnostic.category,
        fingerprint: hash(JSON.stringify([stage, path, diagnostic.category, detail])),
      };
    });
  }
  assert.equal(stage, "architecture");
  const violations = report.summary?.violations;
  assert(Array.isArray(violations), "Architekturdiagnosen fehlen");
  assert.equal(report.summary.error, violations.filter((v) => v.rule.severity === "error").length);
  return violations.map((violation) => {
    const path = violation.from;
    const detail = [
      violation.rule.severity,
      violation.type,
      violation.to,
      (violation.cycle ?? []).map((c) => [c.name, [...c.dependencyTypes].sort()]),
    ];
    return {
      stage,
      path,
      rule: violation.rule.name,
      fingerprint: hash(JSON.stringify([stage, path, violation.rule.name, detail])),
    };
  });
}

export function assessFindings(findings, rules = policy, now = Date.now()) {
  assert(rules.version === 1 && Array.isArray(rules.entries));
  const remaining = [...rules.entries];
  const approved = [];
  const rejected = [];
  for (const finding of findings) {
    const index = remaining.findIndex(
      (entry) =>
        entry.stage === finding.stage &&
        entry.path === finding.path &&
        entry.rule === finding.rule &&
        entry.fingerprint === finding.fingerprint,
    );
    const entry = index < 0 ? undefined : remaining.splice(index, 1)[0];
    if (
      !entry ||
      entry.owner !== "Root" ||
      typeof entry.reason !== "string" ||
      entry.reason.length < 20 ||
      entry.expires !== EXCEPTION_DEADLINE ||
      Date.parse(entry.expires) <= now
    ) {
      rejected.push(finding);
    } else approved.push(entry);
  }
  return { accepted: rejected.length === 0, approved, rejected };
}

export function assessStage(stage, exit, text, root, now = Date.now()) {
  if (!["lint", "architecture"].includes(stage))
    return { accepted: exit === 0, approved: [], rejected: [] };
  assert([0, 1].includes(exit), "Diagnosewerkzeug wurde nicht ordnungsgemäß ausgeführt");
  const report = reportJson(text);
  const findings = findingsFor(stage, report, root);
  assert(exit === 0 || findings.length > 0, "roter Lauf ohne konkrete Diagnose");
  return { ...assessFindings(findings, policy, now), count: findings.length };
}
