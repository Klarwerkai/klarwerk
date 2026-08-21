import { describe, expect, it } from "vitest";
import {
  type BestandsresetLauf,
  SQL_COMMITMERKMAL_SETZEN,
  bestandsresetBefund,
  letzterBestandsresetLauf,
  loeseBestandsresetAuf,
} from "./bestandsreset-audit";
import type { Queryable } from "./tx";

// ================================================================================================
// JOB 596 — DER AUDITAUTOMAT UNTER TEST.
// ================================================================================================
//
// Die Auflösung ist eine reine Funktion: zwei Eingaben, ein Befund, kein I/O. Sie ist damit ohne
// Datenbank vollständig prüfbar — und das ist kein Zufall, sondern der Grund für ihren Zuschnitt.
// Die eine Aussage, die sie treffen muss („steht mein Bestand noch?"), darf nicht davon abhängen,
// ob gerade jemand eine Datenbank starten kann.

const lauf = (status: BestandsresetLauf["status"], merkmal: Date | null): BestandsresetLauf => ({
  id: "r1",
  status,
  payloadCommittedAt: merkmal,
});

const COMMITZEIT = new Date("2026-08-18T04:00:00.000Z");

describe("A — die Auflösung des letzten Laufs", () => {
  it("A1: Merkmal fehlt, Sperre frei → ROLLED_BACK_BY_CRASH, Bestand steht auf P0", () => {
    const befund = loeseBestandsresetAuf(lauf("RUNNING", null), false);

    expect(befund.zustand).toBe("ROLLED_BACK_BY_CRASH");
    expect(befund.bestandIstP0).toBe(true);
    expect(befund.erfolgMeldbar).toBe(false);
  });

  it("A2: Sperre gehalten → RUNNING, und über den Bestand wird NICHTS behauptet", () => {
    const befund = loeseBestandsresetAuf(lauf("RUNNING", null), true);

    expect(befund.zustand).toBe("RUNNING");
    // `undefined`, nicht `false`: der Lauf arbeitet, eine Bestandsaussage wäre geraten.
    expect(befund.bestandIstP0).toBeUndefined();
    expect(befund.erfolgMeldbar).toBe(false);
  });

  it("A3: Merkmal DA, Sperre frei → COMMITTED_AUDIT_MISSING, Bestand NICHT P0, kein Erfolg", () => {
    const befund = loeseBestandsresetAuf(lauf("RUNNING", COMMITZEIT), false);

    expect(befund.zustand).toBe("COMMITTED_AUDIT_MISSING");
    expect(befund.bestandIstP0).toBe(false);
    expect(befund.erfolgMeldbar).toBe(false);
  });

  it("A3-Unterscheidbarkeit: DIESELBE Sperrlage, zwei verschiedene Wahrheiten", () => {
    // Der Fall, der die Auflage wörtlich nimmt. „RUNNING plus freie Sperre" ist in beiden Zeilen
    // identisch — allein das Commitmerkmal trennt „der Bestand steht" von „der Bestand ist weg".
    const ohne = loeseBestandsresetAuf(lauf("RUNNING", null), false);
    const mit = loeseBestandsresetAuf(lauf("RUNNING", COMMITZEIT), false);

    expect(ohne.zustand).not.toBe(mit.zustand);
    expect(ohne.bestandIstP0).toBe(true);
    expect(mit.bestandIstP0).toBe(false);
  });

  it("A4: sauberer Lauf (OK mit Merkmal) → OK, Erfolg meldbar", () => {
    const befund = loeseBestandsresetAuf(lauf("OK", COMMITZEIT), false);

    expect(befund.zustand).toBe("OK");
    expect(befund.bestandIstP0).toBe(false);
    expect(befund.erfolgMeldbar).toBe(true);
  });

  it("A4b: sauber zurückgerollt → ROLLED_BACK, Bestand P0, kein Erfolg", () => {
    const befund = loeseBestandsresetAuf(lauf("ROLLED_BACK", null), false);

    expect(befund.zustand).toBe("ROLLED_BACK");
    expect(befund.bestandIstP0).toBe(true);
    expect(befund.erfolgMeldbar).toBe(false);
  });

  it("A5: OK OHNE Merkmal → INCONSISTENT, fail-closed", () => {
    const befund = loeseBestandsresetAuf(lauf("OK", null), false);

    expect(befund.zustand).toBe("INCONSISTENT");
    expect(befund.bestandIstP0).toBeUndefined();
    expect(befund.erfolgMeldbar).toBe(false);
  });

  it("A6: ROLLED_BACK MIT Merkmal → INCONSISTENT, ebenfalls fail-closed", () => {
    // Die Gegenrichtung zu A5: Ein Lauf, der zurückgerollt sein will, dessen Nutzdatentransaktion
    // aber committet hat. Auch hier wird geschwiegen statt geraten.
    const befund = loeseBestandsresetAuf(lauf("ROLLED_BACK", COMMITZEIT), false);

    expect(befund.zustand).toBe("INCONSISTENT");
    expect(befund.bestandIstP0).toBeUndefined();
    expect(befund.erfolgMeldbar).toBe(false);
  });

  it("A7: ein abgeschlossener Lauf wird nicht durch eine gehaltene Sperre umgedeutet", () => {
    // Eine fremde Sperre auf demselben Schlüssel darf einen abgeschlossenen Lauf nicht in
    // „läuft noch" zurückverwandeln — der geschriebene Endstand hat Vorrang.
    expect(loeseBestandsresetAuf(lauf("OK", COMMITZEIT), true).zustand).toBe("OK");
    expect(loeseBestandsresetAuf(lauf("ROLLED_BACK", null), true).zustand).toBe("ROLLED_BACK");
  });

  it("kein Zustand meldet Erfolg außer OK", () => {
    const alle = [
      loeseBestandsresetAuf(lauf("RUNNING", null), true),
      loeseBestandsresetAuf(lauf("RUNNING", null), false),
      loeseBestandsresetAuf(lauf("RUNNING", COMMITZEIT), false),
      loeseBestandsresetAuf(lauf("ROLLED_BACK", null), false),
      loeseBestandsresetAuf(lauf("OK", null), false),
      loeseBestandsresetAuf(lauf("ROLLED_BACK", COMMITZEIT), false),
    ];

    expect(alle.filter((b) => b.erfolgMeldbar)).toHaveLength(0);
    expect(loeseBestandsresetAuf(lauf("OK", COMMITZEIT), false).erfolgMeldbar).toBe(true);
  });
});

