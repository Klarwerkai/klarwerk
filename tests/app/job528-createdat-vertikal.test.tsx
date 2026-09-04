// @vitest-environment jsdom
// ================================================================================================
// JOB 528 · DIE ERSTELLZEIT, VERTIKAL — vom persistierten Datensatz bis in die DOM-Zeile.
// ================================================================================================
//
// DIE OWNERENTSCHEIDUNG (13.08.2026, `00_CONTROL/ENTSCHEIDUNGEN/JOB-528.md`): angezeigt wird die
// ERSTELLZEIT (`createdAt`). `koChangedMs` und „beide anzeigen" sind ausdruecklich verworfen.
//
// WARUM ES DIESEN TEST NEBEN `apps/web/src/pages/Library.timestamp.test.tsx` GIBT — und warum das
// keine zweite Wahrheit ist: Jener Test mockt `../api/hooks` (dort Zeile 61) und stellt der
// Komponente fertige Objekte hin. Er prueft den RENDERER: formatiert er richtig, laesst er die
// Zeile bei fehlendem Wert weg. Er kann prinzipiell nicht merken, wenn `createdAt` den Weg vom
// Datensatz zum Client gar nicht ueberlebt — denn er faehrt diesen Weg nicht. Genau diese Haelfte
// prueft die Datei hier: EIN persistierter Datensatz, der echte KO-Dienst, die echte Suchroute
// `/api/library/search`, der echte Client-Hook `useLibrarySearch` und die echte `Library` — bis zu
// der DOM-Zeile, die an SEINER Karte haengt.
//
// WAS GEFAELSCHT IST, vollstaendig und benannt:
//   1. `fetch` → `app.inject` (DIE BRUECKE). Der Request, den die Oberflaeche wirklich baut, reist
//      in den echten Server. Vorbild: tests/capture/mega20-capture-submit-mounted.test.tsx:25.
//   2. `Date` (nur Date, NICHT die Timer). Ohne feste Uhr waere `createdAt` bei jedem Lauf ein
//      anderer Wert und die erwartete Zeichenkette geraten. D8 hat an genau dieser Stelle ein Rot
//      erzeugt, weil die Anzeige mit der Systemuhr wanderte.
//   3. Fuer den NULLFALL (F4) entfernt die Bruecke `createdAt` aus der Antwort EINES Datensatzes.
//      Das ist der einzige Weg, einen Datensatz ohne Wert durch die ECHTE Kette zu schicken: der
//      Server setzt `createdAt` beim Anlegen immer. Der Eingriff steht im Transport, nicht im
//      Renderer — und er ist hier benannt, statt sich als „Altbestand" auszugeben.
// NICHT gefaelscht: KO-Dienst, Repository, Suchroute, Sichtbarkeit, Client-Endpunkte,
// React-Query, Kontexte, `Library`, `formatKoTimestamp`, i18n.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Id des Datensatzes, dem der Transport `createdAt` abnimmt — nur fuer den Nullfall F4. */
  ohneZeitFuer: null as string | null,
  /** Jede Suchantwort, die wirklich zum Client ging — der WIRE-Beleg, ungefiltert. */
  wire: [] as Record<string, unknown>[][],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Die Oberflaechen-Pakete liegen unter `apps/web`, nicht im Stamm — dieselbe Importform wie in
// tests/capture/mega20-capture-submit-mounted.test.tsx:95-101.
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
import { formatKoTimestamp } from "../../apps/web/src/lib/koDates";
import { Library } from "../../apps/web/src/pages/Library";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Der feste Zeitpunkt der Anlage: 14.03.2026, 09:47 Ortszeit. */
const ANGELEGT_AM = new Date(2026, 2, 14, 9, 47, 0);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

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
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    let body = res.body;
    if (url.includes("/library/search") && res.statusCode === 200) {
      const geliefert = JSON.parse(body) as Record<string, unknown>[];
      bruecke.wire.push(geliefert);
      if (bruecke.ohneZeitFuer) {
        // F4: EIN Datensatz verliert seinen Wert auf dem Transport — der Server hat ihn gesetzt.
        body = JSON.stringify(
          geliefert.map((k) =>
            k.id === bruecke.ohneZeitFuer ? { ...k, createdAt: undefined } : k,
          ),
        );
      }
    }
    // JOB 3063 (H4): die Zeitangabe steht auf der Leseflaeche, und die holt ihren Eintrag EINZELN
    // (`GET /api/kos/:id`). Der Transportverlust aus F4 muss deshalb auch auf diesem Weg gelten —
    // sonst prueft der Fall eine Lage, die es so nicht gibt.
    if (
      bruecke.ohneZeitFuer &&
      res.statusCode === 200 &&
      url.includes(`/kos/${bruecke.ohneZeitFuer}`)
    ) {
      const einzeln = JSON.parse(body) as Record<string, unknown>;
      body = JSON.stringify({ ...einzeln, createdAt: undefined });
    }
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => body,
    };
  };
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.ohneZeitFuer = null;
  bruecke.wire = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/**
 * Holt ein frisches Token — noetig, wenn die Testuhr nach der Anmeldung springt: das bei T0
 * ausgestellte Token ist zehn Jahre spaeter abgelaufen, und ohne gueltige Anmeldung liefert die
 * Suchroute nichts. Der angelegte Datensatz ist davon unberuehrt; sein `createdAt` bleibt T0.
 */
