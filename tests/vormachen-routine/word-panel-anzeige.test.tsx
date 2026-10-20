// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:peter-p06 · LERNANZEIGE MIT SOFORTIGER PAUSE IM WORD-PANEL (Block KW-VORMACHEN).
// ================================================================================================
//
// WAS HIER LÄUFT: die ausgelieferte Datei `apps/web/public/word-addin/vormachen.js`, unverändert, in
// einem jsdom-Fenster mit den Globalen des Panels (`lang`, `signedIn`). Ihre Abrufe gehen über einen
// `fetch`-Ersatz an den ECHTEN Server (`buildApp(buildServices())`, `app.inject`) mit derselben
// Anmeldesitzung, mit der auch die Word-Arbeitswege des Tests laufen — so, wie Panel und Taskpane
// im selben Fenster dieselbe Sitzung teilen. Fiktive Daten, kein Modell, kein laufendes Word.
// (`.tsx` wie die übrigen DOM-Prüfungen: `tsconfig.tests-tsx.json` trägt die DOM-Typen.)
//
//   W1  Ohne Lernsitzung bleibt die Anzeige verborgen; eine Word-Übernahme wird nirgends notiert.
//   W2  Läuft eine Word-Lernsitzung, zeigt das Panel „Lernt mit" mit „Pause"; erst seine
//       Sichtbarkeitsmeldung (`?anzeige=word`) lässt den Server die Word-Übernahme mitschreiben.
//   W3  „Pause" im Panel wirkt sofort am Server: die nächste Word-Übernahme wird nicht notiert;
//       „Fortsetzen" stellt das Mitschreiben wieder her.
//   W4  Ein verborgenes Panel meldet keine Sichtbarkeit.
//   W5  Vor dem ersten Blick (2 s nach dem Laden) fragt der Block nichts — der Zeitpunkt hängt so
//       nicht vom Ladeweg des Fensters ab (`tests/klara-zerlegung/probeschnitt.test.ts`, D2/D5/D7).
import { readFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { repoPfad } from "../support/repoPfad";

const QUELLE = readFileSync(repoPfad("apps/web/public/word-addin/vormachen.js"), "utf8");
/** `VORMACHEN_START_MS` in `vormachen.js`. */
const ERSTER_BLICK_MS = 2000;
const ADA = { name: "Ada Fiktiv", email: "ada@word-vormachen.test", password: "ada-geheim-1" };
const WORD = "http://localhost/word-addin/taskpane.html";
const ENTWURF = {
  title: "Angebot Musterfirma",
  statement: "Angebot vor Versand fachlich prüfen.",
  type: "best_practice",
  category: "Vertrieb",
  confidentiality: "intern",
  bodyHtml: "<p>Angebotsnotiz mit fiktiven Werten.</p>",
  origin: "word_addin",
};

let app: FastifyInstance | null = null;
let cookie = "";
const abrufe: string[] = [];
let vorherigerFetch: typeof globalThis.fetch;

async function draht(
  methode: "GET" | "POST",
  url: string,
  payload?: Record<string, unknown>,
  herkunft?: string,
): Promise<{ status: number; body: unknown }> {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: { cookie, ...(herkunft ? { referer: herkunft } : {}) },
    ...(payload ? { payload } : {}),
  });
  return { status: r.statusCode, body: r.body === "" ? null : r.json() };
}

interface Sitzung {
  id: string;
  zustand: string;
  beobachtet: number;
  nichtAufgenommen: { unsichtbar: number; pausiert: number };
}

async function sitzung(): Promise<Sitzung | undefined> {
  const r = await draht("GET", "/api/me/vormachen");
  return (r.body as { sitzungen: Sitzung[] }).sitzungen[0];
}

/** Die vorhandene Word-Übernahme „Auswahl als Entwurf" — wie das Taskpane sie sendet. */
async function wordUebernahme(titel: string): Promise<void> {
  const r = await draht("POST", "/api/drafts", { ...ENTWURF, title: titel }, WORD);
  expect(r.status).toBe(201);
}

/** Wartet echte I/O-Runden ab (die Zeitgeber des Panels sind gestellt). */
async function ruhe(runden = 40): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await new Promise((r) => setImmediate(r));
  }
}

const anzeige = (): HTMLElement | null => document.getElementById("kw-vormachen");
const knopf = (): HTMLButtonElement | null =>
  document.getElementById("kw-vormachen-pause") as HTMLButtonElement | null;
const sichtbar = (): boolean => anzeige()?.style.display === "flex";

/** Lädt die ausgelieferte Datei wie das Panel: als Skript im Fenster mit dessen Globalen. */
async function panelLaden(): Promise<void> {
  Object.assign(globalThis, { lang: "de", signedIn: true });
  new Function(QUELLE)();
  await ruhe();
}

