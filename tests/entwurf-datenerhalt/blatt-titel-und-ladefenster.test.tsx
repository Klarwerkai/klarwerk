// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG gesamt-entwurf-datenerhalt — DIE RESTE, DIE NACH DEM BESTANDSABGLEICH OFFEN WAREN.
// ================================================================================================
//
// N-0062 · Ein ohne Warnung angenommener Titel bleibt vollständig gespeichert. Gemessen am Basisstand
//          c04ec23: das Titelfeld nimmt jeden Buchstaben an, `deriveFrontDoorTitle` kürzte den
//          GETIPPTEN Titel beim Speichern aber still auf 90 Zeichen. T1 ist dort rot.
// N-0064 · Die vollständige Titelanzeige direkt am Feld — nur, wenn der Titel das einzeilige Feld
//          wirklich überläuft. jsdom kennt kein Layout; die Messwerte des Feldes setzt der Test
//          deshalb selbst (T3/T4), die Messung im Produkt bleibt dieselbe.
// R-1541 · Frühe und geladene Gegenfälle gemeinsam auf Deutsch UND Englisch. Die gemounteten Fälle
//          von JOB 3141 (`tests/cap-p1-fruehe-eingabe`) laufen nur deutsch; E1/E2 fahren denselben
//          Weg in der englischen Oberfläche.
//
// Die Entwurfs-Endpunkte laufen gegen den ECHTEN Dienst (CaptureService + InMemoryDraftRepo),
// derselbe Aufbau wie `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  zaehler: { create: 0, update: 0 },
  seed: async (_p: Record<string, unknown>): Promise<string> => "",
  liste: async (): Promise<{ id: string; payload: Record<string, unknown> }[]> => [],
  gebremst: false,
  aufloesen: null as null | (() => void),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    box.zaehler.create = 0;
    box.zaehler.update = 0;
    box.gebremst = false;
    box.aufloesen = null;
  };
  box.seed = async (p: P) => (await svc.createDraft(p, "u1")).id;
  box.liste = async () => (await svc.listDrafts()) as unknown as { id: string; payload: P }[];
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        get: vi.fn(async (id: string) => {
          if (box.gebremst) {
            await new Promise<void>((res) => {
              box.aufloesen = res;
            });
          }
          return svc.getDraft(id);
        }),
        create: vi.fn(async (p: P) => {
          box.zaehler.create += 1;
          return svc.createDraft(p, "u1");
        }),
        update: vi.fn(async (id: string, p: P) => {
          box.zaehler.update += 1;
          return svc.continueDraft(id, p, "u1");
        }),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
      },
      ko: { list: ok([]) },
      knowledge: { check: ok({ status: "pending" }) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      gaps: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "unknown" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
      },
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
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string): Promise<void> {
  const ziel = document.createElement("div");
  document.body.appendChild(ziel);
  container = ziel;
  const wurzel = createRoot(ziel);
  root = wurzel;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel.render(
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
                        path: "/erfassen",
                        element: createElement(CaptureFrontDoor),
                      }),
                    ),
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

