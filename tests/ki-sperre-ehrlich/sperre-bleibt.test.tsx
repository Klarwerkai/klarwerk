import { describe, expect, it } from "vitest";
// @vitest-environment jsdom
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { MODELL, OHNE_MODELL, UNBEKANNT, fragenSeite, json } from "./fragen-fixture";

describe("JOB 3220 · bestehender Sperrvertrag", () => {
  it.each([
    ["active:false", OHNE_MODELL],
    ["tasks.answer:false", { ...MODELL, tasks: { answer: false } }],
    ["reachable:unreachable", { ...MODELL, reachable: "unreachable" }],
  ])("F4 · %s: alter Satz und Knopf gesperrt", async (_name, status) => {
    const seite = await fragenSeite(() => json(status));
    await seite.fertig();
    expect(seite.container.textContent).toContain(i18n.t("ai.unavailable.hint"));
    expect(seite.container.textContent).not.toContain(UNBEKANNT.de);
    expect(seite.knopf.title).toBe(i18n.t("ai.unavailable.hint"));
    expect(seite.knopf.disabled).toBe(true);
  });

  it("F5 · nutzbares Modell: kein Sperrsatz und Knopf bedienbar", async () => {
    const seite = await fragenSeite(() => json(MODELL));
    await seite.fertig();
    expect(seite.container.textContent).not.toContain(i18n.t("ai.unavailable.hint"));
    expect(seite.container.textContent).not.toContain(UNBEKANNT.de);
    expect(seite.knopf.title).toBe("");
    expect(seite.knopf.disabled).toBe(false);
  });

  it("F7 · Erstabruf läuft: kein Sperrsatz und Knopf bedienbar", async () => {
    const seite = await fragenSeite(() => new Promise<Response>(() => undefined));
    expect(seite.client.getQueryState(["reasoner", "status"])?.fetchStatus).toBe("fetching");
    expect(seite.container.textContent).not.toContain(i18n.t("ai.unavailable.hint"));
    expect(seite.container.textContent).not.toContain(UNBEKANNT.de);
    expect(seite.knopf.disabled).toBe(false);
  });

  it.each([true, false])(
    "F8 · Cache nutzbar=%s: laufender und gescheiterter Refetch bewahren Status",
    async (nutzbar) => {
      let antwort = () => Promise.resolve(json(nutzbar ? MODELL : OHNE_MODELL));
      const seite = await fragenSeite(() => antwort());
      await seite.fertig();
      let ablehnen: (reason: Error) => void = () => {
        throw new Error("Refetch fehlt");
      };
      antwort = () =>
        new Promise<Response>((_resolve, reject) => {
          ablehnen = reject;
        });
      let refetch: Promise<void> | undefined;
      await act(async () => {
        refetch = seite.client.refetchQueries({ queryKey: ["reasoner", "status"] });
      });
      expect(seite.client.getQueryState(["reasoner", "status"])?.fetchStatus).toBe("fetching");
      const pruefen = () => {
        expect(seite.knopf.disabled).toBe(!nutzbar);
        expect(seite.container.textContent).not.toContain(UNBEKANNT.de);
        expect(seite.container.textContent?.includes(i18n.t("ai.unavailable.hint"))).toBe(!nutzbar);
      };
      pruefen();
      await act(async () => {
        ablehnen(new TypeError("Failed to fetch"));
        await refetch;
      });
      await seite.warten(() =>
        expect(seite.client.getQueryState(["reasoner", "status"])?.status).toBe("error"),
      );
      pruefen();
    },
  );
});
