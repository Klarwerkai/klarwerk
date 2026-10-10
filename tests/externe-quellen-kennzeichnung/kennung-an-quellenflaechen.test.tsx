// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung · R-0205 — „STUFE 2" UND „EXTERN · UNGEPRÜFT"
// ================================================================================================
//
// Originalwortlaut: „Jede externe Quelle trägt sichtbar das Etikett ‚Stufe 2': Sie stützt das Wissen,
// ersetzt aber keine einzige Prüfstimme. Extern stammende Inhalte sollen überall einen
// Herkunfts-Hinweis ‚Extern · ungeprüft' tragen."
//
// STARTSTAND (Basis ceb29795): „Extern · ungeprüft" stand allein in `KoView`; ein Etikett „Stufe 2"
// stand an KEINER Quelle (nur in Hilfetexten und `ko.sourcesHint`). Bibliothek, Prüfkarte,
// Belegschicht (`SourceEvidence`) und die Erfassungs-Warteliste zeigten nur den Prüfstand
// „extern · nicht peer-validiert".
//
// HIER gemessen: der gemeinsame Baustein selbst (Bedingung fail-closed, drei Sprachen, lesbarer
// Text) und die beiden reinen Flächen `KoView` und `SourceEvidence`. Die Seitenflächen sind in
// ihren vorhandenen, gemounteten Tests ergänzt:
//   · Bibliothek   `tests/bibliothek-quellennachweis/nachweis-im-bibliotheksabschnitt.test.tsx` (E)
//   · Prüfkarte    `tests/pruefen-quellennachweis/nachweis-an-der-pruefkarte.test.tsx` (g)
//   · Warteliste   `tests/capture/job2683-d2-suche-flaeche.test.tsx`
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { KnowledgeObject, KoSource } from "../../apps/web/src/api/types";
import { KoView } from "../../apps/web/src/components/KoView";
import { ExterneQuelleKennung } from "../../apps/web/src/components/ko/ExterneQuelleKennung";
import { SourceEvidence } from "../../apps/web/src/components/ko/SourceEvidence";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STUFE = "externequelle.stufe";
const HINWEIS = "ko.sourceExternUnchecked";
const ERKLAERUNG = "externequelle.erklaerung";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(element: ReturnType<typeof createElement>): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(element);
  });
}

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

function quelle(overrides: Partial<KoSource> = {}): KoSource {
  return {
    id: "q-1",
    label: "Zugekaufte Norm DIN-X",
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    author: "u1",
    at: "2026-09-14T10:00:00Z",
    ...overrides,
  } as KoSource;
}

function eintragMit(label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll("li")).find((li) =>
    (li.textContent ?? "").includes(label),
  );
}

