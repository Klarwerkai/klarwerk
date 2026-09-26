// @vitest-environment jsdom
// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · DER HINWEIS IN DER ECHTEN LESEFLÄCHE.
// ================================================================================================
//
// Gebaut wie `tests/wiki-bearbeitung/speichern-bricht-unterwegs-ab.test.tsx`: unter der echten
// Lesefläche `BibliothekLesen` in jsdom steht die ECHTE Fastify-Anwendung über `app.inject`.
// Ersetzt ist nur der Transport — und dort nur, was ein Verbindungsabbruch braucht (`offline`).
// Das zweite Konto handelt über die echten Routen.
//
//   F1  Anna bearbeitet; Bernd sieht in der Fläche, WER bearbeitet — ohne Kontaktdaten (K1). Anna
//       beendet; nach dem nächsten Abruf (Takt, kein Nachhelfen) sagt die Fläche das Ende und
//       liest den Eintrag neu (K3).
//   F2  Bernd bearbeitet selbst: der Server kennt seinen Hinweis; Anna speichert dazwischen, Bernds
//       Speichern läuft in den vorhandenen Konflikt, sein Text bleibt, der Hinweis bleibt; bewusstes
//       Abbrechen nimmt ihn zurück (K3/K4/K5).
//   F3  Verbindungsabbruch: die Fläche sagt es, der Text bleibt; nach Rückkehr wird der Serverstand
//       neu gelesen, der Text steht noch da (K3).
//   F4  Fremdes Beenden trifft Bernds Hinweis nicht, und sein Text bleibt (K2/K3).
//   F5  Rechteentzug mitten im Bearbeiten: der Hinweis endet, der Text bleibt (K6, Flächenhälfte).
//   F6  DE/EN/NL erklären Hinweis, Ablauf und Konflikt; der Schliessen-Griff ist ein Knopf (K7).
//   F7  Gegenprobe (K7): eine Ablage, die keine Bearbeitung meldet, lässt F1s Prüfung scheitern.
//
// BENANNTE PRÜFLÜCKEN: Speicherablagen, jsdom (kein Layout, keine echte Tastatur), ein Prozess.
// Echte Browser, PostgreSQL und zwei App-Prozesse misst die `.integration`-Datei daneben.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BibliothekLesen } from "../../apps/web/src/components/bibliothek/BibliothekLesen";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import type { BearbeitungsRepo } from "../../services/app/src/bearbeitungshinweis";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
let adminToken = "";
let anna = { id: "", token: "" };
let bernd = { id: "", token: "" };
/** Mit wessen Anmeldung die Fläche spricht. */
let flaechenToken = "";
/** Verbindung der Fläche: aus heisst, jeder Aufruf scheitert wie ohne Netz. */
let offline = false;
/** Wie oft die Fläche den Eintrag selbst gelesen hat — der Beleg für „neu gelesen". */
let eintragAbrufe = 0;
let eintragPfad = "";

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (offline) {
      throw new TypeError("Failed to fetch");
    }
    if (methode === "GET" && url === eintragPfad) {
      eintragAbrufe++;
    }
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

async function token(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(
  rolle: string,
  email: string,
  name: string,
): Promise<{ id: string; token: string }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await token(email) };
}

async function eintrag(): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

const api = (wer: string, methode: "GET" | "PUT" | "DELETE", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

interface Lage {
  bearbeitungen: Array<{ name: string; eigen: boolean; sitzung?: string }>;
}
const lageVon = async (wer: string, id: string): Promise<Lage> =>
  (await api(wer, "GET", `/api/kos/${id}/bearbeitungen`)).json() as Lage;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(koId: string, bearbeiten: boolean): Promise<void> {
  eintragPfad = `/api/kos/${koId}`;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wurzel = root;
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [bearbeiten ? "/bibliothek?edit=1" : "/bibliothek"] },
                  createElement(BibliothekLesen, {
                    koId,
                    suchtext: "",
                    treffer: [],
                    onGeloescht: () => {},
                    hinweisSchonGesagt: true,
                    lesevarianteSchonGesagt: true,
                  }),
                  createElement(ToastViewport, null),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

const suche = (testId: string): HTMLElement | null =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Wartet ECHTE Zeit, bis die Bedingung gilt — der Takt der Fläche arbeitet, nicht der Test. */
async function bis(bedingung: () => boolean, was: string, ms = 9_000): Promise<void> {
  const ende = Date.now() + ms;
  while (Date.now() < ende) {
    if (bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
      await flush();
    });
  }
  throw new Error(`nicht eingetreten: ${was}`);
}

