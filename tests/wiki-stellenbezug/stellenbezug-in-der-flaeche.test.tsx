// @vitest-environment jsdom
// ================================================================================================
// P-WIKI-STELLENBEZUG · D4 — DIE RÜCKFRAGE AN EINER STELLE, AUF DER ECHTEN LESEFLÄCHE
// ================================================================================================
//
// Gemessen an der echten Route `/wissen/:id` (`KnowledgeDetail` → … → `MehrAbschnitte`), Bauform aus
// `tests/wiki-diskussion/diskussion-in-der-flaeche.test.tsx`.
//
// F1  eine Stelle wählen und senden: die Aktion trägt Fassung, Art, Abschnitt und Textstelle
// F2  ein Beitrag aus einer früheren Fassung, dessen Stelle eindeutig wiedergefunden ist: Zitat,
//     Lage und der Weg zur alten Fassung stehen da
// F3  ist die Stelle nicht mehr eindeutig, steht der Satz „Bezug in der neuen Fassung nicht
//     eindeutig — Zuordnung prüfen" — und das gespeicherte Zitat bleibt lesbar
// F4  ändert sich die Fassung nach der Wahl, verfällt sie sichtbar; Senden ist gesperrt, bis neu
//     gewählt ist — die Rückfrage wird nicht still zu einer an das ganze Dokument
// F5  wortgleiche Absätze im selben Abschnitt werden nicht angeboten
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

