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
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const KLON = "/Users/peterkohnert/klarwerk_arbeit/kw-pro-job2686-d3";
const SPUR = "/Users/peterkohnert/klarwerk_arbeit/kw-pro-job2686-d3-arbeit";
const BUENDEL = `${SPUR}/sso-server.bundle.cjs`;

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
let serverProzess: ReturnType<typeof spawn> | undefined;
let port = 0;

// Das Uebersetzen liegt im STARTER, nicht hier: esbuild prueft beim Laden
// `new TextEncoder().encode("") instanceof Uint8Array`, und jsdoms Encoder liefert ein
// `Uint8Array` aus einem anderen Realm — esbuild bricht dann mit „your JavaScript environment is
// broken" ab. Im Kindprozess (reines Node) gilt die Pruefung.
async function starteServer(szenario: string): Promise<void> {
  serverProzess = spawn(
    process.execPath,
    [`${KLON}/tests/helpers/job2686-sso-start.mjs`, szenario, BUENDEL],
    { cwd: KLON, env: { ...process.env, KLARWERK_SKIP_KEYCHAIN: "1" } },
  );
  let fehler = "";
  serverProzess.stderr?.on("data", (d: Buffer) => {
    fehler += String(d);
  });
  port = await new Promise<number>((fertig, scheitern) => {
    let puffer = "";
    const grenze = setTimeout(
      () => scheitern(new Error(`Server startete nicht. stderr: ${fehler.slice(0, 600)}`)),
      25000,
    );
    serverProzess?.stdout?.on("data", (d: Buffer) => {
      puffer += String(d);
      const treffer = /PORT=(\d+)/.exec(puffer);
      if (treffer) {
        clearTimeout(grenze);
        fertig(Number(treffer[1]));
      }
    });
  });
}

function haltServer(): void {
  serverProzess?.kill();
  serverProzess = undefined;
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

// ================================================================================================
describe("JOB 2686 · vom Klick bis zur Sitzung", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("de");
  }, 120000);

  afterEach(() => {
    abbauen();
    haltServer();
    kekse.clear();
    zugewiesen = [];
  });

  afterAll(() => {
    globalThis.fetch = echtesFetch;
  });

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

  it("K1 · ein Bestandskonto kommt herein — und sieht seine Rolle", async () => {
    await starteServer("bestandskonto");
    await klickeUndFolge();

    // Der Callback ist durch: die Anwendung geht in die Schale.
    expect(zugewiesen, "keine Weiterleitung in die Anwendung").toContain("/");
    abbauen();

    // 4 · Die Schale: die Sitzung kommt vom echten Server.
    setzeAdresse("/");
    await montiere();
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
  }, 60000);

  it("K2 · ein Angreifer bleibt draussen — und das Admin-Konto bleibt unberuehrt", async () => {
    await starteServer("angreifer");
    await klickeUndFolge();

    // KEINE Weiterleitung in die Anwendung; die Fehlerflaeche sagt, was ist.
    await warteAufText("SSO-Anmeldung fehlgeschlagen");
    expect(zugewiesen).not.toContain("/");

    // Und ohne Sitzung bleibt die Anwendung zu.
    const me = await globalThis.fetch("/api/auth/me");
    expect(me.status).toBe(401);
  }, 60000);

  it("K3 · wer herabgestuft wurde, sieht eine Betrachter-Sitzung und keine Admin-Nutzung", async () => {
    await starteServer("herabgestuft");
    await klickeUndFolge();
    expect(zugewiesen).toContain("/");
    abbauen();

    // 4 · Die Schale rendert die Rolle, die der Server vergeben hat.
    setzeAdresse("/");
    await montiere();

    // DAS IST DIE STELLE, AN DER DIE KETTE IHREN ZWECK HAT.
    await warteAufText("Betrachter");
    expect(container.textContent ?? "").not.toContain("Administrator");

    // Und der Server verweigert die Admin-Nutzung wirklich — nicht nur die Oberflaeche.
    const verweigert = await globalThis.fetch("/api/auth/users/u-erst/approve", { method: "POST" });
    expect(verweigert.status).toBe(403);
  }, 60000);
});
