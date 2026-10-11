// @vitest-environment jsdom
// ================================================================================================
// ADMIN-12 · DIE SEITE „MELDUNGEN UND KANÄLE“, GEMOUNTET GEGEN DIE ECHTE ANWENDUNG.
// ================================================================================================
//
// Die Seite (`pages/Kommunikation.tsx`) wird in jsdom montiert; ihr `fetch` geht über `app.inject`
// an die echte App (In-Memory-Ablage, ohne Mailversand). Jeder Aufruf wird mitgeschrieben — damit
// ist messbar, dass Anzeigen nichts schreibt und eine Änderung genau einmal gespeichert wird.
// Fiktive Beispielkonten.
//
//   S1  (K1) Jedes Konto sieht je Ereignis Zielgruppe, Kanäle samt Zustand, Häufigkeit und Abwahl;
//       still/normal/hervorgehoben/Aktualisierung und die verbindliche Kenntnisnahme sind erklärt.
//       Wer nicht verwalten darf, bekommt keine Bearbeitung angeboten.
//   S2  (K1) Die eigene Abwahl: speichern, nach dem Neuladen noch gesetzt; die verbindliche
//       Kenntnisnahme ist nicht abwählbar.
//   S3  (K4, K6) Die Verwaltung: Mail ist ohne eingerichteten Versand gesperrt und sagt warum; eine
//       Änderung wird genau einmal gespeichert, steht im Protokoll und gilt nach dem Neuladen.
//   S4  (K6) Mehrbenutzerfall: eine inzwischen fremd gespeicherte Fassung wird nicht überschrieben;
//       die Fläche sagt verständlich, was zu tun ist.
//   S5  (K1) Dieselbe Übersicht auf Englisch.
//
// WAS HIER NICHT GEMESSEN IST: Layout bei 390 px, Fokusring und Tastaturweg im echten Browser — das
// misst `tests-smoke/kommunikation-browser.spec.ts`. Und KEIN Mensch: ob die Erklärung verstanden
// wird, beobachtet dieser Prüfstand nicht.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import i18n from "../../apps/web/src/i18n";
import { Kommunikation } from "../../apps/web/src/pages/Kommunikation";
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
let adaToken = "";
let veraToken = "";
let flaechenToken = "";
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

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Montiert die Seite frisch — mit neuem Zwischenspeicher, also wie ein Neuladen. */
async function montieren(token: string): Promise<HTMLDivElement> {
  await abbauen();
  flaechenToken = token;
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
        createElement(
          MemoryRouter,
          { initialEntries: ["/kommunikation"] },
          createElement(NavGuardProvider, null, createElement(Kommunikation)),
        ),
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
const alle = (wo: HTMLElement, testId: string): HTMLElement[] => [
  ...wo.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`),
];
const zeile = (wo: HTMLElement, testId: string, ereignis: string): HTMLElement | undefined =>
  alle(wo, testId).find((z) => z.getAttribute("data-ereignis") === ereignis);
const schreibend = () => aufrufe.filter((a) => a.methode !== "GET");

/**
 * Wartet, bis `finde` etwas liefert. Die eigenen Einstellungen fragt die Seite erst NACH den Regeln
 * ab (zweite Abfrage) — ein fester Takt reicht dafür nicht immer.
 */
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

async function waehle(feld: HTMLSelectElement, wert: string): Promise<void> {
  await act(async () => {
    const setzer = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function klicke(element: HTMLElement | null | undefined): Promise<void> {
  expect(element, "Element fehlt").toBeTruthy();
  await act(async () => {
    element?.click();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@kommunikation-seite.test", password: "secret123" },
  });
  adaToken = await anmelden("ada@kommunikation-seite.test");
  const vera = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adaToken}` },
    payload: {
      name: "Vera Viewer",
      email: "vera@kommunikation-seite.test",
      password: "secret123",
      role: "viewer",
    },
  });
  expect(vera.statusCode).toBe(201);
  veraToken = await anmelden("vera@kommunikation-seite.test");
  aufrufe = [];
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
});

