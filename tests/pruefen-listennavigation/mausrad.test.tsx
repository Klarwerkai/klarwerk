// @vitest-environment jsdom
// ================================================================================================
// JOB 3504 · PRUEFEN-LISTENNAVIGATION — MIT DEM MAUSRAD DURCH DIE LISTE.
// ================================================================================================
//
// Die zweite Hälfte von Pedis Satz. Sie hat eine eigene Falle, die die Tastenhälfte nicht hat: das
// Rad ist ein Strom, kein Anschlag. Ein Trackpad schickt Dutzende winziger `wheel`-Ereignisse; ohne
// Schwelle rauschte die Auswahl bei der kleinsten Handbewegung durch die halbe Liste. Gemessen wird
// deshalb nicht nur DASS geschaltet wird, sondern WIE OFT.
//
// Und die Grenze: über dem Detailbereich rechts bewegt das Rad gar nichts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import {
  type Brett,
  KARTE,
  eintrag,
  gewaehlterEintrag,
  kartenTitel,
  kartenZahl,
  maus,
  mounteBrett,
  rad,
  sprung,
} from "./kulisse";

const TITEL = ["A", "B", "C", "D", "E", "F"] as const;
/** Ein Rastpunkt eines gewöhnlichen Mausrads. */
const RASTE = 100;
let brett: Brett;

function liste(b: Brett): HTMLElement {
  const ul = b.container.querySelector<HTMLElement>('[data-testid="pruefen-warteschlange"]');
  expect(ul, "die Warteschlange steht").not.toBeNull();
  return ul as HTMLElement;
}
function karte(b: Brett): HTMLElement {
  const el = b.container.querySelector<HTMLElement>(KARTE);
  expect(el, "die Karte steht").not.toBeNull();
  return el as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

describe("JOB 3504 · Mausrad über der Warteschlange", () => {
  it("eine Raste nach unten schaltet einen Artikel weiter, rechts folgt er", async () => {
    brett = await mounteBrett(TITEL);
    expect(kartenTitel(brett)).toBe("A");
    const runter = await rad(liste(brett), RASTE);
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
    expect(kartenZahl(brett)).toBe(1);
    // Verbraucht: die Seite scrollt nicht zusätzlich unter der Auswahl weg.
    expect(runter.defaultPrevented).toBe(true);

    await rad(liste(brett), RASTE);
    expect(kartenTitel(brett)).toBe("C");
    const hoch = await rad(liste(brett), -RASTE);
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
    expect(hoch.defaultPrevented).toBe(true);
  });

  it("ein Rad über einem EINTRAG wirkt genauso — der Zeiger steht ja über der Liste", async () => {
    brett = await mounteBrett(TITEL);
    await rad(eintrag(brett, 3), RASTE);
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
  });

  it("winzige Trackpad-Schübe rauschen nicht durch: erst die Schwelle schaltet", async () => {
    brett = await mounteBrett(TITEL);
    for (let i = 0; i < 3; i += 1) {
      const ev = await rad(liste(brett), 12);
      // Verbraucht wird der Schub trotzdem — sonst führe die Seite in Schüben mit.
      expect(ev.defaultPrevented).toBe(true);
      expect(gewaehlterEintrag(brett)).toBe("A");
    }
    await rad(liste(brett), 12);
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
    // Nach dem Schalten beginnt die Zählung neu: der nächste kleine Schub schaltet nicht sofort.
    await rad(liste(brett), 12);
    expect(gewaehlterEintrag(brett)).toBe("B");
  });

  it("ein Richtungswechsel verwirft die angesammelten Schübe", async () => {
    brett = await mounteBrett(TITEL);
    await rad(liste(brett), 30);
    expect(gewaehlterEintrag(brett)).toBe("A");
    // Ohne Verwerfen stünde jetzt 30 − 20 = 10 und der nächste Schub nach unten schaltete zu früh.
    await rad(liste(brett), -20);
    expect(gewaehlterEintrag(brett)).toBe("A");
    await rad(liste(brett), 30);
    expect(gewaehlterEintrag(brett)).toBe("A");
    await rad(liste(brett), 30);
    expect(gewaehlterEintrag(brett)).toBe("B");
  });

  it("Räder im Zeilenmaß (deltaMode 1) zählen als Zeilen, nicht als Pixel", async () => {
    brett = await mounteBrett(TITEL);
    // Firefox liefert für eine Raste `deltaMode: 1, deltaY: 3` — drei Zeilen.
    await rad(liste(brett), 3, 1);
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
  });

  it("die Auswahl bleibt sichtbar: der neu gewählte Eintrag wird in Sicht gezogen", async () => {
    brett = await mounteBrett(TITEL);
    await rad(liste(brett), RASTE);
    expect(brett.springen).toHaveBeenCalledTimes(1);
    expect(sprung(brett).ziel).toBe(eintrag(brett, 1));
    expect(sprung(brett).einstellung).toMatchObject({ block: "nearest" });
  });

  it("Mausrad über dem Detailbereich bewegt die Auswahl NICHT", async () => {
    brett = await mounteBrett(TITEL);
    for (let i = 0; i < 5; i += 1) {
      const ev = await rad(karte(brett), RASTE);
      // Dort gehört das Rad der Seite: nichts wird verbraucht.
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
    expect(brett.springen).not.toHaveBeenCalled();
  });

  it("am Ende der Liste gehört das Rad wieder der Seite", async () => {
    brett = await mounteBrett(TITEL);
    const obenRaus = await rad(liste(brett), -RASTE);
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(obenRaus.defaultPrevented).toBe(false);
    for (let i = 0; i < 5; i += 1) {
      await rad(liste(brett), RASTE);
    }
    expect(gewaehlterEintrag(brett)).toBe("F");
    const untenRaus = await rad(liste(brett), RASTE);
    expect(gewaehlterEintrag(brett)).toBe("F");
    expect(kartenTitel(brett)).toBe("F");
    expect(untenRaus.defaultPrevented).toBe(false);
  });

  it("bloßes Überfahren mit der Maus wählt nichts aus", async () => {
    brett = await mounteBrett(TITEL);
    const ziel = eintrag(brett, 4);
    for (const typ of ["mouseenter", "mouseover", "mousemove", "pointerover"]) {
      await maus(ziel, typ);
    }
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
    expect(brett.springen).not.toHaveBeenCalled();
  });
});
