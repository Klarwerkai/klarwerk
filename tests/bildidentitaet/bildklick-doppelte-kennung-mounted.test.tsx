// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · R-0945 / R-0053 — DER KÖRPERKLICK TRIFFT GENAU DAS ANGEKLICKTE VORKOMMEN.
// ================================================================================================
//
// R-0945 wörtlich: „Klickt jemand im Dokumentkörper auf ein Bild, muss der Editor genau dieses Bild
// in der Galerie öffnen. Bisher konnte bei gleicher Bildkennung der erste Treffer geöffnet werden."
// R-0053: „Enthält ein Text mehrere gleiche Bilder, muss der Klick die Großansicht des tatsächlich
// angeklickten Vorkommens öffnen, nicht irgendeines."
//
// DIE LAGE, in der das zählt: ein gespeicherter Text mit zwei Bildern unter DERSELBEN Kennung. Der
// Editor trennt sie beim Laden (JOB 3035/3051), speichert dabei aber absichtlich nichts. Die
// Galerie liest den zuletzt gemeldeten Körper — dort steht die Doppelung also noch. Gemessen wird
// am Produktaufbau aus `tests/web/d44-bild-klick-grossansicht.test.tsx`: Editor und
// `DraftBodyGallery` als Geschwister, mit dem Provider, den das Produkt setzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = () => vi.fn(async () => []);
  const basis: Record<string, unknown> = {
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "cloud", reachable: "off" })),
      config: vi.fn(async () => null),
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({ text: "", demo: true })),
      describe: vi.fn(async () => ({ text: "", demo: true })),
    },
  };
  const endpoints = new Proxy(basis, {
    get: (t, p) => (p in t ? t[p as string] : new Proxy({}, { get: () => leer() })),
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import {
  type D44BildEreignis,
  galerieIndexFuerBildklick,
} from "../../apps/web/src/components/BodyImageGallery";
import { DraftBodyGallery } from "../../apps/web/src/components/DraftBodyGallery";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import "../../apps/web/src/i18n";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";

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

const BILD_A = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const BILD_B = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICVAEAOw==";

const einheit = (src: string, text: string): string =>
  `<figure data-image-id="kw-dup"><img src="${src}" alt="${text}" data-image-id="kw-dup"><figcaption data-image-id="kw-dup">${text}</figcaption></figure>`;

/** Zwei verschiedene Bilder unter derselben Kennung (kopierte Einheit, Quelle danach getauscht). */
const VERSCHIEDEN = `<p>Vorher</p>${einheit(BILD_A, "Erste")}<p>Dazwischen</p>${einheit(BILD_B, "Zweite")}`;
/** R-0053: dasselbe Bild zweimal, dieselbe Kennung — unterscheidbar nur an der Beschreibung. */
const GLEICH = `${einheit(BILD_A, "Erste")}<p>Dazwischen</p>${einheit(BILD_A, "Zweite")}`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Seite({ initial }: { initial: string }) {
  const [body, setBody] = useState(initial);
  return createElement(
    "div",
    null,
    createElement(RichTextEditor, { value: body, onChange: setBody, documentTitle: "R-0945" }),
    createElement(DraftBodyGallery, { bodyHtml: body }),
  );
}

function montiere(html: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(ImageDescribeProvider, null, createElement(Seite, { initial: html })),
      ),
    ),
  );
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
const zaehler = (): string => dialog()?.querySelector("span.font-mono")?.textContent ?? "";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("R-0945 · der Körperklick bei doppelter Kennung öffnet das angeklickte Bild", () => {
  it("V0 · Vorbedingung: der Editor hat getrennt, die Galerie sieht die Doppelung noch", () => {
    montiere(VERSCHIEDEN);
    const [erstes, zweites] = editorBilder();
    expect(erstes?.getAttribute("data-image-id")).toBe("kw-dup");
    expect(zweites?.getAttribute("data-image-id")).not.toBe("kw-dup");
    // Die Galerie zeigt zwei Kacheln — beide aus dem ungetrennten Körper.
    expect(container.querySelectorAll("button[aria-label] img.h-16").length).toBe(2);
  });

  it("V1 · Klick auf das ZWEITE Bild öffnet das zweite (vorher: nichts)", () => {
    montiere(VERSCHIEDEN);
    act(() => editorBilder()[1]?.click());
    expect(dialog()?.open, "der Klick hat die Großansicht nicht geöffnet").toBe(true);
    expect(grossesBild()?.getAttribute("src")).toBe(BILD_B);
  });

  it("V2 · Klick auf das ERSTE Bild öffnet das erste — nicht zufällig, sondern über die Position", () => {
    montiere(VERSCHIEDEN);
    act(() => editorBilder()[0]?.click());
    expect(dialog()?.open).toBe(true);
    expect(grossesBild()?.getAttribute("src")).toBe(BILD_A);
  });

  it("V3 · R-0053: dasselbe Bild zweimal — der Klick öffnet das angeklickte Vorkommen", () => {
    montiere(GLEICH);
    act(() => editorBilder()[1]?.click());
    expect(dialog()?.open).toBe(true);
    expect(zaehler()).toMatch(/2/);
    expect(dialog()?.textContent ?? "").toContain("Zweite");
    expect(dialog()?.textContent ?? "").not.toContain("Erste");
  });
});

