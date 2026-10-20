// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:peter-p06 · SICHTBARER LERNZUSTAND, SOFORTIGE PAUSE UND VORSCHAU IN DER OBERFLÄCHE.
// ================================================================================================
//
// Die ECHTE Hülle (`AppShell` mit der Lernanzeige), die ECHTE Profilseite und der ECHTE Server
// (`buildApp(buildServices())`, In-Memory). Ersetzt ist allein der Transport (`fetch` →
// `app.inject`), wie in `tests/assistenz-profil/assistenz-mounted.test.tsx`. Fiktive Konten und Daten.
//
//   U1  Start über „Vormachen und Routinen" in Klarwerk-Web (Word ist ebenfalls wählbar, seit das
//       Klara-Panel den Lernzustand zeigt); danach steht auf der Seite UND in der Lernanzeige
//       „Lernt mit", und der Merker gilt je Konto im Browserspeicher.
//   U2  Pause in der Lernanzeige wirkt sofort am Server: der Web-Weg „Entwurf anlegen" gelingt,
//       wird aber nicht mitgeschrieben; Fortsetzen stellt das Mitschreiben wieder her; eine
//       Word-Übernahme bleibt draußen.
//   U3  Vorschau aus echten Web-Arbeitswegen (Entwurf anlegen, einreichen) mit Beleg und
//       Zielbezug; Bestätigen legt die Routine an; der Außenschritt braucht Anforderung UND
//       Bestätigung genau dieser Ausführung, danach ist sie verbraucht.
//
// Die Lernanzeige im Word-Panel misst `tests/vormachen-routine/word-panel-anzeige.test.tsx` an der
// ausgelieferten Datei `vormachen.js`. Was nirgends belegt ist: ein laufendes Word.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { verwerfeAssistenzProfil } from "../../apps/web/src/lib/assistenzProfil";
import { meldeVormachen } from "../../apps/web/src/lib/vormachenAnzeige";
import { Profile } from "../../apps/web/src/pages/Profile";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@vormachen-ui.test", password: "ada-geheim-1" };
const ZWECK = "Angebotsanschreiben für Musterfirma vorbereiten";
const WEB = "http://localhost/erfassen";
const WORD = "http://localhost/word-addin/taskpane.html";
const ENTWURF = {
  title: "Angebot Musterfirma",
  statement: "Angebot vor Versand fachlich prüfen.",
  type: "best_practice",
  category: "Vertrieb",
  confidentiality: "intern",
  bodyHtml: "<p>Angebotsnotiz mit fiktiven Werten.</p>",
};

let app: FastifyInstance | null = null;
let cookie = "";
let vorherigerFetch: typeof globalThis.fetch;

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.cookie = cookie;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

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

let adaId = "";
/** Was der Server aus dem Einreichen des in Schritt 1 angelegten Entwurfs als Schritt ableitet. */
const EINGEREICHT = "Entwurf zur Prüfung einreichen (Entwurf aus Schritt 1)";

/** Der vorhandene Web-Weg „Entwurf anlegen" aus der Anwendung heraus. */
function webEntwurf(titel: string) {
  return draht("POST", "/api/drafts", { ...ENTWURF, title: titel }, WEB);
}

/** Der vorhandene Word-Weg „Auswahl als Entwurf" — so, wie das Taskpane ihn sendet. */
function wordUebernahme(titel: string) {
  return draht("POST", "/api/drafts", { ...ENTWURF, title: titel, origin: "word_addin" }, WORD);
}

interface Sitzung {
  id: string;
  zustand: string;
  beobachtet: number;
}

async function sitzungen(): Promise<Sitzung[]> {
  const r = await draht("GET", "/api/me/vormachen");
  expect(r.status).toBe(200);
  return (r.body as { sitzungen: Sitzung[] }).sitzungen;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function montiere(route: string, seite: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [route] },
                  createElement(AppShell, null, seite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  }
}

/** Öffnet „Vormachen und Routinen". */
async function oeffneFlaeche(): Promise<void> {
  await montiere("/profil", createElement(Profile));
  await bis(() => Boolean(q(document, "zeile-funktionen")));
  await klick(q(document, "zeile-funktionen"));
}

