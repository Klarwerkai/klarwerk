// @vitest-environment jsdom
// ==============================================================================================
// AUFTRAG-mega23 Block A — DIE VORDERTÜR ÜBERLEBT DEN ANTWORTVERLUST, GEMOUNTET.
// ==============================================================================================
//
// DER BEFUND (ben, sammel22) hat ZWEI Gestalten, und sie sind verschieden schwer. Beide werden
// hier GETRENNT belegt, weil ein gemeinsamer Beleg die teure der beiden verstecken würde:
//
//   · FRISCHE VORDERTÜR-EINGABE. Der Entwurf wird angelegt, das Promote gelingt serverseitig, die
//     ANTWORT geht verloren. Bis mega22 kannte der Browser die erzeugte Entwurfskennung ausserhalb
//     des Helfers nicht — der nächste Klick legte einen NEUEN Entwurf an und promotete ihn. ZWEI
//     Wissensobjekte für EINE Eingabe: eine stille Dublette im Bestand, entstanden auf dem Weg,
//     den ein neuer Nutzer als ersten geht. Das ist der Datenintegritätsfehler, nicht der
//     Anzeigefehler.
//
//   · FORTGESETZTER ENTWURF. Das Promote gelingt und LÖSCHT den Entwurf; der Wiederholversuch lief
//     zuerst in `updateDraft` und endete mit 404 — derselbe Mangel, den mega21 Block B für den
//     Dokumentweg und mega22 Block H für den Erfassen-Promote geschlossen haben.
//
// DER ENDZUSTAND WIRD BEIM SERVER ERFRAGT (`bestand()`, `entwuerfe()`) und nicht aus den Aufrufen
// der Oberfläche abgeleitet. Genau daran ist die alte Zusage gescheitert: die Aufrufe sahen
// plausibel aus, der Bestand nicht.
//
// Die Brücke ist DIESELBE wie in mega21/mega22 (echte Oberfläche, echter Client, echte
// Fastify-Anwendung, `fetch → app.inject`). Sie steht hier als eigene Kopie und nicht als Import:
// die abgenommenen Dateien bleiben unverändert, und dieser Beleg hängt an keiner fremden Datei.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Pfadfragment, für das die ANTWORT verworfen wird — der Server führt trotzdem aus. */
  antwortVerlustFuer: null as string | null,
  /** Jeder Request, den die OBERFLÄCHE erzeugt hat. */
  requests: [] as { method: string; url: string; body: string | undefined }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

// Nur die Modellläufe und die Verfügbarkeitsanzeige werden ersetzt. Alles andere — auch
// `drafts.create`, `drafts.update`, `drafts.promote` — bleibt das ECHTE Modul und läuft über den
// echten Client in den echten Server.
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
          active: false,
          mode: "off",
          reachable: "unknown",
          tasks: { structure: false, extract: false },
        })),
        config: vi.fn(async () => null),
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
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

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
    bruecke.requests.push({ method: init.method ?? "GET", url, body: init.body });
    if (bruecke.antwortVerlustFuer && url.includes(bruecke.antwortVerlustFuer)) {
      // DER ANTWORTVERLUST. Der Server hat AUSGEFÜHRT — nur die Antwort erreicht den Browser nie.
      throw new TypeError("Failed to fetch");
    }
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
  bruecke.antwortVerlustFuer = null;
  bruecke.requests = [];
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

/** Der PERSISTIERTE Endzustand — direkt beim Server erfragt, nicht aus Aufrufen abgeleitet. */
async function bestand(): Promise<{ id: string; title: string }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function entwuerfe(): Promise<{ id: string }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

/** Ein Entwurf, wie ihn die Vordertür selbst angelegt hätte — über die ECHTE Route. */
async function entwurfAnlegen(): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Allgemein",
      bodyHtml: "<p>Dichtung vor jedem Anlauf prüfen.</p>",
      origin: "frontdoor",
    },
  });
  return (JSON.parse(res.body) as { id: string }).id;
}

async function mount(url: string): Promise<void> {
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
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: [url] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/capture/frontdoor",
                        element: createElement(CaptureFrontDoor),
                      }),
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement("div", null),
                      }),
                    ),
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

