// @vitest-environment jsdom
// ================================================================================================
// JOB 1890 · D3 (M-4, Anker D44-BILD-KLICK) — DER KLICK AUF EIN GEDECKELTES BILD.
// ================================================================================================
//
// Seit `4eba61c` deckelt `apps/web/src/index.css:132` die Bildhoehe im schreibenden Editor:
//
//   .prose-kw[contenteditable="true"] img { max-height: 320px; }
//
// **Der Deckel allein waere eine Verschlechterung** — ein Bild waere gedeckelt UND nicht mehr gross
// zu sehen. Weg (a) (`ENTSCHEIDUNGEN/JOB-1620.md`) schliesst das: Ein Klick auf genau dieses Bild
// oeffnet die vorhandene, ben-abgenommene `BodyImageGallery`-Grossansicht.
//
// ================================================================================================
// DIE REGEL, DIE DIESE DATEI IN D1 GEKOSTET HAT:
// ================================================================================================
//
//   **Ein Wegtest, der die Produktionskomposition nicht nachbildet, misst nicht das Produkt,
//   sondern die Buehne.**
//
// In D1 fielen alle sechs Faelle — nicht an ihrem Inhalt, sondern schon im `beforeEach`:
// `RichTextEditor.tsx:311` ruft `useImageDescribe()`, und dieser Hook WIRFT ohne Provider
// (`apps/web/src/app/ImageDescribeContext.tsx:79-84`, fail-closed und mit Absicht). Der Test
// hatte den Editor nicht gewickelt — das Produkt tut es (`CaptureFrontDoor.tsx:887`).
//
// DESHALB MOUNTET DIESE DATEI DIE PRODUKTIONSKOMPOSITION, Glied fuer Glied belegt:
//
//   <QueryClientProvider>        weil ImageDescribeProvider -> useAiAvailable -> useReasonerStatus
//                                (apps/web/src/lib/useAiAvailable.tsx:17) React Query braucht
//     <ImageDescribeProvider>    wie apps/web/src/pages/CaptureFrontDoor.tsx:887
//       <RichTextEditor/>        wie CaptureFrontDoor.tsx:888  / Capture.tsx:5416
//       <DraftBodyGallery/>      wie CaptureFrontDoor.tsx:903  / Capture.tsx:5427 — GESCHWISTER
//
// `DraftBodyGallery` ist nicht wegzulassen: Sie haelt den 300-ms-Debounce, den die Galerie
// darunter sieht (`DraftBodyGallery.tsx:28`). Ein Test ohne sie misst einen Weg, den es nicht gibt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `useReasonerStatus` fragt `endpoints.reasoner.status` ab. Ohne Antwort bliebe der Provider im
// Ladezustand und der Editor rendert nie fertig — derselbe Klassenfehler wie der fehlende Provider.
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
import { DraftBodyGallery } from "../../apps/web/src/components/DraftBodyGallery";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import "../../apps/web/src/i18n";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// jsdom kennt `showModal`/`close` nicht. Ohne die Stubs bliebe `dialog.open` false, und der Test
// maesse die jsdom-Luecke statt des Wegs.
if (typeof HTMLDialogElement !== "undefined") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// Zwei unterscheidbare Bilder — die Quellen differieren im letzten Datenblock. Genau daran zeigt
// sich, ob das RICHTIGE Bild geoeffnet wurde.
const BILD_A = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const BILD_B = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICVAEAOw==";

