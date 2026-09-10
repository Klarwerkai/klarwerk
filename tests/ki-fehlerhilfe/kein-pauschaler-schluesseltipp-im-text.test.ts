// ================================================================================================
// JOB 3420 · UX-10b — FALL 6: DER PAUSCHALE SCHLÜSSELTIPP STEHT IN KEINEM SPRACHWERT MEHR.
// ================================================================================================
//
// WORAN DIESER WÄCHTER VERANKERT IST — und warum nicht am Rohtext der Datei (Codex-Lehre
// JOB 3401 R1, 09.09.): Gelesen werden die WERTE des initialisierten Wörterbuchs
// (`i18n.getResourceBundle`, s. `tests/support/i18nBestand.ts`), also genau das, was ein Mensch auf
// der Fläche zu sehen bekommt. Ein Wächter über `readFileSync("i18n.ts")` würde stattdessen jeden
// KOMMENTAR mitzählen — und dieser Auftrag hinterlässt notwendigerweise einen, der die entfernte
// Zeile beim Namen nennt. Er wäre rot, obwohl kein sichtbarer Text den Tipp trägt: eine Zusicherung,
// die nicht misst, was sie behauptet.
//
// DIE KALIBRIERUNG STEHT DESHALB IM TEST (Fall B), nicht in einem einmaligen Handgriff: sie belegt
// bei jedem Lauf, dass die Zeichenkette im Quelltext SEHR WOHL vorkommt und der Wert-Wächter sie
// trotzdem zu Recht nicht sieht. Ohne diesen Gegenbeleg könnte Fall A auch dadurch grün sein, dass
// er gar nichts liest.
//
// AUSDRÜCKLICH NICHT GEPRÜFT: der Kontoname, den Fall (a) des Auftrags im 401/403-Fall zeigt. Er
// steht nicht in einem i18n-Wert, sondern kommt als Einsetzung `{{konto}}` aus
// `apps/web/src/lib/kiTestBefund.ts`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alleSprachbestaende } from "../support/i18nBestand";

const I18N_DATEI = join(__dirname, "../../apps/web/src/i18n.ts");

/** Die Kontonamen, die vor JOB 3420 pauschal in JEDEM Fehlertext standen. */
const KONTONAMEN = ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"] as const;

/**
 * Die einzigen zwei Schlüssel, die einen Kontonamen tragen DÜRFEN — und je genau EINEN, den ihres
 * eigenen Anbieters. Sie sind keine Lücke in der Zusage, sondern ihr Gegenstück: Fall D unten pinnt
 * für jeden von beiden POSITIV, welchen Namen er trägt und welchen nicht.
 *
 * WARUM DER NAME HIER STEHT UND NICHT IN `kiTestBefund.ts`: Die Hausregel
 * `tests/security/egress-chokepoint.test.ts:31-35` verbietet die CODE-FORM eines Credential-Namens
 * (quotiertes Literal, `env`-Zugriff) in jeder `.ts`-Datei ausserhalb der beiden Chokepoint-Dateien
 * und nimmt Fliesstext ausdrücklich aus. Eine Kontotabelle in `kiTestBefund.ts` hat diesen Wächter
 * im Tor-Lauf dieses Jobs rot gemacht; er wird nicht erweitert, der Name bleibt im Text. Die
 * ZUORDNUNG (geprüfter Anbieter → welcher Satz) liegt weiterhin an der EINEN Stelle
 * `apps/web/src/lib/kiTestBefund.ts`.
 */
const KONTO_SCHLUESSEL: Readonly<Record<string, string>> = {
  "adm.ai.rat.zugangKonto.openai": "OPENAI_API_KEY",
  "adm.ai.rat.zugangKonto.anthropic": "ANTHROPIC_API_KEY",
};

describe("JOB 3420 · Fall 6 — kein Kontoname in einem sichtbaren adm.ai-Text", () => {
  it("A · in keinem WERT eines adm.ai-Schlüssels steht ein Kontoname (de, en, nl)", () => {
    const treffer: string[] = [];
    for (const [sprache, bestand] of Object.entries(alleSprachbestaende())) {
      for (const [schluessel, wert] of Object.entries(bestand)) {
        if (!schluessel.startsWith("adm.ai.") || schluessel in KONTO_SCHLUESSEL) {
          continue;
        }
        for (const konto of KONTONAMEN) {
          if (typeof wert === "string" && wert.includes(konto)) {
            treffer.push(`${sprache} · ${schluessel} · ${konto}`);
          }
        }
      }
    }
    expect(treffer).toEqual([]);
  });

  it("D · die zwei ausgenommenen Schlüssel tragen je GENAU ihr eigenes Konto (de, en, nl)", () => {
    const bestaende = alleSprachbestaende();
    for (const sprache of ["de", "en", "nl"] as const) {
      for (const [schluessel, eigenes] of Object.entries(KONTO_SCHLUESSEL)) {
        const wert = bestaende[sprache]?.[schluessel] ?? "";
        expect(wert, `${schluessel} fehlt in ${sprache}`).not.toBe("");
        expect(wert, `${sprache} · ${schluessel}: eigenes Konto fehlt`).toContain(eigenes);
        const fremd = KONTONAMEN.find((k) => k !== eigenes) as string;
        expect(wert, `${sprache} · ${schluessel}: nennt das FREMDE Konto`).not.toContain(fremd);
      }
    }
  });

  it("A2 · der Rahmen `adm.ai.testFail` trägt nur noch die Rohmeldung, keinen Rat", () => {
    const bestaende = alleSprachbestaende();
    for (const sprache of ["de", "en", "nl"] as const) {
      const wert = bestaende[sprache]?.["adm.ai.testFail"] ?? "";
      expect(wert, `adm.ai.testFail fehlt in ${sprache}`).not.toBe("");
      // Der neutrale Rahmen setzt die Rohmeldung ein — und sonst nichts.
      expect(wert).toContain("{{detail}}");
      // Kein Schlüsselbund-Rat mehr, in keiner der drei Sprachen.
      expect(wert, `${sprache}: alter Schlüsselbund-Rat lebt weiter`).not.toMatch(
        /Schlüsselbund|keychain|sleutelhanger/i,
      );
    }
  });

  it("B · KALIBRIERUNG: im Rohtext der Datei kommt der Kontoname vor — der Wert-Wächter sieht ihn zu Recht nicht", () => {
    // Ein Wächter über den Dateitext wäre allein hierdurch rot. Genau das ist der Grund, warum
    // Fall A die Werte liest. Fällt diese Zusage, misst Fall A womöglich einen leeren Bestand.
    const roh = readFileSync(I18N_DATEI, "utf8");
    expect(roh).toContain("ANTHROPIC_API_KEY");
  });

  it("C · KALIBRIERUNG: der Bestand, den Fall A liest, ist wirklich gefüllt", () => {
    const bestaende = alleSprachbestaende();
    for (const sprache of ["de", "en", "nl"] as const) {
      const admAi = Object.keys(bestaende[sprache] ?? {}).filter((k) => k.startsWith("adm.ai."));
      expect(admAi.length, `zu wenige adm.ai-Schlüssel in ${sprache}`).toBeGreaterThan(40);
    }
  });
});