const box = vi.hoisted(() => ({
  ko: null as unknown,
  aktionen: [] as Record<string, unknown>[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => box.ko),
        list: vi.fn(async () => [box.ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async (_id: string, body: Record<string, unknown>) => {
          box.aktionen.push(body);
          return box.ko;
        }),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: {
        list: vi.fn(async () => [
          { id: "u1", name: "Eva" },
          { id: "u2", name: "Pedi" },
        ]),
      },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { stellenFingerabdruck } from "../../apps/web/src/lib/stellenabdruck";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView =
  () => {};

const ERSTER = "Erst das Ventil X schließen.";
const INHALT = [
  "<h2>Ablauf</h2>",
  "<p>Erst das <strong>Ventil X</strong> schließen.</p>",
  "<p>Danach spülen.</p>",
  "<p>Danach spülen.</p>",
  "<h2>Grenzwerte</h2>",
  "<table><tbody><tr><th>Druck</th><td>6 bar</td></tr></tbody></table>",
].join("");

interface Beitrag {
  id: string;
  author: string;
  text: string;
  at: string;
  koVersion?: number;
  stelle?: {
    koVersion: number;
    art: string;
    abschnitt: string;
    text: string;
    fingerabdruck: string;
  };
}

function ko(comments: Beitrag[], version = 5, bodyHtml = INHALT): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Ventil X schließt bei Überdruck",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments,
    sources: [],
    attachments: [],
  } as unknown as KnowledgeObject;
}

const frage = (stelleText: string, stelleVersion = 3): Beitrag => ({
  id: "frage-1",
  author: "u2",
  text: "Welches Ventil genau?",
  at: "2026-08-02T08:00:00.000Z",
  koVersion: stelleVersion,
  // Der Abdruck über den vollständigen Absatz — hier ist der Absatz kürzer als das Zitatlimit.
  stelle: {
    koVersion: stelleVersion,
    art: "absatz",
    abschnitt: "Ablauf",
    text: stelleText,
    fingerabdruck: stellenFingerabdruck("absatz", "Ablauf", stelleText),
  },
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(bestand: KnowledgeObject): Promise<void> {
  box.ko = bestand;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("Der Knopf „Mehr“ fehlt auf der Lesefläche");
  }
  await ausloesen(mehr);
  const d = container.querySelector<HTMLDetailsElement>('[data-bib-abschnitt="kommentare"]');
  if (!d) {
    throw new Error("Der Abschnitt der Diskussion ist nicht gemountet");
  }
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

async function tippen(feld: HTMLTextAreaElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function waehlen(auswahl: HTMLSelectElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(auswahl, wert);
    auswahl.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

const el = (marke: string, wert?: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(wert ? `[${marke}="${wert}"]` : `[${marke}]`);

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

const auswahl = (): HTMLSelectElement => el("data-bib-diskussion-stellenwahl") as HTMLSelectElement;

/** Der Wert der Option, deren Beschriftung den Text trägt. */
const optionMit = (teil: string): string => {
  const o = Array.from(auswahl().options).find((x) => x.text.includes(teil));
  if (!o) {
    throw new Error(`Keine Option mit „${teil}“`);
  }
  return o.value;
};

const feld = (): HTMLTextAreaElement =>
  container.querySelector<HTMLTextAreaElement>(
    '[data-bib-abschnitt="kommentare"] textarea',
  ) as HTMLTextAreaElement;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.aktionen = [];
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
});

describe("P-WIKI-STELLENBEZUG · D4 — Rückfrage an einer Stelle auf der Lesefläche", () => {
  it("F1 · eine Stelle wählen und senden: Fassung, Art, Abschnitt und Textstelle reisen mit", async () => {
    await mount(ko([]));

    await waehlen(auswahl(), optionMit("Ventil X"));
    await tippen(feld(), "Welches Ventil genau?");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);

    expect(box.aktionen.at(-1)).toMatchObject({
      action: "comment",
      text: "Welches Ventil genau?",
      stelle: { koVersion: 5, art: "absatz", abschnitt: "Ablauf", text: ERSTER },
    });
  });

  it("F1b · auch eine Tabelle ist wählbar", async () => {
    await mount(ko([]));

    await waehlen(auswahl(), optionMit("Druck 6 bar"));
    await tippen(feld(), "Gilt das auch bei 8 bar?");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);

    expect(box.aktionen.at(-1)).toMatchObject({
      stelle: { koVersion: 5, art: "tabelle", abschnitt: "Grenzwerte", text: "Druck 6 bar" },
    });
  });

  it("F2 · aus früherer Fassung, eindeutig wiedergefunden: Zitat, Lage und der Weg zur alten Fassung", async () => {
    await mount(ko([frage(ERSTER, 3)], 5));

    const bezug = el("data-bib-diskussion-stelle", "frage-1");
    expect(text(bezug)).toContain("Abschnitt „Ablauf“");
    expect(text(bezug)).toContain("v3");
    expect(text(el("data-bib-diskussion-stelle-zitat", "frage-1"))).toBe(ERSTER);
    expect(text(el("data-bib-diskussion-stelle-lage", "eindeutig"))).toBe(
      i18n.t("stellenbezug.eindeutig", { aktuell: 5 }),
    );

    await ausloesen(el("data-bib-diskussion-stelle-fassung", "frage-1") as HTMLElement);
    const fassungen = container.querySelector<HTMLDetailsElement>(
      '[data-bib-abschnitt="schnappschuesse"]',
    );
    expect(fassungen?.open).toBe(true);
  });

  it("F3 · nicht mehr eindeutig: der Satz steht da, und das alte Zitat bleibt lesbar", async () => {
    await mount(ko([frage("Erst das Ventil W schließen.", 3)], 5));

    expect(text(el("data-bib-diskussion-stelle-lage", "unklar"))).toBe(
      "Bezug in der neuen Fassung nicht eindeutig — Zuordnung prüfen",
    );
    expect(text(el("data-bib-diskussion-stelle-zitat", "frage-1"))).toBe(
      "Erst das Ventil W schließen.",
    );
    // KEIN stilles Umhängen: es wird keine „wiedergefundene" Lage behauptet.
    expect(el("data-bib-diskussion-stelle-lage", "eindeutig")).toBeNull();
  });

  it("F4 · ändert sich die Fassung nach der Wahl, verfällt sie sichtbar — Senden bleibt gesperrt, bis neu gewählt ist", async () => {
    await mount(ko([], 5));
    await waehlen(auswahl(), optionMit("Ventil X"));
    await tippen(feld(), "Welches Ventil genau?");

    // Jemand überarbeitet den Eintrag; die Fläche lädt den neuen Stand.
    box.ko = ko([], 6);
    await act(async () => {
      await qc.invalidateQueries();
      await flush();
    });
    await act(flush);

    expect(el("data-bib-diskussion-stelle-verfallen")).not.toBeNull();
    const senden = el("data-bib-diskussion-senden") as HTMLButtonElement;
    expect(senden.disabled).toBe(true);
    // Der Text ist unangetastet.
    expect(feld().value).toBe("Welches Ventil genau?");

    // Ausdrücklich „Ganzes Dokument" wählen hebt die Sperre auf — und dann reist keine Stelle mit.
    await waehlen(auswahl(), "");
    expect(el("data-bib-diskussion-stelle-verfallen")).toBeNull();
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    expect(box.aktionen.at(-1)).toMatchObject({ action: "comment", text: "Welches Ventil genau?" });
    expect(box.aktionen.at(-1)).not.toHaveProperty("stelle");
  });

  it("F5 · wortgleiche Absätze im selben Abschnitt werden nicht angeboten", async () => {
    await mount(ko([]));

    const beschriftungen = Array.from(auswahl().options).map((o) => o.text);
    expect(beschriftungen.some((b) => b.includes("Ventil X"))).toBe(true);
    expect(beschriftungen.some((b) => b.includes("Danach spülen"))).toBe(false);
  });
});
