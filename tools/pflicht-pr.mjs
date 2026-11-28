#!/usr/bin/env node
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessFindings } from "./release-ausnahmen.mjs";
import { releaseVertrag } from "./release-vertrag.mjs";
import {
  assertStageEvidence,
  assertStages,
  controls,
  hash,
  releaseInputs,
  runStages,
} from "./release.mjs";

// Bei 64 Dateien blieben dem Einzelrunner unter 4 Sekunden pro Datei inklusive Vitest-Start.
// Höchstens 16 pro Teil lassen im Normalfall 15 Sekunden pro Datei. Eine langsame Einzeldatei
// bleibt der 240-Sekunden-Grenze unterworfen. GitHub gestattet maximal 256 Matrixjobs.
const EINZELGRENZE = 64;
const DATEIEN_PRO_TEIL = 16;

export function aufteilung(tests) {
  assert(tests.length > 0 && new Set(tests).size === tests.length, "Testauswahl leer oder doppelt");
  if (tests.length < EINZELGRENZE) return [];
  const anzahl = Math.min(255, Math.ceil(tests.length / DATEIEN_PRO_TEIL));
  const teile = Array.from({ length: anzahl }, (_, i) => ({ id: `test-${i + 1}`, tests: [] }));
  tests.forEach((test, i) => teile[i % anzahl].tests.push(test));
  return [{ id: "vorstufen", tests: [] }, ...teile];
}

function stufen(teil) {
  return releaseVertrag.stages.filter((s) => (s.name === "test") === (teil.id !== "vorstufen"));
}

export function prPlan(inputs) {
  return {
    typ: "pr-pflichtplan-v1",
    ...inputs,
    ueberlappung: inputs.changedPaths.filter((p) => releaseVertrag.causalTests.includes(p)),
    teile: aufteilung(inputs.tests),
  };
}
function schreiben(pfad, daten) {
  writeFileSync(pfad, `${JSON.stringify(daten, null, 2)}\n`, { flag: "wx" });
}

export function pruefeTeil(plan, teil, pruefung, ordner) {
  assert.equal(pruefung.typ, "pr-pflichtteil-v1");
  assert.equal(pruefung.planSha, hash(JSON.stringify(plan)), "anderer Plan oder Commit");
  assert.equal(pruefung.commit, plan.commit);
  assert.equal(pruefung.tree, plan.tree);
  assert.equal(pruefung.id, teil.id);
  assert.deepEqual(pruefung.tests, teil.tests);
  assert(
    pruefung.success === true && pruefung.sourceUnchanged === true,
    pruefung.error || "Teil fehlgeschlagen",
  );
  assertStages(pruefung, stufen(teil));
  for (const s of pruefung.stages) {
    assert(s.actualWaitCompleted && Number.isInteger(s.actualPid) && s.actualPid > 0);
    assert.equal(s.signal, null);
    assert.deepEqual(s.controls, controls);
  }
  assert.deepEqual(
    pruefung.exceptions,
    pruefung.stages.flatMap((s) => s.approvedExceptions),
  );
  assert(assessFindings(pruefung.exceptions).accepted);
  assertStageEvidence(pruefung, ordner, teil.id !== "vorstufen");
}

export function laufzustand(verteilt, planErgebnis, matrixErgebnis) {
  assert.equal(planErgebnis, "success", "PR-Auswahl fehlt oder ist fehlgeschlagen");
  assert.equal(
    matrixErgebnis,
    verteilt ? "success" : "skipped",
    "unerwartetes Ergebnis der PR-Matrix",
  );
}

export function sammle(plan, eingang, matrixErgebnis) {
  assert(plan.teile.length > 0, "ein Einzelvertrag braucht einen vollständigen Releasebeleg");
  const fehler = [];
  const teile = [];
  const namen = plan.teile.map((teil) => `pflicht-pr-${plan.commit}-${teil.id}`);
  try {
    assert.deepEqual(
      readdirSync(eingang).sort(),
      [...namen].sort(),
      "Teilbelege fehlen oder sind unerwartet",
    );
  } catch (error) {
    fehler.push(error.message);
  }
  for (const [i, teil] of plan.teile.entries()) {
    const ordner = join(eingang, namen[i]);
    try {
      const raw = readFileSync(join(ordner, "teil.json"));
      const pruefung = JSON.parse(raw);
      pruefeTeil(plan, teil, pruefung, ordner);
      teile.push({
        id: teil.id,
        sha256: hash(raw),
        dateien: teil.tests.length,
        faelle: pruefung.testReport?.numPassedTests ?? 0,
      });
    } catch (error) {
      fehler.push(`${teil.id}: ${error.message}`);
    }
  }
  if (matrixErgebnis !== "success") fehler.push(`GitHub-Matrix: ${matrixErgebnis}`);
  return { typ: "pr-pflichtbericht-v1", plan, teile, fehler, success: fehler.length === 0 };
}

function cli([befehl, base, ordnerArg, teilId]) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  assert.equal(process.env.GITHUB_EVENT_NAME, "pull_request", "nur für Pull Requests");
  assert(/^[0-9a-f]{40}$/.test(base) && /^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA));
  const plan = prPlan(releaseInputs(root, base));
  assert.equal(plan.commit, process.env.GITHUB_SHA, "Checkout ist nicht der GitHub-Commit");
  const verteilt = plan.teile.length > 0;
  const output = resolve(ordnerArg);
  if (befehl === "plan") {
    mkdirSync(output, { recursive: true });
    schreiben(join(output, "auswahl.json"), plan);
    const matrix = { teil: verteilt ? plan.teile.map((teil) => teil.id) : ["einzeln"] };
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `verteilt=${verteilt}\nmatrix=${JSON.stringify(matrix)}\n`,
    );
    console.log(
      `${plan.tests.length} Pflichtdateien, ${plan.ueberlappung.length} Überschneidungen, ${matrix.teil.join(", ")}`,
    );
  } else if (befehl === "teil") {
    const teil = plan.teile.find((t) => t.id === teilId);
    assert(teil, "unbekannter PR-Teil");
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, "einmaliger-start.txt"), `${plan.commit} ${teil.id}\n`, {
      flag: "wx",
    });
    const pruefung = {
      typ: "pr-pflichtteil-v1",
      id: teil.id,
      planSha: hash(JSON.stringify(plan)),
      root,
      output,
      commit: plan.commit,
      tree: plan.tree,
      tests: teil.tests,
      startedAt: new Date().toISOString(),
      stages: [],
      exceptions: [],
      success: false,
    };
    runStages(pruefung, stufen(teil));
    schreiben(join(output, "teil.json"), pruefung);
    assert(pruefung.success, pruefung.error);
    pruefeTeil(plan, teil, pruefung, output);
  } else {
    assert.equal(befehl, "abschluss");
    assert.notEqual(process.env.LAUF_ABGEBROCHEN, "true", "GitHub-Lauf abgebrochen");
    mkdirSync(output, { recursive: true });
    assert.equal(process.env.PLAN_ERGEBNIS, "success", "PR-Auswahl fehlt oder ist fehlgeschlagen");
    assert.equal(
      process.env.PLAN_VERTEILT,
      String(verteilt),
      "PR-Auswahl stimmt nicht mit Checkout überein",
    );
    if (verteilt) {
      const bericht = sammle(plan, join(output, "teile"), process.env.MATRIX_ERGEBNIS);
      schreiben(join(output, "pr-pflichtbericht.json"), bericht);
      assert(bericht.success, bericht.fehler.join("\n"));
    }
    laufzustand(verteilt, process.env.PLAN_ERGEBNIS, process.env.MATRIX_ERGEBNIS);
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
