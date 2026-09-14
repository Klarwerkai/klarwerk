// @vitest-environment jsdom
// ================================================================================================
// JOB 3980 — NIEDERLAENDISCH ERREICHT KLARAS HILFE-KI: GEMESSEN AM ARGUMENT DES MODELLS.
// ================================================================================================
//
// DIE BESTELLUNG (Pruefer BEN, `archiv/3949/runde-1/ben.md`, PROMPTVERBESSERUNGEN, woertlich):
// „Belege `nl` am Argument von `reasoner.helpAnswer`."
//
// WARUM GENAU DORT UND NICHT AM ANFRAGEKOERPER: Zwei Stellen bildeten die Oberflaechensprache auf
// die Reasoner-Sprache ab, und BEIDE kannten nur zwei Werte —
//   `apps/web/src/components/KlaraAssistant.tsx`  (`startsWith("en") ? "en" : "de"`)
//   `services/app/src/routes/help-routes.ts`      (`value === "en" ? "en" : "de"`)
// Ein Test, der nur den gesendeten Rumpf liest (so misst DU5i in
// `tests/seitenhilfe-navkapitel/duplikate-am-seitenverhalten.test.tsx`), sieht die ZWEITE Stelle
// nie: Der Client koennte laengst „nl" schicken, und der Server machte still „de" daraus. Deshalb
// wird hier das Argument gelesen, mit dem `reasoner.helpAnswer` WIRKLICH aufgerufen wird — hinter
// beiden Stellen.
//
// WAS HIER ECHT IST:
//   * die echte Komponente `KlaraAssistant` mit ihren echten Providern,
//   * der echte Clientabruf `endpoints.help.explain` -> `api.post` -> `fetch("/api/help/explain")`,
//   * die echte App dahinter (`buildApp`/`buildServices`) mit der echten Route,
//   * der echte Reasoner — nur seine Methode `helpAnswer` ist UMHUELLT (nicht ersetzt): die Huelle
//     schreibt das Sprachargument mit und ruft danach das Original.
// Der EINZIGE Ersatz ist der Transport: `globalThis.fetch` liegt auf `app.inject`. Die Bauform ist
// woertlich die von `tests/web/job2660-hilfe-fremdtext-ui.test.tsx` (dort ausfuehrlich begruendet);
// sie ist hier zusaetzlich zwingend, weil die Bahn-Sandbox keinen Horchsocket zulaesst
// (`listen EPERM`). Ein zweiter Montageweg entsteht nicht.
//
// WAS HIER NICHT BEHAUPTET WIRD: dass das Modell die Antwort auch wirklich auf Niederlaendisch
// FORMULIERT. Das ist Modellverhalten und braeuchte einen echten Anbieter. Gemessen ist allein,
// dass die eingestellte Sprache bis an die Modellkante durchreist.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
// Beschriftung der Modellstufe (RFC-2606-Kennung, wird nie aufgeloest): Sie gibt den KI-Knopf im
// Panel frei — ohne nutzbares Modell ist er HART ausgegraut (`useAiAvailable("answer")`), und der
// Test koennte die Nutzerhandlung gar nicht ausloesen. Der Aufruf endet an der In-Process-Grenze
// unten. Bauform und Begruendung: `tests/web/job2660-hilfe-fremdtext-ui.test.tsx`.
process.env.KLARWERK_LOCAL_LLM_URL = "http://kw-in-process.invalid/v1";
process.env.KLARWERK_LOCAL_LLM_MODEL = "kw-job3980-in-process";
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
import {
  allFaqEntries,
  allKlaraEntries,
  resolveKlaraEntries,
} from "../../apps/web/src/lib/klaraRegistry";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// DIE MESSSTELLE — das Sprachargument, mit dem `reasoner.helpAnswer` aufgerufen wurde.
// ------------------------------------------------------------------------------------------------
const modellSprachen: unknown[] = [];
/** Die Anfragekoerper, die der Client an `POST /api/help/explain` geschickt hat (Fehlerbild). */
const gesendeteKoerper: string[] = [];
/** Abweisungen der Route — ohne sie sucht man einen ausgebliebenen Modellaufruf im Blinden. */
const abgewiesen: string[] = [];
let letzterModellstatus = "(nie abgerufen)";

let drahtApp: FastifyInstance | null = null;
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;

