// @vitest-environment jsdom
// ================================================================================================
// JOB 3064 · H5 · KORREKTURPFLICHT 1+2 (Ben, Runde 5) — DIE ZUSTANDSMATRIX VON `/fragen`.
// ================================================================================================
//
// BENS BEFUND an Runde 5:
//   „Die Zustandsmatrix von `/fragen` ist unvollständig: Wissenslücken erzeugen zwei Karten mit
//    einem wirkungslosen „Mehr"-Menü, und bei Cache-Aktualisierungen verschwindet die vorhandene
//    Antwort."
// Gemessen hatte er `{"ergebniskarten":2,"mehrOeffnet":false}` und
// `expected '…' to contain 'Ventil V4 wird jährlich geprüft.'`.
//
// Und seine Promptverbesserung, die diese Datei wörtlich einlöst:
//   „Ergänze für `/fragen` verpflichtende Mounted-Fälle für Ausgangslage, Laden, Antwort,
//    Wissenslücke, Fehler, Offline, Cache-Aktualisierung und fehlgeschlagene Cache-Aktualisierung.
//    Prüfe je Fall Kartenanzahl, sichtbare Texte sowie die Klickwirkung jedes sichtbaren
//    Menüpunkts. In der Wissenslücke darf exakt eine Ergebniskarte existieren."
//
// ------------------------------------------------------------------------------------------------
// WAS „ERGEBNISKARTE" HIER HEISST — und warum nicht „irgendein Kasten".
// ------------------------------------------------------------------------------------------------
// Gezählt werden die Karten IN der Ergebnisfläche (`ask-result-anchor`), also genau das, was auf
// eine Frage antwortet: Antwortkarte, Lückenkarte, Fehlerkasten. Nicht gezählt wird, was zur
// FLÄCHE gehört (Frage-Feld, Fussleiste) oder was hinter einem Griff liegt (das Info-Blatt) — das
// eine ist keine Antwort, das andere steht nicht im Sichtfeld. Ohne diese Festlegung wäre
// „genau eine Karte" eine Zahl ohne Gegenstand.
//
// JEDER SICHTBARE MENÜPUNKT WIRD GEKLICKT. Ein Punkt, der nichts tut, ist eine Scheinfunktion —
// genau der Befund im Lückenfall. `menuepunkteWirken` öffnet das „…", klickt jeden Eintrag einzeln
// und verlangt eine nachweisbare Wirkung; für „Mehr" ist das das Blatt, für Drucken/Markdown der
// Aufruf des jeweiligen Weges.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  lage: "antwort" as "antwort" | "luecke" | "fehler" | "haengt",
  /** Zählt die Aufrufe, damit „dieselbe Frage erneut" von „erste Frage" unterscheidbar ist. */
  aufrufe: [] as string[],
  /** Auflöser der hängenden Anfrage — so ist der Pending-Zustand kontrolliert beobachtbar. */
  aufloesen: null as null | ((wert: unknown) => void),
  ablehnen: null as null | ((grund: unknown) => void),
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
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
      ask: vi.fn(async (frage: string) => {
        bestand.aufrufe.push(frage);
        if (bestand.lage === "fehler") {
          throw new Error("Draht abgerissen");
        }
        if (bestand.lage === "haengt") {
          return new Promise((aufloesen, ablehnen) => {
            bestand.aufloesen = aufloesen;
            bestand.ablehnen = ablehnen;
          });
        }
        if (bestand.lage === "luecke") {
          return {
            result: {
              answered: false,
              answer: null,
              knowledgeClass: "unbekannt",
              trust: 0,
              sources: [],
              citedSources: [],
              steps: [],
              demo: false,
              captionSources: [],
            },
            gap: { id: "g1" },
            receipt: "r",
          };
        }
        return {
          result: {
            answered: true,
            answer: "Ventil V4 wird jährlich geprüft.",
            knowledgeClass: "gesichert",
            trust: 90,
            sources: [],
            citedSources: [],
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
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const FRAGE = "Wie oft wird Ventil V4 geprüft?";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Flaeche {
  container: HTMLElement;
  unmount: () => void;
}

async function mount(): Promise<Flaeche> {
  await i18n.changeLanguage("de");
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

/** Stellt eine Frage über das ECHTE Formular — kein Hineinschreiben in den Zustand. */
async function fragen(f: Flaeche, frage: string = FRAGE): Promise<void> {
  const feld = f.container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, frage);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (f.container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

/**
 * Die Karten IN der Ergebnisfläche. Gezählt werden die direkten Kartenträger — Antwort, Lücke,
 * Fehler —, nicht jedes verschachtelte `div`.
 */
function ergebniskarten(c: HTMLElement): Element[] {
  const anker = c.querySelector('[data-testid="ask-result-anchor"]');
  if (!anker) {
    return [];
  }
  return [
    ...anker.querySelectorAll(
      '[data-testid="ask-answer"], [data-testid="ask-gap"], [data-testid="ask-error"]',
    ),
  ];
}

const sichtbar = (c: Element): string => (c.textContent ?? "").replace(/\s+/g, " ");
const blattDa = (): boolean => document.querySelector('[data-testid="ask-mehr"]') !== null;

/**
 * Öffnet das „…"-Menü und gibt die sichtbaren Einträge zurück.
 *
 * IDEMPOTENT: der Griff ist ein Umschalter (`OverflowMenu`: `setOffen((v) => !v)`). Ein zweiter
 * Klick auf ein offenes Menü würde es SCHLIESSEN — und dann misst der Aufrufer eine leere Liste
 * statt der Punkte. Deshalb wird `aria-expanded` gelesen, bevor geklickt wird.
 */
async function menuOeffnen(f: Flaeche): Promise<HTMLButtonElement[]> {
  const griff = f.container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]');
  expect(griff, "es gibt keinen „…“-Griff").not.toBeNull();
  if ((griff as HTMLButtonElement).getAttribute("aria-expanded") !== "true") {
    await act(async () => {
      (griff as HTMLButtonElement).click();
      await flush();
    });
  }
  return [...f.container.querySelectorAll<HTMLButtonElement>('[data-testid^="ask-menu-punkt-"]')];
}

/**
 * JEDER sichtbare Menüpunkt wird geklickt und muss SEINE EIGENE Wirkung zeigen. Genau hier fiel
 * Runde 5 durch: „Mehr" stand im Lückenfall da und öffnete nichts (`mehrOeffnet: false`).
 *
 * WARUM NICHT „irgendeine Veränderung am DOM": ein Klick auf einen Menüpunkt schliesst IMMER das
 * Menü — das allein verändert den Baum und würde jeden Punkt als „wirksam" durchwinken. Genau
 * diese Falle habe ich beim Bauen gemessen: mit der losen Prüfung blieb der Fall grün, obwohl das
 * Blatt nicht aufging. Deshalb steht je Punkt, WORAN man seine Wirkung erkennt.
 */
const WIRKUNG: Record<string, (welt: { gedruckt: number; geladen: number }) => boolean> = {
  "ask-menu-punkt-mehr": () => document.querySelector('[data-testid="ask-mehr"]') !== null,
  "ask-menu-punkt-print": (w) => w.gedruckt > 0,
  "ask-menu-punkt-download": (w) => w.geladen > 0,
};

async function menuepunkteWirken(f: Flaeche): Promise<string[]> {
  const punkte = await menuOeffnen(f);
  const ids = punkte.map((p) => p.getAttribute("data-testid") ?? "");
  expect(ids.length, "das Menü hat gar keine Punkte").toBeGreaterThan(0);
  const ohneWirkung: string[] = [];
  for (const id of ids) {
    // Für jeden Punkt frisch öffnen — ein Klick schliesst das Menü.
    const offen = await menuOeffnen(f);
    const punkt = offen.find((p) => p.getAttribute("data-testid") === id);
    if (!punkt) {
      ohneWirkung.push(`${id} (nach dem Öffnen nicht mehr da)`);
      continue;
    }
    const welt = { gedruckt: 0, geladen: 0 };
    const echtesPrint = window.print;
    const echtesCreate = URL.createObjectURL;
    window.print = () => {
      welt.gedruckt += 1;
    };
    URL.createObjectURL = () => {
      welt.geladen += 1;
      return "blob:probe";
    };
    URL.revokeObjectURL = () => undefined;
    try {
      await act(async () => {
        punkt.click();
        await flush();
      });
      const pruefe = WIRKUNG[id];
      if (!pruefe) {
        ohneWirkung.push(`${id} (kein Wirkungsmass hinterlegt — bitte ergänzen)`);
      } else if (!pruefe(welt)) {
        ohneWirkung.push(id);
      }
    } finally {
      window.print = echtesPrint;
      URL.createObjectURL = echtesCreate;
    }
    // Zurück in den Ausgangszustand: ein etwaiges Blatt wieder schliessen.
    const zu = document.querySelector<HTMLButtonElement>(
      '[data-testid="ask-mehr"] button[aria-label]',
    );
    if (zu) {
      await act(async () => {
        zu.click();
        await flush();
      });
    }
  }
  return ohneWirkung;
}

afterEach(() => {
  vi.clearAllMocks();
  bestand.lage = "antwort";
  bestand.aufrufe = [];
  bestand.aufloesen = null;
  bestand.ablehnen = null;
  onlineManager.setOnline(true);
  document.body.innerHTML = "";
});

describe("JOB 3064 · W · die Zustandsmatrix von /fragen — Karten, Texte, Menüwirkung", () => {
  it("W1 · AUSGANGSLAGE: keine Ergebniskarte, und „…“ → „Mehr“ wirkt", async () => {
    const f = await mount();
    expect(ergebniskarten(f.container)).toHaveLength(0);
    expect(sichtbar(f.container), "vor der Frage steht schon eine Antwort").not.toContain(
      "Ventil V4 wird jährlich geprüft.",
    );
    expect(await menuepunkteWirken(f), "Menüpunkte ohne Wirkung").toEqual([]);
    f.unmount();
  });

  it("W2 · LADEN (erste Frage): Platzhalter statt Karte, kein Fehler, Menü wirkt", async () => {
    bestand.lage = "haengt";
    const f = await mount();
    await fragen(f);
    expect(f.container.querySelector('[data-testid="ask-pending"]')).not.toBeNull();
    expect(ergebniskarten(f.container), "beim Laden steht schon eine Karte").toHaveLength(0);
    expect(f.container.querySelector('[data-testid="ask-error"]')).toBeNull();
    expect(await menuepunkteWirken(f), "Menüpunkte ohne Wirkung").toEqual([]);
    f.unmount();
  });

  it("W3 · ANTWORT: genau EINE Karte, sie trägt den Antworttext, jeder Menüpunkt wirkt", async () => {
    const f = await mount();
    await fragen(f);
    const karten = ergebniskarten(f.container);
    expect(karten).toHaveLength(1);
    expect(karten[0]?.getAttribute("data-testid")).toBe("ask-answer");
    expect(sichtbar(f.container)).toContain("Ventil V4 wird jährlich geprüft.");
    expect(await menuepunkteWirken(f), "Menüpunkte ohne Wirkung").toEqual([]);
    f.unmount();
  });

  it("W4 · DER FANG — WISSENSLÜCKE: EXAKT EINE Karte, mit Lückensatz und „Wissen erfassen“", async () => {
    // Bens Messung an Runde 5: `{"ergebniskarten":2,"mehrOeffnet":false}`.
    bestand.lage = "luecke";
    const f = await mount();
    await fragen(f);

    const karten = ergebniskarten(f.container);
    expect(
      karten.map((k) => k.getAttribute("data-testid")),
      "in der Wissenslücke steht mehr als eine Ergebniskarte",
    ).toEqual(["ask-gap"]);
    // Die Karte trägt, was §6 verlangt: den Lückensatz und den Weg.
    const text = sichtbar(karten[0] as Element);
    expect(text, "der Lückensatz fehlt").toContain(i18n.t("ask.noBasisTitle"));
    expect(
      f.container.querySelector('[data-testid="ask-luecke-erfassen"]'),
      "„Wissen erfassen“ fehlt — die Lücke hat keinen Ausweg",
    ).not.toBeNull();
    f.unmount();
  });

  it("W5 · DER ZWEITE FANG — WISSENSLÜCKE: das sichtbare „Mehr“ öffnet wirklich ein Blatt", async () => {
    bestand.lage = "luecke";
    const f = await mount();
    await fragen(f);
    expect(blattDa(), "vor dem Griff hängt schon ein Blatt").toBe(false);
    expect(await menuepunkteWirken(f), "Menüpunkte ohne Wirkung").toEqual([]);
    f.unmount();
  });

  it("W6 · WISSENSLÜCKE: die Einordnung ist nicht gestrichen — sie steht im Blatt", async () => {
    // Die Gegenprobe zu W4: „eine Karte" darf nicht heissen „Texte weg". Vertrag, Quellenbilanz
    // und der geführte Rettungsweg müssen hinter dem Griff vollständig auffindbar sein.
    bestand.lage = "luecke";
    const f = await mount();
    await fragen(f);

    // Im Sichtfeld stehen sie NICHT mehr.
    expect(sichtbar(f.container)).not.toContain(i18n.t("ask.contract.label"));

    const punkte = await menuOeffnen(f);
    const mehr = punkte.find((p) => p.getAttribute("data-testid") === "ask-menu-punkt-mehr");
    await act(async () => {
      (mehr as HTMLButtonElement).click();
      await flush();
    });
    const blatt = document.querySelector('[data-testid="ask-mehr"]');
    expect(blatt, "„Mehr“ öffnet kein Blatt").not.toBeNull();
    const imBlatt = sichtbar(blatt as HTMLElement);
    expect(imBlatt, "das Vertrags-Etikett fehlt im Blatt").toContain(i18n.t("ask.contract.label"));
    expect(imBlatt, "der Kernsatz der Lücke fehlt im Blatt").toContain(
      i18n.t("ask.contract.gap.title"),
    );
    expect(
      document.querySelector('[data-testid="ask-mehr-luecke"]'),
      "die Lücken-Einordnung fehlt im Blatt",
    ).not.toBeNull();
    f.unmount();
  });

  it("W7 · FEHLER: der Fehlerkasten, keine Antwortkarte, Menü wirkt", async () => {
    bestand.lage = "fehler";
    const f = await mount();
    await fragen(f);
    const karten = ergebniskarten(f.container);
    expect(karten.map((k) => k.getAttribute("data-testid"))).toEqual(["ask-error"]);
    expect(sichtbar(f.container)).toContain(i18n.t("ask.error.retry"));
    expect(await menuepunkteWirken(f), "Menüpunkte ohne Wirkung").toEqual([]);
    f.unmount();
  });

  it("W8 · OFFLINE: ein Satz, keine Karte, kein Fehlerkasten", async () => {
    const f = await mount();
    const feld = f.container.querySelector("input") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(feld, FRAGE);
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await act(async () => {
      onlineManager.setOnline(false);
      (f.container.querySelector("form") as HTMLFormElement).dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(f.container.querySelector('[data-testid="ask-offline"]')).not.toBeNull();
    expect(ergebniskarten(f.container)).toHaveLength(0);
    expect(f.container.querySelector('[data-testid="ask-error"]')).toBeNull();
    f.unmount();
  });
});

describe("JOB 3064 · C · dieselbe Frage erneut ist eine AUFFRISCHUNG, kein Themenwechsel", () => {
  it("C1 · DER FANG: während der Auffrischung BLEIBT die Antwort stehen, mit Spinner", async () => {
    // Bens Messung an Runde 5: `expected '…' to contain 'Ventil V4 wird jährlich geprüft.'` —
    // die Antwort verschwand, sobald dieselbe Frage erneut lief.
    const f = await mount();
    await fragen(f);
    expect(sichtbar(f.container)).toContain("Ventil V4 wird jährlich geprüft.");

    bestand.lage = "haengt";
    await fragen(f);
    expect(bestand.aufrufe, "die zweite Anfrage ging gar nicht raus").toHaveLength(2);

    expect(
      sichtbar(f.container),
      "die vorhandene Antwort verschwand während der Auffrischung",
    ).toContain("Ventil V4 wird jährlich geprüft.");
    expect(ergebniskarten(f.container)).toHaveLength(1);
    // Der SICHTBARE Wartezustand steht am Auslöser, nicht als Platzhalterblock unter der Antwort
    // (§9) — vier graue Zeilen dort wären die Ankündigung einer zweiten Antwort.
    expect(
      f.container.querySelector('[data-testid="ask-pending-platzhalter"]'),
      "unter der stehenden Antwort erscheinen Platzhalter für eine zweite",
    ).toBeNull();
    // Der busy-TRÄGER bleibt trotzdem: A18 verlangt, dass sich JEDER Abruf ansagt — auch der
    // zweite auf dieselbe Frage (`tests/ask/job2064-a18-ask-ladetext-mounted.test.tsx` G5).
    // Gesagt, nicht gemalt: die zwei Zusagen widersprechen sich nur scheinbar.
    const traeger = f.container.querySelector('[data-testid="ask-pending"]');
    expect(traeger, "die Auffrischung sagt sich nicht an — A18 verlangt das").not.toBeNull();
    expect(traeger?.textContent ?? "").toContain(i18n.t("ask.pending.title"));
    expect(
      f.container.querySelector("form button[type=submit] .animate-spin"),
      "der Sendeknopf zeigt keinen Spinner",
    ).not.toBeNull();
    f.unmount();
  });

  it("C2 · gescheiterte Auffrischung: die Antwort BLEIBT, mit einem Satz darunter", async () => {
    const f = await mount();
    await fragen(f);

    bestand.lage = "haengt";
    await fragen(f);
    await act(async () => {
      bestand.ablehnen?.(new Error("Leitung weg"));
      await flush();
    });

    expect(
      sichtbar(f.container),
      "nach der gescheiterten Auffrischung ist die Antwort weg",
    ).toContain("Ventil V4 wird jährlich geprüft.");
    expect(
      f.container.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]'),
      "es fehlt der Satz unter der Karte",
    ).not.toBeNull();
    expect(sichtbar(f.container)).toContain(i18n.t("ask.refreshFailed"));
    // Der grosse Fehlerkasten sagt „es gibt kein Ergebnis" — über einer Antwort wäre das unwahr.
    expect(
      f.container.querySelector('[data-testid="ask-error"]'),
      "der Fehlerkasten steht über einer sichtbaren Antwort",
    ).toBeNull();
    expect(ergebniskarten(f.container)).toHaveLength(1);
    f.unmount();
  });

  it("C3 · geglückte Auffrischung: der Satz verschwindet wieder", async () => {
    const f = await mount();
    await fragen(f);
    bestand.lage = "haengt";
    await fragen(f);
    await act(async () => {
      bestand.ablehnen?.(new Error("Leitung weg"));
      await flush();
    });
    expect(
      f.container.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]'),
    ).not.toBeNull();

    bestand.lage = "antwort";
    await fragen(f);
    expect(
      f.container.querySelector('[data-testid="ask-auffrischung-fehlgeschlagen"]'),
      "der Hinweis bleibt stehen, obwohl die Auffrischung geglückt ist",
    ).toBeNull();
    f.unmount();
  });

  it("C4 · KALIBRIERUNG: eine ANDERE Frage räumt die alte Antwort ab (mega39 Block C)", async () => {
    // Ohne diesen Fall wäre C1 auch von einer Fläche erfüllt, die JEDE alte Antwort stehen lässt —
    // und dann stünde die Antwort auf Frage A über der laufenden Frage B. Genau das verbietet
    // mega39 Block C, und genau diese Zusage darf Korrekturpflicht 2 nicht aufweichen.
    const f = await mount();
    await fragen(f);
    expect(sichtbar(f.container)).toContain("Ventil V4 wird jährlich geprüft.");

    bestand.lage = "haengt";
    await fragen(f, "Etwas ganz anderes?");
    expect(
      sichtbar(f.container),
      "die Antwort auf die VORIGE Frage steht über der laufenden neuen",
    ).not.toContain("Ventil V4 wird jährlich geprüft.");
    expect(ergebniskarten(f.container)).toHaveLength(0);
    expect(f.container.querySelector('[data-testid="ask-pending"]')).not.toBeNull();
    f.unmount();
  });
});
