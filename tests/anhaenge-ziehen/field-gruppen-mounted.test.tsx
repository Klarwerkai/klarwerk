// @vitest-environment jsdom
// ================================================================================================
// FIELD ALS GRUPPE — ein Klick ins Schreibfeld drückt keinen Knopf daneben.
// ================================================================================================
//
// LIVE-BEFUND (03.10.2026, klarwerk.ai/erfassen, `LIVE-BEFUND-FORMULAR.json`): im Expertenformular
// öffnete ein Klick ins Schreibfeld ungefragt das Knowledge Studio. `Field` zeichnete ein `<label>`
// um ALLE Kinder — Studio-Knöpfe und Editor. Ein Klick irgendwo in ein Label aktiviert dessen
// erstes beschriftbares Element, hier den ersten Knopf.
//
// Gefahren wird mit dem ECHTEN `Field` und dem ECHTEN `RichTextEditor`, in derselben Anordnung wie
// `Capture.tsx` (Knopf vor dem Editor im selben Feld). K0 kalibriert: die alte Labelform zeigt den
// Fehler in dieser Umgebung wirklich — sonst wäre G1 auch ohne Reparatur grün.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import { Field } from "../../apps/web/src/components/ui";
import "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let studioKlicks = 0;

function mountGruppe(gruppe: boolean): void {
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  const r = createRoot(el);
  root = r;
  studioKlicks = 0;
  act(() => {
    r.render(
      mitBildbeschreibung(
        createElement(Field, {
          label: "Ausführlicher Inhalt",
          gruppe,
          children: [
            createElement(
              "button",
              {
                key: "studio",
                type: "button",
                "data-testid": "studio",
                onClick: () => {
                  studioKlicks += 1;
                },
              },
              "Studio öffnen",
            ),
            createElement(RichTextEditor, {
              key: "editor",
              value: "<p>Vorhandener Text</p>",
              onChange: () => undefined,
              documentTitle: "Gruppe",
            }),
          ],
        }),
      ),
    );
  });
}

afterEach(() => {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

function schreibfeld(): HTMLElement {
  const el = container?.querySelector('[role="textbox"]');
  if (!(el instanceof HTMLElement)) {
    throw new Error("Schreibfeld fehlt");
  }
  return el;
}

// Wie der Browser klickt: das Ziel ist das Element unter der Maus — der Absatz im Schreibfeld.
function klickInsSchreibfeld(): void {
  const absatz = schreibfeld().querySelector("p");
  if (!absatz) {
    throw new Error("kein Absatz im Schreibfeld");
  }
  act(() => {
    absatz.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    absatz.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    absatz.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function tippe(): void {
  const feld = schreibfeld();
  act(() => {
    feld.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "x" }));
    feld.querySelector("p")?.append(" x");
    feld.dispatchEvent(new InputEvent("input", { bubbles: true, data: "x" }));
    feld.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "x" }));
  });
}

describe("Field · gruppe — zusammengesetzte Bereiche ohne implizites Label", () => {
  it("K0 · Kalibrierung: in der ALTEN Labelform drückt der Klick ins Schreibfeld den Knopf (der Live-Befund)", () => {
    mountGruppe(false);
    klickInsSchreibfeld();
    expect(studioKlicks).toBe(1);
  });

  it("G1 · als Gruppe: Klicken und Tippen im Schreibfeld lösen den Knopf daneben NICHT aus", () => {
    mountGruppe(true);
    klickInsSchreibfeld();
    tippe();
    klickInsSchreibfeld();
    expect(studioKlicks).toBe(0);
    expect(container?.querySelector("label")).toBeNull();
  });

  it("G2 · der bewusste Klick auf den Knopf wirkt weiterhin", () => {
    mountGruppe(true);
    const knopf = container?.querySelector('[data-testid="studio"]') as HTMLButtonElement;
    act(() => {
      knopf.click();
    });
    expect(studioKlicks).toBe(1);
  });

  it("G3 · die Gruppe trägt ihren Namen: fieldset mit legend", () => {
    mountGruppe(true);
    const gruppe = container?.querySelector("fieldset");
    expect(gruppe?.querySelector(":scope > legend")?.textContent).toBe("Ausführlicher Inhalt");
    expect(gruppe?.contains(schreibfeld())).toBe(true);
  });
});

describe("Field · ohne gruppe — einzelne Eingabefelder behalten ihr Label", () => {
  it("L1 · das Label ist seinem Eingabefeld zugeordnet, ein Klick auf den Text erreicht genau dieses Feld", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    container = el;
    const r = createRoot(el);
    root = r;
    let feldKlicks = 0;
    act(() => {
      r.render(
        createElement(Field, {
          label: "Kernaussage",
          children: createElement("input", {
            "data-testid": "titel",
            onClick: () => {
              feldKlicks += 1;
            },
          }),
        }),
      );
    });
    const label = el.querySelector("label") as HTMLLabelElement;
    const feld = el.querySelector('[data-testid="titel"]') as HTMLInputElement;
    expect(label.control).toBe(feld);
    act(() => {
      label
        .querySelector("span")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(feldKlicks).toBe(1);
  });
});