describe("S1 · die Übersicht erklärt Ereignis, Zielgruppe, Kanäle, Häufigkeit und Wirkung", () => {
  it("eine Leserin sieht alle Regeln, aber keine Bearbeitung; Anzeigen schreibt nichts", async () => {
    const seite = await montieren(veraToken);
    expect(el(seite, "page-kommunikation")?.textContent).toContain("Meldungen und Kanäle");
    expect(alle(seite, "kommunikation-ereignis")).toHaveLength(9);

    const normal = zeile(seite, "kommunikation-ereignis", "veroeffentlichung");
    expect(normal?.querySelector("h3")?.textContent).toBe(
      "Veröffentlichung oder Aktualisierung (normal)",
    );
    expect(el(normal as HTMLElement, "kommunikation-zielgruppe")?.textContent).toBe(
      "Alle, die den Eintrag lesen dürfen — außer der veröffentlichenden Person",
    );
    const kanaele = alle(normal as HTMLElement, "kommunikation-kanal").map(
      (k) => `${k.getAttribute("data-kanal")}=${k.getAttribute("data-zustand")}`,
    );
    expect(kanaele).toEqual([
      "glocke=aktiv",
      "mail=nicht_eingerichtet",
      "push=nicht_angeschlossen",
    ]);
    expect(el(normal as HTMLElement, "kommunikation-haeufigkeit")?.textContent).toBe("sofort");
    expect(el(normal as HTMLElement, "kommunikation-abwahl")?.textContent).toBe("abwählbar");

    const kn = zeile(seite, "kommunikation-ereignis", "kenntnisnahme");
    expect(el(kn as HTMLElement, "kommunikation-haeufigkeit")?.textContent).toBe(
      "sofort · mit Erinnerung",
    );
    expect(el(kn as HTMLElement, "kommunikation-abwahl")?.textContent).toBe(
      "verbindlich — muss bestätigt werden",
    );

    const wirkung = alle(seite, "kommunikation-wirkung-zeile").map((z) =>
      z.getAttribute("data-wirkung"),
    );
    expect(wirkung).toEqual([
      "still",
      "normal",
      "hervorgehoben",
      "aktualisierung",
      "unabhaengig",
      "zusammenfassung",
      "kenntnisnahme",
    ]);
    const still = alle(seite, "kommunikation-wirkung-zeile")[0]?.textContent ?? "";
    expect(still).toContain("Eine angeforderte Kenntnisnahme wird trotzdem gemeldet.");

    expect(el(seite, "kommunikation-vorgaben")).toBeNull();
    expect(el(seite, "kommunikation-nur-lesen")?.textContent).toContain("nur die Verwaltung");
    expect(el(seite, "kommunikation-zurueck")).toBeNull();
    expect(schreibend()).toEqual([]);
  });
});

describe("S2 · die eigene Abwahl — gespeichert, nach dem Neuladen gesetzt", () => {
  it("normal abwählen; die verbindliche Kenntnisnahme ist gesperrt", async () => {
    let seite = await montieren(veraToken);
    const kn = await warteAuf(
      () => zeile(seite, "kommunikation-meine-zeile", "kenntnisnahme"),
      "eigene Einstellung Kenntnisnahme",
    );
    const knFeld = kn.querySelector<HTMLInputElement>("input");
    expect(knFeld?.checked).toBe(true);
    expect(knFeld?.disabled).toBe(true);
    expect(kn.textContent).toContain("verbindlich — muss bestätigt werden");

    const normal = zeile(seite, "kommunikation-meine-zeile", "veroeffentlichung");
    const feld = normal?.querySelector<HTMLInputElement>("input");
    expect(feld?.checked).toBe(true);
    // Das Feld ist über sein Label benannt — für Tastatur und Vorleser.
    expect(seite.querySelector(`label[for="${feld?.id}"]`)?.textContent).toContain("Erhalten");
    await klicke(feld);
    expect(schreibend()).toEqual([
      {
        methode: "PUT",
        url: "/api/meldungsregeln/meine",
        rumpf: JSON.stringify({ ereignis: "veroeffentlichung", abgewaehlt: true }),
      },
    ]);
    expect(el(seite, "kommunikation-meine-gespeichert")?.textContent).toBe("Gespeichert.");

    seite = await montieren(veraToken);
    const neu = seite;
    const danach = await warteAuf(
      () => zeile(neu, "kommunikation-meine-zeile", "veroeffentlichung"),
      "eigene Einstellung nach dem Neuladen",
    );
    expect(danach.querySelector<HTMLInputElement>("input")?.checked).toBe(false);
  });
});

