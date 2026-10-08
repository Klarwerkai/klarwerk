// @vitest-environment jsdom
// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · D2 — STELLE ANTIPPEN UND SPRECHEN, AUF DER LESEFLÄCHE
// ================================================================================================
//
// Gemessen an der echten Route `/wissen/:id` (`KnowledgeDetail` → … → `MehrAbschnitte`), Bauform aus
// `tests/wiki-stellenbezug/stellenbezug-in-der-flaeche.test.tsx`. Die Spracherkennung ist ein
// Doppel des Browser-Rekorders (wie `tests/diktat-fragefeld/mikrofon-im-fragefeld.test.tsx`).
//
// Z1  Zeichnung wählen, Stelle antippen, Notiz sprechen, senden: die Aktion trägt Bild, Punkt und
//     den gesprochenen Text
// Z2  ohne Tipp, nach „Punkt entfernen" und nach einem Wechsel der Stelle reist KEIN Punkt mit
// Z3  der Tastaturweg: Enter setzt die Marke in die Mitte, Pfeiltasten schieben sie
// Z4  ein gespeicherter Beitrag zeigt die Zeichnung mit der Marke an seinem Punkt
// Z5  steht die Zeichnung in der angezeigten Fassung nicht mehr, bleibt der Punkt als Satz lesbar —
//     es wird keine Marke auf ein Bild gesetzt, das niemand gewählt hat
// Z6  ohne Spracherkennung kein Mikrofon; auf iPhone/iPad steht der Ausweg über die Tastatur
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

const ZEICHNUNG =
  '<figure data-image-id="plan-1"><img src="/api/objects/obj1/raw" alt="Bohrbild" data-image-id="plan-1"><figcaption data-image-id="plan-1">Bohrbild Flansch DN 80</figcaption></figure>';
const INHALT = `<h2>Bohrbild</h2><p>Bezugspunkt ist die linke Kante.</p>${ZEICHNUNG}`;

const BILDSTELLE = {
  art: "bild",
  abschnitt: "Bohrbild",
  text: "plan-1",
  fingerabdruck: stellenFingerabdruck("bild", "Bohrbild", "plan-1"),
};

const GESPROCHEN = "Hier wird oft falsch gemessen, der Bezugspunkt muss die linke Kante sein.";

interface Beitrag {
  id: string;
  author: string;
  text: string;
  at: string;
  koVersion?: number;
  stelle?: Record<string, unknown>;
}

function ko(comments: Beitrag[], version = 5, bodyHtml = INHALT): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Flansch DN 80 bohren",
    statement: "Bohrbild nach Zeichnung, Bezug linke Kante.",
    bodyHtml,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Fertigung",
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

const notizAmPunkt = (version = 5): Beitrag => ({
  id: "frage-1",
  author: "u2",
  text: GESPROCHEN,
  at: "2026-08-02T08:00:00.000Z",
  koVersion: version,
  stelle: { koVersion: version, ...BILDSTELLE, punkt: { x: 0.25, y: 0.75 } },
});

// ---- Das Rekorder-Doppel ------------------------------------------------------------------------

interface ErgebnisEreignis {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: ErgebnisEreignis) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  gestartet = 0;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {
    this.gestartet += 1;
  }
  stop(): void {
    this.onend?.();
  }
  spricht(text: string): void {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
  }
}

type FensterMitSprache = { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };

function spracherkennung(an: boolean): void {
  (window as unknown as FensterMitSprache).SpeechRecognition = an ? RekorderDoppel : undefined;
  (window as unknown as FensterMitSprache).webkitSpeechRecognition = undefined;
}

// ---- Die Fläche ---------------------------------------------------------------------------------

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

