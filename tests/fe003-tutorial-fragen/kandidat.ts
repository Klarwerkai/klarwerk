// ================================================================================================
// FE-003 · E8 — DER KANDIDAT ALS LAUFENDE VORSCHAU: gebaut, gestartet, zugeordnet, aufgeräumt.
// ================================================================================================
//
// Diese Datei enthält KEINE Erwartung und keinen Fall, nur den Prüfstand (Bauart wie
// `tests/insel-echter-start/echter-lauf.ts`). Was gemessen wird, steht in
//   · `vorschau-weg.integration.test.ts`    — /health, KI aus, /fragen (E8, E5),
//   · `browser-breiten.integration.test.ts` — Chromium bei 1280/1024/390 px (E1, E5, E6, E7),
//   · `kandidat-pruefung.test.ts`           — die Ablehnungen von `pruefeKandidat` gegen einen
//                                             Stellvertreter (läuft im Tor, ohne echten Server).
//
// WOHER DER SERVER KOMMT — genau eine von drei Quellen, nie ein Überspringen:
//   1. `vorschau.vitest.config.ts` baut den Kandidaten EINMAL (`tools/build`), startet ihn und reicht
//      die Adresse per `provide` an BEIDE Testdateien — derselbe Server für beide.
//   2. `FE003_KANDIDAT_URL` nennt einen bereits laufenden Kandidaten (z. B. `tools/fe003-vorschau`).
//      Er wird genauso hart geprüft; ist er nicht erreichbar, ist der Lauf rot.
//   3. Sonst (z. B. `npm run test:integration`) baut und startet jede Datei ihren eigenen.
//
// Im seriellen CI-Auswahlweg liegt tools/build in einer eigenen 240s-Phase. Der Auswahlbeleg
// bindet den abgewarteten Bau an sauberen HEAD/Tree und alle erzeugten Web-Dateien; vor der
// Wiederverwendung wird dieselbe Bindung erneut geprueft. Ohne Beleg bleibt der eigene Bau bestehen.
//
// ZUORDNUNG: `/health` muss den erwarteten Commit (`git rev-parse HEAD`, überschreibbar mit
// `FE003_ERWARTETER_COMMIT` — nur für die Gegenprobe) und die Version aus `package.json` melden. Der
// selbst gestartete Server bekommt seinen Commit wie im Container über `KLARWERK_BUILD_COMMIT`
// (`Dockerfile`, `services/app/src/build-app.ts` `buildCommit`) — aus dem ausgecheckten Stand, nicht
// aus der Vorgabe. Eine falsche Vorgabe macht den Lauf deshalb rot.
//
// KI AUS: der Server startet mit leerer Umgebung plus einer kurzen Liste harmloser Variablen, wie
// `tools/fe003-vorschau` — Zugangsdaten eines Anbieters aus der Aufrufer-Shell erreichen ihn nicht,
// kein lokales Modell, kein externer Suchdienst, Schlüsselbund zu. In-Memory, keine Datenbank.
import assert from "node:assert/strict";
import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, relative, resolve } from "node:path";

export const WURZEL = resolve(import.meta.dirname, "../..");
export const MARKE = "FE-003 Vorschauweg";
export const DIST_INDEX = join(WURZEL, "apps/web/dist/index.html");

/** Nur diese vorhandenen Kandidatdateien erhalten im seriellen CI-Weg eine Bauvorbereitung. */
export const FE003_DATEIEN = [
  "tests/fe003-tutorial-fragen/browser-breiten.integration.test.ts",
  "tests/fe003-tutorial-fragen/vorschau-weg.integration.test.ts",
];

function kindUmgebung(): NodeJS.ProcessEnv {
  const namen = [
    "PATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "USER",
    "LOGNAME",
    "SHELL",
  ];
  return {
    ...Object.fromEntries(namen.filter((n) => process.env[n]).map((n) => [n, process.env[n]])),
    KLARWERK_SKIP_KEYCHAIN: "1",
    EXTERNAL_SEARCH: "off",
    NODE_ENV: "test",
    KLARWERK_DEV_PERSIST: "0",
  };
}