/** Zwei VERANKERTE Bilder plus eines OHNE Kennung — der fail-closed-Fall. */
const DOKUMENT = [
  "<p>Vorher</p>",
  `<figure><img src="${BILD_A}" alt="Aufriss" data-image-id="bild-a"><figcaption data-image-id="bild-a">Aufriss</figcaption></figure>`,
  "<p>Dazwischen</p>",
  `<figure><img src="${BILD_B}" alt="Schnitt" data-image-id="bild-b"><figcaption data-image-id="bild-b">Schnitt</figcaption></figure>`,
  `<p><img src="${BILD_A}" alt="ohne Kennung"></p>`,
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/** Editor und Galerie als Geschwister — die Anordnung beider Produktionsseiten. */
function Seite({ initial }: { initial: string }) {
  const [body, setBody] = useState(initial);
  return createElement(
    "div",
    null,
    createElement(RichTextEditor, { value: body, onChange: setBody, documentTitle: "D44" }),
    createElement(DraftBodyGallery, { bodyHtml: body }),
  );
}

/** Die Editorflaeche traegt `prose-kw` UND `contenteditable` — genau der Selektor des Deckels. */
function editorFlaeche(): HTMLElement {
  const el = container.querySelector<HTMLElement>('.prose-kw[contenteditable="true"]');
  if (!el) {
    throw new Error("keine gedeckelte Editorflaeche (.prose-kw[contenteditable=true])");
  }
  return el;
}
const editorBilder = (): HTMLImageElement[] => [...editorFlaeche().querySelectorAll("img")];
const dialog = (): HTMLDialogElement | null => container.querySelector("dialog");
const grossesBild = (): HTMLImageElement | null =>
  dialog()?.querySelector<HTMLImageElement>("img.max-h-\\[70vh\\]") ?? null;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        // DER WIRT, DER IN D1 FEHLTE. `provenance` ist optional
        // (apps/web/src/app/ImageDescribeContext.tsx:97).
        createElement(ImageDescribeProvider, null, createElement(Seite, { initial: DOKUMENT })),
      ),
    ),
  );
  // Die Galerie sieht `debounced` (300 ms). Ohne dieses Vorspulen kennt sie die Bilder noch nicht,
  // `findIndex` greift nicht, und der Klick oeffnete nichts — der Test maesse den Debounce.
  act(() => vi.advanceTimersByTime(LIBRARY_SEARCH_DEBOUNCE_MS + 20));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("D44-BILD-KLICK · Weg (a) am gedeckelten Editorbild", () => {
  it("K1 · BILDIDENTITAET: Klick auf das ZWEITE Bild oeffnet GENAU dieses", () => {
    // Der Kern des Auftrags. Nicht „eine Galerie geht auf", sondern: die geoeffnete Quelle ist
    // die des angeklickten Bildes.
    const bilder = editorBilder();
    expect(bilder.length, "der Entwurf traegt nicht drei Bilder").toBe(3);
    expect(bilder[1]?.getAttribute("src"), "Aufbaufehler: Bild 2 ist nicht BILD_B").toBe(BILD_B);
    expect(dialog()?.open ?? false, "die Grossansicht war schon offen").toBe(false);

    act(() => bilder[1]?.click());

    expect(dialog()?.open, "der Klick hat die Grossansicht nicht geoeffnet").toBe(true);
    expect(grossesBild()?.getAttribute("src"), "es wurde das FALSCHE Bild geoeffnet").toBe(BILD_B);
  });

  it("K2 · das ERSTE Bild oeffnet ebenfalls sich selbst — die Zuordnung ist keine Konstante", () => {
    // Gegenprobe zu K1: Ein Weg, der stumpf `0` oeffnet, waere in K1 rot und hier gruen. Beide
    // Faelle zusammen schliessen jede feste Zuordnung aus.
    act(() => editorBilder()[0]?.click());
    expect(dialog()?.open).toBe(true);
    expect(grossesBild()?.getAttribute("src")).toBe(BILD_A);
  });

  it("K3 · nach dem Schliessen oeffnet DASSELBE Bild erneut", () => {
    // Ohne Ereigniskennung (`nonce`) bliebe die zweite Bitte stumm, weil sich der Wert nicht
    // geaendert haette — der Nutzer klickt, und nichts passiert.
    const bild = editorBilder()[1];
    act(() => bild?.click());
    act(() => dialog()?.close());
    expect(dialog()?.open ?? false).toBe(false);

    act(() => bild?.click());
    expect(dialog()?.open, "der zweite Klick auf dasselbe Bild blieb stumm").toBe(true);
    expect(grossesBild()?.getAttribute("src")).toBe(BILD_B);
  });

  it("K4 · fail-closed: ein Bild OHNE data-image-id oeffnet nichts", () => {
    // Nur verankerte Bilder stehen in der Galerie (`apps/web/src/lib/bodyImages.ts`). Eine leere
    // Grossansicht waere schlimmer als keine.
    act(() => editorBilder()[2]?.click());
    expect(dialog()?.open ?? false, "ein Bild ohne Kennung hat geoeffnet").toBe(false);
  });

  it("K5 · der Editorinhalt bleibt unberuehrt — der Deckel begrenzt die Anzeige, nicht die Datei", () => {
    const vorher = editorFlaeche().innerHTML;
    const bild = editorBilder()[1];

    act(() => bild?.click());
    act(() => dialog()?.close());

    expect(editorFlaeche().innerHTML, "der Editorinhalt hat sich geaendert").toBe(vorher);
    // JOB 1890 D13 — DIESE ZUSICHERUNG WAR RICHTIG GEMEINT UND FALSCH GEMESSEN.
    //
    // Hier stand `expect(vorher).not.toContain("tabindex")`. Zwei Fehler in einer Zeile:
    //   1. `vorher` wird oben VOR dem Klick gelesen. Ein Attribut, das der Klick setzt, kann
    //      darin gar nicht vorkommen — die Zeile konnte den gemeinten Fall nie treffen.
    //   2. Sie fand stattdessen ein FREMDES `tabindex`: `enhanceFiguresForEditing` macht jede
    //      Bild-Fussnote fokussierbar (`editorFigures.ts:1081`, `caption.setAttribute(
    //      "tabindex", "0")`, AUFTRAG-mega84 — der Tastaturweg zur Bildbeschreibung). Das steht
    //      seit mega84 im Inhalt, ist gewollt und hat mit dem Bildklick nichts zu tun.
    //
    // Die Zusicherung bleibt und wird schaerfer: Das Hilfsattribut des BILDKLICKS darf nach dem
    // Schliessen nicht am Bild zurueckbleiben — geprueft am Endzustand statt am Vorzustand.
    // Die Zeile darueber deckt weiterhin JEDE Inhaltsaenderung ab, auch eine unbekannte.
    expect(bild?.outerHTML, "ein Hilfsattribut ist am Bild geblieben").not.toContain("tabindex");
    expect(vorher).toContain(BILD_B);
  });

  it("K6 · der Fokus kehrt zum angeklickten Bild zurueck, das Hilfsattribut wird abgeraeumt", () => {
    const bild = editorBilder()[1];
    act(() => bild?.click());
    expect(bild?.getAttribute("tabindex"), "das Bild ist nicht fokussierbar gemacht").toBe("-1");

    act(() => dialog()?.close());
    expect(document.activeElement, "der Fokus ging nicht zum Bild zurueck").toBe(bild);
    expect(bild?.hasAttribute("tabindex"), "das Hilfsattribut blieb stehen").toBe(false);
  });
});
