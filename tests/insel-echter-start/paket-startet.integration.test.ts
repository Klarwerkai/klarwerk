// ================================================================================================
// JOB 4315 — DAS ECHT GEBAUTE INSELPAKET STARTET WIRKLICH.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT. Die Zusage der Zeile KUNDENBETRIEB-BACKUP lautet: „Ein mit
// dem offiziellen Paketbauer erzeugtes Paket lässt sich in einer leeren, isolierten Zielumgebung
// entpacken und starten." Belegt war davon KEIN EINZIGER LAUF. Gemessen wurde bisher ausschliesslich
// der QUELLTEXT des Bauers (`tests/insel-update/release-inhalt.test.ts:22` liest ihn als Text,
// `tests/insel-paketausgabe/fremdquellen-im-paket.test.ts` stellt seine Ausgabe NACH). Beide sagen
// das auch selbst; der Satz dort („ein voller Baulauf … wird hier nicht behauptet") bleibt wahr,
// weil der volle Lauf ab jetzt HIER steht und nicht dort.
//
// WARUM DAS ÜBERHAUPT GEHT, obwohl der Prüfstand kein `zip` hat (`register/cloud/Dockerfile:4`):
// Die Werkzeugsperre trifft nur die VERPACKUNG. `npm ci --omit=dev` läuft IM Releaseverzeichnis, der
// `zip`-Aufruf kommt danach. Der Bauer kennt seit diesem Auftrag den ausdrücklichen Schalter
// `--ohne-verpackung`; damit ist das fertige Release messbar, ohne dass irgendwo ein unverpacktes
// Paket als verpacktes gemeldet würde.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER NICHT GEMESSEN WIRD — die Grenze gehört an dieselbe Stelle wie die Behauptung
// ------------------------------------------------------------------------------------------------
//   Der ZIP-Schritt selbst (nur sein ABBRUCH wird gemessen, Fall K3), das Auspacken über `unzip`,
//   der Lauf auf dem Mac Studio, `update-einspielen.sh`/Rückfall und die Bedienung der Oberfläche
//   durch einen Menschen. Nichts davon wird hier gefahren, und ein nicht gefahrener Fall gilt nie
//   als bestanden.
//
// ------------------------------------------------------------------------------------------------
// JOB 4332 — DER BEFUND VON JOB 4315 IST BEHOBEN, UND DIESE DATEI SETZT KEINEN WERT MEHR DAZU
// ------------------------------------------------------------------------------------------------
//   Bis JOB 4332 startete jeder Fall dieser Datei das Paket mit zwei Werten, die der Startbefehl
//   nicht selbst setzte (`APP_BASE_URL`, `KLARWERK_ALLOW_INMEMORY_PROD=1`), und Fall B1 pinnte den
//   Abbruch OHNE sie. Der Startbefehl setzt beide jetzt selbst (`release-texte.mjs`,
//   `startBefehlText`): die Adresse als Vorgabewert aus dem verwendeten `PORT`, die
//   Persistenz-Ausnahme AUSSCHLIESSLICH im Journalzweig. B1 ist damit der POSITIVE Nachweis.
//
//   DIE REGEL, DIE DARAUS FOLGT UND FÜR JEDEN NEUEN FALL HIER GILT: `starteInsel` bekommt ausser
//   `KLARWERK_SHARED_ROOT` (dem Zielverzeichnis, das auf dem Mac Studio der Betreiber stellt) KEINEN
//   Umgebungswert mehr. Wer hier einen dazusetzt, misst nicht mehr das Paket, das beim Betreiber
//   startet. Die EINE Ausnahme ist Fall B2 — dort ist das von aussen gesetzte `APP_BASE_URL` der
//   Gegenstand der Messung.
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Baulauf,
  FREMDQUELLE,
  type Gesundheit,
  type Inselstart,
  WURZEL,
  baue,
  feldAus,
  freierPort,
  kopiereNachAussen,
  leeresZielverzeichnis,
  paketVersion,
  pfadOhneZip,
  portBelegt,
  raeumeAuf,
  starteInsel,
  warteAufGesundheit,
} from "./echter-lauf";

/** Die Frist, innerhalb derer `/health` geantwortet haben muss. Sie wird ausgewiesen, nicht geraten. */
const GESUNDHEITSFRIST_MS = 120_000;
/** Ein echtes, kleines Dokument aus dem Bestand: ein Absatz, ein unverwechselbarer Satz. */
const DOKUMENT = join(WURZEL, "tests/fixtures/sample.docx");
const DOKUMENTSATZ = "Ventil bei Überdruck schließen";

interface Bauausgabe {
  version?: unknown;
  commit?: unknown;
  marker?: unknown;
  releaseDir?: unknown;
  relativeRelease?: unknown;
  verpackt?: unknown;
  grund?: unknown;
  zipPath?: unknown;
  relativeZip?: unknown;
  size?: unknown;
}

/**
 * Die JSON-Ausgabe des Bauers aus seinem Gesamtprotokoll schneiden. Sie steht am ENDE; davor liegt
 * das Protokoll von `npm ci`, das der Bauer an seine eigene Ausgabe durchreicht (`run`, `stdio:
 * "inherit"`). Gesucht wird deshalb das LETZTE Paar aus einer Zeile `{` und einer Zeile `}` —
 * `JSON.stringify(…, null, 2)` schreibt beide ohne Einrückung, jede innere Zeile eingerückt.
 */