function gitWert(wurzel: string, ...args: string[]): string {
  return execFileSync("git", ["--no-optional-locks", ...args], {
    cwd: wurzel,
    env: kindUmgebung(),
    encoding: "utf8",
    timeout: 30_000,
  }).trim();
}

export function saubererBaustand(wurzel = WURZEL) {
  assert.equal(gitWert(wurzel, "status", "--porcelain=v1", "--untracked-files=all"), "");
  const commit = gitWert(wurzel, "rev-parse", "HEAD");
  const tree = gitWert(wurzel, "rev-parse", "HEAD^{tree}");
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.match(tree, /^[a-f0-9]{40}$/);
  return { wurzel: realpathSync(wurzel), commit, tree };
}

export function oberflaechenBindung(wurzel = WURZEL) {
  const dist = join(wurzel, "apps/web/dist");
  const dateien: { pfad: string; bytes: number; sha256: string }[] = [];
  function lesen(pfad: string): void {
    const stat = lstatSync(pfad);
    assert(!stat.isSymbolicLink(), "keine fremden Oberflaechendateien ueber Symlinks");
    if (stat.isDirectory()) {
      for (const name of readdirSync(pfad).sort()) lesen(join(pfad, name));
    } else {
      assert(stat.isFile());
      const roh = readFileSync(pfad);
      dateien.push({
        pfad: relative(dist, pfad),
        bytes: roh.length,
        sha256: createHash("sha256").update(roh).digest("hex"),
      });
    }
  }
  lesen(dist);
  const html = readFileSync(join(dist, "index.html"), "utf8");
  assert(html.includes('<div id="root"'));
  const skripte = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)];
  assert(skripte.length > 0, "keine gebaute Oberflaeche");
  for (const skript of skripte) {
    const src = skript[1];
    assert(src?.startsWith("/"));
    assert(dateien.some((datei) => datei.pfad === src.slice(1) && datei.bytes > 0));
  }
  return dateien;
}

interface Bauvorbereitung {
  version: number;
  stand: ReturnType<typeof saubererBaustand>;
  auswahl: { id: string; base: string; files: string[] };
  bau: {
    command: string[];
    capMs: number;
    pid: number;
    exit: number;
    signal: null;
    processError: null;
    actualWaitCompleted: boolean;
    startedAt: string;
    endedAt: string;
    logPath: string;
    logSha256: string;
  };
  oberflaeche: ReturnType<typeof oberflaechenBindung>;
}

/** Ein Auswahlbeleg ist nur mit Quellstand, echtem Bauabschluss UND unveraendertem Dist nutzbar. */
export function pruefeBauvorbereitung(wurzel = WURZEL, env: NodeJS.ProcessEnv = process.env): void {
  const {
    FE003_BAU_BELEG: pfad,
    FE003_BAU_SHA256: sha,
    FE003_BAU_AUSWAHL: id,
    FE003_BAU_DATEI: datei,
  } = env;
  assert(pfad && sha && id && datei, "unvollstaendiger FE003-Baubeleg");
  assert.match(sha, /^[a-f0-9]{64}$/);
  assert(lstatSync(pfad).isFile() && !lstatSync(pfad).isSymbolicLink());
  const roh = readFileSync(pfad);
  assert.equal(createHash("sha256").update(roh).digest("hex"), sha, "veraenderter FE003-Baubeleg");
  const beleg = JSON.parse(roh.toString()) as Bauvorbereitung;
  assert.equal(beleg.version, 1);
  assert.deepEqual(beleg.stand, saubererBaustand(wurzel));
  assert.equal(beleg.auswahl.id, id);
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.match(beleg.auswahl.base, /^[a-f0-9]{40}$/);
  const files = gitWert(
    wurzel,
    "diff",
    "--name-only",
    "--diff-filter=ACMR",
    beleg.auswahl.base,
    beleg.stand.commit,
  )
    .split("\n")
    .filter((file) => file.endsWith(".integration.test.ts"))
    .sort();
  assert.deepEqual(beleg.auswahl.files, files);
  assert(FE003_DATEIEN.includes(datei) && files.includes(datei) && existsSync(join(wurzel, datei)));
  assert.deepEqual(beleg.bau.command, ["tools/build"]);
  assert.equal(beleg.bau.capMs, 240_000);
  assert.equal(beleg.bau.actualWaitCompleted, true);
  assert.equal(beleg.bau.exit, 0);
  assert.equal(beleg.bau.signal, null);
  assert.equal(beleg.bau.processError, null);
  assert(Number.isSafeInteger(beleg.bau.pid) && beleg.bau.pid > 0);
  assert(Number.isFinite(Date.parse(beleg.bau.startedAt)));
  assert(Date.parse(beleg.bau.endedAt) >= Date.parse(beleg.bau.startedAt));
  assert.equal(beleg.bau.logPath, join(dirname(pfad), "build.log"));
  assert.equal(
    createHash("sha256").update(readFileSync(beleg.bau.logPath)).digest("hex"),
    beleg.bau.logSha256,
  );
  assert.deepEqual(beleg.oberflaeche, oberflaechenBindung(wurzel));
}

