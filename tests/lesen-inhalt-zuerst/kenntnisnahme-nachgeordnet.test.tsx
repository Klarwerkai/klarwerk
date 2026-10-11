// @vitest-environment jsdom
// ================================================================================================
// LESEN-INHALT-ZUERST · DIE KENNTNISNAHME NACHGEORDNET — UND DIE PFLICHT BLEIBT WIRKSAM.
// ================================================================================================
//
// Auftrag `produkt:20261007:lesen-inhalt-zuerst`, Kriterium 2: „Bei nicht angeforderter
// Kenntnisnahme blockiert keine große Bestätigungsfläche den Inhalt; tatsächliche
// Pflichtkenntnisnahme bleibt wirksam."
//
// Die Fläche wird in jsdom montiert, ihr `fetch` geht über `app.inject` an die ECHTE App
// (In-Memory-Ablage) — dieselbe Vorrichtung wie `tests/kenntnisnahme/kenntnisnahme-flaeche.test.tsx`.
// Montiert wird in der Reihenfolge der Lesespalte: Verweis oben, Inhalt, Fläche danach.
//
//   N1  Zuweisungsrecht OHNE eigene Anforderung → eine zugeklappte Zeile, kein Bestätigen-Knopf,
//       kein Verweis oben. Aufgeklappt fordert sie unverändert an (ein POST).
//   N2  EIGENE Anforderung → oben ein Satz mit Sprung; der Sprung fokussiert den Bestätigen-Knopf
//       unten; erst der Klick bestätigt (ein POST), danach verschwindet der Verweis.
//   N3  Ohne Recht und ohne Anforderung → nichts, und Verweis und Fläche teilen EINE Abfrage.
//
// Die Lage im Bild (Höhe < 80 px, 390 × 844) misst `tests-smoke/lesen-inhalt-zuerst-browser.spec.ts`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  KenntnisnahmeBereich,
  KenntnisnahmeVerweis,
} from "../../apps/web/src/components/kenntnisnahme/KenntnisnahmeBereich";
import i18n from "../../apps/web/src/i18n";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;

const ZIEL = "kenntnisnahme-ziel";
const EMPFAENGER_WAHL = '[data-testid="kenntnisnahme-empfaenger-wahl"]';

let services: AppServices;
let app: App;
let adminToken = "";
let adminId = "";
let flaechenToken = "";
let aufrufe: Array<{ methode: string; url: string }> = [];

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({ methode, url });
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${flaechenToken}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

/** Ein gültiger, fiktiver Eintrag in Fassung V2. */
async function gueltigerEintrag(): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Druckluftbehälter vor Inbetriebnahme prüfen",
      statement: "Regel 1: Sicherheitsventil prüfen und im Prüfbuch festhalten.",
      type: "best_practice",
      category: "Instandhaltung Beispiel",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  await services.ko.revise(id, { statement: "Fassung 2: zusätzlich Schild anbringen." }, adminId);
  await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  return id;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Verweis · Inhalt · Fläche — die Reihenfolge der Lesespalte. */
async function lesespalte(koId: string, darfAnfordern: boolean): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wurzel = root;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(KenntnisnahmeVerweis, { koId, zielId: ZIEL }),
        createElement("article", { "data-testid": "inhalt" }, "Regel 1"),
        createElement(KenntnisnahmeBereich, { koId, darfAnfordern, zielId: ZIEL }),
      ),
    );
  });
  await act(flush);
  return container;
}