describe("R-0205 · der gemeinsame Baustein ExterneQuelleKennung", () => {
  it("B1 · peerValidated=false: „Stufe 2“ und „Extern · ungeprüft“ als lesbarer Text", () => {
    mount(createElement(ExterneQuelleKennung, { source: { peerValidated: false } }));
    const text = container.textContent ?? "";
    expect(i18n.t(STUFE), `${STUFE} ist nicht übersetzt`).not.toBe(STUFE);
    expect(text).toContain(i18n.t(STUFE));
    expect(text).toContain(i18n.t(HINWEIS));
    // Die Begründung „stützt, ersetzt keine Prüfstimme" hängt am Etikett.
    const etikett = container.querySelector('[data-testid="quelle-stufe2"]');
    expect(etikett?.getAttribute("title")).toBe(i18n.t(ERKLAERUNG));
    expect(i18n.t(ERKLAERUNG)).toContain("Prüfstimme");
  });

  it("B2 · peerValidated=true: keine Kennzeichnung", () => {
    mount(createElement(ExterneQuelleKennung, { source: { peerValidated: true } }));
    expect(container.textContent ?? "").toBe("");
  });

  it("B3 · fehlendes Feld gilt als ungeprüft (fail-closed wie F-0205 K3)", () => {
    mount(
      createElement(ExterneQuelleKennung, {
        source: {} as Pick<KoSource, "peerValidated">,
      }),
    );
    expect(container.textContent ?? "").toContain(i18n.t(STUFE));
    expect(container.textContent ?? "").toContain(i18n.t(HINWEIS));
  });

  it("B4 · DE/EN/NL: beide Texte stammen aus dem Register und folgen der Sprache", async () => {
    const gesehen = new Set<string>();
    for (const sprache of ["de", "en", "nl"] as const) {
      const fix = i18n.getFixedT(sprache);
      for (const schluessel of [STUFE, HINWEIS, ERKLAERUNG]) {
        expect(fix(schluessel), `${schluessel} fehlt in ${sprache}`).not.toBe(schluessel);
        expect(String(fix(schluessel)).trim().length).toBeGreaterThan(0);
      }
      await i18n.changeLanguage(sprache);
      mount(createElement(ExterneQuelleKennung, { source: { peerValidated: false } }));
      const text = container.textContent ?? "";
      expect(text).toContain(String(fix(STUFE)));
      expect(text).toContain(String(fix(HINWEIS)));
      gesehen.add(text);
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    // afterEach räumt einen gemounteten Baum ab — ein leerer genügt.
    mount(createElement("div"));
    expect(gesehen.size, "die Sprachen zeigen denselben Text — keine Registerbindung").toBe(3);
  });
});

describe("R-0205 · KoView und Belegschicht tragen die Kennzeichnung an der externen Quelle", () => {
  it("K1 · KoView: Etikett und Hinweis nur an der nicht peer-validierten Quelle", () => {
    const ko = {
      id: "ko-1",
      title: "Anfahren der Kesselspeisepumpe",
      statement: "Die Pumpe wird langsam angefahren.",
      status: "validiert",
      conditions: [],
      measures: [],
      trust: 80,
      sources: [
        quelle({ id: "q-geprueft", label: "Interne Betriebsanweisung", peerValidated: true }),
        quelle({ id: "q-extern", label: "Zugekaufte Norm DIN-X" }),
      ],
    } as unknown as KnowledgeObject;
    mount(createElement(KoView, { ko }));

    const extern = eintragMit("Zugekaufte Norm DIN-X")?.textContent ?? "";
    const geprueft = eintragMit("Interne Betriebsanweisung")?.textContent ?? "";
    expect(extern).toContain(i18n.t(STUFE));
    expect(extern).toContain(i18n.t(HINWEIS));
    expect(geprueft).not.toContain(i18n.t(STUFE));
    expect(geprueft).not.toContain(i18n.t(HINWEIS));
  });

  it("K2 · SourceEvidence (KO-Lesefläche, Konflikte, Vergleich): dieselbe Regel, Prüfstand bleibt", () => {
    mount(
      createElement(SourceEvidence, {
        sources: [
          quelle({ id: "q-extern", label: "Zugekaufte Norm DIN-X", provider: "SharePoint" }),
          quelle({ id: "q-geprueft", label: "Interne Betriebsanweisung", peerValidated: true }),
        ],
        variant: "full",
      }),
    );
    const extern = eintragMit("Zugekaufte Norm DIN-X")?.textContent ?? "";
    const geprueft = eintragMit("Interne Betriebsanweisung")?.textContent ?? "";
    expect(extern).toContain(i18n.t(STUFE));
    expect(extern).toContain(i18n.t(HINWEIS));
    // R-0177: die Kennzeichnung „nicht peer-validiert" bleibt daneben bestehen.
    expect(extern).toContain(i18n.t("ko.sourceUnvalidated"));
    expect(geprueft).not.toContain(i18n.t(STUFE));
    expect(geprueft).not.toContain(i18n.t(HINWEIS));
    expect(geprueft).toContain(i18n.t("ko.sourceValidated"));
  });

  it("K3 · compact-Variante: auch die einzeilige Belegzeile kennzeichnet die erste Quelle", () => {
    mount(
      createElement(SourceEvidence, {
        sources: [quelle({ id: "q-extern", label: "Zugekaufte Norm DIN-X" })],
        variant: "compact",
      }),
    );
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t(STUFE));
    expect(text).toContain(i18n.t(HINWEIS));
  });
});
