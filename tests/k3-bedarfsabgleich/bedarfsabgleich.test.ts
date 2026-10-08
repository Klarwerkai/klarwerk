// ================================================================================================
// R-0991 (K3) · DIE EINZELTABELLE WIRD GEMESSEN, NICHT GEGLAUBT.
// ================================================================================================
//
// `bedarfsabgleich.ts` ordnet jeden der 82 Kandidaten aus JOB 2612 heute einem Fall A/B/C zu. Diese
// Datei hält die Tabelle am Code fest — die BEN-Korrekturpflichten aus JOB 2612 D2 im Wortlaut:
//   1  „Für jeden der 82 Kandidaten einen funktionsbezogenen Bedarfsbefund … samt bijektiver
//      Summenprüfung" → T1, T2, T3, T4.
//   2  „Für die 25 Word-Addin-Funde die Zuordnung TypeScript-Export → HTML-Spiegel → realer
//      HTML-Aufruf vollständig und namentlich" → T5.
//   3  A-Fälle bis zur sichtbaren Wirkung angeschlossen, der Rest trägt die Ausweichklausel → T2, T6
//      und der Wirkungstest `ordner-ohne-seite-mounted.test.tsx`.
// Jeder Beleg wird beim Lauf aus der genannten Datei gelesen; ändert sich der Code so, dass ein
// Alternativweg verschwindet, wird diese Datei rot und der Fall muss neu eingestuft werden.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 4): R-0991 liess die B- und C-Fälle bewusst
// stehen; R-1349 verlangt, jeden anzuschliessen oder begründet zu entfernen. T1, T2 und T5 bleiben
// unverändert (die historische Einstufung und der Word-Spiegel). T3, T4 und T6 lesen jetzt den
// Ausgang je Fall (`R1349_AUSGANG`): ein entfernter Export muss WEG sein (und sein Alternativweg aus
// R-0991 weiter treffen), ein angeschlossener muss gerufen werden, ein offener muss im Wächter mit
// Entscheider stehen. T7 verlangt für JEDEN B- und C-Fall genau einen Ausgang.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEDARFSABGLEICH, type Bedarf, HISTORISCH, R1349_AUSGANG } from "./bedarfsabgleich";

const WURZEL = process.cwd();
const lies = (rel: string): string => readFileSync(join(WURZEL, rel), "utf8");
const schluessel = (b: Bedarf): string => `${b.datei}::${b.name}`;
const flucht = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WAECHTER = "tests/capture/aufrufer-waechter.test.ts";

/** Steht der Export heute (noch) im Modul? Eine entfernte Datei heisst: nein. */
function exportVorhanden(b: Bedarf): boolean {
  const pfad = `apps/web/src/lib/${b.datei}`;
  if (!existsSync(join(WURZEL, pfad))) {
    return false;
  }
  return new RegExp(`export (async )?(function|const) ${flucht(b.name)}\\b`).test(lies(pfad));
}

