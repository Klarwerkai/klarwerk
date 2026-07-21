// WP-D11 (Pedis Entscheid: jede Folie als Bild): Server-Konvertierung PPTX → PNG je Folie.
//
// GEWÄHLTER WEG: pptx → PDF (LibreOffice headless) → PNG je Seite (pdftoppm/poppler). Begründung:
// `soffice --convert-to png` rendert bekanntermaßen NUR die erste Folie — der PDF-Zwischenschritt
// ist der einzige zuverlässige Je-Folie-Pfad; pdftoppm ist klein, schnell, skaliert sauber auf
// die Zielkante und nummeriert die Seiten deterministisch.
//
// WP-D11b (bens sammel16-Blocker 1) — VERTRAUENSGRENZE DER KINDPROZESSE, ehrlich benannt:
// LibreOffice/poppler parsen hier FREMDE Dateien. Was DIESE Schicht ohne Infra-Umbau leistet:
//  - EXPLIZIT BEREINIGTE Minimal-ENV je Kindprozess (nur PATH auf Standard-Systempfade fixiert,
//    HOME = Job-Tempverzeichnis, LANG/LC_ALL=C) — NICHTS aus process.env wird durchgereicht
//    (keine DB-/Provider-Credentials, keine Tokens im Adressraum der Konverter).
//  - CWD = Job-Tempverzeichnis; stdout/stderr werden verworfen (stdio "ignore" — kein Puffer,
//    die Konverter-Ausgabe wird nicht gebraucht, ein tobender Prozess kann keinen Speicher füllen).
//  - Eigene Prozessgruppe (detached) + Deadline-Kill der GANZEN GRUPPE (SIGKILL an -pid): auch
//    Enkelprozesse (oosplash & Co.) überleben das Zeitlimit nicht.
// BEWUSST OFFEN (Infra-Arbeit, NICHT in diesem WP): volle Prozess-Isolation (eigener Sidecar/
// Container mit eigenem User, seccomp, cgroup-Memory/CPU-Limits) und ein Netz-Block für die
// Konverter. Kernel-Ressourcenlimits (ulimit/cgroups) sind unter Node ohne Wrapper-Infrastruktur
// nicht sauber setzbar. WP-SHIP7-FIX (bens Fix 4): bis diese Grenze steht, ist die Route per
// DEFAULT AUS — nur ein explizites KLARWERK_SLIDES_ENABLED=1|true schaltet sie scharf
// (siehe slides-routes.ts).
//
// Robustheit:
//  - temporäres Arbeitsverzeichnis pro Job (mkdtemp), IMMER aufgeräumt (finally, auch im Fehlerfall)
//  - GESAMT-Deadline über beide Schritte (Standard 60 s): laufende Prozesse werden samt Gruppe gekillt
//  - harte Grenzen: max. 30 Folien (pdftoppm -l; eine Probeseite mehr entlarvt die Kappung),
//    längste Kante 1600 px; die Eingabegrenze (50 MB) prüft die Route VOR dem Konverter
//  - WP-D11b (Blocker 2): Ausgabe hart gedeckelt — VOR jedem readFile ein fs.stat; Einzel-PNG über
//    MAX_SLIDE_PNG_BYTES wird NIE geladen (droppedOversize), und eine laufende Gesamtgrenze
//    (MAX_TOTAL_SLIDES_BYTES) verwirft die restlichen Folien ehrlich (droppedByBudget) — damit ist
//    auch die Antwortgröße strukturell gedeckelt (Base64 von max. 24 MB).
//  - Feature-Erkennung: ohne soffice/pdftoppm (lokale Dev-Umgebung!) meldet available() false —
//    die Route antwortet dann ehrlich 503; Tests laufen KOMPLETT ohne soffice (Fake-Konverter,
//    der echte Aufruf bleibt diese dünne, injizierbare Schicht).
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MAX_SLIDES = 30;
export const MAX_PPTX_BYTES = 50 * 1024 * 1024; // 50 MB Eingabe (Route lehnt Größeres mit 413 ab)
export const SLIDE_PNG_LONG_EDGE = 1600;
// WP-D11b (Blocker 2): Einzel-PNG-Deckel und laufende Gesamtgrenze über alle geladenen PNGs.
export const MAX_SLIDE_PNG_BYTES = 3_000_000;
export const MAX_TOTAL_SLIDES_BYTES = 24_000_000;
export const SLIDE_CONVERT_TIMEOUT_MS = 60_000;