/** Startet über die Oberfläche eine Lernsitzung in Klarwerk-Web mit zwei Entwurfsvorgängen. */
async function starteUeberOberflaeche(): Promise<void> {
  await oeffneFlaeche();
  await bis(() => Boolean(q(document, "vormachen-start")));
  // Beide Hosts zeigen den Lernzustand an (Word über das Klara-Panel, `vormachen.js`) und sind
  // deshalb wählbar; einen Hinweis auf einen Host ohne Anzeige gibt es nicht mehr.
  const word = document.querySelector<HTMLOptionElement>(
    '[data-testid="vormachen-host"] option[value="word"]',
  );
  expect(word?.disabled).toBe(false);
  expect(q(document, "vormachen-host-ohne-anzeige")).toBeNull();
  for (const v of ["entwurf_anlegen", "entwurf_speichern"]) {
    await klick(q(document, `vormachen-vorgang-${v}`));
  }
  // Ein Vorgang eines anderen Hosts steht gar nicht zur Wahl.
  expect(q(document, "vormachen-vorgang-word_frage")).toBeNull();
  await tippe(q<HTMLInputElement>(document, "vormachen-zweck") as HTMLInputElement, ZWECK);
  await klick(q(document, "vormachen-starten"));
  await bis(() => Boolean(q(document, "vormachen-anzeige")));
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  meldeVormachen(false);
  verwerfeAssistenzProfil();
  medienStub();
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  const services = buildServices();
  // Ein stiller Prüf-Job — das Einreichen in U3 reiht ein, es läuft kein Modell.
  services.aiCheckWorker = {
    enqueue: () => undefined,
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode).toBe(201);
  adaId = (a.json() as { id: string }).id;
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  expect((await draht("POST", "/api/auth/notice")).status).toBeLessThan(300);
});

afterEach(async () => {
  abbauen();
  await app?.close();
  app = null;
});

describe("P06-AC01/AC02 · Start, sichtbarer Lernzustand und sofortige Pause", () => {
  it("U1 · der Start trägt genau die gewählte Anwendung und Vorgänge; Seite und Anzeige zeigen „Lernt mit“", async () => {
    await starteUeberOberflaeche();
    const [s] = await sitzungen();
    expect(s?.zustand).toBe("lernt");
    const ueber = (await draht("GET", "/api/me/vormachen")).body as {
      sitzungen: { host: string; vorgaenge: string[]; zweck: string }[];
    };
    expect(ueber.sitzungen[0]).toMatchObject({
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern"],
      zweck: ZWECK,
    });
    // Der Merker gilt je Konto im Browserspeicher — ein weiterer Tab sieht die Anzeige ebenso.
    expect(localStorage.getItem(`kw-vormachen-aktiv:${adaId}`)).toBe("1");
    const anzeige = q(document, "vormachen-anzeige");
    expect(anzeige?.getAttribute("data-zustand")).toBe("lernt");
    expect(anzeige?.textContent).toContain(i18n.t("vormachen.zustand.lernt", { anzahl: 0 }));
    expect(q(document, "vormachen-zustand")?.getAttribute("data-zustand")).toBe("lernt");
  });

  it("U2 · Pause in der Anzeige wirkt sofort; Fortsetzen stellt das Mitschreiben wieder her", async () => {
    await starteUeberOberflaeche();

    await klick(q(document, "vormachen-anzeige-pause"));
    await bis(() => q(document, "vormachen-anzeige")?.getAttribute("data-zustand") === "pausiert");
    expect((await sitzungen())[0]?.zustand).toBe("pausiert");
    // Der Entwurf entsteht — mitgeschrieben wird er während der Pause nicht.
    expect((await webEntwurf("Während der Pause")).status).toBe(201);
    expect((await sitzungen())[0]?.beobachtet).toBe(0);
    expect(q(document, "vormachen-anzeige")?.textContent).toContain(
      i18n.t("vormachen.zustand.pausiert"),
    );
    await bis(() => q(document, "vormachen-zustand")?.getAttribute("data-zustand") === "pausiert");
    expect(q(document, "vormachen-zustand")?.getAttribute("data-zustand")).toBe("pausiert");

    await klick(q(document, "vormachen-pause"));
    await bis(() => q(document, "vormachen-anzeige")?.getAttribute("data-zustand") === "lernt");
    expect((await sitzungen())[0]?.zustand).toBe("lernt");
    expect((await webEntwurf("Nach der Pause")).status).toBe(201);
    expect((await sitzungen())[0]?.beobachtet).toBe(1);
    // Eine Word-Übernahme gehört nicht zum gewählten Host und wird nicht mitgeschrieben.
    expect((await wordUebernahme("Aus Word")).status).toBe(201);
    expect((await sitzungen())[0]?.beobachtet).toBe(1);
  });
});

