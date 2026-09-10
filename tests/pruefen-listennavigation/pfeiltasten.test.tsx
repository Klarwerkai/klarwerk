// @vitest-environment jsdom
// ================================================================================================
// JOB 3504 · PRUEFEN-LISTENNAVIGATION — MIT DEN PFEILTASTEN DURCH DIE LISTE.
// ================================================================================================
//
// Pedis Wortlaut (über Codex, 10.09. 06:48): wenn links ein Artikel ausgewählt ist, durch die Liste
// gehen, ohne jeden Artikel extra anzuklicken — mit Mausrad UND mit den Pfeiltasten hoch/runter.
//
// Diese Datei misst die Tastenhälfte und ihre GRENZEN, denn die Grenzen sind der eigentliche
// Auftrag: kein globaler Handler, kein gekapertes Textfeld, kein wandernder Fokus, nie eine
// veraltete Antwort rechts.
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

import { act } from "../../apps/web/node_modules/react";
import { endpoints } from "../../apps/web/src/api/endpoints";
import i18n from "../../apps/web/src/i18n";
import {
  type Brett,
  KARTE,
  eintraege,
  eintrag,
  flush,
  gewaehlterEintrag,
  kartenTitel,
  kartenZahl,
  klick,
  mounteBrett,
  sprung,
  taste,
} from "./kulisse";

const TITEL = ["A", "B", "C", "D", "E", "F"] as const;
let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => brett?.abbauen());

