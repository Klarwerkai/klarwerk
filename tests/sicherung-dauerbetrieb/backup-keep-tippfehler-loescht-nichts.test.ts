// ================================================================================================
// JOB 4057 · L2c — EIN TIPPFEHLER DARF NIEMALS DEN BESTAND RÄUMEN.
// ================================================================================================
//
// `BACKUP_KEEP=zwei` ist keine Zahl, `BACKUP_KEEP=0` bedeutet „behalte keine" — beides wäre in
// einer stillen Auslegung („0 heisst alles löschen", „nicht-numerisch heisst 0") der Totalverlust.
// Eine Umgebungsvariable wird in einer Coolify-Maske oder einer Cron-Zeile getippt; genau dort
// entstehen solche Werte.
//
// DESHALB: Abbruch mit eigener Meldung, Exit 1, OHNE zu löschen — und ohne überhaupt einen Dump zu
// erzeugen. Die Prüfung steht vor dem `pg_dump`, damit ein fehlkonfigurierter Cron nicht jede Nacht
// eine Datenbank ausliest, die er danach nicht ablegen darf.
import { describe, expect, it } from "vitest";
import { altInhalt, lauf } from "./lauf";

const ALT = ["20260901T010000Z", "20260902T010000Z"] as const;

describe.each(["zwei", "0", "", "-1", "3.5", " 3"])(
  "L2c · BACKUP_KEEP=%j bricht ab, ohne etwas zu entfernen",
  (wert) => {
    it("endet mit Exit 1 und nennt die Variable", () => {
      const r = lauf({ keep: wert, altstempel: ALT });
      expect(r.code, r.ausgabe).toBe(1);
      expect(r.stderr, r.ausgabe).toContain("BACKUP_KEEP");
    });

    it("kein Altpaar entfernt, kein neuer Dump erzeugt", () => {
      const r = lauf({ keep: wert, altstempel: ALT });
      expect(r.dumps, r.dateien.join(" ")).toEqual([
        `klarwerk-${ALT[0]}.dump`,
        `klarwerk-${ALT[1]}.dump`,
      ]);
      for (const stempel of ALT) {
        expect(r.inhalt[`klarwerk-${stempel}.dump`]).toBe(altInhalt(stempel));
        expect(r.dateien).toContain(`klarwerk-${stempel}.dump.sha256`);
      }
      expect(
        r.dateien.filter((n) => n.endsWith(".partial")),
        r.dateien.join(" "),
      ).toEqual([]);
    });

    it("die Datenbank wird gar nicht erst ausgelesen", () => {
      const r = lauf({ keep: wert, altstempel: ALT });
      expect(
        r.aufrufe.map((a) => a[0]),
        JSON.stringify(r.aufrufe),
      ).not.toContain("pg_dump");
    });

    it("der Fehlschlag steht in letzter-lauf.json", () => {
      const r = lauf({ keep: wert, altstempel: ALT });
      const e = r.ergebnis();
      expect(e.ergebnis).toBe("fehler");
      expect(e.exitcode).toBe(1);
      expect(String(e.grund)).toContain("BACKUP_KEEP");
      expect(e.datei).toBeNull();
    });
  },
);
