// @vitest-environment jsdom
// ================================================================================================
// JOB 2959 · D1 · F-0304 — DIE ANTWORT GEHOERT SICHTBAR ZU IHRER FRAGE
// ================================================================================================
//
// DIE GEMESSENE LUECKE, in einem Satz: Die KI-Antwort im Klara-Panel bleibt stehen, wenn der Nutzer
// im Suchfeld weitertippt — und sie sagt nirgends, auf welche Frage sie antwortet. Wer eine zweite
// Frage eingibt, liest die Antwort auf die erste als Antwort auf die zweite.
//
// BELEG AM CODE (Stand `6d574fce`, vor diesem Durchgang):
//   * `KlaraAssistant.tsx:98`   `const [askedFor, setAskedFor] = useState<string | null>(null)`
//   * `KlaraAssistant.tsx:299`  `setAskedFor(question)` — beim Ausloesen gesetzt
//   * `KlaraAssistant.tsx:493`  `{askedFor && !aiAsk.isPending ? (` — die EINZIGE weitere Stelle
//   Die Frage wird also gemerkt und ausschliesslich als Schalter benutzt. Sie erreicht den
//   Bildschirm nie. Gegenprobe im Bestand: `grep -n askedFor` liefert genau diese drei Zeilen.
//
// WARUM DAS MEHR IST ALS EIN SCHOENHEITSFEHLER. Klara ist ausdruecklich darauf gebaut, nichts zu
// behaupten, was sie nicht belegen kann (Dateikopf: „raet nie", „sagt offen, wenn ihr ein Eintrag
// fehlt"). Die Trefferliste darunter fuehrt ihre Frage sogar mit: `klara.resultsFor` = „Treffer
// fuer: {{q}}" (`:593`) — sie aktualisiert sich beim Tippen. Die KI-Antwort daneben tut beides
// nicht: sie aktualisiert sich nicht und nennt ihre Frage nicht. Nebeneinander entsteht dadurch das
// Bild, die stehengebliebene Antwort gehoere zur neu getippten Frage.
//
// WAS HIER ECHT IST — Bauform woertlich aus `tests/web/job2660-hilfe-fremdtext-ui.test.tsx`
// (dort ausfuehrlich begruendet): die echte Komponente `KlaraAssistant` mit ihren echten Providern,
// der echte Clientabruf `endpoints.help.explain`, die echte App (`buildApp`/`buildServices`) mit
// echter Route und echtem Reasoner, der echte Renderer. Der EINZIGE Ersatz ist der Transport:
// `globalThis.fetch` liegt auf `app.inject` — die Bahn-Sandbox laesst keinen Horchsocket zu
// (`listen EPERM`).
//
// ZUR DATEIENDUNG: `.test.tsx`, weil eine `.test.ts` kein JSX uebersetzt (TS6142). Pfad und Name
// sind exakt die aus dem Pfad-Gate.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Die Modellstufe gibt den KI-Knopf frei — ohne nutzbares Modell ist er HART ausgegraut
// (`useAiAvailable("answer")`), und die Nutzerhandlung waere gar nicht ausloesbar. Die Kennung ist
// eine RFC-2606-Adresse und wird nie aufgeloest; der Aufruf endet an der In-Process-Grenze unten.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job2959-in-process";
process.env.KLARWERK_LOCAL_LLM_TIMEOUT_MS = "1000";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { authApi } from "../../apps/web/src/api/auth";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Zwei Fragen, die sich in JEDEM Inhaltswort unterscheiden — sonst koennte ein Test gruen werden,
// weil die zweite Frage zufaellig in der ersten steckt.
const FRAGE_EINS = "Wie funktioniert die Validierung von Wissen?";
const FRAGE_ZWEI = "Wo finde ich meine gespeicherten Entwuerfe?";

let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;
let letzterModellstatus = "(nie abgerufen)";
let modellkanteAngefragt = 0;
const erklaerAbrufe: string[] = [];

