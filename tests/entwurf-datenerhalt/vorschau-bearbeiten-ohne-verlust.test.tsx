// @vitest-environment jsdom
// ================================================================================================
// FR-STR-05 · Vorschau/Bearbeiten-Umschaltung OHNE Verlust des Zwischenstands.
// ================================================================================================
//
// Historisches Abnahmekriterium (`specs/reference/Pflichtenheft.md`): „Wechsel hin/zurück behält
// Edits inkl. Bilder." Beim Bestandsabgleich fand sich dafür kein eigener Beleg — der Moduswechsel
// kommt nur als Nebenweg in `tests/editor-fremdfassung` (F4) vor, dort mit einer Fassung von aussen,
// nicht mit dem, was die Autorin selbst getippt hat.
//
// Gemessen wird wie dort BEIDES: was im Editor steht (was die Autorin sieht) und was beim
// Verbraucher steht (was gespeichert würde).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = "<p>Ausgangstext der Autorin</p>";
const MIT_BILD = [
  "<p>Ausgangstext der Autorin</p>",
  "<p>Nachgetragen vor der Vorschau.</p>",
  '<figure data-image-id="kw-img-fr05-1">',
  '<img data-image-id="kw-img-fr05-1" alt="Exzenter" src="/api/objects/fr05/raw">',
  '<figcaption data-image-id="kw-img-fr05-1">Schmierstelle am Exzenter</figcaption></figure>',
].join("");

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let hostValue = "";

function Host({ initial }: { initial: string }): JSX.Element {
  const [value, setValue] = useState(initial);
  hostValue = value;
  return mitBildbeschreibung(
    createElement(RichTextEditor, {
      value,
      documentTitle: "Wartungsnotiz",
      onChange: (html: string) => setValue(html),
    }),
  );
}

function editorEl(): HTMLElement | null {
  const el = container.querySelector('[role="textbox"]');
  return el instanceof HTMLElement ? el : null;
}

function modusKnopf(): HTMLElement {
  const vorschau = i18n.t("editor.preview");
  const bearbeiten = i18n.t("editor.edit");
  for (const b of container.querySelectorAll("button")) {
    const t = b.getAttribute("title");
    if (t === vorschau || t === bearbeiten) {
      return b as HTMLElement;
    }
  }
  throw new Error("Modus-Knopf nicht gefunden");
}

function umschalten(): void {
  act(() => {
    modusKnopf().click();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  hostValue = "";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Host, { initial: START }));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("FR-STR-05 · Vorschau und zurück behält den Zwischenstand", () => {
  it("V1: Getipptes samt Bild und Bildunterschrift steht in der Vorschau und nach der Rückkehr unverändert da", () => {
    const el = editorEl();
    if (!el) {
      throw new Error("Editor nicht gerendert");
    }
    act(() => {
      el.focus();
      el.innerHTML = MIT_BILD;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const vorher = hostValue;
    expect(vorher).toContain("Nachgetragen vor der Vorschau.");
    expect(vorher).toContain("kw-img-fr05-1");

    // Hin: die Vorschau zeigt denselben Stand — kein Schreibfeld, aber Text, Bild, Unterschrift.
    umschalten();
    expect(editorEl(), "in der Vorschau steht noch ein Schreibfeld").toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("Nachgetragen vor der Vorschau.");
    expect(text).toContain("Schmierstelle am Exzenter");
    expect(container.querySelector('img[data-image-id="kw-img-fr05-1"]')).not.toBeNull();
    expect(hostValue, "der Wechsel in die Vorschau hat den Stand verändert").toBe(vorher);

    // Zurück: der Editor trägt alles wieder, der Verbraucher hat nichts verloren.
    umschalten();
    const zurueck = editorEl();
    expect(zurueck).not.toBeNull();
    expect(zurueck?.innerHTML).toContain("Nachgetragen vor der Vorschau.");
    expect(zurueck?.querySelector('img[data-image-id="kw-img-fr05-1"]')).not.toBeNull();
    expect(zurueck?.querySelector("figcaption")?.textContent).toContain(
      "Schmierstelle am Exzenter",
    );
    expect(hostValue).toBe(vorher);
  });

  it("V2: mehrfaches Hin und Her verändert nichts — und danach Getipptes kommt weiter an", () => {
    const el = editorEl();
    if (!el) {
      throw new Error("Editor nicht gerendert");
    }
    act(() => {
      el.innerHTML = MIT_BILD;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const vorher = hostValue;
    for (let i = 0; i < 3; i++) {
      umschalten();
      umschalten();
    }
    expect(hostValue).toBe(vorher);

    const wieder = editorEl();
    if (!wieder) {
      throw new Error("Editor nach der Rückkehr fehlt");
    }
    act(() => {
      wieder.innerHTML = `${wieder.innerHTML}<p>Nach der Vorschau ergänzt.</p>`;
      wieder.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(hostValue).toContain("Nach der Vorschau ergänzt.");
    expect(hostValue).toContain("kw-img-fr05-1");
  });
});
