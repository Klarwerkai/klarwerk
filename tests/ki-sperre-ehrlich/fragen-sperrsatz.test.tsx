import { describe, expect, it } from "vitest";
// @vitest-environment jsdom
import { act } from "../../apps/web/node_modules/react";
import { ApiError } from "../../apps/web/src/api/client";
import i18n from "../../apps/web/src/i18n";
import { MODELL, UNBEKANNT, fragenSeite, json } from "./fragen-fixture";

describe("JOB 3220 · Statusfehler auf /fragen", () => {
  for (const sprache of ["de", "en"] as const) {
    for (const fehler of ["Netzfehler", "HTTP 503"] as const) {
      it(`${fehler === "Netzfehler" ? "F2" : "F3"} · ${fehler} · ${sprache}: unbekannt, alter Satz weg, Knopf gesperrt`, async () => {
        const seite = await fragenSeite(() => {
          if (fehler === "Netzfehler") throw new TypeError("Failed to fetch");
          return json({ error: "STATUS_FAILURE", message: "Interne Diagnose" }, 503);
        }, sprache);
        await seite.fertig();
        const status = seite.client.getQueryState(["reasoner", "status"]);
        expect(status?.status).toBe("error");
        expect(status?.data).toBeUndefined();
        if (fehler === "HTTP 503") {
          expect(status?.error).toBeInstanceOf(ApiError);
          expect(status?.error).toMatchObject({ status: 503 });
        } else {
          expect(status?.error).toBeInstanceOf(TypeError);
        }
        expect(seite.container.textContent).toContain(UNBEKANNT[sprache]);
        expect(seite.container.textContent).not.toContain(i18n.t("ai.unavailable.hint"));
        expect(i18n.getResource(sprache, "translation", "ai.statusUnknown.hint")).toBe(
          UNBEKANNT[sprache],
        );
        expect(seite.container.textContent).not.toContain("Interne Diagnose");
        expect(seite.knopf.title).toBe(UNBEKANNT[sprache]);
        expect(seite.knopf.disabled).toBe(true);
        // Auch ein programmatisches Submit darf den bestehenden Sperrvertrag nicht umgehen.
        await act(async () => {
          seite.container
            .querySelector("form")
            ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        expect(seite.anfragen.filter((a) => a.method !== "GET")).toEqual([]);
      });
    }
  }

  it("F6 · erfolgreicher Refetch löst unbekannt auf und gibt den Antwortknopf frei", async () => {
    let fehler = true;
    const seite = await fragenSeite(() => (fehler ? json({}, 503) : json(MODELL)));
    await seite.fertig();
    expect(seite.container.textContent).toContain(UNBEKANNT.de);
    expect(seite.knopf.disabled).toBe(true);
    fehler = false;
    await act(async () => {
      await seite.client.refetchQueries({ queryKey: ["reasoner", "status"] });
    });
    await seite.warten(() => expect(seite.knopf.disabled).toBe(false));
    expect(seite.container.textContent).not.toContain(UNBEKANNT.de);
    expect(seite.container.textContent).not.toContain(i18n.t("ai.unavailable.hint"));
  });
});
