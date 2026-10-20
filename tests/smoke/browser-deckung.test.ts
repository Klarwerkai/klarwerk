// ================================================================================================
// JOB 2357 D1 §5 · DER BROWSERDECKUNGSWÄCHTER — übertragen auf den heutigen Prüfweg.
// ================================================================================================
//
// aufnahme:20260922:gesamt-prueftor-einheitlich (R-1332, Bens Befund zu nacharbeit-4). JOB 2357
// verlangte zwei Dinge: einen ausschliesslich zeitgesteuerten/handausgelösten Drei-Engine-Lauf
// (`.github/workflows/smoke-drei.yml`) und diesen Wächter, fail-closed, rot bei jeder von vier
// Gegenmutationen: (1) `pull_request` als Auslöser, (2) `firefox` aus der Browserliste,
// (3) `continue-on-error: true`, (4) ein anderer Befehl statt `npm run smoke:ui:gate:drei`.
// „Ein Wächter, der nur prüft, ob eine Zeichenfolge vorkommt, erfüllt das nicht.“
//
// DIE STRUKTUR WIRD GELESEN, NICHT GESUCHT: ein kleiner Block-YAML-Leser bildet Auslöser, Jobs und
// Schritte; die Engines kommen aus der Kette tools/check → npm-Skript → `--project` →
// playwright.smoke.config.ts (Gerät → Engine). D1–D3 belegen, dass Kommentare und Schrittnamen mit
// den richtigen Wörtern nichts retten.
//
// ZWEI LÄUFE, ZWEI REGELN:
//   · Der Drei-Engine-Lauf (JOB 2357): nur `schedule`/`workflow_dispatch`, genau ein Job, Browser
//     mit `--with-deps`, letzter Befehl exakt `npm run smoke:ui:gate:drei`. Maßgeblich ist die echte
//     .github/workflows/smoke-drei.yml; eine fehlende Datei lässt den Wächter scheitern.
//   · Das PR-Tor (spätere Entscheidung, Aufnahme 20260922 A19, s. tools/check „AUFNAHME 20260922“):
//     drei Engines gehören seitdem INS Tor. Hier ist die Regel umgekehrt: ci.yml muss bei Push UND
//     Pull Request laufen. Dieselben vier Mutationsklassen machen es rot (T1–T4), dazu T5 für die
//     Engine-Kette.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), "utf8");

// ------------------------------------------------------------------------------------------------
// Ein Block-YAML-Leser für die Teilmenge, die die Workflows hier benutzen: Abbildungen, Listen,
// Skalare; Flusswerte (`{ … }`, `[ … ]`) bleiben Zeichenketten. Kommentarzeilen fallen weg.
// ------------------------------------------------------------------------------------------------

type Knoten = string | Knoten[] | { [schluessel: string]: Knoten };
type Abb = { [schluessel: string]: Knoten };
interface Zeile {
  einzug: number;
  inhalt: string;
}

