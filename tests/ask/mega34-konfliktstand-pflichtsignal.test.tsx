// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega34 BLOCK A (bens schwerster Befund aus sammel32) — „NICHTS DA" IST NICHT
// „NICHTS VORHANDEN".
// ================================================================================================
//
// mega31 hat die Beweislast am ERGEBNIS umgekehrt: ohne belegten Prüf-Lauf kein „gesichert".
// mega33 hat sie am VERTRAG erzwungen: `sourcesCheckUnproven` ist Pflichtfeld, niemand kann die
// Bedingung mehr weglassen. Genau dieselbe Annahme lebte eine Schicht weiter außen ungebrochen
// weiter — am ABRUF:
//
//   `conflicts.data ?? []`
//
// Drei fachlich verschiedene Zustände fallen in dieses eine leere Array: erfolgreich geladen und
// leer · noch nicht geladen · Abruf fehlgeschlagen. In den letzten beiden weiß die Seite über
// Konflikte GAR NICHTS — und las das als „es gibt keine". Eine Antwort konnte dadurch `verified`
// werden, vorübergehend beim Laden und dauerhaft bei einem Netz- oder Backendfehler.
//
// Dieser Test fährt beide echten Leseflächen (Desktop und Mobil) mit einem hängenden und mit einem
// fehlgeschlagenen Konfliktabruf und belegt: keine Sicherheitsbehauptung, dafür ein benannter
// Hinweis, der sagt WARUM. Die Gegenprobe (erfolgreich geladen, leer, belegter Lauf) muss weiterhin
// „Gesichert" tragen — sonst wäre die Zusage durch bloßes Abschalten erfüllbar.
import { afterEach, describe, expect, it, vi } from "vitest";

// Der Konfliktabruf ist hier die Variable: er liefert, er hängt, oder er reißt ab.
const netz = vi.hoisted(() => ({
  kos: [] as unknown[],
  conflicts: "loaded" as "loaded" | "pending" | "failed",
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => netz.kos) },
    conflicts: {
      list: vi.fn(() => {
        if (netz.conflicts === "failed") {
          return Promise.reject(new Error("conflicts unreachable"));
        }
        if (netz.conflicts === "pending") {
          return new Promise(() => {}); // hängt — genau der Zustand „noch nicht geladen"
        }
        return Promise.resolve([]);
      }),
    },
    directory: { list: vi.fn(async () => []) },
    drafts: { list: vi.fn(async () => []) },
    library: { search: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => ({
        result: {
          answered: true,
          answer: "Ventil V4 wird jährlich geprüft.",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["k1"],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "r",
      })),
      helpful: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { conflictKnowledge, effectiveAnswer } from "../../apps/web/src/lib/effectiveAnswer";
import { Ask } from "../../apps/web/src/pages/Ask";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// Ein Lauf, über den ALLES belegt ist — damit die Einstufung an nichts anderem als am
// Konfliktstand scheitern kann.
const PROVEN = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

// Kein \b-Anker: `textContent` klebt die Plaketten aneinander.
const GESICHERT = "Gesichert";

function ko(): Record<string, unknown> {
  return {
    id: "k1",
    title: "Ventilprüfung",
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck: { status: "done", coverage: PROVEN },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Nur die gemounteten Fälle setzen diese beiden; die reinen Ableitungstests darunter fassen kein
// DOM an. Deshalb räumt afterEach unten defensiv auf.
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

// Zugriff auf den gemounteten Baum. Wirft, wenn nichts gemountet ist — das waere ein Fehler im
// Test selbst und soll laut scheitern, nicht still `null` liefern.
function find(selector: string): Element | null {
  if (!container) {
    throw new Error("Kein gemounteter Baum — find() vor mount aufgerufen");
  }
  return container.querySelector(selector);
}

function newClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

async function mountAsk(): Promise<string> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: newClient() },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen?q=Ventil&ask=1"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return el.textContent ?? "";
}

async function mountMobileAndAsk(): Promise<string> {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: newClient() },
        createElement(
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(MemoryRouter, { initialEntries: ["/mobile"] }, createElement(Mobile)),
          ),
        ),
      ),
    );
    await flush();
  });
  const askTab = Array.from(el.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === i18n.t("mob.tabAsk"),
  );
  expect(askTab, "Reiter Fragen nicht gefunden").toBeTruthy();
  await act(async () => {
    askTab?.click();
    await flush();
  });
  const input = el.querySelector<HTMLInputElement>(
    `input[placeholder="${i18n.t("ask.placeholder")}"]`,
  );
  expect(input, "Frage-Eingabe nicht gefunden").toBeTruthy();
  await act(async () => {
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "Wie oft wird V4 geprüft?");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush();
  });
  const form = el.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
  await act(flush);
  return el.textContent ?? "";
}