async function neuAnmelden(): Promise<void> {
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  expect(login.statusCode, login.body).toBe(200);
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Legt ein Wissensobjekt ueber die ECHTE Route an und liefert seine Id. */
async function objektAnlegen(titel: string): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
    payload: { title: titel, type: "technik", statement: `Aussage zu ${titel}.` },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
                  { initialEntries: ["/bibliothek"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/bibliothek",
                      element: createElement(Library),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(async () => {
    await flush();
  });
}

// ==================================================================================================
// JOB 3063 (H4) — DIE ZEILE HAENGT NICHT MEHR AN EINER KARTE, SONDERN AN DER LESEFLAECHE.
// ==================================================================================================
//
// Die Bibliothek ist seit dem Umbau Liste plus Lesefläche: links Punkt, Titel und „Bereich · Status",
// rechts der GEWAEHLTE Eintrag mit seiner Meta-Zeile „Stufe · Bereich · Autor · Datum"
// (`components/bibliothek/BibliothekLesen.tsx:394`). Die Frage dieses Auftrags — „gehoert der
// angezeigte Wert zu DIESEM Datensatz?" — wird deshalb ab hier so gestellt, wie ein Mensch sie
// stellt: Eintrag anklicken, Meta-Zeile lesen, naechsten Eintrag anklicken, wieder lesen. Das ist
// dieselbe Zuordnungsfrage, nur an der Flaeche, die es heute gibt.

/** Die Listenzeile eines Datensatzes — ueber ihren sichtbaren Titel, nicht ueber eine Klasse. */
function listenZeile(titel: string): HTMLElement | undefined {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="bib-zeile"]')].find(
    (z) => (z.querySelector('[data-bib-text="zeile-titel"]')?.textContent ?? "").trim() === titel,
  );
}

/**
 * Einen Eintrag waehlen — der Weg des Menschen: ein Klick auf die Zeile. Die Leseflaeche holt ihren
 * Eintrag danach EINZELN vom Server (`GET /api/kos/:id`), also wird hier auf die Antwort gewartet.
 */
async function waehle(titel: string): Promise<void> {
  const zeile = listenZeile(titel);
  if (zeile === undefined) {
    throw new Error(`Listenzeile „${titel}" fehlt; DOM: ${container.textContent}`);
  }
  await act(async () => {
    zeile.click();
    await flush();
  });
  // Die Abfrage der Leseflaeche laeuft ueber die echte HTTP-Bruecke; sie braucht nach dem Klick
  // noch Durchlaeufe, bis Antwort und Render durch sind.
  for (let i = 0; i < 3 && container.querySelector('[data-testid="bib-titel"]') === null; i++) {
    await act(async () => {
      await flush();
    });
  }
}

/** Der Titel, der gerade auf der Leseflaeche steht. */
function leseTitel(): string {
  return (container.querySelector('[data-testid="bib-titel"]')?.textContent ?? "").trim();
}

/** Die Meta-Zeile der Leseflaeche — dort steht die Erstellzeit. */
function metaZeile(): string {
  return (container.querySelector('[data-testid="bib-meta"]')?.textContent ?? "").trim();
}

