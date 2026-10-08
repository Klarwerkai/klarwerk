// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0942 — KLARA ÖFFNET ALS AUFKLAPPENDE FLÄCHE, NICHT ALS SPERRENDES FENSTER.
// ================================================================================================
//
// DER ORIGINALWORTLAUT: „Klara öffnet sich als aufklappender Bereich, nicht als Dialogfenster, das
// den Rest sperrt. Der Auslöser meldet seinen Zustand für Hilfsmittel, der Fokus springt beim
// Öffnen hinein, Escape schließt, und der Fokus kehrt nur zurück, wenn er noch drinnen war."
//
// DER BEFUND (Quelltext am Basisstand 6f9e961b, `components/KlaraAssistant.tsx`): nicht sperrend
// und Escape schließt — beides war da. Es fehlten der gemeldete Zustand am Auslöser (kein
// `aria-expanded`), der Fokussprung beim Öffnen und die bedingte Rückkehr beim Schließen.
// „Auch auf kleinen Bildschirmen erscheint Klara vollständig" misst die vorhandene Chromium-Matrix
// `tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts` (N-0033, 320/390/1280) — hier nicht
// noch einmal in jsdom behauptet, weil jsdom keine Geometrie hat.
//
// GEPRÜFT WIRD DAS ECHTE BAUTEIL `KlaraAssistant` mit echtem Router und echtem i18n. Ersetzt sind
// nur die Modellverfügbarkeit und die Modellanzeige — dieselben zwei Attrappen wie
// `tests/dok1-export-wahrheit/faq-anzeigeweg.test.tsx`.
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

vi.mock("../../apps/web/src/lib/useAiAvailable", () => ({
  useAiAvailable: () => ({ available: false, isLoading: false }),
}));
vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let draussen: HTMLButtonElement;
let root: ReturnType<typeof createRoot>;
let client: QueryClient;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // Ein gewöhnliches Bedienelement der Seite AUSSERHALB von Klara — der Ort, an dem ein Mensch
  // weiterarbeitet, während Klara offen steht.
  draussen = document.createElement("button");
  draussen.textContent = "Seitenknopf";
  document.body.append(draussen);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
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
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  host.remove();
  draussen.remove();
  vi.restoreAllMocks();
});

function ausloeser(): HTMLButtonElement {
  const knopf = host.querySelector<HTMLButtonElement>(
    `button[aria-label="${i18n.t("klara.open")}"]`,
  );
  if (!knopf) {
    throw new Error("Der Klara-Auslöser fehlt.");
  }
  return knopf;
}

function flaeche(): HTMLElement | null {
  return host.querySelector<HTMLElement>("section[data-klara='1']");
}

async function oeffnen(): Promise<HTMLElement> {
  await act(async () => ausloeser().click());
  const offen = flaeche();
  if (!offen) {
    throw new Error("Klara hat sich nicht geöffnet.");
  }
  return offen;
}

async function escapeDruecken(): Promise<void> {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
}

describe("R-0942 · Klara als aufklappende Fläche", () => {
  it("A1 · geschlossen meldet der Auslöser „zugeklappt“ und verweist auf keine Fläche", () => {
    expect(ausloeser().getAttribute("aria-expanded")).toBe("false");
    expect(ausloeser().hasAttribute("aria-controls")).toBe(false);
    expect(flaeche()).toBeNull();
  });

  it("A2 · geöffnet meldet er „aufgeklappt“, verweist auf die Fläche, und der Fokus steht darin", async () => {
    const offen = await oeffnen();
    expect(ausloeser().getAttribute("aria-expanded")).toBe("true");
    expect(offen.id, "die Fläche trägt keine Kennung").not.toBe("");
    expect(ausloeser().getAttribute("aria-controls")).toBe(offen.id);
    expect(
      offen.contains(document.activeElement),
      "der Fokus ist beim Öffnen nicht in Klara gesprungen",
    ).toBe(true);
  });

  it("A3 · kein sperrendes Fenster: kein Dialog, kein aria-modal, nichts auf der Seite wird inert", async () => {
    const offen = await oeffnen();
    expect(offen.getAttribute("role")).not.toBe("dialog");
    expect(offen.hasAttribute("aria-modal")).toBe(false);
    expect(document.querySelectorAll("[inert]")).toHaveLength(0);
    expect(document.querySelectorAll("[aria-hidden='true'] button")).toHaveLength(0);
    // Der Seitenknopf bleibt erreichbar, während Klara offen steht.
    draussen.focus();
    expect(document.activeElement).toBe(draussen);
    expect(flaeche(), "Klara hat sich beim Wechsel auf die Seite geschlossen").not.toBeNull();
  });

  it("A4 · Escape schließt; stand der Fokus in Klara, kehrt er zum Auslöser zurück", async () => {
    await oeffnen();
    await escapeDruecken();
    expect(flaeche()).toBeNull();
    expect(ausloeser().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(ausloeser());
  });

  it("A5 · Escape schließt; stand der Fokus schon draußen, bleibt er dort", async () => {
    await oeffnen();
    draussen.focus();
    await escapeDruecken();
    expect(flaeche()).toBeNull();
    expect(document.activeElement, "der Fokus wurde aus der Seite zurückgerissen").toBe(draussen);
  });

  it("A6 · der Schließen-Knopf in Klara gibt den Fokus an den Auslöser zurück", async () => {
    const offen = await oeffnen();
    const zu = offen.querySelector<HTMLButtonElement>(
      `button[aria-label="${i18n.t("cmd.close")}"]`,
    );
    if (!zu) {
      throw new Error("Der Schließen-Knopf fehlt.");
    }
    zu.focus();
    await act(async () => zu.click());
    expect(flaeche()).toBeNull();
    expect(document.activeElement).toBe(ausloeser());
  });
});
