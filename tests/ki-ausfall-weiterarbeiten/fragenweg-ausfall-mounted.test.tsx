// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:poc-ki-ausfall-weiterarbeiten · PV-03-07 — DER ZUSAMMENHÄNGENDE BENUTZERWEG
// BEI ISOLIERTEM KI-AUSFALL UND ERHOLUNG, AUF DER ECHTEN FRAGENSEITE.
// ================================================================================================
//
// Echte `Ask`-Seite, echter Browserspeicher (jsdom), echte Sitzungsabfrage `["auth", "me"]` im
// Query-Cache. Gemockt sind nur die Endpunkte — der KI-Status und die Antwort von `/api/ask` sind
// die zwei Stellschrauben, über die der Ausfall isoliert provoziert wird. Kein Modell, kein Netz,
// keine Kosten, nur fiktive Inhalte.
//
//   F1  Status „nicht erreichbar": eigener Störungssatz, Knopf gesperrt, Wege ohne KI; Frage und
//       Fragekontext überstehen Abbau/Neuaufbau; „KI-Status erneut prüfen" hebt die Sperre nach
//       der Erholung auf; danach kommt die Antwort.
//   F2  Kapazität ausgeschöpft: belegte Ursache statt „steckengeblieben", Frage im Feld, Speicherort
//       „dieser Browser" (nachgelesen), Wege ohne KI; Wiederholen während des laufenden Versuchs
//       erzeugt keine zweite Anfrage.
//   F3  Verweigerte Verarbeitung: eigene Ursache, KEIN „Erneut versuchen".
//   F4  Ersatz nach Modellausfall: die Ursache steht an der Antwort; eine Modellantwort danach
//       trägt keine.
//   F5  Netzfehler des Abrufs: allgemeiner Satz, kein KI-Ausfall behauptet; Speicherort ehrlich.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const steuer = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
  antworten: [] as Array<() => unknown>,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    gaps: { list: vi.fn(async () => []) },
    reasoner: { status: vi.fn(async () => steuer.status) },
    ask: {
      ask: vi.fn(async () => {
        const naechste = steuer.antworten.shift();
        if (!naechste) {
          throw new Error("Testaufbau: keine Antwort vorbereitet");
        }
        return naechste();
      }),
      helpful: vi.fn(async () => ({})),
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
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = (): void => {};

const MODELL = { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } };
const KONTO = "konto-fiktiv-1";
const FRAGE = "Wie oft wird das fiktive Ventil V4 geprüft?";

function antwort(extra: Record<string, unknown> = {}): unknown {
  return {
    result: {
      answered: true,
      answer: "Das fiktive Ventil V4 wird jährlich geprüft.",
      knowledgeClass: "gesichert",
      trust: 90,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
      captionSources: [],
      ...extra,
    },
    gap: null,
    receipt: "beleg-fiktiv",
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function neuerCache(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: KONTO, role: "experte" });
  return client;
}

interface Flaeche {
  container: HTMLElement;
  abbauen: () => void;
}

