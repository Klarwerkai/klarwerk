// @vitest-environment jsdom
// ================================================================================================
// JOB 2686 D3 — VOM KLICK BIS ZUR SITZUNG, EINE KETTE
// ================================================================================================
//
// Pedis Frage: „Sehe ich nach dem SSO-Klick wirklich, was ich darf?"
//
// BEN an D2: *„zwischen realer Serverantwort und Clientabruf liegt ein handgebauter Mock; davor
// fehlt der `AuthScreens`-Klick und danach der konkrete Renderer, der Viewer sichtbar macht
// beziehungsweise Admin-Nutzung verweigert."* — *„Zwei richtige Tests mit einem Mock dazwischen
// sind nicht eine Kette."*
//
// ------------------------------------------------------------------------------------------------
// KEIN MOCK ZWISCHEN KLICK UND ANTWORT. Die Kette laeuft ueber eine ECHTE HTTP-Grenze:
//
//   gemountetes App  →  Klick auf „Mit SSO anmelden"  →  GET /api/auth/oidc/start
//     →  ECHTER Fastify-Prozess (eigener node-Prozess, eigener Port)
//     →  Flusscookies, Umleitung zum Anbieter
//   Anbieter schickt zurueck  →  /sso/callback?code=&state=  →  App zeigt SsoCallback
//     →  POST /api/auth/oidc  →  ECHTER AuthService entscheidet  →  Sitzungscookie
//   App neu  →  GET /api/auth/me  →  Rolle  →  Sidebar zeigt, was der Mensch darf
//
// WARUM EIN EIGENER PROZESS: Der Waechter `tests/capture/draft-limits-shared.test.ts` verlangt
// „keine Datei unter apps/web/src importiert aus services/". Diese Datei tut das auch nicht — sie
// kennt nur einen Port. Der Server liegt in `tests/helpers/job2686-sso-server.ts` und laeuft
// eigenstaendig, so wie im Betrieb.
//
// WAS ERSETZT IST, einzeln benannt:
//   1. DER IDENTITAETSANBIETER. Er laeuft nicht im Netz, sondern im Serverprozess. Er nimmt den
//      `nonce` entgegen und gibt ihn im SIGNIERTEN Token zurueck; der Produktcode prueft Signatur,
//      Aussteller, Audience und Nonce wirklich.
//   2. DIE BROWSERSCHALE um `fetch`: Basisadresse und Cookiespeicher. Ein Browser bringt beides
//      mit, Node nicht. Das ist Transport, keine Antwort — der Server antwortet selbst.
//   3. `../api/endpoints` — die FACHDATEN der Anwendung (Wissensobjekte, Konflikte, Hinweise).
//      Sie liegen nicht auf dem Weg vom Klick zur Sitzung; ohne sie startet die Schale nicht.
//      `../api/auth` ist AUSDRUECKLICH NICHT ersetzt.
// ------------------------------------------------------------------------------------------------
//
//   K1  Bestandskonto, Anbieter ohne `email_verified` → kommt herein, Rolle sichtbar.
//   K2  Angreifer mit unverifizierter `admin@…`-Adresse → bleibt draussen, Admin-Konto unberuehrt.
//   K3  Im Anbieter herabgestuft → BETRACHTER-Sitzung sichtbar, Admin-Nutzung verweigert.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// ================================================================================================
// JOB 2707 D1 — DIE HORCHPROBE: dieselbe wie in JOB 2622, aus demselben Grund
// ================================================================================================
//
// DER BEFUND (PRO4 in 2701 D1): Diese drei Faelle standen im Tor rot mit
// „Serverstart gescheitert: listen EPERM 127.0.0.1" — sie starten einen ECHTEN Server, und in
// Bahn-Sitzungen ohne Horchrecht gibt es dafuer keinen Port. Elf andere Faelle im Haus haben
// denselben Grund und seit JOB 2622 einen Schalter; diese drei hatten keinen.
//
// WARUM KEIN PAUSCHALES `skip`: Diese Faelle pruefen die Kette vom SSO-Klick bis zur sichtbaren
// Sitzung — die Auflage, an der 2686 zweimal gescheitert ist. Sie sollen laufen, sobald ein Port
// da ist. `skipIf` sagt WARUM sie ruhen und laesst sie anderswo wieder anlaufen; `skip` wuerde sie
// still fuer immer stilllegen.
//
// Die Probe ist dieselbe wie in `tests/app/job2622-sandbox-skips.test.ts`: ein echter
// `listen`-Versuch auf einem freien Port, kein Raten an Umgebungsvariablen.
const KANN_HORCHEN = await new Promise<boolean>((fertig) => {
  const probe = createServer();
  probe.on("error", () => fertig(false));
  probe.listen(0, "127.0.0.1", () => probe.close(() => fertig(true)));
});

