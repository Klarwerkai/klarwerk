// ================================================================================================
// AUFNAHME 20260922 · GESAMT-PRUEFDIENST — DER BESTANDSABGLEICH ZEIGT AUF VORHANDENES.
// ================================================================================================
//
// `docs/entscheidungen/pruefdienst-bestandsabgleich.md` ordnet die heute vorhandenen Prüfweg-
// Funktionen den Originalpunkten zu (Nacharbeit 6, Bens Befund zum Bestandsabgleich). Diese Datei
// hält fest:
//   · Z   jede genannte Datei im Produktbaum liegt im Bestand;
//   · F   die tragenden Namen der Produkt-Leseregel stehen in der genannten Datei;
//   · K   jeder Originalpunkt K1–K16 hat einen eigenen Abschnitt mit seiner R-Nummer;
//   · Q   die sieben ausgewerteten Koordinationsmodule sind mit SHA-256 an ihre Fassung gebunden;
//   · G   das Dokument behauptet keine Gesamterfüllung und wählt die offene Entscheidung nicht.
//
// WAS DIESE DATEI NICHT BELEGT: das Verhalten der Koordinationsmodule. Sie liegen außerhalb des
// Produktbaums; ihre Fundstellen belegt die Quellenführung, nicht dieser Test.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOKUMENT = "docs/entscheidungen/pruefdienst-bestandsabgleich.md";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");
const flach = (pfad: string): string => lies(pfad).replace(/\s+/g, " ");

const PFADANGABE = /`((?:services|tests|apps|docs|scripts|tools)\/[^`\s]*)`/g;

const ABSCHNITTE: ReadonlyArray<readonly [string, string]> = [
  ["K1", "R-1201"],
  ["K2", "R-1202"],
  ["K3", "R-1231"],
  ["K4", "R-1248"],
  ["K5", "R-1258"],
  ["K6", "R-1326"],
  ["K7", "R-1362"],
  ["K8", "R-1379"],
  ["K9", "R-1380"],
  ["K10", "R-1414"],
  ["K11", "R-1440"],
  ["K12", "R-1465"],
  ["K13", "R-1478"],
  ["K14", "R-1486"],
  ["K15", "R-2021"],
];

const MODULE = [
  "dienst.py",
  "benurteil.py",
  "befund.py",
  "fortsetzung.py",
  "produkt.py",
  "laufzeit.py",
  "auftragsstand.py",
];

describe("Gesamt-Prüfdienst · Bestandsabgleich", () => {
  it("Z: jede genannte Datei im Produktbaum liegt im Bestand", () => {
    const pfade = [...new Set([...lies(DOKUMENT).matchAll(PFADANGABE)].map((t) => t[1] ?? ""))];
    expect(pfade.length).toBeGreaterThan(5);
    expect(pfade.filter((p) => !existsSync(p))).toEqual([]);
  });

  it("F: die tragenden Namen der Produkt-Leseregel stehen in der genannten Datei", () => {
    const urteilslage = lies("tools/urteilslage.ts");
    expect(urteilslage).toContain("export function gesamturteil(");
    expect(urteilslage).toContain("export function istTeilurteil(");
    expect(urteilslage).toContain("export function ohneCodebloecke(");
    expect(lies("tools/schon-eingebaut.ts")).toContain("export function erklaertNullWrites(");
  });

  it("K: jeder Originalpunkt hat einen eigenen Abschnitt mit seiner R-Nummer", () => {
    const text = lies(DOKUMENT);
    for (const [k, r] of ABSCHNITTE) {
      expect(text, `${k} · ${r}`).toContain(`### ${k} · ${r} — `);
    }
    expect(text).toContain("### K16 — ");
  });

  it("Q: die sieben Koordinationsmodule sind mit SHA-256 an ihre Fassung gebunden", () => {
    const text = lies(DOKUMENT);
    for (const modul of MODULE) {
      expect(text, modul).toMatch(new RegExp(`\\| \`${modul}\` \\| \`[0-9a-f]{64}\` \\|`));
    }
  });

  it("G: keine Gesamterfüllung, offene Entscheidung bleibt offen, Abgrenzung benannt", () => {
    const text = flach(DOKUMENT);
    expect(text).toContain("eine Erfüllungsbehauptung für alle 16 Kriterien");
    expect(text).toContain("**offene Produktentscheidung**");
    expect(text).toContain("**Das entscheide ich nicht selbst.**");
    for (const abgeschlossen of ["**R-1216**", "**R-1238**", "**R-1301**", "**R-1235**"]) {
      expect(text).toContain(abgeschlossen);
    }
  });
});
