// ================================================================================================
// JOB 1531 · D1 (M-5, Anker S2) — DIE DEKLARIERTE ZUORDNUNG, UND WAS SIE NICHT TUT.
// ================================================================================================
//
// S2: „‚klep' findet ‚Ventil' nicht: literaler Token-Schnitt und `ILIKE`, keine Synonyme, keine
// Uebersetzung, keine Embeddings."
//
// Diese Datei prueft die deterministische Antwort darauf — und ebenso scharf ihre Grenzen. Denn
// eine Synonymerweiterung kann auf drei Weisen falsch werden, und alle drei sind hier Faelle:
//
//   Z — SIE ERFINDET. Eine Zuordnung ohne Fundstelle ist eine Meinung, die wie eine Messung
//       aussieht. Genau diesen Fehler hat mir BEN heute in JOB 1521 nachgewiesen (die
//       unbelegte Drei-Ueberschriften-Schwelle). Z1 laesst ihn nicht noch einmal zu.
//   E — SIE NIMMT WEG. Ein Aufrufer, der deckelt, darf nie eine ECHTE Eingabe zugunsten einer
//       ergaenzten verlieren. Deshalb stehen ergaenzte Terme immer HINTEN.
//   G — SIE GREIFT ZU WEIT. Kein Netz, kein Modell, keine Ableitung, kein Vorfilter.
import { describe, expect, it } from "vitest";
import {
  S2_ERWEITERUNG_GRENZE,
  SUCH_ZUORDNUNGEN,
  expandSearchTerms,
  normalizeSearchTerms,
} from "../../services/knowledge-object/src/search-projection";

describe("S2 · Z — jede Zuordnung ist belegt", () => {
  it("Z1 · kein Eintrag ohne Fundstelle", () => {
    // Der Fall, der diese Datei traegt: wer die Tabelle erweitert, braucht eine Quelle.
    for (const zuordnung of SUCH_ZUORDNUNGEN) {
      expect(zuordnung.quelle.trim().length, `${zuordnung.begriffe} ohne Quelle`).toBeGreaterThan(
        10,
      );
      expect(zuordnung.quelle, `${zuordnung.begriffe}: Quelle nennt keine Kennung`).toMatch(
        /OFFEN\.md|\.md:\d+|BEN-PRUEFUNG/,
      );
    }
  });

  it("Z2 · jede Zuordnung hat mindestens zwei Begriffe", () => {
    // Ein einzelner Begriff ist keine Zuordnung, sondern ein Eintrag ohne Wirkung.
    for (const zuordnung of SUCH_ZUORDNUNGEN) {
      expect(zuordnung.begriffe.length).toBeGreaterThanOrEqual(2);
      expect(new Set(zuordnung.begriffe).size, "doppelter Begriff").toBe(zuordnung.begriffe.length);
    }
  });

  it("Z3 · alle Begriffe sind schon normalisiert", () => {
    // Die Tabelle wird gegen BEREINIGTE Terme geprueft. Ein Eintrag mit Grossbuchstaben oder
    // Leerraum traefe nie — er saehe aus, als wirkte er, und wirkte nicht.
    for (const zuordnung of SUCH_ZUORDNUNGEN) {
      for (const begriff of zuordnung.begriffe) {
        expect(normalizeSearchTerms([begriff]), `${begriff} ist nicht normalisiert`).toEqual([
          begriff,
        ]);
      }
    }
  });

  it("Z4 · die beiden Faelle aus OFFEN.md sind enthalten", () => {
    const alle = SUCH_ZUORDNUNGEN.flatMap((z) => z.begriffe);
    expect(alle).toContain("klep");
    expect(alle).toContain("ventil");
    expect(alle).toContain("urlaubsregelung");
    expect(alle).toContain("urlaubszeiten");
  });
});

describe("S2 · F — die Erweiterung findet, was gemeint ist", () => {
  it("F1 · klep findet ventil", () => {
    // Der namensgebende Fall.
    expect(expandSearchTerms(["klep"])).toEqual(["klep", "ventil"]);
  });

  it("F2 · und ventil findet klep — die Zuordnung gilt in beide Richtungen", () => {
    expect(expandSearchTerms(["ventil"])).toEqual(["ventil", "klep"]);
  });

  it("F3 · urlaubsregelung findet urlaubszeiten", () => {
    expect(expandSearchTerms(["urlaubsregelung"])).toEqual(["urlaubsregelung", "urlaubszeiten"]);
  });

  it("F4 · die ganze Kette: Eingabe -> Bereinigung -> Erweiterung", () => {
    // Kein nachgebauter Eingang: `normalizeSearchTerms` ist die echte Hausfunktion.
    expect(expandSearchTerms(normalizeSearchTerms(["  KLEP  "]))).toEqual(["klep", "ventil"]);
  });
});

