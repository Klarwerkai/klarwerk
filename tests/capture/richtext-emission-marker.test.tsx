// @vitest-environment jsdom
// WP-POLISH-CLOSE (bens Punkt 2): der lastEmitted-Guard des Editors ist eine EINMALIGE
// Bestätigung. Gepinnt wird bens Kante A→B→A in beiden Formen:
//  (1) Nutzer tippt: Inhalt A → tippt B (emit B) → stellt A wieder her → emit A MUSS feuern
//      (der Guard vergleicht Emissionen gegen value, nie gegen sich selbst),
//  (2) extern: nach einer verbrauchten Emission A setzt der Parent B und danach wieder A —
//      der Editor MUSS wieder A zeigen (vor dem Fix blieb der alte Marker stehen und die
//      Rückkehr zu A wurde als No-op verschluckt → der Editor zeigte weiter B).
// Dazu bleibt der U8-Fall grün: ein No-op-Blur (nichts geändert) feuert KEIN onChange —
// nicht-vakuös bewiesen (der Blur-Pfad feuert nachweislich, wenn sich etwas geändert hat).
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let setHostValue: ((html: string) => void) | null = null;

function Host({ onChange }: { onChange: (html: string) => void }): JSX.Element {
  const [value, setValue] = useState("<p>A</p>");
  setHostValue = setValue;
  return createElement(RichTextEditor, {
    value,
    onChange: (html: string) => {
      onChange(html);
      setValue(html); // kontrollierter Normalfall: die Emission kommt als value zurück
    },
  });
}

function mount(onChange: (html: string) => void): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { onChange }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  setHostValue = null;
});

function editorEl(): HTMLElement {
  const el = container.querySelector('[contenteditable="true"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Editor fehlt");
  }
  return el;
}

function typeInto(html: string): void {
  act(() => {
    const el = editorEl();
    el.innerHTML = html;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("WP-POLISH-CLOSE Punkt 2: Emissionsmarker A→B→A", () => {
  it("bens Szenario (tippen): A → B (emit) → A wiederhergestellt → emit A FEUERT", () => {
    const onChange = vi.fn();
    mount(onChange);
    expect(editorEl().innerHTML).toContain("A");

    typeInto("<p>B</p>");
    expect(onChange).toHaveBeenLastCalledWith("<p>B</p>");

    // Nutzer stellt A wieder her — eine ECHTE Eingabe, die emittieren MUSS.
    typeInto("<p>A</p>");
    expect(onChange).toHaveBeenLastCalledWith("<p>A</p>");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("bens Kante (extern): verbrauchte Emission A → extern B → extern zurück zu A → der Editor zeigt wieder A", () => {
    const onChange = vi.fn();
    mount(onChange);
    // Emission A (setzt den Marker) — kommt als value zurück und wird dabei VERBRAUCHT.
    typeInto("<p>A</p>");

    // Externer Set auf B (z. B. Vorschlag übernommen) → der Editor zeigt B.
    act(() => {
      setHostValue?.("<p>B</p>");
    });
    expect(editorEl().innerHTML).toContain("B");

    // Externe Rückkehr zu A (z. B. Vorschlag rückgängig): OHNE das einmalige Verbrauchen bliebe
    // der alte Marker (A) stehen und der Editor zeigte weiter B — jetzt zeigt er wieder A.
    act(() => {
      setHostValue?.("<p>A</p>");
    });
    expect(editorEl().innerHTML).toContain("A");
    expect(editorEl().innerHTML).not.toContain("B");
  });

  it("U8 bleibt: ein No-op-Blur feuert KEIN onChange (der Blur-Pfad selbst ist nachweislich aktiv)", () => {
    const onChange = vi.fn();
    mount(onChange);
    // Nicht-vakuöser Beweis: eine STILLE DOM-Änderung (ohne input-Event) + Blur → emit feuert.
    act(() => {
      const el = editorEl();
      el.innerHTML = "<p>D</p>";
      el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith("<p>D</p>");

    // No-op-Blur: nichts geändert → KEIN weiterer onChange (bens U8-Fix bleibt grün).
    act(() => {
      editorEl().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