describe("das Commitmerkmal steht IN der Nutzdatentransaktion", () => {
  it("die Anweisung ist ein reines UPDATE — kein eigenes COMMIT, kein zweites Fenster", () => {
    // Trüge sie ihr eigenes COMMIT, wäre sie eine zweite Transaktion und damit genau das Fenster,
    // dessen Schließung ihr ganzer Zweck ist.
    expect(SQL_COMMITMERKMAL_SETZEN).toContain("UPDATE bestandsreset_laeufe");
    expect(SQL_COMMITMERKMAL_SETZEN).toContain("payload_committed_at");
    expect(SQL_COMMITMERKMAL_SETZEN).not.toContain("COMMIT");
    expect(SQL_COMMITMERKMAL_SETZEN).not.toContain("BEGIN");
  });
});

describe("der Leseweg", () => {
  function dbDoppel(zeilen: unknown[]): { db: Queryable; anweisungen: string[] } {
    const anweisungen: string[] = [];
    const db: Queryable = {
      query: async <T>(text: string) => {
        anweisungen.push(text);
        return { rows: zeilen as T[], rowCount: zeilen.length };
      },
    };
    return { db, anweisungen };
  }

  it("ohne jeden Lauf gibt es keinen Befund — Abwesenheit wird nicht in einen Zustand übersetzt", async () => {
    const { db } = dbDoppel([]);

    expect(await letzterBestandsresetLauf(db)).toBeUndefined();
    expect(await bestandsresetBefund(db, async () => false)).toBeUndefined();
  });

  it("die Zeile wird treu übersetzt, NULL bleibt null", async () => {
    const { db } = dbDoppel([{ id: "r9", status: "RUNNING", payload_committed_at: null }]);

    expect(await letzterBestandsresetLauf(db)).toEqual({
      id: "r9",
      status: "RUNNING",
      payloadCommittedAt: null,
    });
  });

  it("der Befund verbindet den Lauf mit dem Lebenszeichen der Sperre", async () => {
    const { db } = dbDoppel([{ id: "r9", status: "RUNNING", payload_committed_at: COMMITZEIT }]);

    expect((await bestandsresetBefund(db, async () => true))?.zustand).toBe("RUNNING");
    expect((await bestandsresetBefund(db, async () => false))?.zustand).toBe(
      "COMMITTED_AUDIT_MISSING",
    );
  });

  it("gelesen wird der JÜNGSTE Lauf", async () => {
    const { db, anweisungen } = dbDoppel([
      { id: "r9", status: "OK", payload_committed_at: COMMITZEIT },
    ]);

    await letzterBestandsresetLauf(db);

    expect(anweisungen[0]).toContain("ORDER BY gestartet_at DESC");
    expect(anweisungen[0]).toContain("LIMIT 1");
  });
});
