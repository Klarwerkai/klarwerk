// aufnahme:20260922:gesamt-sprachfeedback · R-1649 — die Erkennung des gesprochenen Satzes.
//
// Gemessen am Text, wie das Diktat ihn ins Fragefeld schreibt. Erkannt werden muss die Rückmeldung
// samt abweichendem Weg; eine Sachfrage, in der dieselben Worte vorkommen, darf es nicht werden.
import { describe, expect, it } from "vitest";
import { erkenneNichtHilfreich } from "../../apps/web/src/lib/nichtHilfreich";

describe("R-1649 · erkenneNichtHilfreich", () => {
  it("der Satz aus der Quelle: Rückmeldung erkannt, Überleitung abgestreift, Weg bleibt wörtlich", () => {
    expect(
      erkenneNichtHilfreich(
        "Das war nicht hilfreich, ich habe es so gemacht: erst entlüften, dann den Deckel lösen.",
      ),
    ).toEqual({ alternative: "erst entlüften, dann den Deckel lösen." });
  });

  it("weitere Wendungen in DE/EN/NL", () => {
    expect(erkenneNichtHilfreich("Hat mir nicht geholfen. Stattdessen Ventil Y schließen")).toEqual(
      { alternative: "Ventil Y schließen" },
    );
    expect(
      erkenneNichtHilfreich("Danke, aber das war leider nicht hilfreich — sondern Filter tauschen"),
    ).toEqual({ alternative: "Filter tauschen" });
    expect(
      erkenneNichtHilfreich("That was not helpful, I did it like this: reset the breaker first"),
    ).toEqual({ alternative: "reset the breaker first" });
    expect(
      erkenneNichtHilfreich("Dat was niet behulpzaam, ik heb het zo gedaan: klep dicht"),
    ).toEqual({ alternative: "klep dicht" });
  });

  it("ohne genannten Weg: Rückmeldung erkannt, Weg leer", () => {
    expect(erkenneNichtHilfreich("Das war nicht hilfreich.")).toEqual({ alternative: "" });
  });

  it("keine Rückmeldung: Fragen, Lob und Worte weit hinten im Satz", () => {
    expect(erkenneNichtHilfreich("Warum ist das Ventil nicht hilfreich?")).toBeNull();
    expect(erkenneNichtHilfreich("Das hat geholfen, danke")).toBeNull();
    expect(
      erkenneNichtHilfreich(
        "Welche Schritte beim Dichtungswechsel an Linie 4 haben sich als nicht hilfreich erwiesen",
      ),
    ).toBeNull();
    expect(erkenneNichtHilfreich("   ")).toBeNull();
  });
});