function hatBauvorbereitung(): boolean {
  return ["FE003_BAU_BELEG", "FE003_BAU_SHA256", "FE003_BAU_AUSWAHL", "FE003_BAU_DATEI"].some(
    (name) => process.env[name] !== undefined,
  );
}

const phasenBeginn = process.hrtime.bigint();

export function meldePhase(
  phase: string,
  prozess: {
    pid: number | undefined;
    exit?: number | null;
    signal?: NodeJS.Signals | null;
  } = { pid: process.pid },
): void {
  writeSync(
    2,
    `FE003-PHASE ${JSON.stringify({
      phase,
      utc: new Date().toISOString(),
      dauerMs: Number((process.hrtime.bigint() - phasenBeginn) / 1_000_000n),
      ...prozess,
    })}\n`,
  );
}

declare module "vitest" {
  export interface ProvidedContext {
    /** Adresse des EINEN Kandidaten, den `vorschau-global.ts` gestartet hat. */
    fe003KandidatUrl: string;
  }
}

export interface Stand {
  readonly commit: string;
  readonly version: string;
}

export function aktuellerCommit(): string {
  return gitWert(WURZEL, "rev-parse", "HEAD");
}

export function paketVersion(): string {
  const wert = (
    JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8")) as { version?: unknown }
  ).version;
  if (typeof wert !== "string" || wert.trim() === "") {
    throw new Error(`${MARKE}: package.json trägt keine Version.`);
  }
  return wert.trim();
}

/** Der Stand, den der laufende Kandidat melden MUSS. */
export function erwarteterStand(env: NodeJS.ProcessEnv = process.env): Stand {
  const vorgabe = (env.FE003_ERWARTETER_COMMIT ?? "").trim();
  return { commit: vorgabe !== "" ? vorgabe : aktuellerCommit(), version: paketVersion() };
}

export interface Befund {
  readonly url: string;
  readonly health: { status: unknown; version: string; commit: string };
  readonly ki: { active: unknown; reachable: unknown };
  readonly fragenHtml: string;
}

async function holen(url: string, fristMs: number): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(fristMs), redirect: "manual" });
  } catch (fehler) {
    throw new Error(`${MARKE}: ${url} ist nicht erreichbar (${String(fehler)}).`);
  }
}

async function json(url: string, fristMs: number): Promise<Record<string, unknown>> {
  const antwort = await holen(url, fristMs);
  if (antwort.status !== 200) {
    throw new Error(`${MARKE}: ${url} antwortet mit ${antwort.status} statt 200.`);
  }
  const roh = await antwort.text();
  try {
    const wert = JSON.parse(roh) as unknown;
    if (typeof wert !== "object" || wert === null) {
      throw new Error("kein Objekt");
    }
    return wert as Record<string, unknown>;
  } catch {
    throw new Error(`${MARKE}: ${url} liefert kein JSON-Objekt: ${roh.slice(0, 200)}`);
  }
}

/**
 * Prüft einen laufenden Kandidaten HART. Jede Abweichung wirft — nie ein leerer Wert, nie ein
 * Überspringen: Stand aus /health, KI aus, /fragen liefert die Oberfläche aus.
 */
