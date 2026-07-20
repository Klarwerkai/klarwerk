import { afterEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// WP-BILD-1d: GEMOUNTETE Galerie-Render-Logik (gleiche Mount-Infra wie WP-D8b: react-dom/client +
// react.act aus apps/web/node_modules, createElement statt JSX — keine neue devDependency).
// Getestet: n Bilder → n Thumbnails; 0 Bilder → KEIN Abschnitt; Klick öffnet die Großansicht mit der
// AKTUELLEN Body-Fußnote; Escape schließt und der Fokus kehrt zum auslösenden Thumbnail zurück.
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { BodyImageGallery } from "../../apps/web/src/components/BodyImageGallery";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// WP-D9c: jsdom implementiert showModal()/close() des <dialog> nicht (wirft „not implemented") —
// MINIMALER Test-Polyfill, der nur das offene/geschlossene Verhalten + close-Ereignis nachbildet.
// Der PRODUKTCODE nutzt die echte API (showModal → Top-Layer + native Fokusfalle im Browser).
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

function figure(id: string, src: string, caption: string): string {
  return `<figure><img data-image-id="${id}" src="${src}"><figcaption data-image-id="${id}">${caption}</figcaption></figure>`;
}

const TWO_IMAGES =
  `<p>Anfang</p>${figure("kw-img-t1-1", "data:image/png;base64,QQ==", "Erstes Bild")}` +
  `${figure("kw-img-t1-2", "data:image/jpeg;base64,QQ==", "Zweites Bild")}<p>Ende</p>`;

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

describe("WP-BILD-1d: gemountete Galerie", () => {
  it("zwei Body-Bilder → zwei Thumbnails; Klick öffnet die Großansicht mit aktueller Fußnote", () => {
    mount(TWO_IMAGES);
    const thumbs = container.querySelectorAll("button img");
    expect(thumbs.length).toBe(2);
    // alt-Text kommt aus der Caption (Barrierefreiheit).
    expect(thumbs[0]?.getAttribute("alt")).toBe("Erstes Bild");

    const firstThumb = container.querySelectorAll("button")[0];
    act(() => {
      (firstThumb as HTMLButtonElement).click();
    });
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    // WP-D9c: ECHTES Modal — showModal() wurde gerufen (open-Attribut via Polyfill) …
    expect(dialog?.hasAttribute("open")).toBe(true);
    // … und der Fokus ist in den Dialog EINGEZOGEN (Schließen-Knopf).
    const closeBtn = dialog?.querySelector("button");
    expect(document.activeElement).toBe(closeBtn);
    // Großansicht zeigt Bild 1 von 2 + die AKTUELLE figcaption aus dem Body (keine Kopie).
    expect(dialog?.textContent).toContain("Erstes Bild");
    expect(dialog?.textContent).toMatch(/1.*2/);
  });

  it("Vor/Zurück blättert; die Fußnote folgt dem angezeigten Bild", () => {
    mount(TWO_IMAGES);
    act(() => {
      (container.querySelectorAll("button")[0] as HTMLButtonElement).click();
    });
    const dialog = () => container.querySelector("dialog");
    const buttons = () => [...(dialog()?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];
    // Buttons im Dialog: Schließen, Zurück, Vor — „Vor" ist der letzte.
    const next = buttons()[buttons().length - 1];
    act(() => {
      next?.click();
    });
    expect(dialog()?.textContent).toContain("Zweites Bild");
    expect(dialog()?.textContent).not.toContain("Erstes Bild");
  });

  it("Escape (nativer cancel-Pfad) schließt; Fokus kehrt zum auslösenden Thumbnail zurück", () => {
    mount(TWO_IMAGES);
    const secondThumb = container.querySelectorAll("button")[1] as HTMLButtonElement;
    act(() => {
      secondThumb.click();
    });
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    // WP-D9c: Escape läuft im echten Browser nativ als cancel-Ereignis des modalen Dialogs — genau
    // dieses Ereignis wird hier gefeuert; der Handler schließt über die native close()-API.
    act(() => {
      dialog?.dispatchEvent(new Event("cancel"));
    });
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(secondThumb);
  });

  it("X-Knopf schließt ebenfalls (kein alert/confirm)", () => {
    mount(TWO_IMAGES);
    act(() => {
      (container.querySelectorAll("button")[0] as HTMLButtonElement).click();
    });
    const closeBtn = container.querySelector("dialog button") as HTMLButtonElement;
    act(() => {
      closeBtn.click();
    });
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("0 Bilder (nur Text / figure ohne Anker) → KEIN Galerie-Abschnitt", () => {
    mount(
      '<p>Nur Text</p><figure><img src="/api/objects/x/raw"><figcaption>ohne id</figcaption></figure>',
    );
    expect(container.innerHTML).toBe("");
  });
});