// ================================================================================================
// REPARATUR 25.09.2026 (Pedi-Entscheidung „a"): KEIN PFAD AUSSERHALB DES CHECKOUTS.
// ================================================================================================
//
// DER BEFUND (Tor-Selbstprüfung auf dem Linux-Testserver g4): `KLON` und `SPUR` zeigten fest auf
// einen alten Mac-Arbeitsordner (`/Users/peterkohnert/klarwerk_arbeit/kw-pro-job2686-d3…`). Der
// Starter wurde von dort gestartet — auf jedem anderen Rechner `spawn … ENOENT`, K1–K3 rot ohne
// fachlichen Grund; auf dem Mac nur grün, weil der alte Ordner zufällig noch existierte.
//
// JETZT: Starter und Server liegen im Checkout selbst (`tests/helpers/job2686-sso-start.mjs`,
// `job2686-sso-server.ts`); die Wurzel wird aus der Lage dieser Datei berechnet
// (apps/web/src/auth → vier Ebenen hoch; `__dirname` stellt vite-node bereit — `import.meta.url`
// ist unter jsdom KEINE file:-Adresse). Der Starter bündelt den Server bei jedem Start neu
// (esbuild, siehe dort) in einen Wegwerfordner unter dem System-Tmp — das ist kein Eingang von
// aussen, sondern Ausgabe dieses Laufs. Der Ordner entsteht ERST beim ersten tatsächlichen
// Serverstart (nicht beim Laden der Datei: ruhen alle Fälle, läuft kein afterAll, und es darf
// nichts zurückbleiben — Ben B1) und wird in `afterAll` entfernt.
//
// Fehlt der Starter (fremder Checkout ohne tests/helpers), RUHT der Fall sichtbar mit Grund, so wie
// ohne Horchrecht — kein stilles Grün, keine abgeschwächte Fachaussage.
const KLON = resolve(__dirname, "..", "..", "..", "..");
const STARTER = join(KLON, "tests", "helpers", "job2686-sso-start.mjs");
const STARTER_DA = existsSync(STARTER);
const KANN_LAUFEN = KANN_HORCHEN && STARTER_DA;
const RUHEGRUND =
  "ruht ohne Horchrecht oder ohne Starter tests/helpers/job2686-sso-start.mjs: der Fall startet einen echten Server aus dem Checkout";
let SPUR: string | undefined;

/** Wegwerfordner für das Serverbündel — angelegt beim ersten Serverstart, entfernt in `afterAll`. */
function buendelPfad(): string {
  SPUR ??= mkdtempSync(join(tmpdir(), "klarwerk-job2686-sso-"));
  return join(SPUR, "sso-server.bundle.cjs");
}

// --- (3) die ersetzten Fachdaten -----------------------------------------------------------------
vi.mock("../api/endpoints", () => ({
  endpoints: {
    features: { get: () => Promise.resolve({ features: {} }) },
    ko: { list: () => Promise.resolve([]) },
    analytics: { overview: () => Promise.resolve({ total: 0, byStatus: {} }) },
    conflicts: { list: () => Promise.resolve([]) },
    duplicates: { list: () => Promise.resolve([]) },
    validation: { board: () => Promise.resolve([]) },
    lifecycle: { pending: () => Promise.resolve([]) },
    learningPaths: { byRole: () => Promise.resolve(null), progress: () => Promise.resolve([]) },
    livewall: { get: () => Promise.resolve({ fresh: [], helped: [], helpedToday: 0 }) },
    notifications: {
      list: () => Promise.resolve([]),
      markSeen: () => Promise.resolve({ unseenCount: 0 }),
    },
    reasoner: {
      status: () => Promise.resolve({ active: false, mode: "deterministic" }),
      config: () => Promise.resolve({}),
    },
    external: { policy: () => Promise.resolve(null) },
    help: { explain: () => Promise.resolve({}) },
    gaps: {
      list: () => Promise.resolve([]),
      summary: () => Promise.resolve({ open: 0, byPriority: {} }),
    },
    directory: { list: () => Promise.resolve([]) },
  },
}));

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { act, createElement } = await import("react");
const { createRoot } = await import("react-dom/client");
const { MemoryRouter } = await import("react-router-dom");
const { default: App } = await import("../App");
const { default: i18n } = await import("../i18n");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ================================================================================== der Server
//
// FASSUNG 4 (Ben, Prüfung vor dem Push): Die Serververwaltung ist ein kleiner Zustandsautomat, damit die
// Fehlerwege der Bereinigung geschlossen sind — kein Zustand geht verloren, kein Verweis wird überschrieben:
//   kein          → starteServer  → laeuft
//   laeuft        → haltServer    → bereinigung → kein (Ende bestätigt) | gescheitert (Ende blieb aus, PID)
//   bereinigung   → jeder weitere Start/Halt wirft (nebenläufige Bereinigung)
//   gescheitert   → jeder weitere Start/Halt wirft mit der PID (kein stilles Weiterlaufen, kein Überschreiben)
// Zeitbudgets: TERM 5 s, dann KILL 10 s (= 15 s); jeder Hook dieser Datei bekommt 30 s, also mehr als die Summe
// der internen Fristen, damit der PID-Fehler die Hook-Zeitgrenze nie verdeckt.
type ServerLage =
  | { art: "kein" }
  | { art: "laeuft"; prozess: ReturnType<typeof spawn> }
  | { art: "bereinigung"; prozess: ReturnType<typeof spawn> }
  | { art: "gescheitert"; pid: number | undefined };
