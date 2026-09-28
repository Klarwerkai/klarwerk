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
// ZUORDNUNG: `/health` muss den erwarteten Commit (`git rev-parse HEAD`, überschreibbar mit
// `FE003_ERWARTETER_COMMIT` — nur für die Gegenprobe) und die Version aus `package.json` melden. Der
// selbst gestartete Server bekommt seinen Commit wie im Container über `KLARWERK_BUILD_COMMIT`
// (`Dockerfile`, `services/app/src/build-app.ts` `buildCommit`) — aus dem ausgecheckten Stand, nicht
// aus der Vorgabe. Eine falsche Vorgabe macht den Lauf deshalb rot.
//
// KI AUS: der Server startet mit leerer Umgebung plus einer kurzen Liste harmloser Variablen, wie
// `tools/fe003-vorschau` — Zugangsdaten eines Anbieters aus der Aufrufer-Shell erreichen ihn nicht,
// kein lokales Modell, kein externer Suchdienst, Schlüsselbund zu. In-Memory, keine Datenbank.
import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";

export const WURZEL = resolve(import.meta.dirname, "../..");
export const MARKE = "FE-003 Vorschauweg";
export const DIST_INDEX = join(WURZEL, "apps/web/dist/index.html");

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
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: WURZEL, encoding: "utf8" }).trim();
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
  const lauf = spawnSync(join(WURZEL, "tools/build"), [], {
    cwd: WURZEL,
    stdio: "inherit",
    env: process.env,
  });
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
      },
    },
  );
  kind.stdout?.on("data", (d: Buffer) => teile.push(d.toString()));
  kind.stderr?.on("data", (d: Buffer) => teile.push(d.toString()));
  let beendet = false;
  kind.on("exit", () => {
    beendet = true;
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
  return genannt ? genannterKandidat(genannt) : await starteKandidat();
}
