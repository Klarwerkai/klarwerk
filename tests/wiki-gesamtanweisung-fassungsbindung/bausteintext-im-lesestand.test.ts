// ================================================================================================
// JOB 4233 · TEST 3 — DER LESESTAND TRÄGT DEN TEXT DER GEBUNDENEN FASSUNG.
// ================================================================================================
//
// DER AUSGANGSFEHLER (`recherche/pruefung/BEFUNDE.md:11`, T-003): „Historischer Text wurde eindeutig
// mitgegeben; Dienstantwort enthält Herkunft und Metadaten, aber nicht diesen Text. Der Nutzer kann
// die vollständige Anweisung daraus nicht lesen."
//
// Gemessen am Produkt: `BausteinInhalt` (`gesamtanweisung-types.ts:103-107`) trägt drei Felder —
// Tabellenüberschriften, Abbildungen, Geltung. Einen Textträger gibt es nicht; `inhaltAusFassung`
// (`gesamtanweisung-service.ts:76-93`) liest den Rumpf und wirft ihn danach weg. Damit kann eine
// Anweisung prinzipiell nicht gelesen werden — der Gegenstand des Auftrags.
//
// DIE ZWEITE, SCHÄRFERE ZUSAGE steht im selben Fall: es ist der Text der GEBUNDENEN Fassung, nicht
// der der heutigen. Beide Fassungen tragen hier einen unverwechselbaren Satz, und der Fall prüft
// beide Richtungen — der eine muss da sein, der andere darf nirgends auftauchen.
//
// GEGENPROBE: den Textträger auf die heutige Fassung umbiegen (in `fassungslagenFuer` statt
// `satz.snapshot.bodyHtml` das `eintrag.bodyHtml` nehmen) → dieser Fall wird rot.
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "../wiki-gesamtanweisung/pruefstand";

const TEXT_EINS = "Erst absperren, dann entlüften.";
const TEXT_ZWEI = "Ganz anders: erst entlüften.";

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2, bodyHtml: `<p>${TEXT_ZWEI}</p>` }, [
    { version: 1, bodyHtml: `<h2>Absperren</h2><p>${TEXT_EINS}</p>` },
    { version: 2, bodyHtml: `<p>${TEXT_ZWEI}</p>` },
  ]),
];

const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });

async function anweisungMitGebundenerFassungEins() {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
  const mitBaustein = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
    ANNA,
  );
  return { dienst, repo, anweisung: mitBaustein };
}

describe("JOB 4233 · der gebundene Text steht im Lesestand", () => {
  it("der Baustein trägt den Rumpf GENAU der gebundenen Fassung", async () => {
    const { dienst, anweisung } = await anweisungMitGebundenerFassungEins();
    const stand = await dienst.lesen(anweisung.id, ANNA);

    const baustein = stand.bausteine[0];
    expect(baustein).toBeDefined();
    expect(baustein?.rumpfHtml).toContain(TEXT_EINS);
    expect(baustein?.rumpfHtml).toContain("<h2>Absperren</h2>");
  });

  it("der Text der HEUTIGEN Fassung taucht nirgends auf — auch nicht am Draht", async () => {
    const { dienst, anweisung } = await anweisungMitGebundenerFassungEins();
    const stand = await dienst.lesen(anweisung.id, ANNA);

    const draht = JSON.stringify(stand);
    expect(draht).toContain(TEXT_EINS);
    expect(draht).not.toContain(TEXT_ZWEI);
    // Und die Bindung selbst bleibt sichtbar: gebunden 1, heute 2, Vorschlag DANEBEN.
    expect(stand.bausteine[0]?.koVersion).toBe(1);
    expect(stand.bausteine[0]?.aktuelleKoVersion).toBe(2);
    expect(stand.bausteine[0]?.aktualisierungsvorschlag).toEqual({ aufVersion: 2 });
  });

  it("der Prüfstand bleibt in Gestalt und Aussage unverändert — keine zweite Dokumentwahrheit", async () => {
    // Lieferung 4 des Auftrags, wörtlich: der Textträger gehört an den Lesestand, NICHT in
    // `BausteinInhalt` — sonst flösse ein Dokumentrumpf über `standAufnehmen` in den festgehaltenen
    // Prüfstand (`gesamtanweisung_staende.aufnahme`) und läge ein zweites Mal im Bestand.
    const { dienst, repo, anweisung } = await anweisungMitGebundenerFassungEins();
    const aufnahme = await repo.standLesen(anweisung.id, anweisung.version);

    expect(aufnahme).toBeDefined();
    expect(JSON.stringify(aufnahme)).not.toContain(TEXT_EINS);
    expect(Object.keys(aufnahme?.bausteine[0]?.inhalt ?? {}).sort()).toEqual([
      "abbildungen",
      "geltung",
      "tabellenUeberschriften",
    ]);

    // Der Vergleich zweier Stände spricht damit weiterhin über Tatsachen, nicht über Rumpf-HTML.
    const zweiter = await dienst.bausteinAufnehmen(
      anweisung.id,
      anweisung.version,
      { koId: "ko-a", koVersion: 2, nachweisHash: "h-2" },
      ANNA,
    );
    const vergleich = await dienst.vergleichen(
      anweisung.id,
      anweisung.version,
      zweiter.version,
      ANNA,
    );
    expect(JSON.stringify(vergleich)).not.toContain(TEXT_EINS);
    expect(JSON.stringify(vergleich)).not.toContain(TEXT_ZWEI);
  });
});