function unmount(): void {
  const wurzel = root;
  if (wurzel) {
    act(() => wurzel.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

function blatt(): HTMLDivElement {
  if (!container) {
    throw new Error("nichts gemountet");
  }
  return container;
}

function titelfeld(): HTMLInputElement {
  const el = blatt().querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  return el;
}

function schreibfeld(): HTMLElement | null {
  const el = blatt().querySelector('[data-testid="blatt-text"] [role="textbox"]');
  return el instanceof HTMLElement ? el : null;
}

function titelVoll(): HTMLElement | null {
  const el = blatt().querySelector('[data-testid="blatt-titel-voll"]');
  return el instanceof HTMLElement ? el : null;
}

function sichernKnopf(): HTMLButtonElement {
  const el = blatt().querySelector('[data-testid="blatt-entwurf-sichern"]');
  if (!(el instanceof HTMLButtonElement)) {
    throw new Error("„Entwurf sichern“ fehlt");
  }
  return el;
}

/** Kontrolliertes React-Feld: über den nativen Setter, wie React es selbst tut. */
async function tippeTitel(text: string): Promise<void> {
  const feld = titelfeld();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function tippeRumpf(html: string): Promise<void> {
  const feld = schreibfeld();
  if (!feld) {
    throw new Error("Schreibfeld nicht gefunden");
  }
  await act(async () => {
    feld.innerHTML = html;
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function sichern(): Promise<void> {
  await act(async () => {
    sichernKnopf().click();
    await flush();
  });
}

/** Die Layoutwerte, die jsdom nicht liefert — am Feld selbst, nicht am Prototyp. */
function feldBreiten(feld: HTMLInputElement, scroll: number, client: number): void {
  Object.defineProperty(feld, "scrollWidth", { configurable: true, get: () => scroll });
  Object.defineProperty(feld, "clientWidth", { configurable: true, get: () => client });
}

/** 132 Zeichen, eindeutig am Ende — die Kürzung auf 90 schnitte „Ende-der-Zeile" ab. */
const LANGER_TITEL =
  "Presse P4 in Halle Nord: Schmierstellen am Exzenter vor jedem Anlauf prüfen, Fettpresse nur mit Sorte EP2 nachfüllen, Ende-der-Zeile";

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("N-0062 · ein angenommener Titel bleibt vollständig gespeichert", () => {
  it("T1: ein langer getippter Titel reist ungekürzt in den Entwurf und kommt beim Wiederöffnen ganz zurück", async () => {
    expect(
      LANGER_TITEL.length,
      "Kalibrierung: der Titel liegt über der alten Grenze",
    ).toBeGreaterThan(90);
    await mount("/erfassen");
    await tippeTitel(LANGER_TITEL);
    // Das Feld hat ihn angenommen — ohne Warnung, ohne Grenze.
    expect(titelfeld().value).toBe(LANGER_TITEL);
    await tippeRumpf("<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>");
    await sichern();

    expect(box.zaehler.create).toBe(1);
    const [entwurf] = await box.liste();
    expect(entwurf?.payload.title, "der gespeicherte Titel wurde gekürzt").toBe(LANGER_TITEL);

    // Normales Wiederöffnen über die Adresse: das Feld trägt den ganzen Titel.
    unmount();
    await mount(`/erfassen?draft=${entwurf?.id}`);
    expect(titelfeld().value).toBe(LANGER_TITEL);
  });

  it("T1b: auch das Aktualisieren eines bestehenden Entwurfs kürzt den Titel nicht", async () => {
    const kennung = await box.seed({
      title: "Kurz",
      statement: "Vor jedem Anlauf die Schmierstellen prüfen.",
      bodyHtml: "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>",
      origin: "frontdoor",
    });
    await mount(`/erfassen?draft=${kennung}`);
    await tippeTitel(LANGER_TITEL);
    await sichern();

    expect(box.zaehler.update).toBe(1);
    const [entwurf] = await box.liste();
    expect(entwurf?.id).toBe(kennung);
    expect(entwurf?.payload.title).toBe(LANGER_TITEL);
  });

  it("T2 (Gegenfall): OHNE getippten Titel wird er weiter aus der ersten Zeile abgeleitet — dort bleibt die Grenze", async () => {
    await mount("/erfassen");
    await tippeRumpf(`<p>${LANGER_TITEL}</p><p>Zweiter Absatz.</p>`);
    await sichern();

    const [entwurf] = await box.liste();
    const titel = String(entwurf?.payload.title);
    expect(titel.length).toBeLessThanOrEqual(90);
    expect(LANGER_TITEL.startsWith(titel)).toBe(true);
    // Und der Text selbst ist unberührt — nur die Ableitung ist begrenzt.
    expect(String(entwurf?.payload.bodyHtml)).toContain("Ende-der-Zeile");
  });
});

describe("N-0064 · der ganze Titel steht direkt am Feld, wenn er nicht hineinpasst", () => {
  it("T3: läuft der Titel über, steht er unter dem Feld vollständig", async () => {
    await mount("/erfassen");
    feldBreiten(titelfeld(), 1400, 676);
    await tippeTitel(LANGER_TITEL);

    const voll = titelVoll();
    expect(voll, "keine vollständige Titelanzeige trotz Überlauf").not.toBeNull();
    expect(voll?.textContent).toBe(LANGER_TITEL);
    // Das Feld bleibt die eine Eingabe; die Anzeige ist kein zweites Feld für Hilfstechnik.
    expect(voll?.getAttribute("aria-hidden")).toBe("true");
    expect(titelfeld().value).toBe(LANGER_TITEL);
  });

  it("T4 (Gegenfall): ein Titel, der ins Feld passt, bekommt keine zweite Zeile — und sie verschwindet beim Kürzen", async () => {
    await mount("/erfassen");
    const feld = titelfeld();
    feldBreiten(feld, 300, 676);
    await tippeTitel("Presse P4 abschmieren");
    expect(titelVoll()).toBeNull();

    feldBreiten(feld, 1400, 676);
    await tippeTitel(LANGER_TITEL);
    expect(titelVoll()).not.toBeNull();

    feldBreiten(feld, 300, 676);
    await tippeTitel("Presse P4");
    expect(titelVoll()).toBeNull();
  });

  it("T5: ein geladener Entwurf mit langem Titel zeigt ihn ebenfalls vollständig", async () => {
    const kennung = await box.seed({
      title: LANGER_TITEL,
      statement: "Vor jedem Anlauf die Schmierstellen prüfen.",
      bodyHtml: "<p>Vor jedem Anlauf die Schmierstellen prüfen.</p>",
      origin: "frontdoor",
    });
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    feldBreiten(titelfeld(), 1400, 676);
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });
    expect(titelfeld().value).toBe(LANGER_TITEL);
    expect(titelVoll()?.textContent).toBe(LANGER_TITEL);
  });
});

describe("R-1541 · frühe und geladene Gegenfälle auch in der englischen Oberfläche", () => {
  const FRUEH = "My early sentence belongs to me.";

  it("E1: im Ladefenster nimmt das Blatt auf Englisch nichts an und nennt den englischen Grund", async () => {
    await i18n.changeLanguage("en");
    const kennung = await box.seed({
      title: "Press P4 lubrication",
      statement: "Check the lubrication points before every start.",
      bodyHtml: "<p>Check the lubrication points before every start.</p>",
      origin: "frontdoor",
    });
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    expect(box.aufloesen, "Ladeversprechen nicht angehalten").not.toBeNull();

    // Früh: keine Schreibfläche, gesperrter Titel, englischer Grund.
    expect(schreibfeld()).toBeNull();
    expect(titelfeld().disabled).toBe(true);
    const grund = blatt().querySelector('[data-testid="blatt-nicht-bereit"]');
    const en = i18n.getResource("en", "translation", "erfassen.laden.nichtBereit") as string;
    const de = i18n.getResource("de", "translation", "erfassen.laden.nichtBereit") as string;
    expect(en).not.toBe(de);
    expect((grund?.textContent ?? "").trim()).toBe(en);
    // Ein früher Einfügeversuch in den Titel findet keinen Empfänger.
    const titel = titelfeld();
    titel.focus();
    expect(document.activeElement).not.toBe(titel);
    expect(blatt().textContent ?? "").not.toContain(FRUEH);

    // Geladen: der Entwurf steht da, der Grund ist weg.
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });
    expect(blatt().querySelector('[data-testid="blatt-nicht-bereit"]')).toBeNull();
    expect(titelfeld().disabled).toBe(false);
    expect(titelfeld().value).toBe("Press P4 lubrication");
    expect(schreibfeld()?.innerHTML).toContain("lubrication points");
  });

  it("E2: nach dem Laden kommt englisch Getipptes an und wird in DENSELBEN Entwurf gesichert", async () => {
    await i18n.changeLanguage("en");
    const kennung = await box.seed({
      title: "Press P4 lubrication",
      statement: "Check the lubrication points before every start.",
      bodyHtml: "<p>Check the lubrication points before every start.</p>",
      origin: "frontdoor",
    });
    box.gebremst = true;
    await mount(`/erfassen?draft=${kennung}`);
    await act(async () => {
      box.aufloesen?.();
      await flush();
    });

    await tippeRumpf(`<p>Check the lubrication points before every start.</p><p>${FRUEH}</p>`);
    await sichern();

    expect(box.zaehler.update).toBe(1);
    expect(box.zaehler.create).toBe(0);
    const alle = await box.liste();
    expect(alle).toHaveLength(1);
    expect(alle[0]?.id).toBe(kennung);
    expect(String(alle[0]?.payload.bodyHtml)).toContain(FRUEH);
    // Die Bestätigungszeile am Blatt spricht Englisch und nennt denselben Entwurf.
    expect(blatt().textContent ?? "").toContain(
      i18n.t("fd.saved.line", { titel: "Press P4 lubrication" }),
    );
  });
});
