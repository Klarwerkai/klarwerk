import { describe, expect, it } from "vitest";
import { befund, koAnlegen, welt } from "./welt";

// ================================================================================================
// JOB 3071 — PEDIS SATZ ALS TEST: „OHNE ÜBER FREMDES WISSEN ZU ENTSCHEIDEN".
// ================================================================================================
//
// Die Rücknahme ist eine Entscheidung über den EIGENEN Beitrag. Sie darf die Gegenseite nicht
// anfassen: nicht ihren Inhalt, nicht ihre Fassung, nicht ihren Status — und sie darf auch keinen
// Befund schliessen, an dem der zurückgezogene Beitrag gar nicht beteiligt ist. Genau das wäre die
// naheliegende Überdehnung („das Paar ist erledigt, also räumen wir rundherum auf"), und genau die
// misst dieser Fall.
describe("JOB 3071: die Rücknahme lässt fremdes Wissen unangetastet", () => {
  it("Gegenseite unverändert, ihr Befund mit einem DRITTEN Beitrag bleibt offen", async () => {
    const { services, app, autorin, fremde } = await welt();
    const a = await koAnlegen(
      app,
      autorin,
      "Ventil V3 zuerst",
      "Bei Überdruck Ventil V3 schließen.",
    );
    const b = await koAnlegen(
      app,
      fremde,
      "Pumpe entlüften",
      "Die Pumpe alle 200 Stunden entlüften.",
    );
    const c = await koAnlegen(app, fremde, "Filter wechseln", "Den Feinfilter jährlich tauschen.");
    const paarAB = await befund(services, a, b);
    const paarBC = await befund(services, b, c);

    const vorher = await services.ko.get(b);
    expect(vorher).toBeDefined();

    const del = await app.inject({
      method: "DELETE",
      url: `/api/kos/${a}`,
      headers: autorin.headers,
    });
    expect(del.statusCode).toBe(204);

    // Der eigene Befund ist zurückgezogen …
    expect((await services.overlaps.get(paarAB.id))?.resolution?.reason).toBe("withdrawn_own");

    // … der Befund über fremdem Wissen bleibt OFFEN. Niemand hat für B und C entschieden.
    const bc = await services.overlaps.get(paarBC.id);
    expect(bc?.status).toBe("offen");
    expect(bc?.resolution).toBeUndefined();

    // Und die Gegenseite selbst ist Zeichen für Zeichen dieselbe.
    const nachher = await services.ko.get(b);
    expect(nachher).toEqual(vorher);
  });
});
