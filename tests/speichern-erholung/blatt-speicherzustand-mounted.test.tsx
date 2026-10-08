// @vitest-environment jsdom
// ================================================================================================
// SPEICHERN-ERHOLUNG (Ausbauliste Punkt 6) — DAS BLATT SAGT, WO SEIN SPEICHERN STEHT.
// ================================================================================================
//
// Gemessen an der ECHTEN Vordertür (`CaptureFrontDoor` → `Blatt`), Harness wie
// `tests/capture/job2684-zwei-tabs-mounted.test.tsx`. Ersetzt ist nur der Endpunkt. Der NETZZUSTAND
// ist echt: der `onlineManager` von react-query wird gestellt — dieselbe Quelle, aus der die
// Mutation ihr `isPaused` ableitet und das Blatt (`useNetzOnline`) seinen Onlinezustand liest.
//
//   K1  läuft · wartet auf Verbindung · fehlgeschlagen · gespeichert — vier Lagen, eine Anzeige.
//   K2  ohne Netz bleibt die Eingabe stehen; nach der Rückkehr geht GENAU EIN Aufruf hinaus, und
//       erst seine Quittung heisst „gespeichert". (Das Neuladen misst der Smoke im echten Browser:
//       `tests-smoke/speichern-erholung-browser.spec.ts`.)
//   K3  ein zweiter Klick während des Wartens und ein „Erneut versuchen" nach einem Abriss legen
//       keinen zweiten Entwurf an (derselbe Vorgangsschlüssel); ein Standkonflikt heisst nie
//       „gespeichert" und überschreibt nichts.
//   K4  der Seitenwechsel bietet weiter Bleiben · Verwerfen · Speichern — ohne Netz sagt „Speichern
//       und wechseln" den Grund und wechselt nicht; „Verwerfen" bricht ein wartendes Speichern ab.
//   K6  der Wartesatz behauptet keinen Schutz beim Neuladen, er warnt davor.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gegenstelle = vi.hoisted(() => ({
  update: async (..._args: unknown[]): Promise<unknown> => ({}),
  create: async (..._args: unknown[]): Promise<unknown> => ({}),
  // Der Titel, den der „Server" beim Laden liefert — die Nacharbeit lädt nach dem Speichern neu und
  // stellt dafür genau den Stand ein, den der Schreibaufruf wirklich getragen hat.
  getTitel: "Wartung der Presse",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      get: vi.fn(async () => ({
        id: "d-1",
        payload: {
          title: gegenstelle.getTitel,
          bodyHtml: "<p>Anlage freischalten. Ventil prüfen.</p>",
          confidentiality: "intern",
        },
        originalAuthor: "u1",
        lastEditor: "u1",
        createdAt: "2026-10-07T08:00:00.000Z",
        updatedAt: "2026-10-07T09:00:00.000Z",
      })),
      create: vi.fn((...args: unknown[]) => gegenstelle.create(...args)),
      update: vi.fn((...args: unknown[]) => gegenstelle.update(...args)),
      promote: vi.fn(async () => ({})),
    },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { GuardedLink, NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const updateMock = endpoints.drafts.update as unknown as ReturnType<typeof vi.fn>;
const createMock = endpoints.drafts.create as unknown as ReturnType<typeof vi.fn>;

const WECHSEL = "Zur anderen Seite";
const ANDERE_SEITE = "Andere Seite erreicht";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Ein Versprechen, dessen Ausgang der Fall bestimmt — „die Anfrage ist unterwegs". */
function offen<T>(): { versprechen: Promise<T>; erfuellen: (wert: T) => void } {
  let erfuellen: (wert: T) => void = () => undefined;
  const versprechen = new Promise<T>((r) => {
    erfuellen = r;
  });
  return { versprechen, erfuellen };
}

async function mount(url: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [url] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      // Eine bewachte Navigationsquelle neben dem Blatt — derselbe Baustein, den die
                      // Hülle benutzt (`GuardedLink`), damit der Wechsel durch die Wache läuft.
                      element: createElement(
                        Fragment,
                        null,
                        createElement(GuardedLink, { to: "/anders" }, WECHSEL),
                        createElement(CaptureFrontDoor),
                      ),
                    }),
                    createElement(Route, {
                      path: "/anders",
                      element: createElement("p", null, ANDERE_SEITE),
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
}

async function netz(online: boolean): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(online);
    await flush();
  });
  await act(flush);
}

function anzeige(): HTMLElement {
  const el = container.querySelector('[data-testid="blatt-speicherzustand"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Die Speicheranzeige des Blattes fehlt");
  }
  return el;
}

