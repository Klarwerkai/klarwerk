// @vitest-environment jsdom
// AUFTRAG-mega1 Block C / AUFTRAG-mega2 Block A (E2E-003): „Verwerfen" setzt das GESAMTE
// Erfassungsmodell zurück — nicht nur die Kernmetadaten. bens Sammel-Review 2 zeigte, dass der
// alte Reset den gesamten INTERVIEW- und DATEI-IMPORT-Zustand stehen ließ; ein Nutzer fand nach
// Datei-/Interviewarbeit im nächsten Wissensobjekt alte Extraktions-/Interviewdaten vor.
// Gemountet an der ECHTEN Capture-Seite über die realen Bedienwege:
//   1) Kernmetadaten (Beispiel laden → Verwerfen)
//   2) Interview: starten + antworten → Verwerfen → echter Leerzustand, kein Rest-Turn
//   3) Datei: Datei einlesen + KI-Punkte + Warteschlange → Verwerfen (Refine-Weg) → alles leer
//   4) Moduswechsel-Leak: Datei-Arbeit → Moduswechsel → Verwerfen → nichts bleibt übrig
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
        // Interview: eine konkrete, im DOM eindeutig wiederfindbare Frage.
        interview: vi.fn(async () => ({ question: "Welche Anlage betrifft es?", done: false })),
        // KI-Punkte-Extraktion: GENAU EIN Punkt (vorausgewählt) → „übernehmen" ist bedienbar
        // und baut die Warteschlange.
        extract: vi.fn(async () => ({
          points: [
            {
              title: "Dosierventil klemmt bei Kaltstart",
              summary: "Nach Stillstand klemmt das Ventil DP-4 sporadisch.",
              sourceExcerpt: "… Ventil DP-4 klemmt nach dem Wochenende …",
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/erfassen"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

function inputValues(): string[] {
  return [...container.querySelectorAll("input")].map((i) => i.value);
}

// Text in ein Textarea schreiben und React-onChange auslösen (nativer Setter + input-Event).
async function typeInto(el: HTMLTextAreaElement, value: string): Promise<void> {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

// Eine Datei über die ECHTE Drop-Zone (data-testid=capture-dropzone) einspeisen — genau der
// getestete onExtractFile-Seam, kein zweiter Pfad.
async function dropExtractFile(name: string, type: string, body: string): Promise<void> {
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Datei-Dropzone nicht gefunden (Modus „Aus Datei“ aktiv?)");
  }
  const file = new File([body], name, { type });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block A: Verwerfen setzt das gesamte Erfassungsmodell zurück", () => {
  it("(1) Kernmetadaten: Beispiel laden → Verwerfen → erweiterte Details öffnen → alle Felder leer", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.loadExample")));
    expect(inputValues()).toContain("Qualität");
    expect(container.textContent).toContain("Dosierung");

    await click(buttonByText(i18n.t("capture.wizard.discard")));
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));

    await click(buttonByText(i18n.t("capture.advanced.title")));
    expect(inputValues()).not.toContain("Qualität");
    expect(inputValues()).not.toContain("Linie L4 / Dosierstation DP-4");
    expect(container.textContent).not.toContain("Dosierung");
  });

  it("(2) Interview: starten + antworten → Verwerfen → kein Rest-Turn, Startzustand zurück", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.mode.interview")));
    // Bewusster Start (E2E-008) → erster Turn, die Frage steht.
    await click(buttonByText(i18n.t("capture.ivStart")));
    expect(container.textContent).toContain("Welche Anlage betrifft es?");
    // Antwort eintippen und senden → ivAnswers wird befüllt.
    const ta = container.querySelector("textarea");
    if (!(ta instanceof HTMLTextAreaElement)) {
      throw new Error("Interview-Antwortfeld nicht gefunden");
    }
    await typeInto(ta, "Dosierstation DP-4");
    await click(buttonByText(i18n.t("capture.ivSend")));
    // Vorher: Interview läuft, die Frage steht weiter.
    expect(container.textContent).toContain("Welche Anlage betrifft es?");

    // Verwerfen (Erzähl-Weg, jetzt auch bei reiner Interviewarbeit erreichbar).
    await click(buttonByText(i18n.t("capture.wizard.discard")));
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));

    // Nachher: kein Rest-Turn — die Frage ist weg, der bewusste Start steht wieder bereit.
    expect(container.textContent).not.toContain("Welche Anlage betrifft es?");
    expect(container.textContent).not.toContain("Dosierstation DP-4");
    expect(() => buttonByText(i18n.t("capture.ivStart"))).not.toThrow();
  });

  it("(3) Datei: Text + KI-Punkte + Warteschlange → Verwerfen → Datei-Zustand komplett leer", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.mode.datei")));
    // Datei über die echte Dropzone einlesen → fileName/fileText/fileOriginal.
    await dropExtractFile("erfahrung.txt", "text/plain", "Ventil DP-4 klemmt nach dem Wochenende.");
    expect(container.textContent).toContain("erfahrung.txt");
    // KI-Punkte extrahieren → filePoints (der Punkt-Titel steht sichtbar).
    await click(buttonByText(i18n.t("capture.file.searchCta")));
    expect(container.textContent).toContain("Dosierventil klemmt bei Kaltstart");
    // „übernehmen" baut die Warteschlange und lädt den Punkt in den Refine-Schritt.
    await click(buttonByText(i18n.t("capture.file.applyCta")));

    // Verwerfen über den zweiten Verwerfen-Weg (Refine-Schritt, confirmDiscard).
    await click(buttonByText(i18n.t("capture.wizard.discard")));
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));

    // Nachher: weder Dateiname noch der extrahierte Punkt sind irgendwo übrig.
    expect(container.textContent).not.toContain("erfahrung.txt");
    expect(container.textContent).not.toContain("Dosierventil klemmt bei Kaltstart");
    expect(container.textContent).not.toContain("Ventil DP-4 klemmt nach dem Wochenende");
  });

  it("(4) Moduswechsel-Leak: Datei einlesen → Modus wechseln → Verwerfen → nichts bleibt übrig", async () => {
    await mount();
    await click(buttonByText("Weitere Wege anzeigen"));
    await click(buttonByText(i18n.t("capture.mode.datei")));
    await dropExtractFile("notiz.txt", "text/plain", "Kurzer Notiztext aus der Schicht.");
    expect(container.textContent).toContain("notiz.txt");

    // Modus wechseln (Datei → Interview) — der Datei-Zustand bleibt zunächst bestehen …
    await click(buttonByText(i18n.t("capture.mode.interview")));
    // … und lässt sich jetzt verwerfen (Verwerfen ist auch ohne Rohtext erreichbar, weil Dateiarbeit vorliegt).
    await click(buttonByText(i18n.t("capture.wizard.discard")));
    await click(buttonByText(i18n.t("capture.wizard.discardYes")));

    // Zurück in „Aus Datei": kein geerbter Dateiname, kein alter Text.
    await click(buttonByText(i18n.t("capture.mode.datei")));
    expect(container.textContent).not.toContain("notiz.txt");
    expect(container.textContent).not.toContain("Kurzer Notiztext aus der Schicht");
  });
});
