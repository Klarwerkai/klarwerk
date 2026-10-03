// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · Lauf 5 — Bens offene Befunde aus Runde 3 am Produktaufbau.
// ================================================================================================
//
// R3-1: Klick auf ein Bild im Editor → Großansicht → „Bildbeschreibung bearbeiten" muss die
//       Beschreibung GENAU DIESES Bildes öffnen. Die Großansicht wird aus dem Editorstand gebaut,
//       ihre Position bezog der Editor aber auf den Galeriekörper (`value`) — dort stehen beim ersten
//       Öffnen noch die Doppelkennungen und das lose Bild zählt nicht. Geöffnet wurde „Zweite".
// R3-2: R-0052 — auch das EINZIGE Bild eines Textes, ursprünglich lose, lässt sich durch Anklicken
//       groß anzeigen. Vorher rendert die Galerie bei leerer Liste nichts und hörte nichts.
//
// Aufbau wie `tests/bildidentitaet/bildklick-doppelte-kennung-mounted.test.tsx`, zusätzlich mit dem
// Rückweg der Galerie zum Editor, verdrahtet wie in `Blatt.tsx` (`onEditCaption` → Bitte).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { DraftBodyGallery } from "../../apps/web/src/components/DraftBodyGallery";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import {
  beschreibungsText,
  beschreibungsfeldOffen,
  mitBildbeschreibung,
} from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

const BILD = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const einheit = (text: string): string =>
  `<figure data-image-id="kw-dup"><img src="${BILD}" alt="${text}" data-image-id="kw-dup"><figcaption data-image-id="kw-dup">${text}</figcaption></figure>`;

/** Bens P1: ein loses Bild vor zwei Einheiten gleicher Quelle und gleicher Kennung. */
const P1 = `<p><img src="${BILD}" alt="lose"></p>${einheit("Erste")}<p>x</p>${einheit("Zweite")}`;
/** Bens P2: der Text enthält genau ein loses Bild. */
const P2 = `<p>Text</p><p><img src="${BILD}" alt="lose"></p>`;

interface Bitte {
  imageId: string;
  src: string;
  index: number;
  koerper?: string | undefined;
  nonce: number;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Seite({ initial }: { initial: string }) {
  const [body, setBody] = useState(initial);
  const [anfrage, setAnfrage] = useState<Bitte | null>(null);
  return mitBildbeschreibung(
    createElement(
      "div",
      null,
      createElement(RichTextEditor, {
        value: body,
        onChange: setBody,
        documentTitle: "Runde 3",
        ...(anfrage ? { captionFormRequest: anfrage } : {}),
      }),
      createElement(DraftBodyGallery, {
        bodyHtml: body,
        onEditCaption: (imageId: string, src: string, index: number, koerper?: string) =>
          setAnfrage((prev) => ({
            imageId,
            src,
            index,
            koerper,
            nonce: (prev?.nonce ?? 0) + 1,
          })),
      }),
    ),
  );
}

function montiere(html: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(createElement(Seite, { initial: html })));
  act(() => vi.advanceTimersByTime(LIBRARY_SEARCH_DEBOUNCE_MS + 20));
}

function editorBilder(): HTMLImageElement[] {
  const flaeche = container.querySelector<HTMLElement>('.prose-kw[contenteditable="true"]');
  if (!flaeche) {
    throw new Error("keine Editorfläche");
  }
  return [...flaeche.querySelectorAll("img")];
}
const dialog = (): HTMLDialogElement | null => container.querySelector("dialog");
const grossesBild = (): HTMLImageElement | null =>
  dialog()?.querySelector<HTMLImageElement>("img.max-h-\\[70vh\\]") ?? null;
