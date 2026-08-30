// @vitest-environment jsdom
// ================================================================================================
// JOB 2703 · D2 — WO DER MENSCH DIE ANTWORT LIEST: die Ask-Trefferliste (Web) und das
// Aufgabenfenster (Word). Beide zeigen die KANONISCH gekuerzte Kernaussage, nicht die Seite.
// ================================================================================================
//
// WEB: der importierte Kandidat wird angenommen (PUT .../candidates/:id accept), das entstandene
// Wissensobjekt validiert, dann die ECHTE Fragen-Seite `Ask` mit echten Providern gemountet; die
// Frage geht ueber die Transportbruecke an die ECHTE App (`/api/ask`). Gelesen wird die Antwort-
// Karte `[data-testid="ask-answer"]`.
//
// WORD: das AUSGELIEFERTE Aufgabenfenster (taskpane.html, Fixture `createKlaraPanel`) laeuft mit der
// Antwort, die die ECHTE App auf dieselbe Frage gegeben hat (aufgenommen ueber `inject`, weil die
// Fixture synchrone Routen braucht). Gelesen wird das Antwortfeld `#ask-answer-edit`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { KERNAUSSAGE_MAX } from "../../services/structure";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";
import { type KlaraPanel, createKlaraPanel, reply } from "./klara-panel-fixture";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };
const SATZ =
  "Die Pumpe P-12 wird wöchentlich auf Dichtheit geprüft und das Ergebnis dokumentiert. ";
const DREISSIG_KB = SATZ.repeat(Math.ceil(30_000 / SATZ.length));
const FRAGE = "Wie oft wird die Pumpe P-12 auf Dichtheit geprüft?";

function seite(): ConfluencePage {
  return {
    id: "2704",
    title: "Pumpe P-12",
    body: { storage: { value: `<p>${DREISSIG_KB}</p>` } },
    version: { number: 1 },
    _links: { webui: "/spaces/K/pages/2704/x" },
    metadata: { labels: { results: [] } },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  };
}

interface Kandidat {
  id: string;
  koId?: string | null;
  item: { statement: string };
}

let b: Bruecke;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let panel: KlaraPanel | null = null;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // `knopfFreigeben`: der einzige Ersatz (s. job2703-bruecke.ts) — ohne ihn sperrt die Fragen-Seite
  // in einer modelllosen Testapp das Absenden, und es gaebe nichts zu messen.
  b = await bruecke({ knopfFreigeben: true });
});

afterEach(async () => {
  if (panel) {
    await panel.flush();
    panel.restore();
    panel = null;
  }
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  b.abbauen();
});

