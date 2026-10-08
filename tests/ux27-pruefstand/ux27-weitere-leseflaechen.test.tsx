// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { SourceEvidence } from "../../apps/web/src/components/ko/SourceEvidence";
import i18n from "../../apps/web/src/i18n";
import { makeKo, makeSource } from "../../apps/web/src/test/render";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await i18n.changeLanguage("de");
});

// Lieferung 8: dieselben echten Verbraucher, deren alte Wortlaut-Pins in Runde 1 rot wurden.
// Die bestehenden Tests außerhalb der Zielpfade bleiben aktiv; diese Fälle ersetzen sie nicht.
// R-1349: Die Fälle „erfassen" (IntakeEmptyState) und „konflikt" (ConflictKoSide) sind mit ihren
// Komponenten entfallen — beide hatten seit JOB 3062 bzw. 3061 keinen Produktaufrufer mehr. Ihr
// Beleg kommt auf den heutigen Flächen aus derselben `SourceEvidence`, die hier weiter geprüft wird.
// Ebenso der Fall „lesen" (`KoReadView`, die Zonen-Leseansicht): seit JOB 3063 ohne Produktaufrufer
// und mit R-1349 entfernt; die Lesefläche der Bibliothek führt den Balken über `ConfidenceBar`
// (gemessen in `tests/ko/mega34-gesichert-eindeutig.test.tsx`).
describe.each(["de", "en"])("UX-27 weitere Leseflächen · %s", (lng) => {
  it.each(["quelle-voll", "quelle-kompakt"] as const)(
    "%s: sichtbarer Prüfstand und zugänglicher Name passen zur unveränderten Quelle und Zahl",
    async (flaeche) => {
      await i18n.changeLanguage(lng);
      const source = makeSource({ label: "Prüfprotokoll", url: "https://example.com/protokoll" });
      const ko = makeKo({ title: "Ventil prüfen", confidence: 84, sources: [source] });
      const element = createElement(SourceEvidence, {
        sources: [source],
        confidence: ko.confidence,
        date: source.at,
        variant: flaeche === "quelle-voll" ? "full" : "compact",
      });
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      try {
        act(() => root.render(element));
        const bars = host.querySelectorAll<HTMLElement>(".kw-confidence");
        expect(bars).toHaveLength(1);
        for (const bar of bars) {
          expect(bar.textContent).toBe(lng === "de" ? "Prüfstand: 84 %" : "Review status: 84 %");
          expect(bar.title).toBe(
            lng === "de" ? "Prüfstand: 84 von 100" : "Review status: 84 of 100",
          );
          const progress = bar.querySelector('[role="progressbar"]');
          expect(progress?.getAttribute("aria-label")).toBe(bar.title);
          expect(progress?.getAttribute("aria-valuenow")).toBe("84");
          expect(bar.closest("details:not([open]), [hidden], [aria-hidden='true']")).toBeNull();
        }
        const link = host.querySelector('a[href="https://example.com/protokoll"]');
        expect(link?.textContent).toBe("Prüfprotokoll");
        expect(host.textContent).toContain(lng === "de" ? "Quelle vom" : "Source dated");
      } finally {
        act(() => root.unmount());
        host.remove();
      }
    },
  );

  it.each(["full", "compact"] as const)(
    "%s ohne Konfidenz: keine erfundene Zahl oder Prüfstandsbeschriftung",
    async (variant) => {
      await i18n.changeLanguage(lng);
      const host = document.createElement("div");
      const root = createRoot(host);
      try {
        act(() => root.render(createElement(SourceEvidence, { sources: [makeSource()], variant })));
        expect(host.querySelector('[role="progressbar"]')).toBeNull();
        expect(host.textContent).not.toMatch(/Prüfstand|Review status|%/);
        expect(host.querySelector('a[href="https://example.com/handbuch"]')).not.toBeNull();
      } finally {
        act(() => root.unmount());
      }
    },
  );
});
