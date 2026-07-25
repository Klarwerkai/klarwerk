// @vitest-environment jsdom
// AUFTRAG-mega1 Block A: Drag&Drop-Datei-Upload beim Erfassen — ZUSÄTZLICH zum Dialog, nicht als
// Ersatz. Gepinnt am ECHTEN CaptureFileImport (dem Baum, den Capture.tsx rendert):
//  (a) Drop einer UNTERSTÜTZTEN Datei (DOCX) ruft GENAU den bestehenden onExtractFile-Seam — kein
//      zweiter Pfad, kein Fetch.
//  (b) Drop einer „geplanten"/nicht unterstützten Datei (XLSX) → keine Verarbeitung, kein Fetch,
//      ehrlicher aria-live-Hinweis.
//  (c) dragover wird abgefangen (preventDefault) und die Zone kündigt „hier ablegen“ an.
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

function dropzone(): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!el) {
    throw new Error("Dropzone nicht gefunden");
  }
  return el;
}

function fireDrop(fileName: string, type: string): void {
  const file = new File(["x"], fileName, { type });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  act(() => {
    dropzone().dispatchEvent(ev);
  });
}

function res(key: string, opts?: Record<string, unknown>): string {
  return opts ? i18n.t(key, opts) : i18n.t(key);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  extractedNames = [];
  fetchSpy = vi.fn();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Block A: CaptureFileImport — Drag&Drop läuft durch den bestehenden onExtractFile-Seam", () => {
  it("(a) Drop einer DOCX ruft onExtractFile mit genau dieser Datei — kein Fetch", () => {
    mount();
    fireDrop("bericht.docx", "");
    expect(extractedNames).toEqual(["bericht.docx"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("(b) Drop einer geplanten XLSX → keine Verarbeitung, kein Fetch, ehrlicher Hinweis", () => {
    mount();
    fireDrop("tabelle.xlsx", "");
    expect(extractedNames).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain(
      res("capture.file.dropReject", { name: "tabelle.xlsx" }),
    );
  });

  it("(c) dragover wird abgefangen und die Zone kündigt „hier ablegen“ an", () => {
    mount();
    const ev = new Event("dragover", { bubbles: true, cancelable: true });
    act(() => {
      dropzone().dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(dropzone().textContent).toContain(res("capture.file.dropActive"));
  });
});
