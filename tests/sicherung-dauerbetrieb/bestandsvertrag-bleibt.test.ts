// ================================================================================================
// JOB 4057 · L4 — DER BESTANDSVERTRAG. Dieser Fall ist heute schon grün und muss grün bleiben.
// ================================================================================================
//
// An ihm hängen zwei andere Wege:
//
//   · Der Drill (`scripts/backup/restore-drill.sh`) verweigert `pg_restore` ohne gültigen Sidecar
//     (Exit 10/11). Das Sidecarformat — 64 Hex, zwei Leerzeichen, DER ENDNAME — ist deshalb kein
//     Zubehör, sondern eine Schnittstelle.
//   · Die Admin-Fläche liest „ein `*.dump` MIT Sidecar ist ein reguläres Backup dieses Skripts".
//
// UND: OHNE `BACKUP_KEEP` ÄNDERT SICH NICHTS. Ein Aufrufer, der vor einem Update sichert und den
// erzeugten Dump für den Rückfall braucht, verliert durch dieses Update kein einziges Backup — die
// Aufbewahrung ist opt-in. Das ist die Zusage, die dieser Fall festhält.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { SKRIPT, altInhalt, lauf, sha256 } from "./lauf";

const ALT = ["20260901T010000Z", "20260902T010000Z"] as const;

describe("L4 · ohne BACKUP_KEEP bleibt jeder bestehende Vertrag zeichengleich", () => {
  it("das Skript ist syntaktisch gültig (bash -n)", () => {
    // Die Abnahmeprüfung `bash -n scripts/backup/backup.sh` als dauerhafter Fall: ein Syntaxfehler
    // in einem Skript, das nur nachts läuft, fällt sonst erst nachts auf.
    const p = spawnSync("bash", ["-n", SKRIPT], { encoding: "utf8" });
    expect(p.status, p.stderr).toBe(0);
  });

  it("Exit 0 und ein Endname im Format des Skripts", () => {
    const r = lauf({ altstempel: ALT });
    expect(r.code, r.ausgabe).toBe(0);
    const neu = r.dumps.filter((n) => !ALT.some((s) => n === `klarwerk-${s}.dump`));
    expect(neu.length, r.dumps.join(" ")).toBe(1);
    expect(neu[0]).toMatch(/^klarwerk-\d{8}T\d{6}Z\.dump$/);
  });

  it("der Sidecar trägt 64 Hex, zwei Leerzeichen und den ENDNAMEN", () => {
    const r = lauf({ altstempel: ALT });
    const neu = r.dumps.filter((n) => !ALT.some((s) => n === `klarwerk-${s}.dump`))[0] ?? "";
    const sidecar = r.inhalt[`${neu}.sha256`] ?? "";
    expect(sidecar).toMatch(/^[0-9a-f]{64} {2}klarwerk-\d{8}T\d{6}Z\.dump\n?$/);
    expect(sidecar).toContain(neu);
    expect(sidecar.slice(0, 64)).toBe(sha256(r.inhalt[neu] ?? ""));
  });

  it("kein Arbeitsstand bleibt liegen", () => {
    const r = lauf({ altstempel: ALT });
    expect(
      r.dateien.filter((n) => n.endsWith(".partial")),
      r.dateien.join(" "),
    ).toEqual([]);
  });

  it("KEIN Altpaar entfernt — die Aufbewahrung ist opt-in", () => {
    const r = lauf({ altstempel: ALT });
    expect(r.dumps.length, r.dateien.join(" ")).toBe(3);
    for (const stempel of ALT) {
      expect(r.inhalt[`klarwerk-${stempel}.dump`]).toBe(altInhalt(stempel));
      expect(r.dateien).toContain(`klarwerk-${stempel}.dump.sha256`);
    }
    expect(r.stdout, r.ausgabe).not.toContain("entfernt");
  });

  it("die gemeldeten Bytes stimmen mit der Datei überein", () => {
    // NUR die Bestandsmeldung auf stdout. Dass `letzter-lauf.json` dieselbe Zahl trägt, prüft L3 —
    // dieser Fall muss am HEUTIGEN Skript grün sein, sonst hütet er den Bestand nicht.
    const r = lauf({ altstempel: ALT });
    const neu = r.dumps.filter((n) => !ALT.some((s) => n === `klarwerk-${s}.dump`))[0] ?? "";
    const laenge = Buffer.byteLength(r.inhalt[neu] ?? "", "utf8");
    expect(r.stdout, r.ausgabe).toContain(`${laenge} Bytes`);
  });

  it("die drei Abschlusszeilen des Skripts bleiben erhalten", () => {
    const r = lauf({ altstempel: ALT });
    expect(r.stdout).toContain("[backup] fertig");
    expect(r.stdout).toContain("[backup] Pruefsumme:");
    expect(r.stdout).toContain("scripts/backup/RESTORE.md");
  });

  it("das Zielverzeichnis aus dem Argument gilt — auch von einem fremden Arbeitsverzeichnis aus", () => {
    // Der CWD-Vertrag aus JOB 943: der Prüfstand startet das Skript mit `cwd` ausserhalb des
    // Baums. Läge der Dump am Aufrufort statt am Ziel, wäre dieser Fall leer.
    const r = lauf();
    expect(r.dumps.length, r.dateien.join(" ")).toBe(1);
  });
});