async function oeffnen(client: QueryClient): Promise<Flaeche> {
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
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function feld(f: Flaeche): HTMLInputElement {
  const el = f.container.querySelector<HTMLInputElement>("form input");
  expect(el, "Eingabefeld nicht gefunden").toBeTruthy();
  return el as HTMLInputElement;
}

function sendeknopf(f: Flaeche): HTMLButtonElement {
  const el = f.container.querySelector<HTMLButtonElement>('form button[type="submit"]');
  expect(el, "Sendeknopf nicht gefunden").toBeTruthy();
  return el as HTMLButtonElement;
}

function teil(f: Flaeche, testId: string): HTMLElement | null {
  return f.container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

async function tippen(f: Flaeche, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld(f), text);
    feld(f).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function absenden(f: Flaeche): Promise<void> {
  await act(async () => {
    f.container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

async function klicken(el: Element | null): Promise<void> {
  expect(el, "Bedienelement fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

function knopfMitText(f: Flaeche, wurzel: HTMLElement | null, text: string): HTMLElement | null {
  const bereich = wurzel ?? f.container;
  return (
    [...bereich.querySelectorAll<HTMLElement>("button")].find((b) =>
      (b.textContent ?? "").includes(text),
    ) ?? null
  );
}

const anfragen = (): number => vi.mocked(endpoints.ask.ask).mock.calls.length;

beforeEach(async () => {
  localStorage.clear();
  steuer.status = { ...MODELL };
  steuer.antworten.length = 0;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("F1 · Status nicht erreichbar → Arbeit bleibt, Erholung ohne Neuladen", () => {
  it("Störungssatz, Sperre, Wege ohne KI, Wiederaufnahme und Erholung", async () => {
    steuer.status = { ...MODELL, reachable: "unreachable" };
    const client = neuerCache();
    const f = await oeffnen(client);
    await tippen(f, FRAGE);

    // PV-03-01: die tatsächliche Lage, nicht „kein Modell aktiv".
    expect(f.container.textContent).toContain(i18n.t("kiausfall.status.nichtErreichbar"));
    expect(f.container.textContent).not.toContain(i18n.t("ai.unavailable.hint"));
    expect(sendeknopf(f).disabled).toBe(true);
    // PV-03-02: Bestand und Erfassen bleiben als Weg da.
    expect(teil(f, "ask-ai-alternative")).not.toBeNull();
    expect(anfragen(), "trotz Sperre ging eine Frage hinaus").toBe(0);

    // PV-03-03: Navigation weg und zurück — die Frage kommt aus dem Arbeitsstand dieses Kontos.
    f.abbauen();
    const g = await oeffnen(client);
    expect(feld(g).value).toBe(FRAGE);
    expect(teil(g, "ask-wiederaufnahme")).not.toBeNull();

    // PV-03-07: Erholung — der Dienst antwortet wieder, der Status wird auf Wunsch neu gelesen.
    steuer.status = { ...MODELL };
    await klicken(teil(g, "ask-ki-status-erneut"));
    expect(g.container.textContent).not.toContain(i18n.t("kiausfall.status.nichtErreichbar"));
    expect(sendeknopf(g).disabled).toBe(false);
    expect(feld(g).value, "die Frage ging bei der Erholung verloren").toBe(FRAGE);

    steuer.antworten.push(() => antwort());
    await absenden(g);
    expect(teil(g, "ask-answer")).not.toBeNull();
    expect(anfragen()).toBe(1);
    g.abbauen();
  });
});

describe("F2 · Kapazität ausgeschöpft → Ursache, Speicherort, Wiederholen ohne Doppelanfrage", () => {
  it("benannte Ursache, Frage bleibt, Speicherort nachgelesen, keine zweite Anfrage im Lauf", async () => {
    const f = await oeffnen(neuerCache());
    await tippen(f, FRAGE);
    steuer.antworten.push(() => {
      throw new ApiError(
        503,
        "MODEL_BUSY",
        "KI-Modell derzeit ausgelastet. Bitte in Kürze erneut versuchen.",
      );
    });
    await absenden(f);

    const kasten = teil(f, "ask-error");
    expect(kasten).not.toBeNull();
    expect(teil(f, "ask-ki-kapazitaet")?.textContent).toContain(
      i18n.t("kiausfall.fehler.kapazitaet.titel"),
    );
    expect(kasten?.textContent ?? "").not.toContain(i18n.t("ask.error.body"));
    expect(feld(f).value).toBe(FRAGE);
    const ort = teil(f, "ask-entwurf-speicherort");
    expect(ort?.getAttribute("data-ort")).toBe("browser");
    expect(ort?.textContent).toBe(i18n.t("kiausfall.entwurf.browser"));
    expect(teil(f, "ask-fehler-manuell")).not.toBeNull();

    // PV-03-05: der zweite Versuch läuft — ein erneutes Absenden währenddessen geht nicht hinaus.
    let aufloesen: (wert: unknown) => void = () => undefined;
    steuer.antworten.push(
      () =>
        new Promise((r) => {
          aufloesen = r;
        }),
    );
    await klicken(knopfMitText(f, kasten, i18n.t("ask.error.retry")));
    expect(anfragen()).toBe(2);
    await absenden(f);
    expect(anfragen(), "während des laufenden Versuchs ging eine zweite Anfrage hinaus").toBe(2);
    await act(async () => {
      aufloesen(antwort());
      await flush();
    });
    expect(teil(f, "ask-answer")).not.toBeNull();
    expect(teil(f, "ask-error")).toBeNull();
    f.abbauen();
  });
});

describe("F3 · verweigerte Verarbeitung", () => {
  it("eigene Ursache und KEIN „Erneut versuchen“", async () => {
    const f = await oeffnen(neuerCache());
    await tippen(f, FRAGE);
    steuer.antworten.push(() => {
      throw new ApiError(409, "KLARA_AUSWEICHWEG_GESPERRT", "gesperrt");
    });
    await absenden(f);
    expect(teil(f, "ask-ki-verweigert")?.textContent).toContain(
      i18n.t("kiausfall.fehler.verweigert.titel"),
    );
    expect(teil(f, "ask-error")?.textContent ?? "").not.toContain(i18n.t("ask.error.retry"));
    expect(feld(f).value).toBe(FRAGE);
    f.abbauen();
  });
});

describe("F4 · Ersatz nach Modellausfall", () => {
  it("die Ursache steht an der Antwort; eine Modellantwort danach trägt keine", async () => {
    const f = await oeffnen(neuerCache());
    await tippen(f, FRAGE);
    steuer.antworten.push(() => antwort({ demo: true, ersatzGrund: "zeitueberschreitung" }));
    await absenden(f);
    expect(teil(f, "ask-answer")).not.toBeNull();
    const satz = teil(f, "ask-ersatz-grund");
    expect(satz?.textContent).toBe(i18n.t("kiausfall.ersatz.zeitueberschreitung"));
    expect(satz?.getAttribute("data-grund")).toBe("zeitueberschreitung");

    await tippen(f, `${FRAGE} Und das Ventil V5?`);
    steuer.antworten.push(() => antwort());
    await absenden(f);
    expect(teil(f, "ask-answer")).not.toBeNull();
    expect(teil(f, "ask-ersatz-grund")).toBeNull();
    f.abbauen();
  });
});

describe("F4b · Ersatz nach Modellausfall OHNE Antwort (Ben nacharbeit-2)", () => {
  it("die Ursache steht da, aber „keine Antwort“ statt „beantwortet“ — mit offenem Weiterweg", async () => {
    const f = await oeffnen(neuerCache());
    await tippen(f, FRAGE);
    steuer.antworten.push(() => ({
      result: {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: true,
        captionSources: [],
        ersatzGrund: "zeitueberschreitung",
      },
      gap: { id: "luecke-fiktiv-1" },
      receipt: "beleg-fiktiv",
    }));
    await absenden(f);
    expect(teil(f, "ask-answer"), "ohne Antwort steht eine Antwortkarte").toBeNull();
    const satz = teil(f, "ask-ersatz-grund");
    expect(satz?.getAttribute("data-beantwortet")).toBe("0");
    expect(satz?.textContent).toContain(i18n.t("kiausfall.ohneAntwort.zeitueberschreitung"));
    expect(satz?.textContent).not.toContain(i18n.t("kiausfall.ersatz.zeitueberschreitung"));
    expect(satz?.textContent ?? "").not.toContain("Ohne KI beantwortet");
    // Der offene Bearbeitungsweg steht im selben Satz: Bestand durchsuchen, Wissen erfassen.
    const weg = teil(f, "ask-ersatz-weiterweg");
    expect(weg?.textContent).toContain(i18n.t("ask.aiUnavailable.toLibrary"));
    expect(weg?.textContent).toContain(i18n.t("ask.aiUnavailable.toCapture"));
    f.abbauen();
  });
});

describe("F5 · Netzfehler des Abrufs ist kein belegter KI-Ausfall", () => {
  it("allgemeiner Satz, keine KI-Wege behauptet, Speicherort ehrlich", async () => {
    const f = await oeffnen(neuerCache());
    await tippen(f, FRAGE);
    steuer.antworten.push(() => {
      throw new TypeError("Failed to fetch");
    });
    await absenden(f);
    expect(teil(f, "ask-error")?.textContent).toContain(i18n.t("ask.error.body"));
    expect(teil(f, "ask-fehler-manuell")).toBeNull();
    expect(teil(f, "ask-entwurf-speicherort")?.getAttribute("data-ort")).toBe("browser");
    f.abbauen();
  });
});
