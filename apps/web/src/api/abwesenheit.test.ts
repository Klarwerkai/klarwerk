import { describe, expect, it } from "vitest";
import { alsAbwesenheit, istAbwesend } from "./abwesenheit";
import { ApiError } from "./client";

// ================================================================================================
// JOB 577 — DER 404-VERTRAG, EINZELN GEBUNDEN.
// ================================================================================================
//
// Die Grenze dieses Vertrags ist sein ganzer Wert: Er verschluckt GENAU 404 und sonst nichts.
// Verschluckte er mehr, würden echte Ladefehler zu stillen Leerzuständen — und ein Nutzer säße vor
// einer leeren Fläche, die aussieht wie „nichts vorhanden", während in Wahrheit der Server brennt.
// Die Fälle unten binden beide Richtungen einzeln, damit eine Verallgemeinerung nicht unbemerkt
// durchgeht.

const gibZurueck =
  <T>(wert: T) =>
  async (): Promise<T> =>
    wert;
const wirft = (fehler: unknown) => async (): Promise<never> => {
  throw fehler;
};

describe("istAbwesend — was gilt als abwesend", () => {
  it("ein ApiError mit 404 ist Abwesenheit", () => {
    expect(istAbwesend(new ApiError(404, "NOT_FOUND", "weg"))).toBe(true);
  });

  it("ein 403 ist KEINE Abwesenheit — die Routen dieses Hauses antworten fail-closed mit 404", () => {
    // Ein 403, das dennoch ankommt, zeigt eine Route an, die von der Hausform abweicht. Es zu
    // verschlucken hieße, genau diese Abweichung zu verbergen.
    expect(istAbwesend(new ApiError(403, "FORBIDDEN", "nein"))).toBe(false);
  });

  it("ein Zeitablauf (408) ist KEINE Abwesenheit", () => {
    expect(istAbwesend(new ApiError(408, "TIMEOUT", "zu lang"))).toBe(false);
  });

  it("ein 500 ist KEINE Abwesenheit — echte Ladefehler bleiben Fehler", () => {
    expect(istAbwesend(new ApiError(500, "INTERNAL", "kaputt"))).toBe(false);
  });

  it("ein 401 ist KEINE Abwesenheit — Abmeldung ist kein leerer Bestand", () => {
    expect(istAbwesend(new ApiError(401, "UNAUTHENTICATED", "wer?"))).toBe(false);
  });

  it("ein gewoehnlicher Error mit 404 im Text ist KEINE Abwesenheit", () => {
    expect(istAbwesend(new Error("404 not found"))).toBe(false);
  });

  it("ein Fremdobjekt mit status 404 ist KEINE Abwesenheit — geprueft wird die Herkunft", () => {
    // Eine reine Formprüfung auf `.status` würde hier `true` sagen. Der Vertrag gilt aber nur für
    // Antworten DIESES Clients.
    expect(istAbwesend({ status: 404 })).toBe(false);
  });

  it("null und undefined sind KEINE Abwesenheit", () => {
    expect(istAbwesend(null)).toBe(false);
    expect(istAbwesend(undefined)).toBe(false);
  });
});

describe("alsAbwesenheit — die Schichtverschiebung", () => {
  it("ein 404 wird zu null — aus dem Fehlerkanal in den Datenkanal", async () => {
    const abruf = alsAbwesenheit(wirft(new ApiError(404, "NOT_FOUND", "weg")));
    await expect(abruf()).resolves.toBeNull();
  });

  it("Kalibrierung: ein erfolgreicher Abruf kommt UNVERAENDERT durch", async () => {
    // Ohne diesen Fall waere „kein Fehler" auch dann erfuellt, wenn die Huelle alles verschluckt.
    const nutzlast = [{ category: "Recht", contributors: [{ authorId: "u1" }] }];
    const abruf = alsAbwesenheit(gibZurueck(nutzlast));
    await expect(abruf()).resolves.toBe(nutzlast);
  });

  it("ein leeres Array bleibt ein leeres Array — nicht null", async () => {
    // „Leer" und „nicht vorhanden" sind verschiedene Aussagen; die Huelle darf sie nicht angleichen.
    const abruf = alsAbwesenheit(gibZurueck([]));
    await expect(abruf()).resolves.toEqual([]);
  });

  it("ein 403 wirft weiter", async () => {
    const abruf = alsAbwesenheit(wirft(new ApiError(403, "FORBIDDEN", "nein")));
    await expect(abruf()).rejects.toBeInstanceOf(ApiError);
  });

  it("ein 500 wirft weiter — der Fehlerkanal bleibt fuer echte Fehler offen", async () => {
    const abruf = alsAbwesenheit(wirft(new ApiError(500, "INTERNAL", "kaputt")));
    await expect(abruf()).rejects.toThrow("kaputt");
  });

  it("ein Zeitablauf wirft weiter", async () => {
    const abruf = alsAbwesenheit(wirft(new ApiError(408, "TIMEOUT", "zu lang")));
    await expect(abruf()).rejects.toThrow("zu lang");
  });

  it("ein Nicht-ApiError wirft unveraendert weiter — auch der Typ bleibt erhalten", async () => {
    const eigen = new TypeError("Netzwerk weg");
    const abruf = alsAbwesenheit(wirft(eigen));
    await expect(abruf()).rejects.toBe(eigen);
  });

  it("die Huelle ruft den Abruf genau einmal auf", async () => {
    let aufrufe = 0;
    const abruf = alsAbwesenheit(async () => {
      aufrufe += 1;
      return "x";
    });
    await abruf();
    expect(aufrufe).toBe(1);
  });

  it("die Huelle ist wiederverwendbar — jeder Aufruf laeuft neu", async () => {
    let aufrufe = 0;
    const abruf = alsAbwesenheit(async () => {
      aufrufe += 1;
      if (aufrufe === 1) {
        throw new ApiError(404, "NOT_FOUND", "weg");
      }
      return "da";
    });
    await expect(abruf()).resolves.toBeNull();
    await expect(abruf()).resolves.toBe("da");
  });
});
