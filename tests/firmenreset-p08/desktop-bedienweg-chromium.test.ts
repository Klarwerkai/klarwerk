// ================================================================================================
// PETER-20261011-P08 · DER ZUSAMMENHÄNGENDE DESKTOP-BEDIENWEG (Ben, Nacharbeit 4).
// ================================================================================================
//
// Bens Befund: die Journaltests bedienen `app.inject` und ersetzen den Prozessabschluss, die
// Oberflächentests ersetzen die Endpunkte — ein zusammenhängender Bedienweg folgt daraus nicht.
// Dieser Fall fährt ihn am Stück, ohne Ersatzteile im Produktweg:
//
//   · der ECHTE Serverprozess, gestartet wie die Desktop-App ihn startet (`server.ts` mit
//     `KLARWERK_DEV_PERSIST=1` und eigener `KLARWERK_DEV_PERSIST_FILE`, ohne `DATABASE_URL`); er
//     liefert die gebaute Oberfläche (`apps/web/dist`) und die API selbst aus;
//   · die ECHTE Oberfläche in Chromium, unmittelbar gegen diesen Server (kein Umleiten, kein Bearer):
//     Karte Werkseinstellungen → Vorschau → Haken → zwei Passwörter → Weiter → ABBRUCH;
//     dann derselbe Weg mit „Zurücksetzen & beenden";
//   · der ECHTE Prozessabschluss: der Server beendet sich nach dem Reset selbst (Exitcode 0);
//   · der ECHTE Neustart: ein neuer Prozess auf derselben Journaldatei; danach melden sich beide
//     Konten mit ihren Passwörtern an, das Firmenwörterbuch steht, die Wissensobjekte sind weg — und
//     die Karte zeigt das in der Oberfläche.
//
// AUSSCHLIESSLICH EIGENE, GEKENNZEICHNETE, FIKTIVE TESTFIRMA (P08-AC08): frisches Temp-Verzeichnis,
// erfundene Namen, `.invalid`-Adressen. Keine Datenbank, kein Modell, keine Produktion.
//
// Grenzen, ausdrücklich: das native Fenster der Desktop-Hülle wird nicht gestartet — gemessen wird der
// Serverprozess, den sie startet, und die Oberfläche, die sie anzeigt. Die Anmeldung selbst geschieht
// im Browser über den Anmeldeaufruf (setzt das echte Sitzungscookie); der Reset ist vollständig über
// die Bedienelemente der Karte bedient. `apps/web/dist` muss gebaut sein (im Tor läuft `./tools/build`
// davor); fehlt es, wird der Fall laut rot statt still übersprungen.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FIRMENRESET_ZEILE, readJournalLines } from "../../services/app/src/dev-persist";
import { DIST, fn, oeffneChromium } from "../design/h6-chromium";

const WURZEL = resolve(process.cwd());
const TESTFIRMA = "P08-Desktopfirma Klarwerk Probe GmbH (fiktiv)";
const ADMIN = {
  name: "Ada Admin (fiktiv)",
  email: "ada@p08-desktopfirma.invalid",
  password: "ada-geheim-123",
};
const KIM = {
  name: "Kim Kollegin (fiktiv)",
  email: "kim@p08-desktopfirma.invalid",
  password: "kim-geheim-123",
};

const bytes = (datei: string): string => (existsSync(datei) ? readFileSync(datei, "utf8") : "");

// Die Browserfunktionen der Bedienung — als Konstanten, damit jede Aufrufstelle kurz bleibt.
const DA_FN = fn("(s) => document.querySelector(s) !== null");
const AKTIV_FN = fn(`(id) => {
  const b = document.querySelector('[data-testid="' + id + '"]');
  return b !== null && !b.disabled;
}`);
const TIPPE_FN = fn(`([i, w]) => {
  const el = document.querySelectorAll('input[type="password"]')[i];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, w);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}`);
const ZAHLEN_FN = fn(`(b) => [...document.querySelectorAll('[data-vorschau="' + b + '"] li')]
  .map((li) => { const m = (li.textContent || '').match(/\\d+/); return m ? Number(m[0]) : -1; })`);
const ANMELDEN_FN = fn(`async ([email, password]) => {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.status;
}`);

/** Eine Antwort der echten API — als Daten gelesen, ohne Typbehauptung über den Inhalt. */
interface Antwort {
  status: number;
  json: unknown;
}

/** Ein Feld einer Antwort entlang eines Pfads; `undefined`, wenn es ihn nicht gibt. */
function feld(a: Antwort, ...pfad: string[]): unknown {
  let wert: unknown = a.json;
  for (const schluessel of pfad) {
    wert =
      typeof wert === "object" && wert !== null
        ? (wert as Record<string, unknown>)[schluessel]
        : undefined;
  }
  return wert;
}

async function freierPort(): Promise<number> {
  return new Promise((ok, fehler) => {
    const s = createServer();
    s.once("error", fehler);
    s.listen(0, "127.0.0.1", () => {
      const adresse = s.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      s.close(() => ok(port));
    });
  });
}