function letztesJson(ausgabe: string): Bauausgabe | undefined {
  const zeilen = ausgabe.split("\n");
  const zu = zeilen.map((z) => z.trimEnd()).lastIndexOf("}");
  if (zu < 0) {
    return undefined;
  }
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

/** Stellt `apps/web/dist` über den VORHANDENEN Web-Build her — kein eigener Bauweg. */
function stelleWebbuendelSicher(): { noetig: boolean; befehl: string; dauerMs: number } {
  if (existsSync(join(WURZEL, "apps/web/dist/index.html"))) {
    return { noetig: false, befehl: "—(vorhanden, wiederverwendet)", dauerMs: 0 };
  }
  const befehl = "npx vite build (in apps/web — derselbe Aufruf wie tools/build)";
  const beginn = Date.now();
  const lauf = spawnSync("npx", ["vite", "build"], {
    cwd: join(WURZEL, "apps", "web"),
    encoding: "utf8",
    timeout: 1_200_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (lauf.status !== 0) {
    throw new Error(
      `Web-Build fehlgeschlagen (${lauf.status}):\n${lauf.stdout ?? ""}\n${lauf.stderr ?? ""}`,
    );
  }
  return { noetig: true, befehl, dauerMs: Date.now() - beginn };
}

/** Das erste im ausgelieferten HTML genannte Bündel — Pfad und erwartete Art. */
function ersterBuendelpfad(html: string): { pfad: string; art: RegExp } | undefined {
  const skript = /<script[^>]+src="([^"]+\.js)"/.exec(html);
  if (skript?.[1]) {
    return { pfad: skript[1], art: /javascript|ecmascript/i };
  }
  const stil = /<link[^>]+href="([^"]+\.css)"/.exec(html);
  if (stil?.[1]) {
    return { pfad: stil[1], art: /text\/css/i };
  }
  return undefined;
}

interface Markerbefund {
  readonly code: number;
  readonly html: string;
  readonly markerImHtml: string;
}

async function holeOberflaeche(port: number): Promise<Markerbefund> {
  const antwort = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(15_000) });
  const html = await antwort.text();
  const treffer = /<meta name="klarwerk-island" content="([^"]*)">/.exec(html);
  return { code: antwort.status, html, markerImHtml: treffer?.[1] ?? "" };
}

// ------------------------------------------------------------------------------------------------
// DIE VIER PRODUKTWEGE, DIE MEHR ALS EIN FALL BRAUCHT — einmal geschrieben, nicht je Fall neu.
// ------------------------------------------------------------------------------------------------
//
// EINE Anmeldung, EIN Import, EIN Lesen: Fall L5 misst sie am ersten Start, N1 misst dieselben Wege
// über einen Neustart hinweg und N2 gegen ein geleertes Journal. Zwei Fassungen desselben Aufrufs
// wären zwei Auffassungen davon, was „derselbe Entwurf" heisst.

/** Das eine Konto dieser Datei. Der erste Anwender einer frischen Instanz wird Administrator. */
const KONTO = {
  name: "Inselprobe",
  email: "inselprobe@example.invalid",
  password: "inselprobe-2026",
} as const;

interface Antwort {
  readonly status: number;
  readonly text: string;
}

