// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG „DIKTAT UND VORLESEN IN UNTERSTÜTZTEN BROWSERN ANBIETEN" — die drei Ergänzungen.
// ================================================================================================
//
// Der Bestand (JOB 3038/3064: Mikrofon im Fragefeld, eine Diktat-Wahrheit; SCRUM-403: Interview-
// frage vorlesen) ist in `mikrofon-im-fragefeld.test.tsx` und `diktat-sprache.test.ts` gemessen und
// wird hier NICHT wiederholt. Diese Datei misst nur, was dieser Auftrag hinzufügt:
//   L  Live-Diktat (FR-CAP-03): Vorläufiges ist sofort SICHTBAR, ins Feld kommt nur Endgültiges.
//   I  iOS (FR-CAP-03, R-0019): kein Browser-Diktat auf iPhone/iPad, stattdessen der ehrliche Satz
//      mit dem Verweis auf das Tastatur-Mikrofon.
//   V  Vorlesen der Systemantwort (R-1053): Knopf an der Antwort, nur auf Klick, stoppbar, endet
//      mit der Seite; ohne Sprachausgabe kein toter Knopf, sondern der Satz im „Mehr"-Blatt.
//
// NICHT GEMESSEN: echte Spracherkennung, echte Sprachausgabe, Mikrofonberechtigung und ein echtes
// iPhone. Gemessen wird die Kette bis zur Browser-Grenze — was das Produkt der API übergibt und was
// es mit den Rückmeldungen tut — an Doppeln der Web-Speech-API.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const laeufe = vi.hoisted(() => ({ ask: [] as string[] }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    // Die tragende Quelle der Antwort — wie in `tests/ask/ask-check-caveat-mounted.test.tsx`.
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
      ask: vi.fn(async (frage: string) => {
        laeufe.ask.push(frage);
        return {
          result: {
            answered: true,
            answer: "**Ventil V4** wird jährlich geprüft.",
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { antwortFuersVorlesen } from "../../apps/web/src/components/fragen/useVorlesen";
import i18n from "../../apps/web/src/i18n";
import { makeRec } from "../../apps/web/src/lib/speechDictation";
import { hasSpeechRecognition, istIosGeraet } from "../../apps/web/src/lib/speechSupport";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

type Ergebnis = ArrayLike<{ transcript: string }> & { isFinal?: boolean };
interface ErgebnisEreignis {
  resultIndex: number;
  results: ArrayLike<Ergebnis>;
}

function ergebnis(transcript: string, isFinal: boolean): Ergebnis {
  return Object.assign([{ transcript }], { isFinal });
}

/** Das Rekorder-Doppel — es spricht nur, wenn der Test es heißt. */
class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  gestartet = 0;
  gestoppt = 0;
  onresult: ((e: ErgebnisEreignis) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {
    this.gestartet += 1;
  }
  stop(): void {
    this.gestoppt += 1;
    this.onend?.();
  }
  hoertVorlaeufig(text: string): void {
    this.onresult?.({ resultIndex: 0, results: [ergebnis(text, false)] });
  }
  hoertEndgueltig(text: string): void {
    this.onresult?.({ resultIndex: 0, results: [ergebnis(text, true)] });
  }
}

/** Das Sprachausgabe-Doppel: zählt, was gesprochen und was abgebrochen wurde. */
class AeusserungDoppel {
  text: string;
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
const ausgabe = {
  gesprochen: [] as AeusserungDoppel[],
  abgebrochen: 0,
};

type Fenster = Record<string, unknown>;
const fenster = window as unknown as Fenster;
const UA_VORHER = navigator.userAgent;

function mitSpracherkennung(): void {
  fenster.SpeechRecognition = RekorderDoppel;
}
function mitSprachausgabe(): void {
  fenster.SpeechSynthesisUtterance = AeusserungDoppel;
  fenster.speechSynthesis = {
    speak: (u: AeusserungDoppel) => ausgabe.gesprochen.push(u),
    cancel: () => {
      ausgabe.abgebrochen += 1;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
function alsIphone(): void {
  Object.defineProperty(window.navigator, "userAgent", {
    value:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    configurable: true,
  });
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(start: string): Promise<{ container: HTMLElement; unmount: () => void }> {
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
          { initialEntries: [start] },
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

async function mehrOeffnen(container: HTMLElement): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
    await flush();
  });
}

function knopfMitLabel(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => (b.getAttribute("aria-label") ?? "") === label,
  );
}

beforeEach(async () => {
  laeufe.ask = [];
  RekorderDoppel.letzter = null;
  ausgabe.gesprochen = [];
  ausgabe.abgebrochen = 0;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  fenster.SpeechRecognition = undefined;
  fenster.webkitSpeechRecognition = undefined;
  // Entfernen statt `undefined`: Flächen fragen auch `"speechSynthesis" in window`.
  Reflect.deleteProperty(fenster, "speechSynthesis");
  Reflect.deleteProperty(fenster, "SpeechSynthesisUtterance");
  Object.defineProperty(window.navigator, "userAgent", { value: UA_VORHER, configurable: true });
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

// ================================================================================================
// L · LIVE-DIKTAT
// ================================================================================================
describe("L · Live-Diktat — Vorläufiges sofort sichtbar, ins Feld nur Endgültiges", () => {
  it("L1 · makeRec mit Zwischenanzeige schaltet interimResults ein und trennt die beiden Ströme", () => {
    mitSpracherkennung();
    const endgueltig: string[] = [];
    const zwischen: string[] = [];
    makeRec(
      (t) => endgueltig.push(t),
      () => {},
      "de-DE",
      (t) => zwischen.push(t),
    );
    const rec = RekorderDoppel.letzter;
    expect(rec?.interimResults).toBe(true);

    rec?.hoertVorlaeufig("wie lan");
    expect(zwischen.at(-1)).toBe("wie lan");
    expect(endgueltig, "Vorläufiges darf nicht ins Feld").toEqual([]);

    rec?.hoertEndgueltig("wie lange gilt");
    expect(endgueltig).toEqual(["wie lange gilt"]);
    expect(zwischen.at(-1), "mit dem Endergebnis verschwindet die Vorschau").toBe("");

    rec?.hoertVorlaeufig("der Urlaub");
    rec?.onend?.();
    expect(zwischen.at(-1), "das Ende räumt die Vorschau ab").toBe("");
  });

  it("L2 · auf /fragen steht Vorläufiges neben dem Feld — das Feld selbst bleibt unberührt", async () => {
    mitSpracherkennung();
    const { container, unmount } = await mountAsk("/fragen");
    await act(async () => {
      knopfMitLabel(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    const feld = container.querySelector("input") as HTMLInputElement;

    await act(async () => {
      RekorderDoppel.letzter?.hoertVorlaeufig("wie lange gilt");
      await flush();
    });
    const vorschau = container.querySelector('[data-testid="ask-diktat-zwischen"]');
    expect(vorschau?.textContent).toBe("wie lange gilt");
    expect(vorschau?.getAttribute("aria-live")).toBe("polite");
    expect(feld.value, "Vorläufiges ist ins Feld geschrieben worden").toBe("");

    await act(async () => {
      RekorderDoppel.letzter?.hoertEndgueltig("wie lange gilt der Urlaub");
      await flush();
    });
    expect(feld.value).toBe("wie lange gilt der Urlaub");
    expect(container.querySelector('[data-testid="ask-diktat-zwischen"]')).toBeNull();
    // Die Zusage aus JOB 3038 bleibt: Diktieren fragt nichts von allein.
    expect(laeufe.ask).toEqual([]);
    unmount();
  });
});

// ================================================================================================
// I · iOS
// ================================================================================================
describe("I · iOS — kein einfrierendes Browser-Diktat, sondern der Weg über die Tastatur", () => {
  it("I1 · iPhone und iPad (auch als „Macintosh“ mit Touch) gelten als iOS, der Desktop-Mac nicht", () => {
    const iphone = { navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)" } };
    const ipad = {
      navigator: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 5,
      },
    };
    const mac = {
      navigator: {
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        maxTouchPoints: 0,
      },
    };
    expect(istIosGeraet(iphone)).toBe(true);
    expect(istIosGeraet(ipad)).toBe(true);
    expect(istIosGeraet(mac)).toBe(false);

    // Dieselbe API-Meldung — auf iOS trotzdem KEIN Diktat; Gegenprobe am Desktop.
    expect(hasSpeechRecognition({ ...iphone, webkitSpeechRecognition: class {} })).toBe(false);
    expect(hasSpeechRecognition({ ...ipad, webkitSpeechRecognition: class {} })).toBe(false);
    expect(hasSpeechRecognition({ ...mac, webkitSpeechRecognition: class {} })).toBe(true);
  });

  it("I2 · /fragen auf dem iPhone: kein Mikrofon, und das „Mehr“-Blatt nennt das Tastatur-Mikrofon", async () => {
    mitSpracherkennung();
    alsIphone();
    const { container, unmount } = await mountAsk("/fragen");
    expect(
      knopfMitLabel(container, i18n.t("ask.diktatStart")),
      "auf iOS stünde ein Knopf, der das Feld einfrieren lässt",
    ).toBeUndefined();
    await mehrOeffnen(container);
    const hinweis = document.querySelector('[data-testid="ask-diktat-na"]')?.textContent ?? "";
    expect(hinweis).toContain(i18n.t("ask.diktatUnsupported"));
    expect(hinweis).toContain(i18n.t("diktat.iosTastatur"));
    unmount();
  });

  it("I2-Gegenprobe · am Desktop ohne Erkennung steht der Satz OHNE den iOS-Zusatz", async () => {
    const { container, unmount } = await mountAsk("/fragen");
    await mehrOeffnen(container);
    const hinweis = document.querySelector('[data-testid="ask-diktat-na"]')?.textContent ?? "";
    expect(hinweis).toContain(i18n.t("ask.diktatUnsupported"));
    expect(hinweis).not.toContain(i18n.t("diktat.iosTastatur"));
    unmount();
  });
});

// ================================================================================================
// V · VORLESEN DER ANTWORT
// ================================================================================================
describe("V · die Antwort des Systems wird auf Klick vorgelesen", () => {
  it("V1 · Knopf an der Antwort: Klick spricht den bereinigten Text, zweiter Klick stoppt", async () => {
    mitSprachausgabe();
    const { container, unmount } = await mountAsk("/fragen?q=Ventil&ask=1");
    expect(laeufe.ask, "die Antwort ist nicht geholt worden").toEqual(["Ventil"]);
    // Kein Auto-Play: die Antwort steht da, gesprochen wurde nichts.
    expect(ausgabe.gesprochen).toEqual([]);

    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="ask-vorlesen"]');
    expect(knopf, "kein Vorlese-Knopf an der Antwort").toBeTruthy();
    expect(knopf?.getAttribute("type")).toBe("button");
    expect(knopf?.textContent).toContain(i18n.t("diktat.antwortVorlesen"));
    expect(knopf?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(ausgabe.gesprochen).toHaveLength(1);
    expect(ausgabe.gesprochen[0]?.text).toBe("Ventil V4 wird jährlich geprüft.");
    expect(ausgabe.gesprochen[0]?.lang).toBe("de-DE");
    expect(knopf?.textContent).toContain(i18n.t("diktat.antwortVorlesenStop"));
    expect(knopf?.getAttribute("aria-pressed")).toBe("true");

    const abgebrochenVorher = ausgabe.abgebrochen;
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(ausgabe.abgebrochen, "der Stopp-Klick hat die Ausgabe nicht beendet").toBeGreaterThan(
      abgebrochenVorher,
    );
    expect(ausgabe.gesprochen, "der Stopp-Klick hat erneut gesprochen").toHaveLength(1);
    expect(knopf?.textContent).toContain(i18n.t("diktat.antwortVorlesen"));
    unmount();
  });

  it("V2 · das Verlassen der Seite beendet das Vorlesen", async () => {
    mitSprachausgabe();
    const { container, unmount } = await mountAsk("/fragen?q=Ventil&ask=1");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-vorlesen"]')?.click();
      await flush();
    });
    const vorher = ausgabe.abgebrochen;
    unmount();
    expect(ausgabe.abgebrochen, "nach dem Abbau spräche der Browser weiter").toBeGreaterThan(
      vorher,
    );
  });

  it("V3 · englische Oberfläche liest englisch", async () => {
    await i18n.changeLanguage("en");
    mitSprachausgabe();
    const { container, unmount } = await mountAsk("/fragen?q=Ventil&ask=1");
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-vorlesen"]')?.click();
      await flush();
    });
    expect(ausgabe.gesprochen[0]?.lang).toBe("en-US");
    unmount();
    await i18n.changeLanguage("de");
  });

  it("V4 · ohne Sprachausgabe kein toter Knopf — der Satz steht im „Mehr“-Blatt", async () => {
    const { container, unmount } = await mountAsk("/fragen?q=Ventil&ask=1");
    expect(laeufe.ask).toEqual(["Ventil"]);
    expect(container.querySelector('[data-testid="ask-vorlesen"]')).toBeNull();
    await mehrOeffnen(container);
    expect(document.querySelector('[data-testid="ask-vorlesen-na"]')?.textContent).toBe(
      i18n.t("diktat.antwortVorlesenNa"),
    );
    unmount();
  });

  it("V5 · Markdown-Zeichen und Fussnotenmarken werden nicht mitgesprochen", () => {
    expect(
      antwortFuersVorlesen("## Prüfung\n- **Ventil** V4 [1] wird `jährlich` geprüft.[^2]"),
    ).toBe("Prüfung Ventil V4 wird jährlich geprüft.");
  });
});

describe("Wortlaut · alle neuen Schlüssel in de, en und nl", () => {
  it("nichtleer in allen drei Sprachen", () => {
    for (const key of [
      "diktat.antwortVorlesen",
      "diktat.antwortVorlesenStop",
      "diktat.antwortVorlesenNa",
      "diktat.iosTastatur",
    ]) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${key} fehlt in ${lng}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("de", "translation", "diktat.antwortVorlesenNa"))).toMatch(
      /nicht verfügbar/i,
    );
  });
});
