// @vitest-environment jsdom
// ================================================================================================
// JOB 3129 · UX-15 (Befund N-0032) · FALL D — WANDERT DER FOKUS HINAUS, GEHT DIE LISTE ZU.
// ================================================================================================
//
// DER KERN DES BEFUNDS: „bei 320 px wandert Tab hinter das offene Menü." Der Klickfänger
// (`fixed inset-0 z-30`, `tabIndex={-1}`) nimmt der Fläche darunter die MAUS, nicht die
// TABULATORTASTE — derselbe Satz steht seit JOB 3102 in `Seitenblatt.tsx:27-29`. Tabbt man über den
// letzten Punkt hinaus, stand der Ring auf einem sichtbaren Knopf, den kein Klick mehr erreichte,
// während die Liste weiter offen hing.
//
// DIE ZWEITE HÄLFTE IST GENAUSO WICHTIG: der Fokus wird dabei NICHT auf den Griff zurückgerissen.
// Er bleibt, wohin der Mensch ihn eben selbst bewegt hat — sonst wäre die Tabulatortaste an dieser
// Stelle wirkungslos und das Menü ein Käfig statt eines Bedienorts.
//
// Beide Richtungen der Abnahmeliste von N-0032 (Tab und Shift+Tab) sind hier dieselbe Aussage: ein
// Ziel HINTER dem Menü und eines DAVOR, beide ausserhalb der Wurzel des Bauteils.
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

// Die Halterung stellt das Menü ZWISCHEN zwei gewöhnliche Knöpfe der Seite — genau die Nachbarn,
// die im Befund hinter dem Klickfänger erreichbar blieben.
async function mounten(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(
        "div",
        null,
        createElement("button", { type: "button", "data-testid": "probe-davor" }, "Davor"),
        createElement(OverflowMenu, {
          label: "Mehr",
          testId: "probe-menu",
          punkte: [
            { id: "eins", label: "Eins" },
            { id: "zwei", label: "Zwei" },
          ],
          onWahl: () => undefined,
        }),
        createElement("button", { type: "button", "data-testid": "probe-aussen" }, "Aussen"),
      ),
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

async function fokussieren(el: Element | null): Promise<void> {
  expect(el, "Fokusziel fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).focus();
    await flush();
  });
}

const griff = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="probe-menu"]');
const liste = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="probe-menu-liste"]');
const aussen = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="probe-aussen"]');
const davor = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="probe-davor"]');

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

describe("UX-15 · D: der Fokus verlässt das Menü — und nimmt die Liste mit", () => {
  it("Tab hinter den letzten Punkt schliesst die Liste und lässt den Fokus draussen", async () => {
    await klick(griff());
    expect(liste(), "die Liste ist nicht aufgegangen").not.toBeNull();

    await fokussieren(aussen());

    expect(
      liste(),
      "die Liste hängt offen über einer Seite, die den Klick nicht mehr annimmt",
    ).toBeNull();
    expect(
      document.activeElement,
      "der Fokus wurde auf den Griff zurückgerissen — die Tabulatortaste wäre damit wirkungslos",
    ).toBe(aussen());
  });

  it("Shift+Tab vor den Griff schliesst ebenso — dieselbe Weiche, andere Richtung", async () => {
    await klick(griff());
    await fokussieren(davor());

    expect(liste()).toBeNull();
    expect(document.activeElement).toBe(davor());
  });

  it("Bewegungen INNERHALB des Menüs schliessen nicht (Punkt → Punkt)", async () => {
    // Die Gegenprobe zur Weiche: schlösse jede Fokusbewegung, wäre schon der Anfangsfokus das Ende
    // der Liste, und ein Wandern zwischen den Punkten unmöglich.
    await klick(griff());
    await fokussieren(container.querySelector('[data-testid="probe-menu-punkt-zwei"]'));

    expect(liste(), "eine Bewegung innerhalb des Menüs hat es geschlossen").not.toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="probe-menu-punkt-zwei"]'),
    );
  });
});