const istAbsolut = (url: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (istAbsolut(url)) {
      // DIE IN-PROCESS-MODELLGRENZE. Sie ANTWORTET, statt zu werfen: ein geworfener Fehler setzte
      // die Kante auf `reachable: "unreachable"`, der KI-Knopf waere hart ausgegraut und die
      // menschliche Handlung gar nicht ausloesbar (gemessen in JOB 2660, dort begruendet).
      // Der Modellclient liest ueber `res.json()`, der Web-Client ueber `res.text()` — beide Wege
      // muessen bedient sein, sonst gilt eine beantwortete Kante still als tot.
      const nutzlast = { choices: [{ message: { content: "bereit" } }] };
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
    if (url.startsWith("/api/help/explain")) {
      gesendeteKoerper.push(
        init?.body === undefined || init.body === null ? "" : String(init.body),
      );
      if (antwort.statusCode !== 200) {
        abgewiesen.push(`${antwort.statusCode} ${antwort.body}`);
      }
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

// ------------------------------------------------------------------------------------------------
// FLAECHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die Frage wird aus dem AUFGELOESTEN Bestand DIESER Sprache gebildet, nicht abgeschrieben: der
 * Titel eines vorhandenen Hilfe-Eintrags. `rankKlara` (`klaraRegistry.ts:289-311`) zaehlt die
 * Wortdeckung ueber Titel + Text — der eigene Titel trifft also zwingend, und der Client hat
 * Schnipsel zum Mitschicken. Ohne Schnipsel gaebe es ehrlich KEINEN Modellaufruf
 * (`KlaraAssistant.tsx:300-302`), und der Fall maesse nichts.
 */
function frageIn(lng: string): string {
  const bestand = [
    ...resolveKlaraEntries(allKlaraEntries(), (key) => i18n.getFixedT(lng)(key)),
    ...allFaqEntries(lng),
  ];
  const traeger = bestand.find((e) => e.title.split(/\s+/).filter((w) => w.length > 2).length >= 2);
  if (!traeger) {
    throw new Error(
      `Hilfe-Bestand (${lng}) ohne Eintrag mit zwei tragenden Titelwoertern — die Frage liesse sich nicht bilden`,
    );
  }
  return traeger.title.slice(0, 120);
}

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
  // Klara draengt sich nie auf — das Panel oeffnet nur auf Klick. Also klicken.
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

/**
 * Die echte Nutzerhandlung in EINER Sprache: Oberflaeche umstellen, Panel oeffnen, Frage tippen,
 * „Mit KI-Unterstuetzung suchen" druecken. Gibt die gestellte Frage zurueck (Fehlerbild).
 */
async function klaraFragt(lng: string): Promise<string> {
  await i18n.changeLanguage(lng);
  await panelOeffnen();
  const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
  if (!feld) {
    throw new Error("Suchfeld im Klara-Panel nicht gefunden.");
  }
  const frage = frageIn(lng);
  // Der Wert wird ueber den PROTOTYP-Setter gesetzt und mit `input` gemeldet: React haengt einen
  // eigenen Setter an das Element, ein blosses `feld.value = …` liefe an seinem Zustand vorbei.
  const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, frage);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
  const knopf = [
    ...container.querySelectorAll<HTMLButtonElement>("section[data-klara='1'] button"),
  ].find((b) => (b.textContent ?? "").includes(i18n.t("klara.aiSearch")));
  expect(knopf, `kein Knopf „Mit KI-Unterstützung suchen“ im Panel (${lng})`).toBeDefined();
  expect(
    knopf?.disabled,
    `der KI-Knopf ist ausgegraut — die Frage geht gar nicht hinaus (${lng}). Modellstatus: ${letzterModellstatus}`,
  ).toBe(false);
  await act(async () => {
    knopf?.click();
    await durchlaufen();
  });
  await act(durchlaufen);
  return frage;
}

/** Der zuletzt am Modell angekommene Sprachwert, mit vollem Fehlerbild, wenn keiner ankam. */
function angekommeneSprache(frage: string): unknown {
  expect(
    modellSprachen.length,
    `\`reasoner.helpAnswer\` wurde gar nicht aufgerufen — die Frage „${frage}" hat die Modellkante nie erreicht. Gesendet: ${gesendeteKoerper.at(-1)?.slice(0, 500)} · Abgewiesen: ${abgewiesen.join(" | ")}`,
  ).toBeGreaterThan(0);
  return modellSprachen.at(-1);
}

beforeAll(async () => {
  drahtAufbauen();
  const services = buildServices();
  // DIE HUELLE, und sie ersetzt nichts: Sie schreibt das dritte Argument mit und ruft danach das
  // Original. Der Weg durch die echte Route und den echten Reasoner bleibt also vollstaendig.
  const echt = services.reasoner.helpAnswer.bind(services.reasoner);
  services.reasoner.helpAnswer = ((
    frage: Parameters<typeof echt>[0],
    kontext: Parameters<typeof echt>[1],
    sprache: Parameters<typeof echt>[2],
  ) => {
    modellSprachen.push(sprache);
    return echt(frage, kontext, sprache);
  }) as typeof services.reasoner.helpAnswer;
  const app = buildApp(services);
  await app.ready();
  drahtApp = app;
  await authApi.register("Pedi", "pedi@job3980.test", "geheim12345");
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3980.test", password: "geheim12345" },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
});

afterAll(async () => {
  globalThis.fetch = vorherigerFetch;
  await drahtApp?.close();
  drahtApp = null;
  await i18n.changeLanguage("de");
});

beforeEach(() => {
  modellSprachen.length = 0;
  gesendeteKoerper.length = 0;
  abgewiesen.length = 0;
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
});

describe("JOB 3980 — die eingestellte Sprache reist bis an Klaras Modellkante", () => {
  it('NL1: die niederländische Hilfefrage erreicht die Modellkante mit `locale: "nl"`', async () => {
    const frage = await klaraFragt("nl");
    // K1 — der Abruf lief wirklich. Ohne ihn maesse die Aussage darunter nichts.
    expect(
      gesendeteKoerper.length,
      `kein Abruf von /api/help/explain — die Handlung lief nicht. Frage: „${frage}"`,
    ).toBeGreaterThan(0);
    expect(
      angekommeneSprache(frage),
      `der Mensch hat Niederländisch eingestellt, am Argument von \`reasoner.helpAnswer\` kommt aber etwas anderes an. Gesendet: ${gesendeteKoerper.at(-1)?.slice(0, 400)}`,
    ).toBe("nl");
  });

  it('NL2: „en-US" erreicht die Modellkante als `locale: "en"`', async () => {
    const frage = await klaraFragt("en-US");
    expect(
      angekommeneSprache(frage),
      `Englisch (en-US) kommt am Modell nicht als „en" an. Gesendet: ${gesendeteKoerper.at(-1)?.slice(0, 400)}`,
    ).toBe("en");
  });

  it('NL3: eine Oberflächensprache ohne eigenen Prompt („fr") landet weiterhin auf `locale: "de"`', async () => {
    // Der sichere Default, und er ist der Kern der Verträglichkeit: Die Reihenfolge ist „bekannte
    // Sprache zuerst, Deutsch zuletzt" (`reasonerLocale.ts:10-13`) — eine vierte Oberflächensprache
    // bekommt keinen Prompt, den niemand geschrieben hat.
    const frage = await klaraFragt("fr");
    expect(
      angekommeneSprache(frage),
      `eine unbekannte Oberflächensprache landet nicht mehr auf dem sicheren Default. Gesendet: ${gesendeteKoerper.at(-1)?.slice(0, 400)}`,
    ).toBe("de");
  });

  it('NL4: eine FEHLENDE Sprachangabe im Rumpf wird von der Route zu „de" — Fremdeingabe, kein Vertrauen auf den Client', async () => {
    // Diese zwei Fälle gehen ABSICHTLICH direkt an die Route: Sie messen die Normalisierung dessen,
    // was der echte Client gar nicht schickt. Genau dafür steht `normalizeLocale` da — der Rumpf
    // kommt aus dem Netz, nicht aus dem eigenen Bündel.
    const antwort = await drahtApp?.inject({
      method: "POST",
      url: "/api/help/explain",
      headers: { cookie: cookie ?? "" },
      payload: {
        question: "Wie validiere ich ein Wissensobjekt?",
        snippets: [
          {
            id: "page:validation",
            title: "Validierung",
            body: "Das Prüf-Board: Erst mit genug grünen Freigaben gilt ein Objekt als validiert.",
          },
        ],
      },
    });
    expect(antwort?.statusCode, `die Route hat den Rumpf abgewiesen: ${antwort?.body}`).toBe(200);
    expect(
      modellSprachen.at(-1),
      "ohne Sprachangabe kommt am Modell nicht der sichere Default an",
    ).toBe("de");
  });

  it('NL5: ein UNBEKANNTER Sprachwert im Rumpf wird von der Route zu „de" — die Tür bleibt zu', async () => {
    const antwort = await drahtApp?.inject({
      method: "POST",
      url: "/api/help/explain",
      headers: { cookie: cookie ?? "" },
      payload: {
        question: "Wie validiere ich ein Wissensobjekt?",
        snippets: [
          {
            id: "page:validation",
            title: "Validierung",
            body: "Das Prüf-Board: Erst mit genug grünen Freigaben gilt ein Objekt als validiert.",
          },
        ],
        locale: "fr",
      },
    });
    expect(antwort?.statusCode, `die Route hat den Rumpf abgewiesen: ${antwort?.body}`).toBe(200);
    expect(
      modellSprachen.at(-1),
      "ein unbekannter Sprachwert aus dem Netz erreicht das Modell — die Normalisierung lässt ihn durch",
    ).toBe("de");
  });
});