/** Import → Annahme → Validierung: das Wissensobjekt, das die Frage tragen soll. */
async function wissensobjekt(): Promise<{ koId: string; kernaussage: string }> {
  const item = mapConfluencePageToImportItem(seite(), OPTS);
  const angelegt = await b.a.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: b.kopf,
    payload: { items: [item] },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const kandidat = (angelegt.json() as Kandidat[])[0];
  if (!kandidat) {
    throw new Error("kein Kandidat angelegt");
  }
  const angenommen = await b.a.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${kandidat.id}`,
    headers: b.kopf,
    payload: { action: "accept" },
  });
  expect(angenommen.statusCode, angenommen.body).toBe(200);
  const koId = (angenommen.json() as Kandidat).koId ?? "";
  expect(koId, "Annahme hat kein Wissensobjekt erzeugt").not.toBe("");
  const ko = await b.a.inject({ method: "GET", url: `/api/kos/${koId}`, headers: b.kopf });
  if ((ko.json() as { status: string }).status !== "validiert") {
    const validiert = await b.a.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: b.kopf,
      payload: { action: "admin-validate" },
    });
    expect(validiert.statusCode, validiert.body).toBe(200);
  }
  // SCRUM-511: ohne Governance-Signal ist ein Import fail-safe „vertraulich" — und Vertrauliches
  // verlaesst den Ask-Dienst nicht (dropConfidential). Der Admin stuft hier bewusst auf „intern"
  // herab (ko.validate traegt das Herabstufen); erst dann darf die Antwort darauf stehen.
  const intern = await b.a.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: b.kopf,
    payload: { action: "confidentiality", level: "intern" },
  });
  expect(intern.statusCode, intern.body).toBe(200);
  return { koId, kernaussage: item.statement };
}

async function askMounten(): Promise<void> {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
              MemoryRouter,
              { initialEntries: ["/fragen"] },
              createElement(ToastProvider, null, createElement(Ask)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
}

async function fragen(frage: string): Promise<void> {
  const feld = container.querySelector<HTMLInputElement>("form input");
  if (!feld) {
    throw new Error(`kein Fragefeld: ${(container.textContent ?? "").slice(0, 300)}`);
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, frage);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  const form = feld.closest("form");
  if (!form) {
    throw new Error("Fragefeld ohne Formular");
  }
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
  for (let i = 0; i < 30; i += 1) {
    await act(flush);
  }
}

describe("JOB 2703 · D2 · Ask-Trefferliste und Aufgabenfenster zeigen die Kernaussage, nicht die Seite", () => {
  it("A1 · WEB: die Antwort-Karte der echten Fragen-Seite traegt die kanonische Kernaussage (hoechstens KERNAUSSAGE_MAX Zeichen), nicht 30 KB", async () => {
    const { kernaussage } = await wissensobjekt();
    await askMounten();
    await fragen(FRAGE);
    const karte = container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
    expect(
      karte,
      `keine Antwort-Karte: ${(container.textContent ?? "").replace(/\s+/g, " ").slice(0, 400)}`,
    ).not.toBeNull();
    const text = (karte?.textContent ?? "").replace(/\s+/g, " ");
    console.info(
      `JOB 2703 · A1 · Antwort-Karte ${text.length} Zeichen · Kernaussage ${kernaussage.length} Zeichen`,
    );
    expect(text).toContain(kernaussage.trim());
    expect(text).not.toContain(SATZ.repeat(8));
    expect(kernaussage.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(b.aufrufe.some((c) => c.method === "POST" && c.url === "/api/ask")).toBe(true);
    // Die TREFFERLISTE: die tragende Quelle steht mit ihrem Titel in der Karte.
    const treffer = container.querySelector<HTMLElement>('[data-testid="ask-source-carrying"]');
    expect(treffer, "keine tragende Quelle in der Trefferliste").not.toBeNull();
    const zeile = treffer?.closest("li") ?? treffer?.parentElement ?? null;
    expect((zeile?.textContent ?? "").replace(/\s+/g, " ")).toContain("Pumpe P-12");
  });

  it("A2 · WORD: das ausgelieferte Aufgabenfenster zeigt im Antwortfeld die Antwort der echten App — die Kernaussage, hoechstens KERNAUSSAGE_MAX Zeichen", async () => {
    const { koId, kernaussage } = await wissensobjekt();
    // Die ECHTE Antwort der App auf dieselbe Frage — aufgenommen, weil die Fixture synchrone Routen
    // verlangt. Kein erfundener Antwortkoerper.
    const antwort = await b.a.inject({
      method: "POST",
      url: "/api/ask",
      headers: b.kopf,
      payload: { question: FRAGE, locale: "de", mode: "retrieval-only" },
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    const ko = await b.a.inject({ method: "GET", url: `/api/kos/${koId}`, headers: b.kopf });
    expect((antwort.json() as { result: { answered: boolean } }).result.answered).toBe(true);
    panel = createKlaraPanel({
      withOffice: false,
      routes: {
        "/api/ask": reply(200, antwort.json()),
        "/api/kos/": reply(200, ko.json()),
      },
    });
    await panel.flush();
    const eingabe = panel.q("#ask-input");
    if (!eingabe) {
      throw new Error("Panel ohne Fragefeld");
    }
    eingabe.value = FRAGE;
    panel.askKlara();
    await panel.flush();
    await panel.flush();
    const feld = panel.text("#ask-answer-edit");
    const wert = panel.q("#ask-answer-edit")?.value ?? "";
    const gezeigt = wert || feld;
    console.info(
      `JOB 2703 · A2 · Antwortfeld ${gezeigt.length} Zeichen · Status „${panel.text("#ask-status")}"`,
    );
    expect(gezeigt.replace(/\s+/g, " ")).toContain(kernaussage.trim());
    expect(gezeigt.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX + 50);
    expect(gezeigt).not.toContain(SATZ.repeat(8));
  });
});
