// ================================================================================================
// PEDI 28.09.2026 · ERGÄNZUNG 1 — DIE REGELN DES ARBEITSSTANDS DER FRAGENSEITE, OHNE BROWSER.
// ================================================================================================
//
// Geprüft wird `apps/web/src/lib/fragenArbeitsstand.ts` gegen die vier Zusagen der Ergänzung:
//   R1  Der Stand gehört EINEM Konto — ein anderes Konto liest nichts, ohne Konto gibt es nichts.
//   R2  Die Antwort kommt mit ihren Quellen, ihrem Beleg und ihrer Lücken-Id zurück, wie sie stand.
//   R3  Verworfen ist verworfen: ein leerer Stand löscht den Eintrag, er taucht nicht wieder auf.
//   R4  Kaputte oder gesperrte Speicher kippen die Seite nicht — sie heißen „nichts aufzunehmen".
//   R5  Der Hinweis kündigt nur an, was wirklich aufgenommen wurde.
import { describe, expect, it } from "vitest";
import type { AnswerResult } from "../../apps/web/src/api/types";
import {
  type FragenArbeitsstand,
  arbeitsstandLesen,
  arbeitsstandSchreiben,
  belegNochGueltig,
  startadresseMarke,
  wiederaufnahmeAus,
} from "../../apps/web/src/lib/fragenArbeitsstand";

function speicher(): Storage & { inhalt: Map<string, string> } {
  const inhalt = new Map<string, string>();
  return {
    inhalt,
    get length() {
      return inhalt.size;
    },
    clear: () => inhalt.clear(),
    key: (i: number) => [...inhalt.keys()][i] ?? null,
    getItem: (k: string) => inhalt.get(k) ?? null,
    setItem: (k: string, v: string) => {
      inhalt.set(k, v);
    },
    removeItem: (k: string) => {
      inhalt.delete(k);
    },
  };
}

const RESULT = {
  answered: true,
  answer: "Ventil V4 wird jährlich geprüft [1].",
  knowledgeClass: "gesichert",
  trust: 90,
  sources: ["ko-1", "ko-2"],
  citedSources: ["ko-1"],
  steps: [],
  demo: false,
} as unknown as AnswerResult;

const STAND: FragenArbeitsstand = {
  entwurf: "Wie oft wird Pumpe P2",
  antwort: {
    frage: "Wie oft wird Ventil V4 geprüft?",
    result: RESULT,
    receipt: "beleg-1",
    verschlossen: [],
    gapId: null,
    angezeigtAm: "2026-09-29T08:15:00.000Z",
  },
  startadressen: [],
};

