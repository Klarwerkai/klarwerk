// @vitest-environment jsdom
// ================================================================================================
// Aufnahme gesamt-integrations-api · R-0842 — AUCH DIE KI-HILFESUCHE ZEIGT DEN WARTESATZ.
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): `POST /api/help/explain` steht unter der KI-Bremse
// (`services/app/src/ki-anfragebremse.ts`), aber das Klara-Panel zeigte bei der Abweisung nur
// „state.error" — ohne Wartezeit. Gemessen wird das ECHTE Panel mit dem ECHTEN Clientabruf; ersetzt
// ist nur der Transport (`fetch`) und `AiModelInfo` (Bauform wie
// `tests/funktionsschalter/klara-ki-abgeschaltet.test.tsx`).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";

vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FRAGE = "Wie lege ich einen neuen Eintrag an?";
const WARTESATZ =
  "Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte warten Sie 42 Sekunden und versuchen Sie es dann erneut.";
const NUTZBAR = {
  active: true,
  mode: "local",
  reachable: "active",
  tasks: { answer: true },
  billable: { answer: false },
  kiAbgeschaltet: false,
};

let erklaerAntwort: { code: number; rumpf: unknown } = { code: 429, rumpf: {} };
let erklaerAbrufe = 0;
let vorherigerFetch: typeof globalThis.fetch;
let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let client: QueryClient | null = null;

beforeEach(() => {
  erklaerAbrufe = 0;
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown) => {
    const url = String(eingabe);
    let code = 404;
    let rumpf: unknown = { error: "NOT_FOUND", message: "nicht da" };
    if (url === "/api/reasoner/status") {
      code = 200;
      rumpf = NUTZBAR;
    } else if (url === "/api/help/explain") {
      erklaerAbrufe += 1;
      code = erklaerAntwort.code;
      rumpf = erklaerAntwort.rumpf;
    }
    const text = JSON.stringify(rumpf);
    return {
      status: code,
      statusText: String(code),
      ok: code >= 200 && code < 300,
      text: async () => text,
      json: async () => JSON.parse(text),
    };
  }) as unknown as typeof globalThis.fetch;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  client?.clear();
  host?.remove();
  root = null;
  client = null;
  host = null;
  globalThis.fetch = vorherigerFetch;
});

async function durchatmen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

async function kiSucheAusloesen(): Promise<HTMLDivElement> {
  const neuerHost = document.createElement("div");
  document.body.append(neuerHost);
  const neueWurzel = createRoot(neuerHost);
  const neuerClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  host = neuerHost;
  root = neueWurzel;
  client = neuerClient;
  await act(async () => {
    neueWurzel.render(
      createElement(
        QueryClientProvider,
        { client: neuerClient },
        createElement(
          MemoryRouter,
          {
            initialEntries: ["/bibliothek"],
            future: { v7_startTransition: true, v7_relativeSplatPath: true },
          },
          createElement(KlaraAssistant),
        ),
      ),
    );
  });
  await durchatmen();
  const oeffnen = neuerHost.querySelector<HTMLButtonElement>(
    `button[aria-label="${i18n.t("klara.open")}"]`,
  );
  expect(oeffnen, "der Öffnen-Knopf des Klara-Panels fehlt").not.toBeNull();
  await act(async () => oeffnen?.click());
  const eingabe = neuerHost.querySelector<HTMLInputElement>("input");
  expect(eingabe, "das Suchfeld des Panels fehlt").not.toBeNull();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(eingabe, FRAGE);
    eingabe?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await durchatmen();
  const knopf = [...neuerHost.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent === i18n.t("klara.aiSearch"),
  );
  expect(knopf?.disabled, "der KI-Knopf ist nicht bedienbar").toBe(false);
  await act(async () => knopf?.click());
  await durchatmen();
  expect(erklaerAbrufe, "die KI-Hilfesuche wurde nie abgefragt").toBeGreaterThan(0);
  return neuerHost;
}

describe("R-0842 · die KI-Hilfesuche bei gebremster Anfrage", () => {
  it("H1 · zeigt den Satz des Servers mit Wartezeit statt des allgemeinen Fehlertexts", async () => {
    await i18n.changeLanguage("de");
    erklaerAntwort = {
      code: 429,
      rumpf: { error: "KI_ANFRAGEN_GEBREMST", message: WARTESATZ, wartenSek: 42 },
    };
    const panel = await kiSucheAusloesen();
    const fehler = panel.querySelector('[data-testid="klara-ai-fehler"]');
    expect(fehler, "kein Fehlerzustand im Panel").not.toBeNull();
    expect(fehler?.textContent).toBe(WARTESATZ);
    expect(fehler?.textContent).not.toBe(i18n.t("state.error"));
  });

  it("H2 · Gegenprobe: ein anderer Fehler behält den allgemeinen Fehlertext", async () => {
    await i18n.changeLanguage("de");
    erklaerAntwort = { code: 500, rumpf: { error: "INTERNAL", message: "Unerwarteter Fehler." } };
    const panel = await kiSucheAusloesen();
    const fehler = panel.querySelector('[data-testid="klara-ai-fehler"]');
    expect(fehler?.textContent).toBe(i18n.t("state.error"));
  });
});
