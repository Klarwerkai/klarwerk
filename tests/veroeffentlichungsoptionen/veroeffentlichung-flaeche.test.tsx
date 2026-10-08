// @vitest-environment jsdom
// ================================================================================================
// VERÖFFENTLICHUNG · DIE FLÄCHE AM EINTRAG, GEGEN DIE ECHTE ANWENDUNG.
// ================================================================================================
//
// Die Fläche (`VeroeffentlichungBereich`) wird in jsdom montiert; ihr `fetch` geht über
// `app.inject` an die echte App (In-Memory-Ablage). Jeder Aufruf wird mitgeschrieben — damit ist
// messbar, dass Anzeigen und Wählen nichts schreiben und erst der Knopf genau einmal veröffentlicht.
// Fiktive Beispielkonten.
//
//   F1  (K1, K3) Keine Vorauswahl; jede Wahl erklärt SOFORT Zustand, Sichtbarkeit und Empfänger;
//       Wählen schreibt nichts; der Knopf veröffentlicht genau einmal mit der gewählten Meldung.
//   F2  (K4) Ein Leser sieht eindeutig: V1 veröffentlicht, aktuelle V2 ist Entwurf — und keine
//       Veröffentlichungswahl.
//   F3  (K5) Offene und überholte Kenntnisnahmen stehen sichtbar an der Wahl.
//   F4  (K1) Dieselbe Erklärung in Englisch.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { VeroeffentlichungBereich } from "../../apps/web/src/components/veroeffentlichung/VeroeffentlichungBereich";
import i18n from "../../apps/web/src/i18n";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let adminToken = "";
let adminId = "";
let flaechenToken = "";
/** Jeder Aufruf der Fläche: Methode, Pfad und Rumpf. */
let aufrufe: Array<{ methode: string; url: string; rumpf?: string }> = [];

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const rumpf = init?.body === undefined || init?.body === null ? undefined : String(init.body);
    aufrufe.push({ methode, url, ...(rumpf === undefined ? {} : { rumpf }) });
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
      ...(rumpf === undefined ? {} : { payload: rumpf }),
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

/** Ein Eintrag mit gültiger Fassung V1. */
async function gueltigerEintrag(): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Absperrschieber vor Wartung schließen",
      statement: "Vor jeder Wartung den Absperrschieber schließen und sichern.",
      type: "best_practice",
      category: "Anlage Beispiel",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
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

async function montieren(koId: string): Promise<HTMLDivElement> {
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
        createElement(VeroeffentlichungBereich, { koId }),
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
const wahlFeld = (wo: HTMLElement, wert: string): HTMLInputElement | undefined =>
  [...wo.querySelectorAll<HTMLInputElement>('[data-testid="veroeffentlichung-wahl"]')].find(
    (w) => w.value === wert,
  );

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@veroeff-flaeche.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@veroeff-flaeche.test");
  adminId = (await services.auth.listUsers())[0]?.id ?? "";
  aufrufe = [];
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
});