afterEach(() => {
  if (root) {
    const r = root;
    act(() => r.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
  document.body.innerHTML = "";
  netz.conflicts = "loaded";
});

// ================================================================================================
// A1 — DAS PFLICHTSIGNAL SELBST.
// ================================================================================================
describe("mega34 A1 · der Erfolg des Konfliktabrufs ist Pflichteingabe der Einstufung", () => {
  const answer = {
    answered: true,
    answer: "Ventil V4 wird jährlich geprüft.",
    knowledgeClass: "gesichert",
    trust: 90,
    sources: ["k1"],
    steps: [],
    demo: false,
  } as never;
  const kos = [ko()] as never;

  it("erfolgreich geladen und leer ⇒ verified, kein Konflikt-Vorbehalt", () => {
    const e = effectiveAnswer(answer, kos, { state: "loaded", items: [] });
    expect(e.grade).toBe("verified");
    expect(e.conflictCaveat).toBeNull();
  });

  it("noch nicht geladen ⇒ NIE verified, mit benanntem Hinweis", () => {
    const e = effectiveAnswer(answer, kos, { state: "pending", items: [] });
    expect(e.grade).toBe("unverified");
    expect(e.conflictCaveat).toEqual({ reason: "pending" });
    // Und die angezeigte Klasse darf das Wort nicht mehr tragen.
    expect(e.knowledgeClass).toBe("ungeprueft");
  });

  it("Abruf fehlgeschlagen ⇒ NIE verified, mit benanntem Hinweis", () => {
    const e = effectiveAnswer(answer, kos, { state: "failed", items: [] });
    expect(e.grade).toBe("unverified");
    expect(e.conflictCaveat).toEqual({ reason: "failed" });
    expect(e.knowledgeClass).toBe("ungeprueft");
  });

  // Der Ableiter, den BEIDE Seiten benutzen — damit Desktop und Mobil nicht getrennt driften
  // können. Er liest genau die drei react-query-Zustände.
  it("conflictKnowledge() bildet die drei Abrufzustände ab — und wirft im Fehlerfall die Daten weg", () => {
    expect(conflictKnowledge({ data: [], isSuccess: true, isError: false })).toEqual({
      state: "loaded",
      items: [],
    });
    expect(conflictKnowledge({ isSuccess: false, isError: false }).state).toBe("pending");
    // Stale-Daten aus einem früheren Lauf dürfen einen abgerissenen Abruf nicht beschönigen.
    const abgerissen = conflictKnowledge({ data: [], isSuccess: false, isError: true });
    expect(abgerissen.state).toBe("failed");
    expect(abgerissen.items).toEqual([]);
  });
});

// ================================================================================================
// A2/A3 — WAS DER LESER STATTDESSEN SIEHT. BEIDE FLÄCHEN, BEIDE FEHLERZUSTÄNDE.
// ================================================================================================
describe("mega34 A3 · Desktop: ein unbekannter Konfliktstand behauptet keine Sicherheit", () => {
  it("Konflikte laden noch: kein „Gesichert“, dafür der benannte Hinweis", async () => {
    await i18n.changeLanguage("de");
    netz.kos = [ko()];
    netz.conflicts = "pending";
    const text = await mountAsk();

    expect(text).toContain("Ventil V4 wird jährlich geprüft.");
    expect(text).not.toContain(GESICHERT);
    expect(find('[data-testid="ask-conflict-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.conflictCaveat.title"));
    expect(text).toContain(i18n.t("ask.conflictCaveat.pending"));
    expect(text).toContain(i18n.t("ask.contract.unverified.title"));
  });

  it("Konfliktabruf fehlgeschlagen: kein „Gesichert“, dafür der benannte Hinweis", async () => {
    await i18n.changeLanguage("de");
    netz.kos = [ko()];
    netz.conflicts = "failed";
    const text = await mountAsk();

    expect(text).toContain("Ventil V4 wird jährlich geprüft.");
    expect(text).not.toContain(GESICHERT);
    expect(find('[data-testid="ask-conflict-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.conflictCaveat.failed"));
    expect(text).toContain(i18n.t("ask.contract.unverified.title"));
  });

  it("Gegenprobe: erfolgreich geladen und leer ⇒ „Gesichert“ steht, kein Hinweis", async () => {
    await i18n.changeLanguage("de");
    netz.kos = [ko()];
    netz.conflicts = "loaded";
    const text = await mountAsk();

    expect(text).toContain(GESICHERT);
    expect(find('[data-testid="ask-conflict-caveat"]')).toBeNull();
  });
});

describe("mega34 A3 · Mobil: dieselbe Einstufung, derselbe Hinweis", () => {
  it("Konflikte laden noch: kein „Gesichert“, dafür der benannte Hinweis", async () => {
    await i18n.changeLanguage("de");
    netz.kos = [ko()];
    netz.conflicts = "pending";
    const text = await mountMobileAndAsk();

    expect(text).toContain("Ventil V4 wird jährlich geprüft.");
    expect(text).not.toContain(GESICHERT);
    expect(find('[data-testid="mob-conflict-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.conflictCaveat.pending"));
  });

  it("Konfliktabruf fehlgeschlagen: kein „Gesichert“, dafür der benannte Hinweis", async () => {
    await i18n.changeLanguage("de");
    netz.kos = [ko()];
    netz.conflicts = "failed";
    const text = await mountMobileAndAsk();

    expect(text).toContain("Ventil V4 wird jährlich geprüft.");
    expect(text).not.toContain(GESICHERT);
    expect(find('[data-testid="mob-conflict-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.conflictCaveat.failed"));
  });

  it("Gegenprobe: erfolgreich geladen und leer ⇒ „Gesichert“ steht, kein Hinweis", async () => {
    await i18n.changeLanguage("de");
    netz.kos = [ko()];
    netz.conflicts = "loaded";
    const text = await mountMobileAndAsk();

    expect(text).toContain(GESICHERT);
    expect(find('[data-testid="mob-conflict-caveat"]')).toBeNull();
  });
});
