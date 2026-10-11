// ================================================================================================
// R-0305/R-1099 · Ben, Nacharbeit 10 — DER FRAGEKONTEXT REIST MIT DER GESPEICHERTEN ANTWORT.
// ================================================================================================
//
// Die Ablage der Fragenseite (`lib/fragenArbeitsstand.ts`) trägt jetzt `fragekontext`, damit die
// Zweitmeinung nach Neuladen oder Wiederaufnahme mit dem Kontext der Antwort fragt. Drei
// Lesarten, und keine wird in eine andere umgedeutet:
//   S1  ein Objekt     → kommt unverändert zurück
//   S2  `null`         → „ohne Kontext gefragt" bleibt `null`
//   S3  fehlt          → Altstand: das Feld fehlt auch beim Lesen (UNBEKANNT)
//   S4  beschädigt     → UNBEKANNT, nie „ohne Kontext"
import { describe, expect, it } from "vitest";
import type { AnswerResult } from "../../apps/web/src/api/types";
import {
  type GespeicherteAntwort,
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
    roh: daten,
  };
}

const ANTWORT: GespeicherteAntwort = {
  frage: "Wie wird das Werkzeug vorgewärmt?",
  result: {
    answered: true,
    answer: "Auf 60 Grad [1].",
    knowledgeClass: "gesichert",
    trust: 90,
    sources: ["ko-1"],
    steps: [],
    demo: false,
  } as unknown as AnswerResult,
  receipt: "beleg",
  verschlossen: [],
  gapId: null,
  angezeigtAm: "2026-10-01T08:00:00.000Z",
};

function rundweg(antwort: GespeicherteAntwort): GespeicherteAntwort | null | undefined {
  const s = speicher();
  arbeitsstandSchreiben(s, "u1", { entwurf: "", antwort, startadressen: [] });
  return arbeitsstandLesen(s, "u1")?.antwort;
}

describe("R-0305/R-1099 · Fragekontext im Arbeitsstand", () => {
  it("S1 · ein Kontext kommt unverändert zurück", () => {
    const kontext = { werk: "Werk Nord", schicht: "Frühschicht" };
    expect(rundweg({ ...ANTWORT, fragekontext: kontext })?.fragekontext).toEqual(kontext);
  });

  it("S2 · „ohne Kontext gefragt“ bleibt null", () => {
    const gelesen = rundweg({ ...ANTWORT, fragekontext: null });
    expect(gelesen?.fragekontext).toBeNull();
  });

  it("S3 · Altstand ohne Feld: das Feld fehlt — unbekannt, nicht „ohne Kontext“", () => {
    const gelesen = rundweg(ANTWORT);
    expect(gelesen).not.toBeNull();
    expect(gelesen ? "fragekontext" in gelesen : true).toBe(false);
  });

  it("S4 · ein beschädigter Kontext wird unbekannt, nie „ohne Kontext“", () => {
    const s = speicher();
    const roh = { entwurf: "", antwort: { ...ANTWORT, fragekontext: { werk: 7 } } };
    s.setItem("kw.fragen.arbeitsstand.v1:u1", JSON.stringify({ ...roh, startadressen: [] }));
    const gelesen = arbeitsstandLesen(s, "u1")?.antwort;
    expect(gelesen).toBeTruthy();
    expect(gelesen ? "fragekontext" in gelesen : true).toBe(false);
  });
});
