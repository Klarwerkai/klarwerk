// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { IntakeEmptyState } from "../../apps/web/src/components/capture/intake/IntakeEmptyState";
import { ConflictKoSide } from "../../apps/web/src/components/conflicts/ConflictKoSide";
import { KoReadView } from "../../apps/web/src/components/ko/KoReadView";
import { SourceEvidence } from "../../apps/web/src/components/ko/SourceEvidence";
import i18n from "../../apps/web/src/i18n";
import { makeKo, makeSource } from "../../apps/web/src/test/render";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
  await i18n.changeLanguage("de");
});

// Lieferung 8: dieselben echten Verbraucher, deren alte Wortlaut-Pins in Runde 1 rot wurden.
// Die bestehenden Tests außerhalb der Zielpfade bleiben aktiv; diese Fälle ersetzen sie nicht.
describe.each(["de", "en"])("UX-27 weitere Leseflächen · %s", (lng) => {
  it.each(["lesen", "quelle-voll", "quelle-kompakt", "erfassen", "konflikt"] as const)(
    "%s: sichtbarer Prüfstand und zugänglicher Name passen zur unveränderten Quelle und Zahl",
    async (flaeche) => {
      await i18n.changeLanguage(lng);
      const source = makeSource({ label: "Prüfprotokoll", url: "https://example.com/protokoll" });
      const ko = makeKo({ title: "Ventil prüfen", confidence: 84, sources: [source] });
      const element =
        flaeche === "lesen"
          ? createElement(KoReadView, { ko })
          : flaeche === "erfassen"
            ? createElement(IntakeEmptyState, { example: ko, onStart: () => {} })
            : flaeche === "konflikt"
              ? createElement(ConflictKoSide, { ko, fallbackId: ko.id })
              : createElement(SourceEvidence, {
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
        expect(bars).toHaveLength(flaeche === "lesen" ? 2 : 1);
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
        if (flaeche === "lesen" || flaeche === "erfassen" || flaeche === "konflikt") {
          expect(host.textContent).toContain("Ventil prüfen");
        }
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
