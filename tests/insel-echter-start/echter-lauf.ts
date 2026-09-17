// ================================================================================================
// JOB 4315 — DER PRÜFSTAND FÜR EINEN ECHTEN INSELLAUF.
// ================================================================================================
//
// WAS HIER ECHT IST UND WAS NICHT — die Grenze gehört an dieselbe Stelle wie die Behauptung:
//
//   ECHT   Der offizielle Paketbauer (`scripts/insel/build-current-release.mjs`), sein
//          `npm ci --omit=dev`, das Release, das dabei entsteht, die Kopie davon in einem leeren
//          Verzeichnis AUSSERHALB des Repos, sein eigenes `start.command`, der Fastify-Prozess
//          daraus und jede HTTP-Antwort, die dieser Prozess gibt.
//   NICHT BEHAUPTET  Der ZIP-Schritt, das Auspacken über `unzip`, der Lauf auf dem Mac Studio,
//          `update-einspielen.sh`/Rückfall und die Bedienung durch einen Menschen. Keines davon
//          wird hier gefahren, und ein nicht gefahrener Fall gilt nie als bestanden.
//
// WARUM DER PRÜFSTAND IN EINER EIGENEN DATEI STEHT und nicht in der Testdatei daneben: dieselbe
// Begründung wie bei `tests/insel-paketausgabe/paketprobe.ts` (JOB 4285) — diese Datei enthält KEINE
// Erwartung und keinen Fall, nur den Stand. Was gemessen wird, steht in der Testdatei.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

export const WURZEL = resolve(import.meta.dirname, "../..");
export const BAUER = join(WURZEL, "scripts/insel/build-current-release.mjs");
/** Die Datei, an der das Paket beim Kunden zum ersten Mal starb (Befund T-015). */
export const FREMDQUELLE = "apps/web/src/lib/docx.ts";

const arbeitsordner: string[] = [];

/**
 * Ein leeres Wegwerfverzeichnis AUSSERHALB des Repos — so wie es auf dem Mac Studio aussieht: kein
 * Repo daneben, kein Entwicklerbaum. Genau dort fiel der fehlende Querimport auf; ein Ordner IM
 * Repo hätte ihn nie gezeigt (`apps/web/src/lib/docx.ts` läge dann zufällig daneben).
 */
export function leeresZielverzeichnis(): string {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-insel-echt-"));
  arbeitsordner.push(ordner);
  if (!relative(WURZEL, ordner).startsWith("..")) {
    throw new Error(
      `Zielverzeichnis ${ordner} liegt IM Repo (${WURZEL}) — dann misst der Start nichts.`,
    );
  }
  return ordner;
}

export function raeumeAuf(): void {
  for (const ordner of arbeitsordner) {
    rmSync(ordner, { recursive: true, force: true });
  }
  arbeitsordner.length = 0;
}

export interface Baulauf {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly dauerMs: number;
}

/**
 * DER ECHTE BAULAUF. Kein Nachbau, kein Ausschnitt: `node scripts/insel/build-current-release.mjs`.
 *
 * `umgebung` erlaubt einen eingeschränkten `PATH` — das ist der Weg, auf dem die Gegenprobe „ohne
 * `zip`" auf JEDEM Rechner gleich läuft, auch auf einem Mac, der `zip` in `/usr/bin` hat.
 */
