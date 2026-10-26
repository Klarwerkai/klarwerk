// @vitest-environment jsdom
// ASK-AW04-1: echte Ask-/Query-/Rechtekontext-Ausgabe mit fiktivem gespeichertem Arbeitsstand.
// Nur der HTTP-Transport ist kontrolliert. Kein /api/ask, Modell, Provider oder Browser.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { bestaetigeNeueAntwort } from "../../apps/web/src/lib/fragenArbeitsstand";
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

const KONTO = "ask1-anna-fiktiv";
const MARKE = "Fiktive-ASK1-Sperrquelle-Nord";
const MISCHTEXT = `${MARKE}: Messwert 73. Allgemeiner Hinweis: regelmäßig prüfen.`;
const ENTWURF = "Meine freie neue Frage für morgen";
const FRAGE = "Welche fiktiven Prüfungen sind vorgesehen?";
const KONTEXT = { werk: "Fiktives Werk", schicht: "Früh", rolle: "Technik" };
const SZENARIO = {
  bisher: "Fiktive alte Bedingung",
  neu: "Fiktive neue Bedingung",
  thema: "Prüfen",
};
const STARTMARKEN = ["ask1-bereits-verbrauchte-adresse"];
const ids = ["ask1-nord", "ask1-frei"];
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
let stempel = "ask1-rechte-vorher";
let halten = false;
let quelleEntzogen = false;
const gehalten: { url: string; freigeben: () => void }[] = [];
let quellfehler = false;
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
  bestaetigeNeueAntwort(KONTO);
  stempel = "ask1-rechte-vorher";
  halten = false;
  quelleEntzogen = false;
  quellfehler = false;
  gehalten.length = 0;
  anfragen.length = 0;
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  arbeitsstandSchreiben(localStorage, KONTO, {
    entwurf: ENTWURF,
    antwort: {
      frage: FRAGE,
      result: RESULT,
      receipt: "ask1-eigener-alter-receipt",
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
  stempel = "ask1-rechte-nachher";
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

it("ASK-AW04-1: stehende Mischantwort ist ab erkanntem Rechtewechsel schon während Reset/Pending gesperrt, ohne neue Ask-Anfrage", async () => {
  await montiere();
  expect(container.textContent).toContain(MISCHTEXT);
  expect(arbeitsstandLesen(localStorage, KONTO)?.entwurf).toBe(ENTWURF);
  expect(anfragen.filter((r) => r.url === "/api/ask")).toHaveLength(0);
  await rechtewechsel();
  expect(container.textContent).not.toContain(MARKE);
  expect(container.textContent).not.toContain("Messwert 73");
  expect(arbeitsstandLesen(localStorage, KONTO)?.entwurf).toBe(ENTWURF);
  freigeben();
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  expect(anfragen.filter((r) => r.url === "/api/ask")).toHaveLength(0);
});

function eigenerStandBleibt(antwortIstDa = false) {
  const stand = arbeitsstandLesen(localStorage, KONTO);
  expect(stand?.entwurf).toBe(ENTWURF);
  expect(stand?.fragekontext).toEqual(KONTEXT);
  expect(stand?.szenario).toEqual(SZENARIO);
  expect(stand?.startadressen).toEqual(STARTMARKEN);
  if (antwortIstDa) {
    expect(stand?.antwort?.frage).toBe(FRAGE);
    expect(stand?.antwort?.receipt).toBe("ask1-eigener-alter-receipt");
    expect(stand?.antwort?.result).toEqual(RESULT);
  } else {
    expect(stand?.antwort).toBeNull();
    expect(stand?.fragenFaden).toContain(FRAGE);
    expect(localStorage.getItem(`kw.fragen.arbeitsstand.v1:${KONTO}`)).not.toContain(MARKE);
    expect(localStorage.getItem(`kw.fragen.arbeitsstand.v1:${KONTO}`)).not.toContain("Messwert 73");
  }
  expect(container.querySelector("[data-testid=ask-fragezeile]")?.textContent).toBe(FRAGE);
  expect(anfragen.filter((r) => r.url === "/api/ask")).toHaveLength(0);
}
function gibPfad(url: string) {
  const i = gehalten.findIndex((h) => h.url === url);
  expect(i).toBeGreaterThanOrEqual(0);
  gehalten.splice(i, 1)[0]?.freigeben();
}
async function abmontiere() {
  await act(async () => root?.unmount());
  root = null;
  container.remove();
}

it("ASK-AW04-2: Sperre überlebt Remount mit altem erfolgreichen Cache; eigener Arbeitsstand und Fragefaden bleiben", async () => {
  await montiere();
  await rechtewechsel();
  eigenerStandBleibt();
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
  await abmontiere();
  // Bereits erfolgreicher Cache ist keine neue Quellenprüfung für den gespeicherten Sperrstand.
  client.setQueryData(["kos", undefined], kos);
  client.setQueryData(["conflicts"], []);
  await montiere(false);
  await tick(); // Ein alter erfolgreicher Querycache enthält keine gelöschte Antwortkopie.
  expect(container.textContent).not.toContain(MARKE);
  expect(container.textContent).not.toContain("Messwert 73");
  eigenerStandBleibt();
  freigeben();
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
});

it("ASK-AW04-3: weder manuelles isSuccess noch zwei frische erlaubte Quellenreads stellen gelöschten Antwortklartext wieder her", async () => {
  await montiere();
  await rechtewechsel(false);
  await act(async () => {
    client.setQueryData(["kos", undefined], kos);
    client.setQueryData(["conflicts"], []);
  });
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
  gibPfad("/api/kos");
  await bis(() => client.getQueryState(["kos", undefined])?.fetchStatus === "idle");
  expect(container.textContent).not.toContain(MARKE);
  gibPfad("/api/conflicts");
  await bis(() => client.getQueryState(["conflicts"])?.fetchStatus === "idle");
  expect(container.textContent).not.toContain(MISCHTEXT);
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort?.rechtepruefungAusstehend).toBeUndefined();
  eigenerStandBleibt();
});

it("ASK-AW04-4: vor dem Wechsel gestartete späte Quellenantworten heben die Sperre nicht auf", async () => {
  await montiere();
  halten = true;
  void client.refetchQueries({ queryKey: ["kos", undefined], exact: true });
  void client.refetchQueries({ queryKey: ["conflicts"], exact: true });
  await bis(() => gehalten.length === 2);
  const alteAntworten = gehalten.splice(0);
  await rechtewechsel();
  for (const alte of alteAntworten) alte.freigeben();
  await tick();
  expect(client.getQueryData(["kos", undefined])).toBeUndefined();
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
  freigeben();
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  eigenerStandBleibt();
});

it("ASK-AW04-5: gewöhnliches initiales Unknown ohne erkannten Rechtewechsel bleibt ungeprüft nutzbar", async () => {
  halten = true;
  await montiere(false);
  await bis(() => gehalten.length === 2);
  expect(anfrageEpoche()).toBe(0);
  expect(client.getQueryState(["kos", undefined])?.status).toBe("pending");
  expect(container.textContent).toContain(MISCHTEXT);
  expect(container.querySelector("[data-testid=ask-antwort-rechtepruefung]")).toBeNull();
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort?.rechtepruefungAusstehend).toBeUndefined();
  eigenerStandBleibt(true);
  freigeben();
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).toContain(MISCHTEXT);
});