interface Server {
  basis: string;
  prozess: ChildProcess;
  ende: Promise<number | null>;
  log: string[];
}

/** Der Serverprozess der Desktop-App — dieselben Schalter, eigener Journalpfad, keine Datenbank. */
async function starteServer(journal: string): Promise<Server> {
  const port = await freierPort();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !["DATABASE_URL", "KLARWERK_PID_FILE", "COOKIE_SECURE"].includes(k)) {
      env[k] = v;
    }
  }
  Object.assign(env, {
    KLARWERK_DEV_PERSIST: "1",
    KLARWERK_DEV_PERSIST_FILE: journal,
    PORT: String(port),
    NODE_ENV: "development",
    KLARWERK_SKIP_KEYCHAIN: "1",
  });
  const prozess = spawn(join(WURZEL, "node_modules/.bin/tsx"), ["services/app/src/server.ts"], {
    cwd: WURZEL,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log: string[] = [];
  prozess.stdout?.on("data", (b: Buffer) => log.push(b.toString().slice(0, 400)));
  prozess.stderr?.on("data", (b: Buffer) => log.push(b.toString().slice(0, 400)));
  const ende = new Promise<number | null>((ok) => prozess.once("exit", (code) => ok(code)));
  const basis = `http://127.0.0.1:${port}`;
  const bis = Date.now() + 90_000;
  while (Date.now() < bis) {
    if (prozess.exitCode !== null) {
      throw new Error(`Server beendet vor Bereitschaft (${prozess.exitCode}): ${log.join("")}`);
    }
    try {
      const r = await fetch(`${basis}/api/auth/status`);
      if (r.ok) {
        return { basis, prozess, ende, log };
      }
    } catch {
      // noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  prozess.kill("SIGKILL");
  throw new Error(`Server nicht bereit: ${log.join("")}`);
}

async function api(
  s: Server,
  pfad: string,
  methode = "GET",
  body?: unknown,
  token?: string,
): Promise<Antwort> {
  const r = await fetch(`${s.basis}${pfad}`, {
    method: methode,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, json: text ? (JSON.parse(text) as unknown) : null };
}

const laufende: Server[] = [];
let browserSchliessen: (() => Promise<void>) | null = null;

afterAll(async () => {
  await browserSchliessen?.();
  for (const s of laufende) {
    if (s.prozess.exitCode === null) {
      s.prozess.kill("SIGKILL");
    }
  }
}, 30_000);

describe("P08 · der zusammenhängende Desktop-Bedienweg an einer eigenen fiktiven Desktopfirma", () => {
  it("Vorschau, Abbruch, Bestätigung, echter Prozessabschluss, Neustart — Konten und Wörterbuch bleiben", async () => {
    const gebaut = existsSync(join(DIST, "index.html"));
    expect(gebaut, "apps/web/dist fehlt — vorher ./tools/build").toBe(true);
    const journal = join(mkdtempSync(join(tmpdir(), "kw-p08-desktop-")), "state.jsonl");

    // ── 1. Erster Start: die eigene Testfirma entsteht über die echten Routen. ─────────────────
    const erster = await starteServer(journal);
    laufende.push(erster);
    const setup = await api(erster, "/api/auth/setup", "POST", ADMIN);
    expect(setup.status).toBe(201);
    const token = String(feld(setup, "token"));
    const kimKonto = { ...KIM, role: "controller" };
    const kimAnlage = await api(erster, "/api/users", "POST", kimKonto, token);
    expect(kimAnlage.status).toBeLessThan(300);
    for (const titel of ["Riemenwechsel Linie 4", "Schichtübergabe Halle 2"]) {
      const ko = await api(
        erster,
        "/api/kos",
        "POST",
        {
          confidentiality: "intern",
          title: `${TESTFIRMA}: ${titel}`,
          statement: "Fiktiver Testinhalt der eigenen Desktopfirma.",
          type: "best_practice",
          category: "Wartung",
          neededValidations: 1,
        },
        token,
      );
      expect(ko.status).toBeLessThan(300);
    }
    const begriff = await api(
      erster,
      "/api/begriffe",
      "POST",
      {
        geltungsbereich: `${TESTFIRMA} · Instandhaltung`,
        verantwortlich: "Qualitätsstelle (fiktiv)",
        definition: { de: "Antriebsriemen der fiktiven Linie 4." },
        bezeichnungen: { de: { vorzug: "Antriebsriemen", synonyme: [], unerwuenscht: [] } },
      },
      token,
    );
    expect(begriff.status).toBe(201);

    // ── 2. Die Oberfläche: anmelden, Karte Werkseinstellungen öffnen. ───────────────────────────
    const browser = await oeffneChromium();
    browserSchliessen = browser.schliessen;
    const { seite } = browser;
    const da = (sel: string, timeout = 30_000) => seite.waitForFunction(DA_FN, sel, { timeout });
    const zahlen = (bereich: string) => seite.evaluate<number[]>(ZAHLEN_FN, bereich);
    const klick = (testId: string) => seite.getByTestId(testId).click();

    async function anmeldenUndKarte(s: Server, konto: { email: string; password: string }) {
      await seite.goto(`${s.basis}/`, { waitUntil: "load", timeout: 60_000 });
      const status = await seite.evaluate<number>(ANMELDEN_FN, [konto.email, konto.password]);
      expect(status).toBe(200);
      await seite.goto(`${s.basis}/admin?bereich=system&detail=werk`, {
        waitUntil: "load",
        timeout: 60_000,
      });
      await da('[data-testid="firmenreset-start"]');
    }

    async function stufe1Ausfuellen() {
      await klick("firmenreset-start");
      await da('[data-testid="firmenreset-vorschau"]');
      await klick("firmenreset-bestaetigt");
      await seite.evaluate(TIPPE_FN, [0, ADMIN.password]);
      await seite.evaluate(TIPPE_FN, [1, ADMIN.password]);
      await seite.waitForFunction(AKTIV_FN, "firmenreset-weiter", { timeout: 15_000 });
      await klick("firmenreset-weiter");
      await da('[data-testid="firmenreset-ausfuehren"]');
    }

    await anmeldenUndKarte(erster, ADMIN);

    // ── 3. Vorschau: konkrete Mengen, und ein ABBRUCH an der letzten Stufe löscht nichts. ──────
    await klick("firmenreset-start");
    await da('[data-testid="firmenreset-vorschau"]');
    expect((await zahlen("entfernt"))[0], "Wissensobjekte in der Vorschau").toBe(2);
    const erhalten = await zahlen("erhalten");
    expect(erhalten.slice(0, 2), "Konten und Wörterbucheinträge in der Vorschau").toEqual([2, 1]);
    await klick("firmenreset-abbrechen");
    const vorAbbruch = bytes(journal);
    await stufe1Ausfuellen();
    await klick("firmenreset-warnung-abbrechen");
    await da('[data-testid="firmenreset-start"]');
    expect(bytes(journal), "Abbruch hat das Journal verändert").toBe(vorAbbruch);
    expect(erster.prozess.exitCode, "Abbruch hat den Prozess beendet").toBeNull();
    expect((await api(erster, "/api/kos", "GET", undefined, token)).json).toHaveLength(2);

    // ── 4. Bestätigung: der Reset läuft, der Prozess beendet sich SELBST. ──────────────────────
    await stufe1Ausfuellen();
    await klick("firmenreset-ausfuehren");
    await da('[data-testid="firmenreset-neustart"]', 15_000);
    const zeit = new Promise<"zeit">((ok) => setTimeout(() => ok("zeit"), 20_000));
    const exitcode = await Promise.race([erster.ende, zeit]);
    expect(exitcode, `Prozess nicht beendet: ${erster.log.join("").slice(-800)}`).toBe(0);
    const spur = readJournalLines(journal).filter(
      (l) => l.entry.repo === FIRMENRESET_ZEILE.repo && l.entry.method === FIRMENRESET_ZEILE.method,
    );
    expect(spur).toHaveLength(1);

    // ── 5. Neustart: neuer Prozess, dieselbe Journaldatei. ─────────────────────────────────────
    const zweiter = await starteServer(journal);
    laufende.push(zweiter);
    expect(feld(await api(zweiter, "/api/auth/status"), "needsSetup")).toBe(false);
    const ada = await api(zweiter, "/api/auth/login", "POST", {
      email: ADMIN.email,
      password: ADMIN.password,
    });
    expect(ada.status).toBe(200);
    expect(feld(ada, "user", "role")).toBe("admin");
    const kim = await api(zweiter, "/api/auth/login", "POST", {
      email: KIM.email,
      password: KIM.password,
    });
    expect(kim.status).toBe(200);
    expect(feld(kim, "user", "role")).toBe("controller");
    const neuToken = String(feld(ada, "token"));
    // Die alte Sitzung ist beendet; der Wissensbestand ist leer; das Wörterbuch steht.
    expect((await api(zweiter, "/api/kos", "GET", undefined, token)).status).toBe(401);
    expect((await api(zweiter, "/api/kos", "GET", undefined, neuToken)).json).toEqual([]);
    const katalog = await api(zweiter, "/api/begriffe", "GET", undefined, neuToken);
    const woerter = feld(katalog, "begriffe");
    expect(JSON.stringify(woerter)).toContain('"vorzug":"Antriebsriemen"');
    expect(Array.isArray(woerter) ? woerter.length : -1).toBe(1);

    // ── 6. Und die Oberfläche nach dem Neustart zeigt dasselbe. ────────────────────────────────
    await anmeldenUndKarte(zweiter, ADMIN);
    await klick("firmenreset-start");
    await da('[data-testid="firmenreset-vorschau"]');
    expect((await zahlen("entfernt"))[0]).toBe(0);
    expect((await zahlen("erhalten")).slice(0, 2)).toEqual([2, 1]);
    await klick("firmenreset-abbrechen");
  }, 300_000);
});