describe("R-0991 (K3) · Bedarfsabgleich der 82 Kandidaten", () => {
  it("T1 · bijektiv: genau die 82 historischen Kandidaten, jeder genau einmal, Nummern 1–82", () => {
    expect(HISTORISCH).toHaveLength(82);
    expect(new Set(HISTORISCH).size).toBe(82);
    const heute = BEDARFSABGLEICH.map(schluessel);
    expect(heute).toHaveLength(82);
    expect(new Set(heute).size).toBe(82);
    expect([...heute].sort()).toEqual([...HISTORISCH].sort());
    expect(BEDARFSABGLEICH.map((b) => b.nr)).toEqual(Array.from({ length: 82 }, (_, i) => i + 1));
  });

  it("T2 · Summen: A + B + C = 82, jeder Fall mit passendem Stand, kein A ohne Anschluss", () => {
    const zahl = (f: Bedarf["fall"]): number => BEDARFSABGLEICH.filter((b) => b.fall === f).length;
    expect(zahl("A") + zahl("B") + zahl("C")).toBe(82);
    expect({ A: zahl("A"), B: zahl("B"), C: zahl("C") }).toEqual({ A: 4, B: 73, C: 5 });
    for (const b of BEDARFSABGLEICH) {
      const erlaubt =
        b.fall === "A"
          ? ["angeschlossen", "neu-angeschlossen"]
          : b.fall === "B"
            ? ["alternativweg"]
            : ["offen"];
      expect(erlaubt, `${schluessel(b)}: Fall ${b.fall} mit Stand ${b.stand}`).toContain(b.stand);
      expect(b.faehigkeit.trim().length, `${schluessel(b)}: Fähigkeit fehlt`).toBeGreaterThan(0);
      expect(b.begruendung.trim().length, `${schluessel(b)}: Begründung fehlt`).toBeGreaterThan(0);
    }
    // Die Ausweichklausel: weniger als drei offene A-Fälle → GENAU diese werden angeschlossen.
    const neu = BEDARFSABGLEICH.filter((b) => b.stand === "neu-angeschlossen").map(schluessel);
    expect(neu).toEqual(["importSelectView.ts::ordnerOhneEigeneZeile"]);
  });

  // R-1349: Bis hierher verlangte T3, dass JEDER Kandidat noch als Export vorhanden ist. Seit R-1349
  // gilt je Ausgang: entfernt oder in den Test gezogen → der Export ist WEG; sonst ist er da.
  it("T3 · jeder Kandidat steht so im Produkt, wie sein Ausgang es sagt", () => {
    const falsch: string[] = [];
    for (const b of BEDARFSABGLEICH) {
      const ausgang = R1349_AUSGANG[schluessel(b)]?.ausgang;
      const sollWeg = ausgang === "entfernt" || ausgang === "in-den-test";
      const da = exportVorhanden(b);
      if (sollWeg && da) {
        falsch.push(`${schluessel(b)}: als „${ausgang}" geführt, steht aber noch im Produkt`);
      }
      if (!sollWeg && !da) {
        falsch.push(`${schluessel(b)}: Export nicht mehr vorhanden`);
      }
    }
    expect(falsch, falsch.join(" · ")).toEqual([]);
  });

  it("T4 · jeder Beleg trifft heute im genannten Produkt- bzw. Prüfcode", () => {
    const daneben: string[] = [];
    for (const b of BEDARFSABGLEICH) {
      const r1349 = R1349_AUSGANG[schluessel(b)];
      const glieder = [
        ...(b.beleg === "word-spiegel" || r1349?.alterBelegEntfaellt ? [] : [b.beleg]),
        ...(r1349?.alterBelegEntfaellt ? [] : (b.kette ?? [])),
        ...(r1349?.nachweis ? [r1349.nachweis] : []),
      ];
      // Der Hauptbeleg, jedes weitere Glied seiner Kette und der R-1349-Nachweis müssen treffen.
      for (const glied of glieder) {
        const pfad = glied.datei;
        if (!existsSync(join(WURZEL, pfad))) {
          daneben.push(`${schluessel(b)}: ${pfad} fehlt`);
          continue;
        }
        if (!new RegExp(glied.muster).test(lies(pfad))) {
          daneben.push(`${schluessel(b)}: /${glied.muster}/ nicht in ${pfad}`);
        }
      }
    }
    expect(daneben, daneben.join("\n")).toEqual([]);
  });

  it("T5 · Word-Add-in: je Name TypeScript-Export → Spiegel in taskpane.js → realer Aufruf", () => {
    const html = lies("apps/web/public/word-addin/taskpane.html");
    expect(html, "taskpane.html bindet den Spiegel nicht ein").toMatch(
      /<script src="taskpane\.js[^"]*"><\/script>/,
    );
    const zeilen = lies("apps/web/public/word-addin/taskpane.js").split("\n");
    const word = BEDARFSABGLEICH.filter((b) => b.beleg === "word-spiegel");
    expect(word).toHaveLength(25);
    const kette: string[] = [];
    const luecken: string[] = [];
    for (const b of word) {
      expect(b.datei).toBe("wordAddin.ts");
      const name = flucht(b.name);
      const definition = new RegExp(`(function|var|const|let)\\s+${name}\\b`);
      const nennung = new RegExp(`\\b${name}\\b`);
      const defZeile = zeilen.findIndex((z) => definition.test(z));
      const aufrufe = zeilen
        .map((z, i) => ({ z, i }))
        .filter(({ z, i }) => i !== defZeile && nennung.test(z) && !/^\s*(\/\/|\*)/.test(z));
      if (defZeile < 0 || aufrufe.length === 0) {
        luecken.push(`${b.name}: Definition ${defZeile + 1}, Aufrufe ${aufrufe.length}`);
        continue;
      }
      kette.push(`${b.name} → taskpane.js:${defZeile + 1} → :${(aufrufe[0]?.i ?? 0) + 1}`);
    }
    expect(luecken, luecken.join("\n")).toEqual([]);
    expect(kette).toHaveLength(25);
    console.info(`R-0991 · Word-Spiegel je Name:\n${kette.join("\n")}`);
  });

  // R-1349: Bis hierher verlangte T6, dass jeder B- und C-Fall „weiter im Altbestand" des Wächters
  // steht. Den eingefrorenen Altbestand gibt es nicht mehr. Der Gleichlauf heisst jetzt: nur ein
  // OFFENER Fall steht im Wächter (mit Grund und Entscheider); ein Word-Fall ist über die gemessene
  // Fremdlesekante gedeckt; jeder andere steht in keinem Register — er ist gerufen oder weg.
  it("T6 · Gleichlauf mit dem Aufrufer-Wächter: nur offene Fälle stehen im Register", () => {
    const waechter = lies(WAECHTER);
    const falsch: string[] = [];
    expect(waechter, "die Fremdlesekante des Word-Spiegels fehlt im Wächter").toMatch(
      /modul: "apps\/web\/src\/lib\/wordAddin\.ts",\s*leser: \["apps\/web\/public\/word-addin\/taskpane\.js"\],\s*art: "spiegel"/,
    );
    for (const b of BEDARFSABGLEICH) {
      const eintrag = `"apps/web/src/lib/${b.datei}::${b.name}"`;
      const gefuehrt = waechter.includes(eintrag);
      const ausgang = R1349_AUSGANG[schluessel(b)]?.ausgang;
      if (ausgang === "offen" && !gefuehrt) {
        falsch.push(`${schluessel(b)}: offen, fehlt aber im Register des Wächters`);
      }
      if (ausgang !== "offen" && gefuehrt) {
        falsch.push(
          `${schluessel(b)}: als „${ausgang ?? b.fall}" abgeschlossen, steht aber im Register`,
        );
      }
    }
    expect(falsch, falsch.join("\n")).toEqual([]);
  });

  it("T7 · R-1349: jeder B- und C-Fall hat genau einen Ausgang, kein A-Fall braucht einen", () => {
    const hatAusgang = (b: Bedarf): boolean => R1349_AUSGANG[schluessel(b)] !== undefined;
    const ohne = BEDARFSABGLEICH.filter((b) => b.fall !== "A" && !hatAusgang(b)).map(schluessel);
    expect(ohne, `ohne R-1349-Ausgang: ${ohne.join(" · ")}`).toEqual([]);
    const mitA = BEDARFSABGLEICH.filter((b) => b.fall === "A" && hatAusgang(b)).map(schluessel);
    expect(mitA).toEqual([]);
    const fremd = Object.keys(R1349_AUSGANG).filter((k) => !HISTORISCH.includes(k));
    expect(fremd, "Ausgang zu einem Namen, der kein Kandidat ist").toEqual([]);
    // Die Zählung, die das Dokument nennt — als Messung, nicht als Behauptung.
    const zahl = (a: string): number =>
      Object.values(R1349_AUSGANG).filter((s) => s.ausgang === a).length;
    expect({
      entfernt: zahl("entfernt"),
      angeschlossen: zahl("angeschlossen"),
      "in-den-test": zahl("in-den-test"),
      fremdleser: zahl("fremdleser"),
      offen: zahl("offen"),
    }).toEqual({ entfernt: 44, angeschlossen: 3, "in-den-test": 3, fremdleser: 25, offen: 3 });
  });
});
