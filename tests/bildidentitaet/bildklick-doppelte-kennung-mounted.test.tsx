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
    expect(zaehler()).toMatch(/1/);
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

  it("B1c · das lose Bild ist in der Galerie nicht vertreten — sein Klick öffnet nichts", () => {
    montiere(G5);
    act(() => editorBilder()[0]?.click());
    expect(dialog()?.open ?? false, "es wurde auf Verdacht ein anderes Bild geöffnet").toBe(false);
  });
});

describe("galerieIndexFuerBildklick · die Auflösung ohne Raten", () => {
  const liste = [
    { id: "kw-dup", src: "a", caption: "Erste" },
    { id: "kw-dup", src: "a", caption: "Zweite" },
    { id: "kw-eins", src: "c", caption: "Dritte" },
  ];
  // „a“ steht im Körper dreimal: zuerst lose (nicht in der Galerie), dann die beiden Einträge.
  const vorkommen = [1, 2, 0];
  const bitte = (d: Partial<D44BildEreignis>): D44BildEreignis => ({
    imageId: "",
    nonce: 1,
    ...d,
  });

  it("A1 · Quelle und Vorkommen entscheiden — nicht die Position", () => {
    expect(galerieIndexFuerBildklick(liste, vorkommen, bitte({ src: "a", vorkommen: 1 }))).toBe(0);
    expect(galerieIndexFuerBildklick(liste, vorkommen, bitte({ src: "a", vorkommen: 2 }))).toBe(1);
    expect(galerieIndexFuerBildklick(liste, vorkommen, bitte({ src: "c", vorkommen: 0 }))).toBe(2);
  });

  it("A2 · ein Vorkommen, das in der Galerie nicht steht, öffnet nichts — auch bei passender Kennung", () => {
    expect(
      galerieIndexFuerBildklick(
        liste,
        vorkommen,
        bitte({ imageId: "kw-eins", src: "a", vorkommen: 0 }),
      ),
    ).toBe(-1);
  });

  it("A3 · ohne Vorkommen gilt nur eine hier eindeutige Kennung", () => {
    expect(galerieIndexFuerBildklick(liste, vorkommen, bitte({ imageId: "kw-eins" }))).toBe(2);
    expect(galerieIndexFuerBildklick(liste, vorkommen, bitte({ imageId: "kw-dup" }))).toBe(-1);
  });
});
