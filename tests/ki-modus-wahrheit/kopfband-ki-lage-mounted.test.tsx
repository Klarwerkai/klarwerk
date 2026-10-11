// @vitest-environment jsdom
// AUFTRAG ki-modus-wahrheit · R-0599 (Ben nacharbeit-2): die KI-Lage steht dauerhaft in der
// Kopfzeile — gemountet, aus der Serverauskunft `GET /api/ki-lage` (hier die Endpunkt-Attrappe),
// ohne DSGVO-Ja/Nein-Aussage. Gegenprobe: scheitert der Abruf, sagt die Zeile „unbekannt" statt
// eine Lage zu erfinden.
import { afterEach, describe, expect, it, vi } from "vitest";

const kiLage = vi.fn();

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { reasoner: { kiLage: () => kiLage() } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import i18n from "../../apps/web/src/i18n";
import { KiLageZeile } from "../../apps/web/src/shell/KiLageZeile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function zeile(): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(createElement(QueryClientProvider, { client: qc }, createElement(KiLageZeile)));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  const el = container.querySelector<HTMLElement>('[data-testid="kopfband-ki-lage"]');
  if (!el) throw new Error("KI-Zeile fehlt");
  return el;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  kiLage.mockReset();
});

describe("R-0599 · die Kopfzeile zeigt die KI-Lage des Servers", () => {
  it("M1 · extern: Modus und Anbieter sichtbar, Hinweis mit Datenfluss — keine DSGVO-Aussage", async () => {
    await i18n.changeLanguage("de");
    kiLage.mockResolvedValue({
      modus: "extern",
      anbieter: "openai",
      anbieterName: "ChatGPT (OpenAI)",
      herkunft: { land: "us", nachweis: "behauptet" },
    });
    const el = await zeile();
    expect(el.textContent).toBe("KI: extern · ChatGPT (OpenAI)");
    // Statusbereich über das semantische Element (implizite Rolle „status“).
    expect(el.tagName).toBe("OUTPUT");
    const hinweis = el.getAttribute("title") ?? "";
    expect(hinweis.startsWith("KI: extern · ChatGPT (OpenAI) — ")).toBe(true);
    expect(hinweis).not.toMatch(/dsgvo/i);
  });

  it("M2 · keine KI: ehrlich „regelbasiert“", async () => {
    await i18n.changeLanguage("de");
    kiLage.mockResolvedValue({
      modus: "keine",
      anbieter: null,
      anbieterName: null,
      herkunft: null,
    });
    expect((await zeile()).textContent).toBe("Keine KI · regelbasiert");
  });

  // Ben nacharbeit-7 (R-0940/R-2142): die bekannte Erreichbarkeit steht im sichtbaren Satz.
  it("M4 · bestätigt erreichbar und noch ungeprüft sind zwei verschiedene Sätze", async () => {
    await i18n.changeLanguage("de");
    const lage = {
      modus: "extern",
      anbieter: "openai",
      anbieterName: "ChatGPT (OpenAI)",
      herkunft: { land: "us", nachweis: "behauptet" },
    };
    kiLage.mockResolvedValue({ ...lage, verfuegbarkeit: "erreichbar" });
    expect((await zeile()).textContent).toBe("KI: extern · ChatGPT (OpenAI) · antwortet");
    act(() => root?.unmount());
    container?.remove();
    kiLage.mockResolvedValue({ ...lage, verfuegbarkeit: "ungeprueft" });
    expect((await zeile()).textContent).toBe(
      "KI: extern · ChatGPT (OpenAI) · Erreichbarkeit noch nicht bestätigt",
    );
  });

  // Ben nacharbeit-9: der nächste Lauf sendet zuerst wieder an diesen Anbieter — die Zeile nennt ihn
  // weiter, mit dem Fehlschlag, und behauptet keinen Ersatzweg.
  it("M5 · zuletzt gescheitert: der Anbieter bleibt genannt, mit Fehlschlag, ohne Ersatzzusage", async () => {
    await i18n.changeLanguage("de");
    kiLage.mockResolvedValue({
      modus: "extern",
      anbieter: "openai",
      anbieterName: "ChatGPT (OpenAI)",
      herkunft: { land: "us", nachweis: "behauptet" },
      verfuegbarkeit: "unerreichbar",
    });
    const el = await zeile();
    expect(el.textContent).toBe("KI: extern · ChatGPT (OpenAI) · zuletzt nicht erreichbar");
    const hinweis = el.getAttribute("title") ?? "";
    expect(hinweis).toContain("beim letzten Versuch nicht geantwortet");
    expect(hinweis).not.toMatch(/regelbasiert|Ersatz/);
  });

  it("M3 · Abruf gescheitert: „unbekannt“, keine erfundene Lage", async () => {
    await i18n.changeLanguage("de");
    kiLage.mockRejectedValue(new Error("401"));
    expect((await zeile()).textContent).toBe("KI-Lage unbekannt");
  });
});
