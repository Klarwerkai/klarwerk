// @vitest-environment jsdom
// RC3-P2-S: erkannte Änderung bei weiter lesbarem Altstand und tatsächlich fehlgeschlagenem setItem.
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
import { rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";
import { Ask } from "../../apps/web/src/pages/Ask";

const KONTO = "rc3-p2s-eigenes-konto";
const ANDERES = "rc3-p2s-anderes-konto";
const MARKE = "Fiktive-RC3-P2-S-Quelle";
const MISCHTEXT = `${MARKE}: Messwert 73. Freier Prüfhinweis.`;
const ENTWURF = "Meine freie bearbeitete Frage für morgen";
const FRAGE = "Welche fiktive Prüfung ist vorgesehen?";
const RESULT: AnswerResult = {
  answered: true,
  answer: MISCHTEXT,
  knowledgeClass: "gesichert",
  trust: 90,
  sources: ["p2s-nord", "p2s-frei"],
  citedSources: ["p2s-nord", "p2s-frei"],
  steps: [],
  demo: false,
};
const kos = RESULT.sources.map((id, i) => ({
  id,
  title: i ? "Fiktive freie Quelle" : MARKE,
  statement: "Fiktiver Prüfhinweis",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "RC3 fiktiv",
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
  createdAt: "2026-10-21T00:00:00Z",
  history: [],
}));
const scrollen = Element.prototype.scrollIntoView;
let client: QueryClient;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let stempel = "p2s-vorher";
let halten = false;
let entzogen = false;
const gehalten: { url: string; freigeben: () => void }[] = [];
const abrufe: string[] = [];

async function ruhe() {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
}
async function bis(p: () => boolean) {
  for (let i = 0; i < 200; i++) {
    await ruhe();
    if (p()) return;
  }
  throw new Error("Kontrollierter RC3-P2-S-Portzustand nicht erreicht");
}
function gib(url?: string) {
  for (let i = gehalten.length - 1; i >= 0; i--)
    if (url === undefined || gehalten[i]?.url === url) gehalten.splice(i, 1)[0]?.freigeben();
}
async function zeige(fragen: boolean) {
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement<{ kontoId: string }>(RechtekontextWache, { kontoId: KONTO }),
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(
            ToastProvider,
            null,
            fragen ? createElement(Ask) : createElement("div", null, "Andere Seite"),
          ),
        ),
      ),
    );
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  sessionStorage.clear();
  rechtekontextZuruecksetzen();
  bestaetigeNeueAntwort(KONTO);
  stempel = "p2s-vorher";
  halten = false;
  entzogen = false;
  gehalten.length = 0;
  abrufe.length = 0;
  Element.prototype.scrollIntoView = () => {};
  for (const konto of [KONTO, ANDERES])
    arbeitsstandSchreiben(localStorage, konto, {
      entwurf: ENTWURF,
      antwort: {
        frage: FRAGE,
        result: RESULT,
        receipt: "p2s-originaler-receipt",
        verschlossen: [],
        gapId: null,
        angezeigtAm: new Date().toISOString(),
        serverQuellenStand: { "p2s-nord": 1, "p2s-frei": 1 },
      },
      startadressen: ["p2s-verbrauchte-adresse"],
      fragekontext: { werk: "Fiktives Werk" },
    });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    abrufe.push(url);
    if (!url.startsWith("/api/") || url === "/api/ask" || (init?.method ?? "GET") !== "GET")
      throw new Error("Kein Schreib-/Ask-/Provider-/Fremdaufruf in RC3-P2-S");
    const kopf = stempel;
    let daten: unknown;
    if (url === "/api/kos") daten = entzogen ? kos.slice(1) : kos;
    else if (url === "/api/conflicts" || url === "/api/directory") daten = [];
    else if (url === "/api/reasoner/status")
      daten = { active: true, mode: "cloud", tasks: { answer: true } };
    else if (url === "/api/auth/me") daten = { id: KONTO, role: "experte" };
    else throw new Error(`Nicht benötigter RC3-P2-S-Port ${url}`);
    if (halten && (url === "/api/kos" || url === "/api/conflicts"))
      await new Promise<void>((r) => gehalten.push({ url, freigeben: r }));
    return new Response(JSON.stringify(daten), {
      status: 200,
      headers: { "content-type": "application/json", "x-klarwerk-rechtekontext": kopf },
    });
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: KONTO, role: "experte" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  halten = false;
  gib();
  await act(async () => {
    root?.unmount();
  });
  root = null;
  client.clear();
  container.remove();
  Element.prototype.scrollIntoView = scrollen;
  rechtekontextZuruecksetzen();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("RC3-P2-S: fehlgeschlagene Bereinigungsschreibung entfernt den alten Klartext trotzdem; zwei neue erlaubte Reads und Eigenarbeit bleiben", async () => {
  await zeige(true);
  await bis(
    () =>
      client.getQueryState(["kos", undefined])?.status === "success" &&
      client.getQueryState(["conflicts"])?.status === "success",
  );
  expect(container.textContent).toContain(MISCHTEXT);
  await zeige(false);
  const key = `kw.fragen.arbeitsstand.v1:${KONTO}`;
  const rohVorher = localStorage.getItem(key);
  const eigenVorher = structuredClone(arbeitsstandLesen(localStorage, KONTO));
  const fremdVorher = structuredClone(arbeitsstandLesen(localStorage, ANDERES));
  if (!rohVorher || !eigenVorher?.antwort)
    throw new Error("Normaler lesbarer eigener Antwortstand fehlt");
  expect(eigenVorher.antwort.rechtepruefungAusstehend).toBeUndefined();
  const setItem = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    k: string,
    v: string,
  ) {
    if (this === localStorage && k === key)
      throw new DOMException("Fiktive volle Speicherquote", "QuotaExceededError");
    setItem.call(this, k, v);
  });
  stempel = "p2s-erkannter-wechsel";
  halten = true;
  await act(async () => {
    await api.get("/directory");
  });
  await bis(() => client.getQueryData(["kos", undefined]) === undefined);
  expect(quota).toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull();
  expect(arbeitsstandLesen(localStorage, ANDERES)).toEqual(fremdVorher);
  expect(arbeitsstandLesen(localStorage, KONTO)).toEqual({
    ...eigenVorher,
    antwort: null,
  });
  client.setQueryData(["kos", undefined], kos);
  client.setQueryData(["conflicts"], []);
  await zeige(true);
  await bis(
    () =>
      gehalten.some((h) => h.url === "/api/kos") &&
      gehalten.some((h) => h.url === "/api/conflicts"),
  );
  expect(container.textContent).not.toContain(MARKE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.entwurf).toBe(ENTWURF);
  expect(localStorage.getItem(key)).toBeNull();
  await act(async () => {
    gib("/api/kos");
  });
  await bis(() => client.getQueryState(["kos", undefined])?.status === "success");
  expect(container.textContent).not.toContain(MARKE);
  await act(async () => {
    halten = false;
    gib();
  });
  await bis(() => client.getQueryState(["conflicts"])?.fetchStatus === "idle");
  expect(container.textContent).not.toContain(MISCHTEXT);
  // Trotz weiter fehlgeschlagener Speicherung bestätigen erst beide tatsächlichen erlaubten Reads die Anzeige.
  expect(localStorage.getItem(key)).toBeNull();
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
  expect(arbeitsstandLesen(localStorage, KONTO)?.fragenFaden).toContain(FRAGE);
  expect(arbeitsstandLesen(localStorage, KONTO)?.entwurf).toBe(eigenVorher.entwurf);
  quota.mockRestore();
  await zeige(false);
  await zeige(true);
  await bis(
    () =>
      client.getQueryState(["conflicts"])?.status === "success" &&
      arbeitsstandLesen(localStorage, KONTO)?.antwort === null,
  );
  expect(arbeitsstandLesen(localStorage, KONTO)?.antwort).toBeNull();
  expect(localStorage.getItem(key)).not.toContain(MARKE);
  expect(container.textContent).not.toContain(MISCHTEXT);
  expect(arbeitsstandLesen(localStorage, ANDERES)).toEqual(fremdVorher);
  expect(abrufe.some((u) => u === "/api/ask" || !u.startsWith("/api/"))).toBe(false);
});
