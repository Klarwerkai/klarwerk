// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04, K5) — DIE PASSAGE ÜBERSTEHT DEN NEUAUFBAU.
// ================================================================================================
//
// Befund nacharbeit-2 (Modell-Smoke, 390 × 844): nach dem Neuaufbau der Fragenseite stand am
// Wechsel Aussage → Fundstelle „Die Passage liegt dieser Ansicht nicht vor" — die Passagen lebten
// nur im flüchtigen Zustand der Seite, die Prüfung selbst kam aus dem Arbeitsstand zurück. Jetzt
// reisen die Passagen mit der Prüfung im Arbeitsstand. Gemessen am echten Lese-/Schreibweg mit
// fiktivem Inhalt; beschädigte Einträge ergeben „keine Passagen", nie eine geratene.
import { describe, expect, it } from "vitest";
import type { AnswerResult, ReferenzPruefung } from "../../apps/web/src/api/types";
import {
  arbeitsstandLesen,
  arbeitsstandSchreiben,
} from "../../apps/web/src/lib/fragenArbeitsstand";

function speicher() {
  const daten = new Map<string, string>();
  return {
    getItem: (k: string) => daten.get(k) ?? null,
    setItem: (k: string, v: string) => {
      daten.set(k, v);
    },
    removeItem: (k: string) => {
      daten.delete(k);
    },
    daten,
  };
}

const PRUEFUNG = {
  richtlinie: "referenzpruefung-v1",
  pruefId: "ref_fiktiv",
  status: "geprueft",
  rollen: { antwort: "deterministic", pruefer: "cloud" },
  aussagen: [],
  hinweise: [],
  globaleAktualitaet: "nicht_behauptet",
  ausCache: false,
  messung: { dauerMs: 1, modellaufrufe: 1 },
  versuch: { nummer: 1, hoechstens: 2 },
} as unknown as ReferenzPruefung;

const ANTWORT = {
  frage: "Wann wird die Hebebühne H9 geprüft?",
  result: { answered: true, sources: ["ko-fiktiv"] } as unknown as AnswerResult,
  receipt: "beleg-fiktiv",
  verschlossen: [],
  gapId: null,
  angezeigtAm: "2026-10-13T08:00:00.000Z",
  referenzpruefung: PRUEFUNG,
  aussageTexte: [["aus_1", "Die Hebebühne H9 wird vor jeder Schicht geprüft."]] as [
    string,
    string,
  ][],
};

describe("REF-04 · K5 — Passagen im Arbeitsstand", () => {
  it("P1 · Passagen je Fundstelle werden mit der Prüfung geschrieben und wieder gelesen", () => {
    const s = speicher();
    const auszuege: [string, string][] = [["fs_1", "Vor jeder Schicht wird H9 geprüft."]];
    arbeitsstandSchreiben(s, "konto-fiktiv", {
      entwurf: "",
      antwort: { ...ANTWORT, fundstellenAuszuege: auszuege },
      startadressen: [],
    });
    const gelesen = arbeitsstandLesen(s, "konto-fiktiv");
    expect(gelesen?.antwort?.fundstellenAuszuege).toEqual(auszuege);
    expect(gelesen?.antwort?.referenzpruefung?.pruefId).toBe("ref_fiktiv");
  });

  it("P2 · ein beschädigter Eintrag ergibt keine Passagen, die Antwort bleibt lesbar", () => {
    const s = speicher();
    arbeitsstandSchreiben(s, "konto-fiktiv", {
      entwurf: "",
      antwort: ANTWORT,
      startadressen: [],
    });
    const schluessel = [...s.daten.keys()][0] as string;
    const roh = JSON.parse(s.daten.get(schluessel) as string) as {
      antwort: Record<string, unknown>;
    };
    roh.antwort.fundstellenAuszuege = [["fs_1", 42]];
    s.daten.set(schluessel, JSON.stringify(roh));
    const gelesen = arbeitsstandLesen(s, "konto-fiktiv");
    expect(gelesen?.antwort?.frage).toBe(ANTWORT.frage);
    expect(gelesen?.antwort?.fundstellenAuszuege).toBeUndefined();
  });
});
