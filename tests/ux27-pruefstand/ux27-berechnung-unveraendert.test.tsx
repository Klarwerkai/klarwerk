// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ConfidenceBar } from "../../apps/web/src/components/trust";
import i18n from "../../apps/web/src/i18n";
import { analyzeEvidenceFreshness } from "../../apps/web/src/lib/evidenceFreshness";
import {
  evidenceFreshnessLabelKey,
  evidenceFreshnessTone,
} from "../../apps/web/src/lib/evidenceFreshnessView";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { trustExplainer } from "../../apps/web/src/lib/trustExplainer";
import { beleg, ko, mount, oeffne, text } from "./buehne";

describe.each(["de", "en"])("UX-27 unveränderte Berechnung · %s", (lng) => {
  it.each([
    [0, "rgb(154, 161, 168)", "low", "warn"],
    [40, "rgb(154, 161, 168)", "mid", "warn"],
    [70, "rgb(200, 134, 26)", "high", "pos"],
    [90, "rgb(58, 160, 106)", "high", "pos"],
  ] as const)(
    "R4 · %i: Zahl, Balkenton und Trust-Band bleiben gleich",
    async (value, color, band, tone) => {
      await i18n.changeLanguage(lng);
      await mount({ confidence: value, trust: value });
      const abschnitt = await oeffne("belege");
      const bar = abschnitt.querySelector('[role="progressbar"]');
      expect(bar?.getAttribute("aria-valuenow")).toBe(String(value));
      expect(bar?.getAttribute("aria-valuemin")).toBe("0");
      expect(bar?.getAttribute("aria-valuemax")).toBe("100");
      const fill = bar?.firstElementChild as HTMLElement;
      expect(fill.style.width).toBe(`${value}%`);
      expect(fill.style.background).toBe(color);
      const overview = koOverview({ ...ko(), confidence: value, trust: value });
      expect(overview.trust).toBe(value);
      expect(overview.trustBand).toBe(band);
      const ex = trustExplainer(overview);
      expect(ex.bandKey).toBe(`trust.explain.band.${band}`);
      expect(ex.bandTone).toBe(tone);
      expect(text(abschnitt)).toContain(i18n.t(ex.bandKey));
      const fresh = analyzeEvidenceFreshness({ kos: [ko()], evidence: [beleg({})] }).rows[0];
      expect(fresh).toMatchObject({
        status: "current",
        currentCount: 1,
        olderCount: 0,
        version: 1,
      });
      if (!fresh) throw new Error("Frischestatus fehlt");
      expect(evidenceFreshnessLabelKey(fresh.status)).toBe("ko.evFresh.current");
      expect(evidenceFreshnessTone(fresh.status)).toBe("pos");
    },
  );

  it("ohne percentPhrase bleiben Rohzahl, Label-Vorgabe, Rundung und Schwellen gleich", async () => {
    await i18n.changeLanguage(lng);
    await mount();
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      for (const [input, value, color] of [
        [-1, 0, "rgb(154, 161, 168)"],
        [64, 64, "rgb(154, 161, 168)"],
        [65, 65, "rgb(200, 134, 26)"],
        [84, 84, "rgb(200, 134, 26)"],
        [85, 85, "rgb(58, 160, 106)"],
        [90.6, 91, "rgb(58, 160, 106)"],
        [101, 100, "rgb(58, 160, 106)"],
      ] as const) {
        act(() => root.render(createElement(ConfidenceBar, { value: input })));
        expect(text(host)).toBe(String(value));
        expect(host.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe(
          String(value),
        );
        expect(
          (host.querySelector('[role="progressbar"] > div') as HTMLElement).style.background,
        ).toBe(color);
      }
    } finally {
      act(() => root.unmount());
    }
  });
});
