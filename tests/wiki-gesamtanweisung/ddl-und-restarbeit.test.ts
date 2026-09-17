// ================================================================================================
// JOB 4154/4309 · DIE DDL — UND IHR WEG IN DEN MIGRATIONSLAUF DER ANWENDUNG.
// ================================================================================================
//
// JOB 4154 musste eine ausdrückliche, begründete Abweichung fahren: die DDL der Anweisung wurde
// NICHT als `export const …_SCHEMA` geführt, weil `db.migrate.test.ts:47-60` dann einen Eintrag in
// `services/app/src/db.ts` verlangt — und diese Datei gehörte damals einer anderen Bahn.
//
// EINE ABWEICHUNG, DIE NUR IN EINER RÜCKGABE STEHT, IST EIN ZETTEL. Diese Fälle haben sie prüfbar
// gehalten, bis JOB 4309 sie einlösen durfte. Sie halten unverändert fest, dass die Konstante
// wirklich da ist, wirklich ausgeführt wird und wirklich additiv ist; geändert hat sich die
// Richtung der zwei Schuldfälle — aus „sie darf nicht heraus" ist „sie IST heraus und wird
// migriert" geworden. Wer sie umbenennt, um den Wächter zu umgehen, fällt hier auf; wer sie aus
// `migrate()` nimmt, ebenfalls.
//
// ------------------------------------------------------------------------------------------------
// JOB 4309 · DIE RESTARBEIT IST ERLEDIGT — und die Schuldwächter sind UMGEDREHT, nicht gelöscht.
// ------------------------------------------------------------------------------------------------
// Zwei Fälle dieser Datei waren als SCHULD gebaut und haben ihre eigene Ablösung ausgeschrieben:
//   · „sie ist modulintern — kein `export const …_SCHEMA`"  (die Konstante durfte nicht heraus)
//   · „OFFENE LÜCKE: die DDL wird weiterhin NICHT über `migrate()` ausgeführt"
// Beide sind mit JOB 4309 rot geworden (Arbeitsprüfung cd46bb7ceb9b46b5a937f1296b645814, acht
// rote Fälle in dieser Datei) und stehen jetzt in ihrer POSITIVEN Form an derselben Stelle: die
// Konstante heisst `GESAMTANWEISUNG_SCHEMA`, ist exportiert, und sie steht in der `schemas`-Liste.
//
// DIE ÜBRIGEN FÄLLE SIND UNVERÄNDERT IN IHRER AUSSAGE und nur im Namen der Konstante nachgeführt —
// additiv, wiederholbar, `pos` statt `position`, wirklich von `migriere()` ausgeführt. Das ist die
// Nachführpflicht des Ändernden und keine Abschwächung: keine Zusicherung ist entfallen.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REPO_QUELLE = readFileSync(
  "services/knowledge-object/src/gesamtanweisung-repo-pg.ts",
  "utf8",
);

/** Der Rumpf der Konstante, so wie er wirklich ausgeführt wird. */
function ddl(): string {
  const treffer = /const GESAMTANWEISUNG_SCHEMA\s*=\s*`([\s\S]*?)`/.exec(REPO_QUELLE);
  expect(treffer?.[1], "die DDL-Konstante ist nicht auffindbar").toBeTruthy();
  return treffer?.[1] ?? "";
}

