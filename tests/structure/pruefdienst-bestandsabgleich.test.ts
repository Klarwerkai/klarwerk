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
//   · G   das Dokument behauptet keine Gesamterfüllung und stellt beauftragte Restanforderungen
//         nicht als offene Produktentscheidung zurück.
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

  it("G: keine Gesamterfüllung, Abgrenzung benannt, keine zurückgestellte Entscheidung", () => {
    const text = flach(DOKUMENT);
    expect(text).toContain("eine Erfüllungsbehauptung für alle 16 Kriterien");
    // Nacharbeit 8 (Ben): Beauftragte Restanforderungen sind keine offenen Produktentscheidungen.
    expect(text).not.toContain("**offene Produktentscheidung**");
    expect(text).not.toContain("Das entscheide ich nicht selbst");
    for (const abgeschlossen of ["**R-1216**", "**R-1238**", "**R-1301**", "**R-1235**"]) {
      expect(text).toContain(abgeschlossen);
    }
  });

  // Bens Befunde (Nacharbeit 7): nur Belegtes anerkennen, Ungeklärtes als ungeklärt führen,
  // keine Lieferpflicht ohne Quellenanforderung erfinden.
  const abschnitt = (kopf: string): string => {
    const text = lies(DOKUMENT);
    const start = text.indexOf(kopf);
    const ende = text.indexOf("\n### ", start + kopf.length);
    return text.slice(start, ende === -1 ? undefined : ende).replace(/\s+/g, " ");
  };

  it("K14: nur Fließtext-Härtung und Einzeldateierfassung anerkannt, Erkennung ungeklärt", () => {
    const k14 = abschnitt("### K14 · R-1486 — ");
    expect(k14).toContain("**Belegt: Fließtext-Härtung im Produktbaum.**");
    expect(k14).toContain("**Belegt: Erfassung neuer Dateien einzeln (zweiter Messfehler).**");
    expect(k14).toContain("**Ungeklärt: Auftragsart-Erkennung des heutigen Wegs.**");
    expect(k14).toContain("bestimmen keine Auftragsart");
    expect(k14).not.toContain("Bewertung: **erfüllt.**");
  });

  it("K15: keine Ablösung durch R-1362; Parallelität getrennt und ungeklärt", () => {
    const k15 = abschnitt("### K15 · R-2021 — ");
    expect(k15).toContain("R-1362 hebt R-2021 nicht auf");
    expect(k15).toContain("**Parallelität zur weiterarbeitenden Hand: ungeklärt.**");
    expect(k15).not.toContain("durch R-1362 ersetzt");
    expect(flach(DOKUMENT)).not.toContain("R-2021 gegen R-1362 (K15) sind oben eingeordnet");
  });

  it("K9: teilweise erfüllt, technische Restanforderung und Zuständigkeitsgrenze benannt", () => {
    const k9 = abschnitt("### K9 · R-1380 — ");
    expect(k9).toContain("Bewertung: **teilweise erfüllt, technische Restanforderung offen.**");
    expect(k9).toContain("**Es fehlen die Ordnungsschlüssel „Produktnähe“ und „Tests“.**");
    expect(k9).toContain(
      "Die zentrale Priorität, die heute an erster Stelle steht, löst R-1380 **nicht** ab.",
    );
    expect(k9).toContain("**Zuständigkeitsgrenze:** Die Sortierung steht in `dienst.py`");
    expect(k9).toContain("`allowed_paths` dieses Auftrags");
    expect(k9).not.toContain("offener Entscheidung");
    // Gezielt die K9-Zeile der Resttabelle, damit eine andere technische Lücke nicht genügt.
    const zeile = lies(DOKUMENT)
      .split("\n")
      .find((z) => z.startsWith("| K9 |"));
    expect(zeile).toBeDefined();
    expect(zeile).toContain("Produktnähe und Tests");
    expect(zeile).toContain("| technische Lücke in der Koordination |");
    expect(flach(DOKUMENT)).toContain("betreffen `dienst.py` (K1, K9)");
  });

  it("K4: Ergebnis am vorhandenen Weg, Beleglücke statt erfundener Vergleichspflicht", () => {
    const k4 = abschnitt("### K4 · R-1248 — ");
    expect(k4).toContain(
      "R-1248 verlangt die Erfassung, nicht eine bestimmte Vergleichsimplementierung",
    );
    expect(k4).toContain("Das ist eine Beleglücke, keine fehlende Funktion.");
    expect(flach(DOKUMENT)).not.toContain("Kein automatischer Vergleich roter Tests");
  });
});
