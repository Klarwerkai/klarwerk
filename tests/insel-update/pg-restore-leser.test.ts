// ================================================================================================
// JOB 4012 · DER PG_RESTORE-TESTLESER LEHNT EIN ABGEBROCHENES LESEN AB (Ben an e7a1d080/ab851092, K2)
// ================================================================================================
//
// DER BEFUND: Der Leser las mit `GELESEN="$(cat "$DATEI"; printf x)"`. Brach `cat` ab, lief `printf`
// trotzdem, und DESSEN Exit 0 war der Status der Ersetzung. War das bis dahin gelesene Anfangsstück
// für sich ein gültiger Probe-Dump, meldete der Leser „lesbar" — ein Lesefehler wurde zu Grün.
//
// DIE GEGENPROBE: Vorne im PATH des Lesers liegt eine `cat`-Attrappe, die von einer 31 Byte grossen
// Datei nur die ersten 10 Byte ausgibt (genau den gültigen Probe-Dump) und mit Exit 7 endet. Der
// jetzige Leser muss ablehnen; die bisherige Form, im selben Test gefahren, nimmt es hin — damit ist
// belegt, dass diese Gegenprobe den alten Leser rot gemacht hätte.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PG_RESTORE_ATTRAPPE } from "./insel-probe";

/** Das gültige Anfangsstück: für sich genau der Probe-Dump, den der Leser annimmt. */
const ANFANG = "PROBE-DUMP";
const DATEIINHALT = `${ANFANG}-ABGEBROCHEN-REST-XYZ`;

/** Der Leseschritt, wie er an e7a1d080/ab851092 stand — `printf` verdeckt den Status von `cat`. */
const BISHERIGER_LESESCHRITT = `if ! GELESEN="$(cat "$DATEI"; printf x)"; then
  echo "pg_restore: error: could not read input file \\"$DATEI\\"" >&2
  exit 1
fi
GELESEN="\${GELESEN%x}"
`;

/** Der heutige Leser mit dem bisherigen Leseschritt an dessen Stelle — alles andere gleich. */
function bisherigerLeser(): string {
  const anfang = PG_RESTORE_ATTRAPPE.indexOf("export LC_ALL=C\n");
  const ende = PG_RESTORE_ATTRAPPE.indexOf('if [ -z "$GELESEN" ]');
  expect(anfang, "Leseschritt im heutigen Leser nicht gefunden").toBeGreaterThan(0);
  expect(ende).toBeGreaterThan(anfang);
  return (
    PG_RESTORE_ATTRAPPE.slice(0, anfang) + BISHERIGER_LESESCHRITT + PG_RESTORE_ATTRAPPE.slice(ende)
  );
}

/** Eine `cat`-Attrappe: gibt die ersten 10 Byte der letzten Argumentdatei aus, endet mit `code`. */
function catAttrappe(code: number): string {
  return `#!/usr/bin/env bash
head -c 10 -- "\${@: -1}"
exit ${code}
`;
}

let ordner: string | undefined;
afterEach(() => {
  if (ordner !== undefined) {
    rmSync(ordner, { recursive: true, force: true });
    ordner = undefined;
  }
});

interface Ergebnis {
  code: number | null;
  stderr: string;
  stdout: string;
}

/** Fährt `leser --list <31-Byte-Datei>`; `cat` ist die Attrappe mit `catCode`, oder das echte. */
function fahreLeser(leser: string, dumpinhalt: string, catCode?: number): Ergebnis {
  ordner = mkdtempSync(join(tmpdir(), "klarwerk-pg-restore-leser-"));
  const datei = join(ordner, "probe.dump");
  writeFileSync(datei, DATEIINHALT);
  const skript = join(ordner, "pg_restore");
  writeFileSync(skript, leser, { mode: 0o755 });
  const pfad = [process.env.PATH ?? ""];
  if (catCode !== undefined) {
    const attrappen = join(ordner, "bin");
    mkdirSync(attrappen);
    writeFileSync(join(attrappen, "cat"), catAttrappe(catCode), { mode: 0o755 });
    pfad.unshift(attrappen);
  }
  const lauf = spawnSync("bash", [skript, "--list", datei], {
    encoding: "utf8",
    env: { ...process.env, PATH: pfad.join(":"), KLARWERK_PROBE_DUMPINHALT: dumpinhalt },
  });
  return { code: lauf.status, stderr: lauf.stderr, stdout: lauf.stdout };
}

describe("JOB 4012 · pg_restore-Testleser — ein abgebrochenes Lesen ist ein Lesefehler", () => {
  it("L1 · Gegenprobe: cat bricht nach dem gültigen Anfangsstück mit Exit 7 ab — der Leser lehnt ab", () => {
    expect(Buffer.byteLength(DATEIINHALT)).toBe(31);
    expect(Buffer.byteLength(ANFANG)).toBe(10);

    const lauf = fahreLeser(PG_RESTORE_ATTRAPPE, ANFANG, 7);
    expect(lauf.code, lauf.stderr).not.toBe(0);
    expect(lauf.stderr).toContain("Lesefehler");
    expect(lauf.stdout).not.toContain("Archive created");
  });

  it("L2 · Kontrolle: derselbe Aufbau mit der bisherigen Form `cat; printf x` nimmt es hin (Exit 0)", () => {
    // Genau das war der Fehler: ohne diese Zeile wäre L1 nicht als Regressionsprobe belegt.
    const lauf = fahreLeser(bisherigerLeser(), ANFANG, 7);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(lauf.stdout).toContain("Archive created");
  });

  it("L3 · ein unvollständiges Lesen ohne Fehlerstatus (cat Exit 0, 10 von 31 Byte) wird abgelehnt", () => {
    const lauf = fahreLeser(PG_RESTORE_ATTRAPPE, ANFANG, 0);
    expect(lauf.code, lauf.stderr).not.toBe(0);
    expect(lauf.stderr).toContain("read 10 of 31 bytes (Lesefehler)");
  });

  it("L4 · positiv: eine vollständig gelesene Datei mit dem Probe-Dump ergibt Exit 0", () => {
    const lauf = fahreLeser(PG_RESTORE_ATTRAPPE, DATEIINHALT);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(lauf.stderr).toBe("");
    expect(lauf.stdout).toContain("Archive created");
  });
});
