// @vitest-environment jsdom
// ================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL (produkt:20261007:arbeitswege-objekt) — DIE PRÜFFLÄCHE.
// ================================================================================================
//
// Gemessen an der ECHTEN Prüffläche (`pages/Validation.tsx`) mit der echten Kette
// `endpoints.validation.board` → react-query → Warteschlange und Karte (dieselbe Kulisse wie
// `tests/pruefen-listennavigation`). Fiktive Testdaten, keine Zugangsdaten.
//
//   K1 · `/validierung?ko=<eigener Beitrag>` öffnet GENAU diesen Beitrag — auch wenn er in der
//        Prüfreihenfolge zuletzt steht (Gegenprobe: ohne `ko` führt der erste, fremde).
//   K2 · nach einer Rückfrage stehen der entschiedene Beitrag, sein Stand laut Server und der
//        Weg dorthin da; die Auswahl wechselt sichtbar und in der Adresse auf den nächsten.
//   K4 · „Zurücksetzen" im Filter-Menü nimmt die Filter zurück, nicht den Suchtext.
//   K5 · die Adresse trägt Kennung und Fassung des GEZEIGTEN Beitrags (auch bei automatischer
//        Erstwahl); Klara nennt denselben; ein „Neuladen" derselben Adresse zeigt denselben
//        Beitrag; ein Wechsel von `ko` bei montierter Seite (A → B, Zurück, Vorwärts) wählt mit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).rolleMock(o as never),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).toastMock(o as never),
);

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { ValidationBoardKo } from "../../apps/web/src/api/types";
import { ModalBoundaryProvider } from "../../apps/web/src/app/ModalBoundaryContext";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";
import { KARTE, flush, kartenTitel, zeilen } from "../pruefen-listennavigation/kulisse";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Fn = ReturnType<typeof vi.fn>;

// Fünf fremde Beiträge vor dem eigenen: „Z …" sortiert in der Prüfreihenfolge ZULETZT (kulisse:
// gleiche Signale, Reihenfolge nach Titel) — genau die Lage, in der der alte Weg fremd öffnete.
const TITEL = ["A Pumpe", "B Ventil", "C Filter", "D Lager", "E Dichtung", "Z Eigener Beitrag"];
const EIGEN = "k6";

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-testid": "test-adresse" }, `${ort.pathname}${ort.search}`);
}

/** Der Router-Griff der Montage: navigieren, ohne die Prüffläche abzubauen (Nacharbeit 3). */
let navigiere: NavigateFunction | null = null;
function Steuer(): null {
  navigiere = useNavigate();
  return null;
}

interface Montage {
  container: HTMLDivElement;
  qc: QueryClient;
  abbauen: () => void;
}
let montage: Montage | null = null;

async function montiere(startadresse: string, bestand: ValidationBoardKo[]): Promise<Montage> {
  await i18n.changeLanguage("de");
  (endpoints.validation.board as unknown as Fn).mockResolvedValue(bestand as never);
  (endpoints.directory.list as unknown as Fn).mockResolvedValue([
    { id: "u9", name: "Erfasser" },
  ] as never);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [startadresse] },
          createElement(Adresse),
          createElement(Steuer),
          createElement(ModalBoundaryProvider, {
            hostRef: { current: container },
            children: createElement(Validation),
          }),
          // Klara steht wie in der Hülle NEBEN der Seite und liest denselben Ort.
          createElement(KlaraAssistant),
        ),
      ),
    );
  });
  for (let i = 0; i < 10 && container.querySelectorAll(KARTE).length === 0; i += 1) {
    await flush();
  }
  await flush();
  return {
    container,
    qc,
    abbauen: () => {
      act(() => root.unmount());
      qc.clear();
      container.remove();
    },
  };
}

