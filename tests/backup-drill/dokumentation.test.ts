import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
it("Skript und beide Anleitungen führen denselben eindeutigen Exitcodesatz und Startweg", () => {
  const read = (path: string) => readFileSync(resolve(root, path), "utf8");
  const script = read("scripts/backup/restore-drill.sh");
  const codes = [...script.matchAll(/^#\s+(\d+)\s+/gm)].map((match) => Number(match[1]));
  expect(codes).toEqual([0, 1, 10, 11, 20, 21, 22, 23, 24, 30, 31, 60, 61, 70, 71, 72, 80]);
  for (const path of ["scripts/backup/RESTORE.md", "docs/operations/restore-drill.md"]) {
    const doc = read(path);
    expect([...doc.matchAll(/^\| `(\d+)` \|/gm)].map((match) => Number(match[1]))).toEqual(codes);
    expect(doc).toContain("npx tsx services/app/src/server.ts");
    for (const table of ["kos", "users", "audit", "objects"]) expect(doc).toContain(`\`${table}\``);
  }
  expect(script).toContain("npx tsx services/app/src/server.ts");
});