describe("JOB 3504 · Pfeiltasten in der Warteschlange", () => {
  it("hoch und runter bewegen die Auswahl, rechts folgt der passende Artikel", async () => {
    brett = await mounteBrett(TITEL);
    expect(eintraege(brett).map((e) => e.textContent)).toEqual([...TITEL]);
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");

    const runter = await taste(eintrag(brett, 0), "ArrowDown");
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
    // Verbraucht: sonst scrollte die Seite zusätzlich unter der Auswahl weg.
    expect(runter.defaultPrevented).toBe(true);

    await taste(eintrag(brett, 0), "ArrowDown");
    expect(kartenTitel(brett)).toBe("C");
    const hoch = await taste(eintrag(brett, 0), "ArrowUp");
    expect(gewaehlterEintrag(brett)).toBe("B");
    expect(kartenTitel(brett)).toBe("B");
    expect(hoch.defaultPrevented).toBe(true);
    // Es bleibt bei EINER Karte rechts — kein zweiter Artikel daneben.
    expect(kartenZahl(brett)).toBe(1);
  });

  it("an den Enden ist Schluss: kein Umlauf, und die Taste bleibt der Seite überlassen", async () => {
    brett = await mounteBrett(TITEL);
    const obenRaus = await taste(eintrag(brett, 0), "ArrowUp");
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
    expect(obenRaus.defaultPrevented).toBe(false);

    for (let i = 0; i < 5; i += 1) {
      await taste(eintrag(brett, 0), "ArrowDown");
    }
    expect(gewaehlterEintrag(brett)).toBe("F");
    const untenRaus = await taste(eintrag(brett, 0), "ArrowDown");
    expect(gewaehlterEintrag(brett)).toBe("F");
    expect(kartenTitel(brett)).toBe("F");
    expect(untenRaus.defaultPrevented).toBe(false);
  });

  it("der Tastaturfokus bleibt, wo er war — die Pfeiltaste verschiebt die Auswahl", async () => {
    brett = await mounteBrett(TITEL);
    const erster = eintrag(brett, 0);
    erster.focus();
    expect(document.activeElement).toBe(erster);
    await taste(erster, "ArrowDown");
    expect(gewaehlterEintrag(brett)).toBe("B");
    // Auswahl und Fokus sind zwei Dinge: der Fokus wandert nicht mit, und der Knopf, der ihn hält,
    // ist derselbe Knoten wie vorher — React hängt die Liste beim Schalten nicht neu auf.
    expect(document.activeElement).toBe(erster);
    expect(eintrag(brett, 0)).toBe(erster);
  });

  it("die Auswahl bleibt sichtbar: der neu gewählte Eintrag wird in Sicht gezogen", async () => {
    brett = await mounteBrett(TITEL);
    await taste(eintrag(brett, 0), "ArrowDown");
    expect(brett.springen).toHaveBeenCalledTimes(1);
    // Gezogen wird der EINTRAG (nicht die Karte, nicht die Seite) und nur so weit wie nötig.
    expect(sprung(brett).ziel).toBe(eintrag(brett, 1));
    expect(sprung(brett).einstellung).toMatchObject({ block: "nearest" });
  });

  it("Pfeiltasten in einem Textfeld bewegen die Auswahl NICHT", async () => {
    brett = await mounteBrett(TITEL);
    await klick(brett.container.querySelector('[data-testid="pruefen-menue-filter"]'));
    const feld = brett.container.querySelector<HTMLInputElement>(
      `input[placeholder="${i18n.t("val.filter")}"]`,
    );
    expect(feld, "das Suchfeld des Filter-Menüs steht").not.toBeNull();
    (feld as HTMLInputElement).focus();
    await taste(feld as HTMLInputElement, "ArrowDown");
    await taste(feld as HTMLInputElement, "ArrowUp");
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
    expect(brett.springen).not.toHaveBeenCalled();
  });

  it("kein globaler Handler: Pfeiltasten ausserhalb der Liste lassen die Auswahl in Ruhe", async () => {
    brett = await mounteBrett(TITEL);
    await taste(document.body, "ArrowDown");
    const karte = brett.container.querySelector<HTMLElement>(KARTE);
    expect(karte).not.toBeNull();
    await taste(karte as HTMLElement, "ArrowDown");
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
    expect(brett.springen).not.toHaveBeenCalled();
  });

  it("mit Zusatztaste gehört der Pfeil der Seite, nicht der Liste", async () => {
    brett = await mounteBrett(TITEL);
    for (const init of [
      { shiftKey: true },
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
    ]) {
      const ev = await taste(eintrag(brett, 0), "ArrowDown", init);
      expect(ev.defaultPrevented).toBe(false);
    }
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
  });

  it("schnelles Weiterschalten zeigt rechts NIE einen vorher gewählten Artikel", async () => {
    brett = await mounteBrett(TITEL);
    const board = endpoints.validation.board as unknown as ReturnType<typeof vi.fn>;
    const abrufeVorher = board.mock.calls.length;

    // (a) Schritt für Schritt: nach JEDEM Schritt steht rechts genau der Artikel der aktuellen
    // Auswahl — nicht der vorherige, nicht der übernächste.
    for (const erwartet of ["B", "C", "D", "E", "F"]) {
      await taste(eintrag(brett, 0), "ArrowDown");
      expect(gewaehlterEintrag(brett)).toBe(erwartet);
      expect(kartenTitel(brett)).toBe(erwartet);
      expect(kartenZahl(brett)).toBe(1);
    }

    // (b) Ein Schwall ohne Atempause: fünf Tastendrücke in EINEM Durchlauf, den React zu EINEM
    // Zeichenlauf bündelt. Danach steht rechts der zuletzt gewählte Artikel — nicht der zweite.
    // Runde 1 stand hier bei E: jeder Schritt las dieselbe alte Auswahl (Validation.tsx, `aktivRef`).
    const erster = eintrag(brett, 0);
    await act(async () => {
      for (let i = 0; i < 5; i += 1) {
        erster.dispatchEvent(
          new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
        );
      }
    });
    await flush();
    expect(gewaehlterEintrag(brett)).toBe("A");
    expect(kartenTitel(brett)).toBe("A");
    expect(kartenZahl(brett)).toBe(1);

    // Der strukturelle Grund, warum es keine späte Antwort GEBEN kann: das Weiterschalten löst
    // keinen artikelbezogenen Abruf aus. Rechts steht eine Ableitung aus der EINEN geladenen
    // Liste — es gibt nichts, was verspätet eintreffen könnte.
    expect(board.mock.calls.length).toBe(abrufeVorher);
  });
});
