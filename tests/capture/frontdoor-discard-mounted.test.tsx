// @vitest-environment jsdom
// WP-UX-WOW-1 U8 (Kopfs Freeze-Befund, Mounted): der Verwerfen-Pfad des KI-Vorschlags im
// Dokument-Canvas. Diagnose-Ergebnis (siehe Fix in CaptureFrontDoor/RichTextEditor):
//  (1) Der Vorschlags-Scroll-Effekt rief scrollIntoView UNGESCHÜTZT auf (nicht das R7-?.()-Muster)
//      und feuerte bei jeder Identitätsänderung der Panel-States — die Probe dieses WPs wies eine
//      UNBEHANDELTE asynchrone TypeError aus genau diesem setTimeout nach (läuft an jedem
//      ErrorBoundary vorbei). Jetzt: Scroll NUR beim Erscheinen-Übergang + ?.()-Guard.
//  (2) Der Editor stieß bei JEDEM Blur (auch dem Klick auf „Vorschlag verwerfen") einen
//      emit→setState→innerHTML-Neuaufbau-Zyklus an — bei großen Dokumenten der synchrone
//      Voll-Neuaufbau, der sich zum beobachteten Renderer-Stillstand stapelt. Jetzt: emittierte
//      Werte werden NIE ins DOM zurückgeschrieben (lastEmitted-Guard) und ein No-op-Blur löst
//      keinen Renderzyklus mehr aus.
// Der Test pinnt: Verwerfen räumt das Panel in EINEM kontrollierten Zyklus (Render-Zähler klein,
// keine Endlosschleife), es bleibt kein unbehandelter Fehler zurück, und die beiden Guards stehen
// im Quelltext (Effekt-Pins).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      structure: vi.fn(),
      assist: vi.fn(),
    },
    drafts: {
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      promote: vi.fn(),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Profiler, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
// AUFTRAG-mega9 Block B: die Vordertür ist jetzt Anmelder am Navigations-Wächter (KW-E2E-002).
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const structureMock = endpoints.reasoner.structure as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let renders = 0;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            AuthProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/capture/frontdoor"] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Profiler,
                    {
                      id: "frontdoor",
                      onRender: () => {
                        renders += 1;
                      },
                    },
                    createElement(CaptureFrontDoor),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf mit Text ${part} nicht gefunden`);
  }
  return btn;
}

describe("WP-UX-WOW-1 U8: „Vorschlag verwerfen“ friert nicht mehr ein", () => {
  it("Verwerfen räumt das Panel in einem kontrollierten Zyklus — endliche Renderzahl, kein Folgefehler", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (event: { reason?: unknown }): void => {
      unhandled.push(event.reason ?? event);
    };
    process.on("uncaughtException", onUnhandled as never);
    try {
      structureMock.mockResolvedValue({
        title: "Ventil entlasten",
        statement: "Ventil vor Wartung entlasten.",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 70,
        demo: false,
      });
      mount();
      const editor = container.querySelector('[contenteditable="true"]');
      if (!editor) {
        throw new Error("Editor fehlt");
      }
      await act(async () => {
        editor.innerHTML = "<p>Ventil vor Wartung entlasten und Druck pruefen.</p>";
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      });
      // JOB 3062 · H3: Der Weg heisst „KI ▾" → „Struktur vorschlagen" (Auftrag §5.2). Derselbe
      // Aufruf, dieselbe Vorschlagskarte mit „Übernehmen"/„Verwerfen" — nur der Zugang ist ein
      // Menü statt eines Knopfes auf der Fläche.
      await act(async () => {
        const werkzeug = container.querySelector('[data-testid="blatt-werkzeug-ki"]');
        if (!(werkzeug instanceof HTMLButtonElement)) {
          throw new Error("Das Menü KI ist nicht auf dem Blatt.");
        }
        werkzeug.click();
      });
      await act(async () => {
        buttonByText("Struktur vorschlagen").click();
      });
      // Scroll-Timeout (0 ms) des Erscheinens ausführen lassen — mit dem ?.()-Guard bleibt er still.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
      expect(container.textContent).toContain("Vorschlag verwerfen");

      renders = 0;
      // Der Klick blurt zuerst den Editor (Kopfs Live-Situation) und verwirft dann den Vorschlag.
      await act(async () => {
        editor.dispatchEvent(new Event("blur", { bubbles: false }));
        buttonByText("Vorschlag verwerfen").click();
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      // Panel weg, keine Endlosschleife (kontrollierte, kleine Renderzahl), kein Folgefehler.
      expect(container.textContent).not.toContain("Vorschlag verwerfen");
      expect(renders).toBeLessThan(6);
      expect(unhandled).toEqual([]);
      // Der Editor-Inhalt ist unangetastet (Verwerfen ändert nie den Text).
      expect(editor.innerHTML).toContain("Ventil vor Wartung entlasten");
    } finally {
      process.removeListener("uncaughtException", onUnhandled as never);
    }
  }, 20000);

  it("Effekt-Pins: Scroll nur beim Erscheinen + ?.()-Guard; Editor schreibt Emissionen nie zurück", () => {
    const frontdoor = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/erfassen/Blatt.tsx"),
      "utf8",
    );
    // ============================================================================================
    // JOB 3062 · H3 — DIE PINS (1) UND (2) HABEN KEINEN GEGENSTAND MEHR.
    // ============================================================================================
    // Sie hielten zwei Vorkehrungen um EINEN Effekt fest: das Blatt scrollte den KI-Vorschlag beim
    // Erscheinen ins Bild (`proposalRef.current?.scrollIntoView?.(…)`), und ein Ref sorgte dafür,
    // dass das nur beim ERSCHEINEN geschah statt bei jeder Identitätsänderung. Beides waren
    // Sicherungen um den Scroll herum, nicht um das Verwerfen.
    //
    // Der Effekt selbst ist mit dem Umbau entfallen: die Vorschlagskarte lag an der Vordertür unter
    // einem langen Formular und war ohne Scroll oft nicht zu sehen. Auf dem Blatt steht sie im
    // Textfluss unmittelbar am Ort des Geschehens — es gibt nichts mehr, wohin gescrollt werden
    // müsste. Kein Effekt, keine Effekt-Sicherung: hier stehenzulassen, was es nicht mehr gibt,
    // hiesse einen Test auf ein Literal zu pinnen statt auf ein Verhalten. Als GESTRICHEN in der
    // RUECKGABE benannt.
    //
    // DIE EIGENTLICHE ZUSAGE DIESER DATEI BLEIBT UNANGETASTET und wird vom Fall darüber gemessen,
    // nicht von diesen Zeilen: Verwerfen räumt in endlich vielen Rendern und ohne Folgefehler.
    // Deshalb wird hier positiv festgehalten, dass die Vorschlagskarte überhaupt noch existiert —
    // sonst könnte sie samt Zusage verschwinden und die Datei bliebe grün.
    expect(frontdoor).toContain("discardProposal");
    // (2) Der Scroll ist WIRKLICH weg und nicht nur umbenannt — sonst stünde eine ungesicherte
    //     Fassung des alten Effekts da (der Fehler, gegen den (1) einmal gebaut wurde).
    expect(frontdoor).not.toContain("scrollIntoView");
    const editor = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/RichTextEditor.tsx"),
      "utf8",
    );
    // (3) lastEmitted-Guard: aus dem DOM emittierte Werte werden nie ins DOM zurückgeschrieben,
    //     und ein No-op-Blur feuert keinen onChange (kein Blur-Renderzyklus mehr).
    expect(editor).toContain("value === lastEmittedRef.current");
    expect(editor).toContain("lastEmittedRef.current = next;");
    expect(editor).toContain("if (next !== value) {");
  });
});
