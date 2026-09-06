// @vitest-environment jsdom
// ================================================================================================
// JOB 3102 · UX-06 · A6 — DAS „…"-MENÜ GIBT DEN FOKUS AN SEINEN EIGENEN KNOPF ZURÜCK.
// ================================================================================================
//
// WARUM DAS EIN EIGENER FALL IST und nicht in `antwortblatt-tastatur.test.tsx` mitläuft:
// `OverflowMenu.tsx:80-83` schliesst beim Klick auf einen Punkt ZUERST die Liste und ruft DANN
// `onWahl`. Der Punkt, der eben noch den Fokus trug, verschwindet im selben Durchlauf; ohne
// Rückgabe steht der Fokus danach auf `body`. Genau daran hängt die Fokusrückgabe des Seitenblatts:
// es liest seinen Auslöser aus `document.activeElement` (Bauform `Modal.tsx:86-87`), und `body`
// gilt dort ausdrücklich nicht als Auslöser.
//
// Das ist zugleich die richtige Bauform für ein Menü — ein Menü, dessen Liste zugeht, gibt die
// Bedienung an seinen Griff zurück. Es gilt für ALLE heutigen Aufrufer (Startseite und
// Fragenfläche), weil es im Bauteil steht und nicht bei einem von beiden.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { OverflowMenu } from "../../apps/web/src/components/start/OverflowMenu";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
const gewaehlt: string[] = [];

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function mounten(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(OverflowMenu, {
        label: "Mehr",
        testId: "probe-menu",
        punkte: [
          { id: "eins", label: "Eins" },
          { id: "zwei", label: "Zwei" },
        ],
        onWahl: (id: string) => {
          gewaehlt.push(id);
        },
      }),
    );
    await flush();
  });
}

async function klick(el: Element | null): Promise<void> {
  expect(el, "Klickziel fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

const griff = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="probe-menu"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gewaehlt.length = 0;
  await mounten();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
});

describe("UX-06 · A6: OverflowMenu gibt den Fokus zurück", () => {
  it("nach der Wahl eines Punktes steht der Fokus auf dem „…“-Knopf", async () => {
    await klick(griff());
    const punkt = container.querySelector('[data-testid="probe-menu-punkt-eins"]');
    expect(punkt, "die Liste ist nicht aufgegangen").not.toBeNull();
    await klick(punkt);
    expect(gewaehlt, "die Wahl ist nicht angekommen").toEqual(["eins"]);
    expect(container.querySelector('[data-testid="probe-menu-liste"]')).toBeNull();
    expect(
      document.activeElement,
      `Fokus liegt auf <${document.activeElement?.tagName.toLowerCase()}> statt auf dem Griff`,
    ).toBe(griff());
  });

  it("der Fokus steht auf dem Griff, BEVOR `onWahl` wirkt — daran hängt der Auslöser des Blatts", async () => {
    // Die Reihenfolge ist der eigentliche Gegenstand: was `onWahl` öffnet, liest den Auslöser aus
    // `document.activeElement`. Steht dort beim Aufruf noch der verschwindende Menüpunkt (oder
    // `body`), hat die geöffnete Fläche kein Rückgabeziel.
    const beobachtet: (Element | null)[] = [];
    await act(async () => {
      root?.render(
        createElement(OverflowMenu, {
          label: "Mehr",
          testId: "probe-menu",
          punkte: [{ id: "eins", label: "Eins" }],
          onWahl: () => {
            beobachtet.push(document.activeElement);
          },
        }),
      );
      await flush();
    });
    await klick(griff());
    await klick(container.querySelector('[data-testid="probe-menu-punkt-eins"]'));
    expect(beobachtet).toEqual([griff()]);
  });

  it("auch der Klick auf den Klickfänger gibt den Fokus zurück", async () => {
    await klick(griff());
    const faenger = container.querySelector(`[aria-label="${i18n.t("cmd.close")}"]`);
    expect(faenger, "kein Klickfänger").not.toBeNull();
    await klick(faenger);
    expect(container.querySelector('[data-testid="probe-menu-liste"]')).toBeNull();
    expect(gewaehlt, "der Fänger darf keine Wahl auslösen").toEqual([]);
    expect(document.activeElement).toBe(griff());
  });
});
