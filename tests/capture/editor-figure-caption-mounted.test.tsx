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
import { mitBildbeschreibung, schreibeBeschreibung } from "./bildbeschreibung-naht";

// React 18: act außerhalb eines Test-Renderers verlangt dieses Flag.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// WP-D10: Altlast-Fixture (Platzhalter als ECHTER Text) — der echte Editor-Mount muss ihn beim
// Verankern leeren (Migration) und stattdessen den rein visuellen data-kw-placeholder setzen.
const FIGURE =
  '<figure><img src="/api/objects/x/raw"><figcaption data-image-id="kw-img-abc123-1">Noch keine Bildbeschreibung</figcaption></figure><p>Absatz</p>';

// Host wie der echte Parent (CaptureFrontDoor): value-State + onChange-Rückkopplung. setValue wird für
// die Gegenprobe (externes value-Update) nach außen gereicht.
let hostSetValue: ((next: string) => void) | null = null;
let emitted: string[] = [];

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  hostSetValue = setValue;
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

// AUFTRAG-mega84 Block A: `typeIntoCaption` ist entfallen — in die Fußnote wird nicht mehr getippt.
// Was der Nutzer eingibt, geht durch das Formular (`schreibeBeschreibung` aus der gemeinsamen Naht).

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
  it("(a) Fokus IN der Fußnote zählt als Fokus im Editor — der Guard prüft contains, nicht Identität", () => {
    mount(FIGURE);
    const caption = findCaption();
    // AUFTRAG-mega84 Block A: die Fußnote ist kein Editing-Host mehr, aber sie ist FOKUSSIERBAR
    // (role=button, tabindex=0) — und damit bleibt genau die Kante bestehen, die WP-D8 ausgelöst
    // hat: document.activeElement ist dann NICHT der Editor-Container, sondern ein Nachfahre.
    // Der Fokus-Guard muss `contains` prüfen; mit dem alten `!== el` hielte er den Editor für
    // unfokussiert und schriebe sein innerHTML neu — der Knoten unter dem Fokus wäre weg.
    expect(caption.getAttribute("contenteditable")).toBe("false");
    expect(caption.getAttribute("tabindex")).toBe("0");
    act(() => {
      caption.focus();
    });
    expect(document.activeElement).toBe(caption);
    expect(document.activeElement).not.toBe(container.querySelector('[role="textbox"]'));

    // Ein Echo desselben Wertes von außen darf den fokussierten Teilbaum nicht neu aufbauen.
    act(() => {
      hostSetValue?.(FIGURE);
    });
    expect(container.querySelector("figcaption")).toBe(caption);
    expect(document.activeElement).toBe(caption);
  });

  it("(b) onChange liefert die über das Formular gesetzte Beschreibung sanitisiert — NIE Platzhaltertext/-attribute", () => {
    mount(FIGURE);
    const caption = findCaption();
    // WP-D10: der echte Mount-Zyklus hat den Altlast-Platzhalter GELEERT und die visuelle Einladung
    // als data-Attribut verankert (Text kommt nur noch aus CSS ::before, nie aus dem Inhalt).
    expect(caption.textContent).toBe("");
    expect(caption.getAttribute("data-kw-placeholder")).toBeTruthy();

    // AUFTRAG-mega84 Block A/B: der Weg in die Fußnote führt über das Formular — Klick auf die
    // Beschreibung, Text eingeben, speichern. Inline getippt wird nicht mehr.
    act(() => {
      caption.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    act(() => {
      schreibeBeschreibung("XYZ");
    });
    act(() => {
      (container.querySelector('[data-testid="caption-form-save"]') as HTMLElement).click();
    });

    expect(emitted.length).toBeGreaterThan(0);
    const last = emitted[emitted.length - 1] ?? "";
    expect(last).toContain("XYZ");
    // WP-D10: der Platzhalter kann unter keinen Umständen gespeichert werden — weder als Alt-Text
    // (Migration hat geleert) noch als Attribut (Sanitizer-Allowlist).
    expect(last).not.toContain("Noch keine Bildbeschreibung");
    expect(last).not.toContain("data-kw-placeholder");
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
