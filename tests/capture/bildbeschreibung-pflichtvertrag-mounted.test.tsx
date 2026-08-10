// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

// AUFTRAG-mega50 Block A/B — DER PFLICHTVERTRAG, ZUR LAUFZEIT BELEGT.
//
// Der Sammler (`tests/app/mega50-bildbeschreibung-sammler.test.ts`) liest Quelltext. Er kann damit
// zeigen, dass keine Fläche den Weg zur Bildbeschreibung mehr hereinreichen MUSS — er kann aber
// nicht zeigen, dass das Fehlen des Wegs wirklich auffällt. Genau das ist hier der Gegenstand, und
// es ist die Antwort auf die dritte benannte Blindheit des Sammlers (Alias/`createElement`):
//
//   · Ein Editor OHNE Provider entsteht gar nicht erst — der Zugriff wirft (fail-closed). Das ist
//     der Unterschied zum alten Zustand, in dem genau dieses Fehlen GERÄUSCHLOS war: kein Fehler,
//     keine Konsole, nur eine nackte einzeilige Fußnote.
//   · Ein Editor MIT Provider trägt beides ohne jedes Zutun seines Aufrufers: den Knopf, der das
//     Eingabeformular öffnet (mega9 Block F), und die Vorschlagsleiste an der fokussierten Fußnote
//     (WP-BILD-1c). Genau diese zwei Dinge hat Pedi auf der Vordertür vermisst.
//
// KEIN NEUER TEXT, KEINE NEUE TESTKENNUNG: geprüft wird gegen dieselben `data-testid`s und
// dieselben i18n-Schlüssel, die es seit mega9/WP-BILD-1c gibt.

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Ein Bild mit Fußnote — dieselbe Vorlage wie in den übrigen Fußnoten-Fällen.
const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA"><figcaption data-image-id="kw-a">Alte Beschreibung</figcaption></figure>';

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

function Host(): JSX.Element {
  const [value, setValue] = useState(FIGURE);
  return createElement(RichTextEditor, {
    value,
    onChange: setValue,
    documentTitle: "Wartungsnotiz",
  });
}

// Dieselbe Auswahl-Geste wie in den übrigen Fußnoten-Fällen (caption-ai-binding-mounted).
function klickIn(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("mega50: der Weg zur Bildbeschreibung ist ein Pflichtvertrag", () => {
  it("OHNE Provider wirft der Editor — das Fehlen ist nicht mehr geräuschlos", () => {
    const root = createRoot(container);
    // React meldet den Fehler zusätzlich auf der Konsole; hier zählt, dass er ÜBERHAUPT entsteht.
    expect(() => {
      act(() => {
        root.render(createElement(Host));
      });
    }).toThrow(/useImageDescribe muss innerhalb von <ImageDescribeProvider>/);
  });

  it("MIT Provider trägt der Editor Formular UND Vorschlag — ohne Zutun des Aufrufers", () => {
    const root = createRoot(container);
    act(() => {
      // Der Host reicht NICHTS zur Bildbeschreibung herein: nur `value` und `onChange`. Genau so
      // sehen `CaptureFrontDoor` und `KnowledgeInputStudio` heute aus.
      root.render(mitBildbeschreibung(createElement(Host)));
    });

    // (1) Der sichtbare Weg ins Eingabeformular (mega9 Block F, Pedis „immer noch kein richtiges
    //     Eingabeformular"). Er sitzt in der Bild-Werkzeugleiste, die mit dem ausgewählten Bild
    //     erscheint. Vorher hing dieser Knopf an `onDescribeImage` und fehlte hier ganz.
    const img = container.querySelector("img");
    expect(img, "Bild nicht gefunden").not.toBeNull();
    klickIn(img as HTMLElement);
    expect(
      container.querySelector('[data-testid="caption-form-open"]'),
      "Der Knopf zum Eingabeformular fehlt — genau Pedis Befund vom 29.07.",
    ).not.toBeNull();

    // (2) Die Vorschlagsleiste an der angeklickten Fußnote (WP-BILD-1c). Sie hing an derselben
    //     Bedingung (`captionSuggestVisible(…, onDescribeImage !== undefined)`). Erkannt wird sie
    //     wie in den übrigen Fußnoten-Fällen am einzigen ✨-Knopf (kein aiPanel gemountet).
    const caption = container.querySelector("figcaption");
    expect(caption, "Fußnote nicht gefunden").not.toBeNull();
    klickIn(caption as HTMLElement);
    const sternKnopf = [...container.querySelectorAll("button")].filter((b) =>
      (b.textContent ?? "").includes("✨"),
    );
    expect(
      sternKnopf.length,
      "Die KI-Vorschlagsleiste fehlt an der angeklickten Fußnote.",
    ).toBeGreaterThan(0);

    act(() => root.unmount());
  });
});
