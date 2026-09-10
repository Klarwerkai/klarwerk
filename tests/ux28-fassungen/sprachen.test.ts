// ================================================================================================
// JOB 3475 · UX-28 — DIE NEUEN TEXTE SPRECHEN WIRKLICH DREI SPRACHEN.
// ================================================================================================
//
// LEHRE JOB 3449 R2: ein Wächter, der nur die ANWESENHEIT dreier Fassungen prüft, sichert nichts —
// dreimal derselbe deutsche Satz ist anwesend und trotzdem nicht übersetzt. Dieser Fall verlangt
// deshalb für jeden in dieser Runde neu angelegten Schlüssel zweierlei: er existiert in DE, EN und
// NL mit nicht-leerem Wert, UND die EN- und die NL-Fassung unterscheiden sich von der deutschen.
//
// DIE LISTE STEHT HIER ALS SOLLWERT (Literale, nicht aus dem Produkt geschöpft): wer einen der
// Schlüssel wieder entfernt oder umbenennt, macht diesen Fall rot statt ihn stillschweigend zu
// leeren.
import { describe, expect, it } from "vitest";
import { alleSprachbestaende } from "../support/i18nBestand";

/** Die sieben in dieser Runde NEU angelegten Schlüssel. */
const NEUE_SCHLUESSEL = [
  "ko.snapshotField.bodyHtml",
  "ko.snapshotOpen",
  "ko.snapshotClose",
  "ko.snapshotBodyChars",
  "ko.snapshotBodyMissing",
  "ko.snapshotReadOnly",
  "ko.snapshotBackToCurrent",
] as const;

/** Die Platzhalter eines Wertes — sie müssen je Schlüssel in allen drei Sprachen dieselben sein. */
function platzhalter(value: string): string[] {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

const bestand = alleSprachbestaende();

describe("JOB 3475 · die neuen Texte in DE, EN und NL", () => {
  it("jeder neue Schlüssel existiert in allen drei Sprachen, nicht leer", () => {
    const fehlend: string[] = [];
    for (const key of NEUE_SCHLUESSEL) {
      for (const sprache of ["de", "en", "nl"]) {
        const wert = bestand[sprache]?.[key];
        if (typeof wert !== "string" || wert.trim().length === 0) {
          fehlend.push(`${sprache}:${key}`);
        }
      }
    }
    expect(fehlend, "Schlüssel fehlen oder sind leer").toEqual([]);
  });

  it("EN und NL unterscheiden sich von DE — dreimal Deutsch ist keine Übersetzung", () => {
    const gleich: string[] = [];
    for (const key of NEUE_SCHLUESSEL) {
      const de = bestand.de?.[key];
      for (const sprache of ["en", "nl"]) {
        if (bestand[sprache]?.[key] === de) {
          gleich.push(`${sprache}:${key} = „${de}"`);
        }
      }
    }
    expect(gleich, "unübersetzte Schlüssel").toEqual([]);
  });

  it("die Platzhalter bleiben je Schlüssel erhalten — sonst bricht die Einsetzung", () => {
    const abweichend: string[] = [];
    for (const key of NEUE_SCHLUESSEL) {
      const soll = JSON.stringify(platzhalter(bestand.de?.[key] ?? ""));
      for (const sprache of ["en", "nl"]) {
        if (JSON.stringify(platzhalter(bestand[sprache]?.[key] ?? "")) !== soll) {
          abweichend.push(`${sprache}:${key}`);
        }
      }
    }
    expect(abweichend, "Platzhalter verschoben").toEqual([]);
  });

  it("die Größenangabe trägt ihren Platzhalter — sonst stünde eine Zahl ohne Bezug da", () => {
    expect(platzhalter(bestand.de?.["ko.snapshotBodyChars"] ?? "")).toEqual(["{{anzahl}}"]);
    expect(platzhalter(bestand.de?.["ko.snapshotReadOnly"] ?? "")).toEqual(["{{version}}"]);
  });
});
