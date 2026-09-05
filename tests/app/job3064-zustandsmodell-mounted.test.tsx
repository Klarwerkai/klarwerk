// @vitest-environment jsdom
// ================================================================================================
// JOB 3064 · H5 · KORREKTURPFLICHT 4 (Ben, Runde 3) — DAS ZUSTANDSMODELL, LAGE FÜR LAGE.
// ================================================================================================
//
// BENS BEFUND an Runde 3:
//   „`ZuletztKarte` unterscheidet Fehler und veralteten Stand nicht sichtbar und bietet keinen
//    Wiederholungsweg … Die Fragenfläche unterscheidet offline nicht vom allgemeinen Fehler."
// und seine Korrekturpflicht: „getrennte Tests für Laden, Erstfehler, offline, Cache-Auffrischung
// und gescheiterte Auffrischung."
//
// WARUM DAS EINE INHALTLICHE FRAGE IST, KEINE FORMALE. Der Auftrag §9 und die REGELN §7 sagen
// dasselbe: eine STÖRUNG darf nicht wie LEERE aussehen, und eine Aussage über den Bestand („nichts
// erfasst") darf nur stehen, wenn ihre Voraussetzung da ist — ein geglückter Abruf. Genau diese
// drei Lagen fielen bis Runde 3 auf dasselbe Bild zusammen: eine leere Karte. Wer sie sah, konnte
// nicht wissen, ob nichts da ist oder ob nichts ankam.
//
// WAS HIER GEMESSEN WIRD: der gerenderte DOM der ECHTEN Bauteile, je Lage einzeln, mit einer
// AUSDRÜCKLICHEN Gegenprobe je Paar — sonst wäre „unterscheidbar" nicht belegt, sondern behauptet.
// Für `/fragen` wird die Lage über den echten Endpunkt-Mock erzeugt (Fehler wirft, offline pausiert
// die Mutation), nicht durch Hineinschreiben in den Zustand.
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  /** `"fehler"` wirft, `"offline"` lässt react-query pausieren, `"antwort"` liefert. */
  askLage: "antwort" as "antwort" | "fehler" | "haengt",
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
      ask: vi.fn(async () => {
        if (bestand.askLage === "fehler") {
          throw new Error("Draht abgerissen");
        }
        if (bestand.askLage === "haengt") {
          return new Promise(() => {});
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
import { ZuletztKarte } from "../../apps/web/src/components/start/StartKarten";
import type { ForYouLage } from "../../apps/web/src/components/start/forYou";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const JETZT = new Date("2026-09-04T12:00:00.000Z");
const WAND = {
  saved: [
    { koId: "k1", title: "Halterungen ohne waagerechte Oberseiten", at: JETZT.toISOString() },
  ],
  helpful: [],
};

/** `ZuletztKarte` allein montiert — die Lage wird als Eingabe gesetzt, nicht simuliert. */
async function zuletzt(
  lage: ForYouLage,
  daten: typeof WAND | undefined,
): Promise<{ container: HTMLElement; klicks: number; unmount: () => void }> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const zaehler = { n: 0 };
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(ZuletztKarte, {
          lage,
          daten: daten as never,
          jetzt: JETZT,
          onWiederholen: () => {
            zaehler.n += 1;
          },
        }),
      ),
    );
    await flush();
  });
  return {
    container,
    get klicks() {
      return zaehler.n;
    },
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const stoerung = (c: HTMLElement): Element | null =>
  c.querySelector('[data-testid="h5-zuletzt-wiederholen"]');
const veraltet = (c: HTMLElement): Element | null =>
  c.querySelector('[data-testid="h5-zuletzt-veraltet"]');
const zeilen = (c: HTMLElement): number =>
  c.querySelectorAll('[data-testid="h5-zuletzt-zeile"]').length;

afterEach(() => {
  vi.clearAllMocks();
  bestand.askLage = "antwort";
  onlineManager.setOnline(true);
  document.body.innerHTML = "";
});

describe("JOB 3064 · Z · „ZULETZT“: Laden, Erstfehler, Bestand und veralteter Stand sind vier Bilder", () => {
  it("Z1 · laedt: keine Zeile, KEIN Störungshinweis — und ausdrücklich keine Aussage über den Bestand", async () => {
    const s = await zuletzt("laedt", undefined);
    expect(zeilen(s.container)).toBe(0);
    expect(stoerung(s.container), "beim Laden steht schon eine Störung da").toBeNull();
    expect(veraltet(s.container)).toBeNull();
    // Der Kern von §9: „nichts erfasst" ist eine Behauptung und braucht einen geglückten Abruf.
    expect(s.container.textContent ?? "").not.toContain(i18n.t("start.zuletzt.leer"));
    s.unmount();
  });

  it("Z2 · Erstfehler: DIE STÖRUNG IST SICHTBAR und trägt einen Wiederholen-Weg", async () => {
    // Bens Punkt: bis Runde 3 sah genau das hier aus wie Z1 und wie Z3-leer.
    const s = await zuletzt("gescheitert", undefined);
    const knopf = stoerung(s.container);
    expect(knopf, "ein gescheiterter Abruf sieht aus wie Leere — genau der Befund").not.toBeNull();
    expect(knopf?.textContent ?? "").toContain(i18n.t("loadstate.error.retry"));
    expect(zeilen(s.container)).toBe(0);
    expect(s.container.textContent ?? "").not.toContain(i18n.t("start.zuletzt.leer"));

    // Der Weg ist nicht nur da, er wirkt: der Rückruf der Fläche wird wirklich gerufen.
    expect(s.klicks).toBe(0);
    await act(async () => {
      (knopf as HTMLButtonElement).click();
      await flush();
    });
    expect(s.klicks, "der Wiederholen-Knopf löst nichts aus — eine Scheinfunktion").toBe(1);
    s.unmount();
  });

  it("Z3 · frisch mit Bestand: die Zeile steht, kein Störungshinweis, keine Veraltet-Marke", async () => {
    const s = await zuletzt("frisch", WAND);
    expect(zeilen(s.container)).toBe(1);
    expect(s.container.textContent ?? "").toContain("Halterungen ohne waagerechte Oberseiten");
    expect(stoerung(s.container)).toBeNull();
    expect(veraltet(s.container)).toBeNull();
    s.unmount();
  });

  it("Z3b · frisch und wirklich leer: JETZT darf der Satz „nichts erfasst“ stehen", async () => {
    // Die Gegenprobe zu Z1/Z2: der Satz ist nicht verboten, er ist an seine Voraussetzung gebunden.
    const s = await zuletzt("frisch", { saved: [], helpful: [] });
    expect(s.container.textContent ?? "").toContain(i18n.t("start.zuletzt.leer"));
    expect(stoerung(s.container)).toBeNull();
    s.unmount();
  });

  it("Z4 · Cache mit gescheiterter Auffrischung: die alten Werte BLEIBEN sichtbar und werden markiert", async () => {
    // REGELN §7, erster Satz: „Scheitert eine Hintergrund-Auffrischung, bleiben die zuletzt
    // erfolgreich geholten Werte SICHTBAR." Leeren wäre hier der Fehler, nicht das Anzeigen.
    const s = await zuletzt("veraltet", WAND);
    expect(zeilen(s.container), "die alten Werte wurden geleert").toBe(1);
    expect(veraltet(s.container), "der veraltete Stand ist nicht markiert").not.toBeNull();
    expect(veraltet(s.container)?.textContent ?? "").toContain(i18n.t("loadstate.stale"));
    expect(stoerung(s.container), "auch hier gehört ein Wiederholen-Weg hin").not.toBeNull();
    s.unmount();
  });

  it("Z5 · KALIBRIERUNG: die vier Lagen sind PAARWEISE unterscheidbar, nicht nur einzeln grün", async () => {
    // Ohne diesen Fall wären Z1–Z4 auch von einer Karte erfüllt, die in zwei Lagen dasselbe zeigt —
    // und genau das war der Befund. Verglichen wird der sichtbare Text, nicht die Bauform.
    const lagen: Array<[string, ForYouLage, typeof WAND | undefined]> = [
      ["laedt", "laedt", undefined],
      ["gescheitert", "gescheitert", undefined],
      ["frisch", "frisch", WAND],
      ["veraltet", "veraltet", WAND],
    ];
    const bilder: Array<[string, string]> = [];
    for (const [name, lage, daten] of lagen) {
      const s = await zuletzt(lage, daten);
      bilder.push([name, (s.container.textContent ?? "").replace(/\s+/g, " ").trim()]);
      s.unmount();
    }
    for (let i = 0; i < bilder.length; i++) {
      for (let j = i + 1; j < bilder.length; j++) {
        expect(
          bilder[i]?.[1],
          `„${bilder[i]?.[0]}“ und „${bilder[j]?.[0]}“ sehen identisch aus`,
        ).not.toBe(bilder[j]?.[1]);
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// `/fragen`: offline ist KEIN Fehlschlag
// ------------------------------------------------------------------------------------------------
async function fragenMitAbsenden(
  /** Läuft unmittelbar VOR dem Absenden — so entsteht „offline" am echten Übergang. */
  vorAbsenden?: () => void,
): Promise<{ container: HTMLElement; unmount: () => void }> {
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
  const feld = container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, "Wie oft wird Ventil V4 geprüft?");
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    vorAbsenden?.();
    (container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("JOB 3064 · O · „/fragen“: offline, Fehler und Warten sind drei Bilder", () => {
  it("O1 · offline: EIN Satz „Keine Verbindung.“ — kein Fehlersatz, keine Warteflaeche", async () => {
    // Der inhaltliche Kern: offline ist ein NICHT-VERSUCH. Der Fehlersatz sagt „unterwegs
    // steckengeblieben" — das wäre über eine Frage, die nie losging, schlicht unwahr. Und die
    // Warteflaeche zeigte Platzhalterzeilen für eine Antwort, auf die niemand wartet.
    const s = await fragenMitAbsenden(() => onlineManager.setOnline(false));
    expect(
      s.container.querySelector('[data-testid="ask-offline"]'),
      "offline sagt die Fläche nichts",
    ).not.toBeNull();
    expect(s.container.textContent ?? "").toContain(i18n.t("ask.offline"));
    expect(
      s.container.querySelector('[data-testid="ask-error"]'),
      "offline wird als Fehlschlag ausgegeben",
    ).toBeNull();
    expect(
      s.container.querySelector('[data-testid="ask-pending"]'),
      "offline zeigt eine Warteflaeche für eine Anfrage, die nie losging",
    ).toBeNull();
    s.unmount();
  });

  it("O2 · Fehler: der Fehlersatz MIT Wiederholen — und ausdrücklich NICHT der Offline-Satz", async () => {
    bestand.askLage = "fehler";
    const s = await fragenMitAbsenden();
    const kasten = s.container.querySelector('[data-testid="ask-error"]');
    expect(kasten, "ein gescheiterter Abruf bleibt stumm").not.toBeNull();
    expect(kasten?.textContent ?? "").toContain(i18n.t("ask.error.retry"));
    expect(
      s.container.textContent ?? "",
      "der Fehlerfall behauptet „keine Verbindung“, ohne das zu wissen",
    ).not.toContain(i18n.t("ask.offline"));
    expect(s.container.querySelector('[data-testid="ask-offline"]')).toBeNull();
    s.unmount();
  });

  it("O3 · laufende Anfrage: die Warteflaeche — und weder Fehler- noch Offline-Satz", async () => {
    bestand.askLage = "haengt";
    const s = await fragenMitAbsenden();
    expect(s.container.querySelector('[data-testid="ask-pending"]')).not.toBeNull();
    expect(s.container.querySelector('[data-testid="ask-error"]')).toBeNull();
    expect(s.container.querySelector('[data-testid="ask-offline"]')).toBeNull();
    // §9: warten heisst KEINE Karte — eine leere Antwortkarte wäre eine Behauptung über nichts.
    expect(s.container.querySelector('[data-testid="ask-answer"]')).toBeNull();
    s.unmount();
  });
});
