// ================================================================================================
// JOB 3363 · RUNDE 2 — DIE SPRACHSPERRE, ZAHN FÜR ZAHN.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEM ROUTENTEST STEHT. `kandidatenvariante-route.test.ts` (K9) misst am
// ECHTEN Endpunkt, dass kein Sprachwert eine Serverausnahme auslöst — das ist der Befund, den BEN
// gemeldet hat, und er ist dort vollständig gedeckt. Beim Gegenproben zeigte sich aber etwas, das
// hier ausdrücklich gesagt wird statt verschwiegen zu werden:
//
//     Gegen die ECHTE Lieferung (`languages: ["de","en"]`) ist JEDER der beiden Zähne von
//     `textFuerSprache` FÜR SICH ALLEIN ausreichend. Schaltet man einen ab, bleibt K9 grün.
//
// Ein Schutz, der nicht einzeln kippt, ist unbelegt — man weiss nicht, ob er wirkt oder nur
// danebensteht. Diese Datei gibt jedem Zahn den Fall, in dem er ALLEIN entscheidet. Gemessen wird
// die Funktion direkt: sie ist rein, und die Fälle brauchen eine Lieferung mit einer anderen Form
// als die eine echte. Das ist kein Nachbau des Produkts — die Funktion IST der Gegenstand.
import { describe, expect, it } from "vitest";
import {
  type LokalisierungsRecord,
  lokalisierungsPaket,
  textFuerSprache,
} from "../../services/app/src/lesevarianten";

/** Ein Datensatz in der Form der Lieferung — die Abweichungen setzt jeder Fall selbst. */
function datensatz(zusatz: Record<string, unknown> = {}): LokalisierungsRecord {
  return {
    key: "S01",
    semantic_id: "S01",
    original_language: "en",
    confluence_id: "25067523",
    translation_status: "draft_translation_not_business_approval",
    en: { title: "Original", paragraphs: ["First paragraph."] },
    de: { title: "Fassung", paragraphs: ["Erster Absatz."] },
    ...zusatz,
  } as LokalisierungsRecord;
}

describe("JOB 3363 R2 · textFuerSprache — jeder Zahn hat seinen eigenen Fall", () => {
  it("Z0 · KALIBRIERUNG: eine geführte Sprache mit gültigem Text kommt durch", () => {
    const text = textFuerSprache({ languages: ["de", "en"] }, datensatz(), "de");
    expect(text).toEqual({ title: "Fassung", paragraphs: ["Erster Absatz."] });
  });

  it("Z1 · NUR ZAHN 1 entscheidet: der Datensatz TRÄGT einen gültigen `nl`-Text, die Lieferung führt die Sprache aber nicht", () => {
    // Zahn 2 würde diesen Text durchlassen — er ist formgültig. Allein die Frage „führt die
    // Lieferung diese Sprache?" hält ihn auf. Fällt Zahn 1, kippt genau dieser Fall.
    const record = datensatz({ nl: { title: "Uitgave", paragraphs: ["Eerste alinea."] } });
    expect(textFuerSprache({ languages: ["de", "en"] }, record, "nl")).toBeUndefined();
    // Und die Gegenrichtung, damit der Fall nicht durch ein pauschales `undefined` grün wird:
    // führt die Lieferung „nl", kommt derselbe Text durch.
    expect(textFuerSprache({ languages: ["de", "en", "nl"] }, record, "nl")).toEqual({
      title: "Uitgave",
      paragraphs: ["Eerste alinea."],
    });
  });

  it("Z2 · NUR ZAHN 2 entscheidet: die Sprache IST geführt, der Datensatz trägt dort aber keinen Text", () => {
    // Zahn 1 lässt „de" passieren. Was dann dasteht, entscheidet allein die Formprüfung — und ohne
    // sie liefe der Aufrufer in `text.paragraphs.length` und würfe, genau wie vor dieser Runde.
    const alsZeichenkette = datensatz({ de: "kaputt" });
    const ohneAbsaetze = datensatz({ de: { title: "Fassung" } });
    const falscheAbsaetze = datensatz({ de: { title: "Fassung", paragraphs: [1, 2] } });
    const alsNull = datensatz({ de: null });
    expect({
      zeichenkette: textFuerSprache({ languages: ["de"] }, alsZeichenkette, "de"),
      ohneAbsaetze: textFuerSprache({ languages: ["de"] }, ohneAbsaetze, "de"),
      falscheAbsaetze: textFuerSprache({ languages: ["de"] }, falscheAbsaetze, "de"),
      alsNull: textFuerSprache({ languages: ["de"] }, alsNull, "de"),
    }).toEqual({
      zeichenkette: undefined,
      ohneAbsaetze: undefined,
      falscheAbsaetze: undefined,
      alsNull: undefined,
    });
  });

  it("Z3 · ein Prototypschlüssel wird auch dann nicht erreicht, wenn die Lieferung ihn als Sprache FÜHRT", () => {
    // Der unwahrscheinliche, aber nicht ausgeschlossene Fall: eine Lieferung nennt „constructor" in
    // ihrer Sprachliste. Zahn 1 lässt ihn dann durch — aufgehalten wird er von ZAHN 2, weil vom
    // Prototyp eine Funktion bzw. `Object.prototype` käme und keines davon Titel und Absätze trägt.
    // Dieser Fall misst denselben Zahn wie Z2 aus der anderen Richtung; ein eigener `hasOwn`-Riegel
    // dafür wäre tote Verteidigung (die Gegenprobe blieb ohne ihn grün) und steht deshalb nicht da.
    expect(
      textFuerSprache({ languages: ["de", "constructor"] }, datensatz(), "constructor"),
    ).toBeUndefined();
    expect(
      textFuerSprache({ languages: ["de", "__proto__"] }, datensatz(), "__proto__"),
    ).toBeUndefined();
  });

  it("Z4 · gegen die ECHTE Lieferung: geführt sind genau „de“ und „en“, und S01 liefert dort Text", () => {
    // Die Bindung an die wirkliche Datei — damit die Fälle oben nicht an einer erfundenen Form
    // hängen. Was hier steht, ist gelesen, nicht abgeschrieben.
    const paket = lokalisierungsPaket("advisor-ict-en-v1");
    const record = paket?.records.find((r) => r.key === "S01");
    if (!paket || !record) {
      throw new Error("Die Lieferung advisor-ict-en-v1 oder ihr Datensatz S01 fehlt.");
    }
    expect(paket.languages).toEqual(["de", "en"]);
    expect(textFuerSprache(paket, record, "de")?.title).toBe(record.de?.title);
    // Und der Wert, an dem Runde 1 mit HTTP 500 zerbrach:
    expect(textFuerSprache(paket, record, "original_language")).toBeUndefined();
  });
});
