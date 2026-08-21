// @vitest-environment jsdom
// ================================================================================================
// JOB 1840 · D1 · ANKER A-1292-MELDUNG — die Ablehnungsmeldung des Dateiimports ist hörbar,
// und sie steht genau EINMAL im Baum.
// ================================================================================================
//
// GEMESSEN VOR DEM BAU (Rückgabe PRO2 JOB 1780 D1, Kandidat 1292): Die Meldung stand in einer
// `sr-only`-Live-Region OHNE Rolle, OHNE atomares Merkmal und OHNE Ausgabeelement — und drei
// Zeilen weiter ein zweites Mal, sichtbar. Für eine Vorlesehilfe war das derselbe Satz zweimal.
//
// DIESE DATEI PRÜFT DEN GEÄNDERTEN BAUM, NICHT DEN QUELLTEXT. Sie mountet die echte
// Produktionskomponente, legt eine nicht unterstützte Datei ab und misst danach am DOM:
//   A1  der Träger ist ein `<output>` — die Bauform dieses Hauses, mit impliziter Statusrolle
//   A2  er trägt `aria-live="polite"` UND `aria-atomic="true"`
//   A3  der Ablehnungsgrund steht GENAU EINMAL im Baum (das war der Doppelausgabe-Befund)
//   A4  die Region ist VOR dem Fehler schon montiert und leer (Zusicherung aus a18 I1/B2)
//   A5  ein zulässiger Typ lässt sie leer — der Negativfall
//
// GEGENMUTATION (Rückgabe §GEGENMUTATION): Wird der Bau auf die zwei alten `<p>` zurückgenommen,
// fallen A1, A2 und A3 rot. A3 ist dabei der schärfste Fall: er zählt die Vorkommen und ist
// gegen ein blosses `toContain` immun.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { CaptureFileImport } from "../../apps/web/src/components/CaptureFileImport";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(CaptureFileImport, { onExtractFile: () => undefined }));
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

/** Der Meldungsträger: das Element, das den Ablehnungsgrund ansagt. */
function traeger(): HTMLElement {
  const el = container.querySelector<HTMLElement>("output, [role=status], .sr-only");
  if (!el) {
    throw new Error("kein Meldungsträger im Baum");
  }
  return el;
}

/** Wie oft steht ein Text im Baum? Zählt Elemente, deren EIGENER Text ihn trägt. */
function vorkommen(text: string): number {
  let n = 0;
  for (const el of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
    const eigener = Array.from(el.childNodes)
      .filter((k) => k.nodeType === 3)
      .map((k) => k.textContent ?? "")
      .join("");
    if (eigener.includes(text)) {
      n += 1;
    }
  }
  return n;
}

function res(key: string, opts?: Record<string, unknown>): string {
  return opts ? i18n.t(key, opts) : i18n.t(key);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("JOB 1840 · A-1292-MELDUNG · die Ablehnung wird angesagt, und zwar einmal", () => {
  it("A4 · VOR dem Fehler: die Live-Region ist bereits montiert und leer", () => {
    mount();
    const t = traeger();
    expect(t.isConnected, "die Region muss vor ihrem Inhalt im Baum stehen").toBe(true);
    expect(t.textContent, "und dabei leer sein").toBe("");
  });

  it("A1 · der Träger ist ein <output> — die Bauform dieses Hauses", () => {
    mount();
    fireDrop("tabelle.xlsx", "");
    expect(traeger().tagName, "der Meldungsträger ist kein <output>").toBe("OUTPUT");
  });

  it("A2 · er trägt aria-live=polite UND aria-atomic=true", () => {
    mount();
    fireDrop("tabelle.xlsx", "");
    const t = traeger();
    expect(t.getAttribute("aria-live"), "keine Höflichkeitsstufe am Träger").toBe("polite");
    expect(t.getAttribute("aria-atomic"), "kein atomares Merkmal am Träger").toBe("true");
  });

  it("A3 · DER KERNFALL: der Ablehnungsgrund steht GENAU EINMAL im Baum", () => {
    mount();
    fireDrop("tabelle.xlsx", "");
    const grund = res("capture.file.dropReject", { name: "tabelle.xlsx" });

    // Er ist überhaupt da …
    expect(container.textContent, "der Grund fehlt ganz").toContain(grund);
    // … und zwar an genau einer Stelle. Vorher waren es zwei: die stumme sr-only-Region und
    // der sichtbare Absatz zwei Zeilen darunter.
    expect(vorkommen(grund), "der Ablehnungsgrund steht mehrfach im Baum").toBe(1);

    // Und er hängt am Kanal, nicht daneben.
    expect(traeger().textContent).toBe(grund);
  });

  it("A5 · NEGATIVFALL: ein zulässiger Typ lässt die Region leer", () => {
    mount();
    fireDrop("bericht.docx", "");
    expect(traeger().textContent, "ein zulässiger Typ darf nichts ansagen").toBe("");
  });
});
