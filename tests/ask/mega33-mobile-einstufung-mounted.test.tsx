// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega33 BLOCK A4 (bens ROT 4) — DIE MOBILE ANSICHT, GEFAHREN.
// ================================================================================================
//
// bens zehnte Leseflache: `mobileAsk.ts` leitete die Evidenz noch einmal eigenstaendig aus
// `answer.knowledgeClass` ab. Die mobile Antwort zeigte deshalb „Evidenz: Gesichert", wo die
// Desktop-Seite fuer dieselbe Antwort laengst einen Pruefvorbehalt trug.
//
// Dieser Test fahrt die ECHTE mobile Seite und belegt beide Richtungen: gedeckelte Quelle ⇒
// nirgends mehr „Gesichert", dafuer der benannte Vorbehalt; belegter Lauf ⇒ das Wort darf stehen.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({ kos: [] as unknown[] }));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => []) },
    drafts: { list: vi.fn(async () => []) },
    library: { search: vi.fn(async () => []) },
    ask: {
      ask: vi.fn(async () => ({
        result: {
          answered: true,
          answer: "Ventil V4 wird jährlich geprüft.",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["k1"],
          // mega53 B1: die Antwort steht auf dieser Quelle — ohne Zuordnung koennte sie
          // seit mega53 gar nicht mehr "gesichert" heissen (das ist der Fall in
          // tests/ask/mega53-zwei-faelle.test.ts).
          citedSources: ["k1"],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "r",
      })),
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
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

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
// Der Lauf meldet „done", nichts uebersprungen, nichts abgebrochen — nur gedeckelt. Bens Fall.
const CAPPED = {
  ...PROVEN,
  available: 12479,
  selected: 20,
  attempted: 20,
  completed: 20,
  capped: true,
};

// Kein \b-Anker: `textContent` klebt Plaketten aneinander. Geprueft wird das Wort in seiner
// Anzeigeform (grosses G).
const GESICHERT = "Gesichert";

function ko(aiCheck: unknown) {
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
    aiCheck,
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function mountMobileAndAsk(): Promise<string> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
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

  // Reiter „Fragen" oeffnen.
  const askTab = Array.from(container.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === i18n.t("mob.tabAsk"),
  );
  expect(askTab, "Reiter Fragen nicht gefunden").toBeTruthy();
  await act(async () => {
    askTab?.click();
    await flush();
  });

  // Frage stellen.
  const input = container.querySelector<HTMLInputElement>(
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
  const form = container.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
  await act(flush);
  return container.textContent ?? "";
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega33 A4 · die mobile Antwort spricht dieselbe Einstufung wie der Desktop", () => {
  it("gedeckelte Quelle: kein „Gesichert“ mehr, dafür der benannte Prüfvorbehalt", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const text = await mountMobileAndAsk();

    // Die Antwort ist wirklich da (sonst wäre die Zusage unten trivial erfüllt).
    expect(text).toContain("Ventil V4 wird jährlich geprüft.");
    // Die zehnte Lesefläche behauptet keine Sicherheit mehr …
    expect(text).not.toContain(GESICHERT);
    expect(text).toContain(`${i18n.t("ask.evidence")}: ${i18n.t("ask.knowledgeClass.ungeprueft")}`);
    // … und sie sagt, worauf sich der Vorbehalt bezieht — wie auf dem Desktop.
    expect(container.querySelector('[data-testid="mob-check-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.checkCaveat.title"));
    expect(text).toContain("1 von 1");
  });

  it("Gegenprobe: mit belegtem Lauf steht „Gesichert“ auch mobil", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: PROVEN })];
    const text = await mountMobileAndAsk();

    expect(text).toContain(GESICHERT);
    expect(container.querySelector('[data-testid="mob-check-caveat"]')).toBeNull();
  });
});