const zustand = (): string | null => anzeige().getAttribute("data-zustand");
const satz = (): string =>
  container.querySelector('[data-testid="blatt-speicherzustand-satz"]')?.textContent ?? "";

function sichern(): HTMLButtonElement {
  const btn = container.querySelector('[data-testid="blatt-entwurf-sichern"]');
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error("Knopf „Entwurf sichern“ fehlt");
  }
  return btn;
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

async function wechseln(): Promise<void> {
  const link = [...container.querySelectorAll("a")].find((a) => a.textContent === WECHSEL);
  if (!(link instanceof HTMLAnchorElement)) {
    throw new Error("Die bewachte Navigationsquelle fehlt");
  }
  await click(link);
}

function titelFeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld fehlt");
  }
  return el;
}

/** Tippen über den Weg, den React für kontrollierte Felder liest (nativer Setter + `input`). */
async function tippeTitel(wert: string): Promise<void> {
  const feld = titelFeld();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const pageText = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const editorHtml = (): string => container.querySelector("[contenteditable]")?.innerHTML ?? "";
const gesichertZeile = (): Element | null =>
  container.querySelector('[data-testid="blatt-entwurf-gespeichert"]');
const wacheFehler = (): string =>
  container.querySelector("[data-navguard-save-error]")?.textContent ?? "";

const QUITTUNG = {
  id: "d-1",
  payload: { title: "Wartung der Presse" },
  updatedAt: "2026-10-07T09:05:00.000Z",
};

beforeEach(async () => {
  await i18n.changeLanguage("de");
  onlineManager.setOnline(true);
  gegenstelle.getTitel = "Wartung der Presse";
  gegenstelle.update = async () => QUITTUNG;
  gegenstelle.create = async () => ({
    id: "d-neu",
    payload: { title: "Neuer Eintrag" },
    updatedAt: "2026-10-07T09:10:00.000Z",
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("K1 · vier sichtbare Lagen des expliziten Speicherns", () => {
  it("in Ruhe steht die Region leer da; während der Anfrage „läuft“, nach der Quittung „gespeichert“", async () => {
    const anfrage = offen<unknown>();
    gegenstelle.update = () => anfrage.versprechen;
    await mount("/capture/frontdoor?draft=d-1");

    expect(zustand()).toBe("ruhe");
    expect(anzeige().textContent).toBe("");

    await click(sichern());
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(zustand()).toBe("laeuft");
    expect(satz()).toBe(i18n.t("erholung.speichern.laeuft"));
    expect(gesichertZeile()).toBeNull();

    await act(async () => {
      anfrage.erfuellen(QUITTUNG);
      await flush();
    });
    await act(flush);
    expect(zustand()).toBe("gespeichert");
    expect(satz()).toBe(i18n.t("erholung.speichern.gespeichert"));
    expect(gesichertZeile()?.getAttribute("data-entwurf")).toBe("d-1");
  });

  it("ein Abriss heisst „fehlgeschlagen“ — mit dem Weg „Erneut versuchen“, ohne „gespeichert“", async () => {
    gegenstelle.update = async () => {
      throw new TypeError("Failed to fetch");
    };
    await mount("/capture/frontdoor?draft=d-1");
    await click(sichern());
    expect(zustand()).toBe("fehlgeschlagen");
    expect(satz()).toBe(i18n.t("erholung.speichern.fehlgeschlagen"));
    expect(container.querySelector('[data-testid="blatt-erneut"]')).not.toBeNull();
    expect(gesichertZeile()).toBeNull();
    expect(pageText()).not.toContain(i18n.t("fd.toastSaved"));
    expect(editorHtml()).toContain("Ventil prüfen.");
  });
});

describe("K2 · ohne Netz explizit gespeichert: die Eingabe bleibt, der Erfolg kommt erst mit der Quittung", () => {
  it("wartet sichtbar, schickt nichts, behält den Text — und meldet nach der Rückkehr den echten Erfolg", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel("Wartung der Presse (offline ergänzt)");
    await netz(false);

    await click(sichern());
    expect(zustand()).toBe("wartet");
    expect(satz()).toBe(i18n.t("erholung.speichern.wartet"));
    // Ohne Netz geht NICHTS hinaus — und nichts heisst „gespeichert".
    expect(updateMock).not.toHaveBeenCalled();
    expect(gesichertZeile()).toBeNull();
    expect(pageText()).not.toContain(i18n.t("fd.toastSaved"));
    // Die Eingabe steht unverändert da.
    expect(titelFeld().value).toBe("Wartung der Presse (offline ergänzt)");
    expect(editorHtml()).toContain("Ventil prüfen.");

    await netz(true);
    // Nach der Rückkehr GENAU EIN Aufruf, mit dem gesehenen Stand (kein stilles Überschreiben).
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0]?.[1]).toMatchObject({
      title: "Wartung der Presse (offline ergänzt)",
    });
    expect(updateMock.mock.calls[0]?.[2]).toEqual({
      expectedUpdatedAt: "2026-10-07T09:00:00.000Z",
    });
    expect(zustand()).toBe("gespeichert");
    expect(gesichertZeile()?.getAttribute("data-entwurf")).toBe("d-1");
  });

  // ==============================================================================================
  // NACHARBEIT 1 (BEN) — WÄHREND DES WARTENS WEITERGESCHRIEBEN: GESENDET UND BESTÄTIGT IST DERSELBE.
  // ==============================================================================================
  // Befund: Stand A offline gesichert, während des Wartens zu B geändert, Netz zurück. Gesendet
  // wurde B (die laufende Mutation übernahm die neue `mutationFn`), als gesichert galt A — ein
  // Zurückändern auf A zeigte „gespeichert", obwohl der Server B trug. Jetzt muss gelten: was
  // hinausgeht, ist der Klickstand A; B bleibt sichtbar ungespeichert; erst A auf dem Blatt heisst
  // „gespeichert"; und nach dem Neuladen steht A da, weil der Server A trägt.
  it("NA1 · A gesichert, B getippt, Netz zurück: A geht hinaus, B ist ungespeichert, Rückänderung auf A bestätigt, Neuladen zeigt A", async () => {
    const A = "Wartung der Presse (Stand A)";
    const B = "Wartung der Presse (Stand B, während des Wartens)";
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel(A);
    await netz(false);
    await click(sichern());
    expect(zustand()).toBe("wartet");

    await tippeTitel(B);
    expect(zustand()).toBe("wartet");
    await netz(true);

    // Gesendet wurde der eingefrorene Klickstand — nicht, was danach getippt wurde.
    expect(updateMock).toHaveBeenCalledTimes(1);
    const gesendet = updateMock.mock.calls[0]?.[1] as { title?: string } | undefined;
    expect(gesendet?.title).toBe(A);
    // B ist NICHT gespeichert, also bestätigt die Anzeige nichts und der Änderungsschutz greift.
    expect(titelFeld().value).toBe(B);
    expect(zustand()).toBe("ruhe");
    expect(gesichertZeile()).toBeNull();

    // Zurück auf A: das ist genau der Stand, den der Server quittiert hat.
    await tippeTitel(A);
    expect(zustand()).toBe("gespeichert");
    expect(gesichertZeile()?.getAttribute("data-entwurf")).toBe("d-1");

    // Neuladen: der Server liefert, was der Schreibaufruf getragen hat — und das ist A.
    gegenstelle.getTitel = gesendet?.title ?? "";
    act(() => root.unmount());
    container.remove();
    await mount("/capture/frontdoor?draft=d-1");
    expect(titelFeld().value).toBe(A);
    expect(zustand()).toBe("ruhe");
  });

  it("NA2 · GEGENPROBE: B getippt und nicht zurückgeändert — die Anzeige behauptet auch später kein „gespeichert“ für B", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel("Stand A");
    await netz(false);
    await click(sichern());
    await tippeTitel("Stand B");
    await netz(true);
    expect((updateMock.mock.calls[0]?.[1] as { title?: string } | undefined)?.title).toBe(
      "Stand A",
    );
    expect(zustand()).toBe("ruhe");
    // Ein erneutes Sichern schickt jetzt B — und erst dessen Quittung bestätigt B.
    await click(sichern());
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect((updateMock.mock.calls[1]?.[1] as { title?: string } | undefined)?.title).toBe(
      "Stand B",
    );
    expect(zustand()).toBe("gespeichert");
  });

  it("K6 · der Wartesatz warnt vor dem Neuladen — er behauptet keinen Schutz", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await netz(false);
    await click(sichern());
    const hinweis =
      container.querySelector('[data-testid="blatt-speicherzustand-hinweis"]')?.textContent ?? "";
    expect(hinweis).toBe(i18n.t("erholung.speichern.wartetHinweis"));
    expect(hinweis).toContain("nicht neu laden");
    expect(hinweis).not.toMatch(/geschützt|gesichert/);
  });
});

