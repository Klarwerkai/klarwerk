// ================================================================================================
// JOB 4057 · L1 — DIE PRÜFSUMME BELEGT NICHT, DASS DER DUMP LESBAR IST.
// ================================================================================================
//
// Sie belegt, dass die Bytes seit dem Schreiben unverändert sind. Ob `pg_restore` das Archiv
// überhaupt öffnen kann, stand vor diesem Fall nirgends — der Betreiber erfuhr es erst im Drill,
// also möglicherweise Wochen später und im Ernstfall.
//
// DESHALB WIRD GELESEN, BEVOR VERÖFFENTLICHT WIRD: `pg_restore --list` läuft gegen den
// Arbeitsstand, VOR der Prüfsumme. Scheitert es, bleibt NICHTS liegen — kein Dump, kein Sidecar,
// kein Arbeitsstand — und der Exitcode ist 4.
import { describe, expect, it } from "vitest";
import { lauf } from "./lauf";

describe("L1 · ein unlesbarer Dump wird nicht veröffentlicht", () => {
  it("scheitert mit Exit 4 und hinterlässt kein einziges Artefakt", () => {
    const r = lauf({ modus: "unlesbar" });
    expect(r.code, r.ausgabe).toBe(4);
    expect(
      r.dateien.filter((n) => n.endsWith(".dump")),
      r.ausgabe,
    ).toEqual([]);
    expect(
      r.dateien.filter((n) => n.endsWith(".sha256")),
      r.ausgabe,
    ).toEqual([]);
    expect(
      r.dateien.filter((n) => n.endsWith(".partial")),
      r.ausgabe,
    ).toEqual([]);
  });

  it("nennt den Grund und den Arbeitsstand in der Meldung", () => {
    const r = lauf({ modus: "unlesbar" });
    expect(r.ausgabe).toMatch(/pg_restore/);
    expect(r.ausgabe).toMatch(/\.partial/);
  });

  it("hinterlegt den Fehlschlag in letzter-lauf.json, ohne Erfolgswerte", () => {
    const r = lauf({ modus: "unlesbar" });
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(4);
    expect(e.datei).toBeNull();
    expect(e.bytes).toBeNull();
    expect(e.sha256).toBeNull();
    expect(String(e.grund).length).toBeGreaterThan(10);
  });

  it("ein LESBARER Dump wird veröffentlicht — die Lesbarkeitsprüfung sperrt nicht alles", () => {
    const r = lauf();
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.ausgabe).toBe(1);
  });

  it("die Lesbarkeit wird VOR der Veröffentlichung geprüft, nämlich am Arbeitsstand", () => {
    // Ein `pg_restore --list` NACH dem Umbenennen wäre wertlos: der unlesbare Dump läge dann
    // schon unter seinem Endnamen. Gemessen wird deshalb am Argument des Aufrufs.
    const r = lauf();
    expect(r.code, r.ausgabe).toBe(0);
    const sicht = JSON.stringify(r.aufrufe);
    const liste = r.aufrufe.filter((a) => a[0] === "pg_restore");
    expect(liste.length, sicht).toBe(1);
    expect(liste[0]?.at(-1) ?? "", sicht).toMatch(/\.dump\.partial$/);
  });
});
