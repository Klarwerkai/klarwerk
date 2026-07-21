// @vitest-environment jsdom
// Teil C1 (bens P2-Nacharbeit): Lightbox-Fokus bei Vor/Zurück. Vorher sprang der Fokus bei JEDER
// Navigation auf den Schließen-Knopf; und lief der fokussierte Navigations-Knopf am Rand auf
// disabled, fiel der Fokus auf body (Verlust). Jetzt: Fokus bleibt beim navigierenden Knopf,
// solange er bedienbar ist; am Rand wandert er zum Gegenknopf — nie aus dem Dialog heraus.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { BodyImageGallery } from "../../apps/web/src/components/BodyImageGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom-Polyfill für <dialog> (Muster body-image-gallery-mounted): nur open/close + close-Event.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  configurable: true,
  get(this: HTMLDialogElement) {
    return this.hasAttribute("open");
  },
});

const figure = (id: string, caption: string): string =>
  `<figure><img data-image-id="${id}" src="data:image/png;base64,QQ=="><figcaption data-image-id="${id}">${caption}</figcaption></figure>`;

const THREE = `${figure("kw-a", "Eins")}${figure("kw-b", "Zwei")}${figure("kw-c", "Drei")}`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(bodyHtml: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(BodyImageGallery, { bodyHtml }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function byLabelPart(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("dialog button")].find((b) =>
    (b.getAttribute("aria-label") ?? "").toLowerCase().includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf ${part} nicht gefunden`);
  }
  return btn;
}

function openLightbox(index: number): void {
  const thumbs = container.querySelectorAll("div.grid button");
  act(() => {
    (thumbs[index] as HTMLButtonElement).click();
  });
}

describe("Teil C1: Lightbox-Fokus bei Vor/Zurück", () => {
  it("mitten in der Liste bleibt der Fokus auf dem navigierenden Knopf (kein Sprung zum Schließen)", () => {
    mount(THREE);
    openLightbox(0);
    const next = byLabelPart("chste"); // galleryNext: „Nächstes Bild" / next
    act(() => {
      next.focus();
      next.click(); // 0 → 1: next bleibt bedienbar
    });
    expect(document.activeElement).toBe(next);
  });

  it("am Rand wandert der Fokus zum Gegenknopf statt zu verschwinden", () => {
    mount(THREE);
    openLightbox(1);
    const next = byLabelPart("chste");
    const prev = byLabelPart("vorheriges");
    act(() => {
      next.focus();
      next.click(); // 1 → 2 (letztes Bild): next wird disabled, Fokus fiele auf body
    });
    expect(next.disabled).toBe(true);
    expect(document.activeElement).toBe(prev); // Gegenknopf übernimmt — kein Fokus-Verlust
    act(() => {
      prev.click(); // 2 → 1: prev bleibt bedienbar, Fokus bleibt dort
    });
    expect(document.activeElement).toBe(prev);
  });

  it("beim ÖFFNEN liegt der Fokus weiterhin auf dem Schließen-Knopf (WP-D9c unverändert)", () => {
    mount(THREE);
    openLightbox(1);
    expect(document.activeElement).toBe(byLabelPart("schließen"));
  });
});
