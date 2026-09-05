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
// ================================================================================================
// UMZUG DURCH JOB 3064 · H5 — DIESELBEN BEHAUPTUNGEN, EIN ANDERER ORT.
// ================================================================================================
//
// H5 nimmt jeden Erklärtext aus dem Sichtfeld von `/fragen` (Auftrag §5, Lieferpunkt 8). Die
// Erklär-Fläche, der Modus-Chip und sein Hilfe-Knopf stehen seither im Info-Blatt „…" → „Mehr"
// (`MehrFlaechenInfo`, `pages/Ask.tsx`), das an `document.body` portaliert wird.
//
// Was das für diesen Wächter ändert — und was ausdrücklich NICHT:
//   · NICHT geändert ist eine einzige Behauptung. Reihenfolge, „genau einmal", sichtbare
//     Kopfzeile, Chip-Beschriftung, fokussierbarer Knopf, lesbarer Text statt Attribut, der
//     Maus-Weg als Kalibrierung — alles wird weiter gemessen, mit denselben Ankern.
//   · GEÄNDERT ist, WO gemessen wird: `document.body` statt nur `container` (das Blatt ist ein
//     Portal), und die Fläche wird vorher über den Griff geöffnet. Ein Menüpunkt, der sein Blatt
//     nicht öffnet, macht ab jetzt jeden Fall hier rot — das ist strenger als vorher, nicht milder.
//   · NEU ist der Fall (2a): VOR dem Griff steht die Erklärung nirgends. Das ist die H5-Zusage
//     selbst, und sie ist zugleich die Gegenprobe zu „verschoben, nicht gestrichen": beides
//     zusammen kann nur erfüllen, wer wirklich umgezogen ist — wer streicht, scheitert an (2),
//     wer stehen lässt, scheitert an (2a).
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
    // JOB 3060 · H1: das Zahnrad-Menü (Seitenhilfe) fragt die Betriebsschalter — hier „alles aus".
    features: { get: vi.fn(async () => ({ features: {} })) },
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { reasonerBadge } from "../../apps/web/src/lib/reasonerBadge";
import { Ask } from "../../apps/web/src/pages/Ask";
import { SeitenhilfeProvider } from "../../apps/web/src/shell/SeitenhilfeContext";
import { ZahnradMenue } from "../../apps/web/src/shell/ZahnradMenue";

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

/**
 * JOB 3064 · H5: der Griff zur Einordnung — „…" öffnen, „Mehr" wählen. Beide Schritte sind echte
 * Klicks auf echte Knöpfe; ein Menü ohne Wirkung fliegt hier auf, statt still durchzugehen.
 */
async function oeffneMehr(container: HTMLElement): Promise<void> {
  const griff = container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
  expect(griff, "es gibt keinen „…“-Griff — die Einordnung hat gar keinen Ort mehr").not.toBeNull();
  await act(async () => {
    (griff as HTMLButtonElement).click();
    await flush();
  });
  const punkt = container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]');
  expect(punkt, "das „…“-Menü trägt keinen Punkt „Mehr“").not.toBeNull();
  await act(async () => {
    (punkt as HTMLButtonElement).click();
    await flush();
  });
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

/**
 * Die Erklär-Fläche — seit H5 im portalierten Info-Blatt, deshalb an `document` gebunden und nicht
 * mehr am Mount-Knoten. Der Aufrufer hat `oeffneMehr` vorher gerufen; sonst ist sie zu Recht nicht
 * da (siehe Fall 2a).
 */
function erklaerung(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-testid="ask-guide"]');
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
    await oeffneMehr(container);

    const feld = eingabefeld(container);
    const erklaert = erklaerung();
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
    await oeffneMehr(container);

    const anker = container.querySelector('[data-testid="ask-result-anchor"]');
    expect(anker, "die Ergebnisfläche ist verschwunden").not.toBeNull();
    expect(
      stehtVor(anker as Element, erklaerung()),
      "die Erklärung liegt zwischen Eingabe und Ergebnisfläche",
    ).toBe(true);
    unmount();
  });

  it("KALIBRIERUNG: die Reihenfolgemessung kann überhaupt scheitern", async () => {
    // Sonst wäre `stehtVor` womöglich für jedes Paar wahr und jede Aussage oben wertlos.
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    const feld = eingabefeld(container);
    const erklaert = erklaerung();
    expect(stehtVor(erklaert, feld), "die Messung ist in beide Richtungen wahr").toBe(false);
    unmount();
  });
});