export function baue(
  argumente: readonly string[],
  umgebung: NodeJS.ProcessEnv = process.env,
): Baulauf {
  const beginn = Date.now();
  const lauf = spawnSync("node", [BAUER, ...argumente], {
    cwd: WURZEL,
    env: umgebung,
    encoding: "utf8",
    timeout: 1_800_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: lauf.status,
    stdout: lauf.stdout ?? "",
    stderr: `${lauf.stderr ?? ""}${lauf.error ? `\n${String(lauf.error)}` : ""}`,
    dauerMs: Date.now() - beginn,
  };
}

/**
 * EIN `PATH`, AUF DEM `zip` NACHWEISLICH NICHT LIEGT — und alles, was der Bauer sonst braucht,
 * schon. Gebaut aus Verweisen auf die ECHTEN Werkzeuge (`command -v`), nicht aus Attrappen: der
 * Baulauf soll bis zum Verpackungsschritt wirklich durchlaufen und erst dort scheitern.
 *
 * Die Liste ist bewusst schmal und benannt. Fehlt eines der Werkzeuge auf diesem Rechner, ist das
 * ein Fehler und kein Grund, den Fall zu überspringen (der Aufrufer wertet `fehlend`).
 */
export interface OhneZip {
  readonly pfad: string;
  readonly fehlend: readonly string[];
  readonly zipAufloesbar: boolean;
}

const WERKZEUGE = [
  "node",
  "npm",
  "npx",
  "git",
  "sh",
  "bash",
  "env",
  "uname",
  "dirname",
  "basename",
  "cat",
  "chmod",
  "mkdir",
  "rm",
  "ln",
  "cp",
  "mv",
  "sed",
  "grep",
  "id",
  "tar",
  "gzip",
] as const;

export function pfadOhneZip(): OhneZip {
  const ordner = leeresZielverzeichnis();
  const fehlend: string[] = [];
  for (const werkzeug of WERKZEUGE) {
    const gefunden = spawnSync("sh", ["-c", `command -v ${werkzeug}`], { encoding: "utf8" });
    const ziel = `${gefunden.stdout ?? ""}`.trim();
    if (gefunden.status !== 0 || ziel === "") {
      fehlend.push(werkzeug);
      continue;
    }
    spawnSync("ln", ["-sfn", ziel, join(ordner, werkzeug)]);
  }
  const probe = spawnSync("sh", ["-c", "command -v zip"], {
    encoding: "utf8",
    env: { ...process.env, PATH: ordner },
  });
  return { pfad: ordner, fehlend, zipAufloesbar: probe.status === 0 };
}

/** Ein freier Port vom Betriebssystem — kein geratener (Bauart aus `tests/insel-update/insel-probe.ts`). */
export function freierPort(): Promise<number> {
  return new Promise((fertig, schiefgegangen) => {
    const horcher = createServer();
    horcher.on("error", schiefgegangen);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      const port = typeof adresse === "object" && adresse !== null ? adresse.port : 0;
      horcher.close(() => {
        if (port > 0) {
          fertig(port);
        } else {
          schiefgegangen(new Error("kein freier Port ermittelbar"));
        }
      });
    });
  });
}

export interface Inselstart {
  readonly port: number;
  readonly ausgabe: () => string;
  readonly lebt: () => boolean;
  /**
   * DAS REGULÄRE BEENDEN (JOB 4332): SIGTERM an die Prozessgruppe, dann warten, bis der Prozess von
   * SELBST geht. Gibt `true` zurück, wenn er das innerhalb der Frist tat, sonst `false` — der
   * Aufrufer soll den Unterschied messen können und nicht raten.
   *
   * WARUM NICHT EINFACH `beenden()`: Das schiesst mit SIGKILL ab. Für die Frage „übersteht der
   * Bestand einen Neustart?" wäre das der günstigere Fall am falschen Ende — der Betreiber beendet
   * seine Insel regulär, und genau dieser Weg muss den Bestand tragen.
   */
  readonly beendeRegulaer: (fristMs: number) => Promise<boolean>;
  readonly beenden: () => Promise<void>;
}

/**
 * STARTET DAS PAKET MIT SEINEM EIGENEN `start.command`.
 *
 * `detached` und die Gruppen-Beendigung sind kein Zierat: `start.command` ist ein bash-Skript, das
 * per `exec` in den Node-Prozess übergeht — in der Regel ist die Prozessnummer damit dieselbe.
 * Bricht der Startbefehl aber VOR dem `exec` ab (oder startet er künftig einen Zwischenprozess),
 * bliebe ein Kind ohne Elternteil am Port hängen. Eine eigene Prozessgruppe beendet beide.
 */
