import { readFileSync } from "node:fs";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { FencingVeraltetError, PgWriteFence, fenceKey } from "./write-fence";

// ================================================================================================
// JOB 1060 D7 — DER MODULNAHE VERTRAG DER SCHREIBSPERRE
// ================================================================================================
//
// Arbeitsteilung mit `tests/app/write-fence-race.test.ts`: DORT steht der Rennvertrag (welches SQL
// abgesetzt wird, Transaktionsklammer, pausierter Altinhaber). HIER stehen die Eigenschaften des
// Moduls selbst, die man ohne Rennszenario prüfen kann — Schlüsselableitung, Typumwandlung an der
// Datenbankgrenze und die unterscheidbare Fehlerklasse.
//
// Kein echtes PostgreSQL: Auflage 3 verlangt zwei parallele Verbindungen, und die sind in dieser
// Bahn nicht herstellbar (kein PostgreSQL installiert — s. Rückgabe). Was hier läuft, misst den
// Adapter, nicht die Datenbank.

function fakePool(rows: Record<string, unknown>[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return { rows, rowCount: rows.length };
  };
  return {
    pool: { query, connect: async () => ({ query, release: () => undefined }) } as unknown as Pool,
    calls,
  };
}

describe("JOB1060 D7 · fenceKey — ein Gegenstand, ein Schlüssel", () => {
  it("ein einzelner Gegenstand braucht keinen zweiten Bezeichner", () => {
    expect(fenceKey("ko-einzel", "k1")).toBe("ko-einzel:k1");
  });

  it("ein Paar ist ungeordnet — die Reihenfolge der Bezeichner ändert den Schlüssel nicht", () => {
    expect(fenceKey("ko-paar", "b", "a")).toBe(fenceKey("ko-paar", "a", "b"));
    expect(fenceKey("ko-paar", "a", "b")).toBe("ko-paar:a|b");
  });

  it("das Trennzeichen im Bezeichner wird kodiert — sonst kollidierten zwei Gegenstände", () => {
    // Ohne Kodierung ergäben ("a|b","c") und ("a","b|c") beide „ko-paar:a|b|c" und teilten sich
    // eine Sperre. Der escapte Wert macht die Zerlegung eindeutig.
    expect(fenceKey("ko-paar", "a|b", "c")).toBe("ko-paar:a%7Cb|c");
    expect(fenceKey("ko-paar", "a", "b|c")).toBe("ko-paar:a|b%7Cc");
    expect(fenceKey("ko-paar", "a|b", "c")).not.toBe(fenceKey("ko-paar", "a", "b|c"));
  });

  it("ein Bezeichner mit demselben Namen wie ein anderer Gegenstandstyp kollidiert nicht", () => {
    expect(fenceKey("ko-paar", "x")).not.toBe(fenceKey("ko-einzel", "x"));
  });
});

describe("JOB1060 D7 · acquire — die Antwort der Datenbank, nicht die des Codes", () => {
  it("wandelt das bigint-Token an GENAU EINER Stelle in eine Zahl", async () => {
    // `pg` liefert `bigint` als Zeichenkette. Bliebe sie eine, verglichen spätere Schritte
    // Zeichenketten („10" < „9") — ein monoton wachsendes Token wäre dann nicht mehr monoton.
    const { pool } = fakePool([{ fencing_token: "42" }]);
    const grant = await new PgWriteFence(pool).acquire("k", "wer", 1000);
    expect(grant?.token).toBe(42);
    expect(typeof grant?.token).toBe("number");
  });

  it("reicht Schlüssel, Halter und Lease-DAUER als Parameter durch — keine Werte im SQL-Text", async () => {
    // Werte gehören in Parameter, nicht in die Anweisung: das ist zugleich der Injektionsschutz
    // und die Voraussetzung dafür, dass die Anweisung eine Konstante bleiben kann.
    const { pool, calls } = fakePool([{ fencing_token: "1" }]);
    await new PgWriteFence(pool).acquire("ko-paar:a|b", "conflicts@1", 30_000);
    expect(calls[0]?.params).toEqual(["ko-paar:a|b", "conflicts@1", 30_000]);
    expect(calls[0]?.sql).not.toContain("conflicts@1");
  });

  it("kein Datensatz ⇒ kein Ausweis (fail-closed)", async () => {
    const { pool } = fakePool([]);
    expect(await new PgWriteFence(pool).acquire("k", "wer", 1000)).toBeNull();
  });
});