const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      // Die In-Process-Modellgrenze. Sie ANTWORTET statt zu werfen, weil eine geworfene Anfrage die
      // Kante als `unreachable` fuehrt und den KI-Knopf ausgraut — dann liefe die Handlung nie.
      // Der Erreichbarkeits-Ping bekommt eine gueltige Mini-Antwort; die Generierung bekommt eine
      // unbrauchbare, und das Ergebnis entsteht ueber den deterministischen Rueckfall der
      // Providerkette. Dieser Test erfindet also keinen Antworttext.
      modellkanteAngefragt += 1;
      const rumpf = init?.body === undefined || init.body === null ? "" : String(init.body);
      const istGenerierung = rumpf.includes("snippet") || rumpf.length > 400;
      const nutzlast = istGenerierung ? {} : { choices: [{ message: { content: "bereit" } }] };
      return {
        status: 200,
        statusText: "200",
        ok: true,
        text: async () => JSON.stringify(nutzlast),
        json: async () => nutzlast,
      };
    }
    if (!drahtApp) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await drahtApp.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    const gesetzt = antwort.headers["set-cookie"];
    const roh = Array.isArray(gesetzt) ? gesetzt[0] : gesetzt;
    if (typeof roh === "string") {
      cookie = roh.split(";")[0] ?? cookie;
    }
    if (url.startsWith("/api/help/explain")) {
      erklaerAbrufe.push(antwort.body);
    }
    if (url.startsWith("/api/reasoner/status") && antwort.statusCode === 200) {
      letzterModellstatus = antwort.body;
    }
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const panel = (): HTMLElement | null =>
  container.querySelector<HTMLElement>("section[data-klara='1']");

