// @vitest-environment jsdom
// AUFNAHME 20260922 · BILDBESCHREIBUNG-BEDIENUNG (R-0899) — DIE GROSSANSICHT ZEIGT IHREN LADEZUSTAND.
//
// R-0899: „Die Galerie zeigt ihren Ladezustand und lässt sich mit der Tastatur bedienen." Vor dieser
// Lieferung stand die Großansicht leer, bis das Bild kam — und ein Bild, das nie kam, sah genauso
// aus. Gemessen wird am gemounteten Produktpfad (echte Kachel, echte Pfeiltaste, echte load/error-
// Ereignisse am <img> der Großansicht). jsdom lädt keine Bilder; die Ereignisse werden deshalb
// ausdrücklich ausgelöst — genau das, was der Browser beim Eintreffen oder Scheitern meldet.
//
// GRENZE: belegt ist der DOM-Vertrag (sichtbarer Text, `aria-busy`, kein zweiter Live-Bereich) —
// nicht, wie eine Sprachausgabe `aria-busy` tatsächlich vorträgt.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { BodyImageGallery } from "../../apps/web/src/components/BodyImageGallery";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom-Polyfill für <dialog> (Muster body-image-gallery-mounted): nur open/close + close-Ereignis.
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

const figure = (id: string, src: string, caption: string): string =>
  `<figure><img data-image-id="${id}" src="${src}"><figcaption data-image-id="${id}">${caption}</figcaption></figure>`;

const ZWEI =
  `${figure("kw-a", "data:image/png;base64,QQ==", "Ventil V2")}` +
  `${figure("kw-b", "data:image/jpeg;base64,Qg==", "Dichtung")}`;

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

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

function oeffne(index: number): void {
  const kachel = container.querySelectorAll("div.grid button")[index];
  if (!(kachel instanceof HTMLButtonElement)) {
    throw new Error(`Kachel ${index} nicht gefunden`);
  }
  act(() => kachel.click());
}

function grossbild(): HTMLImageElement {
  const bild = container.querySelector("dialog img");
  if (!(bild instanceof HTMLImageElement)) {
    throw new Error("Großansicht ohne Bild");
  }
  return bild;
}

function melde(art: "load" | "error"): void {
  act(() => {
    grossbild().dispatchEvent(new Event(art));
  });
}

const status = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="gallery-image-status"]');

const traeger = (): HTMLElement | null => grossbild().parentElement;

describe("R-0899 · die Großansicht zeigt ihren Ladezustand", () => {
  it("L1: geöffnet und noch nicht geladen → sichtbarer Ladetext, Bildbereich `aria-busy`", () => {
    mount(ZWEI);
    oeffne(0);
    expect(status()?.dataset.ladestand).toBe("laedt");
    expect(status()?.textContent).toBe(i18n.t("bildergalerie.laedt"));
    expect(traeger()?.getAttribute("aria-busy")).toBe("true");
  });

  it("L2: das Bild trifft ein → kein Ladetext mehr, `aria-busy` aus, Fußnote bleibt", () => {
    mount(ZWEI);
    oeffne(0);
    melde("load");
    expect(status()).toBeNull();
    expect(traeger()?.getAttribute("aria-busy")).toBe("false");
    expect(container.querySelector("dialog")?.textContent).toContain("Ventil V2");
  });

  it("L3: das Bild scheitert → eigener Fehlertext statt endlosem Laden", () => {
    mount(ZWEI);
    oeffne(0);
    melde("error");
    expect(status()?.dataset.ladestand).toBe("fehler");
    expect(status()?.textContent).toBe(i18n.t("bildergalerie.ladefehler"));
    expect(traeger()?.getAttribute("aria-busy")).toBe("false");
  });

  it("L4: Blättern mit der Pfeiltaste → das NEUE Bild lädt, der Stand des alten gilt nicht weiter", () => {
    mount(ZWEI);
    oeffne(0);
    melde("load");
    expect(status()).toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });
    expect(container.querySelector("dialog span.font-mono")?.textContent).toMatch(/2\D+2/);
    expect(status()?.dataset.ladestand).toBe("laedt");
    melde("load");
    expect(status()).toBeNull();
    // Zurück zum ersten Bild: seine Quelle ist schon bekannt geladen — der Browser meldet es erneut.
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });
    expect(status()?.dataset.ladestand).toBe("laedt");
    melde("load");
    expect(status()).toBeNull();
  });

  it("L5: der Ladetext ist KEIN zweiter Live-Bereich — im Modal spricht weiter genau einer", () => {
    mount(ZWEI);
    oeffne(0);
    expect(status()?.hasAttribute("aria-live")).toBe(false);
    expect(status()?.getAttribute("role")).toBeNull();
    const gefuellt = [...container.querySelectorAll("[aria-live]")].filter(
      (e) => (e.textContent ?? "").trim().length > 0,
    );
    expect(gefuellt).toHaveLength(1);
  });

  it("L6: die Beschriftung folgt dem Sprachwechsel (de → en → nl)", async () => {
    mount(ZWEI);
    oeffne(0);
    expect(status()?.textContent).toBe("Bild wird geladen …");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(status()?.textContent).toBe("Loading image …");
    melde("error");
    expect(status()?.textContent).toBe("The image could not be loaded.");
    await act(async () => {
      await i18n.changeLanguage("nl");
    });
    expect(status()?.textContent).toBe("De afbeelding kon niet worden geladen.");
  });
});