function unmount(): void {
  act(() => root.unmount());
  container.remove();
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * JOB 3062 · H3 — DER SICHTBARE ERFOLG HEISST JETZT ANDERS, ER IST NICHT WEG.
 *
 * Dieser Test benutzt den Erfolgstext nur als SONDE für „der Mensch sieht, dass es geklappt hat";
 * seine eigentliche Aussage ist die Zahl im Bestand (genau eins, nie zwei). Das Blatt zeigt den
 * Abschluss als EINE Zeile (`erfassen.eingereicht`, Auftrag §9) statt als Karte `fd.submitted`.
 * Die Sonde zieht deshalb mit um — die Aussage des Tests bleibt Wort für Wort dieselbe.
 */
function erfolgSichtbar(): boolean {
  return pageText().includes(i18n.t("erfassen.eingereicht"));
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden. Sichtbar: ${pageText().slice(0, 900)}`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function editor(): HTMLElement {
  const el = container.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Body-Editor nicht gefunden");
  }
  return el;
}

async function schreiben(html: string): Promise<void> {
  const el = editor();
  await act(async () => {
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/**
 * JOB 3062 · H3 — DIE VERTRAULICHKEIT IST VOR DEM EINREICHEN PFLICHT (Auftrag §4).
 *
 * Ein FRISCHES Blatt beginnt ohne gewählte Stufe: das Einreichen bleibt gesperrt, bis der Mensch
 * im Menü „Vertraulichkeit" eine wählt (das Menü bekommt sonst Rand und Fokus, ohne Erklärsatz).
 * Ein fortgesetzter Entwurf bringt seine gespeicherte Stufe mit und braucht das nicht.
 *
 * Das ist keine Umgehung der Sperre, sondern ihr Gegenteil: Bis hierher schrieb die Vordertür die
 * Stufe „intern" still voraus, und niemand hatte je gewählt. Dieser Test tut jetzt, was ein Mensch
 * tun muss — und wäre die Sperre kaputt, fiele er beim ersten Einreichen auf.
 */
async function vertraulichkeitWaehlen(): Promise<void> {
  const werkzeug = container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]');
  if (!(werkzeug instanceof HTMLButtonElement)) {
    throw new Error("Das Menü Vertraulichkeit ist nicht auf dem Blatt.");
  }
  await click(werkzeug);
  // INNERHALB der geöffneten Menüfläche suchen, nicht auf der ganzen Seite: der Menüknopf selbst
  // trägt die gewählte Stufe als Beschriftung und käme in der DOM-Reihenfolge zuerst — ein Klick
  // darauf schlösse das Menü wieder, und der Test hätte nichts gewählt, ohne es zu merken.
  const flaeche = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
  if (!(flaeche instanceof HTMLElement)) {
    throw new Error("Das Menü Vertraulichkeit hat sich nicht geöffnet.");
  }
  const eintrag = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(i18n.t("conf.level.intern")),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Stufe „intern" nicht im Menü. Einträge: ${flaeche.textContent ?? ""}`);
  }
  await click(eintrag);
}

async function einreichen(): Promise<void> {
  await click(buttonByText(i18n.t("erfassen.einreichen")));
}