describe("Ergänzung 1 · Arbeitsstand der Fragenseite — Regeln", () => {
  it("R1 · der Stand gehört genau einem Konto; ein anderes Konto und „kein Konto“ lesen nichts", () => {
    const s = speicher();
    arbeitsstandSchreiben(s, "u1", STAND);
    expect(arbeitsstandLesen(s, "u1")).toEqual(STAND);
    expect(arbeitsstandLesen(s, "u2")).toBeNull();
    expect(arbeitsstandLesen(s, null)).toBeNull();
    // Ohne Konto wird auch nicht geschrieben.
    arbeitsstandSchreiben(s, null, STAND);
    expect(s.inhalt.size).toBe(1);
    // Die Kennung steckt im Schlüssel — zwei Konten, zwei Einträge.
    arbeitsstandSchreiben(s, "u2", { entwurf: "Eigene Frage", antwort: null, startadressen: [] });
    expect(s.inhalt.size).toBe(2);
    expect(arbeitsstandLesen(s, "u1")?.entwurf).toBe(STAND.entwurf);
    expect(arbeitsstandLesen(s, "u2")?.entwurf).toBe("Eigene Frage");
  });

  it("R2 · die Antwort kommt mit Quellen, Zuordnung, Beleg und Zeitpunkt unverändert zurück", () => {
    const s = speicher();
    arbeitsstandSchreiben(s, "u1", STAND);
    const zurueck = arbeitsstandLesen(s, "u1")?.antwort;
    expect(zurueck?.result.sources).toEqual(["ko-1", "ko-2"]);
    expect(zurueck?.result.citedSources).toEqual(["ko-1"]);
    expect(zurueck?.result.answer).toBe(RESULT.answer);
    expect(zurueck?.receipt).toBe("beleg-1");
    expect(zurueck?.angezeigtAm).toBe("2026-09-29T08:15:00.000Z");
  });

  it("R3 · ein leerer Stand löscht den Eintrag — der verworfene Entwurf taucht nicht wieder auf", () => {
    const s = speicher();
    arbeitsstandSchreiben(s, "u1", { entwurf: "Halbe Frage", antwort: null, startadressen: [] });
    expect(arbeitsstandLesen(s, "u1")?.entwurf).toBe("Halbe Frage");
    arbeitsstandSchreiben(s, "u1", { entwurf: "   ", antwort: null, startadressen: [] });
    expect(s.inhalt.size).toBe(0);
    expect(arbeitsstandLesen(s, "u1")).toBeNull();
    // Mit stehender Antwort bleibt nur die Antwort — der Entwurf ist fort.
    arbeitsstandSchreiben(s, "u1", { ...STAND, entwurf: "" });
    expect(arbeitsstandLesen(s, "u1")?.entwurf).toBe("");
    expect(arbeitsstandLesen(s, "u1")?.antwort?.frage).toBe(STAND.antwort?.frage);
  });

  it("R4 · kaputte Einträge und verweigerte Speicher enden still in „nichts aufzunehmen“", () => {
    const s = speicher();
    const schluessel = (): string => [...s.inhalt.keys()][0] ?? "";
    arbeitsstandSchreiben(s, "u1", STAND);
    const k = schluessel();
    for (const kaputt of [
      "{kein json",
      "null",
      "[]",
      JSON.stringify({ entwurf: 42 }),
      JSON.stringify({ entwurf: "", antwort: { frage: "x", result: {}, receipt: "" } }),
    ]) {
      s.inhalt.set(k, kaputt);
      expect(arbeitsstandLesen(s, "u1"), kaputt).toBeNull();
    }
    // Eine beschädigte Antwort nimmt den Entwurf nicht mit.
    s.inhalt.set(
      k,
      JSON.stringify({ entwurf: "Rest", antwort: { ...STAND.antwort, angezeigtAm: "gestern" } }),
    );
    expect(arbeitsstandLesen(s, "u1")).toEqual({
      entwurf: "Rest",
      antwort: null,
      startadressen: [],
    });

    const wirft = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(arbeitsstandLesen(wirft, "u1")).toBeNull();
    expect(() => arbeitsstandSchreiben(wirft, "u1", STAND)).not.toThrow();
    expect(arbeitsstandLesen(undefined, "u1")).toBeNull();
  });

  it("R5 · der Hinweis nennt nur, was wirklich aufgenommen wurde", () => {
    expect(wiederaufnahmeAus(null, false)).toBeNull();
    expect(wiederaufnahmeAus(STAND, false)).toEqual({
      entwurf: true,
      antwortAm: "2026-09-29T08:15:00.000Z",
    });
    // Steht im Feld genau die beantwortete Frage, ist das kein ungesendeter Entwurf.
    expect(
      wiederaufnahmeAus({ ...STAND, entwurf: " Wie oft wird Ventil V4 geprüft? " }, false),
    ).toEqual({ entwurf: false, antwortAm: "2026-09-29T08:15:00.000Z" });
    // Eine Startfrage aus der Adresse steht im Feld — dann wird kein Entwurf angekündigt.
    expect(
      wiederaufnahmeAus({ entwurf: "Halbe Frage", antwort: null, startadressen: [] }, true),
    ).toBeNull();
    expect(
      wiederaufnahmeAus({ entwurf: "Halbe Frage", antwort: null, startadressen: [] }, false),
    ).toEqual({
      entwurf: true,
      antwortAm: null,
    });
  });

  it("R6 · Ben R1, F2: eine übernommene Startadresse hält den Eintrag — auch bei leerem Feld", () => {
    const s = speicher();
    const marke = startadresseMarke("default", "Startfrage", false);
    expect(marke).not.toBeNull();
    arbeitsstandSchreiben(s, "u1", {
      entwurf: "",
      antwort: null,
      startadressen: [marke as string],
    });
    // Das bewusst geleerte Feld bleibt leer UND die Adresse bleibt als verbraucht gemerkt.
    expect(arbeitsstandLesen(s, "u1")).toEqual({
      entwurf: "",
      antwort: null,
      startadressen: [marke as string],
    });
    // Ohne Marke ist der leere Stand wirklich leer und fort.
    arbeitsstandSchreiben(s, "u1", { entwurf: "", antwort: null, startadressen: [] });
    expect(s.inhalt.size).toBe(0);
  });

  it("R7 · die Marke unterscheidet Navigation, Antwortwunsch und Frage — und fehlt ohne Frage", () => {
    expect(startadresseMarke("default", null, true)).toBeNull();
    const a = startadresseMarke("default", "Ventil", true);
    expect(startadresseMarke("default", "Ventil", true)).toBe(a);
    expect(startadresseMarke("k2", "Ventil", true)).not.toBe(a);
    expect(startadresseMarke("default", "Ventil", false)).not.toBe(a);
    expect(startadresseMarke("default", "Ventile", true)).not.toBe(a);
  });

  it("R8 · Ben R1, F8: der Antwortbeleg gilt knapp 30 Minuten — ohne Beleg oder Zeit gar nicht", () => {
    const am = "2026-09-29T08:00:00.000Z";
    const t0 = Date.parse(am);
    expect(belegNochGueltig("beleg", am, t0 + 60_000)).toBe(true);
    expect(belegNochGueltig("beleg", am, t0 + 28 * 60_000)).toBe(true);
    expect(belegNochGueltig("beleg", am, t0 + 29 * 60_000)).toBe(false);
    expect(belegNochGueltig("beleg", am, t0 + 1_800_001)).toBe(false);
    expect(belegNochGueltig("", am, t0)).toBe(false);
    expect(belegNochGueltig("beleg", null, t0)).toBe(false);
    expect(belegNochGueltig("beleg", "kaputt", t0)).toBe(false);
  });
});