describe("K3 · Wiederholungen ohne Doppelbeitrag, kein unbemerktes Überschreiben", () => {
  it("ein neuer Eintrag: Doppelklick während des Wartens → nach der Rückkehr genau EIN Anlegen", async () => {
    await mount("/capture/frontdoor");
    await tippeTitel("Neuer Eintrag");
    await netz(false);
    await click(sichern());
    expect(zustand()).toBe("wartet");
    expect(sichern().disabled).toBe(true);
    await click(sichern());

    await netz(true);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(zustand()).toBe("gespeichert");
  });

  it("„Erneut versuchen“ nach einem Abriss trägt DENSELBEN Vorgangsschlüssel — der Server legt nichts doppelt an", async () => {
    let versuch = 0;
    gegenstelle.create = async () => {
      versuch += 1;
      if (versuch === 1) {
        throw new TypeError("Failed to fetch");
      }
      return { id: "d-neu", payload: { title: "Neuer Eintrag" }, updatedAt: "2026-10-07T09:10Z" };
    };
    await mount("/capture/frontdoor");
    await tippeTitel("Neuer Eintrag");
    await click(sichern());
    expect(zustand()).toBe("fehlgeschlagen");

    const erneut = container.querySelector('[data-testid="blatt-erneut"]');
    expect(erneut).toBeInstanceOf(HTMLButtonElement);
    await click(erneut as HTMLButtonElement);

    expect(createMock).toHaveBeenCalledTimes(2);
    const erster = createMock.mock.calls[0]?.[1];
    expect(typeof erster).toBe("string");
    expect(createMock.mock.calls[1]?.[1]).toBe(erster);
    expect(zustand()).toBe("gespeichert");
  });

  it("eine neuere fremde Fassung (409 DRAFT_STALE) heisst nie „gespeichert“ — der eigene Text bleibt", async () => {
    gegenstelle.update = async () => {
      throw new ApiError(409, "DRAFT_STALE", "Der Entwurf wurde inzwischen geändert.");
    };
    await mount("/capture/frontdoor?draft=d-1");
    await click(sichern());
    expect(updateMock.mock.calls[0]?.[2]).toEqual({
      expectedUpdatedAt: "2026-10-07T09:00:00.000Z",
    });
    expect(zustand()).toBe("fehlgeschlagen");
    expect(container.textContent ?? "").toContain(i18n.t("fd.draftStale"));
    expect(gesichertZeile()).toBeNull();
    expect(editorHtml()).toContain("Ventil prüfen.");
  });
});