let server: ServerLage = { art: "kein" };
let port = 0;
const TERM_FRIST_MS = 5000;
const KILL_FRIST_MS = 10000;
const HOOK_BUDGET_MS = 30000; // > TERM_FRIST_MS + KILL_FRIST_MS

function lageText(): string {
  switch (server.art) {
    case "kein":
      return "kein Prozess";
    case "laeuft":
      return `läuft (PID ${server.prozess.pid})`;
    case "bereinigung":
      return `Bereinigung läuft (PID ${server.prozess.pid})`;
    case "gescheitert":
      return `Bereinigung gescheitert (PID ${server.pid})`;
  }
}

// Das Uebersetzen liegt im STARTER, nicht hier: esbuild prueft beim Laden
// `new TextEncoder().encode("") instanceof Uint8Array`, und jsdoms Encoder liefert ein
// `Uint8Array` aus einem anderen Realm — esbuild bricht dann mit „your JavaScript environment is
// broken" ab. Im Kindprozess (reines Node) gilt die Pruefung.
async function starteServer(szenario: string): Promise<void> {
  if (server.art !== "kein") {
    // V3-1: nie einen unbestätigt beendeten oder in Bereinigung befindlichen Prozess überschreiben.
    throw new Error(`Kein Serverstart: vorheriger SSO-Server ist nicht bereinigt — ${lageText()}`);
  }
  const prozess = spawn(process.execPath, [STARTER, szenario, buendelPfad()], {
    cwd: KLON,
    env: { ...process.env, KLARWERK_SKIP_KEYCHAIN: "1" },
  });
  server = { art: "laeuft", prozess };
  let fehler = "";
  prozess.stderr?.on("data", (d: Buffer) => {
    fehler += String(d);
  });
  try {
    port = await new Promise<number>((fertig, scheitern) => {
      let puffer = "";
      const grenze = setTimeout(
        () => scheitern(new Error(`Server startete nicht. stderr: ${fehler.slice(0, 600)}`)),
        25000,
      );
      // Ein Start, der sofort scheitert (kein node, Bündeln bricht ab, Prozess endet), meldet sich
      // hier unmittelbar — nicht erst nach 25 Sekunden.
      prozess.once("error", (e) => {
        clearTimeout(grenze);
        scheitern(
          new Error(`Server startete nicht: ${e.message}. stderr: ${fehler.slice(0, 600)}`),
        );
      });
      prozess.once("exit", (code, signal) => {
        clearTimeout(grenze);
        scheitern(
          new Error(
            `Server endete vor PORT= (Exit ${code}, Signal ${signal}). stderr: ${fehler.slice(0, 600)}`,
          ),
        );
      });
      prozess.stdout?.on("data", (d: Buffer) => {
        puffer += String(d);
        const treffer = /PORT=(\d+)/.exec(puffer);
        if (treffer) {
          clearTimeout(grenze);
          fertig(Number(treffer[1]));
        }
      });
    });
  } catch (e) {
    await haltServer();
    throw e;
  }
}

