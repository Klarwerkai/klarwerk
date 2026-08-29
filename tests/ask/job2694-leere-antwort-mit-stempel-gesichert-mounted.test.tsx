// @vitest-environment jsdom
// ================================================================================================
// JOB 2694 · D1 — EINE LEERE ANTWORT MIT DEM STEMPEL GESICHERT (Review-Befund R2-20)
// ================================================================================================
//
// PEDIS FRAGE: „Kann Klara mir eine leere Antwort als gesichert hinstellen?"
//
// DER BEFUND, gemessen an der Basis 71d3c2b (Ask.tsx:716, 741–744): Liefert der Antwortweg
// `answered: true` mit LEEREM Text, rendert die Fragen-Seite eine leere Antwortkarte
// (`data-testid="ask-answer"`) — samt Einordnungszeile „Quellengebundene Antwort", Quellenliste,
// Kopieren/Download/Druck und Danke-Knopf. Kein Guard auf Leerstring/Whitespace. Nebenan
// (`KlaraAssistant.tsx:511`) steht `answered && answer`, im Word-Add-in (`taskpane.html:1148`)
// sogar `answer.trim().length > 0`. Zwei Regeln, eine Fläche ohne.
//
// WAS DIESER TEST MISST — an der ECHTEN Fragen-Seite, gemountet, mit genau der Antwort aus dem
// Befund: `{answered: true, answer: "", sources: […]}`. Erwartet ist das, was der Mensch bei einer
// echten Wissenslücke sieht — und dass es nichts Leeres zu kopieren gibt. Gegenprobe: eine echte
// Antwort rendert weiterhin die Karte samt Werkzeugen.
//
// RED-FIRST: gegen den unveränderten Startstand gelaufen und dort rot (Protokoll in der
// Arbeitsspur `kw-ext1-job2694-d1-arbeit/red-first.txt`), danach mit dem Guard grün.
import { afterEach, describe, expect, it, vi } from "vitest";

const antwort = vi.hoisted(() => ({
  text: "" as string | null,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () => [
        {
          id: "k1",
          title: "Ventilprüfung",
          statement: "Ventil V4 wird jährlich geprüft.",
          type: "best_practice",
          category: "Betrieb",
          status: "validiert",
          trust: 90,
          author: "u1",
          createdAt: "2026-01-01T00:00:00.000Z",
          // Vollständig geprüfte Quelle (mega32): erst damit heißt eine echte Antwort
          // „Quellengebundene Antwort" — und erst damit wäre der leere Fall oben „gesichert".
          aiCheck: {
            status: "done",
            coverage: {
              available: 4,
              selected: 4,
              alreadyOpen: 0,
              attempted: 4,
              completed: 4,
              skipped: 0,
              capped: false,
              aborted: false,
            },
          },
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
      // GENAU die Antwort aus dem Befund: answered, aber ohne Text — mit einer validierten,
      // tragenden Quelle, damit die Einstufung „gesichert" wäre, wenn die Fläche sie behauptete.
      ask: vi.fn(async () => ({
        result: {
          answered: true,
          answer: antwort.text,
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["k1"],
          citedSources: ["k1"],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "r-2694",
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

/** Die echte Fragen-Seite, Frage über die URL gestellt (`ask=1`) — derselbe Weg wie mega32/33. */
async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
          { initialEntries: ["/fragen?q=Ventil&ask=1"] },
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

// Kein Wortgrenzen-Anker: `textContent` klebt Plaketten aneinander (mega33 A4, dieselbe Messung).
const GESICHERT = "Gesichert";

function werkzeugKnopf(container: HTMLElement, key: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(i18n.t(key)),
  );
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("JOB 2694 — eine Antwort ohne Text ist eine Wissenslücke, kein gesichertes Wissen", () => {
  for (const [name, text] of [
    ["Leerstring", ""],
    ["nur Leerraum", "  \n\t "],
  ] as const) {
    it(`A · answered:true mit ${name} → keine Antwortkarte, kein ‹${GESICHERT}›, dieselbe Lücke wie bei ‹keine Antwort gefunden›`, async () => {
      await i18n.changeLanguage("de");
      antwort.text = text;
      const { container, unmount } = await mountAsk();
      const sichtbar = container.textContent ?? "";

      // Der Befund: die leere Antwortkarte. Sie darf nicht mehr entstehen.
      expect(
        container.querySelector('[data-testid="ask-answer"]'),
        "leere Antwortkarte gerendert",
      ).toBeNull();
      expect(container.querySelector('[data-testid="ask-contract-line"]')).toBeNull();

      // Stattdessen das, was der Mensch bei einer echten Wissenslücke sieht — derselbe Text.
      expect(sichtbar).toContain(i18n.t("ask.contract.gap.title"));
      expect(sichtbar).not.toContain(i18n.t("ask.contract.verified.title"));
      expect(sichtbar, "die Fläche behauptet Sicherheit über nichts").not.toContain(GESICHERT);

      // Nichts Leeres zu kopieren, herunterzuladen oder zu drucken — die Werkzeuge fehlen.
      expect(werkzeugKnopf(container, "ask.export.copy")).toBeUndefined();
      expect(werkzeugKnopf(container, "ask.export.download")).toBeUndefined();
      expect(werkzeugKnopf(container, "ask.export.print")).toBeUndefined();
      unmount();
    });
  }

  it("B · GEGENPROBE: eine echte Antwort rendert weiterhin die Karte mit Einordnung und Werkzeugen", async () => {
    await i18n.changeLanguage("de");
    antwort.text = "Ventil V4 wird jährlich geprüft.";
    const { container, unmount } = await mountAsk();
    const sichtbar = container.textContent ?? "";

    const karte = container.querySelector('[data-testid="ask-answer"]');
    expect(karte, "die echte Antwortkarte fehlt").not.toBeNull();
    expect(karte?.textContent ?? "").toContain("Ventil V4 wird jährlich geprüft.");
    expect(sichtbar).toContain(i18n.t("ask.contract.verified.title"));
    expect(sichtbar).not.toContain(i18n.t("ask.contract.gap.title"));
    expect(werkzeugKnopf(container, "ask.export.copy")).toBeDefined();

    // Und Kopieren liefert den Text — nicht nichts.
    const kopiert: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (v: string) => void kopiert.push(v) },
      configurable: true,
    });
    await act(async () => {
      werkzeugKnopf(container, "ask.export.copy")?.click();
      await flush();
    });
    expect(kopiert).toHaveLength(1);
    expect(kopiert[0]).toContain("Ventil V4 wird jährlich geprüft.");
    unmount();
  });
});
