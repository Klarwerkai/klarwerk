// @vitest-environment jsdom
// AUFTRAG-mega84 Block A — DER WEG BEGINNT AN DER BILDBESCHREIBUNG SELBST.
//
// Pedi, 31.07. 13:20, am laufenden System mit Bildschirmfoto: unter einem importierten Bild steht
// das graue Feld „✎ Bildbeschreibung hinzufügen …", und das ist alles, was passiert. Sein Wunsch
// seit dem 20.07.: „wenn ich hier einen Text eingebe, sollte sich ein Eingabefeld öffnen, in dem
// ich den Text eingeben und formatieren kann."
//
// Das Formular WAR gebaut (mega9 Block F) — nur sein einziger Einstieg lag woanders: man musste
// erst das BILD anklicken, damit die Bild-Werkzeugleiste mit dem Knopf erschien. Klickte man
// stattdessen in die Beschreibung, war die figcaption ein eigener Editing-Host und man tippte
// inline hinein. Genau die Fläche, die der Nutzer ansieht, war der einzige Ort ohne Weg.
//
// Diese Datei pinnt das VERHALTEN des neuen Einstiegs — nicht seine Verdrahtung.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { CAPTION_AI_TEXT } from "../../apps/web/src/lib/captionAiSuggest";
import { mitBildbeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIGURE =
  '<figure><img src="data:image/png;base64,AAAA" data-image-id="kw-a"><figcaption data-image-id="kw-a">Alte Beschreibung</figcaption></figure><p>Absatz</p>';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let lastHtml = "";

function Host({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  lastHtml = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      // AUFTRAG-mega85 Block D: Pflichtparameter — der Compiler zwingt jede Einbindung, den
      // Dokument-Titel zu ENTSCHEIDEN statt ihn zu vergessen.
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => {
        lastHtml = html;
        setValue(html);
      },
    }),
    async (): Promise<DescribeImageResult> => ({ text: "Vorschlag", demo: false }),
  );
}

function mount(initial = FIGURE): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { initial }));
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function caption(): HTMLElement {
  const el = container.querySelector("figcaption");
  if (!(el instanceof HTMLElement)) {
    throw new Error("Fußnote nicht gerendert");
  }
  return el;
}

function feld(): HTMLElement | null {
  const el = document.querySelector("#caption-form-text");
  return el instanceof HTMLElement ? el : null;
}

function feldText(): string {
  return (feld()?.textContent ?? "").trim();
}

function taste(el: HTMLElement, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("AUFTRAG-mega84 Block A: die Bildbeschreibung ist der Einstieg", () => {
  it("Klick auf die Beschreibung öffnet das Formular — mit dem vorhandenen Text als Ausgangswert", () => {
    mount();
    expect(feld(), "vor dem Klick ist kein Formular offen").toBeNull();

    act(() => {
      caption().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(feld(), "Klick auf die Fußnote öffnet das Formular").not.toBeNull();
    expect(feldText()).toBe("Alte Beschreibung");
    expect(document.body.textContent).toContain(i18n.t(CAPTION_AI_TEXT.formTitle));
  });

  it("die Beschreibung ist als Bedienelement angekündigt und mit der Tastatur erreichbar", () => {
    mount();
    const cap = caption();
    // Kein Inline-Editing-Host mehr …
    expect(cap.getAttribute("contenteditable")).toBe("false");
    // … sondern ein angekündigtes, fokussierbares Bedienelement.
    expect(cap.getAttribute("role")).toBe("button");
    expect(cap.getAttribute("tabindex")).toBe("0");
    expect(cap.getAttribute("aria-label")).toBe(i18n.t(CAPTION_AI_TEXT.captionOpenLabel));
    // Der Platzhalter bleibt erhalten und liest sich als Aufforderung.
    expect(cap.getAttribute("data-kw-placeholder")).toBe(i18n.t("editor.captionPlaceholder"));
  });

  it("Tastaturweg gleichwertig: Eingabe- und Leertaste öffnen dasselbe Formular", () => {
    for (const key of ["Enter", " "]) {
      mount();
      taste(caption(), key);
      expect(feld(), `Taste ${JSON.stringify(key)} öffnet das Formular`).not.toBeNull();
      expect(feldText()).toBe("Alte Beschreibung");
      act(() => root.unmount());
      container.remove();
    }
    mount(); // für das afterEach dieser Datei
  });

  it("der erste Tastendruck einer Schreibtaste öffnet das Formular, statt inline zu tippen", () => {
    mount();
    taste(caption(), "A");
    expect(feld(), "eine Schreibtaste öffnet das Formular").not.toBeNull();
    expect(feldText()).toBe("Alte Beschreibung");
  });

  it("Eingabe in der Beschreibung schreibt NICHT mehr direkt in den Dokumentinhalt", () => {
    mount();
    const vorher = lastHtml;
    const cap = caption();

    // Der Tastendruck wird ABGEFANGEN (preventDefault) — der Browser bekommt gar nicht erst die
    // Gelegenheit, ein Zeichen einzufügen. Das ist die zweite Sperre neben contenteditable="false";
    // zusammen schließen sie den Weg, auf dem bis mega82 jeder Anschlag im Dokument landete.
    const ereignis = new KeyboardEvent("keydown", { key: "X", bubbles: true, cancelable: true });
    act(() => {
      cap.dispatchEvent(ereignis);
    });
    expect(ereignis.defaultPrevented, "der Tastendruck läuft nicht in die Fußnote").toBe(true);

    // Der Dokumentinhalt ist unberührt — und statt inline zu tippen, steht das Formular offen.
    expect(lastHtml).toBe(vorher);
    expect(feld()).not.toBeNull();
  });

  it("es gibt genau EIN Formular — der Knopf in der Bild-Werkzeugleiste führt in dasselbe", () => {
    mount();
    const img = container.querySelector("img");
    if (!(img instanceof HTMLImageElement)) {
      throw new Error("Bild nicht gerendert");
    }
    act(() => {
      img.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const knopf = document.querySelector('[data-testid="caption-form-open"]');
    expect(knopf, "der bestehende Knopf bleibt, wo er ist").not.toBeNull();
    act(() => {
      (knopf as HTMLElement).click();
    });
    expect(document.querySelectorAll("#caption-form-text")).toHaveLength(1);
  });

  it("es gibt keinen zweiten, unerreichbaren KI-Weg neben dem Formular", () => {
    mount();
    act(() => {
      caption().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    // Der Vorschlagsknopf existiert genau einmal: im Formular.
    const knöpfe = [...document.querySelectorAll("button")].filter(
      (b) => b.textContent?.includes(i18n.t(CAPTION_AI_TEXT.suggest)) === true,
    );
    expect(knöpfe).toHaveLength(1);
    expect(knöpfe[0]?.getAttribute("data-testid")).toBe("caption-form-suggest");
  });
});
