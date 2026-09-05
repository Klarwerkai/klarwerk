// @vitest-environment jsdom
// ================================================================================================
// JOB 3038 · DAS FRAGEFELD HÖRT ZU — gemessen an der echten `/fragen`-Fläche.
// ================================================================================================
//
// DIE AUSGANGSLAGE, gemessen am Produkt-HEAD `c875f4b`: `apps/web/src/pages/Ask.tsx:542-555` war ein
// blankes `<input>` mit Absendeknopf daneben. Kein Mikrofon, kein Hinweis, keine Erwähnung von
// Sprache in der ganzen Datei — während `Capture.tsx` das Diktat vollständig gebaut hatte.
//
// DIESER TEST FÄHRT DIE ECHTE SEITE (kein Fragment, keine Attrappe der Komponente) und prüft die
// vier Zusagen, die zusammen erst den Zweck ergeben:
//   F1 Der Knopf ist da, wenn der Browser die API hat.
//   F2 Erkanntes landet im Feld — und es geht NICHTS von allein an das Modell.
//   F3 Der Bestand im Feld wird ANGEHÄNGT, nicht überschrieben.
//   F4 Ohne API kein toter Knopf, sondern ein Satz, der es sagt.
//
// F1 und F4 zusammen sind die Aussage; einzeln wären beide von einer Seite erfüllbar, die den Knopf
// nie zeigt bzw. ihn immer zeigt. Ebenso F2: die Kalibrierung „der Absendeknopf sendet sehr wohl"
// steht ausdrücklich mit im Fall, sonst wäre „kein Ask" auch von einer kaputten Seite erfüllt.
//
// WAS HIER AUSDRÜCKLICH NICHT GEMESSEN WIRD: die echte Spracherkennung. Sie braucht Mikrofon,
// Modell und Netz des Browsers und ist headless nicht prüfbar. Gemessen wird die Kette bis zur
// Browser-Grenze — was das Produkt der API übergibt und was es mit dem Erkannten tut.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const laeufe = vi.hoisted(() => ({ ask: [] as string[] }));

