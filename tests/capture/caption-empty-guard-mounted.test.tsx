// @vitest-environment jsdom
// WP-RETEST7 R2 (Pedis Befund: Fußnote verschwindet beim Leeren des Textes): löscht der Nutzer den
// GESAMTEN figcaption-Text, bleibt das Element erhalten und wird WIRKLICH leer (kein <br>-Rest —
// der :empty-Platzhalter erscheint wieder); Weitertippen setzt Text. Backspace/Delete in einer
// leeren Fußnote wird geblockt (preventDefault) — kein Löschen/Mergen des Elements.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-abc123-1">Riefen in Laufrichtung</figcaption></figure><p>Absatz</p>';

let emitted: string[] = [];
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return createElement(RichTextEditor, {
    value,
    onChange: (html: string) => {
      emitted.push(html);
      setValue(html);
    },
  });
}

function mount(initial: string): void {
  emitted = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { initial }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function caption(): HTMLElement {
  const cap = container.querySelector("figcaption");
  if (!(cap instanceof HTMLElement)) {
    throw new Error("figcaption nicht gefunden");
  }
  return cap;
}

// Caret in die Fußnote setzen (kollabiert an den Anfang) — wie ein Klick des Nutzers. Der Editor
// wird dabei FOKUSSIERT (wie beim echten Tippen): nur so bleibt der useEffect-Rückschreib-Pfad
// des Editors außen vor und die Knoten-Identität ist aussagekräftig.
function placeCaretIn(cap: HTMLElement): void {
  const editor = cap.closest("[contenteditable]");
  if (editor instanceof HTMLElement) {
    editor.focus();
  }
  const range = document.createRange();
  range.selectNodeContents(cap);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

describe("WP-RETEST7 R2: figcaption bleibt beim Leeren erhalten", () => {
  it("Text komplett löschen → figcaption bleibt, WIRKLICH leer (kein <br>); Weitertippen setzt Text", () => {
    mount(FIGURE);
    const cap = caption();
    // Browser-typischer Zustand nach „alles löschen": nur ein <br> bleibt zurück → nicht :empty.
    act(() => {
      cap.innerHTML = "<br>";
      placeCaretIn(cap);
      cap.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const after = caption();
    expect(after).toBe(cap); // Element ist NICHT verschwunden (gleicher DOM-Knoten)
    expect(after.innerHTML).toBe(""); // WIRKLICH leer → :empty-Platzhalter greift wieder
    expect(after.matches(":empty")).toBe(true);
    // Weitertippen setzt Text — der normale Editier-Fluss bleibt intakt.
    act(() => {
      after.textContent = "Neue Beschreibung";
      placeCaretIn(after);
      after.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(emitted[emitted.length - 1]).toContain("Neue Beschreibung");
  });

  it("Backspace in der LEEREN figcaption wird geblockt — Element bleibt", () => {
    mount(FIGURE);
    const cap = caption();
    act(() => {
      cap.textContent = "";
      placeCaretIn(cap);
      cap.dispatchEvent(new Event("input", { bubbles: true }));
    });
    placeCaretIn(caption());
    const ev = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    act(() => {
      caption().dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true); // der Merge-/Lösch-Default findet nicht statt
    expect(container.querySelector("figcaption")).not.toBeNull();
  });

  it("Backspace am ANFANG einer nicht-leeren figcaption wird geblockt (kein Merge nach außen)", () => {
    mount(FIGURE);
    const cap = caption();
    placeCaretIn(cap); // kollabiert am Anfang, Text vorhanden
    const ev = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true });
    act(() => {
      cap.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(caption().textContent).toBe("Riefen in Laufrichtung");
  });
});