function warte(ms: number): Promise<false> {
  return new Promise((fertig) => {
    const t = setTimeout(() => fertig(false), ms);
    t.unref?.();
  });
}

/**
 * Beendet den Serverprozess und WARTET auf sein tatsächliches Ende: ein Kill-Signal ohne Warten
 * belegt keine Bereinigung, und ein Ablauf der Wartezeit ist KEIN Erfolg. Erst TERM, dann KILL;
 * kommt das `exit`-Ereignis auch danach nicht, geht die Lage nach „gescheitert" (mit PID) und die
 * Bereinigung wirft sichtbar — jeder spätere Start oder Halt wirft dann ebenfalls.
 */
async function haltServer(): Promise<void> {
  if (server.art === "kein") {
    return;
  }
  if (server.art === "bereinigung") {
    throw new Error(`Bereinigung läuft bereits — ${lageText()}`);
  }
  if (server.art === "gescheitert") {
    throw new Error(`SSO-Server nicht bereinigt — ${lageText()}`);
  }
  const prozess = server.prozess;
  if (prozess.exitCode !== null || prozess.signalCode !== null) {
    server = { art: "kein" };
    return;
  }
  server = { art: "bereinigung", prozess };
  const ende = new Promise<true>((fertig) => prozess.once("exit", () => fertig(true)));
  prozess.kill("SIGTERM");
  let beendet = await Promise.race([ende, warte(TERM_FRIST_MS)]);
  if (!beendet) {
    prozess.kill("SIGKILL");
    beendet = await Promise.race([ende, warte(KILL_FRIST_MS)]);
  }
  if (!beendet) {
    server = { art: "gescheitert", pid: prozess.pid };
    throw new Error(
      `SSO-Serverprozess ${prozess.pid} endete nicht innerhalb von ${(TERM_FRIST_MS + KILL_FRIST_MS) / 1000} s nach TERM und KILL — Bereinigung nicht belegt`,
    );
  }
  server = { art: "kein" };
}

// ============================================ (2) die Browserschale um fetch: Basis + Cookies
const kekse = new Map<string, string>();

function keksKopf(): string {
  return [...kekse.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function nimmKekse(antwort: Response): void {
  // `getSetCookie` liefert die Kopfzeilen einzeln — ein Browser wertet jede fuer sich aus.
  for (const zeile of antwort.headers.getSetCookie?.() ?? []) {
    const [paar] = zeile.split(";");
    const trenner = paar?.indexOf("=") ?? -1;
    if (trenner > 0 && paar) {
      const name = paar.slice(0, trenner).trim();
      const wert = paar.slice(trenner + 1).trim();
      if (wert === "") {
        kekse.delete(name);
      } else {
        kekse.set(name, wert);
      }
    }
  }
}

const echtesFetch = globalThis.fetch;

function installiereTransport(): void {
  globalThis.fetch = (async (eingabe: RequestInfo | URL, init?: RequestInit) => {
    const pfad = typeof eingabe === "string" ? eingabe : String(eingabe);
    const url = pfad.startsWith("http") ? pfad : `http://127.0.0.1:${port}${pfad}`;
    const kopf = new Headers(init?.headers);
    if (kekse.size > 0) {
      kopf.set("cookie", keksKopf());
    }
    const antwort = await echtesFetch(url, { ...init, headers: kopf, redirect: "manual" });
    nimmKekse(antwort);
    return antwort;
  }) as typeof fetch;
}

// ================================================================================== die Montage
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let zugewiesen: string[] = [];

function setzeAdresse(pfad: string, suche = ""): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href: `http://127.0.0.1${pfad}${suche}`,
      pathname: pfad,
      search: suche,
      origin: "http://127.0.0.1",
      assign: (ziel: string) => zugewiesen.push(ziel),
    },
  });
}

async function ruhen(runden = 25): Promise<void> {
  await act(async () => {
    for (let i = 0; i < runden; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

async function montiere(): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(App)),
      ),
    );
  });
  await ruhen();
}

function abbauen(): void {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
}

/**
 * JOB 3060 · H1: Name und Rolle der Sitzung stehen nicht mehr in einer Seitenleiste, sondern im
 * Konto-Menü des Kopfbands (shell/KontoMenue.tsx, Zeile „Name · Rolle"). Es öffnet sich am
 * Konto-Kreis; die Rolle kommt weiterhin aus `/api/auth/me`.
 */