/** Dasselbe für eine Frage an den Server (der Abmeldeaufruf der Fläche läuft ohne Warten). */
async function amServerBis(bedingung: () => Promise<boolean>, was: string): Promise<void> {
  const ende = Date.now() + 5_000;
  while (Date.now() < ende) {
    if (await bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
      await flush();
    });
  }
  throw new Error(`nicht eingetreten: ${was}`);
}

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

function knopfMitText(beschriftung: string): HTMLButtonElement {
  const treffer = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === beschriftung,
  );
  if (!treffer) {
    throw new Error(`Der Knopf „${beschriftung}" steht nicht auf der Fläche`);
  }
  return treffer;
}

function aussagefeld(): HTMLTextAreaElement {
  const gefunden = [...document.body.querySelectorAll("label")]
    .find((l) => l.querySelector("span")?.textContent?.trim() === i18n.t("capture.fStatement"))
    ?.querySelector<HTMLTextAreaElement>("textarea");
  if (!gefunden) {
    throw new Error("Das Feld „Aussage“ steht nicht auf der Fläche");
  }
  return gefunden;
}

async function tippen(ziel: HTMLTextAreaElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setzer?.call(ziel, wert);
    ziel.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Die Erneuerung sofort anstossen — derselbe Griff, den der Browser bei Rückkehr des Netzes tut. */
async function netzereignis(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event("online"));
    await flush();
  });
  await act(flush);
}

/**
 * K1 als Prüfung — als Funktion, damit F7 sie an einer blinden Ablage scheitern sehen kann: die
 * Fläche nennt den Namen des anderen Kontos im Bearbeitungshinweis, aber keine Kontaktdaten.
 */
function pruefeFremdanzeige(name: string, email: string): void {
  const hinweis = suche("bib-bearbeitung-fremd");
  expect(hinweis, "der Bearbeitungshinweis steht auf der Fläche").not.toBeNull();
  expect(text(hinweis)).toContain(i18n.t("bearbeitung.fremd", { name, seit: "" }).split("(")[0]);
  expect(document.body.textContent ?? "").not.toContain(email);
}

const MEIN_TEXT = "Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";

beforeEach(async () => {
  app = buildApp(buildServices());
  offline = false;
  eintragAbrufe = 0;
  transportEinhaengen();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pedi@klarwerk.test");
  anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
  bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");
  flaechenToken = bernd.token;
  await i18n.changeLanguage("de");
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });
});

afterEach(async () => {
  offline = false;
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  qc.clear();
});

describe("F1 · Anna bearbeitet — Bernd sieht es, und er sieht das Ende", () => {
  it("Name ohne Kontakt, Ende über den Takt der Fläche, danach wird neu gelesen", async () => {
    const id = await eintrag();
    expect(
      (await api(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`)).statusCode,
    ).toBe(200);
    await mount(id, false);
    await bis(() => suche("bib-bearbeitung-fremd") !== null, "Hinweis auf Annas Bearbeitung");
    pruefeFremdanzeige("Anna Beispiel", "anna@klarwerk.test");
    expect(text(suche("bib-bearbeitung-fremd"))).toContain(
      i18n.t("bearbeitung.erklaerung", { minuten: 2 }),
    );

    const abrufeVorher = eintragAbrufe;
    expect(
      (await api(anna.token, "DELETE", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`)).statusCode,
    ).toBe(200);
    // Kein Nachhelfen: der Abruftakt der Fläche muss das Ende von selbst bringen.
    await bis(() => suche("bib-bearbeitung-beendet") !== null, "Satz über das Ende");
    expect(suche("bib-bearbeitung-fremd")).toBeNull();
    expect(text(suche("bib-bearbeitung-beendet"))).toContain(
      i18n.t("bearbeitung.beendet", { name: "Anna Beispiel" }),
    );
    await bis(() => eintragAbrufe > abrufeVorher, "der Eintrag wird neu gelesen");

    // Der Schliessen-Griff ist ein echter Knopf (Tastaturweg) und räumt den Satz weg.
    const schliessen = suche("bib-bearbeitung-beendet-schliessen");
    expect(schliessen?.tagName).toBe("BUTTON");
    expect((schliessen as HTMLButtonElement).tabIndex).toBeGreaterThanOrEqual(0);
    await klick(schliessen as HTMLElement);
    expect(suche("bib-bearbeitung-beendet")).toBeNull();
  }, 30_000);
});

