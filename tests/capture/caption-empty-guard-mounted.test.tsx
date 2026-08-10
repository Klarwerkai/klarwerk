// @vitest-environment jsdom
// WP-RETEST7 R2 → AUFTRAG-mega84 Block A: DIE URSACHE IST ENTFALLEN, NICHT NUR DER TEST.
//
// Hier standen drei Fälle: Löscht der Nutzer den gesamten Fußnotentext, bleibt die figcaption
// erhalten und wird WIRKLICH leer (kein <br>-Rest, sonst erscheint der Platzhalter nicht) ·
// Backspace in der leeren Fußnote wird geblockt · Backspace am Anfang einer nicht-leeren Fußnote
// wird geblockt (kein Merge nach außen).
//
// Alle drei waren Reparaturen an EINER Ursache: die figcaption war ein eigener
// contenteditable-Editing-Host, und der Browser tat darin Dinge, die der Nutzer nicht gemeint
// hatte. Seit mega84 ist sie keiner mehr — sie ist der Einstieg in das Bildbeschreibungs-Formular
// (Pedis Befund vom 31.07.: „das graue Feld, und das ist alles, was passiert"). In ihr gibt es
// kein Caret, keinen Tastendruck, der Inhalt verändert, und damit auch nichts mehr zu reparieren.
//
// Die drei Fälle wären ab jetzt grün, ohne irgendetwas zu prüfen — das ist die gefährlichste Sorte
// Test. Diese Datei pinnt deshalb die URSACHE ihrer Abschaffung: solange die Fußnote kein
// Editing-Host ist, kann keiner der drei Schäden zurückkommen. Stellt jemand `contenteditable`
// zurück, wird sie rot, und die Guards müssen mit zurück.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-abc123-1">Riefen in Laufrichtung</figcaption></figure><p>Absatz</p>';

let emitted: string[] = [];
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      // AUFTRAG-mega85 Block D: Pflichtparameter — der Compiler zwingt jede Einbindung, den
      // Dokument-Titel zu ENTSCHEIDEN statt ihn zu vergessen.
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        emitted.push(html);
        setValue(html);
      },
    }),
  );
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

describe("AUFTRAG-mega84 Block A: die Fußnote ist kein Editing-Host — die R2-Schäden können nicht zurückkommen", () => {
  it("die Fußnote ist ausdrücklich nicht editierbar (die Ursache aller drei R2-Guards)", () => {
    mount(FIGURE);
    // Nicht „fehlt das Attribut", sondern „steht ausdrücklich auf false": ein fehlendes Attribut
    // erbt die Editierbarkeit vom contenteditable-Container und wäre genau der alte Zustand.
    expect(caption().getAttribute("contenteditable")).toBe("false");
  });

  it("Lösch-Tasten in der Fußnote verändern den Dokumentinhalt nicht", () => {
    mount(FIGURE);
    const vorher = emitted.length;
    for (const key of ["Backspace", "Delete"]) {
      act(() => {
        caption().dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        );
      });
    }
    // Kein emit, kein Textverlust, das Element steht noch — ohne dass ein Guard dafür arbeiten muss.
    expect(emitted.length).toBe(vorher);
    expect(caption().textContent).toBe("Riefen in Laufrichtung");
    expect(container.querySelector("figure")).not.toBeNull();
  });

  it("der Fußnotentext lässt sich nicht leertippen — der Weg führt ins Formular", () => {
    mount(FIGURE);
    const ereignis = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    act(() => {
      caption().dispatchEvent(ereignis);
    });
    expect(ereignis.defaultPrevented).toBe(true);
    expect(caption().textContent).toBe("Riefen in Laufrichtung");
    expect(document.querySelector("#caption-form-text")).not.toBeNull();
  });
});
