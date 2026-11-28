import { describe, expect, it } from "vitest";
import { run } from "./drill-probe";

describe("Restore-Drill: Messbarkeit und Startvoraussetzungen", () => {
  it.each(["extract-error", "truncated", "doppelblock", "query-error"])(
    "unmessbare Zählung (%s) scheitert geschlossen",
    (mode) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(24);
      expect(r.output).toMatch(/ABBRUCH \(24\):[^\n]*ko_evidence/);
      expect(r.start).toBe("");
    },
    120_000,
  );
  it("ein unlesbares Inhaltsverzeichnis ist nicht messbar, nicht leer", () => {
    const r = run("toc-error");
    expect(r.code, r.output).toBe(24);
    expect(r.output).toContain("Inhaltsverzeichnis des Dumps nicht lesbar");
    expect(r.start).toBe("");
  }, 120_000);
  it("fehlendes Startwerkzeug hat eigenen Exitcode", () => {
    const r = run("tool-missing");
    expect(r.code, r.output).toBe(31);
    expect(r.output).toContain("ABBRUCH (31)");
    expect(r.start).toBe("");
  }, 120_000);
  it.each([
    ["no-sidecar", 10],
    ["bad-sidecar", 11],
    ["occupied", 20],
  ] as const)(
    "%s verhindert jeden pg_restore-Aufruf",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.calls).not.toContain('"pg_restore"');
    },
    120_000,
  );
});
