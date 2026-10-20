// ================================================================================================
// produkt:20261011:peter-p06 · P06-AC08 — SIMULATION: ZÄHLPRÜFUNG DER ANGABEN, KEINE AUSFÜHRUNG.
// ================================================================================================
//
// DIES IST AUSDRÜCKLICH DIE SIMULATION (Bens Befund zu Nacharbeit 2: „Der grüne Test belegt die
// Rechenlogik, keinen Agentenaufwand für dieselbe erledigte Aufgabe"). Sie bleibt als Gegenprobe
// der Rechenlogik stehen. Den AUSGEFÜHRTEN Vergleich — beide Wege erledigen dieselbe Aufgabe über
// die echten Arbeitswege, Ergebnisse werden verglichen — misst
// `tests/vormachen-routine/agentenvergleich-ausgefuehrt.test.ts`.
//
// Gezählt wird hier nur, wie viele Angaben (Zeichen der Nutzlast) ein Agent formulieren müsste:
//   BASELINE   je Lauf jeden Schritt vollständig angeben und das Einreichen einzeln bestätigen;
//   ROUTINE    einmalig Vormachen (über die Arbeitswege-Annahme des Dienstes), Vorschau, EINE
//              Korrektur, Bestätigung; je Lauf jeden Schritt freigeben — der Außenschritt mit
//              Anforderung und Bestätigung genau dieser Ausführung.
// Keine Humanstudie, kein Modell, keine HTTP-Ausführung der Arbeit selbst.
import { describe, expect, it } from "vitest";
import { type ArbeitswegBeobachtung, VormachenDienst } from "../../services/app/src/vormachen";

interface Zaehler {
  aufrufe: number;
  zeichen: number;
}

const neu = (): Zaehler => ({ aufrufe: 0, zeichen: 0 });
const zaehle = (z: Zaehler, angabe?: unknown): void => {
  z.aufrufe += 1;
  z.zeichen += angabe === undefined ? 0 : JSON.stringify(angabe).length;
};

/** Die fiktive Aufgabe — dieselben Angaben für Baseline und Vormachen. */
const AUFGABE: readonly ArbeitswegBeobachtung[] = [
  {
    host: "klarwerk_web",
    vorgang: "entwurf_anlegen",
    beschreibung: "Entwurf anlegen",
    rohwert: "Angebot Musterfirma Beispiel GmbH 48.250 EUR",
  },
  {
    host: "klarwerk_web",
    vorgang: "entwurf_speichern",
    beschreibung: "Entwurf speichern",
    rohwert: "Angebot Musterfirma Beispiel GmbH 48.250 EUR",
  },
  {
    host: "klarwerk_web",
    vorgang: "zur_pruefung_einreichen",
    beschreibung: "Entwurf zur Prüfung einreichen",
    rohwert: null,
  },
];

const LAEUFE = 5;
const KONTO = "konto-simulation";

describe("P06-AC08 · SIMULATION der Angaben einschließlich Korrektur (keine Ausführung)", () => {
  it("rechnet einmaligen Aufwand, Korrektur und Laufaufwand und benennt den Ausgleichspunkt", async () => {
    const dienst = new VormachenDienst();

    const baselineJeLauf = neu();
    for (const schritt of AUFGABE) {
      zaehle(baselineJeLauf, schritt);
    }
    zaehle(baselineJeLauf, { bestaetigt: true, vorgang: "zur_pruefung_einreichen" });

    const einmalig = neu();
    const korrektur = neu();
    const start = {
      host: "klarwerk_web",
      vorgaenge: ["entwurf_anlegen", "entwurf_speichern", "zur_pruefung_einreichen"],
      zweck: "Angebotsnotiz für Musterfirma einreichen",
    };
    zaehle(einmalig, start);
    const s = dienst.starte(KONTO, start);
    // Die sichtbare Lernanzeige des Clients — keine Angabe des Agenten, deshalb nicht gezählt.
    dienst.meldeSichtbar(KONTO, "klarwerk_web", "client-simulation");
    for (const schritt of AUFGABE) {
      zaehle(einmalig, schritt);
      expect(dienst.beobachteArbeitsweg(KONTO, schritt, "client-simulation")).not.toBeNull();
    }
    zaehle(einmalig);
    dienst.vorschau(KONTO, s.id);
    const eingabe = { nr: 1, beschreibung: "Entwurf für das Angebot anlegen" };
    zaehle(korrektur, eingabe);
    const v = dienst.korrigiere(KONTO, s.id, eingabe);
    zaehle(korrektur);
    zaehle(einmalig, { stand: v.stand });
    const routine = await dienst.bestaetige(KONTO, s.id, { stand: v.stand });

    const laeufe: Zaehler[] = [];
    for (let lauf = 0; lauf < LAEUFE; lauf += 1) {
      const z = neu();
      for (const schritt of routine.schritte) {
        zaehle(z);
        if (!schritt.aussenwirkung) {
          await dienst.gibSchrittFrei(KONTO, routine.id, schritt.id, undefined);
          continue;
        }
        const kennung = await dienst
          .gibSchrittFrei(KONTO, routine.id, schritt.id, undefined)
          .then(() => "")
          .catch((e: { details: { ausfuehrung: { id: string } } }) => e.details.ausfuehrung.id);
        const bestaetigung = { ausfuehrung: kennung };
        zaehle(z, { bestaetigung });
        const frei = await dienst.gibSchrittFrei(KONTO, routine.id, schritt.id, bestaetigung);
        expect(frei.art).toBe("aussenaktion_bestaetigt");
      }
      laeufe.push(z);
    }
    const routineJeLauf = laeufe[0] as Zaehler;
    expect(new Set(laeufe.map((z) => z.aufrufe)).size).toBe(1);

    const vorab = {
      aufrufe: einmalig.aufrufe + korrektur.aufrufe,
      zeichen: einmalig.zeichen + korrektur.zeichen,
    };
    let ausgleichZeichen: number | null = null;
    const zeilen = [];
    for (let n = 1; n <= LAEUFE; n += 1) {
      const b = { aufrufe: n * baselineJeLauf.aufrufe, zeichen: n * baselineJeLauf.zeichen };
      const r = {
        aufrufe: vorab.aufrufe + n * routineJeLauf.aufrufe,
        zeichen: vorab.zeichen + n * routineJeLauf.zeichen,
      };
      if (ausgleichZeichen === null && r.zeichen <= b.zeichen) {
        ausgleichZeichen = n;
      }
      zeilen.push({ laeufe: n, baseline: b, routine: r });
    }
    console.log(
      JSON.stringify(
        {
          kriterium: "P06-AC08",
          art: "SIMULATION (Zählung der Angaben, keine ausgeführte Arbeit, keine Humanstudie)",
          baselineJeLauf,
          routineEinmalig: einmalig,
          korrektur,
          routineJeLauf,
          zeilen,
          ausgleichNachLaeufenZeichen: ausgleichZeichen,
        },
        null,
        2,
      ),
    );

    expect(korrektur.aufrufe).toBe(2);
    expect(korrektur.zeichen).toBeGreaterThan(0);
    // Je Lauf: jeder Schritt einzeln, der Außenschritt mit zwei Zügen (Anforderung, Bestätigung).
    expect(routineJeLauf.aufrufe).toBe(AUFGABE.length + 1);
    expect(baselineJeLauf.aufrufe).toBe(AUFGABE.length + 1);
    expect(routineJeLauf.zeichen).toBeLessThan(baselineJeLauf.zeichen);
    expect(ausgleichZeichen).not.toBeNull();
  });
});
