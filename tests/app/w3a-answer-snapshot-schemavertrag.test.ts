// ================================================================================================
// JOB 765 / D3 — DER SCHEMAVERTRAG DER ANTWORTBELEGE, LAUFFAEHIG OHNE DATENBANK.
// ================================================================================================
//
// DER BEFUND (`_relay/kopf/outbox/BEN-PRUEFUNG-JOB-765-D2.md`, Korrekturpflichten 1 und 2):
//
//   „G1 ausführen, Rot kausal messen, bytegleich zurücknehmen und Grün messen."
//   „G2 als Katalogassertion bauen, gegen entfernte `NOT NULL`-Deklarationen rot messen, bytegleich
//    zurücknehmen und grün messen."
//
// UND DIE LAGE, IN DER DIESE DATEI ENTSTEHT — gemessen, nicht behauptet:
//
//   Die einzige Stelle, die diese beiden Zusagen prüft, ist
//   `services/app/src/db.migrate.schemas-61.integration.test.ts`. Sie braucht eine echte
//   PostgreSQL-Instanz. In dieser Bahn gibt es keine: der Docker-Socket antwortet mit
//   `permission denied`, PostgreSQL-Binaries sind nicht installiert. Der Lauf meldet
//   `5 tests | 5 skipped` — und Vitest zählt die Datei trotzdem als `Test Files 1 passed`.
//
//   Die Folge, in diesem Durchgang zweimal gemessen: Entfernt man BEIDE `SET NOT NULL`-Zeilen aus
//   `ANSWER_SNAPSHOT_SCHEMA`, bleibt die lauffähige Nachbarschaft bei `139 passed`. Entfernt man
//   zusätzlich den Unique-Index, ebenfalls `139 passed`. Es gibt heute KEINEN lauffähigen Test, der
//   den Wegfall dieser Zusagen bemerkt.
//
// WAS DIESE DATEI DESHALB TUT: Sie hält den Schemavertrag an der Stelle fest, an der er ohne
// Datenbank prüfbar ist — an der DDL selbst, die `migrate()` tatsächlich ausführt. Sie importiert
// `ANSWER_SNAPSHOT_SCHEMA` als Konstante (kein abgeschriebener Text, keine Datei-Rohlesung des
// Schemas), damit sie nicht neben der Wahrheit herlaufen kann.
//
// WAS SIE AUSDRUECKLICH NICHT TUT — und das ist die tragende Grenze dieser Akte:
//
//   SIE ERSETZT DEN POSTGRESQL-LAUF NICHT. Ob PostgreSQL die Deklaration auch WIRKLICH als
//   `attnotnull` im Katalog führt und ob der Unique-Index unter einer Mutation tatsächlich der
//   einzige Grund für das erwartete Rot ist, kann nur die Integrationsschiene beantworten. Diese
//   Datei sichert die Vorstufe: dass die Zusage im Schema STEHT und dass die Katalogassertion, die
//   sie am Server prüft, nicht still verschwindet, solange niemand sie ausführen kann.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ANSWER_SNAPSHOT_SCHEMA } from "../../services/ask";

const WURZEL = join(__dirname, "..", "..");

/** Die Integrationsdatei, die dieselben Zusagen am echten Server prüft. */
const INTEGRATION = "services/app/src/db.migrate.schemas-61.integration.test.ts";