/** Ersteinrichtung über den vorhandenen Produktweg (`services/auth/src/routes.ts:821`). */
async function richteEin(port: number): Promise<Antwort & { token: string; rolle: string }> {
  const antwort = await fetch(`http://127.0.0.1:${port}/api/auth/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(KONTO),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await antwort.text();
  const gelesen = antwort.status === 201 ? (JSON.parse(text) as Konto) : {};
  return {
    status: antwort.status,
    text,
    token: typeof gelesen.token === "string" ? gelesen.token : "",
    rolle: typeof gelesen.user?.role === "string" ? gelesen.user.role : "",
  };
}

interface Konto {
  token?: unknown;
  user?: { role?: unknown };
}

/** Anmeldung mit DENSELBEN Zugangsdaten (`POST /api/auth/login`). */
async function meldeAn(port: number): Promise<Antwort & { token: string }> {
  const antwort = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: KONTO.email, password: KONTO.password }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await antwort.text();
  const gelesen = antwort.status === 200 ? (JSON.parse(text) as Konto) : {};
  return {
    status: antwort.status,
    text,
    token: typeof gelesen.token === "string" ? gelesen.token : "",
  };
}

/** Der DOCX-Importweg des laufenden Pakets (`POST /api/drafts/from-docx`). */
async function importiereDokument(
  port: number,
  token: string,
): Promise<Antwort & { id: string; bodyHtml: string; statement: string }> {
  const bytes = readFileSync(DOKUMENT);
  const antwort = await fetch(`http://127.0.0.1:${port}/api/drafts/from-docx`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: "inselprobe.docx", data: bytes.toString("base64") }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await antwort.text();
  const entwurf =
    antwort.status === 201
      ? (JSON.parse(text) as {
          id?: unknown;
          payload?: { bodyHtml?: unknown; statement?: unknown };
        })
      : {};
  return {
    status: antwort.status,
    text,
    id: typeof entwurf.id === "string" ? entwurf.id : "",
    bodyHtml: String(entwurf.payload?.bodyHtml ?? ""),
    statement: String(entwurf.payload?.statement ?? ""),
  };
}

/** Einen Entwurf über HTTP wieder lesen (`GET /api/drafts/:id`). */
async function liesEntwurf(port: number, token: string, id: string): Promise<Antwort> {
  const antwort = await fetch(`http://127.0.0.1:${port}/api/drafts/${id}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30_000),
  });
  return { status: antwort.status, text: await antwort.text() };
}

// ------------------------------------------------------------------------------------------------
// Der eine Lauf, den alle Fälle teilen. Er kostet den ganzen Bau samt `npm ci` und wird deshalb
// EINMAL gefahren; jeder Fall misst danach an seinem Ergebnis.
// ------------------------------------------------------------------------------------------------
let webbuendel: { noetig: boolean; befehl: string; dauerMs: number };
let baulauf: Baulauf | undefined;
let bau: Bauausgabe | undefined;
let paket = "";
let port = 0;
let start: Inselstart | undefined;
let gesund: Gesundheit | undefined;
let kopierMs = 0;
let startMs = 0;

/** Was N1 an Bestand hinterlässt und N2 als Gegenprobe wieder verliert. */
interface Neustartakte {
  readonly gemeinsam: string;
  readonly journal: string;
  readonly entwurfId: string;
}
let neustartAkte: Neustartakte | undefined;

beforeAll(async () => {
  webbuendel = stelleWebbuendelSicher();
  baulauf = baue(["--ohne-verpackung"]);
  bau = letztesJson(baulauf.stdout);
  const releaseDir = typeof bau?.releaseDir === "string" ? bau.releaseDir : "";
  if (baulauf.status !== 0 || releaseDir === "" || !existsSync(releaseDir)) {
    // Kein Wurf: der Fall S0 soll die ECHTE Ausgabe zeigen und nicht eine Hookmeldung darüber.
    return;
  }
  const kopierBeginn = Date.now();
  paket = kopiereNachAussen(releaseDir);
  kopierMs = Date.now() - kopierBeginn;

  port = await freierPort();
  const startBeginn = Date.now();
  // OHNE jeden Zusatzwert: genau der Start, den der Betreiber fährt (s. Kopfkommentar, JOB 4332).
  start = starteInsel(paket, port, { KLARWERK_SHARED_ROOT: leeresZielverzeichnis() });
  gesund = await warteAufGesundheit(start, GESUNDHEITSFRIST_MS);
  startMs = Date.now() - startBeginn;
}, 2_400_000);

afterAll(async () => {
  await start?.beenden();
  raeumeAuf();
});

describe("JOB 4315 · das echt gebaute Inselpaket startet wirklich", () => {
  // ==============================================================================================
  // S0 · LIEFERUNG 1 — der Bau endet ohne Verpackung und sagt das ausdrücklich.
  // ==============================================================================================
  it("S0 · `--ohne-verpackung` baut das Release fertig und meldet verpackt: false, zipPath: null", () => {
    expect(baulauf, "beforeAll ist nicht bis zum Baulauf gekommen").toBeDefined();
    const lauf = baulauf as Baulauf;
    expect(lauf.status, `Baulauf rot:\n${lauf.stdout.slice(-4000)}\n${lauf.stderr}`).toBe(0);
    expect(
      bau,
      `keine JSON-Ausgabe am Ende des Baulaufs:\n${lauf.stdout.slice(-2000)}`,
    ).toBeDefined();
    const ausgabe = bau as Bauausgabe;

    expect(ausgabe.verpackt).toBe(false);
    expect(ausgabe.zipPath).toBeNull();
    expect(ausgabe.relativeZip).toBeNull();
    expect(ausgabe.size).toBeNull();
    expect(typeof ausgabe.grund).toBe("string");
    expect(String(ausgabe.grund)).toContain("--ohne-verpackung");
    expect(typeof ausgabe.version).toBe("string");
    expect(String(ausgabe.version)).toMatch(/^klarwerk-insel-/);
    expect(typeof ausgabe.releaseDir).toBe("string");
    expect(String(ausgabe.relativeRelease).split("\\").join("/")).toMatch(
      /^dist\/insel\/staging\//,
    );
    // Und es liegt wirklich kein Paket herum, das jemand für das Ergebnis halten könnte.
    const zipName = `${String(ausgabe.version)}.zip`;
    expect(existsSync(join(WURZEL, "dist", "insel", zipName))).toBe(false);
  });

  // ==============================================================================================
  // L2 · LIEFERUNG 2 — was der Bau hinterlassen hat, gemessen an der Kopie, die gleich startet.
  // ==============================================================================================
  it("L2 · das gebaute Release trägt BUILD_INFO, den DOCX-Kern unter seinem Pfad, node_modules und ein ausführbares start.command", () => {
    expect(paket, "kein Release zum Messen — S0 ist rot").not.toBe("");
    const bauInfo = readFileSync(join(paket, "BUILD_INFO"), "utf8");
    expect(feldAus(bauInfo, "version")).toBe(String(bau?.version));
    expect(feldAus(bauInfo, "commit")).toMatch(/^[0-9a-f]{40}$/);
    expect(feldAus(bauInfo, "ui_marker")).toBe(String(bau?.marker));
    // Die berechnete Inhaltsliste steht am Paket selbst und nennt den Kern aus dem Befund T-015.
    expect(feldAus(bauInfo, "fremdquellen").split(",")).toContain(FREMDQUELLE);

    // UNVERÄNDERTER repo-relativer Pfad, und byte-gleich zur Quelle: eine Kopie an anderer Stelle
    // löste die Einfuhr aus `capture-routes.ts:12` wieder ins Leere auf.
    const imPaket = join(paket, FREMDQUELLE);
    expect(existsSync(imPaket), `${FREMDQUELLE} fehlt im Paket`).toBe(true);
    expect(readFileSync(imPaket, "utf8")).toBe(readFileSync(join(WURZEL, FREMDQUELLE), "utf8"));

    expect(
      existsSync(join(paket, "node_modules", "tsx")),
      "tsx fehlt — der Start hätte keinen Lader",
    ).toBe(true);
    expect(existsSync(join(paket, "apps", "web", "dist", "index.html"))).toBe(true);
    // Der Modus wird vom Bauer GESETZT und nicht vom Quellbaum geerbt (`writeExecutable`, 0755);
    // ein Release, dessen Startbefehl sich nicht ausführen lässt, ist keines.
    expect(statSync(join(paket, "start.command")).mode & 0o777).toBe(0o755);
  });

  // ==============================================================================================
  // S1 · LIEFERUNG 3 — der Start in der leeren, isolierten Zielumgebung.
  // ==============================================================================================
  it("S1 · /health antwortet 200 mit GENAU der Version dieses Pakets", () => {
    expect(start, "das Paket wurde nicht gestartet — S0 ist rot").toBeDefined();
    const lauf = start as Inselstart;
    expect(
      gesund?.erreicht,
      `keine gesunde Antwort binnen ${GESUNDHEITSFRIST_MS / 1000} s. Protokoll des Pakets:\n${lauf.ausgabe().slice(-6000)}`,
    ).toBe(true);
    expect(gesund?.code).toBe(200);
    // Nicht „irgendeine grüne Antwort": die Version muss die des PAKETS sein. Die Vergleichsgrösse
    // kommt aus dem Paket selbst (seiner `package.json` — derselben Datei, aus der `/health` sie
    // liest) und aus seinem `SCHEMA-VERTRAG`; beide sind unabhängig vom laufenden Prozess.
    const ausPaket = paketVersion(paket);
    expect(ausPaket).not.toBe("");
    expect(gesund?.version).toBe(ausPaket);
    expect(feldAus(readFileSync(join(paket, "SCHEMA-VERTRAG"), "utf8"), "app_version")).toBe(
      ausPaket,
    );
    expect(lauf.lebt(), "der Prozess ist nach der Antwort nicht mehr da").toBe(true);
  });

  // ==============================================================================================
  // L4 · LIEFERUNG 4 — die Oberfläche kommt aus DIESEM Paket.
  // ==============================================================================================
  it("L4 · GET / liefert HTML mit dem Inselmarker, und das darin genannte Bündel ist abrufbar", async () => {
    expect(gesund?.erreicht, "ohne laufendes Paket ist hier nichts zu holen").toBe(true);
    const befund = await holeOberflaeche(port);
    expect(befund.code).toBe(200);
    expect(
      befund.markerImHtml,
      `kein Inselmarker im ausgelieferten HTML:\n${befund.html.slice(0, 800)}`,
    ).toBe(String(bau?.marker));
    // Der Marker ist je Baulauf einmalig (Releasename + Commit) — er belegt damit, dass die Antwort
    // aus GENAU diesem Bau stammt und nicht aus einem fremden Prozess am selben Port.
    expect(befund.markerImHtml).toContain(String(bau?.version));

    const buendel = ersterBuendelpfad(befund.html);
    expect(
      buendel,
      `im HTML steht kein JS-/CSS-Bündel:\n${befund.html.slice(0, 800)}`,
    ).toBeDefined();
    const ziel = buendel as { pfad: string; art: RegExp };
    const antwort = await fetch(`http://127.0.0.1:${port}${ziel.pfad}`, {
      signal: AbortSignal.timeout(15_000),
    });
    expect(antwort.status, `${ziel.pfad} nicht ausgeliefert`).toBe(200);
    expect(antwort.headers.get("content-type") ?? "").toMatch(ziel.art);
    expect((await antwort.text()).length).toBeGreaterThan(100);
  });

  // ==============================================================================================
  // L5 · LIEFERUNG 5 — der DOCX-Weg im laufenden Paket, über den vorhandenen Produktweg.
  // ==============================================================================================
  it("L5 · eine echte .docx geht durch den Importweg des gestarteten Pakets und kommt als Text zurück", async () => {
    expect(gesund?.erreicht, "ohne laufendes Paket ist der Weg nicht fahrbar").toBe(true);
    const lauf = start as Inselstart;

    // Die Anmeldung über den VORHANDENEN Produktweg: ein frisches Journal heisst Ersteinrichtung,
    // und die legt das erste Konto als Admin an (`services/auth/src/routes.ts:821`).
    const konto = await richteEin(port);
    expect(konto.status, `Ersteinrichtung fehlgeschlagen: ${konto.text}`).toBe(201);
    expect(konto.token, `kein Sitzungsschlüssel: ${konto.text}`).not.toBe("");
    expect(konto.rolle).toBe("admin");

    expect(readFileSync(DOKUMENT).byteLength).toBeGreaterThan(200);
    const entwurf = await importiereDokument(port, konto.token);
    expect(entwurf.status, `Dokumentimport fehlgeschlagen: ${entwurf.text}`).toBe(201);
    expect(entwurf.bodyHtml).toContain(DOKUMENTSATZ);
    expect(entwurf.statement).toContain(DOKUMENTSATZ);

    // Der Grund, warum es diesen Auftrag gibt: im Protokoll des LAUFENDEN Pakets darf der Befund
    // T-015 nicht stehen.
    expect(lauf.ausgabe()).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(lauf.ausgabe()).not.toContain("MODULE_NOT_FOUND");
  });

  // ==============================================================================================
  // K1 · KALIBRIERUNG (a) — ohne die mitgelieferte Fremdquelle bricht der Start wirklich.
  // ==============================================================================================
  it("K1 · GEGENPROBE: wird apps/web/src/lib/docx.ts aus dem Release gelöscht, startet das Paket nicht mehr", async () => {
    expect(paket, "kein Paket zum Verstellen").not.toBe("");
    const imPaket = join(paket, FREMDQUELLE);
    const sicherung = readFileSync(imPaket);
    rmSync(imPaket);
    const kalibrierPort = await freierPort();
    const kalibrierung = starteInsel(paket, kalibrierPort, {
      KLARWERK_SHARED_ROOT: leeresZielverzeichnis(),
    });
    try {
      const befund = await warteAufGesundheit(kalibrierung, 60_000);
      expect(
        befund.erreicht,
        "das Paket startete OHNE die Datei — dann misst dieser Nachweis nichts",
      ).toBe(false);
      expect(kalibrierung.ausgabe()).toContain("ERR_MODULE_NOT_FOUND");
      expect(kalibrierung.ausgabe()).toContain("apps/web/src/lib/docx");
    } finally {
      await kalibrierung.beenden();
      copyFileSync(join(WURZEL, FREMDQUELLE), imPaket);
      chmodSync(imPaket, 0o644);
    }
    // Zurückgenommen und nachgewiesen: die Datei ist wieder byte-gleich zur Quelle.
    expect(readFileSync(imPaket)).toEqual(sicherung);
  }, 300_000);

  // ==============================================================================================
  // K2 · KALIBRIERUNG (b) — ohne den Marker wird die Prüfung aus L4 rot.
  // ==============================================================================================
  it("K2 · GEGENPROBE: ohne den Inselmarker in der ausgelieferten index.html fällt der Nachweis aus L4", async () => {
    const indexDatei = join(paket, "apps", "web", "dist", "index.html");
    const sicherung = readFileSync(indexDatei, "utf8");
    expect(sicherung).toContain('name="klarwerk-island"');
    const ohneMarker = sicherung.replace(/\s*<meta name="klarwerk-island"[^>]*>/, "");
    expect(ohneMarker).not.toContain("klarwerk-island");
    const kalibrierPort = await freierPort();
    const kalibrierung = starteInsel(paket, kalibrierPort, {
      KLARWERK_SHARED_ROOT: leeresZielverzeichnis(),
    });
    try {
      const befund = await warteAufGesundheit(kalibrierung, 60_000);
      expect(
        befund.erreicht,
        `Start der Kalibrierung misslungen:\n${kalibrierung.ausgabe().slice(-4000)}`,
      ).toBe(true);
      // Erst NACH dem gesunden Start verstellen — sonst misst der Fall den Start und nicht den Marker.
      writeFileSync(indexDatei, ohneMarker, "utf8");
      const verstellt = await holeOberflaeche(kalibrierPort);
      expect(verstellt.code).toBe(200);
      expect(verstellt.markerImHtml, "der Marker steht noch da — dann prüft L4 ihn nicht").toBe("");
      // Und die Rücknahme wirkt am selben laufenden Prozess.
      writeFileSync(indexDatei, sicherung, "utf8");
      const zurueck = await holeOberflaeche(kalibrierPort);
      expect(zurueck.markerImHtml).toBe(String(bau?.marker));
    } finally {
      writeFileSync(indexDatei, sicherung, "utf8");
      await kalibrierung.beenden();
    }
    expect(readFileSync(indexDatei, "utf8")).toBe(sicherung);
  }, 300_000);

  // ==============================================================================================
  // B1 · JOB 4332 LIEFERUNG 4 — das Paket startet mit seinem EIGENEN Startbefehl.
  // ==============================================================================================
  //
  // DER FALL, UM DEN ES IN DIESEM AUFTRAG GEHT, und er misst genau eine Lage: den Start OHNE einen
  // einzigen testseitigen Zusatzwert. Bis JOB 4332 pinnte er hier den Abbruch („Serverstart
  // fehlgeschlagen … APP_BASE_URL, DATABASE_URL"); seit der Startbefehl beide Pflichten selbst
  // erfüllt, ist er der positive Nachweis. Fällt eine der zwei Zeilen aus `startBefehlText` wieder
  // weg, ist dieser Fall rot — mit dem fehlenden Namen in der zitierten Prozessausgabe.
  //
  // UND ER MISST DIE EHRLICHKEIT MIT: die laute Warnung des Speicherwächters
  // (`storage-guard.ts:88-93`) MUSS in der Prozessausgabe stehen. Ein Start, der sie los wäre,
  // wäre kein bestandener Fall, sondern ein Paket, das über seine Datenhaltung schweigt.
  it("B1 · ohne jeden Zusatzwert: /health 200 mit der Paketversion, Marker in der Oberfläche, Warnung laut", async () => {
    expect(paket, "kein Paket zum Starten — S0 ist rot").not.toBe("");
    const eigenPort = await freierPort();
    expect(await portBelegt(eigenPort), "auf dem Port antwortet schon etwas").toBe(false);
    const lauf = starteInsel(paket, eigenPort, { KLARWERK_SHARED_ROOT: leeresZielverzeichnis() });
    try {
      const befund = await warteAufGesundheit(lauf, GESUNDHEITSFRIST_MS);
      expect(
        befund.erreicht,
        `das Paket startete mit seinem eigenen start.command NICHT:\n${lauf.ausgabe().slice(-6000)}`,
      ).toBe(true);
      expect(befund.code).toBe(200);
      expect(befund.version).toBe(paketVersion(paket));
      // Die Oberfläche dieses Baus ist da, nicht irgendeine Antwort auf dem Port.
      const oberflaeche = await holeOberflaeche(eigenPort);
      expect(oberflaeche.code).toBe(200);
      expect(
        oberflaeche.markerImHtml,
        `kein Inselmarker im ausgelieferten HTML:\n${oberflaeche.html.slice(0, 800)}`,
      ).toBe(String(bau?.marker));

      // Die zwei Zeilen, die der Startbefehl selbst schreibt — sie nennen die Adresse, die in
      // Kennwort-Mails landet, und die Datenhaltung.
      expect(lauf.ausgabe()).toContain(
        `[start] Adresse (APP_BASE_URL): http://127.0.0.1:${eigenPort}`,
      );
      expect(lauf.ausgabe()).toContain("[start] Datenhaltung: Journal");
      // Die laute Warnung, wörtlich wie in `storage-guard.ts` — der Start ist NICHT durch ihr
      // Verschwinden erkauft.
      expect(lauf.ausgabe()).toContain(
        "KLARWERK WARN: NODE_ENV=production, KLARWERK_ALLOW_INMEMORY_PROD=1, kein DATABASE_URL → ",
      );
      expect(lauf.ausgabe()).toContain("NICHT prod-tauglich");
      // Und vom alten Befund ist nichts übrig.
      expect(lauf.ausgabe()).not.toContain("Serverstart fehlgeschlagen");
    } finally {
      await lauf.beenden();
    }
  }, 300_000);

  // ==============================================================================================
  // B2 · JOB 4332 LIEFERUNG 7 — der Vorgabewert ist eine Vorgabe und keine Setzung.
  // ==============================================================================================
  //
  // Der Betreiber, der seine Insel unter einem Namen erreichbar macht, muss die Adresse in den
  // Kennwort-Mails bestimmen können. `\${APP_BASE_URL:-…}` sagt das; dieser Fall misst es.
  it("B2 · ein von aussen gesetztes APP_BASE_URL gewinnt gegen den Vorgabewert aus dem PORT", async () => {
    expect(paket, "kein Paket zum Starten — S0 ist rot").not.toBe("");
    const eigenPort = await freierPort();
    const eigeneAdresse = "https://insel.beispiel.invalid";
    const lauf = starteInsel(paket, eigenPort, {
      KLARWERK_SHARED_ROOT: leeresZielverzeichnis(),
      APP_BASE_URL: eigeneAdresse,
    });
    try {
      const befund = await warteAufGesundheit(lauf, GESUNDHEITSFRIST_MS);
      expect(befund.erreicht, `Start misslungen:\n${lauf.ausgabe().slice(-6000)}`).toBe(true);
      expect(lauf.ausgabe()).toContain(`[start] Adresse (APP_BASE_URL): ${eigeneAdresse}`);
      // Und der Vorgabewert steht NICHT daneben — sonst wäre die Adresse zweimal beantwortet.
      expect(lauf.ausgabe()).not.toContain("[start] Adresse (APP_BASE_URL): http://127.0.0.1");
    } finally {
      await lauf.beenden();
    }
  }, 300_000);

  // ==============================================================================================
  // N1 · JOB 4332 LIEFERUNG 6 — der Bestand übersteht das Beenden und den zweiten Start.
  // ==============================================================================================
  //
  // WARUM DIESER FALL DAZUGEHÖRT: Der Startbefehl schaltet im Journalzweig die Persistenzausnahme
  // ein und behauptet damit, dass die Journaldatei die Datenhaltung trägt — genau das sagt auch die
  // Warnzeile des Wächters („übersteht Prozess-Neustarts"). Eine Zusage über einen Neustart ist ohne
  // einen gefahrenen Neustart nicht belegt. Gefahren wird deshalb die ganze Kette in EINEM Fall:
  // starten, einrichten, DOCX importieren, REGULÄR beenden (SIGTERM, kein Abschuss), mit DEMSELBEN
  // `KLARWERK_SHARED_ROOT` neu starten, frisch anmelden, denselben Entwurf über HTTP wieder lesen.
  it("N1 · nach regulärem Beenden und zweitem Start mit demselben SHARED_ROOT ist der Entwurf wieder lesbar", async () => {
    expect(paket, "kein Paket zum Starten — S0 ist rot").not.toBe("");
    const gemeinsam = leeresZielverzeichnis();
    const journal = join(gemeinsam, "data", "state.jsonl");

    const portEins = await freierPort();
    const ersterLauf = starteInsel(paket, portEins, { KLARWERK_SHARED_ROOT: gemeinsam });
    let entwurfId = "";
    try {
      const gesundEins = await warteAufGesundheit(ersterLauf, GESUNDHEITSFRIST_MS);
      expect(
        gesundEins.erreicht,
        `erster Start misslungen:\n${ersterLauf.ausgabe().slice(-6000)}`,
      ).toBe(true);
      expect(ersterLauf.ausgabe()).toContain(`[start] Datenhaltung: Journal (${journal})`);
      // Die Oberfläche gehört in DIESE Kette und nicht in einen Nachbarfall: der Auftrag verlangt
      // sie in EINEM Lauf mit Health, Import und Wiederlesen (Prüfpunkt 3).
      const oberflaeche = await holeOberflaeche(portEins);
      expect(oberflaeche.code).toBe(200);
      expect(
        oberflaeche.markerImHtml,
        `kein Inselmarker im ausgelieferten HTML:\n${oberflaeche.html.slice(0, 800)}`,
      ).toBe(String(bau?.marker));

      const konto = await richteEin(portEins);
      expect(konto.status, `Ersteinrichtung fehlgeschlagen: ${konto.text}`).toBe(201);
      const entwurf = await importiereDokument(portEins, konto.token);
      expect(entwurf.status, `Dokumentimport fehlgeschlagen: ${entwurf.text}`).toBe(201);
      expect(entwurf.id, `der Import nennt keine Entwurfskennung: ${entwurf.text}`).not.toBe("");
      entwurfId = entwurf.id;

      // VORHER-WERT, unabhängig geprüft: der Entwurf ist am LAUFENDEN Prozess über denselben
      // Leseweg da. Ohne das misst der Neustart den Unterschied zu nichts.
      const vorher = await liesEntwurf(portEins, konto.token, entwurfId);
      expect(vorher.status, `Entwurf vor dem Neustart nicht lesbar: ${vorher.text}`).toBe(200);
      expect(vorher.text).toContain(DOKUMENTSATZ);
      expect(existsSync(journal), "die Journaldatei fehlt").toBe(true);
      expect(statSync(journal).size, "das Journal ist leer geblieben").toBeGreaterThan(0);

      // REGULÄR beenden — SIGTERM an die Prozessgruppe, und der Prozess geht von selbst.
      const regulaer = await ersterLauf.beendeRegulaer(30_000);
      expect(
        regulaer,
        `der Prozess ging auf SIGTERM nicht von selbst:\n${ersterLauf.ausgabe().slice(-2000)}`,
      ).toBe(true);
      expect(ersterLauf.lebt()).toBe(false);
    } finally {
      await ersterLauf.beenden();
    }

    const portZwei = await freierPort();
    const zweiterLauf = starteInsel(paket, portZwei, { KLARWERK_SHARED_ROOT: gemeinsam });
    try {
      const gesundZwei = await warteAufGesundheit(zweiterLauf, GESUNDHEITSFRIST_MS);
      expect(
        gesundZwei.erreicht,
        `zweiter Start misslungen:\n${zweiterLauf.ausgabe().slice(-6000)}`,
      ).toBe(true);
      expect(gesundZwei.code).toBe(200);
      // Frische Anmeldung mit denselben Zugangsdaten: auch das Konto hat den Neustart überlebt.
      const angemeldet = await meldeAn(portZwei);
      expect(
        angemeldet.status,
        `Anmeldung nach dem Neustart fehlgeschlagen: ${angemeldet.text}`,
      ).toBe(200);
      expect(angemeldet.token).not.toBe("");
      const nachher = await liesEntwurf(portZwei, angemeldet.token, entwurfId);
      expect(nachher.status, `Entwurf nach dem Neustart nicht lesbar: ${nachher.text}`).toBe(200);
      expect(nachher.text).toContain(DOKUMENTSATZ);
    } finally {
      await zweiterLauf.beenden();
    }
    neustartAkte = { gemeinsam, journal, entwurfId };
  }, 600_000);

  // ==============================================================================================
  // N2 · KALIBRIERUNG (d) — es ist die Journaldatei, die den Bestand trägt.
  // ==============================================================================================
  //
  // Ohne diesen Fall belegte N1 nur, dass IRGENDETWAS den Neustart übersteht. Geleert wird deshalb
  // genau die Datei, die der Startbefehl benennt — und danach ist derselbe Bestand weg.
  it("N2 · GEGENPROBE: wird die Journaldatei vor dem Neustart geleert, ist Konto wie Entwurf verloren", async () => {
    expect(
      neustartAkte,
      "N1 ist nicht bis zum Bestand gekommen — dann misst diese Gegenprobe nichts",
    ).toBeDefined();
    const akte = neustartAkte as Neustartakte;
    const sicherung = readFileSync(akte.journal, "utf8");
    expect(sicherung.length, "ein leeres Journal kann nichts verlieren").toBeGreaterThan(0);
    writeFileSync(akte.journal, "", "utf8");

    const port = await freierPort();
    const lauf = starteInsel(paket, port, { KLARWERK_SHARED_ROOT: akte.gemeinsam });
    try {
      const gesund = await warteAufGesundheit(lauf, GESUNDHEITSFRIST_MS);
      expect(gesund.erreicht, `Start misslungen:\n${lauf.ausgabe().slice(-6000)}`).toBe(true);
      const angemeldet = await meldeAn(port);
      expect(
        angemeldet.status,
        "die Anmeldung gelang trotz geleertem Journal — dann trägt nicht das Journal den Bestand",
      ).not.toBe(200);
      // Die Instanz steht wieder in der Ersteinrichtung, und auch der frische Administrator findet
      // den Entwurf nicht mehr: es ist nicht die Berechtigung, die fehlt, sondern der Bestand.
      const neuesKonto = await richteEin(port);
      expect(neuesKonto.status, `Ersteinrichtung nicht wieder möglich: ${neuesKonto.text}`).toBe(
        201,
      );
      const entwurf = await liesEntwurf(port, neuesKonto.token, akte.entwurfId);
      expect(
        entwurf.status,
        `der Entwurf war nach dem geleerten Journal doch lesbar: ${entwurf.text}`,
      ).toBe(404);
    } finally {
      await lauf.beenden();
      writeFileSync(akte.journal, sicherung, "utf8");
    }
    // Zurückgenommen und nachgewiesen: die Journaldatei ist wieder die aus N1.
    expect(readFileSync(akte.journal, "utf8")).toBe(sicherung);
  }, 300_000);

  // ==============================================================================================
  // K3 · KALIBRIERUNG (c) — ohne den Schalter und ohne `zip` endet der Bau sprechend.
  // ==============================================================================================
  //
  // ER LÄUFT ZULETZT, weil jeder Baulauf `dist/insel/staging` abräumt (`build-current-release.mjs:76`)
  // — das Release der Fälle darüber liegt längst AUSSERHALB des Repos und bleibt davon unberührt.
  it("K3 · GEGENPROBE: ohne --ohne-verpackung und ohne auffindbares zip bricht der Bau mit einer sprechenden Zeile ab", () => {
    const ohneZip = pfadOhneZip();
    expect(
      ohneZip.fehlend,
      "Werkzeuge fehlen auf diesem Rechner — der Fall wäre nicht aussagekräftig",
    ).toEqual([]);
    expect(ohneZip.zipAufloesbar, "zip ist auf diesem PATH doch auffindbar").toBe(false);

    const lauf = baue([], { ...process.env, PATH: ohneZip.pfad });
    expect(lauf.status, "der Bau endete grün, obwohl kein Paket entstehen konnte").not.toBe(0);
    const meldung = `${lauf.stdout}${lauf.stderr}`;
    expect(meldung).toContain("Verpackung abgebrochen");
    expect(meldung).toContain('das Werkzeug „zip" ist auf diesem Rechner nicht auffindbar');
    expect(meldung).toContain("FERTIG GEBAUT ist das Release trotzdem");
    expect(meldung).toContain("--ohne-verpackung");
    // Nicht die nackte Werkzeugmeldung von früher.
    expect(meldung).not.toMatch(/^Error: spawnSync zip ENOENT$/m);

    // Und die Aussage der Meldung stimmt: das Release liegt da, das Paket nicht.
    const gebaut = /FERTIG GEBAUT ist das Release trotzdem — es liegt UNVERPACKT unter: (.+)/.exec(
      meldung,
    );
    expect(gebaut?.[1], "die Meldung nennt keinen Releasepfad").toBeDefined();
    const releaseDir = String(gebaut?.[1]).trim();
    expect(existsSync(join(releaseDir, "BUILD_INFO"))).toBe(true);
    expect(existsSync(join(releaseDir, FREMDQUELLE))).toBe(true);
    const nichtEntstanden = /NICHT ENTSTANDEN ist das Paket: (.+) wurde nicht geschrieben\./.exec(
      meldung,
    );
    expect(nichtEntstanden?.[1], "die Meldung nennt keinen Paketpfad").toBeDefined();
    expect(existsSync(String(nichtEntstanden?.[1]).trim())).toBe(false);
  }, 2_400_000);

  // ==============================================================================================
  // Die Ergebniszeile — das, was ein Mensch von diesem Auftrag ablesen soll.
  // ==============================================================================================
  it("E · die Ergebniszeile nennt Version, Port, Marker und die gemessene Laufzeit", () => {
    // SEKUNDEN UND NICHT MINUTEN: auf dem Prüfstand kostet der ganze Nachweis rund eine Viertel-
    // minute; in Minuten stünde überall „0.0" und die Angabe sähe aus wie ein Messfehler. Die
    // Summe steht zusätzlich in Minuten, weil Lieferung 7 danach fragt.
    const s = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;
    const summeMs = (webbuendel.dauerMs ?? 0) + (baulauf?.dauerMs ?? 0) + kopierMs + startMs;
    const zeile = [
      `Paket ${String(bau?.version)}`,
      `App-Version ${paketVersion(paket)}`,
      `Port ${port}`,
      `Marker "${String(bau?.marker)}"`,
      `/health ${gesund?.code} nach ${s(gesund?.wartezeitMs ?? 0)} (Frist ${GESUNDHEITSFRIST_MS / 1000} s)`,
      `Bau ${s(baulauf?.dauerMs ?? 0)} (npm ci inbegriffen)`,
      `Web-Bündel ${webbuendel.noetig ? `${s(webbuendel.dauerMs)} · ${webbuendel.befehl}` : webbuendel.befehl}`,
      `Kopie nach aussen ${s(kopierMs)}`,
      `Start bis gesund ${s(startMs)}`,
      `Summe ${s(summeMs)} = ${(summeMs / 60_000).toFixed(2)} min`,
    ].join(" · ");
    console.log(`ERGEBNISZEILE: ${zeile}`);
    expect(zeile).toContain("klarwerk-insel-");
    expect(zeile).toContain("KW-MAC-ISLAND-03");
    expect(gesund?.code).toBe(200);
    expect(summeMs).toBeGreaterThan(0);
  });
});