async function ereignis(ziel: HTMLElement, e: Event): Promise<void> {
  await act(async () => {
    ziel.dispatchEvent(e);
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

/** Die wählbare Zeichnung — mit einer gezeichneten Fläche von 400 × 200 ab (100, 50). */
function zeichnung(): HTMLButtonElement {
  const knopf = el("data-bib-zeichnung", "waehlbar") as HTMLButtonElement | null;
  const bild = knopf?.querySelector("img");
  if (!knopf || !bild) {
    throw new Error("Die wählbare Zeichnung fehlt");
  }
  bild.getBoundingClientRect = () =>
    ({ left: 100, top: 50, width: 400, height: 200, right: 500, bottom: 250 }) as DOMRect;
  return knopf;
}

/** Ein Tipp mit dem Finger oder der Maus an die Bildschirmstelle (x, y). */
const tipp = (x: number, y: number): MouseEvent =>
  new MouseEvent("click", { bubbles: true, cancelable: true, detail: 1, clientX: x, clientY: y });

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.aktionen = [];
  RekorderDoppel.letzter = null;
  spracherkennung(true);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  spracherkennung(false);
});

describe("PLAN-SPRACHANMERKUNG · D2 — Stelle antippen und sprechen", () => {
  it("Z1 · Zeichnung wählen, Stelle antippen, Notiz sprechen, senden — Bild, Punkt und Text reisen mit", async () => {
    await mount(ko([]));

    // Vor der Wahl einer Zeichnung steht keine da.
    expect(el("data-bib-diskussion-zeichnung")).toBeNull();
    await waehlen(auswahl(), optionMit("Bohrbild Flansch DN 80"));
    expect(text(el("data-bib-diskussion-zeichnung"))).toContain(
      "Tippe in der Zeichnung auf die Stelle",
    );

    await ereignis(zeichnung(), tipp(200, 200));
    expect(el("data-bib-zeichnung-marke", "25,75")).not.toBeNull();
    expect(text(el("data-bib-diskussion-punkt"))).toBe(
      "Punkt in der Zeichnung: 25 % von links, 75 % von oben",
    );

    await ausloesen(el("data-bib-diskussion-sprechen") as HTMLElement);
    expect(el("data-bib-diskussion-sprechen")?.getAttribute("aria-pressed")).toBe("true");
    expect(RekorderDoppel.letzter?.gestartet).toBe(1);
    expect(RekorderDoppel.letzter?.lang).toBe("de-DE");
    await act(async () => {
      RekorderDoppel.letzter?.spricht(GESPROCHEN);
      await flush();
    });
    await ausloesen(el("data-bib-diskussion-sprechen") as HTMLElement);
    expect(el("data-bib-diskussion-sprechen")?.getAttribute("aria-pressed")).toBe("false");
    expect(feld().value).toBe(GESPROCHEN);

    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    expect(box.aktionen.at(-1)).toEqual({
      action: "comment",
      text: GESPROCHEN,
      clientKey: expect.any(String),
      stelle: { koVersion: 5, ...BILDSTELLE, punkt: { x: 0.25, y: 0.75 } },
    });
  });

  it("Z1b · Gesprochenes wird an Getipptes angehängt, nie ersetzt", async () => {
    await mount(ko([]));

    await tippen(feld(), "Achtung:");
    await ausloesen(el("data-bib-diskussion-sprechen") as HTMLElement);
    await act(async () => {
      RekorderDoppel.letzter?.spricht(" Bezugspunkt prüfen ");
      await flush();
    });

    expect(feld().value).toBe("Achtung: Bezugspunkt prüfen");
  });

  it("Z2 · ohne Tipp, nach „Punkt entfernen“ und nach einem Wechsel reist kein Punkt mit", async () => {
    await mount(ko([]));
    const bild = optionMit("Bohrbild Flansch DN 80");

    // Ohne Tipp: die Rückfrage gilt dem ganzen Bild — wie vor dieser Regel.
    await waehlen(auswahl(), bild);
    await tippen(feld(), "Ist das die aktuelle Zeichnung?");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    expect(box.aktionen.at(-1)?.stelle).toEqual({ koVersion: 5, ...BILDSTELLE });

    // Tipp, dann ausdrücklich entfernen.
    await waehlen(auswahl(), bild);
    await ereignis(zeichnung(), tipp(300, 100));
    expect(el("data-bib-zeichnung-marke", "50,25")).not.toBeNull();
    await ausloesen(el("data-bib-diskussion-punkt-entfernen") as HTMLElement);
    expect(el("data-bib-zeichnung-marke")).toBeNull();
    await tippen(feld(), "Zweite Frage.");
    await ausloesen(el("data-bib-diskussion-senden") as HTMLElement);
    expect(box.aktionen.at(-1)?.stelle).toEqual({ koVersion: 5, ...BILDSTELLE });

    // Tipp, dann die Stelle wechseln und zurück: die alte Position ist nicht mehr gewählt.
    await waehlen(auswahl(), bild);
    await ereignis(zeichnung(), tipp(300, 100));
    await waehlen(auswahl(), optionMit("Bezugspunkt ist die linke Kante"));
    expect(el("data-bib-diskussion-zeichnung")).toBeNull();
    await waehlen(auswahl(), bild);
    expect(el("data-bib-zeichnung-marke")).toBeNull();
  });

  it("Z3 · Tastaturweg: Enter setzt die Marke in die Mitte, Pfeiltasten schieben sie", async () => {
    await mount(ko([]));
    await waehlen(auswahl(), optionMit("Bohrbild Flansch DN 80"));

    // `click()` ohne Zeigeort ist die Aktivierung über Enter oder Leertaste (detail 0).
    await ausloesen(zeichnung());
    expect(el("data-bib-zeichnung-marke", "50,50")).not.toBeNull();

    await ereignis(zeichnung(), new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await ereignis(zeichnung(), new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(el("data-bib-zeichnung-marke", "52,48")).not.toBeNull();
    expect(zeichnung().getAttribute("aria-label")).toContain("Bohrbild Flansch DN 80");
  });

  it("Z4 · ein gespeicherter Beitrag zeigt die Zeichnung mit der Marke an seinem Punkt", async () => {
    await mount(ko([notizAmPunkt(5)], 5));

    const punkt = el("data-bib-diskussion-stelle-punkt", "frage-1");
    expect(text(punkt)).toContain("Punkt in der Zeichnung: 25 % von links, 75 % von oben");
    expect(punkt?.querySelector('[data-bib-zeichnung-marke="25,75"]')).not.toBeNull();
    const bild = punkt?.querySelector("img");
    expect(bild?.getAttribute("src")).toBe("/api/objects/obj1/raw");
    expect(bild?.getAttribute("alt")).toBe(
      "Zeichnung „Bohrbild Flansch DN 80“ mit markiertem Punkt bei 25 % von links, 75 % von oben",
    );
    // Die Notiz selbst steht als Text da.
    expect(text(el("data-bib-diskussion-beitrag", "frage-1"))).toContain(GESPROCHEN);
  });

  it("Z5 · steht die Zeichnung nicht mehr in der Fassung, bleibt der Punkt als Satz — ohne Marke", async () => {
    await mount(
      ko([notizAmPunkt(3)], 5, "<h2>Bohrbild</h2><p>Bezugspunkt ist die linke Kante.</p>"),
    );

    const punkt = el("data-bib-diskussion-stelle-punkt", "frage-1");
    expect(text(punkt)).toBe("Punkt in der Zeichnung: 25 % von links, 75 % von oben");
    expect(punkt?.querySelector("[data-bib-zeichnung]")).toBeNull();
    expect(el("data-bib-diskussion-stelle-lage", "unklar")).not.toBeNull();
  });

  it("Z6 · ohne Spracherkennung kein Mikrofon; auf iPhone/iPad der Ausweg über die Tastatur", async () => {
    spracherkennung(false);
    await mount(ko([]));
    expect(el("data-bib-diskussion-sprechen")).toBeNull();
    expect(el("data-bib-diskussion-sprechen-ios")).toBeNull();
    act(() => root.unmount());
    container.remove();

    const uaVorher = navigator.userAgent;
    Object.defineProperty(window.navigator, "userAgent", {
      value: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      configurable: true,
    });
    try {
      spracherkennung(true);
      await mount(ko([]));
      expect(el("data-bib-diskussion-sprechen")).toBeNull();
      expect(text(el("data-bib-diskussion-sprechen-ios"))).toBe(i18n.t("diktat.iosTastatur"));
    } finally {
      Object.defineProperty(window.navigator, "userAgent", { value: uaVorher, configurable: true });
    }
  });
});
