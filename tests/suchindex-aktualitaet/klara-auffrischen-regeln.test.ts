// ================================================================================================
// R-0338 (Aufnahme gesamt-suchindex-aktualitaet) — DER AUFFRISCHEN-VERTRAG, OHNE BROWSER.
// ================================================================================================
//
// Geprüft wird `apps/web/src/lib/fragenArbeitsstand.ts` gegen die Regeln am Vertrag:
//   F1  Der Stand kommt vom SERVER und gilt nur vollständig — sonst gibt es keinen.
//   F2  Mit Stand: überholt bei fehlender, aufgegangener oder NEUERER Quelle.
//   F3  Mit Stand und älterem Browserbestand: der Browser ist veraltet, nicht die Antwort.
//   F4  Ohne Stand (Altbestand): Verlauf nach der Antwort, Fehlen oder Unwissen ⇒ überholt.
//   F5  Ohne Stand, aber mit Beobachtung beim Eintreffen: nur eine spätere Fassung macht überholt.
//   F5b Eine nie beobachtete Quelle, die im NACH der Antwort geladenen Bestand fehlt ⇒ überholt.
//   F6  Stand und Beobachtung reisen mit der gespeicherten Antwort; Beschädigtes verwirft sie nicht.
import { describe, expect, it } from "vitest";
import type { AnswerResult } from "../../apps/web/src/api/types";
import {
  type FragenArbeitsstand,
  antwortFrische,
  arbeitsstandLesen,
  arbeitsstandSchreiben,
  beobachtungAus,
  quellenStandAus,
} from "../../apps/web/src/lib/fragenArbeitsstand";

const AM = "2026-10-01T08:00:00.000Z";
const VORHER = "2026-09-30T08:00:00.000Z";
const NACHHER = "2026-10-02T08:00:00.000Z";

function speicher(): Pick<Storage, "getItem" | "setItem" | "removeItem"> & {
  inhalt: Map<string, string>;
} {
  const inhalt = new Map<string, string>();
  return {
    inhalt,
    getItem: (k) => inhalt.get(k) ?? null,
    setItem: (k, v) => {
      inhalt.set(k, v);
    },
    removeItem: (k) => {
      inhalt.delete(k);
    },
  };
}

