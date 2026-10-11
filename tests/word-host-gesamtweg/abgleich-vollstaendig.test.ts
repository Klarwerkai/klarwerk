// ================================================================================================
// WORD-HOST-GESAMTWEG · KRITERIEN 12 UND 13 — DER EINZELABGLEICH BLEIBT VOLLSTÄNDIG UND AM BAUM.
// ================================================================================================
//
// `docs/operations/word-host-gesamtweg-abgleich.md` gleicht jeden Originalpunkt, den die
// Auftragsquelle diesem Vorgang zuordnet, mit dem heutigen Bestand ab. Diese Datei hält fest:
//   V1  jeder der 130 zugeordneten Punkte steht genau einmal da — keiner fehlt, keiner ist erfunden
//   V2  jedes Ergebnis ist eines der acht erklärten Wörter, und jeder Nicht-Abschluss nennt seinen Rest
//   V3  die Summentabelle stimmt mit den Zeilen überein
//   V4  jeder genannte Pfad existiert (Bauform von `tests/klara-assistenz/abgleich-belege.test.ts`)
// Die Punktliste ist aus `original_points` der Auftragsquelle abgeschrieben (Stand Auftragsrevision
// 7). Ändert sich die Zuordnung, ist diese Liste und der Abgleich nachzuführen — nicht aufzuweichen.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const ABGLEICH = readFileSync(repoPfad("docs/operations/word-host-gesamtweg-abgleich.md"), "utf8");

const R_NUMMERN = `
0001 0015 0016 0048 0067 0068 0078 0079 0232 0296 0312 0324 0342 0351 0352 0353 0356 0357
0358 0360 0362 0363 0364 0365 0366 0367 0369 0370 0379 0381 0382 0384 0385 0386 0387 0388
0389 0391 0392 0393 0394 0395 0396 0398 0399 0400 0402 0403 0404 0405 0406 0407 0408 0409
0410 0411 0415 0416 0418 0419 0420 0421 0425 0611 0825 0870 1047 1088 1127 1128 1129 1130
1131 1179 1412 1495 1504 1506 1508 1510 1512 1513 1516 1517 1518 1519 1546 1556 1557 1574
1575 1583 1586 1587 1588 1589 1602 1607 1778 1780 1794 1815 1886 1958 1974 2187 2198 2207
2208
`;

const R_PUNKTE: string[] = [];
for (const nummer of R_NUMMERN.split(/\s+/)) {
  if (nummer.length > 0) {
    R_PUNKTE.push(`R-${nummer}`);
  }
}

const WEITERE_PUNKTE = [
  "P-OFFICE-PG-ABNAHME",
  "P-WORD-RUECKWEG",
  "P-KLARA-VERSION",
  "P-M2-R",
  "TEST-A09",
  "priority:OFFICE-PG-ABNAHME:41d668e389e8",
  "priority:WORD-RUECKWEG:a9c220de6223",
  "priority:KLARA-VERSION:d61c0b41a79d",
  "priority:WORD-VERGLEICH:589c47a85494",
  "priority:WORD-VERGLEICH-Z6:667d56d68e78",
  "priority:M2-R:28b2d6b42b48",
  "priority:B2:65dd456556e3",
  "priority:P2:487dd5615541",
  "priority:P7:f2c19623910d",
  "package:abnahme",
  "package:installation",
  "package:rollen",
  "package:roundtrip",
  "package:vergleich",
  "package:wordimport",
  "question:K14",
];

const PUNKTE = [...R_PUNKTE, ...WEITERE_PUNKTE];

const ERGEBNISSE = [
  "geliefert",
  "teilweise",
  "hostprobe",
  "offen",
  "ungeprueft",
  "ersetzt",
  "abgegrenzt",
  "entscheidung",
];

interface Zeile {
  readonly punkt: string;
  readonly ergebnis: string;
  readonly rest: string;
}

/** Die Zeilen der Tabelle „Der Abgleich“ — zwischen ihrer Überschrift und „Summe“. */
function abgleichszeilen(): Zeile[] {
  const anfang = ABGLEICH.indexOf("## Der Abgleich");
  const ende = ABGLEICH.indexOf("## Summe");
  const zeilen: Zeile[] = [];
  for (const zeile of ABGLEICH.slice(anfang, ende).split("\n")) {
    const zellen = zeile.split("|").map((z) => z.trim());
    if (zellen.length < 7 || zellen[1] === "Punkt" || /^-+$/.test(zellen[1] ?? "")) {
      continue;
    }
    zeilen.push({ punkt: zellen[1] ?? "", ergebnis: zellen[3] ?? "", rest: zellen[5] ?? "" });
  }
  return zeilen;
}

describe("Kriterien 12/13 · der Einzelabgleich der zugeordneten Originalpunkte", () => {
  const zeilen = abgleichszeilen();

  it("V1 · alle 130 Punkte genau einmal — keiner fehlt, keiner ist erfunden", () => {
    expect(PUNKTE).toHaveLength(130);
    expect(new Set(PUNKTE).size).toBe(130);
    const genannt = zeilen.map((z) => z.punkt);
    expect([...genannt].sort()).toEqual([...PUNKTE].sort());
  });

  it("V2 · jedes Ergebnis ist erklärt, und jeder Nicht-Abschluss nennt seinen Rest", () => {
    for (const zeile of zeilen) {
      expect(ERGEBNISSE, zeile.punkt).toContain(zeile.ergebnis);
      expect(ABGLEICH, zeile.ergebnis).toContain(`| \`${zeile.ergebnis}\` |`);
      if (!["geliefert", "ersetzt"].includes(zeile.ergebnis)) {
        expect(zeile.rest.replace("—", "").trim().length, zeile.punkt).toBeGreaterThan(0);
      }
    }
  });

  it("V3 · die Summentabelle stimmt mit den Zeilen überein", () => {
    const summe = ABGLEICH.slice(ABGLEICH.indexOf("## Summe"));
    for (const ergebnis of ERGEBNISSE) {
      const anzahl = zeilen.filter((z) => z.ergebnis === ergebnis).length;
      expect(summe, ergebnis).toContain(`| \`${ergebnis}\` | ${anzahl} |`);
    }
  });

  it("V4 · jeder genannte Pfad existiert", () => {
    const pfade = new Set<string>();
    for (const [, roh = ""] of ABGLEICH.matchAll(
      /`((?:apps|services|tests|docs|tools|extensions)\/[^`\s]+)`/g,
    )) {
      pfade.add(roh.replace(/:[\d,-]+$/, ""));
    }
    expect(pfade.size).toBeGreaterThan(40);
    const fehlend = [...pfade].filter((pfad) => !existsSync(repoPfad(pfad)));
    expect(fehlend).toEqual([]);
  });

  it("V5 · keine Zeile behauptet einen realen Hostlauf", () => {
    expect(ABGLEICH).toContain("Für keinen Punkt liegt ein realer Lauf in Word für das Web oder");
    for (const zeile of zeilen) {
      expect(zeile.rest, zeile.punkt).not.toMatch(/im Host (abgenommen|bestanden|belegt)/);
    }
  });
});
