// ================================================================================================
// R-0348 · Ben, Nacharbeit 2, Befund 1 — DER THEMENANKER FÄLLT BEIM BEGRENZEN NICHT HERAUS.
// ================================================================================================
//
// Auf „Wie werden Urlaubstage berechnet?" folgen mehrere „Und bei …?"-Nachfragen. Bis Nacharbeit 2
// begrenzte `fadenNachAntwort` auf die jüngsten drei Fragen; nach drei Nachfragen erwähnte keine
// übermittelte Frage mehr Urlaubstage. Jetzt bleibt die erste Frage als Anker, dazu die jüngsten.
import { describe, expect, it } from "vitest";
import {
  FADEN_MAX_FRAGEN,
  fadenBegrenzen,
  fadenFuerAnfrage,
  fadenNachAntwort,
} from "../../apps/web/src/lib/gespraechsfaden";

const ANKER = "Wie werden Urlaubstage berechnet?";
const NACHFRAGEN = ["Und in Teilzeit?", "Und bei Azubis?", "Und in Elternzeit?", "Und im Minijob?"];

describe("R-0348 · Faden-Regeln", () => {
  it("R1 · nach vier Nachfragen trägt die nächste Anfrage weiterhin die themengebende Erstfrage", () => {
    let faden: string[] = [];
    for (const frage of [ANKER, ...NACHFRAGEN]) {
      faden = fadenNachAntwort(faden, frage);
      expect(faden[0]).toBe(ANKER);
      expect(faden.length).toBeLessThanOrEqual(FADEN_MAX_FRAGEN);
    }
    const gesendet = fadenFuerAnfrage(faden, "Und bei Kurzarbeit?");
    expect(gesendet).toEqual([ANKER, "Und in Elternzeit?", "Und im Minijob?"]);
  });

  it("R2 · KALIBRIERUNG: ohne Anker hätte die reine Jüngsten-Regel das Thema verloren", () => {
    const alleFragen = [ANKER, ...NACHFRAGEN];
    expect(alleFragen.slice(-FADEN_MAX_FRAGEN)).not.toContain(ANKER);
    expect(fadenBegrenzen(alleFragen)).toContain(ANKER);
  });

  it("R3 · Auffrischungen verschieben den Anker nicht und schicken sich nicht selbst mit", () => {
    const faden = fadenNachAntwort(fadenNachAntwort([], ANKER), "Und in Teilzeit?");
    expect(fadenNachAntwort(faden, ANKER)).toEqual(faden);
    expect(fadenFuerAnfrage(faden, "Und in Teilzeit?")).toEqual([ANKER]);
  });
});
