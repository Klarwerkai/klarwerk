// @vitest-environment jsdom
// ================================================================================================
// JOB 1106 / D1 · D-034 — DIE FRAGEN-SEITE FRAGT ZUERST UND ERKLÄRT DANACH.
// ================================================================================================
//
// DER BEFUND (Designblock `DESIGN_AN_CHEF/LIEFERUNG-20260814-BLOCK2.md`, D-034):
//
//   „Vor dem Eingabefeld stehen **vier** Textblöcke (`pages/Ask.tsx:428–492`), darunter eine ganze
//    Erklär-Karte mit zwei Kacheln (`:446–475`) … Der „MODELLMODUS"-Chip (`:437–442`) hat zwar eine
//    Erklärung, aber **nur als Maus-Tooltip** (`title`, `ask.reasoner.hint`, i18n.ts:1805) — für
//    Touch, Tastatur und Screenreader nicht erreichbar; er ist ein `<span>` ohne `aria-label` und
//    ohne Fokus."
//
// Und die NICHT-ZIELE derselben Scheibe, die dieser Wächter mitträgt, weil sie sonst niemand hält:
// „**Die Beispiel-Chips bleiben, wie sie sind.** … Der Wartezustand bleibt unangetastet."
//
// ================================================================================================
// WAS HIER GEMESSEN WIRD — UND WAS AUSDRÜCKLICH NICHT.
// ================================================================================================
//
// GEMESSEN wird der GERENDERTE DOM: Reihenfolge über `compareDocumentPosition`, Fokussierbarkeit
// über `document.activeElement`, Lesbarkeit über `textContent`. Das ist dieselbe Reihenfolge, der
// auch Vorleseprogramme folgen — und `textContent` sieht bewusst KEINE `title`-Attribute; genau
// darin liegt der Unterschied zwischen „erklärt" und „erklärt nur der Maus" (Kalibrierung unten).
//
// NICHT GEMESSEN wird die Abnahme-Zusage (1) „ohne Scrollen sichtbar". jsdom rechnet kein Layout;
// eine Bildschirmhöhe ist hier grundsätzlich nicht beweisbar. Belegt wird die Ursache dieser
// Zusage — dass vor dem Eingabefeld keine Erklär-Fläche mehr steht. Die Umweltgrenze steht in der
// Rückgabe, nicht als grüner Fall in dieser Datei.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
  // Für den Wartezustand: eine Anfrage, die absichtlich nie fertig wird. Nur so ist der
  // Ladezustand überhaupt beobachtbar — mit sofort auflösender Antwort wäre er zwischen zwei
  // Renderdurchläufen wieder verschwunden.
  haengen: false,
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
        if (bestand.haengen) {
          return new Promise(() => {});
        }
        return {
          result: {
            answered: true,
            answer: "Ventil V4 wird jährlich geprüft.",
            knowledgeClass: "gesichert",
            trust: 90,
            sources: ["k1"],
            citedSources: ["k1"],
            steps: [],
            demo: false,
            captionSources: [],
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { reasonerBadge } from "../../apps/web/src/lib/reasonerBadge";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

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

/**
 * Die Seite im ANFANGSZUSTAND: aufgerufen ohne `?ask=1`, also ohne Auto-Ask. Genau diesen Zustand
 * beschreibt D-034 — was die Leserin sieht, BEVOR sie etwas getan hat.
 */
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
          { initialEntries: ["/fragen"] },
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

async function seite(): Promise<{ container: HTMLElement; unmount: () => void }> {
  await i18n.changeLanguage("de");
  bestand.kos = [ko()];
  return mountAsk();
}

/** Steht `a` im Dokument VOR `b`? Genau die Reihenfolge, der Auge und Vorleseprogramm folgen. */
function stehtVor(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** Das Eingabefeld — über seinen echten Platzhalter gebunden, nicht über „irgendein input". */
function eingabefeld(container: HTMLElement): HTMLInputElement {
  const feld = container.querySelector<HTMLInputElement>("form input");
  expect(
    feld,
    "die Fragen-Seite hat gar kein Eingabefeld — alles Weitere misst ins Leere",
  ).not.toBeNull();
  expect((feld as HTMLInputElement).placeholder, "das gefundene Feld ist nicht das Fragefeld").toBe(
    i18n.t("ask.placeholder"),
  );
  return feld as HTMLInputElement;
}

function erklaerung(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="ask-guide"]');
  expect(
    el,
    "die Erklär-Fläche ist gar nicht mehr da — verschieben heisst nicht streichen (D-034, Abnahme 2)",
  ).not.toBeNull();
  return el as HTMLElement;
}

/** Wie oft steht dieser Text da? „Verschoben" heisst genau einmal — nicht null, nicht zweimal. */
function anzahl(heuhaufen: string, nadel: string): number {
  if (nadel.length === 0) {
    throw new Error("leerer Suchtext — die Zählung wäre bedeutungslos");
  }
  return heuhaufen.split(nadel).length - 1;
}

// Die Pflichttexte der Erklärung werden beim echten Modul erfragt, nicht abgeschrieben. Wer eine
// Kachel entfernt, ändert damit auch diesen Wächter.
function erklaertexte(): Array<{ name: string; text: string }> {
  const guide = knowledgeGuidance("ask");
  const texte = [
    { name: "Titel", text: i18n.t(guide.titleKey) },
    { name: "Fliesstext", text: i18n.t(guide.bodyKey) },
  ];
  for (const item of guide.items) {
    texte.push({ name: `Kachel ${item.id} · Etikett`, text: i18n.t(item.labelKey) });
    texte.push({ name: `Kachel ${item.id} · Text`, text: i18n.t(item.bodyKey) });
  }
  return texte;
}

const MODUS_HINWEIS = (): string => i18n.t("ask.reasoner.hint");
const MODUS_ETIKETT = (): string =>
  i18n.t(reasonerBadge({ status: { mode: "cloud" }, isLoading: false, isError: false }).labelKey);

afterEach(() => {
  vi.clearAllMocks();
  bestand.haengen = false;
  document.body.innerHTML = "";
});

describe("D-034 (1) · das Eingabefeld steht vor der Erklärung", () => {
  it("die Eingabe kommt zuerst — die Erklär-Fläche folgt dahinter", async () => {
    const { container, unmount } = await seite();

    const feld = eingabefeld(container);
    const erklaert = erklaerung(container);
    expect(
      stehtVor(feld, erklaert),
      "die Erklär-Karte steht weiterhin VOR dem Eingabefeld — genau der Befund aus D-034",
    ).toBe(true);
    unmount();
  });

  it("auch die Ergebnisfläche steht noch vor der Erklärung — sie drängt sich nicht zwischen Frage und Antwort", async () => {
    // Ohne diesen Fall wäre „hinter das Feld verschoben" schon erfüllt, wenn die Karte künftig
    // zwischen Eingabe und Antwort läge — dort wäre sie erneut ein Vorwort, nur an anderer Stelle.
    const { container, unmount } = await seite();

    const anker = container.querySelector('[data-testid="ask-result-anchor"]');
    expect(anker, "die Ergebnisfläche ist verschwunden").not.toBeNull();
    expect(
      stehtVor(anker as Element, erklaerung(container)),
      "die Erklärung liegt zwischen Eingabe und Ergebnisfläche",
    ).toBe(true);
    unmount();
  });

  it("KALIBRIERUNG: die Reihenfolgemessung kann überhaupt scheitern", async () => {
    // Sonst wäre `stehtVor` womöglich für jedes Paar wahr und jede Aussage oben wertlos.
    const { container, unmount } = await seite();

    const feld = eingabefeld(container);
    const erklaert = erklaerung(container);
    expect(stehtVor(erklaert, feld), "die Messung ist in beide Richtungen wahr").toBe(false);
    unmount();
  });
});

describe("D-034 (2) · die Erklärung ist weiterhin erreichbar — verschoben, nicht gestrichen", () => {
  it("jeder Text der Erklärung steht genau einmal auf der Seite", async () => {
    const { container, unmount } = await seite();

    const text = container.textContent ?? "";
    const befund = erklaertexte().map((p) => ({ text: p.name, anzahl: anzahl(text, p.text) }));
    expect(befund).toEqual(erklaertexte().map((p) => ({ text: p.name, anzahl: 1 })));
    unmount();
  });

  it("die Kopfzeile bleibt sichtbar — die Fläche faltet auf, statt zu verstecken", async () => {
    // D-034 lässt ausdrücklich „in ein `<details>` falten (Kopfzeile bleibt sichtbar)" zu. Eine
    // gefaltete Fläche OHNE sichtbare Kopfzeile wäre dagegen ein Verschwinden mit Zwischenschritt.
    const { container, unmount } = await seite();

    const erklaert = erklaerung(container);
    const kopf = erklaert.querySelector("summary");
    expect(kopf, "die gefaltete Erklärung hat keine sichtbare Kopfzeile").not.toBeNull();
    expect(kopf?.textContent ?? "").toContain(i18n.t(knowledgeGuidance("ask").titleKey));
    unmount();
  });

  it("die Texte stehen IN der verschobenen Fläche — sie sind mitgewandert, nicht zurückgeblieben", async () => {
    // Ohne diesen Fall wäre die Zählung oben auch dann erfüllt, wenn Titel und Kacheln an ihrem
    // alten Ort vor dem Eingabefeld stehengeblieben wären und nur eine leere Hülle umgezogen ist.
    const { container, unmount } = await seite();

    const innen = erklaerung(container).textContent ?? "";
    for (const p of erklaertexte()) {
      expect(innen, `${p.name} steht nicht in der Erklär-Fläche`).toContain(p.text);
    }
    unmount();
  });
});

describe("D-034 (3) · die Bedeutung des Modus-Chips ist ohne Maus zugänglich", () => {
  it("der Modus-Chip benennt den Modus weiterhin sichtbar", async () => {
    const { container, unmount } = await seite();

    const chip = container.querySelector('[data-testid="ask-reasoner-mode"]');
    expect(
      chip,
      "der Modus-Chip ist verschwunden — erklären heisst nicht abschaffen",
    ).not.toBeNull();
    expect(chip?.textContent ?? "").toContain(MODUS_ETIKETT());
    unmount();
  });

  it("neben dem Chip sitzt ein per Tastatur fokussierbares Bedienelement", async () => {
    const { container, unmount } = await seite();

    const knopf = container.querySelector<HTMLButtonElement>(
      '[data-testid="ask-reasoner-help"] button',
    );
    expect(
      knopf,
      "es gibt kein Bedienelement für den Modus-Hinweis — er bleibt ein reiner Maus-Tooltip",
    ).not.toBeNull();
    expect((knopf as HTMLButtonElement).tagName).toBe("BUTTON");
    expect((knopf as HTMLButtonElement).disabled).toBe(false);
    (knopf as HTMLButtonElement).focus();
    expect(
      document.activeElement,
      "das Bedienelement lässt sich nicht fokussieren — die Tastatur kommt nicht hin",
    ).toBe(knopf);
    const chip = container.querySelector('[data-testid="ask-reasoner-mode"]') as Element;
    expect(
      stehtVor(chip, knopf as Element),
      "das Bedienelement steht nicht beim Chip — dann erklärt es sichtbar nichts Bestimmtes",
    ).toBe(true);
    unmount();
  });

  it("Aktivieren legt die Erklärung in den LESBAREN Seitentext — nicht in ein Attribut", async () => {
    const { container, unmount } = await seite();

    expect(
      anzahl(container.textContent ?? "", MODUS_HINWEIS()),
      "der Hinweis steht schon vor jeder Bedienung im Text — dann misst der Fall nichts",
    ).toBe(0);
    const knopf = container.querySelector<HTMLButtonElement>(
      '[data-testid="ask-reasoner-help"] button',
    );
    await act(async () => {
      (knopf as HTMLButtonElement).click();
      await flush();
    });
    expect(
      anzahl(container.textContent ?? "", MODUS_HINWEIS()),
      "nach dem Aktivieren steht die Erklärung immer noch nicht im Seitentext",
    ).toBe(1);
    unmount();
  });

  it("KALIBRIERUNG: der Maus-Weg bleibt bestehen — und `textContent` sieht ihn NICHT", async () => {
    // Das ist der Kern der Messung oben: der `title`-Tooltip existiert weiter (für die Maus), aber
    // er zählt nicht als Erklärung. Fiele diese Trennung, wäre der vorige Fall auch am alten,
    // beanstandeten Stand grün gewesen.
    const { container, unmount } = await seite();

    const mitTooltip = [...container.querySelectorAll<HTMLElement>("[title]")].filter(
      (el) => el.title === MODUS_HINWEIS(),
    );
    expect(mitTooltip.length, "der Maus-Tooltip ist ersatzlos entfallen").toBeGreaterThan(0);
    expect(anzahl(container.textContent ?? "", MODUS_HINWEIS())).toBe(0);
    unmount();
  });
});

describe("D-034 (4) · die Nicht-Ziele bleiben unangetastet", () => {
  it("ein Klick auf einen Beispiel-Chip sendet weiterhin SOFORT", async () => {
    const { container, unmount } = await seite();

    const chips = [...container.querySelectorAll<HTMLButtonElement>("button")].filter(
      (b) => (b.title ?? "") === i18n.t("ask.examplesSendHint"),
    );
    expect(chips.length, "es gibt keine Beispiel-Chips mehr").toBeGreaterThan(0);
    const frage = chips[0]?.textContent?.replace("↵", "").trim() ?? "";
    await act(async () => {
      chips[0]?.click();
      await flush();
    });
    expect(
      (endpoints.ask.ask as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
      "der Chip-Klick löste keine Anfrage aus — das Sofort-Senden ist weg",
    ).toBe(1);
    expect(
      String((endpoints.ask.ask as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]?.[0]),
    ).toContain(frage.slice(0, 20));
    unmount();
  });

  it("der Wartezustand erscheint unverändert an der Ergebnisfläche", async () => {
    bestand.haengen = true;
    const { container, unmount } = await seite();

    const feld = eingabefeld(container);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(feld, "Wie oft wird Ventil V4 geprüft?");
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await act(async () => {
      (container.querySelector("form") as HTMLFormElement).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush();
    });

    const warten = container.querySelector('[data-testid="ask-pending"]');
    expect(warten, "der Wartezustand erscheint nicht mehr").not.toBeNull();
    expect(warten?.getAttribute("aria-busy")).toBe("true");
    expect(warten?.getAttribute("aria-live")).toBe("polite");
    expect(
      warten?.closest('[data-testid="ask-result-anchor"]'),
      "der Wartezustand steht nicht mehr an der Ergebnisfläche",
    ).not.toBeNull();
    unmount();
  });
});
