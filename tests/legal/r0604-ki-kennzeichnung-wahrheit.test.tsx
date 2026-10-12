// @vitest-environment jsdom
// ================================================================================================
// R-0603 / R-0604 / R-0625 — DIE KI-KENNZEICHNUNG SAGT AN JEDEM TRÄGER DIE WAHRHEIT.
// ================================================================================================
//
// DER BEFUND (OFFEN.md G22, mega83 A): „von KI erzeugt" stand bedingungslos — am deterministischen
// Rückfall, an Auslösern vor jedem Klick, auf der Fragenseite vor der ersten Frage und in jeder
// exportierten Antwort. Das Word-Panel war schon an das Serversignal gebunden (mega81, W11); die
// übrigen Träger nicht.
//
// WAS HIER AUSGEFÜHRT WIRD (nicht nur gelesen):
//   A  die echte Fragenseite, montiert, mit vier Antwortkörpern: gültige Servermarke, keine Marke,
//      deterministischer Rückfall, kaputte Marke (G24-Fall). Nur der erste zeigt die Behauptung.
//      Der dauerhafte Flächensatz steht in allen Lagen ohne Griff da (R-0603).
//   B  der Markdown-Export: Kopfblock und Satz nur bei Marke; ohne Angabe bleibt die Kennzeichnung
//      stehen (R-0625: unbekannt wird nicht still zu „nein").
//   C  die Auslöser (Modellangabe, Gruppieren, Bildbeschreibung) und die Vorschlagskarten des
//      Blattes — QUELLTEXTPRÜFUNG, ausdrücklich so benannt: sie belegt die Bindung im Code, nicht
//      ein gemessenes Rendern dieser Flächen.
//
// Den Server-Teil (Marke nur bei `demo: false`) belegen tests/reasoner/mega61-ki-kennzeichnung.test.ts
// und tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts (Zelle 3).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type Lage = "modell" | "ohneMarke" | "rueckfall" | "kaputteMarke";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  lage: "modell" as "modell" | "ohneMarke" | "rueckfall" | "kaputteMarke",
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
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
      ask: vi.fn(async () => {
        const marke =
          bestand.lage === "modell"
            ? {
                aiGenerated: {
                  aiGenerated: true,
                  task: "answer",
                  mode: "model",
                  at: "2026-10-08T00:00:00.000Z",
                },
              }
            : bestand.lage === "kaputteMarke"
              ? // G24: ein nackter wahrer Wert ist KEINE Kennzeichnung.
                { aiGenerated: true }
              : {};
        return {
          result: {
            answered: true,
            answer: "Ventil V4 wird jährlich geprüft.",
            knowledgeClass: "gesichert",
            trust: 90,
            sources: ["k1"],
            citedSources: ["k1"],
            steps: [],
            demo: bestand.lage === "rueckfall",
            captionSources: [],
            ...marke,
          },
          gap: null,
          receipt: "r",
        };
      }),
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
import { type AnswerExportInput, buildAnswerMarkdown } from "../../apps/web/src/lib/answerExport";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const WURZEL = join(__dirname, "..", "..");
const lies = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");

const BELEGT = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

