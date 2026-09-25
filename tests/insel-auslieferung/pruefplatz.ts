// ================================================================================================
// JOB B4-INSEL-RELEASE — DER PRÜFSTAND FÜR DIE VOLLSTÄNDIGE AUSLIEFERUNGSSTRECKE DES INSELPAKETS.
// ================================================================================================
//
// Diese Datei enthält KEINE Erwartung und keinen Fall, nur den Stand (dieselbe Trennung wie
// `tests/insel-echter-start/echter-lauf.ts`). Was gemessen wird, steht in
// `release-update-rueckfall.integration.test.ts`.
//
// WAS HIER ECHT IST:
//   BAU     Jedes Paket entsteht mit dem OFFIZIELLEN Bauer (`scripts/insel/build-current-release.mjs`)
//           in einem eigenen Klon GENAU des Standes, den es ausliefert — die Vorgängerversion aus
//           ihrem eigenen Commit, mit ihrem eigenen Bauer, ihrer eigenen Oberfläche und ihren
//           eigenen Betriebswegen. Verpackt wird mit `zip` (kein `--ohne-verpackung`).
//           Der Klon leiht sich aus dem Arbeitsbaum AUSSCHLIESSLICH die Bauwerkzeuge (`node_modules`
//           für `vite`); ins Paket gelangen sie nicht — der Bauer lässt `node_modules` aus und
//           installiert die Laufzeitabhängigkeiten selbst mit `npm ci --omit=dev`.
//   ZIEL    Ein leeres Verzeichnis AUSSERHALB des Repos. Die Pakete werden dorthin kopiert
//           („übertragen"), dort unabhängig gehasht und dort ausgepackt. Der Betreiberweg dort ist
//           der dokumentierte: `install.command` aus dem ausgepackten Paket, danach
//           `…/current/scripts/insel/update-einspielen.sh <zip>` und `rueckfall.sh`.
//   START   Der Weg, den die Paketskripte selbst wählen (`insel-betrieb.sh`): OHNE geladenen
//           launchd-Agenten `nohup start.command`, MIT geladenem Agenten `launchctl kickstart -k`.
//           Für den zweiten Weg wird ein ECHTER launchd-Agent in die Sitzung des Prüfkontos
//           geladen — unter einem EIGENEN Label, nie `de.klarwerk.insel`, und am Ende entladen.
//
// WAS DER PRÜFSTAND BEWUSST SETZT, benannt:
//   KLARWERK_SHARED_ROOT   die Zielumgebung statt `/Users/Shared/Klarwerk_Insel` (auf dem Mac
//                          Studio ist das der Standard — hier darf nichts Fremdes angefasst werden).
//   PORT                   ein freier Port statt 3002 (derselbe Grund).
//   KLARWERK_LAUNCHD_LABEL ein eigenes Label. Ohne Agent unter diesem Label nehmen die Skripte den
//                          eigenen Start; ein auf diesem Rechner geladenes `de.klarwerk.insel` wird
//                          dadurch NIE neu gestartet.
//   KLARWERK_SKIP_KEYCHAIN aus demselben Grund wie in `tools/test` und `echter-lauf.ts`.
// Sonst nichts: keine Zusatzwerte für den Start, kein nachgebautes Startskript, keine Attrappe.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

export const WURZEL = resolve(import.meta.dirname, "../..");
const BAUER = "scripts/insel/build-current-release.mjs";

/**
 * DIE DEFINIERTE UNTERSTÜTZTE VORGÄNGERVERSION: `1.0.0-beta.1.580` (ship JOB 4332).
 *
 * WARUM GENAU DIESE: Sie ist die erste ausgelieferte Fassung, deren EIGENER Startbefehl das Paket
 * wirklich startet (JOB 4332 schloss Befund B1 aus JOB 4315: vorher brach jedes Paket mit
 * „StartvertragError … APP_BASE_URL, DATABASE_URL" ab). Eine ältere Fassung ist kein
 * unterstützter Ausgangspunkt — sie läuft beim Betreiber gar nicht. Ihre Betriebswege
 * (`scripts/insel/*`) sind byte-gleich mit dem Stand vor diesem Auftrag.
 */
