// WP-D11: die dünne soffice-Schicht — getestet KOMPLETT OHNE LibreOffice über den injizierten
// Prozess-Runner: Feature-Erkennung (kein soffice → available false), Erfolgsweg (pdftoppm-Dateien
// → PNGs in Folienreihenfolge), Kappung (31 Seiten → 30 + truncated), Gesamt-Timeout und der
// Aufräum-Pfad (temporäres Arbeitsverzeichnis verschwindet IMMER, auch bei Fehlern).
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_SLIDES,
  type RunProcess,
  SlideConvertError,
  createSofficeSlideConverter,
} from "../../services/app/src/slide-converter";

// Arbeitsverzeichnis aus den pdftoppm-Argumenten ablesen (letztes Argument = Ausgabe-Präfix).
function dirOfPrefix(prefix: string): string {
  return prefix.slice(0, prefix.lastIndexOf("/"));
}

// Fake-Runner: soffice legt die PDF an (Datei-Existenz reicht), pdftoppm schreibt n PNG-Seiten.
function fakeRun(pages: number, seenDirs: string[]): RunProcess {
  return async (command, args) => {
    if (command === "soffice" && args.includes("--convert-to")) {
      const outIdx = args.indexOf("--outdir") + 1;
      await writeFile(join(String(args[outIdx]), "input.pdf"), "fake-pdf");
      return;
    }
    if (command === "pdftoppm") {
      const prefix = String(args[args.length - 1]);
      seenDirs.push(dirOfPrefix(prefix));
      const limit = Number(args[args.indexOf("-l") + 1]);
      const emit = Math.min(pages, limit);
      for (let i = 1; i <= emit; i++) {
        await writeFile(`${prefix}-${String(i).padStart(2, "0")}.png`, `png-${i}`);
      }
    }
  };
}

describe("WP-D11: soffice-Schicht (Fake-Runner, kein LibreOffice nötig)", () => {
  it("Feature-Erkennung: ohne soffice meldet available() ehrlich false (gecacht)", async () => {
    let calls = 0;
    const converter = createSofficeSlideConverter({
      run: async () => {
        calls += 1;
        throw new Error("ENOENT: soffice nicht gefunden");
      },
    });
    expect(await converter.available()).toBe(false);
    expect(await converter.available()).toBe(false);
    expect(calls).toBe(1); // Ergebnis wird gecacht — keine wiederholten Probeläufe
  });

  it("Erfolg: n Seiten → n PNGs in Folienreihenfolge; das Arbeitsverzeichnis ist danach WEG", async () => {
    const seenDirs: string[] = [];
    const converter = createSofficeSlideConverter({ run: fakeRun(3, seenDirs) });
    const result = await converter.convert(Buffer.from("fake-pptx"));
    expect(result.truncated).toBe(false);
    expect(result.pngs.map((p) => p.toString())).toEqual(["png-1", "png-2", "png-3"]);
    expect(seenDirs.length).toBe(1);
    expect(existsSync(String(seenDirs[0]))).toBe(false); // mkdtemp-Verzeichnis aufgeräumt
  });

  it("31 Folien → harte Kappung auf 30 + truncated (die Probeseite MAX+1 entlarvt die Kappung)", async () => {
    const seenDirs: string[] = [];
    const converter = createSofficeSlideConverter({ run: fakeRun(MAX_SLIDES + 5, seenDirs) });
    const result = await converter.convert(Buffer.from("fake-pptx"));
    expect(result.pngs.length).toBe(MAX_SLIDES);
    expect(result.truncated).toBe(true);
    expect(result.pngs[0]?.toString()).toBe("png-1");
    expect(result.pngs[MAX_SLIDES - 1]?.toString()).toBe(`png-${MAX_SLIDES}`);
  });

  it("GESAMT-Timeout über beide Schritte: abgelaufene Deadline → Fehler + Aufräumen", async () => {
    let fakeNow = 0;
    const seenDirs: string[] = [];
    const converter = createSofficeSlideConverter({
      timeoutMs: 1000,
      now: () => fakeNow,
      run: async (command, args) => {
        if (command === "soffice") {
          const outIdx = args.indexOf("--outdir") + 1;
          seenDirs.push(String(args[outIdx]));
          await writeFile(join(String(args[outIdx]), "input.pdf"), "fake-pdf");
          fakeNow += 2000; // der erste Schritt frisst die komplette Deadline
        }
      },
    });
    await expect(converter.convert(Buffer.from("fake-pptx"))).rejects.toThrow(SlideConvertError);
    await expect(converter.convert(Buffer.from("fake-pptx"))).rejects.toThrow("Zeitlimit");
    for (const dir of seenDirs) {
      expect(existsSync(dir)).toBe(false); // auch im Fehlerfall aufgeräumt
    }
  });

  it("Prozessfehler mitten im Lauf: Fehler wird durchgereicht, das Verzeichnis trotzdem entfernt", async () => {
    const seenDirs: string[] = [];
    const converter = createSofficeSlideConverter({
      run: async (command, args) => {
        if (command === "soffice") {
          const outIdx = args.indexOf("--outdir") + 1;
          seenDirs.push(String(args[outIdx]));
          throw new Error("soffice ist abgestürzt");
        }
      },
    });
    await expect(converter.convert(Buffer.from("fake-pptx"))).rejects.toThrow("abgestürzt");
    expect(seenDirs.length).toBe(1);
    expect(existsSync(String(seenDirs[0]))).toBe(false);
  });

  it("keine Ausgabedateien (leeres/kaputtes Deck) → ehrlicher Fehler, kein leeres Erfolgsergebnis", async () => {
    const converter = createSofficeSlideConverter({ run: fakeRun(0, []) });
    await expect(converter.convert(Buffer.from("fake-pptx"))).rejects.toThrow("keine Folienbilder");
  });
});
