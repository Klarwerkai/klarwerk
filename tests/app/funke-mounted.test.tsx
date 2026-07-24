// @vitest-environment jsdom
// FUNKE (nacht24 Paket 6, Mounted): „Meine Wirkung"-Zahlen, offene Wissenslücken mit
// „In 2 Minuten beantworten"-Direkteinstieg (?gap=-Einstieg) und die Wissenskapital-Kachel.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import {
  KnowledgeCapitalNumbers,
  MyImpactNumbers,
  OpenGapsSummary,
} from "../../apps/web/src/components/FunkeCards";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(node: JSX.Element): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(MemoryRouter, null, node));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("FUNKE (Mounted)", () => {
  it("MyImpactNumbers: vier ehrliche Zahlen + Fußnote (führende Quelle)", () => {
    mount(
      createElement(MyImpactNumbers, {
        impact: { contributions: 5, validated: 3, cited: 7, helpfulReceived: 2 },
      }),
    );
    expect(container.textContent).toContain("5");
    expect(container.textContent).toContain("Meine Beiträge");
    expect(container.textContent).toContain("davon validiert");
    expect(container.textContent).toContain("in Antworten zitiert");
    expect(container.textContent).toContain("als hilfreich markiert");
    // Ehrliche Fußnote: die Zählweise wird benannt, nichts wirkt „magisch".
    expect(container.textContent).toContain("führende Antwort-Quelle");
  });

  // FUNKE-FIX P0 (bens Sammel-Nacht): Die Startseiten-Kachel zeigt NUR die anonyme offene Zahl und
  // führt in die berechtigte Risiko-&-Lücken-Ansicht — KEIN gespeicherter Gap-FREITEXT, KEINE Frage
  // in der URL (der frühere captureGapHref(gap.question)-Einstieg ist entfernt).
  it("OpenGapsSummary: nur aggregierte Zahl + Link /risiko; kein Fragen-Freitext, keine Frage-URL; ohne offene Gaps nichts", () => {
    // FUNKE-FIX2 P0 (bens Erforderlich 1): die Kachel bekommt NUR die aggregierte Zahl (aus dem
    // Summary-Endpunkt) — strukturell kein Fragetext mehr, die Startseite lädt keine Gap-Volltexte.
    mount(createElement(OpenGapsSummary, { total: 2 }));
    expect(container.textContent).toContain("Offene Wissenslücken");
    // Die anonyme Zahl der OFFENEN Lücken (2).
    expect(container.textContent).toContain("2");
    const link = container.querySelector("a");
    // Weg in die berechtigte Ansicht; KEIN gap=-Parameter, KEIN Fragetext in der URL.
    expect(link?.getAttribute("href")).toBe("/risiko");
    expect(link?.getAttribute("href")).not.toContain("gap=");
    act(() => {
      root.unmount();
    });
    container.remove();
    mount(createElement(OpenGapsSummary, { total: 0 }));
    expect(container.textContent).toBe("");
  });

  it("KnowledgeCapitalNumbers: fünf Bestandszahlen + ehrlicher Hinweis (keine Schätzungen)", () => {
    mount(
      createElement(KnowledgeCapitalNumbers, {
        capital: {
          secured: 120,
          validated: 80,
          answerableCategories: 9,
          activeAuthors: 14,
          openGaps: 6,
        },
      }),
    );
    expect(container.textContent).toContain("Wissenskapital");
    expect(container.textContent).toContain("120");
    expect(container.textContent).toContain("gesicherte Wissensobjekte");
    expect(container.textContent).toContain("beantwortbare Themenfelder");
    expect(container.textContent).toContain("aktive Wissensträger");
    expect(container.textContent).toContain("keine Schätzungen");
  });
});
