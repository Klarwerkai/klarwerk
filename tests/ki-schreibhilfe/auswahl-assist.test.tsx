// @vitest-environment jsdom
// ================================================================================================
// R-0300 — DIE MARKIERUNG ALS ZEICHENVERSATZ, UND DIE SPERRE GEGEN EINE VERALTETE ÜBERNAHME.
// ================================================================================================
//
// `lib/auswahlAssist.ts` an der Funktion selbst. Der gemountete Weg im Standardeditor steht in
// `markierung-standardeditor-mounted.test.tsx`; dort ist eine veraltete Übernahme nicht erreichbar,
// weil jede Eingabe den offenen Vorschlag verwirft (M4). Die Sperre bleibt trotzdem die letzte
// Grenze vor dem Rumpf — und sie wird HIER belegt, nicht dort vorausgesetzt.
//
//   A1  die Markierung wird aus der echten Selection als Versatz und Text gelesen
//   A2  Ersetzen trifft nur die Stelle; Fett davor und die Liste danach bleiben
//   A3  hat sich der Text an der Stelle geändert: `null`, nichts wird geändert
//   A4  Rechtschreibung mit nicht passender Wortzahl: `null` — die Stelle selbst ist gültig
//   A5  ein `<br>` im Absatz geht als Zeilenumbruch an die KI (Ben, Nacharbeit 4)
//
// WARUM `.tsx` OHNE JSX: Der Fall braucht DOM-Typen (`document`, `Selection`, `Text`). Der
// Root-Typcheck (`tsconfig.json`) ist Node-rein und schließt deshalb `tests/**/*.tsx` aus; diese
// Dateien prüft `tsconfig.tests-tsx.json` mit DOM-lib. Als `.ts` zog die Datei
// `lib/auswahlAssist.ts` in den Node-reinen Check (Prüflauf Nacharbeit 3, TS2304/TS2584).
import { afterEach, describe, expect, it } from "vitest";
import {
  type TextAuswahl,
  auswahlImFeld,
  auswahlNochGueltig,
  auswahlUebernehmen,
} from "../../apps/web/src/lib/auswahlAssist";

const SATZ = "Der Kunde recieved den Router.";
const RUMPF = `<p><strong>Wichtig:</strong> ${SATZ}</p><ul><li>Punkt eins</li></ul>`;
// „Wichtig:" (8 Zeichen) + Leerzeichen → der Satz beginnt bei Versatz 9.
const AUSWAHL: TextAuswahl = { start: 9, ende: 9 + SATZ.length, text: SATZ };

afterEach(() => {
  document.body.innerHTML = "";
  document.getSelection()?.removeAllRanges();
});

describe("R-0300 · lib/auswahlAssist", () => {
  it("A1 · liest die Markierung aus der Selection als Versatz und Text", () => {
    const feld = document.createElement("div");
    feld.innerHTML = RUMPF;
    document.body.appendChild(feld);
    const knoten = feld.querySelector("p")?.childNodes[1] as Text;
    const bereich = document.createRange();
    bereich.setStart(knoten, 1);
    bereich.setEnd(knoten, 1 + SATZ.length);
    const auswahl = document.getSelection();
    auswahl?.removeAllRanges();
    auswahl?.addRange(bereich);

    expect(auswahlImFeld(feld, auswahl)).toEqual(AUSWAHL);
  });

  it("A2 · Ersetzen trifft nur die Stelle; Fett und Liste bleiben", () => {
    const neu = auswahlUebernehmen(RUMPF, AUSWAHL, "Der Kunde hat den Router erhalten.", {
      modus: "ersetzen",
      rechtschreibung: false,
    });
    expect(neu).toContain("<strong>Wichtig:</strong> Der Kunde hat den Router erhalten.");
    expect(neu).toContain("<ul><li>Punkt eins</li></ul>");
    expect(neu).not.toContain("recieved");
  });

  it("A3 · die Stelle trägt anderen Text: nichts wird übernommen", () => {
    const geaendert = "<p><strong>Wichtig:</strong> Ganz anderer Satz steht hier jetzt.</p>";
    expect(auswahlNochGueltig(geaendert, AUSWAHL)).toBe(false);
    expect(
      auswahlUebernehmen(geaendert, AUSWAHL, "Der Kunde hat den Router erhalten.", {
        modus: "ersetzen",
        rechtschreibung: false,
      }),
    ).toBeNull();
    expect(
      auswahlUebernehmen(geaendert, AUSWAHL, "Zusatz.", {
        modus: "einfuegen",
        rechtschreibung: false,
      }),
    ).toBeNull();
  });

  it("A5 · ein <br> im Absatz geht als Zeilenumbruch an die KI; Versätze und Übernahme bleiben stimmig", () => {
    // Ben, Nacharbeit 4: „Ventil<br>prüfen" kam als „Ventilprüfen" bei der KI an.
    const MIT_UMBRUCH = "<p>Ventil<br>prüfen</p><p>Danach bleibt.</p>";
    const feld = document.createElement("div");
    feld.innerHTML = MIT_UMBRUCH;
    document.body.appendChild(feld);
    const absatz = feld.querySelector("p");
    const erstes = absatz?.firstChild as Text;
    const letztes = absatz?.lastChild as Text;
    const bereich = document.createRange();
    bereich.setStart(erstes, 0);
    bereich.setEnd(letztes, letztes.data.length);
    const auswahl = document.getSelection();
    auswahl?.removeAllRanges();
    auswahl?.addRange(bereich);

    const markiert = auswahlImFeld(feld, auswahl);
    // Der Text zeigt den Umbruch; der Versatz zählt ihn nicht (6 + 6 Zeichen).
    expect(markiert).toEqual({ start: 0, ende: 12, text: "Ventil\nprüfen" });
    if (markiert === null) {
      return;
    }
    expect(auswahlNochGueltig(MIT_UMBRUCH, markiert)).toBe(true);

    // Rechtschreibung verteilt die Wörter auf die Stücke — der Umbruch bleibt stehen.
    const korrigiert = auswahlUebernehmen(MIT_UMBRUCH, markiert, "Ventile prüfen", {
      modus: "ersetzen",
      rechtschreibung: true,
    });
    expect(korrigiert).toContain("<p>Ventile<br>prüfen</p>");
    expect(korrigiert).toContain("<p>Danach bleibt.</p>");

    // Ein anderer Vorschlag ersetzt die Stelle; seine eigenen Zeilen werden wieder zu <br>.
    const ersetzt = auswahlUebernehmen(MIT_UMBRUCH, markiert, "Ventil sofort\nprüfen", {
      modus: "ersetzen",
      rechtschreibung: false,
    });
    expect(ersetzt).toContain("<p>Ventil sofort<br>prüfen</p>");
    expect(ersetzt).toContain("<p>Danach bleibt.</p>");

    // Ohne den Umbruch ist es nicht mehr dieselbe Stelle — nichts wird übernommen.
    const ohneUmbruch = "<p>Ventilprüfen</p><p>Danach bleibt.</p>";
    expect(auswahlNochGueltig(ohneUmbruch, markiert)).toBe(false);
  });

  it("A4 · Rechtschreibung mit anderer Wortzahl: blockiert, obwohl die Stelle gültig ist", () => {
    expect(auswahlNochGueltig(RUMPF, AUSWAHL)).toBe(true);
    expect(
      auswahlUebernehmen(RUMPF, AUSWAHL, "Der Kunde hat den Router heute erhalten.", {
        modus: "ersetzen",
        rechtschreibung: true,
      }),
    ).toBeNull();
  });
});