describe("F2 · Bernd bearbeitet selbst — Konflikt statt stillem Überschreiben", () => {
  it("Hinweis am Server, Konflikt beim Speichern, Text bleibt, Abbrechen nimmt den Hinweis", async () => {
    const id = await eintrag();
    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);
    const bei = await lageVon(anna.token, id);
    expect(bei.bearbeitungen.map((b) => `${b.name}:${b.eigen}`)).toEqual(["Bernd Beispiel:false"]);

    // Anna speichert dazwischen — auf dem bedingten Weg.
    const fassung = ((await api(anna.token, "GET", `/api/kos/${id}`)).json() as { version: number })
      .version;
    const fremd = await api(anna.token, "PUT", `/api/kos/${id}`, {
      action: "revise",
      changes: { statement: "Annas Fassung.", type: "best_practice" },
      expectedVersion: fassung,
    });
    expect(fremd.statusCode).toBe(200);

    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    const lage = suche("bib-speichern-lage");
    expect(lage?.getAttribute("data-lage")).toBe("stale");
    expect(aussagefeld().value).toBe(MEIN_TEXT);
    const amServer = (
      (await api(adminToken, "GET", `/api/kos/${id}`)).json() as { statement: string }
    ).statement;
    expect(amServer).toBe("Annas Fassung.");
    // Der Hinweis steht weiter — die Arbeit ist ja noch da.
    expect((await lageVon(anna.token, id)).bearbeitungen).toHaveLength(1);
    // Die vorhandenen Vergleichs-/Übernahmewege stehen bereit (JOB 4075).
    expect(suche("bib-speichern-neu-lesen")).not.toBeNull();
    expect(suche("bib-speichern-trotzdem")).not.toBeNull();

    await klick(knopfMitText(i18n.t("ko.cancelEdit")));
    await amServerBis(
      async () => (await lageVon(anna.token, id)).bearbeitungen.length === 0,
      "Abbrechen nimmt den Hinweis zurück",
    );
  }, 30_000);

  it("Speichern ohne Konflikt nimmt den Hinweis zurück", async () => {
    const id = await eintrag();
    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);
    expect((await lageVon(anna.token, id)).bearbeitungen).toHaveLength(1);
    await klick(knopfMitText(i18n.t("ko.saveEdit")));
    await act(flush);
    const amServer = (
      (await api(adminToken, "GET", `/api/kos/${id}`)).json() as { statement: string }
    ).statement;
    expect(amServer).toBe(MEIN_TEXT);
    await amServerBis(
      async () => (await lageVon(anna.token, id)).bearbeitungen.length === 0,
      "Speichern nimmt den Hinweis zurück",
    );
  }, 30_000);
});

describe("F3 · Verbindungsabbruch: die Arbeit bleibt, nach Rückkehr wird neu gelesen", () => {
  it("unterbrochen → Satz, Text unverändert; zurück → Serverstand neu gelesen, Text noch da", async () => {
    const id = await eintrag();
    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);

    offline = true;
    await netzereignis();
    const eigen = suche("bib-bearbeitung-eigen");
    expect(eigen?.getAttribute("data-lage")).toBe("unterbrochen");
    expect(text(eigen)).toBe(i18n.t("bearbeitung.eigenUnterbrochen", { minuten: 2 }));
    expect(aussagefeld().value).toBe(MEIN_TEXT);

    const abrufeVorher = eintragAbrufe;
    offline = false;
    await netzereignis();
    await bis(
      () => suche("bib-bearbeitung-eigen")?.getAttribute("data-lage") === "zurueck",
      "Rückkehr gemeldet",
    );
    await bis(() => eintragAbrufe > abrufeVorher, "Serverstand neu gelesen");
    expect(aussagefeld().value).toBe(MEIN_TEXT);
    expect((await lageVon(anna.token, id)).bearbeitungen).toHaveLength(1);
  }, 30_000);
});

