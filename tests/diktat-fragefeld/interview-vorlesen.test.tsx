// @vitest-environment jsdom
// ================================================================================================
// R-0047 (K2) — DIE GESTELLTE INTERVIEWFRAGE WIRD AUF KLICK VORGELESEN.
// ================================================================================================
//
// Gemessen am ECHTEN Produktpfad: `CaptureArbeitsraum` im Modus „interview" (derselbe Mountweg wie
// `tests/capture/interview-start-mounted.test.tsx`), der Interview-Endpunkt liefert die Frage, die
// Sprachausgabe des Browsers ist gedoppelt. `interview-speech-i18n.test.ts` prüft nur die Texte —
// diese Datei prüft das Verhalten (`Capture.tsx`, `toggleReadQuestion` und die beiden Stopp-Effekte):
//   V1 Vor dem Klick wird nichts gesprochen; der Klick spricht genau die angezeigte Frage.
//   V2 Der zweite Klick bricht ab, der Knopf kehrt in den Ruhezustand zurück.
//   V3 Eine neue Frage beendet ein laufendes Vorlesen.
//   V4 Der Abbau der Seite beendet ein laufendes Vorlesen.
//   V5 Ohne Sprachausgabe gibt es keinen Vorleseknopf.
//
// NICHT GEMESSEN: echte Tonausgabe und Stimme — gemessen wird bis zur Browser-Grenze.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fragen = vi.hoisted(() => ({
  folge: ["Welches Ventil wird geprüft?", "Wie oft wird es geprüft?"],
  gestellt: 0,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]) },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => {
          const frage = fragen.folge[Math.min(fragen.gestellt, fragen.folge.length - 1)];
          fragen.gestellt += 1;
          return { question: frage, done: false };
        }),
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Das Sprachausgabe-Doppel: zählt, was gesprochen und was abgebrochen wurde. */
class AeusserungDoppel {
  text: string;
  lang = "";
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
const ausgabe = { gesprochen: [] as AeusserungDoppel[], abgebrochen: 0 };

type Fenster = Record<string, unknown>;
const fenster = window as unknown as Fenster;

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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const wurzel = createRoot(container);
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
                      element: createElement(CaptureArbeitsraum, { modus: "interview" }),
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

function abbauen(): void {
  if (root) {
    const wurzel = root;
    act(() => wurzel.unmount());
    root = null;
    container.remove();
  }
}

function knopfMitText(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden`);
  }
  return btn;
}

/** Der Vorleseknopf, gefunden über seinen `title` — er wechselt zwischen Vorlesen und Stopp. */
function vorleseknopf(): HTMLButtonElement | undefined {
  const titel = [i18n.t("capture.ivReadAloud"), i18n.t("capture.ivReadStop")];
  return [...container.querySelectorAll("button")].find((b) =>
    titel.includes(b.getAttribute("title") ?? ""),
  );
}

async function click(btn: HTMLButtonElement | undefined): Promise<void> {
  await act(async () => {
    btn?.click();
    await flush();
  });
}

async function interviewStarten(): Promise<void> {
  await click(knopfMitText(i18n.t("capture.ivStart")));
  expect(fragen.gestellt, "der Interview-Endpunkt wurde nicht gefragt").toBe(1);
  expect(container.textContent ?? "").toContain("Welches Ventil wird geprüft?");
}

/** Die Antwort ins kontrollierte Feld schreiben — über den nativen Setter, wie React es tut. */
async function antworten(text: string): Promise<void> {
  const feld = [...container.querySelectorAll("textarea")].find(
    (f) => f.getAttribute("placeholder") === i18n.t("capture.ivAnswerHint"),
  );
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Antwortfeld nicht gefunden");
  }
  const setzer = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  fragen.gestellt = 0;
  ausgabe.gesprochen = [];
  ausgabe.abgebrochen = 0;
});

afterEach(() => {
  abbauen();
  // Entfernen statt `undefined`: die Seite fragt `"speechSynthesis" in window`.
  Reflect.deleteProperty(fenster, "speechSynthesis");
  Reflect.deleteProperty(fenster, "SpeechSynthesisUtterance");
  vi.clearAllMocks();
});

describe("R-0047 · die Interviewfrage auf Klick vorlesen", () => {
  it("V1/V2 · kein Auto-Play; Klick spricht genau die angezeigte Frage; zweiter Klick bricht ab", async () => {
    mitSprachausgabe();
    await mount();
    await interviewStarten();

    // Kein Auto-Play: die Frage steht da, gesprochen wurde nichts.
    expect(ausgabe.gesprochen, "vor dem Klick wurde schon gesprochen").toEqual([]);
    const knopf = vorleseknopf();
    expect(knopf, "kein Vorleseknopf an der Interviewfrage").toBeTruthy();
    expect(knopf?.getAttribute("title")).toBe(i18n.t("capture.ivReadAloud"));

    await click(knopf);
    expect(ausgabe.gesprochen).toHaveLength(1);
    const angezeigt = [...container.querySelectorAll("p")].find(
      (p) => (p.textContent ?? "").trim() === "Welches Ventil wird geprüft?",
    );
    expect(angezeigt, "die gesprochene Frage steht nicht so auf der Seite").toBeTruthy();
    expect(ausgabe.gesprochen[0]?.text).toBe(angezeigt?.textContent?.trim());
    expect(ausgabe.gesprochen[0]?.lang).toBe("de-DE");
    expect(vorleseknopf()?.getAttribute("title")).toBe(i18n.t("capture.ivReadStop"));

    const vorher = ausgabe.abgebrochen;
    await click(vorleseknopf());
    expect(ausgabe.abgebrochen, "der zweite Klick hat nicht abgebrochen").toBeGreaterThan(vorher);
    expect(ausgabe.gesprochen, "der zweite Klick hat erneut gesprochen").toHaveLength(1);
    // Ruhezustand: der Knopf bietet wieder das Vorlesen an.
    expect(vorleseknopf()?.getAttribute("title")).toBe(i18n.t("capture.ivReadAloud"));
  });

  it("V3 · eine neue Frage beendet ein laufendes Vorlesen", async () => {
    mitSprachausgabe();
    await mount();
    await interviewStarten();
    await click(vorleseknopf());
    expect(vorleseknopf()?.getAttribute("title")).toBe(i18n.t("capture.ivReadStop"));

    const vorher = ausgabe.abgebrochen;
    await antworten("Das Sicherheitsventil V4.");
    await click(knopfMitText(i18n.t("capture.ivSend")));
    expect(fragen.gestellt, "die nächste Frage wurde nicht geholt").toBe(2);
    expect(container.textContent ?? "").toContain("Wie oft wird es geprüft?");

    expect(ausgabe.abgebrochen, "die alte Frage läuft beim Fragenwechsel weiter").toBeGreaterThan(
      vorher,
    );
    expect(vorleseknopf()?.getAttribute("title")).toBe(i18n.t("capture.ivReadAloud"));
    expect(ausgabe.gesprochen, "die neue Frage wurde ungefragt vorgelesen").toHaveLength(1);
  });

  it("V4 · das Verlassen der Seite beendet ein laufendes Vorlesen", async () => {
    mitSprachausgabe();
    await mount();
    await interviewStarten();
    await click(vorleseknopf());
    const vorher = ausgabe.abgebrochen;

    abbauen();
    expect(ausgabe.abgebrochen, "nach dem Abbau spräche der Browser weiter").toBeGreaterThan(
      vorher,
    );
  });

  it("V5 · ohne Sprachausgabe gibt es keinen Vorleseknopf — die Frage steht trotzdem da", async () => {
    await mount();
    await interviewStarten();
    expect(vorleseknopf(), "Vorleseknopf ohne Sprachausgabe wäre eine Scheinfunktion").toBe(
      undefined,
    );
  });
});