/** Kommentare zählen nicht zur DDL — der Erklärtext darf Begriffe nennen, ohne sie zuzusagen. */
function ohneKommentare(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

const DDL = ohneKommentare(ANSWER_SNAPSHOT_SCHEMA);

/** Die beiden generierten Schlüsselspalten der Revisionsidentität. */
const SCHLUESSELSPALTEN = ["answer_id", "snapshot_revision_key"] as const;

describe("JOB 765 · S — der Schemavertrag der Antwortbelege steht in der DDL", () => {
  it("S1 · beide generierten Schlüsselspalten sind NOT NULL (G2 auf DDL-Ebene)", () => {
    // Die Lehre aus BEN-33 Befund C, die `repo-pg.ts` selbst notiert: ein Unique-Index über
    // NULL-fähige Spalten sagt fast nichts zu, weil PostgreSQL zwei NULLs für verschieden hält.
    // Ohne diese beiden Zeilen ist die Eindeutigkeitszusage darunter hohl.
    const fehlend = SCHLUESSELSPALTEN.filter(
      (spalte) =>
        !new RegExp(
          `ALTER\\s+TABLE\\s+answer_snapshots\\s+ALTER\\s+COLUMN\\s+${spalte}\\s+SET\\s+NOT\\s+NULL`,
          "i",
        ).test(DDL),
    );
    expect(
      fehlend,
      "Schlüsselspalte ohne SET NOT NULL — der Unique-Index darüber wäre über NULL-fähigen " +
        "Spalten und damit fast wirkungslos",
    ).toEqual([]);
  });

  it("S2 · der Unique-Index steht über genau diesen beiden Spalten (G1 auf DDL-Ebene)", () => {
    const treffer =
      /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+answer_snapshots_revision_uq\s+ON\s+answer_snapshots\s*\(([^)]*)\)/i.exec(
        DDL,
      );
    expect(
      treffer,
      "der Unique-Index answer_snapshots_revision_uq fehlt in der DDL",
    ).not.toBeNull();
    const spalten = (treffer?.[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    // GENAU diese zwei, in dieser Reihenfolge: eine dritte Spalte wäre eine andere Identität,
    // eine fehlende machte die Eindeutigkeit gröber.
    expect(spalten).toEqual(["answer_id", "snapshot_revision_key"]);
  });

  it("S3 · die CHECK-Bedingung existiert — und sie ersetzt NOT NULL nicht", () => {
    // BENs eigenes Argument, hier festgehalten: Die CHECK-Bedingung prüft die JSONB-QUELLE
    // (`data->>'answerId'` nichtleer, Revision numerisch). Die NOT-NULL-Deklaration prüft die
    // GENERIERTE SPALTE. Beides sind verschiedene Zusagen an verschiedenen Orten — genau deshalb
    // kann ein Einfügungstest die NOT-NULL-Zeile nicht isolieren, und genau deshalb steht S1
    // getrennt neben diesem Fall.
    expect(DDL).toMatch(/CONSTRAINT\s+answer_snapshots_identitaet_ck\s+CHECK/i);
    expect(DDL).toContain("data->>'answerId'");
    expect(DDL).toContain("data->>'snapshotRevision'");
    // Die CHECK-Bedingung nennt die generierten Spaltennamen NICHT — sie kann über deren
    // Nullbarkeit also gar nichts aussagen.
    const check = /CHECK\s*\(([\s\S]*?)\)\s*;/i.exec(DDL)?.[1] ?? "";
    expect(check.length, "CHECK-Rumpf nicht lesbar").toBeGreaterThan(0);
    for (const spalte of SCHLUESSELSPALTEN) {
      expect(
        check.includes(spalte),
        `die CHECK-Bedingung nennt ${spalte} — dann wäre die Trennung zu S1 nicht mehr sauber`,
      ).toBe(false);
    }
  });

  it("S4 · die DDL bleibt additiv und wiederholbar — nichts wird entfernt oder geleert", () => {
    // Eine Migration, die löscht, ist keine Migration mehr. `migrate()` läuft bei jedem Start.
    for (const verboten of ["DROP TABLE", "DROP COLUMN", "DROP INDEX", "TRUNCATE", "DELETE FROM"]) {
      expect(DDL.toUpperCase().includes(verboten), `DDL enthält ${verboten}`).toBe(false);
    }
    // Jedes CREATE trägt IF NOT EXISTS, sonst bricht der zweite Lauf ab.
    const creates = [...DDL.matchAll(/CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+(\w+)/gi)].map(
      (m) => m[0],
    );
    expect(
      creates.length,
      "keine CREATE-Anweisung gefunden — liest der Test das richtige?",
    ).toBeGreaterThan(3);
    const ohneWaechter = creates.filter((c) => !/IF$/i.test(c.trim().split(/\s+/).pop() ?? ""));
    expect(ohneWaechter, "CREATE ohne IF NOT EXISTS — der zweite migrate()-Lauf bräche ab").toEqual(
      [],
    );
  });

  it("S5 · die Katalogassertion am echten Server existiert weiterhin", () => {
    // DER EIGENTLICHE ZWECK DIESES FALLES: Solange niemand die Integrationsschiene fahren kann,
    // ist ihre Datei unbewacht — ein `5 skipped` meldet Vitest als `1 passed`. Wer die
    // Katalogassertion dort entfernt, würde heute nichts merken. Ab hier schon.
    //
    // GEPRUEFT WIRD JE ABFRAGE, NICHT JE DATEI. Die erste Fassung suchte die Begriffe irgendwo im
    // Text — und blieb grün, als eine Gegenmutation genau die `answer_snapshots`-Katalogabfrage
    // entfernte: die gleichlautende Abfrage für `external_source_records` stand ja noch da. Eine
    // Suche über die ganze Datei misst die Anwesenheit von Wörtern, nicht die der Zusage.
    const quelle = readFileSync(join(WURZEL, INTEGRATION), "utf8");
    const abfragen = [...quelle.matchAll(/`([^`]*)`|"((?:[^"\\]|\\.)*)"/g)].map(
      (m) => m[1] ?? m[2] ?? "",
    );
    expect(
      abfragen.length,
      "keine Zeichenketten gelesen — liest der Fall die richtige Datei?",
    ).toBeGreaterThan(10);

    // Die Nullbarkeit wird am Katalog gelesen, nicht am Einfügeverhalten — und zwar für DIESE
    // Tabelle und BEIDE Schlüsselspalten in EINER Abfrage.
    const nullbarkeit = abfragen.filter(
      (q) =>
        q.includes("information_schema.columns") &&
        q.includes("is_nullable") &&
        q.includes("answer_snapshots"),
    );
    expect(
      nullbarkeit.length,
      `${INTEGRATION}: keine Katalogabfrage der Nullbarkeit für answer_snapshots`,
    ).toBeGreaterThan(0);
    for (const spalte of SCHLUESSELSPALTEN) {
      expect(
        nullbarkeit.some((q) => q.includes(spalte)),
        `${INTEGRATION}: die Nullbarkeit von ${spalte} wird am Server nicht mehr geprüft`,
      ).toBe(true);
    }

    // … und der Unique-Index ebenfalls am Katalog, ebenfalls für DIESE Tabelle.
    const indizes = abfragen.filter(
      (q) => q.includes("pg_indexes") && q.includes("answer_snapshots"),
    );
    expect(
      indizes.length,
      `${INTEGRATION}: keine Katalogabfrage der Indizes für answer_snapshots`,
    ).toBeGreaterThan(0);
    expect(quelle).toContain("answer_snapshots_revision_uq");
  });

  it("S6 · dieser Vertrag gibt sich nicht als PostgreSQL-Beleg aus", () => {
    // Die Integrationsdatei überspringt fail-open, wenn keine Datenbank da ist. Das ist richtig —
    // aber es heisst, dass ihr Grün BEDINGT ist. Dieser Fall hält die Bedingung strukturell fest,
    // damit niemand ein `1 passed` dieser Datei als Serverbeleg liest.
    const quelle = readFileSync(join(WURZEL, INTEGRATION), "utf8");
    expect(quelle).toContain("ctx.skip()");
    expect(quelle).toMatch(/available\s*=\s*false/);
    // Und diese Datei hier redet mit keiner Datenbank. Geprüft wird die IMPORTLISTE, nicht der
    // Rohtext: eine Textsuche fände ihr eigenes Assertionsliteral wieder und wäre immer rot —
    // genau daran ist die erste Fassung dieses Falles zu Recht gescheitert.
    const selbst = readFileSync(
      join(WURZEL, "tests/app/w3a-answer-snapshot-schemavertrag.test.ts"),
      "utf8",
    );
    const importe = [...selbst.matchAll(/^import[^\n]*?from\s+"([^"]+)";/gm)].map((m) => m[1]);
    expect(
      importe.length,
      "keine Importe gelesen — liest der Fall die richtige Datei?",
    ).toBeGreaterThan(2);
    expect(importe).not.toContain("pg");
    expect(importe).not.toContain("testcontainers");
  });
});