const bearbeiten = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="gallery-caption-edit"]');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("R3-1 · vom angeklickten Bild über die Großansicht zur EIGENEN Beschreibung", () => {
  it("Klick auf „Erste“ → Bearbeiten öffnet „Erste“ (vorher: „Zweite“)", () => {
    montiere(P1);
    const bilder = editorBilder();
    expect(bilder).toHaveLength(3);
    act(() => bilder[1]?.click());
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent ?? "").toContain("Erste");
    act(() => bearbeiten()?.click());
    expect(beschreibungsfeldOffen(), "der Bearbeiten-Knopf hat kein Formular geöffnet").toBe(true);
    expect(beschreibungsText()).toBe("Erste");
  });

  it("Klick auf „Zweite“ → Bearbeiten öffnet „Zweite“", () => {
    montiere(P1);
    act(() => editorBilder()[2]?.click());
    expect(dialog()?.textContent ?? "").toContain("Zweite");
    act(() => bearbeiten()?.click());
    expect(beschreibungsfeldOffen()).toBe(true);
    expect(beschreibungsText()).toBe("Zweite");
  });

  it("Klick auf das eingehüllte lose Bild → Bearbeiten öffnet keine fremde Beschreibung", () => {
    montiere(P1);
    act(() => editorBilder()[0]?.click());
    expect(dialog()?.open).toBe(true);
    act(() => bearbeiten()?.click());
    if (beschreibungsfeldOffen()) {
      expect(beschreibungsText()).not.toBe("Erste");
      expect(beschreibungsText()).not.toBe("Zweite");
    }
  });

  it("nach Blättern in der Großansicht gilt das angezeigte Bild", () => {
    montiere(P1);
    act(() => editorBilder()[1]?.click());
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })));
    expect(dialog()?.textContent ?? "").toContain("Zweite");
    act(() => bearbeiten()?.click());
    expect(beschreibungsText()).toBe("Zweite");
  });

  it("verändert sich der Editor zwischen Klick und Bitte, entscheidet die Kennung, nicht die Zählung", () => {
    montiere(P1);
    act(() => editorBilder()[1]?.click());
    expect(dialog()?.textContent ?? "").toContain("Erste");
    // Ein fremder Programmweg fügt vorn ein Bild gleicher Quelle ein (die Großansicht ist modal,
    // eine Nutzereingabe ist das nicht). Die Zählung im Klickkörper zeigte jetzt auf das neue Bild.
    const neu = document.createElement("p");
    neu.innerHTML = `<img src="${BILD}" alt="neu" data-image-id="kw-neu">`;
    editorBilder()[0]?.closest("p, figure")?.before(neu);
    act(() => bearbeiten()?.click());
    expect(beschreibungsfeldOffen()).toBe(true);
    expect(beschreibungsText()).toBe("Erste");
  });

  it("über eine Kachel geöffnet gilt weiter der Galeriekörper (Bestandsweg)", () => {
    montiere(P1);
    const kacheln = container.querySelectorAll<HTMLButtonElement>(
      "button[aria-label]:has(img.h-16)",
    );
    expect(kacheln).toHaveLength(2);
    act(() => kacheln[0]?.click());
    act(() => bearbeiten()?.click());
    expect(beschreibungsText()).toBe("Erste");
  });
});

describe("R3-2 · R-0052: das einzige, ursprünglich lose Bild lässt sich groß anzeigen", () => {
  it("Vorbedingung: der Editor hat das Bild verankert, die Galerie zeigt keine Kachel", () => {
    montiere(P2);
    const [bild] = editorBilder();
    expect(bild?.getAttribute("data-image-id")).toBeTruthy();
    expect(container.querySelectorAll("img.h-16")).toHaveLength(0);
    expect(container.textContent ?? "").not.toContain("Bildergalerie");
  });

  it("Klick öffnet die Großansicht dieses Bildes (vorher: kein Dialog)", () => {
    montiere(P2);
    act(() => editorBilder()[0]?.click());
    expect(dialog()?.open, "der Klick hat die Großansicht nicht geöffnet").toBe(true);
    expect(grossesBild()?.getAttribute("src")).toBe(BILD);
  });

  it("Schließen räumt auf: kein Dialog, keine Kachel", () => {
    montiere(P2);
    act(() => editorBilder()[0]?.click());
    act(() => (dialog() as HTMLDialogElement).close());
    expect(dialog()).toBeNull();
    expect(container.querySelectorAll("img.h-16")).toHaveLength(0);
  });
});
