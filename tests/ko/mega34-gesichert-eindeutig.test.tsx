// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega34 BLOCK C — „GESICHERT" BEKOMMT SEINE BEDEUTUNG ZURÜCK.
// ================================================================================================
//
// Dasselbe Wort trug zwei Produktdimensionen: den obersten Schritt der dreistufigen Konfidenz-Skala
// (ab 85 % — `quality.assured`) UND, seit mega33, die belegte Antwort-Einstufung. Die Testerin
// klickt von einer Antwort direkt in die Quelle; genau dort, im KO-Detail, war der Balken der
// letzte Ort, der das Wort noch aus einem reinen Prozentwert ableitete.
//
// Pedis Entscheidung, ausgelegt: das Wort wird im KO-Detail ABGESCHALTET, nicht umbenannt. Die
// Skala bleibt vollständig im Code — nur diese Anzeige zeigt sie nicht mehr. Die Prozent-Sprache
// („87 % sicher") trägt die Aussage weiter, so wie Bibliothek, Validierung, Mobil und die kompakte
// Konfliktseite es längst tun.
//
// Der Test pinnt beide Hälften: das Wort ist weg UND die Zahl steht noch da. Ohne die zweite Hälfte
// wäre die Zusage durch Löschen des ganzen Balkens erfüllbar.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): C1 maß die Kopfzeile bis hierher an `KoReadHeader`
// (`components/ko/KoRead.tsx`). Diese Leseansicht hatte seit JOB 3063 keinen Produktaufrufer mehr und
// ist entfernt. Das KO-Detail ist heute das „Mehr" der Bibliothek, und dort steht derselbe Balken mit
// denselben Eigenschaften (`MehrAbschnitte.tsx`). C1 misst jetzt genau diesen Balken und pinnt, dass
// die Fläche ihn so führt.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { SourceEvidence } from "../../apps/web/src/components/ko/SourceEvidence";
import { ConfidenceBar } from "../../apps/web/src/components/trust";
import i18n from "../../apps/web/src/i18n";

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

// Ein KO deutlich über der 85-%-Schwelle — genau der Fall, der bisher „Gesichert" schrieb.
const ko = {
  id: "k1",
  title: "Ventilprüfung",
  statement: "Ventil V4 wird jährlich geprüft.",
  type: "best_practice",
  category: "Betrieb",
  status: "validiert",
  trust: 87,
  confidence: 87,
  author: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
} as never;

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

describe("mega34 C1 · im KO-Detail steht die Zahl, nicht das Wort", () => {
  it("die Kopfzeile des KO-Detail zeigt „87 % sicher“ und NICHT „Gesichert“", () => {
    // Der Balken des KO-Details, wörtlich mit den Eigenschaften, die die Fläche setzt …
    const flaeche = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/bibliothek/MehrAbschnitte.tsx"),
      "utf8",
    );
    expect(flaeche).toContain(
      "<ConfidenceBar value={ko.confidence} showLabel={false} percentPhrase />",
    );
    // … und gerendert mit dem Wert des Beispielobjekts.
    const text = render(
      createElement(ConfidenceBar, {
        value: (ko as { confidence: number }).confidence,
        showLabel: false,
        percentPhrase: true,
      }),
    );

    expect(text).toContain(i18n.t("evidence.percentSure", { pct: 87 }));
    expect(text).not.toContain(GESICHERT);
  });

  it("die volle Belegzeile (Quelle · Datum · Konfidenz) ebenso", () => {
    const text = render(
      createElement(SourceEvidence, { sources: [], sourceDate: null, confidence: 87 } as never),
    );

    expect(text).toContain(i18n.t("evidence.percentSure", { pct: 87 }));
    expect(text).not.toContain(GESICHERT);
  });

  it("C2 · die Skala bleibt unangetastet — die Übersetzung existiert weiter", () => {
    // Umbenannt wird nichts. Vier Tage vor einem Test, dessen Frage „versteht man das?“ lautet,
    // wird kein neues Vokabular in drei Sprachen eingeführt. Der Schlüssel bleibt, er erscheint
    // in dieser Ansicht nur nicht mehr.
    expect(i18n.t("quality.assured")).toBe(GESICHERT);
    expect(i18n.t("quality.reliable")).toBeTruthy();
    expect(i18n.t("quality.preliminary")).toBeTruthy();
  });
});