function skalar(roh: string): string {
  const t = roh.trim();
  return /^(["']).*\1$/.test(t) ? t.slice(1, -1) : t;
}

function leseYaml(text: string): Knoten {
  const zeilen: Zeile[] = text
    .split("\n")
    .filter((z) => z.trim().length > 0 && !z.trim().startsWith("#"))
    .map((z) => ({ einzug: z.length - z.trimStart().length, inhalt: z.trim() }));
  let i = 0;

  function block(einzug: number): Knoten {
    if (zeilen[i]?.inhalt.startsWith("- ")) {
      const folge: Knoten[] = [];
      while (zeilen[i]?.einzug === einzug && zeilen[i]?.inhalt.startsWith("- ")) {
        const rest = (zeilen[i] as Zeile).inhalt.slice(2);
        if (/^[\w-]+:(\s|$)/.test(rest)) {
          zeilen[i] = { einzug: einzug + 2, inhalt: rest };
          folge.push(block(einzug + 2));
        } else {
          folge.push(skalar(rest));
          i++;
        }
      }
      return folge;
    }
    const karte: Abb = {};
    while (zeilen[i]?.einzug === einzug && !zeilen[i]?.inhalt.startsWith("- ")) {
      const inhalt = (zeilen[i] as Zeile).inhalt;
      const m = /^([\w-]+):\s*(.*)$/.exec(inhalt);
      const schluessel = m?.[1];
      if (!m || !schluessel) {
        throw new Error(`YAML-Zeile nicht lesbar: ${inhalt}`);
      }
      const wert = m[2] ?? "";
      i++;
      const naechste = zeilen[i];
      if (wert === "" && naechste && naechste.einzug > einzug) {
        karte[schluessel] = block(naechste.einzug);
      } else {
        karte[schluessel] = skalar(wert);
      }
    }
    return karte;
  }

  return block(zeilen[0]?.einzug ?? 0);
}

function abb(k: Knoten | undefined): Abb {
  return k && typeof k === "object" && !Array.isArray(k) ? k : {};
}

function folge(k: Knoten | undefined): Knoten[] {
  return Array.isArray(k) ? k : [];
}

/** Die Auslösernamen, gleich ob als Abbildung, Liste oder einzelner Name geschrieben. */
function ausloeser(wurzel: Knoten): string[] {
  const on = abb(wurzel).on;
  if (typeof on === "string") {
    const namen = on.replace(/[[\]]/g, "").split(",");
    return namen.map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return Array.isArray(on) ? on.map(String) : Object.keys(abb(on));
}

const istWahr = (k: Knoten | undefined) => k !== undefined && k !== "false";

/** Jeder `continue-on-error`, der nicht ausdrücklich `false` ist — auf Job- oder Schrittebene. */
function nachgiebig(job: Abb, name: string): string[] {
  const funde: string[] = [];
  if (istWahr(job["continue-on-error"])) {
    funde.push(`Job „${name}“ trägt continue-on-error: ${String(job["continue-on-error"])}`);
  }
  for (const schritt of folge(job.steps).map(abb)) {
    if (istWahr(schritt["continue-on-error"])) {
      funde.push(`Schritt „${String(schritt.run ?? schritt.uses)}“ trägt continue-on-error`);
    }
  }
  return funde;
}

function befehle(job: Abb): string[] {
  const laeufe = folge(job.steps).map((s) => abb(s).run);
  return laeufe.filter((r): r is string => typeof r === "string");
}

const ENGINES = ["chromium", "firefox", "webkit"];

/** Fehlt dem Installationsschritt eine Engine? Gelesen werden Wörter des Befehls, kein Rohtext. */
function installationsbefunde(job: Abb): string[] {
  const install = befehle(job).find((b) => /^npx\s+playwright\s+install\b/.test(b));
  if (!install) {
    return ["kein Schritt `npx playwright install`"];
  }
  const woerter = install.split(/\s+/);
  const fehlend = ENGINES.filter((e) => !woerter.includes(e));
  const funde = fehlend.map((e) => `Engine ${e} nicht installiert`);
  if (!woerter.includes("--with-deps")) {
    funde.push("Browser ohne --with-deps installiert");
  }
  return funde;
}

// ------------------------------------------------------------------------------------------------
// Engines aus der echten Kette: Projekt → Gerät → Engine (playwright.smoke.config.ts).
// ------------------------------------------------------------------------------------------------

const GERAET: Record<string, string> = {
  "Desktop Chrome": "chromium",
  "Desktop Firefox": "firefox",
  "Desktop Safari": "webkit",
};

function projekte(konfig: string): Map<string, string> {
  const karte = new Map<string, string>();
  for (const m of konfig.matchAll(/name:\s*"([^"]+)"[\s\S]*?devices\["([^"]+)"\]/g)) {
    const engine = GERAET[m[2] ?? ""];
    if (m[1] && engine) {
      karte.set(m[1], engine);
    }
  }
  return karte;
}

// Bens Befund zu nacharbeit-5: hier zählte ein Skript OHNE `--project` pauschal alle konfigurierten
// Engines — ohne nachzuweisen, dass es überhaupt Playwright startet. Ein fehlendes Skript oder ein
// `echo` hätte Drei-Engine-Deckung gemeldet. Jetzt gilt fail-closed: erst der tatsächliche Aufruf
// `playwright test --config playwright.smoke.config.ts …` (letztes Kettenglied, nach Umgebung,
// Browserdeckel und `npx`), dann seine Projekte; alles andere ist ein Befund, keine Engine.

const KONFIG_PFAD = "playwright.smoke.config.ts";

type Aufloesung = { engines: string[] } | { befund: string };

/** Der Playwright-Testaufruf eines npm-Skripts und die Engines, die er tatsächlich startet. */
function skriptEngines(name: string, skript: string | undefined, konfig: string): Aufloesung {
  if (skript === undefined) {
    return { befund: `npm-Skript ${name} fehlt in package.json` };
  }
  const glieder = skript.split("&&");
  const t = (glieder[glieder.length - 1] ?? "").trim().split(/\s+/);
  let i = 0;
  while (/^[A-Za-z_]\w*=/.test(t[i] ?? "")) {
    i++;
  }
  if (t[i] === "./tools/browserdeckel.sh" && t[i + 1] === "smoke") {
    i += 2;
  }
  if (t[i] === "npx") {
    i++;
  }
  if (t[i] !== "playwright" || t[i + 1] !== "test") {
    return { befund: `${name} startet keinen Playwright-Testaufruf („${skript}“)` };
  }
  const args = t.slice(i + 2);
  const stelle = args.indexOf("--config");
  const config =
    stelle >= 0 ? args[stelle + 1] : args.find((a) => a.startsWith("--config="))?.slice(9);
  if (config !== KONFIG_PFAD) {
    const gefunden = config ?? "keine";
    return { befund: `${name} nennt nicht --config ${KONFIG_PFAD} (gefunden: ${gefunden})` };
  }
  const karte = projekte(konfig);
  const gewaehlt = [...args.join(" ").matchAll(/--project[= ](\S+)/g)].map((m) => m[1] ?? "");
  const unbekannt = gewaehlt.filter((p) => !karte.has(p));
  if (unbekannt.length > 0) {
    return { befund: `${name} wählt unbekannte Projekte: ${unbekannt.join(", ")}` };
  }
  const namen = gewaehlt.length > 0 ? gewaehlt : [...karte.keys()];
  const engines = namen.map((n) => karte.get(n)).filter((e): e is string => !!e);
  return { engines: [...new Set(engines)].sort() };
}

/** Die Engines, die tools/check über seine npm-Skripte tatsächlich fährt, samt Befunden. */
function torEngines(tor: string, skripte: Record<string, string>, konfig: string) {
  const engines = new Set<string>();
  const befunde: string[] = [];
  for (const roh of tor.split("\n")) {
    const zeile = roh.trim();
    if (zeile.startsWith("#") || zeile.startsWith("echo ")) {
      continue;
    }
    for (const glied of zeile.split(/&&|\|\||;/)) {
      const name = /^npm\s+run\s+(?:--\S+\s+)*(smoke:\S+)/.exec(glied.trim())?.[1];
      if (!name) {
        continue;
      }
      const ergebnis = skriptEngines(name, skripte[name], konfig);
      if ("befund" in ergebnis) {
        befunde.push(ergebnis.befund);
      } else {
        for (const e of ergebnis.engines) {
          engines.add(e);
        }
      }
    }
  }
  return { engines: [...engines].sort(), befunde };
}

// ------------------------------------------------------------------------------------------------
// Die zwei Prüfungen. Leere Liste = erfüllt; jeder Eintrag ist ein benannter Befund.
// ------------------------------------------------------------------------------------------------

const DREI_BEFEHL = "npm run smoke:ui:gate:drei";
const DREI_VORLAUF = [
  "npm ci",
  "npm ci --prefix apps/web",
  "npx playwright install --with-deps chromium firefox webkit",
  "./tools/build",
];

/** JOB 2357 §5: der zeitgesteuerte Drei-Engine-Lauf. */
function pruefeDreiEngineLauf(text: string, skripte: Record<string, string>, konfig: string) {
  const wurzel = leseYaml(text);
  const funde: string[] = [];
  const an = ausloeser(wurzel);
  for (const a of an.filter((x) => !["schedule", "workflow_dispatch"].includes(x))) {
    funde.push(`unzulässiger Auslöser ${a} (nur schedule/workflow_dispatch)`);
  }
  if (an.length === 0) {
    funde.push("kein Auslöser");
  }
  const jobs = Object.entries(abb(abb(wurzel).jobs));
  if (jobs.length !== 1) {
    funde.push(`genau ein Job verlangt, gefunden ${jobs.length}`);
  }
  for (const [name, roh] of jobs) {
    const job = abb(roh);
    funde.push(...nachgiebig(job, name), ...installationsbefunde(job));
    const laeufe = befehle(job);
    const letzter = laeufe[laeufe.length - 1] ?? "–";
    if (letzter !== DREI_BEFEHL) {
      funde.push(`letzter Befehl ist „${letzter}“ statt „${DREI_BEFEHL}“`);
    }
    for (const b of laeufe.slice(0, -1).filter((x) => !DREI_VORLAUF.includes(x))) {
      funde.push(`abweichender Befehl „${b}“`);
    }
  }
  const drei = skriptEngines("smoke:ui:gate:drei", skripte["smoke:ui:gate:drei"], konfig);
  if ("befund" in drei) {
    funde.push(drei.befund);
  } else if (drei.engines.join(",") !== ENGINES.join(",")) {
    funde.push(`smoke:ui:gate:drei fährt ${drei.engines.join(", ")} statt aller drei Engines`);
  }
  return funde;
}

/** Das PR-Tor: ci.yml bei Push und Pull Request, Job `check` fährt ./tools/check mit drei Engines. */
function pruefeTorDeckung(
  text: string,
  tor: string,
  skripte: Record<string, string>,
  konfig: string,
) {
  const wurzel = leseYaml(text);
  const funde: string[] = [];
  const an = ausloeser(wurzel);
  for (const pflicht of ["push", "pull_request"].filter((p) => !an.includes(p))) {
    funde.push(`Auslöser ${pflicht} fehlt — das Tor liefe nicht bei jedem ${pflicht}`);
  }
  const check = abb(abb(abb(wurzel).jobs).check);
  if (Object.keys(check).length === 0) {
    return [...funde, "Job check fehlt"];
  }
  funde.push(...nachgiebig(check, "check"), ...installationsbefunde(check));
  const tore = befehle(check).filter((b) => b === "./tools/check");
  if (tore.length !== 1) {
    funde.push(`Job check fährt ./tools/check ${tore.length}-mal statt genau einmal`);
  }
  const { engines, befunde } = torEngines(tor, skripte, konfig);
  funde.push(...befunde);
  if (engines.join(",") !== ENGINES.join(",")) {
    funde.push(`tools/check fährt ${engines.join(", ") || "keine Engine"} statt aller drei`);
  }
  return funde;
}

// ------------------------------------------------------------------------------------------------

const SKRIPTE = (JSON.parse(lies("package.json")) as { scripts: Record<string, string> }).scripts;
const KONFIG = lies("playwright.smoke.config.ts");
const TOR = lies("tools/check");
const CI = lies(".github/workflows/ci.yml");
const DREI_WORKFLOW = lies(".github/workflows/smoke-drei.yml");

const drei = (text: string) => pruefeDreiEngineLauf(text, SKRIPTE, KONFIG);
const tor = (text: string) => pruefeTorDeckung(text, TOR, SKRIPTE, KONFIG);

/** Ersetzt genau eine Stelle — fehlt sie oder steht sie doppelt, ist die Mutation selbst kaputt. */
function mutiere(text: string, alt: string, neu: string): string {
  const stelle = text.indexOf(alt);
  if (stelle === -1 || text.indexOf(alt, stelle + alt.length) !== -1) {
    throw new Error(`Mutation trifft nicht genau eine Stelle: ${alt}`);
  }
  return text.slice(0, stelle) + neu + text.slice(stelle + alt.length);
}

const DISPATCH = "  workflow_dispatch: {}\n";
const RUNS_ON = "    runs-on: ubuntu-latest\n";
const DREI_SCHRITT = `        run: ${DREI_BEFEHL}\n`;
const GATE_SCHRITT = "        run: npm run smoke:ui:gate\n";
const NACHGIEBIG_JOB = "    continue-on-error: true\n";
const NACHGIEBIG_SCHRITT = "        continue-on-error: true\n";
const TOR_SCHRITT = "        run: ./tools/check\n";

describe("JOB 2357 · zeitgesteuerter Drei-Engine-Lauf (.github/workflows/smoke-drei.yml)", () => {
  it("V0 · der tatsächliche Workflow erfüllt §5 vollständig", () => {
    expect(drei(DREI_WORKFLOW)).toEqual([]);
  });

  it("M1 · pull_request als Auslöser macht den Lauf rot", () => {
    const m = mutiere(DREI_WORKFLOW, DISPATCH, `${DISPATCH}  pull_request: {}\n`);
    expect(drei(m)).toContain(
      "unzulässiger Auslöser pull_request (nur schedule/workflow_dispatch)",
    );
  });

  it("M2 · firefox aus der Browserliste entfernt macht den Lauf rot", () => {
    const m = mutiere(DREI_WORKFLOW, "chromium firefox webkit", "chromium webkit");
    expect(drei(m)).toContain("Engine firefox nicht installiert");
  });

  it("M3 · continue-on-error: true macht den Lauf rot — auf Job- und Schrittebene", () => {
    const job = mutiere(DREI_WORKFLOW, RUNS_ON, `${RUNS_ON}${NACHGIEBIG_JOB}`);
    expect(drei(job)).toContain("Job „drei-engines“ trägt continue-on-error: true");
    const schritt = mutiere(DREI_WORKFLOW, DREI_SCHRITT, `${DREI_SCHRITT}${NACHGIEBIG_SCHRITT}`);
    expect(drei(schritt)).toContain(`Schritt „${DREI_BEFEHL}“ trägt continue-on-error`);
  });

  it("M4 · ein anderer Befehl statt npm run smoke:ui:gate:drei macht den Lauf rot", () => {
    const m = mutiere(DREI_WORKFLOW, DREI_SCHRITT, GATE_SCHRITT);
    expect(drei(m)).toContain(`letzter Befehl ist „npm run smoke:ui:gate“ statt „${DREI_BEFEHL}“`);
  });

  it("D1 · der richtige Befehl nur in Kommentar und Schrittname rettet nichts", () => {
    const m = mutiere(
      DREI_WORKFLOW,
      DREI_SCHRITT,
      `        # run: ${DREI_BEFEHL}\n${GATE_SCHRITT}`,
    );
    const umbenannt = mutiere(m, "name: volle hermetische Suite", `name: ${DREI_BEFEHL}`);
    expect(drei(umbenannt).some((f) => f.startsWith("letzter Befehl ist"))).toBe(true);
  });

  it("D2 · Firefox nur im Schrittnamen, nicht im Befehl, rettet nichts", () => {
    const m = mutiere(DREI_WORKFLOW, "chromium firefox webkit\n", "chromium webkit\n");
    expect(m).toContain("Firefox");
    expect(drei(m)).toContain("Engine firefox nicht installiert");
  });

  it("D3 · ein zweiter Job oder ein Zusatzbefehl vor dem Lauf fällt auf", () => {
    const zweiterJob = [
      "  zweiter:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo",
    ];
    const zweiter = `${DREI_WORKFLOW}${zweiterJob.join("\n")}\n`;
    expect(drei(zweiter)).toContain("genau ein Job verlangt, gefunden 2");
    const npmCi = "      - run: npm ci\n";
    const zusatz = mutiere(DREI_WORKFLOW, npmCi, `${npmCi}      - run: npm test\n`);
    expect(drei(zusatz)).toContain("abweichender Befehl „npm test“");
  });

  it("D4 · verliert smoke:ui:gate:drei Firefox in der Engine-Kette, wird der Lauf rot", () => {
    const gekuerzt = `${SKRIPTE["smoke:ui:gate:drei"]} --project=chromium --project=webkit`;
    const skripte = { ...SKRIPTE, "smoke:ui:gate:drei": gekuerzt };
    expect(pruefeDreiEngineLauf(DREI_WORKFLOW, skripte, KONFIG)).toContain(
      "smoke:ui:gate:drei fährt chromium, webkit statt aller drei Engines",
    );
  });

  // Bens Befund zu nacharbeit-5: ohne nachgewiesenen Playwright-Aufruf gibt es keine Engine.
  it("D5 · fehlt das npm-Skript smoke:ui:gate:drei, wird der Lauf rot", () => {
    const { "smoke:ui:gate:drei": _weg, ...ohne } = SKRIPTE;
    const funde = pruefeDreiEngineLauf(DREI_WORKFLOW, ohne, KONFIG);
    expect(funde).toContain("npm-Skript smoke:ui:gate:drei fehlt in package.json");
  });

  it("D6 · ein Ersatz ohne Browserstart (echo) wird rot, nicht Drei-Engine-Deckung", () => {
    const skripte = { ...SKRIPTE, "smoke:ui:gate:drei": "echo drei Engines" };
    expect(pruefeDreiEngineLauf(DREI_WORKFLOW, skripte, KONFIG)).toContain(
      "smoke:ui:gate:drei startet keinen Playwright-Testaufruf („echo drei Engines“)",
    );
    const vorgeschaltet = { ...SKRIPTE, "smoke:ui:gate:drei": "playwright test && echo fertig" };
    expect(pruefeDreiEngineLauf(DREI_WORKFLOW, vorgeschaltet, KONFIG)).toContain(
      "smoke:ui:gate:drei startet keinen Playwright-Testaufruf („playwright test && echo fertig“)",
    );
  });

  it("D7 · ohne oder mit fremder Konfiguration oder unbekanntem Projekt wird rot", () => {
    const ohne = "playwright test --grep-invert @modell";
    const ohneKonfig = { ...SKRIPTE, "smoke:ui:gate:drei": ohne };
    expect(pruefeDreiEngineLauf(DREI_WORKFLOW, ohneKonfig, KONFIG)).toContain(
      "smoke:ui:gate:drei nennt nicht --config playwright.smoke.config.ts (gefunden: keine)",
    );
    const anderes = "playwright test --config anderes.config.ts";
    const fremd = { ...SKRIPTE, "smoke:ui:gate:drei": anderes };
    expect(pruefeDreiEngineLauf(DREI_WORKFLOW, fremd, KONFIG)).toContain(
      `smoke:ui:gate:drei nennt nicht --config ${KONFIG_PFAD} (gefunden: anderes.config.ts)`,
    );
    const erfunden = `playwright test --config ${KONFIG_PFAD} --project=opera`;
    const projekt = { ...SKRIPTE, "smoke:ui:gate:drei": erfunden };
    expect(pruefeDreiEngineLauf(DREI_WORKFLOW, projekt, KONFIG)).toContain(
      "smoke:ui:gate:drei wählt unbekannte Projekte: opera",
    );
  });
});

describe("Aufnahme 20260922 · PR-Tor mit drei Engines (ci.yml → tools/check)", () => {
  it("T0 · ci.yml und tools/check erfüllen die Deckung", () => {
    expect(tor(CI)).toEqual([]);
  });

  it("T1 · fehlt pull_request als Auslöser, wird das Tor rot", () => {
    const m = mutiere(CI, "  pull_request: {}\n", "");
    expect(tor(m)).toContain(
      "Auslöser pull_request fehlt — das Tor liefe nicht bei jedem pull_request",
    );
  });

  it("T2 · firefox aus der Browserliste des check-Jobs entfernt macht das Tor rot", () => {
    const m = mutiere(CI, "chromium firefox webkit", "chromium webkit");
    expect(tor(m)).toContain("Engine firefox nicht installiert");
  });

  it("T3 · continue-on-error: true am check-Job oder am Torschritt macht das Tor rot", () => {
    const kopf = `  check:\n${RUNS_ON}`;
    const job = mutiere(CI, kopf, `${kopf}${NACHGIEBIG_JOB}`);
    expect(tor(job)).toContain("Job „check“ trägt continue-on-error: true");
    const schritt = mutiere(CI, TOR_SCHRITT, `${TOR_SCHRITT}${NACHGIEBIG_SCHRITT}`);
    expect(tor(schritt)).toContain("Schritt „./tools/check“ trägt continue-on-error");
  });

  it("T4 · ein anderer Befehl statt ./tools/check macht das Tor rot", () => {
    const m = mutiere(CI, TOR_SCHRITT, "        run: npm run test\n");
    expect(tor(m)).toContain("Job check fährt ./tools/check 0-mal statt genau einmal");
  });

  it("T5 · verliert tools/check den Firefox-Lauf, wird das Tor rot", () => {
    const ohne = TOR.split("\n")
      .filter((z) => !z.startsWith("npm run --silent smoke:ui:gate:kern:firefox"))
      .join("\n");
    expect(pruefeTorDeckung(CI, ohne, SKRIPTE, KONFIG)).toContain(
      "tools/check fährt chromium, webkit statt aller drei",
    );
  });

  it("T6 · wird der Firefox-Lauf des Tors durch echo ersetzt, ist das ein Befund", () => {
    const skripte = { ...SKRIPTE, "smoke:ui:gate:kern:firefox": "echo firefox" };
    const funde = pruefeTorDeckung(CI, TOR, skripte, KONFIG);
    expect(funde).toContain(
      "smoke:ui:gate:kern:firefox startet keinen Playwright-Testaufruf („echo firefox“)",
    );
    expect(funde).toContain("tools/check fährt chromium, webkit statt aller drei");
  });

  it("T7 · fehlt ein von tools/check gerufenes Smoke-Skript, ist das ein Befund", () => {
    const { "smoke:ui:gate:kern:webkit": _weg, ...ohne } = SKRIPTE;
    const funde = pruefeTorDeckung(CI, TOR, ohne, KONFIG);
    expect(funde).toContain("npm-Skript smoke:ui:gate:kern:webkit fehlt in package.json");
    expect(funde).toContain("tools/check fährt chromium, firefox statt aller drei");
  });
});