async function abbauen(): Promise<void> {
  if (root) {
    const wurzel = root;
    await act(async () => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

const el = (wo: HTMLElement, testId: string): HTMLElement | null =>
  wo.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

const folgt = (a: Element, b: Element): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

const schreibend = (): string[] =>
  aufrufe.filter((a) => a.methode !== "GET").map((a) => `${a.methode} ${a.url}`);

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@lesen-inhalt.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@lesen-inhalt.test");
  adminId = (await services.auth.listUsers())[0]?.id ?? "";
  aufrufe = [];
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
});

describe("N1 · ohne eigene Anforderung: eine zugeklappte Zeile nach dem Inhalt", () => {
  it("Controller sieht keine Bestätigungsfläche, kann aber unverändert anfordern", async () => {
    const clara = await konto("controller", "clara@lesen-inhalt.test", "Clara Controller");
    await konto("experte", "erik@lesen-inhalt.test", "Erik Experte");
    const id = await gueltigerEintrag();
    flaechenToken = clara.token;
    const spalte = await lesespalte(id, true);

    const bereich = el(spalte, "kenntnisnahme-bereich");
    expect(bereich, "die Zeile fehlt für das Zuweisungsrecht").not.toBeNull();
    expect(bereich?.getAttribute("data-kenntnisnahme-lage")).toBe("nur-anfordern");
    expect(bereich?.id).toBe(ZIEL);
    expect(folgt(el(spalte, "inhalt") as Element, bereich as Element)).toBe(true);
    // Nichts verlangt: kein Verweis oben, kein Bestätigen-Knopf.
    expect(el(spalte, "kenntnisnahme-verweis")).toBeNull();
    expect(el(spalte, "kenntnisnahme-bestaetigen")).toBeNull();
    // Formular und Übersicht liegen zugeklappt in der Zeile.
    const zeile = el(spalte, "kenntnisnahme-verwalten") as HTMLDetailsElement | null;
    expect(zeile?.tagName).toBe("DETAILS");
    expect(zeile?.open).toBe(false);
    expect(zeile?.querySelector("summary")?.textContent).toContain(
      "Kenntnisnahme: anfordern und Übersicht",
    );
    expect(zeile?.contains(el(spalte, "kenntnisnahme-anfordern"))).toBe(true);
    expect(zeile?.textContent).toContain("keine elektronische Signatur");

    // Aufgeklappt fordert sie an wie bisher — genau ein POST.
    await act(async () => {
      if (zeile) {
        zeile.open = true;
      }
    });
    const optionen = [...spalte.querySelectorAll<HTMLInputElement>(EMPFAENGER_WAHL)];
    const wahl = optionen.find((w) => w.parentElement?.textContent?.includes("Erik Experte"));
    expect(wahl, "Erik steht nicht zur Wahl").toBeDefined();
    await act(async () => {
      wahl?.click();
    });
    await act(async () => {
      el(spalte, "kenntnisnahme-anfordern-absenden")?.click();
      await flush();
    });
    await act(flush);
    expect(schreibend()).toEqual([`POST /api/kos/${id}/kenntnisnahmen`]);
  });
});

describe("N2 · eigene Anforderung: Verweis oben, Bestätigen unten, nur per Klick", () => {
  it("der Sprung fokussiert den Knopf, erst der Klick bestätigt, danach ist der Verweis weg", async () => {
    const clara = await konto("controller", "clara@lesen-inhalt.test", "Clara Controller");
    const erik = await konto("experte", "erik@lesen-inhalt.test", "Erik Experte");
    const id = await gueltigerEintrag();
    const anforderung = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/kenntnisnahmen`,
      headers: { authorization: `Bearer ${clara.token}` },
      payload: { fassung: 2, empfaenger: [erik.id] },
    });
    expect(anforderung.statusCode).toBe(201);

    flaechenToken = erik.token;
    const spalte = await lesespalte(id, false);
    const verweis = el(spalte, "kenntnisnahme-verweis");
    const bereich = el(spalte, "kenntnisnahme-bereich");
    expect(verweis?.textContent).toContain("deine Kenntnisnahme angefordert");
    expect(bereich?.getAttribute("data-kenntnisnahme-lage")).toBe("pflicht-offen");
    // Reihenfolge: Verweis vor dem Inhalt, Bestätigen nach dem Inhalt.
    const inhalt = el(spalte, "inhalt") as Element;
    expect(folgt(verweis as Element, inhalt)).toBe(true);
    expect(folgt(inhalt, bereich as Element)).toBe(true);

    // Anzeigen schreibt nichts.
    expect(schreibend()).toEqual([]);

    // Der Sprung führt zum Knopf — und bestätigt selbst nichts.
    await act(async () => {
      el(spalte, "kenntnisnahme-verweis-sprung")?.click();
    });
    const knopf = el(spalte, "kenntnisnahme-bestaetigen");
    expect(knopf).not.toBeNull();
    expect(document.activeElement).toBe(knopf);
    expect(schreibend()).toEqual([]);

    // Erst der Klick bestätigt — genau ein POST.
    await act(async () => {
      knopf?.click();
      await flush();
    });
    await act(flush);
    const posts = schreibend();
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatch(/^POST \/api\/kenntnisnahmen\/[^/]+\/bestaetigen$/);
    expect(el(spalte, "kenntnisnahme-bestaetigt")?.textContent).toMatch(
      /^Du hast Fassung V2 am .+ zur Kenntnis genommen\.$/,
    );
    expect(el(spalte, "kenntnisnahme-verweis"), "der Verweis bleibt stehen").toBeNull();
  });
});

describe("N3 · Unbeteiligte: nichts, und nur eine Abfrage", () => {
  it("Viewer ohne Anforderung sieht weder Verweis noch Fläche", async () => {
    const vera = await konto("viewer", "vera@lesen-inhalt.test", "Vera Viewer");
    const id = await gueltigerEintrag();
    flaechenToken = vera.token;
    const spalte = await lesespalte(id, false);
    expect(el(spalte, "kenntnisnahme-verweis")).toBeNull();
    expect(el(spalte, "kenntnisnahme-bereich")).toBeNull();
    expect(aufrufe.map((a) => a.url)).toEqual(["/api/kenntnisnahmen/meine"]);
  });
});
