// ================================================================================================
// JOB 4154 · F2 — EINE NEUE FASSUNG ERSETZT DIE GEBUNDENE NICHT STILL.
// ================================================================================================
//
// Startvertrag, zweiter entscheidender Fall:
//   „Neue Version eines eingebundenen Bausteins ersetzt die gebundene Fassung nicht still."
//   „Neuere Fassung bedeutet Aktualisierungsvorschlag."
//
// Der Fehler, gegen den das steht, ist bequem und lautlos: Man speichert nur die Kennung des
// Eintrags und löst beim Lesen „die aktuelle Fassung" auf. Dann steht in einer entschiedenen
// Anweisung morgen etwas anderes als gestern — ohne dass jemand etwas entschieden hätte.
//
// GEGENPROBE: In `fassungslagenFuer` (`gesamtanweisung-service.ts`) den Fassungssatz nicht über
// `f.version === baustein.koVersion` suchen, sondern den letzten nehmen (`.at(-1)`). Dann zeigt der
// Lesestand den neuen Titel, und der erste Fall unten wird namentlich rot.
import { describe, expect, it } from "vitest";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import {
  InMemoryAnweisungRepo,
  bauDienst,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "./pruefstand";

const LESER = sichtbarAls({ id: "anna", darfPruefen: false });

/** Derselbe Eintrag in zwei Fassungen — Fassung 1 gebunden, Fassung 2 ist neuer. */
const EINTRAEGE = [
  eintrag({ id: "ko-1", title: "Ventil schliessen (überarbeitet)", version: 2 }, [
    {
      version: 1,
      title: "Ventil schliessen",
      bodyHtml: "<p>Alte Fassung.</p>",
      at: "2026-08-01T08:00:00.000Z",
    },
    { version: 2, title: "Ventil schliessen (überarbeitet)", bodyHtml: "<p>Neue Fassung.</p>" },
  ]),
];

async function anweisungMitFassungEins() {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const a = await dienst.anlegen({ titel: "Abschaltung" }, "anna");
  const mit = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-1", koVersion: 1, nachweisHash: "h1" },
    LESER,
  );
  return { dienst, repo, anweisung: mit };
}