describe("S3 · die Verwaltung ändert Vorgaben — nur angeschlossene Kanäle, mit Protokoll", () => {
  it("Mail gesperrt mit Grund; Häufigkeit ändern speichert genau einmal und gilt nach dem Neuladen", async () => {
    let seite = await montieren(adaToken);
    expect(el(seite, "kommunikation-vorgaben-stand")?.textContent).toBe(
      "Werksvorgabe — noch nie geändert.",
    );
    expect(el(seite, "kommunikation-zurueck")?.getAttribute("href")).toBe("/admin");
    const vorgabe = zeile(seite, "kommunikation-vorgabe", "veroeffentlichung") as HTMLElement;
    const mail = el(vorgabe, "kommunikation-vorgabe-mail") as HTMLInputElement;
    expect(mail.disabled).toBe(true);
    const grund = seite.querySelector(`#${mail.getAttribute("aria-describedby")}`);
    expect(grund?.textContent).toBe(
      "Mailversand ist in dieser Instanz nicht eingerichtet — Mail kann nicht aktiviert werden.",
    );
    expect(seite.textContent).toContain(
      "Push ist nicht angeschlossen und kann nicht gewählt werden.",
    );
    // Die Kenntnisnahme steht nicht unter den einstellbaren Vorgaben.
    expect(zeile(seite, "kommunikation-vorgabe", "kenntnisnahme")).toBeUndefined();

    await waehle(el(vorgabe, "kommunikation-vorgabe-haeufigkeit") as HTMLSelectElement, "taeglich");
    expect(schreibend()).toEqual([]);
    await klicke(el(seite, "kommunikation-vorgaben-speichern"));
    const gespeichert = schreibend();
    expect(gespeichert).toHaveLength(1);
    expect(gespeichert[0]?.url).toBe("/api/admin/kommunikation/regeln");
    expect(JSON.parse(gespeichert[0]?.rumpf ?? "{}")).toMatchObject({
      version: 0,
      vorgaben: { veroeffentlichung: { haeufigkeit: "taeglich", mail: false } },
    });
    expect(el(seite, "kommunikation-vorgaben-ergebnis")?.textContent).toBe(
      "Gespeichert als Fassung 1.",
    );
    expect(alle(seite, "kommunikation-protokoll-zeile")[0]?.textContent).toMatch(
      /^Fassung 1 · Ada Admin · /,
    );

    seite = await montieren(adaToken);
    expect(el(seite, "kommunikation-vorgaben-stand")?.textContent).toMatch(
      /^Fassung 1 · geändert von Ada Admin am /,
    );
    const neu = zeile(seite, "kommunikation-vorgabe", "veroeffentlichung") as HTMLElement;
    expect((el(neu, "kommunikation-vorgabe-haeufigkeit") as HTMLSelectElement).value).toBe(
      "taeglich",
    );
    const uebersicht = zeile(seite, "kommunikation-ereignis", "veroeffentlichung") as HTMLElement;
    expect(el(uebersicht, "kommunikation-haeufigkeit")?.textContent).toBe(
      "tägliche Zusammenfassung",
    );
    const protokoll = await services.audit.list({ action: "kommunikationsregeln.geaendert" });
    expect(protokoll).toHaveLength(1);
  });
});

describe("S4 · Mehrbenutzerfall: nichts wird still überschrieben", () => {
  it("eine inzwischen fremd gespeicherte Fassung führt zu einer verständlichen Meldung", async () => {
    const seite = await montieren(adaToken);
    // Eine zweite Sitzung derselben Verwaltung speichert zwischendurch.
    const fremd = await app.inject({
      method: "PUT",
      url: "/api/admin/kommunikation/regeln",
      headers: { authorization: `Bearer ${adaToken}` },
      payload: { version: 0, vorgaben: { wirkung: { abwaehlbar: false } } },
    });
    expect(fremd.statusCode).toBe(200);
    const vorgabe = zeile(seite, "kommunikation-vorgabe", "veroeffentlichung") as HTMLElement;
    await klicke(el(vorgabe, "kommunikation-vorgabe-abwaehlbar"));
    await klicke(el(seite, "kommunikation-vorgaben-speichern"));
    const fehler = el(seite, "kommunikation-vorgaben-fehler");
    expect(fehler?.getAttribute("role")).toBe("alert");
    expect(fehler?.textContent).toBe(
      "Die Vorgaben wurden inzwischen von jemand anderem geändert. Lade die Seite neu und prüfe deine Änderung erneut.",
    );
    // Gespeichert ist allein die fremde Fassung.
    expect(await services.audit.list({ action: "kommunikationsregeln.geaendert" })).toHaveLength(1);
  });
});

describe("S5 · dieselbe Übersicht auf Englisch", () => {
  it("Titel, Kanalzustand und Kenntnisnahme in Englisch", async () => {
    await i18n.changeLanguage("en");
    const seite = await montieren(veraToken);
    expect(el(seite, "page-kommunikation")?.textContent).toContain("Notifications and channels");
    const normal = zeile(seite, "kommunikation-ereignis", "veroeffentlichung") as HTMLElement;
    expect(alle(normal, "kommunikation-kanal").map((k) => k.textContent)).toEqual([
      "Bell: active",
      "Email: not set up",
      "Push: not connected",
    ]);
    const kn = zeile(seite, "kommunikation-ereignis", "kenntnisnahme") as HTMLElement;
    expect(el(kn, "kommunikation-abwahl")?.textContent).toBe("mandatory — must be confirmed");
  });
});
