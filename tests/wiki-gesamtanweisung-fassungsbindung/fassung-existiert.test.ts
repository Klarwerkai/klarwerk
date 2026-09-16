// ================================================================================================
// JOB 4233 · TEST 1 — OHNE BELEGTE FASSUNG KEIN SCHREIBVORGANG.
// ================================================================================================
//
// DER AUSGANGSFEHLER, gemessen und nicht vermutet (`recherche/pruefung/BEFUNDE.md:9`, T-002):
// „Gesamtanweisung akzeptiert Version 999 bei einer Quelle mit nur Version 1/2; Bestand und
// Anweisungsversion ändern sich."
//
// RUNDE 2 — DIE REGEL IST JETZT DIE BESTELLTE UND KEINE MILDERE. Runde 1 hat den Nummernbereich
// bis zur heutigen Fassung genügen lassen („eine fehlende Aufbewahrung ist keine fehlende
// Fassung"). BEN hat das mit ROT zurückgewiesen (Korrekturpflicht 1, wörtlich): „Fehlender Satz
// oder gescheiterter Historienabruf dürfen keinen Schreibvorgang auslösen." Genau das prüfen die
// Fälle unten — in BEIDEN Spielarten, denn sie sehen für den Dienst gleich aus und sind es auch:
// ohne Fassungssatz gibt es keinen Beleg, und was nicht belegt ist, wird nicht gebunden.
//
// WAS DIESE FÄLLE BEWEISEN, und warum sie mehr prüfen als einen Fehlercode: der Bestand wird VOR
// und NACH dem abgelehnten Versuch vollständig verglichen (`repo.abdruck()`, Lehre JOB 4141 R1 —
// „ein `bestand`-Feld zählt erst als Nachweis, wenn seine Vorher-/Nachher-Werte tatsächlich
// verglichen werden"). Eine Route, die ablehnt UND vorher geschrieben hat, fällt hier auf.
//
// GEGENPROBE: die Existenzprüfung in `bausteinAufnehmen` entfernen → diese Fälle werden rot, und
// zwar namentlich an `schreibvorgaenge` und am Abdruck.
import { describe, expect, it } from "vitest";
import type {
  AnweisungFassungssatz,
  AnweisungKoLeser,
} from "../../services/knowledge-object/src/gesamtanweisung-service";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import {
  InMemoryAnweisungRepo,
  bauDienst,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2 }, [
    { version: 1, bodyHtml: "<p>Erst absperren.</p>" },
    { version: 2, bodyHtml: "<p>Erst absperren, dann entlüften.</p>" },
  ]),
];

/** Anna darf prüfen und sieht deshalb alles — an ihr scheitert nichts an Rechten. */
const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });

async function leereAnweisung() {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const anweisung = await dienst.anlegen({ titel: "Wartung" }, "anna");
  return { dienst, repo, anweisung };
}

