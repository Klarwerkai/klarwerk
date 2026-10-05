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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BEDARFSABGLEICH, type Bedarf, HISTORISCH } from "./bedarfsabgleich";

const WURZEL = process.cwd();
const lies = (rel: string): string => readFileSync(join(WURZEL, rel), "utf8");
const schluessel = (b: Bedarf): string => `${b.datei}::${b.name}`;
const flucht = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  it("T3 · jeder Kandidat ist heute noch als Export vorhanden", () => {
    const fehlt: string[] = [];
    for (const b of BEDARFSABGLEICH) {
      const text = lies(`apps/web/src/lib/${b.datei}`);
      const def = new RegExp(`export (async )?(function|const) ${flucht(b.name)}\\b`);
      if (!def.test(text)) {
        fehlt.push(schluessel(b));
      }
    }
    expect(fehlt, `Export nicht mehr vorhanden: ${fehlt.join(" · ")}`).toEqual([]);
  });

  it("T4 · jeder Beleg trifft heute im genannten Produkt- bzw. Prüfcode", () => {
    const daneben: string[] = [];
    for (const b of BEDARFSABGLEICH) {
      if (b.beleg === "word-spiegel") {
        continue;
      }
      // Der Hauptbeleg und jedes weitere Glied seiner Kette müssen heute treffen.
      for (const glied of [b.beleg, ...(b.kette ?? [])]) {
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

  it("T6 · Gleichlauf mit dem Aufrufer-Wächter: A ohne Ausnahme, B/C weiter im Altbestand", () => {
    const waechter = lies("tests/capture/aufrufer-waechter.test.ts");
    const falsch: string[] = [];
    for (const b of BEDARFSABGLEICH) {
      const eintrag = `"apps/web/src/lib/${b.datei}::${b.name}"`;
      const gefuehrt = waechter.includes(eintrag);
      if (b.fall === "A" && gefuehrt) {
        falsch.push(`${schluessel(b)}: angeschlossen, steht aber noch als Ausnahme im Wächter`);
      }
      if (b.fall !== "A" && !gefuehrt) {
        falsch.push(`${schluessel(b)}: ohne Produktaufrufer, fehlt aber im Altbestand`);
      }
    }
    expect(falsch, falsch.join("\n")).toEqual([]);
  });
});