export function starteInsel(
  paket: string,
  port: number,
  zusatz: Record<string, string>,
): Inselstart {
  const teile: string[] = [];
  const kind: ChildProcess = spawn("bash", [join(paket, "start.command")], {
    cwd: paket,
    // ============================================================================================
    // EINE AUFGERÄUMTE UMGEBUNG, NICHT DIE DES TESTLAUFS.
    // ============================================================================================
    // `tests/setup-env.ts` setzt für die Suite vier Schalter (Selbstregistrierung, Demo-Seed,
    // externe Suche, Protokollstufe `silent`). Würden sie mitvererbt, liefe hier NICHT das Paket,
    // das beim Betreiber startet, sondern eine Testinstanz — und die stille Protokollstufe nähme
    // genau die Zeilen weg, an denen ein Startabbruch ablesbar ist. Weitergereicht wird deshalb
    // nur, was ein leerer Rechner ohnehin hat.
    //
    // DIE EINE AUSNAHME, benannt: `KLARWERK_SKIP_KEYCHAIN=1` — aus demselben Grund wie in
    // `tools/test:8`. Ein Prüflauf darf den persönlichen Schlüsselbund eines Macs nicht anfassen.
    // Auf der Insel entscheidet darüber der Betreiber; für den hier gemessenen Weg (Start, Health,
    // Oberfläche, Dokumentimport) spielt der Wert keine Rolle.
    env: {
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      LANG: process.env.LANG ?? "de_DE.UTF-8",
      TZ: process.env.TZ ?? "Europe/Berlin",
      KLARWERK_SKIP_KEYCHAIN: "1",
      PORT: String(port),
      ...zusatz,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  kind.stdout?.on("data", (stueck: Buffer) => teile.push(stueck.toString("utf8")));
  kind.stderr?.on("data", (stueck: Buffer) => teile.push(stueck.toString("utf8")));
  let beendet = false;
  kind.on("exit", () => {
    beendet = true;
  });
  return {
    port,
    ausgabe: () => teile.join(""),
    lebt: () => !beendet,
    beendeRegulaer: (fristMs) =>
      new Promise<boolean>((fertig) => {
        if (beendet) {
          fertig(true);
          return;
        }
        if (kind.pid === undefined) {
          fertig(false);
          return;
        }
        let entschieden = false;
        const schluss = (vonSelbst: boolean) => {
          if (!entschieden) {
            entschieden = true;
            fertig(vonSelbst);
          }
        };
        kind.on("exit", () => schluss(true));
        try {
          process.kill(-kind.pid, "SIGTERM");
        } catch {
          try {
            kind.kill("SIGTERM");
          } catch {
            schluss(false);
          }
        }
        setTimeout(() => schluss(false), fristMs).unref?.();
      }),
    beenden: () =>
      new Promise<void>((fertig) => {
        if (beendet || kind.pid === undefined) {
          fertig();
          return;
        }
        kind.on("exit", () => fertig());
        try {
          process.kill(-kind.pid, "SIGKILL");
        } catch {
          try {
            kind.kill("SIGKILL");
          } catch {
            /* schon beendet */
          }
        }
        // Fail-safe: ein Prozess, der sich nicht beenden lässt, darf den Lauf nicht anhalten.
        setTimeout(fertig, 5_000).unref?.();
      }),
  };
}

export interface Gesundheit {
  readonly erreicht: boolean;
  readonly code: number;
  readonly version: string;
  readonly rumpf: string;
  readonly wartezeitMs: number;
}

/**
 * WARTET MIT ENDLICHER FRIST AUF `/health`. Solange nichts geantwortet hat, gilt das Paket als
 * UNBEKANNT, nie als gesund — und die Frist steht im Ergebnis, damit sie in der Rückgabe genannt
 * werden kann.
 */
export async function warteAufGesundheit(start: Inselstart, fristMs: number): Promise<Gesundheit> {
  const beginn = Date.now();
  let letzterRumpf = "";
  let letzterCode = 0;
  while (Date.now() - beginn < fristMs) {
    if (!start.lebt()) {
      break;
    }
    try {
      const antwort = await fetch(`http://127.0.0.1:${start.port}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      letzterCode = antwort.status;
      letzterRumpf = await antwort.text();
      if (antwort.status === 200) {
        const gelesen = JSON.parse(letzterRumpf) as { version?: unknown };
        return {
          erreicht: true,
          code: 200,
          version: typeof gelesen.version === "string" ? gelesen.version : "",
          rumpf: letzterRumpf,
          wartezeitMs: Date.now() - beginn,
        };
      }
    } catch {
      /* noch nicht da — weiter warten */
    }
    await new Promise((weiter) => setTimeout(weiter, 250));
  }
  return {
    erreicht: false,
    code: letzterCode,
    version: "",
    rumpf: letzterRumpf,
    wartezeitMs: Date.now() - beginn,
  };
}

/** Antwortet auf diesem Port schon irgendetwas? Vor dem Start muss die Antwort „nein" lauten. */
export async function portBelegt(port: number): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1_000) });
    return true;
  } catch {
    return false;
  }
}

/** Eine Zeile aus `BUILD_INFO` oder `SCHEMA-VERTRAG`. */
export function feldAus(text: string, name: string): string {
  return new RegExp(`^${name}=(.*)$`, "m").exec(text)?.[1]?.trim() ?? "";
}

/** Die App-Version, die GENAU DIESES Paket mitbringt — aus seiner eigenen `package.json`. */
export function paketVersion(paket: string): string {
  const roh = JSON.parse(readFileSync(join(paket, "package.json"), "utf8")) as {
    version?: unknown;
  };
  return typeof roh.version === "string" ? roh.version : "";
}

/**
 * KOPIERT DAS FERTIGE RELEASE IN EIN LEERES VERZEICHNIS AUSSERHALB DES REPOS.
 *
 * `recursive` kopiert Symlinks als Symlinks (`dereference` steht auf `false`) — die relativen
 * Verweise in `node_modules/.bin` bleiben damit heil. Der Modus wird übernommen, `start.command`
 * ist im Ziel also weiterhin ausführbar; genau das misst der Fall dazu.
 */
export function kopiereNachAussen(releaseDir: string): string {
  const ziel = join(leeresZielverzeichnis(), "current");
  cpSync(releaseDir, ziel, { recursive: true });
  if (!existsSync(join(ziel, "start.command"))) {
    throw new Error(`Kopie unvollstaendig: ${join(ziel, "start.command")} fehlt.`);
  }
  return ziel;
}
