// @vitest-environment jsdom
// ================================================================================================
// ARTIKEL-GEMEINSAM · DIE SEITE „GEMEINSAM BEARBEITEN" IN DER FLÄCHE.
// ================================================================================================
//
// Gebaut wie `tests/wiki-bearbeitungsreservierung/hinweis-in-der-flaeche.test.tsx`: unter der
// echten Seite `GemeinsamerEntwurfSeite` (jsdom) steht die ECHTE Fastify-Anwendung über
// `app.inject`. Ersetzt ist nur der Transport — und dort nur, was ein Verbindungsabbruch braucht
// (`offline`). Bernd bedient die Fläche; Anna und Pedi handeln über die echten Routen.
//
//   F1 (K1/K3) Bernd sieht DENSELBEN Entwurf, den Anna begonnen hat, wer dabei ist und den
//              gespeicherten Stand mit Person — ohne Kontaktdaten.
//   F2 (K2)    Bernd tippt unten, Anna speichert oben: die Fläche sagt es; Speichern führt
//              zusammen, beide Änderungen stehen im Feld und am Server.
//   F3 (K2)    Beide ändern denselben Abschnitt: Konflikt mit beiden Fassungen, nichts
//              überschrieben, Bernds Text bleibt; „Beide behalten" + Speichern legt die Lösung ab.
//   F4 (K5)    Verbindungsabbruch: „unterbrochen", Text bleibt; nach einem Neuladen der Seite steht
//              die Eingabe wieder da und wird gespeichert.
//   F5 (K5)    Rechteentzug: „keine Rechte mehr", nichts gespeichert, Text bleibt, Kopieren da.
//   F6 (K4/K6) Lesefassung bleibt bis zur Übernahme; die Übernahme macht die neue Fassung über den
//              bestehenden Weg; die Seite meldet den Abschluss.
//   F7         DE/EN/NL: die Sätze stehen in der Sprache der Fläche, kein Schlüssel bleibt roh.
//
// BENANNTE PRÜFLÜCKEN: Speicherablagen, jsdom (kein Layout), ein Prozess. Echte Browser zeigt
// `tests-smoke/artikel-gemeinsam-browser.spec.ts`, PostgreSQL mit zwei App-Prozessen
// `gemeinsam-pg.integration.test.ts`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { GemeinsamerEntwurfSeite } from "../../apps/web/src/pages/GemeinsamerEntwurf";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

const KENNWORT = "secret123";
const TITEL = "Ventil X schließt bei Überdruck";
const A1 = "Bei Überdruck schließt Ventil X selbsttätig.";
const A2 = "Vorher den Druck über Ventil Y ablassen.";
const A3 = "Danach die Dichtheit prüfen.";
const TEXT = [A1, A2, A3].join("\n\n");
const A1_NEU = "Bei Überdruck schließt Ventil X selbsttätig und hörbar.";
const A3_NEU = "Danach die Dichtheit mit Lecksuchspray prüfen.";

let app: App;
let pedi = "";
let anna = { id: "", token: "" };
let bernd = { id: "", token: "" };
/** Mit wessen Anmeldung die Fläche spricht. */
let flaechenToken = "";
/** Verbindung der Fläche: aus heisst, jeder Aufruf scheitert wie ohne Netz. */
let offline = false;

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    if (offline) {
      throw new TypeError("Failed to fetch");
    }
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${flaechenToken}`;
    const antwort = await app.inject({
      method: (init?.method ?? "GET").toUpperCase() as "GET",
      url: String(eingabe),
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
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode).toBe(200);
  return (res.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${pedi}` },
    payload: { name, email, password: KENNWORT, role: rolle },
  });
  expect(res.statusCode).toBe(201);
  return { id: (res.json() as { id: string }).id, token: await anmelden(email) };
}

const api = (wer: string, methode: "GET" | "POST" | "PUT", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function artikelMitEntwurf(): Promise<string> {
  const res = await api(pedi, "POST", "/api/kos", {
    confidentiality: "intern",
    title: TITEL,
    statement: TEXT,
    bodyHtml: `<p>${A1}</p><p>${A2}</p><p>${A3}</p>`,
    type: "best_practice",
    category: "",
  });
  expect(res.statusCode).toBe(201);
  const koId = (res.json() as { id: string }).id;
  expect((await api(anna.token, "POST", `/api/kos/${koId}/gemeinsam`)).statusCode).toBe(201);
  return koId;
}

const amServer = async (koId: string): Promise<{ revision: number; text: string }> => {
  const lage = (await api(pedi, "GET", `/api/kos/${koId}/gemeinsam`)).json() as {
    entwurf: { revision: number; text: string };
  };
  return lage.entwurf;
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;
const neuerQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } } });

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(koId: string): Promise<void> {
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
                  { initialEntries: [`/wissen/${koId}/gemeinsam`] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id/gemeinsam",
                      element: createElement(GemeinsamerEntwurfSeite),
                    }),
                  ),
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

