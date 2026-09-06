// @vitest-environment jsdom
// ================================================================================================
// JOB 3129 · UX-15 (Befund N-0032) · FALL C — BEIM ÖFFNEN GEHT DER FOKUS IN DIE LISTE.
// ================================================================================================
//
// „Fokus sehen" ist die zweite Hälfte des Befunds und ein EIGENER Fall: ein Bau, der nur Escape
// einbaut, erfüllt den Wortlaut und lässt den Ring trotzdem auf dem Griff stehen, während daneben
// eine offene Liste steht. Vor diesem Bau setzte der Griff ausschliesslich seinen Zustand um.
//
// Das Fokusziel ist der ERSTE MENÜPUNKT, nicht die Wurzel des Bauteils: unter der Wurzel stünden
// der Griff selbst und der Klickfänger (`button`, `tabIndex={-1}`) vor dem ersten Punkt. Und der
// Fokus RUHT danach — dass er sich nicht selbst wieder hinaustreibt (Anfangsfokus gegen
// „Verlassen schliesst", Prüflücke 6d des Auftrags), ist die zweite Zusicherung hier.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { OverflowMenu } from "../../apps/web/src/components/start/OverflowMenu";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

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
        onWahl: () => undefined,
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
  await mounten();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
});

describe("UX-15 · C: der Anfangsfokus liegt auf dem ersten Menüpunkt", () => {
  it("nach dem Öffnen trägt „Eins“ den Fokus, nicht der Griff und nicht der Klickfänger", async () => {
    griff()?.focus();
    await klick(griff());

    const ersterPunkt = container.querySelector('[data-testid="probe-menu-punkt-eins"]');
    expect(ersterPunkt, "die Liste ist nicht aufgegangen").not.toBeNull();
    expect(
      document.activeElement,
      `Fokus liegt auf <${document.activeElement?.tagName.toLowerCase()}> statt auf dem ersten Punkt`,
    ).toBe(ersterPunkt);
    expect(document.activeElement, "der Fokus ist auf dem Griff stehen geblieben").not.toBe(
      griff(),
    );
  });

  it("der Anfangsfokus lässt die Liste offen — er treibt sich nicht selbst hinaus", async () => {
    await klick(griff());
    await act(async () => {
      await flush();
    });

    expect(
      container.querySelector('[data-testid="probe-menu-liste"]'),
      "die Liste hat sich durch den eigenen Anfangsfokus wieder geschlossen",
    ).not.toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="probe-menu-punkt-eins"]'),
    );
  });
});
