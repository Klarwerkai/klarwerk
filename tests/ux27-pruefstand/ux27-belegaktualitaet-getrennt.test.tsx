// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { beleg, box, mount, oeffne, pruefeSichtbar, satzKnoten, text } from "./buehne";

describe.each(["de", "en"])("UX-27 Belegaktualität · %s", (lng) => {
  it.each(["current", "outdated", "missing", "neutral"] as const)(
    "R3 · %s steht in einer eigenen benannten Zeile außerhalb der Konsistenz- und Fassungszahlen",
    async (status) => {
      await i18n.changeLanguage(lng);
      box.belege =
        status === "current" ? [beleg({})] : status === "outdated" ? [beleg({ koVersion: 0 })] : [];
      await mount(status === "neutral" ? { attachments: [] } : {});
      const abschnitt = await oeffne("belege");
      const label = lng === "de" ? "Belegaktualität" : "Evidence freshness";
      const dt = satzKnoten(abschnitt, label);
      expect(dt, "eigene Beschriftung fehlt").not.toBeNull();
      expect(dt?.tagName).toBe("DT");
      const row = dt?.parentElement;
      const dd = row?.querySelector("dd");
      expect(dd).not.toBeNull();
      expect(text(dd as HTMLElement)).toContain(i18n.t(`ko.evFresh.${status}`));
      pruefeSichtbar(dt as HTMLElement, abschnitt);
      pruefeSichtbar(dd as HTMLElement, abschnitt);
      expect(row?.closest(".font-mono"), "Frische steckt weiter im grauen Zahlenblock").toBeNull();
      expect(text(row as HTMLElement)).not.toContain(
        i18n.t("ko.evCons.counts", {
          sources: "0",
          attachments: status === "neutral" ? "0" : "1",
          evidence: String(box.belege.length),
        }),
      );
      expect(row?.querySelector(".kw-confidence")).toBeNull();
    },
  );
});
