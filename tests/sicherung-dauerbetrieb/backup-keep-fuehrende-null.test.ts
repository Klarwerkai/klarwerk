// ================================================================================================
// JOB 4057 · L5 (BEN R1, Korrekturpflicht 1) — `BACKUP_KEEP=08` HEISST ACHT.
// ================================================================================================
//
// DER BEFUND, gemessen von BEN am Stand der Runde 1: In der Shell-Arithmetik `$(( ))` ist eine
// führende Null eine BASISANGABE. `010` ist damit oktal und bedeutet 8 — es wurden drei Sicherungen
// zu viel gelöscht. `08` ist überhaupt keine gültige Oktalzahl — der Lauf räumte gar nicht auf und
// meldete trotzdem Erfolg.
//
// WARUM DAS KEIN RANDFALL IST: Wer in eine Coolify-Maske oder eine Cron-Zeile „08" tippt, meint
// acht. Die Null davor ist Gewohnheit aus Uhrzeiten und Datumsangaben, keine Zahlenbasis. Ein
// Aufbewahrungswert, der bei „08" etwas anderes tut als bei „8", löscht entweder zu viel oder gar
// nichts — und beides fällt erst auf, wenn man die Sicherung braucht.
//
// GEPRÜFT WIRD MIT GENUG ALTBESTAND, damit die Verwechslung sichtbar wird: zwölf Altpaare plus der
// neue Lauf sind dreizehn vollständige Sicherungen. Bei acht müssen fünf gehen, bei zehn drei.
import { describe, expect, it } from "vitest";
import { lauf } from "./lauf";

const ZWOELF_ALT = Array.from(
  { length: 12 },
  (_, i) => `202608${String(i + 1).padStart(2, "0")}T000000Z`,
);

describe("L5 · führende Nullen werden dezimal gelesen", () => {
  it.each([
    ["08", 8],
    ["8", 8],
    ["010", 10],
    ["10", 10],
    ["0009", 9],
  ])("BACKUP_KEEP=%s behält genau %i vollständige Sicherungen", (wert, soll) => {
    const r = lauf({ keep: wert, altstempel: ZWOELF_ALT });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(soll);
    // Jedes verbliebene Paar ist vollständig, und die neue Sicherung ist dabei.
    for (const dump of r.dumps) expect(r.dateien).toContain(`${dump}.sha256`);
    const neu = r.dumps.filter((n) => !ZWOELF_ALT.some((s) => n === `klarwerk-${s}.dump`));
    expect(neu.length, r.dumps.join(" ")).toBe(1);
  });

  it("`08` und `8` führen zum identischen Bestand — die Null ändert nichts", () => {
    const mitNull = lauf({ keep: "08", altstempel: ZWOELF_ALT });
    const ohneNull = lauf({ keep: "8", altstempel: ZWOELF_ALT });
    const alt = (r: { dumps: readonly string[] }) =>
      r.dumps.filter((n) => ZWOELF_ALT.some((s) => n === `klarwerk-${s}.dump`));
    expect(alt(mitNull), mitNull.ausgabe).toEqual(alt(ohneNull));
  });

  it("die Meldung nennt den getippten UND den gelesenen Wert", () => {
    const r = lauf({ keep: "08", altstempel: ZWOELF_ALT });
    expect(r.stdout, r.ausgabe).toContain("BACKUP_KEEP=08 (dezimal gelesen: 8)");
  });

  it("und der Erfolg ist auch hinterlegt — kein stiller Halbausgang", () => {
    const r = lauf({ keep: "08", altstempel: ZWOELF_ALT });
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("erfolg");
    expect(e.exitcode).toBe(0);
    // Die Aufbewahrung ist vollständig gelaufen; der Grund trägt deshalb keinen Vorbehalt.
    expect(String(e.grund)).not.toContain("unvollstaendig");
  });

  it("`00` bleibt ein Tippfehler: Abbruch, kein Dump, nichts entfernt", () => {
    // Dezimal gelesen ist `00` = 0 — also „behalte keine". Das bleibt der Abbruchfall.
    const r = lauf({ keep: "00", altstempel: ZWOELF_ALT });
    expect(r.code, r.ausgabe).toBe(1);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(12);
    expect(r.stderr).toContain("BACKUP_KEEP");
    expect(r.ergebnis().ergebnis).toBe("fehler");
  });

  it("eine Zahl jenseits der Shell-Arithmetik ist ein Tippfehler, kein stiller Überlauf", () => {
    const r = lauf({ keep: "99999999999999999999", altstempel: ZWOELF_ALT });
    expect(r.code, r.ausgabe).toBe(1);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(12);
    expect(r.ergebnis().ergebnis).toBe("fehler");
  });
});