async function kontoMenueOeffnen(): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const kreis = container.querySelector<HTMLButtonElement>('[data-testid="kopfband-konto"]');
    if (kreis) {
      await act(async () => {
        kreis.click();
      });
      await ruhen(5);
      return;
    }
    await ruhen(5);
  }
  throw new Error(
    `Der Konto-Kreis des Kopfbands erschien nicht. Sichtbar: "${(container.textContent ?? "").slice(0, 300)}"`,
  );
}

/** Sucht einen Knopf/Link an seinem sichtbaren Text. */
function findeText(text: string): Element | undefined {
  return [...container.querySelectorAll("button, a")].find((e) =>
    (e.textContent ?? "").includes(text),
  );
}

/**
 * Wartet gebunden, bis ein Text auf der Flaeche steht.
 *
 * Eine feste Rundenzahl waere hier eine Wette: hinter jeder Anzeige liegt eine ECHTE
 * HTTP-Anfrage an einen eigenen Prozess, und wie viele Ticks die braucht, ist nichts, was ein
 * Test raten sollte. Laeuft die Grenze ab, ist der Test rot — mit dem, was stattdessen dastand.
 */
async function warteAufText(text: string, runden = 80): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    if ((container.textContent ?? "").includes(text)) {
      return;
    }
    await ruhen(5);
  }
  throw new Error(
    `„${text}" erschien nicht. Sichtbar: "${(container.textContent ?? "").slice(0, 300)}"`,
  );
}

/**
 * JOB 3044 · NACHZUG — DIESELBE BEGRUENDUNG WIE OBEN, NUR FUER DIE WEITERLEITUNG.
 *
 * `warteAufText` sagt es schon: „Eine feste Rundenzahl waere hier eine Wette." Fuer die
 * WEITERLEITUNG stand diese Wette trotzdem im Test. Nach `montiere()` auf `/sso/callback` laeuft
 * `SsoCallback` den Austausch mit einem EIGENEN Serverprozess und weist erst danach `/` zu
 * (`SsoCallback.tsx:32`). `montiere()` wartet dafuer feste 25 Nullticks — auf einer unbelasteten
 * Maschine reicht das, im vollen Tor nicht. Gemessen am 04.09. um 23:56 im Gesamtlauf (1243
 * Dateien, `tests 1773s`): K3 fiel mit `expected [ '/api/auth/oidc/start' ] to include '/'`,
 * waehrend dieselbe Datei einzeln und unter mittlerer Last gruen durchlief.
 *
 * DIESE HILFE WIRFT ABSICHTLICH NICHT. Sie wartet nur gebunden; das URTEIL faellt weiter das
 * unveraenderte `expect` an der Aufrufstelle. So ist belegbar, dass hier eine Wartezeit gebunden
 * und KEINE Zusage aufgeweicht wurde: bleibt die Weiterleitung aus, ist der Fall so rot wie zuvor.
 */
async function warteAufZuweisung(ziel: string, runden = 80): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    if (zugewiesen.includes(ziel)) {
      return;
    }
    await ruhen(5);
  }
}

