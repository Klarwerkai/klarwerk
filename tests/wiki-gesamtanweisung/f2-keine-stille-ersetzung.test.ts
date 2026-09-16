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
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

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
    // Der Eintrag existiert und ist sichtbar, aber zur gebundenen Fassung 1 gibt es keinen Satz.
    const ohneSatz = [
      eintrag({ id: "ko-2", title: "Heutiger Titel", version: 4 }, [{ version: 4 }]),
    ];
    const { dienst } = bauDienst(ohneSatz);
    const a = await dienst.anlegen({ titel: "Abschaltung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-2", koVersion: 1, nachweisHash: null },
      LESER,
    );
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
