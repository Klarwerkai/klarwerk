// ================================================================================================
// REGISTER I17 (R-2033, R-0969, R-0128) — DIE ÜBERTRAGENE FASSUNG GEGEN BYTEZAHL UND PRÜFSUMME.
// ================================================================================================
//
// Der Fall vom 29.07.: `provider.ts` kam mit 64.256 Bytes und altem Code an, die Maschine trug
// 65.655 Bytes und den neuen. Fall A stellt genau diese beiden Längen nach. Fall B ist der Fall,
// den die Bytezahl allein NICHT sieht und für den R-0969 die Inhaltsprüfsumme verlangt: gleiche
// Länge, anderer Inhalt. Die Aufrufertests laufen über den echten Starter (`node tools/…`), nicht
// über die exportierten Funktionen allein — der Exitcode ist das, worauf sich ein Kopf verlässt.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  liesManifest,
  meldeFassungen,
  pruefeFassungen,
  sichererPfad,
} from "../../tools/fassung-pruefen";

const WURZEL = join(import.meta.dirname, "..", "..");

function ablage(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-i17-"));
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    mkdirSync(dirname(join(wurzel, pfad)), { recursive: true });
    writeFileSync(join(wurzel, pfad), inhalt);
  }
  return wurzel;
}

// `stdout` getrennt: dorthin schreibt `melden` das Manifest; eine Laufzeitwarnung auf stderr darf
// es nicht verunreinigen.
function starter(args: string[]): { code: number | null; stdout: string; aus: string } {
  const r = spawnSync(process.execPath, ["tools/fassung-pruefen.ts", ...args], {
    cwd: WURZEL,
    encoding: "utf-8",
  });
  return { code: r.status, stdout: r.stdout ?? "", aus: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const PFAD = "services/reasoner/src/provider.ts";
const NEU = "n".repeat(65_655);
const ALT = "a".repeat(64_256);

describe("I17 · Fassungsprüfung", () => {
  it("A · der Fall vom 29.07.: 64.256 statt 65.655 Bytes wird mit beiden Zahlen gemeldet", () => {
    const manifest = meldeFassungen(ablage({ [PFAD]: NEU }), [PFAD]);
    expect(manifest.dateien[0]?.bytes).toBe(65_655);
    const befund = pruefeFassungen(ablage({ [PFAD]: ALT }), manifest);
    expect(befund).toEqual([
      { pfad: PFAD, zustand: "bytes_abweichend", gemeldet: 65_655, angekommen: 64_256 },
    ]);
  });

  it("B · gleiche Bytezahl, anderer Inhalt: nur die Prüfsumme sieht die Altfassung", () => {
    const manifest = meldeFassungen(ablage({ "a.ts": "return x < 1;" }), ["a.ts"]);
    const befund = pruefeFassungen(ablage({ "a.ts": "return x > 1;" }), manifest);
    expect(befund[0]?.zustand).toBe("inhalt_abweichend");
  });

  it("C · identische Fassung ist gleich; eine fehlende Datei wird einzeln benannt", () => {
    const quelle = ablage({ "a.ts": "eins", "b.ts": "zwei" });
    const manifest = meldeFassungen(quelle, ["a.ts", "b.ts"]);
    expect(pruefeFassungen(ablage({ "a.ts": "eins" }), manifest)).toEqual([
      { pfad: "a.ts", zustand: "gleich", bytes: 4 },
      { pfad: "b.ts", zustand: "fehlt" },
    ]);
  });

  it("D · Manifestpfade dürfen die Wurzel nicht verlassen; kaputte Zeilen werden abgelehnt", () => {
    for (const p of ["../geheim", "/etc/passwd", "a/../../b", ""]) {
      expect(sichererPfad(p), p).toBe(false);
    }
    expect(sichererPfad("a/b/../c.ts")).toBe(true);
    const ausbruch = { dateien: [{ pfad: "../x", bytes: 1, sha256: "0".repeat(64) }] };
    expect(() => liesManifest(JSON.stringify(ausbruch))).toThrow();
    expect(() => liesManifest(JSON.stringify({ dateien: [{ pfad: "x", bytes: 1 }] }))).toThrow();
  });

  it("E · Starter: 0 bei gleicher Fassung, 1 bei Altfassung, 2 bei kaputtem Manifest", () => {
    const quelle = ablage({ [PFAD]: NEU });
    const gemeldet = starter(["melden", quelle, PFAD]);
    expect(gemeldet.code).toBe(0);
    const manifestDatei = join(ablage({}), "manifest.json");
    writeFileSync(manifestDatei, gemeldet.stdout);

    expect(starter(["pruefen", quelle, manifestDatei]).code).toBe(0);

    const alt = starter(["pruefen", ablage({ [PFAD]: ALT }), manifestDatei]);
    expect(alt.code).toBe(1);
    expect(alt.aus).toContain("gemeldet 65655 Bytes, angekommen 64256 Bytes");

    const kaputt = join(ablage({}), "kaputt.json");
    writeFileSync(kaputt, "{}");
    expect(starter(["pruefen", quelle, kaputt]).code).toBe(2);
  });
});
