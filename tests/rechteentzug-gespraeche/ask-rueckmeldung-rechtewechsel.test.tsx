// @vitest-environment jsdom
// ASK-AW04-2-NH: nur eine neue direkt betroffene Rückmeldekante; alte sechs Fälle bleiben unverändert.
// Nur der HTTP-Transport ist kontrolliert. Kein /api/ask, Modell, Provider oder Browser.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
  useRoleOptional: () => ({ role: "experte" }),
}));
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { api } from "../../apps/web/src/api/client";
import type { AnswerResult } from "../../apps/web/src/api/types";
import { RechtekontextWache } from "../../apps/web/src/app/RechtekontextWache";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import {
  arbeitsstandLesen,
  arbeitsstandSchreiben,
} from "../../apps/web/src/lib/fragenArbeitsstand";
import { anfrageEpoche, rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";
import { Ask } from "../../apps/web/src/pages/Ask";

const urspruenglicheZwischenablage = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const urspruenglichesScrollen = Element.prototype.scrollIntoView;

const KONTO = "ask2-anna-fiktiv";
const MARKE = "Fiktive-ASK2-Sperrquelle-Nord";
const MISCHTEXT = `${MARKE}: Messwert 73. Allgemeiner Hinweis: regelmäßig prüfen.`;
const ENTWURF = "Meine freie neue Frage für morgen";
const FRAGE = "Welche fiktiven Prüfungen sind vorgesehen?";
const KONTEXT = { werk: "Fiktives Werk", schicht: "Früh", rolle: "Technik" };
const SZENARIO = {
  bisher: "Fiktive alte Bedingung",
  neu: "Fiktive neue Bedingung",
  thema: "Prüfen",
};
const STARTMARKEN = ["ask2-bereits-verbrauchte-adresse"];
const ids = ["ask2-nord", "ask2-frei"];
const RESULT: AnswerResult = {
  answered: true,
  answer: MISCHTEXT,
  knowledgeClass: "gesichert",
  trust: 90,
  sources: ids,
  citedSources: ids,
  steps: [],
  demo: false,
};
const kos = ids.map((id, i) => ({
  id,
  title: i === 0 ? MARKE : "Freie fiktive Quelle",
  statement: "Fiktiver Prüfhinweis",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "AW04 fiktiv",
  tags: [],
  confidence: 80,
  trust: 90,
  status: "validiert",
  version: 1,
  originalAuthor: KONTO,
  author: KONTO,
  neededValidations: 2,
  assignments: [],
  asset: null,
  createdAt: "2026-10-20T00:00:00.000Z",
  history: [],
}));
let client: QueryClient;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let stempel = "ask2-rechte-vorher";
let halten = false;
let quelleEntzogen = false;
const gehalten: { url: string; freigeben: () => void }[] = [];
let quellfehler = false;
const rueckmeldungen: unknown[] = [];
const anfragen: { url: string; method: string }[] = [];
const tick = async () => {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
};
async function bis(p: () => boolean) {
  for (let i = 0; i < 200; i++) {
    await tick();
    if (p()) return;
  }
  throw new Error("Benannter kontrollierter Clientzustand nicht erreicht");
}
function freigeben() {
  halten = false;
  for (const gib of gehalten.splice(0)) gib.freigeben();
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  rechtekontextZuruecksetzen();
  stempel = "ask2-rechte-vorher";
  halten = false;
  quelleEntzogen = false;
  quellfehler = false;
  gehalten.length = 0;
  anfragen.length = 0;
  rueckmeldungen.length = 0;
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  arbeitsstandSchreiben(localStorage, KONTO, {
    entwurf: ENTWURF,
    antwort: {
      frage: FRAGE,
      result: RESULT,
      receipt: "ask2-eigener-alter-receipt",
      verschlossen: [],
      gapId: null,
      angezeigtAm: new Date().toISOString(),
      serverQuellenStand: Object.fromEntries(ids.map((id) => [id, 1])),
      fragekontext: KONTEXT,
    },
    startadressen: STARTMARKEN,
    fragekontext: KONTEXT,
    szenario: SZENARIO,
  });
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = init?.method ?? "GET";
      anfragen.push({ url, method });
      if (url === "/api/ask/not-helpful" && method === "POST") {
        rueckmeldungen.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ vermerkt: true, entwurfId: null }), {
          status: 200,
          headers: { "content-type": "application/json", "x-klarwerk-rechtekontext": stempel },
        });
      }
      if (!url.startsWith("/api/") || url === "/api/ask" || method !== "GET")
        throw new Error("Kein Ask-/Modell-/Provider-/Schreibaufruf in dieser Probe");
      const kopf = stempel;
      const status = url === "/api/kos" && quellfehler ? 503 : 200;
      let daten: unknown;
      if (url === "/api/kos") daten = quelleEntzogen ? kos.slice(1) : kos;
      else if (url === "/api/conflicts" || url === "/api/directory") daten = [];
      else if (url === "/api/reasoner/status")
        daten = { active: true, mode: "cloud", tasks: { answer: true } };
      else if (url === "/api/auth/me") daten = { id: KONTO, role: "experte" };
      else throw new Error(`Nicht benötigter kontrollierter Abruf ${url}`);
      if (halten && (url === "/api/kos" || url === "/api/conflicts"))
        await new Promise<void>((resolve) => gehalten.push({ url, freigeben: resolve }));
      return new Response(JSON.stringify(daten), {
        status,
        headers: { "content-type": "application/json", "x-klarwerk-rechtekontext": kopf },
      });
    },
  );
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: KONTO, role: "experte" });
});
afterEach(async () => {
  freigeben();
  await act(async () => {
    root?.unmount();
  });
  root = null;
  client.clear();
  container?.remove();
  rechtekontextZuruecksetzen();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Element.prototype.scrollIntoView = urspruenglichesScrollen;
  if (urspruenglicheZwischenablage)
    Object.defineProperty(navigator, "clipboard", urspruenglicheZwischenablage);
  else Reflect.deleteProperty(navigator, "clipboard");
});
async function montiere(warten = true) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(RechtekontextWache),
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
  });
  if (warten)
    await bis(
      () =>
        client.getQueryState(["kos", undefined])?.status === "success" &&
        client.getQueryState(["conflicts"])?.status === "success",
    );
}
async function rechtewechsel(entzug = true) {
  const epoche = anfrageEpoche();
  stempel = "ask2-rechte-nachher";
  halten = true;
  quelleEntzogen = entzug;
  await act(async () => {
    await api.get("/auth/me");
  });
  await bis(() => gehalten.length >= 2);
  expect(anfrageEpoche()).toBe(epoche + 1);
  expect(client.getQueryData(["auth", "me"])).toMatchObject({ id: KONTO });
  expect(client.getQueryData(["kos", undefined])).toBeUndefined();
}