export async function pruefeKandidat(url: string, stand: Stand, fristMs = 5_000): Promise<Befund> {
  const basis = url.replace(/\/+$/, "");
  const health = await json(`${basis}/health`, fristMs);
  if (health.commit !== stand.commit) {
    throw new Error(
      `${MARKE}: ${basis}/health meldet commit=${String(health.commit)}, erwartet ${stand.commit}.`,
    );
  }
  if (health.version !== stand.version) {
    throw new Error(
      `${MARKE}: ${basis}/health meldet version=${String(health.version)}, erwartet ${stand.version} (package.json).`,
    );
  }
  const ki = await json(`${basis}/api/reasoner/status`, fristMs);
  if (ki.active !== false || ki.reachable !== "none") {
    throw new Error(
      `${MARKE}: der Kandidat hat ein Modell (active=${String(ki.active)}, reachable=${String(ki.reachable)}) — zugesagt ist KI aus.`,
    );
  }
  const fragen = await holen(`${basis}/fragen`, fristMs);
  const fragenHtml = await fragen.text();
  if (fragen.status !== 200) {
    throw new Error(`${MARKE}: ${basis}/fragen antwortet mit ${fragen.status} statt 200.`);
  }
  if (!(fragen.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(
      `${MARKE}: ${basis}/fragen liefert ${fragen.headers.get("content-type")} statt HTML.`,
    );
  }
  if (!fragenHtml.includes('<div id="root"') || !/<script[^>]+src="[^"]+"/.test(fragenHtml)) {
    throw new Error(`${MARKE}: ${basis}/fragen liefert die Oberfläche nicht aus.`);
  }
  return {
    url: basis,
    health: {
      status: health.status,
      version: String(health.version),
      commit: String(health.commit),
    },
    ki: { active: ki.active, reachable: ki.reachable },
    fragenHtml,
  };
}

/** Ein freier Port vom Betriebssystem — kein geratener. */
export function freierPort(): Promise<number> {
  return new Promise((fertig, schiefgegangen) => {
    const horcher = createServer();
    horcher.on("error", schiefgegangen);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      const port = typeof adresse === "object" && adresse !== null ? adresse.port : 0;
      horcher.close(() =>
        port > 0 ? fertig(port) : schiefgegangen(new Error("kein freier Port ermittelbar")),
      );
    });
  });
}

export interface Kandidat {
  readonly url: string;
  /** `true`, wenn dieser Prozess den Server selbst gebaut und gestartet hat. */
  readonly selbstGestartet: boolean;
  readonly lebt: () => boolean;
  readonly ausgabe: () => string;
  /** Beendet den selbst gestarteten Server; `true`, wenn er danach sicher weg ist. */
  readonly beenden: () => Promise<boolean>;
}

/** Baut den Kandidaten mit `tools/build` — derselbe Befehl wie im Tor. */
export function baueKandidat(): void {
  if (hatBauvorbereitung()) {
    try {
      pruefeBauvorbereitung();
      meldePhase("build-beleg-bestaetigt");
      return;
    } catch (error) {
      meldePhase("build-beleg-abgelehnt");
      throw error;
    }
  }
  meldePhase("build-start");
  const manifest = process.env.KLARWERK_FASSUNG_MANIFEST;
  const lauf = spawnSync(join(WURZEL, "tools/build"), [], {
    cwd: WURZEL,
    stdio: "inherit",
    env: {
      ...kindUmgebung(),
      ...(manifest === undefined ? {} : { KLARWERK_FASSUNG_MANIFEST: manifest }),
    },
    timeout: 240_000,
  });
  meldePhase("build-ende", { pid: lauf.pid, exit: lauf.status, signal: lauf.signal });
  if (lauf.status !== 0) {
    throw new Error(`${MARKE}: tools/build endet mit ${String(lauf.status ?? lauf.signal)}.`);
  }
  if (!existsSync(DIST_INDEX)) {
    throw new Error(`${MARKE}: nach tools/build fehlt ${DIST_INDEX}.`);
  }
}

