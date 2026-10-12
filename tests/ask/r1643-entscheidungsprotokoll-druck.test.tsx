// @vitest-environment jsdom
// ================================================================================================
// R-1643 · ENTSCHEIDUNGS-PROTOKOLL — DER PDF-WEG AN DER ECHTEN FRAGENSEITE.
// ================================================================================================
//
// „Drucken / PDF" ist der PDF-Weg des Produkts. Bis R-1643 druckte er die Antwortkarte, in der
// Quellen, Schritte und Vertrauenswert hinter „Mehr" liegen — auf dem Blatt standen sie nicht, ein
// Zeitstempel und eine Nutzer-ID nirgends. Dieser Test misst im Augenblick von `window.print()`,
// was IN der Druckfläche steht, und dass das Protokoll danach wieder verschwindet. Dazu der
// Kopierweg: dieselbe Eingabe, also derselbe Zeitpunkt und dieselbe Kennung im Markdown.
// Aufbau wie `r0287-vorbehalt-sichtbar-mounted.test.tsx` (echte `Ask`-Seite, gemockte Endpunkte).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () => [
        {
          id: "k487",
          title: "Farbregelung Firmenwagen",
          statement: "Alle Firmenwagen werden in Blau bestellt.",
          type: "best_practice",
          category: "Betrieb",
          status: "validiert",
          trust: 91,
          author: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
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
          answer: "Ja — alle Firmenwagen werden in Blau bestellt.",
          knowledgeClass: "gesichert",
          trust: 91,
          sources: ["k487"],
          citedSources: ["k487"],
          steps: [{ description: "Farbregel geprüft", snippet: "Alle in Blau.", sourceId: "k487" }],
          // R-1643 (Ben, Nacharbeit 2): die Kette, wie der Reasoner sie aus der Deckungsprüfung
          // liefert — bewusst ein anderer Text als der Schritt, damit sichtbar ist, WAS gedruckt wird.
          argumentation: [
            {
              aussage: "Alle Firmenwagen werden in Blau bestellt.",
              quellen: ["k487"],
              belegtDurch: "k487",
            },
          ],
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(
  angemeldet: { id: string; role: string } | null,
): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Die Sitzungsabfrage, die `AuthContext` führt und `useKontoKennung` liest.
  if (angemeldet) {
    client.setQueryData(["auth", "me"], angemeldet);
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen?q=Firmenwagen&ask=1"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Druckt über das „…"-Menü der Antwortkarte und hält fest, was im Druckaugenblick dastand. */
async function drucken(container: HTMLElement): Promise<{
  gedruckt: number;
  protokoll: HTMLElement | null;
  inDruckflaeche: boolean;
  klasseGesetzt: boolean;
}> {
  const befund = {
    gedruckt: 0,
    protokoll: null as HTMLElement | null,
    inDruckflaeche: false,
    klasseGesetzt: false,
  };
  const echtesPrint = window.print;
  window.print = () => {
    befund.gedruckt += 1;
    const el = document.querySelector<HTMLElement>('[data-testid="ask-entscheidungsprotokoll"]');
    befund.protokoll = el ? (el.cloneNode(true) as HTMLElement) : null;
    befund.inDruckflaeche = Boolean(el?.closest(".print-area"));
    befund.klasseGesetzt = document.body.classList.contains("printing-extract");
  };
  try {
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
      await flush();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-print"]')?.click();
      await flush();
    });
  } finally {
    window.print = echtesPrint;
  }
  return befund;
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  document.body.className = "";
  // Der Arbeitsstand der Fragenseite merkt sich je Konto die verbrauchte Startadresse — ohne
  // Leeren fragte der nächste Fall mit derselben Kennung nicht mehr selbst.
  localStorage.clear();
});