async function panelOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
            createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(KlaraAssistant)),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  // Klara draengt sich nie auf — das Panel oeffnet nur auf Klick.
  const oeffner = container.querySelector<HTMLButtonElement>("button[data-klara='1']");
  if (!oeffner) {
    throw new Error("Klara-Knopf nicht gefunden — das Panel ist nicht erreichbar.");
  }
  await act(async () => {
    oeffner.click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

/** Nur tippen — genau die Handlung, die heute die Antwort veralten laesst, ohne es zu sagen. */
async function tippen(text: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
  if (!feld) {
    throw new Error("Suchfeld im Klara-Panel nicht gefunden.");
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
}

/** Tippen und „Mit KI-Unterstuetzung suchen" druecken — die echte Nutzerhandlung. */
async function fragen(frage: string): Promise<void> {
  await tippen(frage);
  const knopf = [
    ...container.querySelectorAll<HTMLButtonElement>("section[data-klara='1'] button"),
  ].find((b) => (b.textContent ?? "").includes(i18n.t("klara.aiSearch")));
  if (!knopf) {
    throw new Error("KI-Knopf im Klara-Panel nicht gefunden.");
  }
  // Ohne freigegebenen Knopf gaebe es nichts zu messen — genau daran sind gemountete Tests dieser
  // Bahn frueher still gescheitert: die Handlung lief gar nicht.
  expect(
    knopf.disabled,
    `der KI-Knopf ist ausgegraut — die Frage wurde nie gestellt. Modellstatus: ${letzterModellstatus} · Modellkante angefragt: ${modellkanteAngefragt}`,
  ).toBe(false);
  await act(async () => {
    knopf.click();
    await durchlaufen();
  });
  await act(durchlaufen);
}

async function vorrichtung(): Promise<void> {
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();
  drahtApp = app;
  await authApi.register("Pedi", "pedi@job2959.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2959.test", password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  await panelOeffnen();
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  drahtApp = null;
  cookie = null;
  erklaerAbrufe.length = 0;
});

describe("JOB 2959 · D1 · F-0304 — die Assistenzflaeche sagt, zu welcher Frage ihre Antwort gehoert", () => {
  it("K0 · KALIBRIERUNG: die Handlung laeuft wirklich — die Antwortkarte steht nach dem Fragen auf der Flaeche", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    // Ohne diesen Nachweis maesse alles Weitere eine Flaeche, auf der nie etwas passiert ist.
    expect(
      erklaerAbrufe.length,
      "kein einziger Abruf von /api/help/explain — der Clientabruf lief nicht",
    ).toBeGreaterThan(0);
    const karte = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-evidence]");
    expect(
      karte,
      `keine KI-Antwortkarte auf der Flaeche. Geliefert: ${erklaerAbrufe.at(-1)?.slice(0, 300)}`,
    ).not.toBeNull();
  });

  it("F1 · DIE LUECKE: die Antwort nennt die Frage, auf die sie antwortet", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    const zeile = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    expect(
      zeile,
      "die KI-Antwort nennt ihre Frage nicht — `askedFor` wird gemerkt (KlaraAssistant.tsx:299), " +
        "aber nie angezeigt",
    ).not.toBeNull();
    expect(
      (zeile?.textContent ?? "").replace(/\s+/g, " "),
      "die genannte Frage ist nicht die gestellte",
    ).toContain(FRAGE_EINS);
  });

  it("F2 · DER SCHADENSFALL: tippt der Nutzer weiter, bleibt die Antwort bei IHRER Frage — sie wandert nicht auf die neue", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    // Nur tippen, NICHT erneut fragen — genau so entsteht der Fehler heute: die Trefferliste
    // darunter zieht mit (`klara.resultsFor`, KlaraAssistant.tsx:593), die KI-Antwort bleibt stehen.
    await tippen(FRAGE_ZWEI);

    // KALIBRIERUNG: die Eingabe ist wirklich angekommen. Gemessen wird sie am Feldwert und NICHT
    // am Paneltext — der erste Entwurf dieses Falls suchte die neue Frage im sichtbaren Text und
    // scheiterte daran, dass sie gar keine Treffer hat: statt „Treffer fuer: …" steht dann
    // `klara.noResults` da, und die Frage taucht nirgends auf. Der Feldwert ist die Stelle, an der
    // die Eingabe unbestreitbar liegt.
    const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
    expect(
      feld?.value,
      "die Eingabe ist gar nicht angekommen — der Fall waere ohne Gegenstand",
    ).toBe(FRAGE_ZWEI);

    const zeile = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    expect(zeile, "die Antwort nennt ihre Frage nicht — der Bezug bleibt unklar").not.toBeNull();
    const genannt = (zeile?.textContent ?? "").replace(/\s+/g, " ");
    // DER KERN: die stehengebliebene Antwort gehoert weiterhin sichtbar zur ERSTEN Frage.
    expect(
      genannt,
      "die Antwort schreibt sich der neuen Frage zu, obwohl sie zur alten gehoert",
    ).toContain(FRAGE_EINS);
    expect(genannt, "die Antwort behauptet, auf die neu getippte Frage zu antworten").not.toContain(
      FRAGE_ZWEI,
    );
  });

  it("F3 · die Frage steht IN der Antwortkarte, nicht irgendwo auf der Flaeche", async () => {
    await vorrichtung();
    await fragen(FRAGE_EINS);
    const zeile = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-question]");
    expect(zeile).not.toBeNull();
    // Sonst genuegte ein Text am Seitenrand, und der Bezug zur Antwort waere wieder Auslegung:
    // beide muessen denselben Traeger haben.
    const etikett = panel()?.querySelector<HTMLElement>("[data-testid=klara-ai-evidence]");
    expect(etikett).not.toBeNull();
    const karteDerFrage = zeile?.closest("div");
    expect(
      karteDerFrage?.contains(etikett as Node),
      "Frage und Antwort stehen nicht im selben Kasten",
    ).toBe(true);
  });
});