it("ASK-AW04-6: Quellenfehler sperrt Kopieren/Datei/Druck; erneute erlaubte Leseprüfung erhält Eigenarbeit ohne gelöschte Antwortkopie", async () => {
  const kopieren = vi.fn(async (_text: string) => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: kopieren },
  });
  const druck = vi.spyOn(window, "print").mockImplementation(() => {});
  await montiere();
  const kopierKnopf = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === i18n.t("ask.export.copy"),
  );
  expect(kopierKnopf).toBeDefined();
  await act(async () => kopierKnopf?.click());
  expect(kopieren).toHaveBeenCalledTimes(1);
  expect(kopieren.mock.calls[0]?.[0]).toContain(MISCHTEXT);
  quellfehler = true;
  await rechtewechsel(false);
  expect(
    [...container.querySelectorAll("button")].some(
      (b) => b.textContent === i18n.t("ask.export.copy"),
    ),
  ).toBe(false);
  expect(container.querySelector("[data-testid=ask-mehr-antwort]")).toBeNull();
  expect(container.querySelector("[data-testid=ask-vorlesen]")).toBeNull();
  freigeben();
  await bis(() => client.getQueryState(["kos", undefined])?.status === "error");
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
  expect(kopieren).toHaveBeenCalledTimes(1);
  expect(druck).not.toHaveBeenCalled();
  quellfehler = false;
  expect(container.textContent).not.toContain(MISCHTEXT);
  const erneut = container.querySelector<HTMLButtonElement>(
    "[data-testid=ask-antwort-rechtepruefung] button",
  );
  expect(erneut).not.toBeNull();
  await act(async () => erneut?.click());
  await bis(() => client.getQueryState(["conflicts"])?.fetchStatus === "idle");
  expect(container.textContent).not.toContain(MISCHTEXT);
  eigenerStandBleibt();
  druck.mockRestore();
});
