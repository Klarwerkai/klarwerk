// @vitest-environment jsdom
// ================================================================================================
// JOB 3129 · UX-15 (Befund N-0032) · FALL E — DIE NUTZENKETTE: „…" → BLATT → ZURÜCK AUF DEN GRIFF.
// ================================================================================================
//
// Die Fälle A–D messen das Bauteil. DIESER Fall misst die Kette, an der der Mensch es merkt, und
// zwar in der Halterung des Aufrufers (`Start.tsx:250-255` und `:336-344`: die Menüwahl setzt den
// Blattzustand, das Blatt hängt daneben) — samt der EINEN Modalgrenze der Shell
// (`ModalBoundaryProvider`), denn ohne sie gäbe das Seitenblatt seinen Fokus gar nicht zurück
// (`Seitenblatt.tsx:104-121`). Der Blattinhalt ist hier bewusst ein einfacher Absatz statt
// `StartPanelInhalt`: Gegenstand ist die Fokuskette, nicht was im Blatt steht.
//
// DREI AUSSAGEN, und die mittlere ist die, die JOB 3129 hätte kaputtmachen können:
//   (a) die Wahl eines Punktes öffnet das Blatt, und der Fokus liegt DARIN
//   (b) Escape schliesst das Blatt und gibt den Fokus auf den „…"-Griff zurück
//       — die beiden Escape-Wege (Menü und Blatt) kommen sich nicht in die Quere, weil der Hörer
//         des Menüs mit der Liste verschwindet
//   (c) beim Aufruf von `onWahl` steht `document.activeElement` auf dem Griff
//       — daran hängt der Auslöser des Blatts (`Seitenblatt.tsx:99-103` liest ihn von dort)
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement, useRef, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ModalBoundaryProvider, ModalRegion } from "../../apps/web/src/app/ModalBoundaryContext";
import { OverflowMenu } from "../../apps/web/src/components/start/OverflowMenu";
import { Seitenblatt } from "../../apps/web/src/components/start/Seitenblatt";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
const beobachtet: (Element | null)[] = [];

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

function Halterung(): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [blatt, setBlatt] = useState<string | null>(null);
  // `children` steht hier IM Props-Objekt, nicht als weitere Argumente von `createElement`: beide
  // Bauteile fordern `children` als Pflichtfeld, und die variadische Überladung von `createElement`
  // füllt ein solches Pflichtfeld nicht (TS2769, gemessen im Tor der Runde 3).
  return createElement(ModalBoundaryProvider, {
    hostRef,
    children: [
      // Der Seiteninhalt ist ein angemeldeter Bereich — wie `AppShell.tsx`. Er wird `inert`, solange
      // das Blatt offen ist; der Portal-Anker darunter liegt ausserhalb davon.
      createElement(ModalRegion, {
        key: "inhalt",
        children: createElement(OverflowMenu, {
          label: "Mehr",
          testId: "h5-start-menu",
          punkte: [
            { id: "eins", label: "Eins" },
            { id: "zwei", label: "Zwei" },
          ],
          onWahl: (id: string) => {
            beobachtet.push(document.activeElement);
            setBlatt(id);
          },
        }),
      }),
      createElement("div", { key: "anker", ref: hostRef, "data-testid": "probe-anker" }),
      blatt
        ? createElement(Seitenblatt, {
            key: "blatt",
            titel: `Blatt ${blatt}`,
            testId: `h5-start-blatt-${blatt}`,
            onSchliessen: () => setBlatt(null),
            children: createElement("p", null, "Inhalt"),
          })
        : null,
    ],
  });
}

async function klick(el: Element | null): Promise<void> {
  expect(el, "Klickziel fehlt").not.toBeNull();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
}

async function escapeDruecken(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();
  });
}

const griff = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="h5-start-menu"]');
const blattEins = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-testid="h5-start-blatt-eins"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
  beobachtet.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(createElement(Halterung));
    await flush();
  });
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
});

describe("UX-15 · E: Startseite — Menü, Blatt und der Weg zurück", () => {
  it("(a) die Wahl eines Punktes öffnet das Blatt, und der Fokus liegt darin", async () => {
    await klick(griff());
    expect(document.activeElement, "der Anfangsfokus des Menüs fehlt").toBe(
      container.querySelector('[data-testid="h5-start-menu-punkt-eins"]'),
    );

    await klick(container.querySelector('[data-testid="h5-start-menu-punkt-eins"]'));

    const blatt = blattEins();
    expect(blatt, "das Blatt ist nicht aufgegangen").not.toBeNull();
    expect(container.querySelector('[data-testid="h5-start-menu-liste"]')).toBeNull();
    expect(
      blatt?.contains(document.activeElement),
      `Fokus liegt auf <${document.activeElement?.tagName.toLowerCase()}> ausserhalb des Blatts`,
    ).toBe(true);
  });

  it("(b) Escape schliesst das Blatt und stellt den Fokus auf den „…“-Griff zurück", async () => {
    await klick(griff());
    await klick(container.querySelector('[data-testid="h5-start-menu-punkt-eins"]'));
    expect(blattEins()).not.toBeNull();

    await escapeDruecken();

    expect(blattEins(), "das Blatt steht nach Escape noch offen").toBeNull();
    expect(
      document.activeElement,
      `Fokus liegt auf <${document.activeElement?.tagName.toLowerCase()}> statt auf dem Griff`,
    ).toBe(griff());
  });

  it("(c) beim Aufruf von `onWahl` steht der Fokus bereits auf dem Griff", async () => {
    await klick(griff());
    await klick(container.querySelector('[data-testid="h5-start-menu-punkt-eins"]'));

    expect(beobachtet, "die Wahl kam nicht genau einmal an").toHaveLength(1);
    expect(beobachtet[0]).toBe(griff());
  });
});