describe("JOB 4154/4309 · die DDL steht bereit und läuft im Migrationsweg der Anwendung", () => {
  it("sie ist EXPORTIERT — genau die Form, die der Migrationswächter erhebt", () => {
    // Genau das Muster, das `db.migrate.test.ts:47` sammelt. Bis JOB 4156 stand hier die
    // Gegenerwartung `toEqual([])`, weil `db.ts` damals einer anderen Bahn gehörte und eine
    // exportierte Konstante den Wächter rot gemacht hätte, ohne dass ihn jemand beheben durfte.
    // Seit JOB 4309 ist genau das erledigt — und der Wächter greift wie bei jeder anderen Stufe.
    const exportiert = [...REPO_QUELLE.matchAll(/export const (\w+_SCHEMA)\s*=\s*`/g)].map(
      (m) => m[1],
    );
    expect(
      exportiert,
      "die DDL ist nicht (mehr) als `export const …_SCHEMA = `…`` geschrieben — dann sammelt db.migrate.test.ts sie nicht, und ein fehlender Eintrag in db.ts fiele nicht auf",
    ).toEqual(["GESAMTANWEISUNG_SCHEMA"]);
  });

  it("sie ist nicht tot: `migriere()` führt sie wirklich aus", () => {
    // Ohne diesen Fall wäre die Konstante genau der Fehler, den der Aufrufer-Wächter beschreibt:
    // gebaut, richtig, und wirkungslos. JOB 4309: `migriere()` ist kein zweiter Migrationsweg
    // mehr, sondern führt DIESELBE Konstante aus wie `migrate()` — eine DDL, zwei Aufrufer.
    expect(REPO_QUELLE).toMatch(/async migriere\(\)[\s\S]*GESAMTANWEISUNG_SCHEMA/);
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

  it("der Weg in `migrate()` ist im Quelltext NAMENTLICH benannt, nicht nur in einer Rückgabe", () => {
    // Bis JOB 4309 hielt dieser Fall fest, dass die OFFENE Restarbeit namentlich dastand. Jetzt
    // hält er fest, dass der eingelöste Weg namentlich dasteht: wer die Konstante eines Tages
    // wieder modulintern machte, nähme `db.ts` die Stufe weg — dieser Satz soll ihn vorher warnen.
    expect(REPO_QUELLE).toContain("GESAMTANWEISUNG_SCHEMA");
    expect(REPO_QUELLE).toContain("migrate()");
    expect(REPO_QUELLE).toContain("services/knowledge-object/index.ts");
  });

  // ------------------------------------------------------------------------------------------------
  // JOB 4309 · DIE DRITTE HÄLFTE IST EINGELÖST — DIE DDL LÄUFT IM MIGRATIONSWEG DER ANWENDUNG.
  // ------------------------------------------------------------------------------------------------
  //
  // Hier stand bis JOB 4154 der Fall „die Route ist als Plugin da, aber `build-app.ts` bleibt in
  // dieser Lieferung unberührt" mit drei `not.toContain`. JOB 4156 hat zwei davon eingelöst (die
  // Kompositionswurzel registriert das Plugin, die Modulfassade nennt Dienst und Ablage) und den
  // dritten als Schuld stehen gelassen — die DDL wurde nicht migriert.
  //
  // JOB 4309 löst ihn ein. Der Fall wird NICHT gelöscht, sondern umgedreht: an derselben Stelle
  // steht jetzt die positive Erwartung. Wer die Stufe eines Tages wieder aus der Liste nimmt, macht
  // genau diese Zeile rot — und auf einer frisch migrierten Datenbank fehlten dann wieder die drei
  // Tabellen. Gemessen als Gegenprobe, siehe RUECKGABE.
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

  it("JOB 4309: die DDL-Stufe steht in der `schemas`-Liste — `migrate()` legt die Tabellen an", () => {
    // Die Konstante ist exportiert (erster Fall oben) UND sie steht in der Liste. Beides zusammen
    // heisst: auf einer frisch migrierten Datenbank sind die drei Tabellen da, ohne dass jemand
    // `PgAnweisungRepo.migriere()` von Hand ruft. Das ist das Ziel, nicht mehr die Schuld.
    const db = readFileSync("services/app/src/db.ts", "utf8");
    const schemasListe = db.slice(db.indexOf("export const schemas = ["));
    expect(
      /^\s*GESAMTANWEISUNG_SCHEMA,\s*$/m.test(schemasListe),
      "Die DDL-Stufe fehlt in der schemas-Liste — dann fehlen die drei Tabellen auf jeder frisch migrierten Datenbank, und die Gesamtanweisung ist im Postgres-Betrieb nicht einsatzbereit.",
    ).toBe(true);
    // UND SIE GEHT WIRKLICH ÜBER DIE MODULGRENZE: ohne den Weiterreichungspunkt in der Fassade
    // wäre der Eintrag oben ein Name ohne Bindung, und `dependency-cruiser` liesse den direkten
    // Griff in `src/` gar nicht zu.
    const fassade = readFileSync("services/knowledge-object/index.ts", "utf8");
    expect(fassade, "die Modulfassade reicht die DDL-Stufe nicht weiter").toMatch(
      /export \{[^}]*GESAMTANWEISUNG_SCHEMA[^}]*\} from "\.\/src\/gesamtanweisung-repo-pg"/,
    );
    expect(db, "db.ts holt die Stufe nicht über die Modulfassade").toMatch(
      /import \{[\s\S]*?GESAMTANWEISUNG_SCHEMA[\s\S]*?\} from "\.\.\/\.\.\/knowledge-object"/,
    );
  });
});
