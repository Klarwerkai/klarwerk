// @vitest-environment jsdom
// ================================================================================================
// JOB 2610 · D4 — KEINE DATEIZUSAGE OHNE DATEIWEG.
// ================================================================================================
//
// DIE ABNAHME (Auftrag §3): „Ein Mensch sieht auf der Fronttuer einen Hinweis, der stimmt — er
// kann tun, was dort steht, und es funktioniert."
//
// DER BEFUND, gemessen: Unter dem Schreibfeld der Fronttuer steht
//
//     „Bilder hierher ziehen oder einfuegen (Strg/⌘+V). Dateien bleiben Beleg/Evidence."
//
// Der zweite Satz ist dort FALSCH. Die Fronttuer nimmt keine Dateien an: Sie reicht dem Editor
// weder `onAttachFiles` noch `files`, und deshalb blendet der Editor den Datei-Knopf korrekt aus
// (`editorFileButtonVisible`). Nur der SATZ war unbedingt — er sagte etwas zu, wofuer es auf
// dieser Flaeche keinen Weg gibt.
//
// WARUM NICHT EINFACH DEN GANZEN SATZ WEG: Die erste Haelfte ist auf der Fronttuer WAHR und dort
// die einzige Bildfuehrung — Bilder lassen sich ziehen und einfuegen. Wer den Satz als Ganzes
// ausblendet, kauft Ehrlichkeit mit dem Verlust einer wahren Auskunft. Deshalb ein zweiter
// Schluessel mit nur der Bildzeile.
//
// WAS DIESER TEST NICHT IST: eine Pruefung „ein Hinweis erscheint". Genau die haette D1
// durchgehen lassen. Er prueft den GERENDERTEN Satz Zeichen fuer Zeichen und beide Richtungen —
// ohne Dateiweg darf die Zusage NICHT dastehen, mit Dateiweg MUSS sie dastehen.
//
// HERKUNFT: In D3 lief dieser Vertrag als Sonde gegen eine Arbeitsspur-Kopie und war damit,
// wie BEN zu Recht befand, ein Scheinbeleg fuer den ausgelieferten Stand. D4 baut die Korrektur
// in den gebundenen Produktstand ein; derselbe Vertrag misst hier den echten Integrationsstand.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    validation: { settings: ok({ defaultNeededValidations: 3 }) },
    external: { policy: vi.fn(async () => ({ stage: "off" })), search: vi.fn(async () => []) },
    uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
    directory: { list: arrFn() },
    gaps: { list: arrFn() },
    drafts: {
      list: arrFn(),
      get: vi.fn(async () => ({ id: "d1", payload: {} })),
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => {}),
      promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
    },
    reasoner: {
      status: ok({ active: true, mode: "cloud", reachable: "active" }),
      config: ok(null),
      structure: vi.fn(async () => ({})),
      interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      assist: vi.fn(async () => ({ text: "" })),
      describeImage: vi.fn(async () => ({ text: "", demo: false })),
    },
    notifications: { list: arrFn(), markSeen: vi.fn(async () => ({})) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
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
import { Capture } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Die Dateizusage im Wortlaut — der Teilsatz, der ohne Dateiweg nicht dastehen darf. */
const DATEIZUSAGE = "Dateien bleiben Beleg/Evidence";
/** Die Bildfuehrung — sie ist auf BEIDEN Flaechen wahr und muss BEIDE Male dastehen. */
const BILDFUEHRUNG = "Bilder hierher ziehen oder einfügen";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string, seite: "fronttuer" | "erfassen"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
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
                        path: url.split("?")[0] as string,
                        element: createElement(seite === "fronttuer" ? CaptureFrontDoor : Capture),
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

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** Der Datei-Knopf — an seinem eigenen `title` erkannt, nicht an Klassen. */
function dateiKnopf(): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("title") === i18n.t("editor.file"),
    ) ?? null
  );
}

function knopf(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

/** Der Weg zum Editor auf /erfassen — drei Klicks, wie ihn ein Mensch geht. */
async function zumEditor(): Promise<void> {
  await act(async () => {
    knopf("Weitere Wege anzeigen").click();
    await flush();
  });
  await act(async () => {
    knopf(i18n.t("capture.advanced.title")).click();
    await flush();
  });
  await act(async () => {
    knopf("Expertenmodus: Formular direkt ausf").click();
    await flush();
  });
}

function editorDa(): boolean {
  return container.querySelector('[role="textbox"]') !== null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2610 D4 · keine Dateizusage ohne Dateiweg", () => {
  it("H0 · KALIBRIERUNG: beide Flaechen montieren ihren Editor wirklich", async () => {
    // Ohne diesen Fall koennte H1 gruen sein, WEIL nichts gerendert wird — der Scheinbeleg,
    // gegen den es diesen Test gibt.
    await mount("/capture/frontdoor", "fronttuer");
    expect(editorDa(), "Fronttuer ohne Editor").toBe(true);
    act(() => root.unmount());
    container.remove();

    await mount("/erfassen", "erfassen");
    await zumEditor();
    expect(editorDa(), "Erfassen ohne Editor").toBe(true);
  });

  it("H1 · FRONTTUER ohne Dateiweg: kein Knopf UND keine Dateizusage", async () => {
    await mount("/capture/frontdoor", "fronttuer");

    // Der Knopf war schon immer richtig — er haengt an `editorFileButtonVisible`.
    expect(dateiKnopf(), "ein Datei-Knopf ohne Dateiweg").toBeNull();
    // DER KERN: der Satz haengt jetzt an derselben Bedingung.
    expect(text(), "die Dateizusage steht auf einer Flaeche ohne Dateiannahme").not.toContain(
      DATEIZUSAGE,
    );
    // UND die wahre Haelfte bleibt: Bilder gehen hier wirklich.
    expect(text(), "die Bildfuehrung ist mit weggefallen").toContain(BILDFUEHRUNG);
  });

  it("H2 · GEGENFALL /erfassen MIT Dateiweg: Knopf UND Zusage bleiben", async () => {
    await mount("/erfassen", "erfassen");
    await zumEditor();

    // Hier ist die Zusage WAHR — Capture reicht `onAttachFiles`.
    expect(dateiKnopf(), "der Datei-Knopf fehlt, wo er hingehoert").not.toBeNull();
    expect(text(), "die zutreffende Zusage ist verschwunden").toContain(DATEIZUSAGE);
    expect(text()).toContain(BILDFUEHRUNG);
  });

  it("H3 · WAECHTER: Knopf und Satz haengen an DERSELBEN Bedingung", async () => {
    // Der eigentliche Fehler war nicht der Satz, sondern dass er eine EIGENE (fehlende) Bedingung
    // hatte. Dieser Fall haelt die Kopplung fest: Auf keiner Flaeche darf das eine ohne das
    // andere stehen. Er wuerde rot, wenn jemand nur eine der beiden Stellen aendert.
    await mount("/capture/frontdoor", "fronttuer");
    const fronttuer = { knopf: dateiKnopf() !== null, zusage: text().includes(DATEIZUSAGE) };
    act(() => root.unmount());
    container.remove();

    await mount("/erfassen", "erfassen");
    await zumEditor();
    const erfassen = { knopf: dateiKnopf() !== null, zusage: text().includes(DATEIZUSAGE) };

    expect(fronttuer.knopf).toBe(fronttuer.zusage);
    expect(erfassen.knopf).toBe(erfassen.zusage);
    // Und die beiden Flaechen unterscheiden sich wirklich — sonst pruefte H3 nichts.
    expect(fronttuer.knopf).toBe(false);
    expect(erfassen.knopf).toBe(true);
  });
});