describe("R-0053 · Runde 2 (Bens Befund B1): Editor und Galerie zählen verschiedene Mengen", () => {
  // Bens Fall G5: ein LOSES Bild vor zwei Einheiten mit gleicher Quelle und Kennung. Der Editor
  // hüllt das lose Bild ein und zählt es mit, die Galerie nicht. Die Positionen verrutschen, und
  // bei gleicher Quelle bestätigte die Quelle ein falsches Vorkommen.
  const G5 = `<p><img src="${BILD_A}" alt="lose"></p>${GLEICH}`;

  it("B1a · Klick auf das Bild „Erste“ öffnet „Erste“ (vorher: „Bild 2 von 2 — Zweite“)", () => {
    montiere(G5);
    const bilder = editorBilder();
    expect(bilder).toHaveLength(3);
    act(() => bilder[1]?.click());
    expect(dialog()?.open, "der Klick hat die Großansicht nicht geöffnet").toBe(true);
    // Runde 3: gezählt wird im Editorstand, dort steht das eingehüllte lose Bild vorn.
    expect(zaehler()).toMatch(/2\D+3/);
    expect(dialog()?.textContent ?? "").toContain("Erste");
    expect(dialog()?.textContent ?? "").not.toContain("Zweite");
  });

  it("B1b · Klick auf das Bild „Zweite“ öffnet „Zweite“", () => {
    montiere(G5);
    act(() => editorBilder()[2]?.click());
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent ?? "").toContain("Zweite");
    expect(dialog()?.textContent ?? "").not.toContain("Erste");
  });

  it("B1c · Klick auf das eingehüllte lose Bild öffnet dieses Bild — nicht „Erste“ oder „Zweite“", () => {
    // Runde 3: Die Großansicht wird aus dem Editorstand aufgebaut. Dort hat der Editor das lose Bild
    // eingehüllt und verankert — es ist ein eigenes Bild, und genau das öffnet der Klick.
    montiere(G5);
    act(() => editorBilder()[0]?.click());
    expect(dialog()?.open).toBe(true);
    expect(zaehler()).toMatch(/1\D+3/);
    expect(dialog()?.textContent ?? "").not.toContain("Erste");
    expect(dialog()?.textContent ?? "").not.toContain("Zweite");
  });
});

const flaeche = (): HTMLElement => {
  const el = container.querySelector<HTMLElement>('.prose-kw[contenteditable="true"]');
  if (!el) {
    throw new Error("keine Editorfläche");
  }
  return el;
};

const paar = (id: string, text: string): string =>
  `<figure data-image-id="${id}"><img src="${BILD_A}" data-image-id="${id}"><figcaption data-image-id="${id}">${text}</figcaption></figure>`;

