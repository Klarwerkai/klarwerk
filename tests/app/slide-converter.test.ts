// WP-D11: die dünne soffice-Schicht — getestet KOMPLETT OHNE LibreOffice über den injizierten
// Prozess-Runner: Feature-Erkennung (kein soffice → available false), Erfolgsweg (pdftoppm-Dateien
// → PNGs in Folienreihenfolge), Kappung (31 Seiten → 30 + truncated), Gesamt-Timeout und der
// Aufräum-Pfad (temporäres Arbeitsverzeichnis verschwindet IMMER, auch bei Fehlern).
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONVERTER_PATH,
  MAX_SLIDES,
  MAX_SLIDE_PNG_BYTES,
  MAX_TOTAL_SLIDES_BYTES,
  type RunProcess,
  SlideConvertError,
  converterEnv,
  createSofficeSlideConverter,
  runProcess,
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

describe("WP-D11b Blocker 1: Kindprozesse laufen mit EXPLIZIT BEREINIGTER Minimal-ENV", () => {
  it("der Runner erhält EXAKT {PATH fixiert, HOME=Job-Tempdir, LANG/LC_ALL=C} — nichts aus process.env", async () => {
    // Eine App-ENV-Variable, wie sie in Produktion Credentials trüge — sie darf NIE beim Konverter landen.
    process.env.KLARWERK_TEST_GEHEIMNIS = "super-geheimer-wert";
    try {
      const seen: { command: string; cwd: string; env: Record<string, string> }[] = [];
      const converter = createSofficeSlideConverter({
        run: async (command, args, opts) => {
          seen.push({ command, cwd: opts.cwd, env: opts.env });
          if (command === "soffice") {
            const outIdx = args.indexOf("--outdir") + 1;
            await writeFile(join(String(args[outIdx]), "input.pdf"), "fake-pdf");
          }
          if (command === "pdftoppm") {
            await writeFile(`${String(args[args.length - 1])}-01.png`, "png-1");
          }
        },
      });
      await converter.convert(Buffer.from("fake-pptx"));
      expect(seen.map((c) => c.command)).toEqual(["soffice", "pdftoppm"]);
      for (const call of seen) {
        // EXAKT die vier Minimal-Schlüssel — kein Durchreichen von process.env.
        expect(Object.keys(call.env).sort()).toEqual(["HOME", "LANG", "LC_ALL", "PATH"]);
        expect(call.env.PATH).toBe(CONVERTER_PATH);
        expect(call.env.LANG).toBe("C");
        expect(call.env.LC_ALL).toBe("C");
        // HOME = Job-Tempverzeichnis = CWD des Prozesses.
        expect(call.env.HOME).toBe(call.cwd);
        expect(call.cwd.includes("kw-slides-")).toBe(true);
        // KEINE App-ENV-Variable reist mit (weder Schlüssel noch Wert).
        expect(call.env.KLARWERK_TEST_GEHEIMNIS).toBeUndefined();
        expect(JSON.stringify(call.env)).not.toContain("super-geheimer-wert");
        for (const key of Object.keys(process.env)) {
          if (!["PATH", "HOME", "LANG", "LC_ALL"].includes(key)) {
            expect(call.env[key]).toBeUndefined();
          }
        }
      }
    } finally {
      delete process.env.KLARWERK_TEST_GEHEIMNIS;
    }
  });

  it("pdftoppm deckelt die LÄNGSTE Kante (-scale-to 1600) — nicht mehr nur die Breite", async () => {
    const pdftoppmArgs: string[][] = [];
    const converter = createSofficeSlideConverter({
      run: async (command, args) => {
        if (command === "soffice") {
          const outIdx = args.indexOf("--outdir") + 1;
          await writeFile(join(String(args[outIdx]), "input.pdf"), "fake-pdf");
        }
        if (command === "pdftoppm") {
          pdftoppmArgs.push(args);
          await writeFile(`${String(args[args.length - 1])}-01.png`, "png-1");
        }
      },
    });
    await converter.convert(Buffer.from("fake-pptx"));
    const args = pdftoppmArgs[0] ?? [];
    expect(args[args.indexOf("-scale-to") + 1]).toBe("1600");
    // Der alte, einseitige Weg (Breite fix, Höhe unbegrenzt) ist weg.
    expect(args).not.toContain("-scale-to-x");
    expect(args).not.toContain("-scale-to-y");
  });
});

