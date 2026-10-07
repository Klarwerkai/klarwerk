// @vitest-environment jsdom
// ================================================================================================
// R-0919 / R-0996 · DER BAUSTEINKATALOG `/ui-kit` ZEIGT DIE GRUNDWERTE — OHNE DEN BETRIEB ZU BERÜHREN.
// ================================================================================================
//
// Der Katalog (`pages/UiKit.tsx`, Lieferung FE-FND-07, Route `/ui-kit` ohne Navigationseintrag)
// zeigte bis hierher nur die Vertrauensbausteine (Status, Vertrauen, Wissensart, KI-Entwurf,
// Herkunft). R-0919 verlangt dazu den Baukasten selbst — Farbbedeutung, Schrift, Radien —, R-0996
// eine Vorführfläche, die keinen Arbeitsbetrieb stört. Gemessen an der gemounteten Seite:
//   G1  die sechs Farbbedeutungen stehen da, je mit ihrer Regel;
//   G2  die Schriftskala nennt die Untergrenze 11 px und die vier benannten Stufen (R-0918);
//   G3  die Rückfrage-Vorlage liegt auf neutraler Fläche, Rot nur am gefährlichen Knopf (R-0896);
//   G4  die Vertrauensbausteine sind weiter da;
//   G5  das Anzeigen löst keinen einzigen Netzabruf aus.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { BENANNTE_STUFEN } from "../../apps/web/src/lib/schriftskala";
import { UiKit } from "../../apps/web/src/pages/UiKit";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const abrufe = vi.fn();

function mount(): HTMLDivElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(MemoryRouter, null, createElement(UiKit)));
  });
  return container;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  abrufe.mockReset();
  vi.stubGlobal("fetch", abrufe);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("Bausteinkatalog /ui-kit · Grundwerte", () => {
  it("G1 · sechs Farbbedeutungen: Orange Marke, Ampel nur Status, Violett nur KI, Stahl", () => {
    const c = mount();
    const farben = [...c.querySelectorAll('[data-testid^="bausteine-farbe-"]')];
    expect(farben.map((f) => f.getAttribute("data-testid"))).toEqual([
      "bausteine-farbe-marke",
      "bausteine-farbe-pos",
      "bausteine-farbe-warn",
      "bausteine-farbe-crit",
      "bausteine-farbe-ki",
      "bausteine-farbe-ink",
    ]);
    const text = (id: string): string =>
      c.querySelector(`[data-testid="bausteine-farbe-${id}"]`)?.textContent ?? "";
    expect(text("marke")).toContain("nur Marke und Auswahl");
    expect(text("ki")).toContain("nur KI-Inhalte");
    for (const ampel of ["pos", "warn", "crit"]) {
      expect(text(ampel), ampel).toContain("nur Reife/Status");
    }
    // Das Farbfeld trägt genau die Token-Klasse, deren Bedeutung daneben steht.
    const feld = (id: string): string =>
      c.querySelector(`[data-testid="bausteine-farbe-${id}"] span[aria-hidden]`)?.className ?? "";
    expect(feld("marke")).toContain("bg-brand");
    expect(feld("ki")).toContain("bg-ai");
    expect(feld("crit")).toContain("bg-trust-crit-fill");
  });

  it("G2 · Schriftskala: Untergrenze 11 px und die vier benannten Stufen mit ihrer Klasse", () => {
    const c = mount();
    expect(c.querySelector('[data-testid="bausteine-untergrenze"]')?.textContent).toBe(
      "Untergrenze für Lesetext: 11 px",
    );
    const stufen = [...c.querySelectorAll('[data-testid="bausteine-stufe"]')];
    expect(stufen).toHaveLength(BENANNTE_STUFEN.length);
    BENANNTE_STUFEN.forEach((s, i) => {
      const zeile = stufen[i];
      expect(zeile?.textContent).toContain(`${s.klasse} · ${s.px}px`);
      // Das Muster wird in seiner eigenen Stufe gesetzt — der Katalog zeigt, was er nennt.
      expect(zeile?.querySelector(`span.${s.klasse}`), s.klasse).not.toBeNull();
    });
  });

  it("G3 · Rückfrage-Vorlage: neutrale Fläche, Rot nur am gefährlichen Knopf", () => {
    const c = mount();
    const vorlage = c.querySelector<HTMLElement>('[data-testid="bausteine-rueckfrage"]');
    expect(vorlage).not.toBeNull();
    expect(vorlage?.className).toContain("bg-page");
    expect(vorlage?.className).not.toMatch(/trust-(crit|warn|pos)/);
    const knoepfe = [...(vorlage?.querySelectorAll("button") ?? [])];
    expect(knoepfe.map((k) => k.textContent)).toEqual(["Behalten", "Endgültig löschen"]);
    expect(knoepfe[0]?.className).not.toMatch(/trust-crit/);
    expect(knoepfe[1]?.className).toContain("text-trust-crit-text");
  });

  it("G4 · die Vertrauensbausteine stehen weiter da", () => {
    const text = mount().textContent ?? "";
    for (const titel of ["Status-Pills", "Wissensarten", "Herkunftszeile"]) {
      expect(text, titel).toContain(titel);
    }
  });

  it("G5 · die Vorführfläche ruft nichts ab — sie stört keinen Arbeitsbetrieb", () => {
    mount();
    expect(abrufe).not.toHaveBeenCalled();
  });
});