async function tippe(feld: HTMLInputElement | HTMLTextAreaElement, text: string) {
  await act(async () => {
    const proto = feld instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setter) throw new Error("Nativer Eingabesetzer fehlt");
    setter.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("ASK-AW04-2-NH: regulär geöffnete Rückmeldung verbirgt Quelle und sperrt Bestätigung bei Rechtewechsel, behält bearbeiteten eigenen Weg und bestätigt erst nach frischer Wiederfreigabe", async () => {
  const RUECKMELDUNG = "Das war nicht hilfreich, ich habe es so gemacht: Mein ursprünglicher eigener Weg";
  const EIGENER_WEG = "Mein bereits bearbeiteter eigener Alternativentwurf mit zusätzlicher Prüfung";
  await montiere();
  expect(container.textContent).toContain(MISCHTEXT);
  const fragefeld = container.querySelector<HTMLInputElement>("input[data-tutorial-ziel]");
  if (!fragefeld) throw new Error("Reguläres Fragefeld fehlt");
  await tippe(fragefeld, RUECKMELDUNG);
  const formular = fragefeld.closest("form");
  if (!formular) throw new Error("Reguläres Frageformular fehlt");
  await act(async () => formular.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  await bis(() => container.querySelector("[data-testid=ask-nicht-hilfreich]") !== null);
  const karte = container.querySelector("[data-testid=ask-nicht-hilfreich]");
  const weg = container.querySelector<HTMLTextAreaElement>("[data-testid=ask-nicht-hilfreich-weg]");
  if (!karte || !weg) throw new Error("Regulär erkannte Rückmeldekarte mit eigenem Weg fehlt");
  expect(karte.textContent).toContain(MARKE);
  expect(weg.value).toBe("Mein ursprünglicher eigener Weg");
  await tippe(weg, EIGENER_WEG);
  expect(weg.value).toBe(EIGENER_WEG);
  expect(rueckmeldungen).toHaveLength(0);
  expect(anfragen.filter((r) => r.url === "/api/ask")).toHaveLength(0);

  await rechtewechsel();
  expect(client.getQueryData(["auth", "me"])).toMatchObject({ id: KONTO });
  expect(client.getQueryData(["kos", undefined])).toBeUndefined();
  expect.soft(container.textContent).not.toContain(MARKE);
  expect.soft(container.textContent).not.toContain(ids[0]);
  expect(container.querySelector("[data-testid=ask-nicht-hilfreich]")).toBe(karte);
  expect(container.querySelector("[data-testid=ask-nicht-hilfreich-weg]")).toBe(weg);
  expect(weg.value).toBe(EIGENER_WEG);
  expect(arbeitsstandLesen(localStorage, KONTO)?.entwurf).toBe(RUECKMELDUNG);
  const bestaetigen = container.querySelector<HTMLButtonElement>("[data-testid=ask-nicht-hilfreich-bestaetigen]");
  if (!bestaetigen) throw new Error("Bestätigungsport der erhaltenen Rückmeldekarte fehlt");
  expect.soft(bestaetigen.disabled).toBe(true);
  await act(async () => bestaetigen.click());
  await bis(() => bestaetigen.disabled || rueckmeldungen.length > 0);
  expect.soft(rueckmeldungen).toHaveLength(0);
  // Auf dem negativen Bestand beendet das konkret nachgewiesene unerlaubte POST den Gegenlauf.
  if (rueckmeldungen.length > 0) return;

  freigeben();
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  expect(container.textContent).not.toContain(ids[0]);
  expect(weg.value).toBe(EIGENER_WEG);
  expect(bestaetigen.disabled).toBe(true);
  expect(rueckmeldungen).toHaveLength(0);

  stempel = "ask2-rechte-wieder-freigegeben";
  quelleEntzogen = false;
  halten = true;
  await act(async () => { await api.get("/auth/me"); });
  await bis(() => gehalten.length >= 2);
  expect(anfrageEpoche()).toBe(2);
  expect(weg.value).toBe(EIGENER_WEG);
  expect(bestaetigen.disabled).toBe(true);
  freigeben();
  await bis(() => !bestaetigen.disabled);
  expect(karte.textContent).toContain(MARKE);
  expect(weg.value).toBe(EIGENER_WEG);
  expect(rueckmeldungen).toHaveLength(0);
  await act(async () => bestaetigen.click());
  await bis(() => rueckmeldungen.length === 1);
  expect(rueckmeldungen[0]).toMatchObject({
    koId: ids[0], receipt: "ask2-eigener-alter-receipt", alternative: EIGENER_WEG,
  });
  expect(anfragen.filter((r) => r.url === "/api/ask")).toHaveLength(0);
});
