import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @vitest-environment jsdom
// WP-D8b (bens GELB-Auflage aus BERICHT-d8): ECHT GEMOUNTETER RichTextEditor — der jsdom-Helfer-Test
// (editor-figure-caption.test.ts) belegte den contains-Guard nur als Source-Pin; hier läuft der reale
// React-Zyklus (render → value/onChange → useEffect-Sync → Fokus/Input). Kleinste Lösung OHNE neue
// devDependency: react-dom/client + react.act (React 18.3) direkt aus apps/web/node_modules — kein
// @testing-library noetig, da nur mount/act/dispatch gebraucht werden.
//
// ROT unter dem ALTEN Guard (document.activeElement !== el): die fokussierte figcaption ist ein EIGENER
// Editing-Host — activeElement ist die FIGCAPTION, nicht der Editor-Container. Der alte Identitäts-Guard
// hielte den Editor für unfokussiert und schriebe bei jedem onChange-value-Zyklus das innerHTML neu; der
// figcaption-DOM-Knoten würde ERSETZT (Referenz-Identität bricht) und der Fokus fiele zurück auf body.
// Genau DAS asserten die Tests über Knoten-Identität + activeElement — nicht über den Quelltext.
// react/react-dom liegen (wie fflate) nur in apps/web/node_modules — relativer Import wie etabliert;
// die Komponente selbst löst ihr bare "react" über die normale Node-Auflösung auf DIESELBE Instanz auf.
// createElement statt JSX-Syntax: so braucht der Test weder jsx-Transform-Konfiguration noch jsx-runtime.
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
// i18n VOR dem Editor importieren: initialisiert react-i18next global (useTranslation ohne Provider).
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";

// React 18: act außerhalb eines Test-Renderers verlangt dieses Flag.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-abc123-1">Noch keine Bildbeschreibung</figcaption></figure><p>Absatz</p>';

// Host wie der echte Parent (CaptureFrontDoor): value-State + onChange-Rückkopplung. setValue wird für
// die Gegenprobe (externes value-Update) nach außen gereicht.
let hostSetValue: ((next: string) => void) | null = null;
let emitted: string[] = [];

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  hostSetValue = setValue;
  return createElement(RichTextEditor, {
    value,
    onChange: (html: string) => {
      emitted.push(html);
      setValue(html);
    },
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(initial: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { initial }));
  });
}

function findCaption(): HTMLElement {
  const caption = container.querySelector("figcaption");
  if (!(caption instanceof HTMLElement)) {
    throw new Error("figcaption nicht gerendert");
  }
  return caption;
}

// Tippen in die Fußnote simulieren: Textknoten ändern + natives input-Event (bubbelt zum Editor-Div,
// React ruft den onInput-Handler → emit → onChange → value-Update → useEffect-Sync-Entscheidung).
function typeIntoCaption(caption: HTMLElement, text: string): void {
  act(() => {
    caption.textContent = `${caption.textContent ?? ""}${text}`;
    caption.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  emitted = [];
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  hostSetValue = null;
});

describe("WP-D8b: gemounteter RichTextEditor — Fokus in der Bild-Fußnote", () => {
  it("(a) Tippen in der fokussierten figcaption ersetzt den DOM-Knoten NICHT (kein innerHTML-Rewrite)", () => {
    mount(FIGURE);
    const caption = findCaption();
    // Enhancement des echten useEffect-Zyklus: figcaption ist als Editing-Host verankert.
    expect(caption.getAttribute("contenteditable")).toBe("true");

    // Echten Fokus setzen (jsdom fokussiert Elemente zuverlässig über tabindex; der Guard prüft NUR
    // el.contains(document.activeElement) — die tabindex-Hilfe ändert an der geprüften Logik nichts).
    caption.setAttribute("tabindex", "-1");
    act(() => {
      caption.focus();
    });
    expect(document.activeElement).toBe(caption);
    // Der springende Punkt: activeElement ist NICHT der Editor-Container selbst (alter Guard griffe hier).
    expect(document.activeElement).not.toBe(caption.closest('[contenteditable="true"][class]'));

    // Mehrere Eingaben feuern — jede löst onChange → value-Update → useEffect aus.
    typeIntoCaption(caption, "A");
    typeIntoCaption(caption, "B");
    typeIntoCaption(caption, "C");

    // (a) DERSELBE DOM-Knoten lebt noch (kein innerHTML-Rewrite während des Tippens) …
    expect(container.querySelector("figcaption")).toBe(caption);
    // … und der Fokus blieb in der Fußnote (kein Caret-Zerstörungs-Symptom).
    expect(document.activeElement).toBe(caption);
  });

  it("(b) onChange liefert den getippten Text sanitisiert (ohne contenteditable-Attribute)", () => {
    mount(FIGURE);
    const caption = findCaption();
    caption.setAttribute("tabindex", "-1");
    act(() => {
      caption.focus();
    });
    typeIntoCaption(caption, " XYZ");

    expect(emitted.length).toBeGreaterThan(0);
    const last = emitted[emitted.length - 1] ?? "";
    expect(last).toContain("Noch keine Bildbeschreibung XYZ");
    expect(last).toContain('data-image-id="kw-img-abc123-1"');
    expect(last).not.toContain("contenteditable");
  });

  it("(c) Gegenprobe: Fokus AUSSERHALB + externes value-Update → innerHTML WIRD gesetzt", () => {
    mount(FIGURE);
    const captionBefore = findCaption();
    // Fokus liegt außerhalb des Editors (body) — der Guard darf externes Sync NICHT verhindern.
    expect(container.contains(document.activeElement)).toBe(false);

    act(() => {
      hostSetValue?.("<p>Extern ersetzt</p>");
    });

    // Editor-Inhalt wurde neu gesetzt: figure ist weg, neuer Inhalt da, alter Knoten entsorgt.
    expect(container.querySelector("figcaption")).toBeNull();
    expect(captionBefore.isConnected).toBe(false);
    expect(container.textContent).toContain("Extern ersetzt");
  });
});