describe("F1 · jede Wahl erklärt sofort, was danach gilt — erst der Knopf veröffentlicht", () => {
  it("still, normal, hervorgehoben: Zustand, Sichtbarkeit, Empfänger; ein POST mit der Wahl", async () => {
    const clara = await konto("controller", "clara@veroeff-flaeche.test", "Clara Controller");
    await konto("experte", "erik@veroeff-flaeche.test", "Erik Experte");
    await konto("viewer", "vera@veroeff-flaeche.test", "Vera Viewer");
    const id = await gueltigerEintrag();
    flaechenToken = clara.token;
    const flaeche = await montieren(id);

    expect(el(flaeche, "veroeffentlichung-stand")?.textContent).toBe("Noch nicht veröffentlicht.");
    expect(el(flaeche, "veroeffentlichung-aktuell")?.textContent).toBe(
      "Die aktuelle Fassung V1 ist gültig, aber noch nicht veröffentlicht.",
    );
    expect(flaeche.textContent).toContain("nicht öffentlich im Internet");
    // Keine Vorauswahl: ohne Wahl keine Wirkung und kein freier Knopf.
    expect(el(flaeche, "veroeffentlichung-wirkung")).toBeNull();
    const knopf = (): HTMLButtonElement | null =>
      flaeche.querySelector<HTMLButtonElement>('[data-testid="veroeffentlichung-absenden"]');
    expect(knopf()?.disabled).toBe(true);

    await act(async () => {
      wahlFeld(flaeche, "still")?.click();
    });
    expect(el(flaeche, "veroeffentlichung-wirkung-zustand")?.textContent).toContain(
      "Fassung V1 ist danach veröffentlicht (neue Veröffentlichung)",
    );
    expect(el(flaeche, "veroeffentlichung-wirkung-sichtbarkeit")?.textContent).toContain(
      "lesen dürfen genau 4 Person(en) (Stufe: intern)",
    );
    expect(el(flaeche, "veroeffentlichung-wirkung-empfaenger")?.textContent).toBe(
      "Benachrichtigung: niemand. Der Eintrag bleibt für Berechtigte auffindbar, und die Veröffentlichung steht im Verlauf.",
    );

    await act(async () => {
      wahlFeld(flaeche, "normal")?.click();
    });
    expect(el(flaeche, "veroeffentlichung-wirkung-empfaenger")?.textContent).toBe(
      "Benachrichtigung: 3 Person(en) bekommen eine Meldung in der Glocke — Ada Admin, Erik Experte, Vera Viewer.",
    );

    await act(async () => {
      wahlFeld(flaeche, "hervorgehoben")?.click();
    });
    const hervor = el(flaeche, "veroeffentlichung-wirkung-empfaenger")?.textContent ?? "";
    expect(hervor).toContain("dieselben 3 Person(en) wie bei „Normal“");
    expect(hervor).toContain("Niemand bekommt dadurch zusätzliche Leserechte.");
    expect(knopf()?.textContent).toBe("Fassung V1 veröffentlichen (Hervorgehoben)");

    // Anzeigen und Wählen haben nichts geschrieben.
    expect(aufrufe.filter((a) => a.methode !== "GET")).toEqual([]);

    await act(async () => {
      knopf()?.click();
      knopf()?.click();
      await flush();
    });
    await act(flush);
    const schreibend = aufrufe.filter((a) => a.methode === "POST");
    expect(schreibend).toHaveLength(1);
    expect(schreibend[0]?.url).toBe(`/api/kos/${id}/veroeffentlichung`);
    expect(JSON.parse(schreibend[0]?.rumpf ?? "{}")).toEqual({
      fassung: 1,
      meldung: "hervorgehoben",
    });
    expect(el(flaeche, "veroeffentlichung-erfolg")?.textContent).toBe(
      "Fassung V1 ist veröffentlicht. Benachrichtigt: 3 Person(en).",
    );
    expect(el(flaeche, "veroeffentlichung-stand")?.textContent).toMatch(
      /^Veröffentlicht: Fassung V1 am .+ von Clara Controller\.$/,
    );
    expect(el(flaeche, "veroeffentlichung-hindernis")?.textContent).toBe(
      "Diese Fassung ist bereits veröffentlicht.",
    );
    const zeile = el(flaeche, "veroeffentlichung-verlauf-zeile");
    expect(zeile?.getAttribute("data-meldung")).toBe("hervorgehoben");
    expect(zeile?.textContent).toContain(
      "neue Veröffentlichung · Hervorgehoben · Clara Controller",
    );
  });
});

