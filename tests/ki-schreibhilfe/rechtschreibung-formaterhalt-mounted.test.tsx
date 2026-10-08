// @vitest-environment jsdom
// ================================================================================================
// R-0103 — „RECHTSCHREIBUNG" BEHÄLT FETT UND AUFZÄHLUNG, AUCH AUSSERHALB DES BLATTES.
// ================================================================================================
//
// Pedis Live-Befund (KW-PROD-40): nach zwei Korrekturrunden blieb ein Teil der Formatierung,
// „Fettschrift und Aufzählungspunkte gehen weiterhin verloren". Das Blatt übernimmt die
// Rechtschreibung seit KW-PROD-37 formaterhaltend (`applySpellingAssistPreservingHtml`). Die
// gemeinsame `AiAssistBox` am Rumpf (alter Arbeitsraum, Studio, Bibliothek-Bearbeiten) tat es nicht:
// „Ersetzen" lief dort für JEDE Aktion über `applyBodyAssist` und machte aus dem Rumpf Klartext.
//
// Gemountet wird die ECHTE Box mit der Übernahme, die die Aufrufer ihr geben; gestellt sind nur
// Modellantwort und die Verfügbarkeitsanzeige drumherum.
//
//   A  Rechtschreibung → Vorschau → Ersetzen: `<strong>` und `<ul><li>` stehen danach noch da.
//   B  Passt die Wortzahl nicht, wird NICHT ersetzt: Meldung, Vorschau bleibt, Rumpf unverändert.
//   C  Gegenprobe: jede andere Aktion („Klarer") übernimmt weiter über `applyFn` wie bisher.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/hooks", () => ({
  useAssistPresets: () => ({ data: [], isError: false, fetchStatus: "idle" }),
}));
vi.mock("../../apps/web/src/lib/useAiAvailable", () => ({
  useAiAvailable: () => ({ available: true, isLoading: false }),
}));
vi.mock("../../apps/web/src/components/AiModelInfo", () => ({ AiModelInfo: () => null }));
vi.mock("../../apps/web/src/components/AiUnavailableHint", () => ({
  AiUnavailableHint: () => null,
}));
vi.mock("../../apps/web/src/components/HelpTip", () => ({ HelpTip: () => null }));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AiAssistBox } from "../../apps/web/src/components/AiAssistBox";
import "../../apps/web/src/i18n";
import {
  applyBodyAssist,
  bodyTextForAssist,
  spellingAssistHtmlOrNull,
} from "../../apps/web/src/lib/bodyAiAssist";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Ein Rumpf mit genau den beiden Formaten aus dem Befund: Fett und Aufzählung. */
const RUMPF =
  "<p><strong>Feler</strong> im <em>Ventl</em></p><ul><li>Erstr Punkt</li><li>Zweitr</li></ul>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(antwort: string, onApply: (next: string) => void): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(AiAssistBox, {
        text: bodyTextForAssist(RUMPF),
        runAssist: async () => antwort,
        // Dieselbe Verdrahtung wie an den vier Rumpf-Aufrufern.
        applyFn: (mode, _original, suggestion) => applyBodyAssist(mode, RUMPF, suggestion),
        applySpelling: (suggestion) => spellingAssistHtmlOrNull(RUMPF, suggestion),
        onApply,
        hintKey: "capture.ai.bodyHint",
      }),
    );
  });
}

function knopf(beschriftung: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === beschriftung,
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${beschriftung}" nicht gefunden`);
  }
  return treffer;
}

async function klick(beschriftung: string): Promise<void> {
  await act(async () => {
    knopf(beschriftung).click();
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("R-0103 · Rechtschreibung in der AiAssistBox erhält die Formatierung", () => {
  it("A · Vorschau zuerst, dann Ersetzen: Fett und Aufzählungspunkte bleiben erhalten", async () => {
    const onApply = vi.fn();
    mount("Fehler im Ventil Erster Punkt Zweiter", onApply);

    await klick("Rechtschreibung");
    // R-0320: der Vorschlag steht in der Vorschau — übernommen ist noch nichts.
    expect(container.textContent ?? "").toContain("KI-Vorschlag (Vorschau)");
    expect(onApply).not.toHaveBeenCalled();

    await klick("Ersetzen");

    expect(onApply).toHaveBeenCalledTimes(1);
    const html = String(onApply.mock.calls[0]?.[0] ?? "");
    expect(html).toContain("<strong>Fehler</strong>");
    expect(html).toContain("<em>Ventil</em>");
    expect(html).toContain("<ul><li>Erster Punkt</li><li>Zweiter</li></ul>");
  });

  it("B · Wortzahl passt nicht: nichts wird ersetzt, die Meldung steht, die Vorschau bleibt", async () => {
    const onApply = vi.fn();
    mount("Fehler im Ventil, ein ganz neuer Satz", onApply);

    await klick("Rechtschreibung");
    await klick("Ersetzen");

    const grund = "ein nicht abbildbarer Vorschlag darf den Rumpf nicht ersetzen";
    expect(onApply, grund).not.toHaveBeenCalled();
    expect(container.textContent ?? "").toContain(
      "Rechtschreibprüfung kann Formatierung aktuell nicht sicher erhalten.",
    );
    expect(container.textContent ?? "").toContain("KI-Vorschlag (Vorschau)");
  });

  it("C · Gegenprobe: „Klarer“ übernimmt unverändert über applyFn", async () => {
    const onApply = vi.fn();
    mount("Der Fehler liegt im Ventil.", onApply);

    await klick("Klarer");
    await klick("Ersetzen");

    expect(onApply).toHaveBeenCalledWith(
      applyBodyAssist("replace", RUMPF, "Der Fehler liegt im Ventil."),
    );
  });
});
