// @vitest-environment jsdom
// ================================================================================================
// VERSTÄNDNISFRAGEN · DIE FLÄCHE AM EINTRAG UND IM LERNPFAD (aufnahme:20260922:gesamt-lernwege).
// ================================================================================================
//
// Die Flächen werden in jsdom montiert, ihr `fetch` geht über `app.inject` an die ECHTE App
// (In-Memory-Ablage) — dieselbe Vorrichtung wie `tests/lesen-inhalt-zuerst/…`. Getrennte, fiktive
// Beispieldaten.
//
//   U1  (K17/K18/K21) Lernende: Regel sichtbar, Abgrenzung sichtbar; unvollständig abgeben →
//       Rückmeldung nach der Regel mit Sprung an die Belegstelle der Fassung; Doppelklick schickt
//       EINE Abgabe; nach Neuladen steht das Ergebnis samt Rückmeldung wieder da.
//   U2  (K15/K16) Bearbeitung: Verantwortliche sehen Status und Befunde, Lernende nicht; ohne
//       wörtliche Belegstelle ist „Annehmen" gesperrt und der Befund benannt.
//   U3  (K21) Lernpfad: der zugeordnete Fragensatz mit Lage „bestanden"; Lesen, Verständnisfragen
//       und praktische Befähigung stehen getrennt da.
//   U4  (K19) Fachlich geänderte Quelle: Hinweis „zur erneuten Prüfung", kein Beantworten.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { LernpfadVerstaendnis } from "../../apps/web/src/components/verstaendnisfragen/LernpfadVerstaendnis";
import { VerstaendnisfragenBereich } from "../../apps/web/src/components/verstaendnisfragen/VerstaendnisfragenBereich";
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

const auf = (wer: string, methode: "GET" | "POST", url: string, body?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(body === undefined ? {} : { payload: body as Record<string, unknown> }),
  });

const V1 = "Vor dem Einschalten wird das Sicherheitsventil von Hand angelüftet.";
const V2 = `${V1} Der Prüfdruck beträgt 11 bar; das Ergebnis steht im Prüfbuch.`;

