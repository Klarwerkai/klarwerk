// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega34 BLOCK D — DIE DATEIAUSWAHL HAT KEINEN KNOPF.
// ================================================================================================
//
// Aufgabe 5 der Testerin lautet „ein Word-Dokument hineinbringen". Der Weg dorthin bestand aus
// einem versteckten `<input type="file" class="hidden">`, einer Ablagefläche darüber und
// Dateityp-Kacheln darunter, die den versteckten Eingang anklicken. Einen Knopf „Datei auswählen"
// gab es nicht. Wer nicht darauf kommt, dass eine KACHEL den Systemdialog öffnet, findet den Weg
// nicht — und dann scheitert ihr Test, ohne dass irgendetwas kaputt wäre. Zwei Bildschirmfotos aus
// der externen Auswertung zeigen genau diesen Moment.
//
// Dieser Test pinnt drei Dinge am ECHTEN CaptureFileImport:
//   D1  Ein SICHTBARER, benannter Knopf existiert — und er klickt GENAU den vorhandenen versteckten
//       Eingang (kein neuer Importweg, kein neuer Egress, keine neue Fähigkeit).
//   D2  Die Ablagefläche ist mit der Tastatur erreichbar und reagiert auf Enter und Leertaste.
//   D3  Eine `.docx` erreicht über diesen Weg den bestehenden Verarbeitungsstart.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { CaptureFileImport } from "../../apps/web/src/components/CaptureFileImport";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let extractedNames: Array<string | undefined>;
let fetchSpy: ReturnType<typeof vi.fn>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(CaptureFileImport, {
        onExtractFile: (e) => {
          extractedNames.push(e.target.files?.[0]?.name);
        },
      }),
    );
  });
}

function hiddenInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!el) {
    throw new Error("Der bestehende versteckte Datei-Eingang fehlt");
  }
  return el;
}

function pickButton(): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>("[data-testid=capture-file-pick]");
  if (!el) {
    throw new Error("Knopf „Datei auswählen“ nicht gefunden");
  }
  return el;
}

function dropzone(): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!el) {
    throw new Error("Dropzone nicht gefunden");
  }
  return el;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  extractedNames = [];
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("mega34 D1 · ein sichtbarer, benannter Knopf öffnet den Dateidialog", () => {
  it("der Knopf ist da, trägt seinen Namen und ist NICHT versteckt", () => {
    const btn = pickButton();
    // Sichtbar heißt hier: nicht die `hidden`-Klasse des versteckten Eingangs, kein aria-hidden.
    expect(btn.className).not.toContain("hidden");
    expect(btn.getAttribute("aria-hidden")).toBeNull();
    expect(btn.textContent ?? "").toContain(i18n.t("capture.file.pick"));
    // Und er ist ein echter Knopf, kein anklickbares <div> — Tastatur und Screenreader inklusive.
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("der Knopf klickt GENAU den vorhandenen versteckten Eingang — kein zweiter Importweg", () => {
    const input = hiddenInput();
    const clicked = vi.fn();
    input.click = clicked;

    act(() => {
      pickButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(clicked).toHaveBeenCalledTimes(1);
    // Kein neuer Egress: der Knopf öffnet einen Dialog, er lädt nichts hoch.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("es bleibt bei EINEM Datei-Eingang — der Knopf hat keinen eigenen angelegt", () => {
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1);
  });
});

describe("mega34 D2 · die Ablagefläche ist mit der Tastatur bedienbar", () => {
  // Sie ist ein ECHTER <button>. Damit sind Fokussierbarkeit und Enter/Leertaste vom Browser
  // garantiert — es gibt keine eigene Tastatur-Nachbildung, die man testen könnte oder sollte.
  // Eine nachgebaute keydown-Behandlung auf einem nativen Knopf würde in einem echten Browser
  // sogar DOPPELT auslösen (Handler plus natives click). Geprüft wird deshalb, dass die Fläche
  // wirklich ein bedienbarer Knopf ist — und dass ihr Klickweg derselbe ist wie der des Knopfes.
  it("sie ist ein echter, nicht deaktivierter Knopf — nicht ein anklickbares <div>", () => {
    const zone = dropzone();
    expect(zone.tagName).toBe("BUTTON");
    expect(zone.getAttribute("type")).toBe("button");
    expect((zone as HTMLButtonElement).disabled).toBe(false);
    // Kein negativer tabindex, der den Knopf aus der Tab-Reihenfolge nähme.
    expect(zone.getAttribute("tabindex")).toBeNull();
  });

  it("ihre Aktivierung öffnet denselben Dialog wie der Knopf", () => {
    const input = hiddenInput();
    const clicked = vi.fn();
    input.click = clicked;

    act(() => {
      dropzone().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("mega34 D3 · eine .docx erreicht den bestehenden Verarbeitungsstart", () => {
  it("die über den Dialog gewählte Datei läuft durch denselben onExtractFile-Seam", () => {
    const input = hiddenInput();
    const file = new File(["x"], "Handbuch.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    // Genau das, was der native Dialog nach der Auswahl auslöst: files setzen, change feuern.
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(extractedNames).toEqual(["Handbuch.docx"]);
  });

  it("der Eingang akzeptiert DOCX — der Knopf verspricht nichts, was der Dialog nicht anbietet", () => {
    expect(hiddenInput().getAttribute("accept") ?? "").toContain(".docx");
  });
});