// Wie in `tests/ask/ask-check-caveat-mounted.test.tsx`: die Rollenfrage stellt Ask am RoleLink-Tor;
// diese Datei prüft sie nicht und mountet mit fester Expertinnen-Rolle.
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
      // Der Zähler ist der eigentliche Messpunkt von F2: eine versehentlich erkannte Silbe darf
      // keinen Modelllauf kosten.
      ask: vi.fn(async (frage: string) => {
        laeufe.ask.push(frage);
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
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

interface ErgebnisEreignis {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
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
  spricht(text: string): void {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
  }
}

/** Das `window`-Doppel MIT Spracherkennung. */
function mitSpracherkennung(): void {
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = RekorderDoppel;
}
/** Das `window`-Doppel OHNE Spracherkennung — der ehrliche Negativzustand. */
function ohneSpracherkennung(): void {
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = undefined;
  (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = undefined;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(
  start = "/fragen",
): Promise<{ container: HTMLElement; unmount: () => void }> {
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

/** Der Diktat-Knopf, gefunden über sein zugängliches Label — nicht über eine Stilklasse. */
function diktatKnopf(container: HTMLElement, label: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (b) => (b.getAttribute("aria-label") ?? "") === label,
  );
}

function fragefeld(container: HTMLElement): HTMLInputElement {
  const feld = container.querySelector("input");
  expect(feld, "Fragefeld nicht gefunden").toBeTruthy();
  return feld as HTMLInputElement;
}

beforeEach(async () => {
  laeufe.ask = [];
  RekorderDoppel.letzter = null;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  ohneSpracherkennung();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("JOB 3038 · das Fragefeld hört zu", () => {
  it("F1 · mit Spracherkennung steht der Diktat-Knopf am Fragefeld", async () => {
    mitSpracherkennung();
    const { container, unmount } = await mountAsk();
    const knopf = diktatKnopf(container, i18n.t("ask.diktatStart"));
    expect(knopf, "kein Knopf mit dem Diktat-Label auf /fragen").toBeTruthy();
    // Er darf das Formular NICHT absenden — das ist keine Kosmetik, sondern Lieferung 5.
    expect(knopf?.getAttribute("type")).toBe("button");
    // JOB 3064 H5 NACHGEFÜHRT, nicht gelockert: das Zielbild `design/klarwerk/Fragen.dc.html`
    // (Z.47) trägt im Frage-Feld ein SYMBOL, keine Wortschaltfläche — vorher stand der Wortlaut
    // zusätzlich als Text im Knopf. Die ZUSAGE bleibt dieselbe und wird hier vollständig gemessen:
    // der Zustand ist benannt (der Name wechselt „sprechen" → „stoppen"), er ist maschinell
    // auslesbar (`aria-pressed`) und er steht auch für die Maus da (`title`).
    expect(knopf?.getAttribute("aria-label")).toBe(i18n.t("ask.diktatStart"));
    expect(knopf?.getAttribute("title")).toBe(i18n.t("ask.diktatStart"));
    expect(knopf?.getAttribute("aria-pressed")).toBe("false");
    unmount();
  });

  it("F2 · Erkanntes steht im Feld — und KEIN Ask ist gelaufen; erst der Klick sendet", async () => {
    mitSpracherkennung();
    const { container, unmount } = await mountAsk();
    const knopf = diktatKnopf(container, i18n.t("ask.diktatStart"));
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(RekorderDoppel.letzter?.gestartet, "Aufnahme nicht gestartet").toBe(1);

    await act(async () => {
      RekorderDoppel.letzter?.spricht("wie lange gilt der Urlaub");
      await flush();
    });
    expect(fragefeld(container).value).toBe("wie lange gilt der Urlaub");

    // Zweiter Klick beendet die Aufnahme — der Knopf trägt jetzt das Stopp-Label.
    const stopp = diktatKnopf(container, i18n.t("ask.diktatStop"));
    expect(stopp, "der laufende Knopf trägt kein Stopp-Label").toBeTruthy();
    await act(async () => {
      stopp?.click();
      await flush();
    });
    expect(RekorderDoppel.letzter?.gestoppt).toBe(1);
    // DIE ZUSAGE: Stoppen löst KEINE Modellanfrage aus.
    expect(laeufe.ask, "das Stoppen der Aufnahme hat eine Modellanfrage ausgelöst").toEqual([]);
    // Und der Knopf ist sichtbar in den Ruhezustand zurückgegangen.
    expect(diktatKnopf(container, i18n.t("ask.diktatStart"))).toBeTruthy();

    // KALIBRIERUNG: der bestehende Weg sendet sehr wohl — sonst wäre „kein Ask" auch von einer
    // vollständig kaputten Seite erfüllt.
    const senden = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("type") === "submit",
    );
    await act(async () => {
      senden?.click();
      await flush();
    });
    expect(laeufe.ask).toEqual(["wie lange gilt der Urlaub"]);
    unmount();
  });

  it("F3 · der Bestand im Feld bleibt stehen, Erkanntes wird angehängt", async () => {
    mitSpracherkennung();
    const { container, unmount } = await mountAsk("/fragen?q=Urlaub");
    expect(fragefeld(container).value).toBe("Urlaub");
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    await act(async () => {
      RekorderDoppel.letzter?.spricht("Regelung");
      await flush();
    });
    expect(fragefeld(container).value).toBe("Urlaub Regelung");
    expect(laeufe.ask).toEqual([]);
    unmount();
  });

  it("F4 · ohne Spracherkennung kein toter Knopf, sondern der ehrliche Satz", async () => {
    ohneSpracherkennung();
    const { container, unmount } = await mountAsk();
    expect(
      diktatKnopf(container, i18n.t("ask.diktatStart")),
      "ein Diktat-Knopf ohne Browser-Unterstützung wäre eine Scheinfunktion",
    ).toBeUndefined();
    expect(diktatKnopf(container, i18n.t("ask.diktatStop"))).toBeUndefined();

    // JOB 3064 H5 NACHGEFÜHRT, nicht gelockert: der Satz steht nicht mehr im Sichtfeld — §6 des
    // Auftrags nimmt ihn heraus („ohne Spracherkennung fehlt das Mikrofon einfach, kein Satz"),
    // das Funktionsinventar gibt ihm den benannten Ort „…" → „Mehr". Die Zusage von F4 bleibt
    // wörtlich dieselbe: es gibt keinen toten Knopf UND es gibt den ehrlichen Satz. Nur ist er
    // einen Klick entfernt, und dieser Klick wird hier über das echte Menü ausgeführt.
    expect(
      container.textContent ?? "",
      "der Satz steht ungefragt im Sichtfeld — H5 nimmt Erklärtext dort heraus",
    ).not.toContain(i18n.t("ask.diktatUnsupported"));
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
      await flush();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
      await flush();
    });
    // `document.body`, weil das Seitenblatt dorthin portaliert wird (Geometrie, s. Seitenblatt.tsx).
    expect(
      document.body.textContent ?? "",
      "der Satz ist ersatzlos entfallen — verschieben heisst nicht streichen",
    ).toContain(i18n.t("ask.diktatUnsupported"));
    unmount();
  });

  // ==============================================================================================
  // F7 · JOB 3038 RUNDE 2 — BENs BEFUND: DIE AUFNAHME MUSS AUCH OHNE KLICK ENDEN.
  // ==============================================================================================
  //
  // DER FEHLER, den Runde 1 hatte und den dieser Fall gefangen haben muss: `recRef` wurde gesetzt
  // und AUSSCHLIESSLICH vom zweiten Klick gestoppt. Wer die Frageseite verliess, während das
  // Diktat lief, nahm den Stoppknopf mit — die Erkennung lief weiter, und mit ihr das Mikrofon.
  // Der Nutzerkontrollpunkt war weg, der Zugriff nicht. Bei einem Mikrofonzugriff ist das kein
  // Schönheitsfehler, sondern ein Lebenszyklus- und Datenschutzfehler.
  //
  // Runde 1 hat den Fall auch deshalb übersehen, weil F3 und F5 SOGAR mit laufendem Rekorder
  // unmounteten, ohne `gestoppt` je anzusehen. Beide Fälle unten schliessen das: der Fang und —
  // genauso wichtig — die Kalibrierung, dass der Abbau nicht blind ein zweites Mal stoppt.
  it("F7 · das Verlassen der Seite beendet die laufende Aufnahme — genau einmal, ohne Klick", async () => {
    mitSpracherkennung();
    const { container, unmount } = await mountAsk();
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    const rec = RekorderDoppel.letzter;
    expect(rec?.gestartet, "Aufnahme nicht gestartet").toBe(1);
    expect(rec?.gestoppt, "vor dem Verlassen läuft sie noch — sonst misst der Fall nichts").toBe(0);

    // Der Routenwechsel baut diese Seite ab. Ab hier gibt es keinen Stoppknopf mehr.
    unmount();

    expect(
      rec?.gestoppt,
      "die Aufnahme lief nach dem Abbau der Seite weiter — das Mikrofon bleibt offen, " +
        "während der sichtbare Stoppweg verschwunden ist",
    ).toBe(1);
  });

  it("F7-Kalibrierung · nach dem Stopp-Klick stoppt der Abbau NICHT ein zweites Mal", async () => {
    // Ohne diese Hälfte wäre der Fang oben mit einem Abbau erkauft, der blind auf eine längst
    // beendete Erkennung eintritt. Die Referenz wird beim Ende geräumt — sie zeigt nur, solange
    // wirklich etwas läuft.
    mitSpracherkennung();
    const { container, unmount } = await mountAsk();
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStop"))?.click();
      await flush();
    });
    const rec = RekorderDoppel.letzter;
    expect(rec?.gestoppt, "der Klick stoppt genau einmal").toBe(1);
    unmount();
    expect(rec?.gestoppt, "der Abbau hat eine bereits beendete Aufnahme erneut gestoppt").toBe(1);
  });

  // ==============================================================================================
  // F8 · JOB 3038 RUNDE 3 — BENs ZWEITER BEFUND: EIN ALTER RÜCKRUF DARF DIE NEUE AUFNAHME NICHT
  // ABRÄUMEN.
  // ==============================================================================================
  //
  // DER FEHLER, den Runde 2 hatte: `onDone` räumte `recRef` und `listening` BEDINGUNGSLOS — und
  // dieselbe Funktion hing an `onend` UND `onerror`. Die Web-Speech-Spezifikation lässt die
  // Ereignisreihenfolge offen und verlangt ein `end` bei JEDEM Sitzungsende, auch nach einem
  // `error` (§4.1.5). Damit war diese Folge zulässig und tödlich:
  //
  //     A starten → A meldet `error` (Ruhezustand) → B starten → A meldet SPÄT sein `end`
  //
  // Das späte `end` von A trug den Zustand von B ab: der Stoppknopf verschwand, `recRef` wurde
  // `null` — und weil der Abbau der Seite genau diese Referenz liest, fand auch er B nicht mehr.
  // Rekorder B lief weiter, ohne sichtbaren und ohne erreichbaren Stoppweg. Derselbe
  // Datenschutzfehler wie in Runde 1, nur über einen Ereignis-Race statt über die Navigation.
  //
  // DIESER FALL FÜHRT DIE FOLGE BIS ZUM ABBAU — sonst bewiese er nur die halbe Kette.
  it("F8 · ein spätes Ende der ALTEN Aufnahme lässt die neue unberührt — bis zum Abbau", async () => {
    mitSpracherkennung();
    const { container, unmount } = await mountAsk();

    // (1) Aufnahme A läuft.
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    const a = RekorderDoppel.letzter;
    expect(a?.gestartet, "A nicht gestartet").toBe(1);

    // (2) A scheitert. Der Knopf geht in den Ruhezustand zurück — das ist richtig und gemessen.
    await act(async () => {
      a?.onerror?.();
      await flush();
    });
    expect(
      diktatKnopf(container, i18n.t("ask.diktatStart")),
      "nach dem Fehler muss der Startknopf zurück sein",
    ).toBeTruthy();

    // (3) Aufnahme B läuft — ein NEUER Rekorder.
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    const b = RekorderDoppel.letzter;
    expect(b, "B ist derselbe Rekorder wie A — der Fall misst dann nichts").not.toBe(a);
    expect(b?.gestartet).toBe(1);

    // (4) Und JETZT meldet A sein Ende — verspätet, nach dem Start von B.
    await act(async () => {
      a?.onend?.();
      await flush();
    });

    // DIE ZUSAGE: B ist davon unberührt. Der Stoppweg steht noch.
    expect(
      diktatKnopf(container, i18n.t("ask.diktatStop")),
      "das späte Ende des alten Rekorders hat den sichtbaren Stoppweg des neuen entfernt",
    ).toBeTruthy();

    // (5) Bis zum Abbau geführt: er findet B, beendet ihn genau einmal — und lässt A in Ruhe.
    unmount();
    expect(b?.gestoppt, "der Abbau hat B nicht (oder mehrfach) beendet").toBe(1);
    expect(a?.gestoppt, "A wurde erneut gestoppt, obwohl er längst beendet war").toBe(0);
  });

  it("F5 · bei Oberflächensprache `en` trägt der gestartete Rekorder `en-US`", async () => {
    await i18n.changeLanguage("en");
    mitSpracherkennung();
    const { container, unmount } = await mountAsk();
    await act(async () => {
      diktatKnopf(container, i18n.t("ask.diktatStart"))?.click();
      await flush();
    });
    expect(RekorderDoppel.letzter?.lang).toBe("en-US");
    unmount();
    await i18n.changeLanguage("de");
  });
});

describe("JOB 3038 F6 · der Wortlaut-Riegel — dreisprachig und ehrlich", () => {
  const schluessel = ["ask.diktatStart", "ask.diktatStop", "ask.diktatUnsupported"];

  it("alle drei Schlüssel sind in de, en und nl nichtleer", () => {
    for (const key of schluessel) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${key} fehlt in ${lng}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("der deutsche Nicht-verfügbar-Satz sagt „nicht verfügbar“ — dieselbe Zusage wie im Erfassen", () => {
    // Dasselbe Versprechen, das `tests/capture/interview-speech-i18n.test.ts:19-21` für
    // `capture.ivDictNa` hält: kein Fake-Feature, sondern ein Satz, der den Zustand nennt.
    expect(String(i18n.getResource("de", "translation", "ask.diktatUnsupported"))).toMatch(
      /nicht verfügbar/i,
    );
  });
});