describe("JOB 4233 · die gebundene Fassung muss wirklich belegt sein", () => {
  it("Fassung 999 bei einem Eintrag mit 1 und 2 wird abgelehnt — Bestand und Version unverändert", async () => {
    const { dienst, repo, anweisung } = await leereAnweisung();
    const abdruckVorher = repo.abdruck();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;

    await expect(
      dienst.bausteinAufnehmen(
        anweisung.id,
        anweisung.version,
        { koId: "ko-a", koVersion: 999, nachweisHash: "h-999" },
        ANNA,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });

    // KEIN SCHREIBVORGANG: nicht „geschrieben und wieder verworfen", sondern gar nicht erst.
    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher);
    expect(repo.abdruck()).toBe(abdruckVorher);

    // Und am Lesestand ist ebenfalls nichts geschehen — weder ein Baustein noch eine neue Version.
    const stand = await dienst.lesen(anweisung.id, ANNA);
    expect(stand.version).toBe(anweisung.version);
    expect(stand.bausteine).toHaveLength(0);
    expect(stand.unvollstaendig).toBe(false);
  });

  it("die Absage sagt, welche Fassungen belegt sind — der Betrachter darf den Eintrag ohnehin sehen", async () => {
    const { dienst, anweisung } = await leereAnweisung();
    const fehler = await dienst
      .bausteinAufnehmen(
        anweisung.id,
        anweisung.version,
        { koId: "ko-a", koVersion: 999, nachweisHash: null },
        ANNA,
      )
      .then(() => null)
      .catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(Error);
    expect((fehler as { code?: unknown }).code).toBe("INVALID");
    const meldung = (fehler as Error).message;
    expect(meldung).toContain("Diese Fassung gibt es nicht.");
    // Die wirklich BELEGTEN Fassungen, aufsteigend — genau die, die sich auch binden lassen.
    expect(meldung).toContain("Belegt: 1, 2.");
    expect(meldung).not.toContain("999");
  });

  it("KONTROLLFALL: eine vorhandene Fassung wird weiterhin aufgenommen", async () => {
    const { dienst, repo, anweisung } = await leereAnweisung();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;

    const neu = await dienst.bausteinAufnehmen(
      anweisung.id,
      anweisung.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );

    expect(neu.version).toBe(anweisung.version + 1);
    expect(neu.bausteine).toHaveLength(1);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher + 1);
  });

  it("FEHLENDER FASSUNGSSATZ: eine Nummer unterhalb der heutigen Fassung genügt NICHT", async () => {
    // BENs Korrekturpflicht 1 in ihrer schärfsten Form. Der Eintrag steht bei 2, sein Abbild zu
    // Fassung 1 liegt nicht vor. Runde 1 hat hier gebunden („die Nummer hat es ja gegeben") — und
    // damit einen Baustein angelegt, dessen Inhalt niemand je belegen kann. Eine Bindung ohne
    // Gebundenes ist genau das, was der Startvertrag ausschliesst.
    const mitLuecke = [
      eintrag({ id: "ko-l", title: "Mit Lücke", version: 2 }, [
        { version: 2, bodyHtml: "<p>Nur die zweite ist da.</p>" },
      ]),
    ];
    const { dienst, repo } = bauDienst(mitLuecke);
    const anweisung = await dienst.anlegen({ titel: "Störung" }, "anna");
    const abdruckVorher = repo.abdruck();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;

    await expect(
      dienst.bausteinAufnehmen(
        anweisung.id,
        anweisung.version,
        { koId: "ko-l", koVersion: 1, nachweisHash: null },
        ANNA,
      ),
    ).rejects.toMatchObject({ code: "INVALID" });
    expect(repo.abdruck()).toBe(abdruckVorher);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher);

    // Die belegte Fassung 2 bleibt aufnehmbar — die Sperre sperrt nicht zu viel.
    const neu = await dienst.bausteinAufnehmen(
      anweisung.id,
      anweisung.version,
      { koId: "ko-l", koVersion: 2, nachweisHash: null },
      ANNA,
    );
    expect(neu.bausteine[0]?.koVersion).toBe(2);
  });

  it("HISTORIENAUSFALL: scheitert der Fassungsabruf, wird NICHTS gebunden", async () => {
    // BENs Prüfpunkt 4, wörtlich: „Auch ein technischer Fehler von `versionsOf` wird über die leere
    // Liste und den Nummernbereich zur erfolgreichen Aufnahme." Das ist der gefährlichere Zwilling
    // des Falls darüber: der Bestand IST vollständig, nur die Abfrage ist ausgefallen. Fail-closed
    // heisst hier: kein Schreibvorgang, und die Absage nennt keine Fassungen, weil keine bekannt
    // sind — sie behauptet nicht, es gäbe keine.
    const eintraege = [
      eintrag({ id: "ko-h", title: "Historie kaputt", version: 3 }, [
        { version: 1 },
        { version: 2 },
        { version: 3 },
      ]),
    ];
    const kaputt: AnweisungKoLeser = {
      async get(id) {
        return koLeser(eintraege).get(id);
      },
      async versionsOf(): Promise<readonly AnweisungFassungssatz[]> {
        throw new Error("Fassungsabruf ausgefallen (Prüfung JOB 4233 R2).");
      },
    };
    const repo = new InMemoryAnweisungRepo();
    const dienst = new GesamtanweisungDienst({
      repo,
      ko: kaputt,
      jetzt: uhr(),
      kennung: kennungen("b"),
    });
    const anweisung = await dienst.anlegen({ titel: "Störung" }, "anna");
    const abdruckVorher = repo.abdruck();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;

    const fehler = await dienst
      .bausteinAufnehmen(
        anweisung.id,
        anweisung.version,
        { koId: "ko-h", koVersion: 1, nachweisHash: null },
        ANNA,
      )
      .then(() => null)
      .catch((e: unknown) => e);

    expect((fehler as { code?: unknown }).code).toBe("INVALID");
    expect((fehler as Error).message).toBe("Diese Fassung gibt es nicht.");
    expect(repo.abdruck()).toBe(abdruckVorher);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher);
  });

  it("über der heutigen Fassung gibt es nichts mehr — und eine unbrauchbare Nummer auch nicht", async () => {
    const { dienst, repo, anweisung } = await leereAnweisung();
    const abdruckVorher = repo.abdruck();

    for (const koVersion of [3, 0, -1, 1.5]) {
      await expect(
        dienst.bausteinAufnehmen(
          anweisung.id,
          anweisung.version,
          { koId: "ko-a", koVersion, nachweisHash: null },
          ANNA,
        ),
      ).rejects.toMatchObject({ code: "INVALID" });
    }

    expect(repo.abdruck()).toBe(abdruckVorher);
  });
});
