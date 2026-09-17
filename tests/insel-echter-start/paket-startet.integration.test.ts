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
// EIN BEFUND AUS DIESEM LAUF, der NICHT in den Diff gehört (Auftrag §10) — Fall B1 misst ihn
// ------------------------------------------------------------------------------------------------
//   Das Paket startet mit seinem eigenen `start.command` im Journalbetrieb NICHT: der Startbefehl
//   setzt `NODE_ENV=production` (`scripts/insel/release-texte.mjs:77`), und der Startvertrag
//   (`services/app/src/start-vertrag.ts:1017`) verlangt in Produktion `APP_BASE_URL` sowie
//   `DATABASE_URL` (Ausnahme `KLARWERK_ALLOW_INMEMORY_PROD=1`). Keiner der drei Werte wird vom
//   Startbefehl gesetzt. Beide Dateien liegen ausserhalb der Zielpfade dieses Auftrags; der Befund
//   wird deshalb GEMESSEN und benannt, nicht behoben. Alle übrigen Fälle starten das Paket mit
//   genau diesen zwei Werten und sagen das an jeder Stelle dazu.
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

/** Die zwei Werte, die der Startvertrag in Produktion verlangt und die `start.command` nicht setzt. */
function vertragswerte(fuerPort: number): Record<string, string> {
  return {
    APP_BASE_URL: `http://127.0.0.1:${fuerPort}`,
    KLARWERK_ALLOW_INMEMORY_PROD: "1",
  };
}

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
  start = starteInsel(paket, port, {
    KLARWERK_SHARED_ROOT: leeresZielverzeichnis(),
    ...vertragswerte(port),
  });
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
    const einrichtung = await fetch(`http://127.0.0.1:${port}/api/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Inselprobe",
        email: "inselprobe@example.invalid",
        password: "inselprobe-2026",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const einrichtungText = await einrichtung.text();
    expect(einrichtung.status, `Ersteinrichtung fehlgeschlagen: ${einrichtungText}`).toBe(201);
    const konto = JSON.parse(einrichtungText) as { token?: unknown; user?: { role?: unknown } };
    expect(typeof konto.token, `kein Sitzungsschlüssel: ${einrichtungText}`).toBe("string");
    expect(konto.user?.role).toBe("admin");

    const bytes = readFileSync(DOKUMENT);
    expect(bytes.byteLength).toBeGreaterThan(200);
    const antwort = await fetch(`http://127.0.0.1:${port}/api/drafts/from-docx`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${String(konto.token)}`,
      },
      body: JSON.stringify({ name: "inselprobe.docx", data: bytes.toString("base64") }),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await antwort.text();
    expect(antwort.status, `Dokumentimport fehlgeschlagen: ${text}`).toBe(201);
    const entwurf = JSON.parse(text) as { payload?: { bodyHtml?: unknown; statement?: unknown } };
    expect(String(entwurf.payload?.bodyHtml ?? "")).toContain(DOKUMENTSATZ);
    expect(String(entwurf.payload?.statement ?? "")).toContain(DOKUMENTSATZ);

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
      ...vertragswerte(kalibrierPort),
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
      ...vertragswerte(kalibrierPort),
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
  // B1 · DER BEFUND — das Paket startet mit seinem eigenen Startbefehl NICHT.
  // ==============================================================================================
  //
  // DIESER FALL PINNT EINEN FEHLER, UND ZWAR ABSICHTLICH. `start.command` setzt `NODE_ENV=production`
  // (`release-texte.mjs:77`) und lässt `APP_BASE_URL` und `DATABASE_URL` ungesetzt; der Startvertrag
  // weist genau das ab. Beide Dateien gehören nicht zu diesem Auftrag (§10), der Befund wird deshalb
  // gemessen statt behoben.
  //
  // WIRD ER BEHOBEN, GEHT DIESER FALL ROT — und das ist die Absicht: dann ist er auf den positiven
  // Nachweis umzustellen (Start OHNE Zusatzwerte, `/health` 200 mit der Paketversion), und der
  // Hinweis im Dateikopf entfällt.
  it("B1 · BEFUND: ohne APP_BASE_URL und ohne Persistenz-Ausnahme bricht der eigene Startbefehl ab", async () => {
    const befundPort = await freierPort();
    expect(await portBelegt(befundPort), "auf dem Port antwortet schon etwas").toBe(false);
    const lauf = starteInsel(paket, befundPort, {
      KLARWERK_SHARED_ROOT: leeresZielverzeichnis(),
    });
    try {
      const befund = await warteAufGesundheit(lauf, 45_000);
      expect(
        befund.erreicht,
        "das Paket startete doch — dann ist der Befund behoben (s. Kopfkommentar)",
      ).toBe(false);
      expect(lauf.ausgabe()).toContain("Serverstart fehlgeschlagen");
      expect(lauf.ausgabe()).toContain("APP_BASE_URL");
      expect(lauf.ausgabe()).toContain("DATABASE_URL");
      // Das Journal wurde vorher angelegt — der Startbefehl kam also bis zu seiner Datenentscheidung.
      expect(lauf.ausgabe()).toContain("Datenhaltung: Journal");
    } finally {
      await lauf.beenden();
    }
  }, 180_000);

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