function arbeitsbaumSauber(): void {
  const offen = execFileSync("git", ["status", "--porcelain"], {
    cwd: WURZEL,
    env: kindUmgebung(),
    encoding: "utf8",
  }).trim();
  if (offen !== "") {
    throw new Error(
      `${MARKE}: der Arbeitsbaum hat nicht festgehaltene Änderungen — der Server wäre keinem Commit zuzuordnen:\n${offen.slice(0, 800)}`,
    );
  }
}

/** Baut und startet den ausgecheckten Kandidaten ohne Modell auf einem freien Port. */
export async function starteKandidat(fristMs = 120_000): Promise<Kandidat> {
  arbeitsbaumSauber();
  baueKandidat();
  meldePhase("server-start");
  const port = await freierPort();
  const commit = aktuellerCommit();
  const teile: string[] = [];
  const kind: ChildProcess = spawn(
    join(WURZEL, "node_modules/.bin/tsx"),
    ["services/app/src/server.ts"],
    {
      cwd: WURZEL,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "/tmp",
        LANG: process.env.LANG ?? "C.UTF-8",
        PORT: String(port),
        KLARWERK_BUILD_COMMIT: commit,
        KLARWERK_SKIP_KEYCHAIN: "1",
        KLARWERK_LOCAL_LLM_URL: "",
        KLARWERK_LOCAL_LLM_MODEL: "",
        EXTERNAL_SEARCH: "off",
        NODE_ENV: "test",
        KLARWERK_DEV_PERSIST: "0",
      },
    },
  );
  meldePhase("server-gestartet", { pid: kind.pid });
  kind.stdout?.on("data", (d: Buffer) => teile.push(d.toString()));
  kind.stderr?.on("data", (d: Buffer) => teile.push(d.toString()));
  let beendet = false;
  kind.on("exit", (code, signal) => {
    beendet = true;
    meldePhase("server-ende", { pid: kind.pid, exit: code, signal });
  });
  const lebt = (): boolean => !beendet;
  const ausgabe = (): string => teile.join("").slice(-4000);
  const beenden = async (): Promise<boolean> => {
    if (beendet || kind.pid === undefined) {
      return true;
    }
    const gruppe = -kind.pid;
    try {
      process.kill(gruppe, "SIGTERM");
    } catch {
      return !lebt();
    }
    for (let i = 0; i < 100 && lebt(); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (lebt()) {
      try {
        process.kill(gruppe, "SIGKILL");
      } catch {
        // schon weg
      }
      for (let i = 0; i < 50 && lebt(); i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return !lebt();
  };
  const url = `http://127.0.0.1:${port}`;
  const ende = Date.now() + fristMs;
  for (;;) {
    if (!lebt()) {
      throw new Error(`${MARKE}: der Server ist beim Start beendet worden.\n${ausgabe()}`);
    }
    const ok = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2_000) })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) {
      meldePhase("health-bereit", { pid: kind.pid });
      break;
    }
    if (Date.now() > ende) {
      await beenden();
      throw new Error(`${MARKE}: ${url}/health nicht erreichbar nach ${fristMs} ms.\n${ausgabe()}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { url, selbstGestartet: true, lebt, ausgabe, beenden };
}

/** Ein von aussen genannter, schon laufender Kandidat — wird geprüft, nicht gestartet. */
export function genannterKandidat(url: string): Kandidat {
  return {
    url: url.replace(/\/+$/, ""),
    selbstGestartet: false,
    lebt: () => true,
    ausgabe: () => "",
    beenden: async () => true,
  };
}

/**
 * Der Kandidat für eine Testdatei: der gemeinsame aus der Konfiguration, ein genannter, oder ein
 * eigener. Danach IMMER `pruefeKandidat` — auch für den gemeinsamen und den genannten.
 */
export async function kandidatBereitstellen(gemeinsam: string | undefined): Promise<Kandidat> {
  const genannt = gemeinsam ?? (process.env.FE003_KANDIDAT_URL || undefined);
  if (genannt && hatBauvorbereitung()) {
    throw new Error(`${MARKE}: ein Baubeleg erlaubt keinen fremden laufenden Kandidaten.`);
  }
  return genannt ? genannterKandidat(genannt) : await starteKandidat();
}
