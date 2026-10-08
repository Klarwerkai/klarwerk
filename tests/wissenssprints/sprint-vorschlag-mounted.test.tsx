// @vitest-environment jsdom
// ================================================================================================
// R-1657 (ROADMAP 9.3) — DIE FLÄCHE DER WISSENS-SPRINTS.
// ================================================================================================
//
// Die Rechnung belegt tests/wissenssprints/lueckenerkennung.test.ts. Dieser Test rendert die
// Fläche, die `/kapital` in der Empfehlungskarte zeigt (Stufe2.tsx → WissensSprints), mit einer
// Antwort in der Form des Servers, und hält fest:
//   F1  der Satz der Quelle steht da: „Bereich Schweißtechnik: 4 Objekte in offenen Konflikten,
//       12 Objekte zur Re-Validierung. 2-Tage-Sprint vorschlagen?" — Reihenfolge wie geliefert
//   F2  Einzahl bei einem Tag und einem Objekt; „nur 0 validierte Objekte" bleibt lesbar
//   F3  ohne Vorschlag sagt die Fläche es; Englisch und Niederländisch tragen eigene Texte
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { MgmtSprint, MgmtSprintAnalysis } from "../../apps/web/src/api/types";
import { WissensSprints } from "../../apps/web/src/components/WissensSprints";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCHWEISSTECHNIK: MgmtSprint = {
  category: "Schweißtechnik",
  reasons: [
    { key: "conflicts", count: 4 },
    { key: "revalidation", count: 12 },
  ],
  workItems: 16,
  days: 2,
};
const HYDRAULIK: MgmtSprint = {
  category: "Hydraulik",
  reasons: [
    { key: "lowTrust", count: 1 },
    { key: "thinKnowledge", count: 0 },
  ],
  workItems: 1,
  days: 1,
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function mount(sprints: MgmtSprint[], analyse?: MgmtSprintAnalysis): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(WissensSprints, { sprints, analyse }));
  });
}

const STAND: MgmtSprintAnalysis = {
  regular: true,
  intervalMs: 900_000,
  analyzedAt: null,
  provider: null,
  failure: null,
};

const zeilen = () => [...container.querySelectorAll('[data-testid="sprint"]')];

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

describe("R-1657 · Wissens-Sprints in der Empfehlungskarte", () => {
  it("F1 · der Vorschlag der Quelle steht als ganzer Satz da, in der gelieferten Reihenfolge", async () => {
    await mount([SCHWEISSTECHNIK, HYDRAULIK]);

    expect(container.textContent).toContain("Wissens-Sprints");
    expect(zeilen().map((z) => z.getAttribute("data-kategorie"))).toEqual([
      "Schweißtechnik",
      "Hydraulik",
    ]);
    expect(zeilen()[0]?.textContent).toBe(
      "Bereich Schweißtechnik: 4 Objekte in offenen Konflikten, 12 Objekte zur Re-Validierung. 2-Tage-Sprint vorschlagen?",
    );
  });

  it("F2 · Einzahl bei einem Tag und einem Objekt; null validierte Objekte bleibt lesbar", async () => {
    await mount([HYDRAULIK]);

    expect(zeilen()[0]?.querySelector('[data-testid="sprint-gruende"]')?.textContent).toBe(
      "1 Objekt mit geringem Vertrauen, nur 0 validierte Objekte.",
    );
    expect(zeilen()[0]?.querySelector('[data-testid="sprint-vorschlag"]')?.textContent).toBe(
      "1-Tages-Sprint vorschlagen?",
    );
  });

  it("F3 · ohne Vorschlag sagt die Fläche es; EN und NL tragen eigene Texte", async () => {
    await mount([]);
    expect(zeilen()).toHaveLength(0);
    expect(container.querySelector('[data-testid="sprints-leer"]')?.textContent).toBe(
      "Kein Bereich braucht derzeit einen Wissens-Sprint.",
    );
    await act(async () => {
      root.unmount();
    });
    container.remove();

    await i18n.changeLanguage("en");
    await mount([SCHWEISSTECHNIK]);
    expect(zeilen()[0]?.textContent).toBe(
      "Area Schweißtechnik: 4 objects in open conflicts, 12 objects to re-validate. Suggest a 2-day sprint?",
    );
    await act(async () => {
      root.unmount();
    });
    container.remove();

    await i18n.changeLanguage("nl");
    await mount([SCHWEISSTECHNIK]);
    expect(zeilen()[0]?.textContent).toBe(
      "Gebied Schweißtechnik: 4 objecten in open conflicten, 12 objecten om te hervalideren. Sprint van 2 dagen voorstellen?",
    );
  });
});

// Nacharbeit 2 (Ben: „über Reasoner", „regelmäßig"): die Fläche sagt, wer einen Vorschlag trägt,
// und wie es um die regelmäßige Reasoner-Analyse der eigenen Sicht steht.
describe("R-1657 · Nacharbeit 2 — Herkunft und Analysestand", () => {
  const quelle = (i: number) =>
    zeilen()[i]?.querySelector('[data-testid="sprint-quelle"]')?.textContent;
  const stand = () => container.querySelector('[data-testid="sprints-analyse"]')?.textContent;

  it("F4 · Reasoner-Urteil: Marke „Reasoner“, Stand nennt den Anbieter; der Satz bleibt", async () => {
    await mount(
      [
        { ...SCHWEISSTECHNIK, source: "reasoner" },
        { ...HYDRAULIK, source: "rule" },
      ],
      {
        ...STAND,
        analyzedAt: "2026-10-01T08:00:00.000Z",
        provider: "anthropic:test-modell",
      },
    );

    expect(quelle(0)).toBe("Reasoner");
    expect(quelle(1)).toBe("Regel");
    expect(zeilen()[0]?.getAttribute("data-quelle")).toBe("reasoner");
    expect(zeilen()[0]?.querySelector('[data-testid="sprint-satz"]')?.textContent).toBe(
      "Bereich Schweißtechnik: 4 Objekte in offenen Konflikten, 12 Objekte zur Re-Validierung. 2-Tage-Sprint vorschlagen?",
    );
    expect(stand()).toContain("Bewertet vom Reasoner (anthropic:test-modell)");
  });

  it("F5 · kein Urteil: die Ursache steht da, und es gilt ausdrücklich die Regel", async () => {
    await mount([{ ...HYDRAULIK, source: "rule" }], {
      ...STAND,
      analyzedAt: "2026-10-01T08:00:00.000Z",
      failure: "confidential",
    });

    expect(stand()).toBe(
      "Kein Reasoner-Urteil: vertrauliche Bereiche dürfen nicht an die eingerichtete KI. Es gilt die benannte Regel.",
    );
    expect(quelle(0)).toBe("Regel");
  });

  it("F6 · noch kein Lauf bzw. keine regelmäßige Analyse: beides wird benannt", async () => {
    await mount([], STAND);
    expect(stand()).toBe(
      "Die Reasoner-Analyse für deine Sicht steht noch aus — bis dahin gilt die benannte Regel.",
    );
    await act(async () => {
      root.unmount();
    });
    container.remove();

    await mount([], { ...STAND, regular: false, intervalMs: null });
    expect(stand()).toBe(
      "Die regelmäßige Reasoner-Analyse läuft in dieser Instanz nicht — es gilt die benannte Regel.",
    );
  });
});