export const VORGAENGER = {
  commit: "fdeb3c0445595d4efc76990e00364a049b37805c",
  appVersion: "1.0.0-beta.1.580",
} as const;

export interface Lauf {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly ms: number;
}

export function fahreBefehl(
  befehl: string,
  argumente: readonly string[],
  o: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Lauf {
  const beginn = Date.now();
  const lauf = spawnSync(befehl, argumente, {
    cwd: o.cwd,
    env: o.env ?? process.env,
    encoding: "utf8",
    timeout: o.timeoutMs ?? 600_000,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: lauf.status,
    stdout: lauf.stdout ?? "",
    stderr: `${lauf.stderr ?? ""}${lauf.error ? `\n${String(lauf.error)}` : ""}`,
    ms: Date.now() - beginn,
  };
}

/**
 * DASSELBE FÜR LANGE SCHRITTE (Bau, Betriebswege) — asynchron. Ein `spawnSync` über Minuten hält
 * den Vitest-Arbeiter an; er meldete dann „Timeout calling onTaskUpdate" und brach den Lauf ab.
 */
export function fahreLang(
  befehl: string,
  argumente: readonly string[],
  o: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): Promise<Lauf> {
  const beginn = Date.now();
  return new Promise((fertig) => {
    const kind = spawn(befehl, argumente, {
      cwd: o.cwd,
      env: o.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const aus: Buffer[] = [];
    const fehler: Buffer[] = [];
    kind.stdout.on("data", (d: Buffer) => aus.push(d));
    kind.stderr.on("data", (d: Buffer) => fehler.push(d));
    const frist = setTimeout(() => kind.kill("SIGKILL"), o.timeoutMs ?? 900_000);
    let startfehler = "";
    kind.on("error", (e) => {
      startfehler = `\n${String(e)}`;
    });
    kind.on("close", (code) => {
      clearTimeout(frist);
      fertig({
        code,
        stdout: Buffer.concat(aus).toString("utf8"),
        stderr: `${Buffer.concat(fehler).toString("utf8")}${startfehler}`,
        ms: Date.now() - beginn,
      });
    });
  });
}

function mussGelingen(lauf: Lauf, was: string): string {
  if (lauf.code !== 0) {
    throw new Error(
      `${was} scheiterte (Exit ${lauf.code}):\n${lauf.stdout.slice(-4000)}\n${lauf.stderr.slice(-4000)}`,
    );
  }
  return lauf.stdout;
}

export function sha256Datei(pfad: string): string {
  return createHash("sha256").update(readFileSync(pfad)).digest("hex");
}

export function sha256Puffer(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Ein freier Port vom Betriebssystem — kein geratener. */
export function freierPort(): Promise<number> {
  return new Promise((fertig, fehler) => {
    const horcher = createServer();
    horcher.on("error", fehler);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      const port = typeof adresse === "object" && adresse !== null ? adresse.port : 0;
      horcher.close(() => (port > 0 ? fertig(port) : fehler(new Error("kein freier Port"))));
    });
  });
}

/** Die letzte nicht leere Zeile der Standardausgabe — die Ergebniszeile der Betriebswege. */
export function ergebniszeile(stdout: string): string {
  const zeilen = stdout.split("\n").filter((z) => z.trim() !== "");
  return zeilen[zeilen.length - 1] ?? "";
}

// ------------------------------------------------------------------------------------------------
// 1 · DER BAU
// ------------------------------------------------------------------------------------------------

export interface Stand {
  /** Der Commit, aus dem gebaut wird. */
  readonly stand: string;
  readonly head: string;
  /** `true`, wenn der Arbeitsbaum Änderungen gegenüber HEAD trägt (dann ist `stand` ihr Abbild). */
  readonly arbeitsstand: boolean;
}

/**
 * Der Stand der AKTUELLEN KORREKTURAUSGABE. Am festen Commit (Prüfung durch Ben, Linux-Tor) ist das
 * schlicht HEAD. Trägt der Arbeitsbaum noch nicht festgehaltene Änderungen an verfolgten Dateien,
 * wird ihr Abbild mit `git stash create` als Commit-OBJEKT erzeugt — ohne den (geteilten)
 * Stash-Stapel und ohne irgendeine Referenz anzufassen. Eine NEUE, unverfolgte Produktdatei käme
 * darin nicht vor; dann bricht der Bau ab, statt ein Paket ohne sie zu liefern.
 */
export function aktuellerStand(): Stand {
  const git = (argumente: readonly string[]) =>
    mussGelingen(
      fahreBefehl("git", argumente, { cwd: WURZEL }),
      `git ${argumente.join(" ")}`,
    ).trim();
  const head = git(["rev-parse", "HEAD"]);
  const unverfolgt = git([
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    "services",
    "scripts",
    "apps/web",
    "package.json",
    "package-lock.json",
  ])
    .split("\n")
    .filter((z) => z.startsWith("??"));
  if (unverfolgt.length > 0) {
    throw new Error(
      `Unverfolgte Produktdateien — das Paket würde sie nicht enthalten:\n${unverfolgt.join("\n")}`,
    );
  }
  const abbild = git(["stash", "create"]);
  return { stand: abbild === "" ? head : abbild, head, arbeitsstand: abbild !== "" };
}

/**
 * DIE BAUM-SHA DES GANZEN ARBEITSBAUMS (verfolgte UND neue, nicht ignorierte Dateien) — über einen
 * EIGENEN, temporären Index, der echte Index bleibt unberührt. Sie ist gleich
 * `git rev-parse <commit>^{tree}` des Commits, der genau diesen Baum festhält; damit ist ein
 * Lauf eindeutig einer Revision zuzuordnen, auch wenn er VOR dem Festhalten gefahren wurde.
 */
export function arbeitsbaumSha(): string {
  const ordner = mkdtempSync(join(tmpdir(), "kwi-index-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(ordner, "index") };
    for (const argumente of [
      ["read-tree", "HEAD"],
      ["add", "-A"],
    ]) {
      mussGelingen(fahreBefehl("git", argumente, { cwd: WURZEL, env }), `git ${argumente[0]}`);
    }
    return mussGelingen(
      fahreBefehl("git", ["write-tree"], { cwd: WURZEL, env }),
      "git write-tree",
    ).trim();
  } finally {
    rmSync(ordner, { recursive: true, force: true });
  }
}

export interface Paket {
  readonly rolle: string;
  readonly releaseName: string;
  readonly appVersion: string;
  readonly commit: string;
  /** Das Zip auf dem Bauplatz (Kopie des Bauerzeugnisses, außerhalb des Klons). */
  readonly zip: string;
  /** Der SHA-256 des Bauerzeugnisses, gemessen am Bauplatz. */
  readonly sha256: string;
  readonly bytes: number;
  readonly bauMs: number;
}

interface Bauausgabe {
  version?: unknown;
  commit?: unknown;
  verpackt?: unknown;
  zipPath?: unknown;
  size?: unknown;
}

function letztesJson(ausgabe: string): Bauausgabe | undefined {
  const zeilen = ausgabe.split("\n");
  const zu = zeilen.map((z) => z.trimEnd()).lastIndexOf("}");
  for (let auf = zu; auf >= 0; auf -= 1) {
    if (zeilen[auf]?.trimEnd() === "{") {
      try {
        return JSON.parse(zeilen.slice(auf, zu + 1).join("\n")) as Bauausgabe;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export interface Aenderung {
  readonly datei: string;
  readonly vorher: string;
  readonly nachher: string;
}

/** Der Bauplatz: Klone, Bauläufe, Zips. Liegt außerhalb des Repos und wird am Ende gelöscht. */
export class Bauplatz {
  readonly ordner = realpathSync(mkdtempSync(join(tmpdir(), "klarwerk-insel-bauplatz-")));
  readonly pakete = join(this.ordner, "pakete");

  constructor() {
    mkdirSync(this.pakete, { recursive: true });
  }

  /** Ein eigener Klon genau dieses Standes. Die Objekte teilt er mit dem Repo (`--shared`). */
  klone(name: string, stand: string): string {
    const klon = join(this.ordner, name);
    mussGelingen(
      fahreBefehl("git", ["clone", "--quiet", "--shared", "--no-checkout", WURZEL, klon], {
        cwd: this.ordner,
      }),
      `Klon ${name}`,
    );
    mussGelingen(
      fahreBefehl("git", ["checkout", "--quiet", "--detach", stand], { cwd: klon }),
      `Checkout ${stand} in ${name}`,
    );
    // NUR die Bauwerkzeuge (vite und seine Abhängigkeiten). Der Bauer kopiert `node_modules` nie
    // ins Release (`skipNames`) und installiert dort mit `npm ci --omit=dev` neu.
    for (const teil of ["node_modules", join("apps", "web", "node_modules")]) {
      const quelle = join(WURZEL, teil);
      if (existsSync(quelle)) {
        symlinkSync(realpathSync(quelle), join(klon, teil));
      }
    }
    return klon;
  }

  /** Die Oberfläche des Klons mit DEMSELBEN Aufruf wie `tools/build` (`vite build`). */
  async webBauen(klon: string): Promise<number> {
    const lauf = await fahreLang("npx", ["vite", "build"], {
      cwd: join(klon, "apps", "web"),
      timeoutMs: 1_200_000,
    });
    mussGelingen(lauf, `vite build in ${klon}`);
    return lauf.ms;
  }

  /**
   * Eine Paketvariante: genau benannte Textänderungen, eine eigene App-Version, ein eigener Commit
   * im Klon. Jede Änderung MUSS greifen — ein Muster, das nicht mehr passt, bricht ab, statt eine
   * unveränderte „Variante" zu bauen.
   */
  veraendere(
    klon: string,
    o: {
      ausgehendVon: string;
      aenderungen: readonly Aenderung[];
      versionszusatz: string;
      nachricht: string;
    },
  ): void {
    // Jede Variante geht vom Stand der Korrekturausgabe aus, nicht von der vorigen Variante. Die
    // gebaute Oberfläche (`apps/web/dist`, nicht verfolgt) bleibt dabei liegen.
    mussGelingen(
      fahreBefehl("git", ["checkout", "--quiet", "--detach", o.ausgehendVon], { cwd: klon }),
      `Checkout ${o.ausgehendVon} für die Variante`,
    );
    for (const a of o.aenderungen) {
      const pfad = join(klon, a.datei);
      const text = readFileSync(pfad, "utf8");
      if (!text.includes(a.vorher)) {
        throw new Error(`Variante: in ${a.datei} steht die erwartete Stelle nicht:\n${a.vorher}`);
      }
      writeFileSync(pfad, text.replace(a.vorher, a.nachher));
    }
    const paketPfad = join(klon, "package.json");
    const paket = JSON.parse(readFileSync(paketPfad, "utf8")) as { version: string };
    paket.version = `${paket.version}${o.versionszusatz}`;
    writeFileSync(paketPfad, `${JSON.stringify(paket, null, 2)}\n`);
    mussGelingen(
      fahreBefehl(
        "git",
        [
          "-c",
          "user.name=Inselprobe",
          "-c",
          "user.email=inselprobe@example.invalid",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "--quiet",
          "--no-verify",
          "-am",
          o.nachricht,
        ],
        { cwd: klon },
      ),
      `Variantencommit in ${klon}`,
    );
  }

  /** DER OFFIZIELLE BAUER, verpackt. Das Zip wird auf den Bauplatz kopiert und dort gehasht. */
  async paketBauen(klon: string, rolle: string): Promise<Paket> {
    const lauf = await fahreLang("node", [BAUER], { cwd: klon, timeoutMs: 1_800_000 });
    mussGelingen(lauf, `Paketbau ${rolle}`);
    const aus = letztesJson(lauf.stdout);
    if (aus?.verpackt !== true || typeof aus.zipPath !== "string" || !existsSync(aus.zipPath)) {
      throw new Error(
        `Paketbau ${rolle}: kein verpacktes Paket gemeldet:\n${lauf.stdout.slice(-2000)}`,
      );
    }
    const ziel = join(this.pakete, basename(aus.zipPath));
    copyFileSync(aus.zipPath, ziel);
    const vertrag = fahreBefehl("unzip", ["-p", ziel, `${String(aus.version)}/SCHEMA-VERTRAG`], {
      cwd: this.ordner,
    });
    const appVersion = /^app_version=(.*)$/m.exec(vertrag.stdout)?.[1]?.trim() ?? "";
    return {
      rolle,
      releaseName: String(aus.version),
      appVersion,
      commit: String(aus.commit),
      zip: ziel,
      sha256: sha256Datei(ziel),
      bytes: statSync(ziel).size,
      bauMs: lauf.ms,
    };
  }

  raeumeAuf(): void {
    rmSync(this.ordner, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------------------------------------
// 2 · DIE ZIELUMGEBUNG
// ------------------------------------------------------------------------------------------------

export type Startweg = "eigenstart" | "launchd";

export interface Prozess {
  readonly pid: number;
  readonly befehl: string;
  readonly cwd: string;
}

/** Was von außen an einer Insel zu sehen ist — ohne eine Zeile ihrer eigenen Ausgabe zu glauben. */
export interface Serverbild {
  readonly zeit: string;
  readonly health: { readonly code: number; readonly version: string } | null;
  /** Die Prozesse, die WIRKLICH auf dem Port lauschen (`lsof`), mit Arbeitsverzeichnis. */
  readonly lauscher: readonly Prozess[];
  /** Jeder Prozess, dessen Befehlszeile in der Zielumgebung liegt. */
  readonly prozesse: readonly Prozess[];
  readonly current: string | null;
  readonly aktiv: string | null;
  readonly vorversion: string | null;
}

export interface Betreiberlauf extends Lauf {
  readonly befehl: string;
  readonly ergebnis: string;
}

const LSOF = ["/usr/sbin/lsof", "/usr/bin/lsof"].find((p) => existsSync(p)) ?? "lsof";

function lsofZeilen(argumente: readonly string[]): string[] {
  const lauf = spawnSync(LSOF, argumente, { encoding: "utf8" });
  return (lauf.stdout ?? "").split("\n").filter((z) => z !== "");
}

export function arbeitsverzeichnis(pid: number): string {
  const zeile = lsofZeilen(["-a", "-p", String(pid), "-d", "cwd", "-Fn"]).find((z) =>
    z.startsWith("n"),
  );
  return zeile?.slice(1) ?? "";
}

/** Die Pfade, die ein Prozess gerade offen oder eingeblendet hat (`lsof -p`). */
export function offeneDateien(pid: number): string[] {
  return lsofZeilen(["-p", String(pid), "-Fn"])
    .filter((z) => z.startsWith("n/"))
    .map((z) => z.slice(1));
}

export function lebt(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function alleProzesse(): { pid: number; befehl: string }[] {
  const lauf = spawnSync("ps", ["-axww", "-o", "pid=,command="], { encoding: "utf8" });
  return (lauf.stdout ?? "")
    .split("\n")
    .map((z) => /^\s*(\d+)\s+(.*)$/.exec(z))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ pid: Number(m[1]), befehl: m[2] ?? "" }));
}

export class Pruefplatz {
  readonly wurzel: string;
  readonly eingang: string;
  readonly shared: string;
  readonly label: string;
  readonly plist: string;
  readonly uid = typeof process.getuid === "function" ? process.getuid() : -1;

  constructor(
    readonly startweg: Startweg,
    readonly port: number,
    marke: string,
  ) {
    // KURZER ORT: `tsx` legt seinen IPC-Socket unter `$TMPDIR/tsx-<uid>/<pid>.pipe` an, und ein
    // Unix-Socketpfad darf auf macOS höchstens 104 Zeichen lang sein. Unter dem langen
    // `/var/folders/…/T/…` riss der Start mit `listen EINVAL` (gemessen im ersten Lauf).
    const basis = existsSync("/tmp") ? realpathSync("/tmp") : tmpdir();
    this.wurzel = realpathSync(mkdtempSync(join(basis, `kwi-${marke}-`)));
    if (!relative(WURZEL, this.wurzel).startsWith("..")) {
      throw new Error(`Zielumgebung ${this.wurzel} liegt IM Repo — dann misst sie nichts.`);
    }
    this.eingang = join(this.wurzel, "eingang");
    this.shared = join(this.wurzel, "Klarwerk_Insel");
    mkdirSync(this.eingang, { recursive: true });
    mkdirSync(join(this.wurzel, "t"), { recursive: true });
    this.label = `de.klarwerk.insel.pruefplatz.${process.pid}.${port}`;
    this.plist = join(this.wurzel, "launchd", `${this.label}.plist`);
  }

  get logDatei(): string {
    return join(this.shared, "logs", `server-${this.port}.log`);
  }

  get journal(): string {
    return join(this.shared, "data", "state.jsonl");
  }

  /** Die Umgebung des Betreibers: was ein leerer Rechner hat, plus die vier benannten Werte. */
  umgebung(pfad?: string): NodeJS.ProcessEnv {
    return {
      PATH: pfad ?? `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
      HOME: process.env.HOME ?? this.wurzel,
      TMPDIR: join(this.wurzel, "t"),
      LANG: "de_DE.UTF-8",
      TZ: "Europe/Berlin",
      KLARWERK_SHARED_ROOT: this.shared,
      PORT: String(this.port),
      KLARWERK_LAUNCHD_LABEL: this.label,
      KLARWERK_SKIP_KEYCHAIN: "1",
    };
  }

  /** „Übertragen": das Zip in den Eingang der Zielumgebung kopieren und DORT hashen. */
  uebertrage(paket: Paket): { pfad: string; sha256: string } {
    const pfad = join(this.eingang, basename(paket.zip));
    copyFileSync(paket.zip, pfad);
    return { pfad, sha256: sha256Datei(pfad) };
  }

  /** Mit `unzip` in einen eigenen Ordner des Eingangs auspacken. Zurück: der Releaseordner. */
  entpacke(zip: string, releaseName: string): string {
    const ziel = join(this.eingang, `entpackt-${releaseName}`);
    mkdirSync(ziel, { recursive: true });
    mussGelingen(fahreBefehl("unzip", ["-q", zip, "-d", ziel], { cwd: this.wurzel }), "unzip");
    return join(ziel, releaseName);
  }

  /** Ein Betriebsweg, so gerufen wie vom Menschen: `bash <skript> <argumente…>`. */
  async fahre(skript: string, argumente: readonly string[], pfad?: string): Promise<Betreiberlauf> {
    const lauf = await fahreLang("bash", [skript, ...argumente], {
      cwd: this.wurzel,
      env: this.umgebung(pfad),
      timeoutMs: 900_000,
    });
    return {
      ...lauf,
      befehl: `bash ${skript} ${argumente.join(" ")}`.trim(),
      ergebnis: ergebniszeile(lauf.stdout),
    };
  }

  /** Der dokumentierte Updatebefehl: `…/current/scripts/insel/update-einspielen.sh`. */
  get updateSkript(): string {
    return join(this.shared, "current", "scripts", "insel", "update-einspielen.sh");
  }

  get rueckfallSkript(): string {
    return join(this.shared, "current", "scripts", "insel", "rueckfall.sh");
  }

  /**
   * DER LAUNCHD-AGENT — wie auf dem Mac Studio (`tools/studio/klarwerk-app-launcher.applescript`:
   * ein Agent, der `current/start.command` fährt; der Wechsel geschieht mit `kickstart -k`).
   * `RunAtLoad` ist aus: gestartet wird er vom Betriebsweg, nicht vom Laden. `KeepAlive` nur bei
   * erfolglosem Ende — ein abstürzendes Release wird also wie im Betrieb neu versucht.
   */
  ladeAgent(): void {
    if (process.platform !== "darwin") {
      throw new Error(
        `Startweg launchd braucht einen macOS-Prüfplatz (K8); dieser Rechner ist ${process.platform}.`,
      );
    }
    mkdirSync(dirname(this.plist), { recursive: true });
    mkdirSync(join(this.shared, "logs"), { recursive: true });
    const umgebung = this.umgebung();
    const eintraege = [
      "PATH",
      "HOME",
      "LANG",
      "TZ",
      "KLARWERK_SHARED_ROOT",
      "PORT",
      "KLARWERK_SKIP_KEYCHAIN",
    ]
      .map((k) => `    <key>${k}</key><string>${xml(String(umgebung[k] ?? ""))}</string>`)
      .join("\n");
    writeFileSync(
      this.plist,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${xml(this.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${xml(join(this.shared, "current", "start.command"))}</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
${eintraege}
  </dict>
  <key>WorkingDirectory</key><string>${xml(this.wurzel)}</string>
  <key>StandardOutPath</key><string>${xml(this.logDatei)}</string>
  <key>StandardErrorPath</key><string>${xml(this.logDatei)}</string>
  <key>RunAtLoad</key><false/>
  <key>KeepAlive</key>
  <dict><key>SuccessfulExit</key><false/></dict>
</dict>
</plist>
`,
    );
    mussGelingen(
      fahreBefehl("launchctl", ["bootstrap", `gui/${this.uid}`, this.plist], { cwd: this.wurzel }),
      "launchctl bootstrap",
    );
  }

  agentGeladen(): boolean {
    return (
      fahreBefehl("launchctl", ["print", `gui/${this.uid}/${this.label}`], { cwd: this.wurzel })
        .code === 0
    );
  }

  /** Was gerade läuft — gemessen am Port, an den Prozessen und am Dateisystem. */
  async beobachte(): Promise<Serverbild> {
    let health: Serverbild["health"] = null;
    try {
      const antwort = await fetch(`http://127.0.0.1:${this.port}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      const rumpf = (await antwort.json().catch(() => ({}))) as { version?: unknown };
      health = {
        code: antwort.status,
        version: typeof rumpf.version === "string" ? rumpf.version : "",
      };
    } catch {
      health = null;
    }
    const alle = alleProzesse();
    const lauscherPids = lsofZeilen(["-nP", `-iTCP:${this.port}`, "-sTCP:LISTEN", "-t"]).map(
      Number,
    );
    const mitOrt = (pid: number): Prozess => ({
      pid,
      befehl: alle.find((p) => p.pid === pid)?.befehl ?? "",
      cwd: arbeitsverzeichnis(pid),
    });
    const lies = (datei: string): string | null =>
      existsSync(join(this.shared, datei))
        ? readFileSync(join(this.shared, datei), "utf8").trim()
        : null;
    const currentPfad = join(this.shared, "current");
    let current: string | null = null;
    try {
      if (lstatSync(currentPfad).isSymbolicLink()) {
        current = basename(readlinkSync(currentPfad));
      }
    } catch {
      current = null;
    }
    return {
      zeit: new Date().toISOString(),
      health,
      lauscher: [...new Set(lauscherPids)].map(mitOrt),
      prozesse: alle
        .filter((p) => p.befehl.includes(this.wurzel))
        .map((p) => ({ ...p, cwd: arbeitsverzeichnis(p.pid) })),
      current,
      aktiv: lies("AKTIV"),
      vorversion: lies("VORVERSION"),
    };
  }

  releaseOrdner(name: string): string {
    return join(this.shared, "releases", name);
  }

  releases(): string[] {
    const ordner = join(this.shared, "releases");
    return existsSync(ordner) ? readdirSync(ordner).sort() : [];
  }

  /** Alle Sicherungsdateien mit Prüfsumme — für „Sicherungen bleiben erhalten". */
  sicherungen(): Record<string, string> {
    const ordner = join(this.shared, "backups");
    const befund: Record<string, string> = {};
    if (!existsSync(ordner)) {
      return befund;
    }
    for (const lauf of readdirSync(ordner).sort()) {
      const laufOrdner = join(ordner, lauf);
      if (!statSync(laufOrdner).isDirectory()) {
        continue;
      }
      for (const datei of readdirSync(laufOrdner).sort()) {
        befund[`${lauf}/${datei}`] = sha256Datei(join(laufOrdner, datei));
      }
    }
    return befund;
  }

  log(): string {
    return existsSync(this.logDatei) ? readFileSync(this.logDatei, "utf8") : "";
  }

  /** Jeden Prozess dieser Zielumgebung beenden — TERM, dann KILL. */
  async beendeAlles(): Promise<number[]> {
    const pids = alleProzesse()
      .filter((p) => p.befehl.includes(this.wurzel))
      .map((p) => p.pid);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* schon weg */
      }
    }
    const frist = Date.now() + 10_000;
    while (Date.now() < frist && pids.some(lebt)) {
      await new Promise((weiter) => setTimeout(weiter, 200));
    }
    for (const pid of pids.filter(lebt)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* schon weg */
      }
    }
    return pids;
  }

  async raeumeAuf(behalten: boolean): Promise<void> {
    if (this.startweg === "launchd" && this.agentGeladen()) {
      fahreBefehl("launchctl", ["bootout", `gui/${this.uid}/${this.label}`], { cwd: this.wurzel });
    }
    await this.beendeAlles();
    if (!behalten) {
      rmSync(this.wurzel, { recursive: true, force: true });
    }
  }
}

function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ein `PATH`, auf dem `unzip` NACHWEISLICH fehlt und sonst jedes Systemwerkzeug liegt — gebaut aus
 * Verweisen auf die echten Werkzeuge, nicht aus Attrappen (Bauart wie `echter-lauf.ts: pfadOhneZip`).
 */
export function pfadOhneUnzip(ordner: string): string {
  mkdirSync(ordner, { recursive: true });
  const gesetzt = new Set<string>();
  for (const quelle of ["/usr/local/bin/node", process.execPath]) {
    if (!gesetzt.has("node") && existsSync(quelle)) {
      symlinkSync(quelle, join(ordner, "node"));
      gesetzt.add("node");
    }
  }
  for (const verzeichnis of ["/bin", "/usr/bin", "/usr/sbin", "/sbin"]) {
    if (!existsSync(verzeichnis)) {
      continue;
    }
    for (const name of readdirSync(verzeichnis)) {
      if (name === "unzip" || gesetzt.has(name)) {
        continue;
      }
      symlinkSync(join(verzeichnis, name), join(ordner, name));
      gesetzt.add(name);
    }
  }
  const probe = spawnSync("sh", ["-c", "command -v unzip"], { env: { PATH: ordner } });
  if (probe.status === 0) {
    throw new Error(`unzip ist auf ${ordner} trotzdem auffindbar.`);
  }
  return ordner;
}

/** Symlinks in einem Release, die AUS ihm herauszeigen — ein Paket muss ohne sie auskommen. */
export function fremdverweise(release: string): string[] {
  const funde: string[] = [];
  const echt = realpathSync(release);
  const gehe = (ordner: string) => {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name);
      const art = lstatSync(pfad);
      if (art.isSymbolicLink()) {
        let ziel = "";
        try {
          ziel = realpathSync(pfad);
        } catch {
          funde.push(`${relative(release, pfad)} → (unauflösbar) ${readlinkSync(pfad)}`);
          continue;
        }
        if (relative(echt, ziel).startsWith("..")) {
          funde.push(`${relative(release, pfad)} → ${ziel}`);
        }
      } else if (art.isDirectory()) {
        gehe(pfad);
      }
    }
  };
  gehe(release);
  return funde;
}

/** Die Git-Beschreibung eines Standes — für den Beleg. */
export function gitZeile(stand: string): string {
  return execFileSync("git", ["log", "-1", "--format=%h %s", stand], {
    cwd: WURZEL,
    encoding: "utf8",
  }).trim();
}