describe("F2 · keine stille Ersetzung einer gebundenen Fassung", () => {
  it("der Lesestand zeigt die GEBUNDENE Fassung — mit ihrem Titel und ihrem Datum", async () => {
    const { dienst, anweisung } = await anweisungMitFassungEins();
    const stand = await dienst.lesen(anweisung.id, LESER);
    const baustein = stand.bausteine[0];

    expect(baustein?.koVersion).toBe(1);
    expect(baustein?.herkunft?.titel).toBe("Ventil schliessen");
    expect(baustein?.herkunft?.fassungAm).toBe("2026-08-01T08:00:00.000Z");
    // Der überarbeitete Titel taucht in der Herkunft NICHT auf.
    expect(baustein?.herkunft?.titel).not.toContain("überarbeitet");
  });

  it("die neuere Fassung erscheint als VORSCHLAG daneben, nicht als Ersetzung", async () => {
    const { dienst, anweisung } = await anweisungMitFassungEins();
    const stand = await dienst.lesen(anweisung.id, LESER);
    const baustein = stand.bausteine[0];

    expect(baustein?.aktuelleKoVersion).toBe(2);
    expect(baustein?.aktualisierungsvorschlag).toEqual({ aufVersion: 2 });
    // Die Bindung selbst ist unangetastet geblieben.
    expect(baustein?.koVersion).toBe(1);
  });

  it("die Bindung im BESTAND ist durch das Lesen nicht gewandert", async () => {
    const { dienst, repo, anweisung } = await anweisungMitFassungEins();
    const vorher = repo.abdruck();
    await dienst.lesen(anweisung.id, LESER);
    await dienst.lesen(anweisung.id, LESER);
    expect(repo.abdruck()).toBe(vorher);
  });

  it("ohne neuere Fassung gibt es KEINEN Vorschlag — der Vorschlag ist kein Dauerzustand", async () => {
    const { dienst } = bauDienst(EINTRAEGE);
    const a = await dienst.anlegen({ titel: "Abschaltung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-1", koVersion: 2, nachweisHash: "h2" },
      LESER,
    );
    const stand = await dienst.lesen(mit.id, LESER);
    expect(stand.bausteine[0]?.aktualisierungsvorschlag).toBeNull();
    expect(stand.bausteine[0]?.aktuelleKoVersion).toBe(2);
  });

  it("fehlt der Fassungssatz, bleibt die Herkunft LEER statt auf die heutige auszuweichen", async () => {
    // ==============================================================================================
    // JOB 4233 R2 · DER AUFBAU IST NACHGEFÜHRT — DIE ZUSAGE IST DIESELBE GEBLIEBEN.
    // ==============================================================================================
    //
    // BIS HIERHER band dieser Fall die Fassung 1 eines Eintrags, der bei 4 steht und dessen Satz zu
    // 1 gar nicht vorliegt — über `bausteinAufnehmen`. Seit JOB 4233 ist genau das VERBOTEN: eine
    // Fassung ohne Beleg wird nicht mehr gebunden (BENs Korrekturpflicht 1 zu jener Runde:
    // „Fehlender Satz oder gescheiterter Historienabruf dürfen keinen Schreibvorgang auslösen").
    // Der alte Aufbau hätte die neue Pflicht ausgehebelt; er war der WEG zum Zustand, nicht die
    // Zusage.
    //
    // DIE ZUSAGE DIESES FALLS BLEIBT WORTGLEICH: fehlt der Fassungssatz, bleibt die Herkunft leer,
    // der Inhalt unbekannt — und es wird NICHT auf die heutige Fassung ausgewichen. Nur entsteht
    // der Zustand jetzt so, wie er im Betrieb wirklich entsteht: die Fassung wird gebunden, SOLANGE
    // ES SIE GIBT, und verschwindet später aus dem Bestand (Aufbewahrung, Bereinigung, Ausfall).
    // Vorgehen wörtlich aus BENs Promptverbesserung zu JOB 4233 R1: „Fassung zunächst vorhanden
    // aufnehmen, anschließend aus dem Testbestand entfernen und unveränderte Unbekannt-Anzeige
    // prüfen."
    const mitSatz = [
      eintrag({ id: "ko-2", title: "Alter Titel", version: 4 }, [{ version: 1 }, { version: 4 }]),
    ];
    const ohneSatz = [
      eintrag({ id: "ko-2", title: "Heutiger Titel", version: 4 }, [{ version: 4 }]),
    ];
    const repo = new InMemoryAnweisungRepo();
    const bauen = (eintraege: typeof mitSatz): GesamtanweisungDienst =>
      new GesamtanweisungDienst({
        repo,
        ko: koLeser(eintraege),
        jetzt: uhr(),
        kennung: kennungen("b"),
      });

    const vorher = bauen(mitSatz);
    const a = await vorher.anlegen({ titel: "Abschaltung" }, "anna");
    const mit = await vorher.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-2", koVersion: 1, nachweisHash: null },
      LESER,
    );

    // Derselbe Bestand, aber der Fassungssatz 1 liegt nicht mehr vor.
    const dienst = bauen(ohneSatz);
    const stand = await dienst.lesen(mit.id, LESER);

    expect(stand.bausteine[0]?.herkunft).toBeNull();
    expect(stand.bausteine[0]?.inhalt).toEqual({
      tabellenUeberschriften: null,
      abbildungen: null,
      geltung: null,
    });
    // Und trotzdem steht der Aktualisierungsvorschlag da — die heutige Fassung ist ja bekannt.
    expect(stand.bausteine[0]?.aktualisierungsvorschlag).toEqual({ aufVersion: 4 });
  });
});
