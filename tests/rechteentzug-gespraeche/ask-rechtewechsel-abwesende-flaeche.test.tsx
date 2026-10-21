// @vitest-environment jsdom
// RC3-P2: Ask verlässt die Fläche VOR dem erkannten Wechsel; die echte globale Wache bleibt.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
  useRoleOptional: () => ({ role: "experte" }),
}));
import { QueryClient, QueryClientProvider } from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { api } from "../../apps/web/src/api/client";
import type { AnswerResult } from "../../apps/web/src/api/types";
import { RechtekontextWache } from "../../apps/web/src/app/RechtekontextWache";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { arbeitsstandLesen, arbeitsstandSchreiben } from "../../apps/web/src/lib/fragenArbeitsstand";
import { anfrageEpoche, rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";
import { Ask } from "../../apps/web/src/pages/Ask";

const KONTO = "rc3-p2-eigenes-konto";
const ANDERES = "rc3-p2-anderes-konto";
const MARKE = "Fiktive-RC3-P2-Quelle";
const MISCHTEXT = `${MARKE}: Messwert 73. Freier Prüfhinweis.`;
const ENTWURF = "Meine freie bearbeitete Frage für morgen";
const FRAGE = "Welche fiktive Prüfung ist vorgesehen?";
const RESULT: AnswerResult = { answered: true, answer: MISCHTEXT, knowledgeClass: "gesichert",
  trust: 90, sources: ["p2-nord", "p2-frei"], citedSources: ["p2-nord", "p2-frei"], steps: [], demo: false };
const kos = RESULT.sources.map((id, i) => ({ id, title: i ? "Fiktive freie Quelle" : MARKE,
  statement: "Fiktiver Prüfhinweis", conditions: [], measures: [], type: "best_practice",
  category: "RC3 fiktiv", tags: [], confidence: 80, trust: 90, status: "validiert", version: 1,
  originalAuthor: KONTO, author: KONTO, neededValidations: 2, assignments: [], asset: null,
  createdAt: "2026-10-21T00:00:00Z", history: [] }));
const scrollen = Element.prototype.scrollIntoView;
let client: QueryClient;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let stempel = "p2-vorher";
let halten = false;
let entzogen = false;
const gehalten: { url: string; freigeben: () => void }[] = [];
const abrufe: string[] = [];

async function ruhe() {
  await act(async () => { await new Promise<void>((r) => setTimeout(r, 0)); });
}
async function bis(p: () => boolean) {
  for (let i = 0; i < 200; i++) { await ruhe(); if (p()) return; }
  throw new Error("Kontrollierter RC3-P2-Portzustand nicht erreicht");
}
function gib(url?: string) {
  for (let i = gehalten.length - 1; i >= 0; i--)
    if (url === undefined || gehalten[i]?.url === url) gehalten.splice(i, 1)[0]?.freigeben();
}
async function zeige(fragen: boolean) {
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client },
      createElement(RechtekontextWache, { kontoId: KONTO }),
      createElement(MemoryRouter, { initialEntries: ["/fragen"] },
        createElement(ToastProvider, null, fragen ? createElement(Ask) : createElement("div", null, "Andere Seite")))));
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  sessionStorage.clear();
  rechtekontextZuruecksetzen();
  stempel = "p2-vorher";
  halten = false;
  entzogen = false;
  gehalten.length = 0;
  abrufe.length = 0;
  Element.prototype.scrollIntoView = () => {};
  for (const konto of [KONTO, ANDERES]) arbeitsstandSchreiben(localStorage, konto, {
    entwurf: ENTWURF,
    antwort: { frage: FRAGE, result: RESULT, receipt: "p2-originaler-receipt", verschlossen: [],
      gapId: null, angezeigtAm: new Date().toISOString(), serverQuellenStand: { "p2-nord": 1, "p2-frei": 1 } },
    startadressen: ["p2-verbrauchte-adresse"], fragekontext: { werk: "Fiktives Werk" },
  });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    abrufe.push(url);
    if (!url.startsWith("/api/") || url === "/api/ask" || (init?.method ?? "GET") !== "GET")
      throw new Error("Kein Schreib-/Ask-/Provider-/Fremdaufruf in RC3-P2");
    const kopf = stempel;
    let daten: unknown;
    if (url === "/api/kos") daten = entzogen ? kos.slice(1) : kos;
    else if (url === "/api/conflicts" || url === "/api/directory") daten = [];
    else if (url === "/api/reasoner/status") daten = { active: true, mode: "cloud", tasks: { answer: true } };
    else if (url === "/api/auth/me") daten = { id: KONTO, role: "experte" };
    else throw new Error(`Nicht benötigter RC3-P2-Port ${url}`);
    if (halten && (url === "/api/kos" || url === "/api/conflicts"))
      await new Promise<void>((r) => gehalten.push({ url, freigeben: r }));
    return new Response(JSON.stringify(daten), { status: 200,
      headers: { "content-type": "application/json", "x-klarwerk-rechtekontext": kopf } });
  });
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(["auth", "me"], { id: KONTO, role: "experte" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  halten = false;
  gib();
  await act(async () => { root?.unmount(); });
  root = null;
  client.clear();
  container.remove();
  Element.prototype.scrollIntoView = scrollen;
  rechtekontextZuruecksetzen();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("RC3-P2: erkannter Wechsel ohne montierte Ask-Seite sperrt gespeicherte Mischantwort bei Rückkehr; nur zwei neue echte erlaubte Lesungen öffnen", async () => {
  await zeige(true);
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success" &&
    client.getQueryState(["conflicts"])?.status === "success");
  expect(container.textContent).toContain(MISCHTEXT);
  const eigenerStand = structuredClone(arbeitsstandLesen(localStorage, KONTO));
  const andererStand = structuredClone(arbeitsstandLesen(localStorage, ANDERES));
  if (!eigenerStand?.antwort) throw new Error("Eigener normaler Antwortarbeitsstand fehlt");
  expect(eigenerStand?.antwort?.rechtepruefungAusstehend).toBeUndefined();
  await zeige(false);
  stempel = "p2-entzogen";
  halten = true;
  entzogen = true;
  const vorher = anfrageEpoche();
  // Echte Antwort eines anderen Inhaltsports erkennt den Wechsel, während nur die Wache montiert ist.
  await act(async () => { await api.get("/directory"); });
  await bis(() => client.getQueryData(["kos", undefined]) === undefined);
  expect(anfrageEpoche()).toBe(vorher + 1);
  expect(arbeitsstandLesen(localStorage, ANDERES)).toEqual(andererStand);
  const markiert = arbeitsstandLesen(localStorage, KONTO);
  expect(markiert).toEqual({ ...eigenerStand, antwort: { ...eigenerStand.antwort, rechtepruefungAusstehend: true } });
  // Alte erfolgreiche Cachewerte allein sind keine aktuelle Freigabe für den markierten Stand.
  client.setQueryData(["kos", undefined], kos);
  client.setQueryData(["conflicts"], []);
  await zeige(true);
  await bis(() => gehalten.some((h) => h.url === "/api/kos") && gehalten.some((h) => h.url === "/api/conflicts"));
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.entwurf).toBe(ENTWURF);
  await act(async () => { gib("/api/kos"); });
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  await act(async () => { halten = false; gib(); });
  await bis(() => client.getQueryState(["conflicts"])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort?.rechtepruefungAusstehend).toBe(true);
  stempel = "p2-wieder-erlaubt";
  halten = true;
  entzogen = false;
  await act(async () => { await api.get("/directory"); });
  await bis(() => gehalten.some((h) => h.url === "/api/kos") && gehalten.some((h) => h.url === "/api/conflicts"));
  await act(async () => { client.setQueryData(["kos", undefined], kos); client.setQueryData(["conflicts"], []); });
  expect(container.textContent).not.toContain(MARKE);
  await act(async () => { gib("/api/kos"); });
  await bis(() => client.getQueryState(["kos", undefined])?.fetchStatus === "idle");
  expect(container.textContent).not.toContain(MARKE);
  await act(async () => { halten = false; gib(); });
  await bis(() => container.textContent?.includes(MISCHTEXT) === true);
  const wieder = arbeitsstandLesen(localStorage, KONTO);
  expect(wieder?.entwurf).toBe(eigenerStand?.entwurf);
  expect(wieder?.antwort?.receipt).toBe(eigenerStand?.antwort?.receipt);
  expect(wieder?.antwort?.result).toEqual(eigenerStand?.antwort?.result);
  expect(wieder?.antwort?.rechtepruefungAusstehend).toBeUndefined();
  expect(abrufe.some((u) => u === "/api/ask" || !u.startsWith("/api/"))).toBe(false);
});
