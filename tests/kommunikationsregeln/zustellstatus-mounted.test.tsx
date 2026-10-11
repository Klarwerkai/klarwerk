// @vitest-environment jsdom
// ================================================================================================
// ADMIN-12 · Nacharbeit 1 — DER ZUSTELLSTATUS LIEST BEIM AUFKLAPPEN FRISCH (K4).
// ================================================================================================
//
// Befund (Smoke `kommunikation-browser.spec.ts:233`): die Leserin hatte ihre Glocke geöffnet (als
// gesehen markiert), das wieder aufgeklappte Zustellstatus-Feld zeigte aber weiter „zugestellt".
// Ursache: die Anwendung hält Antworten 30 s für frisch (`main.tsx`, `staleTime`), das Feld las
// deshalb beim erneuten Aufklappen den alten Stand. Gemessen wird hier die echte Fläche
// (`VeroeffentlichungBereich`) mit DENSELBEN Zwischenspeicherwerten gegen die echte Anwendung
// (`app.inject`). Fiktive Konten.
//
// GEGENPROBE (benannt, nicht gefahren): `staleTime: 0` / `refetchOnMount` an der Zustellstatus-
// Abfrage entfernen → der Fall bleibt bei „zugestellt" stehen und wird rot.
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
let flaechenToken = "";
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    const rumpf = init?.body === undefined || init?.body === null ? undefined : String(init.body);
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${flaechenToken}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url: String(eingabe),
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

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function warteAuf<T>(finde: () => T | null | undefined, was: string): Promise<T> {
  for (let i = 0; i < 40; i += 1) {
    const treffer = finde();
    if (treffer) {
      return treffer;
    }
    await act(flush);
  }
  throw new Error(`nicht erschienen: ${was}`);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  transportEinhaengen();
});

afterEach(async () => {
  if (root) {
    const wurzel = root;
    await act(async () => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
});

describe("K4 · der Zustellstatus zeigt nach dem Lesen „gelesen“ — auch mit Betriebs-Zwischenspeicher", () => {
  it("zugestellt → Leser markiert gesehen → Wiederaufklappen zeigt gelesen", async () => {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Ada Admin", email: "ada@zustellstatus.test", password: "secret123" },
    });
    const adaToken = await anmelden("ada@zustellstatus.test");
    const erik = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { authorization: `Bearer ${adaToken}` },
      payload: {
        name: "Erik Experte",
        email: "erik@zustellstatus.test",
        password: "secret123",
        role: "experte",
      },
    });
    expect(erik.statusCode).toBe(201);
    const erikToken = await anmelden("erik@zustellstatus.test");

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: { authorization: `Bearer ${adaToken}` },
      payload: {
        confidentiality: "intern",
        title: "Prüfmittel ausgeben",
        statement: "Prüfmittel werden nur gegen Quittung ausgegeben.",
        type: "best_practice",
        category: "Anlage Beispiel",
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const id = (angelegt.json() as { id: string }).id;
    await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
    const pub = await app.inject({
      method: "POST",
      url: `/api/kos/${id}/veroeffentlichung`,
      headers: { authorization: `Bearer ${adaToken}` },
      payload: { fassung: 1, meldung: "normal" },
    });
    expect(pub.statusCode).toBe(201);
    const vermerk = (pub.json() as { vermerk: { id: string } }).vermerk.id;
    // Erik ruft seine Glocke ab → zugestellt.
    const feed = await app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${erikToken}` },
    });
    expect(feed.statusCode).toBe(200);

    flaechenToken = adaToken;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const wurzel = root;
    // Dieselben Werte wie im Betrieb (`apps/web/src/main.tsx`): 30 s gilt eine Antwort als frisch.
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: false } },
    });
    await act(async () => {
      wurzel.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(VeroeffentlichungBereich, { koId: id }),
        ),
      );
    });
    const flaeche = container;
    const knopf = await warteAuf(
      () =>
        flaeche.querySelector<HTMLButtonElement>(
          '[data-testid="veroeffentlichung-zustellung-umschalten"]',
        ),
      "Zustellstatus-Knopf",
    );
    const person = (): HTMLElement | null =>
      flaeche.querySelector<HTMLElement>('[data-testid="veroeffentlichung-zustellung-person"]');

    await act(async () => knopf.click());
    const erst = await warteAuf(person, "Zeile der Empfängerin");
    expect(erst.getAttribute("data-glocke")).toBe("zugestellt");

    const gesehen = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: { authorization: `Bearer ${erikToken}` },
      payload: { ids: [`pub-${vermerk}`] },
    });
    expect(gesehen.statusCode).toBe(200);

    await act(async () => knopf.click());
    expect(person()).toBeNull();
    await act(async () => knopf.click());
    const danach = await warteAuf(
      () => (person()?.getAttribute("data-glocke") === "gelesen" ? person() : null),
      "Status „gelesen“ nach dem Wiederaufklappen",
    );
    expect(danach.textContent).toContain("Erik Experte");
  });
});
