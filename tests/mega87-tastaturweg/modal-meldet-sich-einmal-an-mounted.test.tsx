// @vitest-environment jsdom
// mega87-TASTATURWEG · EIN ÖFFNEN IST EIN ANMELDEN — DER FOKUS SPRINGT DANACH NICHT NOCH EINMAL.
//
// DER BEFUND: der Volllauf `pa-1790473625-b7e49118` (Commit 694cf26e) scheiterte in
// `tests-smoke/mega87-caption-formatierung-browser.spec.ts:193` — der reine Tastaturweg
// (Feld fokussieren, Strg/⌘+A, Kursiv-Knopf, Leertaste) ließ die Bildunterschrift unausgezeichnet.
//
// DIE URSACHE liegt nicht im Formular, sondern in `Modal.tsx`: sein Anmelde-Effekt hing am
// Kontext-OBJEKT der Grenze. `enter()` setzt `locked` — das Objekt wechselt, und der Effekt lief
// ein zweites Mal: abmelden (Fokus ZURÜCK auf den Auslöser), neu anmelden (Fokus auf den ersten
// Knopf des Panels). Dieser zweite Lauf kommt in einem EIGENEN Rendern nach dem Öffnen. Fokussiert
// ein Mensch das Feld schneller, als dieser Lauf kommt, nimmt er ihm den Fokus; Strg/⌘+A markiert
// dann nicht mehr das Feld, und Kursiv trifft nichts. `Seitenblatt.tsx` beschreibt genau diesen
// Fehler und hängt deshalb nur an `enter` — hier wird dieselbe Zusage für `<Modal>` festgehalten.
//
// Gemessen wird der FOKUSVERLAUF während des Öffnens, nicht eine Frist: genau ein Fokus ins Panel,
// kein Umweg über den Auslöser.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement, useRef, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ModalBoundaryProvider, ModalRegion } from "../../apps/web/src/app/ModalBoundaryContext";
import { Modal } from "../../apps/web/src/components/Modal";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function Buehne(): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [offen, setOffen] = useState(false);
  return createElement(
    "div",
    null,
    createElement(
      ModalBoundaryProvider,
      { hostRef },
      createElement(
        ModalRegion,
        null,
        createElement(
          "button",
          { type: "button", "data-testid": "ausloeser", onClick: () => setOffen(true) },
          "Öffnen",
        ),
      ),
      createElement(
        Modal,
        { open: offen, onClose: () => setOffen(false), title: "Bildbeschreibung" },
        createElement("div", {
          id: "feld",
          contentEditable: true,
          suppressContentEditableWarning: true,
          tabIndex: 0,
        }),
      ),
    ),
    createElement("div", { ref: hostRef }),
  );
}

function beschreibe(el: Element | null): string {
  if (!el) {
    return "null";
  }
  const testid = el.getAttribute("data-testid");
  return testid
    ? `[${testid}]`
    : el.id
      ? `#${el.id}`
      : `${el.tagName.toLowerCase()}"${el.textContent ?? ""}"`;
}

describe("mega87-Tastaturweg · Modal unter der Grenze", () => {
  it("meldet sich je Öffnen genau einmal an: ein Fokus ins Panel, kein Rücksprung auf den Auslöser", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(Buehne));
    });
    const ausloeser = container.querySelector('[data-testid="ausloeser"]') as HTMLButtonElement;
    ausloeser.focus();

    const verlauf: string[] = [];
    const merke = (e: FocusEvent): void => {
      verlauf.push(beschreibe(e.target as Element));
    };
    document.addEventListener("focusin", merke);
    try {
      await act(async () => {
        ausloeser.click();
      });
    } finally {
      document.removeEventListener("focusin", merke);
    }

    expect(verlauf, `Fokusverlauf beim Öffnen: ${JSON.stringify(verlauf)}`).toHaveLength(1);
    expect(verlauf).not.toContain("[ausloeser]");
    expect(
      container.querySelector("h2")?.closest("[tabindex='-1']")?.contains(document.activeElement),
    ).toBe(true);
  });

  // Der Ablauf aus dem Browser, ohne `act`: der Klick rendert das Panel sofort (diskretes Ereignis),
  // ein nachgereichtes Rendern käme erst in einer späteren Aufgabe des Schedulers. Genau in diese
  // Lücke fällt der Fokus des Menschen — hier synchron nach dem ersten Rendern gesetzt.
  it("lässt einen gleich nach dem Öffnen ins Feld gesetzten Fokus stehen", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root.render(createElement(Buehne));
    });
    const ausloeser = container.querySelector('[data-testid="ausloeser"]') as HTMLButtonElement;
    ausloeser.focus();
    const umgebung = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
    umgebung.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      ausloeser.click();
      let feld: HTMLElement | null = null;
      for (let i = 0; i < 10 && !feld; i += 1) {
        await Promise.resolve();
        feld = container.querySelector("#feld");
      }
      expect(feld, "das Panel ist nach dem Klick nicht gerendert").not.toBeNull();
      (feld as HTMLElement).focus();
      expect(beschreibe(document.activeElement)).toBe("#feld");
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      umgebung.IS_REACT_ACT_ENVIRONMENT = true;
    }
    expect(beschreibe(document.activeElement), "der Fokus wurde dem Feld wieder genommen").toBe(
      "#feld",
    );
  });
});
