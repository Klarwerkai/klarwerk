// ================================================================================================
// JOB 4233 · TEST 7 — VORLEGEN, ENTSCHEIDEN, ERNEUT LESEN: DER TEXT BLEIBT DER GEBUNDENE.
// ================================================================================================
//
// Der Startvertrag, wörtlich (`gesamtanweisung-types.ts:12-14`): „Keine dynamische Ersetzung eines
// eingebundenen Bausteins in einer bereits freigegebenen Anweisung. Neuere Fassung bedeutet
// Aktualisierungsvorschlag."
//
// Mit dem neuen Textträger bekommt dieser Satz eine zweite Hälfte, die vorher gar nicht geprüft
// werden konnte: nicht nur die NUMMER bleibt gebunden, sondern der WORTLAUT. Wer eine Anweisung
// entschieden hat, liest morgen denselben Text — auch wenn der Eintrag inzwischen dreimal
// überarbeitet wurde.
//
// GEPRÜFT WIRD ÜBER EINEN BESTANDSWECHSEL: derselbe Anweisungsbestand, ein neuer Eintragsbestand
// (der Wissenseintrag hat inzwischen Fassung 2). Das ist der „Neustart" dieses Falls — der Dienst
// wird neu gebaut, die Anweisung kommt aus der Ablage.
//
// GEGENPROBE: den Textträger auf die heutige Fassung umbiegen → dieser Fall wird rot, und zwar an
// der entschiedenen Anweisung, wo der Schaden am grössten wäre.
import { describe, expect, it } from "vitest";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import {
  InMemoryAnweisungRepo,
  eintrag,
  kennungen,
  koLeser,
  sichtbarAls,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const TEXT_EINS = "Erst absperren, dann entlüften.";
const TEXT_ZWEI = "Neu: erst entlüften, dann absperren.";

const NUR_EINS = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 1 }, [
    { version: 1, bodyHtml: `<h2>Absperren</h2><p>${TEXT_EINS}</p>` },
  ]),
];

const INZWISCHEN_ZWEI = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2 }, [
    { version: 1, bodyHtml: `<h2>Absperren</h2><p>${TEXT_EINS}</p>` },
    { version: 2, bodyHtml: `<h2>Entlüften</h2><p>${TEXT_ZWEI}</p>` },
  ]),
];

const ANNA = sichtbarAls({ id: "anna", darfPruefen: true });

function dienstUeber(repo: InMemoryAnweisungRepo, eintraege: typeof NUR_EINS) {
  return new GesamtanweisungDienst({
    repo,
    ko: koLeser(eintraege),
    jetzt: uhr(),
    kennung: kennungen("b"),
  });
}

describe("JOB 4233 · die Bindung hält über Vorlegen, Entscheiden und Neustart", () => {
  it("nach der Entscheidung liest ein Mensch weiterhin den Text der gebundenen Fassung", async () => {
    const repo = new InMemoryAnweisungRepo();
    const dienst = dienstUeber(repo, NUR_EINS);

    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );
    const vorgelegt = await dienst.vorlegen(mit.id, mit.version, ANNA);
    const entschieden = await dienst.entscheiden(
      vorgelegt.id,
      vorgelegt.version,
      "angenommen",
      ANNA,
    );
    expect(entschieden.stand).toBe("entschieden");

    // NEUSTART: neuer Dienst, derselbe Anweisungsbestand, inzwischen gibt es Fassung 2.
    const spaeter = dienstUeber(repo, INZWISCHEN_ZWEI);
    const stand = await spaeter.lesen(entschieden.id, ANNA);

    expect(stand.stand).toBe("entschieden");
    const baustein = stand.bausteine[0];
    expect(baustein?.koVersion).toBe(1);
    expect(baustein?.rumpfHtml).toContain(TEXT_EINS);
    expect(baustein?.rumpfHtml).not.toContain(TEXT_ZWEI);
    expect(JSON.stringify(stand)).not.toContain(TEXT_ZWEI);
  });

  it("der Aktualisierungsvorschlag steht DANEBEN — er ersetzt weder Nummer noch Text", async () => {
    const repo = new InMemoryAnweisungRepo();
    const dienst = dienstUeber(repo, NUR_EINS);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const mit = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );

    const spaeter = dienstUeber(repo, INZWISCHEN_ZWEI);
    const stand = await spaeter.lesen(mit.id, ANNA);

    expect(stand.bausteine[0]?.aktualisierungsvorschlag).toEqual({ aufVersion: 2 });
    expect(stand.bausteine[0]?.aktuelleKoVersion).toBe(2);
    expect(stand.bausteine[0]?.herkunft?.fassungAm).toBe("2026-09-01T09:00:00.000Z");
    expect(stand.bausteine[0]?.rumpfHtml).toContain(TEXT_EINS);
  });

  it("wer die neue Fassung WILL, nimmt sie ausdrücklich auf — und bekommt dann ihren Text", async () => {
    const repo = new InMemoryAnweisungRepo();
    const dienst = dienstUeber(repo, INZWISCHEN_ZWEI);
    const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
    const eins = await dienst.bausteinAufnehmen(
      a.id,
      a.version,
      { koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
      ANNA,
    );
    const zwei = await dienst.bausteinAufnehmen(
      eins.id,
      eins.version,
      { koId: "ko-a", koVersion: 2, nachweisHash: "h-2" },
      ANNA,
    );

    const stand = await dienst.lesen(zwei.id, ANNA);
    expect(stand.bausteine).toHaveLength(2);
    expect(stand.bausteine[0]?.rumpfHtml).toContain(TEXT_EINS);
    expect(stand.bausteine[1]?.rumpfHtml).toContain(TEXT_ZWEI);
  });
});