describe("R-1643 · Drucken / PDF trägt das Entscheidungs-Protokoll", () => {
  it("im Druckaugenblick: Zeitstempel, Nutzer-ID, Schritte, Quelle mit Kennung und Vertrauenswert", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk({ id: "u-7", role: "experte" });
    const karte = container.querySelector('[data-testid="ask-answer"]');
    expect(karte, "keine Antwortkarte").not.toBeNull();
    // Vor dem Druck steht kein Protokoll im Baum — der Bildschirm bleibt, wie er war.
    expect(document.querySelector('[data-testid="ask-entscheidungsprotokoll"]')).toBeNull();

    const befund = await drucken(container);
    expect(befund.gedruckt).toBe(1);
    expect(befund.klasseGesetzt).toBe(true);
    expect(befund.protokoll, "kein Protokoll im Druckaugenblick").not.toBeNull();
    expect(befund.inDruckflaeche, "Protokoll liegt außerhalb der Druckfläche").toBe(true);
    expect(befund.protokoll?.classList.contains("print-only")).toBe(true);

    const text = befund.protokoll?.textContent ?? "";
    expect(text).toContain(i18n.t("ask.export.protocol.heading"));
    expect(text).toContain(i18n.t("ask.export.protocol.time"));
    // Voller ISO-Zeitstempel, nicht nur der Tag.
    expect(text).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    expect(text).toContain(i18n.t("ask.export.protocol.user"));
    expect(text).toContain("u-7");
    expect(text).toContain("Farbregel geprüft");
    expect(text).toContain("Alle in Blau.");
    expect(text).toContain("Farbregelung Firmenwagen");
    expect(text).toContain(`${i18n.t("val.trust")} 91`);
    expect(text).toContain("k487");
    // R-1643 (Ben, Nacharbeit 2): die Argumentationskette — Aussage mit ihrem Beleg.
    const kette = befund.protokoll?.querySelector('[data-testid="ask-argumentationskette"]');
    expect(kette, "keine Argumentationskette auf dem Blatt").not.toBeNull();
    const glieder = [...(kette?.querySelectorAll("li") ?? [])].map((li) => li.textContent ?? "");
    expect(glieder).toHaveLength(1);
    expect(glieder[0]).toContain("Alle Firmenwagen werden in Blau bestellt.");
    expect(glieder[0]).toContain(i18n.t("ask.export.protocol.supportedBy"));
    expect(glieder[0]).toContain("Farbregelung Firmenwagen");
    expect(glieder[0]).toContain("k487");
    // Die Fundstelle „Farbregel geprüft" ist KEIN Glied der Kette.
    expect(glieder[0]).not.toContain("Farbregel geprüft");

    // Nach dem Druck ist es wieder weg.
    await act(async () => {
      window.dispatchEvent(new Event("afterprint"));
      await flush();
    });
    expect(document.querySelector('[data-testid="ask-entscheidungsprotokoll"]')).toBeNull();
    expect(document.body.classList.contains("printing-extract")).toBe(false);
    unmount();
  });

  it("ohne Sitzung: das Blatt sagt „nicht angemeldet“ und nennt keine erfundene Kennung", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk(null);
    const befund = await drucken(container);
    const text = befund.protokoll?.textContent ?? "";
    expect(text).toContain(i18n.t("ask.export.protocol.userUnknown"));
    expect(text).not.toContain("u-7");
    unmount();
  });
});

describe("R-1643 · Kopieren trägt dasselbe Protokoll als Markdown", () => {
  it("Zeitstempel und Nutzer-ID stehen im kopierten Dokument", async () => {
    await i18n.changeLanguage("de");
    const kopiert: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (s: string) => {
          kopiert.push(s);
        },
      },
    });
    const { container, unmount } = await mountAsk({ id: "u-7", role: "experte" });
    const knopf = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => b.textContent?.trim() === i18n.t("ask.export.copy"),
    );
    expect(knopf, "kein Kopieren-Knopf").toBeDefined();
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(kopiert).toHaveLength(1);
    const md = kopiert[0] ?? "";
    expect(md).toContain(`## ${i18n.t("ask.export.protocol.heading")}`);
    expect(md).toContain(`- ${i18n.t("ask.export.protocol.user")}: \`u-7\``);
    expect(md).toMatch(/exported-at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    expect(md).toContain('user-id: "u-7"');
    expect(md).toContain("`k487`");
    // R-1643 (Ben, Nacharbeit 2): dieselbe Kette im Markdown.
    expect(md).toContain(`### ${i18n.t("ask.export.protocol.argumentation")}`);
    expect(md).toContain(
      `1. „Alle Firmenwagen werden in Blau bestellt.“ — ${i18n.t("ask.export.protocol.supportedBy")}: Farbregelung Firmenwagen \`k487\``,
    );
    unmount();
  });
});