function ko() {
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
    aiCheck: { status: "done", coverage: BELEGT },
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(pfad: string): Promise<{ container: HTMLElement; unmount: () => void }> {
  await i18n.changeLanguage("de");
  bestand.kos = [ko()];
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
          { initialEntries: [pfad] },
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

/** Die Antwortkarte in einer Lage — samt der Frage, ob sie „von KI erzeugt" sagt. */
async function karteIn(lage: Lage): Promise<{
  karte: HTMLElement;
  behauptet: boolean;
  flaechensatz: boolean;
  unmount: () => void;
}> {
  bestand.lage = lage;
  const { container, unmount } = await mountAsk("/fragen?q=Ventil&ask=1");
  const karte = container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
  expect(karte, `${lage}: die Antwortkarte wurde nicht montiert — die Messung wäre leer`).not.toBe(
    null,
  );
  return {
    karte: karte as HTMLElement,
    behauptet: (karte as HTMLElement).querySelector('[data-testid="ai-generated-notice"]') !== null,
    flaechensatz: container.querySelector('[data-testid="ai-surface-notice"]') !== null,
    unmount,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("A · R-0604 — die Fragenseite behauptet die Erzeugung nur mit gültiger Servermarke", () => {
  it("KALIBRIERUNG: mit Servermarke steht der Satz an der Antwort (sonst wären die Nullen blind)", async () => {
    const { karte, behauptet, unmount } = await karteIn("modell");
    expect(behauptet).toBe(true);
    expect(karte.textContent ?? "").toContain(i18n.t("ai.generatedNotice"));
    unmount();
  });

  it("OHNE Marke (retrieval-only, alter Server): kein „von KI erzeugt“", async () => {
    const { behauptet, unmount } = await karteIn("ohneMarke");
    expect(behauptet, "Antwort ohne Servermarke als KI-Erzeugnis gekennzeichnet").toBe(false);
    unmount();
  });

  it("DETERMINISTISCHER RÜCKFALL: kein „von KI erzeugt“", async () => {
    const { behauptet, unmount } = await karteIn("rueckfall");
    expect(behauptet, "regelbasierte Antwort als KI-Erzeugnis gekennzeichnet").toBe(false);
    unmount();
  });

  it("R-0625 · KAPUTTE Marke (nackter Wahrheitswert): die gemeinsame Prüfung erkennt sie nicht an", async () => {
    const { behauptet, unmount } = await karteIn("kaputteMarke");
    expect(behauptet, "`aiGenerated: true` ohne Aufgabe und Modus schaltet den Satz ein").toBe(
      false,
    );
    unmount();
  });
});

describe("A · R-0603 — der Flächensatz steht dauerhaft, ohne Griff, in jeder Lage", () => {
  it("vor der ersten Frage: sichtbar ohne Interaktion — und ohne Erzeugungsbehauptung", async () => {
    bestand.lage = "modell";
    const { container, unmount } = await mountAsk("/fragen");
    // Kein „…" → „Mehr": das Blatt ist zu.
    expect(document.querySelector('[data-testid="ask-mehr"]')).toBeNull();
    const satz = container.querySelector('[data-testid="ask-ki-flaechensatz"]');
    expect(satz, "der KI-Hinweis der Fläche steht nicht im Sichtfeld").not.toBeNull();
    expect(satz?.textContent ?? "").toContain(i18n.t("ai.surfaceNotice"));
    expect(container.querySelector('[data-testid="ai-generated-notice"]')).toBeNull();
    unmount();
  });

  it("nach einer Antwort — in jeder der vier Lagen", async () => {
    for (const lage of ["modell", "ohneMarke", "rueckfall", "kaputteMarke"] as const) {
      const { flaechensatz, unmount } = await karteIn(lage);
      expect(flaechensatz, `${lage}: der Flächensatz fehlt`).toBe(true);
      unmount();
    }
  });

  it("der Flächensatz behauptet keine Erzeugung und keine Einwilligung — in allen drei Sprachen", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const satz = i18n.t("ai.surfaceNotice").toLowerCase();
      expect(satz.length, `${sprache}: Flächensatz fehlt`).toBeGreaterThan(20);
      // „erzeugt" darf nur in der Nebenaussage stehen, dass Erzeugtes GEKENNZEICHNET wird.
      expect(satz, `${sprache}: der Satz ist der alte Erzeugungssatz`).not.toBe(
        i18n.t("ai.generatedNotice").toLowerCase(),
      );
      for (const wort of ["zustimm", "einwillig", "consent", "toestemming"]) {
        expect(satz, `${sprache}: „${wort}“ im Flächensatz`).not.toContain(wort);
      }
    }
    await i18n.changeLanguage("de");
  });
});

// ------------------------------------------------------------------------------------------------
const LABELS = {
  answer: "Antwort",
  evidence: "Evidenz",
  trust: "Trust",
  steps: "Schritte",
  sources: "Quellen",
  footer: "erstellt am {{date}}",
  aiNotice:
    "Von künstlicher Intelligenz erzeugt (KLARWERK, Frage beantwortet, 2026-10-08). Inhaltlich zu prüfen.",
};

function exportEingabe(zusatz: Partial<AnswerExportInput>): AnswerExportInput {
  return {
    question: "Wie oft wird Ventil V4 geprüft?",
    answer: "Jährlich.",
    statusLabel: "Gesichert",
    evidenceLabel: "belegt",
    trust: 4,
    steps: [],
    sources: [],
    generatedAt: "2026-10-08T09:00:00.000Z",
    labels: LABELS,
    ...zusatz,
  };
}

// Ben Nacharbeit 2: hier stand ein Boolean `aiGenerated`, und die Fragenseite machte aus
// „unbekannt" ein `false` — die Kennzeichnung fiel genau dort weg, wo R-0625 sie verlangt. Die
// Eingabe ist jetzt die DREIWERTIGE Herkunft. Die Wirkung über den ECHTEN Exportaufruf der Seite
// (Menü → Download, alle vier Formate, vier Antwortlagen) belegt
// tests/legal/r0703-ki-dateien-und-stufen.test.tsx; hier steht nur der Helfer.
describe("B · R-0604 / R-0625 — der Markdown-Helfer folgt der dreiwertigen Herkunft", () => {
  it("belegt KI: Kopfblock und Satz", () => {
    const md = buildAnswerMarkdown(exportEingabe({ kiHerkunft: "ki" }));
    expect(md.split("\n").slice(0, 2)).toEqual(["---", "ai-generated: true"]);
    expect(md).toContain(`_${LABELS.aiNotice}_`);
  });

  it("belegt modellfrei (`ohne-ki`): weder Kopfblock noch Satz — die Datei behauptet keine KI", () => {
    const md = buildAnswerMarkdown(exportEingabe({ kiHerkunft: "ohne-ki" }));
    expect(md).not.toContain("ai-generated");
    expect(md).not.toContain(LABELS.aiNotice);
    // Die Antwort selbst ist vollständig da — nur die falsche Behauptung fehlt.
    expect(md.startsWith("# Wie oft wird Ventil V4 geprüft?")).toBe(true);
    expect(md).toContain("Jährlich.");
  });

  it("R-0625 · `unbekannt` und fehlende Angabe behalten die Kennzeichnung — nicht still „nein“", () => {
    for (const md of [
      buildAnswerMarkdown(exportEingabe({ kiHerkunft: "unbekannt" })),
      buildAnswerMarkdown(exportEingabe({})),
    ]) {
      expect(md).toContain("ai-generated: true");
      expect(md).toContain(`_${LABELS.aiNotice}_`);
    }
  });
});

describe("C · Auslöser und Vorschläge — Quelltextprüfung der Bindung", () => {
  it("Auslöser tragen den Flächensatz, nicht die Erzeugungsbehauptung", () => {
    const info = lies("apps/web/src/components/AiModelInfo.tsx");
    expect(info).toContain("<AiSurfaceNotice");
    expect(info).not.toContain("<AiGeneratedNotice");
    const gruppen = lies("apps/web/src/components/ImportGroups.tsx");
    expect(gruppen).toContain("<AiSurfaceNotice");
    expect(gruppen).not.toContain("<AiGeneratedNotice");
  });

  it("Bildbeschreibung: Flächensatz am Knopf, Erzeugungssatz NUR im Vorschlag", () => {
    const editor = lies("apps/web/src/components/RichTextEditor.tsx");
    const knopf = editor.indexOf('data-testid="caption-form-suggest"');
    const vorschlag = editor.indexOf('data-testid="caption-form-suggestion"');
    expect(knopf).toBeGreaterThan(0);
    expect(vorschlag).toBeGreaterThan(knopf);
    const behauptung = editor.indexOf("<AiGeneratedNotice");
    expect(behauptung, "der Erzeugungssatz steht vor dem Vorschlag").toBeGreaterThan(vorschlag);
    expect(editor.indexOf("<AiGeneratedNotice", behauptung + 1), "zweiter Erzeugungssatz").toBe(-1);
    expect(editor.slice(knopf, vorschlag)).toContain("<AiSurfaceNotice");
  });

  it("Blatt: die Vorschlagskarten behaupten nur auf dem Modellweg (`demo: false`)", () => {
    const blatt = lies("apps/web/src/components/erfassen/Blatt.tsx");
    expect(blatt).toContain(
      '{structureProposal.demo ? null : <AiGeneratedNotice className="mt-1.5 block" />}',
    );
    expect(blatt).toContain(
      '{assistProposal.demo ? null : <AiGeneratedNotice className="mt-1.5 block" />}',
    );
    // Kein dritter, unbedingter Träger daneben.
    expect(blatt.split("<AiGeneratedNotice").length - 1).toBe(2);
  });
});
