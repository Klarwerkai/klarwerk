// ================================================================================================
// JOB 4241 — DAS AUSGELIEFERTE PAKET STARTET IN EINER LEEREN UMGEBUNG.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (T-015). Ein Betreiber baut mit dem offiziellen Bauer
// (`scripts/insel/build-current-release.mjs`) ein Release, traegt es in eine leere, isolierte
// Zielumgebung — kein Repo, kein Entwicklerbaum daneben —, packt aus und startet. Der Start endete
// mit `ERR_MODULE_NOT_FOUND apps/web/src/lib/docx`: `services/app/src/routes/capture-routes.ts:12`
// fuehrt den DOM-freien DOCX-Kern aus `apps/web/src/lib` ein, der Bauer kopierte aber nur `services`
// und `apps/web/dist`. Das Paket lud eine Datei, die es selbst nicht mitbrachte.
//
// WARUM `tests/insel-update/release-inhalt.test.ts` das nicht sehen konnte, und warum diese Datei
// daneben noetig ist: Jener Test liest den Bauer als TEXT und zaehlt Zeichenketten darin
// (`:22`, `expect(quelle).toContain(...)`). Eine Zeichenkettensuche im Quelltext kann eine fehlende
// Datei in der AUSGABE nicht sehen. Hier wird deshalb eine Ausgabe NACHGESTELLT und in ihr JEDE
// relative Einfuhr ab dem Einstieg aufgeloest — im Zielordner, nie im Arbeitsbaum.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER ECHT IST UND WAS NICHT — die Grenze gehoert an dieselbe Stelle wie die Behauptung
// ------------------------------------------------------------------------------------------------
//   ECHT   Die berechnete Inhaltsliste (`scripts/insel/paketinhalt.mjs`, im Kindprozess gefahren wie
//          beim Bauen), die echten Quelldateien, die echten Kopierfilter des Bauers und die
//          Aufloesung jeder Importkante im Zielordner.
//   NACHGESTELLT  Der Kopierschritt selbst. Der VOLLE Baulauf ist hier nicht fahrbar: er ruft
//          `npm ci --omit=dev` und `zip`, und `zip` fehlt im Pruefstand (belegt:
//          `tests/insel-update/release-inhalt.test.ts:9-14`, Cloud-Laeufer 8b610ee9).
//   NICHT BEHAUPTET  Ein echtes Auspacken und Starten auf einem Mac Studio. Das bleibt eine
//          Handprobe; ein uebersprungener Fall gilt nie als bestanden (Lehre JOB 4097/4127).
//
// DIE AUFLOESUNG IST HIER EIGENSTAENDIG GESCHRIEBEN und holt sich nichts aus dem Prueflung. Eine
// Probe, die ihre Erwartung aus dem Prueflung bezieht, bestaetigt jede Aenderung — auch die falsche
// (`tests/insel-update/insel-probe.ts:20-22`). Gesucht wird deshalb roh, ueber die Zeilen: das ist
// eine OBERMENGE der Kanten und kann keine uebersehen. Reine Kommentarzeilen bleiben aussen vor —
// im Bestand stehen Importzeilen IN Kommentaren (`services/wissensnetz/src/policy-naht.ts:20`,
// `services/reasoner/src/types.ts:622`), und ein Waechter soll milder sein, nie falsch-rot.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const WURZEL = resolve(import.meta.dirname, "../..");
const BAU = join(WURZEL, "scripts/insel/build-current-release.mjs");
const MODUL = join(WURZEL, "scripts/insel/paketinhalt.mjs");
const EINSTIEG = "services/app/src/server.ts";

const arbeitsordner: string[] = [];
afterAll(() => {
  for (const ordner of arbeitsordner) {
    rmSync(ordner, { recursive: true, force: true });
  }
});

function wegwerfordner(): string {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-paketausgabe-"));
  arbeitsordner.push(ordner);
  return ordner;
}