/** Die Vorgangsschlüssel, die die OBERFLÄCHE tatsächlich auf die Leitung gelegt hat. */
function gesendeteVorgangsschluessel(): string[] {
  return bruecke.requests
    .filter((r) => r.method === "POST" && r.url.includes("/promote") && r.body !== undefined)
    .map((r) => (JSON.parse(r.body as string) as { operationId?: string }).operationId ?? "");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mega23 A: die Vordertür erzeugt bei Antwortverlust KEIN zweites Wissensobjekt", () => {
  it("FRISCHE EINGABE: Antwortverlust, zweiter Klick ⇒ GENAU EIN Wissensobjekt im Bestand", async () => {
    // DIE TEURE GESTALT. Bis mega22 stand danach eine stille Dublette im Bestand — zwei
    // Wissensobjekte für eine einzige Eingabe, auf dem ersten Weg eines neuen Nutzers.
    await mount("/capture/frontdoor");
    await schreiben("<p>Die Dichtung an Linie 4 muss regelmäßig getauscht werden.</p>");
    await vertraulichkeitWaehlen();

    bruecke.antwortVerlustFuer = "/promote";
    await einreichen();

    // Der Server HAT angelegt und promotet — der Browser weiß es nur nicht.
    expect(await bestand()).toHaveLength(1);
    expect(erfolgSichtbar()).toBe(false);

    // Der Nutzer klickt erneut. Diesmal kommt die Antwort an.
    bruecke.antwortVerlustFuer = null;
    await einreichen();

    // ---- DER BEIM SERVER ERFRAGTE ENDZUSTAND: GENAU EINS, NICHT ZWEI ------------------------
    const liste = await bestand();
    expect(liste).toHaveLength(1);
    // Und der Nutzer sieht den Erfolg, der die ganze Zeit schon einer war.
    expect(erfolgSichtbar()).toBe(true);

    // ---- DERSELBE VORGANGSSCHLÜSSEL, ZWEIMAL ------------------------------------------------
    // Das ist die Ursache des Endzustands und nicht nur eine Begleiterscheinung: ein zweiter
    // Schlüssel hätte den Server einen zweiten Vorgang sehen lassen — und die Dublette entstünde.
    const schluessel = gesendeteVorgangsschluessel();
    expect(schluessel).toHaveLength(2);
    expect(schluessel[0]).toBe(schluessel[1]);
    expect(schluessel[0]).toMatch(/^create-/);

    // ---- UND GENAU EIN ENTWURF WURDE ANGELEGT, NICHT ZWEI -----------------------------------
    // Der gemerkte Entwurf ist die zweite Hälfte des Fixes: ohne ihn trüge der zweite Versuch
    // einen anderen Abdruck (er enthält die Entwurfskennung) und wäre für den Server ein anderer
    // Vorgang. Der Bestand bestätigt es — der eine Entwurf ist vom Promote verbraucht worden.
    const entwurfsAnlagen = bruecke.requests.filter(
      (r) => r.method === "POST" && /\/drafts$/.test(r.url),
    );
    expect(entwurfsAnlagen).toHaveLength(1);
    expect(await entwuerfe()).toHaveLength(0);
    unmount();
  });

  it("FORTGESETZTER ENTWURF: Antwortverlust, zweiter Klick ⇒ Erfolg statt 404, GENAU EINS", async () => {
    // DIE ZWEITE GESTALT. Das Promote gelingt und LÖSCHT den Entwurf; der Wiederholversuch lief
    // bis mega22 zuerst in `PUT /api/drafts/:id` und endete mit 404, bevor irgendein Nachschlag
    // erreicht war — 404 für einen GELUNGENEN Vorgang.
    const draftId = await entwurfAnlegen();
    await mount(`/capture/frontdoor?draft=${draftId}`);
    expect(editor().innerHTML).toContain("Dichtung");

    bruecke.antwortVerlustFuer = "/promote";
    await einreichen();

    expect(await bestand()).toHaveLength(1);
    expect(await entwuerfe()).toHaveLength(0);
    expect(erfolgSichtbar()).toBe(false);

    bruecke.antwortVerlustFuer = null;
    await einreichen();

    // ---- DER BEIM SERVER ERFRAGTE ENDZUSTAND ------------------------------------------------
    expect(await bestand()).toHaveLength(1);
    // Kein 404 mehr, sondern der Erfolg.
    expect(erfolgSichtbar()).toBe(true);

    // ---- KEIN VORGESCHALTETER ENTWURFS-PUT --------------------------------------------------
    // Der Beweis für den GEWÄHLTEN WEG: es gibt gar keinen Entwurfs-PUT mehr auf dem Einreich-Weg,
    // an dem die Wiederholung scheitern könnte. Der Stand reist IM Promote, hinter dem Nachschlag.
    const entwurfsPuts = bruecke.requests.filter(
      (r) => r.method === "PUT" && /\/drafts\/[^/]+$/.test(r.url),
    );
    expect(entwurfsPuts).toHaveLength(0);

    const schluessel = gesendeteVorgangsschluessel();
    expect(schluessel).toHaveLength(2);
    expect(schluessel[0]).toBe(schluessel[1]);
    unmount();
  });
});
