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

// ==================================================================================================
// JOB 4010 — DIE ABLÖSUNG WIRD GEBUNDEN, NICHT NUR VOLLZOGEN.
// ==================================================================================================
//
// Bis JOB 4010 erklärte sich das Produkt an zwei Stellen selbst für nicht abnahmefähig
// (`restore-drill.sh:11-13`, `docs/operations/restore-drill.md:100-106`). Beide Stellen sind ersetzt.
// Ohne diesen Wächter könnte der Satz unbemerkt zurückkehren — oder die Betriebsanleitung könnte
// das Ergebnis nennen, ohne den Befehl zu nennen, mit dem es entsteht (Auftrag §9).
//
// AUSDRÜCKLICH NICHT GEPRÜFT: `scripts/backup/RESTORE.md:100-102`. Dort steht dieselbe, jetzt
// falsche Aussage; die Datei liegt außerhalb der Zielpfade dieses Auftrags und bleibt deshalb
// unverändert. Ein Wächter darüber wäre hier sofort rot — er gehört in den Auftrag, der die Datei
// nachzieht. Diese Grenze steht so auch in der Rückgabe von JOB 4010.
it("Skript und Betriebsanleitung tragen keine Abnahmegrenze mehr und nennen ihre Belege", () => {
  const read = (path: string) => readFileSync(resolve(root, path), "utf8");
  for (const path of ["scripts/backup/restore-drill.sh", "docs/operations/restore-drill.md"]) {
    const text = read(path);
    expect(text, `${path} behauptet weiterhin eine offene Abnahmegrenze`).not.toMatch(
      /noch nicht abnahmef[äa]h/i,
    );
    // Der Beleg wird benannt, nicht behauptet.
    expect(text).toContain("prozesszuordnung.test.ts");
    expect(text).toContain("echter-wiederanlauf.integration.test.ts");
  }
  const anleitung = read("docs/operations/restore-drill.md");
  // Nicht nur das Ergebnis, sondern die Bedingung, unter der es entsteht.
  expect(anleitung).toContain("KLARWERK_PG_TEST_URL=");
  expect(anleitung).toContain("npx vitest run --config vitest.integration.config.ts");
  // Der Skip bleibt sichtbar — ein stiller Skip sähe aus wie ein bestandener Lauf.
  expect(anleitung).toContain("sichtbar auf stderr");
});
