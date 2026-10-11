// @vitest-environment jsdom
// ================================================================================================
// R-0161 — ZUSATZWISSEN AUS MODELLWISSEN ODER BELEGTER WEBSUCHE: EXTERN, UNGEPRÜFT, NUR AUF KLICK.
// ================================================================================================
//
// Der Serverweg ist belegt (`tests/app/enrich-e2e.test.ts`: Gate unterhalb „offen" 403, ohne Modell
// ehrlich leer). Was bisher kein Fall las, ist die Fläche selbst: dass ein Ergebnis IMMER die Marke
// „extern · ungeprüft" trägt und erst auf den bewussten Klick in den Entwurf geht — nie beim
// Eintreffen. Gemountet wird das ECHTE `PublicAiEnrichPanel`; gestellt sind allein die zwei
// Datenquellen (`endpoints.reasoner.enrich`, `endpoints.external.search`), der Rest bleibt Produkt.
//
// GELESEN WIRD AM ERGEBNIS:
//   E1  Modellwissen: Marke sichtbar, `onAppendHtml` vor dem Klick nie gerufen, danach genau einmal
//       mit der Herkunftsklasse `panel-external` und escaptem Text.
//   E2  Websuche: Titel, Link und Textauszug mit Marke; übernommen wird genau der angeklickte Treffer.
//   E3  KALIBRIERUNG: ohne verbundenes Modell (demo) gibt es nichts zu übernehmen; unterhalb „offen"
//       gibt es kein Eingabefeld und keinen Abruf. Ohne E3 wären E1/E2 auch dann grün, wenn die
//       Fläche jede Antwort ungeprüft anböte.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: { ...original.endpoints.reasoner, enrich: vi.fn() },
      external: { ...original.endpoints.external, search: vi.fn() },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ExternalKnowledgeStage } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { PublicAiEnrichPanel } from "../../apps/web/src/components/PublicAiEnrichPanel";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const enrichMock = endpoints.reasoner.enrich as unknown as ReturnType<typeof vi.fn>;
const searchMock = endpoints.external.search as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let uebernommen: string[];

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(stage: ExternalKnowledgeStage): Promise<void> {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/erfassen"] },
              createElement(PublicAiEnrichPanel, {
                stage,
                locale: "de",
                onAppendHtml: (html: string) => {
                  uebernommen.push(html);
                },
              }),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
}

function knopf(text: string): HTMLButtonElement {
  // Genauer Wortlaut: der HelpTip-Text nennt „Web-Suche" ebenfalls.
  const treffer = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === text,
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${text}" fehlt; sichtbar: ${container.textContent}`);
  }
  return treffer;
}

function uebernehmenKnoepfe(): HTMLButtonElement[] {
  return [...container.querySelectorAll("button")].filter(
    (b) => (b.textContent ?? "").trim() === i18n.t("enrich.take"),
  );
}

