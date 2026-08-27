// ================================================================================================
// JOB 2413 · D1 — DIE NUTZLAST VON `PgUserRepo.update`, NICHT DIE KLAMMER.
// ================================================================================================
//
// WORUM ES GEHT. `update` setzt neun Spalten über nummerierte Parameter:
//
//     UPDATE users SET name=$2,email=$3,password_salt=$4,password_hash=$5,role=$6,
//                      approved=$7,created_at=$8,notice_ack_at=$9,notice_ack_version=$10
//     WHERE id=$1
//
// Vertauscht jemand `$4` und `$5`, wandert das Salz in die Hash-Spalte und der Hash ins Salz.
// **Beides sind Zeichenketten vergleichbarer Länge.** Es gibt keinen Typfehler, keinen
// Laufzeitfehler und kein Rollback — die Klammer committet den Dreher sauber. Der Schaden fällt
// erst beim nächsten Anmeldeversuch auf, und dann sieht er aus wie ein Fehler des Anmeldewegs:
// **ab diesem Moment lässt sich für den betroffenen Nutzer kein Passwort mehr prüfen.**
//
// Dieselbe Klasse trifft die beiden Zeitstempel (`created_at`/`notice_ack_at`) und das Paar
// `notice_ack_at`/`notice_ack_version` — jeweils Werte, die sich nicht gegenseitig ausschliessen.
//
// WARUM EINE KORREKTE TRANSAKTIONSKLAMMER DAVOR NICHT SCHÜTZT: Sie kann es gar nicht. Eine falsche
// Nutzlast INNERHALB einer korrekten Klammer ist ein gültiger Schreibvorgang. Sieben Bahnen haben
// in der Nacht auf den 26.08. Klammern geprüft und repariert; keine dieser Arbeiten fängt einen
// vertauschten Parameter ab.
//
// IST-ZUSTAND VOR DIESEM BAU, gemessen im Klon `kw-basic3-job2413-d1` (Stand `589d2b6`):
//   · Die Bindung ist HEUTE KORREKT — alle zehn Positionen stimmen (kein Produktionsvorfall).
//   · Neben `services/auth/src/repo-pg.ts` liegt keine Nachbardatei mit Testendung, und in
//     `tests/` nennt keine Datei `PgUserRepo`. Der Pfad einer solchen Datei wird hier bewusst
//     NICHT ausgeschrieben: `tests/structure/testverweise-aufloesbar.test.ts` liest jeden
//     ausgeschriebenen Testpfad als behauptete Abdeckung — und die gibt es ja gerade nicht.
//   · Damit ist die Nutzlast von `update` von keinem laufenden Test gedeckt.
//
// WAS DIESE DATEI PRÜFT: die Zuordnung **SPALTE → PARAMETERPOSITION → ÜBERGEBENER WERT**, nicht
// die Anwesenheit von Namen. Die Zuordnung wird aus dem gesendeten SQL-Text GELESEN, nicht
// abgeschrieben — steht morgen `password_hash=$4`, prüft dieser Test genau das und fällt um, wenn
// dort der Salzwert steht.
//
// AUSDRÜCKLICHE REICHWEITENGRENZE: Geprüft wird, WAS das Repo an die Datenbank sendet — Text und
// Werte. **NICHT geprüft ist, was PostgreSQL daraus macht**; dass `SET spalte=$n` den n-ten
// Parameter in diese Spalte schreibt, ist dokumentiertes Postgres-Verhalten und bleibt bis zu
// einem Integrationslauf eine UNBEWIESENE HYPOTHESE.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgUserRepo } from "../../services/auth";

// Der Nutzertyp wird aus der Methodensignatur abgeleitet statt tief importiert: so bindet die
// Fixture an GENAU den Parameter, den `update` annimmt, und ein Feldwechsel am Produkt fällt hier
// als Typfehler auf, statt still durchzugehen.
type NutzerWerte = Parameters<PgUserRepo["update"]>[0];

interface Anweisung {
  text: string;
  params: readonly unknown[];
}

/** Ein Pool-Doppel, das TEXT UND PARAMETER mitschreibt. */
function poolDoppel(): { pool: Pool; anweisungen: Anweisung[] } {
  const anweisungen: Anweisung[] = [];
  const query = async (text: string, params?: readonly unknown[]) => {
    anweisungen.push({ text, params: params ?? [] });
    return { rows: [], rowCount: 1 };
  };
  return { pool: { query } as unknown as Pool, anweisungen };
}

// Jeder Wert ist EINMALIG und selbsterklärend. Das ist der ganze Trick: Wären Salz und Hash beide
// "abc", könnte keine Vertauschung auffallen — der Test wäre grün und wertlos.
const NUTZER: NutzerWerte = {
  id: "WERT-ID",
  name: "WERT-NAME",
  email: "WERT-EMAIL",
  passwordSalt: "WERT-SALZ",
  passwordHash: "WERT-HASH",
  role: "admin",
  approved: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  noticeAckAt: "2026-02-02T00:00:00.000Z",
  noticeAckVersion: "WERT-ACK-VERSION",
} as NutzerWerte;