/** Laden und den ersten Blick abwarten. */
async function panelStarten(): Promise<void> {
  await panelLaden();
  vi.advanceTimersByTime(ERSTER_BLICK_MS);
  await ruhe();
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  document.body.innerHTML = "";
  abrufe.length = 0;
  const services = buildServices();
  services.aiCheckWorker = {
    enqueue: () => undefined,
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
  app = buildApp(services);
  await app.ready();
  const registriert = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(registriert.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    abrufe.push(`${methode} ${url}`);
    const kopf: Record<string, string> = { cookie };
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    const antwort = await (app as FastifyInstance).inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      json: async () => antwort.json(),
    };
  }) as unknown as typeof globalThis.fetch;
});

afterEach(async () => {
  globalThis.fetch = vorherigerFetch;
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
  await app?.close();
  app = null;
});

describe("P06-AC02 · Lernanzeige mit sofortiger Pause im Word-Panel", () => {
  it("W1 · ohne Lernsitzung verborgen; eine Word-Übernahme wird nirgends notiert", async () => {
    await panelStarten();
    expect(anzeige()).not.toBeNull();
    expect(sichtbar()).toBe(false);
    expect(abrufe).toContain("GET /api/me/vormachen?anzeige=word");
    await wordUebernahme("Ohne Lernsitzung");
    expect(await sitzung()).toBeUndefined();
  });

  it("W2 · zeigt „Lernt mit“ samt Pause; erst die Meldung des Panels lässt Word mitschreiben", async () => {
    const start = await draht("POST", "/api/me/vormachen", {
      host: "word",
      vorgaenge: ["word_auswahl_uebernehmen"],
      zweck: "Angebotstext aus Word übernehmen",
    });
    expect(start.status).toBe(201);
    // Noch kein Panel offen: die Übernahme wird nicht notiert, nur als „nicht sichtbar" gezählt.
    await wordUebernahme("Vor dem Panel");
    expect(await sitzung()).toMatchObject({ beobachtet: 0, nichtAufgenommen: { unsichtbar: 1 } });

    await panelStarten();
    expect(sichtbar()).toBe(true);
    expect(anzeige()?.getAttribute("data-zustand")).toBe("lernt");
    expect(anzeige()?.textContent).toContain("Lernt mit – 0 Schritte mitgeschrieben");
    expect(knopf()?.textContent).toBe("Pause");

    await wordUebernahme("Mit Panel");
    expect((await sitzung())?.beobachtet).toBe(1);
    // Der nächste Puls (20 s) meldet erneut und zeigt die neue Zahl.
    vi.advanceTimersByTime(20_000);
    await ruhe();
    expect(anzeige()?.textContent).toContain("Lernt mit – 1 Schritte mitgeschrieben");
  });

  it("W3 · Pause im Panel wirkt sofort; Fortsetzen stellt das Mitschreiben wieder her", async () => {
    await draht("POST", "/api/me/vormachen", {
      host: "word",
      vorgaenge: ["word_auswahl_uebernehmen"],
      zweck: "Angebotstext aus Word übernehmen",
    });
    await panelStarten();
    knopf()?.click();
    await ruhe();
    expect(abrufe.some((a) => /^PUT \/api\/me\/vormachen\/[^/]+\/zustand$/.test(a))).toBe(true);
    expect((await sitzung())?.zustand).toBe("pausiert");
    expect(anzeige()?.getAttribute("data-zustand")).toBe("pausiert");
    expect(anzeige()?.textContent).toContain("Pausiert – es wird nichts mitgeschrieben");
    expect(knopf()?.textContent).toBe("Fortsetzen");

    await wordUebernahme("Während der Pause");
    expect(await sitzung()).toMatchObject({ beobachtet: 0, nichtAufgenommen: { pausiert: 1 } });

    knopf()?.click();
    await ruhe();
    expect((await sitzung())?.zustand).toBe("lernt");
    await wordUebernahme("Nach der Pause");
    expect((await sitzung())?.beobachtet).toBe(1);
  });

  it("W4 · ein verborgenes Panel meldet keine Sichtbarkeit — Word schreibt dann nicht mit", async () => {
    await draht("POST", "/api/me/vormachen", {
      host: "word",
      vorgaenge: ["word_auswahl_uebernehmen"],
      zweck: "Angebotstext aus Word übernehmen",
    });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    await panelStarten();
    expect(abrufe).toContain("GET /api/me/vormachen");
    expect(abrufe).not.toContain("GET /api/me/vormachen?anzeige=word");
    await wordUebernahme("Panel verborgen");
    expect(await sitzung()).toMatchObject({ beobachtet: 0, nichtAufgenommen: { unsichtbar: 1 } });
  });

  it("W5 · vor dem ersten Blick fragt der Block nichts; danach genau einmal", async () => {
    await panelLaden();
    expect(abrufe).toEqual([]);
    vi.advanceTimersByTime(ERSTER_BLICK_MS - 1);
    await ruhe();
    expect(abrufe).toEqual([]);
    vi.advanceTimersByTime(1);
    await ruhe();
    expect(abrufe).toEqual(["GET /api/me/vormachen?anzeige=word"]);
  });
});
