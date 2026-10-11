// ================================================================================================
// AUFNAHME 20260922 · BROWSER-KERNPRÜFUNG — WÄCHTER ÜBER DEN ENGINE-BERICHT DES SMOKE-LAUFS.
// ================================================================================================
//
// R-1382 verlangt: „der Durchlauf sagt, welche Browser er wirklich gefahren hat". Der Bericht
// (`tests-smoke/support/engine-bericht.ts`) stützt sich seit Nacharbeit 2 auf das STARTPROTOKOLL:
// gestartet ist eine Engine nur, wenn `launch()` einen Browser zurückgegeben hat. Bens Befund zur
// ersten Fassung war, dass drei Startfehler „alle drei Engines" ergeben hätten — E2 ist genau diese
// Gegenprobe. Ebenso belegt E7, dass der Bericht NICHT an der Reporterliste hängt, die der
// Prüfadapter mit `--reporter=line,json` ersetzt.
//
// Diese Datei startet keinen Browser: das Protokoll wird an einem nachgebauten `BrowserType`
// gemessen. Ob es am echten Prototyp greift, zeigt erst die Ausgabe eines `smoke:ui:gate`-Laufs.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import engineBerichtNachLauf, {
  ENGINE_LAUF_ENV,
  type StartEintrag,
  type StartfaehigerTyp,
  installiereStartprotokoll,
  leseStartprotokoll,
  schreibeStarteintrag,
  startBerichtText,
  startBilanz,
} from "../../tests-smoke/support/engine-bericht";

const WURZEL = resolve(__dirname, "../..");

function gestartet(engine: string, version: string): StartEintrag {
  return { engine, ok: true, version };
}

function startfehler(engine: string, fehler: string): StartEintrag {
  return { engine, ok: false, fehler };
}

/** Ein nachgebauter `BrowserType`: `launch()` gelingt oder wirft, je nach Engine. */
function baueTyp(scheitert: ReadonlySet<string>): {
  Typ: new (n: string) => StartfaehigerTyp;
  prototyp: StartfaehigerTyp;
} {
  class NachgebauterTyp {
    constructor(private readonly n: string) {}
    name(): string {
      return this.n;
    }
    async launch(): Promise<unknown> {
      if (scheitert.has(this.n)) {
        throw new Error(`browserType.launch: ${this.n} startet nicht\nZweite Zeile`);
      }
      return { version: () => `${this.n}-1.0` };
    }
  }
  return { Typ: NachgebauterTyp, prototyp: NachgebauterTyp.prototype };
}

const offen: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env[ENGINE_LAUF_ENV];
  for (const verzeichnis of offen.splice(0)) {
    rmSync(verzeichnis, { recursive: true, force: true });
  }
});

function frischesVerzeichnis(): string {
  const verzeichnis = mkdtempSync(join(tmpdir(), "engine-bericht-"));
  offen.push(verzeichnis);
  return verzeichnis;
}

describe("Engine-Bericht · Bilanz aus dem Startprotokoll", () => {
  it("E1 · ein Tor-Lauf nur in Chromium benennt Firefox und WebKit als nicht versucht", () => {
    const bilanz = startBilanz([gestartet("chromium", "140.0"), gestartet("chromium", "140.0")]);
    expect(bilanz.gestartet).toEqual([
      { engine: "chromium", starts: 2, versionen: ["140.0"], startfehler: [] },
    ]);
    expect(bilanz.nichtVersucht).toEqual(["firefox", "webkit"]);
    const text = startBerichtText(bilanz);
    expect(text).toContain("Browser gestartet:    chromium 140.0 (2 Starts)");
    expect(text).toContain("nicht versucht:       firefox; webkit");
    expect(text).toContain("belegt NICHT alle drei Engines");
    expect(text).not.toContain("Alle drei Engines");
  });

  it("E2 · BENS GEGENPROBE: drei Startfehler ergeben NIE „gestartet“ oder „alle drei“", () => {
    const bilanz = startBilanz([
      startfehler("chromium", "Target page, context or browser has been closed"),
      startfehler("firefox", "Cannot read properties of undefined (reading '_page')"),
      startfehler("webkit", "Zeitlimit 60000 ms"),
    ]);
    expect(bilanz.gestartet).toEqual([]);
    expect(bilanz.nurStartfehler.map((z) => z.engine)).toEqual(["chromium", "firefox", "webkit"]);
    const text = startBerichtText(bilanz);
    expect(text).toContain("Browser gestartet:    —");
    expect(text).toContain("nur Startfehler:      chromium; firefox; webkit");
    expect(text).toContain("webkit: Zeitlimit 60000 ms");
    expect(text).toContain("ein Startfehler ist kein Fahrnachweis");
    expect(text).not.toContain("Alle drei Engines");
  });

  it("E3 · nur wenn alle drei nachweislich starteten, sagt der Bericht „alle drei“", () => {
    const bilanz = startBilanz([
      gestartet("chromium", "140.0"),
      gestartet("firefox", "141.0"),
      startfehler("webkit", "erster Versuch scheiterte"),
      gestartet("webkit", "26.0"),
    ]);
    expect(bilanz.gestartet.map((z) => z.engine)).toEqual(["chromium", "firefox", "webkit"]);
    const text = startBerichtText(bilanz);
    expect(text).toContain("Alle drei Engines");
    // Auch neben einem gelungenen Start bleibt der gescheiterte sichtbar.
    expect(text).toContain("Startfehler:          webkit: erster Versuch scheiterte");
  });

  it("E4 · zwei Starts und ein Startfehler: nur die gestarteten zählen", () => {
    const bilanz = startBilanz([
      gestartet("chromium", "140.0"),
      gestartet("firefox", "141.0"),
      startfehler("webkit", "Zeitlimit"),
    ]);
    expect(bilanz.gestartet.map((z) => z.engine)).toEqual(["chromium", "firefox"]);
    expect(bilanz.nurStartfehler.map((z) => z.engine)).toEqual(["webkit"]);
    expect(startBerichtText(bilanz)).toContain("belegt NICHT alle drei Engines");
  });
});