async function anfragen(text: string): Promise<void> {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("placeholder") === i18n.t("enrich.placeholder"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Eingabefeld fehlt; sichtbar: ${container.textContent}`);
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    knopf(i18n.t("enrich.run")).click();
    await flush();
  });
}

beforeEach(async () => {
  uebernommen = [];
  enrichMock.mockReset();
  searchMock.mockReset();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("R-0161: Zusatzwissen ist extern, ungeprüft und wird nur auf Klick übernommen", () => {
  it("E1 · Modellwissen: Marke sichtbar, Übernahme erst und genau mit dem Klick", async () => {
    enrichMock.mockResolvedValue({
      text: "Wälzlager <b>halten</b> ca. 20.000 h.",
      provider: "cloud",
      demo: false,
    });
    await mount("open");
    await anfragen("Wälzlager Lebensdauer");

    expect(enrichMock).toHaveBeenCalledWith("Wälzlager Lebensdauer", "de");
    expect(searchMock).not.toHaveBeenCalled();
    const text = container.textContent ?? "";
    expect(text).toContain("Extern · ungeprüft");
    expect(text).toContain(i18n.t("enrich.externBadge"));
    expect(text).toContain(i18n.t("enrich.disclaimer"));
    expect(text).toContain("Wälzlager <b>halten</b> ca. 20.000 h.");

    // Das Eintreffen allein übernimmt nichts.
    expect(uebernommen).toEqual([]);

    const knoepfe = uebernehmenKnoepfe();
    expect(knoepfe).toHaveLength(1);
    await act(async () => {
      knoepfe[0]?.click();
    });

    expect(uebernommen).toHaveLength(1);
    const html = uebernommen[0] ?? "";
    expect(html).toContain('class="panel panel-external"');
    expect(html).toContain(`[${i18n.t("enrich.externBadge")}]`);
    expect(html).toContain("Wälzlager &lt;b&gt;halten&lt;/b&gt; ca. 20.000 h.");
    expect(html).not.toContain("<b>halten</b>");
  });

  it("E2 · Websuche: Titel, Link und Textauszug mit Marke; übernommen wird nur der angeklickte Treffer", async () => {
    searchMock.mockResolvedValue([
      {
        title: "Wälzlager",
        url: "https://de.wikipedia.org/wiki/W%C3%A4lzlager",
        snippet: "Ein Wälzlager ist ein Lager.",
        provider: "Wikipedia",
      },
      {
        title: "Gleitlager",
        url: "https://de.wikipedia.org/wiki/Gleitlager",
        snippet: "Ein Gleitlager gleitet.",
        provider: "Wikipedia",
      },
    ]);
    await mount("open");
    await act(async () => {
      knopf(i18n.t("enrich.modeWeb")).click();
    });
    await anfragen("Lager");

    expect(searchMock).toHaveBeenCalledWith("Lager");
    expect(enrichMock).not.toHaveBeenCalled();
    const eintraege = [...container.querySelectorAll("li")];
    expect(eintraege).toHaveLength(2);
    for (const li of eintraege) {
      expect(li.textContent).toContain(i18n.t("enrich.externBadge"));
    }
    expect(eintraege[0]?.textContent).toContain("Ein Wälzlager ist ein Lager.");
    expect(eintraege[1]?.querySelector("a")?.getAttribute("href")).toBe(
      "https://de.wikipedia.org/wiki/Gleitlager",
    );
    expect(uebernommen).toEqual([]);

    await act(async () => {
      uebernehmenKnoepfe()[1]?.click();
    });

    expect(uebernommen).toHaveLength(1);
    const html = uebernommen[0] ?? "";
    expect(html).toContain('class="panel panel-external"');
    expect(html).toContain(`[${i18n.t("enrich.externBadge")}]`);
    expect(html).toContain("Gleitlager");
    expect(html).toContain('<a href="https://de.wikipedia.org/wiki/Gleitlager">');
    expect(html).not.toContain("Wälzlager");
  });

  it("E3a · KALIBRIERUNG: ohne verbundenes Modell (demo) gibt es nichts zu übernehmen", async () => {
    enrichMock.mockResolvedValue({ text: "", provider: "none", demo: true });
    await mount("open");
    await anfragen("Wälzlager");

    expect(container.textContent).toContain(i18n.t("enrich.noModel"));
    expect(uebernehmenKnoepfe()).toHaveLength(0);
    expect(uebernommen).toEqual([]);
  });

  it("E3b · KALIBRIERUNG: unterhalb „offen“ kein Eingabefeld, kein Abruf, nichts zu übernehmen", async () => {
    for (const stage of ["blocked", "search_on_click", "search_attach"] as const) {
      await mount(stage);
      expect(container.querySelector("input"), `${stage}: Eingabefeld`).toBeNull();
      expect(container.textContent, `${stage}: Hinweis`).toContain(i18n.t("enrich.disabledHint"));
      expect(uebernehmenKnoepfe(), `${stage}: Übernahmeknopf`).toHaveLength(0);
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    // Zuletzt erneut gemountet, damit afterEach etwas abzuräumen hat.
    await mount("blocked");
    expect(enrichMock).not.toHaveBeenCalled();
    expect(searchMock).not.toHaveBeenCalled();
    expect(uebernommen).toEqual([]);
  });
});
