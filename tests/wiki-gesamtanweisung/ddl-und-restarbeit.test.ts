// ================================================================================================
// JOB 4154 · DIE DDL — UND DIE BENANNTE RESTARBEIT DES NACHFOLGERS.
// ================================================================================================
//
// Der Auftrag verlangt eine ausdrückliche, begründete Abweichung: die DDL der Anweisung wird in
// DIESEM Durchgang NICHT als `export const …_SCHEMA` geführt, weil `db.migrate.test.ts:47-60` dann
// einen Eintrag in `services/app/src/db.ts` verlangt — und diese Datei gehört JOB 4151.
//
// EINE ABWEICHUNG, DIE NUR IN EINER RÜCKGABE STEHT, IST EIN ZETTEL. Diese Fälle machen sie
// prüfbar: Sie halten fest, dass die Konstante wirklich da ist, wirklich ausgeführt wird, wirklich
// additiv ist — und dass der Migrationswächter durch diese Lieferung NICHT rot wird. Wer die
// Konstante später exportiert, ohne sie in `migrate()` einzutragen, fällt bei `db.migrate.test.ts`
// auf; wer sie stattdessen umbenennt, um den Wächter zu umgehen, fällt hier auf.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REPO_QUELLE = readFileSync(
  "services/knowledge-object/src/gesamtanweisung-repo-pg.ts",
  "utf8",
);

/** Der Rumpf der Konstante, so wie er wirklich ausgeführt wird. */
function ddl(): string {
  const treffer = /const GESAMTANWEISUNG_TABELLEN_DDL\s*=\s*`([\s\S]*?)`/.exec(REPO_QUELLE);
  expect(treffer?.[1], "die DDL-Konstante ist nicht auffindbar").toBeTruthy();
  return treffer?.[1] ?? "";
}

describe("JOB 4154 · die DDL steht bereit, ohne den Migrationswächter zu umgehen", () => {
  it("sie ist modulintern — kein `export const …_SCHEMA` in dieser Lieferung", () => {
    // Genau das Muster, das `db.migrate.test.ts:47` sammelt.
    const exportiert = [...REPO_QUELLE.matchAll(/export const (\w+_SCHEMA)\s*=\s*`/g)].map(
      (m) => m[1],
    );
    expect(
      exportiert,
      "eine exportierte *_SCHEMA-Konstante verlangt einen Eintrag in services/app/src/db.ts — die Datei gehört JOB 4151",
    ).toEqual([]);
    expect(REPO_QUELLE).toContain("const GESAMTANWEISUNG_TABELLEN_DDL");
  });

  it("sie ist nicht tot: `migriere()` führt sie wirklich aus", () => {
    // Ohne diesen Fall wäre die Konstante genau der Fehler, den der Aufrufer-Wächter beschreibt:
    // gebaut, richtig, und wirkungslos.
    expect(REPO_QUELLE).toMatch(/async migriere\(\)[\s\S]*GESAMTANWEISUNG_TABELLEN_DDL/);
  });

  it("sie legt genau die drei Tabellen der Lieferung an", () => {
    const rumpf = ddl();
    for (const tabelle of [
      "gesamtanweisungen",
      "gesamtanweisung_bausteine",
      "gesamtanweisung_staende",
    ]) {
      expect(rumpf).toContain(`CREATE TABLE IF NOT EXISTS ${tabelle}`);
    }
  });

  it("sie ist additiv: kein DROP, kein TRUNCATE, kein UPDATE, kein DELETE", () => {
    const rumpf = ddl();
    expect(rumpf).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX)/i);
    expect(rumpf).not.toMatch(/TRUNCATE/i);
    expect(rumpf).not.toMatch(/UPDATE\s+/i);
    expect(rumpf).not.toMatch(/DELETE\s+FROM/i);
  });

  it("sie ist wiederholbar: jede Stufe trägt IF NOT EXISTS", () => {
    const rumpf = ddl();
    const anlagen = rumpf.match(/CREATE\s+(TABLE|INDEX)/gi) ?? [];
    const abgesichert = rumpf.match(/CREATE\s+(TABLE|INDEX)\s+IF NOT EXISTS/gi) ?? [];
    expect(abgesichert.length).toBe(anlagen.length);
  });

  it("die Spalte heisst `pos` — `position` wäre in PostgreSQL ein Schlüsselwort", () => {
    const rumpf = ddl();
    expect(rumpf).toMatch(/\n\s+pos int NOT NULL/);
    expect(rumpf).not.toMatch(/\n\s+position\s/i);
  });

  it("die Restarbeit ist im Quelltext NAMENTLICH benannt, nicht nur in einer Rückgabe", () => {
    expect(REPO_QUELLE).toContain("WIKI-GESAMTANWEISUNG-ANSCHLUSS");
    expect(REPO_QUELLE).toContain("GESAMTANWEISUNG_SCHEMA");
    expect(REPO_QUELLE).toContain("migrate()");
  });

  it("die Route ist als Plugin da, aber `build-app.ts` bleibt in dieser Lieferung unberührt", () => {
    const buildApp = readFileSync("services/app/src/build-app.ts", "utf8");
    expect(buildApp).not.toContain("gesamtanweisung");
    const index = readFileSync("services/knowledge-object/index.ts", "utf8");
    expect(index).not.toContain("gesamtanweisung");
    const db = readFileSync("services/app/src/db.ts", "utf8");
    expect(db).not.toContain("GESAMTANWEISUNG");
  });
});
