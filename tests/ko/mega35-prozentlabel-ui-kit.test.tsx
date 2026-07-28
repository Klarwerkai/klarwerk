// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega35 BLOCK E — DAS PROZENT-LABEL IM UI-KIT.
// ================================================================================================
//
// bens GELB-Befund 4: Das prozentbasierte Qualitätswort („Gesichert" ab 85) ist aus Bibliothek
// (`Library.tsx:957`), Validierung (`Validation.tsx:828`), Mobil und den KO-Leseflächen entfernt —
// alle setzen `showLabel={false}`. `/ui-kit` setzte die Prop nicht und hing damit am Vorgabewert
// `true`: dort stand das Wort weiter, und die Seite ist ohne Nav-Eintrag trotzdem erreichbar
// (`routes.tsx`). mega34 C hatte dem Wort seine Bedeutung zurückgegeben — diese eine Fläche nahm
// sie ihm wieder weg.
//
// Gepinnt wird beides:
//   1. Die Seite selbst zeigt das Wort nicht mehr — und die Zahlen stehen noch da. Ohne die zweite
//      Hälfte wäre die Zusage durch Löschen des ganzen Balkens erfüllbar (Muster aus mega34 C).
//   2. Der VORGABEWERT ist false — sonst wandert dieselbe Falle in die nächste neue Fläche. Wer das
//      Wort will, sagt es ausdrücklich; das tut allein `Ask.tsx:509`, und dort nur bei belegter
//      Einstufung.
//
// Die Übersetzungen bleiben unangetastet — `quality.assured` existiert weiter und wird hier
// ausdrücklich als vorhanden geprüft, damit dieser Test nicht als Erlaubnis missverstanden wird,
// den Schlüssel zu löschen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ConfidenceBar } from "../../apps/web/src/components/trust";
import i18n from "../../apps/web/src/i18n";
import { UiKit } from "../../apps/web/src/pages/UiKit";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Anzeigeform mit großem G — beiläufige Kleinschreibung im Fließtext ist keine Behauptung.
const GESICHERT = "Gesichert";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function render(node: ReturnType<typeof createElement>): string {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(MemoryRouter, null, node));
  });
  return container.textContent ?? "";
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("mega35 E1 · /ui-kit zeigt das prozentbasierte Qualitätswort nicht mehr", () => {
  it("die Seite trägt bei 91 kein „Gesichert“ — und die Zahlen stehen noch da", () => {
    const text = render(createElement(UiKit));
    expect(text).not.toContain(GESICHERT);
    // Der Balken bleibt vollständig: alle drei Schwellen-Beispiele mit ihrer Rohzahl.
    expect(text).toContain("42");
    expect(text).toContain("73");
    expect(text).toContain("91");
  });

  it("auch die beiden anderen Stufen der Skala stehen dort nicht mehr", () => {
    const text = render(createElement(UiKit));
    expect(text).not.toContain(i18n.t("quality.reliable"));
    expect(text).not.toContain(i18n.t("quality.preliminary"));
  });
});

describe("mega35 E2 · der Vorgabewert trägt die Entscheidung", () => {
  it("ohne die Prop steht kein Qualitätswort da — keine neue Fläche kann hineinlaufen", () => {
    const text = render(createElement(ConfidenceBar, { value: 91 }));
    expect(text).not.toContain(GESICHERT);
    expect(text).toContain("91");
  });

  it("ausdrückliches showLabel bleibt möglich — Ask.tsx nutzt es bei belegter Einstufung", () => {
    const text = render(createElement(ConfidenceBar, { value: 91, showLabel: true }));
    expect(text).toContain(GESICHERT);
  });
});

describe("mega35 E3 · die Übersetzungen sind unangetastet", () => {
  it("alle drei Qualitäts-Schlüssel lösen weiterhin auf", () => {
    for (const key of ["quality.assured", "quality.reliable", "quality.preliminary"]) {
      expect(i18n.t(key), key).not.toBe(key);
    }
    expect(i18n.t("quality.assured")).toBe(GESICHERT);
    // Der Balken selbst muss gerendert werden, damit afterEach aufräumen kann.
    render(createElement(ConfidenceBar, { value: 91 }));
  });
});