/** Der Titel, den die Karte rechts zeigt — die Antwort, die der Mensch sieht. */
function titel(): string | null {
  return kartenTitel({ container: (montage as Montage).container } as never);
}
const EINTRAG = '[data-testid="pruefen-warteschlange-eintrag"]';
function eintraegeText(): string[] {
  const knoepfe = (montage as Montage).container.querySelectorAll(EINTRAG);
  return [...knoepfe].map((e) => e.textContent?.trim() ?? "");
}
/** Was Klara gerade als Beitrag nennt: Kennung und Fassung, oder `null` ohne Bezug. */
async function klaraBezug(): Promise<{ ko: string | null; fassung: string | null } | null> {
  const m = montage as Montage;
  if (!m.container.querySelector("section[data-klara='1']")) {
    await klick(m.container.querySelector("button[data-klara='1']"));
  }
  const block = m.container.querySelector('[data-testid="klara-objektbezug"]');
  return block
    ? { ko: block.getAttribute("data-ko"), fassung: block.getAttribute("data-fassung") }
    : null;
}
async function geheZu(ziel: string | number): Promise<void> {
  await act(async () => {
    if (typeof ziel === "number") {
      navigiere?.(ziel);
    } else {
      navigiere?.(ziel);
    }
  });
  await flush();
  await flush();
}
/** Die Board-Antwort NACH einer Rückfrage am eigenen Beitrag: er bleibt, mit einer Gegenstimme. */
function mitRueckfrage(k: ValidationBoardKo): ValidationBoardKo {
  return k.id === EIGEN ? { ...k, reviewVotes: { up: 0, warn: 1, down: 0 } } : k;
}
const adresse = (): string =>
  montage?.container.querySelector('[data-testid="test-adresse"]')?.textContent ?? "";
const abfrage = (): URLSearchParams => new URLSearchParams(adresse().split("?")[1] ?? "");
const element = (sel: string): HTMLElement | null =>
  montage?.container.querySelector<HTMLElement>(sel) ?? null;

async function klick(el: Element | null): Promise<void> {
  expect(el, "Bedienelement fehlt").toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await flush();
  await flush();
}

