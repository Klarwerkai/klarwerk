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
//
// ------------------------------------------------------------------------------------------------
// JOB 4156 R2 · DIE RESTARBEIT IST NOCH IMMER OFFEN — und das ist jetzt gemessen, nicht vermutet.
// ------------------------------------------------------------------------------------------------
// Der Anschluss-Auftrag hat Dienst, Ablage und Routen-Plugin verdrahtet, die DDL aber NICHT
// exportieren dürfen: diese Datei liegt ausserhalb seiner Zielpfade. Runde 1 hat sie umbenannt und
// wurde dafür zurückgewiesen; die Umbenennung ist zurückgenommen. Der letzte Fall unten hält
// deshalb BEIDES fest — was inzwischen verdrahtet IST und was weiterhin fehlt.
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

  // ------------------------------------------------------------------------------------------------
  // JOB 4156 R2 · WAS DER ANSCHLUSS ERREICHT HAT — UND WO ER STEHEN GEBLIEBEN IST.
  // ------------------------------------------------------------------------------------------------
  //
  // Hier stand bis JOB 4154 der Fall „die Route ist als Plugin da, aber `build-app.ts` bleibt in
  // dieser Lieferung unberührt" mit drei `not.toContain`. Zwei davon treffen nicht mehr zu: die
  // Kompositionswurzel registriert das Plugin, und die Modulfassade nennt Dienst und Ablage. Der
  // dritte trifft weiterhin — die DDL wird NICHT migriert.
  //
  // DER FALL WIRD DESHALB NICHT GELÖSCHT, SONDERN GETEILT. Er hält jetzt beide Hälften fest, und
  // die zweite ist die wichtigere: sie ist der Wächter über eine OFFENE Lücke. Wer die DDL eines
  // Tages exportiert und in `db.ts` einträgt, macht genau diese Zeile rot — und das ist der Moment,
  // in dem sie durch die positive Erwartung zu ersetzen ist.
  it("JOB 4156: Dienst, Ablage und Routen-Plugin sind verdrahtet", () => {
    const index = readFileSync("services/knowledge-object/index.ts", "utf8");
    expect(index, "die Modulfassade nennt den Dienst").toContain("GesamtanweisungDienst");
    expect(index, "die Modulfassade nennt die haltbare Ablage").toContain("PgAnweisungRepo");

    const buildApp = readFileSync("services/app/src/build-app.ts", "utf8");
    expect(buildApp, "das Plugin ist an der Kompositionswurzel registriert").toContain(
      "app.register(gesamtanweisungRoutes",
    );
    expect(buildApp, "die haltbare Ablage hängt am echten Pool").toContain(
      "new PgAnweisungRepo(pool)",
    );
  });

  it("OFFENE LÜCKE: die DDL wird weiterhin NICHT über `migrate()` ausgeführt", () => {
    // Die Konstante ist modulintern (erster Fall oben), also kann `db.ts` sie gar nicht führen.
    // Beides zusammen heisst: auf einer frisch migrierten Datenbank fehlen die drei Tabellen, bis
    // jemand `PgAnweisungRepo.migriere()` von Hand ruft. Diese Zeile ist die Schuld, nicht das Ziel.
    const db = readFileSync("services/app/src/db.ts", "utf8");
    const schemasListe = db.slice(db.indexOf("export const schemas = ["));
    expect(
      /^\s*GESAMTANWEISUNG_SCHEMA,\s*$/m.test(schemasListe),
      "Die DDL-Stufe steht jetzt doch in der schemas-Liste — dann ist die Lücke geschlossen und dieser Fall gehört durch die positive Erwartung ersetzt.",
    ).toBe(false);
  });
});