/**
 * Liest aus dem GESENDETEN SQL-Text, welche Spalte an welcher Parameterposition hängt, und gibt
 * den dort übergebenen Wert zurück.
 *
 * Der Text ist die Quelle, nicht eine hier abgeschriebene Erwartung — sonst prüfte die Datei ihre
 * eigene Annahme statt des Produkts.
 */
function wertFuerSpalte(a: Anweisung, spalte: string): unknown {
  const treffer = new RegExp(`\\b${spalte}=\\$(\\d+)`).exec(a.text);
  if (treffer === null) {
    throw new Error(
      `Die Spalte ${spalte} kommt im gesendeten UPDATE nicht vor:\n${a.text}\nEntweder wurde sie entfernt oder umbenannt — beides gehört angesehen.`,
    );
  }
  const position = Number(treffer[1]);
  return a.params[position - 1];
}

async function update(): Promise<Anweisung> {
  const { pool, anweisungen } = poolDoppel();
  await new PgUserRepo(pool).update(NUTZER);
  const treffer = anweisungen.find((a) => /^\s*UPDATE\s+users\b/i.test(a.text));
  expect(treffer, "Es wurde gar kein UPDATE auf `users` gesendet").toBeDefined();
  return treffer as Anweisung;
}

describe("JOB 2413 · die Nutzlast von PgUserRepo.update", () => {
  it("KALIBRIERUNG: die Anweisung geht raus und trägt zehn Parameter", async () => {
    // Ohne diesen Fall wäre jede Zuordnung unten still erfüllt, wenn gar nichts gesendet würde.
    const a = await update();

    expect(a.params).toHaveLength(10);
    expect(a.text, "das UPDATE bindet den Nutzer nicht über die Id").toMatch(/WHERE\s+id=\$1/i);
    expect(a.params[0], "an $1 steht nicht die Id").toBe("WERT-ID");
  });

  it("GRUPPE 1 — password_salt und password_hash stehen NICHT vertauscht", async () => {
    // Der schärfste Fall: Ein Dreher hier macht jedes Passwort unprüfbar, ohne jedes Signal.
    const a = await update();

    expect(
      wertFuerSpalte(a, "password_salt"),
      "In der Spalte `password_salt` landet nicht das Salz — Salz und Hash sind vertauscht. " +
        "Ab diesem Schreibvorgang lässt sich für diesen Nutzer kein Passwort mehr prüfen.",
    ).toBe("WERT-SALZ");

    expect(
      wertFuerSpalte(a, "password_hash"),
      "In der Spalte `password_hash` landet nicht der Hash — Salz und Hash sind vertauscht.",
    ).toBe("WERT-HASH");
  });

  it("GRUPPE 2 — die beiden Zeitstempel stehen nicht über Kreuz", async () => {
    // `created_at` und `notice_ack_at` sind beides ISO-Zeitstempel. Ein Dreher setzt das
    // Anlagedatum auf den Zeitpunkt der Kenntnisnahme — und umgekehrt.
    const a = await update();

    expect(wertFuerSpalte(a, "created_at"), "`created_at` trägt nicht das Anlagedatum").toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(
      wertFuerSpalte(a, "notice_ack_at"),
      "`notice_ack_at` trägt nicht den Zeitpunkt der Kenntnisnahme",
    ).toBe("2026-02-02T00:00:00.000Z");
  });

  it("GRUPPE 3 — notice_ack_at und notice_ack_version stehen nicht über Kreuz", async () => {
    // Beide gehören zum selben Vermerk und stehen nebeneinander in der Liste — genau die Lage,
    // in der eine Vertauschung beim Lesen des Codes nicht auffällt.
    const a = await update();

    expect(
      wertFuerSpalte(a, "notice_ack_version"),
      "`notice_ack_version` trägt nicht die Version",
    ).toBe("WERT-ACK-VERSION");
    expect(
      wertFuerSpalte(a, "notice_ack_at"),
      "`notice_ack_at` trägt die Version statt des Zeitpunkts",
    ).not.toBe("WERT-ACK-VERSION");
  });

  it("die übrigen Spalten tragen ebenfalls ihren eigenen Wert", async () => {
    // Vollständigkeit: Der Wächter deckt die ganze Anweisung, nicht nur die drei genannten
    // Gruppen — sonst bliebe eine Vertauschung zwischen `name` und `email` unbemerkt.
    const a = await update();

    expect(wertFuerSpalte(a, "name")).toBe("WERT-NAME");
    expect(wertFuerSpalte(a, "email")).toBe("WERT-EMAIL");
    expect(wertFuerSpalte(a, "role")).toBe("admin");
    expect(wertFuerSpalte(a, "approved")).toBe(true);
  });

  it("KALIBRIERUNG: die Fixture-Werte sind paarweise verschieden", async () => {
    // Ohne diese Probe könnte ein späterer Umbau zwei Werte gleich machen — dann wäre jede
    // Vertauschungsaussage oben still erfüllt, und die Datei sähe weiter grün aus.
    const werte = [
      NUTZER.passwordSalt,
      NUTZER.passwordHash,
      NUTZER.createdAt,
      NUTZER.noticeAckAt,
      NUTZER.noticeAckVersion,
      NUTZER.name,
      NUTZER.email,
    ];
    expect(
      new Set(werte).size,
      "zwei Fixture-Werte sind gleich — Vertauschungen fielen nicht auf",
    ).toBe(werte.length);
  });
});