async function tippe(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  text: string,
): Promise<void> {
  expect(el, "Eingabefeld fehlt").toBeTruthy();
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setzer = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  await act(async () => {
    setzer?.call(el, text);
    (el as HTMLElement).dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => {
  montage?.abbauen();
  montage = null;
});

describe("K1 · Einreichen → Prüfung desselben Beitrags, unabhängig von der Reihenfolge", () => {
  it("Gegenprobe: ohne Bezug führt der erste Eintrag — und Adresse wie Klara nennen GENAU ihn", async () => {
    montage = await montiere("/validierung?origin=non-demo", zeilen(TITEL));
    expect(titel()).toBe("A Pumpe");
    // Nacharbeit 3 (bens Befund): auch die automatische Erstwahl ist der gemeinsame Bezug — die
    // Adresse trägt den gezeigten Beitrag samt Fassung, Klara nennt denselben.
    expect(abfrage().get("ko")).toBe("k1");
    expect(abfrage().get("fassung")).toBe("1");
    expect(abfrage().get("origin")).toBe("non-demo");
    expect(await klaraBezug()).toEqual({ ko: "k1", fassung: "1" });
  });

  it("mit `ko=<eigener Beitrag>` steht rechts der eigene Beitrag und links ist er gewählt", async () => {
    montage = await montiere(`/validierung?origin=non-demo&ko=${EIGEN}`, zeilen(TITEL));
    expect(titel()).toBe("Z Eigener Beitrag");
    const gewaehlt = element(`${EINTRAG}[aria-current="true"]`);
    expect(gewaehlt?.textContent?.trim()).toBe("Z Eigener Beitrag");
    expect(element('[data-testid="pruefen-objekt-fehlt"]')).toBeNull();
    // K5: die Adresse nennt jetzt auch die Fassung — Ansichtsparameter bleiben stehen.
    expect(abfrage().get("ko")).toBe(EIGEN);
    expect(abfrage().get("fassung")).toBe("1");
    expect(abfrage().get("origin")).toBe("non-demo");
  });

  it("nach „Neuladen“ derselben Adresse steht derselbe Beitrag da (K5)", async () => {
    montage = await montiere(`/validierung?ko=${EIGEN}`, zeilen(TITEL));
    const nachErstemAufbau = adresse();
    montage.abbauen();
    montage = await montiere(nachErstemAufbau, zeilen(TITEL));
    expect(titel()).toBe("Z Eigener Beitrag");
    expect(adresse()).toBe(nachErstemAufbau);
  });

  it("ein Beitrag, der hier nicht offen steht, wird offen benannt — nicht still ersetzt", async () => {
    montage = await montiere("/validierung?ko=gibt-es-hier-nicht", zeilen(TITEL));
    const hinweis = element('[data-testid="pruefen-objekt-fehlt"]');
    expect(hinweis?.getAttribute("data-ko")).toBe("gibt-es-hier-nicht");
    expect(hinweis?.textContent).toContain(String(i18n.t("arbeitsweg.pruefen.fehlt")));
    expect(hinweis?.querySelector("a")?.getAttribute("href")).toBe("/wissen/gibt-es-hier-nicht");
    // Die Adresse behält den angeforderten Beitrag — er wird nicht mit dem fremden überschrieben.
    expect(abfrage().get("ko")).toBe("gibt-es-hier-nicht");
    // Nacharbeit 3: KEINE fremde Prüfkarte an seiner Stelle, kein fremder Eintrag als gewählt —
    // und Klara nennt den verlangten Beitrag, den auch die Zeile nennt.
    expect((montage as Montage).container.querySelectorAll(KARTE)).toHaveLength(0);
    expect(element(`${EINTRAG}[aria-current="true"]`)).toBeNull();
    expect(eintraegeText()).toHaveLength(TITEL.length);
    expect((await klaraBezug())?.ko).toBe("gibt-es-hier-nicht");

    // Ein Klick auf einen Eintrag beendet die Lage: Karte, Adresse und Klara folgen ihm.
    await klick(element(EINTRAG));
    expect(titel()).toBe("A Pumpe");
    expect(element('[data-testid="pruefen-objekt-fehlt"]')).toBeNull();
    expect(abfrage().get("ko")).toBe("k1");
    expect((await klaraBezug())?.ko).toBe("k1");
  });

  it("Navigation bei montierter Seite: ko A → B wählt B, Zurück wählt wieder A (K5)", async () => {
    montage = await montiere("/validierung?ko=k2", zeilen(TITEL));
    expect(titel()).toBe("B Ventil");
    expect(abfrage().get("ko")).toBe("k2");

    // Dieselbe Montage, neue Adresse — wie ein Link aus Klara, Fragen oder dem Einreichen.
    await geheZu("/validierung?ko=k5");
    expect(titel()).toBe("E Dichtung");
    expect(element(`${EINTRAG}[aria-current="true"]`)?.textContent?.trim()).toBe("E Dichtung");
    // Die Adresse wird NICHT auf die alte Wahl zurückgeschrieben.
    expect(abfrage().get("ko")).toBe("k5");
    expect(abfrage().get("fassung")).toBe("1");
    expect((await klaraBezug())?.ko).toBe("k5");

    await geheZu(-1);
    expect(titel()).toBe("B Ventil");
    expect(abfrage().get("ko")).toBe("k2");
    expect((await klaraBezug())?.ko).toBe("k2");

    await geheZu(1);
    expect(titel()).toBe("E Dichtung");
    expect(abfrage().get("ko")).toBe("k5");
  });

  it("kommt der Beitrag mit dem nächsten Abruf, wird er von selbst gewählt", async () => {
    // Die Lage direkt nach dem Einreichen: die Liste im Zwischenspeicher kennt den neuen Beitrag
    // noch nicht. Der alte Weg zeigte hier still den ersten, fremden.
    const ohneEigenen = zeilen(TITEL).filter((k) => k.id !== EIGEN);
    montage = await montiere(`/validierung?ko=${EIGEN}`, ohneEigenen);
    expect(element('[data-testid="pruefen-objekt-fehlt"]')).not.toBeNull();
    expect(abfrage().get("ko")).toBe(EIGEN);

    // Die nächste Antwort des Servers enthält ihn — dieselbe Auffrischung wie jede andere.
    (endpoints.validation.board as unknown as Fn).mockResolvedValue(zeilen(TITEL) as never);
    await act(async () => {
      await (montage as Montage).qc.invalidateQueries({ queryKey: ["validation", "board"] });
    });
    await flush();
    await flush();
    expect(element('[data-testid="pruefen-objekt-fehlt"]')).toBeNull();
    expect(titel()).toBe("Z Eigener Beitrag");
    expect(abfrage().get("ko")).toBe(EIGEN);
  });
});

describe("K2 · nach der Rückfrage: Ergebnis erreichbar, nächster Beitrag nachvollziehbar", () => {
  async function rueckfrageAmEigenen(nachher: ValidationBoardKo[]): Promise<void> {
    montage = await montiere(`/validierung?ko=${EIGEN}`, zeilen(TITEL));
    expect(titel()).toBe("Z Eigener Beitrag");
    (endpoints.validation.board as unknown as Fn).mockResolvedValue(nachher as never);
    await klick(element('[data-testid="pruefen-entscheidung-warn"]'));
    await tippe(
      element('[data-testid="pruefen-begruendung"] textarea') as HTMLTextAreaElement,
      "Bitte die Messstelle ergänzen.",
    );
    // Der letzte Knopf im Begründungsfeld ist „Senden" (davor „Abbrechen").
    const knoepfe = (montage as Montage).container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="pruefen-begruendung"] button',
    );
    await klick(knoepfe[knoepfe.length - 1] ?? null);
    for (let i = 0; i < 6; i += 1) {
      await flush();
    }
  }

  it("bleibt der Beitrag in Prüfung, nennt die Zeile seinen Serverstand; die Auswahl wechselt", async () => {
    await rueckfrageAmEigenen(zeilen(TITEL).map(mitRueckfrage));

    const entschieden = (endpoints.ko.act as unknown as Fn).mock.calls.map((c) => c[0]);
    expect(new Set(entschieden), "entschieden wurde der eigene Beitrag").toEqual(new Set([EIGEN]));

    const zeile = element('[data-testid="pruefen-entschieden"]');
    expect(zeile?.getAttribute("data-ko")).toBe(EIGEN);
    expect(zeile?.getAttribute("data-verdict")).toBe("warn");
    expect(zeile?.textContent).toContain("Z Eigener Beitrag");
    // Das tatsächliche Ergebnis: die Board-Antwort NACH der Entscheidung.
    expect(zeile?.getAttribute("data-stand")).toBe("offen");
    expect(element('[data-testid="pruefen-entschieden-stand"]')?.textContent).toBe(
      String(i18n.t("arbeitsweg.pruefen.standOffen", { gruen: 0, noetig: 3 })),
    );
    // Der eigene Beitrag bleibt erreichbar …
    expect(element('[data-testid="pruefen-entschieden-oeffnen"]')?.getAttribute("href")).toBe(
      `/wissen/${EIGEN}`,
    );
    // … und der Wechsel ist benannt — Zeile, Karte und Adresse sagen dasselbe.
    const weiter = element('[data-testid="pruefen-entschieden-weiter"]');
    expect(weiter?.getAttribute("data-ko")).toBe("k5");
    expect(weiter?.textContent).toContain("E Dichtung");
    expect(titel()).toBe("E Dichtung");
    expect(abfrage().get("ko")).toBe("k5");
  });

  it("verlässt der Beitrag die Prüfliste, sagt die Zeile genau das", async () => {
    await rueckfrageAmEigenen(zeilen(TITEL).filter((k) => k.id !== EIGEN));
    const zeile = element('[data-testid="pruefen-entschieden"]');
    expect(zeile?.getAttribute("data-ko")).toBe(EIGEN);
    expect(zeile?.getAttribute("data-stand")).toBe("raus");
    expect(element('[data-testid="pruefen-entschieden-stand"]')?.textContent).toBe(
      String(i18n.t("arbeitsweg.pruefen.standRaus")),
    );
    expect(element('[data-testid="pruefen-objekt-fehlt"]')).toBeNull();
  });
});