describe("R-0053 · Runde 3 (Bens Befunde N1/N2): kein anderes Vorkommen, auch nicht in Nachbarlagen", () => {
  it("N1 · erstes Bild gelöscht, Galerie noch nicht nachgezogen: Klick auf das verbliebene öffnet „Zweite“", () => {
    montiere(`${paar("a", "Erste")}<p>x</p>${paar("b", "Zweite")}`);
    act(() => {
      editorBilder()[0]?.closest("figure")?.remove();
      flaeche().dispatchEvent(new Event("input", { bubbles: true }));
    });
    // Die Galerie steht noch auf dem alten Körper (Verzögerung nicht abgelaufen).
    expect(container.querySelectorAll("button[aria-label] img.h-16").length).toBe(2);
    const bilder = editorBilder();
    expect(bilder).toHaveLength(1);
    act(() => bilder[0]?.click());
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent ?? "").toContain("Zweite");
    expect(dialog()?.textContent ?? "", "die Beschreibung des GELÖSCHTEN Bildes").not.toContain(
      "Erste",
    );
  });

  it("N2 · ein Bild innerhalb einer losen Fußnote verfälscht die Auswahl späterer Bilder nicht", () => {
    montiere(
      `<figcaption><img src="${BILD_A}" alt="in der Fußnote"></figcaption>${paar("e1", "Erste")}<p>x</p>${paar("e2", "Zweite")}`,
    );
    const erste = editorBilder().find((b) => b.getAttribute("data-image-id") === "e1");
    const zweite = editorBilder().find((b) => b.getAttribute("data-image-id") === "e2");
    act(() => erste?.click());
    expect(dialog()?.open).toBe(true);
    expect(dialog()?.textContent ?? "").toContain("Erste");
    expect(dialog()?.textContent ?? "").not.toContain("Zweite");
    act(() => (dialog() as HTMLDialogElement).close());
    act(() => zweite?.click());
    expect(dialog()?.textContent ?? "").toContain("Zweite");
    expect(dialog()?.textContent ?? "").not.toContain("Erste");
  });

  it("N2b · Klick auf das Bild INNERHALB der Fußnote öffnet weder „Erste“ noch „Zweite“", () => {
    montiere(
      `<figcaption><img src="${BILD_A}" alt="in der Fußnote"></figcaption>${paar("e1", "Erste")}<p>x</p>${paar("e2", "Zweite")}`,
    );
    const innen = editorBilder().find((b) => b.closest("figcaption") !== null);
    expect(innen, "Vorbedingung: ein Bild steht in einer Fußnote").toBeDefined();
    act(() => innen?.click());
    const text = dialog()?.textContent ?? "";
    expect(text).not.toContain("Erste");
    expect(text).not.toContain("Zweite");
  });

  it("nach dem Schließen zeigt die Galerie wieder ihren eigenen Stand", () => {
    montiere(`${paar("a", "Erste")}<p>x</p>${paar("b", "Zweite")}`);
    act(() => editorBilder()[1]?.click());
    act(() => (dialog() as HTMLDialogElement).close());
    expect(dialog()).toBeNull();
    expect(container.querySelectorAll("button[aria-label] img.h-16").length).toBe(2);
  });
});

describe("galerieIndexFuerBildklick · die Auflösung ohne Raten", () => {
  const liste = [
    { id: "kw-a", src: "a", caption: "Erste" },
    { id: "kw-b", src: "a", caption: "Zweite" },
    { id: "kw-dup", src: "c", caption: "Dritte" },
    { id: "kw-dup", src: "c", caption: "Vierte" },
  ];
  const bitte = (imageId: string): D44BildEreignis => ({ imageId, nonce: 1 });

  it("A1 · eine in der Liste eindeutige Kennung entscheidet — die Quelle spielt keine Rolle", () => {
    expect(galerieIndexFuerBildklick(liste, bitte("kw-a"))).toBe(0);
    expect(galerieIndexFuerBildklick(liste, bitte("kw-b"))).toBe(1);
  });

  it("A2 · doppelte oder fehlende Kennung: es öffnet sich nichts", () => {
    expect(galerieIndexFuerBildklick(liste, bitte("kw-dup"))).toBe(-1);
    expect(galerieIndexFuerBildklick(liste, bitte("kw-weg"))).toBe(-1);
  });
});
