// ================================================================================================
// JOB 4057 · L2b — WAS DIE AUFBEWAHRUNG NIEMALS ANFASST.
// ================================================================================================
//
// ZWEI DINGE IM SICHERUNGSVERZEICHNIS GEHÖREN DIESEM SKRIPT NICHT:
//
//   · Ein `*.dump` OHNE Sidecar. Nach dem Vertrag aus `RESTORE.md:17-31` ist das kein regulär
//     entstandenes Backup dieses Skripts — es kam von Hand, aus einer Kopie, von woanders. Es wird
//     weder mitgezählt noch gelöscht. Würde es mitgezählt, verschiebe sich die Grenze und ein
//     ECHTES Paar fiele zu früh weg.
//   · Ein `*.dump.partial`. Das ist der Arbeitsstand eines gleichzeitig laufenden Laufs. Wer ihn
//     löscht, zerstört eine Sicherung, die gerade entsteht.
//
// `BACKUP_KEEP=1` ist hier der härteste Fall: die Regel will so viel entfernen wie möglich.
import { describe, expect, it } from "vitest";
import { altInhalt, lauf } from "./lauf";

const ALT = ["20260901T010000Z", "20260902T010000Z"] as const;
const OHNE_SIDECAR = "20260810T010000Z";
const FREMD = "20260811T010000Z";

describe("L2b · Fremdes im Zielverzeichnis bleibt unberührt", () => {
  it("ein Dump ohne Sidecar existiert danach unverändert", () => {
    const r = lauf({
      keep: "1",
      altstempel: ALT,
      ohneSidecar: [OHNE_SIDECAR],
      fremdePartial: [FREMD],
    });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dateien, r.dateien.join(" ")).toContain(`klarwerk-${OHNE_SIDECAR}.dump`);
    expect(r.inhalt[`klarwerk-${OHNE_SIDECAR}.dump`]).toBe(altInhalt(OHNE_SIDECAR));
    // Es bekommt auch keinen Sidecar angedichtet.
    expect(r.dateien).not.toContain(`klarwerk-${OHNE_SIDECAR}.dump.sha256`);
  });

  it("der Arbeitsstand eines fremden Laufs existiert danach unverändert", () => {
    const r = lauf({
      keep: "1",
      altstempel: ALT,
      ohneSidecar: [OHNE_SIDECAR],
      fremdePartial: [FREMD],
    });
    expect(r.dateien, r.dateien.join(" ")).toContain(`klarwerk-${FREMD}.dump.partial`);
    expect(r.inhalt[`klarwerk-${FREMD}.dump.partial`]).toBe(altInhalt(FREMD));
  });

  it("der unpaarige Dump wird NICHT mitgezählt: beide echten Altpaare gehen, das neue bleibt", () => {
    const r = lauf({
      keep: "1",
      altstempel: ALT,
      ohneSidecar: [OHNE_SIDECAR],
      fremdePartial: [FREMD],
    });
    for (const stempel of ALT) {
      expect(r.dateien, r.dateien.join(" ")).not.toContain(`klarwerk-${stempel}.dump`);
      expect(r.dateien, r.dateien.join(" ")).not.toContain(`klarwerk-${stempel}.dump.sha256`);
    }
    // Genau zwei Dumps liegen danach da: der unpaarige Fremdling und die neue Sicherung.
    expect(r.dumps.length, r.dateien.join(" ")).toBe(2);
    expect(r.dateien.filter((n) => n.endsWith(".sha256")).length, r.dateien.join(" ")).toBe(1);
  });

  it("die Meldung nennt nur, was wirklich entfernt wurde", () => {
    const r = lauf({
      keep: "1",
      altstempel: ALT,
      ohneSidecar: [OHNE_SIDECAR],
      fremdePartial: [FREMD],
    });
    expect(r.stdout).not.toContain(`klarwerk-${OHNE_SIDECAR}.dump`);
    expect(r.stdout).not.toContain(`klarwerk-${FREMD}.dump.partial`);
    for (const stempel of ALT) expect(r.stdout).toContain(`klarwerk-${stempel}.dump`);
  });
});