describe("D-034 (2) · die Erklärung ist weiterhin erreichbar — verschoben, nicht gestrichen", () => {
  it("jeder Text der Erklärung steht genau einmal auf der Seite", async () => {
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    // `document.body` statt `container`: es umfasst BEIDES — die Fläche und das portalierte Blatt.
    // Eine Abschrift, die im Blatt UND daneben stünde, ergäbe hier 2 und fiele auf.
    const text = document.body.textContent ?? "";
    const befund = erklaertexte().map((p) => ({ text: p.name, anzahl: anzahl(text, p.text) }));
    expect(befund).toEqual(erklaertexte().map((p) => ({ text: p.name, anzahl: 1 })));
    unmount();
  });

  it("die Kopfzeile bleibt sichtbar — die Fläche faltet auf, statt zu verstecken", async () => {
    // D-034 lässt ausdrücklich „in ein `<details>` falten (Kopfzeile bleibt sichtbar)" zu. Eine
    // gefaltete Fläche OHNE sichtbare Kopfzeile wäre dagegen ein Verschwinden mit Zwischenschritt.
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    const erklaert = erklaerung();
    const kopf = erklaert.querySelector("summary");
    expect(kopf, "die gefaltete Erklärung hat keine sichtbare Kopfzeile").not.toBeNull();
    expect(kopf?.textContent ?? "").toContain(i18n.t(knowledgeGuidance("ask").titleKey));
    unmount();
  });

  it("die Texte stehen IN der verschobenen Fläche — sie sind mitgewandert, nicht zurückgeblieben", async () => {
    // Ohne diesen Fall wäre die Zählung oben auch dann erfüllt, wenn Titel und Kacheln an ihrem
    // alten Ort vor dem Eingabefeld stehengeblieben wären und nur eine leere Hülle umgezogen ist.
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    const innen = erklaerung().textContent ?? "";
    for (const p of erklaertexte()) {
      expect(innen, `${p.name} steht nicht in der Erklär-Fläche`).toContain(p.text);
    }
    unmount();
  });
});

describe("D-034 (2a) · JOB 3064 H5: vor dem Griff steht die Erklärung nirgends", () => {
  it("ohne „…“ → „Mehr“ ist weder die Erklär-Fläche noch einer ihrer Texte auf der Seite", async () => {
    // Die H5-Zusage (Auftrag §5, Lieferpunkt 8) — und zugleich die Gegenprobe zu (2): „verschoben"
    // ist nur wahr, wenn es hier NICHT steht und dort SCHON. Wer den alten Ort bloss zusätzlich
    // stehen liesse, wäre in (2) bei 2 und hier bei „nicht null".
    const { unmount } = await seite();

    expect(
      document.querySelector('[data-testid="ask-guide"]'),
      "die Erklär-Fläche steht ungefragt auf der Fragenfläche — genau das nimmt H5 heraus",
    ).toBeNull();
    const text = document.body.textContent ?? "";
    for (const p of erklaertexte()) {
      expect(anzahl(text, p.text), `${p.name} steht ungefragt im Sichtfeld`).toBe(0);
    }
    unmount();
  });

  it("KALIBRIERUNG: derselbe Griff macht sie da — die Abwesenheit oben ist kein Messfehler", async () => {
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    expect(document.querySelector('[data-testid="ask-guide"]')).not.toBeNull();
    unmount();
  });
});