/** Ein Eintrag mit gültiger V2, verantwortet von `autor`. */
async function eintragV2(autor: { id: string; token: string }): Promise<string> {
  const angelegt = await auf(autor.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: "Druckluftbehälter prüfen (Beispiel)",
    statement: V1,
    type: "best_practice",
    category: "Instandhaltung Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;
  await services.ko.revise(id, { statement: V2 }, autor.id);
  await services.ko.setValidationState(id, { trust: 80, status: "validiert" });
  return id;
}

function inhalt(beleg2 = "Der Prüfdruck beträgt 11 bar") {
  return {
    koVersion: 2,
    titel: "Druckluft · Verständnis",
    rollen: ["viewer"],
    regel: { mindestRichtig: 2, hoechstVersuche: 3 },
    fragen: [
      {
        text: "Was wird von Hand angelüftet?",
        optionen: ["Das Sicherheitsventil", "Der Kompressor"],
        richtig: [0],
        erlaeuterung: "Die Anweisung nennt das Sicherheitsventil.",
        beleg: "das Sicherheitsventil von Hand angelüftet",
      },
      {
        text: "Wie hoch ist der Prüfdruck?",
        optionen: ["6 bar", "11 bar"],
        richtig: [1],
        erlaeuterung: "Fassung 2 nennt 11 bar.",
        beleg: beleg2,
      },
      {
        text: "Wo steht das Ergebnis?",
        optionen: ["Im Prüfbuch", "Nirgends"],
        richtig: [0],
        erlaeuterung: "Das Ergebnis steht im Prüfbuch.",
        beleg: "das Ergebnis steht im Prüfbuch",
      },
    ],
  };
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function montiere(element: ReturnType<typeof createElement>): Promise<HTMLDivElement> {
  await abbauen();
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
        createElement(MemoryRouter, { initialEntries: ["/wissen"] }, element),
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

const el = (wo: ParentNode, testId: string): HTMLElement | null =>
  wo.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

async function klick(knoten: HTMLElement | null | undefined): Promise<void> {
  expect(knoten, "Element zum Klicken fehlt").toBeTruthy();
  await act(async () => {
    knoten?.click();
  });
  await act(flush);
}

function option(wo: ParentNode, frage: string, opt: string): HTMLInputElement | null {
  return wo.querySelector<HTMLInputElement>(
    `[data-frage="${frage}"] [data-testid="verstaendnis-option"][data-option="${opt}"]`,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@verstaendnis-flaeche.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@verstaendnis-flaeche.test");
  aufrufe = [];
  transportEinhaengen();
});

afterEach(async () => {
  await abbauen();
});

/** Erik verantwortet, legt an und vor; Clara nimmt an. */
async function lage() {
  const clara = await konto("controller", "clara@verstaendnis-flaeche.test", "Clara Controller");
  const erik = await konto("experte", "erik@verstaendnis-flaeche.test", "Erik Experte");
  const vera = await konto("viewer", "vera@verstaendnis-flaeche.test", "Vera Viewer");
  const koId = await eintragV2(erik);
  const angelegt = await auf(erik.token, "POST", `/api/kos/${koId}/verstaendnisfragen`, inhalt());
  expect(angelegt.statusCode).toBe(201);
  const satzId = (angelegt.json() as { id: string }).id;
  const satz = `/api/verstaendnisfragen/${satzId}`;
  expect((await auf(erik.token, "POST", `${satz}/vorlegen`, { version: 1 })).statusCode).toBe(200);
  const entschieden = await auf(clara.token, "POST", `${satz}/entscheiden`, {
    version: 1,
    entscheidung: "annehmen",
  });
  expect(entschieden.statusCode).toBe(200);
  return { clara, erik, vera, koId, satzId };
}

describe("U1 · Lernende: Regel, Abgabe, Rückmeldung, Neuladen", () => {
  it("unvollständig → Rückmeldung nach der Regel; Doppelklick ist EINE Abgabe", async () => {
    const { vera, koId } = await lage();
    flaechenToken = vera.token;
    const flaeche = await montiere(createElement(VerstaendnisfragenBereich, { koId }));

    expect(el(flaeche, "verstaendnis-bereich")).not.toBeNull();
    expect(el(flaeche, "verstaendnis-abgrenzung")?.textContent).toContain(
      "kein Kompetenz- oder Befähigungsnachweis",
    );
    const regel = el(flaeche, "verstaendnis-regel")?.textContent ?? "";
    expect(regel).toContain("Bestanden ab 2 von 3 richtig beantworteten Fragen.");
    expect(regel).toContain("Unbeantwortete Fragen zählen als nicht richtig.");
    expect(el(flaeche, "verstaendnis-regel")?.textContent).toContain("Bis zu 3 Versuche");
    // Lernende sehen keine Bearbeitung.
    expect(el(flaeche, "verstaendnis-bearbeitung")).toBeNull();

    await klick(el(flaeche, "verstaendnis-beantworten"));
    await klick(option(flaeche, "f1", "o1"));
    await klick(option(flaeche, "f2", "o2"));
    expect(el(flaeche, "verstaendnis-unbeantwortet-hinweis")?.textContent).toContain(
      "Unbeantwortet: 1",
    );

    const knopf = el(flaeche, "verstaendnis-abgeben");
    await act(async () => {
      knopf?.click();
      knopf?.click();
    });
    await act(flush);
    const abgaben = aufrufe.filter((a) => a.methode === "POST" && a.url.endsWith("/versuche"));
    expect(abgaben).toHaveLength(1);

    const rueck = el(flaeche, "verstaendnis-rueckmeldung");
    expect(rueck).not.toBeNull();
    expect(el(flaeche, "verstaendnis-ergebnis")?.getAttribute("data-bestanden")).toBe("ja");
    expect(el(flaeche, "verstaendnis-ergebnis")?.textContent).toContain("2 von 3 richtig");
    expect(el(flaeche, "verstaendnis-unvollstaendig")?.textContent).toContain("1 unbeantwortet");
    const urteile = [...flaeche.querySelectorAll('[data-testid="verstaendnis-urteil"]')].map((u) =>
      u.getAttribute("data-urteil"),
    );
    expect(urteile).toEqual(["richtig", "richtig", "unbeantwortet"]);
    // Zurück zur relevanten Stelle: der Sprung trägt Passage und Fassung.
    const sprung = el(flaeche, "verstaendnis-zur-stelle") as HTMLAnchorElement | null;
    const ziel = new URL(sprung?.getAttribute("href") ?? "", "http://lokal");
    expect(ziel.pathname).toBe(`/wissen/${koId}`);
    expect(ziel.searchParams.get("fassung")).toBe("2");
    expect(ziel.searchParams.get("stelle")).toBe("das Sicherheitsventil von Hand angelüftet");

    // „Neuladen": neue Fläche, neuer Abruf — das Ergebnis samt Rückmeldung steht wieder da.
    const neu = await montiere(createElement(VerstaendnisfragenBereich, { koId }));
    const eigene = neu.querySelectorAll('[data-testid="verstaendnis-eigenes"]');
    expect(eigene).toHaveLength(1);
    expect(eigene[0]?.getAttribute("data-bestanden")).toBe("ja");
    await klick(el(neu, "verstaendnis-rueck-anzeigen"));
    expect(el(neu, "verstaendnis-rueckmeldung")).not.toBeNull();
    expect(el(neu, "verstaendnis-unvollstaendig")?.textContent).toContain("1 unbeantwortet");
  });
});

describe("U2 · Bearbeitung nur für Verantwortliche; Befunde statt Annahme", () => {
  it("Erik sieht Status und Belegstand, aber keinen Annehmen-Knopf", async () => {
    const { erik, koId } = await lage();
    flaechenToken = erik.token;
    const flaeche = await montiere(createElement(VerstaendnisfragenBereich, { koId }));
    const block = el(flaeche, "verstaendnis-bearbeitung");
    expect(block?.getAttribute("data-status")).toBe("angenommen");
    expect(block?.textContent).toContain("Alle Fragen sind aus Fassung 2 belegt.");
    expect(el(flaeche, "verstaendnis-annehmen")).toBeNull();
    expect(el(flaeche, "verstaendnis-anlegen")).not.toBeNull();
  });

  it("ohne wörtliche Belegstelle: Befund benannt, Annehmen gesperrt", async () => {
    const clara = await konto("controller", "clara@verstaendnis-flaeche.test", "Clara Controller");
    const koId = await eintragV2(clara);
    const url = `/api/kos/${koId}/verstaendnisfragen`;
    const angelegt = await auf(clara.token, "POST", url, inhalt("Der Prüfdruck beträgt 16 bar"));
    expect(angelegt.statusCode).toBe(201);
    flaechenToken = clara.token;
    const flaeche = await montiere(createElement(VerstaendnisfragenBereich, { koId }));
    const befunde = [...flaeche.querySelectorAll('[data-testid="verstaendnis-befund"]')].map(
      (b) => b.textContent,
    );
    expect(befunde).toEqual([
      "Frage 2: Die Belegstelle steht nicht wörtlich in der gebundenen Fassung.",
    ]);
    expect((el(flaeche, "verstaendnis-annehmen") as HTMLButtonElement | null)?.disabled).toBe(true);
    expect((el(flaeche, "verstaendnis-vorlegen") as HTMLButtonElement | null)?.disabled).toBe(true);
  });
});

describe("U3 · Lernpfad: zugeordnet, bestanden — und drei getrennte Nachweise", () => {
  it("zeigt die Lage des Fragensatzes und trennt Lesen, Verständnis und Befähigung", async () => {
    const { vera, satzId } = await lage();
    const r = await auf(vera.token, "POST", `/api/verstaendnisfragen/${satzId}/versuche`, {
      versuchId: "versuch-lernpfad-1",
      version: 1,
      antworten: [
        { frageId: "f1", gewaehlt: ["o1"] },
        { frageId: "f2", gewaehlt: ["o2"] },
        { frageId: "f3", gewaehlt: ["o1"] },
      ],
    });
    expect(r.statusCode).toBe(201);
    flaechenToken = vera.token;
    const pfad = await montiere(createElement(LernpfadVerstaendnis));
    const eintrag = el(pfad, "lernpfad-verstaendnis-satz");
    expect(eintrag?.getAttribute("data-lage")).toBe("bestanden");
    expect(eintrag?.textContent).toContain("Druckluft · Verständnis");
    const drei = el(pfad, "lernpfad-verstaendnis-drei")?.textContent ?? "";
    expect(drei).toContain("praktische Befähigung (nicht in Klarwerk nachgewiesen)");
    expect(drei).toContain("getrennte Nachweise");
  });
});

describe("U4 · fachlich geänderte Quelle", () => {
  it("Hinweis zur erneuten Prüfung, kein Beantworten — altes Ergebnis bleibt", async () => {
    const { vera, erik, koId, satzId } = await lage();
    await auf(vera.token, "POST", `/api/verstaendnisfragen/${satzId}/versuche`, {
      versuchId: "versuch-quelle-flaeche-1",
      version: 1,
      antworten: [{ frageId: "f1", gewaehlt: ["o1"] }],
    });
    await services.ko.revise(koId, { statement: V2.replace("11 bar", "12 bar") }, erik.id);
    await services.ko.setValidationState(koId, { trust: 80, status: "validiert" });
    flaechenToken = vera.token;
    const flaeche = await montiere(createElement(VerstaendnisfragenBereich, { koId }));
    expect(el(flaeche, "verstaendnis-satz")?.getAttribute("data-quellenlage")).toBe("geaendert");
    expect(el(flaeche, "verstaendnis-quelle-warnung")?.textContent).toContain(
      "seit Fassung 2 fachlich geändert",
    );
    expect(el(flaeche, "verstaendnis-beantworten")).toBeNull();
    expect(flaeche.querySelectorAll('[data-testid="verstaendnis-eigenes"]')).toHaveLength(1);
  });
});
