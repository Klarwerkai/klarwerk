// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg`, Runde 2 — Bens Befunde BEN-1 (N-0068) und BEN-2.
// ================================================================================================
//
// BEN-1: „Datei → Formular (Experten)" und „Mehr → Anhänge → Anhänge verwalten" zeigten den älteren
//        gesicherten Stand (bzw. ein leeres Formular), während auf dem Blatt ungesicherte Änderungen
//        standen — ohne Rückfrage. Jetzt fragt das Blatt, sichert auf Zustimmung und öffnet das
//        Formular erst danach; bei Ablehnung bleibt alles auf dem Blatt.
// BEN-2: Ein getippter Titel über 90 Zeichen wurde still gekürzt gespeichert, während Feld und
//        Bestätigung den vollen Titel zeigten.
//
// Aufbau wie `blatt-einstieg-mounted.test.tsx` (echte Fastify-Anwendung über `app.inject`, das
// Blatt unter `CaptureFrontDoor` samt dem echten Arbeitsraum, nur der Modelllauf gefälscht). Die
// Brücke verändert hier NICHTS am Draht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Verändert die nächste Anlage `POST /api/drafts`, bevor sie beim Server ankommt. */
  anlageUmbauen: null as null | ((rumpf: Record<string, unknown>) => Record<string, unknown>),
  /** Runde 3: hält die nächste Speicheranfrage (PUT/POST auf Entwürfe) fest, bis sie freigegeben wird. */
  speichernFesthalten: false,
  festgehalten: [] as (() => void)[],
  antworten: [] as { method: string; url: string; status: number }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => ({
          active: true,
          mode: "cloud",
          reachable: "ok",
          tasks: { structure: true, extract: true },
        })),
        config: vi.fn(async () => null),
        // BEN-4 (Lauf 3): ein vollständiger Strukturvorschlag, wie ihn die echte Route liefert
        // (`StructureResult`) — nur der Modelllauf ist gefälscht, der Vorschlag selbst ist echt.
        structure: vi.fn(async () => ({
          title: "KI-Titel aus dem Strukturvorschlag",
          statement: "Die Dosierpumpe wird nach dem Gebindewechsel entlüftet.",
          conditions: [],
          measures: [],
          tags: [],
          confidence: 0.8,
          demo: false,
        })),
      },
    },
  };
});

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
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TITEL = "Dosierpumpe nach Gebindewechsel entlüften";
const KOERPER = "<p>Erst den Nullpunkt am HMI prüfen, dann die Pumpe DP-4 entlüften.</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    let body = init.body;
    if (method === "POST" && /\/api\/drafts$/.test(url) && bruecke.anlageUmbauen && body) {
      body = JSON.stringify(bruecke.anlageUmbauen(JSON.parse(body) as Record<string, unknown>));
      bruecke.anlageUmbauen = null;
    }
    if (
      bruecke.speichernFesthalten &&
      (method === "PUT" || method === "POST") &&
      /\/api\/drafts(\/[^/]+)?$/.test(url)
    ) {
      bruecke.speichernFesthalten = false;
      await new Promise<void>((weiter) => bruecke.festgehalten.push(weiter));
    }
    const res = await bruecke.app.inject({
      method,
      url,
      headers,
      ...(body !== undefined ? { payload: body } : {}),
    });
    bruecke.antworten.push({ method, url, status: res.statusCode });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.anlageUmbauen = null;
  bruecke.antworten = [];
  bruecke.speichernFesthalten = false;
  bruecke.festgehalten = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@formular.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@formular.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Der gespeicherte Bestand an Entwürfen — beim Server erfragt, nicht aus Aufrufen abgelesen. */
async function entwuerfeAmServer(): Promise<unknown[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  const daten = JSON.parse(res.body) as unknown;
  return Array.isArray(daten) ? daten : ((daten as { items?: unknown[] }).items ?? []);
}