// ================================================================================================
// JOB 3060 · H1 — WO DIE ERKLÄRUNG SEITDEM WOHNT.
// ================================================================================================
//
// D-034 verlangte ein per Tastatur erreichbares Bedienelement, das den Modus-Hinweis als LESBAREN
// Text öffnet; JOB 1106 nahm dafür den `HelpTip` neben dem Chip. Pedi (04.09., JOB 3060): Erklärung
// gehört hinter das Zahnrad, nicht ins Sichtfeld — `HelpTip` rendert im Seitenfluss nichts mehr und
// meldet Titel und Text bei der Seitenhilfe an (shell/SeitenhilfeContext.tsx); das Zahnrad-Menü
// listet sie unter „Seitenhilfe". Das Bedienelement ist damit das Zahnrad des Kopfbands (ein
// echter BUTTON, per Tabulator erreichbar), die Erklärung steht nach dem Aufklappen im Seitentext.
// Der Chip selbst behält seinen Maus-Tooltip (`title`) — die Kalibrierung unten bleibt.
async function seiteMitHuelle(): Promise<{ container: HTMLElement; unmount: () => void }> {
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
          { initialEntries: ["/fragen"] },
          createElement(
            ToastProvider,
            null,
            createElement(
              NavGuardProvider,
              null,
              createElement(
                SeitenhilfeProvider,
                null,
                createElement(ZahnradMenue),
                createElement(Ask),
              ),
            ),
          ),
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

describe("D-034 (3) · die Bedeutung des Modus-Chips ist ohne Maus zugänglich", () => {
  it("der Modus-Chip benennt den Modus weiterhin sichtbar", async () => {
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    const chip = document.querySelector('[data-testid="ask-reasoner-mode"]');
    expect(
      chip,
      "der Modus-Chip ist verschwunden — erklären heisst nicht abschaffen",
    ).not.toBeNull();
    expect(chip?.textContent ?? "").toContain(MODUS_ETIKETT());
    unmount();
  });

  it("im Sichtfeld steht neben dem Chip KEINE Sprechblase mehr — der HelpTip meldet sich bei der Seitenhilfe an", async () => {
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    const traeger = document.querySelector('[data-testid="ask-reasoner-help"]');
    expect(traeger, "der Anmelde-Träger des HelpTip fehlt").not.toBeNull();
    expect(traeger?.childElementCount, "der HelpTip rendert wieder etwas im Sichtfeld").toBe(0);
    unmount();
  });

  it("das Bedienelement ist das Zahnrad des Kopfbands: ein echter, per Tastatur fokussierbarer Knopf", async () => {
    const { container, unmount } = await seiteMitHuelle();

    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="kopfband-zahnrad"]');
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
    unmount();
  });

  it("Aktivieren (Zahnrad → Seitenhilfe) legt die Erklärung in den LESBAREN Seitentext — nicht in ein Attribut", async () => {
    const { container, unmount } = await seiteMitHuelle();
    await oeffneMehr(container);

    expect(
      anzahl(document.body.textContent ?? "", MODUS_HINWEIS()),
      "der Hinweis steht schon vor jeder Bedienung im Text — dann misst der Fall nichts",
    ).toBe(0);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="kopfband-zahnrad"]')?.click();
      await flush();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="zahnrad-seitenhilfe"]')?.click();
      await flush();
    });
    expect(
      anzahl(document.body.textContent ?? "", MODUS_HINWEIS()),
      "nach dem Aktivieren steht die Erklärung immer noch nicht im Seitentext",
    ).toBe(1);
    // Und sie steht ÜBERSCHRIEBEN mit dem Modus, um den es geht — die Zuordnung ist eindeutig.
    const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
    expect(liste?.textContent ?? "").toContain(MODUS_ETIKETT());
    unmount();
  });

  it("KALIBRIERUNG: der Maus-Weg bleibt bestehen — und `textContent` sieht ihn NICHT", async () => {
    // Das ist der Kern der Messung oben: der `title`-Tooltip existiert weiter (für die Maus), aber
    // er zählt nicht als Erklärung. Fiele diese Trennung, wäre der vorige Fall auch am alten,
    // beanstandeten Stand grün gewesen.
    const { container, unmount } = await seite();
    await oeffneMehr(container);

    const mitTooltip = [...document.querySelectorAll<HTMLElement>("[title]")].filter(
      (el) => el.title === MODUS_HINWEIS(),
    );
    expect(mitTooltip.length, "der Maus-Tooltip ist ersatzlos entfallen").toBeGreaterThan(0);
    expect(anzahl(document.body.textContent ?? "", MODUS_HINWEIS())).toBe(0);
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