describe("K4 · Seitenwechsel: Bleiben · Verwerfen · Speichern behalten ihre Wirkung", () => {
  it("ohne Netz: „Speichern und wechseln“ nennt den Grund im Dialog und wechselt nicht; „Hier bleiben“ behält die Eingabe", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel("Wartung der Presse (geändert)");
    await netz(false);

    await wechseln();
    expect(buttonByText(i18n.t("nav.guard.stay"))).toBeTruthy();
    expect(buttonByText(i18n.t("nav.guard.discard"))).toBeTruthy();
    await click(buttonByText(i18n.t("nav.guard.save")));

    expect(wacheFehler()).toBe(i18n.t("erholung.speichern.wechselOhneVerbindung"));
    expect(updateMock).not.toHaveBeenCalled();
    expect(pageText()).not.toContain(ANDERE_SEITE);
    // Die beiden anderen Wege bleiben wählbar.
    expect(buttonByText(i18n.t("nav.guard.discard")).disabled).toBe(false);

    await click(buttonByText(i18n.t("nav.guard.stay")));
    expect(container.querySelector("[data-navguard-save-error]")).toBeNull();
    expect(titelFeld().value).toBe("Wartung der Presse (geändert)");
  });

  it("mit Netz: „Speichern und wechseln“ speichert wirklich und wechselt danach", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel("Wartung der Presse (geändert)");
    await wechseln();
    await click(buttonByText(i18n.t("nav.guard.save")));
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(pageText()).toContain(ANDERE_SEITE);
  });

  it("„Verwerfen und wechseln“ während eines wartenden Speicherns: auch nach der Rückkehr wird NICHTS geschrieben", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel("Wartung der Presse (verworfen)");
    await netz(false);
    await click(sichern());
    expect(zustand()).toBe("wartet");

    await wechseln();
    await click(buttonByText(i18n.t("nav.guard.discard")));
    expect(pageText()).toContain(ANDERE_SEITE);

    await netz(true);
    expect(updateMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("„Hier bleiben“ während eines wartenden Speicherns: es wartet weiter und speichert nach der Rückkehr genau einmal", async () => {
    await mount("/capture/frontdoor?draft=d-1");
    await tippeTitel("Wartung der Presse (bleibt)");
    await netz(false);
    await click(sichern());

    await wechseln();
    await click(buttonByText(i18n.t("nav.guard.stay")));
    expect(pageText()).not.toContain(ANDERE_SEITE);
    expect(zustand()).toBe("wartet");

    await netz(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(zustand()).toBe("gespeichert");
  });
});
