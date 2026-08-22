// ================================================================================================
// JOB 1993 · D2 · KA5 — DIE SCHEMA-LITERALE TRAGEN BACKTICKS, UND ZWAR NUR IN KOMMENTAREN
// ================================================================================================
//
// WOHER DIESER FALL KOMMT. `1943 D11` hat vier unmaskierte Backticks in die SQL-Kommentare von
// `KLARA_CONSENT_SCHEMA` geschrieben. Der Uebersetzer brach ab, und die zehn Syntaxmeldungen sahen
// einen Tag lang wie „zehn Typfehler und fuenf rote Tests" aus. `1993 D1` hat sie maskiert (`\``,
// die Schreibweise, die `KLARA_SESSION_SCHEMA` bei `:48` schon benutzte).
//
// WAS DAMIT NOCH IMMER UNGEPRUEFT WAR — und der Grund fuer diesen Fall. Die Maskierung stellt zwei
// Fragen, und der Uebersetzer beantwortet nur die erste:
//
//   1. Ist das Literal syntaktisch heil?      -> ja, sonst uebersetzt nichts. Der Compiler faengt das.
//   2. Ist der ERZEUGTE STRING gueltiges SQL? -> das faengt der Compiler NICHT.
//
// Zu Frage 2: `\`` erzeugt das Zeichen `` ` ``, und ein Backtick ist in Postgres KEIN gueltiges
// Zeichen — ausser hinter `--`, wo alles bis Zeilenende Kommentar ist. Genau dort stehen sie hier.
// Rutschte einer je aus einem Kommentar heraus, entstuende „42601 syntax error" beim Boot — exakt
// der Fehler, aus dem SCRUM-496 gelernt wurde (`db.migrate.integration.test.ts:23-26`).
//
// WARUM DAS NICHT SCHON GEDECKT IST. Das echte DDL laeuft nur in
// `services/app/src/db.migrate.integration.test.ts` gegen Postgres, und die Datei sagt selbst
// (`:28`): „Braucht Docker (Testcontainers); laeuft unter `npm run test:integration` (CI-Job
// ‚integration‘), NICHT im schnellen Root-Gate." Im Wurzel-Gate wird dieses SQL also nie
// ausgefuehrt. Dieser Fall prueft den erzeugten String dort, wo er ohne Docker pruefbar ist.
//
// WAS DIESER FALL NICHT IST. Keine Nachbildung: geprueft wird die exportierte Produktkonstante
// selbst (`services/reasoner/index.ts:207`), derselbe String, den `migrate()` an Postgres schickt.

import { describe, expect, it } from "vitest";
import { KLARA_CONSENT_SCHEMA, KLARA_SESSION_SCHEMA } from "../../services/reasoner";

const BACKTICK = String.fromCharCode(96);

/** Alle Zeilen eines DDL-Literals, die zur Laufzeit ein Backtick-Zeichen tragen. */
function zeilenMitBacktick(ddl: string): string[] {
  return ddl.split("\n").filter((zeile) => zeile.includes(BACKTICK));
}

describe("JOB 1993 · KA5: die Klara-Schema-Literale erzeugen gueltiges SQL", () => {
  const literale: ReadonlyArray<readonly [string, string]> = [
    ["KLARA_SESSION_SCHEMA", KLARA_SESSION_SCHEMA],
    ["KLARA_CONSENT_SCHEMA", KLARA_CONSENT_SCHEMA],
  ];

  it("die Maskierung erzeugt zur Laufzeit echte Backtick-Zeichen", () => {
    // Das ist die Zusicherung, die der Uebersetzer NICHT gibt: `\`` im Quelltext muss im erzeugten
    // String als `` ` `` ankommen. Wuerde jemand die Maskierung „reparieren", indem er die
    // Backticks aus dem Text entfernt, faende der Compiler daran nichts auszusetzen — dieser Fall
    // schon. Der Text ist eine gesetzte Zusicherung aus D1: er sollte zeichengleich bleiben.
    for (const [name, ddl] of literale) {
      expect(zeilenMitBacktick(ddl).length, `${name} traegt keine Backticks mehr`).toBeGreaterThan(
        0,
      );
    }
  });

  it("JEDER Backtick steht hinter `--`, also im SQL-Kommentar", () => {
    // Der eigentliche Schutz. Ein Backtick ausserhalb eines Kommentars ist in Postgres ungueltig
    // und faellt erst beim Boot auf ("42601 syntax error at or near ..."), weil das DDL im
    // Wurzel-Gate nie ausgefuehrt wird.
    for (const [name, ddl] of literale) {
      for (const zeile of zeilenMitBacktick(ddl)) {
        const kommentarBeginn = zeile.indexOf("--");
        expect(
          kommentarBeginn,
          `${name}: Zeile ohne Kommentar traegt Backtick -> ${zeile}`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          zeile.indexOf(BACKTICK),
          `${name}: Backtick steht VOR dem Kommentarzeichen -> ${zeile}`,
        ).toBeGreaterThan(kommentarBeginn);
      }
    }
  });

  it("die zehnte Bindung steht in CREATE TABLE UND in ALTER TABLE", () => {
    // Beides ist noetig und aus verschiedenen Gruenden: `CREATE TABLE IF NOT EXISTS` ist an einer
    // bestehenden Tabelle ein No-op, eine Bestandsinstallation bekaeme die Spalte also nur ueber
    // das ALTER. Faellt eines der beiden weg, merkt es im Wurzel-Gate sonst niemand.
    expect(KLARA_CONSENT_SCHEMA).toContain("addin_instance_id text,");
    expect(KLARA_CONSENT_SCHEMA).toContain("ADD COLUMN IF NOT EXISTS addin_instance_id text;");
  });
});