describe("JOB 528 · die Erstellzeit reist vom Datensatz bis in die Bibliothekszeile", () => {
  beforeEach(async () => {
    // NUR Date faelschen. Die Timer bleiben echt — `flush` braucht sie, und ein gefaelschter
    // Timer haette den Server mitten im Lauf angehalten.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ANGELEGT_AM);
    await i18n.changeLanguage("de");
    brueckeAufbauen();
    await serverStarten();
  });

  afterEach(() => {
    if (root) {
      act(() => root.unmount());
    }
    container?.remove();
    vi.useRealTimers();
  });

  it("F1 · WIRE: die Suchantwort traegt `createdAt` des persistierten Datensatzes", async () => {
    const id = await objektAnlegen("Ventilpruefung");
    await mount();

    expect(
      bruecke.wire.length,
      "die Oberflaeche hat die Suchroute wirklich gerufen",
    ).toBeGreaterThan(0);
    const letzte = bruecke.wire[bruecke.wire.length - 1] as { id: string; createdAt?: string }[];
    const treffer = letzte.find((k) => k.id === id);
    expect(treffer, "der angelegte Datensatz steht in der Suchantwort").toBeDefined();
    expect(
      treffer?.createdAt,
      "`createdAt` verlaesst den Server — ohne diesen Wert kann keine Zeile entstehen",
    ).toBe(ANGELEGT_AM.toISOString());
  });

  it("F2 · DOM: die Zeitangabe steht in der Meta-Zeile GENAU dieses Datensatzes", async () => {
    await objektAnlegen("Ventilpruefung");
    await objektAnlegen("Druckpruefung");
    await mount();

    await waehle("Ventilpruefung");
    expect(leseTitel(), "die Leseflaeche zeigt den gewaehlten Datensatz").toBe("Ventilpruefung");
    expect(metaZeile()).toContain(formatKoTimestamp(ANGELEGT_AM.toISOString(), "de"));
  });

  it("F3 · zwei Datensaetze: jeder traegt seine Zeitangabe an SEINER Meta-Zeile", async () => {
    await objektAnlegen("Ventilpruefung");
    await objektAnlegen("Druckpruefung");
    await mount();

    for (const titel of ["Ventilpruefung", "Druckpruefung"]) {
      await waehle(titel);
      expect(leseTitel(), `die Leseflaeche zeigt ${titel}`).toBe(titel);
      expect(metaZeile(), `Zeitangabe an der Meta-Zeile von ${titel}`).toContain(
        formatKoTimestamp(ANGELEGT_AM.toISOString(), "de"),
      );
    }
    // Genau EINE Meta-Zeile, keine verirrte zweite: die Leseflaeche zeigt immer einen Eintrag.
    expect(container.querySelectorAll('[data-testid="bib-meta"]').length).toBe(1);
  });

  it("F4 · NULLFALL: verliert ein Datensatz `createdAt` auf dem Transport, faellt SEINE Angabe weg — und kein 1970 erscheint", async () => {
    const ohne = await objektAnlegen("Ohne Zeitangabe");
    await objektAnlegen("Mit Zeitangabe");
    bruecke.ohneZeitFuer = ohne;
    await mount();

    const wert = formatKoTimestamp(ANGELEGT_AM.toISOString(), "de");
    await waehle("Ohne Zeitangabe");
    expect(leseTitel()).toBe("Ohne Zeitangabe");
    const ohneZeile = metaZeile();
    expect(ohneZeile, "ohne Wert KEINE Zeitangabe — kein Ersatzwert").not.toContain(wert);
    expect(ohneZeile.endsWith("·"), "kein leerhaengendes Trennzeichen").toBe(false);

    await waehle("Mit Zeitangabe");
    expect(leseTitel()).toBe("Mit Zeitangabe");
    const mitZeile = metaZeile();
    expect(mitZeile, "der Nachbar mit Wert traegt seine Angabe unveraendert").toContain(wert);
    // Der Unterschied zwischen beiden Zeilen ist GENAU das Datum.
    expect(`${ohneZeile} · ${wert}`.replace("Ohne", "Mit")).toBe(mitZeile.replace("Ohne", "Mit"));
    expect(container.textContent, "nirgends ein 01.01.1970").not.toContain("1970");
  });

  it("F5 · SPRACHEN: DE und EN formatieren denselben Wert deterministisch", async () => {
    await objektAnlegen("Ventilpruefung");
    await mount();
    await waehle("Ventilpruefung");
    const de = metaZeile();
    expect(de).toContain(formatKoTimestamp(ANGELEGT_AM.toISOString(), "de"));

    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    const en = metaZeile();
    expect(en).toContain(formatKoTimestamp(ANGELEGT_AM.toISOString(), "en"));
    expect(en, "die Schreibweise wechselt mit der Sprache").not.toBe(de);
  });

  it("F6 · ZEITSTABILITAET: die Uhr steht VOR dem Render zehn Jahre weiter — angezeigt wird trotzdem T0", async () => {
    // ============================================================================================
    // WARUM DIESER FALL IN D11 UMGEBAUT WURDE — der D10-Fall war ein Scheinbeleg.
    // ============================================================================================
    //
    // D10 hat den Datensatz bei T0 angelegt, bei T0 gerendert und ERST DANACH die Uhr
    // vorgestellt. Das BEN-Urteil zu D10 nennt die Luecke woertlich: „Eine fehlerhafte
    // Implementierung, die bei vorhandenem `createdAt` die Zeitzeile rendert, als Inhalt aber
    // `new Date()` formatiert, kann F1 bis F6 bestehen: Beim Erst-Render sind aktuelle Zeit und
    // `createdAt` identisch, und nach dem Zeitsprung wird nicht neu gerendert."
    //
    // Das ist richtig. Ein statisches DOM ein zweites Mal zu lesen beweist keine Zeitstabilitaet.
    //
    // DESHALB STEHEN JETZT ANLAGEZEIT UND RENDERZEIT AUSEINANDER: Der Datensatz entsteht bei T0,
    // die Uhr springt VOR `mount()` auf T0 + 10 Jahre, und erst dann rendert die Oberflaeche zum
    // ERSTEN Mal. Wer jetzt `new Date()` formatiert, zeigt 2036 — wer `createdAt` formatiert,
    // zeigt 2026. Die beiden Werte koennen sich nicht mehr zufaellig decken.
    const T0 = ANGELEGT_AM;
    const T0_PLUS_10 = new Date(2036, 2, 14, 9, 47, 0);

    await objektAnlegen("Ventilpruefung"); // entsteht bei T0 (beforeEach hat die Uhr gesetzt)

    vi.setSystemTime(T0_PLUS_10); // DIE UHR SPRINGT — VOR dem ersten Render
    // Die Anmeldung von T0 ist zehn Jahre spaeter abgelaufen; ohne frisches Token liefert die
    // Suche keine Treffer und der Fall pruefte nur eine leere Liste. Der DATENSATZ behaelt dabei
    // sein `createdAt` von T0 — genau die Trennung, um die es hier geht.
    await neuAnmelden();
    await mount();

    await waehle("Ventilpruefung");
    const zeile = metaZeile();
    const erwartetT0 = formatKoTimestamp(T0.toISOString(), "de");
    const waereJetzt = formatKoTimestamp(T0_PLUS_10.toISOString(), "de");

    // Die Kalibrierung des Falls selbst: die beiden Zeichenketten muessen verschieden sein,
    // sonst pruefte der Vergleich unten nichts.
    expect(erwartetT0, "T0 und T0+10 Jahre formatieren verschieden").not.toBe(waereJetzt);

    expect(zeile, "angezeigt wird die persistierte Erstellzeit").toContain(erwartetT0);
    expect(zeile, "und NICHT die Uhr des Betrachters").not.toContain(waereJetzt);
  });

  it("F6b · ZEITSTABILITAET bei erzwungenem Re-Render: auch ein zweiter Renderdurchlauf zeigt T0", async () => {
    // Die zweite Haelfte derselben Zusicherung: nicht nur der ERSTE Render nach dem Uhrsprung
    // haelt, sondern auch ein nachweislich erzwungener weiterer. Erzwungen wird er ueber den
    // Sprachwechsel — er laeuft durch dieselbe Formatierung und rendert den Baum neu.
    const T0_PLUS_10 = new Date(2036, 2, 14, 9, 47, 0);
    await objektAnlegen("Ventilpruefung");
    await mount();
    await waehle("Ventilpruefung");

    vi.setSystemTime(T0_PLUS_10);
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    const nachRerender = metaZeile();

    expect(nachRerender, "der neue Renderdurchlauf zeigt weiterhin T0").toContain(
      formatKoTimestamp(ANGELEGT_AM.toISOString(), "en"),
    );
    expect(nachRerender, "und nicht die vorgestellte Uhr").not.toContain(
      formatKoTimestamp(T0_PLUS_10.toISOString(), "en"),
    );
  });

  it("F7 · KALIBRIERUNG: ohne angelegten Datensatz gibt es keine Meta-Zeile — die Faelle oben messen wirklich etwas", async () => {
    // Die Sorte Fehler, die einen Waechter still macht: ein Selektor, der immer trifft.
    await mount();
    expect(container.querySelectorAll('[data-testid="bib-zeile"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="bib-meta"]').length).toBe(0);
  });
});