async function blattOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
                  { initialEntries: ["/capture/frontdoor"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
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
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function element<T extends Element>(selektor: string, art: new () => T): T {
  const el = container.querySelector(selektor);
  if (!(el instanceof art)) {
    throw new Error(`${selektor} fehlt. Sichtbar: ${seitentext().slice(0, 700)}`);
  }
  return el;
}

async function klick(knopf: HTMLElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

async function titelSetzen(wert: string): Promise<void> {
  const feld = element('[data-testid="blatt-titel"]', HTMLInputElement);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld, wert);
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function textSchreiben(): Promise<void> {
  const el = element('[role="textbox"]', HTMLElement);
  await act(async () => {
    el.innerHTML = KOERPER;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function blattFuellen(): Promise<void> {
  await titelSetzen(TITEL);
  await textSchreiben();
}

async function sichern(): Promise<void> {
  const knopf = element('[data-testid="blatt-entwurf-sichern"]', HTMLButtonElement);
  expect(knopf.disabled, `Entwurf sichern ist gesperrt. ${seitentext().slice(0, 500)}`).toBe(false);
  await klick(knopf);
}

async function stufeWaehlen(stufe: "intern" | "vertraulich" = "intern"): Promise<void> {
  await klick(element('[data-testid="blatt-werkzeug-vertraulichkeit"]', HTMLButtonElement));
  const flaeche = element('[data-testid="blatt-menue-vertraulichkeit"]', HTMLElement);
  const beschriftung = i18n.t(`conf.level.${stufe}`);
  const eintrag = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Eintrag „${beschriftung}“ fehlt im Menü.`);
  }
  await klick(eintrag);
}

const NEU = "NEUER ungesicherter Bearbeitungsstand";
let bestaetigen = true;
let rueckfragen: string[] = [];
/** BEN-4: reine Meldungen (`window.alert`) — sie zählen zu den Rückfragen, die der Mensch sieht. */
let meldungen: string[] = [];
/** Schutz für die Gegenprobe B4: ab der n-ten Rückfrage wird abgelehnt (wie Ben bei der vierten). */
let ablehnenAb = Number.POSITIVE_INFINITY;

/** Der gespeicherte Entwurf beim Server — sein Titel, nicht der der Oberfläche. */
async function entwurfsTitelAmServer(): Promise<string[]> {
  const liste = (await entwuerfeAmServer()) as { id: string }[];
  const titel: string[] = [];
  for (const eintrag of liste) {
    const res = await bruecke.app.inject({
      method: "GET",
      url: `/api/drafts/${eintrag.id}`,
      headers: { authorization: `Bearer ${bruecke.token}` },
    });
    titel.push((JSON.parse(res.body) as { payload: { title?: string } }).payload.title ?? "");
  }
  return titel;
}

function schreibAufrufe(): { method: string; url: string; status: number }[] {
  return bruecke.antworten.filter(
    (a) => (a.method === "POST" || a.method === "PUT") && /\/api\/drafts(\/[^/]+)?$/.test(a.url),
  );
}

function knopfIn(behaelter: Element, text: string): HTMLButtonElement {
  const knopf = [...behaelter.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${text}“ fehlt. Sichtbar: ${seitentext().slice(0, 600)}`);
  }
  return knopf;
}

async function ueberDateiMenueZumFormular(): Promise<void> {
  await klick(element('[data-testid="blatt-werkzeug-datei"]', HTMLButtonElement));
  const menue = element('[data-testid="blatt-menue-datei"]', HTMLElement);
  await klick(knopfIn(menue, i18n.t("erfassen.weg.formular")));
}

async function ueberAnhaengeZumFormular(): Promise<void> {
  await klick(element('[data-testid="blatt-werkzeug-mehr"]', HTMLButtonElement));
  await klick(
    knopfIn(
      element('[data-testid="blatt-menue-mehr"]', HTMLElement),
      i18n.t("erfassen.mehr.anhaenge"),
    ),
  );
  await klick(
    knopfIn(
      element('[data-testid="blatt-menue-mehr"]', HTMLElement),
      i18n.t("erfassen.anhaenge.verwalten"),
    ),
  );
}

/** Das Titelfeld des Expertenformulars, an seiner sichtbaren Beschriftung gefunden. */
function formularTitel(): HTMLInputElement | HTMLTextAreaElement | null {
  const beschriftung = i18n.t("capture.wizard.titleLabel");
  const l = [...container.querySelectorAll("label")].find(
    (x) => (x.querySelector("span")?.textContent ?? "").trim() === beschriftung,
  );
  const el = l?.querySelector("input, textarea");
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
}

/** Die gespeicherte Nutzlast des (einzigen) Entwurfs beim Server. */
async function entwurfAmServer(): Promise<Record<string, unknown>> {
  const liste = (await entwuerfeAmServer()) as { id: string }[];
  expect(liste, "es gibt nicht genau einen Entwurf").toHaveLength(1);
  const res = await bruecke.app.inject({
    method: "GET",
    url: `/api/drafts/${liste[0]?.id}`,
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return (JSON.parse(res.body) as { payload: Record<string, unknown> }).payload;
}

/** Ein eigenes Wissensobjekt mit Bereich anlegen — sonst bietet das Bereich-Menü nichts an. */
async function bereichAnlegen(bereich: string): Promise<void> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
    payload: {
      confidentiality: "intern",
      title: "Vorhandenes Wissen mit Bereich",
      statement: "Kurzfassung für den Prüfstand.",
      type: "best_practice",
      category: bereich,
      tags: [],
      neededValidations: 1,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
}

async function bereichWaehlen(bereich: string): Promise<void> {
  await klick(element('[data-testid="blatt-werkzeug-bereich"]', HTMLButtonElement));
  await klick(knopfIn(element('[data-testid="blatt-menue-bereich"]', HTMLElement), bereich));
}

async function textErsetzen(html: string): Promise<void> {
  const el = element('[role="textbox"]', HTMLElement);
  await act(async () => {
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Bens Ablauf B4, Schritt 2: „KI → Strukturieren" — der Vorschlag steht danach unübernommen da. */
async function strukturVorschlagErzeugen(): Promise<void> {
  await klick(element('[data-testid="blatt-werkzeug-ki"]', HTMLButtonElement));
  await klick(
    knopfIn(element('[data-testid="blatt-menue-ki"]', HTMLElement), i18n.t("erfassen.ki.struktur")),
  );
  expect(
    container.querySelector('[data-testid="blatt-ki-vorschlag"]'),
    `kein KI-Vorschlag sichtbar. ${seitentext().slice(0, 500)}`,
  ).not.toBeNull();
}

function vorschlagSteht(): boolean {
  return container.querySelector('[data-testid="blatt-ki-vorschlag"]') !== null;
}

async function freigeben(): Promise<void> {
  await act(async () => {
    for (const weiter of bruecke.festgehalten.splice(0)) {
      weiter();
    }
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  bestaetigen = true;
  rueckfragen = [];
  meldungen = [];
  ablehnenAb = Number.POSITIVE_INFINITY;
  vi.spyOn(window, "confirm").mockImplementation((frage?: string) => {
    rueckfragen.push(String(frage ?? ""));
    return bestaetigen && rueckfragen.length < ablehnenAb;
  });
  vi.spyOn(window, "alert").mockImplementation((meldung?: string) => {
    meldungen.push(String(meldung ?? ""));
  });
  brueckeAufbauen();
  await serverStarten();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  for (const weiter of bruecke.festgehalten.splice(0)) {
    weiter();
  }
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  vi.restoreAllMocks();
  await i18n.changeLanguage("de");
});

describe("BEN-1 · das Formular übernimmt den Stand des Blattes oder sagt es (N-0068)", () => {
  it("N1 · gesichert, dann geändert, dann „Datei → Formular“: Rückfrage, Sichern, das Formular zeigt den NEUEN Titel", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);
    const vorher = schreibAufrufe().length;

    await ueberDateiMenueZumFormular();

    expect(rueckfragen).toEqual([i18n.t("einstieg.formular.sichernFrage")]);
    expect(schreibAufrufe().length, "es wurde nicht gesichert").toBe(vorher + 1);
    expect(await entwurfsTitelAmServer()).toEqual([NEU]);
    const feld = formularTitel();
    expect(
      feld,
      `das Formular ist nicht offen. Sichtbar: ${seitentext().slice(0, 500)}`,
    ).not.toBeNull();
    expect(feld?.value).toBe(NEU);
    expect(seitentext()).not.toContain(TITEL);
  });

  it("N2 · dieselbe Lage, Rückfrage abgelehnt: man bleibt auf dem Blatt, nichts wird gesichert oder verloren", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);
    const vorher = schreibAufrufe().length;
    bestaetigen = false;

    await ueberDateiMenueZumFormular();

    expect(rueckfragen).toHaveLength(1);
    expect(schreibAufrufe().length).toBe(vorher);
    expect(formularTitel()).toBeNull();
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(NEU);
    expect(await entwurfsTitelAmServer()).toEqual([TITEL]);
  });

  it("N3 · ungesichertes neues Blatt: Rückfrage, genau ein Entwurf entsteht, das Formular zeigt den getippten Titel", async () => {
    await blattOeffnen();
    await blattFuellen();
    expect(await entwuerfeAmServer()).toHaveLength(0);

    await ueberDateiMenueZumFormular();

    expect(rueckfragen).toEqual([i18n.t("einstieg.formular.sichernFrage")]);
    expect(await entwurfsTitelAmServer()).toEqual([TITEL]);
    expect(formularTitel()?.value).toBe(TITEL);
  });

  it("N4 · Kalibrierung: unverändert gesichertes Blatt öffnet das Formular ohne Rückfrage, mit demselben Stand", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    const vorher = schreibAufrufe().length;

    await ueberDateiMenueZumFormular();

    expect(rueckfragen).toEqual([]);
    expect(schreibAufrufe().length).toBe(vorher);
    expect(formularTitel()?.value).toBe(TITEL);
  });

  it("N5 · derselbe Schutz auf dem Weg „Mehr → Anhänge → Anhänge verwalten“", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);

    await ueberAnhaengeZumFormular();

    expect(rueckfragen).toEqual([i18n.t("einstieg.formular.sichernFrage")]);
    expect(await entwurfsTitelAmServer()).toEqual([NEU]);
    expect(formularTitel()?.value).toBe(NEU);
  });

  it("N6 · nicht sicherbare Abweichung (nur eine Stufe gewählt, noch kein Inhalt): die Rückfrage nennt den Wechsel", async () => {
    await blattOeffnen();
    await stufeWaehlen("vertraulich");
    const vorher = schreibAufrufe().length;

    await ueberDateiMenueZumFormular();

    expect(rueckfragen).toEqual([i18n.t("einstieg.formular.ohneSichernFrage")]);
    expect(schreibAufrufe().length).toBe(vorher);
    // Der Wechsel ist erklärt: es gibt noch keinen gesicherten Stand, das Formular ist leer.
    expect(formularTitel()?.value).toBe("");
  });

  it("N6b · dieselbe Lage, abgelehnt: man bleibt auf dem Blatt, die gewählte Stufe steht weiter da", async () => {
    await blattOeffnen();
    await stufeWaehlen("vertraulich");
    bestaetigen = false;

    await ueberDateiMenueZumFormular();

    expect(rueckfragen).toHaveLength(1);
    expect(formularTitel()).toBeNull();
    expect(
      element('[data-testid="blatt-werkzeug-vertraulichkeit"]', HTMLButtonElement).textContent,
    ).toContain(i18n.t("conf.level.vertraulich"));
  });

  it("N8 · Nachtrag WÄHREND des Sicherns (Bens Gegenprobe R2): erneute Rückfrage, auch der Nachtrag wird gesichert, das Formular zeigt ihn", async () => {
    const NACHTRAG = "NACHTRAG WÄHREND DES SICHERNS";
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);
    bruecke.speichernFesthalten = true;

    await ueberDateiMenueZumFormular();
    expect(bruecke.festgehalten, "die Speicheranfrage wurde nicht festgehalten").toHaveLength(1);
    // Das Titelfeld nimmt während der laufenden Anfrage weiter an — genau Bens Fall.
    await titelSetzen(NACHTRAG);
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(NACHTRAG);

    await freigeben();

    expect(rueckfragen).toEqual([
      i18n.t("einstieg.formular.sichernFrage"),
      i18n.t("einstieg.formular.nachtragFrage"),
    ]);
    expect(await entwurfsTitelAmServer()).toEqual([NACHTRAG]);
    expect(formularTitel()?.value).toBe(NACHTRAG);
  });

  it("N8b · derselbe Nachtrag, zweite Rückfrage abgelehnt: kein wortloser Wechsel, das Blatt behält den Nachtrag", async () => {
    const NACHTRAG = "NACHTRAG WÄHREND DES SICHERNS";
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);
    bruecke.speichernFesthalten = true;
    await ueberDateiMenueZumFormular();
    await titelSetzen(NACHTRAG);
    bestaetigen = false;

    await freigeben();

    expect(rueckfragen).toEqual([
      i18n.t("einstieg.formular.sichernFrage"),
      i18n.t("einstieg.formular.nachtragFrage"),
    ]);
    expect(formularTitel()).toBeNull();
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(NACHTRAG);
    // Gesichert ist der Stand, dem zugestimmt wurde — der Nachtrag steht ungesichert auf dem Blatt.
    expect(await entwurfsTitelAmServer()).toEqual([NEU]);
  });

  it("N8c · Kalibrierung: festgehaltene Anfrage OHNE Nachtrag — solange sie läuft kein Formular, danach ohne zweite Rückfrage", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);
    bruecke.speichernFesthalten = true;
    await ueberDateiMenueZumFormular();
    expect(bruecke.festgehalten).toHaveLength(1);
    // Solange die Anfrage läuft, ist das Formular NICHT offen (die Reihenfolge, Runde-2-Lücke G6).
    expect(formularTitel()).toBeNull();

    await freigeben();

    expect(rueckfragen).toEqual([i18n.t("einstieg.formular.sichernFrage")]);
    expect(formularTitel()?.value).toBe(NEU);
  });

  // Lauf 3 (N-0068, bisher nur Titel gemessen): derselbe Nachtrag während des Sicherns, je einzeln
  // über Text, Vertraulichkeitsstufe und Bereich. Jeder Fall misst: zweite Rückfrage, genau zwei
  // Speicherungen, der Server trägt den Nachtrag, das Formular ist offen.
  it("N9 · Nachtrag im TEXT während des Sicherns: zweite Rückfrage, der neue Text ist gesichert, das Formular öffnet", async () => {
    const NACHTRAG_TEXT =
      "<p>Nachtrag im Text während des Sicherns: Ventil V-7 vorher schließen.</p>";
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await titelSetzen(NEU);
    const vorher = schreibAufrufe().length;
    bruecke.speichernFesthalten = true;
    await ueberDateiMenueZumFormular();
    expect(bruecke.festgehalten).toHaveLength(1);
    await textErsetzen(NACHTRAG_TEXT);

    await freigeben();

    expect(rueckfragen).toEqual([
      i18n.t("einstieg.formular.sichernFrage"),
      i18n.t("einstieg.formular.nachtragFrage"),
    ]);
    expect(schreibAufrufe().length).toBe(vorher + 2);
    expect(String((await entwurfAmServer()).bodyHtml ?? "")).toContain("Ventil V-7");
    expect(formularTitel()?.value).toBe(NEU);
  });

  it("N9b · Nachtrag der VERTRAULICHKEITSSTUFE während des Sicherns: zweite Rückfrage, die neue Stufe ist gesichert, das Formular öffnet", async () => {
    await blattOeffnen();
    await blattFuellen();
    await stufeWaehlen("intern");
    await sichern();
    expect((await entwurfAmServer()).confidentiality).toBe("intern");
    await titelSetzen(NEU);
    const vorher = schreibAufrufe().length;
    bruecke.speichernFesthalten = true;
    await ueberDateiMenueZumFormular();
    expect(bruecke.festgehalten).toHaveLength(1);
    await stufeWaehlen("vertraulich");

    await freigeben();

    expect(rueckfragen).toEqual([
      i18n.t("einstieg.formular.sichernFrage"),
      i18n.t("einstieg.formular.nachtragFrage"),
    ]);
    expect(schreibAufrufe().length).toBe(vorher + 2);
    expect((await entwurfAmServer()).confidentiality).toBe("vertraulich");
    expect(formularTitel()?.value).toBe(NEU);
  });

  it("N9c · Nachtrag des BEREICHS während des Sicherns: zweite Rückfrage, der Bereich ist gesichert, das Formular öffnet", async () => {
    await bereichAnlegen("Technik");
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    // Ohne Wahl trägt der Server seinen Vorgabebereich — jedenfalls nicht den späteren Nachtrag.
    expect((await entwurfAmServer()).category).not.toBe("Technik");
    await titelSetzen(NEU);
    const vorher = schreibAufrufe().length;
    bruecke.speichernFesthalten = true;
    await ueberDateiMenueZumFormular();
    expect(bruecke.festgehalten).toHaveLength(1);
    await bereichWaehlen("Technik");

    await freigeben();

    expect(rueckfragen).toEqual([
      i18n.t("einstieg.formular.sichernFrage"),
      i18n.t("einstieg.formular.nachtragFrage"),
    ]);
    expect(schreibAufrufe().length).toBe(vorher + 2);
    expect((await entwurfAmServer()).category).toBe("Technik");
    expect(formularTitel()?.value).toBe(NEU);
  });

  it("N7 · auch in EN und NL steht die Rückfrage in der Sprache der Sitzung", async () => {
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      expect(i18n.t("einstieg.formular.sichernFrage")).not.toBe(
        i18n.getFixedT("de")("einstieg.formular.sichernFrage"),
      );
      expect(i18n.t("einstieg.formular.ohneSichernFrage")).not.toBe(
        i18n.getFixedT("de")("einstieg.formular.ohneSichernFrage"),
      );
      expect(i18n.t("einstieg.formular.nachtragFrage")).not.toBe(
        i18n.getFixedT("de")("einstieg.formular.nachtragFrage"),
      );
      expect(i18n.t("einstieg.formular.vorschlagOffen")).not.toBe(
        i18n.getFixedT("de")("einstieg.formular.vorschlagOffen"),
      );
      expect(i18n.t("einstieg.formular.vorschlagOffen")).not.toBe(
        "einstieg.formular.vorschlagOffen",
      );
    }
  });
});

