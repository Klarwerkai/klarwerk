// @vitest-environment jsdom
// AUFTRAG-mega5 Block A (bens Ship-Gate 1+2, Verlustpfade 3+4): die EHRLICHE GRENZE des
// Speicher-Vertrags am echten Klickpfad. Für Zustände, die saveDraft nicht sichern kann — lokale
// Bilder, angehängte Dateien, eine hochgeladene Datei vor Extraktionsabschluss, die laufende
// Datei-Queue und die geladene Trefferliste der externen Suche — beweist jeder Test: die
// Navigationswache blockiert ehrlich, benennt GENAU DIESEN Inhalt (nicht „irgendeine Warnung"),
// bietet KEIN „Entwurf speichern und wechseln" an, und nur „Hier bleiben" oder bewusstes
// Verwerfen führen weiter.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// jsdom hat keine Canvas-/Image-Pipeline: das Thumbnail schlägt kontrolliert fehl, der ECHTE
// Produktpfad (addImage) fällt dann aufs Original aus dem FileReader zurück — genau wie im Browser
// bei exotischen Bildformaten. Alle übrigen Datei-Helfer bleiben die echten.
vi.mock("../../apps/web/src/lib/files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../apps/web/src/lib/files")>();
  return {
    ...actual,
    fileToThumbDataUrl: vi.fn(async () => {
      throw new Error("no-canvas");
    }),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: {
        policy: ok({ stage: "search_on_click" }),
        search: vi.fn(async () => [
          {
            title: "Dichtungsnorm 4711",
            url: "https://example.org/norm",
            snippet: "Auszug zur Norm",
            provider: "FakeWiki",
          },
        ]),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: ok([]),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        extract: vi.fn(async () => ({
          points: [
            {
              title: "Dosierwert prüfen",
              summary: "Nach Schichtwechsel den Dosierwert kontrollieren.",
              sourceExcerpt: "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.",
            },
          ],
          note: null,
        })),
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
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const nav = { proceeded: false };

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function NavProbe(): JSX.Element {
  const { guard } = useNavGuard();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "navprobe",
      onClick: () =>
        guard(() => {
          nav.proceeded = true;
        }),
    },
    "navprobe",
  );
}

// ==================================================================================================
// JOB 3062 · H3 — DER MODUS KOMMT ALS PROP, WEIL DIE MODUS-LEISTE GELÖSCHT IST.
// ==================================================================================================
// Bis hierher wählte dieser Test den Erzähl-Modus über die Knopfreihe auf `/erfassen`. Die Leiste
// ist mit dem Standardweg-Kasten gelöscht (Auftrag §5); im Produkt wählt der Mensch den Weg im
// Menü „Datei ▾" der Blatt-Werkzeugzeile, und das Blatt reicht ihn als `modus` an den Arbeitsraum.
// Der Test fährt GENAU DIESEN Weg: dieselbe Montage, neuer Prop — React behält den Zustand des
// Arbeitsraums, und `CaptureArbeitsraum` gleicht den Modus über `switchMode` ab (dieselbe Funktion,
// die vorher am Knopf hing).
let h3Modus: "freitext" | "diktat" | "interview" | "datei" | "formular" | undefined;
let h3Zeichnen: (() => Promise<void>) | null = null;

async function waehleModus(
  m: "freitext" | "diktat" | "interview" | "datei" | "formular",
): Promise<void> {
  h3Modus = m;
  if (!h3Zeichnen) {
    throw new Error("waehleModus vor mount() gerufen");
  }
  await h3Zeichnen();
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const zeichne = async (): Promise<void> => {
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
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/erfassen"] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureArbeitsraum, { modus: h3Modus }),
                      }),
                    ),
                    createElement(NavProbe),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await flush();
    });
  };
  h3Zeichnen = zeichne;
  await zeichne();
  await act(flush);
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

function maybeButtonByText(part: string): HTMLButtonElement | null {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  return btn instanceof HTMLButtonElement ? btn : null;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
}

