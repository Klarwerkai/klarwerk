// @vitest-environment jsdom
// ================================================================================================
// F-0120 / K-27 · JOB 2969 D1 — DIE IMPORT-ABLEHNUNG WIRD VORGELESEN UND ERSCHEINT EINMAL
// ================================================================================================
//
// Abnahme aus der gebundenen Quellzeile, drei Punkte:
//   A  `role="status"`/`aria-live` an der Ausgabe
//   B  genau EINE Meldung bei MEHREREN Ursachen
//   C  sichtbarer Text unveraendert
//
// WAS SCHON DA WAR — und deshalb hier nur bewacht, nicht neu gebaut: JOB 1840 D1 hat die
// Drop-Ablehnung bereits auf EINEN Traeger gezogen (`CaptureFileImport.tsx:144-150`, `<output>`
// mit `aria-live="polite"` und `aria-atomic="true"`), und `a1292-meldung-mounted.test.tsx` pinnt
// das seither. Fall A und C halten diesen Stand fest.
//
// WAS FEHLTE: Die Erfassen-Flaeche hat ZWEI Ablehnungsursachen, und jede hatte ihre EIGENE
// Live-Region — die Drop-Ablehnung in `CaptureFileImport`, der Kachel-Hinweis („bald"/„geplant"/
// „nicht konfiguriert") in `FileTypePicker`. Beide koennen GLEICHZEITIG Text tragen, in beiden
// Reihenfolgen. Fuer eine Vorlesehilfe sind das zwei Ansagen fuer einen Vorgang — genau die
// Doppelmeldung, die K-27 ausschliesst. Fall B misst das am gemounteten Baum.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { CaptureFileImport } from "../../apps/web/src/components/CaptureFileImport";
import i18n from "../../apps/web/src/i18n";
import { fileSourcesForSurface } from "../../apps/web/src/lib/importSourceGallery";

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

/** Alle Ansagekanaele im Baum, die gerade wirklich Text tragen. */
function ansagenMitText(): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>("output, [role=status], [aria-live]"),
  ).filter((el) => (el.textContent ?? "").trim().length > 0);
}

/** Die erste Kachel, die KEIN Import ist — sie loest den ehrlichen Hinweis aus. */
function nichtAktiveKachel(): HTMLElement {
  const quelle = fileSourcesForSurface("capture").find((s) => s.state !== "active");
  if (!quelle) {
    throw new Error("keine nicht-aktive Kachel auf der Erfassen-Flaeche");
  }
  const beschriftung = i18n.t(quelle.labelKey);
  const treffer = Array.from(container.querySelectorAll<HTMLElement>("button")).find((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  if (!treffer) {
    throw new Error(`Kachel „${beschriftung}" nicht im Baum`);
  }
  return treffer;
}

function res(key: string, opts?: Record<string, unknown>): string {
  return opts ? i18n.t(key, opts) : i18n.t(key);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("F-0120 · JOB 2969 D1 — die Ablehnung wird angesagt, und zwar genau einmal", () => {
  it("A · die Ausgabe traegt Statusrolle und Hoeflichkeitsstufe", () => {
    fireDrop("tabelle.xlsx", "application/vnd.ms-excel");
    const kanaele = ansagenMitText();
    expect(kanaele.length, "kein Ansagekanal traegt die Ablehnung").toBeGreaterThan(0);
    const traeger = kanaele[0] as HTMLElement;
    expect(traeger.tagName, "der Meldungstraeger ist kein <output>").toBe("OUTPUT");
    expect(traeger.getAttribute("aria-live"), "keine Hoeflichkeitsstufe am Traeger").toBe("polite");
    expect(traeger.getAttribute("aria-atomic"), "kein atomares Merkmal am Traeger").toBe("true");
  });

  it("B · DER KERNFALL: zwei Ursachen ergeben trotzdem genau EINE Ansage", () => {
    // Ursache 1: eine nicht unterstuetzte Datei wird abgelegt.
    fireDrop("tabelle.xlsx", "application/vnd.ms-excel");
    expect(ansagenMitText().length, "nach der ersten Ursache steht genau eine Ansage").toBe(1);

    // Ursache 2: der Mensch tippt danach eine Kachel an, die keinen Import startet.
    act(() => {
      nichtAktiveKachel().click();
    });

    expect(
      ansagenMitText().map((el) => (el.textContent ?? "").trim()),
      "Zwei Live-Regionen mit Text heissen fuer eine Vorlesehilfe ZWEI Ansagen fuer einen " +
        "Vorgang. Genau EINE Meldung darf stehen — die zur juengsten Ursache.",
    ).toHaveLength(1);
  });

  it("B2 · auch in der anderen Reihenfolge bleibt es bei EINER Ansage", () => {
    act(() => {
      nichtAktiveKachel().click();
    });
    expect(ansagenMitText().length, "nach der Kachel steht genau eine Ansage").toBe(1);

    fireDrop("tabelle.xlsx", "application/vnd.ms-excel");

    expect(
      ansagenMitText().map((el) => (el.textContent ?? "").trim()),
      "Die Reihenfolge der Ursachen darf keinen Unterschied machen — sonst haengt die " +
        "Hoerbarkeit davon ab, was der Mensch zuerst getan hat.",
    ).toHaveLength(1);
  });

  it("C · der sichtbare Text bleibt unveraendert", () => {
    fireDrop("tabelle.xlsx", "application/vnd.ms-excel");
    const grund = res("capture.file.dropReject", { name: "tabelle.xlsx" });
    expect(
      container.textContent,
      "der Ablehnungsgrund im Wortlaut steht nicht mehr auf der Flaeche",
    ).toContain(grund);
    const traeger = ansagenMitText()[0] as HTMLElement;
    expect(traeger.textContent, "der Traeger sagt genau diesen Satz an").toBe(grund);
  });
});