// ================================================================================================
// BEN-4 (Lauf 3) — Bens Ablauf B4: Blatt füllen und sichern, „KI → Strukturieren", Vorschlag stehen
// lassen, „Datei → Formular". Gemessen: Zahl der Rückfragen (Bestätigungsfragen UND Meldungen),
// Zahl der Speicherungen, Endzustand.
// ================================================================================================
describe("BEN-4 · ein offener KI-Vorschlag beim Wechsel ins Formular", () => {
  it("B4 · gesichert + offener Vorschlag → „Datei → Formular“: genau EINE erklärende Meldung, KEINE Speicherung, Vorschlag und Blatt bleiben", async () => {
    // Bei Ben stimmten drei Zustimmungen drei Speicherungen zu; die vierte Frage lehnte er ab.
    // Derselbe Schutz hier, damit ein Rückfall messbar endet statt ewig zu laufen.
    ablehnenAb = 4;
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    const vorher = schreibAufrufe().length;
    expect(vorher).toBe(1);
    await strukturVorschlagErzeugen();
    expect(schreibAufrufe().length, "Strukturieren hat gesichert").toBe(vorher);

    await ueberDateiMenueZumFormular();
    // Ohne weitere Eingabe nachlaufen lassen: es darf keine Nachfrage nachkommen.
    await act(flush);
    await act(flush);

    expect(rueckfragen, "Bestätigungsfragen ohne neue Eingabe").toEqual([]);
    expect(meldungen).toEqual([i18n.t("einstieg.formular.vorschlagOffen")]);
    expect(rueckfragen.length + meldungen.length, "Rückfragen gesamt").toBe(1);
    expect(schreibAufrufe().length, "Speicherungen ohne neue Eingabe").toBe(vorher);
    // Endzustand: Vorschlagszustand erklärt — die Meldung nennt „übernehmen oder verwerfen".
    expect(meldungen[0]).toMatch(/Übernimm oder verwirf den Vorschlag zuerst/);
    expect(formularTitel()).toBeNull();
    expect(vorschlagSteht(), "der Vorschlag ging verloren").toBe(true);
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(TITEL);
    expect(await entwurfsTitelAmServer()).toEqual([TITEL]);
  });

  it("B4b · danach verworfen → „Datei → Formular“: das Formular öffnet ohne Rückfrage und ohne Speicherung mit dem gesicherten Stand", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await strukturVorschlagErzeugen();
    await ueberDateiMenueZumFormular();
    const vorher = schreibAufrufe().length;

    await klick(
      knopfIn(
        element('[data-testid="blatt-ki-vorschlag"]', HTMLElement),
        i18n.t("fd.discardProposal"),
      ),
    );
    expect(vorschlagSteht()).toBe(false);
    await ueberDateiMenueZumFormular();

    expect(meldungen).toHaveLength(1);
    expect(rueckfragen).toEqual([]);
    expect(schreibAufrufe().length).toBe(vorher);
    expect(formularTitel()?.value).toBe(TITEL);
  });

  it("B4c · danach übernommen → „Datei → Formular“: eine Sichern-Rückfrage, genau eine Speicherung, das Formular zeigt den übernommenen Stand", async () => {
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    await strukturVorschlagErzeugen();
    await ueberDateiMenueZumFormular();
    const vorher = schreibAufrufe().length;

    await klick(
      knopfIn(element('[data-testid="blatt-ki-vorschlag"]', HTMLElement), i18n.t("fd.accept")),
    );
    expect(vorschlagSteht()).toBe(false);
    const blattTitel = element('[data-testid="blatt-titel"]', HTMLInputElement).value;
    await ueberDateiMenueZumFormular();

    expect(meldungen).toHaveLength(1);
    expect(rueckfragen).toEqual([i18n.t("einstieg.formular.sichernFrage")]);
    expect(schreibAufrufe().length).toBe(vorher + 1);
    expect(await entwurfsTitelAmServer()).toEqual([blattTitel]);
    expect(formularTitel()?.value).toBe(blattTitel);
  });

  // Tippen in Titel oder Text räumt einen offenen Vorschlag bestehender Bauart ab (`changeTitle` →
  // `clearStructureState`); die Stufenwahl tut das nicht. Daran misst B4d die Kombination.
  it("B4d · offener Vorschlag UND ungesicherte Stufe (über „Anhänge verwalten“): dieselbe eine Meldung, nichts gesichert, Stufe und Vorschlag bleiben auf dem Blatt", async () => {
    await blattOeffnen();
    await blattFuellen();
    await stufeWaehlen("intern");
    await sichern();
    await strukturVorschlagErzeugen();
    await stufeWaehlen("vertraulich");
    expect(vorschlagSteht(), "die Stufenwahl hat den Vorschlag abgeräumt").toBe(true);
    const vorher = schreibAufrufe().length;

    await ueberAnhaengeZumFormular();
    await act(flush);

    expect(rueckfragen).toEqual([]);
    expect(meldungen).toEqual([i18n.t("einstieg.formular.vorschlagOffen")]);
    expect(schreibAufrufe().length).toBe(vorher);
    expect(formularTitel()).toBeNull();
    expect(vorschlagSteht()).toBe(true);
    expect(
      element('[data-testid="blatt-werkzeug-vertraulichkeit"]', HTMLButtonElement).textContent,
    ).toContain(i18n.t("conf.level.vertraulich"));
    expect((await entwurfAmServer()).confidentiality).toBe("intern");
  });
});

describe("BEN-2 · ein getippter Titel wird nicht still gekürzt", () => {
  it("T1 · 120 Zeichen getippt und gesichert: der Server hat alle 120, Feld und Bestätigung sagen dasselbe", async () => {
    const lang =
      `${"Dosierpumpe DP-4 nach jedem Gebindewechsel entlüften und Nullpunkt prüfen ".repeat(2)}`
        .slice(0, 120)
        .trimEnd()
        .padEnd(120, "x");
    expect(lang).toHaveLength(120);
    await blattOeffnen();
    await titelSetzen(lang);
    await textSchreiben();
    await sichern();

    expect(await entwurfsTitelAmServer()).toEqual([lang]);
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(lang);
    const zeile = container.querySelector('[data-testid="blatt-entwurf-gespeichert"]');
    expect(zeile?.textContent ?? "").toContain(lang);
  });
});
