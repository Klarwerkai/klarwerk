// ================================================================================================
// JOB 4213 · DIE NEUEN TEXTE SPRECHEN WIRKLICH DREI SPRACHEN.
// ================================================================================================
//
// LEHRE JOB 3449 R2 (übernommen aus `tests/ux28-fassungen/sprachen.test.ts`): ein Wächter, der nur
// die ANWESENHEIT dreier Fassungen prüft, sichert nichts — dreimal derselbe deutsche Satz ist
// anwesend und trotzdem nicht übersetzt. Für jeden in dieser Runde neu angelegten Schlüssel gilt
// deshalb: er existiert in DE, EN und NL mit nicht-leerem Wert, und die drei lauten paarweise
// verschieden.
//
// DIE LISTE STEHT HIER ALS SOLLWERT (Literale, nicht aus dem Produkt geschöpft): wer einen der
// Schlüssel entfernt oder umbenennt, macht diesen Fall rot statt ihn stillschweigend zu leeren.
//
// DIE HERKUNFT (`ko.snapshotRestoredFrom`) STEHT MIT IN DIESER LISTE, und das ist der Unterschied
// zu einem Dienst-Vermerk: sie ist ein Text der FLÄCHE mit einem Platzhalter, kein Wort, das der
// Dienst in den Datensatz schreibt. Die festen Dienst-Vermerke werden weiterhin allein an ihrem
// eigenen, schärferen Ort gemessen (`tests/bibliothek-historie-vermerk/vermerk-uebersetzung.test.ts`,
// dort zeichengenau samt der Kette Vermerk → Schlüssel → Text); dieser Auftrag führt keinen neuen
// ein.
import { describe, expect, it } from "vitest";
import { alleSprachbestaende } from "../support/i18nBestand";

const SPRACHEN = ["de", "en", "nl"] as const;

/** Die in dieser Runde NEU angelegten sichtbaren Schlüssel. */
const NEUE_SCHLUESSEL = [
  "ko.snapshotCompareTitle",
  "ko.snapshotCompareFrom",
  "ko.snapshotCompareTo",
  "ko.snapshotCompareNeedsTwo",
  "ko.snapshotCompareChoose",
  "ko.snapshotCompareHint",
  "ko.snapshotCompareNone",
  "ko.snapshotCompareSame",
  "ko.snapshotCompareUnknown",
  "ko.snapshotFieldEmpty",
  "ko.snapshotRestore",
  "ko.snapshotRestoreHint",
  "ko.snapshotRestoreRunning",
  "ko.snapshotRestoreDone",
  "ko.snapshotRestoreStale",
  "ko.snapshotRestoreAgain",
  "ko.snapshotRestoreOffline",
  "ko.snapshotRestoreNoRight",
  "ko.snapshotRestoreNeedsRelease",
  "ko.snapshotRestoreIsCurrent",
  "ko.snapshotRestoreNoContent",
  "ko.snapshotRestoredFrom",
] as const;

/** Der in dieser Runde GEÄNDERTE Schlüssel — sein Platzhalter muss überleben. */
const GEAENDERT = "ko.snapshotReadOnly";

function platzhalter(value: string): string[] {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

const bestand = alleSprachbestaende();

describe("JOB 4213 · die neuen Texte in DE, EN und NL", () => {
  it("jeder neue Schlüssel existiert in allen drei Sprachen, nicht leer", () => {
    const fehlend: string[] = [];
    for (const key of NEUE_SCHLUESSEL) {
      for (const sprache of SPRACHEN) {
        const wert = bestand[sprache]?.[key];
        if (typeof wert !== "string" || wert.trim().length === 0) {
          fehlend.push(`${sprache}:${key}`);
        }
      }
    }
    expect(fehlend, "Schlüssel fehlen oder sind leer").toEqual([]);
  });

  it("die drei Sprachen lauten paarweise verschieden — dreimal Deutsch ist keine Übersetzung", () => {
    const PAARE = [
      ["de", "en"],
      ["de", "nl"],
      ["en", "nl"],
    ] as const;
    const gleich: string[] = [];
    for (const key of NEUE_SCHLUESSEL) {
      for (const [a, b] of PAARE) {
        if (bestand[a]?.[key] === bestand[b]?.[key]) {
          gleich.push(`${key}: ${a} und ${b} tragen beide „${String(bestand[a]?.[key])}“`);
        }
      }
    }
    expect(gleich, "unübersetzte oder verwechselte Schlüssel").toEqual([]);
  });

  it("die Platzhalter bleiben je Schlüssel erhalten — sonst bricht die Einsetzung", () => {
    const abweichend: string[] = [];
    for (const key of [...NEUE_SCHLUESSEL, GEAENDERT]) {
      const soll = JSON.stringify(platzhalter(bestand.de?.[key] ?? ""));
      for (const sprache of ["en", "nl"] as const) {
        if (JSON.stringify(platzhalter(bestand[sprache]?.[key] ?? "")) !== soll) {
          abweichend.push(`${sprache}:${key}`);
        }
      }
    }
    expect(abweichend, "Platzhalter verschoben").toEqual([]);
  });

  it("die Versionsangaben tragen ihren Platzhalter — sonst stünde eine Zahl ohne Bezug da", () => {
    expect(platzhalter(bestand.de?.["ko.snapshotRestoreDone"] ?? "")).toEqual(["{{version}}"]);
    // Die Herkunft OHNE Platzhalter wäre die schlimmste Form: ein Satz, der „aus einer früheren
    // Fassung" sagt und die Fassung verschweigt, obwohl sie bekannt ist.
    expect(platzhalter(bestand.de?.["ko.snapshotRestoredFrom"] ?? "")).toEqual(["{{version}}"]);
    // Der geänderte Satz behält seinen Platzhalter: „Alte Fassung v{{version}} · …".
    expect(platzhalter(bestand.de?.[GEAENDERT] ?? "")).toEqual(["{{version}}"]);
  });

  it("KEIN Satz dieser Runde empfiehlt, die Seite neu zu laden", () => {
    // Korrekturpflicht aus JOB 4146 R6/R7: wer neu lädt, verliert, was er gerade tun wollte. Der
    // Wächter liest den KATALOG — damit fällt auch ein Satz auf, den heute noch niemand zeichnet.
    const verdaechtig = ["neu laden", "neu lesen", "reload", "opnieuw laden", "aktualisier"];
    const treffer: string[] = [];
    for (const key of NEUE_SCHLUESSEL) {
      for (const sprache of SPRACHEN) {
        const wert = (bestand[sprache]?.[key] ?? "").toLowerCase();
        for (const wort of verdaechtig) {
          if (wert.includes(wort)) {
            treffer.push(`${sprache}:${key} enthält „${wort}“`);
          }
        }
      }
    }
    expect(treffer, "ein neuer Satz empfiehlt Neuladen").toEqual([]);
  });
});