describe("S2 · E — sie nimmt nichts weg und sortiert nichts um", () => {
  it("E1 · ergaenzte Terme stehen HINTEN, echte Eingaben zuerst", () => {
    // Der Grund ist der Deckel: `KoSearchQuery.limit` schneidet quellseitig. Stuenden ergaenzte
    // Terme vorn, verloere eine gedeckelte Abfrage zuerst das, was der Nutzer wirklich eingab.
    expect(expandSearchTerms(["klep", "dichtung"])).toEqual(["klep", "dichtung", "ventil"]);
  });

  it("E2 · die Reihenfolge der Eingabe bleibt erhalten", () => {
    expect(expandSearchTerms(["b", "a", "c"])).toEqual(["b", "a", "c"]);
  });

  it("E3 · ohne Treffer in der Tabelle ist die Ausgabe die Eingabe", () => {
    const eingabe = ["dichtung", "flansch"];
    expect(expandSearchTerms(eingabe)).toEqual(eingabe);
    expect(S2_ERWEITERUNG_GRENZE.entferntTerme).toBe(false);
  });

  it("E4 · nichts wird doppelt, auch wenn beide Seiten eines Paares eingegeben werden", () => {
    expect(expandSearchTerms(["klep", "ventil"])).toEqual(["klep", "ventil"]);
  });

  it("E5 · eine leere Eingabe bleibt leer", () => {
    expect(expandSearchTerms([])).toEqual([]);
  });

  it("E6 · zwei Aufrufe liefern dasselbe", () => {
    // Der Index wird einmal gebaut; ein geteilter Zustand duerfte nicht durchschlagen.
    expect(expandSearchTerms(["klep"])).toEqual(expandSearchTerms(["klep"]));
  });
});

describe("S2 · G — sie greift nicht zu weit", () => {
  it("G1 · nichts wird abgeleitet — nur deklarierte Paare treffen", () => {
    // „ventile" (Plural) steht nicht in der Tabelle. Wer hier eine Stammform-Regel einbaut, baut
    // die „Uebersetzung", die S2 ausschliesst — und tut es unbelegt.
    expect(expandSearchTerms(["ventile"])).toEqual(["ventile"]);
    expect(expandSearchTerms(["urlaub"])).toEqual(["urlaub"]);
    expect(S2_ERWEITERUNG_GRENZE.leitetAb).toBe(false);
  });

  it("G2 · kein Teilstring-Treffer", () => {
    // „klepper" enthaelt „klep". Ein Teilstringabgleich haette hier ergaenzt — und damit eine
    // Zuordnung erfunden, die niemand erklaert hat.
    expect(expandSearchTerms(["klepper"])).toEqual(["klepper"]);
  });

  it("G3 · die Grenzen stehen als lesbares Datum da", () => {
    expect(S2_ERWEITERUNG_GRENZE.brauchtNetz).toBe(false);
    expect(S2_ERWEITERUNG_GRENZE.ruehrtVorfilterAn).toBe(false);
  });

  it("G4 · normalizeSearchTerms bleibt unveraendert — der Panelspiegel haengt daran", () => {
    // `tests/app/word-addin.test.ts:1106` misst die Aequivalenz der buildlosen Spiegelfassung im
    // Aufgabenfenster gegen genau diese Funktion. Erweiterte sie sich um Synonyme, waere der
    // Spiegel sofort falsch — und jene Datei gehoert PRO3 (Null-Diff); ihr Pfad steht in der
    // Rueckgabe und im Kopf von `search-projection.ts`.
    //
    // Der Dateiname des Fensters steht hier BEWUSST nicht ausgeschrieben:
    // `tests/app/klara-regressionsinventar.test.ts:67-69` fuehrt eine Achse, deren Muster genau
    // diesen Namen im DATEIINHALT sucht — wer ihn erwaehnt, landet im Klara-Inventar. Diese Datei
    // ist kein Klara-Regressionstest; sie dort einzutragen waere die falsche Buchung.
    // Der volle Pfad steht im Kopf von `search-projection.ts` und in der Rueckgabe.
    expect(normalizeSearchTerms(["klep"])).toEqual(["klep"]);
    expect(normalizeSearchTerms(["KLEP", "klep"])).toEqual(["klep"]);
  });
});