describe("F2 · veröffentlichte Fassung und Entwurf sind für Leser eindeutig", () => {
  it("V1 veröffentlicht, V2 Entwurf — und keine Wahl für eine Leserin", async () => {
    const clara = await konto("controller", "clara@veroeff-flaeche.test", "Clara Controller");
    const vera = await konto("viewer", "vera@veroeff-flaeche.test", "Vera Viewer");
    const id = await gueltigerEintrag();
    const pub = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/veroeffentlichung`,
      headers: { authorization: `Bearer ${clara.token}` },
      payload: { fassung: 1, meldung: "normal" },
    });
    expect(pub.statusCode).toBe(201);
    await services.ko.revise(id, { statement: "Fassung 2: zusätzlich Schild anbringen." }, adminId);

    flaechenToken = vera.token;
    const flaeche = await montieren(id);
    expect(el(flaeche, "veroeffentlichung-stand")?.textContent).toMatch(
      /^Veröffentlicht: Fassung V1 am .+ von Clara Controller\.$/,
    );
    expect(el(flaeche, "veroeffentlichung-aktuell")?.textContent).toBe(
      "Die aktuelle Fassung V2 ist noch nicht gültig (Entwurf oder in Prüfung) und nicht veröffentlicht.",
    );
    expect(flaeche.querySelectorAll('[data-testid="veroeffentlichung-wahl"]')).toHaveLength(0);
    expect(el(flaeche, "veroeffentlichung-absenden")).toBeNull();
    expect(aufrufe.map((a) => `${a.methode} ${a.url}`)).toEqual([
      `GET /api/kos/${id}/veroeffentlichung`,
    ]);
  });
});

describe("F3 · angeforderte Kenntnisnahmen stehen an der Wahl", () => {
  it("offene Kenntnisnahme: bleibt auch bei „Still“; überholte nach Aktualisierung: genannt", async () => {
    const clara = await konto("controller", "clara@veroeff-flaeche.test", "Clara Controller");
    const erik = await konto("experte", "erik@veroeff-flaeche.test", "Erik Experte");
    const id = await gueltigerEintrag();
    const anforderung = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/kenntnisnahmen`,
      headers: { authorization: `Bearer ${clara.token}` },
      payload: { fassung: 1, empfaenger: [erik.id] },
    });
    expect(anforderung.statusCode).toBe(201);

    flaechenToken = clara.token;
    let flaeche = await montieren(id);
    expect(el(flaeche, "veroeffentlichung-kenntnisnahme-offen")?.textContent).toBe(
      "1 angeforderte Kenntnisnahme(n) dieser Fassung sind offen. Sie bleiben bestehen und werden weiter gemeldet — auch bei „Still“.",
    );
    await abbauen();

    await app.inject({
      method: "POST",
      url: `/api/kos/${id}/veroeffentlichung`,
      headers: { authorization: `Bearer ${clara.token}` },
      payload: { fassung: 1, meldung: "still" },
    });
    await services.ko.revise(id, { statement: "Fassung 2: neue Grenzwerte." }, adminId);
    await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
    flaeche = await montieren(id);
    expect(el(flaeche, "veroeffentlichung-kenntnisnahme-ueberholt")?.textContent).toBe(
      "1 Kenntnisnahme(n) einer früheren Fassung sind durch diese Fassung überholt und werden nicht mehr gemeldet. Fordere sie für V2 neu an, wenn sie gelten sollen.",
    );
  });
});

describe("F4 · dieselbe Erklärung auf Englisch", () => {
  it("Silent / Normal / Highlighted mit Zustand, Sichtbarkeit und Empfängern", async () => {
    const clara = await konto("controller", "clara@veroeff-flaeche.test", "Clara Controller");
    const id = await gueltigerEintrag();
    await i18n.changeLanguage("en");
    flaechenToken = clara.token;
    const flaeche = await montieren(id);
    await act(async () => {
      wahlFeld(flaeche, "normal")?.click();
    });
    expect(flaeche.textContent).toContain("not public on the internet");
    expect(el(flaeche, "veroeffentlichung-wirkung-zustand")?.textContent).toContain(
      "version V1 is published afterwards (new publication)",
    );
    expect(el(flaeche, "veroeffentlichung-wirkung-sichtbarkeit")?.textContent).toContain(
      "exactly 2 person(s) may read it (level: internal)",
    );
    expect(el(flaeche, "veroeffentlichung-wirkung-empfaenger")?.textContent).toBe(
      "Notification: 1 person(s) get a message in the bell — Ada Admin.",
    );
  });
});