// ------------------------------------------------------------------------------------------------
// Das Modul wird im KINDPROZESS gefahren — genau so, wie `build-current-release.mjs` es laedt.
// Dieselbe Bauart wie `tests/insel-update/insel-probe.ts:505` und `release-inhalt.test.ts:31`:
// die Insel-Skripte sind `.mjs` und werden von `node` gefahren, nicht vom TypeScript-Baum.
// ------------------------------------------------------------------------------------------------
function imModul(ausdruck: string): { status: number | null; stdout: string; stderr: string } {
  const lauf = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as m from ${JSON.stringify(MODUL)};
const WURZEL = ${JSON.stringify(WURZEL)};
process.stdout.write(JSON.stringify(${ausdruck}));`,
    ],
    { encoding: "utf8", timeout: 120_000 },
  );
  return { status: lauf.status, stdout: lauf.stdout ?? "", stderr: lauf.stderr ?? "" };
}

function modulJson<T>(ausdruck: string): T {
  const lauf = imModul(ausdruck);
  expect(lauf.status, lauf.stderr).toBe(0);
  return JSON.parse(lauf.stdout) as T;
}

/** Wie `imModul`, aber fuer Rumpfe, die scheitern DUERFEN — der Aufrufer wertet den Ausgang. */
function fahreModul(rumpf: string): { status: number | null; stdout: string; stderr: string } {
  const lauf = spawnSync(
    "node",
    ["--input-type=module", "-e", `import * as m from ${JSON.stringify(MODUL)};\n${rumpf}`],
    { encoding: "utf8", timeout: 120_000 },
  );
  return { status: lauf.status, stdout: lauf.stdout ?? "", stderr: lauf.stderr ?? "" };
}

// ------------------------------------------------------------------------------------------------
// Die Kopierfilter des Bauers, woertlich (`build-current-release.mjs:41-42, :48-61`). Sie werden
// hier nachgebaut und nicht eingefuehrt: der Bauer raeumt beim Laden Verzeichnisse ab.
// ------------------------------------------------------------------------------------------------
const SKIP_NAMEN = new Set(["node_modules", ".git", ".localdb", "dist", ".DS_Store"]);
const SKIP_ENDUNGEN = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".log"];

function kopiereGefiltert(quelle: string, ziel: string): void {
  const name = basename(quelle);
  if (SKIP_NAMEN.has(name)) return;
  if (SKIP_ENDUNGEN.some((endung) => name.endsWith(endung))) return;
  if (statSync(quelle).isDirectory()) {
    mkdirSync(ziel, { recursive: true });
    for (const kind of readdirSync(quelle)) {
      kopiereGefiltert(join(quelle, kind), join(ziel, kind));
    }
    return;
  }
  cpSync(quelle, ziel);
}

/**
 * Ein Paket, wie der Bauer es hinterlaesst — `mitFremdquellen: false` ist der Stand VOR diesem
 * Auftrag und damit die Gegenprobe (Fall C).
 */
function stelleReleaseNach(fremdquellen: readonly string[], mitFremdquellen: boolean): string {
  const ziel = wegwerfordner();
  kopiereGefiltert(join(WURZEL, "services"), join(ziel, "services"));
  // `apps/web/dist` ist das Buendel der Oberflaeche und traegt keine Importkante des Servers; es
  // liegt im Pruefstand oft gar nicht vor (es entsteht erst im Web-Build). Fehlt es, aendert das an
  // dieser Messung nichts — sie fragt nach Quelldateien, nicht nach dem Buendel.
  const dist = join(WURZEL, "apps", "web", "dist");
  if (existsSync(dist)) {
    mkdirSync(join(ziel, "apps", "web"), { recursive: true });
    cpSync(dist, join(ziel, "apps", "web", "dist"), { recursive: true });
  }
  if (mitFremdquellen) {
    for (const pfad of fremdquellen) {
      const nach = join(ziel, pfad);
      mkdirSync(dirname(nach), { recursive: true });
      cpSync(join(WURZEL, pfad), nach);
    }
  }
  return ziel;
}

/**
 * EIN KLEINER, ECHTER QUELLBAUM fuer die Unterscheidung „Importsyntax gegen Importtext" (Fall G).
 *
 * Er ist bewusst winzig und vollstaendig selbst geschrieben: die Erwartung dieses Falls stammt aus
 * DIESER Funktion und nicht aus dem Prueflung. Vier Angaben stehen in `server.ts`, zwei davon sind
 * Syntax und zwei sind Daten:
 *
 *   SYNTAX  `from "../../../aussen/ueber-anfuehrung"`    — gewoehnliche Einfuhr
 *   SYNTAX  `import(`../../../aussen/wirklich-geladen`)` — konstanter Backtick, echte Kante
 *   TEXT    "import { x } from './gibt-es-nicht'"        — Inhalt einer Zeichenkette
 *   TEXT    'export * from "../../../aussen/auch-nicht"' — Inhalt einer Zeichenkette
 *
 * Zu den zwei TEXT-Angaben gibt es ABSICHTLICH keine Datei: wer sie als Kante liest, verlangt eine
 * Datei, die es nicht gibt, und bricht den Bau ab, obwohl nichts fehlt.
 */
function legeProbebaumAn(): string {
  const wurzel = wegwerfordner();
  mkdirSync(join(wurzel, "services", "app", "src"), { recursive: true });
  mkdirSync(join(wurzel, "aussen"), { recursive: true });
  writeFileSync(join(wurzel, "aussen", "ueber-anfuehrung.ts"), "export const auch = 2;\n");
  writeFileSync(join(wurzel, "aussen", "wirklich-geladen.ts"), "export const geladen = 1;\n");
  writeFileSync(
    join(wurzel, EINSTIEG),
    [
      'import { auch } from "../../../aussen/ueber-anfuehrung";',
      "const spaet = () => import(`../../../aussen/wirklich-geladen`);",
      `export const beispiel = "import { x } from './gibt-es-nicht'";`,
      `export const zweites = 'export * from "../../../aussen/auch-nicht"';`,
      "export { auch, spaet, beispiel, zweites };",
      "",
    ].join("\n"),
  );
  return wurzel;
}

/**
 * EIN LAUFFÄHIGER QUELLBAUM für den Fall H — echte `.mjs`-Dateien, die `node` wirklich startet.
 *
 * DER BEFUND, GEGEN DEN ER STEHT (BEN, Runde 4): Ein Schablonenliteral besteht aus TEXT und aus
 * AUSFÜHRBAREN Einsetzungen `${…}`. Runde 4 hat beim Überspringen des Textes auch den Code in den
 * Einsetzungen weggeworfen — und damit eine echte Importkante mit festem Pfad verloren. Das Paket
 * haette die Datei nicht mitgebracht, und der Start endete beim Betreiber mit
 * `ERR_MODULE_NOT_FOUND`: genau der Befund T-015, wegen dem es diesen Auftrag gibt.
 *
 * Hier wird deshalb nicht nur aufgeloest, sondern GESTARTET: `node <paket>/services/app/start.mjs`.
 * Der Einstieg ist absichtlich ein `.mjs` mit Top-Level-await — so braucht der Start kein `tsx` und
 * misst wirklich, was Node tut.
 */
const EINSTIEG_MJS = "services/app/start.mjs";
const GELADEN = "aussen/geladen.mjs";

function legeLaufbaumAn(zeilen: readonly string[]): string {
  const wurzel = wegwerfordner();
  mkdirSync(join(wurzel, "services", "app"), { recursive: true });
  mkdirSync(join(wurzel, "aussen"), { recursive: true });
  writeFileSync(join(wurzel, GELADEN), 'export const wert = "da";\n');
  writeFileSync(
    join(wurzel, EINSTIEG_MJS),
    [
      ...zeilen,
      "// Der Importtext daneben bleibt ein Datum und darf keine Datei verlangen.",
      `export const beispiel = "import { x } from './gibt-es-nicht'";`,
      "",
    ].join("\n"),
  );
  return wurzel;
}

/** Startet ein gebautes Paket wirklich — `node <paket>/<einstieg>`, ohne Umweg. */
function starte(paket: string, einstieg: string): { status: number | null; aus: string } {
  const lauf = spawnSync("node", [join(paket, einstieg)], { encoding: "utf8", timeout: 60_000 });
  return { status: lauf.status, aus: `${lauf.stdout ?? ""}${lauf.stderr ?? ""}` };
}

/**
 * DIE GANZE KETTE FÜR EINEN EINSTIEG: läuft er überhaupt → wird seine Kante gefunden → startet das
 * gebaute Paket → und fällt das Fehlen der Datei auf?
 *
 * Vier Messungen, keine davon verzichtbar:
 *   1. DER QUELLBAUM LÄUFT. Ohne diesen Nachweis wäre jeder folgende Schritt wertlos — eine
 *      Importkante, die Node gar nicht ausführt, muss auch nicht mitgeliefert werden.
 *   2. DIE BERECHNUNG FINDET SIE. Genau `aussen/geladen.mjs`, nicht mehr und nicht weniger.
 *   3. DAS GEBAUTE PAKET STARTET. Kopiert wird wie der Bauer: `services/**` plus die gemeldete Menge.
 *   4. DIE DATEIENTFERNUNGS-GEGENPROBE. Ohne die Datei muss der Start mit `ERR_MODULE_NOT_FOUND`
 *      enden — genau der Ausgang, der beim Betreiber stand (Befund T-015).
 */
function pruefeLaufbaum(zeilen: readonly string[]): void {
  const wurzel = legeLaufbaumAn(zeilen);

  const original = starte(wurzel, EINSTIEG_MJS);
  expect(original.status, `der Quellbaum selbst muss laufen:\n${original.aus}`).toBe(0);
  expect(original.aus).toContain("Ergebnis: da");

  const gemeldet = modulJson<string[]>(
    `m.fremdquellen(${JSON.stringify(wurzel)}, ["${EINSTIEG_MJS}"])`,
  );
  expect(gemeldet).toEqual([GELADEN]);

  const paket = wegwerfordner();
  kopiereGefiltert(join(wurzel, "services"), join(paket, "services"));
  for (const pfad of gemeldet) {
    mkdirSync(dirname(join(paket, pfad)), { recursive: true });
    cpSync(join(wurzel, pfad), join(paket, pfad));
  }
  const imPaket = starte(paket, EINSTIEG_MJS);
  expect(imPaket.status, `das gebaute Paket muss starten:\n${imPaket.aus}`).toBe(0);
  expect(imPaket.aus).toContain("Ergebnis: da");

  rmSync(join(paket, GELADEN));
  const ohne = starte(paket, EINSTIEG_MJS);
  expect(ohne.status).not.toBe(0);
  expect(ohne.aus).toContain("ERR_MODULE_NOT_FOUND");
}

// ------------------------------------------------------------------------------------------------
// Die eigenstaendige Aufloesung: was findet der Start im Zielordner NICHT?
// ------------------------------------------------------------------------------------------------
const ENDUNGEN = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs"];

function angabenAus(quelltext: string): string[] {
  const treffer: string[] = [];
  for (const zeile of quelltext.split("\n")) {
    const rein = zeile.trim();
    if (rein.startsWith("//") || rein.startsWith("*") || rein.startsWith("/*")) continue;
    for (const muster of [
      /\bfrom\s*["']([^"']+)["']/g,
      // NACHGEFUEHRT (BEN, Runde 3): auch der KONSTANTE Backtick ist echte Importsyntax
      // (`import(`./x`)`). Fehlte er hier, koennte diese unabhaengige Suche eine wirklich geladene
      // Datei uebersehen — also genau die Fehlerklasse, gegen die dieser Auftrag steht.
      /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
      /^\s*import\s*["']([^"']+)["']/g,
    ]) {
      for (const fund of zeile.matchAll(muster)) {
        treffer.push(fund[1] as string);
      }
    }
  }
  return treffer;
}

function aufloesen(vonDatei: string, angabe: string): string | undefined {
  const basis = resolve(dirname(vonDatei), angabe);
  const kandidaten = [
    basis,
    ...ENDUNGEN.map((endung) => `${basis}${endung}`),
    ...ENDUNGEN.map((endung) => join(basis, `index${endung}`)),
  ];
  return kandidaten.find((kandidat) => existsSync(kandidat) && statSync(kandidat).isFile());
}

/** Jede relative Einfuhr ab dem Einstieg, die im Zielordner ins Leere zeigt. */
function unaufloesbare(wurzel: string, einstieg: string): string[] {
  const start = join(wurzel, einstieg);
  expect(existsSync(start), `${einstieg} fehlt im nachgestellten Paket`).toBe(true);
  const offen = [start];
  const gesehen = new Set<string>();
  const fehlend: string[] = [];
  while (offen.length > 0) {
    const datei = offen.pop() as string;
    if (gesehen.has(datei)) continue;
    gesehen.add(datei);
    for (const angabe of angabenAus(readFileSync(datei, "utf8"))) {
      if (!angabe.startsWith(".")) continue;
      const ziel = aufloesen(datei, angabe);
      if (ziel === undefined) {
        fehlend.push(`${relative(wurzel, datei)} -> ${angabe}`);
        continue;
      }
      offen.push(ziel);
    }
  }
  return fehlend;
}

function dateienUnter(ordner: string): string[] {
  if (!existsSync(ordner)) return [];
  const gefunden: string[] = [];
  const offen = [ordner];
  while (offen.length > 0) {
    const jetzt = offen.pop() as string;
    for (const kind of readdirSync(jetzt)) {
      const pfad = join(jetzt, kind);
      if (statSync(pfad).isDirectory()) offen.push(pfad);
      else gefunden.push(pfad);
    }
  }
  return gefunden;
}

/** Die gemeldete Menge — einmal erhoben, in jedem Fall dieselbe (jeder Aufruf kostet einen Node-Start). */
let erhoben: string[] | undefined;
function fremdquellenListe(): string[] {
  if (erhoben === undefined) {
    erhoben = modulJson<string[]>("m.fremdquellen(WURZEL)");
  }
  return erhoben;
}

describe("JOB 4241 · das Paket bringt mit, was sein Startpfad laedt", () => {
  it("A · die Inhaltsliste wird berechnet — sie nennt den DOCX-Kern und meldet nicht pauschal alles", () => {
    expect(modulJson<string[]>("m.laufzeitEinstiege()")).toEqual([EINSTIEG]);

    // Der Kernfall: `capture-routes.ts:12` fuehrt ihn ein, der Bauer kopierte ihn nie.
    expect(fremdquellenListe()).toContain("apps/web/src/lib/docx.ts");

    // Und die Gegenrichtung — die Berechnung darf nicht einfach alles melden, was im Baum liegt.
    // `migrationsbeleg.ts` fuehrt nichts ein; von dort aus ist die Menge leer.
    expect(
      modulJson<string[]>('m.fremdquellen(WURZEL, ["services/app/src/migrationsbeleg.ts"])'),
    ).toEqual([]);

    // Nackte Paketnamen kommen ueber `npm ci --omit=dev`, nie ueber den Quellbaum.
    for (const paket of ["mammoth", "fastify", "jszip", "sharp", "pg"]) {
      expect(fremdquellenListe(), `${paket} ist ein Paketname und keine Fremdquelle`).not.toContain(
        paket,
      );
    }
  });

  it("B · im nachgestellten Paket loest JEDE relative Einfuhr ab server.ts auf", () => {
    const paket = stelleReleaseNach(fremdquellenListe(), true);
    expect(unaufloesbare(paket, EINSTIEG)).toEqual([]);

    // Genau die gemeldete Menge — nicht der ganze `apps/web/src`-Baum (dort liegen hunderte
    // Dateien, darunter die ganze Oberflaeche). Ein pauschales Kopieren waere die zweite Halbheit.
    const mitgebracht = dateienUnter(join(paket, "apps", "web", "src"))
      .map((pfad) => relative(paket, pfad).split("\\").join("/"))
      .sort();
    expect(mitgebracht).toEqual(
      fremdquellenListe()
        .filter((pfad) => pfad.startsWith("apps/web/src/"))
        .sort(),
    );
    expect(dateienUnter(join(WURZEL, "apps", "web", "src")).length).toBeGreaterThan(
      mitgebracht.length * 10,
    );

    // Kein Entwicklerbaum: weder `node_modules` noch `.git` wandern mit.
    for (const verboten of ["node_modules", ".git"]) {
      expect(existsSync(join(paket, verboten)), `${verboten} gehoert nicht ins Paket`).toBe(false);
    }
  });

  it("C · GEGENPROBE: ohne den Kopierschritt meldet dieselbe Vorrichtung den DOCX-Kern als unauflösbar", () => {
    const paket = stelleReleaseNach(fremdquellenListe(), false);
    const fehlend = unaufloesbare(paket, EINSTIEG);
    expect(fehlend.length).toBeGreaterThan(0);
    expect(fehlend.join("\n")).toContain("apps/web/src/lib/docx");
  });

  it("D · der Bauer ruft die Berechnung wirklich und legt sie unter unveraendertem Pfad ab", () => {
    // Bauart uebernommen von `tests/insel-update/release-inhalt.test.ts:25-47`: `node --check`
    // faengt den Syntaxfehler, die Einfuhrprobe den umbenannten Export.
    const syntax = spawnSync("node", ["--check", BAU], { encoding: "utf8" });
    expect(syntax.status, syntax.stderr ?? "").toBe(0);

    const namen = modulJson<string[]>("Object.keys(m).sort()");
    for (const name of ["fremdquellen", "laufzeitEinstiege"]) {
      expect(namen, `build-current-release.mjs benutzt ${name}`).toContain(name);
    }

    const quelle = readFileSync(BAU, "utf8");
    expect(quelle, "der Bauer muss die Liste berechnen").toContain('from "./paketinhalt.mjs"');
    expect(quelle).toContain("fremdquellen(repo)");
    // Unveraenderter repo-relativer Pfad im Release — sonst zeigt die Einfuhr wieder ins Leere.
    expect(quelle).toMatch(/join\(releaseDir,\s*pfad\)/);
    // Fail-closed statt stiller Luecke (Muster `build-current-release.mjs:101-103`).
    expect(quelle).toContain("das Paket waere unvollstaendig");
    // Und die Ausgabe belegt am Paket selbst, was sie mitbringt.
    expect(quelle).toMatch(/fremdquellen=\$\{mitgelieferteFremdquellen/);
    // Die bestehenden BUILD_INFO-Zeilen bleiben, `tests/insel-update` liest sie.
    for (const zeile of ["version=${version}", "web_build=apps/web/dist", "port=3002"]) {
      expect(quelle, `BUILD_INFO-Zeile ${zeile} darf nicht wegfallen`).toContain(zeile);
    }
  });

  it("E · die Berechnung hat keine Nebenwirkung — sie schreibt nichts und ruft kein Werkzeug", () => {
    const quelle = readFileSync(MODUL, "utf8");
    for (const verboten of ["writeFileSync", "rmSync", "mkdirSync", "execFileSync", "spawnSync"]) {
      expect(quelle, `${verboten} gehoert nicht in ein nebenwirkungsfreies Modul`).not.toContain(
        verboten,
      );
    }
    // Gemessen statt behauptet: das Modul in einem leeren Ordner einfuehren und fahren, danach ist
    // der Ordner unveraendert leer.
    const leer = wegwerfordner();
    const lauf = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { fremdquellen } from ${JSON.stringify(MODUL)};
fremdquellen(${JSON.stringify(WURZEL)});
process.stdout.write("gefahren");`,
      ],
      { cwd: leer, encoding: "utf8", timeout: 120_000 },
    );
    expect(lauf.status, lauf.stderr ?? "").toBe(0);
    expect(lauf.stdout).toBe("gefahren");
    expect(readdirSync(leer)).toEqual([]);
  });

  it("F · eine unauflösbare Einfuhr bricht ab, statt ein halbes Paket zu melden", () => {
    // FAIL-CLOSED, gemessen: ein Einstieg, der eine nicht vorhandene Datei einfuehrt, muss den
    // Lauf beenden. Eine stille leere Liste waere genau der Ausgang, gegen den dieser Auftrag steht.
    const ordner = wegwerfordner();
    mkdirSync(join(ordner, "services", "app", "src"), { recursive: true });
    writeFileSync(
      join(ordner, "services", "app", "src", "server.ts"),
      'import { fastify } from "fastify";\nimport { fehlt } from "./gibt-es-nicht";\nexport { fastify, fehlt };\n',
    );
    const lauf = spawnSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import { erreichteQuellen } from ${JSON.stringify(MODUL)};
erreichteQuellen(${JSON.stringify(ordner)}, ["services/app/src/server.ts"]);`,
      ],
      { encoding: "utf8", timeout: 120_000 },
    );
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("dazu gibt es keine Datei");

    // Und derselbe Ausgang fuer den Pfad, der erst zur Laufzeit entsteht: welche Datei das Paket
    // dafuer braucht, kann niemand benennen — sie stillschweigend wegzulassen waere derselbe
    // Fehler wie bei `docx.ts`, nur unauffindbar.
    writeFileSync(
      join(ordner, "services", "app", "src", "server.ts"),
      "const teil = (n) => import(`./teil/${n}`);\nexport { teil };\n",
    );
    const berechnet = fahreModul(`m.erreichteQuellen(${JSON.stringify(ordner)}, ["${EINSTIEG}"]);`);
    expect(berechnet.status).not.toBe(0);
    expect(berechnet.stderr).toContain("berechneten relativen Pfad");
  });

  // ==============================================================================================
  // G · IMPORTSYNTAX GEGEN IMPORTTEXT — die zwei Gegenbeispiele aus BENs Runde-3-Urteil.
  // ==============================================================================================
  //
  // Beide Faelle sind heute im Bestand NICHT vorhanden (gemessen: kein `import(\`…\`)` und kein
  // Importtext in einer Zeichenkette unter `services/**` oder `apps/web/src/**`). Genau deshalb
  // gehoeren sie hierher: sie schlagen beim ERSTEN Mal zu, an dem jemand so etwas schreibt, und
  // zwar still.
  //
  //   TEXT IST KEINE KANTE.   `const s = "import { x } from './gibt-es-nicht'"` ist ein Datum.
  //                           Wer daraus eine Kante macht, verlangt eine Datei, die niemand laedt —
  //                           und bricht mit Lieferung 3 den Bau ab, ohne dass etwas fehlt.
  //   BACKTICK IST EINE KANTE. `import(\`./wirklich-geladen\`)` ist echte Syntax mit konstantem
  //                           Pfad. Wer sie uebersieht, laesst die Datei aus dem Paket fallen —
  //                           also genau `ERR_MODULE_NOT_FOUND` beim Betreiber, der Befund T-015.
  //
  // Gemessen wird an einem ECHTEN kleinen Quellbaum und an der daraus gebauten Paketausgabe, nicht
  // an einer Zeichenkette allein.
  it("G · Importtext in einer Zeichenkette erzeugt keine Kante, ein konstanter Backtick-Import schon", () => {
    const baum = legeProbebaumAn();

    // Die Berechnung selbst — die Erwartung stammt aus dem Baum, den dieser Test geschrieben hat.
    expect(modulJson<string[]>(`m.fremdquellen(${JSON.stringify(baum)}, ["${EINSTIEG}"])`)).toEqual(
      ["aussen/ueber-anfuehrung.ts", "aussen/wirklich-geladen.ts"],
    );

    // Und dieselbe Unterscheidung direkt an der Lesefunktion (so hat BEN sie gemessen).
    const quelle = readFileSync(join(baum, EINSTIEG), "utf8");
    const angaben = modulJson<string[]>(`m.modulangaben(${JSON.stringify(quelle)})`);
    expect(angaben).toContain("../../../aussen/wirklich-geladen");
    expect(angaben).toContain("../../../aussen/ueber-anfuehrung");
    expect(angaben, "Importtext in einer Zeichenkette ist keine Importangabe").not.toContain(
      "./gibt-es-nicht",
    );
    expect(angaben).not.toContain("../../../aussen/auch-nicht");
  });

  it("G2 · das daraus gebaute Paket ist vollständig — und ohne den Backtick-Fund ist es das nicht", () => {
    const baum = legeProbebaumAn();
    const gemeldet = modulJson<string[]>(
      `m.fremdquellen(${JSON.stringify(baum)}, ["${EINSTIEG}"])`,
    );

    // MIT der berechneten Menge: der Startpfad loest im Zielordner vollstaendig auf.
    const vollstaendig = wegwerfordner();
    kopiereGefiltert(join(baum, "services"), join(vollstaendig, "services"));
    for (const pfad of gemeldet) {
      mkdirSync(dirname(join(vollstaendig, pfad)), { recursive: true });
      cpSync(join(baum, pfad), join(vollstaendig, pfad));
    }
    // Die rohe Suche oben ist eine OBERMENGE: sie meldet auch den Importtext aus der Zeichenkette,
    // weil sie Zeilen liest und keine Syntax kennt. Von ihr wird deshalb genau das verlangt, was sie
    // kann — dass die ECHTEN Kanten aufloesen. Dass der Text KEINE Datei verlangt, ist die Aufgabe
    // des Prueflings und wird gleich an ihm gemessen.
    const offen = unaufloesbare(vollstaendig, EINSTIEG).join("\n");
    expect(offen, "der Backtick-Import muss im Zielordner aufloesen").not.toContain(
      "wirklich-geladen",
    );
    expect(offen, "die Anfuehrungs-Einfuhr muss im Zielordner aufloesen").not.toContain(
      "ueber-anfuehrung",
    );
    const gutlauf = fahreModul(
      `m.erreichteQuellen(${JSON.stringify(vollstaendig)}, ["${EINSTIEG}"]);`,
    );
    expect(gutlauf.status, gutlauf.stderr).toBe(0);

    // GEGENPROBE: derselbe Ordner, nur ohne die Datei aus dem Backtick-Import. Jetzt muss es
    // auffallen — still weiterzubauen waere der Fehler, den dieser Auftrag beseitigt.
    rmSync(join(vollstaendig, "aussen", "wirklich-geladen.ts"));
    expect(unaufloesbare(vollstaendig, EINSTIEG).join("\n")).toContain("wirklich-geladen");
    const schlechtlauf = fahreModul(
      `m.erreichteQuellen(${JSON.stringify(vollstaendig)}, ["${EINSTIEG}"]);`,
    );
    expect(schlechtlauf.status).not.toBe(0);
    expect(schlechtlauf.stderr).toContain("wirklich-geladen");

    // Und der Importtext hat keine Datei verlangt: `gibt-es-nicht` existiert nirgends, trotzdem
    // lief die Berechnung oben ohne Abbruch durch.
    expect(gemeldet.join(",")).not.toContain("gibt-es-nicht");
  });

  // ==============================================================================================
  // H · WO ENDET EINE `${…}`-EINSETZUNG WIRKLICH — gestartet, nicht nur aufgeloest.
  // ==============================================================================================
  //
  // DREI FÄLLE, EINE FRAGE. BEN hat denselben Fehlertyp zweimal an verschiedenen Stellen gefunden:
  // Runde 4 verlor die Einfuhr, weil der Ausdruck in `${…}` uebersprungen wurde; Runde 5, weil ein
  // `}` INNERHALB eines regulaeren Ausdrucks die Einsetzung vorzeitig beendete. Beide Male fiel eine
  // Datei aus dem Paket, die der Start wirklich laedt. Deshalb steht hier nicht der naechste
  // Einzelfall, sondern eine Reihe: einfach, regulaerer Ausdruck, verschachtelt samt Kommentar.
  // Jeder Fall faehrt die ganze Kette (`pruefeLaufbaum`) — Start, Menge, Paketstart, Dateientfernung.
  it("H · einfache Einsetzung: der Import wandert mit, das gebaute Paket startet", () => {
    pruefeLaufbaum([
      "// Die Einfuhr steht IN der Einsetzung eines Schablonenliterals — und laeuft wirklich.",
      'console.log(`Ergebnis: ${(await import("../../aussen/geladen.mjs")).wert}`);',
    ]);
  });

  it("H3 · ein `}` in einem regulären Ausdruck beendet die Einsetzung NICHT (BENs Gegenfall, Runde 5)", () => {
    // Woertlich der Fall aus dem Urteil: `/}/` enthaelt eine Klammer, `"}"` noch eine. Beendet eines
    // davon die Einsetzung, faellt der dahinter stehende konstante Import weg — still.
    pruefeLaufbaum([
      'console.log(`Ergebnis: ${ /}/.test("}")',
      '  ? (await import("../../aussen/geladen.mjs")).wert : "nein" }`);',
    ]);
  });

  it("H4 · verschachtelte Einsetzung mit `}` in Kommentar und Zeichenkette", () => {
    pruefeLaufbaum([
      "console.log(`Ergebnis: ${ `${ /* ein } im Kommentar */ " +
        '(await import("../../aussen/geladen.mjs")).wert }` }`);',
    ]);
  });

  it("H2 · ohne den Kopierschritt startet dasselbe Paket nicht — der Grund ist die fehlende Datei", () => {
    const wurzel = legeLaufbaumAn([
      'console.log(`Ergebnis: ${(await import("../../aussen/geladen.mjs")).wert}`);',
    ]);
    // Der Stand VOR diesem Auftrag: nur die zwei Baeume, keine berechnete Menge.
    const halb = wegwerfordner();
    kopiereGefiltert(join(wurzel, "services"), join(halb, "services"));
    const lauf = starte(halb, EINSTIEG_MJS);
    expect(lauf.status).not.toBe(0);
    expect(lauf.aus).toContain("ERR_MODULE_NOT_FOUND");
    expect(lauf.aus).toContain("geladen.mjs");
  });
});
