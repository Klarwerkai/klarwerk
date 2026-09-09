// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { mount, oeffne, pruefeSichtbar, satzKnoten, text } from "./buehne";

describe.each(["de", "en"])("UX-27 Kurztext · %s", (lng) => {
  it("R1 · offenes KO mit 0: Text, title und zugänglicher Name versprechen keine Wahrheit", async () => {
    await i18n.changeLanguage(lng);
    await mount();
    const abschnitt = await oeffne("belege");
    const bar = abschnitt.querySelector<HTMLElement>(".kw-confidence");
    expect(bar).not.toBeNull();
    const verboten = lng === "de" ? /sicher|Sicherheit|gesichert/i : /sure|certainty|confident/i;
    expect(text(bar as HTMLElement)).not.toMatch(verboten);
    expect(text(bar as HTMLElement)).toBe(lng === "de" ? "Prüfstand: 0 %" : "Review status: 0 %");
    expect(bar?.title).toBe(lng === "de" ? "Prüfstand: 0 von 100" : "Review status: 0 of 100");
    const progress = bar?.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute("aria-label")).toBe(bar?.title);
    for (const e of [bar, ...Array.from(bar?.querySelectorAll("[title], [aria-label]") ?? [])]) {
      expect(e?.getAttribute("title") ?? "").not.toMatch(verboten);
      expect(e?.getAttribute("aria-label") ?? "").not.toMatch(verboten);
    }
    pruefeSichtbar(bar as HTMLElement, abschnitt);
  });

  it("R2 · die Einordnung steht bei der Zahl, ohne die vertiefende Erklärung aufzuklappen", async () => {
    await i18n.changeLanguage(lng);
    await mount();
    const abschnitt = await oeffne("belege");
    const meta = i18n.t("trust.explain.meta");
    expect(meta).toMatch(
      lng === "de" ? /Review.*Evidenzsignal.*kein/i : /review.*evidence signal.*not/i,
    );
    const knoten = satzKnoten(abschnitt, meta);
    expect(knoten).not.toBeNull();
    pruefeSichtbar(knoten as HTMLElement, abschnitt);
    expect(abschnitt.querySelector("details")?.open).toBe(false);
    expect(text(abschnitt.querySelector(".kw-confidence") as HTMLElement)).toMatch(
      lng === "de" ? /Prüfstand/ : /Review status/,
    );
    expect(abschnitt.querySelectorAll("p").length).toBeGreaterThan(0);
    expect(
      Array.from(abschnitt.querySelectorAll("p")).filter((p) => text(p) === meta),
    ).toHaveLength(1);
  });

  it("validiert mit 0 behält den bestehenden Sonderhinweis", async () => {
    await i18n.changeLanguage(lng);
    await mount({ status: "validiert", confidence: 0 });
    const abschnitt = await oeffne("belege");
    expect(abschnitt.querySelector(".kw-confidence")).toBeNull();
    expect(text(abschnitt)).toContain(i18n.t("lib.confidenceNone"));
  });
});