// WP-D11b (Blocker 1): fixierter Standard-Systempfad — bewusst NICHT process.env.PATH (der könnte
// auf App-eigene, credential-tragende Wrapper zeigen); soffice/pdftoppm liegen in Systempfaden.
export const CONVERTER_PATH = "/usr/local/bin:/usr/bin:/bin";

// Die EINZIGE ENV, die ein Konverter-Kindprozess sieht: kein Token, kein Credential, kein Proxy —
// HOME zeigt ins Job-Tempverzeichnis (LibreOffice braucht ein schreibbares HOME/Profil).
export function converterEnv(home: string): Record<string, string> {
  return { PATH: CONVERTER_PATH, HOME: home, LANG: "C", LC_ALL: "C" };
}

export interface SlideConvertResult {
  pngs: Buffer[]; // eine PNG je Folie, in Folienreihenfolge (verworfene Folien fehlen ehrlich)
  truncated: boolean; // true, wenn die Präsentation mehr als MAX_SLIDES Folien hatte
  droppedOversize: number; // Folien über dem Einzel-PNG-Deckel — per stat verworfen, NIE geladen
  droppedByBudget: number; // Folien, die der Gesamtgrenze zum Opfer fielen
  truncatedByBudget: boolean; // = droppedByBudget > 0 (ehrliches Flag für die Antwort/UI)
}

export interface SlideConverter {
  available(): Promise<boolean>;
  convert(pptx: Buffer): Promise<SlideConvertResult>;
}

// Dünner, injizierbarer Prozess-Runner: löst bei Exit-Code 0 auf, wirft bei Fehler/Signal/Deadline.
// Die Tests ersetzen ihn vollständig — kein soffice/pdftoppm nötig. opts trägt die bereinigte
// Minimal-ENV und das Job-CWD (Blocker 1) — der Default-Runner reicht BEIDES 1:1 an spawn durch.
export type RunProcess = (
  command: string,
  args: string[],
  opts: { timeoutMs: number; cwd: string; env: Record<string, string> },
) => Promise<void>;

