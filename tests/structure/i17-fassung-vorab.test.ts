// ================================================================================================
// REGISTER I17 (R-2033) — DIE PRÜFUNG SITZT IM ABLAUF, NICHT NUR DANEBEN.
// ================================================================================================
//
// `tools/build` ruft als ersten Schritt `tools/fassung-vorab.sh` auf. Gemessen wird hier der echte
// Starter gegen echte Dateien dieses Baums: eine quellseitige Liste der angekommenen Fassung lässt
// ihn durch, eine Liste mit anderer Bytezahl oder Prüfsumme hält ihn VOR der Verwendung an, und
// ohne Liste sagt er „ungeprüft" (oder bricht ab, wenn der Ablauf eine Liste verlangt).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { meldeFassungen } from "../../tools/fassung-pruefen";

const WURZEL = join(import.meta.dirname, "..", "..");
const PFADE = ["package.json", "tools/fassung-pruefen.ts"];

function vorab(env: Record<string, string>): { code: number | null; aus: string } {
  const r = spawnSync("bash", ["tools/fassung-vorab.sh"], {
    cwd: WURZEL,
    encoding: "utf-8",
    env: { ...process.env, KLARWERK_FASSUNG_MANIFEST: "", KLARWERK_FASSUNG_PFLICHT: "", ...env },
  });
  return { code: r.status, aus: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function liste(inhalt: unknown): string {
  const datei = join(mkdtempSync(join(tmpdir(), "kw-i17-vorab-")), "fassung.json");
  writeFileSync(datei, JSON.stringify(inhalt));
  return datei;
}

describe("I17 · Fassungsprüfung vor dem Bau", () => {
  it("V1 · tools/build ruft die Prüfung vor dem ersten Bauschritt auf", () => {
    const build = readFileSync(join(WURZEL, "tools/build"), "utf-8");
    const pruefung = build.indexOf("bash tools/fassung-vorab.sh");
    expect(pruefung, "Aufruf fehlt in tools/build").toBeGreaterThan(-1);
    expect(pruefung).toBeLessThan(build.indexOf("npm run --silent build"));
  });

  it("V2 · gemeldete Fassung gleich der angekommenen: Lauf geht weiter (0)", () => {
    const r = vorab({ KLARWERK_FASSUNG_MANIFEST: liste(meldeFassungen(WURZEL, PFADE)) });
    expect(r.code, r.aus).toBe(0);
    expect(r.aus).toContain("GLEICH      package.json");
  });

  it("V3 · Altfassung (andere Bytezahl bzw. Prüfsumme): Abbruch vor der Verwendung (1)", () => {
    const echt = meldeFassungen(WURZEL, PFADE);
    const [erste, zweite] = echt.dateien;
    if (!erste || !zweite) throw new Error("Fassungsliste unvollständig");
    const gemeldet = {
      dateien: [
        { ...erste, bytes: erste.bytes + 1399 },
        { ...zweite, sha256: "0".repeat(64) },
      ],
    };
    const r = vorab({ KLARWERK_FASSUNG_MANIFEST: liste(gemeldet) });
    expect(r.code, r.aus).toBe(1);
    const erwartet = `gemeldet ${erste.bytes + 1399} Bytes, angekommen ${erste.bytes} Bytes`;
    expect(r.aus).toContain(erwartet);
    expect(r.aus).toContain("ALTFASSUNG? tools/fassung-pruefen.ts: gleiche Länge");
  });

  it("V4 · ohne Liste: ausdrücklich „ungeprüft“; mit Pflicht ist das ein Abbruch", () => {
    const ohne = vorab({});
    expect(ohne.code, ohne.aus).toBe(0);
    expect(ohne.aus).toContain("Übertragung ungeprüft");
    const pflicht = vorab({ KLARWERK_FASSUNG_PFLICHT: "1" });
    expect(pflicht.code, pflicht.aus).toBe(1);
  });

  it("V5 · unlesbare Liste: nichts geprüft, eigener Code (2)", () => {
    const r = vorab({ KLARWERK_FASSUNG_MANIFEST: liste({ falsch: true }) });
    expect(r.code, r.aus).toBe(2);
  });
});