describe("K4 · „Zurücksetzen“ im Filter-Menü behält den Suchtext", () => {
  it("Filter gehen, der sichtbare Suchtext bleibt und wirkt weiter", async () => {
    // „Mir zugewiesen" aus der Adresse: niemandem ist hier etwas zugewiesen → leere Liste.
    montage = await montiere("/validierung?mine=1", zeilen(TITEL));
    expect(eintraegeText()).toEqual([]);
    await klick(element('[data-testid="pruefen-menue-filter"]'));
    const feld = (): HTMLInputElement | null =>
      (montage as Montage).container.querySelector<HTMLInputElement>(
        `input[placeholder="${String(i18n.t("pruefboard.volltextFiltern"))}"]`,
      );
    await tippe(feld(), "Dichtung");

    await klick(element('[data-testid="pruefen-filter-reset"]'));
    if (!feld()) {
      // Schliesst das Menü beim Zurücksetzen, wird es zum Ablesen wieder geöffnet.
      await klick(element('[data-testid="pruefen-menue-filter"]'));
    }
    // Der Filter ist weg (Adresse UND Liste) …
    expect(abfrage().get("mine")).toBeNull();
    // … der Suchtext steht weiter im Feld und grenzt weiter ein.
    expect(feld()?.value).toBe("Dichtung");
    expect(eintraegeText()).toEqual(["E Dichtung"]);
  });
});