describe("F4 · fremdes Beenden trifft Bernds Hinweis nicht", () => {
  it("Anna schickt Bernds Sitzungskennung — nichts endet, Bernds Text bleibt", async () => {
    const id = await eintrag();
    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);
    const eigene = (await lageVon(bernd.token, id)).bearbeitungen.find((b) => b.eigen);
    expect(eigene?.sitzung).toBeTruthy();
    const versuch = await api(
      anna.token,
      "DELETE",
      `/api/kos/${id}/bearbeitungen/${eigene?.sitzung}`,
    );
    expect(versuch.json()).toEqual({ beendet: false });
    expect((await lageVon(anna.token, id)).bearbeitungen.map((b) => b.name)).toEqual([
      "Bernd Beispiel",
    ]);
    expect(aussagefeld().value).toBe(MEIN_TEXT);
  }, 30_000);
});

describe("F5 · Rechteentzug mitten im Bearbeiten", () => {
  it("die Erneuerung wird abgewiesen, die Fläche sagt es, der Text bleibt", async () => {
    const id = await eintrag();
    await mount(id, true);
    await tippen(aussagefeld(), MEIN_TEXT);
    const rolle = await api(adminToken, "PUT", `/api/users/${bernd.id}`, { role: "viewer" });
    expect(rolle.statusCode).toBe(200);
    await netzereignis();
    const eigen = suche("bib-bearbeitung-eigen");
    expect(eigen?.getAttribute("data-lage")).toBe("ohneRecht");
    expect(text(eigen)).toBe(i18n.t("bearbeitung.eigenOhneRecht"));
    expect(aussagefeld().value).toBe(MEIN_TEXT);
  }, 30_000);
});

describe("F6 · DE/EN/NL erklären Hinweis, Ablauf und Konflikt", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: Hinweis und Ablauf stehen in der Sprache der Fläche`, async () => {
      await i18n.changeLanguage(sprache);
      const id = await eintrag();
      await api(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`);
      await mount(id, false);
      await bis(() => suche("bib-bearbeitung-fremd") !== null, "Hinweis");
      const satz = text(suche("bib-bearbeitung-fremd"));
      const erklaerung = i18n.t("bearbeitung.erklaerung", { minuten: 2 });
      expect(satz).toContain(i18n.t("bearbeitung.titel"));
      expect(satz).toContain(erklaerung);
      expect(satz).not.toContain("bearbeitung.");
      // Die drei Sprachen sind wirklich drei — nicht dreimal der deutsche Satz.
      if (sprache !== "de") {
        expect(erklaerung).not.toBe(i18n.getFixedT("de")("bearbeitung.erklaerung", { minuten: 2 }));
      }
    }, 30_000);
  }
});

describe("F7 · Gegenprobe: eine Ablage ohne Meldungen macht F1 rot", () => {
  it("fehlt die Fremdanzeige, schlägt pruefeFremdanzeige an", async () => {
    const services = buildServices();
    const blind: BearbeitungsRepo = {
      melde: (koId, nutzer, sitzung) => services.bearbeitungen.melde(koId, nutzer, sitzung),
      beende: (koId, nutzerId, sitzung) => services.bearbeitungen.beende(koId, nutzerId, sitzung),
      laufende: async () => ({ jetzt: new Date().toISOString(), bearbeitungen: [] }),
    };
    services.bearbeitungen = blind;
    app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
    });
    adminToken = await token("pedi@klarwerk.test");
    anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");
    flaechenToken = bernd.token;
    const id = await eintrag();
    await api(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`);
    await mount(id, false);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
      await flush();
    });
    expect(() => pruefeFremdanzeige("Anna Beispiel", "anna@klarwerk.test")).toThrow();
  }, 30_000);
});