describe("WP-D11b Blocker 2: Ausgabe hart gedeckelt (stat vor readFile, Gesamtbudget)", () => {
  // Fake-Runner, der PNG-Dateien mit VORGEGEBENEN Byte-Größen schreibt.
  function fakeRunSized(sizes: number[]): RunProcess {
    return async (command, args) => {
      if (command === "soffice") {
        const outIdx = args.indexOf("--outdir") + 1;
        await writeFile(join(String(args[outIdx]), "input.pdf"), "fake-pdf");
        return;
      }
      if (command === "pdftoppm") {
        const prefix = String(args[args.length - 1]);
        for (let i = 1; i <= sizes.length; i++) {
          await writeFile(
            `${prefix}-${String(i).padStart(2, "0")}.png`,
            Buffer.alloc(Number(sizes[i - 1]), i),
          );
        }
      }
    };
  }

  it("Einzel-PNG über dem Deckel wird per stat verworfen und NIE geladen (loadFile-Spy)", async () => {
    const loaded: string[] = [];
    const converter = createSofficeSlideConverter({
      run: fakeRunSized([10, 200, 15]),
      maxSlidePngBytes: 100,
      loadFile: async (path) => {
        loaded.push(path);
        return readFile(path);
      },
    });
    const result = await converter.convert(Buffer.from("fake-pptx"));
    expect(result.pngs.length).toBe(2);
    expect(result.droppedOversize).toBe(1);
    expect(result.droppedByBudget).toBe(0);
    expect(result.truncatedByBudget).toBe(false);
    // Die übergroße Folie 2 wurde nie gelesen — nur die zwei behaltenen.
    expect(loaded.length).toBe(2);
    expect(loaded.some((p) => p.endsWith("slide-02.png"))).toBe(false);
  });

  it("Gesamtbudget erreicht → restliche Folien ehrlich verworfen + truncatedByBudget, Zähler stimmen", async () => {
    const loaded: string[] = [];
    const converter = createSofficeSlideConverter({
      run: fakeRunSized([40, 40, 40, 40]),
      maxSlidePngBytes: 100,
      maxTotalSlidesBytes: 100,
      loadFile: async (path) => {
        loaded.push(path);
        return readFile(path);
      },
    });
    const result = await converter.convert(Buffer.from("fake-pptx"));
    expect(result.pngs.length).toBe(2); // 40 + 40 = 80 ≤ 100; die dritte (120 > 100) kippt
    expect(result.droppedByBudget).toBe(2);
    expect(result.droppedOversize).toBe(0);
    expect(result.truncatedByBudget).toBe(true);
    expect(loaded.length).toBe(2); // die verworfenen wurden NIE geladen
  });

  it("die produktiven Deckel-Konstanten stehen fest (3 MB je PNG, 24 MB gesamt)", () => {
    expect(MAX_SLIDE_PNG_BYTES).toBe(3_000_000);
    expect(MAX_TOTAL_SLIDES_BYTES).toBe(24_000_000);
  });
});

describe("WP-D11b GELB a: Deadline killt die GANZE Prozessgruppe (echter Kindprozess)", () => {
  // Lebt der Prozess noch WIRKLICH? Ein Linux-Zombie (beendet, wartet nur auf reap durch init)
  // zählt als tot — kill(pid, 0) würde ihn sonst fälschlich als „lebend" melden.
  function descendantLives(pid: number): boolean {
    try {
      process.kill(pid, 0);
    } catch {
      return false; // ESRCH — Prozess existiert nicht mehr
    }
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const state = stat.slice(stat.lastIndexOf(") ") + 2).charAt(0);
      return state !== "Z" && state !== "X";
    } catch {
      return true;
    }
  }

  it("auch der ENKEL überlebt den SIGKILL an die Gruppe nicht (sh spawnt einen Hintergrund-sleep)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kw-kill-"));
    try {
      // Der Kindprozess (sh) startet einen Enkel (sleep im Hintergrund, gleiche Prozessgruppe,
      // pid landet in enkel.pid) und bleibt dann selbst hängen — die Deadline muss BEIDE beenden.
      await expect(
        runProcess("sh", ["-c", "sleep 30 & echo $! > enkel.pid; wait"], {
          timeoutMs: 300,
          cwd: dir,
          env: converterEnv(dir),
        }),
      ).rejects.toThrow("Zeitlimit");
      const pid = Number((await readFile(join(dir, "enkel.pid"), "utf8")).trim());
      expect(Number.isInteger(pid) && pid > 0).toBe(true);
      // SIGKILL-Zustellung abwarten — danach darf der Enkel nicht mehr laufen.
      let lives = true;
      for (let i = 0; i < 100 && lives; i++) {
        await new Promise((r) => setTimeout(r, 20));
        lives = descendantLives(pid);
      }
      expect(lives).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
