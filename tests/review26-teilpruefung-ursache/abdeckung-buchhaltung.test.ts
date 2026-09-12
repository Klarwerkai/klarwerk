// Mutation: eine Klasse beim Merge fallen lassen oder Gründe als sechste Vollständigkeitsbedingung verlangen.
import { expect, it } from "vitest";
import {
  emptyCoverage,
  isCompleteRun,
  mergeCoverage,
  singleRunBalances,
} from "../../services/conflicts";
import { fixture } from "./fixture";

// Mutation: Klassen beim Merge überschreiben statt addieren → auth-Zähler rot.
// Unabhängig von den App-Adaptern, damit deren Fehler die Merge-Probe nicht verdecken.
it("Merge addiert wiederkehrende Klassen und erhält Klassen aus nur einem Lauf", () => {
  const a = {
    ...emptyCoverage(),
    available: 2,
    selected: 2,
    attempted: 2,
    skipped: 2,
    skippedReasons: { auth: 1, unreachable: 1 },
  };
  const b = { ...a, skippedReasons: { auth: 2 } };
  const expected = {
    available: 2,
    selected: 2,
    alreadyOpen: 0,
    attempted: 2,
    completed: 0,
    skipped: 4,
    skippedReasons: { auth: 3, unreachable: 1 },
    capped: false,
    aborted: false,
  };
  expect(mergeCoverage(a, b)).toEqual(expected);
  expect(mergeCoverage(b, a)).toEqual(expected);
});

it("jeder Einzellauf bilanziert seine Ausfälle; Merge summiert jede Klasse", async () => {
  const f = await fixture([
    new Error("ECONNREFUSED"),
    new SyntaxError("Unexpected token"),
    undefined,
  ]);
  const a = await f.detect("conflict");
  const b = await f.detect("duplicate");
  for (const c of [a, b]) {
    expect(singleRunBalances(c)).toBe(true);
    expect(c).toHaveProperty("skippedReasons", { unreachable: 1, "bad-response": 1 });
    const reasons = Reflect.get(c, "skippedReasons") as Record<string, number>;
    expect(Object.values(reasons).reduce((sum, count) => sum + count, 0)).toBe(c.skipped);
  }
  expect(mergeCoverage(a, b)).toEqual({
    available: 3,
    selected: 3,
    alreadyOpen: 0,
    attempted: 3,
    completed: 1,
    skipped: 4,
    skippedReasons: { unreachable: 2, "bad-response": 2 },
    capped: false,
    aborted: false,
  });
});

// Mutation: ein gültiges Nicht-Treffer-Urteil als skipped zählen → Vollform und Invariante rot.
it("echter Reasoner: drei gültige Urteile bleiben auf beiden Wegen vollständig", async () => {
  const f = await fixture(Array<undefined>(3).fill(undefined));
  for (const kind of ["conflict", "duplicate"] as const) {
    const coverage = await f.detect(kind);
    expect(f.calls[kind]).toBe(3);
    expect(coverage).toEqual({
      available: 3,
      selected: 3,
      alreadyOpen: 0,
      attempted: 3,
      completed: 3,
      skipped: 0,
      skippedReasons: {},
      capped: false,
      aborted: false,
    });
    expect(isCompleteRun(coverage)).toBe(true);
  }
});
it("leerer Pool hat keine Gründe und die fünf Bedingungen bleiben allein maßgeblich", async () => {
  const empty = emptyCoverage();
  expect(empty).toHaveProperty("skippedReasons", {});
  expect(isCompleteRun(Object.assign(empty, { skippedReasons: { auth: 1 } }))).toBe(true);
  const f = await fixture();
  expect(await f.detect("duplicate")).toEqual(emptyCoverage());
  expect((await f.run()).fallbackReason).toBeUndefined();
});

// Mutation: Kapazitätsfehler wie einen Providerfehler zählen → terminale Buchhaltung rot.
it("Duplikat-Kapazitätsabbruch bleibt terminal, zählt keine Providerklasse und wirft nicht ins Submit", async () => {
  const { ModelCapacityError } = await import("../../services/reasoner");
  const f = await fixture(
    [undefined, undefined, new ModelCapacityError("busy"), ...Array<undefined>(5).fill(undefined)],
    false,
    "duplicate",
  );
  const coverage = await f.detect("duplicate");
  expect(f.calls.duplicate).toBe(3);
  expect(coverage).toEqual({
    available: 8,
    selected: 3,
    alreadyOpen: 0,
    attempted: 3,
    completed: 2,
    skipped: 0,
    aborted: true,
    capped: true,
    skippedReasons: {},
  });
  expect(isCompleteRun(coverage)).toBe(false);
  expect(singleRunBalances(coverage)).toBe(true);
});