describe("P06-AC04/AC05 · Vorschau und Außenschritt in der Oberfläche", () => {
  it("U3 · Vorschau aus echten Web-Arbeitswegen; der Außenschritt braucht Anforderung und Bestätigung", async () => {
    // Start am Draht (Klarwerk-Web), dann die Fläche öffnen — die Anzeige liest den Serverstand.
    const start = await draht("POST", "/api/me/vormachen", {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "zur_pruefung_einreichen"],
      zweck: ZWECK,
    });
    expect(start.status).toBe(201);
    meldeVormachen(true, adaId);
    await oeffneFlaeche();
    await bis(() => Boolean(q(document, "vormachen-sitzung")));
    // Die Anzeige hat sich gemeldet — erst damit wird in diesem Client mitgeschrieben.
    await bis(() => Boolean(q(document, "vormachen-anzeige")));

    // Vormachen über die vorhandenen Wege: Entwurf anlegen, zur Prüfung einreichen.
    const e = await draht("POST", "/api/drafts", ENTWURF, WEB);
    expect(e.status).toBe(201);
    const entwurfId = (e.body as { id: string }).id;
    const einreichen = await draht(
      "POST",
      `/api/drafts/${entwurfId}/promote`,
      { operationId: "vormachen-ui-einreichen-0001" },
      WEB,
    );
    expect(einreichen.status).toBe(201);

    await klick(q(document, "vormachen-vorschau-laden"));
    await bis(() => Boolean(q(document, "vormachen-vorschau")));
    const zweiter = q(document, "vormachen-vorschau-schritt-2");
    expect(zweiter?.textContent).toContain("Entwurf zur Prüfung einreichen");
    expect(zweiter?.textContent).toContain(i18n.t("vormachen.vorschau.beleg", { nr: 2 }));
    expect(zweiter?.textContent).toContain(i18n.t("vormachen.vorgang.aussen"));

    await klick(q(document, "vormachen-bestaetigen"));
    await bis(() => Boolean(q(document, "vormachen-routine")));
    expect(q(document, "vormachen-anzeige")).toBeNull();
    expect(q(document, "vormachen-freigabe-s1")).not.toBeNull();
    expect(q(document, "vormachen-routine")?.textContent).toContain(
      i18n.t("vormachen.aussen.hinweis"),
    );

    // Erster Zug: genau diese Ausführung anfordern — noch nichts freigegeben.
    await klick(q(document, "vormachen-aussen-s2"));
    await bis(() => Boolean(q(document, "vormachen-aussen-bestaetigen-s2")));
    expect(q(document, "vormachen-aussen-offen-s2")?.textContent).toContain(
      "Entwurf zur Prüfung einreichen",
    );
    expect(q(document, "vormachen-meldung")).toBeNull();
    // Zweiter Zug: bestätigen — danach ist die Anforderung verbraucht.
    await klick(q(document, "vormachen-aussen-bestaetigen-s2"));
    await bis(() => Boolean(q(document, "vormachen-meldung")));
    expect(q(document, "vormachen-meldung")?.textContent).toBe(
      i18n.t("vormachen.freigabe.aussen", { schritt: EINGEREICHT }),
    );
    expect(q(document, "vormachen-aussen-bestaetigen-s2")).toBeNull();
    expect(q(document, "vormachen-aussen-s2")).not.toBeNull();
  });
});
