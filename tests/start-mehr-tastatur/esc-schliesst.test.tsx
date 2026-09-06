// @vitest-environment jsdom
// ================================================================================================
// JOB 3129 · UX-15 (Befund N-0032) · FALL A/B — ESCAPE SCHLIESST DAS „…"-MENÜ DER STARTSEITE.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (N-0032, 320 px): „Tab wandert hinter das offene Menü, Escape
// schließt nicht." Vor diesem Bau enthielt `OverflowMenu.tsx` keinen einzigen Tastenhörer; der
// einzige Schliessweg hing an zwei Klicks (Klickfänger und Menüpunkt). Wer mit der Tastatur
// öffnete, kam nicht wieder heraus.
//
// ZWEI RICHTUNGEN, damit „ein Escape-Hörer existiert" nicht als erfüllt durchgeht:
//   A  offen  → Escape schliesst UND gibt den Fokus an den Griff zurück
//   B  zu     → dasselbe Escape tut nichts und bewegt keinen Fokus (der Hörer verschwindet mit der
//               Liste — sonst hinge an jeder Startseite ein stiller Tastenhörer)
// Dazu die beiden Lagen aus §9 des Auftrags: erneutes Öffnen nach dem Escape, und das Menü ohne
// Punkte, das gar keinen Bedienort aufspannt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { type MenuPunkt, OverflowMenu } from "../../apps/web/src/components/start/OverflowMenu";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const PUNKTE: MenuPunkt[] = [
  { id: "eins", label: "Eins" },
  { id: "zwei", label: "Zwei" },
];

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

async function mounten(punkte: MenuPunkt[] = PUNKTE): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(OverflowMenu, {
        label: "Mehr",
        testId: "probe-menu",
        punkte,
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

async function escapeDruecken(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();
  });
}

const griff = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="probe-menu"]');
const liste = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="probe-menu-liste"]');

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
  }
  root = null;
});

describe("UX-15 · A: Escape schliesst das offene Menü", () => {
  it("Escape schliesst die Liste und stellt den Fokus auf den „…“-Griff zurück", async () => {
    await mounten();
    await klick(griff());
    expect(liste(), "die Liste ist nicht aufgegangen").not.toBeNull();

    await escapeDruecken();

    expect(liste(), "die Liste steht nach Escape noch offen").toBeNull();
    expect(
      document.activeElement,
      `Fokus liegt auf <${document.activeElement?.tagName.toLowerCase()}> statt auf dem Griff`,
    ).toBe(griff());
  });

  it("nach dem Escape lässt sich das Menü wieder öffnen — und der Fokus geht erneut hinein", async () => {
    // „erneutes Öffnen" aus der Abnahmeliste von N-0032. Ein Schliessweg, der den Zustand nur
    // halb zurücksetzt (Hörer weg, `offen` hängen geblieben), fiele genau hier auf.
    await mounten();
    await klick(griff());
    await escapeDruecken();
    await klick(griff());

    expect(liste(), "das Menü ging nicht wieder auf").not.toBeNull();
    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="probe-menu-punkt-eins"]'),
    );
  });
});

describe("UX-15 · B: bei geschlossenem Menü ist Escape wirkungslos", () => {
  it("Escape bewegt weder Liste noch Fokus, solange das Menü zu ist", async () => {
    await mounten();
    expect(liste(), "das Menü darf ungeöffnet keine Liste zeigen").toBeNull();
    griff()?.focus();
    expect(document.activeElement).toBe(griff());

    await escapeDruecken();

    expect(liste()).toBeNull();
    expect(document.activeElement, "Escape hat den Fokus bewegt, obwohl nichts offen war").toBe(
      griff(),
    );
  });

  it("ohne Punkte entsteht gar kein Menüort — kein Griff, keine Liste, kein Hörer", async () => {
    // §9 des Auftrags, erste Lage: `punkte.length === 0` rendert `null`. Dann darf es auch kein
    // Fokusziel und keinen angemeldeten Tastenhörer geben.
    const daneben = document.createElement("button");
    daneben.setAttribute("data-testid", "probe-daneben");
    document.body.appendChild(daneben);
    await mounten([]);
    daneben.focus();

    expect(griff(), "ohne Punkte darf kein „…“-Knopf entstehen").toBeNull();
    expect(liste()).toBeNull();

    await escapeDruecken();

    expect(liste()).toBeNull();
    expect(document.activeElement, "ein Hörer hat den Fokus bewegt, den es nicht geben darf").toBe(
      daneben,
    );
    daneben.remove();
  });
});