async function change(el: HTMLElement, value: string): Promise<void> {
  setNativeValue(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

function inputByPlaceholder(ph: string): HTMLInputElement {
  const el = [...container.querySelectorAll("input")].find((i) => i.placeholder === ph);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Input mit Placeholder „${ph}“ nicht gefunden`);
  }
  return el;
}

function fileInputByAccept(match: (accept: string) => boolean): HTMLInputElement {
  const el = [...container.querySelectorAll<HTMLInputElement>("input[type=file]")].find((i) =>
    match(i.accept),
  );
  if (!el) {
    throw new Error("Datei-Input nicht gefunden");
  }
  return el;
}

async function chooseFiles(input: HTMLInputElement, files: File[]): Promise<void> {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

async function dropFileOnImportZone(file: File): Promise<void> {
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Dropzone nicht gefunden");
  }
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

async function openWorkspace(): Promise<void> {
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
}

// Kern-Assertion der ehrlichen Grenze: Dialog offen, Inhalt NAMENTLICH benannt, KEIN Speichern-Knopf.
async function expectHonestBlock(reason: string): Promise<void> {
  nav.proceeded = false;
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  const text = pageText();
  expect(text).toContain(i18n.t("nav.guard.unsavableTitle"));
  expect(text).toContain(i18n.t("nav.guard.unsavableLead"));
  expect(text).toContain(reason);
  // Kein „Speichern", das erfolgreich wegnavigiert — der Knopf existiert in diesem Dialog nicht.
  expect(maybeButtonByText(i18n.t("nav.guard.save"))).toBeNull();
  expect(nav.proceeded).toBe(false);
  // „Hier bleiben" schließt ohne Wechsel …
  await click(buttonByText(i18n.t("nav.guard.stay")));
  expect(pageText()).not.toContain(i18n.t("nav.guard.unsavableTitle"));
  expect(nav.proceeded).toBe(false);
  // … und NUR bewusstes Verwerfen führt weiter.
  await click(
    container.querySelector<HTMLButtonElement>("[data-testid=navprobe]") as HTMLButtonElement,
  );
  await click(buttonByText(i18n.t("nav.guard.discard")));
  expect(nav.proceeded).toBe(true);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  nav.proceeded = false;
});

afterEach(() => {
  h3Modus = undefined;
  h3Zeichnen = null;
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block A: ehrliche Grenze — Navigation blockiert und benennt den nicht sicherbaren Inhalt", () => {
  it("lokales Bild: „1 eingefügtes Bild“ wird benannt, kein Speichern-und-wechseln", async () => {
    await mount();
    await openWorkspace();
    await click(buttonByText(i18n.t("capture.advanced.title")));
    const image = new File(["png-bytes"], "foto.png", { type: "image/png" });
    await chooseFiles(
      fileInputByAccept((a) => a === "image/*"),
      [image],
    );
    // Das Bild hängt wirklich im Zustand: die Galerie rendert es (Name steht im alt-Attribut).
    expect(container.querySelector('img[alt="foto.png"]')).not.toBeNull();

    await expectHonestBlock(i18n.t("capture.unsavable.images", { count: 1 }));
  });

  it("lokales Dokument (Session-Datei): „1 angehängte Datei“ wird benannt, kein Speichern-und-wechseln", async () => {
    await mount();
    await openWorkspace();
    const video = new File(["video-bytes"], "maschine.mp4", { type: "video/mp4" });
    await chooseFiles(
      fileInputByAccept((a) => a.includes("video/*")),
      [video],
    );
    expect(pageText()).toContain(t_docAdded("maschine.mp4"));

    await expectHonestBlock(i18n.t("capture.unsavable.docs", { count: 1 }));
  });

  it("hochgeladene Datei VOR Extraktionsabschluss: die Datei wird beim Namen genannt", async () => {
    await mount();
    await openWorkspace();
    await waehleModus("datei");
    await dropFileOnImportZone(
      new File(["Der Dosierwert ist nach jedem Schichtwechsel zu prüfen."], "bericht.txt", {
        type: "text/plain",
      }),
    );
    expect(pageText()).toContain("bericht.txt");

    await expectHonestBlock(i18n.t("capture.unsavable.file", { name: "bericht.txt" }));
  });

  it("aktive Datei-Queue: die laufende Verarbeitung wird mit Datei und Fortschritt benannt", async () => {
    await mount();
    await openWorkspace();
    await waehleModus("datei");
    await dropFileOnImportZone(
      new File(["Der Dosierwert ist nach jedem Schichtwechsel zu prüfen."], "bericht.txt", {
        type: "text/plain",
      }),
    );
    await click(buttonByText(i18n.t("capture.file.searchCta")));
    expect(pageText()).toContain("Dosierwert prüfen");
    await click(buttonByText(i18n.t("capture.file.applyCta")));
    expect(pageText()).toContain(
      i18n.t("capture.file.queueBadge", { current: 1, total: 1, name: "bericht.txt" }),
    );

    await expectHonestBlock(
      i18n.t("capture.unsavable.fileQueue", { name: "bericht.txt", current: 1, total: 1 }),
    );
  });

  it("geladene Trefferliste der externen Suche: benannt inkl. Zusage, dass die Anfrage bleibt", async () => {
    await mount();
    await openWorkspace();
    await click(buttonByText(i18n.t("capture.advanced.title")));
    await change(inputByPlaceholder(i18n.t("ext.placeholder")), "Dichtung Norm");
    await click(buttonByText(i18n.t("ext.search")));
    expect(pageText()).toContain("Dichtungsnorm 4711");

    await expectHonestBlock(i18n.t("capture.unsavable.extResults"));
  });
});

// Kleiner Helfer: das ehrliche „Datei angehängt"-Feedback des Video-/Audio-Pfads.
function t_docAdded(name: string): string {
  return i18n.t("capture.videoAdded", { name });
}