describe("Engine-Bericht · Startprotokoll am BrowserType", () => {
  it("E5 · Start mit Version, Startfehler mit Meldung, Fehler unverändert", async () => {
    const { Typ, prototyp } = baueTyp(new Set(["webkit"]));
    const eintraege: StartEintrag[] = [];
    expect(installiereStartprotokoll(prototyp, (e) => eintraege.push(e))).toBe(true);
    // Zweites Installieren (die Konfiguration lädt in jedem Prozess) bleibt wirkungslos.
    expect(installiereStartprotokoll(prototyp, (e) => eintraege.push(e))).toBe(false);

    const browser = await new Typ("chromium").launch();
    expect((browser as { version(): string }).version()).toBe("chromium-1.0");
    // Der Fehler wird UNVERÄNDERT weitergeworfen — das Protokoll greift nicht in den Lauf ein.
    await expect(new Typ("webkit").launch()).rejects.toThrow("webkit startet nicht");

    expect(eintraege).toEqual([
      { engine: "chromium", ok: true, version: "chromium-1.0" },
      { engine: "webkit", ok: false, fehler: "browserType.launch: webkit startet nicht" },
    ]);
  });

  it("E6 · Prozessdateien und globaler Abbau: Druck und engine-bericht.txt", async () => {
    const verzeichnis = frischesVerzeichnis();
    schreibeStarteintrag(verzeichnis, gestartet("chromium", "140.0"));
    schreibeStarteintrag(verzeichnis, startfehler("firefox", "kein Seitenprozess"));
    expect(leseStartprotokoll(verzeichnis)).toHaveLength(2);

    process.env[ENGINE_LAUF_ENV] = verzeichnis;
    const ausgabe = vi.spyOn(console, "log").mockImplementation(() => {});
    await engineBerichtNachLauf();
    expect(ausgabe).toHaveBeenCalledTimes(1);
    const gedruckt = String(ausgabe.mock.calls[0]?.[0]);
    expect(gedruckt).toContain("Browser gestartet:    chromium 140.0 (1 Start)");
    expect(gedruckt).toContain("nur Startfehler:      firefox");
    expect(gedruckt).toContain("nicht versucht:       webkit");
    const datei = readFileSync(join(verzeichnis, "engine-bericht.txt"), "utf8");
    expect(datei.trim()).toBe(gedruckt.trim());
  });

  it("E7 · die Konfiguration bindet den Bericht an Abbau und Start, nicht an die Reporter", () => {
    const konfig = readFileSync(resolve(WURZEL, "playwright.smoke.config.ts"), "utf8");
    expect(konfig).toContain('globalTeardown: "./tests-smoke/support/engine-bericht.ts",');
    expect(konfig).toMatch(/^installiereStartprotokoll\(Object\.getPrototypeOf\(chromium\),/m);
    // Die Reporterliste trägt den Bericht NICHT mehr: sie wird von `--reporter=…` ersetzt.
    const reporter = /^\s*reporter:\s*(\[.*\]),\s*$/m.exec(konfig)?.[1] ?? "";
    expect(reporter).toBe('[["list"]]');
  });
});