describe("R-0338 · Auffrischen-Vertrag — Regeln", () => {
  it("F1 · der Stand kommt vom Server und gilt nur vollständig", () => {
    expect(quellenStandAus(["ko-1", "ko-2"], { "ko-1": 3, "ko-2": 1 })).toEqual({
      "ko-1": 3,
      "ko-2": 1,
    });
    expect(quellenStandAus([], {})).toEqual({});
    // Eine Quelle ohne Fassung im Serverstand, ein fremder Wert oder kein Stand: kein Stand.
    expect(quellenStandAus(["ko-1", "ko-9"], { "ko-1": 3 })).toBeUndefined();
    expect(quellenStandAus(["ko-1"], { "ko-1": "drei" })).toBeUndefined();
    expect(quellenStandAus(["ko-1"], undefined)).toBeUndefined();
  });

  it("F2 · mit Stand: fehlende, aufgegangene oder neuere Quelle ⇒ überholt", () => {
    const antwort = { quellen: ["ko-1"], stand: { "ko-1": 3 }, am: AM };
    expect(antwortFrische(antwort, [{ id: "ko-1", version: 3 }])).toBe("aktuell");
    expect(antwortFrische(antwort, [{ id: "ko-1", version: 4 }])).toBe("ueberholt");
    expect(antwortFrische(antwort, [])).toBe("ueberholt");
    expect(antwortFrische(antwort, [{ id: "ko-1", version: 3, mergedInto: { koId: "x" } }])).toBe(
      "ueberholt",
    );
    // Ohne geladenen Bestand: ungeprüft, nie still „aktuell".
    expect(antwortFrische(antwort, undefined)).toBe("ungeprueft");
  });

  it("F3 · auseinanderlaufende Fassungen: kennt der Browser eine ÄLTERE, bleibt die Antwort stehen", () => {
    // Der Server las Fassung 4; der Browserbestand ist noch bei 3 — die Antwort ist die neuere.
    const antwort = { quellen: ["ko-1"], stand: { "ko-1": 4 }, am: AM };
    expect(antwortFrische(antwort, [{ id: "ko-1", version: 3 }])).toBe("aktuell");
    // Und sobald der Bestand die Fassung 5 kennt, ist sie überholt.
    expect(antwortFrische(antwort, [{ id: "ko-1", version: 5 }])).toBe("ueberholt");
  });

  it("F4 · ohne Stand (Altbestand): Änderung nach der Antwort, Fehlen oder Unwissen ⇒ überholt", () => {
    const alt = { quellen: ["ko-1"], stand: undefined, am: AM };
    // Kalibrierung: Verlauf nur VOR der Antwort — sie bleibt stehen (ungeprüft, mit Zeitpunkt).
    expect(
      antwortFrische(alt, [{ id: "ko-1", version: 2, history: [{ version: 2, at: VORHER }] }]),
    ).toBe("ungeprueft");
    expect(antwortFrische(alt, [{ id: "ko-1", version: 1, history: [] }])).toBe("ungeprueft");
    // Eine Änderung NACH der Antwort.
    expect(
      antwortFrische(alt, [{ id: "ko-1", version: 3, history: [{ version: 3, at: NACHHER }] }]),
    ).toBe("ueberholt");
    // Quelle entfernt (Papierkorb, nicht mehr sichtbar).
    expect(antwortFrische(alt, [])).toBe("ueberholt");
    // Nicht zu entscheiden: spätere Fassung ohne Verlauf, oder kein lesbarer Zeitpunkt.
    expect(antwortFrische(alt, [{ id: "ko-1", version: 2 }])).toBe("ueberholt");
    expect(antwortFrische({ ...alt, am: null }, [{ id: "ko-1", version: 1, history: [] }])).toBe(
      "ueberholt",
    );
  });

  it("F5 · ohne Stand, mit Beobachtung: nur eine spätere Fassung macht überholt", () => {
    const beobachtet = beobachtungAus(["ko-1", "ko-2"], [{ id: "ko-1", version: 2 }]);
    expect(beobachtet).toEqual({ "ko-1": 2 });
    const frisch = { quellen: ["ko-1", "ko-2"], stand: undefined, beobachtet, am: AM };
    const vorDerAntwort = Date.parse(VORHER);
    const nachDerAntwort = Date.parse(NACHHER);
    // ko-1 trägt Fassung 2 ohne Verlauf — beobachtet war 2: keine Änderung nach der Antwort.
    // ko-2 kannte die Fläche nie; solange der Bestand noch der von damals ist, belegt sein Fehlen
    // keine Änderung nach der Antwort.
    expect(antwortFrische(frisch, [{ id: "ko-1", version: 2 }], vorDerAntwort)).toBe("ungeprueft");
    expect(antwortFrische(frisch, [{ id: "ko-1", version: 3 }], vorDerAntwort)).toBe("ueberholt");
    // Was beim Eintreffen da war und jetzt fehlt, ist entfernt worden.
    expect(antwortFrische(frisch, [], vorDerAntwort)).toBe("ueberholt");
  });

  it("F5b · Ben, Nacharbeit 5: die nie beobachtete Quelle fehlt auch im NACH der Antwort geladenen Bestand ⇒ überholt", () => {
    const frisch = {
      quellen: ["ko-1", "ko-2"],
      stand: undefined,
      beobachtet: { "ko-1": 2 },
      am: AM,
    };
    const bestand = [{ id: "ko-1", version: 2 }];
    // Kalibrierung: Bestand von vor der Antwort — die Ausnahme gilt noch.
    expect(antwortFrische(frisch, bestand, Date.parse(VORHER))).toBe("ungeprueft");
    // Bestand NACH der Antwort aufgefrischt, ko-2 fehlt weiterhin: keine Ausnahme mehr.
    expect(antwortFrische(frisch, bestand, Date.parse(NACHHER))).toBe("ueberholt");
    // Dasselbe für eine gespeicherte LEERE Beobachtung (der Bestand war beim Eintreffen nicht da).
    expect(antwortFrische({ ...frisch, beobachtet: {} }, bestand, Date.parse(NACHHER))).toBe(
      "ueberholt",
    );
  });

  it("F6 · Stand und Beobachtung reisen mit; Beschädigtes verwirft die Antwort nicht", () => {
    const s = speicher();
    const stand: FragenArbeitsstand = {
      entwurf: "",
      antwort: {
        frage: "Wie oft wird Ventil V4 geprüft?",
        result: { answered: true, sources: ["ko-1"] } as unknown as AnswerResult,
        receipt: "beleg-1",
        verschlossen: [],
        gapId: null,
        angezeigtAm: AM,
        serverQuellenStand: { "ko-1": 3 },
        beobachtet: { "ko-1": 3 },
      },
      startadressen: [],
    };
    arbeitsstandSchreiben(s, "u1", stand);
    const gelesen = arbeitsstandLesen(s, "u1")?.antwort;
    expect(gelesen?.serverQuellenStand).toEqual({ "ko-1": 3 });
    expect(gelesen?.beobachtet).toEqual({ "ko-1": 3 });

    const [schluessel, roh] = [...s.inhalt.entries()][0] as [string, string];
    const kaputt = JSON.parse(roh);
    kaputt.antwort.serverQuellenStand = { "ko-1": "drei" };
    // Ein Eintrag des früheren, nie ausgelieferten Stands trug einen Browserwert unter
    // `quellenStand` — er wird nicht als Serverstand gelesen.
    kaputt.antwort.quellenStand = { "ko-1": 3 };
    s.setItem(schluessel, JSON.stringify(kaputt));
    const nachher = arbeitsstandLesen(s, "u1")?.antwort;
    expect(nachher?.frage).toBe("Wie oft wird Ventil V4 geprüft?");
    expect(nachher?.serverQuellenStand).toBeUndefined();
  });
});