async function unmount(): Promise<void> {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
}

const suche = (testId: string): HTMLElement | null =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
const alle = (testId: string): HTMLElement[] => [
  ...document.body.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`),
];
const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Wartet ECHTE Zeit, bis die Bedingung gilt — der Abruftakt der Seite arbeitet, nicht der Test. */
async function bis(bedingung: () => boolean, was: string, ms = 12_000): Promise<void> {
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

async function klick(testId: string): Promise<void> {
  const ziel = suche(testId);
  if (!ziel) {
    throw new Error(`${testId} steht nicht auf der Fläche`);
  }
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

function feld(): HTMLTextAreaElement {
  const f = suche("gemeinsam-text");
  if (!(f instanceof HTMLTextAreaElement)) {
    throw new Error("Das Textfeld steht nicht auf der Fläche");
  }
  return f;
}

async function tippen(wert: string): Promise<void> {
  const ziel = feld();
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

const zustand = (): string | null =>
  suche("gemeinsam-speicherstand")?.getAttribute("data-zustand") ?? null;

beforeEach(async () => {
  app = buildApp(buildServices());
  offline = false;
  transportEinhaengen();
  window.sessionStorage.clear();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: KENNWORT },
  });
  pedi = await anmelden("pedi@klarwerk.test");
  anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
  bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");
  flaechenToken = bernd.token;
  await i18n.changeLanguage("de");
  qc = neuerQueryClient();
});

afterEach(async () => {
  offline = false;
  await unmount();
  qc.clear();
});

describe("F1 · derselbe Entwurf, wer dabei ist, was gespeichert ist (K1/K3)", () => {
  it("Bernd sieht Annas Entwurf, Annas Anwesenheit und den Speicherstand mit Person", async () => {
    const koId = await artikelMitEntwurf();
    const entwurfId = (
      (await api(anna.token, "GET", `/api/kos/${koId}/gemeinsam`)).json() as {
        entwurf: { id: string };
      }
    ).entwurf.id;
    await api(anna.token, "PUT", `/api/kos/${koId}/bearbeitungen/annas-sitzung-1`);
    await mount(koId);
    await bis(() => suche("gemeinsam-entwurf") !== null, "der Entwurf steht da");
    expect(suche("gemeinsam-entwurf")?.getAttribute("data-entwurf")).toBe(entwurfId);
    expect(feld().value).toBe(TEXT);
    expect(zustand()).toBe("gespeichert");
    expect(text(suche("gemeinsam-speicherstand"))).toContain("Anna Beispiel");
    await bis(
      () => text(suche("gemeinsam-anwesend-satz")).includes("Anna Beispiel"),
      "Anna ist als anwesend genannt",
    );
    expect(document.body.textContent ?? "").not.toContain("anna@klarwerk.test");
    // Bernd ist selbst angemeldet — am Server über den vorhandenen Bearbeitungshinweis.
    const namen = async (): Promise<string[]> =>
      (
        (await api(anna.token, "GET", `/api/kos/${koId}/bearbeitungen`)).json() as {
          bearbeitungen: Array<{ name: string }>;
        }
      ).bearbeitungen
        .map((b) => b.name)
        .sort();
    let gesehen: string[] = [];
    for (let i = 0; i < 50 && gesehen.length < 2; i++) {
      gesehen = await namen();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
        await flush();
      });
    }
    expect(gesehen).toEqual(["Anna Beispiel", "Bernd Beispiel"]);
  }, 30_000);
});

describe("F2 · verschiedene Abschnitte werden zusammengeführt (K2)", () => {
  it("die Fläche meldet Annas Stand; Speichern führt zusammen — beides im Feld und am Server", async () => {
    const koId = await artikelMitEntwurf();
    await mount(koId);
    await bis(() => suche("gemeinsam-text") !== null, "das Textfeld steht da");
    await tippen(TEXT.replace(A3, A3_NEU));
    expect(zustand()).toBe("ungespeichert");
    const anna2 = await api(anna.token, "PUT", `/api/kos/${koId}/gemeinsam`, {
      basisRevision: 1,
      titel: TITEL,
      text: TEXT.replace(A1, A1_NEU),
    });
    expect(anna2.statusCode).toBe(200);
    await bis(() => suche("gemeinsam-fremd") !== null, "Annas neuer Stand wird gemeldet");
    expect(text(suche("gemeinsam-fremd"))).toContain("Anna Beispiel");
    // Die eigene Eingabe wurde NICHT durch Annas Stand ersetzt.
    expect(feld().value).toContain(A3_NEU);

    await klick("gemeinsam-speichern");
    await bis(() => zustand() === "gespeichert", "gespeichert");
    expect(text(suche("gemeinsam-speicherstand"))).toBe(
      i18n.t("gemeinsam.speicher.zusammengefuehrt", { namen: "Anna Beispiel", revision: 3 }),
    );
    expect(feld().value).toContain(A1_NEU);
    expect(feld().value).toContain(A3_NEU);
    const server = await amServer(koId);
    expect(server.revision).toBe(3);
    expect(server.text).toBe([A1_NEU, A2, A3_NEU].join("\n\n"));
  }, 30_000);
});

describe("F3 · derselbe Abschnitt: konkret lösbarer Konflikt (K2)", () => {
  it("nichts überschrieben, Bernds Text bleibt; „Beide behalten“ und Speichern legen die Lösung ab", async () => {
    const koId = await artikelMitEntwurf();
    await mount(koId);
    await bis(() => suche("gemeinsam-text") !== null, "das Textfeld steht da");
    const berndsA2 = "Vorher den Druck über Ventil Z ablassen.";
    const annasA2 = "Vorher den Druck VOLLSTÄNDIG ablassen.";
    await tippen(TEXT.replace(A2, berndsA2));
    await api(anna.token, "PUT", `/api/kos/${koId}/gemeinsam`, {
      basisRevision: 1,
      titel: TITEL,
      text: TEXT.replace(A2, annasA2),
    });
    await klick("gemeinsam-speichern");
    await bis(() => suche("gemeinsam-konflikt") !== null, "der Konflikt steht da");
    expect(zustand()).toBe("konflikt");
    const stellen = alle("gemeinsam-konflikt-stelle");
    expect(stellen).toHaveLength(1);
    const stelle = stellen[0] as HTMLElement;
    const teil = (id: string): string => text(stelle.querySelector(`[data-testid="${id}"]`));
    expect(teil("gemeinsam-konflikt-meine")).toContain(berndsA2);
    const deren = teil("gemeinsam-konflikt-deren");
    expect(deren).toContain(annasA2);
    expect(deren).toContain("Anna Beispiel");
    // Nichts überschrieben: am Server steht Annas Stand, im Feld Bernds Text.
    expect((await amServer(koId)).text).toBe(TEXT.replace(A2, annasA2));
    expect(feld().value).toBe(TEXT.replace(A2, berndsA2));
    // Ohne Entscheidung lässt sich nichts übernehmen.
    expect((suche("gemeinsam-konflikt-uebernehmen") as HTMLButtonElement).disabled).toBe(true);

    await klick("gemeinsam-wahl-beide");
    await klick("gemeinsam-konflikt-uebernehmen");
    expect(suche("gemeinsam-konflikt")).toBeNull();
    const loesung = [A1, annasA2, berndsA2, A3].join("\n\n");
    expect(feld().value).toBe(loesung);
    await klick("gemeinsam-speichern");
    await bis(() => zustand() === "gespeichert", "gespeichert");
    expect((await amServer(koId)).text).toBe(loesung);
  }, 30_000);
});

describe("F4 · Verbindungsabbruch und Wiederaufnahme (K5)", () => {
  it("unterbrochen → Text bleibt; nach Neuladen steht die Eingabe wieder da und wird gespeichert", async () => {
    const koId = await artikelMitEntwurf();
    await mount(koId);
    await bis(() => suche("gemeinsam-text") !== null, "das Textfeld steht da");
    await tippen(TEXT.replace(A3, A3_NEU));
    offline = true;
    await klick("gemeinsam-speichern");
    await bis(() => zustand() === "unterbrochen", "die Fläche sagt „unterbrochen“");
    expect(text(suche("gemeinsam-speicherstand"))).toBe(i18n.t("gemeinsam.speicher.unterbrochen"));
    expect(feld().value).toContain(A3_NEU);
    expect((await amServer(koId)).revision).toBe(1);

    // Inzwischen speichert Anna oben; dann lädt Bernd die Seite neu (Netz wieder da).
    await api(anna.token, "PUT", `/api/kos/${koId}/gemeinsam`, {
      basisRevision: 1,
      titel: TITEL,
      text: TEXT.replace(A1, A1_NEU),
    });
    await unmount();
    offline = false;
    qc = neuerQueryClient();
    await mount(koId);
    await bis(() => suche("gemeinsam-wiederhergestellt") !== null, "Eingabe wiederhergestellt");
    expect(feld().value).toContain(A3_NEU);
    expect(zustand()).toBe("ungespeichert");
    await klick("gemeinsam-speichern");
    await bis(() => zustand() === "gespeichert", "gespeichert");
    expect((await amServer(koId)).text).toBe([A1_NEU, A2, A3_NEU].join("\n\n"));
    expect(window.sessionStorage.getItem(`klarwerk.gemeinsam.${koId}`)).toBeNull();
  }, 30_000);
});

describe("F5 · Rechteentzug mitten im Bearbeiten (K5)", () => {
  it("keine Rechte mehr: nichts gespeichert, Text bleibt, Kopieren steht bereit", async () => {
    const koId = await artikelMitEntwurf();
    await mount(koId);
    await bis(() => suche("gemeinsam-text") !== null, "das Textfeld steht da");
    await tippen(TEXT.replace(A3, A3_NEU));
    expect((await api(pedi, "PUT", `/api/users/${bernd.id}`, { role: "viewer" })).statusCode).toBe(
      200,
    );
    await klick("gemeinsam-speichern");
    await bis(() => zustand() === "ohneRecht", "die Fläche sagt „keine Rechte mehr“");
    expect(text(suche("gemeinsam-speicherstand"))).toBe(i18n.t("gemeinsam.speicher.ohneRecht"));
    expect(feld().value).toContain(A3_NEU);
    expect(suche("gemeinsam-kopieren")?.tagName).toBe("BUTTON");
    expect((await amServer(koId)).revision).toBe(1);
  }, 30_000);
});

describe("F6 · Lesefassung bis zur Übernahme, dann die neue Fassung (K4/K6)", () => {
  it("Speichern ändert den Artikel nicht; „Als neue Fassung übernehmen“ schon — über den bestehenden Weg", async () => {
    const koId = await artikelMitEntwurf();
    await mount(koId);
    await bis(() => suche("gemeinsam-text") !== null, "das Textfeld steht da");
    const lese = suche("gemeinsam-lesefassung-satz");
    expect(lese?.getAttribute("data-version")).toBe("1");
    await tippen(TEXT.replace(A3, A3_NEU));
    // Solange ungespeichert, ist Übernehmen gesperrt.
    expect((suche("gemeinsam-uebernehmen") as HTMLButtonElement).disabled).toBe(true);
    await klick("gemeinsam-speichern");
    await bis(() => zustand() === "gespeichert", "gespeichert");
    const vorher = (await api(pedi, "GET", `/api/kos/${koId}`)).json() as {
      version: number;
      statement: string;
    };
    expect(vorher).toMatchObject({ version: 1, statement: TEXT });

    expect(suche("gemeinsam-uebernahme")?.getAttribute("data-weg")).toBe("direkt");
    await klick("gemeinsam-uebernehmen");
    await bis(() => suche("gemeinsam-abgeschlossen") !== null, "Abschluss gemeldet");
    expect(suche("gemeinsam-abgeschlossen")?.getAttribute("data-zustand")).toBe("uebernommen");
    const nachher = (await api(pedi, "GET", `/api/kos/${koId}`)).json() as {
      version: number;
      statement: string;
      history: Array<{ version: number; author: string }>;
    };
    expect(nachher.version).toBe(2);
    expect(nachher.statement).toBe(TEXT.replace(A3, A3_NEU));
    expect(nachher.history[nachher.history.length - 1]).toMatchObject({
      version: 2,
      author: bernd.id,
    });
    await bis(
      () => suche("gemeinsam-lesefassung-satz")?.getAttribute("data-version") === "2",
      "die Lesefassung zeigt Fassung 2",
    );
  }, 30_000);
});

describe("F7 · DE/EN/NL", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: Speicherstand und Lesefassung in der Sprache der Fläche`, async () => {
      await i18n.changeLanguage(sprache);
      const koId = await artikelMitEntwurf();
      await mount(koId);
      await bis(() => suche("gemeinsam-speicherstand") !== null, "Speicherstand");
      const seite = text(suche("gemeinsam-seite"));
      expect(seite).toContain(i18n.t("gemeinsam.lesefassung.titel"));
      expect(seite).not.toMatch(/gemeinsam\.[a-z]+\.[a-zA-Z]+/);
      if (sprache !== "de") {
        expect(i18n.t("gemeinsam.speicher.unterbrochen")).not.toBe(
          i18n.getFixedT("de")("gemeinsam.speicher.unterbrochen"),
        );
      }
    }, 30_000);
  }
});