// WP-D11b (GELB a): spawn mit detached:true → das Kind wird Gruppenleiter einer EIGENEN
// Prozessgruppe. Bei Deadline killt SIGKILL an -pid die GANZE Gruppe — auch Enkel (soffice
// startet Helferprozesse) überleben nicht. stdio "ignore": Konverter-Ausgabe wird verworfen
// (kein maxBuffer nötig, kein unbegrenzter Puffer möglich).
export const runProcess: RunProcess = (command, args, opts) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      detached: true,
      stdio: "ignore",
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) {
          process.kill(-child.pid, "SIGKILL"); // die GANZE Prozessgruppe, nicht nur den Leader
        } else {
          child.kill("SIGKILL");
        }
      } catch {
        child.kill("SIGKILL"); // Gruppe schon weg → wenigstens den Leader (No-Op, wenn beendet)
      }
    }, opts.timeoutMs);
    child.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      // WP-SHIP7-FIX (bens Fix 5, kleiner Rest): auch nach NORMALEM Prozessende die Prozessgruppe
      // best-effort aufräumen — ein vom Konverter zurückgelassener Hintergrund-Enkel (gleiche
      // Gruppe) überlebt den Erfolg nicht. ESRCH/EPERM (Gruppe schon weg/fremd) werden bewusst
      // geschluckt (child.kill auf einen beendeten Prozess ist ein No-op).
      if (!timedOut && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
      if (timedOut) {
        reject(
          new Error(
            `Zeitlimit: ${command} wurde nach ${opts.timeoutMs} ms samt Prozessgruppe beendet.`,
          ),
        );
      } else if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} beendete mit Code ${String(code)} (Signal ${String(signal)}).`),
        );
      }
    });
  });

export interface SofficeConverterDeps {
  run?: RunProcess;
  timeoutMs?: number;
  now?: () => number;
  // WP-D11b (Blocker 2, testbar ohne Riesen-Dateien): Deckel und Datei-Lader injizierbar.
  maxSlidePngBytes?: number;
  maxTotalSlidesBytes?: number;
  loadFile?: (path: string) => Promise<Buffer>;
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
  const maxSlidePngBytes = deps.maxSlidePngBytes ?? MAX_SLIDE_PNG_BYTES;
  const maxTotalSlidesBytes = deps.maxTotalSlidesBytes ?? MAX_TOTAL_SLIDES_BYTES;
  const loadFile = deps.loadFile ?? readFile;
  // Verfügbarkeit einmalig prüfen und cachen (beide Werkzeuge müssen antworten).
  let availability: Promise<boolean> | null = null;

  const checkAvailable = async (): Promise<boolean> => {
    // Auch die Probeläufe laufen mit bereinigter Minimal-ENV (HOME = System-Tempverzeichnis).
    const probeOpts = { timeoutMs: 10_000, cwd: tmpdir(), env: converterEnv(tmpdir()) };
    try {
      await run("soffice", ["--version"], probeOpts);
      await run("pdftoppm", ["-v"], probeOpts);
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
      // Es ist zugleich CWD und HOME der Kindprozesse (Blocker 1: bereinigte Minimal-ENV).
      const dir = await mkdtemp(join(tmpdir(), "kw-slides-"));
      const env = converterEnv(dir);
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
          { timeoutMs: remaining(), cwd: dir, env },
        );
        const pdf = join(dir, "input.pdf");
        // Schritt 2: PDF → PNG je Seite. BEWUSST eine Seite ÜBER dem Cap (-l MAX+1): erscheint die
        // Probeseite, hatte das Deck mehr als MAX_SLIDES → truncated, ohne dass jemals mehr als
        // MAX+1 Seiten gerendert werden.
        // WP-D11b (Blocker 2): -scale-to statt -scale-to-x — poppler skaliert damit die LÄNGSTE
        // Kante der Seite auf 1600 px und erhält das Seitenverhältnis. Vorher war nur die Breite
        // fixiert und die Höhe unbegrenzt (eine extreme Hochkant-Seite hätte beliebig viele Pixel
        // erzeugt); jetzt ist die Pixelzahl je Folie strukturell auf 1600×1600 begrenzt.
        await run(
          "pdftoppm",
          [
            "-png",
            "-f",
            "1",
            "-l",
            String(MAX_SLIDES + 1),
            "-scale-to",
            String(SLIDE_PNG_LONG_EDGE),
            pdf,
            join(dir, "slide"),
          ],
          { timeoutMs: remaining(), cwd: dir, env },
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
        let droppedOversize = 0;
        let droppedByBudget = 0;
        let totalBytes = 0;
        for (const file of keep) {
          const path = join(dir, file);
          // Blocker 2: erst stat, dann laden — ein Einzel-PNG über dem Deckel wird NIE gelesen,
          // und ist die Gesamtgrenze erreicht, werden die restlichen Folien ehrlich verworfen
          // (die Schleife läuft kontrolliert weiter, damit die Zähler stimmen; finally räumt auf).
          const info = await stat(path);
          if (info.size > maxSlidePngBytes) {
            droppedOversize += 1;
            continue;
          }
          if (totalBytes + info.size > maxTotalSlidesBytes) {
            droppedByBudget += 1;
            continue;
          }
          totalBytes += info.size;
          pngs.push(await loadFile(path));
        }
        return {
          pngs,
          truncated,
          droppedOversize,
          droppedByBudget,
          truncatedByBudget: droppedByBudget > 0,
        };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
