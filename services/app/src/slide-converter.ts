// WP-D11 (Pedis Entscheid: jede Folie als Bild): Server-Konvertierung PPTX → PNG je Folie.
//
// GEWÄHLTER WEG: pptx → PDF (LibreOffice headless) → PNG je Seite (pdftoppm/poppler). Begründung:
// `soffice --convert-to png` rendert bekanntermaßen NUR die erste Folie — der PDF-Zwischenschritt
// ist der einzige zuverlässige Je-Folie-Pfad; pdftoppm ist klein, schnell, skaliert sauber auf
// Zielbreite und nummeriert die Seiten deterministisch.
//
// Robustheit:
//  - temporäres Arbeitsverzeichnis pro Job (mkdtemp), IMMER aufgeräumt (finally, auch im Fehlerfall)
//  - GESAMT-Deadline über beide Schritte (Standard 60 s): laufende Prozesse werden gekillt
//  - harte Grenzen: max. 30 Folien (pdftoppm -l; eine Probeseite mehr entlarvt die Kappung),
//    Zielbreite 1600 px; die Eingabegrenze (50 MB) prüft die Route VOR dem Konverter
//  - Feature-Erkennung: ohne soffice/pdftoppm (lokale Dev-Umgebung!) meldet available() false —
//    die Route antwortet dann ehrlich 503; Tests laufen KOMPLETT ohne soffice (Fake-Konverter,
//    der echte Aufruf bleibt diese dünne, injizierbare Schicht).
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MAX_SLIDES = 30;
export const MAX_PPTX_BYTES = 50 * 1024 * 1024; // 50 MB Eingabe (Route lehnt Größeres mit 413 ab)
export const SLIDE_PNG_WIDTH = 1600;
export const SLIDE_CONVERT_TIMEOUT_MS = 60_000;

export interface SlideConvertResult {
  pngs: Buffer[]; // eine PNG je Folie, in Folienreihenfolge
  truncated: boolean; // true, wenn die Präsentation mehr als MAX_SLIDES Folien hatte
}

export interface SlideConverter {
  available(): Promise<boolean>;
  convert(pptx: Buffer): Promise<SlideConvertResult>;
}

// Dünner, injizierbarer Prozess-Runner: löst mit stdout auf, wirft bei Fehler/Signal. Die Tests
// ersetzen ihn vollständig — kein soffice/pdftoppm nötig.
export type RunProcess = (
  command: string,
  args: string[],
  opts: { timeoutMs: number },
) => Promise<void>;

const runProcess: RunProcess = (command, args, opts) =>
  new Promise((resolve, reject) => {
    // timeout + SIGKILL: ein hängender soffice wird hart beendet (kein Zombie-Konverter).
    execFile(command, args, { timeout: opts.timeoutMs, killSignal: "SIGKILL" }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

export interface SofficeConverterDeps {
  run?: RunProcess;
  timeoutMs?: number;
  now?: () => number;
}

export class SlideConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlideConvertError";
  }
}

export function createSofficeSlideConverter(deps: SofficeConverterDeps = {}): SlideConverter {
  const run = deps.run ?? runProcess;
  const totalTimeoutMs = deps.timeoutMs ?? SLIDE_CONVERT_TIMEOUT_MS;
  const now = deps.now ?? (() => Date.now());
  // Verfügbarkeit einmalig prüfen und cachen (beide Werkzeuge müssen antworten).
  let availability: Promise<boolean> | null = null;

  const checkAvailable = async (): Promise<boolean> => {
    try {
      await run("soffice", ["--version"], { timeoutMs: 10_000 });
      await run("pdftoppm", ["-v"], { timeoutMs: 10_000 });
      return true;
    } catch {
      return false;
    }
  };

  return {
    available(): Promise<boolean> {
      availability ??= checkAvailable();
      return availability;
    },

    async convert(pptx: Buffer): Promise<SlideConvertResult> {
      const startedAt = now();
      const remaining = (): number => {
        const left = totalTimeoutMs - (now() - startedAt);
        if (left <= 0) {
          throw new SlideConvertError("Zeitlimit der Folien-Konvertierung überschritten.");
        }
        return left;
      };
      // Arbeitsverzeichnis pro Job — wird IMMER entfernt (finally), auch bei Fehlern/Timeouts.
      const dir = await mkdtemp(join(tmpdir(), "kw-slides-"));
      try {
        const input = join(dir, "input.pptx");
        await writeFile(input, pptx);
        // Schritt 1: pptx → PDF (headless, ohne GUI/Erstlauf-Assistenten).
        await run(
          "soffice",
          [
            "--headless",
            "--norestore",
            "--nolockcheck",
            `-env:UserInstallation=file://${dir}/lo-profile`,
            "--convert-to",
            "pdf",
            "--outdir",
            dir,
            input,
          ],
          { timeoutMs: remaining() },
        );
        const pdf = join(dir, "input.pdf");
        // Schritt 2: PDF → PNG je Seite, auf Zielbreite skaliert. BEWUSST eine Seite ÜBER dem Cap
        // (-l MAX+1): erscheint die Probeseite, hatte das Deck mehr als MAX_SLIDES → truncated,
        // ohne dass jemals mehr als MAX+1 Seiten gerendert werden.
        await run(
          "pdftoppm",
          [
            "-png",
            "-f",
            "1",
            "-l",
            String(MAX_SLIDES + 1),
            "-scale-to-x",
            String(SLIDE_PNG_WIDTH),
            "-scale-to-y",
            "-1",
            pdf,
            join(dir, "slide"),
          ],
          { timeoutMs: remaining() },
        );
        // pdftoppm nummeriert mit führenden Nullen (slide-01.png / slide-001.png) — die
        // lexikografische Sortierung IST dann die Folienreihenfolge.
        const files = (await readdir(dir))
          .filter((f) => f.startsWith("slide") && f.endsWith(".png"))
          .sort();
        if (files.length === 0) {
          throw new SlideConvertError("Die Konvertierung lieferte keine Folienbilder.");
        }
        const truncated = files.length > MAX_SLIDES;
        const keep = files.slice(0, MAX_SLIDES);
        const pngs: Buffer[] = [];
        for (const file of keep) {
          pngs.push(await readFile(join(dir, file)));
        }
        return { pngs, truncated };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