// ================================================================================================
describe("JOB 2686 · vom Klick bis zur Sitzung", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("de");
  }, 120000);

  afterEach(async () => {
    try {
      abbauen();
    } finally {
      // Der Server endet auch dann, wenn der Abbau der Oberfläche wirft; scheitert die Bereinigung,
      // wirft dieser Hook mit der PID (V2-1) — und der nächste Start ist gesperrt (V3-1).
      await haltServer();
      kekse.clear();
      zugewiesen = [];
    }
  }, HOOK_BUDGET_MS);

  afterAll(async () => {
    globalThis.fetch = echtesFetch;
    try {
      await haltServer();
    } finally {
      if (SPUR) {
        rmSync(SPUR, { recursive: true, force: true });
        SPUR = undefined;
      }
    }
  }, HOOK_BUDGET_MS);

  /**
   * DIE KETTE, einmal ausgeschrieben. Sie gibt zurueck, was der Mensch nach dem Klick sieht.
   *
   * Schritt 2 und 3 sind das, was der Browser von selbst tut: der Umleitung folgen und mit
   * `code` und `state` zurueckkommen. In jsdom gibt es keine Navigation, also wird sie hier
   * ausgefuehrt — mit denselben Cookies und demselben `state`, den der Server gesetzt hat.
   */
  async function klickeUndFolge(): Promise<{ statusCallback: number }> {
    installiereTransport();

    // 1 · Die Anmeldemaske steht, der Mensch klickt.
    setzeAdresse("/");
    await montiere();
    await warteAufText("Mit SSO anmelden");
    const knopf = findeText("SSO");
    expect(knopf, "der SSO-Knopf steht nicht auf der Anmeldemaske").toBeDefined();
    await act(async () => {
      (knopf as HTMLElement).click();
    });
    await ruhen(5);
    expect(zugewiesen, "der Klick fuehrt nicht zur Startroute").toContain("/api/auth/oidc/start");
    abbauen();

    // 2 · Der Browser folgt der Startroute: Flusscookies kommen, der Anbieter uebernimmt.
    const start = await globalThis.fetch("/api/auth/oidc/start");
    expect(start.status).toBe(302);
    const zumAnbieter = new URL(String(start.headers.get("location")));
    const state = zumAnbieter.searchParams.get("state") ?? "";
    expect(state, "die Startroute liefert keinen state").not.toBe("");

    // 3 · Der Anbieter schickt zurueck — mit `code` und demselben `state`.
    setzeAdresse("/sso/callback", `?code=der-code&state=${state}`);
    await montiere();

    return { statusCallback: 0 };
  }

  it.skipIf(!KANN_LAUFEN)(
    `K1 · ein Bestandskonto kommt herein — und sieht seine Rolle (${RUHEGRUND})`,
    async () => {
      await starteServer("bestandskonto");
      await klickeUndFolge();

      // Der Callback ist durch: die Anwendung geht in die Schale.
      await warteAufZuweisung("/");
      expect(zugewiesen, "keine Weiterleitung in die Anwendung").toContain("/");
      abbauen();

      // 4 · Die Schale: die Sitzung kommt vom echten Server — Name und Rolle im Konto-Menü.
      setzeAdresse("/");
      await montiere();
      await kontoMenueOeffnen();
      await warteAufText("Die Chefin");

      // KALIBRIERUNG DER ANZEIGE: Das Konto ist `controller`. Steht hier „Controller" und NICHT
      // „Betrachter", dann haengt die Anzeige wirklich an der Rolle aus der Sitzung — und K3 unten,
      // wo „Betrachter" erwartet wird, ist keine zufaellige Uebereinstimmung.
      const sichtbar = container.textContent ?? "";
      expect(sichtbar).toContain("Controller");
      expect(sichtbar).not.toContain("Betrachter");

      // Und die Verknuepfung ohne bestaetigte Adresse hat eine Spur hinterlassen.
      const protokoll = await globalThis.fetch("/pruefprotokoll");
      const { aktionen } = (await protokoll.json()) as { aktionen: string[] };
      expect(aktionen).toContain("user.oidc-linked-unverified");
      expect(aktionen).not.toContain("user.oidc-linked");
    },
    60000,
  );

  it.skipIf(!KANN_LAUFEN)(
    `K2 · ein Angreifer bleibt draussen — und das Admin-Konto bleibt unberuehrt (${RUHEGRUND})`,
    async () => {
      await starteServer("angreifer");
      await klickeUndFolge();

      // KEINE Weiterleitung in die Anwendung; die Fehlerflaeche sagt, was ist.
      await warteAufText("SSO-Anmeldung fehlgeschlagen");
      expect(zugewiesen).not.toContain("/");

      // Und ohne Sitzung bleibt die Anwendung zu.
      const me = await globalThis.fetch("/api/auth/me");
      expect(me.status).toBe(401);
    },
    60000,
  );

  it.skipIf(!KANN_LAUFEN)(
    `K3 · wer herabgestuft wurde, sieht eine Betrachter-Sitzung und keine Admin-Nutzung (${RUHEGRUND})`,
    async () => {
      await starteServer("herabgestuft");
      await klickeUndFolge();
      await warteAufZuweisung("/");
      expect(zugewiesen).toContain("/");
      abbauen();

      // 4 · Die Schale rendert die Rolle, die der Server vergeben hat — im Konto-Menü.
      setzeAdresse("/");
      await montiere();
      await kontoMenueOeffnen();

      // DAS IST DIE STELLE, AN DER DIE KETTE IHREN ZWECK HAT.
      await warteAufText("Betrachter");
      expect(container.textContent ?? "").not.toContain("Administrator");

      // Und der Server verweigert die Admin-Nutzung wirklich — nicht nur die Oberflaeche.
      const verweigert = await globalThis.fetch("/api/auth/users/u-erst/approve", {
        method: "POST",
      });
      expect(verweigert.status).toBe(403);
    },
    60000,
  );
});