describe("JOB1060 D7 · die Fehlerklasse ist unterscheidbar", () => {
  it("ein überholter Ausweis wirft FencingVeraltetError — kein Meldungs-Parsen nötig", async () => {
    const { pool } = fakePool([]); // die Sperre findet keine Zeile: Token veraltet
    const zaun = new PgWriteFence(pool);
    let gefangen: unknown;
    try {
      await zaun.withFence({ key: "k", owner: "wer", token: 3 }, async () => "nie");
    } catch (err) {
      gefangen = err;
    }
    expect(gefangen).toBeInstanceOf(FencingVeraltetError);
    expect((gefangen as FencingVeraltetError).name).toBe("FencingVeraltetError");
    expect((gefangen as FencingVeraltetError).key).toBe("k");
    expect((gefangen as FencingVeraltetError).token).toBe(3);
  });

  it("ein Fehler AUS dem Schreibblock bleibt der Fehler des Aufrufers", async () => {
    // Der Zaun darf fremde Fehler nicht in seine eigene Klasse umdeuten — sonst sähe ein
    // Anwendungsfehler wie eine verlorene Sperre aus und würde falsch behandelt.
    const { pool } = fakePool([{ fencing_token: "1" }]);
    const zaun = new PgWriteFence(pool);
    await expect(
      zaun.withFence({ key: "k", owner: "wer", token: 1 }, async () => {
        throw new Error("Anwendungsfehler");
      }),
    ).rejects.toThrow("Anwendungsfehler");
  });
});

describe("JOB1060 D7 · der Schemaverzicht ist gewollt und bleibt sichtbar", () => {
  const quelle = readFileSync(new URL("./write-fence.ts", import.meta.url), "utf8");
  // Kommentare raus: die Erklaerung, warum es die Konstante NICHT gibt, nennt sie beim Namen.
  const nurCode = quelle
    .split("\n")
    .map((zeile) => zeile.replace(/^\s*(\/\/|\*|\/\*).*$/, ""))
    .join("\n");

  it("das Modul exportiert KEINE Schemakonstante — die Tabelle ist nicht migrierbar", () => {
    // Hausregel `services/app/src/db.migrate.test.ts` (SCRUM-496): jede exportierte
    // DDL-`*_SCHEMA`-Konstante MUSS in der `schemas`-Liste von `services/app/src/db.ts` stehen.
    // `db.ts` ist in der D7-Lease nicht enthalten; eine exportierte Konstante wäre also eine
    // Zusage, die diese Bahn nicht einlösen kann — und der Hauswächter würde sie zu Recht rot
    // machen.
    //
    // Diese Zusicherung hält den Verzicht fest. Wird die Konstante eines Tages ergänzt, OHNE dass
    // db.ts sie migriert, wird zuerst hier klar, warum — und der Hauswächter fängt es zusätzlich.
    expect(nurCode).not.toMatch(/export\s+const\s+\w+_SCHEMA\s*=/);
    expect(nurCode, "der Kommentarfilter darf nicht den ganzen Code wegwerfen").toContain(
      "export class PgWriteFence",
    );
  });

  it("die DDL steht trotzdem wörtlich im Modul — sie muss beim Leasen nicht neu erfunden werden", () => {
    // Ohne diese Zeile wäre der Verzicht ein Verlust: die nächste Bahn müsste die Tabelle raten.
    expect(quelle).toContain("CREATE TABLE IF NOT EXISTS write_fences");
    expect(quelle).toContain("key text PRIMARY KEY");
    expect(quelle).toContain("lease_until timestamptz NOT NULL");
    expect(quelle).toContain("fencing_token bigint NOT NULL DEFAULT 1");
  });

  it("und die Sperre spricht wirklich diese Tabelle an — Spezifikation und Abfrage passen zusammen", () => {
    // Anti-Vakuum: die DDL oben wäre wertlos, wenn der Adapter eine andere Tabelle abfragte.
    expect(quelle).toContain("INSERT INTO write_fences");
    expect(quelle).toContain("FROM write_fences WHERE key=$1");
  });
});
