// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { onlineManager } from "../../apps/web/node_modules/@tanstack/react-query";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { beleg, box, flush, mount, oeffne, pruefeSichtbar, qc, text } from "./buehne";

function ohneBelegaussage(abschnitt: HTMLElement): void {
  for (const status of ["current", "outdated", "missing", "neutral"]) {
    expect(text(abschnitt)).not.toContain(i18n.t(`ko.evFresh.${status}`));
  }
  expect(text(abschnitt)).not.toContain(i18n.t("ko.evFresh.title"));
  expect(text(abschnitt)).not.toContain(i18n.t("ko.evCons.status.ok"));
  expect(text(abschnitt)).not.toContain(
    i18n.t("ko.evCons.counts", { sources: "0", attachments: "1", evidence: "0" }),
  );
  expect(abschnitt.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("0");
}

describe.each(["de", "en"])("UX-27 Abfragezustände · %s", (lng) => {
  it("laden: Prüfwert bleibt, keine Belegbehauptung aus einer noch offenen Antwort", async () => {
    await i18n.changeLanguage(lng);
    box.belegAbruf = () => new Promise(() => {});
    await mount();
    const abschnitt = await oeffne("belege");
    expect(qc.getQueryState(["ko", "ko-1", "evidence"])?.fetchStatus).toBe("fetching");
    expect(text(abschnitt)).toContain(i18n.t("state.loading"));
    ohneBelegaussage(abschnitt);
  });

  it("Erstfehler: Fehlersatz, keine Aktualitäts- oder Leerbehauptung", async () => {
    await i18n.changeLanguage(lng);
    box.belegAbruf = async () => {
      throw new Error("Belegabruf gescheitert");
    };
    await mount();
    const abschnitt = await oeffne("belege");
    expect(qc.getQueryState(["ko", "ko-1", "evidence"])?.status).toBe("error");
    expect(text(abschnitt)).toContain(i18n.t("state.error"));
    expect(text(abschnitt)).not.toContain(i18n.t("ko.evidenceEmpty"));
    ohneBelegaussage(abschnitt);
  });

  it.each([false, true])(
    "Cache auffrischen (Fehler=%s): Belege UND Aktualität bleiben sichtbar",
    async (fehler) => {
      await i18n.changeLanguage(lng);
      box.belege = [beleg({})];
      await mount();
      const abschnitt = await oeffne("belege");
      const queryKey = ["ko", "ko-1", "evidence"];
      const stand = qc.getQueryState(queryKey)?.dataUpdatedAt;
      const vorher = i18n.t("ko.evFresh.current");
      expect(text(abschnitt)).toContain(vorher);
      let ablehnen: (error: Error) => void = () => {};
      box.belegAbruf = () =>
        new Promise((_resolve, reject) => {
          ablehnen = reject;
        });
      let refetch: Promise<void> | undefined;
      await act(async () => {
        refetch = qc.invalidateQueries({ queryKey });
        await flush();
      });
      expect(qc.getQueryState(queryKey)?.fetchStatus).toBe("fetching");
      if (fehler) {
        await act(async () => {
          ablehnen(new Error("Auffrischung gescheitert"));
          await refetch;
          await flush();
        });
        expect(qc.getQueryState(queryKey)?.status).toBe("error");
        const hinweise = abschnitt.querySelectorAll("output");
        expect(hinweise).toHaveLength(1);
        expect(text(hinweise[0] as HTMLElement)).toMatch(
          lng === "de" ? /Stand von .*Auffrischung fehlgeschlagen/ : /As of .*Refresh failed/i,
        );
        pruefeSichtbar(hinweise[0] as HTMLElement, abschnitt);
      }
      expect(qc.getQueryState(queryKey)?.dataUpdatedAt).toBe(stand);
      expect(text(abschnitt)).toContain("Beleg zum Prüfprotokoll");
      expect(text(abschnitt)).toContain(vorher);
      expect(text(abschnitt)).toContain(i18n.t("ko.evFresh.title"));
      expect(text(abschnitt)).not.toContain(i18n.t("state.error"));
    },
  );

  it.each([false, true])(
    "offline (Bestand=%s): keine neue Abfrage, keine erfundene Aktualität",
    async (bestand) => {
      await i18n.changeLanguage(lng);
      box.belege = [beleg({})];
      await mount();
      let abschnitt: HTMLDetailsElement;
      if (bestand) {
        abschnitt = await oeffne("belege");
        await act(async () => {
          onlineManager.setOnline(false);
          await flush();
        });
      } else {
        await act(async () => {
          onlineManager.setOnline(false);
          await flush();
        });
        abschnitt = await oeffne("belege");
      }
      const anzahl = box.belegAufrufe;
      await act(async () => {
        void qc.invalidateQueries({ queryKey: ["ko", "ko-1", "evidence"] });
        await flush();
      });
      expect(qc.getQueryState(["ko", "ko-1", "evidence"])?.fetchStatus).toBe("paused");
      expect(box.belegAufrufe).toBe(anzahl);
      if (bestand) {
        expect(text(abschnitt)).toContain(i18n.t("ko.evFresh.current"));
        expect(text(abschnitt)).toContain("Beleg zum Prüfprotokoll");
      } else {
        expect(anzahl).toBe(0);
        ohneBelegaussage(abschnitt);
      }
    },
  );
});
